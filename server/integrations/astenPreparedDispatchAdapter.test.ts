import test from 'node:test';
import assert from 'node:assert/strict';
import {claimAstenEnvelopeDispatch,startPreparedAstenEnvelopeDispatch} from './supabase';

test('prepared dispatch requires the new RPCs, binds one token to the exact job and never falls back or replays ambiguous writes',async()=>{
 const originalFetch=globalThis.fetch;
 const names=['SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY','SUPABASE_SECRET_KEY','PORTAL_PERSISTENCE_PROVIDER'] as const;
 const originalEnv=Object.fromEntries(names.map(name=>[name,process.env[name]]));
 const input={idempotencyKey:'a'.repeat(64),jobId:'fixture-signature',contentSha256:'b'.repeat(64)};
 const calls:Array<{url:string;body:any}>=[];
 let response:()=>Promise<Response>=async()=>Response.json({outcome:'PREPARED'});
 try{
  process.env.SUPABASE_URL='https://prepared-fixture.supabase.co';process.env.SUPABASE_SERVICE_ROLE_KEY='fixture-only-key';delete process.env.SUPABASE_SECRET_KEY;process.env.PORTAL_PERSISTENCE_PROVIDER='supabase';
  globalThis.fetch=async(url,options)=>{assert.equal(options?.method,'POST');calls.push({url:String(url),body:JSON.parse(String(options?.body))});return response();};
  const prepared=await claimAstenEnvelopeDispatch(input);
  assert.equal(prepared.outcome,'PREPARED');assert.ok(prepared.claimToken&&prepared.claimToken.length>=20);
  assert.match(calls[0].url,/\/rpc\/portal_prepare_asten_dispatch$/);
  assert.equal(calls[0].body.p_claim_token,prepared.claimToken);
  response=async()=>Response.json({outcome:'STARTED'});
  await startPreparedAstenEnvelopeDispatch({...input,claimToken:prepared.claimToken});
  assert.match(calls[1].url,/\/rpc\/portal_start_prepared_asten_dispatch$/);
  assert.deepEqual(calls[1].body,{p_idempotency_key:input.idempotencyKey,p_job_external_id:input.jobId,p_content_sha256:input.contentSha256,p_claim_token:prepared.claimToken});
  const before=calls.length;await assert.rejects(startPreparedAstenEnvelopeDispatch(input),/token/);assert.equal(calls.length,before);
  for(const status of [403,404,500]){
   response=async()=>Response.json({code:status===404?'PGRST202':'fixture-error'},{status});
   let count=calls.length;await assert.rejects(claimAstenEnvelopeDispatch(input));assert.equal(calls.length,count+1);
   count=calls.length;await assert.rejects(startPreparedAstenEnvelopeDispatch({...input,claimToken:prepared.claimToken}));assert.equal(calls.length,count+1);
  }
  for(const malformed of [{outcome:'CLAIMED'},{outcome:'DISPATCHED'},{outcome:'ALREADY_CREATED'}]){
   response=async()=>Response.json(malformed);await assert.rejects(claimAstenEnvelopeDispatch(input));
  }
  response=async()=>Response.json({outcome:'PREPARED'});await assert.rejects(startPreparedAstenEnvelopeDispatch({...input,claimToken:prepared.claimToken}),/início exclusivo/);
  response=async()=>{throw Object.assign(new Error('response lost'),{name:'TimeoutError'});};
  let count=calls.length;await assert.rejects(claimAstenEnvelopeDispatch(input),/response lost/);assert.equal(calls.length,count+1);
  count=calls.length;await assert.rejects(startPreparedAstenEnvelopeDispatch({...input,claimToken:prepared.claimToken}),/response lost/);assert.equal(calls.length,count+1);
  assert.ok(calls.every(call=>!call.url.endsWith('/portal_claim_asten_dispatch')),'old one-phase RPC is never a fallback');
 }finally{
  globalThis.fetch=originalFetch;
  for(const name of names){if(originalEnv[name]===undefined)delete process.env[name];else process.env[name]=originalEnv[name];}
 }
});
