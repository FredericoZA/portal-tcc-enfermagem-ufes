import test from 'node:test';
import assert from 'node:assert/strict';
import type { ProcessData, SignatureJob } from '../../src/types';
import { publicFileAuthorized, finalDocumentFilesLocked } from './publicationAccess';
import { declarationReady } from './gates';
import { deriveSignatureSigners, publicationRequested } from './signaturePolicy';
import { publicationAuthorizationVariables } from '../../src/utils/publicationAuthorization';
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

test('autorização em dupla libera somente os PDFs selecionados no termo arquivado', () => {
  const authors = [
    { nome: 'Autora de teste', email: 'author@example.invalid' },
    { nome: 'Segundo autor de teste', email: 'coauthor@example.invalid' },
  ];
  const advisor = { nome: 'Orientador de teste', email: 'advisor@example.invalid' };
  const ataOnly = jobs.filter(job => job.documentType === 'ATA');
  for (const [publishFullWork, publishExpandedAbstract] of [[false, false], [true, false], [false, true], [true, true]]) {
    const variant = {
      ...process,
      aluno1: authors[0],
      aluno2: authors[1],
      orientador: advisor,
      acervo: {
        ...process.acervo,
        publishFullWork,
        publishExpandedAbstract,
        resumoExpandidoFileId: 'private-abstract',
        publicExpandedAbstractFileId: 'published-abstract',
        resumoExpandidoSha256: 'b'.repeat(64),
      },
    } as ProcessData;
    assert.equal(publicationRequested(variant), publishFullWork || publishExpandedAbstract);
    assert.equal(declarationReady(variant, ataOnly), !publicationRequested(variant));
    assert.equal(publicFileAuthorized(variant, ataOnly, 'trabalho-completo'), false);
    assert.equal(publicFileAuthorized(variant, ataOnly, 'resumo-expandido'), false);
    assert.equal(publicFileAuthorized(variant, jobs, 'trabalho-completo'), publishFullWork);
    assert.equal(publicFileAuthorized(variant, jobs, 'resumo-expandido'), publishExpandedAbstract);
    const choices = publicationAuthorizationVariables(variant);
    assert.equal(choices.PUBLICACAO_TRABALHO_MARCA, publishFullWork ? '☒' : '☐');
    assert.equal(choices.PUBLICACAO_RESUMO_MARCA, publishExpandedAbstract ? '☒' : '☐');
    if (publicationRequested(variant)) {
      const termSigners = deriveSignatureSigners(variant, 'TERMO', {});
      assert.deepEqual(termSigners.map(signer => signer.email), [...authors, advisor].map(person => person.email));
      assert.deepEqual(termSigners.map(signer => signer.role), ['STUDENT', 'STUDENT', 'ADVISOR']);
    }
  }
});
