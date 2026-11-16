import {isDeepStrictEqual} from 'node:util';
import type {ProcessData,SignatureJob} from '../../src/types';import type {LegacyAcademicRecord} from '../../src/types/legacyArchive';import {publicFileAuthorized} from './publicationAccess';import {legacyFileIsPublic} from '../legacyArchive';
/** Restoring a backup cannot silently revoke, republish or change already published Drive content.
 * New historical records still pass the normal import validator. */
export function restoreChangesPublicFiles(before:{processes:ProcessData[];legacy:LegacyAcademicRecord[];jobs:SignatureJob[]},after:{processes:ProcessData[];legacy:LegacyAcademicRecord[];jobs:SignatureJob[]}){
 const currentKeys=(p:ProcessData|undefined,jobs:SignatureJob[])=>!p?[]:['trabalho-completo','resumo-expandido'].flatMap(kind=>publicFileAuthorized(p,jobs,kind)?[kind==='trabalho-completo'?`${kind}:${p.acervo.trabalhoCompletoFileId}:${p.acervo.trabalhoCompletoSha256}`:`${kind}:${p.acervo.resumoExpandidoFileId}:${p.acervo.resumoExpandidoSha256}`]:[]);
 for(const p of before.processes){
  const restored=after.processes.find(n=>n.id===p.id);
  if(p.acervo?.publicationChange&&(!restored||!isDeepStrictEqual(p.acervo.publicationChange,restored.acervo?.publicationChange)))return true;
  if(p.acervo?.publicationState==='WITHDRAWN'){
   const fields=['publicationState','publicationWithdrawnAt','publicationWithdrawnBy','publicationWithdrawalReason','publicFullWorkFileId','publicExpandedAbstractFileId','trabalhoCompletoFileId','trabalhoCompletoSha256','resumoExpandidoFileId','resumoExpandidoSha256'];
   const revocation=(value:ProcessData)=>Object.fromEntries(fields.map(key=>[key,(value.acervo as any)?.[key]]));
   if(!restored||!isDeepStrictEqual(revocation(p),revocation(restored)))return true;
  }
  if(JSON.stringify(currentKeys(p,before.jobs))!==JSON.stringify(currentKeys(restored,after.jobs)))return true;
 }
 const legacyKeys=(r:LegacyAcademicRecord|undefined)=>r?r.attachments.filter(f=>legacyFileIsPublic(r,f)).map(f=>`${f.kind}:${f.driveFileId}:${f.sha256}`).sort():[];
 for(const r of before.legacy){
  const restored=after.legacy.find(n=>n.id===r.id),withdrawal=r.provenance.publicationWithdrawal as {drivePending?:boolean}|undefined;
  if(r.provenance.publicationOverride&&(!restored||!isDeepStrictEqual(r.provenance.publicationProcess,restored.provenance.publicationProcess)||!isDeepStrictEqual(r.provenance.publicationOverride,restored.provenance.publicationOverride)))return true;
  if(withdrawal?.drivePending){
   const references=(value:LegacyAcademicRecord)=>value.attachments.map(f=>`${f.kind}:${f.driveFileId}:${f.sha256}`).sort();
   if(!restored||!isDeepStrictEqual(withdrawal,restored.provenance.publicationWithdrawal)||!isDeepStrictEqual(references(r),references(restored)))return true;
  }
  if(JSON.stringify(legacyKeys(r))!==JSON.stringify(legacyKeys(restored)))return true;
 }
 return false;
}
