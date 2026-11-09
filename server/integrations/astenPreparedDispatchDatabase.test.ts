import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {pgcrypto} from '@electric-sql/pglite/contrib/pgcrypto';

async function fixture(){
 const db=new PGlite({extensions:{pgcrypto}});
 await db.exec('create role anon;create role authenticated;create role service_role bypassrls;create extension pgcrypto;');
 await db.exec(await readFile('supabase/migrations/202609060001_asten_transactional_outbox_v6.sql','utf8'));
 const legacy=(await db.query<{definition:string}>("select pg_get_functiondef('portal_claim_asten_dispatch(text,text,text,text,integer)'::regprocedure) definition")).rows[0].definition;
 await db.exec(await readFile('supabase/migrations/20261107223734_asten_prepared_dispatch.sql','utf8'));
 assert.equal((await db.query<{definition:string}>("select pg_get_functiondef('portal_claim_asten_dispatch(text,text,text,text,integer)'::regprocedure) definition")).rows[0].definition,legacy);
 return db;
}
const key='a'.repeat(64),hash='b'.repeat(64),tokenA='owner-a-'.repeat(5),tokenB='owner-b-'.repeat(5);
async function prepare(db:PGlite,token=tokenA){return (await db.query<{result:{outcome:string}}>('select portal_prepare_asten_dispatch($1,$2,$3,$4,120) result',[key,'job-fixture',hash,token])).rows[0].result;}
async function start(db:PGlite,token=tokenA){return (await db.query<{result:{outcome:string}}>('select portal_start_prepared_asten_dispatch($1,$2,$3,$4) result',[key,'job-fixture',hash,token])).rows[0].result;}
test('PREPARED has one owner; expiry rotates ownership and fences out the old worker before provider start',async()=>{
 const db=await fixture();try{
  const competing=await Promise.all([prepare(db,tokenA),prepare(db,tokenB)]);
  assert.equal(competing.filter(row=>row.outcome==='PREPARED').length,1);assert.equal(competing.filter(row=>row.outcome==='BUSY').length,1);
  const winner=competing[0].outcome==='PREPARED'?tokenA:tokenB,other=winner===tokenA?tokenB:tokenA;
  await assert.rejects(start(db,other),/divergente/);
  await db.exec("update portal_asten_dispatch_claims set lease_until=now()-interval '1 second'");
  await assert.rejects(start(db,winner),/não está ativa/);
  assert.equal((await prepare(db,other)).outcome,'PREPARED');
  await assert.rejects(start(db,winner),/divergente/);
  assert.equal((await start(db,other)).outcome,'STARTED');
  await assert.rejects(start(db,other),/não está ativa/,'even the winner cannot start twice');
  await db.exec("update portal_asten_dispatch_claims set lease_until=now()-interval '1 second'");
  assert.equal((await prepare(db,winner)).outcome,'UNCERTAIN','a provider-started claim never becomes retryable');
 }finally{await db.close();}
});
test('legacy claims stay conservative; existing envelope identities and private ACLs remain intact',async()=>{
 const db=await fixture();try{
  await db.query('select portal_claim_asten_dispatch($1,$2,$3,$4,120)',[key,'job-fixture',hash,tokenA]);
  await db.exec("update portal_asten_dispatch_claims set lease_until=now()-interval '1 second'");
  assert.equal((await prepare(db,tokenB)).outcome,'UNCERTAIN');
  await assert.rejects(start(db,tokenA),/não está ativa/);
  await db.query('select portal_update_asten_dispatch($1,$2,$3,$4,$5,$6)',[key,'ENVELOPE_CREATED',tokenA,'12345','envelope-hash',null]);
  const recovered=await prepare(db,tokenB);assert.deepEqual(recovered,{outcome:'ALREADY_CREATED',providerEnvelopeId:'12345',providerEnvelopeHash:'envelope-hash'});
  await db.query('select portal_update_asten_dispatch($1,$2,$3,$4,$5,$6)',[key,'DISPATCHED',null,'12345','envelope-hash',null]);
  assert.equal((await prepare(db)).outcome,'DISPATCHED');
  const acl=(await db.query<{allowed:boolean;role:string;routine:string}>("select r as role,f as routine,has_function_privilege(r,f,'EXECUTE') allowed from unnest(array['anon','authenticated','service_role']) r cross join unnest(array['portal_prepare_asten_dispatch(text,text,text,text,integer)','portal_start_prepared_asten_dispatch(text,text,text,text)']) f")).rows;
  for(const row of acl)assert.equal(row.allowed,row.role==='service_role');
  const functions=(await db.query<{prosecdef:boolean;proconfig:string[]}>("select prosecdef,proconfig from pg_proc where oid in ('portal_prepare_asten_dispatch(text,text,text,text,integer)'::regprocedure,'portal_start_prepared_asten_dispatch(text,text,text,text)'::regprocedure)")).rows;
  assert.equal(functions.length,2);for(const row of functions){assert.equal(row.prosecdef,false);assert.ok(row.proconfig.includes('search_path=public, extensions, pg_temp'));}
  const table=(await db.query<{relrowsecurity:boolean;relforcerowsecurity:boolean}>("select relrowsecurity,relforcerowsecurity from pg_class where oid='portal_asten_dispatch_claims'::regclass")).rows[0];assert.deepEqual(table,{relrowsecurity:true,relforcerowsecurity:true});
  for(const token of [null,'short'])await assert.rejects(db.query('select portal_start_prepared_asten_dispatch($1,$2,$3,$4)',[key,'job-fixture',hash,token]));
  for(const role of ['anon','authenticated']){
   await db.exec(`set role ${role}`);
   try{await assert.rejects(prepare(db),/permission denied/);await assert.rejects(start(db),/permission denied/);}finally{await db.exec('reset role');}
  }
  await db.exec('set role service_role');
  try{assert.equal((await prepare(db)).outcome,'DISPATCHED','invoker works with the existing service role grants');}finally{await db.exec('reset role');}
 }finally{await db.close();}
});
test('old callers cannot create from a new PREPARED reservation and mismatched identity cannot take it',async()=>{
 const db=await fixture();try{
  assert.equal((await prepare(db)).outcome,'PREPARED');
  await assert.rejects(db.query('select portal_prepare_asten_dispatch($1,$2,$3,$4,120)',[key,'different-job',hash,tokenB]),/Conflito/);
  await assert.rejects(db.query('select portal_start_prepared_asten_dispatch($1,$2,$3,$4)',[key,'job-fixture','c'.repeat(64),tokenA]),/divergente/);
  const old=await db.query<{result:{outcome:string}}>('select portal_claim_asten_dispatch($1,$2,$3,$4,120) result',[key,'job-fixture',hash,tokenB]);assert.equal(old.rows[0].result.outcome,'BUSY');
  await db.exec("update portal_asten_dispatch_claims set lease_until=now()-interval '1 second'");
  const expired=await db.query<{result:{outcome:string}}>('select portal_claim_asten_dispatch($1,$2,$3,$4,120) result',[key,'job-fixture',hash,tokenB]);assert.equal(expired.rows[0].result.outcome,'UNCERTAIN');
  assert.equal((await prepare(db)).outcome,'UNCERTAIN');
 }finally{await db.close();}
});
