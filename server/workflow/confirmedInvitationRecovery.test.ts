import test from 'node:test';import assert from 'node:assert/strict';
import {selectConfirmedInvitationRecovery} from './confirmedInvitationRecovery';
function fixture(){
 const process:any={id:'p',protocolo:'TCC - 00003',dataRevision:4,legacyRecord:false,status:'AGUARDANDO_CONFIRMACAO_LOCAL',
  avaliacao:{status:'PENDENTE'},defesa:{reservationRevision:1,localStatus:'CONFIRMADO',local:'Sala fictícia',departmentResponse:{revision:1,decision:'CONFIRMED'}}};
 const run:any={id:'run',processId:'p',eventCode:'LOCATION_CONFIRMED',sourceDataRevision:4,studioRevision:8,status:'PARTIAL_FAILURE',actorEmail:'original@example.invalid',
  startedAt:'2026-11-07T17:24:00Z',completedAt:'2026-11-07T17:25:00Z',eventVariables:{RESERVATION_REVISION:'1'},actions:[{actionId:'doc',stageId:'s',kind:'DOCUMENT',status:'FAILED',idempotencyKey:'a'.repeat(64),error:'The operation was aborted due to timeout'}],issues:[]};
 const archive:any={id:'form',processId:'p',formType:'CONFIRMACAO_LOCAL',version:4,reservationRevision:1,status:'FAILED',lastError:'The operation was aborted due to timeout',updatedAt:'2026-11-07T17:23:00Z'};
 return{processes:[process],runs:[run],archives:[archive],emails:[] as any[],signatures:[],studioRevision:8,process,run,archive};
}
test('recorded document timeout selects only the current reservation archive, preserving references and context',()=>{
 const f=fixture(),before=structuredClone(f);const candidate=selectConfirmedInvitationRecovery(f)!;
 assert.equal(candidate.process,f.process);assert.equal(candidate.run,f.run);assert.equal(candidate.archive,f.archive);assert.deepEqual(f,before);
 assert.equal(candidate.run!.actorEmail,'original@example.invalid');
 f.archive.status='ARCHIVED';assert.ok(selectConfirmedInvitationRecovery(f));
});
test('changed process/studio/reservation, missing archive and non-transient errors never trigger an automatic replay',()=>{
 for(const change of [
  (f:any)=>f.process.dataRevision++, (f:any)=>f.studioRevision++, (f:any)=>f.process.defesa.reservationRevision++,
  (f:any)=>f.process.defesa.departmentResponse.decision='UNAVAILABLE',(f:any)=>f.process.defesa.invitationSentAt='sent',
  (f:any)=>f.archives=[],(f:any)=>f.archive.version--,(f:any)=>f.archive.reservationRevision--,
  (f:any)=>f.archive.lastError='modelo inválido',(f:any)=>f.run.actions[0].error='variável ausente',
  (f:any)=>f.run.actions[0].kind='EMAIL',(f:any)=>f.run.status='FAILED_VALIDATION',(f:any)=>f.process.avaliacao.status='CONCLUIDO',
 ]){const f=fixture();change(f);assert.equal(selectConfirmedInvitationRecovery(f),undefined);}
});
test('accepted, uncertain and in-flight invitation deliveries block automatic retry; no extra actor or event is made',()=>{
 for(const delivery of [{status:'ACCEPTED_BY_GMAIL'},{status:'FAILED',dispatchState:'UNCERTAIN'},{status:'RETRY',dispatchState:'SENDING'}]){
  const f=fixture();f.emails=[{processId:'p',templateId:'email-convite',sourceDataRevision:4,...delivery}];assert.equal(selectConfirmedInvitationRecovery(f),undefined);
 }
 const f=fixture();f.runs.push({...f.run,id:'later',status:'COMPLETED',startedAt:'2026-11-07T17:26:00Z'});assert.equal(selectConfirmedInvitationRecovery(f),undefined);
});

test('a future receipt timeout before any workflow run is recoverable only with captured studio revision and the original confirmation actor',()=>{
 const f=fixture();f.runs=[];f.process.defesa.departmentResponse.respondedBy='original@example.invalid';
 assert.equal(selectConfirmedInvitationRecovery(f),undefined,'legacy jobs without captured configuration cannot auto-run a changed flow');
 f.archive.workflowStudioRevision=8;const candidate=selectConfirmedInvitationRecovery(f)!;
 assert.equal(candidate.run,undefined);assert.equal(candidate.actorEmail,'original@example.invalid');
 f.studioRevision=9;assert.equal(selectConfirmedInvitationRecovery(f),undefined);
});

test('legacy document timeouts without a recorded action key require an existing file pointer before any recovery',()=>{
 const f=fixture();delete f.run.actions[0].idempotencyKey;f.process.driveFolderUrl='https://drive.google.com/created-after-failure';
 assert.equal(selectConfirmedInvitationRecovery(f),undefined,'absence of the original provider identity never permits a new generated copy');
 f.process.defesa.invitationDriveFileId='existing-invitation-id';assert.ok(selectConfirmedInvitationRecovery(f),'the exact file still has to pass Drive job/hash/ancestry checks');
});

test('explicit Gmail rejection resumes the original failed email only after its retry deadline, preserving the archived document',()=>{
 const f=fixture();f.archive.status='ARCHIVED';f.process.defesa.invitationDriveFileId='existing-file';
 f.run.actions=[{actionId:'doc',stageId:'s',kind:'DOCUMENT',status:'COMPLETED',externalId:'existing-file'},
  {actionId:'mail',stageId:'s',kind:'EMAIL',status:'FAILED',idempotencyKey:'a'.repeat(64),externalId:'mail',error:'Um ou mais e-mails aguardam nova tentativa.'}] as any;
 const mail:any={id:'mail',processId:'p',templateId:'email-convite',recipient:'exam@example.invalid',sourceDataRevision:4,workflowEventVariables:{RESERVATION_REVISION:'1'},idempotencyKey:'a'.repeat(64)+':exam@example.invalid',status:'RETRY',maxAttempts:4,attempts:[{status:'RETRY'}],nextRetryAt:new Date(Date.now()-1000).toISOString()};f.emails=[mail];
 assert.equal(selectConfirmedInvitationRecovery(f)?.run,f.run);
 for(const mutate of [(m:any)=>m.nextRetryAt=new Date(Date.now()+60000).toISOString(),(m:any)=>m.status='FAILED',(m:any)=>m.dispatchState='UNCERTAIN',(m:any)=>m.dispatchState='SENDING',(m:any)=>m.maxAttempts=1,(m:any)=>m.sourceDataRevision=3,(m:any)=>m.idempotencyKey='different']){
  const original=structuredClone(mail);mutate(mail);assert.equal(selectConfirmedInvitationRecovery(f),undefined);Object.assign(mail,original);for(const key of Object.keys(mail))if(!(key in original))delete mail[key];
 }
 assert.equal(f.run.actions[0].externalId,'existing-file');
});

test('interruption between the archived letter and Gmail resumes only the recorded email',()=>{
 const f=fixture();
 f.archive.status='ARCHIVED';
 f.process.defesa.invitationDriveFileId='existing-file';
 f.run.actions=[
  {actionId:'doc',stageId:'s',kind:'DOCUMENT',status:'COMPLETED',externalId:'existing-file'},
  {actionId:'mail',stageId:'s',kind:'EMAIL',status:'FAILED',idempotencyKey:'a'.repeat(64)}
 ] as any;
 assert.equal(selectConfirmedInvitationRecovery(f)?.run,f.run);
 f.emails=[{processId:'p',templateId:'email-convite',sourceDataRevision:4,dispatchState:'UNCERTAIN'}];
 assert.equal(selectConfirmedInvitationRecovery(f),undefined);
});


test('a committed confirmation with an orphaned archive can resume after the execution window',()=>{
 const f=fixture();f.runs=[];f.archive.status='PENDING';f.archive.workflowStudioRevision=8;
 f.process.defesa.departmentResponse.respondedBy='original@example.invalid';
 assert.equal(selectConfirmedInvitationRecovery({...f,now:new Date('2026-11-07T17:28:59Z')}),undefined);
 assert.equal(selectConfirmedInvitationRecovery({...f,now:new Date('2026-11-07T17:29:00Z')})?.archive,f.archive);
 f.emails=[{processId:'p',templateId:'email-convite',dispatchState:'UNCERTAIN'}];
 assert.equal(selectConfirmedInvitationRecovery({...f,now:new Date('2026-11-07T17:29:00Z')}),undefined);
});
