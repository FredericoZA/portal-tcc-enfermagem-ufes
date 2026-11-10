import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';
import {executeWorkflowEvent,normalizeWorkflowEventCode} from './workflow/runtime';
import {ataArchived,declarationReady} from './workflow/gates';
import {deriveSignatureSigners,assertSignatureEligibility,publicationRequested,signatureJobMatchesCurrentRevision} from './workflow/signaturePolicy';
import {signatureDocumentRevision} from '../src/utils/documentSignatureState';
import {operationalDocumentType} from '../src/utils/courseStudioValidator';
import {safeRepositorySignatureError} from './workflow/automaticRepositorySignatureRecovery';
import {inspectAstenDelivery} from './integrations/astenReadiness';
import {beginRuntimeRequestTask,attachRuntimeRequestLifecycle} from './runtimeRequestQueue';

const source=readFileSync('server.ts','utf8');
function fn(name:string){const start=source.search(new RegExp(`(?:async )?function ${name}\\(`));assert.ok(start>=0,name);return source.slice(start,source.indexOf('\n}',start)+2);}
const routeStart=source.indexOf("  app.post('/api/processes/:id/final-data'");
const route=source.slice(routeStart,source.indexOf("  app.post('/api/admin/processes/:id/publication/withdraw'",routeStart));
function harness(options:{paired?:boolean;rejectDispatch?:boolean}={}){
 const p:any={id:'integration-unit',protocolo:'TCC - 00002',titulo:'Trabalho sintético',dataRevision:10,status:'AGUARDANDO_DADOS_FINAIS',etapaAtual:'REPOSITORIO',defesa:{},banca:[],aluno1:{nome:'Autora fictícia',email:'author@example.invalid'},aluno2:options.paired?{nome:'Segundo autor',email:'second@example.invalid'}:undefined,orientador:{nome:'Orientador fictício',email:'advisor@example.invalid'},avaliacao:{status:'CONCLUIDO',documentRevision:9},acervo:{trabalhoCompletoFileId:'work-unit',trabalhoCompletoFileUrl:'/api/private-unit'}};
 const jobs:any[]=[{id:'signed-ata',processId:p.id,documentType:'ATA',sourceDataRevision:9,documentVersion:1,status:'ARCHIVED',driveSignedFileId:'signed-ata-unit',signers:[{email:p.orientador.email,role:'ADVISOR',status:'SIGNED'},{email:'one@example.invalid',role:'EXAMINER',status:'SIGNED'},{email:'two@example.invalid',role:'EXAMINER',status:'SIGNED'}]}];
 const studio:any={revision:7,emailTemplates:[],formTemplates:[],docTemplates:[{id:'tmpl-termo',type:'TERMO'},{id:'tmpl-declaracao',type:'DECLARACAO'}],variables:[],workflowStages:[{id:'repository',triggerEvent:'REPOSITORY_SUBMITTED',actions:[{id:'generate-term',type:'DOCUMENT',refId:'tmpl-termo'}]},{id:'publication',triggerEvent:'PUBLICATION_CLEARED',actions:[{id:'generate-declaration',type:'DOCUMENT',refId:'tmpl-declaracao'}]}]};
 const settings:any={driveRootFolderId:'private-unit-root',commissionPresidentName:'Presidência fictícia',commissionPresidentEmail:'president@example.invalid',integrationStudio:studio};
 const snapshots:any[]=[];const dispatches:any[]=[];const events:any[]=[];const scheduled:Array<()=>void>=[];const background:Promise<void>[]=[];let handler:any;
 const context:any={Date,Promise,Error,console:{error:()=>{}},process:{env:{VERCEL:'fixture',ASTEN_AUTOMATIC_WORKFLOW_ENABLED:'true'}},setImmediate:(callback:()=>void)=>scheduled.push(callback),waitUntil:(task:Promise<void>)=>background.push(task),beginRuntimeRequestTask,
  app:{post:(_path:any,_auth:any,callback:any)=>{handler=callback;}},requireAuthenticated:()=>{},processesStore:[p],signatureJobsStore:jobs,auditLogsStore:[],currentSettings:settings,
  getPortalIdentity:()=>({email:p.aluno1.email}),canAccessProcess:()=>true,getActiveProcessRoles:()=>['STUDENT'],getUserRolesForEmail:()=>({memberships:[{roles:['STUDENT']}]}),missingDocumentModels:()=>[],ataArchived,declarationReady,signatureDocumentRevision,signatureJobMatchesCurrentRevision,publicationRequested,safeRepositorySignatureError,normalizeWorkflowEventCode,operationalDocumentType,
  assertSignatureEligibility:(process:any,type:any)=>assertSignatureEligibility(process,type,jobs),inspectAstenDelivery,
  getPersistentAstenStatus:async()=>({dispatchEnabled:true,securityMessage:''}),astenWebhookInboxReady:async()=>true,resolveAstenDocumentFolder:async()=>10,getGoogleWorkspaceStatus:async()=>({connected:true}),
  persistPortalStateDurably:async()=>{snapshots.push(structuredClone({processes:context.processesStore,jobs}));},
  // Durable job port isolates PDF rendering/storage. Recipient derivation and gates are real.
  createSignatureJob:async(process:any,type:any)=>{const job={id:`job-${type}`,processId:process.id,documentType:type,sourceDataRevision:signatureDocumentRevision(process,type),documentVersion:1,provider:'ASTEN',status:'QUEUED',driveUnsignedFileId:'generated-private-pdf',signers:deriveSignatureSigners(process,type,settings)};jobs.push(job);await context.persistPortalStateDurably();return job;},
  // External ASTEN dispatch boundary: validates preparation was durable before provider call.
  dispatchSignatureJobAutomatically:async(job:any)=>{assert.ok(snapshots.some(s=>s.jobs.some((j:any)=>j.id===job.id&&j.driveUnsignedFileId)));dispatches.push(structuredClone(job));if(options.rejectDispatch){job.status='PROVIDER_ERROR';job.lastError='synthetic dispatch rejected';return job;}job.status='SENT';job.providerDispatchState='SENT';job.sentAt=new Date().toISOString();return job;},updateProcessCompletion:()=>{},
 };
 const functions=['configuredDocumentType','assertSafeWorkflowDocumentEvent','automaticAstenEnabled','queueAutomaticAsten','acceptedAstenSignature','executeAutomaticAsten','executeConfiguredDocumentAction'].map(fn).join('\n');
 runInNewContext(ts.transpileModule(functions+'\n'+route,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,context);
 context.executeConfiguredWorkflowEvent=async(process:any,eventCode:any,actorEmail:any)=>{const run=await executeWorkflowEvent(studio,{process,eventCode,actorEmail,actorRoles:['STUDENT']},{createDocument:async({template,idempotencyKey,variables})=>context.executeConfiguredDocumentAction(process,template,actorEmail,idempotencyKey,variables,eventCode),createFormTask:async()=>assert.fail('No form action configured'),sendEmail:async()=>assert.fail('ASTEN notices belong to provider, not a separate workflow email')});events.push(run);return run;};
 return {context,jobs,snapshots,dispatches,events,request:async(body:any={})=>{const req={params:{id:p.id},body:{palavrasChave:['a','b','c','d','e'],resumoSintese:'Resumo sintético de integração.',publishFullWork:true,publishExpandedAbstract:false,...body}};const lifecycle=attachRuntimeRequestLifecycle(req,()=>{});const res={code:200,body:undefined as any,status(code:number){this.code=code;return this;},json(value:any){this.body=structuredClone(value);lifecycle.responseFinished();return this;}};try{await handler(req,res);return res;}finally{lifecycle.hydrationFinished();}},flush:async()=>{for(const callback of scheduled.splice(0))callback();await Promise.all(background);}};
}
for(const paired of [false,true])test(`real final-data route → engine → document executor → automatic ASTEN (${paired?2:1} authors)`,async()=>{
 const h=harness({paired});const response=await h.request();assert.equal(response.code,202);assert.equal(h.dispatches.length,0);assert.equal(response.body.astenSignatureIntent.documentType,'TERMO');
 await h.flush();assert.equal(h.events[0].status,'COMPLETED',JSON.stringify(h.events[0]));assert.equal(h.events[0].actions[0].externalId,'job-TERMO');assert.equal(h.dispatches.length,1);
 assert.deepEqual(h.dispatches[0].signers.map((s:any)=>s.email).sort(),['advisor@example.invalid','author@example.invalid',...(paired?['second@example.invalid']:[])].sort());assert.ok(h.dispatches[0].signers.every((s:any)=>s.signingOrder===1));
 assert.equal(h.context.processesStore[0].astenSignatureIntent,undefined);assert.equal(h.snapshots.at(-1).jobs.find((j:any)=>j.id==='job-TERMO').status,'SENT');assert.equal(h.snapshots.at(-1).processes[0].astenSignatureIntent,undefined);
});
test('rejected external dispatch retains intent and failed action, never reports delivery accepted',async()=>{
 const h=harness({rejectDispatch:true});await h.request();await h.flush();assert.equal(h.events[0].status,'PARTIAL_FAILURE');assert.equal(h.dispatches.length,1);assert.equal(h.context.processesStore[0].astenSignatureIntent.documentType,'TERMO');assert.equal(h.context.processesStore[0].astenSignatureIntent.lastErrorCode,'WORKFLOW_PENDING');assert.equal(h.jobs.find(j=>j.id==='job-TERMO').status,'PROVIDER_ERROR');
});
test('GOV preference does not create or dispatch an automatic TERMO',async()=>{
 const h=harness();const res=await h.request({signatureProvider:'GOV_BR'});await h.flush();assert.equal(res.code,200);assert.equal(h.dispatches.length,0);assert.equal(h.jobs.length,1);assert.equal(h.events[0].actions[0].externalId,'MANUAL_SIGNATURE_SELECTION:TERMO');
});
test('no publication skips TERMO and only advances declaration through its own real gate',async()=>{
 const h=harness();await h.request({publishFullWork:false});await h.flush();assert.equal(h.events[0].actions[0].externalId,'NOT_APPLICABLE_NO_PUBLICATION');assert.equal(h.jobs.some(j=>j.documentType==='TERMO'),false);assert.deepEqual(h.dispatches.map(j=>j.documentType),['DECLARACAO']);assert.deepEqual(h.dispatches[0].signers.map((s:any)=>s.email),['president@example.invalid']);
});
test('missing archived ATA blocks delivery before intent, job, dispatch or durable write',async()=>{
 const h=harness();h.jobs[0].status='SENT';const res=await h.request();await h.flush();assert.equal(res.code,409);assert.equal(res.body.code,'ATA_SIGNATURE_REQUIRED');assert.equal(h.dispatches.length,0);assert.equal(h.snapshots.length,0);assert.equal(h.events.length,0);
});
