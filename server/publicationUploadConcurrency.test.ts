import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { createHash } from 'node:crypto';
import ts from 'typescript';
import { beginPublicationChoice } from './workflow/publicationChoice';

function harness() {
  const pdf = Buffer.from('%PDF-fixture-only');
  const p: any = { id: 'upload-fixture', titulo: 'Fixture', protocolo: 'TCC - 99999', dataRevision: 4,
    status: 'CONCLUIDO', aluno1: {nome:'Author'}, orientador:{}, avaliacao:{status:'CONCLUIDO'},
    driveFolderId:'private-folder', acervo:{submittedAt:'2026-11-16',trabalhoCompletoFileId:'old-pdf',trabalhoCompletoSha256:'a'.repeat(64),
      publicationChange:{id:'editing-fixture',status:'EDITING',revision:4,publishFullWork:true,publishExpandedAbstract:false,requestedBy:'author@example.invalid',previousTermJobIds:[],revokeFileIds:[]}} };
  let release!:()=>void, started!:()=>void;
  const startedUpload=new Promise<void>(resolve=>{started=resolve;});
  const upload=new Promise<void>(resolve=>{release=resolve;});
  let handler:any, persists=0;
  const context:any={Buffer,Date,Error,Boolean,String,Number,Math,createHash,
    processesStore:[p],signatureJobsStore:[],auditLogsStore:[],currentSettings:{driveRootFolderId:'private-root'},
    requireAuthenticated:'auth',app:{post:(_path:string,_auth:any,fn:any)=>{handler=fn;}},
    publicationProcessById:(id:string)=>context.processesStore.find((row:any)=>row.id===id),
    getPortalIdentity:()=>({email:'author@example.invalid'}),hasFullAdministration:()=>false,canAccessProcess:()=>true,
    getActiveProcessRoles:()=>['STUDENT'],getUserRolesForEmail:()=>({globalRoles:[]}),ataArchived:()=>true,finalDocumentFilesLocked:()=>false,
    localReviewFilesEnabled:()=>true,sourceFilesAccessToken:async()=> 'fixture-only',
    ensureStoredProcessFolder:async()=>p.driveFolderId,
    uploadSourceFile:async()=>{started();await upload;return {id:'new-private-pdf',name:'Fixture.pdf'};},
    buildProcessArchiveFileName:()=> 'Fixture.pdf',publicationRequested:()=>false,
    readLegacyDevelopmentUpload:()=>pdf,persistPortalStateDurably:async()=>{persists++;},
  };
  const source=readFileSync('server.ts','utf8');
  const start=source.indexOf("  app.post('/api/processes/:id/files/:kind',");
  const end=source.indexOf('\n  const repositoryPublicationStillCurrent=',start);
  runInNewContext(ts.transpileModule(source.slice(start,end),{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,context);
  const res:any={code:200,status(code:number){this.code=code;return this;},json(body:any){this.body=body;return this;}};
  return {p,context,res,startedUpload,release:()=>release(),persists:()=>persists,
    send:()=>handler({params:{id:p.id,kind:'trabalho-completo'},body:{fileName:'Fixture.pdf',expectedPublicationRevision:4}},res)};
}
test('a completed upload cannot replace consent withdrawn during the Drive request',async()=>{
  const h=harness();const sending=h.send();await h.startedUpload;
  const restricted=beginPublicationChoice(h.p,{publishFullWork:false,publishExpandedAbstract:false},[],'author@example.invalid','veto','2026-11-17');
  h.context.processesStore[0]=restricted;
  h.release();await sending;
  assert.equal(h.res.code,409);assert.equal(h.res.body.code,'PUBLICATION_UPLOAD_CONFLICT');
  assert.equal(h.context.processesStore[0],restricted);assert.equal(restricted.acervo.publicationChange.id,'veto');
  assert.equal(restricted.acervo.trabalhoCompletoFileId,'old-pdf');assert.equal(h.persists(),0);
});
test('an unchanged publication request accepts its uploaded private PDF',async()=>{
  const h=harness();const sending=h.send();await h.startedUpload;h.release();await sending;
  assert.equal(h.res.code,201);assert.equal(h.context.processesStore[0].dataRevision,5);
  assert.equal(h.context.processesStore[0].acervo.publicationChange.revision,5);assert.equal(h.persists(),1);
});
