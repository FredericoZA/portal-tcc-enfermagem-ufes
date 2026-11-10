import test from 'node:test';import assert from 'node:assert/strict';
import express from 'express';import {readFileSync} from 'node:fs';import {runInNewContext} from 'node:vm';import ts from 'typescript';
import {createHmac} from 'node:crypto';
import {attachPortalIdentity,createPortalIdentity,getPortalIdentity,requireAuthenticated} from './security/firebaseAuth';
import {communicationCopyBlocker,sendConsciousCommunicationCopy} from './workflow/emailCommunicationCopy';
import {dispatchTrackedEmail,initialEmailDelivery,dueEmailRetries} from './integrations/trackedGmail';
import {emailDeliveryAuditSummary,buildAuditFeed} from './auditFeed';
import {operationalEmailRetryBlocker} from './workflow/emailRetryEligibility';
import {normalizeEmail} from '../src/utils/formatters';
import type {EmailDeliveryRecord} from '../src/types/automation';
const source=readFileSync('server.ts','utf8');
function fn(name:string){const start=source.indexOf(`function ${name}(`);return source.slice(start,source.indexOf('\n}',start)+2);}
function original(){return {...initialEmailDelivery({processId:'fixture',protocol:'TCC - 00002',sourceDataRevision:4,studioRevision:7,templateId:'email-custom-notice',recipient:'author@example.invalid',additionalRecipients:['advisor@example.invalid'],workflowCc:[],subject:'Aviso fictício',text:'Consulte o processo em https://portal.example.invalid/?process=TCC-00002',html:'<p>Mensagem original</p>',idempotencyKey:'original'}),status:'ACCEPTED_BY_GMAIL' as const,acceptedAt:'2026-11-08T10:00:00Z'};}
const body={mode:'COMMUNICATION_COPY',checkedSentFolder:true,reason:'Conferi Enviados e solicito uma cópia.',operationId:'operation-fixture-00000001'};

test('HTTP Master autoriza cópia sem refazer evento; cookie real, idempotência e snapshot durável',async()=>{
 const keys=['NODE_ENV','VERCEL','PORTAL_SESSION_SECRET'];const previous=Object.fromEntries(keys.map(key=>[key,process.env[key]]));
 Object.assign(process.env,{NODE_ENV:'test',VERCEL:'',PORTAL_SESSION_SECRET:'copy-test-session-0123456789abcdefghijkl'});
 const app=express();app.use(express.json());app.use(attachPortalIdentity);let listener:ReturnType<typeof app.listen>|undefined;
 const initial:EmailDeliveryRecord=original();const originalSnapshot=structuredClone(initial);const deliveries:EmailDeliveryRecord[]=[initial];const audit:any[]=[];let sendCount=0,commits=0,failSend=false;
 const p:any={id:'fixture',protocolo:'TCC - 00002',dataRevision:4,defesa:{localStatus:'CONFIRMADO'},aluno1:{email:'author@example.invalid'},orientador:{email:'advisor@example.invalid'},banca:[]};let changedAudience=false;
 const journal={findByIdempotencyKey:async(key:string)=>structuredClone(deliveries.find(record=>record.idempotencyKey===key)||null),save:async(record:EmailDeliveryRecord)=>{const copy=structuredClone(record),index=deliveries.findIndex(item=>item.id===record.id);if(index>=0)deliveries[index]=copy;else deliveries.push(copy);commits++;}};
 const context:any={app,Date,Error,JSON,normalizeEmail,getPortalIdentity,requireAuthenticated,currentSettings:{integrationStudio:{revision:7}},getUserRolesForEmail:(email:string)=>({globalRoles:email==='master@example.invalid'?['MASTER_ADMIN']:[]}),emailDeliveriesStore:deliveries,processesStore:[p],signatureJobsStore:[],auditLogsStore:audit,
  selectedEmailAudience:()=>({to:changedAudience?['changed@example.invalid']:['author@example.invalid','advisor@example.invalid'],cc:[]}),operationalEmailRetryBlocker,isConsolidatedEmailNotice:()=>false,communicationCopyBlocker,sendConsciousCommunicationCopy,emailDeliveryAuditSummary,emailAuditMailbox:()=>undefined,emailDeliveryJournal:journal,persistPortalStateDurably:async()=>{commits++;},executeConfiguredWorkflowEvent:()=>assert.fail('A copy must never publish a workflow event'),
  sendGmailMessage:async(input:any)=>{sendCount++;assert.equal(input.to,initial.recipient);assert.deepEqual(input.additionalRecipients,initial.additionalRecipients);assert.deepEqual(input.cc,[]);assert.equal(input.text,initial.renderedText);assert.equal(input.html,initial.renderedHtml);assert.deepEqual(input.attachments,[]);assert.ok(deliveries.some(item=>item.communicationCopy?.sourceDeliveryId===initial.id&&item.dispatchState==='SENDING'),'claim and reason durable before provider call');if(failSend)throw Error('synthetic provider timeout');return{id:'gmail-fixture',threadId:'thread-fixture'};},
 };
 try{
  const admin=source.slice(source.indexOf('  const requireGlobalRoles='),source.indexOf('  const requirePresidencyOperator='));
  const start=source.indexOf("  app.post('/api/admin/email-deliveries/:id/retry'");const end=source.indexOf("  app.get('/api/admin/workflow/operations'",start);
  runInNewContext(ts.transpileModule(admin+'\n'+fn('currentEmailRetryBlocker')+'\n'+fn('currentEmailCommunicationCopyBlocker')+'\n'+source.slice(start,end),{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,context);
  listener=app.listen(0,'127.0.0.1');await new Promise<void>(resolve=>listener!.once('listening',resolve));const address=listener.address();assert.ok(address&&typeof address!=='string');const url=`http://127.0.0.1:${address.port}/api/admin/email-deliveries/${initial.id}/retry`;
  const cookie=(email:string)=>{const payload=Buffer.from(JSON.stringify(createPortalIdentity(email))).toString('base64url');return `portal_tcc_session=${payload}.${createHmac('sha256',process.env.PORTAL_SESSION_SECRET!).update(payload).digest('base64url')}`;};
  const request=(value:any=body,email='master@example.invalid')=>fetch(url,{method:'POST',headers:{'content-type':'application/json',...(email?{cookie:cookie(email)}:{})},body:JSON.stringify(value)});
  assert.equal((await request(body,'')).status,401);assert.equal((await request(body,'author@example.invalid')).status,403);assert.equal(sendCount,0);
  for(const value of [{...body,checkedSentFolder:false},{...body,reason:''},{...body,operationId:'x'}])assert.equal((await request(value)).status,400);
  changedAudience=true;assert.equal((await request()).status,409);changedAudience=false;
  p.dataRevision++;assert.equal((await request()).status,409);p.dataRevision--;
  initial.dispatchState='SENDING';initial.dispatchLeaseUntil=new Date(Date.now()+60_000).toISOString();assert.equal((await request()).status,409);delete initial.dispatchState;delete initial.dispatchLeaseUntil;
  const first=await request();assert.equal(first.status,200,await first.clone().text());const copied=await first.json();assert.equal(copied.sourceDeliveryId,initial.id);assert.notEqual(copied.id,initial.id);assert.equal(copied.status,'ACCEPTED_BY_GMAIL');assert.equal(copied.templateId,'communication-copy:email-custom-notice');assert.equal(deliveries.find(item=>item.id===copied.id)?.workflowEventCode,undefined);
  assert.equal((await request()).status,200);assert.equal(sendCount,1);assert.deepEqual(initial,originalSnapshot);assert.equal(audit.length,1);assert.ok(commits>=3);
  assert.equal((await request({...body,reason:'Outro motivo informado na mesma operação.'})).status,409);
  assert.equal((await request({...body,operationId:'operation-fixture-00000002'})).status,429);
  // A later explicit operation against an uncertain original has its own single-use key.
  deliveries.find(item=>item.id===copied.id)!.communicationCopy!.confirmedAt='2000-01-01T00:00:00Z';
  initial.status='FAILED';initial.dispatchState='UNCERTAIN';failSend=true;
  const uncertainBody={...body,operationId:'operation-fixture-uncertain01'};
  const uncertain=await request(uncertainBody);assert.equal(uncertain.status,200);const pending=await uncertain.json();assert.equal(pending.dispatchState,'UNCERTAIN');
  assert.equal((await request(uncertainBody)).status,200);assert.equal(sendCount,2);assert.equal(audit.length,2);assert.equal(initial.dispatchState,'UNCERTAIN');assert.equal(dueEmailRetries(deliveries).length,0);
 }finally{if(listener)await new Promise<void>((resolve,reject)=>listener!.close(error=>error?reject(error):resolve()));for(const key of keys){if(previous[key]===undefined)delete process.env[key];else process.env[key]=previous[key];}}
});

test('cópia bloqueia conteúdo pessoal, anexos sem prova, anexos presentes e cópia de outra cópia',async()=>{
 for(const patch of [{auditCopyMode:'sensitive'},{renderedText:'Código de acesso: 123456'},{renderedText:'https://portal.invalid/api/reservation-confirmation/personal-token'},{attachmentManifest:undefined},{attachmentManifest:[{fileName:'ata.pdf',mimeType:'application/pdf',sha256:'a'.repeat(64),byteLength:123}]},{communicationCopy:{sourceDeliveryId:'other'}}])assert.ok(communicationCopyBlocker({...original(),...patch} as any));
 const record=initialEmailDelivery({recipient:'x@example.invalid',subject:'Anexo',text:'PDF',attachments:[{fileName:'documento.pdf',mimeType:'application/pdf',content:Buffer.from('pdf-bytes')} ]});assert.equal(record.attachmentManifest?.length,1);assert.equal(record.attachmentManifest?.[0].byteLength,9);assert.doesNotMatch(JSON.stringify(record.attachmentManifest),/pdf-bytes|base64/);
});
