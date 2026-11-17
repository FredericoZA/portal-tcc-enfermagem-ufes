import {isDeepStrictEqual} from 'node:util';
import type {ProcessData,SignatureJob} from '../../src/types';import type {LegacyAcademicRecord} from '../../src/types/legacyArchive';import {publicFileAuthorized} from './publicationAccess';import {legacyAdministrativeRoutes,legacyAdministrativeFiles,legacyFileIsPublic,publicLegacyAdministrativeDocuments} from '../legacyArchive';
import {normalizeEmail} from '../../src/utils/formatters';

const uniqueSorted=(values:string[])=>[...new Set(values)].sort();
function legacySourceBoundary(record:LegacyAcademicRecord|undefined){
 const baseline=record?.provenance.publicationImportBaseline as {
  publicFiles?:Array<{kind:string;sha256:string;sourceUrl?:string;sourceRowFingerprint?:string;sourceFileName?:string;sourceRecordId?:string;sourcePageRecordId?:string}>;
  privateFileIds?:string[];policy?:string;cutoffDate?:string;sourcePageUrl?:string;sourcePageSha256?:string;
 }|undefined;
 return {
  publicFiles:uniqueSorted((baseline?.publicFiles||[]).filter(file=>['TRABALHO_COMPLETO','RESUMO_EXPANDIDO'].includes(file.kind)).map(file=>JSON.stringify([
   file.kind,file.sha256,file.sourceUrl,file.sourceRowFingerprint,file.sourceFileName,file.sourceRecordId,file.sourcePageRecordId,
  ]))),
  privateFileIds:uniqueSorted(baseline?.privateFileIds||[]),
  policy:baseline?.policy,cutoffDate:baseline?.cutoffDate,
  sourcePageUrl:baseline?.sourcePageUrl,sourcePageSha256:baseline?.sourcePageSha256,
 };
}
function publicLegacyAdministrativeKeys(record:LegacyAcademicRecord|undefined){
 if(!record)return [];
 const publicIds=new Set(publicLegacyAdministrativeDocuments(record).map(document=>document.id));
 return legacyAdministrativeRoutes(record).flatMap(({file,index})=>publicIds.has(`legacy-document-${index}`)?[`${file.kind}:${file.driveFileId}:${file.sha256}`]:[]).sort();
}
function legacyEvaluationAccessBoundary(record:LegacyAcademicRecord|undefined){
 const value=record?.provenance.verifiedPublicationParticipants;
 const binding=value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:undefined;
 const name=(value:unknown)=>typeof value==='string'?value.normalize('NFKC').trim().replace(/\s+/g,' ').toLocaleLowerCase('pt-BR'):'';
 // Keep malformed raw controls distinct: normalizing them away could turn a
 // previously rejected email/name into an accepted binding on restoration.
 const identity=(value:unknown,email=false)=>typeof value!=='string'?'':/[\u0000-\u001f\u007f]/.test(value)||(!email&&value.length>1000)?value:email?normalizeEmail(value):name(value);
 const person=(value:unknown)=>{
  const p=value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:undefined;
  return [identity(p?.nome),identity(p?.email,true)];
 };
 const revision=record?.provenance.evaluationAccessRevision;
 return {
  revision:Number.isSafeInteger(revision)&&Number(revision)>=0?Number(revision):0,
  contacts:binding?{
   verifiedBy:identity(binding.verifiedBy,true),
   // The authorization helper pairs each saved author with the catalog entry
   // at the same index. Joint reordering is cosmetic; reordering only one side
   // can activate an otherwise conflicting identity proof.
   authors:Array.isArray(binding.authors)?binding.authors.map((value,index)=>JSON.stringify([
    identity(record?.autores[index]),...person(value),
   ])).sort():[],
   advisor:person(binding.advisor),
   catalogAuthors:(record?.autores||[]).map(value=>identity(value)).sort(),
   catalogAdvisor:identity(record?.orientador),
  }:null,
 };
}

/** A private classification follows the Drive original across historical records.
 * Prior records also protect a private original omitted from an imported backup. */
export function assertLegacyPrivateClassificationConsistency(records:LegacyAcademicRecord[],priorRecords:LegacyAcademicRecord[]=[]):void{
 const privateIds=new Set<string>();
 for(const record of [...priorRecords,...records]){
  const baseline=record.provenance.publicationImportBaseline as {privateFileIds?:unknown}|undefined;
  const ids=baseline?.privateFileIds;
  if(ids!==undefined&&(!Array.isArray(ids)||ids.some(id=>typeof id!=='string')))throw Error('Classificação privada histórica inválida.');
  for(const id of (ids||[]) as string[])privateIds.add(id);
  for(const file of legacyAdministrativeFiles(record))if(file.kind==='AVALIACAO')privateIds.add(file.driveFileId);
 }
 for(const record of records){
  const publicIds=new Set(publicLegacyAdministrativeDocuments(record).map(document=>document.id));
  const published=[...record.attachments.filter(file=>legacyFileIsPublic(record,file)),...legacyAdministrativeRoutes(record).filter(({index})=>publicIds.has(`legacy-document-${index}`)).map(entry=>entry.file)];
  if(published.some(file=>privateIds.has(file.driveFileId)))throw Error('Um arquivo classificado como privado não pode ser publicado no acervo legado.');
 }
 const priorIds=new Set(priorRecords.map(record=>record.id));
 if(records.some(record=>!priorIds.has(record.id)&&record.attachments.some(file=>legacyFileIsPublic(record,file))))
  throw Error('Novos trabalhos históricos devem manter os arquivos acadêmicos privados.');
}
/** Restoring a backup cannot silently revoke, republish or change already published Drive content.
 * New historical records still pass the normal import validator. */
export function restoreChangesPublicFiles(before:{processes:ProcessData[];legacy:LegacyAcademicRecord[];jobs:SignatureJob[]},after:{processes:ProcessData[];legacy:LegacyAcademicRecord[];jobs:SignatureJob[]}){
 try{assertLegacyPrivateClassificationConsistency(after.legacy,before.legacy);}catch{return true;}
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
  const restored=after.legacy.find(n=>n.id===r.id),withdrawal=r.provenance.publicationWithdrawal as {withdrawnAt?:string;drivePending?:boolean}|undefined;
  if(!isDeepStrictEqual(legacySourceBoundary(r),legacySourceBoundary(restored)))return true;
  if(!isDeepStrictEqual(publicLegacyAdministrativeKeys(r),publicLegacyAdministrativeKeys(restored)))return true;
  if(!isDeepStrictEqual(legacyEvaluationAccessBoundary(r),legacyEvaluationAccessBoundary(restored)))return true;
  if(withdrawal?.withdrawnAt&&(!restored||!isDeepStrictEqual(withdrawal,restored.provenance.publicationWithdrawal)))return true;
  if(r.provenance.publicationOverride&&(!restored||!isDeepStrictEqual(r.provenance.publicationProcess,restored.provenance.publicationProcess)||!isDeepStrictEqual(r.provenance.publicationOverride,restored.provenance.publicationOverride)))return true;
  if(withdrawal?.drivePending){
   const references=(value:LegacyAcademicRecord)=>value.attachments.map(f=>`${f.kind}:${f.driveFileId}:${f.sha256}`).sort();
   if(!restored||!isDeepStrictEqual(withdrawal,restored.provenance.publicationWithdrawal)||!isDeepStrictEqual(references(r),references(restored)))return true;
  }
  if(JSON.stringify(legacyKeys(r))!==JSON.stringify(legacyKeys(restored)))return true;
 }
 return false;
}
