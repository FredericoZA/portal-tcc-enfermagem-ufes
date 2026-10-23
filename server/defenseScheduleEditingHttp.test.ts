import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {DEMO_PROCESSES,DEMO_MEMBERSHIPS,INITIAL_SETTINGS} from '../src/services/demoSeed';

test('HTTP: agenda confirmada continua editável e auditada, sem desbloquear outros dados', {timeout:45000}, async()=>{
 const directory=await mkdtemp(path.join(tmpdir(),'portal-defense-schedule-'));
 const p=structuredClone(DEMO_PROCESSES[0]);
 p.defesa={...p.defesa,localStatus:'CONFIRMADO',invitationDriveFileId:'fixture-invitation',invitationSentAt:new Date().toISOString()};
 p.avaliacao.status='CONCLUIDO';
 const job={id:'fixture-active-signature',processId:p.id,documentType:'ATA',status:'SENT',documentVersion:1,sourceDataRevision:p.dataRevision,provider:'ASTEN',driveUnsignedFileId:'fixture-unsigned'};
 await writeFile(path.join(directory,'portal-state.json'),JSON.stringify({settings:structuredClone(INITIAL_SETTINGS),processes:[p],memberships:DEMO_MEMBERSHIPS.filter(m=>m.processId===p.id),signatureJobs:[job]}));
 const port=43500+Math.floor(Math.random()*500);
 const child=spawn(process.execPath,['--import','tsx','server.ts'],{cwd:fileURLToPath(new URL('..',import.meta.url)),env:{...process.env,NODE_ENV:'development',PORT:String(port),PORTAL_DATA_DIR:directory,PORTAL_SESSION_SECRET:'test-session-secret-0123456789-abcdef',PORTAL_OTP_PEPPER:'test-otp-pepper-0123456789-abcdef',PORTAL_ALLOW_INSECURE_DEMO_AUTH:'true',PORTAL_ALLOW_LOCAL_OTP_STORE:'true',PORTAL_ALLOW_LOCAL_SECRET_STORE:'true',PORTAL_TEST_DOCUMENT_RENDERER:'true',PORTAL_OTP_DELIVERY_MODE:'log',ASTEN_INTEGRATION_ENABLED:'false',PORTAL_PERSISTENCE_PROVIDER:'local_file',SUPABASE_URL:'',SUPABASE_SERVICE_ROLE_KEY:'',SUPABASE_SECRET_KEY:''},stdio:['ignore','pipe','pipe']});
 child.stdout.resume();child.stderr.resume();
 const base=`http://127.0.0.1:${port}`;
 const patch=async(email:string,body:unknown)=>{const response=await fetch(`${base}/api/processes/${p.id}`,{method:'PATCH',headers:{'content-type':'application/json','x-demo-user-email':email},body:JSON.stringify(body)});return{status:response.status,body:await response.json()};};
 try{
  const deadline=Date.now()+25000;while(true){try{if((await fetch(base+'/api/health')).ok)break;}catch{}if(Date.now()>deadline||child.exitCode!==null)throw new Error('Servidor de teste não iniciou.');await new Promise(resolve=>setTimeout(resolve,200));}
  const date=await patch('master@portal.local',{defesa:{startAt:'2026-11-20T14:00:00.000Z'}});assert.equal(date.status,200,JSON.stringify(date.body));
  const time=await patch(p.aluno1.email,{defesa:{startAt:'2026-11-20T15:30:00.000Z'}});assert.equal(time.status,200,JSON.stringify(time.body));
  const local=await patch(p.orientador.email,{defesa:{local:'Sala de defesa atualizada'}});assert.equal(local.status,200,JSON.stringify(local.body));assert.equal(local.body.defesa.localStatus,'CONFIRMADO');assert.equal(local.body.defesa.invitationDriveFileId,'fixture-invitation');
  assert.equal((await patch('master@portal.local',{defesa:{startAt:'inválida'}})).status,400);
  assert.equal((await patch('master@portal.local',{defesa:{local:''}})).status,400);
  assert.equal((await patch(p.banca.find(member=>member.email!==p.orientador.email)!.email,{defesa:{local:'Sem permissão'}})).status,403);
  assert.equal((await patch('master@portal.local',{titulo:'Outro título'})).body.code,'ACTIVE_SIGNATURE_ENVELOPE');
  assert.equal((await patch('master@portal.local',{titulo:'Outro título',defesa:{local:'Outro local'}})).body.code,'ACTIVE_SIGNATURE_ENVELOPE');
  const state=JSON.parse(await readFile(path.join(directory,'portal-state.json'),'utf8'));
  const logs=state.auditLogs.filter((log:any)=>log.action==='EDICAO_DADOS_PROCESSO');assert.equal(logs.length,3);
  assert.equal(logs[0].actorEmail,'master@portal.local');assert.equal(logs[0].before.defesa.startAt,p.defesa.startAt);assert.equal(logs[0].after.defesa.startAt,'2026-11-20T14:00:00.000Z');
  assert.equal(logs[1].actorEmail,p.aluno1.email);assert.equal(logs[2].actorEmail,p.orientador.email);assert.equal(logs[2].after.defesa.local,'Sala de defesa atualizada');assert.ok(logs.every((log:any)=>Number.isFinite(Date.parse(log.timestamp))));assert.equal(state.signatureJobs[0].status,'SENT');
 }finally{child.kill('SIGTERM');await new Promise(resolve=>child.once('exit',resolve));await rm(directory,{recursive:true,force:true});}
});
