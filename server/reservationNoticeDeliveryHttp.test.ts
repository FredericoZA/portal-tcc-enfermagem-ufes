import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn,type ChildProcess} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import {createServer} from 'node:net';
import {mkdtemp,readFile,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {DEMO_PROCESSES,INITIAL_SETTINGS} from '../src/services/demoSeed';
import {initialEmailDelivery} from './integrations/trackedGmail';
import type {EmailDeliveryRecord} from '../src/types/automation';

const student='student@reservation-delivery.invalid';
const advisor='advisor@reservation-delivery.invalid';
const previousDepartment='sender+department@reservation-delivery.invalid';
const currentDepartment='department@reservation-delivery.invalid';
const master='master@reservation-delivery.invalid';
const responseAt='2026-11-04T15:41:34.985Z';
const processId='reservation-delivery-process';
const receiptKey=`reservation-receipt:${processId}:0:${previousDepartment}`;

const isolatedRuntime=String.raw`
import dotenv from 'dotenv';
import {readFile} from 'node:fs/promises';
dotenv.config=()=>({parsed:{}});
const NativeDate=Date;
let offset=0,attempt=0;
globalThis.Date=class extends NativeDate {
  constructor(...args){super(...(args.length?args:[NativeDate.now()+offset]));}
  static now(){return NativeDate.now()+offset;}
};
process.on('message',message=>{
  if(message?.kind==='advance-clock'){
    offset+=message.milliseconds;
    process.send?.({kind:'clock-advanced',id:message.id});
  }
});
globalThis.fetch=async(input,init={})=>{
  const url=new URL(typeof input==='string'||input instanceof URL?String(input):input.url);
  if(url.href==='https://oauth2.googleapis.com/token')return Response.json({access_token:'synthetic-reservation-access-token',expires_in:3600});
  if(url.href==='https://gmail.googleapis.com/gmail/v1/users/me/messages/send'){
    const payload=JSON.parse(String(init.body));
    const persisted=JSON.parse(await readFile(process.env.FIXTURE_STATE_FILE,'utf8'));
    const claim=persisted.emailDeliveries.find(row=>row.templateId==='email-comprovante-reserva');
    const status=++attempt<=Number(process.env.FIXTURE_TRANSIENT_FAILURES||0)?503:200;
    process.send?.({kind:'gmail',raw:Buffer.from(payload.raw,'base64url').toString('utf8'),threadId:payload.threadId,
      status,claimStatus:claim?.status,claimDispatchState:claim?.dispatchState});
    return status===503?Response.json({error:{message:'Synthetic temporary Gmail rejection'}},{status})
      :Response.json({id:'synthetic-receipt-'+attempt,threadId:'synthetic-reservation-thread'});
  }
  process.send?.({kind:'unexpected-network',origin:url.origin});
  throw new Error('External providers are blocked in this reservation fixture.');
};
const {saveIntegrationSecret}=await import('./server/integrations/integrationSecrets.ts');
await saveIntegrationSecret('google_workspace','synthetic-reservation-refresh-token',{email:'sender@reservation-delivery.invalid'});
await import('./server.ts');
`;

interface CapturedMessage {
  raw:string;
  threadId?:string;
  status:number;
  claimStatus?:string;
  claimDispatchState?:string;
}

async function fixture(options:{transientFailures?:number;newReservation?:boolean}={}){
  const directory=await mkdtemp(path.join(tmpdir(),'portal-reservation-delivery-http-'));
  const stateFile=path.join(directory,'portal-state.json');
  const p=structuredClone(DEMO_PROCESSES[0]);
  p.id=processId;p.protocolo='TCC-2026-0001';p.aluno1.email=student;p.aluno2=null;p.orientador.email=advisor;
  p.status='AGUARDANDO_CONFIRMACAO_LOCAL';p.etapaAtual='CONFIRMACAO_LOCAL';
  delete p.defesa.reservationRevision;p.defesa.localStatus='PENDENTE';
  p.defesa.departmentResponse={revision:0,decision:'UNAVAILABLE',respondedBy:previousDepartment,respondedAt:responseAt,
    local:p.defesa.local,startAt:p.defesa.startAt,endAt:p.defesa.endAt};
  const requestDelivery=(key:string,recipient:string,cc:string[]=[])=>{
    const record=initialEmailDelivery({processId:p.id,protocol:p.protocolo,recipient,cc,subject:`Solicitação de reserva [${p.protocolo}]`,
      text:'Solicitação sintética já enviada.',templateId:'email-reserva',workflowEventVariables:{RESERVATION_REVISION:'0'},idempotencyKey:key},new Date(responseAt));
    record.status='ACCEPTED_BY_GMAIL';record.acceptedAt=responseAt;record.nextRetryAt=undefined;
    record.attempts=[{number:1,startedAt:responseAt,completedAt:responseAt,status:'ACCEPTED_BY_GMAIL',gmailMessageId:key,gmailThreadId:'synthetic-reservation-thread'}];
    return record;
  };
  const requestDeliveries=[requestDelivery('reservation-request-owner',previousDepartment),requestDelivery('reservation-request-group',student,[advisor])];
  const emailDeliveries:EmailDeliveryRecord[]=[...requestDeliveries];
  if(options.newReservation){
    p.defesa.reservationRevision=1;
    p.defesa.startAt='2026-12-09T17:00:00.000Z';p.defesa.endAt='2026-12-09T18:30:00.000Z';
    const oldReceipt=initialEmailDelivery({processId:p.id,protocol:p.protocolo,recipient:previousDepartment,cc:[student,advisor],
      templateId:'email-comprovante-reserva',workflowEventVariables:{RESERVATION_REVISION:'0'},subject:'Recusa anterior',text:'Aviso anterior ainda não enviado.',idempotencyKey:receiptKey},new Date(responseAt));
    oldReceipt.attempts=[{number:1,startedAt:responseAt,completedAt:responseAt,status:'RETRY',errorCode:'TRANSIENT_GMAIL_ERROR'}];
    emailDeliveries.push(oldReceipt);
  }
  await writeFile(stateFile,JSON.stringify({settings:{...structuredClone(INITIAL_SETTINGS),masterEmail:master,ownerEmail:master,calendarId:'',driveRootFolderId:'',
    emailConfig:{roomReservationDepartmentEmail:currentDepartment,auditEmailsEnabled:true}},
    processes:[p],memberships:[],authorizedStudents:[],signatureJobs:[],emailDeliveries,auditLogs:[]}));
  const inherited=Object.fromEntries(['PATH','HOME','TMPDIR','LANG','TZ'].filter(key=>process.env[key]).map(key=>[key,process.env[key]]));
  const cronSecret=randomBytes(40).toString('hex');
  let child:ChildProcess|undefined,base='',output='';
  const sent:CapturedMessage[]=[],unexpected:string[]=[],clockAcks=new Set<string>();
  const stop=async()=>{
    if(child&&child.exitCode===null&&child.signalCode===null){
      const ended=new Promise<void>(resolve=>child!.once('exit',()=>resolve()));child.kill('SIGTERM');await ended;
    }
  };
  const start=async()=>{
    const socket=createServer();await new Promise<void>(resolve=>socket.listen(0,'127.0.0.1',resolve));
    const port=(socket.address() as {port:number}).port;
    await new Promise<void>((resolve,reject)=>socket.close(error=>error?reject(error):resolve()));
    base=`http://127.0.0.1:${port}`;
    child=spawn(process.execPath,['--import','tsx','--input-type=module','-e',isolatedRuntime],{cwd:process.cwd(),env:{...inherited,
      NODE_ENV:'development',HOST:'127.0.0.1',PORT:String(port),VERCEL:'',APP_URL:base,PORTAL_PUBLIC_URL:base,PORTAL_DATA_DIR:directory,
      FIXTURE_STATE_FILE:stateFile,FIXTURE_TRANSIENT_FAILURES:String(options.transientFailures||0),CRON_SECRET:cronSecret,
      PORTAL_PERSISTENCE_PROVIDER:'local_file',PORTAL_LOCAL_REVIEW_DATA:'false',PORTAL_ALLOW_INSECURE_DEMO_AUTH:'false',PORTAL_TEST_DOCUMENT_RENDERER:'false',
      PORTAL_ALLOW_LOCAL_OTP_STORE:'true',PORTAL_ALLOW_LOCAL_SECRET_STORE:'true',PORTAL_SESSION_SECRET:randomBytes(40).toString('hex'),PORTAL_OTP_PEPPER:randomBytes(40).toString('hex'),
      PORTAL_SECRET_ENCRYPTION_KEY:randomBytes(32).toString('hex'),PORTAL_OTP_DELIVERY_MODE:'log',ASTEN_INTEGRATION_ENABLED:'false',
      SUPABASE_URL:'',SUPABASE_SECRET_KEY:'',SUPABASE_SERVICE_ROLE_KEY:'',GOOGLE_OAUTH_CLIENT_ID:'synthetic-reservation-client',GOOGLE_OAUTH_CLIENT_SECRET:'synthetic-reservation-client-secret'},
      stdio:['ignore','pipe','pipe','ipc']});
    child.stdout?.on('data',chunk=>{output=(output+chunk).slice(-4000);});child.stderr?.on('data',chunk=>{output=(output+chunk).slice(-4000);});
    child.on('message',(message:unknown)=>{
      if(!message||typeof message!=='object')return;
      const event=message as CapturedMessage&{kind?:string;origin?:string;id?:string};
      if(event.kind==='gmail')sent.push(event);
      if(event.kind==='unexpected-network'&&event.origin)unexpected.push(event.origin);
      if(event.kind==='clock-advanced'&&event.id)clockAcks.add(event.id);
    });
    const deadline=Date.now()+20000;
    while(Date.now()<deadline){
      try{if((await fetch(base+'/api/health')).ok)return;}catch{}
      if(child.exitCode!==null)break;
      await new Promise(resolve=>setTimeout(resolve,50));
    }
    throw new Error('Reservation delivery fixture did not start: '+output);
  };
  try{await start();}catch(error){await stop();await rm(directory,{recursive:true,force:true});throw error;}
  const state=async()=>JSON.parse(await readFile(stateFile,'utf8'));
  return {sent,unexpected,p,requestDeliveries,state,
    recover:async()=>{
      const response=await fetch(base+'/api/cron/reservation-notices',{headers:{authorization:`Bearer ${cronSecret}`}});
      assert.equal(response.status,200,await response.clone().text());
      return response.json() as Promise<{checked:number;failed:number}>;
    },
    publicProcess:async()=>{
      const response=await fetch(base+'/api/public/processes/'+p.protocolo);assert.equal(response.status,200);return response.json();
    },
    advance:async(milliseconds:number)=>{
      const id=randomBytes(8).toString('hex');child!.send({kind:'advance-clock',milliseconds,id});
      const deadline=Date.now()+5000;
      while(!clockAcks.has(id)&&Date.now()<deadline)await new Promise(resolve=>setTimeout(resolve,10));
      assert.ok(clockAcks.has(id),'the isolated clock acknowledged the advance');
    },
    restart:async()=>{await stop();await start();},
    close:async()=>{await stop();await rm(directory,{recursive:true,force:true});},
  };
}

const copies=(raw:string)=>raw.match(/^Cc: (.*)\r?$/m)?.[1].trim().split(/,\s*/)||[];
const decodedMessage=(raw:string)=>[...raw.matchAll(/Content-Transfer-Encoding: base64\r?\n\r?\n([A-Za-z0-9+/=\r\n]+)/g)]
  .map(part=>Buffer.from(part[1].replace(/\s/g,''),'base64').toString('utf8')).join('\n');

test('HTTP: cron delivers a persisted legacy refusal to the student and advisor without another department click, surviving restart without duplication',{timeout:45000},async()=>{
  const f=await fixture();
  try{
    assert.equal(f.sent.length,0);
    assert.deepEqual(await f.recover(),{checked:1,failed:0});
    assert.equal(f.sent.length,1);
    const message=f.sent[0],body=decodedMessage(message.raw);
    assert.equal(message.status,200);assert.equal(message.claimStatus,'RETRY');assert.equal(message.claimDispatchState,'SENDING');
    assert.match(message.raw,new RegExp(`^To: ${previousDepartment.replaceAll('.','\\.').replaceAll('+','\\+')}\\r?$`,'m'));
    assert.deepEqual(copies(message.raw).sort(),[student,advisor,master].sort());
    assert.ok(!copies(message.raw).includes(currentDepartment),'a changed destination does not rewrite who answered the old request');
    assert.match(body,/agendamento solicitado|reserva recusada/);assert.match(body,/Refazer reserva/);assert.match(body,/evitar retrabalho/);
    assert.match(body,/É necessário solicitar novamente a reserva/);assert.match(body,/o mesmo TCC/);
    assert.match(body,/O código do TCC será mantido/);assert.match(body,/não criem outro trabalho/);
    assert.match(body,/href="http:\/\/127\.0\.0\.1:\d+\/\?tcc=reservation-delivery-process&amp;secao=geral"[^>]*>Refazer reserva<\/a>/);
    assert.equal(message.threadId,'synthetic-reservation-thread');
    const saved=await f.state(),receipt=saved.emailDeliveries.find((row:EmailDeliveryRecord)=>row.idempotencyKey===receiptKey);
    assert.equal(saved.emailDeliveries.length,3);assert.equal(receipt.status,'ACCEPTED_BY_GMAIL');assert.equal(receipt.attempts.length,1);
    assert.equal(receipt.attempts[0].gmailMessageId,'synthetic-receipt-1');assert.ok(receipt.acceptedAt);assert.equal(receipt.dispatchState,undefined);
    assert.deepEqual(saved.emailDeliveries.filter((row:EmailDeliveryRecord)=>row.templateId==='email-reserva'),JSON.parse(JSON.stringify(f.requestDeliveries)));
    assert.equal(saved.processes[0].protocolo,f.p.protocolo);assert.equal(saved.processes[0].defesa.localStatus,'RECUSADO');
    assert.equal(saved.processes[0].defesa.departmentResponse.respondedAt,responseAt);
    assert.equal(saved.formArchiveJobs?.length||0,0);
    await f.restart();
    assert.deepEqual(await f.recover(),{checked:0,failed:0});assert.equal(f.sent.length,1);
    const after=await f.state();assert.equal(after.emailDeliveries.length,3);
    assert.deepEqual(after.emailDeliveries.find((row:EmailDeliveryRecord)=>row.id===receipt.id),receipt);
    const publicView=await f.publicProcess();assert.equal(publicView.protocolo,f.p.protocolo);assert.equal(publicView.defesa.localStatus,'RECUSADO');
    assert.doesNotMatch(JSON.stringify(publicView),/respondedBy|sender\+department@reservation-delivery/);
    assert.deepEqual(f.unexpected,[]);
  }finally{await f.close();}
});

test('HTTP: an explicit transient Gmail rejection is durable RETRY and the due cron recovers it once',{timeout:45000},async()=>{
  const f=await fixture({transientFailures:1});
  try{
    assert.deepEqual(await f.recover(),{checked:1,failed:1});assert.equal(f.sent.length,1);assert.equal(f.sent[0].status,503);
    const first=await f.state(),pending=first.emailDeliveries.find((row:EmailDeliveryRecord)=>row.idempotencyKey===receiptKey);
    assert.equal(pending.status,'RETRY');assert.equal(pending.dispatchState,undefined);assert.ok(pending.nextRetryAt);
    assert.equal(pending.attempts.length,1);assert.equal(pending.attempts[0].errorCode,'TRANSIENT_GMAIL_ERROR');
    assert.equal(Date.parse(pending.nextRetryAt)-Date.parse(pending.attempts[0].completedAt),60_000);
    assert.deepEqual(await f.recover(),{checked:0,failed:0});assert.equal(f.sent.length,1,'a future retry does not send early');
    await f.advance(61_000);
    assert.deepEqual(await f.recover(),{checked:1,failed:0});assert.equal(f.sent.length,2);
    assert.equal(f.sent[1].status,200);assert.equal(f.sent[1].claimDispatchState,'SENDING');
    const saved=await f.state(),receipt=saved.emailDeliveries.find((row:EmailDeliveryRecord)=>row.idempotencyKey===receiptKey);
    assert.equal(saved.emailDeliveries.length,3);assert.equal(receipt.id,pending.id);assert.equal(receipt.rfcMessageId,pending.rfcMessageId);
    assert.equal(receipt.status,'ACCEPTED_BY_GMAIL');assert.equal(receipt.attempts.length,2);assert.equal(receipt.nextRetryAt,undefined);
    assert.deepEqual(copies(f.sent[1].raw).sort(),[student,advisor,master].sort());assert.match(decodedMessage(f.sent[1].raw),/Refazer reserva/);
    await f.restart();assert.deepEqual(await f.recover(),{checked:0,failed:0});assert.equal(f.sent.length,2);
    assert.deepEqual(f.unexpected,[]);
  }finally{await f.close();}
});

test('HTTP: a new reservation does not send the previous refusal or its overdue retry',{timeout:45000},async()=>{
  const f=await fixture({newReservation:true});
  try{
    const before=await f.state();
    assert.deepEqual(await f.recover(),{checked:0,failed:0});assert.deepEqual(f.sent,[]);
    const saved=await f.state();assert.deepEqual(saved.emailDeliveries,before.emailDeliveries);
    assert.equal(saved.processes[0].defesa.reservationRevision,1);assert.equal(saved.processes[0].defesa.departmentResponse.revision,0);
    assert.equal(saved.processes[0].defesa.localStatus,'PENDENTE');assert.equal(saved.processes[0].protocolo,f.p.protocolo);
    const publicView=await f.publicProcess();assert.equal(publicView.defesa.localStatus,'PENDENTE');
    assert.deepEqual(f.unexpected,[]);
  }finally{await f.close();}
});
