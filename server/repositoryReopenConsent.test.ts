import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';
import {PGlite} from '@electric-sql/pglite';
import {pgcrypto} from '@electric-sql/pglite/contrib/pgcrypto';
import {documentSignatureCompleted,signatureDocumentRevision} from '../src/utils/documentSignatureState';
import {ataArchived,declarationReady} from './workflow/gates';
import {signatureJobMatchesCurrentRevision} from './workflow/signaturePolicy';
import {publicFileAuthorized,finalDocumentFilesLocked} from './workflow/publicationAccess';
import {settlePreviousRuntimeWrites} from './runtimeRequestQueue';
import {inferAstenJobStatus} from './integrations/asten';

const source=await readFile('server.ts','utf8');
const start=source.indexOf('  const repositoryReopenLocks=new Set<string>();');
const end=source.indexOf("  app.post('/api/admin/processes/:id/publication/withdraw'",start);
const routes=source.slice(start,end);
const now='2026-11-07T12:00:00Z';
function fixture(){
 const p:any={id:'repository-consent-fixture',protocolo:'TCC-2026-0001',titulo:'Trabalho fictício',dataRevision:10,status:'AGUARDANDO_ASSINATURA',etapaAtual:'ASSINATURA',createdAt:now,updatedAt:now,
  aluno1:{nome:'Autora fictícia',email:'author@example.invalid'},aluno2:null,orientador:{nome:'Orientador fictício',email:'advisor@example.invalid'},banca:[],
  avaliacao:{status:'CONCLUIDO',documentRevision:9,submittedAt:now},
  acervo:{submittedAt:now,submittedBy:'author@example.invalid',authorizationConfirmedAt:now,publicationRequestedAt:now,publishFullWork:true,publishExpandedAbstract:true,isPublic:true,
   trabalhoCompletoFileId:'private-work-fixture',trabalhoCompletoFileUrl:'/api/source/private-work-fixture',trabalhoCompletoSha256:'a'.repeat(64),trabalhoCompletoVersion:1,trabalhoCompletoFileName:'Trabalho.pdf',
   resumoExpandidoFileId:'private-abstract-fixture',resumoExpandidoSha256:'b'.repeat(64),resumoExpandidoVersion:1,resumoExpandidoFileName:'Resumo.pdf',palavrasChave:['a','b','c','d','e'],resumoSintese:'Resumo fictício preservado.'},
  astenSignatureIntent:{documentType:'TERMO',revision:10,queuedAt:now},signatureProviderPreferences:{TERMO:'ASTEN'}};
 const common={processId:p.id,protocol:p.protocolo,documentVersion:1,createdAt:now,updatedAt:now,createdBy:p.aluno1.email,idempotencyKey:'c'.repeat(64),contentSha256:'d'.repeat(64),fileName:'Documento.pdf',provider:'ASTEN'};
 const jobs:any[]=[{...common,id:'ata-archived-fixture',documentType:'ATA',sourceDataRevision:9,status:'ARCHIVED',driveUnsignedFileId:'private-ata-unsigned-fixture',driveSignedFileId:'private-ata-signed-fixture',
  signers:[{email:'advisor@example.invalid',name:'Orientador fictício',role:'ADVISOR',status:'SIGNED'},{email:'one@example.invalid',name:'Examinador fictício1',role:'EXAMINER',status:'SIGNED'},{email:'two@example.invalid',name:'Examinador fictício2',role:'EXAMINER',status:'SIGNED'}]},
  {...common,id:'term-queued-fixture',documentType:'TERMO',sourceDataRevision:10,status:'QUEUED',driveUnsignedFileId:'private-term-fixture',idempotencyKey:'e'.repeat(64),signers:[]}];
 return {p,jobs};
}
function harness(p:any,jobs:any[],persist:()=>Promise<void>,options:{durable?:boolean;read?:()=>Promise<any>}={}){
 const handlers=new Map<string,(req:any,res:any)=>Promise<void>>();
 const background:Promise<unknown>[]=[];
 const calls={automatic:0,queued:0,external:0};
 let role='STUDENT',access=true;
 const context:any={Date,Set,Error,structuredClone,setImmediate,process:{env:{VERCEL:'fixture'}},waitUntil:(task:Promise<unknown>)=>background.push(task),beginRuntimeRequestTask:()=>()=>{},processesStore:[p],signatureJobsStore:jobs,auditLogsStore:[],requireAuthenticated:'authenticated',remotePersistenceQueue:Promise.resolve(),settlePreviousRuntimeWrites,
  getSupabaseRuntimeStatus:()=>({durablePersistenceReady:options.durable===true}),loadPortalRuntimeState:options.read||(async()=>{throw Error('Read not configured');}),applyPersistedState:(remote:any)=>{context.processesStore=structuredClone(remote.processes);context.signatureJobsStore=structuredClone(remote.signatureJobs||[]);context.auditLogsStore=structuredClone(remote.auditLogs||[]);if(remote.access===false)access=false;},inferAstenJobStatus,
  app:{post:(path:string,auth:unknown,handler:any)=>{assert.equal(auth,'authenticated');handlers.set(path,handler);}},getPortalIdentity:()=>({email:p.aluno1.email}),canAccessProcess:()=>access,getActiveProcessRoles:()=>[role],getUserRolesForEmail:()=>({globalRoles:[],memberships:[{roles:[role]}]}),documentSignatureCompleted,ataArchived,declarationReady,
  getPersistentAstenConnection:async()=>{calls.external++;throw Error('External call forbidden in this fixture');},callAsten:async()=>{calls.external++;throw Error('External call forbidden in this fixture');},persistPortalStateDurably:async()=>{const pending=persist();context.remotePersistenceQueue=pending;await pending;},
  missingDocumentModels:()=>[],signatureDocumentRevision,queueAutomaticAsten:(process:any,type:string)=>{calls.queued++;process.astenSignatureIntent={documentType:type,revision:signatureDocumentRevision(process,type),queuedAt:now};},executeConfiguredWorkflowEvent:async()=>({status:'COMPLETED',actions:[]}),executeAutomaticAsten:async()=>{calls.automatic++;},updateProcessCompletion:()=>{},};
 runInNewContext(ts.transpileModule(routes,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,context);
 return {context,calls,finishBackground:()=>Promise.all(background),setRole:(value:string)=>{role=value;},setAccess:(value:boolean)=>{access=value;},request:async(path:string,body:any={reason:'Correção dos arquivos da entrega'})=>{
  const res={code:200,body:undefined as any,status(code:number){this.code=code;return this;},json(value:any){this.body=value;return this;}};
  await handlers.get(path)!({params:{id:p.id},body},res);return res;
 }};
}
test('reabrir entrega renova consentimento sem SQL23514 e só nova confirmação enfileira TERMO',async()=>{
 const {p,jobs}=fixture(),db=new PGlite({extensions:{pgcrypto}});
 try{
  await db.exec('create role anon; create role authenticated; create role service_role; create schema auth; create function auth.uid() returns uuid language sql as $$select null::uuid$$;');
  for(const migration of ['202608270001_portal_producao','202608290001_portal_normalized_core','202608310001_portal_transactional_runtime','202609010001_portal_governance_v4','20260911102237_portal_author_access_trigger_fix','20260911183500_portal_publication_security_v8','202609190001_portal_publication_projection_requested_at_fix_v12'])await db.exec(await readFile(`supabase/migrations/${migration}.sql`,'utf8'));
  await db.exec("alter table portal_signature_signers drop constraint portal_signature_signers_signer_role_check; alter table portal_signature_signers add constraint portal_signature_signers_signer_role_check check(signer_role in ('STUDENT','ADVISOR','COMMISSION_PRESIDENT','EXAMINER'))");
  let revision=0;
  const payload=(process=p)=>({processes:[process],signatureJobs:jobs,settings:{masterEmail:'master@example.invalid',commissionPresidentEmail:'president@example.invalid'}});
  const commit=async(value:unknown)=>{await db.query('select portal_commit_runtime_state($1,$2::jsonb)',[revision,JSON.stringify(value)]);revision++;};
  await commit(payload());
  const broken=structuredClone(p);delete broken.acervo.authorizationConfirmedAt;delete broken.acervo.publicationRequestedAt;delete broken.acervo.submittedAt;broken.acervo.isPublic=false;
  await assert.rejects(commit(payload(broken)),/portal_publication_explicit_consent_check/,'old reopen kept publish=true while removing its consent');
  const beforeFiles=JSON.stringify({work:p.acervo.trabalhoCompletoFileId,workHash:p.acervo.trabalhoCompletoSha256,abstract:p.acervo.resumoExpandidoFileId,abstractHash:p.acervo.resumoExpandidoSha256,ata:p.avaliacao,job:jobs[0]});
  const h=harness(p,jobs,()=>commit(payload(h.context.processesStore[0])));
  const response=await h.request('/api/processes/:id/repository/reopen');
  assert.equal(response.code,200);assert.equal(revision,2);
  assert.equal(p.acervo.publishFullWork,false);assert.equal(p.acervo.publishExpandedAbstract,false);assert.equal(p.acervo.authorizationConfirmedAt,undefined);assert.equal(p.acervo.submittedAt,undefined);assert.equal(p.acervo.firstSubmittedAt,now);
  assert.equal(p.astenSignatureIntent,undefined);assert.equal(p.dataRevision,11);assert.equal(jobs[1].status,'CANCELED');
  assert.equal(JSON.stringify({work:p.acervo.trabalhoCompletoFileId,workHash:p.acervo.trabalhoCompletoSha256,abstract:p.acervo.resumoExpandidoFileId,abstractHash:p.acervo.resumoExpandidoSha256,ata:p.avaliacao,job:jobs[0]}),beforeFiles);
  assert.equal(h.calls.automatic,0);assert.equal(h.calls.queued,0);assert.equal(h.calls.external,0);
  assert.equal((await db.query<{status:string}>('select status from portal_publications')).rows[0].status,'PRIVATE');
  assert.equal(h.context.auditLogsStore[0].before.publishFullWork,true);assert.equal(h.context.auditLogsStore[0].after.publishFullWork,false);
  assert.equal((await h.request('/api/processes/:id/repository/reopen')).code,200);assert.equal(revision,2,'repeated reopen is idempotent');
  const submitted=await h.request('/api/processes/:id/final-data',{palavrasChave:['a','b','c','d','e'],resumoSintese:'Resumo fictício revisado.',publishFullWork:true,publishExpandedAbstract:false});
  assert.equal(submitted.code,202);await h.finishBackground();const current=h.context.processesStore[0];
  assert.equal(current.dataRevision,12);assert.equal(current.acervo.publishFullWork,true);assert.ok(current.acervo.authorizationConfirmedAt);assert.equal(current.astenSignatureIntent.revision,12);assert.equal(h.calls.queued,1);assert.equal(h.calls.automatic,1);assert.equal(h.calls.external,0);
 }finally{await db.close();}
});
test('reabrir continua exclusivo dos autores e bloqueado por conclusão/declaração assinada',async()=>{
 for(const blocker of ['access','role','completed','declaration'] as const){
  const {p,jobs}=fixture();let commits=0;const h=harness(p,jobs,async()=>{commits++;});
  if(blocker==='access')h.setAccess(false);
  if(blocker==='role')h.setRole('ADVISOR');
  if(blocker==='completed')p.status='CONCLUIDO';
  if(blocker==='declaration')jobs.push({...jobs[1],id:'signed-declaration',documentType:'DECLARACAO',status:'ARCHIVED'});
  const before=JSON.stringify(p),response=await h.request('/api/processes/:id/repository/reopen');
  assert.equal(response.code,blocker==='access'?404:blocker==='role'?403:409);assert.equal(commits,0);assert.equal(JSON.stringify(p),before);assert.equal(h.calls.external,0);
 }
});
for(const mode of ['confirmed','unchanged','read-failed','newer','revoked'] as const)test(`falha de confirmação ${mode}: um commit, readback autoritativo, sem replay`,async()=>{
 const {p,jobs}=fixture();const before={processes:[structuredClone(p)],signatureJobs:structuredClone(jobs),auditLogs:[]};
 let commits=0,reads=0,remote:any=before;
 const h=harness(p,jobs,async()=>{
  commits++;
  if(mode==='confirmed'||mode==='revoked')remote={processes:structuredClone(h.context.processesStore),signatureJobs:structuredClone(h.context.signatureJobsStore),auditLogs:structuredClone(h.context.auditLogsStore),...(mode==='revoked'?{access:false}:{})};
  if(mode==='newer')remote={...before,processes:[{...before.processes[0],dataRevision:20,titulo:'Alteração concorrente preservada'}]};
  throw Error('ACK unconfirmed');
 },{durable:true,read:async()=>{reads++;if(mode==='read-failed')throw Error('Read unavailable');return remote;}});
 const response=await h.request('/api/processes/:id/repository/reopen');
 assert.equal(commits,1);assert.equal(reads,1);assert.equal(response.code,mode==='confirmed'?200:503);
 if(mode==='read-failed')await assert.rejects(h.context.remotePersistenceQueue,/ACK/);
 else await h.context.remotePersistenceQueue;
 if(mode==='confirmed')assert.equal(response.body.dataRevision,11);
 if(mode==='unchanged')assert.equal(h.context.processesStore[0].dataRevision,10);
 if(mode==='newer')assert.equal(h.context.processesStore[0].titulo,'Alteração concorrente preservada');
 if(mode!=='confirmed')assert.equal(response.body.code,'REPOSITORY_REOPEN_NOT_CONFIRMED');
 assert.equal(h.calls.external,0);assert.equal(h.calls.automatic,0);
});
test('falha local restaura só os registros desta tentativa, sem segundo salvamento',async()=>{
 const {p,jobs}=fixture();const before=JSON.stringify({p,jobs});let commits=0;
 const h=harness(p,jobs,async()=>{commits++;throw Error('Local write failed');});
 const response=await h.request('/api/processes/:id/repository/reopen');
 assert.equal(response.code,503);assert.equal(commits,1);
 assert.equal(JSON.stringify({p:h.context.processesStore[0],jobs:h.context.signatureJobsStore}),before);assert.deepEqual(h.context.auditLogsStore,[]);
});
test('TERMO assinado fica no histórico e perde validade corrente após reabrir, sem apagar PDF',async()=>{
 const {p,jobs}=fixture();Object.assign(jobs[1],{status:'ARCHIVED',driveSignedFileId:'signed-historical-term',signedSha256:'f'.repeat(64),providerEnvelopeId:'historical-signed-envelope'});
 const oldTerm=structuredClone(jobs[1]);let commits=0;const h=harness(p,jobs,async()=>{commits++;});
 const response=await h.request('/api/processes/:id/repository/reopen');
 assert.equal(response.code,200);assert.equal(commits,1);assert.deepEqual(jobs[1],oldTerm);assert.equal(h.calls.external,0);
 assert.equal(signatureJobMatchesCurrentRevision(p,jobs[1]),false);assert.equal(declarationReady(p,jobs),false);assert.equal(publicFileAuthorized(p,jobs,'trabalho-completo'),false);assert.equal(finalDocumentFilesLocked(p,jobs),false);assert.equal(ataArchived(p,jobs),true);
});
test('motivo é obrigatório e segue para o cancelamento ASTEN e para a auditoria',async()=>{
 const {p,jobs}=fixture();Object.assign(jobs[1],{status:'SENT',providerEnvelopeId:'5353'});
 let commits=0,cancels=0;const h=harness(p,jobs,async()=>{commits++;});
 for(const reason of [undefined,'','curto',' '.repeat(15),'x'.repeat(1001)]){
  const response=await h.request('/api/processes/:id/repository/reopen',{reason});
  assert.equal(response.code,400);assert.equal(response.body.code,'REOPEN_REASON_REQUIRED');
 }
 assert.equal(commits,0);assert.equal(h.calls.external,0);assert.ok(p.acervo.submittedAt);
 h.context.getPersistentAstenConnection=async()=>({token:'fixture-only'});
 h.context.callAsten=async(method:string,body:any)=>{
  if(method==='cancelarEnvelope'){cancels++;assert.equal(body.idEnvelope,'5353');assert.equal(body.motivo,'Correção dos arquivos da entrega');assert.equal(body.anularAssinaturas,'N');return {};}
  assert.equal(method,'getDadosEnvelope');return {Envelope:{id:'5353',status:cancels?5:1}};
 };
 const response=await h.request('/api/processes/:id/repository/reopen',{reason:'  Correção dos arquivos da entrega  '});
 assert.equal(response.code,200,JSON.stringify(response.body));assert.equal(cancels,1);assert.equal(commits,1);
 assert.equal(h.context.auditLogsStore[0].after.reopenReason,'Correção dos arquivos da entrega');
});
for(const status of [3,5])test(`consulta ASTEN antes de cancelar protege estado remoto ${status}`,async()=>{
 const {p,jobs}=fixture();Object.assign(jobs[1],{status:'SENT',providerEnvelopeId:'5353'});
 let commits=0,cancels=0,reads=0;const h=harness(p,jobs,async()=>{commits++;});
 h.context.getPersistentAstenConnection=async()=>({token:'fixture-only'});
 h.context.callAsten=async(method:string)=>{if(method==='cancelarEnvelope'){cancels++;throw Error('Cancellation must not repeat');}assert.equal(method,'getDadosEnvelope');reads++;return {Envelope:{id:'5353',status}};};
 const response=await h.request('/api/processes/:id/repository/reopen');
 assert.equal(cancels,0);assert.equal(reads,1);assert.equal(response.code,status===5?200:409,JSON.stringify(response.body));assert.equal(commits,status===5?1:0);
 if(status===3)assert.match(response.body.error,/foi assinado/);
});
