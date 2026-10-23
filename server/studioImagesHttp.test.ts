import test from 'node:test';
import {normalizeStudioSettings} from '../src/services/integrationStudioService';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {DEMO_PROCESSES,DEMO_MEMBERSHIPS,INITIAL_SETTINGS} from '../src/services/demoSeed';

test('HTTP: imagem persiste mesmo com pacote incompleto, sem publicar outros campos e com controle de acesso', {timeout:45000}, async()=>{
 const directory=await mkdtemp(path.join(tmpdir(),'portal-studio-image-'));
 const settings=structuredClone(INITIAL_SETTINGS);
 const studio=settings.integrationStudio=normalizeStudioSettings({}) as import('../src/types/integrationStudio').IntegrationStudioSettings;
 studio.formTemplates=[{id:'incomplete-form',title:'',questions:[]} as any];
 studio.emailTemplates=[{id:'email-fixture',name:'Modelo',recipient:'',subject:'',body:''}];
 await writeFile(path.join(directory,'portal-state.json'),JSON.stringify({settings,processes:[],memberships:[]}));
 const port=43500+Math.floor(Math.random()*500);
 const child=spawn(process.execPath,['--import','tsx','server.ts'],{cwd:fileURLToPath(new URL('..',import.meta.url)),env:{...process.env,NODE_ENV:'development',PORT:String(port),PORTAL_DATA_DIR:directory,PORTAL_SESSION_SECRET:'test-session-secret-0123456789-abcdef',PORTAL_OTP_PEPPER:'test-otp-pepper-0123456789-abcdef',PORTAL_ALLOW_INSECURE_DEMO_AUTH:'true',PORTAL_ALLOW_LOCAL_OTP_STORE:'true',PORTAL_ALLOW_LOCAL_SECRET_STORE:'true',PORTAL_TEST_DOCUMENT_RENDERER:'true',PORTAL_OTP_DELIVERY_MODE:'log',ASTEN_INTEGRATION_ENABLED:'false',PORTAL_PERSISTENCE_PROVIDER:'local_file',SUPABASE_URL:'',SUPABASE_SERVICE_ROLE_KEY:'',SUPABASE_SECRET_KEY:''},stdio:['ignore','pipe','pipe']});
 child.stdout.resume();child.stderr.resume();
 const base=`http://127.0.0.1:${port}`;
 const image='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==';
 const patch=async(email:string,body:unknown)=>{const response=await fetch(`${base}/api/admin/studio/image`,{method:'PATCH',headers:{'content-type':'application/json',...(email?{'x-demo-user-email':email}:{})},body:JSON.stringify(body)});return {status:response.status,body:await response.json()};};
 const input={kind:'email',templateId:'email-fixture',field:'heroImageUrl',value:image,expectedRevision:studio.revision||0};
 try{
  const deadline=Date.now()+25000;while(true){try{if((await fetch(base+'/api/health')).ok)break;}catch{}if(Date.now()>deadline||child.exitCode!==null)throw new Error('Servidor de teste não iniciou.');await new Promise(resolve=>setTimeout(resolve,200));}
  assert.equal((await patch('',input)).status,401);
  assert.equal((await patch('student@example.invalid',input)).status,403);
  assert.equal((await patch('master@portal.local',{...input,field:'recipient'})).status,400);
  assert.equal((await patch('master@portal.local',{...input,value:'data:image/svg+xml;base64,PHN2Zz4='})).status,400);
  assert.equal((await patch('master@portal.local',{...input,value:'data:image/png;base64,aW52YWxpZA=='})).status,400);
  const saved=await patch('master@portal.local',input);assert.equal(saved.status,200,JSON.stringify(saved.body));
  assert.equal(saved.body.imageUrl,image);assert.equal(saved.body.revision,input.expectedRevision+1);
  assert.equal((await patch('master@portal.local',input)).status,409);
  const formSaved=await patch('master@portal.local',{kind:'form',templateId:'incomplete-form',field:'logoUrl',value:image,expectedRevision:input.expectedRevision,expectedImageValue:''});
  assert.equal(formSaved.status,200,JSON.stringify(formSaved.body));assert.equal(formSaved.body.revision,saved.body.revision+1);
  assert.equal((await patch('master@portal.local',{...input,expectedImageValue:''})).status,409,'same image changed in another session');
  const stalePackage=await fetch(base+'/api/admin/settings',{method:'PATCH',headers:{'content-type':'application/json','x-demo-user-email':'master@portal.local'},body:JSON.stringify({integrationStudio:{...studio,revision:999},studioExpectedRevision:0})});
  assert.equal(stalePackage.status,409,'stale full draft cannot overwrite the saved images by jumping revision');
  const state=JSON.parse(await readFile(path.join(directory,'portal-state.json'),'utf8'));
  assert.equal(state.settings.integrationStudio.emailDesigns['email-fixture'].heroImageUrl,image);
  assert.deepEqual(state.settings.integrationStudio.emailTemplates,studio.emailTemplates);
  assert.deepEqual(state.settings.integrationStudio.formTemplates,studio.formTemplates);
  assert.equal(state.settings.integrationStudio.formDesigns['incomplete-form'].logoUrl,image);
  assert.equal(state.auditLogs.filter((log:any)=>log.action==='ALTERACAO_IMAGEM_ESTUDIO').length,2);
  assert.equal(state.processes.length,0);
 }finally{child.kill('SIGTERM');await new Promise(resolve=>child.once('exit',resolve));await rm(directory,{recursive:true,force:true});}
});
