import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile,readdir} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {canonicalLegacyRecord,legacyFileIsPublic} from '../legacyArchive';

test('lean repository retains exact body-link proof without exposing raw source rows or broadening RPC grants',async()=>{
 const db=new PGlite();
 try{
  await db.exec('create role anon; create role authenticated; create role service_role; create table public.portal_runtime_state(id text primary key,revision bigint,payload jsonb);');
  const url='https://enfermagem.vitoria.ufes.br/sites/enfermagem.vitoria.ufes.br/files/field/anexo/work.pdf#overlay-context=pt-br/trabalhos-de-conclusao-de-curso-defendidos';
  const sourcePageId=(id:string)=>`legado-${String(Number(id.slice(-4))+1).padStart(4,'0')}`;
  const make=(id:string):any=>({id,protocolo:`${id.slice(-3)} - Legado`,sourceFingerprint:'a'.repeat(64),titulo:'Historical work',autores:['Author'],orientador:'Advisor',coorientador:'',coorientadorInstituicao:'',examinadores:[],resumo:'Abstract',palavrasChave:['Care'],dataDefesa:'2024-06-01',horaDefesa:'14:00:00',localDefesa:'Room',attachments:[{driveFileId:`original_${id}`,fileName:'work.pdf',sourceFileName:'original-submission.pdf',kind:'TRABALHO_COMPLETO',sha256:'b'.repeat(64),evidence:'SHA256:'+'b'.repeat(64)}],provenance:{
   originalConsent:['Sim'],publicationOverride:null,publicationWithdrawal:null,
   publicationImportBaseline:{policy:'BODY_ROW_LINK_AND_VERIFIED_KIND_HASH_REQUIRED',cutoffDate:'2025-08-28',publicFiles:[{kind:'TRABALHO_COMPLETO',sha256:'b'.repeat(64),sourceRecordId:id,sourcePageRecordId:sourcePageId(id),sourceUrl:url,sourceFileName:'work.pdf',sourceRowFingerprint:'c'.repeat(64)}]},
   pageRecords:[{legacyId:sourcePageId(id),sourceFingerprint:'c'.repeat(64),sourceLinks:[url],authorsOriginal:'Private source author',titleOriginal:'Private raw text',metadata:{private:'x'.repeat(10000)}}],
   submissionWorkbook:{private:'y'.repeat(50000)},administrativeDocuments:[{kind:'AVALIACAO',privateGrade:10}],privateContacts:['private@example.invalid']
  }});
  const allowed=make('legado-0001'),denied=make('legado-0002'),withdrawn=make('legado-0003'),missing=make('legado-0004'),malformed=make('legado-0005');
  denied.provenance.originalConsent=['Sim','Não'];
  withdrawn.provenance.publicationWithdrawal={withdrawnAt:'2026-11-16T12:00:00Z',drivePending:true};
  delete missing.provenance.pageRecords;
  malformed.provenance.pageRecords={private:'invalid source structure'};
  const records=[allowed,denied,withdrawn,missing,malformed];
  const source={processes:[{id:'process',titulo:'Current work',registrationAnswers:{private:'not projected'}}],legacyAcademicRecords:records,settings:{private:'not projected'},auditLogs:[{private:'not projected'}]};
  await db.query('insert into public.portal_runtime_state values($1,61,$2::jsonb)',['global',JSON.stringify(source)]);
  await db.exec(await readFile('supabase/migrations/20261116185426_legacy_publication_scope_and_renewal_projection.sql','utf8'));
  const before=(await db.query<any>('select * from public.portal_read_repository_v1()')).rows[0];
  const publicIds=(items:any[])=>items.map(canonicalLegacyRecord).filter(record=>record.attachments.some(file=>legacyFileIsPublic(record,file))).map(record=>record.id);
  assert.deepEqual(publicIds(records),['legado-0001']);
  assert.deepEqual(publicIds(before.payload.legacyAcademicRecords),[],'the prior lean projection dropped evidence required for body-row approval');
  const filename=(await readdir('supabase/migrations')).find(file=>file.endsWith('_repository_body_row_link_projection.sql'));
  assert.ok(filename,'the additive migration must be present');
  await db.exec(await readFile(`supabase/migrations/${filename}`,'utf8'));
  const row=(await db.query<any>('select * from public.portal_read_repository_v1()')).rows[0];
  assert.equal(row.revision,61);
  assert.deepEqual(publicIds(row.payload.legacyAcademicRecords),publicIds(records));
  assert.deepEqual(row.payload.processes,[{id:'process',titulo:'Current work'}]);
  for(const [index,record] of row.payload.legacyAcademicRecords.entries()){
   assert.deepEqual(Object.keys(record.provenance).sort(),['originalConsent','pageRecords','publicationImportBaseline','publicationOverride','publicationWithdrawal','repositorySourceDigest'].sort());
   assert.deepEqual(record.provenance.pageRecords,index<3?[{legacyId:sourcePageId(records[index].id),sourceFingerprint:'c'.repeat(64),sourceLinks:[url]}]:[]);
   assert.equal(record.provenance.repositorySourceDigest,before.payload.legacyAcademicRecords[index].provenance.repositorySourceDigest);
  }
  assert.ok(JSON.stringify(row.payload).length<JSON.stringify(source).length/10,'source workbooks and row annotations must remain excluded');
  assert.deepEqual((await db.query<any>('select payload from public.portal_runtime_state')).rows[0].payload,source,'a read projection must not rewrite the canonical runtime');
  for(const role of ['anon','authenticated'])assert.equal((await db.query<any>('select has_function_privilege($1,$2,$3) allowed',[role,'public.portal_read_repository_v1()','EXECUTE'])).rows[0].allowed,false);
  assert.equal((await db.query<any>("select has_function_privilege('service_role','public.portal_read_repository_v1()','EXECUTE') allowed")).rows[0].allowed,true);
 }finally{await db.close();}
});
