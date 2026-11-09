import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';

test('constraint instalada rejeita examinadores; migração permite ATA e mantém papéis desconhecidos/permissões bloqueados',async()=>{
 const migration=await readFile('supabase/migrations/20261107123138_signature_examiner_role.sql','utf8');
 const db=new PGlite();
 try{
  await db.exec(`create role anon;create role authenticated;create role service_role;
   create table portal_runtime_state(id text);grant select on portal_runtime_state to service_role;
   create function portal_runtime_capabilities() returns jsonb language sql as $$select '{"schema_version":6}'::jsonb$$;
   create table portal_signature_signers(signer_role text not null constraint portal_signature_signers_signer_role_check check(signer_role in ('STUDENT','ADVISOR','COMMISSION_PRESIDENT')));
   insert into portal_signature_signers values('STUDENT');`);
  await db.exec('begin');await assert.rejects(db.exec("insert into portal_signature_signers values('ADVISOR'),('EXAMINER'),('EXAMINER')"),/portal_signature_signers_signer_role_check/);await db.exec('rollback');
  assert.deepEqual((await db.query('select signer_role from portal_signature_signers')).rows,[{signer_role:'STUDENT'}]);
  await db.exec(migration);
  await db.exec("insert into portal_signature_signers values('ADVISOR'),('EXAMINER'),('EXAMINER'),('COMMISSION_PRESIDENT')");
  assert.equal((await db.query('select * from portal_signature_signers')).rows.length,5);
  await assert.rejects(db.exec("insert into portal_signature_signers values('UNAUTHORIZED')"),/portal_signature_signers_signer_role_check/);
  await db.exec('set role service_role');
  const ready:any=await db.query('select portal_check_runtime_v1() as capabilities');assert.equal(ready.rows[0].capabilities.signature_examiner_role_ready,true);await db.exec('reset role');
  await db.exec('set role anon');await assert.rejects(db.query('select portal_check_runtime_v1()'),/permission denied/);await db.exec('reset role');
  const rollback=await readFile('supabase/rollback/20261107123138_signature_examiner_role.sql','utf8');
  await assert.rejects(db.exec(rollback),/EXAMINER/);await db.exec('rollback');
  await db.exec("delete from portal_signature_signers where signer_role='EXAMINER'");await db.exec(rollback);
  await assert.rejects(db.exec("insert into portal_signature_signers values('EXAMINER')"),/portal_signature_signers_signer_role_check/);
 }finally{await db.close();}
});
