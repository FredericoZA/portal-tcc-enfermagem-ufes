import assert from 'node:assert/strict';
import test from 'node:test';
import { assertAstenEnvelopeSigners } from './asten';

test('Asten não trata status negativo como assinatura concluída', () => {
  assert.throws(() => assertAstenEnvelopeSigners({signatarios:[{email:'aluno@ufes.br',ordem:1,status:'Não assinado'}]},[{email:'aluno@ufes.br',order:1}]), /ainda não confirma/);
  assert.throws(() => assertAstenEnvelopeSigners({signatarios:[{email:'aluno@ufes.br',ordem:1,status:'Pendente'}]},[{email:'aluno@ufes.br',order:1}]), /ainda não confirma/);
  assert.doesNotThrow(() => assertAstenEnvelopeSigners({signatarios:[{email:'aluno@ufes.br',ordem:1,status:'Assinado'}]},[{email:'aluno@ufes.br',order:1}]));
});

test('Asten reconhece o código numérico 3 como assinado, 1 e 2 como pendentes',()=>{
    assert.doesNotThrow(()=>assertAstenEnvelopeSigners({SignatarioEnvelope:[{ordem:'1',status:'3',ConfigAssinatura:{emailSignatario:'aluno@ufes.br'}}]},[{email:'aluno@ufes.br',order:1}]));
    for(const status of ['1','2','4','5'])assert.throws(()=>assertAstenEnvelopeSigners({SignatarioEnvelope:[{ordem:1,status,ConfigAssinatura:{emailSignatario:'aluno@ufes.br'}}]},[{email:'aluno@ufes.br',order:1}]),/ainda não confirma/);
  });
