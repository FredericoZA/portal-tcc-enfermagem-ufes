import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {performance} from 'node:perf_hooks';
import {PGlite} from '@electric-sql/pglite';
import {pgcrypto} from '@electric-sql/pglite/contrib/pgcrypto';
import {documentModelPublicationPatch} from './documentModelPatch';
import {loadPortalRuntimeState,savePortalRuntimeState,refreshPortalRuntimeState,currentPortalRuntimeRevision} from './supabase';

const migration='supabase/migrations/20261107224631_document_model_scoped_commit.sql';
const identity={id:'sig-fixture',processId:'p1',documentType:'ATA',documentVersion:1,idempotencyKey:'a'.repeat(64),createdBy:'master@example.invalid',createdAt:'2026-11-07T12:00:00Z',sourceDataRevision:1};
const job={...identity,status:'QUEUED',contentSha256:'b'.repeat(64),driveUnsignedFileId:'private-drive-fixture',fileName:'Ata.pdf',signers:[{name:'Orientador',email:'advisor@example.invalid',role:'ADVISOR',signingOrder:1,status:'PENDING'},{name:'Examinador',email:'exam@example.invalid',role:'EXAMINER',signingOrder:2,status:'PENDING'},{name:'Coorientadora',email:'co@example.invalid',role:'CO_ADVISOR',signingOrder:3,status:'PENDING'}]};
function state(){return {settings:{documentModels:{ATA:{fileId:'old-model',version:1}},updatedAt:'2026-11-07T12:00:00Z',masterEmail:'master@example.invalid',commissionPresidentEmail:'president@example.invalid'},authorizedStudents:Array.from({length:88},(_,i)=>({email:`student${i}@example.invalid`,nome:`Pessoa ${i}`,active:i!==0,manualRevocation:i===0})),processes:[1,2].map(i=>({id:`p${i}`,protocolo:`TCC-2026-000${i}`,titulo:`Trabalho ${i}`,status:'AGUARDANDO_ASSINATURA',createdAt:'2026-11-07T12:00:00Z',aluno1:{email:`author${i}@example.invalid`,nome:`Autoria ${i}`},orientador:{email:'advisor@example.invalid',nome:'Orientador'},banca:[]})),signatureJobs:[structuredClone(job)],auditLogs:[],emailDeliveries:[],workflowRuns:[]};}
async function fixture(payload=state()){
 const db=new PGlite({extensions:{pgcrypto}});
 await db.exec('create role anon; create role authenticated; create role service_role bypassrls; create schema auth; create function auth.uid() returns uuid language sql as $$select null::uuid$$;');
 for(const file of ['202608270001_portal_producao','202608290001_portal_normalized_core','202608310001_portal_transactional_runtime','202609010001_portal_governance_v4','20260911102237_portal_author_access_trigger_fix','20260911183500_portal_publication_security_v8','202609190001_portal_publication_projection_requested_at_fix_v12'])await db.exec(await readFile(`supabase/migrations/${file}.sql`,'utf8'));
 await db.exec("alter table portal_signature_signers drop constraint portal_signature_signers_signer_role_check; alter table portal_signature_signers add constraint portal_signature_signers_signer_role_check check(signer_role in ('STUDENT','ADVISOR','COMMISSION_PRESIDENT','EXAMINER','CO_ADVISOR'));");
 await db.exec(await readFile(migration,'utf8'));
 await db.exec(await readFile('supabase/migrations/20261106001943_runtime_audit_delta.sql','utf8'));
 await db.exec(await readFile('supabase/migrations/20261107194035_runtime_audit_chunk_projection.sql','utf8'));
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
function changed(initial=state()):any{
 const next:any=structuredClone(initial);next.settings.documentModels.ATA={fileId:'reviewed-model',version:2};next.settings.updatedAt='2026-11-07T12:01:00Z';
 next.auditLogs.push({id:'model-published',timestamp:'2026-11-07T12:01:00Z',actorEmail:'MASTER@example.invalid',action:'MODEL_PUBLISHED',entityType:'document-model',entityId:'ATA',processId:'p1',before:{version:1},after:{version:2}});
 return next;
}
async function commit(db:PGlite,revision:number,next:any){const patch=documentModelPublicationPatch((await db.query<{payload:any}>('select payload from portal_runtime_state')).rows[0].payload,next);assert.ok(patch);return db.query('select portal_commit_document_models($1,$2::jsonb,$3,$4::jsonb)',[revision,JSON.stringify(patch.document_models),patch.settings_updated_at,JSON.stringify(patch.audit_append)]);}
async function audit(db:PGlite){return (await db.query('select external_id,occurred_at,actor_email_hash,process_code,event_type,entity_type,entity_id,details from portal_audit_events order by external_id')).rows;}
test('model selector refuses unrelated writes, missing histories, pruning and duplicate IDs',()=>{
 const initial=state(),next=changed(initial);assert.ok(documentModelPublicationPatch(initial,next));assert.equal(documentModelPublicationPatch(initial,initial),null);
 for(const value of [null,[],42,'bad'])assert.equal(documentModelPublicationPatch(initial,value as any),null);
 for(const key of ['masterEmail','commissionPresidentEmail','featureFlags','installationProfile','academicCycles'])assert.equal(documentModelPublicationPatch(initial,{...next,settings:{...next.settings,[key]:'changed'}}),null,key);
 for(const key of ['processes','signatureJobs','authorizedStudents','studioVersions','emailDeliveries','workflowRuns'])assert.equal(documentModelPublicationPatch(initial,{...next,[key]:[{changed:true}]}),null,key);
 const existing:any={...initial,auditLogs:[{id:'old',action:'old'}]};
 assert.equal(documentModelPublicationPatch(existing,{...next,auditLogs:[{id:'old',action:'rewritten'}]}),null);
 assert.equal(documentModelPublicationPatch(existing,{...next,auditLogs:[]}),null);
 assert.equal(documentModelPublicationPatch(initial,{...next,auditLogs:[next.auditLogs[0],next.auditLogs[0]]}),null);
 assert.equal(documentModelPublicationPatch(existing,{...next,auditLogs:[...existing.auditLogs,{id:'old'}]}),null);
 assert.equal(documentModelPublicationPatch({...initial,auditLogs:undefined},{...next,auditLogs:undefined}),null);
 assert.equal(documentModelPublicationPatch(initial,{...next,settings:{...next.settings,documentModels:{big:'x'.repeat(2_000_001)}}}),null);
});
test('scoped model commit matches full canonical/hash/audit/chunks and preserves unrelated normalized data',async()=>{
 const initial=state(),full=await fixture(initial),scoped=await fixture(initial);
 try{
  const next=changed(initial),before=await normalized(scoped);
  await full.query('select portal_commit_runtime_state(1,$1::jsonb)',[JSON.stringify(next)]);await commit(scoped,1,next);
  assert.deepEqual(await normalized(scoped),before);assert.deepEqual(await normalized(scoped),await normalized(full));assert.deepEqual(await audit(scoped),await audit(full));
  const snapshot=(db:PGlite)=>db.query<{revision:number;payload:unknown}>('select revision,payload from portal_runtime_state');
  assert.deepEqual((await snapshot(scoped)).rows,(await snapshot(full)).rows);
  assert.deepEqual((await scoped.query('select chunk,fingerprint,events from portal_runtime_audit_chunks order by chunk')).rows,(await full.query('select chunk,fingerprint,events from portal_runtime_audit_chunks order by chunk')).rows);
  assert.equal((await scoped.query<{ok:boolean}>("select payload_sha256=encode(digest(payload::text,'sha256'),'hex') as ok from portal_runtime_commits c join portal_runtime_state s on c.revision=s.revision")).rows[0].ok,true);
  await assert.rejects(scoped.query("select portal_commit_document_models(1,'{}','stamp','[]')"),/concorrência/);
  await scoped.exec('drop function portal_commit_document_models(bigint,jsonb,text,jsonb)');
  await scoped.query('select portal_commit_runtime_state(2,$1::jsonb)',[JSON.stringify(next)]);
  assert.deepEqual((await snapshot(scoped)).rows[0].payload,JSON.parse(JSON.stringify(next)));
 }finally{await full.close();await scoped.close();}
});
test('model RPC validates CAS/history and rolls back projection errors; only service role can execute',async()=>{
 const db=await fixture();try{
  const initial=(await db.query('select revision,payload from portal_runtime_state')).rows,before=await normalized(db);
  for(const entries of [[{id:'bad',timestamp:'invalid-date'}],[{id:'same'},{id:'same'}],[{}]]){
   await assert.rejects(db.query("select portal_commit_document_models(1,'{}','stamp',$1::jsonb)",[JSON.stringify(entries)]));
   await db.exec('rollback');assert.deepEqual((await db.query('select revision,payload from portal_runtime_state')).rows,initial);assert.deepEqual(await normalized(db),before);assert.deepEqual(await audit(db),[]);
  }
  for(const role of ['anon','authenticated']){await db.exec(`set role ${role}`);await assert.rejects(db.query("select portal_commit_document_models(1,'{}','stamp','[]')"),/permission denied/);await db.exec('reset role');}
  assert.equal((await db.query<{prosecdef:boolean}>("select prosecdef from pg_proc where proname='portal_commit_document_models'")).rows[0].prosecdef,false);
  await db.exec('set role service_role');await commit(db,1,changed());
  await assert.rejects(db.query("select portal_commit_document_models(2,'{}','stamp','[{\"id\":\"model-published\"}]')"),/acrescentar/);
  assert.equal((await db.query<{revision:number}>('select revision from portal_runtime_state')).rows[0].revision,2);
 }finally{await db.close();}
});
test('adapter sends small model patch, exact readback for lost ACK, narrow missing-RPC fallback and bounded timeout retry',async t=>{
 const keys=['SUPABASE_URL','SUPABASE_SECRET_KEY','PORTAL_PERSISTENCE_PROVIDER','PORTAL_RUNTIME_AUDIT_DELTA'] as const;
 const prior=Object.fromEntries(keys.map(k=>[k,process.env[k]]));t.after(()=>{for(const k of keys){if(prior[k]===undefined)delete process.env[k];else process.env[k]=prior[k];}});
 Object.assign(process.env,{SUPABASE_URL:'https://model-scoped.invalid',SUPABASE_SECRET_KEY:'fixture',PORTAL_PERSISTENCE_PROVIDER:'supabase',PORTAL_RUNTIME_AUDIT_DELTA:'false'});
 let remote:any={...state(),large:'x'.repeat(1_000_000)},revision=10,mode='ok';const posts:{url:string;body:string}[]=[];let failures=0;
 t.mock.method(globalThis,'fetch',async(url:any,init?:RequestInit)=>{
  const parsed=new URL(String(url));if(init?.method!=='POST')return Response.json([{revision,...(parsed.searchParams.get('select')==='revision'?{}:{payload:remote})}]);
  const body=JSON.parse(String(init.body));posts.push({url:parsed.pathname,body:String(init.body)});assert.equal(body.expected_revision,revision);
  if(parsed.pathname.endsWith('portal_commit_document_models')){
   assert.ok(String(init.body).length<3000);
   if(mode==='missing')return Response.json({code:'PGRST202'},{status:404});
   if(mode==='forbidden')return Response.json({code:'42501'},{status:403});
   if(mode==='timeout'&&failures++===0)return Response.json({code:'57014',message:'canceling statement due to statement timeout'},{status:500});
   remote={...remote,settings:{...remote.settings,documentModels:body.document_models,updatedAt:body.settings_updated_at},auditLogs:[...remote.auditLogs,...body.audit_append]};revision++;
   if(mode==='mismatch')remote.other='concurrent';if(mode==='lost'||mode==='mismatch')throw Error('lost ACK');
  }else{assert.ok(parsed.pathname.endsWith('portal_commit_runtime_state'));remote=body.next_payload;revision++;}
  return Response.json(revision);
 });
 await loadPortalRuntimeState();
 const next=changed(remote);await savePortalRuntimeState(next);next.large='mutated';assert.equal(posts.length,1);assert.equal((await refreshPortalRuntimeState<any>()).large.length,1_000_000);
 const update=()=>{const n=structuredClone(remote);n.settings.documentModels.ATA.version++;n.settings.updatedAt+='x';return n;};
 mode='lost';await savePortalRuntimeState(update());assert.equal(posts.length,2);assert.equal(currentPortalRuntimeRevision(),12);
 mode='timeout';await savePortalRuntimeState(update());assert.equal(posts.length,4);assert.equal(posts[2].body,posts[3].body);
 mode='forbidden';await assert.rejects(savePortalRuntimeState(update()),/403/);assert.equal(posts.length,5);assert.equal(currentPortalRuntimeRevision(),13);
 mode='missing';await savePortalRuntimeState(update());assert.equal(posts.length,7);assert.ok(posts[6].url.endsWith('portal_commit_runtime_state'));
 mode='mismatch';await assert.rejects(savePortalRuntimeState(update()),/lost ACK/);assert.equal(posts.length,8);assert.equal(currentPortalRuntimeRevision(),14);
});
test('synthetic model commit benchmark: 4.45 MB canonical metadata, exact payload unchanged outside models',async t=>{
 const initial:any=state();initial.auditLogs=Array.from({length:273},(_,i)=>({id:`audit-${i}`,timestamp:'2026-11-07T12:00:00Z',action:'fixture',after:{value:'x'.repeat(9300)}}));initial.large='x'.repeat(1_870_000);
 const db=await fixture(initial);try{
  let revision=1,current=initial;
  const run=async(scoped:boolean)=>{const times:number[]=[];for(let i=0;i<4;i++){const next=structuredClone(current);next.settings.documentModels.ATA.version++;next.settings.updatedAt+='x';next.auditLogs.push({id:`model-benchmark-${revision}`,timestamp:'2026-11-07T12:01:00Z',action:'MODEL_PUBLISHED',entityType:'document-model',entityId:'ATA'});const patch=documentModelPublicationPatch(current,next);assert.ok(patch);const start=performance.now();if(scoped)await db.query('select portal_commit_document_models($1,$2::jsonb,$3,$4::jsonb)',[revision,JSON.stringify(patch.document_models),patch.settings_updated_at,JSON.stringify(patch.audit_append)]);else await db.query('select portal_commit_runtime_state($1,$2::jsonb)',[revision,JSON.stringify(next)]);revision++;current=next;if(i)times.push(performance.now()-start);}return times.sort((a,b)=>a-b)[1];};
  const full=await run(false),scoped=await run(true);assert.deepEqual((await db.query<{payload:any}>('select payload from portal_runtime_state')).rows[0].payload,current);
  t.diagnostic(JSON.stringify({bytes:Buffer.byteLength(JSON.stringify(initial)),fullMedianMs:full,modelMedianMs:scoped,patchBytes:Buffer.byteLength(JSON.stringify({document_models:current.settings.documentModels,settings_updated_at:current.settings.updatedAt,audit_append:[current.auditLogs.at(-1)]}))}));
 }finally{await db.close();}
});
