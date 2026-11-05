import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {spawn} from 'node:child_process';
import {mkdtemp,writeFile,readFile,rm,mkdir,access} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {INITIAL_SETTINGS,DEMO_PROCESSES} from '../src/services/demoSeed';
import {normalizeStudioSettings} from '../src/services/integrationStudioService';
const secret='active-admin-session-http-test-0123456789abcdef';
const master='master-session@portal.local';
function cookie(email:string,age=3600,expired=false){
 const now=Math.floor(Date.now()/1000),issuedAt=now-age;
 const identity={sessionId:`session_${email.replace(/[^a-z]/g,'')}_1234567890`,uid:`email:${email}`,email,emailVerified:true,authTime:issuedAt,issuedAt,expiresAt:expired?now-1:now+3600,isDemo:false,method:'EMAIL_OTP'};
 const value=Buffer.from(JSON.stringify(identity)).toString('base64url');return `portal_tcc_session=${value}.${createHmac('sha256',secret).update(value).digest('base64url')}`;
}
test('real active Master cookie older than ten minutes can operate while expired, forged and unauthorized sessions cannot', {timeout:45000},async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'portal-active-admin-'));
 const process={...structuredClone(DEMO_PROCESSES[0]),id:'deletable',driveFolderId:undefined,defesa:{...structuredClone(DEMO_PROCESSES[0].defesa),invitationDriveFileId:undefined}};
 const protectedProcess={...structuredClone(process),id:'protected',driveFolderId:'private-institutional-folder'};
 const key='a'.repeat(64),fileId='local_review_'+key;
 const cleanupProcess={...structuredClone(process),id:'cleanup',protocolo:'TCC-2026-0999',defesa:{...process.defesa,invitationDriveFileId:fileId}};
 await mkdir(path.join(dir,'arquivos-demonstrativos'));await writeFile(path.join(dir,'arquivos-demonstrativos',key+'.pdf'),'synthetic file');await writeFile(path.join(dir,'arquivos-demonstrativos',key+'.json'),JSON.stringify({processId:'cleanup'}));
 const studio={...normalizeStudioSettings({}),revision:5,matrixColumns:[],matrixRows:[],docTemplates:[],emailTemplates:[],formTemplates:[],workflowStages:[]};
 await writeFile(path.join(dir,'portal-state.json'),JSON.stringify({settings:{...structuredClone(INITIAL_SETTINGS),masterEmail:master,ownerEmail:master,integrationStudio:studio},processes:[process,protectedProcess,cleanupProcess],memberships:[],signatureJobs:[{id:"cleanup-job",processId:"cleanup",provider:"ASTEN",providerEnvelopeId:"synthetic-envelope",documentType:"ATA",status:"ARCHIVED"}],auditLogs:[{id:"old-cleanup",processId:"cleanup",entityId:"cleanup",action:"OLD"}]}));
 const port=46500+Math.floor(Math.random()*200),base=`http://127.0.0.1:${port}`;
 const child=spawn(globalThis.process.execPath,['--import','tsx','server.ts'],{cwd:globalThis.process.cwd(),env:{...globalThis.process.env,NODE_ENV:'development',HOST:'127.0.0.1',PORT:String(port),PORTAL_DATA_DIR:dir,PORTAL_PERSISTENCE_PROVIDER:'local_file',PORTAL_ALLOW_INSECURE_DEMO_AUTH:'false',PORTAL_TEST_DOCUMENT_RENDERER:'true',PORTAL_ALLOW_LOCAL_OTP_STORE:'true',PORTAL_ALLOW_LOCAL_SECRET_STORE:'true',PORTAL_SESSION_SECRET:secret,PORTAL_OTP_PEPPER:'active-session-otp-test-0123456789abcdef',ASTEN_INTEGRATION_ENABLED:'false',SUPABASE_URL:'',SUPABASE_SECRET_KEY:'',SUPABASE_SERVICE_ROLE_KEY:'',VERCEL:''},stdio:'ignore'});
 const request=(url:string,method='GET',data?:unknown,session=cookie(master))=>fetch(base+url,{method,headers:{'Content-Type':'application/json',...(session?{cookie:session}:{})},...(data===undefined?{}:{body:JSON.stringify(data)})});
 try{
  const deadline=Date.now()+20000;while(true){try{if((await fetch(base+'/api/health')).ok)break;}catch{}if(Date.now()>deadline||child.exitCode!==null)throw Error('Server did not start');await new Promise(r=>setTimeout(r,100));}
  const me=await (await request('/api/me')).json();assert.equal(me.isAuthenticated,true);assert.ok(me.globalRoles.includes('MASTER_ADMIN'));
  const confirm={confirmation:'EXCLUIR',expectedProcessId:'deletable'};
  assert.equal((await request('/api/processes/deletable','DELETE',confirm,'')).status,401);
  assert.equal((await request('/api/processes/deletable','DELETE',confirm,cookie(master,3600,true))).status,401);
  assert.equal((await request('/api/processes/deletable','DELETE',confirm,cookie(master)+'invalid')).status,401);
  assert.equal((await request('/api/processes/deletable','DELETE',confirm,cookie('student@edu.ufes.br'))).status,403);
  const unconfirmed=await request('/api/processes/deletable','DELETE');assert.equal(unconfirmed.status,400);assert.equal((await unconfirmed.json()).code,'PROCESS_DELETE_CONFIRMATION_REQUIRED');
  assert.equal((await request('/api/processes/deletable','DELETE',{...confirm,expectedProcessId:'other'})).status,400);
  const protectedDelete=await request('/api/processes/protected','DELETE',{confirmation:'EXCLUIR',expectedProcessId:'protected',deleteFiles:false,clearHistory:false});assert.equal(protectedDelete.status,202,await protectedDelete.clone().text());
  const save=await request('/api/admin/settings','PATCH',{integrationStudio:{...studio,revision:6},studioExpectedRevision:5,studioSaveMode:'autosave'});assert.equal(save.status,200,await save.clone().text());
  const importCheck=await request('/api/admin/models/ATA/link','POST',{linkOrId:''});assert.equal(importCheck.status,400);assert.notEqual((await importCheck.json()).code,'REAUTHENTICATION_REQUIRED');
  const critical=await request('/api/admin/administration-transfers','POST',{role:'MASTER_ADMIN',targetEmail:'another@portal.local'});assert.equal(critical.status,428);
  const deleted=await request('/api/processes/deletable','DELETE',confirm);assert.equal(deleted.status,200,await deleted.clone().text());
  const cleanup=await request('/api/processes/cleanup','DELETE',{confirmation:'EXCLUIR',expectedProcessId:'cleanup',deleteFiles:true,clearHistory:true});assert.equal(cleanup.status,200,await cleanup.clone().text());
  assert.deepEqual((await cleanup.json()).manualAstenEnvelopes,['synthetic-envelope']);
  await assert.rejects(access(path.join(dir,'arquivos-demonstrativos',key+'.pdf')));
  const queue=await(await request('/api/admin/process-deletions')).json();assert.equal(queue.length,1);
  const protectedTask=queue.find((item:any)=>item.processId==='protected');assert.equal(protectedTask.deleteFiles,true);assert.equal(protectedTask.clearHistory,false);
  assert.equal(queue.some((item:any)=>item.processId==='cleanup'),false);
  assert.equal((await request('/api/admin/process-deletions/'+protectedTask.id+'/retry','POST',{},cookie('student@edu.ufes.br'))).status,403);
  const finish=await request('/api/admin/process-deletions/'+protectedTask.id+'/retry','POST',{});assert.equal(finish.status,200);assert.equal((await(await request('/api/admin/process-deletions')).json()).length,1);
  const disk=JSON.parse(await readFile(path.join(dir,'portal-state.json'),'utf8'));assert.equal(disk.processes.some((p:any)=>p.id==='deletable'),false);assert.equal(disk.processes.some((p:any)=>p.id==='protected'),false);assert.equal(disk.auditLogs.some((l:any)=>l.processId==='cleanup'||l.entityId==='cleanup'),false);assert.equal(disk.signatureJobs.some((j:any)=>j.processId==='cleanup'),false);assert.equal(disk.auditLogs.some((l:any)=>l.action==='EXCLUSAO_PROCESSO_TCC'&&l.entityId==='deletable'),false);
 }finally{if(child.exitCode===null){const stopped=new Promise(r=>child.once('exit',r));child.kill('SIGTERM');await stopped;}await rm(dir,{recursive:true,force:true});}
});
