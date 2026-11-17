import {createHash, randomUUID} from 'node:crypto';
import type {Express, Request, RequestHandler} from 'express';
import type {AuditLog} from '../src/types';
import type {LegacyAcademicRecord, LegacyEvaluationParticipantsView} from '../src/types/legacyArchive';
import {normalizeEmail} from '../src/utils/formatters';
import {verifiedLegacyParticipants} from './legacyPrivateAccess';

interface Ports {
  authenticate: RequestHandler;
  limit?: RequestHandler;
  email: (req: Request) => string | undefined;
  master: (email: string) => boolean;
  record: (id: string) => LegacyAcademicRecord | undefined;
  /** Recheck the fingerprint and commit the complete new record + audit atomically.
   * The request is successful only once durable persistence has completed. */
  commit: (id: string, expectedRevision: string, next: LegacyAcademicRecord, audit: AuditLog) => Promise<void>;
  now?: () => string;
}

const sequence = (record: LegacyAcademicRecord): number => {
  const value=record.provenance.evaluationAccessRevision;
  return Number.isSafeInteger(value)&&Number(value)>=0?Number(value):0;
};
/** Includes a monotonic revision so clearing a binding never restores an old
 * fingerprint and an earlier request cannot silently re-grant access. */
export function legacyEvaluationAccessRevision(record: LegacyAcademicRecord): string {
  return createHash('sha256').update(JSON.stringify({id:record.id,sourceFingerprint:record.sourceFingerprint,
    authors:record.autores,advisor:record.orientador,revision:sequence(record),
    contacts:record.provenance.verifiedPublicationParticipants??null})).digest('hex');
}
export function legacyEvaluationParticipantsView(record: LegacyAcademicRecord, master: Ports['master']): LegacyEvaluationParticipantsView {
  const contacts=verifiedLegacyParticipants(record,master);
  const source=record.provenance.verifiedPublicationParticipants as Record<string,unknown>|undefined;
  return {revision:legacyEvaluationAccessRevision(record),authors:record.autores.map((nome,index)=>({nome,email:contacts?.authors[index]?.email||''})),
    advisor:{nome:record.orientador,email:contacts?.advisor.email||''},confirmed:Boolean(contacts),
    hasStoredBinding:record.provenance.verifiedPublicationParticipants!==undefined,
    ...(contacts&&typeof source?.verifiedAt==='string'?{verifiedAt:source.verifiedAt}:{})};
}
const evidenceText = (value: unknown): string => typeof value==='string'&&value.trim().length>=10&&
  value.trim().length<=1000&&!/[\u0000-\u001f\u007f]/.test(value)?value.trim():'';

/** Explicit Master confirmation, separate from publication or Google sharing.
 * Names and roles are fixed by the historical catalog, never supplied by a client. */
export function installLegacyEvaluationParticipantRoutes(app: Pick<Express,'get'|'put'>, ports: Ports): void {
  const path='/api/admin/legacy-academic-records/:id/evaluation-participants';
  const authorize:RequestHandler=(req,res,next)=>{
    const email=ports.email(req);
    if(!email)return res.status(401).json({error:'Entre no Portal para continuar.'});
    if(!ports.master(email))return res.status(403).json({error:'A confirmação dos acessos exige o usuário Master.'});
    next();
  };
  app.get(path,ports.authenticate,authorize,(req,res)=>{
    res.setHeader('Cache-Control','private, no-store');
    const record=ports.record(String(req.params.id));
    if(!record)return res.status(404).json({error:'Trabalho histórico não encontrado.'});
    return res.json(legacyEvaluationParticipantsView(record,ports.master));
  });
  app.put(path,ports.authenticate,authorize,...(ports.limit?[ports.limit]:[]),async(req,res)=>{
    res.setHeader('Cache-Control','private, no-store');
    const actor=normalizeEmail(ports.email(req)!),record=ports.record(String(req.params.id));
    if(!record)return res.status(404).json({error:'Trabalho histórico não encontrado.'});
    const expected=legacyEvaluationAccessRevision(record);
    if(req.body?.expectedRevision!==expected)return res.status(409).json({error:'Os acessos mudaram. Reabra a confirmação antes de salvar.'});
    const reason=evidenceText(req.body?.reason),source=evidenceText(req.body?.source);
    if(!reason||!source)return res.status(400).json({error:'Informe o motivo e a fonte de confirmação, com 10 a 1.000 caracteres cada.'});
    if(sequence(record)>=Number.MAX_SAFE_INTEGER)return res.status(409).json({error:'Não foi possível atualizar a revisão dos acessos.'});
    const next=structuredClone(record),at=ports.now?.()||new Date().toISOString();
    next.provenance.evaluationAccessRevision=sequence(record)+1;
    const clear=req.body?.clear===true;
    if(clear)delete next.provenance.verifiedPublicationParticipants;
    else{
      const authors=req.body?.authorEmails,advisorEmail=req.body?.advisorEmail;
      if(!Array.isArray(authors)||authors.length!==record.autores.length||authors.some(email=>typeof email!=='string')||typeof advisorEmail!=='string')
        return res.status(400).json({error:'Informe um e-mail individual para cada autor e para o orientador.'});
      next.provenance.verifiedPublicationParticipants={authors:record.autores.map((nome,index)=>({nome,email:authors[index]})),
        advisor:{nome:record.orientador,email:advisorEmail},verifiedBy:actor,verifiedAt:at,
        verificationReason:reason,verificationSource:source};
      const contacts=verifiedLegacyParticipants(next,ports.master);
      if(!contacts)return res.status(400).json({error:'Os e-mails precisam ser válidos, distintos e corresponder aos participantes do catálogo.'});
      next.provenance.verifiedPublicationParticipants={...next.provenance.verifiedPublicationParticipants as object,...contacts};
    }
    // Keeps revocation provenance even after contacts have been removed; it does
    // not retain old participant email addresses in the routine audit payload.
    next.provenance.evaluationAccessLastChange={at,by:actor,action:clear?'REVOKED':'CONFIRMED',reason,source};
    const audit:AuditLog={id:`log-${randomUUID()}`,processId:record.id,actorEmail:actor,actorRoles:['MASTER_ADMIN'],
      action:clear?'LEGACY_EVALUATION_ACCESS_REVOKED':'LEGACY_EVALUATION_ACCESS_CONFIRMED',
      entityType:'legacy_evaluation_access',entityId:record.id,timestamp:at,
      after:{revision:next.provenance.evaluationAccessRevision,authors:clear?0:record.autores.length,advisor:!clear}};
    try{
      await ports.commit(record.id,expected,next,audit);
      return res.json(legacyEvaluationParticipantsView(next,ports.master));
    }catch(error){
      if((error as {code?:string})?.code==='LEGACY_EVALUATION_ACCESS_CONFLICT')return res.status(409).json({error:'Os acessos mudaram. Reabra a confirmação antes de salvar.'});
      return res.status(503).json({error:'A confirmação não foi gravada. Reabra os acessos antes de tentar novamente.'});
    }
  });
}
