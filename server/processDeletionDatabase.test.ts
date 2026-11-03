import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {PGlite} from '@electric-sql/pglite';
test('complete cleanup is idempotent, scoped in backups, and rejects live processes',async()=>{
 const db=new PGlite();
 try{
  await db.exec('create role anon;create role authenticated;create role service_role;create schema auth;create function auth.uid() returns uuid language sql as $$select null::uuid$$;');
  await db.exec((await readFile('supabase/migrations/202608290001_portal_normalized_core.sql','utf8')).replace('create extension if not exists pgcrypto;',''));
  await db.exec(`create table portal_runtime_state(id text primary key,payload jsonb);insert into portal_runtime_state values('global','{"processes":[]}');create table portal_runtime_state_backups(backup_id int,payload jsonb);create table portal_asten_dispatch_claims(job_external_id text);create table portal_asten_webhook_inbox(event jsonb);create table portal_download_transfers(id uuid);`);
  const sql=await readFile('supabase/migrations/20261026190000_complete_process_cleanup.sql','utf8');await db.exec(sql);
  await db.exec(await readFile('supabase/migrations/20261102205917_optimize_process_purge.sql','utf8'));
  await db.exec(`insert into portal_users(email,full_name) values ('test@example.invalid','Teste');insert into portal_processes(external_id,code,title,created_by) select 'p','TCC-2026-0001','Teste',id from portal_users;insert into portal_audit_events(external_id,process_id,event_type,entity_type,entity_id) select 'a',id,'TEST','TEST','p' from portal_processes;insert into portal_audit_events(external_id,event_type,entity_type,entity_id,process_code) values('orphan','TEST','TEST','p','TCC-2026-0001');insert into portal_runtime_state_backups values(1,'{"processes":[{"id":"p"},{"id":"other"}],"auditLogs":[{"processId":"p"}]}'),(2,'{"processes":[{"id":"other"}]}');`);
  const unrelated={documentModels:{large:'x'.repeat(2_000_000)},nested:[{id:'p-other',note:'keep p substring'}],literal:null};
  await db.query('insert into portal_runtime_state_backups values(3,$1)',[JSON.stringify(unrelated)]);
  await db.query(`select portal_master_purge_process_history('p','TCC-2026-0001',array[]::text[])`);
  const untouched=await db.query<{payload:any}>('select payload from portal_runtime_state_backups where backup_id=3');
  assert.deepEqual(untouched.rows[0].payload,unrelated);
  assert.equal((await db.query('select id from portal_processes')).rows.length,0);assert.equal((await db.query('select id from portal_audit_events')).rows.length,0);
  const backups=await db.query<{payload:any}>('select payload from portal_runtime_state_backups order by backup_id');assert.deepEqual(backups.rows[0].payload,{processes:[{id:'other'}],auditLogs:[]});assert.deepEqual(backups.rows[1].payload,{processes:[{id:'other'}]});
  await db.query(`select portal_master_purge_process_history('p','TCC-2026-0001',array[]::text[])`);
  await db.exec(`insert into portal_processes(external_id,code,title,created_by) select 'new-owner','TCC-2026-0001','Outro trabalho',id from portal_users;`);
  await assert.rejects(db.query(`select portal_master_purge_process_history('p','TCC-2026-0001',array[]::text[])`),/different process/);
  await db.exec(`update portal_runtime_state set payload='{"processes":[{"id":"live"}]}' where id='global';`);
  await assert.rejects(db.query(`select portal_master_purge_process_history('live','TCC-2026-0999',array[]::text[])`),/still active/);
  const privileges=await db.query<{allowed:boolean}>(`select has_function_privilege('authenticated','public.portal_master_purge_process_history(text,text,text[])','execute') allowed`);assert.equal(privileges.rows[0].allowed,false);
 }finally{await db.close();}
});
