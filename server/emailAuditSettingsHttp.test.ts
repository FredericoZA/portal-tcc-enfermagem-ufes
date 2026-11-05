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

async function fixture(options:{auditEmailsEnabled?:boolean;installationId?:string;otpDeliveryMode?:'gmail'|'log'}={}){
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

const cc=(raw:string)=>raw.match(/^Cc: (.*)\r?$/m)?.[1].trim().split(/,\s*/)||[];
const decodedMessage=(raw:string)=>[...raw.matchAll(/Content-Transfer-Encoding: base64\r?\n\r?\n([A-Za-z0-9+/=\r\n]+)/g)]
  .map(part=>Buffer.from(part[1].replace(/\s/g,''),'base64').toString('utf8')).join('\n');

test('HTTP: login copies the full OTP message to the configured Master only while auditing is enabled',{timeout:45000},async()=>{
  const f=await fixture({auditEmailsEnabled:true,otpDeliveryMode:'gmail'});
  try{
    const requestCode=async(email:string)=>{
      const response=await f.request('/api/auth/request-code','','POST',{email,auditCopyEmail:'foreign-auditor@audit-settings.invalid'});
      assert.equal(response.status,200,await response.clone().text());
      assert.equal((await response.json()).sent,true);
    };
    await requestCode(student);
    const message=(await f.messages(1))[0];
    assert.deepEqual(cc(message),[master]);
    assert.match(message,new RegExp(`^To: ${student.replaceAll('.','\\.')}\\r?$`,'m'));
    const body=decodedMessage(message);
    const code=body.match(/Seu código de acesso é (\d{6})/)?.[1];
    assert.ok(code);assert.ok(body.includes(`>${code}</div>`));
    const recorded=(await f.state()).auditLogs.find((log:any)=>log.action==='EMAIL_CODIGO_ACESSO_ACEITO_GMAIL');
    assert.deepEqual(recorded.after.cc,[master]);
    assert.ok(!JSON.stringify(recorded).includes(code));
    await f.toggle(false);
    await requestCode(examiner);
    assert.deepEqual(cc((await f.messages(2))[1]),[]);
    await f.toggle(true);
    await requestCode(master);
    assert.deepEqual(cc((await f.messages(3))[2]),[],'o Master já recebe a mensagem como destinatário');
    assert.ok(f.sent.every(raw=>!cc(raw).includes('foreign-auditor@audit-settings.invalid')));
    assert.deepEqual(f.unexpected,[]);
  }finally{await f.close();}
});

test('HTTP: only Master can change the boolean audit switch, preserving configuration and persisted choice',{timeout:45000},async()=>{
  const f=await fixture({auditEmailsEnabled:false});
  try{
    for(const [email,status]of [['',401],[student,403],[examiner,403],[president,403]] as const){
      const response=await f.request('/api/admin/settings',email,'PATCH',{emailConfig:{auditEmailsEnabled:true}});assert.equal(response.status,status,email||'guest');
      assert.equal((await f.settings()).emailConfig.auditEmailsEnabled,false);
    }
    await f.toggle(true);
    for(const body of [null,[],false,'disabled',0])assert.equal((await f.request('/api/admin/settings',master,'PATCH',body)).status,400);
    for(const value of [null,'false',0,1,[],{}])assert.equal((await f.request('/api/admin/settings',master,'PATCH',{emailConfig:{auditEmailsEnabled:value}})).status,400);
    for(const email of [master,president])for(const value of [null,[],false,'disabled',0])assert.equal((await f.request('/api/admin/settings',email,'PATCH',{emailConfig:value})).status,400);
    assert.equal((await f.request('/api/admin/settings',master,'PATCH',{emailConfig:{auditCopyEmail:'foreign-destination@audit-settings.invalid'}})).status,400);
    assert.deepEqual((await f.settings()).emailConfig,{...preservedEmailConfig,auditEmailsEnabled:true});
    const normal=await f.request('/api/admin/settings',president,'PATCH',{emailConfig:{senderLabel:'Updated sender'}});assert.equal(normal.status,200);
    await f.toggle(false);await f.restart();
    assert.deepEqual((await f.settings()).emailConfig,{...preservedEmailConfig,senderLabel:'Updated sender',auditEmailsEnabled:false});
    assert.equal((await f.state()).settings.emailConfig.auditEmailsEnabled,false);
    assert.deepEqual(f.sent,[]);assert.deepEqual(f.unexpected,[]);
  }finally{await f.close();}
});

test('HTTP: audit ON and OFF control actual MIME copies for new messages and older retries copying personal codes only to the Master',{timeout:45000},async()=>{
  const f=await fixture();
  try{
    await f.retry(0);assert.deepEqual(cc((await f.messages(1))[0]),[advisor,master]);
    await f.toggle(false);
    await f.retry(1);assert.deepEqual(cc((await f.messages(2))[1]),[advisor]);
    const oldOff=await f.retry(2);assert.deepEqual(cc((await f.messages(3))[2]),[advisor]);assert.equal(oldOff.auditCopyEmail,undefined);
    await f.retry(0);assert.equal(f.sent.length,3,'a policy change does not resend an already accepted message');
    await f.toggle(true);
    const oldOn=await f.retry(3);assert.deepEqual(cc((await f.messages(4))[3]),[advisor,master]);assert.equal(oldOn.auditCopyEmail,master);
    const sensitive=await f.retry(4);assert.deepEqual(cc((await f.messages(5))[4]),[master]);assert.equal(sensitive.auditCopyMode,'sensitive');assert.match(decodedMessage(f.sent[4]),/Seu código de acesso é 123456/);
    assert.ok(f.sent.every(raw=>!cc(raw).includes(previousMaster)&&!cc(raw).includes('ignored-destination@audit-settings.invalid')));
    assert.deepEqual(f.unexpected,[]);
  }finally{await f.close();}
});

test('HTTP: replicated installations default to no audit copy and opt in only to their own Master mailbox',{timeout:45000},async()=>{
  const f=await fixture({installationId:'another-course'});
  try{
    await f.retry(0);assert.deepEqual(cc((await f.messages(1))[0]),[advisor]);
    await f.toggle(true);await f.retry(1);assert.deepEqual(cc((await f.messages(2))[1]),[advisor,master]);
    assert.ok(f.sent.every(raw=>!cc(raw).includes('tccenfermagemufes@gmail.com')));
    assert.deepEqual(f.unexpected,[]);
  }finally{await f.close();}
});

test('HTTP: restoring history or a backup cannot change the current audit policy indirectly',{timeout:45000},async()=>{
  const f=await fixture({auditEmailsEnabled:false});
  const restoreBackup=async(enabled:boolean)=>{
    const exported=await f.request('/api/admin/backup');assert.equal(exported.status,200);
    const backup=await exported.json();backup.settings.emailConfig.auditEmailsEnabled=enabled;
    const preview=await f.request('/api/admin/restore-full-backup',president,'POST',backup);assert.equal(preview.status,200,await preview.clone().text());
    const confirmation=await preview.json();assert.equal(confirmation.requiresConfirmation,true);
    const restored=await f.request('/api/admin/restore-full-backup',president,'POST',{...backup,confirmHash:confirmation.confirmHash});assert.equal(restored.status,200,await restored.clone().text());
  };
  try{
    assert.equal((await f.request('/api/admin/rollback-log/historical-audit-true',president,'POST',{})).status,200);
    assert.equal((await f.settings()).emailConfig.auditEmailsEnabled,false);
    await restoreBackup(true);assert.equal((await f.settings()).emailConfig.auditEmailsEnabled,false);
    await f.toggle(true);
    assert.equal((await f.request('/api/admin/rollback-log/historical-audit-false',president,'POST',{})).status,200);
    assert.equal((await f.settings()).emailConfig.auditEmailsEnabled,true);
    await restoreBackup(false);assert.equal((await f.settings()).emailConfig.auditEmailsEnabled,true);
    await f.restart();assert.equal((await f.state()).settings.emailConfig.auditEmailsEnabled,true);
    assert.deepEqual(f.sent,[]);assert.deepEqual(f.unexpected,[]);
  }finally{await f.close();}
});
