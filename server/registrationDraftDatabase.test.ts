import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {pgcrypto} from '@electric-sql/pglite/contrib/pgcrypto';

test('draft CAS preserves unrelated JSON, conflicts across workers/tabs and restricts its RPC',async()=>{
  const db=new PGlite({extensions:{pgcrypto}});
  try{
    await db.exec(`create extension pgcrypto; create role anon; create role authenticated; create role service_role;
      create table portal_runtime_state(id text primary key,payload jsonb,revision bigint,updated_at timestamptz);
      create table portal_runtime_commits(revision bigint primary key,payload_sha256 text);`);
    await db.exec(await readFile('supabase/migrations/20261107191835_registration_draft_scoped_commit.sql','utf8'));
    const draft=(owner:string,revision:number,schemaRevision=9)=>({ownerEmail:owner,answers:{ALUNO_1_EMAIL:owner,ALUNO_1_NOME:'Nome de Teste'},section:2,revision,schemaRevision,updatedAt:'2026-11-07T12:00:00Z',expiresAt:'2099-11-07T12:00:00Z'});
    const first='first@example.invalid',second='second@example.invalid';
    const initial={settings:{integrationStudio:{revision:9}},registrationDrafts:{[first]:draft(first,1)},processes:[{id:'p',sentinel:'unmodified'}],signatureJobs:[{status:'SENT'}],auditLogs:[{id:'preserve'}],unknown:{nested:['retain',null,42]}};
    await db.query("insert into portal_runtime_state values('global',$1::jsonb,5,now())",[JSON.stringify(initial)]);
    const commit=(globalRevision:number,owner:string,previous:number,value:unknown)=>db.query<{revision:number}>('select portal_commit_registration_draft($1,$2,$3,$4::jsonb)::int as revision',[globalRevision,owner,previous,JSON.stringify(value)]);
    assert.deepEqual((await commit(5,first,1,draft(first,2))).rows,[{revision:6}]);
    await assert.rejects(commit(5,second,0,draft(second,1)),/concorrência/);
    assert.deepEqual((await commit(6,second,0,draft(second,1))).rows,[{revision:7}]);
    await assert.rejects(commit(7,first,1,draft(first,2)),/concorrência/);
    await assert.rejects(commit(7,first,2,draft(first,3,8)),/formulário mudou/);
    await assert.rejects(commit(7,first,2,draft(second,3)),/inválido/);
    const saved=(await db.query<{payload:typeof initial;revision:number}>("select payload,revision::int from portal_runtime_state where id='global'")).rows[0];
    assert.equal(saved.revision,7);
    assert.deepEqual(saved.payload,{...initial,registrationDrafts:{[first]:draft(first,2),[second]:draft(second,1)}});
    assert.equal((await db.query<{count:number}>('select count(*)::int as count from portal_runtime_commits')).rows[0].count,2);
    assert.equal((await db.query<{ok:boolean}>("select payload_sha256=encode(digest(payload::text,'sha256'),'hex') as ok from portal_runtime_commits c cross join portal_runtime_state s where c.revision=s.revision")).rows[0].ok,true);
    // No projection functions exist in this database: even calling one would fail.
    for(const role of ['anon','authenticated']){
      await db.exec(`set role ${role}`);
      await assert.rejects(commit(7,first,2,draft(first,3)),/permission denied for function/);
      await db.exec('reset role');
    }
    const permissions=(await db.query<{prosecdef:boolean}>('select prosecdef from pg_proc where proname=$1',['portal_commit_registration_draft'])).rows[0];
    assert.equal(permissions.prosecdef,false);
  }finally{await db.close();}
});
