import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
const migration='supabase/migrations/20261115162608_selective_runtime_projection.sql';
test('selective projection skips unchanged entities and retains conservative identity and signature dependencies',async()=>{
 const db=new PGlite();
 try{
  await db.exec('create role anon;create role authenticated;create role service_role;create table portal_runtime_state(id text primary key,payload jsonb);');
  const rollback=await readFile('supabase/rollbacks/20261115162608_selective_runtime_projection.sql','utf8');
  await db.exec(rollback.slice(0,rollback.indexOf('drop function public.portal_projection_rows_v1')));
  const person=(name:string)=>({nome:name,email:name+'@example.invalid'});
  const a={id:'a',titulo:'A',aluno1:person('a'),orientador:person('advisor'),banca:[]};
  const b={...a,id:'b',titulo:'B',aluno1:person('b')};
  const initial={settings:{masterEmail:'master@example.invalid'},processes:[a,b],authorizedStudents:[person('a')],signatureJobs:[],emailDeliveries:[],workflowRuns:[],administrationTransfers:[]};
  await db.query("insert into portal_runtime_state values('global',$1)",[JSON.stringify(initial)]);
  const before=(await db.query("select oid,proacl::text,prosecdef,proconfig from pg_proc where proname='portal_project_runtime_state'")).rows;
  await db.exec(await readFile(migration,'utf8'));
  assert.deepEqual((await db.query("select oid,proacl::text,prosecdef,proconfig from pg_proc where proname='portal_project_runtime_state'")).rows,before);
  const rows=async(value:unknown,section='processes')=>(await db.query<{value:any}>('select public.portal_projection_rows_v1($1,$2) as value',[JSON.stringify(value),section])).rows.map(r=>r.value);
  assert.deepEqual(await rows(initial),[]);
  assert.deepEqual(await rows({...initial,auditLogs:[{id:'new'}]}),[]);
  assert.deepEqual(await rows({...initial,processes:[{...a,titulo:'Changed'},b]}),[{...a,titulo:'Changed'}]);
  const renamed={...a,orientador:person('other')};
  assert.deepEqual(await rows({...initial,processes:[renamed,b]}),[renamed,b]);
  assert.deepEqual(await rows({...initial,signatureJobs:[{id:'job',status:'ARCHIVED'}]}),[a,b]);
  assert.deepEqual(await rows(initial,'authorizedStudents'),[]);
  assert.deepEqual(await rows({...initial,authorizedStudents:[{...person('a'),active:false}]},'authorizedStudents'),[{...person('a'),active:false}]);
  await db.exec("set portal.force_full_projection='on';");assert.deepEqual(await rows(initial),[a,b]);
  assert.equal((await db.query<{ok:boolean}>("select has_function_privilege('anon','portal_projection_rows_v1(jsonb,text)','execute') as ok")).rows[0].ok,false);
 }finally{await db.close();}
});
