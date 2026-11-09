import test from 'node:test';
import assert from 'node:assert/strict';
import {apiClient,invalidateIdentityRequests} from '../src/services/apiClient';

test('bootstrap retries only one pre-handler busy GET, with a bounded cancellable wait',async t=>{
  t.mock.timers.enable({apis:['setTimeout']});let calls=0;
  t.mock.method(globalThis,'fetch',async(url:unknown,options:RequestInit)=>{
    calls++;assert.equal(url,'/api/registration/bootstrap');assert.equal(options.credentials,'include');assert.equal(options.method,undefined);
    return calls===1?Response.json({code:'RUNTIME_BUSY'},{status:503,headers:{'Retry-After':'5'}}):Response.json({schema:{},draft:null,hasExistingProcess:false});
  });
  const pending=apiClient.getRegistrationBootstrap();
  for(let i=0;i<20;i++)await Promise.resolve();
  assert.equal(calls,1);t.mock.timers.tick(5099);await Promise.resolve();assert.equal(calls,1);
  t.mock.timers.tick(1);assert.equal((await pending).hasExistingProcess,false);assert.equal(calls,2);
});
test('bootstrap does not retry other statuses/codes, unbounded delay or a second busy response',async t=>{
  for(const [status,code,retryAfter] of [[401,'AUTHENTICATION_REQUIRED','5'],[403,'STUDENT_REGISTRATION_REQUIRED','5'],[503,'RUNTIME_STATE_UNAVAILABLE','5'],[503,'RUNTIME_BUSY','31'],[503,'RUNTIME_BUSY','']] as const){
    let calls=0;const mock=t.mock.method(globalThis,'fetch',async()=>{calls++;return Response.json({code},{status,headers:{'Retry-After':retryAfter}});});
    await assert.rejects(apiClient.getRegistrationBootstrap());assert.equal(calls,1);mock.mock.restore();
  }
  t.mock.timers.enable({apis:['setTimeout']});let calls=0;
  t.mock.method(globalThis,'fetch',async()=>{calls++;return Response.json({code:'RUNTIME_BUSY'},{status:503,headers:{'Retry-After':'0'}});});
  const pending=apiClient.getRegistrationBootstrap();const rejected=assert.rejects(pending);
  for(let i=0;i<20;i++)await Promise.resolve();t.mock.timers.tick(100);await rejected;assert.equal(calls,2);
});
test('closing registration or changing identity during the wait prevents its retry',async t=>{
  t.mock.timers.enable({apis:['setTimeout']});let calls=0;
  t.mock.method(globalThis,'fetch',async()=>{calls++;return Response.json({code:'RUNTIME_BUSY'},{status:503,headers:{'Retry-After':'5'}});});
  for(const changeIdentity of [false,true]){
    const controller=new AbortController();const before=calls;
    const pending=apiClient.getRegistrationBootstrap({signal:controller.signal});const rejected=assert.rejects(pending);
    for(let i=0;i<20;i++)await Promise.resolve();
    if(changeIdentity)invalidateIdentityRequests();else controller.abort();
    t.mock.timers.tick(5100);await rejected;assert.equal(calls,before+1);
  }
});

test('process detail recovers a saved reservation after two busy responses',async t=>{
  t.mock.timers.enable({apis:['setTimeout']});
  let calls=0;
  t.mock.method(globalThis,'fetch',async(url:unknown,options:RequestInit)=>{
    assert.equal(url,'/api/processes/fixture/detail');
    assert.equal(options.method,undefined);
    assert.equal(options.credentials,'include');
    return ++calls<=2
      ? Response.json({code:'RUNTIME_BUSY'},{status:503,headers:{'Retry-After':'5'}})
      : Response.json({process:{defesa:{localStatus:'CONFIRMADO'}}});
  });
  const pending=apiClient.getProcessDetail('fixture');
  for(let attempt=1;attempt<=2;attempt++){
    for(let i=0;i<30;i++)await Promise.resolve();
    assert.equal(calls,attempt);
    t.mock.timers.tick(5100);
  }
  assert.equal((await pending).process.defesa.localStatus,'CONFIRMADO');
  assert.equal(calls,3);
});

test('process detail never retries an access denial',async t=>{
  let calls=0;
  t.mock.method(globalThis,'fetch',async()=>{
    calls++;
    return Response.json({error:'Processo não encontrado.'},{status:404});
  });
  await assert.rejects(apiClient.getProcessDetail('fixture'),{status:404});
  assert.equal(calls,1);
});
