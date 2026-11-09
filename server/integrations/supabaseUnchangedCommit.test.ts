import test from 'node:test';
import assert from 'node:assert/strict';
import {loadPortalRuntimeState,savePortalRuntimeState,currentPortalRuntimeRevision} from './supabase';

test('unchanged durable barriers verify the authoritative revision without reuploading or incrementing state',async t=>{
 for(const[key,value]of Object.entries({SUPABASE_URL:'https://unchanged-runtime.invalid',SUPABASE_SECRET_KEY:'test-unchanged-key',PORTAL_PERSISTENCE_PROVIDER:'supabase',PORTAL_RUNTIME_AUDIT_DELTA:'false',PORTAL_RUNTIME_WIRE_SNAPSHOT:'false'})){
  const previous=process.env[key];process.env[key]=value;t.after(()=>{if(previous===undefined)delete process.env[key];else process.env[key]=previous;});
 }
 const initial={settings:{masterEmail:'master@example.invalid'},auditLogs:[{id:'original',details:'x'.repeat(100000)}]};
 let revision=17,payload=structuredClone(initial),failRead=false;const requests:Array<{path:string;selection:string|null;bytes:number}>=[];
 t.mock.method(globalThis,'fetch',async(url:string,options?:RequestInit)=>{
  const target=new URL(url);requests.push({path:target.pathname,selection:target.searchParams.get('select'),bytes:Buffer.byteLength(String(options?.body||''))});
  if(target.pathname.endsWith('/portal_runtime_state')){
   if(failRead)return Response.json({code:'42501'},{status:403});
   return Response.json([{revision,...(target.searchParams.get('select')==='revision'?{}:{payload})}]);
  }
  assert.ok(target.pathname.endsWith('/portal_commit_runtime_state'));
  const body=JSON.parse(String(options?.body));assert.equal(body.expected_revision,revision);payload=body.next_payload;return Response.json(++revision);
 });
 await loadPortalRuntimeState();requests.length=0;
 await savePortalRuntimeState(structuredClone(initial));
 assert.deepEqual(requests,[{path:'/rest/v1/portal_runtime_state',selection:'revision',bytes:0}]);assert.equal(revision,17);assert.equal(currentPortalRuntimeRevision(),17);
 revision=18;await assert.rejects(savePortalRuntimeState(initial),/Conflito de concorrência/);assert.equal(currentPortalRuntimeRevision(),17);
 revision=17;failRead=true;await assert.rejects(savePortalRuntimeState(initial),/verificar a revisão/);assert.equal(currentPortalRuntimeRevision(),17);
 failRead=false;requests.length=0;const changed={...initial,settings:{masterEmail:'new-master@example.invalid'}};await savePortalRuntimeState(changed);
 assert.equal(requests.filter(item=>item.path.endsWith('/portal_commit_runtime_state')).length,1);assert.deepEqual(payload,changed);assert.equal(currentPortalRuntimeRevision(),18);
 requests.length=0;const logged={...changed,auditLogs:[...changed.auditLogs,{id:'new',details:'one actual event'}]};await savePortalRuntimeState(logged);await savePortalRuntimeState(structuredClone(logged));
 assert.equal(requests.filter(item=>item.path.endsWith('/portal_commit_runtime_state')).length,1,'one actual audit event commits once; its repeated barrier does not create a new revision');assert.equal(currentPortalRuntimeRevision(),19);
});
