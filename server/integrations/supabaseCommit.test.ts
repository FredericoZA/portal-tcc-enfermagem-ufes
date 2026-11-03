import test from 'node:test';import assert from 'node:assert/strict';
import {loadPortalRuntimeState,savePortalRuntimeState} from './supabase';
test('commit diferencia unicidade de concorrência e leitura do callback não altera revisão',async()=>{
 const original=globalThis.fetch;const previous={url:process.env.SUPABASE_URL,key:process.env.SUPABASE_SERVICE_ROLE_KEY,provider:process.env.PORTAL_PERSISTENCE_PROVIDER};let failCode='23505';const expected:number[]=[];
 try{
  process.env.SUPABASE_URL='https://test.supabase.co';process.env.SUPABASE_SERVICE_ROLE_KEY='fake-test-key';process.env.PORTAL_PERSISTENCE_PROVIDER='supabase';let reads=0;
  globalThis.fetch=async(_url,init)=>{if(init?.method==='POST'){expected.push(JSON.parse(String(init.body)).expected_revision);return new Response(JSON.stringify({code:failCode,message:failCode==='40001'?'Conflito de concorrência':'duplicate key'}),{status:409});}return new Response(JSON.stringify([{revision:++reads===1?7:9,payload:{settings:{}}}]));};
  await loadPortalRuntimeState();await loadPortalRuntimeState(false);
  await assert.rejects(savePortalRuntimeState({settings:{}}),error=>error instanceof Error&&!error.message.includes('Conflito de concorrência')&&error.message.includes('23505'));
  failCode='40001';await assert.rejects(savePortalRuntimeState({settings:{}}),/Conflito de concorrência/);
  failCode='PT409';await assert.rejects(savePortalRuntimeState({settings:{}}),/Conflito de concorrência/);
  // A refused write must never spin, refresh-and-overwrite, or schedule itself.
  for(let tick=0;tick<10;tick++)await Promise.resolve();
  assert.deepEqual(expected,[7,7,7]);
 }finally{globalThis.fetch=original;for(const[k,v]of [['SUPABASE_URL',previous.url],['SUPABASE_SERVICE_ROLE_KEY',previous.key],['PORTAL_PERSISTENCE_PROVIDER',previous.provider]] as const){if(v===undefined)delete process.env[k];else process.env[k]=v;}}
});
