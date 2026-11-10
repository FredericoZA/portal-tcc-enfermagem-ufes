import assert from 'node:assert/strict';
import test, {type TestContext} from 'node:test';
import {performance} from 'node:perf_hooks';
import {currentPortalRuntimeRevision,loadPortalRuntimeState} from './supabase';

function environment(t:TestContext,name:string){
 for(const [key,value] of Object.entries({SUPABASE_URL:`https://cold-${name}.invalid`,SUPABASE_SECRET_KEY:'fixture-cold-recovery',PORTAL_PERSISTENCE_PROVIDER:'supabase',PORTAL_RUNTIME_WIRE_SNAPSHOT:'true'})){
  const previous=process.env[key];process.env[key]=value;
  t.after(()=>{if(previous===undefined)delete process.env[key];else process.env[key]=previous;});
 }
}
for(const mode of ['statement-timeout','network-timeout','gateway'] as const)test(`cold snapshot ${mode} recovers only through current canonical row`,async t=>{
 environment(t,mode);const calls:string[]=[];
 t.mock.method(globalThis,'fetch',async(url:any,init?:RequestInit)=>{
  const target=new URL(url);calls.push(target.pathname);
  assert.equal(init?.cache,'no-store');assert.ok(init?.signal);
  assert.equal(new Headers(init?.headers).get('Authorization'),'Bearer fixture-cold-recovery');
  if(target.pathname.includes('/rpc/')){
   assert.equal(init?.method,'POST');assert.equal(init?.body,'{}');assert.equal(new Headers(init?.headers).get('Accept'),'application/octet-stream');
   if(mode==='network-timeout')throw new DOMException('fixture timeout','TimeoutError');
   return Response.json({code:mode==='statement-timeout'?'57014':'gateway'},{status:mode==='statement-timeout'?500:502});
  }
  assert.equal(init?.method,undefined);assert.equal(target.pathname,'/rest/v1/portal_runtime_state');
  assert.equal(target.searchParams.get('id'),'eq.global');assert.equal(target.searchParams.get('select'),'payload,revision');
  return Response.json([{revision:17,payload:{permissions:{allowed:false},auditLogs:[]}}]);
 });
 assert.deepEqual(await loadPortalRuntimeState(),{permissions:{allowed:false},auditLogs:[]});
 assert.equal(currentPortalRuntimeRevision(),17);
 assert.equal(calls.at(-1),'/rest/v1/portal_runtime_state');
 assert.equal(calls.filter(url=>url.includes('/rpc/')).length,1);
 assert.equal(calls.filter(url=>!url.includes('/rpc/')).length,1);
});
for(const mode of ['unauthorized','denied','stale','malformed','canonical-denied','canonical-unavailable'] as const)test(`cold recovery ${mode} fails closed without old snapshot`,async t=>{
 environment(t,mode);const calls:string[]=[];const revisionBefore=currentPortalRuntimeRevision();
 t.mock.method(globalThis,'fetch',async(url:any)=>{
  const path=new URL(url).pathname;calls.push(path);
  if(path.includes('/rpc/')){
   if(mode==='denied'||mode==='unauthorized')return Response.json({code:'42501'},{status:mode==='unauthorized'?401:403});
   if(mode==='stale')return Response.json({code:'PT503'},{status:503});
   if(mode==='malformed')return Response.json([{revision:18,payload:[]}]);
   return Response.json({code:'57014'},{status:500});
  }
  return Response.json({code:mode==='canonical-denied'?'42501':'57014'},{status:mode==='canonical-denied'?403:500});
 });
 await assert.rejects(loadPortalRuntimeState());
 assert.equal(currentPortalRuntimeRevision(),revisionBefore,'failed read cannot install a revision or reuse another endpoint cache');
 const canonical=calls.filter(url=>!url.includes('/rpc/'));
 assert.equal(canonical.length,mode==='canonical-denied'?1:mode==='canonical-unavailable'?3:0);
});

for(const code of ['UND_ERR_HEADERS_TIMEOUT','ETIMEDOUT'])test(`cold transport ${code} uses current canonical fallback once`,async t=>{
 environment(t,code);const calls:string[]=[];
 t.mock.method(globalThis,'fetch',async(url:any)=>{
  const path=new URL(url).pathname;calls.push(path);
  if(path.includes('/rpc/'))throw new TypeError('fetch failed',{cause:{code}});
  return Response.json([{revision:21,payload:{permissions:{allowed:false}}}]);
 });
 assert.deepEqual(await loadPortalRuntimeState(),{permissions:{allowed:false}});
 assert.equal(calls.length,2);assert.ok(!calls[1].includes('/rpc/'));
});
for(const status of [502,503,504])test(`cold slow gateway ${status} leaves shared budget for canonical read`,async t=>{
 environment(t,`slow-${status}`);let now=0;const calls:string[]=[];
 t.mock.method(performance,'now',()=>now);
 t.mock.method(globalThis,'fetch',async(url:any,init?:RequestInit)=>{
  const path=new URL(url).pathname;calls.push(path);assert.ok(init?.signal);
  if(path.includes('/rpc/')){now+=10_500;return Response.json({code:'gateway'},{status});}
  now+=10_500;return Response.json([{revision:22,payload:{permissions:{allowed:false}}}]);
 });
 assert.deepEqual(await loadPortalRuntimeState(),{permissions:{allowed:false}});
 assert.equal(calls.length,2);assert.equal(now,21_000);assert.ok(!calls[1].includes('/rpc/'));
});
test('cold transport fallback body timeout has no third attempt or stale success',async t=>{
 environment(t,'transport-budget');let calls=0;
 t.mock.method(globalThis,'fetch',async()=>{
  calls++;if(calls===1)throw new TypeError('fetch failed',{cause:{code:'UND_ERR_HEADERS_TIMEOUT'}});
  return new Response(new ReadableStream({start(controller){controller.error(new TypeError('terminated'));}}));
 });
 await assert.rejects(loadPortalRuntimeState(),(error:any)=>error.code==='SUPABASE_SNAPSHOT_TRANSPORT');assert.equal(calls,2);
});

test('warm explicitly stale projection PT503 never falls back or retries',async t=>{
 environment(t,'warm-stale');const before=process.env.PORTAL_RUNTIME_AUDIT_DELTA;process.env.PORTAL_RUNTIME_AUDIT_DELTA='true';t.after(()=>{if(before===undefined)delete process.env.PORTAL_RUNTIME_AUDIT_DELTA;else process.env.PORTAL_RUNTIME_AUDIT_DELTA=before;});
 let calls=0;t.mock.method(globalThis,'fetch',async(url:any)=>{
  calls++;if(calls===1)return Response.json([{revision:23,payload:{permissions:{allowed:true}}}]);
  assert.ok(String(url).endsWith('/rpc/portal_read_runtime_snapshot_v1'));return Response.json({code:'PT503'},{status:503});
 });
 await loadPortalRuntimeState();await assert.rejects(loadPortalRuntimeState(),(error:any)=>error.code==='SUPABASE_PT503');assert.equal(calls,2);
});
