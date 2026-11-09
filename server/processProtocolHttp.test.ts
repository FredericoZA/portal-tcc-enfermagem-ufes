import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac,randomBytes} from 'node:crypto';
import {spawn,type ChildProcess} from 'node:child_process';
import {createServer} from 'node:net';
import {mkdtemp,readFile,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {DEMO_PROCESSES,INITIAL_SETTINGS} from '../src/services/demoSeed';
import type {ProcessData} from '../src/types';

const master='master@protocol.invalid';
const authors=Array.from({length:4},(_,index)=>`author-${index+1}@protocol.invalid`);
const advisor='advisor@protocol.invalid';
const year=new Date().getFullYear();
const code=(sequence:number)=>`TCC - ${String(sequence).padStart(5,'0')}`;
const historicalCode=(sequence:number)=>`TCC-${year}-${String(sequence).padStart(4,'0')}`;
const reference=(sequence:number)=>encodeURIComponent(code(sequence));

function initialState(processes:ProcessData[]=[],extra:Record<string,unknown>={}){
  const now=new Date().toISOString();
  return {
    settings:{...structuredClone(INITIAL_SETTINGS),masterEmail:master,ownerEmail:master,commissionPresidentEmail:'',academicCycles:[],calendarId:'',documentModels:{}},
    processes,memberships:[],signatureJobs:[],legacyAcademicRecords:[],auditLogs:[],
    authorizedStudents:authors.map((email,index)=>({id:`access-${index}`,email,nome:`Autora de Teste ${index+1}`,active:true,roles:['STUDENT'],accessType:'STUDENT',processIds:[],origin:'MASTER_LIST',createdBy:master,createdAt:now,updatedAt:now})),
    ...extra,
  };
}

async function fixture(state:ReturnType<typeof initialState>){
  const directory=await mkdtemp(path.join(tmpdir(),'portal-protocol-http-'));
  const stateFile=path.join(directory,'portal-state.json');
  await writeFile(stateFile,JSON.stringify(state));
  const secret=randomBytes(40).toString('hex');
  const inherited=Object.fromEntries(['PATH','HOME','TMPDIR','LANG','TZ'].filter(key=>process.env[key]).map(key=>[key,process.env[key]]));
  const isolate="import dotenv from 'dotenv';dotenv.config=()=>({parsed:{}});globalThis.fetch=async()=>{throw new Error('Providers are disabled in this fixture.');};await import('./server.ts');";
  let child:ChildProcess|undefined;
  let base='';
  let output='';
  const stop=async()=>{
    if(child&&child.exitCode===null&&child.signalCode===null){const ended=new Promise<void>(resolve=>child!.once('exit',()=>resolve()));child.kill('SIGTERM');await ended;}
  };
  const start=async()=>{
    const socket=createServer();
    await new Promise<void>(resolve=>socket.listen(0,'127.0.0.1',resolve));
    const port=(socket.address() as {port:number}).port;
    await new Promise<void>((resolve,reject)=>socket.close(error=>error?reject(error):resolve()));
    base=`http://127.0.0.1:${port}`;
    child=spawn(process.execPath,['--import','tsx','--input-type=module','-e',isolate],{cwd:process.cwd(),env:{...inherited,NODE_ENV:'development',HOST:'127.0.0.1',PORT:String(port),VERCEL:'',PORTAL_DATA_DIR:directory,
      PORTAL_PUBLIC_URL:base,APP_URL:base,PORTAL_PERSISTENCE_PROVIDER:'local_file',PORTAL_LOCAL_REVIEW_DATA:'false',PORTAL_ALLOW_INSECURE_DEMO_AUTH:'false',
      PORTAL_TEST_DOCUMENT_RENDERER:'true',PORTAL_ALLOW_LOCAL_OTP_STORE:'true',PORTAL_ALLOW_LOCAL_SECRET_STORE:'true',PORTAL_SESSION_SECRET:secret,PORTAL_OTP_PEPPER:randomBytes(40).toString('hex'),
      PORTAL_SECRET_ENCRYPTION_KEY:randomBytes(32).toString('hex'),PORTAL_OTP_DELIVERY_MODE:'log',ASTEN_INTEGRATION_ENABLED:'false',SUPABASE_URL:'',SUPABASE_SECRET_KEY:'',SUPABASE_SERVICE_ROLE_KEY:'',GOOGLE_OAUTH_CLIENT_ID:'',GOOGLE_OAUTH_CLIENT_SECRET:''},stdio:['ignore','pipe','pipe']});
    child.stdout?.on('data',chunk=>{output=(output+chunk).slice(-4000);});
    child.stderr?.on('data',chunk=>{output=(output+chunk).slice(-4000);});
    const deadline=Date.now()+20000;
    while(Date.now()<deadline){
      try{if((await fetch(base+'/api/health')).ok)return;}catch{}
      if(child.exitCode!==null)break;
      await new Promise(resolve=>setTimeout(resolve,100));
    }
    throw new Error('Protocol fixture did not start: '+output);
  };
  const session=(email:string)=>{
    const issuedAt=Math.floor(Date.now()/1000);
    const payload=Buffer.from(JSON.stringify({sessionId:randomBytes(24).toString('base64url'),uid:`email:${email}`,email,emailVerified:true,authTime:issuedAt,issuedAt,expiresAt:issuedAt+3600,isDemo:false,method:'EMAIL_OTP'})).toString('base64url');
    return `portal_tcc_session=${payload}.${createHmac('sha256',secret).update(payload).digest('base64url')}`;
  };
  try{await start();}catch(error){await stop();await rm(directory,{recursive:true,force:true});throw error;}
  return {
    request:(route:string,email=master,method='GET',body?:unknown)=>fetch(base+route,{method,headers:{'Content-Type':'application/json',Origin:base,...(email?{cookie:session(email)}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})}),
    state:async()=>JSON.parse(await readFile(stateFile,'utf8')),
    restart:async()=>{await stop();await start();},
    close:async()=>{await stop();await rm(directory,{recursive:true,force:true});},
  };
}

function registerProcess(f:Awaited<ReturnType<typeof fixture>>,index:number,coauthorIndex?:number,defenseAt=`2030-11-${String(index+11).padStart(2,'0')}T10:00`){
  return f.request('/api/processes',authors[index],'POST',{registrationAnswers:{
    ALUNO_1_NOME:'Autora de Teste',ALUNO_1_MATRICULA:`2030000${index}`,ALUNO_1_EMAIL:authors[index],TEM_ALUNO_2:'Não',
    ORIENTADOR_NOME:'Orientador de Teste',ORIENTADOR_EMAIL:advisor,ORIENTADOR_SIAPE:'1234567',TEM_COORIENTADOR:'Não',
    EXAMINADOR_2_NOME:'Examinador de Teste',EXAMINADOR_2_EMAIL:'examiner-1@protocol.invalid',EXAMINADOR_2_INSTITUICAO:'UFES',
    EXAMINADOR_3_NOME:'Examinadora de Teste',EXAMINADOR_3_EMAIL:'examiner-2@protocol.invalid',EXAMINADOR_3_INSTITUICAO:'UFES',
    TITULO:'Trabalho de Teste da Sequência',DEFESA_DATA_HORA:defenseAt,DEFESA_LOCAL:'Auditório do Prédio do Departamento de Enfermagem - CCS/UFES',
    ...(coauthorIndex === undefined ? {} : {
      TEM_ALUNO_2: 'Sim', ALUNO_2_NOME: 'Segundo autor de teste',
      ALUNO_2_EMAIL: authors[coauthorIndex], ALUNO_2_MATRICULA: `2030000${coauthorIndex}`,
    }),
  }});
}

async function createProcess(f:Awaited<ReturnType<typeof fixture>>,index:number){
  const response=await registerProcess(f,index);
  assert.ok([201,202].includes(response.status),await response.clone().text());
  return await response.json() as ProcessData;
}

async function awaitDeletionStatus(f:Awaited<ReturnType<typeof fixture>>,processId:string,taskId:string,expected:'COMPLETED'|'PENDING'){
 const route='/api/admin/process-deletions/status?'+new URLSearchParams({processId,taskId});
 const deadline=Date.now()+10000;let last:any;
 while(Date.now()<deadline){
  const response=await f.request(route);assert.equal(response.status,200,await response.clone().text());last=await response.json();
  assert.equal(last.processId,processId);assert.equal(last.taskId,taskId);
  if(last.state===expected&&(expected==='COMPLETED'||last.cleanup?.errors?.length))return last;
  await new Promise(resolve=>setTimeout(resolve,50));
 }
 assert.fail('Cleanup did not reach its expected durable result: '+JSON.stringify(last));
}

test('HTTP: weekend defenses use normal registration and still await the reservation decision', {timeout:45000}, async()=>{
  const f=await fixture(initialState());
  try{
    for(const [index,weekday] of [6,0].entries()){
      const date=new Date(Date.UTC(year+4,10,1,12));
      while(date.getUTCDay()!==weekday)date.setUTCDate(date.getUTCDate()+1);
      const response=await registerProcess(f,index,undefined,`${date.toISOString().slice(0,10)}T14:00`);
      assert.ok([201,202].includes(response.status),await response.clone().text());
      const registered=await response.json() as ProcessData;
      assert.equal(registered.defesa.localStatus,'PENDENTE');
      assert.equal(registered.defesa.departmentResponse,undefined,'nenhum aceite é fabricado para o fim de semana');
      assert.equal(registered.protocolo,code(index+1));
    }
  }finally{await f.close();}
});

test('HTTP: rejects a past defense before allocating a protocol', {timeout:45000}, async()=>{
  const f=await fixture(initialState());
  try{
    const rejected=await registerProcess(f,0,undefined,'2020-11-06T14:00');
    assert.equal(rejected.status,400,await rejected.clone().text());
    assert.equal((await rejected.json()).code,'DEFENSE_DATE_IN_PAST');
    const registered=await createProcess(f,0);
    assert.equal(registered.protocolo,'TCC - 00001');
  }finally{await f.close();}
});

test('HTTP: simultaneous individual and joint registration assigns unique protocols and scoped membership', {timeout:45000}, async()=>{
  const f=await fixture(initialState());
  try {
    const [individual,joint,duplicate]=await Promise.all([
      registerProcess(f,0),
      registerProcess(f,1,2),
      registerProcess(f,0),
    ]);
    assert.ok([201,202].includes(joint.status),await joint.clone().text());
    const accepted=[individual,duplicate].find(response=>[201,202].includes(response.status));
    assert.ok(accepted);
    assert.equal([individual,duplicate].filter(response=>response.status===409).length,1);
    const first=await accepted.json() as ProcessData;
    const second=await joint.json() as ProcessData;
    assert.deepEqual([first.protocolo,second.protocolo].sort(),[code(1),code(2)]);
    assert.equal(first.aluno2,null);
    assert.equal(second.aluno2?.email,authors[2]);
    const path=`/api/processes/${second.id}`;
    const view=await f.request(path,authors[2]);
    assert.equal(view.status,200);
    assert.equal((await view.json()).id,second.id);
    const outsider=await f.request(path,authors[3]);
    assert.equal(outsider.status,404);
    const saved=await f.state();
    assert.equal(saved.processes.length,2);
    assert.equal(saved.signatureJobs.length,0);
    assert.equal(saved.processProtocolCounters['TCC-9999'],2);
  } finally {
    await f.close();
  }
});

test('HTTP: completed deletion releases a gap after restart and the pending replacement appears publicly',{timeout:45000},async()=>{
  const f=await fixture(initialState());
  try{
    const created:ProcessData[]=[];
    for(let index=0;index<3;index++){const process=await createProcess(f,index);assert.equal(process.protocolo,code(index+1));created.push(process);}
    const removed=created[1];
    const deleted=await f.request(`/api/processes/${removed.id}`,master,'DELETE',{confirmation:'EXCLUIR',expectedProcessId:removed.id});
    assert.equal(deleted.status,202,await deleted.clone().text());
    const ack=await deleted.json();assert.equal(ack.processId,removed.id);assert.equal(ack.cleanupPending,true);
    await awaitDeletionStatus(f,removed.id,ack.cleanupTaskId,'COMPLETED');
    assert.equal((await f.state()).processProtocolCounters['TCC-9999'],3);
    await f.restart();
    const replacement=await createProcess(f,1);
    assert.equal(replacement.protocolo,code(2));
    assert.notEqual(replacement.id,removed.id);
    assert.equal(replacement.defesa.localStatus,'PENDENTE');
    const repository=await f.request('/api/public/repository','');
    assert.equal(repository.status,200);
    const rows:ProcessData[]=await repository.json();
    assert.equal(rows.filter(row=>row.protocolo===code(2)).length,1);
    assert.equal(rows.find(row=>row.protocolo===code(2))?.defesa.localStatus,'PENDENTE');
    assert.ok(!JSON.stringify(rows).includes(removed.id));
    assert.ok(rows.some(row=>row.protocolo===code(1)));
    const saved=await f.state();
    assert.equal(saved.processProtocolCounters['TCC-9999'],3);
    assert.deepEqual(saved.processes.map((process:ProcessData)=>process.protocolo),[code(1),code(3),code(2)]);
  }finally{await f.close();}
});

function renamedProcess():ProcessData{
  const process=structuredClone(DEMO_PROCESSES[0]);
  process.id='renumbered-process';process.protocolo=code(1);process.previousProtocols=[historicalCode(6),code(6)];process.createdByEmail=authors[0];
  process.aluno1.email=authors[0];process.aluno2=null;process.orientador.email=advisor;process.avaliacao={status:'PENDENTE'};
  process.status='AGUARDANDO_CONFIRMACAO_LOCAL';process.etapaAtual='CONFIRMACAO_LOCAL';process.acervo=undefined;
  process.defesa={startAt:'2030-11-05T14:00:00Z',endAt:'2030-11-05T15:30:00Z',local:'Sala Histórica de Teste',localStatus:'RECUSADO',reservationRevision:0,
    departmentResponse:{revision:0,decision:'UNAVAILABLE',startAt:'2030-11-05T14:00:00Z',endAt:'2030-11-05T15:30:00Z',respondedAt:'2030-10-01T12:00:00Z',respondedBy:'department@protocol.invalid'}};
  return process;
}

test('HTTP: a corrected protocol keeps its alias without importing old cleanup numbers into the new counter',{timeout:45000},async()=>{
  const process=renamedProcess();
  const f=await fixture(initialState([process],{processProtocolCounters:{[`TCC-${year}`]:128},processDeletionTasks:[3,4,5].map(number=>({id:`historical-${number}`,processId:`deleted-${number}`,protocol:historicalCode(number),status:'PENDING',envelopes:[`synthetic-${number}`],fileIds:[],protectedIds:[],jobIds:[],errors:[],createdAt:'2030-10-01T12:00:00Z'}))}));
  try{
    assert.equal((await(await f.request(`/api/public/processes/${historicalCode(6)}`,'')).json()).protocolo,code(1));
    assert.equal((await createProcess(f,1)).protocolo,code(2));
    assert.equal((await f.state()).processProtocolCounters['TCC-9999'],2);
  }finally{await f.close();}
});

test('HTTP: a deletion pending external cleanup keeps its protocol reserved',{timeout:45000},async()=>{
  const real=renamedProcess();
  const task={id:'delete_old_1',processId:'old',protocol:code(2),status:'PENDING',clearHistory:true,envelopes:[],fileIds:[],protectedIds:[],jobIds:[],errors:[],createdAt:'2030-10-01T12:00:00Z'};
  const f=await fixture(initialState([real],{processDeletionTasks:[task]}));
  try{
    assert.equal((await createProcess(f,1)).protocolo,code(3));
    assert.equal((await f.request('/api/public/processes/'+reference(2),'')).status,404);
  }finally{await f.close();}
});

test('HTTP: converted TCCs preserve both annual links and the next registration is 00003',{timeout:45000},async()=>{
  const real=renamedProcess();
  real.previousProtocols=[historicalCode(1)];
  const pilot={...structuredClone(real),id:'converted-pilot',protocolo:code(2),previousProtocols:[historicalCode(6)],aluno1:{...real.aluno1,email:authors[1]}};
  const f=await fixture(initialState([real,pilot],{processProtocolCounters:{[`TCC-${year}`]:6,'TCC-9999':2}}));
  try{
    for(const [old,expected] of [[historicalCode(1),real],[historicalCode(6),pilot]] as const){
      for(const prefix of ['/api/public/processes/','/api/processes/']){
        const response=await f.request(prefix+old,'');
        assert.equal(response.status,200);
        const found=await response.json();
        assert.equal(found.protocolo,expected.protocolo);
      }
      const privateView=await f.request(`/api/processes/${old}`);
      assert.equal(privateView.status,200);
      assert.equal((await privateView.json()).id,expected.id);
    }
    assert.equal((await createProcess(f,2)).protocolo,code(3));
  }finally{await f.close();}
});

test('HTTP: current protocols take precedence over an older process alias in every public resolver',{timeout:45000},async()=>{
  const original=renamedProcess();
  const current=structuredClone(original);current.id='current-sixth-process';current.protocolo=code(6);current.previousProtocols=[];current.aluno1.email=authors[1];
  current.defesa={...current.defesa,local:'Sala Atual de Teste',localStatus:'CONFIRMADO',departmentResponse:{...current.defesa.departmentResponse!,decision:'CONFIRMED'}};
  const f=await fixture(initialState([original,current],{processProtocolCounters:{[`TCC-${year}`]:6}}));
  try{
    for(const prefix of ['/api/processes/','/api/public/processes/'])assert.equal((await(await f.request(prefix+reference(6),'')).json()).protocolo,code(6));
    const receipts=await(await f.request(`/api/public/processes/${reference(6)}/reservation-receipts`,'')).json();
    assert.equal(receipts.currentStatus,'CONFIRMADO');
    assert.equal(receipts.items[0].local,'Sala Atual de Teste');
    const receipt=await f.request(`/api/public/processes/${reference(6)}/reservation-receipt`,'');
    assert.equal(receipt.status,200);
    assert.match(receipt.headers.get('Content-Disposition')||'',new RegExp(code(6)));
    assert.equal((await(await f.request(`/api/public/processes/${original.id}`,'')).json()).protocolo,code(1));
  }finally{await f.close();}
});

test('HTTP: Master resumes an interrupted cleanup through its existing route before serial gap reuse',{timeout:45000},async()=>{
  const real=renamedProcess();
  const task={id:'delete_old_1794050000000',processId:'old',protocol:code(2),rootFolderId:'',status:'PENDING',clearHistory:true,deleteFiles:true,envelopes:[],fileIds:[],protectedIds:[],jobIds:[],errors:[],attemptCount:1,createdAt:'2026-11-06T12:00:00Z',lastAttemptAt:'2026-11-06T12:00:00Z',nextRetryAt:'2099-11-07T12:00:00Z'};
  const f=await fixture(initialState([real],{processDeletionTasks:[task],auditLogs:[{id:`log-${task.id}`,action:'EXCLUSAO_PROCESSO_TCC',entityType:'process_deletion',entityId:task.id,processProtocol:task.protocol,actorEmail:master,actorRoles:['MASTER_ADMIN'],timestamp:task.createdAt,after:{deletedProcessId:task.processId,cleanupStatus:'Limpeza pendente'}}]}));
  try{
    const route=`/api/admin/process-deletions/${task.id}/retry`;
    const before=await f.state();
    assert.equal((await f.request('/api/admin/process-deletions',authors[1])).status,403);
    assert.equal((await f.request(route,authors[1],'POST',{})).status,403);
    assert.deepEqual((await f.state()).processDeletionTasks,before.processDeletionTasks);
    const resumed=await f.request(route,master,'POST',{});
    assert.equal(resumed.status,202,await resumed.clone().text());
    const ack=await resumed.json();assert.equal(ack.id,task.id);assert.equal(ack.status,'PENDING');
    await awaitDeletionStatus(f,task.processId,task.id,'COMPLETED');
    const state=await f.state();
    assert.deepEqual(state.processDeletionTasks,[]);
    assert.equal(state.processes.length,1);
    const replacement=await createProcess(f,1);
    assert.equal(replacement.protocolo,code(2));
    assert.notEqual(replacement.id,task.processId);
  }finally{await f.close();}
});

test('HTTP: deletion status is read-only, Master-only, and requires durable completion after restart',{timeout:45000},async()=>{
 const process=renamedProcess(),president='president@protocol.invalid';
 const state=initialState([process]);state.settings.commissionPresidentEmail=president;
 const f=await fixture(state);
 const statusRoute=(id:string,taskId?:string)=>'/api/admin/process-deletions/status?'+new URLSearchParams({processId:id,...(taskId?{taskId}:{})});
 try{
  for(const email of [authors[0],president])assert.equal((await f.request(statusRoute(process.id),email)).status,403);
  assert.equal((await f.request('/api/admin/process-deletions/status',master)).status,400);
  const before=await f.state();
  const untouched=await f.request(statusRoute(process.id));assert.equal(untouched.status,200);
  assert.equal((await untouched.json()).state,'NOT_STARTED');
  assert.equal((await(await f.request(statusRoute('unknown-process'))).json()).state,'UNKNOWN');
  assert.deepEqual(await f.state(),before,'status reads must not persist or create cleanup tasks');
  const response=await f.request(`/api/processes/${process.id}`,master,'DELETE',{confirmation:'EXCLUIR',expectedProcessId:process.id});
  assert.equal(response.status,202,await response.clone().text());
  const deleted=await response.json();
  assert.equal(deleted.processId,process.id);assert.equal(deleted.protocol,process.protocolo);
  assert.ok(deleted.cleanupTaskId);assert.equal(deleted.cleanup.id,deleted.cleanupTaskId);
  assert.equal(deleted.cleanup.status,'PENDING');
  await awaitDeletionStatus(f,process.id,deleted.cleanupTaskId,'COMPLETED');
  await f.restart();
  const completed=await f.request(statusRoute(process.id,deleted.cleanupTaskId));assert.equal(completed.status,200);
  const result=await completed.json();assert.equal(result.state,'COMPLETED');
  assert.equal(result.processId,process.id);assert.equal(result.taskId,deleted.cleanupTaskId);
  assert.equal((await(await f.request(statusRoute(process.id,'delete_other_1'))).json()).state,'UNKNOWN');
 }finally{await f.close();}
});

test('HTTP: 202 pending deletion returns an exact cleanup summary and status survives restart',{timeout:45000},async()=>{
 const process=renamedProcess();
 // Missing local archive ownership produces a normal cleanup failure; no runtime gate is bypassed.
 process.driveFolderId='foreign-folder';
 const f=await fixture(initialState([process]));
 try{
  const response=await f.request(`/api/processes/${process.id}`,master,'DELETE',{confirmation:'EXCLUIR',expectedProcessId:process.id});
  assert.equal(response.status,202,await response.clone().text());
  const deleted=await response.json();assert.equal(deleted.cleanupPending,true);
  assert.equal(deleted.processId,process.id);assert.equal(deleted.protocol,process.protocolo);
  assert.equal(deleted.cleanup.id,deleted.cleanupTaskId);assert.equal(deleted.cleanup.status,'PENDING');
  assert.deepEqual(deleted.cleanupErrors,[],'ACK precedes external cleanup');
  const pending=await awaitDeletionStatus(f,process.id,deleted.cleanupTaskId,'PENDING');assert.ok(pending.cleanup.errors.length);
  await f.restart();
  const beforeStatus=await f.state();
  const status=await f.request('/api/admin/process-deletions/status?'+new URLSearchParams({processId:process.id,taskId:deleted.cleanupTaskId}));
  assert.equal(status.status,200);const result=await status.json();assert.equal(result.state,'PENDING');
  assert.equal(result.taskId,deleted.cleanupTaskId);assert.equal(result.cleanup.id,deleted.cleanupTaskId);
  assert.deepEqual(result.cleanup.errors,pending.cleanup.errors);
  assert.deepEqual(await f.state(),beforeStatus,'consulting pending cleanup must not retry or persist');
  assert.equal((await f.state()).processes.length,0);
 }finally{await f.close();}
});
