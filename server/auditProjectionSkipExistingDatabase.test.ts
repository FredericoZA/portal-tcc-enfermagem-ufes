import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {pgcrypto} from '@electric-sql/pglite/contrib/pgcrypto';

const candidatePath='supabase/migrations/20261107205937_skip_existing_audit_projection.sql';
const rollbackPath='supabase/rollbacks/20261107205937_skip_existing_audit_projection.sql';
const insideTransaction=(sql:string)=>sql.replace(/\bbegin;/i,'').replace(/\bcommit;\s*$/i,'');

test('audit-only selector preserves append-only results and every other projection, owner/ACL/security, and rollback',async t=>{
  const db=new PGlite({extensions:{pgcrypto}});
  try{
    await db.exec('create role anon;create role authenticated;create role service_role;create role metadata_reader;create schema auth;create function auth.uid() returns uuid language sql as $$select null::uuid$$;');
    for(const file of ['202608270001_portal_producao','202608290001_portal_normalized_core','202608310001_portal_transactional_runtime','20260911102237_portal_author_access_trigger_fix'])await db.exec(await readFile(`supabase/migrations/${file}.sql`,'utf8'));
    // Extra legitimate ACL proves CREATE OR REPLACE does not reset installed grants.
    await db.exec('grant execute on function public.portal_project_runtime_state(jsonb) to metadata_reader;');
    const person=(email:string)=>({nome:'Fixture Person',email});
    const timestamp='2026-11-07T12:00:00Z';
    const historical=Array.from({length:276},(_,index)=>({id:`history-${index}`,processId:'fixture-process',actorEmail:'actor@example.invalid',action:'HISTORY',entityType:'process',entityId:'fixture-process',timestamp,before:{index},after:{message:'x'.repeat(9000),index}}));
    const initial={settings:{masterEmail:'master@example.invalid'},authorizedStudents:[{...person('student@example.invalid'),origin:'MASTER_LIST',active:false,manualRevocation:true,createdAt:timestamp,updatedAt:timestamp}],processes:[{id:'fixture-process',protocolo:'TCC-2026-0001',titulo:'Fixture before',createdAt:timestamp,updatedAt:timestamp,aluno1:person('student@example.invalid'),orientador:person('advisor@example.invalid'),banca:[{...person('examiner@example.invalid'),funcao:'EXAMINER_2'}]}],signatureJobs:[{id:'fixture-signature',processId:'fixture-process',documentType:'ATA',createdBy:'advisor@example.invalid',createdAt:timestamp,updatedAt:timestamp,documentVersion:1,idempotencyKey:'a'.repeat(64),status:'QUEUED',signers:[{role:'ADVISOR',name:'Fixture Person',email:'advisor@example.invalid',signingOrder:1,status:'WAITING'}]}],emailDeliveries:[{id:'fixture-mail',processId:'fixture-process',recipient:'student@example.invalid',idempotencyKey:'mail-fixture',templateId:'fixture',status:'FAILED',attempts:[],createdAt:timestamp,updatedAt:timestamp}],workflowRuns:[{id:'fixture-workflow',processId:'fixture-process',eventCode:'TCC_CREATED',status:'COMPLETED',startedAt:timestamp,completedAt:timestamp}],auditLogs:historical};
    const project=(payload:unknown)=>db.query('select public.portal_project_runtime_state($1::jsonb)',[JSON.stringify(payload)]);
    await project(initial);
    await db.exec(`create table audit_insert_attempts(n integer);insert into audit_insert_attempts values(0);
      create function count_audit_attempt() returns trigger language plpgsql as $$begin update audit_insert_attempts set n=n+1;return new;end$$;
      create trigger audit_attempt before insert on portal_audit_events for each row execute function count_audit_attempt();`);
    const metadata=async()=> (await db.query(`select p.oid::text,p.proowner::text,p.prosecdef,p.proconfig,p.proacl::text from pg_proc p where oid='public.portal_project_runtime_state(jsonb)'::regprocedure`)).rows;
    const definition=async()=>(await db.query<{definition:string}>("select pg_get_functiondef('public.portal_project_runtime_state(jsonb)'::regprocedure) as definition")).rows[0].definition;
    const tables=['portal_users','portal_access_entries','portal_access_sources','portal_processes','portal_process_authors','portal_process_memberships','portal_files','portal_signature_jobs','portal_signature_signers','portal_email_deliveries','portal_workflow_runs','portal_audit_events'];
    const snapshot=async()=>{
      const result:Record<string,unknown>={};
      // UUIDs generated for replaced membership rows are not business fields.
      for(const table of tables)result[table]=(await db.query(`select coalesce(jsonb_agg(row_value order by row_value::text),'[]'::jsonb) as rows from (select to_jsonb(t)-'id' as row_value from public.${table} t) data`)).rows[0];
      return result;
    };
    const metadataBefore=await metadata(),definitionBefore=await definition();
    const rlsBefore=(await db.query("select relname,relrowsecurity,relforcerowsecurity from pg_class where relnamespace='public'::regnamespace and relkind='r' order by relname")).rows;
    const event={id:'new-a',processId:'fixture-process',actorEmail:'actor@example.invalid',action:'NEW',entityType:'process',entityId:'fixture-process',timestamp,before:null,after:{first:true}};
    const next={...initial,processes:initial.processes.map(p=>({...p,titulo:'Fixture after'})),authorizedStudents:initial.authorizedStudents.map(p=>({...p,active:true})),auditLogs:[{...historical[0],action:'MUST_NOT_REPLACE',after:{changed:true}},...historical.slice(1),event,{...event,after:{duplicateMustNotReplace:true}},{...event,id:'new-b',processId:'missing-process'}]};
    const assertMalformedNewRollback=async()=>{
      const before=await snapshot();await db.exec('savepoint malformed_new;');
      await assert.rejects(project({...next,processes:next.processes.map(p=>({...p,titulo:'MUST_ROLL_BACK'})),auditLogs:[...next.auditLogs,{...event,id:'malformed-new',timestamp:'not-a-timestamp'}]}),/invalid input syntax.*timestamp/);
      await db.exec('rollback to malformed_new;');assert.deepEqual(await snapshot(),before);
    };
    await db.exec('begin;savepoint baseline;');
    await project(next);const baseline=await snapshot();
    assert.equal((await db.query<{n:number}>('select n from audit_insert_attempts')).rows[0].n,279);
    await assertMalformedNewRollback();
    await db.exec('rollback to baseline;');
    const candidate=insideTransaction(await readFile(candidatePath,'utf8'));
    const rowsBeforeMigration=await snapshot();
    await db.exec(candidate);await db.exec(candidate);
    assert.deepEqual(await snapshot(),rowsBeforeMigration,'Installing the selector changes function code only, never stored evidence or other rows.');
    assert.deepEqual(await metadata(),metadataBefore);
    const optimizedDefinition=await definition();
    assert.ok(optimizedDefinition.includes('where existing.external_id=incoming.value->>\'id\''));
    // Everything outside the one loop selector remains physically identical.
    const prefix=definitionBefore.slice(0,definitionBefore.indexOf('  for audit_row in'));
    const suffix=definitionBefore.slice(definitionBefore.indexOf('    select id into selected_process_id from public.portal_processes where external_id=audit_row'));
    assert.ok(optimizedDefinition.startsWith(prefix));assert.ok(optimizedDefinition.endsWith(suffix));
    await project(next);assert.deepEqual(await snapshot(),baseline);
    assert.equal((await db.query<{n:number}>('select n from audit_insert_attempts')).rows[0].n,3,'Historical IDs must never enter INSERT, while in-batch duplicates retain ON CONFLICT safety.');
    await assertMalformedNewRollback();
    const immutableRows=await snapshot();
    await project({...next,auditLogs:[{...historical[0],timestamp:'ignored-malformed-historical-copy',action:'MUST_NOT_REPLACE'}]});
    assert.deepEqual(await snapshot(),immutableRows,'Already stored IDs ignore incoming contents; historical evidence is never rewritten.');
    const audit=(await db.query<{event_type:string;details:any}>("select event_type,details from portal_audit_events where external_id='new-a'")).rows[0];
    assert.equal(audit.event_type,'NEW');assert.equal(audit.details.after.first,true);
    assert.equal((await db.query<{event_type:string}>("select event_type from portal_audit_events where external_id='history-0'")).rows[0].event_type,'HISTORY');
    assert.deepEqual((await db.query("select relname,relrowsecurity,relforcerowsecurity from pg_class where relnamespace='public'::regnamespace and relkind='r' order by relname")).rows,rlsBefore);
    for(const role of ['anon','authenticated']){
      await db.exec(`set local role ${role};savepoint denied;`);
      await assert.rejects(project(next),/permission denied/);await db.exec('rollback to denied;reset role;');
    }
    const rowsBeforeRollback=await snapshot();
    await db.exec(insideTransaction(await readFile(rollbackPath,'utf8')));
    assert.equal(await definition(),definitionBefore);assert.deepEqual(await metadata(),metadataBefore);assert.deepEqual(await snapshot(),rowsBeforeRollback);
    // Estimate local SQL work only, with the diagnostic trigger removed.
    await db.exec('drop trigger audit_attempt on portal_audit_events;');
    const samples=async()=>{await project(next);const values:number[]=[];for(let i=0;i<3;i++){const start=performance.now();await project(next);values.push(performance.now()-start);}return values.sort((a,b)=>a-b)[1];};
    const beforeMs=await samples();await db.exec(candidate);const afterMs=await samples();
    t.diagnostic(`PGlite local, 278 existing audit events / ${(JSON.stringify(next.auditLogs).length/1024/1024).toFixed(2)} MiB: baseline median ${beforeMs.toFixed(1)} ms; optimized median ${afterMs.toFixed(1)} ms. Not a production latency estimate.`);
    await db.exec('rollback;');
  }finally{await db.close();}
});

test('candidate refuses an unexpected installed projector rather than replacing unrelated security or logic',async()=>{
  const db=new PGlite();
  try{
    await db.exec("create function public.portal_project_runtime_state(next_payload jsonb) returns void language plpgsql security invoker set search_path=pg_catalog,pg_temp as $$begin return;end$$;");
    const before=(await db.query("select pg_get_functiondef('portal_project_runtime_state(jsonb)'::regprocedure) as definition")).rows;
    await assert.rejects(db.exec(await readFile(candidatePath,'utf8')),/difere do contrato/);await db.exec('rollback');
    assert.deepEqual((await db.query("select pg_get_functiondef('portal_project_runtime_state(jsonb)'::regprocedure) as definition")).rows,before);
  }finally{await db.close();}
});
