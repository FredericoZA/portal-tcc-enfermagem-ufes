import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';

test('coadvisor signer migration preserves preflight checks, restrictions and historical signers',async()=>{
  const db=new PGlite();
  try{
    await db.exec(`create role anon;create role authenticated;create role service_role;
      create table portal_signature_signers(signer_role text not null constraint portal_signature_signers_signer_role_check check(signer_role in ('STUDENT','ADVISOR','EXAMINER','COMMISSION_PRESIDENT')));
      alter table portal_signature_signers enable row level security;
      insert into portal_signature_signers values('ADVISOR'),('EXAMINER'),('EXAMINER');
      create function public.portal_check_runtime_v1() returns jsonb language sql stable security invoker as $$select '{"signature_examiner_role_ready":true,"unrelated_capability":"preserve"}'::jsonb$$;
      revoke all on function public.portal_check_runtime_v1() from public,anon,authenticated;grant execute on function public.portal_check_runtime_v1() to service_role;`);
    await assert.rejects(db.exec("insert into portal_signature_signers values('CO_ADVISOR')"),/signer_role_check/);
    const migration=await readFile('supabase/migrations/20261107195901_signature_coadvisor_role.sql','utf8');
    await db.exec(migration);
    await db.exec("insert into portal_signature_signers values('STUDENT'),('STUDENT'),('CO_ADVISOR')");
    await assert.rejects(db.exec("insert into portal_signature_signers values('UNAUTHORIZED')"),/signer_role_check/);
    assert.equal((await db.query<{count:number}>('select count(*)::int as count from portal_signature_signers')).rows[0].count,6);
    assert.equal((await db.query<{relrowsecurity:boolean}>("select relrowsecurity from pg_class where oid='portal_signature_signers'::regclass")).rows[0].relrowsecurity,true);
    await db.exec('set role service_role');
    assert.deepEqual((await db.query<{result:unknown}>('select portal_check_runtime_v1() as result')).rows[0].result,{signature_examiner_role_ready:true,signature_coadvisor_role_ready:true,unrelated_capability:'preserve'});
    await db.exec('reset role');
    for(const role of ['anon','authenticated']){
      await db.exec(`set role ${role}`);await assert.rejects(db.query('select portal_check_runtime_v1()'),/permission denied/);await assert.rejects(db.query('select portal_check_runtime_before_coadvisor_v1()'),/permission denied/);await db.exec('reset role');
    }
    const rollback=await readFile('supabase/rollback/20261107195901_signature_coadvisor_role.sql','utf8');
    await assert.rejects(db.exec(rollback),/Existem signatários CO_ADVISOR/);await db.exec('rollback');
    await db.exec("delete from portal_signature_signers where signer_role='CO_ADVISOR'");await db.exec(rollback);
    await assert.rejects(db.exec("insert into portal_signature_signers values('CO_ADVISOR')"),/signer_role_check/);
    assert.deepEqual((await db.query<{result:unknown}>('select portal_check_runtime_v1() as result')).rows[0].result,{signature_examiner_role_ready:true,unrelated_capability:'preserve'});
  }finally{await db.close();}
});
