import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';
import {recordSignatureAudit,signatureAuditMetadata} from './signatureAuditMetadata';
import {safeAuditValue,buildAuditFeed} from '../auditFeed';
const process:any={id:'p',protocolo:'TCC - 00002',titulo:'Documento sintético',avaliacao:{}};
const makeJob=():any=>({id:'j',processId:'p',documentType:'ATA',documentTitle:'Ata oficial da defesa',documentVersion:2,sourceDataRevision:4,provider:'ASTEN',status:'SIGNED',signers:[{role:'ADVISOR',name:'Pessoa sintética',email:'unit@example.invalid',status:'SIGNED',signedAt:'2026-11-08T12:00:00Z'},{role:'STUDENT',name:'Autor sintético',email:'student@example.invalid',status:'SIGNED'}]});
test('callback e preparo não inventam progresso ou identidade individual',()=>{
 const job=makeJob();const result=signatureAuditMetadata(job,'PROVIDER_CALLBACK_RECONCILED');
 assert.equal(result.expectedSignerCount,2);assert.equal('verifiedSignerCount' in result,false);assert.equal('verifiedSigners' in result,false);
});
test('readback preserva quem assinou e só a data individual comprovada; metadados seguros e limitados',()=>{
 const job=makeJob();job.artifactBase64='secret';job.providerEnvelopeHash='secret';
 const result=signatureAuditMetadata(job,'PROVIDER_SIGNERS_VERIFIED','ASTEN_SIGNERS_READBACK');
 assert.equal(result.verifiedSignerCount,2);assert.equal(result.verifiedSigners?.[0].signedAt,'2026-11-08T12:00:00Z');assert.equal('signedAt' in result.verifiedSigners![1],false);
 assert.deepEqual(safeAuditValue(result),result);assert.equal(JSON.stringify(result).includes('secret'),false);
 job.signers=Array.from({length:20},()=>job.signers[0]);assert.equal(signatureAuditMetadata(job,'PROVIDER_SIGNERS_VERIFIED','ASTEN_SIGNERS_READBACK').verifiedSigners?.length,12);
});
test('evento determinístico e snapshot histórico sobrevivem feed sem lookup atual',()=>{
 const logs:any[]=[];const job=makeJob();recordSignatureAudit(logs,process,job,'system@example.invalid','PROVIDER_SIGNERS_VERIFIED','ASTEN_SIGNERS_READBACK');
 job.signers[0].name='Nome alterado';recordSignatureAudit(logs,process,job,'system@example.invalid','PROVIDER_SIGNERS_VERIFIED','ASTEN_SIGNERS_READBACK');assert.equal(logs.length,1);
 const row=buildAuditFeed({logs,deliveries:[],processes:[]})[0];assert.equal(row.after.verifiedSigners[0].name,'Pessoa sintética');assert.equal(row.processProtocol,'TCC - 00002');
 const historical:any={id:'old',action:'CALLBACK_ASTEN_RECONCILIADO',actorEmail:'system',entityType:'signature_job',entityId:'j',timestamp:'2026-01-01'};
 assert.equal(buildAuditFeed({logs:[historical],deliveries:[],processes:[]})[0].after,undefined);
});
test('commit real grava evidência de arquivamento uma vez após ack e antes da persistência',async()=>{
 const source=readFileSync('server.ts','utf8');const start=source.indexOf('async function commitSignatureArchive(');const text=source.slice(start,source.indexOf('\n}\n',start)+2);
 const job=makeJob();const logs:any[]=[];let writes=0;let finishes=0;
 const ports={Date,randomBytes:()=>({toString:()=> 'code'}),processesStore:[process],signatureJobsStore:[job],auditLogsStore:logs,signatureJobMatchesCurrentRevision:()=>true,hasCompetingSignatureArchive:()=>false,declarationReady:()=>false,queueAutomaticAsten:()=>{},recordSignatureAudit,persistPortalStateDurably:async()=>{writes++;assert.equal(logs.length,1);assert.equal(logs[0].after.eventStage,'SIGNED_DOCUMENT_ARCHIVED');},finishArchivedSignature:async()=>{finishes++;}};
 const commit=runInNewContext(ts.transpileModule('('+text+')',{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,ports);
 await commit(process,job,'system@example.invalid',{driveSignedFileId:'drive-ack',signedSha256:'sha'});await commit(process,job,'system@example.invalid',{});
 assert.equal(writes,1);assert.equal(finishes,1);assert.equal(logs[0].before.status,'SIGNED');assert.equal(logs[0].after.status,'ARCHIVED');assert.equal(logs[0].after.evidenceSource,'ASTEN_SIGNERS_READBACK');
});
test('produção somente consulta signatários na leitura existente e registra depois da validação',()=>{
 const source=readFileSync('server.ts','utf8');const start=source.indexOf('async function archiveSignatureJobAutomatically(');const body=source.slice(start,source.indexOf('\nfunction findAstenEnvelopeId',start));
 assert.equal(body.match(/callAsten\('getSignatariosPorEnvelope'/g)?.length,1);
 assert.ok(body.indexOf('recordSignatureAudit(')>body.indexOf('assertAstenEnvelopeSigners('));assert.ok(body.indexOf('recordSignatureAudit(')<body.indexOf('downloadPDFEnvelopeDocs'));
});
