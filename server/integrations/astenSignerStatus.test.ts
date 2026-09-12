import assert from 'node:assert/strict';
import test from 'node:test';
import { assertAstenEnvelopeSigners } from './asten';

test('Asten não trata status negativo como assinatura concluída', () => {
  assert.throws(() => assertAstenEnvelopeSigners({signatarios:[{email:'aluno@ufes.br',ordem:1,status:'Não assinado'}]},[{email:'aluno@ufes.br',order:1}]), /ainda não confirma/);
  assert.throws(() => assertAstenEnvelopeSigners({signatarios:[{email:'aluno@ufes.br',ordem:1,status:'Pendente'}]},[{email:'aluno@ufes.br',order:1}]), /ainda não confirma/);
  assert.doesNotThrow(() => assertAstenEnvelopeSigners({signatarios:[{email:'aluno@ufes.br',ordem:1,status:'Assinado'}]},[{email:'aluno@ufes.br',order:1}]));
});
