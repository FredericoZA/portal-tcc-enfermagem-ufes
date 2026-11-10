import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {performance} from 'node:perf_hooks';
import {PGlite} from '@electric-sql/pglite';
import {pgcrypto} from '@electric-sql/pglite/contrib/pgcrypto';
import {existingSignatureJobPatch} from './signatureJobPatch';
import {loadPortalRuntimeState,savePortalRuntimeState,refreshPortalRuntimeState,currentPortalRuntimeRevision} from './supabase';

const migration='supabase/migrations/20261107202908_signature_job_scoped_commit.sql';
const identity={id:'sig-fixture',processId:'p1',documentType:'ATA',documentVersion:1,idempotencyKey:'a'.repeat(64),createdBy:'master@example.invalid',createdAt:'2026-11-07T12:00:00Z',sourceDataRevision:1};
const job={...identity,status:'QUEUED',contentSha256:'b'.repeat(64),driveUnsignedFileId:'private-drive-fixture',fileName:'Ata.pdf',signers:[{name:'Orientador',email:'advisor@example.invalid',role:'ADVISOR',signingOrder:1,status:'PENDING'},{name:'Examinador',email:'exam@example.invalid',role:'EXAMINER',signingOrder:2,status:'PENDING'},{name:'Coorientadora',email:'co@example.invalid',role:'CO_ADVISOR',signingOrder:3,status:'PENDING'}]};
function state(){return {settings:{masterEmail:'master@example.invalid',commissionPresidentEmail:'president@example.invalid'},authorizedStudents:Array.from({length:88},(_,i)=>({email:`student${i}@example.invalid`,nome:`Pessoa ${i}`,active:i!==0,manualRevocation:i===0})),processes:[1,2].map(i=>({id:`p${i}`,protocolo:`TCC-2026-000${i}`,titulo:`Trabalho ${i}`,status:'AGUARDANDO_ASSINATURA',createdAt:'2026-11-07T12:00:00Z',aluno1:{email:`author${i}@example.invalid`,nome:`Autoria ${i}`},orientador:{email:'advisor@example.invalid',nome:'Orientador'},banca:[]})),signatureJobs:[structuredClone(job)],auditLogs:[],emailDeliveries:[],workflowRuns:[]};}
async function fixture(payload=state()){
 const db=new PGlite({extensions:{pgcrypto}});
 await db.exec('create role anon; create role authenticated; create role service_role bypassrls; create schema auth; create function auth.uid() returns uuid language sql as $$select null::uuid$$;');
 for(const file of ['202608270001_portal_producao','202608290001_portal_normalized_core','202608310001_portal_transactional_runtime','202609010001_portal_governance_v4','20260911102237_portal_author_access_trigger_fix','20260911183500_portal_publication_security_v8','202609190001_portal_publication_projection_requested_at_fix_v12'])await db.exec(await readFile(`supabase/migrations/${file}.sql`,'utf8'));
 await db.exec("alter table portal_signature_signers drop constraint portal_signature_signers_signer_role_check; alter table portal_signature_signers add constraint portal_signature_signers_signer_role_check check(signer_role in ('STUDENT','ADVISOR','COMMISSION_PRESIDENT','EXAMINER','CO_ADVISOR'));");
 await db.exec(await readFile(migration,'utf8'));
 await db.exec(await readFile('supabase/migrations/20261107224633_signature_job_append_commit.sql','utf8'));
 await db.query('select portal_commit_runtime_state(0,$1::jsonb)',[JSON.stringify(payload)]);
 return db;
}
async function normalized(db:PGlite){
 return {
  jobs:(await db.query('select j.external_id,p.external_id as process,j.document_type,f.drive_file_id,j.provider_envelope_id,j.idempotency_key,j.version,j.status,j.sent_at,j.completed_at,j.last_error_code,j.signed_sha256,j.verification_code from portal_signature_jobs j join portal_processes p on p.id=j.process_id left join portal_files f on f.id=j.source_file_id order by j.external_id')).rows,
  signers:(await db.query('select j.external_id,s.signer_name,s.signer_email,s.signer_role,s.signing_priority,s.status,s.signed_at from portal_signature_signers s join portal_signature_jobs j on j.id=s.signature_job_id order by j.external_id,s.signing_priority')).rows,
  files:(await db.query('select external_id,file_kind,lifecycle,drive_file_id,file_name,mime_type,sha256,version,visibility from portal_files order by external_id')).rows,
  processes:(await db.query('select external_id,code,title,status,cancelled_at from portal_processes order by external_id')).rows,
  access:(await db.query('select email,active,manual_revocation from portal_access_entries order by email')).rows,
  publications:(await db.query<{status:string}>('select p.external_id,q.status,q.publish_full_work,q.publish_expanded_abstract from portal_publications q join portal_processes p on p.id=q.process_id order by p.external_id')).rows,
 };
}
test('selector preserva identidades existentes e recusa alterações paralelas',()=>{
 const before=state(),next=structuredClone(before);next.signatureJobs[0].status='SENDING';
 assert.deepEqual(existingSignatureJobPatch(before,next),[next.signatureJobs[0]]);
 assert.equal(existingSignatureJobPatch(before,before),null);
 for(const invalid of [null,[],1,'invalid'])assert.equal(existingSignatureJobPatch(before,invalid as any),null);
 assert.equal(existingSignatureJobPatch(before,{...next,settings:{...next.settings,masterEmail:'other@example.invalid'}}),null);
 for(const key of ['id','processId','documentType','documentVersion','idempotencyKey','createdBy','createdAt','sourceDataRevision']){
  const changed=structuredClone(next) as any;changed.signatureJobs[0][key]='different';assert.equal(existingSignatureJobPatch(before,changed),null,key);
 }
 assert.equal(existingSignatureJobPatch(before,{...next,signatureJobs:[]}),null);
 assert.equal(existingSignatureJobPatch(before,{...next,signatureJobs:[...next.signatureJobs,{...job,id:'new'}]}),null);
 assert.equal(existingSignatureJobPatch(before,{...next,signatureJobs:[{...next.signatureJobs[0],oversized:'x'.repeat(200001)}]}),null);
});
test('TERMO assinado reprojeta publicação afetada com a mesma privacidade do commit integral',async()=>{
 const initial:any=state();initial.signatureJobs[0].documentType='TERMO';
 initial.processes[0]={...initial.processes[0],status:'CONCLUIDO',dataRevision:1,acervo:{publishFullWork:true,publishExpandedAbstract:false,authorizationConfirmedAt:'2026-11-07T12:00:00Z',publicationRequestedAt:'2026-11-07T12:00:00Z',trabalhoCompletoFileId:'private-full-work-fixture',trabalhoCompletoSha256:'d'.repeat(64),trabalhoCompletoVersion:1,trabalhoCompletoFileName:'Trabalho.pdf'}};
 const full=await fixture(initial),scoped=await fixture(initial);
 try{
  assert.equal((await normalized(scoped)).publications[0].status,'PENDING_AUTHORIZATION');
  const next=structuredClone(initial);next.signatureJobs[0].status='SIGNED';next.signatureJobs[0].signers=next.signatureJobs[0].signers.map((signer:any)=>({...signer,status:'SIGNED',signedAt:'2026-11-07T12:01:00Z'}));
  await full.query('select portal_commit_runtime_state(1,$1::jsonb)',[JSON.stringify(next)]);
  await scoped.query('select portal_commit_signature_jobs(1,$1::jsonb)',[JSON.stringify(next.signatureJobs)]);
  assert.deepEqual(await normalized(scoped),await normalized(full));
  assert.equal((await normalized(scoped)).publications[0].status,'PUBLISHED');
  assert.equal((await normalized(scoped)).publications[1].status,'PRIVATE');
 }finally{await full.close();await scoped.close();}
});
test('RPC scoped preserva projeções core/v4, signers/files, CAS, hash global e processo não alterado',async()=>{
 const initial=state(),full=await fixture(initial),scoped=await fixture(initial);
 try{
  let revision=1;
  for(const status of ['SENDING','SENT','PARTIALLY_SIGNED','SIGNED','ARCHIVED','PROVIDER_ERROR']){
   const next=structuredClone(initial);next.signatureJobs[0]={...next.signatureJobs[0],status,providerEnvelopeId:'fixture-envelope',signedSha256:'c'.repeat(64),verificationCode:'fixture-verification',sentAt:'2026-11-07T12:01:00Z',lastError:status==='PROVIDER_ERROR'?'fixture error':undefined,updatedAt:'2026-11-07T12:02:00Z',signers:next.signatureJobs[0].signers.map(s=>({...s,status:status==='SIGNED'||status==='ARCHIVED'?'SIGNED':'VIEWED',signedAt:status==='SIGNED'||status==='ARCHIVED'?'2026-11-07T12:02:00Z':undefined}))} as any;
   await full.query('select portal_commit_runtime_state($1,$2::jsonb)',[revision,JSON.stringify(next)]);
   await scoped.query('select portal_commit_signature_jobs($1,$2::jsonb)',[revision,JSON.stringify(next.signatureJobs)]);
   assert.deepEqual(await normalized(scoped),await normalized(full),status);
   assert.deepEqual((await scoped.query<{payload:unknown}>('select payload from portal_runtime_state')).rows[0].payload,JSON.parse(JSON.stringify(next)));
   assert.equal((await scoped.query<{ok:boolean}>("select payload_sha256=encode(digest(payload::text,'sha256'),'hex') as ok from portal_runtime_commits c join portal_runtime_state s on c.revision=s.revision")).rows[0].ok,true);
   revision++;
  }
  await assert.rejects(scoped.query('select portal_commit_signature_jobs(1,$1::jsonb)',[JSON.stringify([job])]),/concorrência/);
 }finally{await full.close();await scoped.close();}
});
test('falhas de projeção/identidade/ACL fazem rollback sem alterar revisão nem jobs',async()=>{
 const db=await fixture();
 try{
  const before=await normalized(db);
  const invalid={...job,status:'SENT',signers:[{...job.signers[0],role:'INVALID_ROLE'}]};
  await assert.rejects(db.query('select portal_commit_signature_jobs(1,$1::jsonb)',[JSON.stringify([invalid])]),/signer_role_check/);
  assert.deepEqual(await normalized(db),before);
  for(const changed of [[{...job,id:'new-job'}],[{...job,processId:'p2'}],[job,job]])await assert.rejects(db.query('select portal_commit_signature_jobs(1,$1::jsonb)',[JSON.stringify(changed)]));
  assert.equal((await db.query<{revision:number}>('select revision from portal_runtime_state')).rows[0].revision,1);
  for(const role of ['anon','authenticated']){await db.exec(`set role ${role}`);await assert.rejects(db.query("select portal_commit_signature_jobs(1,'[]')"),/permission denied/);await assert.rejects(db.query("select portal_project_signature_jobs_v1('[]')"),/permission denied/);await db.exec('reset role');}
  await db.exec('set role service_role');
  await db.query('select portal_commit_signature_jobs(1,$1::jsonb)',[JSON.stringify([{...job,status:'SENDING'}])]);
  assert.equal((await db.query<{revision:number}>('select revision from portal_runtime_state')).rows[0].revision,2);
 }finally{await db.close();}
});
test('adapter usa patch pequeno, ACK exato e cache isolado; fallback só quando RPC ausente',async t=>{
 const keys=['SUPABASE_URL','SUPABASE_SECRET_KEY','PORTAL_PERSISTENCE_PROVIDER','PORTAL_RUNTIME_AUDIT_DELTA'] as const;
 const previous=Object.fromEntries(keys.map(key=>[key,process.env[key]]));t.after(()=>{for(const key of keys){if(previous[key]===undefined)delete process.env[key];else process.env[key]=previous[key];}});
 Object.assign(process.env,{SUPABASE_URL:'https://signature-scoped.invalid',SUPABASE_SECRET_KEY:'fixture',PORTAL_PERSISTENCE_PROVIDER:'supabase',PORTAL_RUNTIME_AUDIT_DELTA:'false'});
 let remote:any={...state(),large:'x'.repeat(1_000_000)},revision=10;const posts:string[]=[];
 let mode:'ok'|'lost'|'missing'|'forbidden'|'mismatch'='ok';
 t.mock.method(globalThis,'fetch',async(url:any,init?:RequestInit)=>{
  const parsed=new URL(String(url));
    if(parsed.pathname.endsWith('/portal_runtime_commits'))return Response.json([]);
  if(init?.method!=='POST')return Response.json([{revision,...(parsed.searchParams.get('select')==='revision'?{}:{payload:remote})}]);
  const body=JSON.parse(String(init.body));posts.push(parsed.pathname);
  assert.equal(body.expected_revision,revision);
  if(parsed.pathname.endsWith('/portal_commit_signature_jobs')){
   assert.ok(String(init.body).length<3000);
   if(mode==='missing')return Response.json({code:'PGRST202'},{status:404});
   if(mode==='forbidden')return Response.json({code:'42501'},{status:403});
   remote={...remote,signatureJobs:remote.signatureJobs.map((old:any)=>body.changed_jobs.find((j:any)=>j.id===old.id)||old)};
   revision++;if(mode==='mismatch')remote={...remote,otherChange:true};
   if(mode==='lost'||mode==='mismatch')throw Error('lost ACK');
  }else{assert.ok(parsed.pathname.endsWith('/portal_commit_runtime_state'));remote=body.next_payload;revision++;}
  return Response.json(revision);
 });
 await loadPortalRuntimeState();
 const next=structuredClone(remote);next.signatureJobs[0].status='SENDING';await savePortalRuntimeState(next);next.large='caller mutation';
 assert.equal(posts.length,1);assert.equal(currentPortalRuntimeRevision(),11);assert.equal((await refreshPortalRuntimeState<any>()).large.length,1_000_000);
 mode='lost';const sent=structuredClone(remote);sent.signatureJobs[0].status='SENT';await savePortalRuntimeState(sent);assert.equal(posts.length,2);assert.equal(currentPortalRuntimeRevision(),12);
 mode='forbidden';const archived=structuredClone(remote);archived.signatureJobs[0].status='ARCHIVED';await assert.rejects(savePortalRuntimeState(archived),/403/);assert.equal(posts.length,3);assert.equal(currentPortalRuntimeRevision(),12);
 mode='missing';await savePortalRuntimeState(archived);assert.equal(posts.length,5);assert.ok(posts[3].endsWith('portal_commit_signature_jobs'));assert.ok(posts[4].endsWith('portal_commit_runtime_state'));
 mode='mismatch';const failed=structuredClone(remote);failed.signatureJobs[0].status='PROVIDER_ERROR';await assert.rejects(savePortalRuntimeState(failed),/lost ACK/);assert.equal(posts.length,6);assert.equal(currentPortalRuntimeRevision(),13);
});
test('benchmark local: commit de job existente evita reprojetar listas e auditoria sem alterar resultado',async t=>{
 const initial:any=state();initial.auditLogs=Array.from({length:273},(_,i)=>({id:`audit-${i}`,action:'fixture',timestamp:'2026-11-07T12:00:00Z',after:{value:'x'.repeat(9000)}}));initial.large='x'.repeat(1_870_000);
 const db=await fixture(initial);
 try{
  let revision=1;
  const run=async(scoped:boolean)=>{
   const times:number[]=[];
   for(let i=0;i<4;i++){
    const next=structuredClone(initial);next.signatureJobs[0].status=i%2?'SENT':'SENDING';
    const started=performance.now();
    await db.query(scoped?'select portal_commit_signature_jobs($1,$2::jsonb)':'select portal_commit_runtime_state($1,$2::jsonb)',[revision++,JSON.stringify(scoped?next.signatureJobs:next)]);
    if(i)times.push(performance.now()-started);
   }
   return times.sort((a,b)=>a-b)[1];
  };
  const fullMs=await run(false),scopedMs=await run(true);
  t.diagnostic(JSON.stringify({environment:'PGlite local, median of 3 after warmup, no network/production claim',processes:2,access:88,audit:273,fullMs,scopedMs,speedup:fullMs/scopedMs,fullRequestBytes:Buffer.byteLength(JSON.stringify(initial)),scopedRequestBytes:Buffer.byteLength(JSON.stringify(initial.signatureJobs))}));
 }finally{await db.close();}
});

test('retry scoped repete só transação57014abortada, mesmoCAS/body, sem repetir ACKincerto',async t=>{
 const keys=['SUPABASE_URL','SUPABASE_SECRET_KEY','PORTAL_PERSISTENCE_PROVIDER','PORTAL_RUNTIME_AUDIT_DELTA'] as const;
 const previous=Object.fromEntries(keys.map(key=>[key,process.env[key]]));t.after(()=>{for(const key of keys){if(previous[key]===undefined)delete process.env[key];else process.env[key]=previous[key];}});
 Object.assign(process.env,{SUPABASE_SECRET_KEY:'fixture',PORTAL_PERSISTENCE_PROVIDER:'supabase',PORTAL_RUNTIME_AUDIT_DELTA:'false'});
 for(const mode of ['success','timeout','canceled','conflict','network-applied','network-unknown'] as const){
  process.env.SUPABASE_URL=`https://signature-retry-${mode}.invalid`;
  const before=state(),next=structuredClone(before);next.signatureJobs[0].status='SENDING';
  let remote=structuredClone(before),revision=10,fullReads=0;const bodies:string[]=[];
  t.mock.method(globalThis,'fetch',async(url:any,init?:RequestInit)=>{
   const parsed=new URL(String(url));
    if(parsed.pathname.endsWith('/portal_runtime_commits'))return Response.json([]);
   if(init?.method!=='POST'){
    if(parsed.searchParams.get('select')==='revision')return Response.json([{revision}]);
    fullReads++;return Response.json([{revision,payload:remote}]);
   }
   assert.ok(parsed.pathname.endsWith('/rpc/portal_commit_signature_jobs'),'no full commit fallback or provider operation');
   bodies.push(String(init.body));assert.equal(JSON.parse(String(init.body)).expected_revision,10);
   if(mode==='canceled')return Response.json({code:'57014',message:'canceling statement due to user request'},{status:500});
   if(bodies.length===1||mode==='timeout')return Response.json({code:'57014',message:'canceling statement due to statement timeout'},{status:500});
   if(mode==='conflict')return Response.json({code:'PT409',message:'Conflito de concorrência'},{status:409});
   if(mode==='success'||mode==='network-applied'){remote=structuredClone(next);revision=11;}
   if(mode.startsWith('network'))throw new TypeError('lost signature ACK');
   return Response.json(revision);
  });
  await loadPortalRuntimeState();
  if(mode==='success'||mode==='network-applied')await savePortalRuntimeState(next);
  else await assert.rejects(savePortalRuntimeState(next),mode==='conflict'?/concorrência/:mode==='network-unknown'?/lost signature ACK/:/57014/);
  assert.equal(bodies.length,mode==='canceled'?1:2,mode);
  if(bodies.length===2)assert.equal(bodies[0],bodies[1],mode);
  assert.equal(currentPortalRuntimeRevision(),mode==='success'||mode==='network-applied'?11:10);
  assert.equal(fullReads,mode.startsWith('network')?2:1,'only ambiguous ACK requires canonical readback');
  assert.deepEqual(await refreshPortalRuntimeState(),mode==='success'||mode==='network-applied'?next:before);
 }
});
test('retry scoped compartilha30s e não inicia outra escrita depois do prazo',async t=>{
 const keys=['SUPABASE_URL','SUPABASE_SECRET_KEY','PORTAL_PERSISTENCE_PROVIDER','PORTAL_RUNTIME_AUDIT_DELTA'] as const;
 const previous=Object.fromEntries(keys.map(key=>[key,process.env[key]]));t.after(()=>{for(const key of keys){if(previous[key]===undefined)delete process.env[key];else process.env[key]=previous[key];}});
 Object.assign(process.env,{SUPABASE_URL:'https://signature-retry-budget.invalid',SUPABASE_SECRET_KEY:'fixture',PORTAL_PERSISTENCE_PROVIDER:'supabase',PORTAL_RUNTIME_AUDIT_DELTA:'false'});
 let now=0,revision=10,posts=0,expire=false;let remote=state();
 t.mock.method(Date,'now',()=>now);
 const timeouts:number[]=[];const nativeTimeout=AbortSignal.timeout;
 t.mock.method(AbortSignal,'timeout',(ms:number)=>{timeouts.push(ms);return nativeTimeout(ms);});
 t.mock.method(globalThis,'fetch',async(_url:any,init?:RequestInit)=>{
  if(init?.method!=='POST')return Response.json([{revision,payload:remote}]);
  posts++;
  if(posts===1||expire){now+=expire?30_001:15_000;return Response.json({code:'57014',message:'canceling statement due to statement timeout'},{status:500});}
  const changed=JSON.parse(String(init.body)).changed_jobs;remote={...remote,signatureJobs:changed};return Response.json(++revision);
 });
 await loadPortalRuntimeState();timeouts.length=0;
 const next=structuredClone(remote);next.signatureJobs[0].status='SENDING';await savePortalRuntimeState(next);
 assert.deepEqual(timeouts,[20_000,15_000]);assert.equal(posts,2);
 expire=true;posts=0;timeouts.length=0;
 const later=structuredClone(remote);later.signatureJobs[0].status='SENT';await assert.rejects(savePortalRuntimeState(later),/57014/);
 assert.equal(posts,1);assert.deepEqual(timeouts,[20_000]);assert.equal(currentPortalRuntimeRevision(),11);
});

function appendedJob(type:'ATA'|'TERMO'='TERMO'){
 return {...structuredClone(job),id:`sig-new-${type}`,driveUnsignedFileId:`private-new-${type}`,documentType:type,documentVersion:type==='ATA'?2:1,
  idempotencyKey:(type==='ATA'?'c':'d').repeat(64),provider:'ASTEN',providerCreationState:'PENDING',sourceDataRevision:type==='ATA'?3:4};
}
function appendState(){const initial:any=state();initial.processes[0].dataRevision=4;initial.processes[0].avaliacao={documentRevision:3};return initial;}
test('selector permite só sufixo novo preparado, preserva prefixo e rejeita exclusão/reordenação',()=>{
 const before=appendState(),next=structuredClone(before);next.signatureJobs.push(appendedJob());
 assert.deepEqual(existingSignatureJobPatch(before,next),[next.signatureJobs[1]]);
 next.signatureJobs[0].status='SENDING';assert.equal(existingSignatureJobPatch(before,next)?.length,2);
 for(const patch of [
  {...next,signatureJobs:[...next.signatureJobs].reverse()},
  {...next,signatureJobs:next.signatureJobs.slice(1)},
  {...next,signatureJobs:[next.signatureJobs[0],{...next.signatureJobs[1],id:job.id}]},
  {...next,signatureJobs:[next.signatureJobs[0],{...next.signatureJobs[1],idempotencyKey:job.idempotencyKey}]},
  {...next,signatureJobs:[next.signatureJobs[0],{...next.signatureJobs[1],status:'SENT'}]},
  {...next,signatureJobs:[next.signatureJobs[0],{...next.signatureJobs[1],provider:'GOV_BR'}]},
 ])assert.equal(existingSignatureJobPatch(before,patch),null);
 const empty={...before,signatureJobs:[]};assert.deepEqual(existingSignatureJobPatch(empty,{...empty,signatureJobs:[appendedJob()]}),[appendedJob()]);
});
test('append ATA e TERMO têm projeções normalizadas idênticas ao integral, sem perder coorientador/ordem/hash',async t=>{
 const initial=appendState(),full=await fixture(initial),scoped=await fixture(initial);
 try{
  const next=structuredClone(initial);next.signatureJobs[0].status='SENDING';next.signatureJobs.push(appendedJob('ATA'),appendedJob('TERMO'));
  const patch=existingSignatureJobPatch(initial,next);assert.equal(patch?.length,3);
  const started=performance.now();
  await full.query('select portal_commit_runtime_state(1,$1::jsonb)',[JSON.stringify(next)]);
  const fullMs=performance.now()-started,scopedStarted=performance.now();
  await scoped.query('select portal_commit_signature_jobs(1,$1::jsonb)',[JSON.stringify(patch)]);
  t.diagnostic(JSON.stringify({sample:'one local PGlite append ATA+TERMO, no production/network claim',fullMs,scopedMs:performance.now()-scopedStarted,fullBytes:Buffer.byteLength(JSON.stringify(next)),patchBytes:Buffer.byteLength(JSON.stringify(patch))}));
  assert.deepEqual(await normalized(scoped),await normalized(full));
  assert.deepEqual((await scoped.query<{payload:unknown}>('select payload from portal_runtime_state')).rows[0].payload,JSON.parse(JSON.stringify(next)));
  assert.equal((await scoped.query<{ok:boolean}>("select payload_sha256=encode(digest(payload::text,'sha256'),'hex') ok from portal_runtime_commits c join portal_runtime_state s on c.revision=s.revision")).rows[0].ok,true);
  assert.equal((await normalized(scoped)).signers.filter((row:any)=>row.signer_role==='CO_ADVISOR').length,3);
  await assert.rejects(scoped.query('select portal_commit_signature_jobs(1,$1::jsonb)',[JSON.stringify([appendedJob()])]),/concorrência/);
 }finally{await full.close();await scoped.close();}
});
test('append novo rejeita identidade/revisão/histórico falsos e faz rollback integral em falha de signatário',async()=>{
 const db=await fixture(appendState());
 try{
  const before=await normalized(db),valid=appendedJob();
  for(const invalid of [
   {...valid,sourceDataRevision:3},{...appendedJob('ATA'),sourceDataRevision:4},
   {...valid,processId:'absent'},{...valid,documentVersion:2},
   {...valid,id:job.id},{...valid,idempotencyKey:job.idempotencyKey},
   {...valid,status:'SENT'},{...valid,providerEnvelopeId:'123'},
   {...valid,signers:[{...valid.signers[0],status:'SIGNED'}]},
   {...valid,signers:[{...valid.signers[0],role:'INVALID_ROLE'}]},
  ]){
   await assert.rejects(db.query('select portal_commit_signature_jobs(1,$1::jsonb)',[JSON.stringify([invalid])]));
   assert.deepEqual(await normalized(db),before);
   assert.equal((await db.query<{revision:number}>('select revision from portal_runtime_state')).rows[0].revision,1);
  }
  await assert.rejects(db.query('select portal_commit_signature_jobs(1,$1::jsonb)',[JSON.stringify([valid,valid])]));
  // An already normalized ID absent from the aggregate cannot be seized.
  await db.query('select portal_project_signature_jobs_v1($1::jsonb)',[JSON.stringify([valid])]);
  await assert.rejects(db.query('select portal_commit_signature_jobs(1,$1::jsonb)',[JSON.stringify([valid])]),/Identidade/);
 }finally{await db.close();}
});
test('append primeiro job parte de lista vazia e mantém ACL invoker',async()=>{
 const initial=appendState();initial.signatureJobs=[];const db=await fixture(initial);
 try{
  const next={...appendedJob('ATA'),documentVersion:1};
  await db.query('select portal_commit_signature_jobs(1,$1::jsonb)',[JSON.stringify([next])]);
  assert.deepEqual((await db.query<{payload:any}>('select payload from portal_runtime_state')).rows[0].payload.signatureJobs,[next]);
  assert.equal((await db.query<{prosecdef:boolean}>("select prosecdef from pg_proc where oid='portal_commit_signature_jobs(bigint,jsonb)'::regprocedure")).rows[0].prosecdef,false);
 }finally{await db.close();}
});

test('adapter append usa RPC pequeno e ACK perdido confirma o novo job sem segunda escrita',async t=>{
 const keys=['SUPABASE_URL','SUPABASE_SECRET_KEY','PORTAL_PERSISTENCE_PROVIDER','PORTAL_RUNTIME_AUDIT_DELTA'] as const;
 const previous=Object.fromEntries(keys.map(key=>[key,process.env[key]]));t.after(()=>{for(const key of keys){if(previous[key]===undefined)delete process.env[key];else process.env[key]=previous[key];}});
 Object.assign(process.env,{SUPABASE_SECRET_KEY:'fixture',PORTAL_PERSISTENCE_PROVIDER:'supabase',PORTAL_RUNTIME_AUDIT_DELTA:'false'});
 for(const mode of ['applied','unknown'] as const){
  process.env.SUPABASE_URL=`https://append-ack-${mode}.invalid`;
  let remote=appendState(),revision=1,posts=0;
  const next=structuredClone(remote);next.signatureJobs.push(appendedJob());
  t.mock.method(globalThis,'fetch',async(url:any,init?:RequestInit)=>{
   if(init?.method!=='POST')return Response.json([{revision,payload:remote}]);
   posts++;assert.ok(String(url).endsWith('/rpc/portal_commit_signature_jobs'));
   const payload=JSON.parse(String(init.body));assert.equal(payload.expected_revision,1);assert.deepEqual(payload.changed_jobs,[appendedJob()]);
   if(mode==='applied'){remote=structuredClone(next);revision=2;}
   throw new TypeError('ACK lost');
  });
  await loadPortalRuntimeState();
  if(mode==='applied')await savePortalRuntimeState(next);else await assert.rejects(savePortalRuntimeState(next),/ACK lost/);
  assert.equal(posts,1);assert.equal(currentPortalRuntimeRevision(),mode==='applied'?2:1);
 }
});

test('versioned signer policy survives PostgreSQL JSONB commit, normalized signer projection, scoped update and runtime reload',async t=>{
 const {DEMO_PROCESSES}=await import('../../src/services/demoSeed');
 const {deriveSignatureSigners,captureSignaturePolicySnapshot,assertCurrentSignatureRecipients}=await import('../workflow/signaturePolicy');
 const p=structuredClone(DEMO_PROCESSES[0]);p.id='p1';p.avaliacao.coadvisorPresent=false;
 const settings={commissionPresidentName:'Presidência',commissionPresidentEmail:'president@example.invalid',integrationStudio:{revision:9,docTemplates:[{id:'tmpl-ata',type:'ATA',signatureRecipientRoles:['ADVISOR','EXAMINERS','AUTHORS','COADVISOR_PRESENT','COMMISSION_PRESIDENT']}]} as any};
 const signers=deriveSignatureSigners(p,'ATA',settings),snapshot=captureSignaturePolicySnapshot(p,'ATA',settings,signers);
 const initial:any=state();initial.processes[0]=p;initial.signatureJobs[0]={...initial.signatureJobs[0],ataSignerPolicy:'BOARD_AUTHORS_V1',signers,signerPolicySnapshot:snapshot};
 const db=await fixture(initial);
 try{
  const changed={...initial.signatureJobs[0],status:'SENT',providerEnvelopeId:'frozen-envelope',signers:signers.map(s=>({...s,status:'VIEWED'}))};
  await db.query('select portal_commit_signature_jobs(1,$1::jsonb)',[JSON.stringify([changed])]);
  const normalizedRows=await db.query<{signer_email:string}>('select s.signer_email from portal_signature_signers s join portal_signature_jobs j on j.id=s.signature_job_id where j.external_id=$1',[changed.id]);
  assert.deepEqual(normalizedRows.rows.map(row=>row.signer_email).sort(),signers.map(s=>s.email).sort());
  for(const [key,value]of Object.entries({SUPABASE_URL:'https://signer-policy-jsonb.invalid',SUPABASE_SECRET_KEY:'fixture-only',PORTAL_PERSISTENCE_PROVIDER:'supabase',PORTAL_RUNTIME_WIRE_SNAPSHOT:'false',PORTAL_RUNTIME_AUDIT_DELTA:'false'})){
   const previous=process.env[key];process.env[key]=value;t.after(()=>{if(previous===undefined)delete process.env[key];else process.env[key]=previous;});
  }
  t.mock.method(globalThis,'fetch',async()=>Response.json((await db.query('select payload,revision from portal_runtime_state where id=\'global\'')).rows));
  const reloaded=await loadPortalRuntimeState<any>(false);
  assert.deepEqual(reloaded.signatureJobs[0].signerPolicySnapshot,snapshot);
  assert.doesNotThrow(()=>assertCurrentSignatureRecipients(p,'ATA',reloaded.signatureJobs[0],{commissionPresidentEmail:'changed@example.invalid'}));
 }finally{await db.close();}
});
