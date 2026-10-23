import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {INITIAL_SETTINGS,DEMO_PROCESSES,DEMO_MEMBERSHIPS} from '../src/services/demoSeed';

test('HTTP: real schedule changes have actor/before/after, protected history and complete PDF', {timeout:45000},async()=>{
 const directory=await mkdtemp(path.join(tmpdir(),'portal-audit-'));
 const processData=structuredClone(DEMO_PROCESSES[0]);
 const port=46500+Math.floor(Math.random()*900),base=`http://127.0.0.1:${port}`;
 await writeFile(path.join(directory,'portal-state.json'),JSON.stringify({settings:INITIAL_SETTINGS,processes:[processData],memberships:DEMO_MEMBERSHIPS,auditLogs:[{id:'other',processId:'private-other',entityId:'private-other',entityType:'processo',actorEmail:'other@example.org',actorRoles:[],action:'OTHER_PRIVATE',timestamp:new Date().toISOString()}]}));
 const child=spawn(process.execPath,['--import','tsx','server.ts'],{cwd:process.cwd(),env:{...process.env,PORT:String(port),HOST:'127.0.0.1',NODE_ENV:'development',PORTAL_DATA_DIR:directory,PORTAL_PERSISTENCE_PROVIDER:'local_file',PORTAL_ALLOW_INSECURE_DEMO_AUTH:'true',PORTAL_ALLOW_LOCAL_OTP_STORE:'true',PORTAL_ALLOW_LOCAL_SECRET_STORE:'true',PORTAL_SESSION_SECRET:'test-audit-session-secret-0123456789',PORTAL_OTP_PEPPER:'test-audit-otp-pepper-0123456789',PORTAL_OTP_DELIVERY_MODE:'log',ASTEN_INTEGRATION_ENABLED:'false',SUPABASE_URL:'',SUPABASE_SECRET_KEY:'',SUPABASE_SERVICE_ROLE_KEY:'',VERCEL:''},stdio:['ignore','pipe','pipe']});child.stdout.resume();child.stderr.resume();
 const url=`${base}/api/processes/${processData.id}/audit-logs`;
 const headers={'x-demo-user-email':'master@portal.local'};
 try{
  const deadline=Date.now()+25000;while(true){try{if((await fetch(base+'/api/health')).ok)break;}catch{}if(Date.now()>deadline||child.exitCode!==null)throw new Error('Servidor isolado não iniciou.');await new Promise(resolve=>setTimeout(resolve,100));}
  assert.equal((await fetch(url)).status,401);
  assert.equal((await fetch(url,{headers:{'x-demo-user-email':'unrelated@example.org'}})).status,404);
  assert.equal((await fetch(url+'/pdf',{headers:{'x-demo-user-email':'unrelated@example.org'}})).status,404);
  const changed=await fetch(`${base}/api/processes/${processData.id}`,{method:'PATCH',headers:{...headers,'content-type':'application/json'},body:JSON.stringify({defesa:{startAt:'2026-10-29T16:00:00.000Z',local:'Sala de conferência'}})});
  assert.equal(changed.status,200,await changed.text());
  const response=await fetch(url,{headers});assert.equal(response.status,200);assert.match(response.headers.get('cache-control')||'',/no-store/);
  const rows=await response.json();const change=rows.find((r:any)=>r.action==='EDICAO_DADOS_PROCESSO');
  assert.ok(change);assert.equal(change.actorEmail,'master@portal.local');assert.equal(change.before.defesa.startAt,processData.defesa.startAt);assert.equal(change.after.defesa.startAt,'2026-10-29T16:00:00.000Z');assert.equal(change.after.defesa.local,'Sala de conferência');assert.ok(Number.isFinite(Date.parse(change.timestamp)));assert.ok(!rows.some((r:any)=>r.action==='OTHER_PRIVATE'));
  const file=await fetch(url+'/pdf',{headers});assert.equal(file.status,200);assert.match(file.headers.get('content-type')||'',/application\/pdf/);const text=Buffer.from(await file.arrayBuffer()).toString('latin1');assert.match(text,/EDICAO_DADOS_PROCESSO/);assert.match(text,/2026-10-29T16:00/);assert.doesNotMatch(text,/OTHER_PRIVATE/);
  const durable=JSON.parse(await readFile(path.join(directory,'portal-state.json'),'utf8'));assert.ok(durable.auditLogs.some((r:any)=>r.id===change.id));
 }finally{const exited=new Promise(resolve=>child.once('exit',resolve));child.kill('SIGTERM');await exited;await rm(directory,{recursive:true,force:true});}
});
