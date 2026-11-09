import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {spawn,type ChildProcess} from 'node:child_process';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {INITIAL_SETTINGS,DEMO_PROCESSES} from '../src/services/demoSeed';
test('retired signature deletion returns 404 for every role and preserves records after restart',{timeout:50000},async()=>{
 const directory=await mkdtemp(path.join(tmpdir(),'portal-signature-removal-'));
 const port=47400+Math.floor(Math.random()*200),base=`http://127.0.0.1:${port}`,secret='signature-removal-fixture-0123456789abcdef';
 const process=structuredClone(DEMO_PROCESSES[0]);
 process.id='signature-process';
 process.status='CONCLUIDO';
 process.orientador.email='advisor@example.invalid';
 const roleUsers=[['student@example.invalid','STUDENT'],['advisor@example.invalid','ADVISOR'],['coadvisor@example.invalid','CO_ADVISOR'],['examiner@example.invalid','EXAMINER']] as const;
 const memberships=roleUsers.map(([email,role],index)=>({id:`membership-${index}`,email,roles:[role],processId:process.id,active:true,createdAt:'2026-11-04T12:00:00Z',updatedAt:'2026-11-04T12:00:00Z'}));
 const job=(id:string,patch:Record<string,unknown>={})=>({id,processId:process.id,protocol:'TEST-001',documentTitle:'Ata',documentType:'ATA',documentVersion:1,sourceDataRevision:1,provider:'GOV_BR',status:'READY_FOR_REVIEW',createdAt:'2026-11-04T12:00:00Z',updatedAt:'2026-11-04T12:00:00Z',createdBy:'master@portal.local',signers:[],...patch});
 const hiddenArchive=job('historical-archive',{documentType:'DECLARACAO',status:'ARCHIVED',driveSignedFileId:'historical-archive-file',removedFromLogsAt:'2026-11-03T12:00:00Z',removedFromLogsBy:'master@portal.local'});
 const jobs=[hiddenArchive,job('draft'),job('archived',{provider:'ASTEN',providerEnvelopeId:'123',status:'ARCHIVED',driveSignedFileId:'original-signed-file',signedSha256:'original-hash'}),job('sending',{status:'SENDING'}),job('uncertain',{provider:'ASTEN',providerCreationState:'UNCERTAIN'}),job('historically-hidden',{status:'CANCELED',removedFromLogsAt:'2026-11-03T12:00:00Z',removedFromLogsBy:'master@portal.local'})];
 await writeFile(path.join(directory,'portal-state.json'),JSON.stringify({settings:INITIAL_SETTINGS,processes:[process],memberships,emailDeliveries:[],signatureJobs:jobs}));
 const cookie=(email:string)=>{
  const now=Math.floor(Date.now()/1000);
  const value=Buffer.from(JSON.stringify({sessionId:`signature_retirement_${email.replace(/[^a-z]/g,'')}`,uid:`email:${email}`,email,emailVerified:true,authTime:now,issuedAt:now,expiresAt:now+3600,isDemo:false,method:'EMAIL_OTP'})).toString('base64url');
  return `portal_tcc_session=${value}.${createHmac('sha256',secret).update(value).digest('base64url')}`;
 };
 let child:ChildProcess|undefined;
 const start=async()=>{child=spawn(globalThis.process.execPath,['--import','tsx','server.ts'],{cwd:globalThis.process.cwd(),env:{...globalThis.process.env,NODE_ENV:'development',PORT:String(port),HOST:'127.0.0.1',PORTAL_DATA_DIR:directory,PORTAL_PERSISTENCE_PROVIDER:'local_file',PORTAL_ALLOW_INSECURE_DEMO_AUTH:'false',PORTAL_ALLOW_LOCAL_OTP_STORE:'true',PORTAL_ALLOW_LOCAL_SECRET_STORE:'true',PORTAL_SESSION_SECRET:secret,PORTAL_OTP_PEPPER:'parity-fixture-otp-secret-0123456789',PORTAL_OTP_DELIVERY_MODE:'log',ASTEN_INTEGRATION_ENABLED:'false',ASTEN_WEBHOOK_SECRET:'signature-removal-webhook-fixture-0123456789abcdef',SUPABASE_URL:'',SUPABASE_SECRET_KEY:'',SUPABASE_SERVICE_ROLE_KEY:'',VERCEL:''},stdio:'ignore'});const until=Date.now()+20000;while(true){try{if((await fetch(base+'/api/health')).ok)break;}catch{}if(Date.now()>until||child.exitCode!==null)throw Error('Fixture did not start');await new Promise(r=>setTimeout(r,100));}};
 const stop=async()=>{if(child&&child.exitCode===null){const ended=new Promise(r=>child!.once('exit',r));child.kill('SIGTERM');await ended;}};
 const headers={'content-type':'application/json',cookie:cookie('master@portal.local')};
 try{
  await start();
  const remove=(id:string,email?:string)=>fetch(`${base}/api/signatures/jobs/${id}`,{method:'DELETE',headers:{'content-type':'application/json',...(email?{cookie:cookie(email)}:{})}});
  const list=async()=>await(await fetch(base+'/api/signatures/jobs',{headers})).json();
  const before=await list();assert.equal(before.length,4);
  assert.ok(!before.some((item:any)=>item.id===hiddenArchive.id));
  const processEvidence=await (await fetch(`${base}/api/processes/${process.id}/signatures`,{headers})).json();
  const preserved=processEvidence.find((item:any)=>item.id===hiddenArchive.id);
  assert.equal(preserved.driveSignedFileId,'historical-archive-file');
  assert.equal(preserved.removedFromLogsBy,undefined);
  assert.ok(!processEvidence.some((item:any)=>item.id==='historically-hidden'));
  const presidency=await (await fetch(base+'/api/president/signature-queue',{headers})).json();
  assert.ok(presidency.find((entry:any)=>entry.process.id===process.id).jobs.some((item:any)=>item.id===hiddenArchive.id));

  for(const [email,role] of [...roleUsers,['master@portal.local','MASTER_ADMIN'],['presidente@portal.local','COMMISSION_PRESIDENT']] as const){
   const identity=await(await fetch(base+'/api/me',{headers:{cookie:cookie(email)}})).json();
   assert.equal(identity.isAuthenticated,true);
   assert.ok(identity.globalRoles.includes(role)||identity.memberships.some((membership:any)=>membership.roles.includes(role)),`Fixture must have ${role}`);
   assert.equal((await remove('draft',email)).status,404,`${role} cannot delete a signature record`);
  }
  assert.equal((await remove('draft')).status,404);
  for(const id of ['archived','sending','uncertain','historically-hidden','missing'])assert.equal((await remove(id,'master@portal.local')).status,404);
  assert.deepEqual(await list(),before);
  const diskBeforeRestart=JSON.parse(await readFile(path.join(directory,'portal-state.json'),'utf8'));
  assert.deepEqual(diskBeforeRestart.signatureJobs,jobs);
  await stop();await start();assert.deepEqual(await list(),before);
  const state=JSON.parse(await readFile(path.join(directory,'portal-state.json'),'utf8'));
  assert.deepEqual(state.signatureJobs,jobs);
  assert.equal((state.auditLogs||[]).filter((e:any)=>e.action==='REGISTRO_ASSINATURA_EXCLUIDO').length,0);
  assert.equal(state.emailDeliveries.length,0);
 }finally{await stop();await rm(directory,{recursive:true,force:true});}
});
