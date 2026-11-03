import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {INITIAL_SETTINGS} from '../src/services/demoSeed';

test('HTTP: Master importa acesso externo; rejeita lote inválido integralmente e mantém revogação',{timeout:40000},async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'portal-access-import-')),port=46100+Math.floor(Math.random()*300),base=`http://127.0.0.1:${port}`;
 await writeFile(path.join(dir,'portal-state.json'),JSON.stringify({settings:INITIAL_SETTINGS,processes:[],memberships:[],authorizedStudents:[],signatureJobs:[]}));
 const child=spawn(process.execPath,['--import','tsx','server.ts'],{cwd:process.cwd(),env:{...process.env,NODE_ENV:'development',HOST:'127.0.0.1',PORT:String(port),PORTAL_PUBLIC_URL:base,APP_URL:base,PORTAL_DATA_DIR:dir,PORTAL_PERSISTENCE_PROVIDER:'local_file',PORTAL_ALLOW_INSECURE_DEMO_AUTH:'true',PORTAL_ALLOW_LOCAL_OTP_STORE:'true',PORTAL_ALLOW_LOCAL_SECRET_STORE:'true',PORTAL_SESSION_SECRET:'access-import-test-0123456789abcdef',PORTAL_OTP_PEPPER:'access-import-otp-0123456789abcdef',ASTEN_INTEGRATION_ENABLED:'false',SUPABASE_URL:'',SUPABASE_SECRET_KEY:'',SUPABASE_SERVICE_ROLE_KEY:'',VERCEL:''},stdio:'ignore'});
 const post=(records:unknown,email='master@portal.local')=>fetch(base+'/api/admin/access-list/import',{method:'POST',headers:{'content-type':'application/json',...(email?{'x-demo-user-email':email}:{})},body:JSON.stringify({records})});
 const records=[{row:1,nome:'Pessoa Externa',email:'pessoa@example.invalid',matricula:'0000123'}];
 try{
  const deadline=Date.now()+20000;while(true){try{if((await fetch(base+'/api/health')).ok)break;}catch{}if(Date.now()>deadline||child.exitCode!==null)throw Error('Servidor de teste não iniciou');await new Promise(r=>setTimeout(r,100));}
  assert.equal((await post(records,'')).status,401);
  assert.equal((await post(records,'aluno@edu.ufes.br')).status,403);
  const bad=await post([...records,{row:10,nome:'Outra',email:'inválido'}]);assert.equal(bad.status,400);assert.equal((await bad.json()).issues['10'],'E-mail inválido');
  let saved=JSON.parse(await readFile(path.join(dir,'portal-state.json'),'utf8'));assert.equal(saved.authorizedStudents?.length||0,0);
  const ok=await post(records);assert.equal(ok.status,201,await ok.clone().text());assert.equal((await ok.json()).created,1);
  assert.equal((await post([...records,records[0]])).status,400);
  const list=await fetch(base+'/api/admin/access-list',{headers:{'x-demo-user-email':'master@portal.local'}});const entries=await list.json();const person=entries.find((entry:any)=>entry.email===records[0].email);assert.ok(person);
  const revoke=await fetch(base+'/api/admin/access-list/'+person.id,{method:'PATCH',headers:{'content-type':'application/json','x-demo-user-email':'master@portal.local'},body:JSON.stringify({active:false})});assert.equal(revoke.status,200);
  const update=await post([{...records[0],nome:'Pessoa Atualizada'}]);assert.equal(update.status,201);assert.equal((await update.json()).preservedRevocations,1);
  const after=await fetch(base+'/api/admin/access-list',{headers:{'x-demo-user-email':'master@portal.local'}});assert.equal((await after.json()).find((entry:any)=>entry.id===person.id).active,false);
 }finally{if(child.exitCode===null){const done=new Promise(r=>child.once('exit',r));child.kill('SIGTERM');await done;}await rm(dir,{recursive:true,force:true});}
});
