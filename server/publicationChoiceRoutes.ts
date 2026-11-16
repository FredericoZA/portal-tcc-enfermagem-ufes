import type { Express, Request, RequestHandler } from 'express';
import { randomUUID } from 'node:crypto';
import type { AuditLog, ProcessData, SignatureJob } from '../src/types';
import {
  authorMayChangePublication,
  beginPublicationChoice,
  finishPublicationRevocation,
  publicationChoiceView,
} from './workflow/publicationChoice';

interface Ports {
  authenticate: RequestHandler;
  limit?: RequestHandler;
  email: (req: Request) => string | undefined;
  process: (id: string) => ProcessData | undefined;
  master?: (email: string) => boolean;
  access: (email: string, p: ProcessData) => boolean;
  replace: (p: ProcessData) => void;
  jobs: () => SignatureJob[];
  audit: (log: AuditLog) => void;
  persist: () => Promise<void>;
  revoke: (ids: string[]) => Promise<void>;
  destroyPreviousTerms: (p: ProcessData) => Promise<void>;
  term: (p: ProcessData, email: string) => Promise<void>;
}
export function installPublicationChoiceRoutes(app: Pick<Express, 'get' | 'post'>, ports: Ports) {
  const running = new Set<string>();
  const resolve = (req: Request) => {
    const email = ports.email(req);
    const p = ports.process(String(req.params.id));
    return {
      email,
      p,
      allowed: Boolean(
        email && p && authorMayChangePublication(p, email, ports.access(email, p), ports.master?.(email)),
      ),
    };
  };
  app.get('/api/processes/:id/publication-choice', ports.authenticate, (req, res) => {
    res.setHeader('Cache-Control', 'private, no-store');
    const { email, p, allowed } = resolve(req);
    if (!email) return res.status(401).json({ error: 'Entre no Portal para continuar.' });
    if (!p || !allowed)
      return res.status(404).json({ error: 'Solicitação não disponível para este usuário.' });
    return res.json(publicationChoiceView(p, email));
  });
  app.post(
    '/api/processes/:id/publication-choice/edit',
    ports.authenticate,
    ...(ports.limit ? [ports.limit] : []),
    async (req, res) => {
      res.setHeader('Cache-Control', 'private, no-store');
      const { email, p: initial, allowed } = resolve(req);
      if (!email || !initial || !allowed)
        return res.status(404).json({ error: 'Solicitação não disponível para este usuário.' });
      if (running.has(initial.id) || req.body?.expectedRevision !== initial.dataRevision)
        return res.status(409).json({ error: 'Atualize os dados antes de substituir o arquivo.' });
      if (initial.acervo.publicationChange?.status === 'EDITING')
        return res.json(publicationChoiceView(initial, email));
      running.add(initial.id);
      try {
        const current = publicationChoiceView(initial, email);
        const p = beginPublicationChoice(
          initial,
          current,
          ports.jobs(),
          email,
          `publication-${randomUUID()}`,
          new Date().toISOString(),
          true,
        );
        ports.replace(p);
        ports.audit({
          id: `log-${randomUUID()}`,
          processId: p.id,
          actorEmail: email,
          actorRoles: ports.master?.(email) ? ['MASTER_ADMIN'] : ['STUDENT'],
          action: 'PUBLICACAO_ARQUIVOS_EDICAO_INICIADA',
          entityType: 'publication',
          entityId: p.acervo.publicationChange!.id,
          timestamp: p.updatedAt,
        });
        await ports.persist();
        await ports.revoke(p.acervo.publicationChange!.revokeFileIds);
        p.acervo.publicationChange!.status = 'EDITING';
        await ports.persist();
        return res.json(publicationChoiceView(p, email));
      } catch {
        return res
          .status(503)
          .json({
            error:
              'Não foi possível preparar a substituição. Os arquivos permanecem bloqueados no Portal até a conferência do Drive.',
          });
      } finally {
        running.delete(initial.id);
      }
    },
  );
  app.post(
    '/api/processes/:id/publication-choice',
    ports.authenticate,
    ...(ports.limit ? [ports.limit] : []),
    async (req, res) => {
      res.setHeader('Cache-Control', 'private, no-store');
      const { email, p: initial, allowed } = resolve(req);
      if (!email) return res.status(401).json({ error: 'Entre no Portal para continuar.' });
      if (!initial || !allowed)
        return res.status(404).json({ error: 'Solicitação não disponível para este usuário.' });
      if (running.has(initial.id))
        return res
          .status(409)
          .json({ error: 'A solicitação está sendo processada. Atualize a situação antes de repetir.' });
      if (req.body?.confirmed !== true || req.body?.expectedRevision !== initial.dataRevision)
        return res.status(409).json({ error: 'Confira a escolha e atualize os dados antes de confirmar.' });
      const current = initial.acervo?.publicationChange;
      const retry =
        typeof req.body?.requestId === 'string' &&
        current?.id === req.body.requestId &&
        (current.requestedBy === email || ports.master?.(email)) &&
        current.status !== 'COMPLETED';
      if (req.body?.requestId && !retry)
        return res.status(409).json({ error: 'Esta solicitação não está mais pendente para este usuário.' });
      let p = initial;
      running.add(p.id);
      try {
        if (!retry) {
          try {
            p = beginPublicationChoice(
              p,
              {
                publishFullWork: req.body.publishFullWork,
                publishExpandedAbstract: req.body.publishExpandedAbstract,
              },
              ports.jobs(),
              email,
              `publication-${randomUUID()}`,
              new Date().toISOString(),
            );
          } catch (error) {
            return res
              .status(400)
              .json({ error: error instanceof Error ? error.message : 'Escolha inválida.' });
          }
          ports.replace(p);
          ports.audit({
            id: `log-${randomUUID()}`,
            processId: p.id,
            actorEmail: email,
            actorRoles: ports.master?.(email) ? ['MASTER_ADMIN'] : ['STUDENT'],
            action: 'ALTERACAO_PUBLICACAO_SOLICITADA',
            entityType: 'publication',
            entityId: p.acervo!.publicationChange!.id,
            timestamp: p.updatedAt,
            after: {
              publishFullWork: req.body.publishFullWork,
              publishExpandedAbstract: req.body.publishExpandedAbstract,
            },
          });
          await ports.persist();
        }
        const request = p.acervo!.publicationChange!;
        if (request.status === 'REVOKING_DRIVE') {
          try {
            await ports.revoke(request.revokeFileIds);
          } catch {
            request.lastError =
              'Os arquivos estão bloqueados no Portal. A retirada do acesso público no Drive aguarda conclusão.';
            await ports.persist();
            return res.status(202).json(publicationChoiceView(p, email));
          }
          try {
            await ports.destroyPreviousTerms(p);
            request.previousTermsDestroyedAt = new Date().toISOString();
          } catch {
            request.lastError = 'O acesso público foi retirado. A exclusão do termo anterior no Drive aguarda conclusão.';
            await ports.persist();
            return res.status(202).json(publicationChoiceView(p, email));
          }
          finishPublicationRevocation(p, new Date().toISOString());
          await ports.persist();
        }
        if (request.status === 'AWAITING_SIGNATURE') {
          try {
            await ports.term(p, email);
            request.lastError = undefined;
          } catch (error) {
            request.lastError =
              (error as { code?: string })?.code === 'PUBLICATION_CONTACTS_UNVERIFIED'
                ? 'A publicação permanece restrita. O Master precisa confirmar os contatos de todos os autores e do orientador antes da assinatura do novo termo.'
                : 'A escolha foi registrada. A assinatura do novo termo ou a sincronização no Drive aguarda conclusão.';
          }
          await ports.persist();
        }
        return res.status(request.status === 'COMPLETED' ? 200 : 202).json(publicationChoiceView(p, email));
      } catch {
        return res.status(503).json({
          error: 'Não foi possível confirmar a solicitação. Atualize a situação antes de tentar novamente.',
        });
      } finally {
        running.delete(initial.id);
      }
    },
  );
}
