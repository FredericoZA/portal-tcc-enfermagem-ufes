import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {DEMO_PROCESSES,INITIAL_SETTINGS} from '../src/services/demoSeed';
import {canonicalLegacyRecord} from './legacyArchive';

test('HTTP: indicadores públicos incluem legados sem dados individuais; rota administrativa mantém autorização',{timeout:45000},async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'portal-indicators-private-'));
 const processRecord=structuredClone(DEMO_PROCESSES[0]);
 const legacyAcademicRecords=Array.from({length:6},(_,index)=>canonicalLegacyRecord({
  id:`legado-000${index+1}`,protocolo:`00${index+1} - Legado`,sourceFingerprint:String(index+1).repeat(64),
  titulo:'Título privado de teste',autores:['Pessoa demonstrativa'],orientador:'Docente demonstrativo',coorientador:'',coorientadorInstituicao:'',examinadores:[],resumo:'Resumo privado de teste',palavrasChave:[],
  dataDefesa:'2023-06-01',horaDefesa:'',localDefesa:'Local individual',isPublic:false,publishFullWork:false,publishExpandedAbstract:false,publicationState:'NOT_REQUESTED',authorizationDecision:'UNSPECIFIED',
  attachments:[{driveFileId:'private_file_123456',fileName:'documento-privado.pdf',kind:'TRABALHO_COMPLETO',sha256:'b'.repeat(64),evidence:'Conferido'}],provenance:{originalConsent:[index<3?'Sim':'Não']},
 }));
 await writeFile(path.join(dir,'portal-state.json'),JSON.stringify({settings:INITIAL_SETTINGS,processes:[processRecord],legacyAcademicRecords,signatureJobs:[]}));
 const port=47000+Math.floor(Math.random()*900),base=`http://127.0.0.1:${port}`;
 const child=spawn(process.execPath,['--import','tsx','server.ts'],{cwd:process.cwd(),env:{PATH:process.env.PATH,HOME:process.env.HOME,NODE_ENV:'development',HOST:'127.0.0.1',PORT:String(port),APP_URL:base,PORTAL_PUBLIC_URL:base,PORTAL_DATA_DIR:dir,PORTAL_PERSISTENCE_PROVIDER:'local_file',PORTAL_ALLOW_INSECURE_DEMO_AUTH:'true',PORTAL_ALLOW_LOCAL_OTP_STORE:'true',PORTAL_ALLOW_LOCAL_SECRET_STORE:'true',PORTAL_SESSION_SECRET:'indicators-test-session-secret-0123456789abcdef',PORTAL_OTP_PEPPER:'indicators-test-otp-secret-0123456789abcdef',ASTEN_INTEGRATION_ENABLED:'false',SUPABASE_URL:'',SUPABASE_SECRET_KEY:'',SUPABASE_SERVICE_ROLE_KEY:'',VERCEL:''},stdio:'ignore'});
 try{
  const deadline=Date.now()+20000;while(true){try{if((await fetch(base+'/api/health')).ok)break;}catch{}if(Date.now()>deadline||child.exitCode!==null)throw Error('Servidor local não iniciou');await new Promise(r=>setTimeout(r,100));}
  const route=base+'/api/admin/indicators';
  assert.equal((await fetch(route)).status,401);
  assert.equal((await fetch(route,{headers:{'x-demo-user-email':processRecord.aluno1.email}})).status,403);
  for(const email of ['master@portal.local','presidente@portal.local']){
   const response=await fetch(route,{headers:{'x-demo-user-email':email}});assert.equal(response.status,200);assert.match(response.headers.get('cache-control')||'',/private, no-store/);
   const result=await response.json();assert.equal(result.totals.registered,7);assert.equal(result.totals.published,3);assert.equal(result.privacy.smallGroupSuppressed,false);assert.deepEqual(result.themes,[]);assert.doesNotMatch(JSON.stringify(result),/@|matricula|parecer|aluno1|private_file|Título privado|Pessoa demonstrativa|Resumo privado|Local individual/);
  }
  for(const email of ['',processRecord.aluno1.email,'master@portal.local']){
   const response=await fetch(base+'/api/public/indicators',{headers:email?{'x-demo-user-email':email}:{}});assert.equal(response.status,200);const result=await response.json();assert.equal(result.totals.registered,7);assert.equal(result.totals.published,3);assert.equal(result.privacy.containsPersonalData,false);assert.deepEqual(result.locations,[]);assert.doesNotMatch(JSON.stringify(result),/@|matricula|parecer|aluno1|private_file|Título privado|Pessoa demonstrativa|Resumo privado|Local individual/);
  }
  const post=await fetch(base+'/api/public/indicators',{method:'POST'});assert.equal(post.status,405);assert.equal((await post.json()).totals,undefined);
  for(const endpoint of ['/api/admin/continuous-intelligence','/api/admin/continuous-intelligence/refresh','/api/admin/continuous-intelligence/proposals/example']){const response=await fetch(base+endpoint,{method:'POST',headers:{'x-demo-user-email':'master@portal.local'}});assert.equal(response.status,404);assert.equal((await response.json()).code,'API_NOT_FOUND');}
 }finally{if(child.exitCode===null){const stopped=new Promise(r=>child.once('exit',r));child.kill('SIGTERM');await stopped;}await rm(dir,{recursive:true,force:true});}
});
