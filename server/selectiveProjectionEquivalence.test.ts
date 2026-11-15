import test from 'node:test';import assert from 'node:assert/strict';import {readFile,readdir} from 'node:fs/promises';import {PGlite} from '@electric-sql/pglite';import {pgcrypto} from '@electric-sql/pglite/contrib/pgcrypto';
const inner=(s:string)=>s.replace(/\bbegin;/i,'').replace(/\bcommit;\s*$/i,'');
test('selective normalized writes equal full projection and skip the untouched TCC',async()=>{
 const db=new PGlite({extensions:{pgcrypto}});try{
 await db.exec('create role anon;create role authenticated;create role service_role;create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create schema auth;create function auth.uid() returns uuid language sql as $$select null::uuid$$;');
 for(const file of (await readdir('supabase/migrations')).filter(n=>n<='202609190002_portal_publication_integrity_file_alias_fix_v13.sql').sort())await db.exec(await readFile('supabase/migrations/'+file,'utf8'));
 const rollback=await readFile('supabase/rollbacks/20261115162608_selective_runtime_projection.sql','utf8');await db.exec(inner(rollback.slice(0,rollback.indexOf('drop function public.portal_projection_rows_v1'))));
 const person=(email:string)=>({nome:'Person',email});const stamp='2026-11-15T12:00:00Z';
 const a={id:'a',protocolo:'TCC-A',titulo:'Fixture A',createdAt:stamp,updatedAt:stamp,aluno1:person('a@example.invalid'),orientador:person('advisor@example.invalid'),banca:[]};
 const b={...a,id:'b',protocolo:'TCC-B',titulo:'Fixture B',aluno1:person('b@example.invalid')};
 const initial={settings:{masterEmail:'master@example.invalid'},processes:[a,b],authorizedStudents:[],signatureJobs:[],emailDeliveries:[],workflowRuns:[],auditLogs:[],administrationTransfers:[]};
 const project=(p:any)=>db.query('select portal_project_runtime_state($1),portal_project_runtime_state_v4($1),portal_project_publications_v8($1)',[JSON.stringify(p)]);
 await project(initial);await db.query("insert into portal_runtime_state(id,revision,payload) values('global',1,$1) on conflict(id) do update set payload=excluded.payload",[JSON.stringify(initial)]);
 await db.exec('create table write_counts(external_id text);create function count_process_write() returns trigger language plpgsql as $$begin insert into write_counts values(new.external_id);return new;end$$;create trigger process_write after update on portal_processes for each row execute function count_process_write();');
 const snapshot=async()=>{const result:any={};for(const table of ['portal_users','portal_processes','portal_process_authors','portal_process_memberships','portal_files','portal_publications'])result[table]=(await db.query(`select coalesce(jsonb_agg(v order by v::text),'[]'::jsonb) v from(select to_jsonb(t)-'id'${['portal_users','portal_process_authors','portal_process_memberships'].includes(table)?"-'created_at'-'updated_at'":''} v from ${table} t)s`)).rows[0];return result;};
 await db.exec('begin;savepoint baseline;');const next={...initial,processes:[{...a,titulo:'Changed'},b]};await project(next);const expected=await snapshot();await db.exec('rollback to baseline;');
 await db.exec(inner(await readFile('supabase/migrations/20261115162608_selective_runtime_projection.sql','utf8')));await project(next);assert.deepEqual(await snapshot(),expected);
 assert.equal((await db.query<any>("select count(*)::int n from write_counts where external_id='b'")).rows[0].n,0);
 assert.ok((await db.query<any>("select count(*)::int n from write_counts where external_id='a'")).rows[0].n>0);
 await db.exec('rollback;');
 }finally{await db.close();}
});
