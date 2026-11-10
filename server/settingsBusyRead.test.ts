import test from 'node:test';
import assert from 'node:assert/strict';
import {apiClient,invalidateIdentityRequests} from '../src/services/apiClient';

test('settings recover once from explicit pre-handler busy without repeating any mutation',async t=>{
  t.mock.timers.enable({apis:['setTimeout']});let calls=0;
  t.mock.method(globalThis,'fetch',async(url:unknown,options:RequestInit)=>{
    calls++;assert.equal(url,'/api/settings');assert.equal(options.method,undefined);
    return calls===1?Response.json({code:'RUNTIME_BUSY'},{status:503,headers:{'Retry-After':'0'}}):Response.json({commissionPresidentName:'Nome configurado'});
  });
  const pending=apiClient.getSettings();
  for(let i=0;i<20;i++)await Promise.resolve();
  assert.equal(calls,1);t.mock.timers.tick(100);
  assert.equal((await pending).commissionPresidentName,'Nome configurado');assert.equal(calls,2);
});

test('settings never retry access denial, invalid state, unbounded wait or a changed identity',async t=>{
  for(const [status,code,delay] of [[401,'AUTHENTICATION_REQUIRED','5'],[403,'DENIED','5'],[503,'RUNTIME_STATE_UNAVAILABLE','5'],[503,'RUNTIME_BUSY','31']] as const){
    let calls=0;const mock=t.mock.method(globalThis,'fetch',async()=>{calls++;return Response.json({code},{status,headers:{'Retry-After':delay}});});
    await assert.rejects(apiClient.getSettings());assert.equal(calls,1);mock.mock.restore();
  }
  t.mock.timers.enable({apis:['setTimeout']});let calls=0;
  t.mock.method(globalThis,'fetch',async()=>{calls++;return Response.json({code:'RUNTIME_BUSY'},{status:503,headers:{'Retry-After':'0'}});});
  const pending=apiClient.getSettings(),rejected=assert.rejects(pending);
  for(let i=0;i<20;i++)await Promise.resolve();
  invalidateIdentityRequests();t.mock.timers.tick(100);await rejected;assert.equal(calls,1);
});

test('simultaneous settings reads still share one request and one busy recovery',async t=>{
  t.mock.timers.enable({apis:['setTimeout']});let calls=0;
  t.mock.method(globalThis,'fetch',async()=>{
    calls++;
    return calls===1?Response.json({code:'RUNTIME_BUSY'},{status:503,headers:{'Retry-After':'0'}}):Response.json({commissionPresidentName:'Configurado'});
  });
  const one=apiClient.getSettings(),two=apiClient.getSettings();
  for(let i=0;i<30;i++)await Promise.resolve();
  assert.equal(calls,1);t.mock.timers.tick(100);
  const results=await Promise.all([one,two]);
  assert.equal(calls,2);assert.equal(results[0].commissionPresidentName,'Configurado');assert.deepEqual(results[0],results[1]);
});
