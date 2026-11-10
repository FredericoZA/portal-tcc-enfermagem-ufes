import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {DEMO_PROCESSES,INITIAL_SETTINGS} from '../src/services/demoSeed';

test('HTTP: Master importa acesso externo; rejeita lote inválido integralmente e mantém revogação',{timeout:40000},async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'portal-access-import-')),port=46100+Math.floor(Math.random()*300),base=`http://127.0.0.1:${port}`;
 const legacyProcess=structuredClone(DEMO_PROCESSES[0]);
 legacyProcess.aluno1.matricula='PRIVATE-LEGACY-STUDENT';
 legacyProcess.orientador.siape='PRIVATE-LEGACY-ADVISOR';
 legacyProcess.registrationAnswers={ALUNO_1_MATRICULA:'PRIVATE-LEGACY-ANSWER',ORIENTADOR_CIAP:'PRIVATE-LEGACY-CIAP'};
 const legacyAccess={id:'legacy-access',nome:'Pessoa da lista antiga',email:'legacy@example.invalid',active:true,processIds:[],matricula:'PRIVATE-LEGACY-ACCESS',ciap:'PRIVATE-LEGACY-ACCESS-CIAP'};
 await writeFile(path.join(dir,'portal-state.json'),JSON.stringify({settings:INITIAL_SETTINGS,processes:[legacyProcess],memberships:[],authorizedStudents:[legacyAccess],signatureJobs:[]}));
 const child=spawn(process.execPath,['--import','tsx','server.ts'],{cwd:process.cwd(),env:{...process.env,NODE_ENV:'development',HOST:'127.0.0.1',PORT:String(port),PORTAL_PUBLIC_URL:base,APP_URL:base,PORTAL_DATA_DIR:dir,PORTAL_PERSISTENCE_PROVIDER:'local_file',PORTAL_ALLOW_INSECURE_DEMO_AUTH:'true',PORTAL_ALLOW_LOCAL_OTP_STORE:'true',PORTAL_ALLOW_LOCAL_SECRET_STORE:'true',PORTAL_SESSION_SECRET:'access-import-test-0123456789abcdef',PORTAL_OTP_PEPPER:'access-import-otp-0123456789abcdef',ASTEN_INTEGRATION_ENABLED:'false',SUPABASE_URL:'',SUPABASE_SECRET_KEY:'',SUPABASE_SERVICE_ROLE_KEY:'',VERCEL:''},stdio:'ignore'});
 const post=(records:unknown,email='master@portal.local')=>fetch(base+'/api/admin/access-list/import',{method:'POST',headers:{'content-type':'application/json',...(email?{'x-demo-user-email':email}:{})},body:JSON.stringify({records})});
 const records=[{row:1,nome:'Pessoa Externa',email:'pessoa@example.invalid',matricula:'0000123'}];
 try{
  const deadline=Date.now()+20000;while(true){try{if((await fetch(base+'/api/health')).ok)break;}catch{}if(Date.now()>deadline||child.exitCode!==null)throw Error('Servidor de teste não iniciou');await new Promise(r=>setTimeout(r,100));}
  assert.equal((await post(records,'')).status,401);
  assert.equal((await post(records,'aluno@edu.ufes.br')).status,403);
  const bad=await post([...records,{row:10,nome:'Outra',email:'inválido'}]);assert.equal(bad.status,400);assert.equal((await bad.json()).issues['10'],'E-mail inválido');
  const masterHeaders={'x-demo-user-email':'master@portal.local'};
  const initialList=await fetch(base+'/api/admin/access-list',{headers:masterHeaders});
  assert.equal(initialList.status,200);
  const initialEntries=await initialList.json();
  assert.equal(initialEntries.find((entry:any)=>entry.id===legacyAccess.id)?.email,legacyAccess.email);
  assert.doesNotMatch(JSON.stringify(initialEntries),/PRIVATE-LEGACY/);
  const processResponse=await fetch(base+'/api/processes/'+legacyProcess.id,{headers:masterHeaders});
  assert.equal(processResponse.status,200);
  assert.doesNotMatch(await processResponse.text(),/PRIVATE-LEGACY/);
  const initialState=JSON.parse(await readFile(path.join(dir,'portal-state.json'),'utf8'));
  assert.equal(initialState.authorizedStudents.some((entry:any)=>entry.email===records[0].email),false);
  const ok=await post(records);assert.equal(ok.status,201,await ok.clone().text());assert.equal((await ok.json()).created,1);
  const saved=JSON.parse(await readFile(path.join(dir,'portal-state.json'),'utf8'));
  const historicalProcess=saved.processes.find((entry:any)=>entry.id===legacyProcess.id);
  const historicalAccess=saved.authorizedStudents.find((entry:any)=>entry.id===legacyAccess.id);
  assert.equal(historicalProcess.aluno1.matricula,legacyProcess.aluno1.matricula);
  assert.equal(historicalProcess.orientador.siape,legacyProcess.orientador.siape);
  assert.deepEqual(historicalProcess.registrationAnswers,legacyProcess.registrationAnswers);
  assert.equal(historicalAccess.matricula,legacyAccess.matricula);
  assert.equal(historicalAccess.ciap,legacyAccess.ciap);
  assert.doesNotMatch(JSON.stringify(saved),/0000123/);
  assert.equal((await post([...records,records[0]])).status,400);
  const list=await fetch(base+'/api/admin/access-list',{headers:{'x-demo-user-email':'master@portal.local'}});const entries=await list.json();const person=entries.find((entry:any)=>entry.email===records[0].email);assert.ok(person);
  const revoke=await fetch(base+'/api/admin/access-list/'+person.id,{method:'PATCH',headers:{'content-type':'application/json','x-demo-user-email':'master@portal.local'},body:JSON.stringify({active:false})});assert.equal(revoke.status,200);
  const update=await post([{...records[0],nome:'Pessoa Atualizada'}]);assert.equal(update.status,201);assert.equal((await update.json()).preservedRevocations,1);
  const after=await fetch(base+'/api/admin/access-list',{headers:{'x-demo-user-email':'master@portal.local'}});assert.equal((await after.json()).find((entry:any)=>entry.id===person.id).active,false);
 }finally{if(child.exitCode===null){const done=new Promise(r=>child.once('exit',r));child.kill('SIGTERM');await done;}await rm(dir,{recursive:true,force:true});}
});
