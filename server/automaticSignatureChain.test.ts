import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {runInNewContext} from 'node:vm';import ts from 'typescript';import {declarationReady} from './workflow/gates';import {signatureDocumentRevision} from '../src/utils/documentSignatureState';

test('retomada natural mantém ata → entrega → termo aplicável → declaração e não repete etapa arquivada',async()=>{
 const server=readFileSync('server.ts','utf8');const start=server.indexOf('async function finishArchivedSignature(');const source=server.slice(start,server.indexOf('\n}\n',start)+2);
 const p:any={id:'chain',dataRevision:2,status:'AGUARDANDO_ASSINATURA',avaliacao:{status:'CONCLUIDO',documentRevision:1},acervo:{submittedAt:'2026-11-07',publishFullWork:true,publicationState:'PENDING_SYNC'}};
 const ata:any={id:'ata',processId:p.id,documentType:'ATA',sourceDataRevision:1,documentVersion:1,status:'ARCHIVED',driveSignedFileId:'signed-ata',signers:[{role:'ADVISOR',status:'SIGNED',email:'advisor@example.invalid'},{role:'EXAMINER',status:'SIGNED',email:'exam1@example.invalid'},{role:'EXAMINER',status:'SIGNED',email:'exam2@example.invalid'}],postArchivePending:true};
 const term:any={id:'term',processId:p.id,documentType:'TERMO',sourceDataRevision:2,documentVersion:1,status:'SENT',postArchivePending:true};
 const jobs=[ata,term];const events:string[]=[];let declarations=0,fail=false;
 const ports:any={Date,processesStore:[p],signatureJobsStore:jobs,signatureDocumentRevision,declarationReady,persistPortalStateDurably:async()=>{},executeConfiguredWorkflowEvent:async(_p:any,event:string)=>{events.push(event);return{status:'COMPLETED'};},syncAuthorizedPublication:async()=>{p.acervo.publicationState='PUBLIC';},executeAutomaticAsten:async(_p:any,type:string)=>{assert.equal(type,'DECLARACAO');declarations++;if(fail)throw Error('temporarily unavailable');},updateProcessCompletion:()=>{}};
 const finish=runInNewContext(ts.transpileModule('('+source+')',{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,ports);
 await finish(ata,'advisor@example.invalid');assert.deepEqual(events,['SIGNATURE_COMPLETED']);assert.equal(declarations,0,'unsigned term cannot release declaration');
 events.length=0;term.status='ARCHIVED';term.driveSignedFileId='signed-term';fail=true;
 await finish(term,'advisor@example.invalid');assert.equal(term.postArchivePending,true);assert.equal(declarations,1);assert.equal(p.acervo.publicationState,'PUBLIC');assert.match(term.lastError,/aguarda retomada/);
 fail=false;await finish(term,'advisor@example.invalid');assert.equal(term.postArchivePending,undefined);assert.equal(declarations,2);assert.ok(events.includes('PUBLICATION_CLEARED'));assert.ok(events.includes('SIGNATURE_COMPLETED'));
 const before=events.length;await finish(term,'advisor@example.invalid');assert.equal(events.length,before);assert.equal(declarations,2);
 // A superseded revision does not trigger downstream signatures.
 term.postArchivePending=true;term.sourceDataRevision=1;await finish(term,'advisor@example.invalid');assert.equal(declarations,2);assert.equal(term.postArchivePending,undefined);
});
