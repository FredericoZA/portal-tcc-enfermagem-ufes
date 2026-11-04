import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {DEMO_PROCESSES,INITIAL_SETTINGS} from '../src/services/demoSeed';

test('recuperação autenticada reconcilia recusa antiga ainda PENDENTE e cria um único aviso ao grupo',{timeout:45000},async()=>{
 const directory=await mkdtemp(path.join(tmpdir(),'portal-reservation-notice-'));
 const p=structuredClone(DEMO_PROCESSES[0]);delete p.defesa.reservationRevision;p.defesa.localStatus='PENDENTE';
 p.defesa.departmentResponse={revision:0,decision:'UNAVAILABLE',respondedBy:'department@example.invalid',respondedAt:'2026-11-04T15:41:34.985Z',startAt:p.defesa.startAt,endAt:p.defesa.endAt};
 const stale=structuredClone(p);stale.id='stale';stale.protocolo='TEST-STALE-RESERVATION';stale.defesa.reservationRevision=1;
 await writeFile(path.join(directory,'portal-state.json'),JSON.stringify({settings:INITIAL_SETTINGS,processes:[p,stale],memberships:[],emailDeliveries:[],signatureJobs:[]}));
 const port=46900+Math.floor(Math.random()*300),base=`http://127.0.0.1:${port}`,secret='reservation-cron-fixture-12345678901234567890';
 const safeEnvironment=Object.fromEntries(['PATH','HOME','TMPDIR','LANG','TZ'].filter(key=>process.env[key]).map(key=>[key,process.env[key]]));
 const child=spawn(process.execPath,['--import','tsx','--input-type=module','-e',"import dotenv from 'dotenv';dotenv.config=()=>({parsed:{}});await import('./server.ts');"],{cwd:process.cwd(),env:{...safeEnvironment,NODE_ENV:'development',HOST:'127.0.0.1',PORT:String(port),APP_URL:base,PORTAL_PUBLIC_URL:base,PORTAL_DATA_DIR:directory,PORTAL_PERSISTENCE_PROVIDER:'local_file',CRON_SECRET:secret,PORTAL_ALLOW_LOCAL_SECRET_STORE:'true',PORTAL_ALLOW_LOCAL_OTP_STORE:'true',PORTAL_SESSION_SECRET:'reservation-session-fixture-1234567890',PORTAL_OTP_PEPPER:'reservation-otp-fixture-123456789012345',ASTEN_INTEGRATION_ENABLED:'false',SUPABASE_URL:'',SUPABASE_SECRET_KEY:'',SUPABASE_SERVICE_ROLE_KEY:'',VERCEL:''},stdio:'ignore'});
 try{
  const deadline=Date.now()+20000;while(true){try{if((await fetch(base+'/api/health')).ok)break;}catch{}if(Date.now()>deadline||child.exitCode!==null)throw Error('Servidor não iniciou');await new Promise(r=>setTimeout(r,100));}
  const publicResponse=await fetch(base+'/api/public/processes/'+encodeURIComponent(p.protocolo));assert.equal(publicResponse.status,200);
  const publicView=await publicResponse.json();assert.equal(publicView.defesa.localStatus,'RECUSADO','a resposta gravada prevalece sobre o estado PENDENTE antigo');
  assert.equal(publicView.protocolo,p.protocolo);assert.doesNotMatch(JSON.stringify(publicView),/department@example\.invalid|respondedBy/);
  const endpoint=base+'/api/cron/reservation-notices';assert.equal((await fetch(endpoint)).status,401);assert.equal((await fetch(endpoint,{headers:{authorization:'Bearer invalid'}})).status,401);
  const response=await fetch(endpoint,{headers:{authorization:`Bearer ${secret}`}});assert.equal(response.status,200);assert.equal((await response.json()).checked,1);
  const state=JSON.parse(await readFile(path.join(directory,'portal-state.json'),'utf8'));
  assert.equal(state.processes[0].defesa.departmentResponse.decision,'UNAVAILABLE');assert.equal(state.processes[0].protocolo,p.protocolo);
  assert.equal(state.processes[0].defesa.localStatus,'RECUSADO','o cron corrige o estado canônico sem novo clique do departamento');
  assert.equal(state.processes[1].defesa.localStatus,'PENDENTE','uma resposta de revisão anterior não cancela a nova solicitação');
  assert.equal(state.emailDeliveries.length,1);const mail=state.emailDeliveries[0];
  assert.equal(mail.recipient,'department@example.invalid');assert.deepEqual(mail.cc.sort(),[p.aluno1.email,p.aluno2?.email,p.orientador.email,'tccenfermagemufes@gmail.com'].filter(Boolean).sort());
  assert.match(mail.renderedText,/Refazer reserva/);assert.match(mail.renderedText,/evitar retrabalho/);assert.match(mail.subject,/recusado/);
  assert.equal(mail.status,'RETRY','sem Google real, o aviso fica durável para nova tentativa');assert.ok(mail.nextRetryAt);
  assert.equal(state.formArchiveJobs?.length||0,0,'não exige gerar nem arquivar comprovante para recuperar a comunicação');
  const repeated=await fetch(endpoint,{headers:{authorization:`Bearer ${secret}`}});assert.ok([200,429].includes(repeated.status));
  if(repeated.status===200)assert.equal((await repeated.json()).checked,0,'a próxima execução respeita a tentativa já agendada');
  const afterRepeat=JSON.parse(await readFile(path.join(directory,'portal-state.json'),'utf8'));assert.equal(afterRepeat.emailDeliveries.length,1,'o mesmo resultado não cria avisos duplicados');
 }finally{child.kill('SIGTERM');await new Promise<void>(r=>child.exitCode!==null?r():child.once('exit',()=>r()));await rm(directory,{recursive:true,force:true});}
});
