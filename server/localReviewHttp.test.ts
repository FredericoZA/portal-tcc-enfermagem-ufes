import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {INITIAL_SETTINGS} from '../src/services/demoSeed';

test('HTTP: exemplos persistem somente localmente e a Presidência tem acesso à própria fila', {timeout:45000},async()=>{
 const directory=await mkdtemp(path.join(tmpdir(),'portal-review-start-'));const settings={...structuredClone(INITIAL_SETTINGS),contactEmail:'preservar@example.invalid'};
 await writeFile(path.join(directory,'portal-state.json'),JSON.stringify({settings,processes:[],memberships:[]}));
 const port=44000+Math.floor(Math.random()*400);
 const child=spawn(process.execPath,['--import','tsx','server.ts'],{cwd:fileURLToPath(new URL('..',import.meta.url)),env:{...process.env,NODE_ENV:'development',VERCEL:'',PORT:String(port),PORTAL_DATA_DIR:directory,PORTAL_SESSION_SECRET:'test-session-secret-0123456789-abcdef',PORTAL_OTP_PEPPER:'test-otp-pepper-0123456789-abcdef',PORTAL_LOCAL_REVIEW_DATA:'true',PORTAL_LOCAL_REVIEW_DATA_CUSTOM_DIR:'true',PORTAL_ALLOW_INSECURE_DEMO_AUTH:'true',PORTAL_ALLOW_LOCAL_OTP_STORE:'true',PORTAL_ALLOW_LOCAL_SECRET_STORE:'true',PORTAL_TEST_DOCUMENT_RENDERER:'true',PORTAL_OTP_DELIVERY_MODE:'log',ASTEN_INTEGRATION_ENABLED:'false',PORTAL_PERSISTENCE_PROVIDER:'local_file',SUPABASE_URL:'',SUPABASE_SERVICE_ROLE_KEY:'',SUPABASE_SECRET_KEY:''},stdio:['ignore','pipe','pipe']});
 child.stdout.resume();child.stderr.resume();const base=`http://127.0.0.1:${port}`;
 try{
  const deadline=Date.now()+25000;while(true){try{if((await fetch(base+'/api/health')).ok)break;}catch{}if(Date.now()>deadline||child.exitCode!==null)throw new Error('Servidor local não iniciou.');await new Promise(r=>setTimeout(r,200));}
  const headers={'x-demo-user-email':'presidente@portal.local'};
  const identity=await (await fetch(base+'/api/me',{headers})).json();assert.ok(identity.globalRoles.includes('COMMISSION_PRESIDENT'));assert.ok(!identity.globalRoles.includes('MASTER_ADMIN'));
  assert.equal((await fetch(base+'/api/coordinator/signature-queue',{headers})).status,200);
  assert.equal((await fetch(base+'/api/coordinator/signature-queue',{headers:{'x-demo-user-email':'mariana.silva@aluno.ufes.br'}})).status,403);
  assert.equal((await fetch(base+'/api/coordinator/signature-queue')).status,401);
  const processes=await(await fetch(base+'/api/processes',{headers})).json();assert.ok(processes.length>=7);
  const disk=JSON.parse(await readFile(path.join(directory,'portal-state.json'),'utf8'));assert.equal(disk.processes.length,processes.length);assert.equal(disk.settings.contactEmail,settings.contactEmail);assert.equal(disk.signatureJobs.length,0);
 }finally{child.kill('SIGTERM');await new Promise(r=>child.once('exit',r));await rm(directory,{recursive:true,force:true});}
});
