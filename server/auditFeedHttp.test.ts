import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {DEMO_PROCESSES,INITIAL_SETTINGS} from '../src/services/demoSeed';
import {initialEmailDelivery} from './integrations/trackedGmail';

test('HTTP: auditoria de envios é restrita ao Master e prévia não expõe links pessoais',{timeout:45000},async()=>{
 const directory=await mkdtemp(path.join(tmpdir(),'portal-audit-feed-')),p=structuredClone(DEMO_PROCESSES[0]);
 const common={processId:p.id,protocol:p.protocolo,recipient:p.orientador.email,cc:['tccenfermagemufes@gmail.com'],requestedBy:p.aluno1.email,subject:'Resultado da reserva',text:'Reserva recusada. Abra o TCC para refazer a reserva.'};
 const visible=initialEmailDelivery({...common,idempotencyKey:'mail-visible'});visible.status='ACCEPTED_BY_GMAIL';visible.attempts=[{number:1,startedAt:visible.createdAt,completedAt:visible.createdAt,status:'ACCEPTED_BY_GMAIL'}];
 const sensitive=initialEmailDelivery({...common,idempotencyKey:'mail-sensitive',text:'Responder https://portal.test/api/reservation-confirmation/do-not-disclose-this-token',cc:[]});
 delete sensitive.requestedBy;
 const sending=initialEmailDelivery({...common,idempotencyKey:'mail-sending'});sending.dispatchState='SENDING';sending.dispatchStartedAt=new Date().toISOString();sending.dispatchLeaseUntil=new Date(Date.now()+600000).toISOString();
 const uncertain=initialEmailDelivery({...common,idempotencyKey:'mail-uncertain'});uncertain.status='FAILED';uncertain.dispatchState='UNCERTAIN';uncertain.nextRetryAt=undefined;uncertain.attempts=[{number:1,startedAt:uncertain.createdAt,completedAt:uncertain.createdAt,status:'FAILED',errorCode:'GMAIL_DELIVERY_UNCERTAIN'}];
 await writeFile(path.join(directory,'portal-state.json'),JSON.stringify({settings:INITIAL_SETTINGS,processes:[p],memberships:[],emailDeliveries:[visible,sensitive,sending,uncertain],signatureJobs:[],auditLogs:[{id:'created',processId:p.id,actorEmail:p.aluno1.email,actorRoles:['STUDENT'],action:'CRIACAO_PROCESSO',entityType:'processo',entityId:p.id,after:p,timestamp:p.createdAt}]}));
 const port=47300+Math.floor(Math.random()*200),base=`http://127.0.0.1:${port}`;
 const env=Object.fromEntries(['PATH','HOME','TMPDIR','LANG','TZ'].filter(k=>process.env[k]).map(k=>[k,process.env[k]]));
 const child=spawn(process.execPath,['--import','tsx','--input-type=module','-e',"import dotenv from 'dotenv';dotenv.config=()=>({parsed:{}});await import('./server.ts');"],{cwd:process.cwd(),env:{...env,NODE_ENV:'development',HOST:'127.0.0.1',PORT:String(port),APP_URL:base,PORTAL_PUBLIC_URL:base,PORTAL_DATA_DIR:directory,PORTAL_PERSISTENCE_PROVIDER:'local_file',PORTAL_ALLOW_INSECURE_DEMO_AUTH:'true',PORTAL_ALLOW_LOCAL_SECRET_STORE:'true',PORTAL_ALLOW_LOCAL_OTP_STORE:'true',PORTAL_OTP_DELIVERY_MODE:'log',PORTAL_SESSION_SECRET:'audit-session-fixture-12345678901234567890',PORTAL_OTP_PEPPER:'audit-otp-fixture-12345678901234567890',ASTEN_INTEGRATION_ENABLED:'false',SUPABASE_URL:'',SUPABASE_SECRET_KEY:'',SUPABASE_SERVICE_ROLE_KEY:'',VERCEL:''},stdio:'ignore'});
 try{
  const deadline=Date.now()+20000;while(true){try{if((await fetch(base+'/api/health')).ok)break;}catch{}if(Date.now()>deadline||child.exitCode!==null)throw Error('Servidor não iniciou');await new Promise(r=>setTimeout(r,100));}
  const feed='/api/admin/audit-logs',preview=`/api/admin/email-deliveries/${sensitive.id}/preview`;
  for(const endpoint of [feed,preview]){
   assert.equal((await fetch(base+endpoint)).status,401);
   assert.equal((await fetch(base+endpoint,{headers:{'x-demo-user-email':p.aluno1.email}})).status,403);
  }
  const headers={'x-demo-user-email':'master@portal.local'},response=await fetch(base+feed,{headers});assert.equal(response.status,200);assert.match(response.headers.get('cache-control')||'',/no-store/);
  const rows=await response.json();assert.equal(rows.filter((row:any)=>row.source==='email').length,4);assert.equal(rows.find((row:any)=>row.emailDeliveryId===visible.id).actorEmail,p.aluno1.email);assert.equal(rows.find((row:any)=>row.id==='created').processProtocol,p.protocolo);assert.doesNotMatch(JSON.stringify(rows),/do-not-disclose-this-token|renderedHtml|renderedText/);
  const summary=await (await fetch(base+'/api/admin/email-deliveries',{headers})).json();
  assert.doesNotMatch(JSON.stringify(summary),/do-not-disclose-this-token|renderedHtml|renderedText|idempotencyKey|workflowEventVariables/);
  const protectedPreview=await (await fetch(base+preview,{headers})).json();assert.equal(protectedPreview.sensitive,true);assert.doesNotMatch(JSON.stringify(protectedPreview),/do-not-disclose-this-token/);
  const ordinary=await (await fetch(`${base}/api/admin/email-deliveries/${visible.id}/preview`,{headers})).json();assert.equal(ordinary.sensitive,false);assert.equal(ordinary.text,visible.renderedText);
  const second=await (await fetch(base+feed,{headers})).json();assert.equal(second.length,rows.length);assert.deepEqual(second.map((r:any)=>r.id),rows.map((r:any)=>r.id));
  const beforeBlocked=JSON.parse(await readFile(path.join(directory,'portal-state.json'),'utf8'));
  for(const [record,code]of [[sending,'EMAIL_DELIVERY_IN_PROGRESS'],[uncertain,'EMAIL_DELIVERY_UNCERTAIN']] as const){
   const retry=await fetch(`${base}/api/admin/email-deliveries/${record.id}/retry`,{method:'POST',headers:{...headers,'content-type':'application/json'},body:'{}'});
   assert.equal(retry.status,409);assert.equal((await retry.json()).code,code);
  }
  const afterBlocked=JSON.parse(await readFile(path.join(directory,'portal-state.json'),'utf8'));
  assert.deepEqual(afterBlocked.emailDeliveries,beforeBlocked.emailDeliveries,'envios em andamento e incertos não alteram tentativas, prazo ou conteúdo');
  assert.deepEqual(afterBlocked.auditLogs,beforeBlocked.auditLogs,'o bloqueio não registra uma nova tentativa de envio');
  const retry=await fetch(`${base}/api/admin/email-deliveries/${sensitive.id}/retry`,{method:'POST',headers:{...headers,'content-type':'application/json'},body:'{}'});assert.equal(retry.status,409,'sem credenciais reais a tentativa não é apresentada como enviada');assert.doesNotMatch(await retry.text(),/do-not-disclose-this-token|renderedText|renderedHtml|idempotencyKey/);
  const acceptedRetry=await fetch(`${base}/api/admin/email-deliveries/${visible.id}/retry`,{method:'POST',headers:{...headers,'content-type':'application/json'},body:'{}'});assert.equal(acceptedRetry.status,200);assert.doesNotMatch(await acceptedRetry.text(),/renderedText|renderedHtml|idempotencyKey/);
  const retried=await (await fetch(base+feed,{headers})).json();assert.equal(retried.find((row:any)=>row.emailDeliveryId===sensitive.id).actorEmail,'Sistema','não inventa o solicitante original do registro antigo');assert.equal(retried.find((row:any)=>row.action==='REENVIO_EMAIL_SOLICITADO').actorEmail,'master@portal.local','a nova tentativa possui seu próprio responsável');
  const code=await fetch(base+'/api/auth/request-code',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:'master@portal.local'})});assert.equal(code.status,200);
  const updated=await (await fetch(base+feed,{headers})).json();const otp=updated.find((row:any)=>row.action==='EMAIL_CODIGO_ACESSO_SIMULADO');assert.ok(otp);assert.equal(otp.actorEmail,'Sistema');assert.equal(otp.after.recipient,'master@portal.local');assert.equal(otp.after.status,'SIMULATED');assert.equal(otp.after.method,'EMAIL_OTP');assert.equal(otp.after.requestedBy,undefined);assert.equal(otp.after.code,undefined);assert.equal(otp.after.challengeId,undefined);
 }finally{child.kill('SIGTERM');await new Promise<void>(r=>child.exitCode!==null?r():child.once('exit',()=>r()));await rm(directory,{recursive:true,force:true});}
});
