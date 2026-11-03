import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';

test('comprovante de reserva usa staging privado sem mudar permissões, limites ou tickets existentes',async()=>{
  const db=new PGlite();
  try{
    await db.exec(`create role anon;create role authenticated;create role service_role;
      create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);`);
    for(const file of ['supabase/migrations/202609040001_portal_secure_file_transport_v5.sql','supabase/migrations/20261024120000_govbr_signed_pdf_staging.sql'])await db.exec(await readFile(file,'utf8'));
    const before=await db.query(`select relrowsecurity,relforcerowsecurity,relacl::text from pg_class where oid='public.portal_upload_staging'::regclass`);
    const constraints=await db.query(`select conname,pg_get_constraintdef(oid) definition from pg_constraint where conrelid='public.portal_upload_staging'::regclass and conname<>'portal_upload_staging_purpose_check' order by conname`);
    const insert=(purpose:string,mime='application/pdf',size=12)=>db.query(`insert into public.portal_upload_staging(id,purpose,requester_hash,object_path,original_file_name,mime_type,expected_size,expected_sha256,status,expires_at) values($1,$2,$3,$4,$5,$6,$7,$8,'PENDING',now()+interval '10 minutes')`,[randomUUID(),purpose,'a'.repeat(64),'pending/'+randomUUID(),'comprovante.pdf',mime,size,'b'.repeat(64)]);
    await insert('GOV_BR_SIGNED_PDF');
    await assert.rejects(insert('LOCATION_PROOF'),/portal_upload_staging_purpose_check/);
    const migration=await readFile('supabase/migrations/20261103210924_location_proof_staging.sql','utf8');
    await db.exec(migration);
    for(const purpose of ['DOCUMENT_MODEL','PROCESS_FULL_WORK','PROCESS_EXPANDED_ABSTRACT','VERIFICATION_PDF','GOV_BR_SIGNED_PDF','LOCATION_PROOF'])await insert(purpose);
    await assert.rejects(insert('UNKNOWN'),/portal_upload_staging_purpose_check/);
    await assert.rejects(insert('LOCATION_PROOF','image/png'),/portal_upload_staging_mime_type_check/);
    await assert.rejects(insert('LOCATION_PROOF','application/pdf',52_428_801),/portal_upload_staging_expected_size_check/);
    assert.deepEqual((await db.query(`select relrowsecurity,relforcerowsecurity,relacl::text from pg_class where oid='public.portal_upload_staging'::regclass`)).rows,before.rows);
    assert.deepEqual((await db.query(`select conname,pg_get_constraintdef(oid) definition from pg_constraint where conrelid='public.portal_upload_staging'::regclass and conname<>'portal_upload_staging_purpose_check' order by conname`)).rows,constraints.rows);
    assert.equal((await db.query<{count:number}>('select count(*)::int count from public.portal_upload_staging')).rows[0].count,7);
    assert.deepEqual((await db.query<{anon:boolean;authenticated:boolean}>(`select has_table_privilege('anon','public.portal_upload_staging','select') anon,has_table_privilege('authenticated','public.portal_upload_staging','select') authenticated`)).rows,[{anon:false,authenticated:false}]);
  }finally{await db.close();}
});
