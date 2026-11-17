import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import {canonicalLegacyRecord,legacyHistoricalFileApproved,legacyPublicationScopeAllowed,mergeLegacyBatch,publicLegacyAcademicView,publicLegacyAdministrativeDocuments} from './legacyArchive';
import {installPublicationChoiceRoutes} from './publicationChoiceRoutes';

function fixture():any {
 const file=(kind:string,sha256:string,id:string)=>({kind,sha256,driveFileId:id,fileName:'Original.pdf',evidence:'Verified fixture'});
 return {id:'legado-0999',titulo:'Fixture',autores:['Author'],orientador:'Advisor',coorientador:'',examinadores:[],palavrasChave:[],
 attachments:[file('TRABALHO_COMPLETO','a'.repeat(64),'original_full_fixture'),file('RESUMO_EXPANDIDO','b'.repeat(64),'original_abstract_fixture')],
 provenance:{originalConsent:['Sim'],publicationImportBaseline:{publicFiles:[{kind:'TRABALHO_COMPLETO',sha256:'a'.repeat(64)}]}}};
}
test('positive consent alone never publishes a historical PDF without the previous source boundary',()=>{
 const r=fixture();delete r.provenance.publicationImportBaseline;
 assert.equal(canonicalLegacyRecord(r).isPublic,false);assert.deepEqual(publicLegacyAcademicView(canonicalLegacyRecord(r)).publicFiles,[]);
 r.provenance.publicationOverride={status:'COMPLETED',signedTermJobId:'signed',syncedAt:'2026-11-16',publishFullWork:true,publishExpandedAbstract:true};
 assert.equal(canonicalLegacyRecord(r).isPublic,false);
});
test('a signed renewal cannot expand a historical kind/hash or publish a replacement version',()=>{
 const r=fixture();r.provenance.publicationOverride={status:'COMPLETED',signedTermJobId:'signed',syncedAt:'2026-11-16',publishFullWork:true,publishExpandedAbstract:true};
 const next=canonicalLegacyRecord(r);assert.equal(next.publishFullWork,true);assert.equal(next.publishExpandedAbstract,false);
 assert.equal(legacyHistoricalFileApproved(r,{...r.attachments[0],sha256:'c'.repeat(64)}),false);
});
test('a private classification anywhere takes priority over an otherwise approved original',()=>{
 const r=fixture();r.provenance.publicationImportBaseline.privateFileIds=['original_full_fixture'];
 assert.equal(canonicalLegacyRecord(r).isPublic,false);
});
test('merging an existing historical record cannot expand its approved baseline, including while private',()=>{
 for(const consent of ['Sim','Não']){
  const existing=fixture();existing.provenance.originalConsent=[consent];
  const current:any=canonicalLegacyRecord(existing),incoming=structuredClone(current);
  incoming.provenance.publicationImportBaseline.publicFiles.push({kind:'RESUMO_EXPANDIDO',sha256:'b'.repeat(64)});
  assert.throws(()=>mergeLegacyBatch([current],[canonicalLegacyRecord(incoming)]),/dados diferentes/);
  assert.deepEqual(current.provenance.publicationImportBaseline.publicFiles,[{kind:'TRABALHO_COMPLETO',sha256:'a'.repeat(64)}]);
 }
});
test('a historical PDF needs the exact hyperlink in its own captured row, independently of kind/hash approval',()=>{
 const r=fixture();r.dataDefesa='2025-08-28';r.attachments[0].sourceFileName='original.pdf';
 const proof={kind:'TRABALHO_COMPLETO',sha256:'a'.repeat(64),sourceRecordId:r.id,sourcePageRecordId:'legado-0037',sourceFileName:'original.pdf',sourceUrl:'https://course.example.invalid/files/original.pdf#overlay-context=original-page',sourceRowFingerprint:'d'.repeat(64)};
 r.provenance.publicationImportBaseline={policy:'BODY_ROW_LINK_AND_VERIFIED_KIND_HASH_REQUIRED',cutoffDate:'2025-08-28',publicFiles:[proof]};
 r.provenance.pageRecords=[{legacyId:proof.sourcePageRecordId,sourceFingerprint:'d'.repeat(64),sourceLinks:[proof.sourceUrl]}];
 assert.equal(canonicalLegacyRecord(r).publishFullWork,true);
 for(const mutate of [
  (copy:any)=>{copy.provenance.pageRecords[0].legacyId='legado-0030';},
  (copy:any)=>{copy.provenance.pageRecords[0].sourceLinks=['https://course.example.invalid/files/other.pdf'];},
  (copy:any)=>{copy.provenance.publicationImportBaseline.publicFiles[0].sourceRowFingerprint='e'.repeat(64);},
  (copy:any)=>{copy.provenance.publicationImportBaseline.publicFiles[0].sourceRecordId='legado-0030';},
  (copy:any)=>{copy.provenance.publicationImportBaseline.publicFiles[0].sourcePageRecordId='legado-0030';},
  (copy:any)=>{delete copy.provenance.publicationImportBaseline.publicFiles[0].sourcePageRecordId;},
  (copy:any)=>{copy.provenance.publicationImportBaseline.publicFiles[0].sourceUrl=proof.sourceUrl.split('#')[0];},
  (copy:any)=>{copy.provenance.publicationImportBaseline.publicFiles[0].sourceFileName='another-work.pdf';},
  (copy:any)=>{copy.dataDefesa='2025-08-29';},
  (copy:any)=>{delete copy.provenance.publicationImportBaseline.publicFiles[0].sourceUrl;},
 ]) {const copy=structuredClone(r);mutate(copy);assert.equal(canonicalLegacyRecord(copy).isPublic,false);}
 r.attachments[0].sourceFileName='renamed-original.pdf';assert.equal(canonicalLegacyRecord(r).publishFullWork,true,'renaming does not change the approved content');
});
test('only ata, authorization term and declaration may appear in historical public documents',()=>{
 const r=fixture();r.provenance.administrativeDocuments=['AVALIACAO','CONVITE','ATA','TERMO','DECLARACAO'].map((kind,i)=>({kind,driveFileId:'admin_fixture_file_'+i,folderId:'private_folder_fixture',sha256:'c'.repeat(64),fileName:kind+'.pdf',visibility:'PRIVATE_ADMINISTRATIVE_DOCUMENT'}));
 assert.deepEqual(publicLegacyAdministrativeDocuments(r).map(d=>d.type),['ATA','TERMO','DECLARACAO']);
 r.provenance.publicationImportBaseline.privateFileIds=['admin_fixture_file_2'];
 assert.deepEqual(publicLegacyAdministrativeDocuments(r).map(d=>d.type),['TERMO','DECLARACAO']);
});
test('unapproved historical publication is rejected before persistence, Drive changes or signature requests',async(t)=>{
 const r=fixture();r.provenance.publicationImportBaseline.publicFiles=[];
 let p:any={id:r.id,status:'CONCLUIDO',dataRevision:1,aluno1:{},orientador:{},avaliacao:{},legacyRecord:true,acervo:{submittedAt:'2026-11-16',publishFullWork:false,publishExpandedAbstract:false,trabalhoCompletoFileId:r.attachments[0].driveFileId,trabalhoCompletoSha256:r.attachments[0].sha256}};
 const original=p;let effects=0;
 const app=express();app.use(express.json());installPublicationChoiceRoutes(app,{authenticate:(_q,_s,n)=>n(),email:()=> 'master@example.invalid',master:()=>true,access:()=>true,process:()=>p,replace:next=>{p=next;},jobs:()=>[],audit:()=>{effects++;},persist:async()=>{effects++;},revoke:async()=>{effects++;},destroyPreviousTerms:async()=>{effects++;},term:async()=>{effects++;},validateChoice:next=>{if(!legacyPublicationScopeAllowed(r,next))throw Error('Keep private');}});
 const server=app.listen(0,'127.0.0.1');await new Promise<void>(resolve=>server.once('listening',resolve));t.after(()=>new Promise<void>((resolve,reject)=>server.close(e=>e?reject(e):resolve())));const addr=server.address();if(!addr||typeof addr==='string')throw Error('address');
 const response=await fetch(`http://127.0.0.1:${addr.port}/api/processes/${r.id}/publication-choice`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({expectedRevision:1,confirmed:true,publishFullWork:true,publishExpandedAbstract:false})});
 assert.equal(response.status,400);assert.equal(p,original);assert.equal(effects,0);
});

test('archived historical term publishes an approved original, but never an original outside the source boundary',async()=>{
 const {readFileSync}=await import('node:fs'),{runInNewContext}=await import('node:vm'),ts=(await import('typescript')).default;
 const {historicalPublicationProcess,storeHistoricalPublicationProcess}=await import('./legacyPublicationProcess');
 const {beginPublicationChoice,finishPublicationRevocation,assertRenewedPublicationSigners}=await import('./workflow/publicationChoice');
 const {signatureDocumentRevision}=await import('../src/utils/documentSignatureState');
 const source=readFileSync('server.ts','utf8'),start=source.indexOf('async function finishArchivedSignature('),end=source.indexOf('\n}',start)+2;
 for(const approved of [false,true]){
  const r=fixture();r.provenance.publicationOverride={status:'COMPLETED',publishFullWork:false,publishExpandedAbstract:false};
  if(!approved)r.provenance.publicationImportBaseline.publicFiles=[];
  const p=beginPublicationChoice(historicalPublicationProcess(canonicalLegacyRecord(r)),{publishFullWork:true,publishExpandedAbstract:false},[],'master@example.invalid','renew','2026-11-16T12:00:00Z');
  p.aluno1.email='author@example.invalid';p.orientador.email='advisor@example.invalid';finishPublicationRevocation(p,'2026-11-16T12:00:00Z');
  const job:any={id:'term-fixture',processId:r.id,documentType:'TERMO',sourceDataRevision:p.dataRevision,status:'ARCHIVED',postArchivePending:true,driveSignedFileId:'signed_term_fixture',signedSha256:'d'.repeat(64),fileName:'Term.pdf',signers:[p.aluno1.email,p.orientador.email].map(email=>({email,status:'SIGNED'}))};
  p.acervo.publicationChange!.signatureJobId=job.id;r.provenance.publicationProcess=p;
  let publications=0;
  const context:any={Date,Error,signatureJobsStore:[job],processesStore:[],legacyAcademicRecordsStore:[r],signatureDocumentRevision,historicalPublicationProcess,legacyPublicationScopeAllowed,assertRenewedPublicationSigners,legacyAdministrativeFiles:(rec:any)=>rec.provenance.administrativeDocuments||[],storeHistoricalPublicationProcess,
   getGoogleWorkspaceAccessToken:async()=> 'fixture-only',publicationProcessById:()=>p,persistPortalStateDurably:async()=>{},publicRepositoryDriveLinks:async(input:any)=>{assert.equal(await input.assertAuthorized(),true);publications++;}};
  runInNewContext(ts.transpileModule(source.slice(start,end),{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,context);
  await context.finishArchivedSignature(job,'master@example.invalid');
  assert.equal(publications,approved?1:0);assert.equal(job.postArchivePending,approved?undefined:true);
  assert.equal(canonicalLegacyRecord(r).isPublic,approved);
 }
});
