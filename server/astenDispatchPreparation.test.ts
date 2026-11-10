import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {createHash} from 'node:crypto';
import ts from 'typescript';
import {DEMO_PROCESSES} from '../src/services/demoSeed';
import {assertCurrentSignatureRecipients,deriveSignatureSigners,hasCompetingSignatureArchive,signatureJobMatchesCurrentRevision} from './workflow/signaturePolicy';
import type {SignatureJob} from '../src/types/signatures';

const source=readFileSync('server.ts','utf8');
const body=(name:string)=>{const start=source.indexOf(`function ${name}(`);assert.ok(start>=0);return source.slice(start,source.indexOf('\n}\n',start)+2);};
type Failure='folder'|'pdf'|'hash'|'create-barrier'|'send-barrier'|'prepare-ack'|'start-ack'|'provider-create'|'provider-send';
function setup(){
  const process=structuredClone(DEMO_PROCESSES[0]);process.dataRevision=7;process.avaliacao={status:'CONCLUIDO',documentRevision:7};process.driveFolderId='fixture-private-folder';
  const pdf=Buffer.from('%PDF-1.4\nfixture\n%%EOF');
  const job={id:'fixture-job',idempotencyKey:'a'.repeat(64),processId:process.id,protocol:process.protocolo,documentType:'ATA',provider:'ASTEN',documentVersion:1,sourceDataRevision:7,status:'PROVIDER_ERROR',providerCreationState:'PENDING',providerAuthenticationProfile:'EMAIL_LINK',providerFolderId:12,providerRepositoryId:34,driveUnsignedFileId:'fixture-original-pdf',contentSha256:createHash('sha256').update(pdf).digest('hex'),signers:deriveSignatureSigners(process,'ATA',{},'BOARD_ONLY_LEGACY')} as SignatureJob;
  const events:string[]=[];const control:{failure?:Failure;claim?:string}={};
  const timeout=()=>Object.assign(new Error('PRIVATE_TOKEN_AND_EMAIL must not be exposed'),{name:'TimeoutError'});
  const ports:any={Error,Date,Buffer,createHash,processesStore:[process],signatureJobsStore:[job],currentSettings:{driveRootFolderId:'private-root'},signatureJobMatchesCurrentRevision,hasCompetingSignatureArchive,assertCurrentSignatureRecipients,getPersistentAstenStatus:async()=>({dispatchEnabled:true}),getPersistentAstenConnection:async()=>({repositoryId:34,token:'unit-secret'}),astenWebhookInboxReady:async()=>true,
    validateAstenDocumentFolder:async()=>{events.push('folder');if(control.failure==='folder')throw timeout();},getAstenSigningProfile:()=> 'EMAIL_LINK',getGoogleWorkspaceAccessToken:async()=> 'unit-google',downloadDrivePdf:async()=>{events.push('pdf');if(control.failure==='pdf')throw timeout();return {pdf:control.failure==='hash'?Buffer.from('%PDF-different'):pdf};},
    claimAstenEnvelopeDispatch:async()=>{events.push('claim');if(control.failure==='prepare-ack')throw timeout();return {outcome:control.claim||'PREPARED',claimToken:'unit-claim'};},
    startPreparedAstenEnvelopeDispatch:async(input:any)=>{assert.equal(events.at(-1),'claim');assert.equal(input.claimToken,'unit-claim');events.push('start');if(control.failure==='start-ack')throw timeout();},
    persistPortalStateDurably:async()=>{
      const event=`persist:${job.providerCreationState}:${job.providerDispatchState||'none'}`;events.push(event);
      if(control.failure==='create-barrier'&&job.providerCreationState==='CREATING')throw timeout();
      if(control.failure==='send-barrier'&&job.providerDispatchState==='SENDING')throw timeout();
    },persistPortalState:()=>{events.push('terminal-persist');},
    buildAstenEnvelopeParams:(input:unknown)=>input,extractAstenEnvelopeIdentity:()=>({id:'envelope-fixture',hash:'fixture-hash'}),assertAstenEnvelopeDestination:()=>{},assertAstenEnvelopeAuthentication:()=>{},
    updateAstenEnvelopeDispatch:async(input:any)=>{events.push(`outbox:${input.state}`);},
    callAsten:async(service:string)=>{
      if(service==='inserirEnvelope'){
        assert.equal(events.at(-1),'start','Creation requires the confirmed exclusive provider-start transition.');
        assert.ok(events.lastIndexOf('persist:CREATING:none')<events.lastIndexOf('claim'),'The durable CREATING barrier must precede the claim.');
        assert.ok(events.includes('persist:CREATING:none'),'Creation requires the confirmed durable CREATING barrier.');
        events.push('create');if(control.failure==='provider-create')throw Error('provider timeout');
      }else if(service==='encaminharEnvelopeParaAssinaturas'){
        assert.equal(events.at(-1),'persist:CONFIRMED:SENDING','Dispatch requires the confirmed durable SENDING barrier.');
        events.push('send');if(control.failure==='provider-send')throw Error('provider timeout');
      }else events.push(`read:${service}`);
      return {};
    },
  };
  ports.astenDispatchFailure=runInNewContext(ts.transpileModule('('+body('astenDispatchFailure')+')',{}).outputText,{Error});
  const dispatch=runInNewContext(ts.transpileModule('(async '+body('dispatchSignatureJobUnlocked')+')',{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,ports) as (job:SignatureJob)=>Promise<SignatureJob>;
  return {job,events,control,dispatch};
}

test('pre-claim folder/PDF timeouts make no envelope or claim and identify a safe non-private stage',async()=>{
  for(const failure of ['folder','pdf'] as const){
    const fixture=setup();fixture.control.failure=failure;
    await fixture.dispatch(fixture.job);
    assert.equal(fixture.job.status,'PROVIDER_ERROR');assert.equal(fixture.job.providerCreationState,'PENDING');
    assert.match(fixture.job.lastError!,failure==='folder'?/\[DESTINATION\]/:/\[PDF_READ\]/);assert.doesNotMatch(fixture.job.lastError!,/PRIVATE_TOKEN_AND_EMAIL/);
    assert.ok(!fixture.events.includes('claim')&&!fixture.events.includes('create')&&!fixture.events.includes('send'));
    assert.equal(fixture.events.filter(event=>event.startsWith('persist:')).length,0,'Read-only preparation no longer writes SENDING.');
  }
});
test('normal retry keeps the existing identity/artifact and both provider mutation barriers',async()=>{
  const fixture=setup(),identity={id:fixture.job.id,key:fixture.job.idempotencyKey,hash:fixture.job.contentSha256,pdf:fixture.job.driveUnsignedFileId,signers:structuredClone(fixture.job.signers)};
  fixture.control.failure='pdf';await fixture.dispatch(fixture.job);
  fixture.control.failure=undefined;await fixture.dispatch(fixture.job);
  assert.equal(fixture.job.status,'SENT');assert.equal(fixture.events.filter(e=>e==='claim').length,1);assert.equal(fixture.events.filter(e=>e==='create').length,1);assert.equal(fixture.events.filter(e=>e==='send').length,1);
  assert.equal(fixture.events.filter(e=>e.startsWith('persist:')).length,3,'Only artifact-ready CREATE, envelope identity and SEND commits remain.');
  assert.deepEqual({id:fixture.job.id,key:fixture.job.idempotencyKey,hash:fixture.job.contentSha256,pdf:fixture.job.driveUnsignedFileId,signers:fixture.job.signers},identity);
  const before=fixture.events.length;await fixture.dispatch(fixture.job);assert.equal(fixture.events.length,before,'Accepted job must not be sent again.');
});
test('failed durable CREATE/SEND barriers forbid the following provider mutation',async()=>{
  for(const failure of ['create-barrier','send-barrier'] as const){
    const fixture=setup();fixture.control.failure=failure;await fixture.dispatch(fixture.job);
    assert.equal(fixture.job.status,'PROVIDER_ERROR');assert.match(fixture.job.lastError!,failure==='create-barrier'?/\[PERSIST_CREATE\]/:/\[PERSIST_SEND\]/);
    assert.doesNotMatch(fixture.job.lastError!,/PRIVATE_TOKEN_AND_EMAIL/);
    assert.equal(fixture.events.filter(e=>e==='create').length,failure==='create-barrier'?0:1);assert.equal(fixture.events.filter(e=>e==='send').length,0);
    if(failure==='create-barrier')assert.equal(fixture.events.filter(e=>e==='claim').length,0,'A failed database preparation must not acquire a claim that will expire as uncertain.');
  }
});
test('failed pre-claim CREATE commit can retry the same job without poisoning its outbox',async()=>{
  const fixture=setup(),identity={id:fixture.job.id,key:fixture.job.idempotencyKey,hash:fixture.job.contentSha256,pdf:fixture.job.driveUnsignedFileId};
  fixture.control.failure='create-barrier';await fixture.dispatch(fixture.job);
  assert.equal(fixture.job.status,'PROVIDER_ERROR');assert.equal(fixture.job.providerEnvelopeId,undefined);
  assert.equal(fixture.events.filter(event=>event==='claim'||event==='create'||event==='send').length,0);
  fixture.control.failure=undefined;await fixture.dispatch(fixture.job);
  assert.equal(fixture.job.status,'SENT');
  for(const event of ['claim','create','send'])assert.equal(fixture.events.filter(item=>item===event).length,1);
  assert.deepEqual({id:fixture.job.id,key:fixture.job.idempotencyKey,hash:fixture.job.contentSha256,pdf:fixture.job.driveUnsignedFileId},identity);
});
test('a known envelope bypasses creation preparation and claim while retaining the SEND barrier',async()=>{
  const fixture=setup();fixture.job.providerEnvelopeId='existing-envelope';fixture.job.providerEnvelopeHash='existing-hash';fixture.job.providerCreationState='CONFIRMED';
  await fixture.dispatch(fixture.job);
  assert.equal(fixture.job.status,'SENT');
  assert.equal(fixture.events.filter(event=>event==='claim'||event==='start'||event==='create'||event==='persist:CREATING:none').length,0);
  assert.equal(fixture.events.filter(event=>event.startsWith('persist:')).length,1,'A known envelope needs only its pre-dispatch durable barrier.');
  assert.equal(fixture.events.filter(event=>event==='send').length,1);
});
test('an uncertain prepare or start acknowledgement never permits a provider creation',async()=>{
  for(const failure of ['prepare-ack','start-ack'] as const){
    const fixture=setup();fixture.control.failure=failure;await fixture.dispatch(fixture.job);
    assert.equal(fixture.job.status,'PROVIDER_ERROR');
    assert.equal(fixture.events.filter(event=>event==='create'||event==='send').length,0);
    assert.equal(fixture.events.filter(event=>event==='start').length,failure==='start-ack'?1:0);
  }
});
test('ambiguous provider creation or dispatch keeps its existing block against duplicate operations',async()=>{
  for(const failure of ['provider-create','provider-send'] as const){
    const fixture=setup();fixture.control.failure=failure;await fixture.dispatch(fixture.job);
    assert.equal(fixture.job.status,'PROVIDER_ERROR');assert.match(fixture.job.lastError!,/bloquead/);
    const beforeCreate=fixture.events.filter(e=>e==='create').length,beforeSend=fixture.events.filter(e=>e==='send').length;
    fixture.control.failure=undefined;await fixture.dispatch(fixture.job);
    assert.equal(fixture.events.filter(e=>e==='create').length,beforeCreate);assert.equal(fixture.events.filter(e=>e==='send').length,beforeSend);
  }
});
test('a changed PDF and a busy/uncertain claim never permit another envelope creation',async()=>{
  const hash=setup();hash.control.failure='hash';await hash.dispatch(hash.job);
  assert.match(hash.job.lastError!,/hash aprovado/);assert.ok(!hash.events.includes('claim')&&!hash.events.includes('create'));
  for(const claim of ['BUSY','UNCERTAIN']){
    const fixture=setup();fixture.control.claim=claim;await fixture.dispatch(fixture.job);
    assert.equal(fixture.events.filter(e=>e==='claim').length,1);assert.ok(!fixture.events.includes('create')&&!fixture.events.includes('send'));
    assert.ok(fixture.events.indexOf('persist:CREATING:none')<fixture.events.indexOf('claim'));
    assert.equal(fixture.job.providerEnvelopeId,undefined);
    if(claim==='UNCERTAIN')assert.equal(fixture.job.providerCreationState,'UNCERTAIN');
  }
});
