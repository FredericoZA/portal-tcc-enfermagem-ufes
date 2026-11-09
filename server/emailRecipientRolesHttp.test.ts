import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn,type ChildProcess} from 'node:child_process';
import {createHmac,randomBytes} from 'node:crypto';
import {createServer} from 'node:net';
import {mkdtemp,readFile,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {DEMO_PROCESSES,INITIAL_SETTINGS} from '../src/services/demoSeed';
import {initialEmailDelivery} from './integrations/trackedGmail';
import {courseStudioFixture} from './fixtures/courseStudioFixture';
import {withOperationalCatalog} from '../src/utils/studioOperationalCatalog';
import {MANAGED_DEFENSE_LOCATIONS} from '../src/utils/reservationLocation';

const master='master@audit-settings.invalid';
const president='president@audit-settings.invalid';
const student='student@audit-settings.invalid';
const examiner='examiner@audit-settings.invalid';
const advisor='advisor@audit-settings.invalid';
const previousMaster='former-master@audit-settings.invalid';
const recipient='recipient@audit-settings.invalid';
const preservedEmailConfig={roomReservationDepartmentEmail:'department@audit-settings.invalid',senderLabel:'Preserved sender',replyTo:'reply@audit-settings.invalid'};

const isolatedRuntime=String.raw`
import dotenv from 'dotenv';
dotenv.config=()=>({parsed:{}});
let messages=0;
globalThis.fetch=async(input,init={})=>{
  const url=new URL(typeof input==='string'||input instanceof URL?String(input):input.url);
  if(url.href==='https://oauth2.googleapis.com/token')return Response.json({access_token:'synthetic-access-token',expires_in:3600});
  if(url.href==='https://gmail.googleapis.com/gmail/v1/users/me/messages/send'){
    const body=JSON.parse(String(init.body));
    process.send?.({kind:'gmail',raw:Buffer.from(body.raw,'base64url').toString('utf8')});
    return Response.json({id:'synthetic-message-'+(++messages),threadId:'synthetic-thread'});
  }
  process.send?.({kind:'unexpected-network',origin:url.origin});
  throw new Error('External providers are blocked in this fixture.');
};
const {saveIntegrationSecret}=await import('./server/integrations/integrationSecrets.ts');
await saveIntegrationSecret('google_workspace','synthetic-refresh-token',{email:'sender@audit-settings.invalid'});
await import('./server.ts');
`;

async function fixture(options:{auditEmailsEnabled?:boolean;installationId?:string;otpDeliveryMode?:'gmail'|'log';recoveryScope?:boolean}={}){
  const directory=await mkdtemp(path.join(tmpdir(),'portal-email-audit-http-'));
  const stateFile=path.join(directory,'portal-state.json');
  const secret=randomBytes(40).toString('hex');
  const process=structuredClone(DEMO_PROCESSES[0]);process.id='audit-settings-process';process.aluno1.email=student;process.aluno2=null;process.orientador.email=advisor;
  const mail=(key:string,text='Aviso operacional de teste sem credenciais.')=>initialEmailDelivery({processId:process.id,protocol:process.protocolo,recipient,cc:[advisor],subject:`Aviso de Teste ${key}`,text,templateId:'fixture-audit-operational',idempotencyKey:`audit-setting-${key}`},new Date('2026-01-01T12:00:00Z'));
  const oldMail=(key:string)=>{const record={...mail(key),cc:[advisor,previousMaster],auditCopyEmail:previousMaster,auditCopyMode:'operational' as const};delete record.workflowCc;return record;};
  const deliveries=[mail('on'),mail('off'),oldMail('old-off'),oldMail('old-on'),mail('sensitive','Seu código de acesso é 123456. Ele expira em 10 minutos.')];
  const state={settings:{...structuredClone(INITIAL_SETTINGS),masterEmail:master,ownerEmail:master,commissionPresidentEmail:president,calendarId:'',driveRootFolderId:'',
      ...(options.installationId?{installationProfile:{...structuredClone(INITIAL_SETTINGS.installationProfile),installationId:options.installationId}}:{}),
      emailConfig:{...preservedEmailConfig,...(options.auditEmailsEnabled===undefined?{}:{auditEmailsEnabled:options.auditEmailsEnabled})}},
    processes:[process],memberships:[{id:'student-membership',processId:process.id,email:student,roles:['STUDENT'],active:true},{id:'examiner-membership',processId:process.id,email:examiner,roles:['EXAMINER'],active:true}],
    authorizedStudents:[student,examiner].map((email,index)=>({id:`audit-access-${index}`,email,nome:'Pessoa de Teste',active:true,roles:[index?'EXAMINER':'STUDENT'],accessType:index?'EXAMINER':'STUDENT',origin:'MASTER_LIST',processIds:[process.id],createdBy:master,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()})),
    signatureJobs:[],emailDeliveries:deliveries,auditLogs:[false,true].map(enabled=>({id:`historical-audit-${enabled}`,action:'ALTERACAO_CONFIGURACOES',entityType:'settings',entityId:'global',actorEmail:master,actorRoles:['MASTER_ADMIN'],timestamp:'2026-01-01T12:00:00Z',before:{emailConfig:{...preservedEmailConfig,auditEmailsEnabled:enabled}}}))};
  if(options.recoveryScope){
    const other={...structuredClone(process),id:'other-recovery-process',protocolo:'TCC - 00999'};
    state.processes.push(other);
    const scopedState=state as typeof state & {reminders:unknown[]};
    scopedState.reminders=[process,other].map(p=>({id:'reminder-'+p.id,processId:p.id,status:'FAILED',recipient,ordinal:1,dueDate:'2026-01-01',policyId:'fixture',milestone:'fixture'}));
    for(const p of [process,other])state.emailDeliveries.push({...mail('reminder-'+p.id),id:'delivery-'+p.id,processId:p.id,idempotencyKey:'reminder:reminder-'+p.id,status:'ACCEPTED_BY_GMAIL'});
    state.emailDeliveries.push({...mail('other-process'),id:'other-pending-email',processId:other.id});
  }
  const studio=withOperationalCatalog(courseStudioFixture());
  studio.emailTemplates.find((item:any)=>item.id==='email-reserva')!.recipient=preservedEmailConfig.roomReservationDepartmentEmail;
  const custom={id:'role-custom',name:'Aviso por papéis',recipient:'legacy@example.invalid',subject:'Aviso de papéis',body:'Mensagem operacional sem ações pessoais.',recipientRoles:['COMMISSION_PRESIDENT'],ccRoles:['AUTHORS']};
  studio.emailTemplates.push(custom as any);
  studio.workflowStages.push({id:'role-stage',name:'Aviso por papéis',triggerEvent:'ROLE_NOTICE',actions:[{id:'role-action',type:'email',refId:'role-custom'}]});
  (state.settings as any).integrationStudio=studio;
  (state as any).workflowRuns=[{id:'role-run',processId:process.id,protocol:process.protocolo,studioRevision:studio.revision,eventCode:'ROLE_NOTICE',startedAt:new Date().toISOString(),status:'FAILED',actions:[],issues:[],sourceDataRevision:process.dataRevision,actorEmail:master}];
  state.emailDeliveries.push(initialEmailDelivery({processId:process.id,protocol:process.protocolo,recipient:president,cc:[student],workflowCc:[student],subject:'Aviso pendente por papéis',text:'Mensagem pendente.',templateId:'role-custom',idempotencyKey:'role-unsent'}));
  await writeFile(stateFile,JSON.stringify(state));
  const inherited=Object.fromEntries(['PATH','HOME','TMPDIR','LANG','TZ'].filter(key=>globalThis.process.env[key]).map(key=>[key,globalThis.process.env[key]]));
  let child:ChildProcess|undefined;
  let base='',output='';
  const sent:string[]=[],unexpected:string[]=[];
  const stop=async()=>{if(child&&child.exitCode===null&&child.signalCode===null){const ended=new Promise<void>(resolve=>child!.once('exit',()=>resolve()));child.kill('SIGTERM');await ended;}};
  const start=async()=>{
    const socket=createServer();await new Promise<void>(resolve=>socket.listen(0,'127.0.0.1',resolve));
    const port=(socket.address() as {port:number}).port;await new Promise<void>((resolve,reject)=>socket.close(error=>error?reject(error):resolve()));
    base=`http://127.0.0.1:${port}`;
    child=spawn(globalThis.process.execPath,['--import','tsx','--input-type=module','-e',isolatedRuntime],{cwd:globalThis.process.cwd(),env:{...inherited,NODE_ENV:'development',HOST:'127.0.0.1',PORT:String(port),VERCEL:'',PORTAL_DATA_DIR:directory,
      PORTAL_PUBLIC_URL:base,APP_URL:base,PORTAL_PERSISTENCE_PROVIDER:'local_file',PORTAL_LOCAL_REVIEW_DATA:'false',PORTAL_ALLOW_INSECURE_DEMO_AUTH:'false',PORTAL_TEST_DOCUMENT_RENDERER:'false',
      PORTAL_ALLOW_LOCAL_OTP_STORE:'true',PORTAL_ALLOW_LOCAL_SECRET_STORE:'true',PORTAL_SESSION_SECRET:secret,PORTAL_OTP_PEPPER:randomBytes(40).toString('hex'),PORTAL_SECRET_ENCRYPTION_KEY:randomBytes(32).toString('hex'),
      PORTAL_OTP_DELIVERY_MODE:options.otpDeliveryMode||'log',ASTEN_INTEGRATION_ENABLED:'false',SUPABASE_URL:'',SUPABASE_SECRET_KEY:'',SUPABASE_SERVICE_ROLE_KEY:'',GOOGLE_OAUTH_CLIENT_ID:'synthetic-client',GOOGLE_OAUTH_CLIENT_SECRET:'synthetic-client-secret'},stdio:['ignore','pipe','pipe','ipc']});
    child.stdout?.on('data',chunk=>{output=(output+chunk).slice(-4000);});child.stderr?.on('data',chunk=>{output=(output+chunk).slice(-4000);});
    child.on('message',(message:unknown)=>{if(!message||typeof message!=='object')return;const event=message as {kind?:string;raw?:string;origin?:string};if(event.kind==='gmail'&&event.raw)sent.push(event.raw);if(event.kind==='unexpected-network'&&event.origin)unexpected.push(event.origin);});
    const deadline=Date.now()+20000;
    while(Date.now()<deadline){try{if((await fetch(base+'/api/health')).ok)return;}catch{}if(child.exitCode!==null)break;await new Promise(resolve=>setTimeout(resolve,100));}
    throw new Error('Email audit fixture did not start: '+output);
  };
  const session=(email:string)=>{const issuedAt=Math.floor(Date.now()/1000),payload=Buffer.from(JSON.stringify({sessionId:randomBytes(24).toString('base64url'),uid:`email:${email}`,email,emailVerified:true,authTime:issuedAt,issuedAt,expiresAt:issuedAt+3600,isDemo:false,method:'EMAIL_OTP'})).toString('base64url');return `portal_tcc_session=${payload}.${createHmac('sha256',secret).update(payload).digest('base64url')}`;};
  try{await start();}catch(error){await stop();await rm(directory,{recursive:true,force:true});throw error;}
  const request=(route:string,email=master,method='GET',body?:unknown)=>fetch(base+route,{method,headers:{'Content-Type':'application/json',Origin:base,...(email?{cookie:session(email)}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});
  return {request,sent,unexpected,deliveries,
    state:async()=>JSON.parse(await readFile(stateFile,'utf8')),
    settings:async()=>{const response=await request('/api/settings');assert.equal(response.status,200);return response.json();},
    toggle:async(enabled:boolean)=>{const response=await request('/api/admin/settings',master,'PATCH',{emailConfig:{auditEmailsEnabled:enabled}});assert.equal(response.status,200,await response.clone().text());},
    retry:async(index:number)=>{const response=await request(`/api/admin/email-deliveries/${deliveries[index].id}/retry`,master,'POST',{auditCopyEmail:'ignored-destination@audit-settings.invalid'});assert.equal(response.status,200,await response.clone().text());return response.json();},
    messages:async(count:number)=>{const deadline=Date.now()+5000;while(sent.length<count&&Date.now()<deadline)await new Promise(resolve=>setTimeout(resolve,20));assert.equal(sent.length,count);return sent;},
    restart:async()=>{await stop();await start();},
    close:async()=>{await stop();await rm(directory,{recursive:true,force:true});},
  };
}

const directTo=(raw:string)=>raw.match(/^To: (.*)\r?$/m)?.[1].trim().split(/,\s*/)||[];
const cc=(raw:string)=>raw.match(/^Cc: (.*)\r?$/m)?.[1].trim().split(/,\s*/)||[];
const decodedMessage=(raw:string)=>[...raw.matchAll(/Content-Transfer-Encoding: base64\r?\n\r?\n([A-Za-z0-9+/=\r\n]+)/g)]
  .map(part=>Buffer.from(part[1].replace(/\s/g,''),'base64').toString('utf8')).join('\n');

test('HTTP role selections publish, survive restart, drive one grouped stage email and reject stale recipient retry',{timeout:65000},async()=>{
 const f=await fixture({auditEmailsEnabled:false});
 try{
  const settings=await f.settings();const studio=structuredClone(settings.integrationStudio);const expectedRevision=studio.revision;studio.revision++;
  const ids=['email-reserva-autores','email-comprovante-reserva','email-local-indisponivel','email-convite','email-entrega-repositorio','email-assinatura-termo','email-conclusao'];
  for(const id of ids){const template=studio.emailTemplates.find((item:any)=>item.id===id);assert.ok(template,id);template.recipientRoles=id==='email-convite'?['EXAMINERS','COMMISSION_PRESIDENT']:['COMMISSION_PRESIDENT'];template.ccRoles=['AUTHORS'];}
  const published=await f.request('/api/admin/settings',master,'PATCH',{integrationStudio:studio,studioExpectedRevision:expectedRevision,studioSaveMode:'publish'});
  assert.equal(published.status,200,await published.clone().text());
  await f.restart();const readback=await f.settings();
  for(const id of ids){const template=readback.integrationStudio.emailTemplates.find((item:any)=>item.id===id);assert.deepEqual(template.recipientRoles,id==='email-convite'?['EXAMINERS','COMMISSION_PRESIDENT']:['COMMISSION_PRESIDENT']);assert.deepEqual(template.ccRoles,['AUTHORS']);}
  const native=readback.integrationStudio.emailTemplates.find((item:any)=>item.id==='email-reserva');assert.equal(native.recipientRoles,undefined,'opening and publishing unrelated defaults does not migrate legacy selection');
  const result=await f.request('/api/admin/workflow/runs/role-run/retry',master,'POST',{reviewedStudioRevision:readback.integrationStudio.revision});
  assert.equal(result.status,200,await result.clone().text());await f.messages(1);
  assert.deepEqual(directTo(f.sent[0]),[president]);assert.deepEqual(cc(f.sent[0]),[student]);assert.ok(!f.sent[0].includes(master),'disabled audit does not add Master');
  const state=await f.state();const delivery=state.emailDeliveries.find((item:any)=>item.templateId==='role-custom'&&item.status==='ACCEPTED_BY_GMAIL');assert.ok(delivery);assert.deepEqual(delivery.additionalRecipients||[],[]);assert.deepEqual(delivery.workflowCc,[student]);
  const next=structuredClone(readback.integrationStudio);next.revision++;next.emailTemplates.find((item:any)=>item.id==='role-custom').recipientRoles=['ADVISOR'];
  const changed=await f.request('/api/admin/settings',master,'PATCH',{integrationStudio:next,studioExpectedRevision:readback.integrationStudio.revision,studioSaveMode:'publish'});assert.equal(changed.status,200,await changed.clone().text());
  const unsent=state.emailDeliveries.find((item:any)=>item.idempotencyKey==='role-unsent');
  const blocked=await f.request('/api/admin/email-deliveries/'+unsent.id+'/retry',master,'POST',{});assert.equal(blocked.status,409,await blocked.clone().text());assert.equal((await blocked.json()).code,'EMAIL_RECIPIENT_CHANGED');assert.equal(f.sent.length,1);
  // The accepted record is immutable and never replayed; changing recipient roles cannot send another message.
  const replay=await f.request('/api/admin/email-deliveries/'+delivery.id+'/retry',master,'POST',{});assert.equal(replay.status,200);assert.equal(f.sent.length,1);
  assert.deepEqual(f.unexpected,[]);
 }finally{await f.close();}
});

test('Teste das integrações envia só ao Master, limita repetição e não cria processo nem assinatura',async()=>{
 const f=await fixture();try{
  const before=await f.state();
  for(const email of ['',student,president]){const denied=await f.request('/api/integrations/homologation',email,'POST',{});assert.ok([401,403].includes(denied.status));}
  const response=await f.request('/api/integrations/homologation',master,'POST',{recipient:student});assert.equal(response.status,200,await response.clone().text());
  const report=await response.json();assert.equal(report.checks.find((check:any)=>check.id==='gmail')?.status,'PASS');assert.equal(report.readyForProduction,false);
  const messages=await f.messages(1);assert.match(messages[0],new RegExp(`To: ${master}`));assert.doesNotMatch(messages[0],/^Cc:/mi);assert.doesNotMatch(messages[0],new RegExp(student));
  const again=await f.request('/api/integrations/homologation',master,'POST',{});assert.equal(again.status,200);await f.messages(1);
  const after=await f.state();assert.deepEqual(after.processes,before.processes);assert.deepEqual(after.signatureJobs,before.signatureJobs);
 }finally{await f.close();}
});
