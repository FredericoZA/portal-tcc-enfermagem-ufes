import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {runInNewContext} from 'node:vm';import ts from 'typescript';import {randomBytes} from 'node:crypto';import {confirmedInvitationDelivery} from './workflow/invitationDelivery';import {currentReservationArchive,hasStableInvitationRecoveryIdentity} from './workflow/confirmedInvitationRecovery';
function actual(name:string,ports:any){ports={selectedEmailAudience:()=>undefined,confirmedInvitationDelivery,randomBytes,emailDeliveriesStore:[],auditLogsStore:[],getUserRolesForEmail:()=>({globalRoles:[]}),reservationReceiptStatus:()=> 'CONFIRMADO',...ports};if(name!=='finalizeConfirmedInvitation'&&!ports.finalizeConfirmedInvitation)ports.finalizeConfirmedInvitation=actual('finalizeConfirmedInvitation',ports);const server=readFileSync('server.ts','utf8'),start=server.indexOf(`async function ${name}(`);assert.ok(start>=0);const source=server.slice(start,server.indexOf('\n}\n',start)+2);return runInNewContext(ts.transpileModule('('+source+')',{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,ports);}
function fixture(){
 const p:any={id:'p',protocolo:'TCC - 00003',dataRevision:4,aluno1:{email:'author@example.invalid'},aluno2:null,orientador:{email:'advisor@example.invalid'},banca:[{funcao:'EXAMINADOR',nome:'Exam One',email:'exam1@example.invalid'},{funcao:'EXAMINADOR',nome:'Exam Two',email:'exam2@example.invalid'}],avaliacao:{status:'PENDENTE'},defesa:{reservationRevision:1,invitationDriveFileId:'existing-invitation-id',localStatus:'CONFIRMADO'}};
 const run:any={id:'original',processId:p.id,eventCode:'LOCATION_CONFIRMED',sourceDataRevision:4,studioRevision:8,actorEmail:'original@example.invalid',eventVariables:{RESERVATION_REVISION:'1'},startedAt:'2026-11-07',actions:[{kind:'DOCUMENT',status:'FAILED'}],status:'PARTIAL_FAILURE'};
 const deliveries=[{id:'mail',recipient:'exam1@example.invalid',additionalRecipients:['exam2@example.invalid'],cc:['author@example.invalid','advisor@example.invalid'],status:'ACCEPTED_BY_GMAIL',processId:p.id,templateId:'email-convite',sourceDataRevision:4,workflowEventVariables:{RESERVATION_REVISION:'1'},attempts:[{status:'ACCEPTED_BY_GMAIL',gmailMessageId:'provider-id',completedAt:'2026-11-07T18:00:00Z'}]}];
 return {p,run,deliveries};
}
test('existing native form retry resumes the same actor, variables and action context, and records both To examiners',async()=>{
 const {p,run,deliveries}=fixture();let writes=0;const events:any[]=[];
 const resume=actual('resumeWorkflowAfterNativeFormArchive',{Date,currentReservationArchive,hasStableInvitationRecoveryIdentity,formArchiveJobsStore:[{processId:p.id,formType:'CONFIRMACAO_LOCAL',version:4,reservationRevision:1,status:'ARCHIVED'}],workflowRunsStore:[run],currentSettings:{integrationStudio:{revision:8}},reservationReceiptStatus:()=> 'CONFIRMADO',emailDeliveriesStore:deliveries,
  executeConfiguredWorkflowEvent:async(_p:any,event:string,actor:string,variables:any,prior:any)=>{events.push({event,actor,variables,prior});return{...run,status:'COMPLETED',actions:[{kind:'EMAIL',status:'COMPLETED',externalId:'mail'}]};},persistPortalStateDurably:async()=>{writes++;}});
 await resume(p,'CONFIRMACAO_LOCAL','master@example.invalid');
 assert.equal(events[0].actor,run.actorEmail);assert.equal(events[0].variables,run.eventVariables);assert.equal(events[0].prior,run);
 assert.deepEqual(Array.from(p.defesa.invitationRecipients),['exam1@example.invalid','exam2@example.invalid','author@example.invalid','advisor@example.invalid']);assert.ok(p.defesa.invitationSentAt);assert.equal(writes,1);
});
test('native form retry refuses changed context without dispatching any action',async()=>{
 const {p,run}=fixture();let effects=0;
 const resume=actual('resumeWorkflowAfterNativeFormArchive',{Date,currentReservationArchive,hasStableInvitationRecoveryIdentity,formArchiveJobsStore:[{processId:p.id,formType:'CONFIRMACAO_LOCAL',version:4,reservationRevision:1,status:'ARCHIVED'}],workflowRunsStore:[run],currentSettings:{integrationStudio:{revision:9}},reservationReceiptStatus:()=> 'CONFIRMADO',executeConfiguredWorkflowEvent:async()=>{effects++;}});
 await assert.rejects(resume(p,'CONFIRMACAO_LOCAL','master@example.invalid'),/configuração mudou/);assert.equal(effects,0);assert.equal(p.defesa.invitationSentAt,undefined);
});
test('initial reservation follow-up never sends the invitation before the current confirmation archive is durable',async()=>{
 const {p}=fixture();let events=0;
 const job:any={processId:p.id,formType:'CONFIRMACAO_LOCAL',status:'FAILED',version:4,reservationRevision:1};
 const finish=actual('finishConfirmedReservation',{Date,currentReservationArchive,hasStableInvitationRecoveryIdentity,formArchiveJobsStore:[job],executeConfiguredWorkflowEvent:async()=>{events++;return {status:'PARTIAL_FAILURE'};}});
 await finish(p,'original@example.invalid');assert.equal(events,0);
 job.status='ARCHIVED';job.reservationRevision=0;await finish(p,'original@example.invalid');assert.equal(events,0);
 job.reservationRevision=1;await finish(p,'original@example.invalid');assert.equal(events,1);assert.equal(p.defesa.invitationSentAt,undefined);
});

test('a failed receipt archive is reported as pending and cannot be treated as completed follow-up',async()=>{
 const {p}=fixture();let events=0;
 const complete=actual('completeReservationFollowup',{notifyReservationResponse:async()=>{},retryExistingFormArchiveJob:async()=>({status:'FAILED',lastError:'The operation was aborted due to timeout'}),finishConfirmedReservation:async()=>{events++;}});
 await assert.rejects(complete(p,'original@example.invalid',1,{id:'receipt'}),/timeout/);
 // The independent finish guard also protects explicit workflow retries.
 assert.equal(events,0);
});

test('legacy native retry with no action identity and no file pointer never executes workflow providers',async()=>{
 const {p,run}=fixture();delete p.defesa.invitationDriveFileId;p.driveFolderUrl='https://drive.google.com/new-folder';let effects=0;
 const resume=actual('resumeWorkflowAfterNativeFormArchive',{Date,currentReservationArchive,hasStableInvitationRecoveryIdentity,
  formArchiveJobsStore:[{processId:p.id,formType:'CONFIRMACAO_LOCAL',version:4,reservationRevision:1,status:'ARCHIVED'}],
  workflowRunsStore:[run],currentSettings:{integrationStudio:{revision:8}},reservationReceiptStatus:()=> 'CONFIRMADO',executeConfiguredWorkflowEvent:async()=>{effects++;}});
 await assert.rejects(resume(p,'CONFIRMACAO_LOCAL','master@example.invalid'),/identidade de arquivo confirmada/);assert.equal(effects,0);assert.equal(p.defesa.invitationSentAt,undefined);
});
test('recorded invitation pointer is passed to the verifier and mismatch never renders or uploads another file',async()=>{
 const {p}=fixture();let reads=0,writes=0;
 const create=actual('executeConfiguredDocumentAction',{configuredDocumentType:()=> 'CONVITE',assertSafeWorkflowDocumentEvent:()=>{},
  ensureWorkflowProcessFolder:async()=>({accessToken:'test-only',folderId:'private-folder'}),currentSettings:{driveRootFolderId:'private-root'},
  readExistingGeneratedInvitation:async(input:any)=>{reads++;assert.equal(input.expectedFileId,p.defesa.invitationDriveFileId);assert.equal(input.jobId,'workflow_original');throw Error('O convite existente não corresponde à revisão desta execução.');},
  renderOfficialTemplatePdf:async()=>{writes++;},uploadGeneratedPdfToDrive:async()=>{writes++;}});
 await assert.rejects(create(p,{},'original@example.invalid','original',{},'LOCATION_CONFIRMED'),/não corresponde/);assert.equal(reads,1);assert.equal(writes,0);
});


test('a completed document-only workflow never marks the invitation as sent without the current Gmail acknowledgement',async()=>{
 const {p,run,deliveries}=fixture();let writes=0;
 const ports={Date,currentReservationArchive,formArchiveJobsStore:[{processId:p.id,formType:'CONFIRMACAO_LOCAL',version:4,reservationRevision:1,status:'ARCHIVED'}],emailDeliveriesStore:deliveries,persistPortalStateDurably:async()=>{writes++;},executeConfiguredWorkflowEvent:async()=>{throw Error('No event without acknowledged invitation');}};
 const finish=actual('finalizeConfirmedInvitation',ports);
 for(const actions of [[{kind:'DOCUMENT',status:'COMPLETED',externalId:'file'}],[{kind:'EMAIL',status:'COMPLETED',externalId:'unknown'}]]){
  assert.equal(await finish(p,{...run,status:'COMPLETED',actions},'actor@example.invalid'),false);assert.equal(p.defesa.invitationSentAt,undefined);
 }
 const completed={...run,status:'COMPLETED',actions:[{kind:'EMAIL',status:'COMPLETED',externalId:'mail'}]};
 deliveries[0].status='RETRY';assert.equal(await finish(p,completed,'actor@example.invalid'),false);assert.equal(writes,0);
});

test('Master invitation retry is scoped to the current archived reservation and reports Gmail confirmation',async()=>{
 const {p,run}=fixture();
 const archive={id:'confirmation',processId:p.id,formType:'CONFIRMACAO_LOCAL',version:4,reservationRevision:1,status:'ARCHIVED'};
 let handler:any, calls=0, eligible=true, confirmed=false;
 const authenticated=()=>{},masterOnly=()=>{};
 const server=readFileSync('server.ts','utf8');
 const start=server.indexOf("  app.post('/api/admin/workflow/invitations/:id/retry'");
 assert.ok(start>=0);
 const source=server.slice(start,server.indexOf('\n  });',start)+6);
 runInNewContext(ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,{
  app:{post:(_path:string,auth:unknown,role:unknown,route:unknown)=>{assert.equal(auth,authenticated);assert.equal(role,masterOnly);handler=route;}},
  requireAuthenticated:authenticated,requireAdministrator:masterOnly,formArchiveJobsStore:[archive],processesStore:[p],
  currentReservationArchive,currentSettings:{integrationStudio:{revision:8}},
  recoverableInvitation:()=>eligible?{archive,run,actorEmail:run.actorEmail}:undefined,
  resumeWorkflowAfterNativeFormArchive:async(process:unknown,form:string,actor:string,prior:unknown)=>{
   assert.equal(process,p);assert.equal(form,'CONFIRMACAO_LOCAL');assert.equal(actor,run.actorEmail);assert.equal(prior,run);
   calls++;if(confirmed)p.defesa.invitationSentAt='confirmed';
  }
 });
 async function request(revision=8){
  const result:any={code:200};
  await handler({params:{id:archive.id},body:{reviewedStudioRevision:revision}},{
   status(code:number){result.code=code;return this;},json(body:unknown){result.body=body;}
  });
  return result;
 }
 assert.equal((await request(7)).code,409);
 eligible=false;assert.equal((await request()).code,409);assert.equal(calls,0);
 eligible=true;assert.equal((await request()).code,202);
 confirmed=true;assert.equal((await request()).code,200);
 assert.match((await request()).body.confirmationMessage,/já foi confirmado/);assert.equal(calls,2);
});

test('Master ATA retry requires the reviewed configuration and waits for the normal workflow',async()=>{
 const {p}=fixture();
 const intent={documentType:'ATA',revision:4};
 const process={...p,astenSignatureIntent:intent};
 const authenticated=()=>{},masterOnly=()=>{};
 let handler:any,ready=true,workflowComplete=false,dispatches=0;
 const server=readFileSync('server.ts','utf8');
 const start=server.indexOf("  app.post('/api/admin/workflow/ata-signatures/:id/retry'");
 assert.ok(start>=0);
 const source=server.slice(start,server.indexOf('\n  });',start)+6);
 runInNewContext(ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,{
  app:{post:(_path:string,auth:unknown,role:unknown,route:unknown)=>{
   assert.equal(auth,authenticated);assert.equal(role,masterOnly);handler=route;
  }},
  requireAuthenticated:authenticated,requireAdministrator:masterOnly,processesStore:[process],
  currentSettings:{integrationStudio:{revision:8}},workflowRunsStore:[],
  recoverableAtaSignature:()=>ready?intent:undefined,
  getPortalIdentity:()=>({email:'master@example.invalid'}),
  executeConfiguredWorkflowEvent:async()=>({status:workflowComplete?'COMPLETED':'FAILED'}),
  executeAutomaticAsten:async(candidate:unknown,type:string,actor:string)=>{
   assert.equal(candidate,process);assert.equal(type,'ATA');assert.equal(actor,'master@example.invalid');
   dispatches++;ready=false;return 'job';
  }
 });
 async function request(revision=8){
  const result:any={code:200};
  await handler({params:{id:p.id},body:{reviewedStudioRevision:revision}},{
   status(code:number){result.code=code;return this;},json(body:unknown){result.body=body;}
  });
  return result;
 }
 assert.equal((await request(7)).code,409);
 assert.equal((await request()).code,202);
 assert.equal(dispatches,0);
 workflowComplete=true;
 assert.match((await request()).body.confirmationMessage,/ASTEN aceitou/);
 assert.equal((await request()).code,409);
 assert.equal(dispatches,1);
});
