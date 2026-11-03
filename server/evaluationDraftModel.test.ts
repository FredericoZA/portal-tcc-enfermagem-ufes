import test from 'node:test';
import assert from 'node:assert/strict';
import {ataModelFingerprint,recoverEvaluationDocument} from '../src/utils/evaluationDraftModel';
test('rascunho legado não substitui o modelo original e preserva as respostas',()=>{
  const draft={answers:{PARECER:'Parecer preenchido',RESULTADO:'APROVADO'},documentText:'Texto do modelo rejeitado'};
  const recovered=recoverEvaluationDocument(draft,'modelo:hash')!;
  assert.equal(recovered.documentText,undefined);assert.deepEqual(recovered.answers,draft.answers);assert.equal((recovered as any).documentTextReset,true);assert.equal(draft.documentText,'Texto do modelo rejeitado');
});
test('revisão integral só é recuperada para o mesmo modelo',()=>{
  const fingerprint=ataModelFingerprint({driveFileId:'arquivo',contentSha256:'hash1'});
  const draft={documentText:'Revisão manual legítima',modelFingerprint:fingerprint};
  assert.equal(recoverEvaluationDocument(draft,fingerprint)?.documentText,draft.documentText);
  assert.equal(recoverEvaluationDocument(draft,ataModelFingerprint({driveFileId:'arquivo',contentSha256:'hash2'}))?.documentText,undefined);
});
