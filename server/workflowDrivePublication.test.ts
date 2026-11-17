import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {createHash} from 'node:crypto';
import ts from 'typescript';
import {publicFileAuthorized} from './workflow/publicationAccess';
import {signatureDocumentRevision} from '../src/utils/documentSignatureState';

const source=readFileSync('server.ts','utf8');
function actual(names:string[],ports:Record<string,unknown>){
 const parsed=ts.createSourceFile('server.ts',source,ts.ScriptTarget.ES2022,true);
 const nodes=parsed.statements.filter(ts.isFunctionDeclaration).filter(node=>node.name&&names.includes(node.name.text));assert.equal(nodes.length,names.length);
 return runInNewContext(ts.transpileModule(nodes.map(node=>node.getText(parsed)).join('\n')+`\n({${names.join(',')}})`,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,{Date,Buffer,createHash,signatureDocumentRevision,publicFileAuthorized,...ports});
}
const pdf=Buffer.from('%PDF-1.4\nfixture only\n%%EOF'),sha=createHash('sha256').update(pdf).digest('hex');
function fixture(){
 const p:any={id:'process-fixture',dataRevision:4,status:'CONCLUIDO',avaliacao:{documentRevision:2,status:'CONCLUIDO'},aluno1:{email:'author@example.invalid'},orientador:{email:'advisor@example.invalid'},acervo:{submittedAt:'2026-11-17',authorizationConfirmedAt:'2026-11-17',publishFullWork:true,publishExpandedAbstract:false,publicationState:'PUBLIC',publicationSyncedAt:'2026-11-17',trabalhoCompletoFileId:'authorized_original_full_123',publicFullWorkFileId:'authorized_original_full_123',trabalhoCompletoSha256:sha,resumoExpandidoFileId:'private_abstract_12345',resumoExpandidoSha256:sha}};
 const jobs:any[]=[{id:'ata-job',processId:p.id,documentType:'ATA',documentVersion:1,sourceDataRevision:2,status:'ARCHIVED',driveSignedFileId:'signed_ata_original_123',signedSha256:sha,signers:[{role:'ADVISOR',email:p.orientador.email,status:'SIGNED'},{role:'EXAMINER',email:'one@example.invalid',status:'SIGNED'},{role:'EXAMINER',email:'two@example.invalid',status:'SIGNED'}]},
 {id:'term-job',processId:p.id,documentType:'TERMO',documentVersion:1,sourceDataRevision:4,status:'ARCHIVED',driveSignedFileId:'signed_term_original_123',signedSha256:sha}];
 return {p,jobs};
}
test('completion publishes only each consent-authorized original and rechecks a withdrawal during provider I/O',async()=>{
 const {p,jobs}=fixture(),published:string[]=[];
 let withdraw=false;
 const {publishAuthorizedAcademicOriginals}=actual(['publishAuthorizedAcademicOriginals'],{
  localReviewFilesEnabled:()=>false,processesStore:[p],signatureJobsStore:jobs,getGoogleWorkspaceAccessToken:async()=> 'fixture',
  publicRepositoryDriveLinks:async(input:any)=>{assert.equal(await input.assertAuthorized(),true);assert.equal(input.sourceFileId,p.acervo.trabalhoCompletoFileId);if(withdraw)p.acervo.publishFullWork=false;assert.equal(await input.assertAuthorized(),!withdraw);if(withdraw)throw Error('authorization changed');published.push(input.sourceFileId);return {};},
 });
 assert.equal(publicFileAuthorized(p,jobs,'trabalho-completo'),true);
 await publishAuthorizedAcademicOriginals(p);assert.deepEqual(published,['authorized_original_full_123']);
 p.status='AGUARDANDO_ASSINATURA';await publishAuthorizedAcademicOriginals(p);assert.equal(published.length,1,'unfinished processes never publish their PDFs');
 p.status='CONCLUIDO';withdraw=true;await assert.rejects(publishAuthorizedAcademicOriginals(p),/authorization changed/);assert.equal(published.length,1);
});
test('completion without publication consent does not request Google credentials or publish files',async()=>{
 const {p,jobs}=fixture();p.acervo.publishFullWork=false;
 const {publishAuthorizedAcademicOriginals}=actual(['publishAuthorizedAcademicOriginals'],{
  localReviewFilesEnabled:()=>false,processesStore:[p],signatureJobsStore:jobs,
  getGoogleWorkspaceAccessToken:async()=>{throw Error('No provider request is allowed without an authorized file.');},
  publicRepositoryDriveLinks:async()=>{throw Error('No file may be published without consent.');},
 });
 assert.equal(publicFileAuthorized(p,jobs,'trabalho-completo'),false);
 assert.equal(publicFileAuthorized(p,jobs,'resumo-expandido'),false);
 await publishAuthorizedAcademicOriginals(p);
});
test('issued signed documents publish during the archive event with exact job, revision and PDF integrity',async()=>{
 const {p,jobs}=fixture(),job=jobs[0];let publications=0,scans=0;
 const ports={localReviewFilesEnabled:()=>false,processesStore:[p],signatureJobsStore:jobs,publicationRequested:()=>true,getGoogleWorkspaceAccessToken:async()=> 'fixture',
  generateDefaultDocuments:()=>[],publicAcademicDocuments:()=>[{type:'ATA',version:1}],downloadDrivePdf:async()=>({pdf}),
  assertPublicAcademicPdf:async(bytes:Buffer,_process:any,options:any)=>{assert.deepEqual(bytes,pdf);assert.equal(options.issuedAdministrativeDocument,true);scans++;},
  publicRepositoryDriveLinks:async(input:any)=>{assert.equal(input.sourceFileId,job.driveSignedFileId);assert.equal(input.signatureJobId,job.id);assert.equal(input.artifactType,'ATA');assert.equal(await input.assertAuthorized(),true);await input.validatePublicContent();assert.equal(await input.assertAuthorized(),true);publications++;return {};},
 };
 const {publishArchivedAdministrativeOriginal}=actual(['publishIssuedAdministrativeOriginal','publishArchivedAdministrativeOriginal'],ports);
 await publishArchivedAdministrativeOriginal(p,job);assert.equal(publications,1);assert.equal(scans,1);
 job.sourceDataRevision=1;await assert.rejects(publishArchivedAdministrativeOriginal(p,job),/mudou antes/);assert.equal(publications,1);
 job.sourceDataRevision=2;job.signedSha256='b'.repeat(64);await assert.rejects(publishArchivedAdministrativeOriginal(p,job),/mudou durante/);assert.equal(publications,1);
});
test('the receipt event accepts only a durable archived receipt linked to that process history',async()=>{
 const {p}=fixture();const job:any={processId:p.id,formType:'CONFIRMACAO_LOCAL',version:4,reservationRevision:2,status:'ARCHIVED',driveFileId:'exact_receipt_original_123',sha256:sha};let publications=0;
 const {publishReservationArchive}=actual(['publishReservationArchive'],{processesStore:[p],formArchiveJobsStore:[job],reservationReceipts:()=>[{summary:{revision:2}}],
  publishIssuedAdministrativeOriginal:async(_p:any,input:any)=>{assert.equal(input.fileId,job.driveFileId);assert.equal(input.formVersion,4);assert.equal(input.sha256,sha);assert.equal(input.assertCurrent(),true);publications++;}});
 await publishReservationArchive(p,job,'fixture',pdf);assert.equal(publications,1);
 job.status='FAILED';
 const guarded=actual(['publishReservationArchive'],{processesStore:[p],formArchiveJobsStore:[job],reservationReceipts:()=>[{summary:{revision:2}}],publishIssuedAdministrativeOriginal:async(_p:any,input:any)=>{assert.equal(input.assertCurrent(),false);throw Error('not archived');}});
 await assert.rejects(guarded.publishReservationArchive(p,job,'fixture',pdf),/not archived/);
});
