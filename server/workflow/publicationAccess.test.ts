import test from 'node:test';
import assert from 'node:assert/strict';
import type { ProcessData, SignatureJob } from '../../src/types';
import { publicFileAuthorized, finalDocumentFilesLocked } from './publicationAccess';
const process = { id:'p', status:'CONCLUIDO', dataRevision:2, acervo:{submittedAt:'now', authorizationConfirmedAt:'now', publishFullWork:true, publishExpandedAbstract:false, publicationState:'PUBLIC', publicationSyncedAt:'now', trabalhoCompletoFileId:'private', publicFullWorkFileId:'public', trabalhoCompletoSha256:'a'.repeat(64)} } as ProcessData;
const jobs = ['ATA','TERMO'].map(documentType => ({processId:'p', documentType, status:'ARCHIVED', documentVersion:1, driveSignedFileId:'signed', sourceDataRevision:2})) as SignatureJob[];
test('publicação exige consentimento, assinatura atual, cópia pública e fingerprint', () => {
  assert.equal(publicFileAuthorized(process,jobs,'trabalho-completo'),true);
  for (const patch of [{submittedAt:undefined},{authorizationConfirmedAt:undefined},{publicationState:'PRIVATE'},{publicationWithdrawnAt:'now'},{publicationSyncedAt:undefined},{publishFullWork:false},{trabalhoCompletoFileId:undefined},{publicFullWorkFileId:undefined},{trabalhoCompletoSha256:''}]) {
    assert.equal(publicFileAuthorized({...process,acervo:{...process.acervo,...patch}} as ProcessData,jobs,'trabalho-completo'),false);
  }
  assert.equal(publicFileAuthorized({...process,status:'AGUARDANDO_DADOS_FINAIS'} as ProcessData,jobs,'trabalho-completo'),false);
  assert.equal(publicFileAuthorized({...process,dataRevision:3},jobs,'trabalho-completo'),false);
  assert.equal(publicFileAuthorized(process,jobs.filter(j=>j.documentType==='ATA'),'trabalho-completo'),false);
  assert.equal(publicFileAuthorized(process,jobs,'resumo-expandido'),false);
  assert.equal(publicFileAuthorized(process,jobs,'outro'),false);
});
test('início de termo ou declaração bloqueia troca de arquivos finais, cancelamento permite edição', () => {
  const draft = {...process,status:'AGUARDANDO_DADOS_FINAIS'} as ProcessData;
  assert.equal(finalDocumentFilesLocked(draft,jobs.filter(j=>j.documentType==='ATA')),false);
  assert.equal(finalDocumentFilesLocked(draft,[{...jobs[1],status:'SENT'} as SignatureJob]),true);
  assert.equal(finalDocumentFilesLocked(draft,[{...jobs[1],status:'CANCELED'} as SignatureJob]),false);
  assert.equal(finalDocumentFilesLocked(process,[]),true);
});
