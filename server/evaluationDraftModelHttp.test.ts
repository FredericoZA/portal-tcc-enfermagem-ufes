import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {DEMO_PROCESSES,DEMO_MEMBERSHIPS,INITIAL_SETTINGS} from '../src/services/demoSeed';

test('HTTP: rascunho de outro modelo não muda a ata nem perde resultado e parecer', {timeout:45000}, async()=>{
 const directory=await mkdtemp(path.join(tmpdir(),'portal-ata-model-'));
 const p=structuredClone(DEMO_PROCESSES[0]);
 p.defesa={...p.defesa,localStatus:'CONFIRMADO',invitationDriveFileId:'fixture-invitation',invitationSentAt:new Date().toISOString()};
 p.avaliacao.status='PENDENTE';
 const settings=structuredClone(INITIAL_SETTINGS);settings.documentModels={ATA:{driveFileId:'fixture-ata',contentSha256:'a'.repeat(64)}} as any;
 const answers={PARECER:'Parecer que deve continuar preenchido',RESULTADO:'APROVADO'};
 await writeFile(path.join(directory,'portal-state.json'),JSON.stringify({settings,processes:[p],memberships:DEMO_MEMBERSHIPS.filter(m=>m.processId===p.id),evaluationDrafts:{[p.id]:{processId:p.id,dataRevision:p.dataRevision,answers,documentText:'Modelo antigo que não deve substituir o padrão',savedAt:new Date().toISOString(),savedBy:p.orientador.email}}}));
 const port=43500+Math.floor(Math.random()*500);
 const child=spawn(process.execPath,['--import','tsx','server.ts'],{cwd:fileURLToPath(new URL('..',import.meta.url)),env:{...process.env,NODE_ENV:'development',PORT:String(port),PORTAL_DATA_DIR:directory,PORTAL_SESSION_SECRET:'test-session-secret-0123456789-abcdef',PORTAL_OTP_PEPPER:'test-otp-pepper-0123456789-abcdef',PORTAL_ALLOW_INSECURE_DEMO_AUTH:'true',PORTAL_ALLOW_LOCAL_OTP_STORE:'true',PORTAL_ALLOW_LOCAL_SECRET_STORE:'true',PORTAL_TEST_DOCUMENT_RENDERER:'true',PORTAL_OTP_DELIVERY_MODE:'log',ASTEN_INTEGRATION_ENABLED:'false',PORTAL_PERSISTENCE_PROVIDER:'local_file',SUPABASE_URL:'',SUPABASE_SERVICE_ROLE_KEY:'',SUPABASE_SECRET_KEY:''},stdio:['ignore','pipe','pipe']});
 child.stdout.resume();child.stderr.resume();
 const base=`http://127.0.0.1:${port}`;
 const request=async(method:string,suffix:string,body?:unknown)=>{const response=await fetch(`${base}/api/processes/${p.id}/evaluation${suffix}`,{method,headers:{'content-type':'application/json','x-demo-user-email':p.orientador.email},body:body===undefined?undefined:JSON.stringify(body)});return{status:response.status,body:await response.json()};};
 try{
  const deadline=Date.now()+25000;while(true){try{if((await fetch(base+'/api/health')).ok)break;}catch{}if(Date.now()>deadline||child.exitCode!==null)throw new Error('Servidor de teste não iniciou.');await new Promise(resolve=>setTimeout(resolve,200));}
  const schema=await request('GET','/schema');const model=schema.body.ataModelFingerprint;
  assert.equal(model,'fixture-ata:'+ 'a'.repeat(64));
  const restored=await request('GET','/draft');assert.equal(restored.status,200);assert.equal(restored.body.documentText,undefined);assert.deepEqual(restored.body.answers,answers);assert.equal(restored.body.documentTextReset,true);
  const data={answers,documentText:'Revisão integral atual que deve permanecer no rascunho',expectedDataRevision:p.dataRevision};
  assert.equal((await request('PUT','/draft',data)).body.code,'ATA_MODEL_CHANGED');
  assert.equal((await request('POST','/preview',data)).body.code,'ATA_MODEL_CHANGED');
  const saved=await request('PUT','/draft',{...data,expectedModelFingerprint:model});assert.equal(saved.status,200,JSON.stringify(saved.body));
  assert.equal((await request('GET','/draft')).body.documentText,data.documentText);
  const state=JSON.parse(await readFile(path.join(directory,'portal-state.json'),'utf8'));assert.deepEqual(state.processes[0],p);assert.equal(state.signatureJobs.length,0);
 }finally{child.kill('SIGTERM');await new Promise(resolve=>child.once('exit',resolve));await rm(directory,{recursive:true,force:true});}
});
