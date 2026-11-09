import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {DEMO_PROCESSES,INITIAL_SETTINGS} from '../src/services/demoSeed';

test('bootstrap uses the existing schema whitelist and applicant guards, with only the caller draft and existing flag',{timeout:45000},async()=>{
  const directory=await mkdtemp(path.join(tmpdir(),'portal-registration-bootstrap-'));
  const master='master@portal.local',student='student@example.invalid',other='other@example.invalid',inactive='inactive@example.invalid';
  const portalProcess=structuredClone(DEMO_PROCESSES[0]);portalProcess.id='fixture-bootstrap';portalProcess.titulo='OTHER_PROCESS_PRIVATE_TITLE';portalProcess.aluno1={...portalProcess.aluno1,email:student,nome:'Own Process Name'};portalProcess.aluno2={...portalProcess.aluno1,email:master,nome:'OTHER_MASTER_PROCESS_NAME'};
  const draft=(owner:string,name:string)=>({ownerEmail:owner,answers:{ALUNO_1_EMAIL:owner,ALUNO_1_NOME:name,ALUNO_1_MATRICULA:'REMOVED_IDENTIFIER'},section:2,revision:1,schemaRevision:INITIAL_SETTINGS.integrationStudio?.revision||0,updatedAt:new Date().toISOString(),expiresAt:'2099-01-01T00:00:00Z'});
  await writeFile(path.join(directory,'portal-state.json'),JSON.stringify({settings:{...structuredClone(INITIAL_SETTINGS),masterEmail:master,privateToken:'SETTINGS_PRIVATE_SECRET'},processes:[portalProcess],memberships:[],registrationDrafts:{[student]:draft(student,'Own Draft'),[other]:draft(other,'OTHER_DRAFT_PRIVATE_NAME')},authorizedStudents:[student,other,inactive].map(email=>({id:email,email,nome:email===student?'Own Applicant':'OTHER_ACCESS_PRIVATE_NAME',active:email!==inactive,processIds:[],roles:['STUDENT'],accessType:'STUDENT',origin:'MASTER_LIST',createdBy:master,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()}))}));
  const port=46200+Math.floor(Math.random()*200),base=`http://127.0.0.1:${port}`;
  const child=spawn(process.execPath,['--import','tsx','server.ts'],{cwd:process.cwd(),env:{PATH:globalThis.process.env.PATH,HOME:globalThis.process.env.HOME,NODE_ENV:'development',HOST:'127.0.0.1',PORT:String(port),APP_URL:base,PORTAL_PUBLIC_URL:base,PORTAL_DATA_DIR:directory,PORTAL_PERSISTENCE_PROVIDER:'local_file',PORTAL_ALLOW_INSECURE_DEMO_AUTH:'true',PORTAL_ALLOW_LOCAL_OTP_STORE:'true',PORTAL_ALLOW_LOCAL_SECRET_STORE:'true',PORTAL_TEST_DOCUMENT_RENDERER:'true',PORTAL_SESSION_SECRET:'bootstrap-test-session-0123456789abcdef-0123456789',PORTAL_OTP_PEPPER:'bootstrap-test-pepper-0123456789abcdef',ASTEN_INTEGRATION_ENABLED:'false',SUPABASE_URL:'',SUPABASE_SECRET_KEY:'',SUPABASE_SERVICE_ROLE_KEY:'',VERCEL:''},stdio:'ignore'});
  const headers=(email:string)=>({'x-demo-user-email':email});
  try{
    const deadline=Date.now()+20000;
    while(true){try{if((await fetch(base+'/api/health')).ok)break;}catch{}if(Date.now()>deadline||child.exitCode!==null)throw Error('Servidor local não iniciou');await new Promise(resolve=>setTimeout(resolve,100));}
    assert.equal((await fetch(base+'/api/registration/bootstrap')).status,401);
    for(const email of [inactive,'unauthorized@example.invalid'])assert.equal((await fetch(base+'/api/registration/bootstrap',{headers:headers(email)})).status,403);
    const response=await fetch(base+'/api/registration/bootstrap',{headers:headers(student)});
    assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'private, no-store');
    assert.match(response.headers.get('server-timing')||'',/total;dur=[\d.]+/);
    const body=await response.json();
    assert.equal(body.hasExistingProcess,true);assert.equal(body.draft.ownerEmail,student);assert.equal(body.draft.answers.ALUNO_1_NOME,'Own Draft');
    assert.deepEqual(Object.keys(body).sort(),['draft','hasExistingProcess','schema']);
    assert.doesNotMatch(JSON.stringify(body),/OTHER_|SETTINGS_PRIVATE_SECRET|REMOVED_IDENTIFIER|MATRICULA/);
    const oldSchema=await (await fetch(base+'/api/forms/registration-schema',{headers:headers(student)})).json();
    assert.deepEqual(body.schema,oldSchema);
    const masterBody=await (await fetch(base+'/api/registration/bootstrap',{headers:headers(master)})).json();
    assert.equal(masterBody.hasExistingProcess,false);assert.equal(masterBody.draft,null);
    const otherBody=await (await fetch(base+'/api/registration/bootstrap',{headers:headers(other)})).json();
    assert.equal(otherBody.hasExistingProcess,false);assert.equal(otherBody.draft.ownerEmail,other);
    const denied=await fetch(base+'/api/registration/draft',{method:'PUT',headers:{...headers(student),'content-type':'application/json'},body:JSON.stringify({expectedRevision:1,schemaRevision:body.schema.revision,answers:{}})});
    assert.equal(denied.status,409);assert.match((await denied.json()).error,/já tem um TCC/);
    const saved=await fetch(base+'/api/registration/draft',{method:'PUT',headers:{...headers(other),'content-type':'application/json'},body:JSON.stringify({expectedRevision:1,schemaRevision:body.schema.revision,answers:{ALUNO_1_EMAIL:other,ALUNO_1_NOME:'Other'}})});
    assert.equal(saved.status,200);assert.match(saved.headers.get('server-timing')||'',/draft_commit;dur=[\d.]+/);
  }finally{
    if(child.exitCode===null){const exited=new Promise(resolve=>child.once('exit',resolve));child.kill('SIGTERM');await exited;}
    await rm(directory,{recursive:true,force:true});
  }
});
