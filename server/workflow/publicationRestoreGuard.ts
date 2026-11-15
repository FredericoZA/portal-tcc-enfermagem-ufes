import type {ProcessData,SignatureJob} from '../../src/types';import type {LegacyAcademicRecord} from '../../src/types/legacyArchive';import {publicFileAuthorized} from './publicationAccess';import {legacyFileIsPublic} from '../legacyArchive';
/** Restoring a backup cannot silently revoke, republish or change already published Drive content.
 * New historical records still pass the normal import validator. */
export function restoreChangesPublicFiles(before:{processes:ProcessData[];legacy:LegacyAcademicRecord[];jobs:SignatureJob[]},after:{processes:ProcessData[];legacy:LegacyAcademicRecord[];jobs:SignatureJob[]}){
 const currentKeys=(p:ProcessData|undefined,jobs:SignatureJob[])=>!p?[]:['trabalho-completo','resumo-expandido'].flatMap(kind=>publicFileAuthorized(p,jobs,kind)?[kind==='trabalho-completo'?`${kind}:${p.acervo.trabalhoCompletoFileId}:${p.acervo.trabalhoCompletoSha256}`:`${kind}:${p.acervo.resumoExpandidoFileId}:${p.acervo.resumoExpandidoSha256}`]:[]);
 for(const p of before.processes)if(JSON.stringify(currentKeys(p,before.jobs))!==JSON.stringify(currentKeys(after.processes.find(n=>n.id===p.id),after.jobs)))return true;
 const legacyKeys=(r:LegacyAcademicRecord|undefined)=>r?r.attachments.filter(f=>legacyFileIsPublic(r,f)).map(f=>`${f.kind}:${f.driveFileId}:${f.sha256}`).sort():[];
 for(const r of before.legacy)if(JSON.stringify(legacyKeys(r))!==JSON.stringify(legacyKeys(after.legacy.find(n=>n.id===r.id))))return true;
 return false;
}
