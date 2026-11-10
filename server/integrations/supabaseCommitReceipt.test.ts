import assert from 'node:assert/strict';import test from 'node:test';
import{currentPortalRuntimeRevision,loadPortalRuntimeState,savePortalRuntimeState}from'./supabase';
import{runtimeCommitPayloadHash}from'./runtimeCommitHash';

for(const mode of ['exact','wrong-hash','wrong-revision','denied','missing']as const)test(`lost commit reply uses only verified receipt: ${mode}`,async t=>{
 for(const[key,value]of Object.entries({SUPABASE_URL:`https://receipt-${mode}.invalid`,SUPABASE_SECRET_KEY:'fixture-key',PORTAL_PERSISTENCE_PROVIDER:'supabase',PORTAL_RUNTIME_WIRE_SNAPSHOT:'false',PORTAL_RUNTIME_AUDIT_DELTA:'false'})){
  const previous=process.env[key];process.env[key]=value;t.after(()=>{if(previous===undefined)delete process.env[key];else process.env[key]=previous;});
 }
 const next={before:false,auditLogs:[{id:'new',action:'saved'}]};let posts=0,fullReads=0,receipts=0;
 t.mock.method(globalThis,'fetch',async(url:any,init?:RequestInit)=>{
  const target=new URL(url);
  if(init?.method==='POST'){posts++;throw Error('lost reply');}
  if(target.pathname.endsWith('/portal_runtime_commits')){
   receipts++;assert.equal(target.searchParams.get('revision'),'eq.8');assert.equal(target.searchParams.get('select'),'revision,payload_sha256');assert.equal(init?.cache,'no-store');assert.ok(init?.signal);
   if(mode==='denied')return Response.json({}, {status:403});
   if(mode==='missing')return Response.json([]);
   return Response.json([{revision:mode==='wrong-revision'?9:8,payload_sha256:mode==='wrong-hash'?'0'.repeat(64):runtimeCommitPayloadHash(next)}]);
  }
  fullReads++;return Response.json([{revision:7,payload:{before:true}}]);
 });
 await loadPortalRuntimeState();
 if(mode==='exact'){await savePortalRuntimeState(next);assert.equal(currentPortalRuntimeRevision(),8);assert.equal(fullReads,1,'no full payload read after ambiguous reply');}
 else{await assert.rejects(savePortalRuntimeState(next),/lost reply/);assert.equal(currentPortalRuntimeRevision(),7);assert.equal(fullReads,2);}
 assert.equal(posts,1,'ambiguous write is never replayed');assert.equal(receipts,1);
});
