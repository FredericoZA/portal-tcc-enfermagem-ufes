import test from 'node:test';
import assert from 'node:assert/strict';
import {callAsten} from './asten';

test('expurgo exige integração habilitada e confirmação explícita do contrato oficial',async()=>{
 const keys=['ASTEN_INTEGRATION_ENABLED','ASTEN_PILOT_APPROVED','ASTEN_PRODUCTION_RELEASE_APPROVED','NODE_ENV','VERCEL'] as const;
 const saved=keys.map(key=>process.env[key]);const original=globalThis.fetch;
 let calls=0;let response:unknown={response:{data:{listaAvisos:{aviso:{tipo:'S',mensagem:'Envelope expurgado com sucesso!'}}}}};
 try{
  process.env.NODE_ENV='production';process.env.VERCEL='1';process.env.ASTEN_INTEGRATION_ENABLED='true';process.env.ASTEN_PILOT_APPROVED='true';process.env.ASTEN_PRODUCTION_RELEASE_APPROVED='false';
  globalThis.fetch=async(input,init)=>{calls++;assert.equal(String(input),'https://plataforma.astenassinatura.com.br/api/expurgarEnvelope');assert.deepEqual(JSON.parse(String(init?.body)),{params:{idEnvelope:'123'}});return Response.json(response);};
  await assert.rejects(callAsten('expurgarEnvelope',{idEnvelope:'123'},'purge-fixture-token-only'),/bloqueada/);assert.equal(calls,0);
  process.env.ASTEN_PRODUCTION_RELEASE_APPROVED='true';
  await callAsten('expurgarEnvelope',{idEnvelope:'123'},'purge-fixture-token-only');assert.equal(calls,1);
  response={response:{mensagem:'sem confirmação'}};
  await assert.rejects(callAsten('expurgarEnvelope',{idEnvelope:'123'},'purge-fixture-token-only'),/não confirmou/);
  response={response:{data:{listaAvisos:{aviso:[{tipo:'S'},{tipo:'E',mensagem:'Operação recusada'}]}}}};
  await assert.rejects(callAsten('expurgarEnvelope',{idEnvelope:'123'},'purge-fixture-token-only'),/recusada/);
 }finally{globalThis.fetch=original;keys.forEach((key,i)=>{if(saved[i]===undefined)delete process.env[key];else process.env[key]=saved[i];});}
});
