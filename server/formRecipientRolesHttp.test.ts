import test from 'node:test';import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';import {mkdtemp,writeFile,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import path from 'node:path';import {fileURLToPath} from 'node:url';
import {DEMO_PROCESSES,INITIAL_SETTINGS} from '../src/services/demoSeed';

test('HTTP forms enforce selected participant roles, release gates, native locks and field restrictions',{timeout:45000},async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'portal-form-roles-'));const processFixture=structuredClone(DEMO_PROCESSES[0]);
 processFixture.status='EM_RASCUNHO';processFixture.coorientador={nome:'Coorientador de exemplo',email:'coadvisor@example.invalid',instituicao:'Exemplo'};
 const members=[{email:processFixture.aluno1.email,roles:['STUDENT']},{email:processFixture.orientador.email,roles:['ADVISOR']},{email:processFixture.coorientador.email,roles:['CO_ADVISOR']}].map((x,i)=>({...x,id:'form-role-'+i,processId:processFixture.id,active:true,createdAt:processFixture.createdAt,updatedAt:processFixture.updatedAt}));
 const custom={id:'custom-role-form',title:'Conferência',targetRole:'Orientador',recipientRoles:['AUTHORS','COADVISOR'],isActive:true,questions:[{id:'name',fieldKey:'OBSERVACAO',label:'Observação',fieldType:'text',required:true},{id:'historical',fieldKey:'CPF',label:'CPF',fieldType:'text',required:true}]};
 const unpublished={...custom,id:'not-released'};
 const native={...custom,id:'form-reserva-aluno'};
 const presidency={...custom,id:'presidency-role-form',recipientRoles:['COMMISSION_PRESIDENT']};
 const settings={...structuredClone(INITIAL_SETTINGS),commissionPresidentEmail:'president@example.invalid',integrationStudio:{...INITIAL_SETTINGS.integrationStudio,revision:9,formTemplates:[custom,unpublished,native,presidency]}};
 await writeFile(path.join(dir,'portal-state.json'),JSON.stringify({settings,processes:[processFixture],memberships:members,workflowRuns:[{id:'released-form',processId:processFixture.id,status:'COMPLETED',eventCode:'TCC_CREATED',actions:[{kind:'FORM',status:'COMPLETED',externalId:'form_task_custom-role-form'},{kind:'FORM',status:'COMPLETED',externalId:'form_task_presidency-role-form'}]}]}));
 const port=46000+Math.floor(Math.random()*1000);const child=spawn(process.execPath,['--import','tsx','server.ts'],{cwd:fileURLToPath(new URL('..',import.meta.url)),env:{...process.env,NODE_ENV:'development',PORT:String(port),PORTAL_DATA_DIR:dir,PORTAL_PERSISTENCE_PROVIDER:'local_file',PORTAL_ALLOW_INSECURE_DEMO_AUTH:'true',PORTAL_ALLOW_LOCAL_OTP_STORE:'true',PORTAL_ALLOW_LOCAL_SECRET_STORE:'true',PORTAL_SESSION_SECRET:'test-session-secret-0123456789-abcdef',PORTAL_OTP_PEPPER:'test-otp-pepper-0123456789-abcdef',PORTAL_TEST_DOCUMENT_RENDERER:'true',PORTAL_OTP_DELIVERY_MODE:'log',ASTEN_INTEGRATION_ENABLED:'false',ASTEN_AUTOMATIC_WORKFLOW_ENABLED:'true',SUPABASE_URL:'',SUPABASE_SERVICE_ROLE_KEY:'',SUPABASE_SECRET_KEY:''},stdio:['ignore','pipe','pipe']});child.stdout.resume();child.stderr.resume();
 const base=`http://127.0.0.1:${port}`,url=`/api/processes/${processFixture.id}/forms`;
 const request=async(route:string,email:string,body?:unknown)=>{const r=await fetch(base+route,{method:body===undefined?'GET':'POST',headers:{'content-type':'application/json','x-demo-user-email':email},body:body===undefined?undefined:JSON.stringify(body)});return{status:r.status,body:await r.json()};};
 try{
  const deadline=Date.now()+25000;while(true){try{if((await fetch(base+'/api/health')).ok)break;}catch{}if(Date.now()>deadline||child.exitCode!==null)throw Error('Server startup failed');await new Promise(r=>setTimeout(r,150));}
  for(const email of [processFixture.aluno1.email,processFixture.coorientador.email]){const listed=await request(url,email);assert.equal(listed.status,200);assert.deepEqual(listed.body.map((x:any)=>x.id),[custom.id]);}
  const master=await request(url,settings.masterEmail||'master@portal.local');assert.equal(master.status,200);assert.ok(master.body.some((form:any)=>form.id===custom.id));
  assert.equal((await request(url,'president@example.invalid')).status,404,'global presidency alone does not grant access to this process');
  const advisor=await request(url,processFixture.orientador.email);assert.equal(advisor.status,200);assert.deepEqual(advisor.body,[]);
  const route=url+'/'+custom.id+'/submissions',payload={expectedFormRevision:9,answers:{OBSERVACAO:'Conferência legítima',CPF:'must-be-discarded',NOT_DECLARED:'must-be-discarded'}};
  assert.equal((await request(route,processFixture.orientador.email,payload)).status,404);
  assert.equal((await request(route,'outsider@example.invalid',payload)).status,404);
  assert.equal((await request(url+'/'+presidency.id+'/submissions','president@example.invalid',payload)).status,404,'selected presidency role still requires process access');
  assert.equal((await request(url+'/'+unpublished.id+'/submissions',processFixture.aluno1.email,payload)).status,404);
  assert.equal((await request(url+'/'+native.id+'/submissions',processFixture.aluno1.email,payload)).status,404);
  const stale=await request(route,processFixture.aluno1.email,{...payload,expectedFormRevision:8});assert.equal(stale.status,409);assert.equal(stale.body.code,'STALE_FORM_REVISION');
  const saved=await request(route,processFixture.aluno1.email,payload);assert.equal(saved.status,202);assert.deepEqual(saved.body.answers,{OBSERVACAO:'Conferência legítima'});
 }finally{child.kill('SIGTERM');await new Promise<void>(resolve=>{if(child.exitCode!==null)resolve();else child.once('exit',()=>resolve());});await rm(dir,{recursive:true,force:true});}
});
