import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn,type ChildProcess} from 'node:child_process';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {INITIAL_SETTINGS} from '../src/services/demoSeed';
test('signature removal is Master-only, survives restart and does not erase archived evidence',{timeout:50000},async()=>{
 const directory=await mkdtemp(path.join(tmpdir(),'portal-signature-removal-'));
 const port=47400+Math.floor(Math.random()*200),base=`http://127.0.0.1:${port}`,secret='signature-removal-fixture-0123456789abcdef';
 const job=(id:string,patch:Record<string,unknown>={})=>({id,processId:'missing-process',protocol:'TEST-001',documentTitle:'Ata',documentType:'ATA',documentVersion:1,sourceDataRevision:1,provider:'GOV_BR',status:'READY_FOR_REVIEW',createdAt:'2026-11-04T12:00:00Z',updatedAt:'2026-11-04T12:00:00Z',createdBy:'master@portal.local',signers:[],...patch});
 await writeFile(path.join(directory,'portal-state.json'),JSON.stringify({settings:INITIAL_SETTINGS,processes:[],memberships:[],emailDeliveries:[],signatureJobs:[job('draft'),job('archived',{provider:'ASTEN',providerEnvelopeId:'123',status:'ARCHIVED',driveSignedFileId:'original-signed-file',signedSha256:'original-hash'}),job('sending',{status:'SENDING'}),job('uncertain',{provider:'ASTEN',providerCreationState:'UNCERTAIN'})]}));
 let child:ChildProcess|undefined;
 const start=async()=>{child=spawn(process.execPath,['--import','tsx','server.ts'],{cwd:process.cwd(),env:{...process.env,NODE_ENV:'development',PORT:String(port),HOST:'127.0.0.1',PORTAL_DATA_DIR:directory,PORTAL_PERSISTENCE_PROVIDER:'local_file',PORTAL_ALLOW_INSECURE_DEMO_AUTH:'true',PORTAL_ALLOW_LOCAL_OTP_STORE:'true',PORTAL_ALLOW_LOCAL_SECRET_STORE:'true',PORTAL_SESSION_SECRET:secret,PORTAL_OTP_PEPPER:'parity-fixture-otp-secret-0123456789',PORTAL_OTP_DELIVERY_MODE:'log',ASTEN_INTEGRATION_ENABLED:'false',ASTEN_WEBHOOK_SECRET:'signature-removal-webhook-fixture-0123456789abcdef',SUPABASE_URL:'',SUPABASE_SECRET_KEY:'',SUPABASE_SERVICE_ROLE_KEY:'',VERCEL:''},stdio:'ignore'});const until=Date.now()+20000;while(true){try{if((await fetch(base+'/api/health')).ok)break;}catch{}if(Date.now()>until||child.exitCode!==null)throw Error('Fixture did not start');await new Promise(r=>setTimeout(r,100));}};
 const stop=async()=>{if(child&&child.exitCode===null){const ended=new Promise(r=>child!.once('exit',r));child.kill('SIGTERM');await ended;}};
 const headers={'content-type':'application/json','x-demo-user-email':'master@portal.local'};
 try{
  await start();
  const remove=(id:string,email?:string)=>fetch(`${base}/api/signatures/jobs/${id}`,{method:'DELETE',headers:{'content-type':'application/json',...(email?{'x-demo-user-email':email}:{})}});
  const list=async()=>await(await fetch(base+'/api/signatures/jobs',{headers})).json();
  assert.equal((await remove('draft')).status,401);
  assert.equal((await remove('draft','student@example.invalid')).status,403);
  assert.equal((await remove('missing','master@portal.local')).status,404);
  assert.equal((await remove('sending','master@portal.local')).status,409);
  assert.equal((await remove('uncertain','master@portal.local')).status,409);
  assert.equal((await list()).length,4);
  assert.equal((await remove('draft','master@portal.local')).status,200);
  assert.equal((await remove('archived','master@portal.local')).status,200);
  assert.equal((await list()).length,2);
  const callback=await fetch(base+'/api/integrations/asten/webhook',{method:'POST',headers:{'content-type':'application/json','x-portal-webhook-key':'signature-removal-webhook-fixture-0123456789abcdef'},body:JSON.stringify({idEnvelope:'123',status:3})});assert.equal(callback.status,200);assert.equal((await callback.json()).ignored,true);
  assert.equal((await remove('draft','master@portal.local')).status,200);
  assert.equal((await fetch(base+'/api/signatures/jobs/draft/retry',{method:'POST',headers})).status,404);
  assert.equal((await fetch(base+'/api/signatures/jobs/archived/reconcile',{method:'POST',headers})).status,404);
  await stop();await start();assert.equal((await list()).length,2);
  const state=JSON.parse(await readFile(path.join(directory,'portal-state.json'),'utf8'));const archived=state.signatureJobs.find((j:any)=>j.id==='archived');assert.equal(archived.status,'ARCHIVED');assert.equal(archived.driveSignedFileId,'original-signed-file');assert.equal(archived.signedSha256,'original-hash');assert.ok(archived.removedFromLogsAt);assert.equal(state.auditLogs.filter((e:any)=>e.action==='REGISTRO_ASSINATURA_EXCLUIDO').length,2);assert.equal(state.emailDeliveries.length,0);
 }finally{await stop();await rm(directory,{recursive:true,force:true});}
});
