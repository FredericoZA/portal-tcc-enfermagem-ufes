import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,writeFile,readFile,rm,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {DEMO_PROCESSES,INITIAL_SETTINGS} from '../src/services/demoSeed';

test('Drive link resolver preserves authentication, process access and local PDF fallback',{timeout:60000},async()=>{
 const directory=await mkdtemp(path.join(tmpdir(),'portal-public-revalidate-'));
 const bytes=Buffer.from('%PDF-1.4\nfixture for byte transfer test\n%%EOF');
 const hash=createHash('sha256').update(bytes).digest('hex'),key='d'.repeat(64);
 const p=structuredClone(DEMO_PROCESSES[0]);p.status='CONCLUIDO';p.defesa.localStatus='CONFIRMADO';p.defesa.invitationDriveFileId='local_review_'+key;p.defesa.invitationSentAt='2026-11-15T00:00:00Z';p.dataRevision=2;p.acervo={...p.acervo,submittedAt:'2026-11-15T00:00:00Z',authorizationConfirmedAt:'2026-11-15T00:00:00Z',publishFullWork:true,publishExpandedAbstract:false,publicationState:'PUBLIC',publicationSyncedAt:'2026-11-15T00:00:00Z',publicationWithdrawnAt:undefined,trabalhoCompletoFileId:'exact_drive_work_original_123',publicFullWorkFileId:'public-copy',trabalhoCompletoSha256:hash};
 const jobs:any[]=[];
 await mkdir(path.join(directory,'arquivos-demonstrativos'));
 const file=path.join(directory,'arquivos-demonstrativos',key+'.pdf');await writeFile(file,bytes);
 await writeFile(path.join(directory,'arquivos-demonstrativos',key+'.json'),JSON.stringify({processId:p.id,artifactType:'CONVITE',fileName:'fixture.pdf',sha256:hash}));
 await writeFile(path.join(directory,'portal-state.json'),JSON.stringify({settings:INITIAL_SETTINGS,processes:[p],signatureJobs:jobs,auditLogs:[],memberships:[{id:'advisor-fixture',processId:p.id,email:p.orientador.email,roles:['ADVISOR'],active:true}],authorizedStudents:[{id:'access-advisor',email:p.orientador.email,nome:p.orientador.nome,active:true,origin:'TCC_FORM',processIds:[p.id]}]}));
 const port=49000+Math.floor(Math.random()*500),base=`http://127.0.0.1:${port}`,route=base+`/api/processes/${p.id}/documents/doc-convite/download`;
 let child:ReturnType<typeof spawn>|undefined;let startupLog='';
 const start=async()=>{
 child=spawn(process.execPath,['--import','tsx','server.ts'],{cwd:process.cwd(),env:{...process.env,NODE_ENV:'development',DISABLE_HMR:'true',PORT:String(port),HOST:'127.0.0.1',PORTAL_DATA_DIR:directory,PORTAL_PERSISTENCE_PROVIDER:'local_file',PORTAL_LOCAL_REVIEW_DATA:'true',PORTAL_ALLOW_INSECURE_DEMO_AUTH:'true',PORTAL_TEST_DOCUMENT_RENDERER:'true',PORTAL_ALLOW_LOCAL_OTP_STORE:'true',PORTAL_ALLOW_LOCAL_SECRET_STORE:'true',PORTAL_OTP_DELIVERY_MODE:'log',PORTAL_SESSION_SECRET:'revalidate-test-0123456789abcdef-0123456789',PORTAL_OTP_PEPPER:'revalidate-test-pepper-0123456789abcdef',ASTEN_INTEGRATION_ENABLED:'false',SUPABASE_URL:'',SUPABASE_SECRET_KEY:'',SUPABASE_SERVICE_ROLE_KEY:'',VERCEL:''},stdio:['ignore','pipe','pipe']});
 child.stdout?.on('data',chunk=>startupLog+=String(chunk));child.stderr?.on('data',chunk=>startupLog+=String(chunk));
 const deadline=Date.now()+25000;while(true){try{if((await fetch(base+'/api/health')).ok)return;}catch{}if(Date.now()>deadline||child.exitCode!==null)throw new Error('Fixture did not start: '+startupLog.slice(-3000));await new Promise(r=>setTimeout(r,100));}
 };
 const stop=async()=>{if(child?.exitCode===null){const done=new Promise(r=>child!.once('exit',r));child.kill('SIGTERM');await done;}};

 try{
  await start();
  const target=route+'?delivery=drive-links';
  assert.equal((await fetch(target)).status,401);
  assert.equal((await fetch(target,{headers:{'x-demo-user-email':'outsider@fixture.invalid'}})).status,404);
  const headers={'x-demo-user-email':p.orientador.email};
  const response=await fetch(target,{headers});assert.equal(response.status,200,await response.clone().text());
  assert.match(response.headers.get('cache-control')||'',/no-store/);
  assert.deepEqual(await response.json(),{links:null});
  const fallback=await fetch(route,{headers});assert.equal(fallback.status,200,await fallback.clone().text());assert.deepEqual(Buffer.from(await fallback.arrayBuffer()),bytes);
  assert.equal((await fetch(route.replace('doc-convite','doc-ata')+'?delivery=drive-links',{headers})).status,404);
  const academic=base+`/api/processes/${p.id}/files/trabalho-completo/download`;
  assert.equal((await fetch(academic+'?delivery=drive-links')).status,401);
  assert.equal((await fetch(academic+'?delivery=drive-links',{headers:{'x-demo-user-email':'outsider@fixture.invalid'}})).status,404);
  assert.deepEqual(await (await fetch(academic+'?delivery=drive-links',{headers})).json(),{links:{view:'https://drive.google.com/file/d/exact_drive_work_original_123/view',download:'https://drive.google.com/uc?export=download&id=exact_drive_work_original_123'}});
  const opened=await fetch(academic+'?view=1',{headers,redirect:'manual'});assert.equal(opened.status,302);assert.equal(opened.headers.get('location'),'https://drive.google.com/file/d/exact_drive_work_original_123/view');
 }finally{await stop();await rm(directory,{recursive:true,force:true});}
});
