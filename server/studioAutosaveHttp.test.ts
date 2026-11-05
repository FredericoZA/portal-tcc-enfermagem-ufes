import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn,type ChildProcess} from 'node:child_process';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {INITIAL_SETTINGS} from '../src/services/demoSeed';
import {courseStudioFixture} from './fixtures/courseStudioFixture';

test('autosave preserves valid and incomplete drafts after restart and activation requires explicit publication',{timeout:45000},async()=>{
 const directory=await mkdtemp(path.join(tmpdir(),'portal-autosave-'));
 const port=47800+Math.floor(Math.random()*500),base=`http://127.0.0.1:${port}`;
 const active=courseStudioFixture();
 await writeFile(path.join(directory,'portal-state.json'),JSON.stringify({settings:{...INITIAL_SETTINGS,integrationStudio:active},processes:[],memberships:[]}));
 let child:ChildProcess;
 const start=async()=>{
  child=spawn(process.execPath,['--import','tsx','server.ts'],{cwd:process.cwd(),env:{...process.env,PORT:String(port),HOST:'127.0.0.1',NODE_ENV:'development',PORTAL_DATA_DIR:directory,PORTAL_PERSISTENCE_PROVIDER:'local_file',PORTAL_ALLOW_INSECURE_DEMO_AUTH:'true',PORTAL_ALLOW_LOCAL_OTP_STORE:'true',PORTAL_ALLOW_LOCAL_SECRET_STORE:'true',PORTAL_SESSION_SECRET:'test-autosave-session-secret-0123456789',PORTAL_OTP_PEPPER:'test-autosave-otp-pepper-0123456789',PORTAL_OTP_DELIVERY_MODE:'log',ASTEN_INTEGRATION_ENABLED:'false',SUPABASE_URL:'',SUPABASE_SECRET_KEY:'',SUPABASE_SERVICE_ROLE_KEY:'',VERCEL:''},stdio:['ignore','pipe','pipe']});child.stdout!.resume();child.stderr!.resume();
  const deadline=Date.now()+20000;while(true){try{if((await fetch(base+'/api/health')).ok)break;}catch{}if(Date.now()>deadline||child.exitCode!==null)throw new Error('Servidor isolado não iniciou.');await new Promise(resolve=>setTimeout(resolve,100));}
 };
 const stop=async()=>{if(child&&child.exitCode===null){const ended=new Promise(resolve=>child.once('exit',resolve));child.kill('SIGTERM');await ended;}};
 const save=async(studio:any,expected:number,email='master@portal.local',mode='autosave')=>{
  const r=await fetch(base+'/api/admin/settings',{method:'PATCH',headers:{'content-type':'application/json',...(email?{'x-demo-user-email':email}:{})},body:JSON.stringify({integrationStudio:studio,studioExpectedRevision:expected,studioSaveMode:mode})});return {status:r.status,body:await r.json()};
 };
 const settings=async()=>await(await fetch(base+'/api/settings',{headers:{'x-demo-user-email':'master@portal.local'}})).json();
 try{
  await start();const incomplete=structuredClone(active);incomplete.revision=2;incomplete.emailTemplates[0].recipient='';incomplete.workflowStages[0].title='Etapa alterada automaticamente';
  assert.equal((await save(incomplete,1,'')).status,401);assert.equal((await save(incomplete,1,'student@example.org')).status,403);
  assert.equal((await save(incomplete,1,'master@portal.local','publish')).status,400,'explicit publication still validates completeness');
  const saved=await save(incomplete,1);assert.equal(saved.status,200,JSON.stringify(saved.body));assert.equal(saved.body.integrationStudioDraft.publication.status,'DRAFT');assert.equal(saved.body.integrationStudioDraft.emailTemplates[0].recipient,'');assert.equal(saved.body.integrationStudio.revision,1);assert.equal(saved.body.integrationStudio.emailTemplates[0].recipient,active.emailTemplates[0].recipient);
  const next=structuredClone(saved.body.integrationStudioDraft);next.revision=3;next.formTemplates[0].questions[0].label='Campo de formulário alterado';assert.equal((await save(next,2)).status,200);
  assert.equal((await save(next,2)).status,409,'old revision cannot overwrite another autosave');
  const publicSettings=await(await fetch(base+'/api/settings')).json();assert.equal(publicSettings.integrationStudioDraft,undefined);assert.equal(publicSettings.integrationStudio,undefined);
  await stop();await start();let reopened=await settings();assert.equal(reopened.integrationStudioDraft.revision,3);assert.equal(reopened.integrationStudioDraft.workflowStages[0].title,'Etapa alterada automaticamente');assert.equal(reopened.integrationStudioDraft.formTemplates[0].questions[0].label,'Campo de formulário alterado');
  const image='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==';
  const imageResponse=await fetch(base+'/api/admin/studio/image',{method:'PATCH',headers:{'content-type':'application/json','x-demo-user-email':'master@portal.local'},body:JSON.stringify({kind:'email',templateId:'confirmacao',field:'heroImageUrl',value:image,expectedRevision:3,expectedImageValue:''})});assert.equal(imageResponse.status,200,await imageResponse.text());
  reopened=await settings();assert.equal(reopened.integrationStudioDraft.revision,4);assert.equal(reopened.integrationStudioDraft.emailDesigns.confirmacao.heroImageUrl,image);assert.equal(reopened.integrationStudio.revision,1);
  const completed=structuredClone(reopened.integrationStudioDraft);completed.revision=5;completed.emailTemplates[0].recipient='autores@example.org';
  const draft=await save(completed,4);assert.equal(draft.status,200,JSON.stringify(draft.body));
  assert.equal(draft.body.integrationStudioDraft.revision,5);assert.equal(draft.body.integrationStudioDraft.publication.status,'DRAFT');
  assert.equal(draft.body.integrationStudio.emailTemplates[0].recipient,active.emailTemplates[0].recipient);
  const candidate={...draft.body.integrationStudioDraft,revision:6};
  assert.equal((await save(null,5,'master@portal.local','publish')).status,400,'a malformed payload cannot clear the active configuration');
  assert.equal((await save(candidate,5,'master@portal.local','')).status,400,'publication mode must be explicit');
  assert.equal((await save(candidate,1,'master@portal.local','publish')).status,409,'publication cannot overwrite an unseen draft');
  const published=await save(candidate,5,'master@portal.local','publish');assert.equal(published.status,200,JSON.stringify(published.body));assert.equal(published.body.integrationStudioDraft,undefined);assert.equal(published.body.integrationStudio.revision,6);assert.equal(published.body.integrationStudio.publication.status,'PUBLISHED');assert.equal(published.body.integrationStudio.emailTemplates[0].recipient,'autores@example.org');
  const durable=JSON.parse(await readFile(path.join(directory,'portal-state.json'),'utf8'));assert.equal(durable.settings.integrationStudio.revision,6);assert.ok(durable.auditLogs.some((r:any)=>r.action==='SALVAMENTO_AUTOMATICO_ESTUDIO'));assert.ok(durable.auditLogs.some((r:any)=>r.action==='PUBLICACAO_ESTUDIO_INTEGRADO'));
 }finally{await stop();await rm(directory,{recursive:true,force:true});}
});
