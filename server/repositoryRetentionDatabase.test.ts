import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {PGlite} from '@electric-sql/pglite';
test('repository projection and verified retention retain recent backups, reject stale hashes and forbid public execution',async()=>{
 const db=new PGlite();try{
 await db.exec("create role anon;create role authenticated;create role service_role;create table portal_runtime_state(id text primary key,revision bigint,payload jsonb);create table portal_runtime_state_backups(backup_id bigint generated always as identity primary key,state_id text,revision bigint,payload jsonb,reason text,created_at timestamptz);");
 await db.exec(await readFile('supabase/migrations/20261115163043_repository_projection_and_backup_retention.sql','utf8'));
 await db.query("insert into portal_runtime_state values('global',5,$1)",[JSON.stringify({settings:{secret:'private'},processes:[{id:'a',titulo:'T',registrationAnswers:{secret:'x'},documents:[{pdf:'huge'}]}],legacyAcademicRecords:[],auditLogs:[{private:'x'}]})]);
 const projection=(await db.query<any>('select * from portal_read_repository_v1()')).rows[0];assert.deepEqual(projection,{revision:5,payload:{processes:[{id:'a',titulo:'T'}],legacyAcademicRecords:[]}});
 for(let i=0;i<5;i++)await db.query("insert into portal_runtime_state_backups(state_id,revision,payload,reason,created_at) values('global',$1::bigint,'{\"settings\":{},\"processes\":[]}','test',now()-interval '40 days'+$1::bigint*interval '1 day')",[i]);
 const rows=(await db.query<any>('select * from portal_list_retirable_backups_v1()')).rows;assert.equal(rows.length,2);
 const args=[rows[0].backup_id,rows[0].payload_sha256,'drive-file-123', 'b'.repeat(64),'c'.repeat(64)];
 await assert.rejects(db.query('select portal_finalize_backup_archive_v1($1,$2,$3,$4,$5)',[args[0],'d'.repeat(64),...args.slice(2)]));
 assert.equal((await db.query<any>('select count(*)::int n from portal_runtime_state_backups')).rows[0].n,5);
 await db.query('select portal_finalize_backup_archive_v1($1,$2,$3,$4,$5)',args);
 assert.equal((await db.query<any>('select count(*)::int n from portal_runtime_state_backups')).rows[0].n,4);
 await db.query('select portal_finalize_backup_archive_v1($1,$2,$3,$4,$5)',args);
 assert.equal((await db.query<any>("select has_function_privilege('anon','portal_read_repository_v1()','execute') ok")).rows[0].ok,false);
 }finally{await db.close();}
});
