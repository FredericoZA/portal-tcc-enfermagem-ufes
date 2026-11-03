import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {DEMO_PROCESSES,DEMO_MEMBERSHIPS,INITIAL_SETTINGS} from '../src/services/demoSeed';

test('HTTP: avaliação concluída bloqueia agenda e cadastro inclusive para Master', {timeout:45000}, async()=>{
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
  for(const email of ['master@portal.local',p.aluno1.email,p.orientador.email]){
   for(const body of [{defesa:{startAt:'2026-11-20T14:00:00.000Z'}},{defesa:{local:'Outro local'}},{titulo:'Outro título'}]){
    const response=await patch(email,body);assert.equal(response.status,409,JSON.stringify(response.body));assert.equal(response.body.code,'PROCESS_DATA_LOCKED');
   }
  }
  const state=JSON.parse(await readFile(path.join(directory,'portal-state.json'),'utf8'));
  assert.deepEqual(state.processes[0].defesa,p.defesa);assert.equal(state.signatureJobs[0].status,'SENT');
 }finally{child.kill('SIGTERM');await new Promise(resolve=>child.once('exit',resolve));await rm(directory,{recursive:true,force:true});}
});
