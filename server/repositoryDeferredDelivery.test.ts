import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';
import {attachRuntimeRequestLifecycle,beginRuntimeRequestTask} from './runtimeRequestQueue';
import {ataArchived,declarationReady} from './workflow/gates';
import {signatureDocumentRevision} from '../src/utils/documentSignatureState';
import {safeRepositorySignatureError} from './workflow/automaticRepositorySignatureRecovery';

const source=await readFile('server.ts','utf8');
const start=source.indexOf("  app.post('/api/processes/:id/final-data'");
const route=source.slice(start,source.indexOf("  app.post('/api/admin/processes/:id/publication/withdraw'",start));
function fixture(){
 const p:any={id:'deferred-fixture',protocolo:'TCC - 00002',dataRevision:10,status:'AGUARDANDO_DADOS_FINAIS',etapaAtual:'REPOSITORIO',aluno1:{nome:'Autora fictícia',email:'author@example.invalid'},orientador:{nome:'Orientador fictício',email:'advisor@example.invalid'},avaliacao:{status:'CONCLUIDO',documentRevision:9},acervo:{trabalhoCompletoFileId:'private-work-fixture',trabalhoCompletoFileUrl:'/api/private-work-fixture',resumoExpandidoFileId:'private-abstract-fixture'}};
 const jobs:any[]=[{id:'signed-ata-fixture',processId:p.id,documentType:'ATA',sourceDataRevision:9,documentVersion:1,status:'ARCHIVED',driveSignedFileId:'private-signed-ata-fixture',signers:[{email:'advisor@example.invalid',role:'ADVISOR',status:'SIGNED'},{email:'one@example.invalid',role:'EXAMINER',status:'SIGNED'},{email:'two@example.invalid',role:'EXAMINER',status:'SIGNED'}]}];
 return {p,jobs};
}
function harness(){
 const {p,jobs}=fixture();let handler:any;
 const scheduled:Array<()=>void>=[],background:Promise<void>[]=[];
 const calls={persist:0,automatic:[] as string[],events:[] as string[],released:0};
 let firstPersist:()=>Promise<void>=async()=>{};
 let event:(process:any,name:string)=>Promise<any>=async()=>({status:'COMPLETED',actions:[]});
 const context:any={Date,Promise,Error,console:{error:()=>{}},process:{env:{VERCEL:'fixture'}},setImmediate:(callback:()=>void)=>scheduled.push(callback),waitUntil:(task:Promise<void>)=>background.push(task),beginRuntimeRequestTask,
  app:{post:(path:string,auth:unknown,callback:any)=>{assert.equal(path,'/api/processes/:id/final-data');assert.equal(auth,'authenticated');handler=callback;}},requireAuthenticated:'authenticated',processesStore:[p],signatureJobsStore:jobs,auditLogsStore:[],
  getPortalIdentity:()=>({email:p.aluno1.email}),canAccessProcess:()=>true,getActiveProcessRoles:()=>['STUDENT'],getUserRolesForEmail:()=>({memberships:[{roles:['STUDENT']}]}),missingDocumentModels:()=>[],ataArchived,declarationReady,
  safeRepositorySignatureError,queueAutomaticAsten:(process:any,type:string)=>{if(process.signatureProviderPreferences?.[type]!=='GOV_BR')process.astenSignatureIntent={documentType:type,revision:signatureDocumentRevision(process,type),queuedAt:'2026-11-07T12:00:00Z'};},
  persistPortalStateDurably:async()=>{calls.persist++;if(calls.persist===1)await firstPersist();},executeConfiguredWorkflowEvent:async(process:any,name:string)=>{calls.events.push(name);return event(process,name);},executeAutomaticAsten:async(_process:any,type:string)=>{calls.automatic.push(type);},updateProcessCompletion:()=>{},};
 runInNewContext(ts.transpileModule(route,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,context);
 return {context,calls,scheduled,background,p,jobs,setPersist:(value:()=>Promise<void>)=>{firstPersist=value;},setEvent:(value:typeof event)=>{event=value;},request:async(body:Record<string,unknown>={})=>{
  const req={params:{id:p.id},body:{palavrasChave:['a','b','c','d','e'],resumoSintese:'Resumo fictício para o teste da entrega.',publishFullWork:true,publishExpandedAbstract:false,...body}};
  const lifecycle=attachRuntimeRequestLifecycle(req,()=>calls.released++);
  const res={code:200,body:undefined as any,status(code:number){this.code=code;return this;},json(value:any){this.body=JSON.parse(JSON.stringify(value));lifecycle.responseFinished();return this;}};
  try{await handler(req,res);return res;}catch(error){lifecycle.responseFinished();throw error;}finally{lifecycle.hydrationFinished();}
 },run:async()=>{for(const release of scheduled.splice(0))release();await Promise.all(background);}};
}
test('confirma entrega+intent duráveis antes202; trabalho deferido mantém lease atésettle',async()=>{
 const h=harness();let release!:()=>void;
 h.setPersist(()=>new Promise<void>(resolve=>{release=resolve;}));
 const request=h.request();await Promise.resolve();await Promise.resolve();
 assert.equal(h.calls.persist,1);assert.equal(h.scheduled.length,0);assert.equal(h.background.length,0);assert.deepEqual(h.calls.events,[]);
 release();const response=await request;
 assert.equal(response.code,202);assert.equal(response.body.acervo.submittedBy,'author@example.invalid');assert.equal(response.body.astenSignatureIntent.documentType,'TERMO');assert.equal(response.body.astenSignatureIntent.revision,11);
 assert.equal(response.body.astenSignatureIntent.sentAt,undefined);assert.equal(h.calls.released,0);assert.equal(h.background.length,1);assert.deepEqual(h.calls.automatic,[]);
 await h.run();assert.deepEqual(h.calls.events,['REPOSITORY_SUBMITTED']);assert.deepEqual(h.calls.automatic,['TERMO']);assert.equal(h.calls.persist,2);assert.equal(h.calls.released,1);
});
for(const change of ['reopen','cancel','replace'] as const)test(`entrega ${change} antes deferred não dispara fluxo nemenvio antigo`,async()=>{
 const h=harness();await h.request();const current=h.context.processesStore[0];
 if(change==='reopen'){current.dataRevision++;current.acervo.submittedAt=undefined;}
 if(change==='cancel')current.astenSignatureIntent=undefined;
 if(change==='replace')h.context.processesStore=[structuredClone(current)];
 await h.run();assert.deepEqual(h.calls.events,[]);assert.deepEqual(h.calls.automatic,[]);assert.equal(h.calls.persist,1);assert.equal(h.calls.released,1);
});
test('reabertura durante await do evento bloqueia continuidade e persistência da versão antiga',async()=>{
 const h=harness();h.setEvent(async process=>{process.dataRevision++;process.acervo.submittedAt=undefined;process.astenSignatureIntent=undefined;return{status:'COMPLETED'};});
 await h.request();await h.run();assert.deepEqual(h.calls.events,['REPOSITORY_SUBMITTED']);assert.deepEqual(h.calls.automatic,[]);assert.equal(h.calls.persist,1);assert.equal(h.calls.released,1);
});
test('run parcial permanece pendente e não ganha fallback de envio',async()=>{
 const h=harness();h.setEvent(async()=>({status:'PARTIAL_FAILURE',actions:[{status:'FAILED',error:'fixture model mismatch'}]}));
 assert.equal((await h.request()).code,202);await h.run();assert.deepEqual(h.calls.automatic,[]);assert.ok(h.context.processesStore[0].astenSignatureIntent.attemptedAt);assert.equal(h.calls.released,1);
 assert.equal(h.context.processesStore[0].astenSignatureIntent.lastErrorCode,'WORKFLOW_PENDING');
});
test('erro antes de criar job fica visível sem copiar conteúdo privado para a intenção',async()=>{
 const h=harness();h.setEvent(async()=>{throw Error('private-token-and-email');});await h.request();await h.run();
 const intent=h.context.processesStore[0].astenSignatureIntent;
 assert.equal(intent.lastErrorCode,'ASTEN_DELIVERY_PENDING');assert.ok(intent.attemptedAt);assert.doesNotMatch(intent.lastError,/private-token-and-email/);assert.deepEqual(h.calls.automatic,[]);
});
test('document action que já consumiu intent não recebe segundo pedido automático',async()=>{
 const h=harness();h.setEvent(async process=>{h.calls.automatic.push('TERMO');process.astenSignatureIntent=undefined;return{status:'COMPLETED'};});
 await h.request();await h.run();assert.deepEqual(h.calls.automatic,['TERMO']);assert.equal(h.calls.released,1);
});
test('sem publicação usa declaração apenas apósgates; GOVpermanece caminho manual existente',async()=>{
 const noPublication=harness();assert.equal((await noPublication.request({publishFullWork:false})).code,202);await noPublication.run();
 assert.deepEqual(noPublication.calls.events,['REPOSITORY_SUBMITTED','PUBLICATION_CLEARED']);assert.deepEqual(noPublication.calls.automatic,['DECLARACAO']);
 const gov=harness();assert.equal((await gov.request({signatureProvider:'GOV_BR'})).code,200);assert.equal(gov.scheduled.length,0);assert.deepEqual(gov.calls.automatic,[]);assert.deepEqual(gov.calls.events,['REPOSITORY_SUBMITTED']);
 const missingAta=harness();missingAta.jobs[0].status='SENT';assert.equal((await missingAta.request({publishFullWork:false})).code,409);assert.equal(missingAta.calls.persist,0);assert.equal(missingAta.scheduled.length,0);
});
test('primeira barreira durável falha sem202nemagendamento',async()=>{
 const h=harness();h.setPersist(async()=>{throw Error('durable save failed');});await assert.rejects(h.request(),/durable save failed/);assert.equal(h.scheduled.length,0);assert.equal(h.background.length,0);assert.deepEqual(h.calls.events,[]);assert.equal(h.calls.released,1);
});
