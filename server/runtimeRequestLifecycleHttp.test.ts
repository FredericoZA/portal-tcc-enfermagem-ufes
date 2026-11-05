import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn,type ChildProcess} from 'node:child_process';
import {request as httpRequest} from 'node:http';
import {once} from 'node:events';
import {createServer} from 'node:net';
import {mkdtemp,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {INITIAL_SETTINGS,DEMO_PROCESSES} from '../src/services/demoSeed';
import {initialEmailDelivery} from './integrations/trackedGmail';
import {createPortalHttpApp,portalHttpError} from './httpApp';
import {attachRuntimeRequestLifecycle,createRuntimeRequestQueue} from './runtimeRequestQueue';

const wait=(milliseconds:number)=>new Promise<void>(resolve=>setTimeout(resolve,milliseconds));

async function waitUntil(condition:()=>boolean,timeout=15_000):Promise<void>{
  const deadline=Date.now()+timeout;
  while(!condition()){
    if(Date.now()>deadline)throw new Error('A operação isolada não terminou no prazo.');
    await wait(10);
  }
}

test('middleware síncrona, rejeição e erro síncrono concluem o ciclo sem bloquear o próximo pedido',async()=>{
  const app=createPortalHttpApp(),acquire=createRuntimeRequestQueue();
  let hydrated=0,released=0;
  app.use(async(req,res,next)=>{
    const release=await acquire();
    const lifecycle=attachRuntimeRequestLifecycle(req,()=>{released++;release();});
    res.once('finish',lifecycle.responseFinished);
    res.once('close',lifecycle.responseFinished);
    try{hydrated++;next();}finally{lifecycle.hydrationFinished();}
  });
  app.use((_req,_res,next)=>next());
  app.get('/sync',(_req,res)=>res.json({ok:true}));
  app.get('/throw',()=>{throw new Error('Erro síncrono isolado.');});
  app.get('/reject',async()=>{await Promise.resolve();throw new Error('Erro assíncrono isolado.');});
  app.use(portalHttpError);
  const server=app.listen(0,'127.0.0.1');
  await once(server,'listening');
  const address=server.address();assert.ok(address&&typeof address==='object');
  const base=`http://127.0.0.1:${address.port}`;
  try{
    for(const [endpoint,status] of [['/sync',200],['/throw',500],['/reject',500],['/sync',200]] as const){
      assert.equal((await fetch(base+endpoint)).status,status);
    }
    await waitUntil(()=>released===4);
    assert.equal(hydrated,4);
  }finally{
    server.closeAllConnections();
    await new Promise<void>(resolve=>server.close(()=>resolve()));
  }
});

const isolatedRuntime=String.raw`
import dotenv from 'dotenv';
import {readFile} from 'node:fs/promises';
dotenv.config=()=>({parsed:{}});
let payload=JSON.parse(await readFile(process.env.FIXTURE_STATE_FILE,'utf8'));
let revision=1,reads=0,gmailCalls=0,commits=0,postSendCommitHeld=false;
const secrets=new Map(),gmailGates=new Map();
let commitGate;
const emit=value=>process.send?.(value);
process.on('message',message=>{
 if(message?.kind==='release-gmail')gmailGates.get(message.id)?.();
 if(message?.kind==='release-commit')commitGate?.();
 if(message?.kind==='snapshot')emit({kind:'snapshot',reads,gmailCalls,commits,deliveries:payload.emailDeliveries.map(row=>({id:row.id,status:row.status,attempts:row.attempts.length}))});
});
globalThis.fetch=async(input,init={})=>{
 const url=new URL(String(input));
 if(url.hostname==='database.fixture.invalid'){
  if(url.pathname.endsWith('/portal_integration_secrets')){
   if(init.method==='POST'){const row=JSON.parse(String(init.body));secrets.set(row.provider,row);return new Response(null,{status:201});}
   const provider=(url.searchParams.get('provider')||'').replace(/^eq\./,'');
   return Response.json(secrets.has(provider)?[structuredClone(secrets.get(provider))]:[]);
  }
  if(url.pathname.endsWith('/portal_runtime_state')){reads++;emit({kind:'hydrate',reads});return Response.json([{payload:structuredClone(payload),revision}]);}
  if(url.pathname.endsWith('/portal_commit_runtime_state')){
   const next=JSON.parse(String(init.body));
   if(next.expected_revision!==revision)return Response.json({code:'PT409'},{status:409});
   if(gmailCalls>0&&!postSendCommitHeld){postSendCommitHeld=true;emit({kind:'commit-waiting'});await new Promise(resolve=>{commitGate=resolve;});}
   payload=structuredClone(next.next_payload);commits++;emit({kind:'committed',commits});return Response.json(++revision);
  }
  if(url.pathname.endsWith('/portal_audit_events'))return new Response(null,{status:201});
  throw new Error('Operação de banco inesperada na execução isolada.');
 }
 if(url.hostname==='oauth2.googleapis.com')return Response.json({access_token:'fixture-only-access-token',expires_in:3600});
 if(url.hostname==='gmail.googleapis.com'){
  const id=++gmailCalls;
  emit({kind:'gmail-waiting',id});
  await new Promise(resolve=>gmailGates.set(id,resolve));
  return Response.json({id:'synthetic-'+id,threadId:'synthetic-thread'});
 }
 throw new Error('Rede externa bloqueada nesta execução isolada.');
};
const {saveIntegrationSecret}=await import('./server/integrations/integrationSecrets.ts');
await saveIntegrationSecret('google_workspace','fixture-only-refresh',{email:'sender@fixture.invalid'});
await import('./server.ts');
`;

test('HTTP: desconexão durante envio mantém exclusão até Gmail e commit, sem repetir a mensagem aceita',{timeout:30_000},async()=>{
  const directory=await mkdtemp(path.join(tmpdir(),'portal-request-lifecycle-'));
  const processFixture=structuredClone(DEMO_PROCESSES[0]);processFixture.id='request-lifecycle-fixture';
  const delivery=initialEmailDelivery({processId:processFixture.id,protocol:processFixture.protocolo,recipient:processFixture.aluno1.email,
    subject:'Envio sintético isolado',text:'Mensagem sintética sem links pessoais.',templateId:'fixture-operational',idempotencyKey:'request-lifecycle-mail'});
  const state={settings:structuredClone(INITIAL_SETTINGS),processes:[processFixture],signatureJobs:[],memberships:[],emailDeliveries:[delivery],auditLogs:[]};
  const statePath=path.join(directory,'portal-state.json');
  await writeFile(statePath,JSON.stringify(state).replace(/data:image\/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+/=]+/g,'/fixture-image.png'));
  const socket=createServer();await new Promise<void>(resolve=>socket.listen(0,'127.0.0.1',resolve));
  const address=socket.address();assert.ok(address&&typeof address==='object');const port=address.port;
  await new Promise<void>(resolve=>socket.close(()=>resolve()));
  const base=`http://127.0.0.1:${port}`,events:Array<Record<string,any>>=[];
  const baseEnvironment=Object.fromEntries(['PATH','HOME','TMPDIR','LANG','TZ'].filter(key=>globalThis.process.env[key]).map(key=>[key,globalThis.process.env[key]]));
  const child:ChildProcess=spawn(globalThis.process.execPath,['--import','tsx','--input-type=module','-e',isolatedRuntime],{
    cwd:globalThis.process.cwd(),env:{...baseEnvironment,NODE_ENV:'development',HOST:'127.0.0.1',PORT:String(port),VERCEL:'',
      APP_URL:base,PORTAL_PUBLIC_URL:base,PORTAL_SERVE_COMPILED_CLIENT:'true',PORTAL_DATA_DIR:directory,FIXTURE_STATE_FILE:statePath,
      PORTAL_PERSISTENCE_PROVIDER:'supabase',PORTAL_ALLOW_INSECURE_DEMO_AUTH:'true',PORTAL_ALLOW_LOCAL_OTP_STORE:'true',PORTAL_ALLOW_LOCAL_SECRET_STORE:'true',
      PORTAL_SESSION_SECRET:'fixture-only-session-1234567890123456789012',PORTAL_OTP_PEPPER:'fixture-only-otp-1234567890123456789012345',
      SUPABASE_URL:'https://database.fixture.invalid',SUPABASE_SECRET_KEY:'sb_secret_' + 'fixture_only_not_a_real_key',SUPABASE_SERVICE_ROLE_KEY:'',
      PORTAL_SECRET_ENCRYPTION_KEY:'12'.repeat(32),GOOGLE_OAUTH_CLIENT_ID:'fixture-only-id',GOOGLE_OAUTH_CLIENT_SECRET:'fixture-only-client',
      ASTEN_INTEGRATION_ENABLED:'false',PORTAL_OTP_DELIVERY_MODE:'log'},stdio:['ignore','pipe','pipe','ipc'],
  });
  let output='';
  child.stdout?.on('data',chunk=>{output=(output+chunk).slice(-4000);});
  child.stderr?.on('data',chunk=>{output=(output+chunk).slice(-4000);});
  child.on('message',message=>events.push(message as Record<string,any>));
  try{
    let ready=false;
    for(let attempt=0;attempt<200;attempt++){
      try{if((await fetch(base+'/api/health')).ok){ready=true;break;}}catch{}
      if(child.exitCode!==null)throw new Error('A execução isolada encerrou: '+output);
      await wait(25);
    }
    assert.ok(ready,'Servidor isolado deve iniciar: '+output);
    const url=`${base}/api/admin/email-deliveries/${delivery.id}/retry`,headers={'x-demo-user-email':'master@portal.local','content-type':'application/json'};
    const first=httpRequest(url,{method:'POST',headers});first.on('error',()=>{});first.end('{}');
    await waitUntil(()=>events.some(event=>event.kind==='gmail-waiting'));
    const before=events.filter(event=>event.kind==='hydrate').length;
    first.destroy();
    let readFinished=false,retryFinished=false;
    const read=fetch(base+'/api/admin/email-deliveries',{headers}).then(async response=>{readFinished=true;assert.equal(response.status,200);return response.json();});
    const retry=fetch(url,{method:'POST',headers,body:'{}'}).then(async response=>{retryFinished=true;assert.equal(response.status,200);return response.json();});
    await wait(150);
    assert.equal(readFinished,false);assert.equal(retryFinished,false);
    assert.equal(events.filter(event=>event.kind==='hydrate').length,before,'A desconexão não libera hidratação concorrente.');
    assert.equal(events.filter(event=>event.kind==='gmail-waiting').length,1);
    child.send?.({kind:'release-gmail',id:1});
    await waitUntil(()=>events.some(event=>event.kind==='commit-waiting'));
    await wait(100);
    assert.equal(readFinished,false);assert.equal(retryFinished,false);
    assert.equal(events.filter(event=>event.kind==='hydrate').length,before,'O commit ainda pendente mantém o runtime exclusivo.');
    child.send?.({kind:'release-commit'});
    const [rows,reused]=await Promise.all([read,retry]);
    assert.equal(rows[0].status,'ACCEPTED_BY_GMAIL');assert.equal(reused.status,'ACCEPTED_BY_GMAIL');
    child.send?.({kind:'snapshot'});
    await waitUntil(()=>events.some(event=>event.kind==='snapshot'));
    const snapshot=events.slice().reverse().find(event=>event.kind==='snapshot')!;
    assert.equal(snapshot.gmailCalls,1);
    assert.deepEqual(snapshot.deliveries,[{id:delivery.id,status:'ACCEPTED_BY_GMAIL',attempts:1}]);
  }catch(error){
    throw new Error(`${error instanceof Error?error.message:String(error)}\n${JSON.stringify(events)}\n${output}`);
  }finally{
    if(child.exitCode===null&&child.signalCode===null){const stopped=once(child,'exit');child.kill('SIGTERM');await stopped;}
    await rm(directory,{recursive:true,force:true});
  }
});
