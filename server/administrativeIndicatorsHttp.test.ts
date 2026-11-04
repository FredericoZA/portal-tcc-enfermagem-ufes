import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {DEMO_PROCESSES,INITIAL_SETTINGS} from '../src/services/demoSeed';
import retiredHandler from './vercel/public-indicators';

test('função Vercel antiga encerra consulta sem carregar dados',()=>{
 const headers:Record<string,string>={};let status=0;let body:any;
 const response:any={setHeader:(k:string,v:string)=>{headers[k]=v;},status:(v:number)=>{status=v;return response;},json:(v:unknown)=>{body=v;return response;}};
 retiredHandler({method:'GET',headers:{},socket:{remoteAddress:'127.0.0.1'}} as any,response);
 assert.equal(status,410);assert.equal(body.code,'PUBLIC_INDICATORS_RETIRED');assert.match(headers['Cache-Control'],/private, no-store/);assert.equal(body.totals,undefined);
});

test('HTTP: indicadores exigem sessão e papel; saídas não ficam em cache público',{timeout:45000},async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'portal-indicators-private-'));
 const processRecord=structuredClone(DEMO_PROCESSES[0]);
 await writeFile(path.join(dir,'portal-state.json'),JSON.stringify({settings:INITIAL_SETTINGS,processes:[processRecord],signatureJobs:[]}));
 const port=47000+Math.floor(Math.random()*900),base=`http://127.0.0.1:${port}`;
 const child=spawn(process.execPath,['--import','tsx','server.ts'],{cwd:process.cwd(),env:{PATH:process.env.PATH,HOME:process.env.HOME,NODE_ENV:'development',HOST:'127.0.0.1',PORT:String(port),APP_URL:base,PORTAL_PUBLIC_URL:base,PORTAL_DATA_DIR:dir,PORTAL_PERSISTENCE_PROVIDER:'local_file',PORTAL_ALLOW_INSECURE_DEMO_AUTH:'true',PORTAL_ALLOW_LOCAL_OTP_STORE:'true',PORTAL_ALLOW_LOCAL_SECRET_STORE:'true',PORTAL_SESSION_SECRET:'indicators-test-session-secret-0123456789abcdef',PORTAL_OTP_PEPPER:'indicators-test-otp-secret-0123456789abcdef',ASTEN_INTEGRATION_ENABLED:'false',SUPABASE_URL:'',SUPABASE_SECRET_KEY:'',SUPABASE_SERVICE_ROLE_KEY:'',VERCEL:''},stdio:'ignore'});
 try{
  const deadline=Date.now()+20000;while(true){try{if((await fetch(base+'/api/health')).ok)break;}catch{}if(Date.now()>deadline||child.exitCode!==null)throw Error('Servidor local não iniciou');await new Promise(r=>setTimeout(r,100));}
  const route=base+'/api/admin/indicators';
  assert.equal((await fetch(route)).status,401);
  assert.equal((await fetch(route,{headers:{'x-demo-user-email':processRecord.aluno1.email}})).status,403);
  for(const email of ['master@portal.local','presidente@portal.local']){
   const response=await fetch(route,{headers:{'x-demo-user-email':email}});assert.equal(response.status,200);assert.match(response.headers.get('cache-control')||'',/private, no-store/);
   const result=await response.json();assert.equal(result.totals.registered,1);assert.equal(result.privacy.smallGroupSuppressed,true);assert.deepEqual(result.themes,[]);assert.doesNotMatch(JSON.stringify(result),/@|matricula|parecer|aluno1/);
  }
  for(const method of ['GET','POST']){const response=await fetch(base+'/api/public/indicators',{method});assert.equal(response.status,410);assert.equal((await response.json()).totals,undefined);assert.match(response.headers.get('cache-control')||'',/no-store/);}
  for(const endpoint of ['/api/admin/continuous-intelligence','/api/admin/continuous-intelligence/refresh','/api/admin/continuous-intelligence/proposals/example']){const response=await fetch(base+endpoint,{method:'POST',headers:{'x-demo-user-email':'master@portal.local'}});assert.equal(response.status,410);}
 }finally{if(child.exitCode===null){const stopped=new Promise(r=>child.once('exit',r));child.kill('SIGTERM');await stopped;}await rm(dir,{recursive:true,force:true});}
});
