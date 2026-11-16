import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { randomBytes } from 'node:crypto';
import ts from 'typescript';
import { canonicalLegacyRecord, legacyFileIsPublic } from './legacyArchive';
import { historicalPublicationProcess, storeHistoricalPublicationProcess } from './legacyPublicationProcess';
import { beginPublicationChoice, finishPublicationRevocation } from './workflow/publicationChoice';
import { destroyPreviousPublicationTerms } from './publicationTermRemoval';

test('administrative withdrawal cancels renewed historical consent and destroys its term, including retries',async()=>{
 const record:any=canonicalLegacyRecord({id:'legado-0999',titulo:'Fixture',autores:['Author'],orientador:'Advisor',coorientador:'',examinadores:[],palavrasChave:[],attachments:[{kind:'TRABALHO_COMPLETO',driveFileId:'original-private-fixture',sha256:'a'.repeat(64),fileName:'Fixture.pdf'}],provenance:{originalConsent:['Sim']}} as any);
 const p=historicalPublicationProcess(record);
 p.acervo.publicationChange={id:'signed-renewal',requestedAt:'2026-11-15',requestedBy:'master@example.invalid',revision:1,status:'COMPLETED',publishFullWork:true,publishExpandedAbstract:false,previousTermJobIds:[],revokeFileIds:[],signatureJobId:'new-term',signedTermFileId:'new-term-pdf'};
 p.acervo.publicationSyncedAt='2026-11-15T12:00:00Z';
 storeHistoricalPublicationProcess(record,p);
 assert.equal(record.isPublic,true);
 const jobs:any[]=[{id:'new-term',processId:record.id,documentType:'TERMO',driveSignedFileId:'new-term-pdf',status:'ARCHIVED'}];
 let handler:any,fail=true,removed:string[]=[],revoked:string[]=[];
 const context:any={Date,Error,randomBytes,canonicalLegacyRecord,legacyFileIsPublic,historicalPublicationProcess,storeHistoricalPublicationProcess,beginPublicationChoice,finishPublicationRevocation,
  legacyAcademicRecordsStore:[record],signatureJobsStore:jobs,auditLogsStore:[],requireAuthenticated:'auth',requireGlobalRoles:()=> 'master',getPortalIdentity:()=>({email:'master@example.invalid'}),
  app:{post:(_path:any,_auth:any,_master:any,fn:any)=>{handler=fn;}},persistPortalStateDurably:async()=>{},getGoogleWorkspaceAccessToken:async()=> 'fixture-only',
  withdrawManyPublicDriveFiles:async(_token:any,ids:string[])=>{revoked=ids;if(fail)throw Error('temporary');},
  destroyPreviousTerms:async(proc:any)=>destroyPreviousPublicationTerms(proc,jobs,async(ids)=>{removed=ids;}),
 };
 const source=readFileSync('server.ts','utf8'),start=source.indexOf("  app.post('/api/admin/legacy-academic-records/:id/publication/withdraw'");
 const end=source.indexOf("  app.get('/api/public/legacy-academic-records/:id/documents",start);
 runInNewContext(ts.transpileModule(source.slice(start,end),{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,context);
 const request=async()=>{const res:any={code:200,status(code:number){this.code=code;return this;},json(body:any){this.body=body;return this;}};await handler({params:{id:record.id},body:{reason:'Withdrawal requested by the author'}},res);return res;};
 assert.equal((await request()).code,502);
 assert.equal(record.isPublic,false);assert.equal(record.provenance.publicationProcess.dataRevision,2);
 assert.equal(record.provenance.publicationProcess.acervo.publicationChange.status,'REVOKING_DRIVE');
 assert.ok(revoked.includes('new-term-pdf'));
 fail=false;assert.equal((await request()).code,200);
 assert.deepEqual(removed,['new-term-pdf']);assert.equal(jobs[0].status,'CANCELED');
 assert.equal(canonicalLegacyRecord(record).isPublic,false);
 assert.equal(record.provenance.publicationProcess.acervo.publicationChange.status,'COMPLETED');
 assert.equal((await request()).code,200);assert.equal(record.provenance.publicationProcess.dataRevision,2,'successful retry is idempotent');
});
