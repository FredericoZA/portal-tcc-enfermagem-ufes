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

async function createProcess(f:Awaited<ReturnType<typeof fixture>>,index:number){
  const response=await f.request('/api/processes',authors[index],'POST',{registrationAnswers:{
    ALUNO_1_NOME:'Autora de Teste',ALUNO_1_MATRICULA:`2030000${index}`,ALUNO_1_EMAIL:authors[index],TEM_ALUNO_2:'Não',
    ORIENTADOR_NOME:'Orientador de Teste',ORIENTADOR_EMAIL:advisor,ORIENTADOR_SIAPE:'1234567',TEM_COORIENTADOR:'Não',
    EXAMINADOR_2_NOME:'Examinador de Teste',EXAMINADOR_2_EMAIL:'examiner-1@protocol.invalid',EXAMINADOR_2_INSTITUICAO:'UFES',
    EXAMINADOR_3_NOME:'Examinadora de Teste',EXAMINADOR_3_EMAIL:'examiner-2@protocol.invalid',EXAMINADOR_3_INSTITUICAO:'UFES',
    TITULO:'Trabalho de Teste da Sequência',DEFESA_DATA_HORA:`2030-11-${String(index+11).padStart(2,'0')}T10:00`,DEFESA_LOCAL:'Auditório do Prédio do Departamento de Enfermagem - CCS/UFES',
  }});
  assert.ok([201,202].includes(response.status),await response.clone().text());
  return await response.json() as ProcessData;
}

test('HTTP: deleting the latest TCC and restarting never reuses its issued protocol',{timeout:45000},async()=>{
  const f=await fixture(initialState());
  try{
    const created:ProcessData[]=[];
    for(let index=0;index<3;index++){const process=await createProcess(f,index);assert.equal(process.protocolo,code(index+1));created.push(process);}
    const third=created[2];
    const deleted=await f.request(`/api/processes/${third.id}`,master,'DELETE',{confirmation:'EXCLUIR',expectedProcessId:third.id});
    assert.ok([200,202].includes(deleted.status),await deleted.clone().text());
    assert.equal((await f.state()).processProtocolCounters['TCC-9999'],3);
    await f.restart();
    assert.equal((await createProcess(f,2)).protocolo,code(4));
    const saved=await f.state();
    assert.equal(saved.processProtocolCounters['TCC-9999'],4);
    assert.deepEqual(saved.processes.map((process:ProcessData)=>process.protocolo),[code(1),code(2),code(4)]);
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
  const f=await fixture(initialState([process],{processProtocolCounters:{[`TCC-${year}`]:1},processDeletionTasks:[3,4,5].map(number=>({id:`historical-${number}`,processId:`deleted-${number}`,protocol:historicalCode(number),status:'PENDING',envelopes:[`synthetic-${number}`],fileIds:[],protectedIds:[],jobIds:[],errors:[],createdAt:'2030-10-01T12:00:00Z'}))}));
  try{
    assert.equal((await(await f.request(`/api/public/processes/${historicalCode(6)}`,'')).json()).protocolo,code(1));
    assert.equal((await createProcess(f,1)).protocolo,code(2));
    assert.equal((await f.state()).processProtocolCounters['TCC-9999'],2);
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
