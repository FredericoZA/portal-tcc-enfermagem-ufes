import test from 'node:test';import assert from 'node:assert/strict';
import {loadPortalRuntimeState,refreshPortalRuntimeState,savePortalRuntimeState} from './supabase';
test('commit diferencia unicidade de concorrência e leitura do callback não altera revisão',async()=>{
 const original=globalThis.fetch;const previous={url:process.env.SUPABASE_URL,key:process.env.SUPABASE_SERVICE_ROLE_KEY,provider:process.env.PORTAL_PERSISTENCE_PROVIDER};let failCode='23505';const expected:number[]=[];
 try{
  process.env.SUPABASE_URL='https://test.supabase.co';process.env.SUPABASE_SERVICE_ROLE_KEY='fake-test-key';process.env.PORTAL_PERSISTENCE_PROVIDER='supabase';let reads=0;
  globalThis.fetch=async(_url,init)=>{if(init?.method==='POST'){expected.push(JSON.parse(String(init.body)).expected_revision);return new Response(JSON.stringify({code:failCode,message:failCode==='40001'?'Conflito de concorrência':'duplicate key'}),{status:409});}return new Response(JSON.stringify([{revision:++reads===1?7:9,payload:{settings:{}}}]));};
  await loadPortalRuntimeState();await loadPortalRuntimeState(false);
  await assert.rejects(savePortalRuntimeState({settings:{changed:true}}),error=>error instanceof Error&&!error.message.includes('Conflito de concorrência')&&error.message.includes('23505'));
  failCode='40001';await assert.rejects(savePortalRuntimeState({settings:{changed:true}}),/Conflito de concorrência/);
  failCode='PT409';await assert.rejects(savePortalRuntimeState({settings:{changed:true}}),/Conflito de concorrência/);
  // A refused write must never spin, refresh-and-overwrite, or schedule itself.
  for(let tick=0;tick<10;tick++)await Promise.resolve();
  assert.deepEqual(expected,[7,7,7]);
 }finally{globalThis.fetch=original;for(const[k,v]of [['SUPABASE_URL',previous.url],['SUPABASE_SERVICE_ROLE_KEY',previous.key],['PORTAL_PERSISTENCE_PROVIDER',previous.provider]] as const){if(v===undefined)delete process.env[k];else process.env[k]=v;}}
});

test('commit só repete timeout SQL confirmado e reaproveita o estado recém-confirmado',async t=>{
 const previous={url:process.env.SUPABASE_URL,key:process.env.SUPABASE_SERVICE_ROLE_KEY,provider:process.env.PORTAL_PERSISTENCE_PROVIDER};
 process.env.SUPABASE_URL='https://timeout.supabase.co';process.env.SUPABASE_SERVICE_ROLE_KEY='fake-test-key';process.env.PORTAL_PERSISTENCE_PROVIDER='supabase';
 t.after(()=>{for(const[k,v]of [['SUPABASE_URL',previous.url],['SUPABASE_SERVICE_ROLE_KEY',previous.key],['PORTAL_PERSISTENCE_PROVIDER',previous.provider]] as const){if(v===undefined)delete process.env[k];else process.env[k]=v;}});
 let commits=0,revision=11;
 let outcome:'timeout-then-success'|'timeout'|'network'='timeout-then-success';
 const bodies:string[]=[];
 t.mock.method(globalThis,'fetch',async(url:URL|string,init?:RequestInit)=>{
   if(String(url).includes('/rpc/portal_commit_runtime_state')){
     commits++;bodies.push(String(init?.body));
     if(outcome==='network')throw new TypeError('ambiguous connection failure');
     if(commits===1||outcome==='timeout')return Response.json({code:'57014',message:'canceling statement due to statement timeout'},{status:500});
     return Response.json(++revision);
   }
   if(String(url).includes('/rpc/portal_read_runtime_snapshot_v1'))return Response.json({code:'PGRST202'},{status:404});
   if(new URL(String(url)).searchParams.get('select')==='revision')return Response.json([{revision}]);
   if(commits)throw new Error('snapshot completo inesperado');
   return Response.json([{revision,payload:{state:'before'}}]);
 });
 await loadPortalRuntimeState();
 await savePortalRuntimeState({state:'after'});
 assert.equal(commits,2);
 assert.equal(bodies[0],bodies[1]);
 assert.equal(JSON.parse(bodies[0]).expected_revision,11);
 assert.deepEqual(await refreshPortalRuntimeState(),{state:'after'});
 outcome='timeout';
 await assert.rejects(savePortalRuntimeState({state:'not saved'}),/57014/);
 assert.equal(commits,4);
 outcome='network';
 await assert.rejects(savePortalRuntimeState({state:'uncertain'}),/ambiguous/);
 assert.equal(commits,5);
 assert.deepEqual(await refreshPortalRuntimeState(),{state:'after'});
});

test('ACK perdido confirma só payload completo e revisão exata sem repetir POST nem mudar baseline em mismatch',async t=>{
 const {currentPortalRuntimeRevision}=await import('./supabase');
 const keys=['SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY','SUPABASE_SECRET_KEY','PORTAL_PERSISTENCE_PROVIDER','PORTAL_RUNTIME_AUDIT_DELTA'] as const;
 const previous=Object.fromEntries(keys.map(key=>[key,process.env[key]]));t.after(()=>{for(const key of keys){if(previous[key]===undefined)delete process.env[key];else process.env[key]=previous[key];}});
 process.env.SUPABASE_URL='https://ack-proof.supabase.co';process.env.SUPABASE_SERVICE_ROLE_KEY='unit-test';delete process.env.SUPABASE_SECRET_KEY;process.env.PORTAL_PERSISTENCE_PROVIDER='supabase';process.env.PORTAL_RUNTIME_AUDIT_DELTA='false';
 let revision=30,posts=0,reads=0,readFails=false;let remote:any={before:true};let outcome:'network'|'badack'='network';
 t.mock.method(globalThis,'fetch',async(url:any,init:any)=>{
  if(init?.method==='POST'){posts++;if(outcome==='badack')return Response.json(null);throw Error('lost ACK');}
  const parsed=new URL(String(url));assert.equal(parsed.searchParams.get('select'),'payload,revision');reads++;
  if(readFails)throw Error('read unavailable');return Response.json([{revision,payload:remote}]);
 });
 await loadPortalRuntimeState();
 const payload={signatureJobs:[{id:'job',status:'QUEUED',signers:[{role:'EXAMINER'}]}],auditLogs:[{id:'audit',action:'queued'}]};
 revision=31;remote={auditLogs:payload.auditLogs,signatureJobs:payload.signatureJobs};
 const {readFileSync}=await import('node:fs');const {runInNewContext}=await import('node:vm');const ts=await import('typescript');
 const server=readFileSync('server.ts','utf8');const start=server.indexOf('async function saveRemoteSnapshotWithRecovery(');const source=server.slice(start,server.indexOf('\n}\n',start)+2);
 const persist=runInNewContext(ts.transpileModule('('+source+')',{}).outputText,{savePortalRuntimeState,loadPortalRuntimeState,requireCanonicalAuditForPersistence:()=>{},applyPersistedState:()=>assert.fail('Confirmed ACK must resolve before conflict recovery.')});
 let queue=Promise.resolve().then(()=>persist(payload));await queue;assert.equal(posts,1);assert.equal(currentPortalRuntimeRevision(),31);
 // A later identical state is not proof of this new CAS commit.
 const candidate={...payload,auditLogs:[...payload.auditLogs,{id:'audit-2',action:'updated'}]};
 revision=33;remote=candidate;await assert.rejects(savePortalRuntimeState(candidate),/lost ACK/);assert.equal(currentPortalRuntimeRevision(),31);
 revision=32;remote={...payload,auditLogs:[{id:'changed-audit'}]};await assert.rejects(savePortalRuntimeState(candidate),/lost ACK/);assert.equal(currentPortalRuntimeRevision(),31);
 readFails=true;await assert.rejects(savePortalRuntimeState(candidate),/lost ACK/);assert.equal(currentPortalRuntimeRevision(),31);
 readFails=false;outcome='badack';remote=candidate;await savePortalRuntimeState(candidate);assert.equal(currentPortalRuntimeRevision(),32);assert.equal(posts,5);assert.ok(reads>=6);
});
