import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile,readdir} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {canonicalLegacyRecord} from '../legacyArchive';
import {buildPublicRepository} from '../publicViews';

test('repository projection preserves consent, withdrawal and duplicate identity without transferring raw provenance',async()=>{
 const db=new PGlite();
 try{
  await db.exec('create role anon; create role authenticated; create role service_role; create table public.portal_runtime_state(id text primary key,revision bigint,payload jsonb);');
  const base:any={id:'legado-0001',protocolo:'Legado 001',sourceFingerprint:'a'.repeat(64),titulo:'Historical work',autores:['Author'],orientador:'Advisor',coorientador:'',coorientadorInstituicao:'',examinadores:[],resumo:'Abstract',palavrasChave:['Care'],dataDefesa:'2023-06-01',horaDefesa:'14:00:00',localDefesa:'Room',attachments:[{driveFileId:'original_file_123',fileName:'work.pdf',kind:'TRABALHO_COMPLETO',evidence:'SHA256:'+'b'.repeat(64)}],provenance:{publicationImportBaseline:{publicFiles:[{kind:'TRABALHO_COMPLETO',sha256:'b'.repeat(64)}]},originalConsent:['Sim'],submissionWorkbook:{privateSource:'x'.repeat(50000)},administrativeDocuments:[]}};
  const records=[base,structuredClone(base),{...base,provenance:{...base.provenance,sourceRow:2}},...[
   {originalConsent:['Sim'],publicationImportBaseline:{publicFiles:[]}},{originalConsent:['Não']},{originalConsent:['Sim','Não']},{originalConsent:[]},
   {originalConsent:['Sim'],publicationProcess:{privateContacts:'not public'},publicationOverride:{status:'REVOKING_DRIVE',publishFullWork:false,publishExpandedAbstract:false}},
   {originalConsent:['Sim'],publicationWithdrawal:{withdrawnAt:'2026-11-16T12:00:00Z',drivePending:true}},
  ].map((consent,i)=>({...base,id:`legado-000${i+2}`,provenance:{...base.provenance,...consent}}))];
  const source={processes:[],legacyAcademicRecords:records,settings:{private:'not part of repository'}};
  await db.query('insert into public.portal_runtime_state values($1,42,$2::jsonb)',['global',JSON.stringify(source)]);
  const migration=process.env.PORTAL_REPOSITORY_PROJECTION_SQL || 'supabase/migrations/'+(await readdir('supabase/migrations')).find(f=>f.endsWith('_lean_legacy_repository_projection.sql'));
  await db.exec(await readFile(migration,'utf8'));
  await db.exec(await readFile('docs/sql/repository-publication-override.sql','utf8'));
  const row=(await db.query<{revision:number;payload:any}>('select * from public.portal_read_repository_v1()')).rows[0];
  assert.equal(row.revision,42);
  assert.equal(row.payload.legacyAcademicRecords.length,records.length);
  const publicView=(items:any[])=>buildPublicRepository([],items.map(canonicalLegacyRecord));
  assert.deepEqual(publicView(row.payload.legacyAcademicRecords),publicView(records));
  assert.equal(publicView(row.payload.legacyAcademicRecords).length,records.length-1,'only exact duplicate provenance may collapse');
  assert.ok(JSON.stringify(row.payload).length<JSON.stringify(source).length/5);
  for(const record of row.payload.legacyAcademicRecords){
   assert.equal(record.provenance.submissionWorkbook,undefined);
   assert.equal(record.provenance.administrativeDocuments,undefined);
   assert.match(record.provenance.repositorySourceDigest,/^[a-f0-9]{64}$/);
  }
  assert.deepEqual((await db.query<{payload:any}>('select payload from public.portal_runtime_state')).rows[0].payload,source);
  for(const role of ['anon','authenticated']) assert.equal((await db.query<{allowed:boolean}>('select has_function_privilege($1,$2,$3) as allowed',[role,'public.portal_read_repository_v1()','EXECUTE'])).rows[0].allowed,false);
  assert.equal((await db.query<{allowed:boolean}>("select has_function_privilege('service_role','public.portal_read_repository_v1()','EXECUTE') as allowed")).rows[0].allowed,true);
 }finally{await db.close();}
});
