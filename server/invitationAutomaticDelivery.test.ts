import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';
import {DEMO_PROCESSES} from '../src/services/demoSeed';
import {selectConfirmedInvitationRecovery} from './workflow/confirmedInvitationRecovery';
import {REPOSITORY_DELIVERY_EMAIL_ID} from '../src/utils/repositoryDeliveryEmail';
import {confirmedInvitationDelivery} from './workflow/invitationDelivery';
import {operationalEmailRecipients,invitationEmailCopies} from './workflow/operationalEmailRecipients';
import {dispatchTrackedEmail} from './integrations/trackedGmail';
import {buildGmailRawMessage} from './integrations/googleWorkspace';
import {processEmailMessage} from '../src/utils/processEmailMessage';
import {buildProcessVariables} from './workflow/runtime';
import {hasPersonalEmailAccess} from './integrations/emailAuditCopy';
import {processEmailApplicable,isConsolidatedEmailNotice} from '../src/utils/consolidatedEmailNotifications';
import {isReservationDecisionEmail} from '../src/utils/studioOperationalCatalog';

function fixture(){
 const p=structuredClone(DEMO_PROCESSES[0]);p.aluno2={...p.aluno1,nome:'Segundo autor',email:'second-author@invitation.invalid'};p.dataRevision=4;p.defesa.reservationRevision=1;
 const to=operationalEmailRecipients('email-convite',p,'',[]),cc=invitationEmailCopies(p);
 const mail:any={id:'invitation-mail',processId:p.id,templateId:'email-convite',status:'ACCEPTED_BY_GMAIL',sourceDataRevision:4,workflowEventVariables:{RESERVATION_REVISION:'1'},recipient:to[0],additionalRecipients:to.slice(1),cc,attempts:[{status:'ACCEPTED_BY_GMAIL',gmailMessageId:'provider-message'}]};
 const run:any={eventCode:'LOCATION_CONFIRMED',processId:p.id,sourceDataRevision:4,status:'COMPLETED',actions:[{kind:'DOCUMENT',status:'COMPLETED',externalId:'file'},{kind:'EMAIL',status:'COMPLETED',externalId:mail.id}]};
 return{p,to,cc,mail,run};
}

test('invitation gate requires the current provider acknowledgement, both direct examiners and participant copies',()=>{
 const f=fixture();assert.equal(confirmedInvitationDelivery(f.p,f.run,[f.mail]),f.mail);
 for(const mutate of [(m:any)=>m.status='RETRY',(m:any)=>m.dispatchState='UNCERTAIN',(m:any)=>m.templateId='email-comprovante-reserva',(m:any)=>m.sourceDataRevision=3,(m:any)=>m.workflowEventVariables.RESERVATION_REVISION='0',(m:any)=>m.attempts=[],(m:any)=>m.additionalRecipients=[],(m:any)=>m.additionalRecipients.push(f.p.aluno1.email),(m:any)=>m.cc=[]]){
  const changed=structuredClone(f.mail);mutate(changed);assert.equal(confirmedInvitationDelivery(f.p,f.run,[changed]),undefined);
 }
 assert.equal(confirmedInvitationDelivery(f.p,{...f.run,actions:[f.run.actions[0]]},[f.mail]),undefined);
});

test('actual server invitation dispatch builds one MIME message with two To examiners, participant Cc and no duplicate on repeated execution',async()=>{
 const {p,to,cc}=fixture(),master='master@invitation.invalid';
 const journal=new Map<string,any>(),raw:string[]=[];
 const server=readFileSync('server.ts','utf8'),start=server.indexOf('async function sendTrackedPortalEmail('),source=server.slice(start,server.indexOf('\n}\n',start)+2);
 const send=runInNewContext(ts.transpileModule('('+source+')',{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,{
  selectedEmailAudience:()=>undefined,REPOSITORY_DELIVERY_EMAIL_ID,processEmailApplicable,isConsolidatedEmailNotice,normalizeEmail:(s:string)=>String(s||'').trim().toLowerCase(),operationalEmailRecipients,invitationEmailCopies,isReservationDecisionEmail,processEmailMessage,buildProcessVariables,hasPersonalEmailAccess,dispatchTrackedEmail,
  currentSettings:{masterEmail:master},emailAuditMailbox:()=>master,emailStudioWithPublicImages:()=>undefined,historicalStudioAnswers:()=>({}),configuredRoomReservationDepartmentEmail:()=> 'department@invitation.invalid',publicPortalBaseUrl:()=> 'https://portal.example.invalid',resolveInstallationProfile:()=>({courseName:'Enfermagem'}),operationalConfig:()=>({reservation:{locations:[]}}),isManagedDefenseLocation:()=>false,
  emailDeliveryJournal:{findByIdempotencyKey:async(key:string)=>journal.get(key)||null,save:async(record:any)=>{journal.set(record.idempotencyKey,structuredClone(record));}},
  sendGmailMessage:async(input:any)=>{raw.push(buildGmailRawMessage(input));return{id:'provider-message',threadId:'provider-thread'};}
 });
 const input={process:p,recipient:to[0],cc:[to[1]],templateId:'email-convite',workflowEventCode:'LOCATION_CONFIRMED',workflowEventVariables:{RESERVATION_REVISION:'1'},subject:'Convite',text:'Convite à banca',idempotencyKey:'invitation-fixture'};
 const sent=await send(input);assert.equal(sent.status,'ACCEPTED_BY_GMAIL');assert.equal(raw.length,1);
 const header=(name:string)=>raw[0].match(new RegExp('^'+name+': (.*)\\r?$','m'))?.[1].trim().split(/,\s*/)||[];
 assert.deepEqual(header('To').sort(),[...to].sort());assert.deepEqual(header('Cc').sort(),[...cc,master].sort());
 assert.ok(!header('To').includes(p.aluno1.email));assert.ok(!header('Cc').some(email=>to.includes(email)));
 await send(input);assert.equal(raw.length,1);
});


test('an acknowledged current invitation can finish a completed run after a lost final state write without another dispatch',()=>{
 const {p,run,mail}=fixture();delete p.defesa.invitationSentAt;p.status='AGUARDANDO_CONFIRMACAO_LOCAL';p.avaliacao={status:'PENDENTE'};p.defesa.localStatus='CONFIRMADO';p.defesa.departmentResponse={revision:1,decision:'CONFIRMED',respondedBy:'original@example.invalid'} as any;
 Object.assign(run,{eventCode:'LOCATION_CONFIRMED',studioRevision:8,actorEmail:'original@example.invalid',startedAt:'2026-11-07T12:00:00Z'});
 const archive:any={id:'archive',processId:p.id,formType:'CONFIRMACAO_LOCAL',version:4,reservationRevision:1,status:'ARCHIVED',updatedAt:'2026-11-07T12:00:00Z'};
 const input={processes:[p],runs:[run],archives:[archive],emails:[mail],signatures:[],studioRevision:8};
 assert.equal(selectConfirmedInvitationRecovery(input)?.run,run);
 mail.dispatchState='UNCERTAIN';assert.equal(selectConfirmedInvitationRecovery(input),undefined);
});

test('configured invitation audience accepts additional direct President but still requires both examiners and exact operational copies',()=>{
 const f=fixture(),president='president@invitation.invalid';
 const audience={to:[...f.to,president,president],cc:[f.p.aluno1.email]};
 f.mail.additionalRecipients.push(president);f.mail.workflowCc=[f.p.aluno1.email];f.mail.cc=[f.p.aluno1.email,'audit@invitation.invalid'];
 assert.equal(confirmedInvitationDelivery(f.p,f.run,[f.mail],audience),f.mail,'audit-only copy is separate from exact operational Cc');
 const missing=structuredClone(f.mail);missing.additionalRecipients=missing.additionalRecipients.filter((email:string)=>email!==f.to[1]);
 assert.equal(confirmedInvitationDelivery(f.p,f.run,[missing],audience),undefined);
 assert.equal(confirmedInvitationDelivery(f.p,f.run,[f.mail],{to:[president],cc:audience.cc}),undefined);
 assert.equal(confirmedInvitationDelivery(f.p,f.run,[f.mail],{...audience,cc:[]}),undefined);
 const wrong=structuredClone(f.mail);wrong.workflowCc.push(f.p.orientador.email);assert.equal(confirmedInvitationDelivery(f.p,f.run,[wrong],audience),undefined);
});

test('automatic recovery recognizes acknowledged configured To/Cc without dispatching again',()=>{
 const {p,run,mail,to}=fixture(),president='president@invitation.invalid';delete p.defesa.invitationSentAt;p.status='AGUARDANDO_CONFIRMACAO_LOCAL';p.avaliacao={status:'PENDENTE'};p.defesa.localStatus='CONFIRMADO';p.defesa.departmentResponse={revision:1,decision:'CONFIRMED',respondedBy:'original@example.invalid'} as any;
 Object.assign(run,{studioRevision:8,actorEmail:'original@example.invalid',startedAt:'2026-11-07T12:00:00Z'});
 mail.additionalRecipients.push(president);mail.workflowCc=[p.aluno1.email,p.aluno2!.email];mail.cc=[...mail.workflowCc,'audit@invitation.invalid'];
 const archive:any={id:'archive',processId:p.id,formType:'CONFIRMACAO_LOCAL',version:4,reservationRevision:1,status:'ARCHIVED',updatedAt:'2026-11-07T12:00:00Z'};
 const input={processes:[p],runs:[run],archives:[archive],emails:[mail],signatures:[],studioRevision:8,presidentEmail:president,studio:{emailTemplates:[{id:'email-convite',recipientRoles:['EXAMINERS','COMMISSION_PRESIDENT'],ccRoles:['AUTHORS']}]} as any};
 assert.equal(selectConfirmedInvitationRecovery(input)?.run,run);
 mail.additionalRecipients=mail.additionalRecipients.filter((email:string)=>email!==to[1]);assert.equal(selectConfirmedInvitationRecovery(input),undefined);
});
