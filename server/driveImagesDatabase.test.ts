import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

test('migração aditiva mantém rollback legado, aceita referências e recusa linhas incompletas',async()=>{
  const db=new PGlite();
  try{
    await db.exec('create role anon;create role authenticated;create role service_role;');
    for(const file of ['supabase/migrations/20260918170000_portal_runtime_assets_v10.sql','supabase/migrations/20261103101600_portal_feedback_public_form.sql'])await db.exec(await readFile(file,'utf8'));
    const key='a'.repeat(64),hash='b'.repeat(64),data='data:image/png;base64,iVBORw0KGgo=';
    await db.query('insert into portal_runtime_assets(asset_key,mime_type,data_url,byte_length)values($1,$2,$3,$4)',[key,'image/png',data,8]);
    const migration=await readFile('supabase/migrations/20261103193915_drive_backed_permanent_images.sql','utf8');
    await db.exec(migration);await db.exec(migration);
    await db.query('update portal_runtime_assets set drive_file_id=$1,content_sha256=$2 where asset_key=$3',['private_image_123',hash,key]);
    assert.equal((await db.query<{data_url:string}>('select data_url from portal_runtime_assets where asset_key=$1',[key])).rows[0].data_url,data);
    await db.query('insert into portal_runtime_assets(asset_key,mime_type,byte_length,drive_file_id,content_sha256)values($1,$2,$3,$4,$5)',['c'.repeat(64),'image/png',8,'private_image_456',hash]);
    await assert.rejects(db.query('insert into portal_runtime_assets(asset_key,mime_type,byte_length,drive_file_id)values($1,$2,$3,$4)',['d'.repeat(64),'image/png',8,'private_image_789']));
    await db.query('insert into portal_feedback(description,ip_fingerprint,image_mime,image_size,image_drive_file_id,image_sha256)values($1,$2,$3,$4,$5,$6)',['Captura de tela sem bytes armazenados no banco.',hash,'image/png',8,'private_feedback_123',hash]);
    assert.equal((await db.query<{image_base64:string|null}>('select image_base64 from portal_feedback')).rows[0].image_base64,null);
    await assert.rejects(db.query('insert into portal_feedback(description,ip_fingerprint,image_mime,image_size,image_drive_file_id)values($1,$2,$3,$4,$5)',['Referência incompleta deve ser recusada.',hash,'image/png',8,'private_feedback_123']));
    const grants=await db.query<{allowed:boolean}>("select has_table_privilege('anon','public.portal_feedback','select') or has_table_privilege('authenticated','public.portal_runtime_assets','select') as allowed");
    assert.equal(grants.rows[0].allowed,false);
  }finally{await db.close();}
});
