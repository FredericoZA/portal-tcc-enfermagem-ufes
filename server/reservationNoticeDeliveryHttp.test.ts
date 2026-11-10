import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn,type ChildProcess} from 'node:child_process';
import {createHmac,randomBytes} from 'node:crypto';
import {createServer} from 'node:net';
import {mkdtemp,readFile,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {DEMO_PROCESSES,INITIAL_SETTINGS} from '../src/services/demoSeed';
import {PDFDocument} from 'pdf-lib';
import {initialEmailDelivery} from './integrations/trackedGmail';
import {reservationToken} from './workflow/reservationConfirmation';
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
let releaseGmail;
const gmailGate=new Promise(resolve=>{releaseGmail=resolve;});
globalThis.Date=class extends NativeDate {
  constructor(...args){super(...(args.length?args:[NativeDate.now()+offset]));}
  static now(){return NativeDate.now()+offset;}
};
process.on('message',message=>{
  if(message?.kind==='release-gmail')releaseGmail();
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
    const claim=persisted.emailDeliveries.find(row=>['email-local-indisponivel','email-comprovante-reserva'].includes(row.templateId));
    const status=++attempt<=Number(process.env.FIXTURE_TRANSIENT_FAILURES||0)?503:200;
    process.send?.({kind:'gmail',raw:Buffer.from(payload.raw,'base64url').toString('utf8'),threadId:payload.threadId,
      status,claimStatus:claim?.status,claimDispatchState:claim?.dispatchState});
    if(process.env.FIXTURE_HOLD_GMAIL==='true')await gmailGate;
    return status===503?Response.json({error:{message:'Synthetic temporary Gmail rejection'}},{status})
      :Response.json({id:'synthetic-receipt-'+attempt,threadId:payload.threadId||'synthetic-new-message-thread'});
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

async function fixture(options:{transientFailures?:number;newReservation?:boolean;fresh?:boolean;noParentMetadata?:boolean;pendingLegacyNotice?:boolean;secondAuthor?:boolean;customLocation?:boolean;pendingParticipantNotice?:boolean}={}){
  const directory=await mkdtemp(path.join(tmpdir(),'portal-reservation-delivery-http-'));
  const stateFile=path.join(directory,'portal-state.json');
  const p=structuredClone(DEMO_PROCESSES[0]);
  p.id=processId;p.protocolo='TCC-2026-0001';p.aluno1.email=student;p.aluno2=null;p.orientador.email=advisor;
  if(options.secondAuthor)p.aluno2={...p.aluno1,nome:'Segundo autor',email:'second-author@reservation-delivery.invalid'};
  p.status='AGUARDANDO_CONFIRMACAO_LOCAL';p.etapaAtual='CONFIRMACAO_LOCAL';
  delete p.defesa.reservationRevision;p.defesa.localStatus='PENDENTE';
  p.defesa.departmentResponse={revision:0,decision:'UNAVAILABLE',respondedBy:previousDepartment,respondedAt:responseAt,
    local:p.defesa.local,startAt:p.defesa.startAt,endAt:p.defesa.endAt};
  if(options.customLocation){p.defesa.local='Sala específica escolhida pelo aluno';if(p.defesa.departmentResponse){p.defesa.departmentResponse.local=p.defesa.local;p.defesa.departmentResponse.respondedBy=advisor;}}
  if(options.fresh)p.defesa.departmentResponse=undefined;
  const requestDelivery=(key:string,recipient:string,cc:string[]=[])=>{
    const record=initialEmailDelivery({processId:p.id,protocol:p.protocolo,recipient,cc,subject:`Solicitação de reserva [${p.protocolo}]`,
      text:key==='reservation-request-owner'?'Aceitar ou recusar: https://portal.example/api/reservation-confirmation/synthetic-personal-token':'Solicitação sintética já enviada.',templateId:'email-reserva',workflowEventVariables:{RESERVATION_REVISION:'0'},idempotencyKey:key},new Date(responseAt));
    record.status='ACCEPTED_BY_GMAIL';record.acceptedAt=responseAt;record.nextRetryAt=undefined;
    record.attempts=[{number:1,startedAt:responseAt,completedAt:responseAt,status:'ACCEPTED_BY_GMAIL',gmailMessageId:key,gmailThreadId:`synthetic-${key}-thread`}];
    if(options.noParentMetadata&&key==='reservation-request-owner'){
      record.rfcMessageId=undefined;
      record.attempts[0].gmailThreadId=undefined;
    }
    return record;
  };
  const requestDeliveries=[requestDelivery('reservation-request-owner',options.customLocation?advisor:options.fresh?currentDepartment:previousDepartment),requestDelivery('reservation-request-group',student,[advisor])];
  const emailDeliveries:EmailDeliveryRecord[]=[...requestDeliveries];
  if(options.newReservation){
    p.defesa.reservationRevision=1;
    p.defesa.startAt='2026-12-09T17:00:00.000Z';p.defesa.endAt='2026-12-09T18:30:00.000Z';
    const oldReceipt=initialEmailDelivery({processId:p.id,protocol:p.protocolo,recipient:previousDepartment,cc:[student,advisor],
      templateId:'email-comprovante-reserva',workflowEventVariables:{RESERVATION_REVISION:'0'},subject:'Recusa anterior',text:'Aviso anterior ainda não enviado.',idempotencyKey:receiptKey},new Date(responseAt));
    oldReceipt.attempts=[{number:1,startedAt:responseAt,completedAt:responseAt,status:'RETRY',errorCode:'TRANSIENT_GMAIL_ERROR'}];
    emailDeliveries.push(oldReceipt);
  }
  if(options.pendingLegacyNotice)emailDeliveries.push(initialEmailDelivery({processId:p.id,protocol:p.protocolo,
    recipient:previousDepartment,cc:[student,advisor],subject:'Aviso antigo ainda não enviado',text:'Aviso pendente.',
    templateId:'email-local-indisponivel',workflowEventVariables:{RESERVATION_REVISION:'0'},idempotencyKey:receiptKey},new Date(responseAt)));
  if(options.pendingParticipantNotice)emailDeliveries.push(initialEmailDelivery({processId:p.id,protocol:p.protocolo,recipient:student,additionalRecipients:[student,advisor],cc:[master],subject:'Comprovante pendente',text:'Aviso pendente.',templateId:'email-local-indisponivel',workflowEventVariables:{RESERVATION_REVISION:'0'},idempotencyKey:receiptKey},new Date(responseAt)));
  await writeFile(stateFile,JSON.stringify({settings:{...structuredClone(INITIAL_SETTINGS),masterEmail:master,ownerEmail:master,calendarId:'',driveRootFolderId:'',
    emailConfig:{roomReservationDepartmentEmail:currentDepartment,roomReservationEmailCentralized:true,auditEmailsEnabled:true}},
    processes:[p],memberships:[],authorizedStudents:[],signatureJobs:[],emailDeliveries,auditLogs:[]}));
  const inherited=Object.fromEntries(['PATH','HOME','TMPDIR','LANG','TZ'].filter(key=>process.env[key]).map(key=>[key,process.env[key]]));
  const cronSecret=randomBytes(40).toString('hex');
  const sessionSecret=randomBytes(40).toString('hex');
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
      FIXTURE_STATE_FILE:stateFile,FIXTURE_TRANSIENT_FAILURES:String(options.transientFailures||0),FIXTURE_HOLD_GMAIL:String(Boolean(options.fresh)),CRON_SECRET:cronSecret,
      PORTAL_PERSISTENCE_PROVIDER:'local_file',PORTAL_LOCAL_REVIEW_DATA:'false',PORTAL_ALLOW_INSECURE_DEMO_AUTH:'false',PORTAL_TEST_DOCUMENT_RENDERER:'false',
      PORTAL_ALLOW_LOCAL_OTP_STORE:'true',PORTAL_ALLOW_LOCAL_SECRET_STORE:'true',PORTAL_SESSION_SECRET:sessionSecret,PORTAL_OTP_PEPPER:randomBytes(40).toString('hex'),
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
    retryPending:async()=>{
      const saved=await state();const record=saved.emailDeliveries.find((row:EmailDeliveryRecord)=>row.idempotencyKey===receiptKey);
      const issuedAt=Math.floor(Date.now()/1000),payload=Buffer.from(JSON.stringify({sessionId:randomBytes(24).toString('base64url'),uid:'email:'+master,email:master,emailVerified:true,authTime:issuedAt,issuedAt,expiresAt:issuedAt+3600,isDemo:false,method:'EMAIL_OTP'})).toString('base64url');
      return fetch(base+'/api/admin/email-deliveries/'+record.id+'/retry',{method:'POST',headers:{'content-type':'application/json',origin:base,cookie:'portal_tcc_session='+payload+'.'+createHmac('sha256',sessionSecret).update(payload).digest('base64url')},body:'{}'});
    },
    replyPdf:(decision:string)=>{
      const token=reservationToken({processId:p.id,revision:0,recipient:currentDepartment,expiresAt:Date.now()+60000},sessionSecret);
      return fetch(base+'/api/reservation-confirmation/'+token,{method:'POST',redirect:'manual',signal:AbortSignal.timeout(5000),
        headers:{accept:'application/pdf','content-type':'application/x-www-form-urlencoded',origin:base},
        body:new URLSearchParams({decision,confirmed:'yes'})});
    },
    releaseGmail:()=>child!.send({kind:'release-gmail'}),
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

const recipientsTo=(raw:string)=>raw.match(/^To: (.*)\r?$/m)?.[1].trim().split(/,\s*/)||[];
const copies=(raw:string)=>raw.match(/^Cc: (.*)\r?$/m)?.[1].trim().split(/,\s*/)||[];
const decodedMessage=(raw:string)=>[...raw.matchAll(/Content-Transfer-Encoding: base64\r?\n\r?\n([A-Za-z0-9+/=\r\n]+)/g)]
  .map(part=>Buffer.from(part[1].replace(/\s/g,''),'base64').toString('utf8')).join('\n');

async function assertReceiptAttachment(raw:string,decision:'CONFIRMED'|'UNAVAILABLE'){
  const filename=decision==='CONFIRMED'?'comprovante-de-reserva':'comprovante-de-indisponibilidade';
  const escaped=raw.match(new RegExp(`Content-Disposition: attachment; filename="[^"]*-${filename}\\.pdf"\\r?\\n\\r?\\n([A-Za-z0-9+/=\\r\\n]+)`))?.[1];
  assert.ok(escaped,'the message includes the PDF attachment with a decision-specific filename');
  const pdf=Buffer.from(escaped.replace(/\s/g,''),'base64');
  assert.equal(pdf.subarray(0,4).toString(),'%PDF');
  const document=await PDFDocument.load(pdf,{updateMetadata:false});
  assert.match(document.getTitle()||'',decision==='CONFIRMED'?/comprovante de reserva/i:/indisponibilidade/i);
}

for(const [decision,opposite,outcome,templateId] of [
  ['decline','accept','UNAVAILABLE','email-local-indisponivel'],
  ['accept','decline','CONFIRMED','email-comprovante-reserva']
] as const) test(`HTTP: ${decision} registra uma resposta e envia o PDF na conversa original`, {timeout:45000}, async()=>{
  const f=await fixture({fresh:true,secondAuthor:true});
  try{
    const receipt=await f.replyPdf(decision);
    assert.equal(receipt.status,200);
    assert.equal(receipt.headers.get('x-reservation-decision'),outcome);
    assert.equal(Buffer.from(await receipt.arrayBuffer()).subarray(0,4).toString(),'%PDF');
    const saved=await f.state();
    assert.equal(saved.processes[0].defesa.departmentResponse.decision,outcome);
    assert.equal(saved.formArchiveJobs.length,1);
    const duplicate=await f.replyPdf(opposite);
    assert.equal(duplicate.status,409);
    assert.equal(duplicate.headers.get('x-reservation-decision'),outcome);
    const duplicateHtml=await duplicate.text();
    assert.match(duplicateHtml,outcome==='CONFIRMED'?/Reserva aceita/:/Reserva recusada/);
    assert.match(duplicateHtml,/Baixar comprovante/);
    assert.doesNotMatch(duplicateHtml,/Os dois botões|Resposta já registrada/);
    f.releaseGmail();
    const deadline=Date.now()+5000;
    while(Date.now()<deadline){
      const state=await f.state();
      const notices=state.emailDeliveries.filter((row:EmailDeliveryRecord)=>row.templateId===templateId);
      if(notices[0]?.status==='ACCEPTED_BY_GMAIL'){
        assert.equal(notices.length,1);
        assert.equal(f.sent.length,1);
        assert.deepEqual(recipientsTo(f.sent[0].raw).sort(),[student,advisor,'second-author@reservation-delivery.invalid',currentDepartment].sort());
        assert.deepEqual(copies(f.sent[0].raw),[master]);
        assert.equal(f.sent[0].threadId,'synthetic-reservation-request-owner-thread');
        assert.doesNotMatch(decodedMessage(f.sent[0].raw),/synthetic-personal-token/);
        assert.ok(f.sent[0].raw.includes(`In-Reply-To: <${f.requestDeliveries[0].rfcMessageId}>`));
        assert.ok(f.sent[0].raw.includes(`References: <${f.requestDeliveries[0].rfcMessageId}>`));
        assert.equal(notices[0].subject,f.requestDeliveries[0].subject);
        await assertReceiptAttachment(f.sent[0].raw,outcome);
        assert.match(decodedMessage(f.sent[0].raw),/O comprovante segue em PDF anexo/);
        return;
      }
      await new Promise(resolve=>setTimeout(resolve,25));
    }
    assert.fail('Aviso da reserva não foi concluído após liberar o Gmail.');
  }finally{await f.close();}
});

test('HTTP: cron delivers a persisted legacy refusal to the student and advisor without another department click, surviving restart without duplication',{timeout:45000},async()=>{
  const f=await fixture();
  try{
    assert.equal(f.sent.length,0);
    assert.deepEqual(await f.recover(),{checked:1,failed:0});
    assert.equal(f.sent.length,1);
    const message=f.sent[0],body=decodedMessage(message.raw);
    assert.equal(message.status,200);assert.equal(message.claimStatus,'RETRY');assert.equal(message.claimDispatchState,'SENDING');
    assert.deepEqual(recipientsTo(message.raw).sort(),[student,advisor,currentDepartment].sort());
    assert.deepEqual(copies(message.raw),[master]);
    assert.ok(recipientsTo(message.raw).includes(currentDepartment));
    assert.ok(!recipientsTo(message.raw).includes(previousDepartment),'the receipt uses the current contact, while preserving the original decision actor');
    assert.match(body,/agendamento solicitado|reserva recusada/);assert.match(body,/Refazer reserva/);assert.match(body,/evitar retrabalho/);
    assert.match(body,/É necessário solicitar novamente a reserva/);assert.match(body,/o mesmo TCC/);
    assert.match(body,/O código do TCC será mantido/);assert.match(body,/não criem outro trabalho/);
    assert.match(body,/href="http:\/\/127\.0\.0\.1:\d+\/\?tcc=reservation-delivery-process&amp;secao=geral"[^>]*>Refazer reserva<\/a>/);
    assert.equal(message.threadId,'synthetic-reservation-request-owner-thread');
    assert.ok(message.raw.includes(`In-Reply-To: <${f.requestDeliveries[0].rfcMessageId}>`));
    await assertReceiptAttachment(message.raw,'UNAVAILABLE');
    const saved=await f.state(),receipt=saved.emailDeliveries.find((row:EmailDeliveryRecord)=>row.idempotencyKey===receiptKey);
    assert.equal(saved.processes[0].defesa.departmentResponse.respondedBy,previousDepartment);
    assert.equal(saved.emailDeliveries.length,3);assert.equal(receipt.status,'ACCEPTED_BY_GMAIL');assert.equal(receipt.attempts.length,1);
    assert.equal(receipt.templateId,'email-local-indisponivel');assert.equal(receipt.workflowEventVariables.RESERVATION_DECISION,'UNAVAILABLE');
    assert.equal(receipt.subject,f.requestDeliveries[0].subject);
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
  const f=await fixture({transientFailures:1,pendingLegacyNotice:true});
  try{
    assert.deepEqual(await f.recover(),{checked:1,failed:1});assert.equal(f.sent.length,1);assert.equal(f.sent[0].status,503);
    const first=await f.state(),pending=first.emailDeliveries.find((row:EmailDeliveryRecord)=>row.idempotencyKey===receiptKey);
    assert.equal(pending.status,'RETRY');assert.equal(pending.dispatchState,undefined);assert.ok(pending.nextRetryAt);
    assert.equal(pending.attempts.length,1);assert.equal(pending.attempts[0].errorCode,'TRANSIENT_GMAIL_ERROR');
    assert.equal(Date.parse(pending.nextRetryAt)-Date.parse(pending.attempts[0].completedAt),60_000);
    assert.deepEqual(await f.recover(),{checked:0,failed:0});assert.equal(f.sent.length,1,'a future retry does not send early');
    await f.advance(61_000);
    assert.deepEqual(await f.recover(),{checked:1,failed:0});assert.equal(f.sent.length,2);
    assert.equal(f.sent[1].status,200);assert.equal(f.sent[1].threadId,'synthetic-reservation-request-owner-thread');
    await assertReceiptAttachment(f.sent[1].raw,'UNAVAILABLE');assert.equal(f.sent[1].claimDispatchState,'SENDING');
    const saved=await f.state(),receipt=saved.emailDeliveries.find((row:EmailDeliveryRecord)=>row.idempotencyKey===receiptKey);
    assert.equal(saved.processes[0].defesa.departmentResponse.respondedBy,previousDepartment);
    assert.equal(saved.emailDeliveries.length,3);assert.equal(receipt.id,pending.id);assert.equal(receipt.rfcMessageId,pending.rfcMessageId);
    assert.equal(receipt.status,'ACCEPTED_BY_GMAIL');assert.equal(receipt.attempts.length,2);assert.equal(receipt.nextRetryAt,undefined);
    assert.deepEqual(recipientsTo(f.sent[1].raw).sort(),[student,advisor,currentDepartment].sort());assert.deepEqual(copies(f.sent[1].raw),[master]);assert.match(decodedMessage(f.sent[1].raw),/Refazer reserva/);
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

test('HTTP: pedido sem dados da conversa aguarda retomada sem criar e-mail separado', {timeout:45000}, async()=>{
  const f=await fixture({noParentMetadata:true});
  try{
    assert.deepEqual(await f.recover(),{checked:1,failed:1});
    assert.equal(f.sent.length,0);
    const state=await f.state();
    assert.equal(state.processes[0].defesa.departmentResponse.decision,'UNAVAILABLE');
    assert.ok(state.auditLogs.some((event:any)=>event.action==='COMPROVANTE_AGUARDA_CONVERSA_ORIGINAL'));
  }finally{await f.close();}
});


test('HTTP: custom-location receipt goes directly to the authors and advisor, without adding the department',{timeout:45000},async()=>{
  const f=await fixture({customLocation:true,secondAuthor:true});
  try{
    assert.deepEqual(await f.recover(),{checked:1,failed:0});
    assert.equal(f.sent.length,1);
    assert.deepEqual(recipientsTo(f.sent[0].raw).sort(),[student,advisor,'second-author@reservation-delivery.invalid'].sort());
    assert.deepEqual(copies(f.sent[0].raw),[master]);
    assert.ok(!recipientsTo(f.sent[0].raw).includes(currentDepartment));
    assert.ok(!recipientsTo(f.sent[0].raw).includes(previousDepartment));
    assert.equal(f.sent[0].threadId,'synthetic-reservation-request-owner-thread');
    await f.restart();await f.recover();assert.equal(f.sent.length,1);
    assert.deepEqual(f.unexpected,[]);
  }finally{await f.close();}
});


test('HTTP: pending participant-primary receipt gains the current department as a direct recipient without replaying an acknowledgement',{timeout:45000},async()=>{
  const f=await fixture({secondAuthor:true,pendingParticipantNotice:true});
  try{
    assert.deepEqual(await f.recover(),{checked:1,failed:0});
    assert.equal(f.sent.length,1);
    assert.deepEqual(recipientsTo(f.sent[0].raw).sort(),[student,advisor,'second-author@reservation-delivery.invalid',currentDepartment].sort());
    assert.deepEqual(copies(f.sent[0].raw),[master]);
    assert.ok(!f.sent[0].raw.includes(previousDepartment));
    const state=await f.state();
    assert.equal(state.processes[0].defesa.departmentResponse.respondedBy,previousDepartment);
    await f.restart();await f.recover();assert.equal(f.sent.length,1);
  }finally{await f.close();}
});


test('HTTP: Master retry migrates an unsent legacy department-primary receipt before generic recipient checks',{timeout:45000},async()=>{
  const f=await fixture({secondAuthor:true,pendingLegacyNotice:true});
  try{
    const retry=await f.retryPending();assert.equal(retry.status,200,await retry.clone().text());
    assert.equal(f.sent.length,1);
    assert.deepEqual(recipientsTo(f.sent[0].raw).sort(),[student,advisor,'second-author@reservation-delivery.invalid',currentDepartment].sort());
    assert.deepEqual(copies(f.sent[0].raw),[master]);
    assert.equal(f.sent[0].threadId,'synthetic-reservation-request-owner-thread');
    assert.equal((await f.retryPending()).status,200);assert.equal(f.sent.length,1);
    assert.equal((await f.state()).processes[0].defesa.departmentResponse.respondedBy,previousDepartment);
    assert.deepEqual(f.unexpected,[]);
  }finally{await f.close();}
});
