import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {INITIAL_SETTINGS} from '../src/services/demoSeed';

test('feedback HTTP exige Master para lista, imagens e análise, inclusive contra a Presidência',{timeout:45000},async()=>{
  const dir=await mkdtemp(path.join(tmpdir(),'portal-feedback-auth-'));
  const master='master@portal.local',president='presidente@portal.local';
  await writeFile(path.join(dir,'portal-state.json'),JSON.stringify({settings:{...INITIAL_SETTINGS,masterEmail:master,commissionPresidentEmail:president},processes:[],memberships:[],signatureJobs:[],emailDeliveries:[],workflowRuns:[]}));
  const port=44000+Math.floor(Math.random()*1000),base=`http://127.0.0.1:${port}`;
  const child=spawn(process.execPath,['--import','tsx','server.ts'],{cwd:process.cwd(),env:{...process.env,NODE_ENV:'development',HOST:'127.0.0.1',PORT:String(port),PORTAL_PUBLIC_URL:base,APP_URL:base,PORTAL_DATA_DIR:dir,PORTAL_ALLOW_INSECURE_DEMO_AUTH:'true',PORTAL_PERSISTENCE_PROVIDER:'local_file',PORTAL_ALLOW_LOCAL_SECRET_STORE:'true',PORTAL_ALLOW_LOCAL_OTP_STORE:'true',PORTAL_SESSION_SECRET:'test-feedback-session-secret-123456789',PORTAL_OTP_PEPPER:'test-feedback-otp-pepper-123456789',SUPABASE_URL:'',SUPABASE_SERVICE_ROLE_KEY:'',SUPABASE_SECRET_KEY:'',GOOGLE_OAUTH_CLIENT_ID:'',GOOGLE_OAUTH_CLIENT_SECRET:'',VERCEL:'',PORTAL_TEST_DOCUMENT_RENDERER:'true',PORTAL_LOCAL_REVIEW_DATA:'false',PORTAL_SERVE_COMPILED_CLIENT:'true',ASTEN_INTEGRATION_ENABLED:'false'},stdio:'ignore'});
  const request=async(url:string,email='',method='GET')=>fetch(base+url,{method,headers:{...(email?{'x-demo-user-email':email}:{}),...(method==='PATCH'?{'content-type':'application/json'}:{})},...(method==='PATCH'?{body:'{}'}:{})});
  try{
    const until=Date.now()+30000;
    while(true){try{if((await fetch(base+'/api/health')).ok)break;}catch{}if(Date.now()>until||child.exitCode!==null)throw Error('Servidor isolado não iniciou');await new Promise(r=>setTimeout(r,200));}
    const me=await request('/api/me',president);assert.equal(me.status,200);assert.ok((await me.json()).globalRoles.includes('COMMISSION_PRESIDENT'));
    const id='11111111-1111-4111-8111-111111111111';
    for(const [url,method]of [['/api/admin/feedback','GET'],['/api/admin/feedback?paginated=true','GET'],[`/api/admin/feedback/${id}/image`,'GET'],[`/api/admin/feedback/${id}/review`,'PATCH']]){
      assert.equal((await request(url,'',method)).status,401,`anônimo ${url}`);
      for(const email of [president,'aluno@example.invalid'])assert.equal((await request(url,email,method)).status,403,`${email} ${url}`);
      const response=await request(url,master,method);assert.equal(response.status,503,`Master autorizado, sem armazenamento remoto ${url}`);assert.match(response.headers.get('cache-control')||'',/private.*no-store/);
    }
    assert.equal((await request('/api/admin/feedback?paginated=true&before=invalid',master)).status,400);
  }finally{
    child.kill('SIGTERM');await new Promise<void>(resolve=>{if(child.exitCode!==null||child.signalCode!==null)return resolve();child.once('exit',()=>resolve());});await rm(dir,{recursive:true,force:true});
  }
});
