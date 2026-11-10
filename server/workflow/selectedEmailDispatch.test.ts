import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';
import {configuredEmailAudience} from '../../src/utils/emailRecipientRoles';
import {studioSampleProcess} from '../../src/utils/studioRuntimePreview';
const source=readFileSync('server.ts','utf8');
const start=source.indexOf('async function sendTrackedPortalEmail('),end=source.indexOf('async function notifyReservationResponse',start);
const compile=(text:string)=>ts.transpileModule(text,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
const president='president@example.invalid',responsible='room@example.invalid';
for(const id of ['email-reserva','email-reserva-autores','email-comprovante-reserva','email-local-indisponivel','email-convite','email-entrega-repositorio','email-assinatura-termo','email-conclusao'])test(`actual dispatch ${id} honors selected direct and copied roles without changing decision-link scope`,async()=>{
 const process={...studioSampleProcess(),status:'CONCLUIDO',avaliacao:{status:'CONCLUIDO'}} as any;
 process.defesa.departmentResponse={revision:0,decision:id==='email-local-indisponivel'?'UNAVAILABLE':'CONFIRMED',respondedBy:responsible};
 const roles=id==='email-reserva'?['RESERVATION_RESPONSIBLE']:id==='email-convite'?['EXAMINERS','COMMISSION_PRESIDENT']:['COMMISSION_PRESIDENT'];
 const template={id,recipientRoles:roles,ccRoles:id==='email-reserva'?[]:['AUTHORS']};
 const participantTemplate={id:'email-reserva-autores',recipientRoles:['AUTHORS'],ccRoles:[]};
 const settings={masterEmail:'master@example.invalid',commissionPresidentEmail:president,integrationStudio:{emailTemplates:[template,...(id==='email-reserva'?[participantTemplate]:[])]}};
 const finalTo=[process.aluno1.email,process.aluno2.email,process.orientador.email,...process.banca.map((person:any)=>person.email),president];
 const sent:any[]=[];
 const context:any={Buffer,currentSettings:settings,processEmailApplicable:()=>true,isConsolidatedEmailNotice:()=>false,normalizeEmail:(value:string)=>value.trim().toLowerCase(),reservationApproverEmail:()=>responsible,reservationCopies:()=>[process.aluno1.email,process.orientador.email],selectedEmailAudience:(p:any,tid:string)=>tid==='email-conclusao'?{to:finalTo,cc:[]}:configuredEmailAudience(settings.integrationStudio.emailTemplates.find((item:any)=>item.id===tid),p,responsible,president),operationalEmailRecipients:()=>process.banca.map((person:any)=>person.email),invitationEmailCopies:()=>[process.aluno1.email],isReservationDecisionEmail:(tid:string)=>['email-comprovante-reserva','email-local-indisponivel'].includes(tid),currentReservationReceiptRecipients:()=>[responsible,process.aluno1.email,process.orientador.email],emailAuditMailbox:()=>undefined,processEmailMessage:(input:any)=>({subject:input.subject,text:'fixture',html:input.departmentUrl?'personal-action-link':'informative'}),publicPortalBaseUrl:()=>'',resolveInstallationProfile:()=>({courseName:'Fixture'}),emailStudioWithPublicImages:()=>settings.integrationStudio,buildProcessVariables:()=>({}),historicalStudioAnswers:()=>({}),configuredRoomReservationDepartmentEmail:()=>responsible,isManagedDefenseLocation:()=>true,operationalConfig:()=>({reservation:{locations:[]}}),departmentReservationUrl:()=>'/api/reservation-confirmation/personal',hasPersonalEmailAccess:(_text:string,html:string)=>html==='personal-action-link',emailDeliveriesStore:[{processId:process.id,templateId:'email-reserva',recipient:responsible,status:'ACCEPTED_BY_GMAIL',workflowEventVariables:{RESERVATION_REVISION:0},attempts:[{status:'ACCEPTED_BY_GMAIL',gmailThreadId:'thread'}],rfcMessageId:'message',subject:'Request'}],createReservationReceiptPdf:async()=>Buffer.from('fixture'),dispatchTrackedEmail:async(input:any)=>{sent.push(input);return{id:'fixture',status:'ACCEPTED_BY_GMAIL'};},sendGmailMessage:()=>{},emailDeliveryJournal:{},finalProcessEmailKey:()=>id,REPOSITORY_DELIVERY_EMAIL_ID:'email-entrega-repositorio',repositoryDeliveryEmailKey:()=>id};
 const send=runInNewContext(compile(`${source.slice(start,end)};sendTrackedPortalEmail`),context);
 await send({process,recipient:id==='email-reserva'?responsible:president,templateId:id,subject:'Fixture',text:'Fixture',idempotencyKey:'fixture-'+id});
 const first=sent[0];
 if(id==='email-conclusao'){
  assert.equal(sent.length,1);
  assert.deepEqual([...new Set([first.recipient,...first.additionalRecipients])],finalTo);
  assert.deepEqual([...first.cc],[]);
  assert.equal(first.idempotencyKey,id);
  return;
 }
 assert.equal(first.recipient,id==='email-reserva'?responsible:id==='email-convite'?process.banca[0].email:president);
 if(id==='email-reserva'){assert.equal(first.html,'personal-action-link');assert.deepEqual([...first.additionalRecipients],[]);assert.deepEqual([...first.cc],[]);assert.equal(sent.length,2);assert.equal(sent[1].html,'informative');assert.equal(sent[1].templateId,'email-reserva-autores');}
 else{assert.deepEqual(first.cc,[process.aluno1.email,process.aluno2.email]);assert.ok(first.additionalRecipients.includes(president));assert.equal(first.html,'informative');}
});
