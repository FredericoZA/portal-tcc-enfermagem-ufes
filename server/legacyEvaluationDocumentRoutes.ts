import type { Express, Request, RequestHandler, Response } from 'express';
import type { LegacyAcademicRecord, LegacyAdministrativeFile } from '../src/types/legacyArchive';
import { legacyAdministrativeFiles } from './legacyArchive';
import { verifyLegacyPdf } from './legacyArchiveFiles';

interface Ports {
  authenticate: RequestHandler;
  limit?: RequestHandler;
  email: (req: Request) => string | undefined;
  record: (id: string) => LegacyAcademicRecord | undefined;
  canRead: (record: LegacyAcademicRecord, email: string) => boolean;
  read: (file: LegacyAdministrativeFile) => Promise<Buffer>;
  deliver: (req: Request, res: Response, record: LegacyAcademicRecord, index: number,
    file: LegacyAdministrativeFile, bytes: Buffer) => Promise<void>;
}

/** These authenticated routes expose evaluation instruments only. In particular,
 * becoming a reader cannot reveal invitations, consents or academic PDFs. */
export function installLegacyEvaluationDocumentRoutes(app: Pick<Express, 'get'>, ports: Ports): void {
  const base = '/api/legacy-academic-records/:id/evaluation-documents';
  const resolve = (req: Request) => {
    const email = ports.email(req), record = ports.record(String(req.params.id));
    return { email, record, allowed: Boolean(email && record && ports.canRead(record, email)) };
  };
  app.get(base, ports.authenticate, ...(ports.limit ? [ports.limit] : []), (req, res) => {
    res.setHeader('Cache-Control', 'private, no-store');
    const { email, record, allowed } = resolve(req);
    if (!email) return res.status(401).json({ error: 'Entre no Portal para continuar.' });
    if (!record || !allowed) return res.status(404).json({ error: 'Documentos não disponíveis.' });
    try {
      return res.json(legacyAdministrativeFiles(record).flatMap((file, index) =>
        file.kind === 'AVALIACAO' ? [{ index, kind: file.kind, fileName: file.fileName,
          downloadUrl: `/api/legacy-academic-records/${encodeURIComponent(record.id)}/evaluation-documents/${index}/download` }] : []));
    } catch {
      return res.status(409).json({ error: 'Não foi possível conferir a documentação histórica.' });
    }
  });
  app.get(`${base}/:index/download`, ports.authenticate, ...(ports.limit ? [ports.limit] : []), async (req, res) => {
    res.setHeader('Cache-Control', 'private, no-store, max-age=0');
    const { email, record, allowed } = resolve(req);
    if (!email) return res.status(401).json({ error: 'Entre no Portal para continuar.' });
    const index = /^(0|[1-9]\d?)$/.test(String(req.params.index)) ? Number(req.params.index) : -1;
    if (!record || !allowed || index < 0) return res.status(404).json({ error: 'Documento não disponível.' });
    try {
      const file = legacyAdministrativeFiles(record)[index];
      if (!file || file.kind !== 'AVALIACAO') return res.status(404).json({ error: 'Documento não disponível.' });
      const pdf = verifyLegacyPdf(file, await ports.read(file));
      // Re-read identity, binding and reference after storage I/O. Revocation or
      // replacement during a download must win over the earlier permission.
      const current = resolve(req);
      const currentFile = current.record && legacyAdministrativeFiles(current.record)[index];
      if (!current.allowed || current.email !== email || !currentFile ||
          currentFile.kind !== 'AVALIACAO' || currentFile.driveFileId !== file.driveFileId ||
          currentFile.sha256 !== file.sha256) return res.status(404).json({ error: 'Documento não disponível.' });
      await ports.deliver(req, res, current.record!, index, currentFile, pdf);
    } catch {
      return res.status(409).json({ error: 'Não foi possível conferir e entregar o documento histórico.' });
    }
  });
}
