import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {INITIAL_SETTINGS} from '../src/services/demoSeed';
const validAnswers = () => ({
  ALUNO_1_NOME: '  MARIA   DAS DORES SILVA  ',
  ALUNO_1_MATRICULA: '2026-00123',
  ALUNO_1_EMAIL: '  MARIA@EDU.UFES.BR ',
  TEM_ALUNO_2: 'Não',
  ORIENTADOR_NOME: 'JOÃO DE SOUZA',
  ORIENTADOR_EMAIL: 'JOAO@UFES.BR',
  ORIENTADOR_SIAPE: '1234567',
  TEM_COORIENTADOR: 'Não',
  EXAMINADOR_2_NOME: 'ANA PAULA LIMA',
  EXAMINADOR_2_EMAIL: 'ANA@UFES.BR',
  EXAMINADOR_2_INSTITUICAO: 'UFES',
  EXAMINADOR_3_NOME: 'Beatriz Ferreira Mendes',
  EXAMINADOR_3_EMAIL: 'BEATRIZ@FIOCRUZ.BR',
  EXAMINADOR_3_INSTITUICAO: 'Fiocruz',
  TITULO: 'IMPACTO DO CUIDADO DE ENFERMAGEM NA UTI',
  DEFESA_DATA_HORA: '2026-09-21T14:00',
  DEFESA_LOCAL: 'Auditório do Prédio do Departamento de Enfermagem - CCS/UFES',
  LOCAL_ALTERNATIVO: ''
});
test('HTTP registration accepts any registered email domain and preserves login, authorization and uniqueness', {timeout:45000},async()=>{
 const directory=await mkdtemp(path.join(tmpdir(),'portal-office-registration-'));
 const email='tccenfermagemufes@gmail.com';
 const frederico='frederico.aguiar@ufes.br';
 const larissa='laripandolfi@gmail.com';
 const personal='aluno@outlook.com';
 const inactive='inativo@gmail.com';
 await writeFile(path.join(directory,'portal-state.json'),JSON.stringify({settings:{...structuredClone(INITIAL_SETTINGS),masterEmail:email},processes:[],memberships:[],authorizedStudents:[frederico,larissa,personal,inactive].map((student,index)=>({id:`authorized-${index}`,email:student,nome:'Pessoa de teste',active:student!==inactive,processIds:[],roles:['STUDENT'],accessType:'STUDENT',origin:'MASTER_LIST',createdBy:email,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()}))}));
 const port=45900+Math.floor(Math.random()*200),base=`http://127.0.0.1:${port}`;
 const child=spawn(process.execPath,['--import','tsx','server.ts'],{cwd:process.cwd(),env:{...process.env,NODE_ENV:'development',HOST:'127.0.0.1',PORT:String(port),PORTAL_DATA_DIR:directory,PORTAL_PERSISTENCE_PROVIDER:'local_file',PORTAL_LOCAL_REVIEW_DATA:'true',PORTAL_LOCAL_REVIEW_DATA_CUSTOM_DIR:'false',PORTAL_ALLOW_INSECURE_DEMO_AUTH:'true',PORTAL_TEST_DOCUMENT_RENDERER:'true',PORTAL_ALLOW_LOCAL_OTP_STORE:'true',PORTAL_ALLOW_LOCAL_SECRET_STORE:'true',PORTAL_OTP_DELIVERY_MODE:'log',PORTAL_SESSION_SECRET:'office-registration-test-0123456789abcdef-0123456789',PORTAL_OTP_PEPPER:'office-registration-pepper-0123456789abcdef',ASTEN_INTEGRATION_ENABLED:'false',SUPABASE_URL:'',SUPABASE_SERVICE_ROLE_KEY:'',SUPABASE_SECRET_KEY:'',VERCEL:''},stdio:'ignore'});
 try{
  const deadline=Date.now()+20000;while(true){try{if((await fetch(base+'/api/health')).ok)break;}catch{}if(Date.now()>deadline||child.exitCode!==null)throw Error('Servidor não iniciou');await new Promise(r=>setTimeout(r,100));}
  const send=(studentEmail:string,authenticated=true,actor=email)=>{const answers=validAnswers();answers.ALUNO_1_EMAIL=studentEmail;answers.DEFESA_DATA_HORA=studentEmail===personal?'2026-10-30T16:00':studentEmail===larissa?'2026-10-30T11:40':studentEmail===frederico?'2026-10-30T10:00':'2026-10-30T08:10';return fetch(base+'/api/processes',{method:'POST',headers:{'content-type':'application/json',...(authenticated?{'x-demo-user-email':actor}:{})},body:JSON.stringify({registrationAnswers:answers})});};
  assert.equal((await send(email,false)).status,401);
  const denied=await send('email-invalido');assert.equal(denied.status,400,await denied.clone().text());assert.ok((await denied.json()).error);
  const created=await send(email);assert.ok([201,202].includes(created.status),await created.clone().text());const process=await created.json();assert.equal(process.aluno1.email,email);assert.equal(process.createdByEmail,email);
  const duplicate=await send(email);assert.equal(duplicate.status,409);
  assert.equal((await send(frederico,false)).status,401);
  assert.equal((await send('naocadastrado@gmail.com',true,'naocadastrado@gmail.com')).status,403);
  assert.equal((await send(inactive,true,inactive)).status,403);
  assert.equal((await send(personal,false)).status,401);
  const personalCreated=await send(personal,true,personal);assert.ok([201,202].includes(personalCreated.status),await personalCreated.clone().text());assert.equal((await personalCreated.json()).aluno1.email,personal);
  assert.equal((await send(personal,true,personal)).status,409);
  assert.equal((await send(frederico,true,'outro@edu.ufes.br')).status,403);
  const fredCreated=await send(frederico,true,frederico);assert.ok([201,202].includes(fredCreated.status),await fredCreated.clone().text());assert.equal((await fredCreated.json()).aluno1.email,frederico);
  assert.equal((await send(frederico,true,frederico)).status,409);
  assert.equal((await send(larissa,false)).status,401);
  assert.equal((await send(larissa,true,'outro@edu.ufes.br')).status,403);
  const larissaCreated=await send(larissa,true,larissa);assert.ok([201,202].includes(larissaCreated.status),await larissaCreated.clone().text());assert.equal((await larissaCreated.json()).aluno1.email,larissa);
  assert.equal((await send(larissa,true,larissa)).status,409);
  const aliases={...validAnswers(),ALUNO_1_EMAIL:'frederico.aguiar+alunoum@ufes.br',TEM_ALUNO_2:'Sim',ALUNO_2_NOME:'Larissa de Teste',ALUNO_2_EMAIL:'tccenfermagemufes+alunodois@gmail.com',ALUNO_2_MATRICULA:'202600124',DEFESA_DATA_HORA:'2026-10-30T14:00'};
  const invalidSecond=await fetch(base+'/api/processes',{method:'POST',headers:{'content-type':'application/json','x-demo-user-email':email},body:JSON.stringify({registrationAnswers:{...aliases,ALUNO_2_EMAIL:'email-invalido'}})});assert.equal(invalidSecond.status,400);assert.ok((await invalidSecond.json()).error);
  const aliasResult=await fetch(base+'/api/processes',{method:'POST',headers:{'content-type':'application/json','x-demo-user-email':email},body:JSON.stringify({registrationAnswers:aliases})});assert.ok([201,202].includes(aliasResult.status),await aliasResult.clone().text());const aliasProcess=await aliasResult.json();assert.equal(aliasProcess.aluno1.email,aliases.ALUNO_1_EMAIL);assert.equal(aliasProcess.aluno2.email,aliases.ALUNO_2_EMAIL);
  const disk=JSON.parse(await readFile(path.join(directory,'portal-state.json'),'utf8'));assert.equal(disk.processes.length,5);assert.equal(disk.processes[0].aluno1.email,email);assert.ok(disk.processes.some((process:{aluno1:{email:string}})=>process.aluno1.email===frederico));
 }finally{const exit=new Promise(r=>child.once('exit',r));if(child.exitCode===null){child.kill('SIGTERM');await exit;}await rm(directory,{recursive:true,force:true});}
});
