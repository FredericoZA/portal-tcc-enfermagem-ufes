import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, writeFile, readFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {INITIAL_SETTINGS} from '../src/services/demoSeed';

test('Master aplica e-mails administrativos sem aceite, substitui pendência e mantém auditoria durável', {timeout:45000}, async () => {
 const directory=await mkdtemp(path.join(tmpdir(),'portal-master-direct-'));
 const port=45500+Math.floor(Math.random()*1000),base=`http://127.0.0.1:${port}`;
 const pending={id:'old-president-request',role:'COMMISSION_PRESIDENT',targetEmail:'old-target@example.org',requestedBy:'master@portal.local',status:'PENDING_TARGET_ACCEPTANCE',requestedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+1800000).toISOString()};
 await writeFile(path.join(directory,'portal-state.json'),JSON.stringify({settings:INITIAL_SETTINGS,processes:[],memberships:[],administrationTransfers:[pending]}));
 const child=spawn(process.execPath,['--import','tsx','server.ts'],{cwd:process.cwd(),env:{...process.env,PORT:String(port),HOST:'127.0.0.1',NODE_ENV:'development',PORTAL_DATA_DIR:directory,PORTAL_PERSISTENCE_PROVIDER:'local_file',PORTAL_ALLOW_INSECURE_DEMO_AUTH:'true',PORTAL_ALLOW_LOCAL_OTP_STORE:'true',PORTAL_ALLOW_LOCAL_SECRET_STORE:'true',PORTAL_SESSION_SECRET:'test-master-direct-session-0123456789',PORTAL_OTP_PEPPER:'test-master-direct-otp-0123456789',PORTAL_OTP_DELIVERY_MODE:'log',ASTEN_INTEGRATION_ENABLED:'false',SUPABASE_URL:'',SUPABASE_SECRET_KEY:'',SUPABASE_SERVICE_ROLE_KEY:'',VERCEL:''},stdio:['ignore','pipe','pipe']});
 child.stdout.resume();child.stderr.resume();
 const change=async(role:string,targetEmail:string,email='master@portal.local')=>{
  const r=await fetch(base+'/api/admin/administration-transfers',{method:'POST',headers:{'content-type':'application/json',...(email?{'x-demo-user-email':email}:{})},body:JSON.stringify({role,targetEmail})});return {status:r.status,body:await r.json()};
 };
 try{
  const deadline=Date.now()+25000;while(true){try{if((await fetch(base+'/api/health')).ok)break;}catch{}if(Date.now()>deadline||child.exitCode!==null)throw new Error('Servidor isolado não iniciou.');await new Promise(resolve=>setTimeout(resolve,100));}
  assert.equal((await change('COMMISSION_PRESIDENT','new-president@example.org','')).status,401);
  assert.equal((await change('COMMISSION_PRESIDENT','new-president@example.org','student@example.org')).status,403);
  assert.equal((await change('COMMISSION_PRESIDENT','invalid')).status,400);
  const president=await change('COMMISSION_PRESIDENT','New-President@example.org');
  assert.equal(president.status,201);assert.equal(president.body.status,'COMPLETED');
  let state=JSON.parse(await readFile(path.join(directory,'portal-state.json'),'utf8'));
  assert.equal(state.settings.commissionPresidentEmail,'new-president@example.org');
  assert.deepEqual(state.settings.masterRecoveryEmails,['new-president@example.org']);
  assert.equal(state.settings.masterEmail,'master@portal.local');
  assert.equal(state.administrationTransfers.find((t:any)=>t.id===pending.id).status,'CANCELED');
  assert.equal(state.auditLogs.filter((a:any)=>a.action==='ALTERACAO_ADMINISTRACAO_POR_MASTER').length,1);
  const master=await change('MASTER_ADMIN','new-master@example.org');
  assert.equal(master.status,201);assert.equal(master.body.status,'COMPLETED');assert.equal(master.body.googleReconnectRequired,true);
  state=JSON.parse(await readFile(path.join(directory,'portal-state.json'),'utf8'));
  assert.equal(state.settings.masterEmail,'new-master@example.org');assert.equal(state.settings.ownerEmail,'new-master@example.org');
  assert.equal(state.administrationTransfers.filter((t:any)=>t.status==='PENDING_TARGET_ACCEPTANCE').length,0);
  assert.equal((await change('COMMISSION_PRESIDENT','someone@example.org')).status,403,'antigo Master perde autorização');
  const me=await fetch(base+'/api/me',{headers:{'x-demo-user-email':'new-master@example.org'}});
  assert.ok((await me.json()).globalRoles.includes('MASTER_ADMIN'));
 }finally{const exited=new Promise(resolve=>child.once('exit',resolve));child.kill('SIGTERM');await exited;await rm(directory,{recursive:true,force:true});}
});
