import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {DEMO_PROCESSES,INITIAL_SETTINGS} from '../src/services/demoSeed';

test('HTTP: novo cadastro não coleta registros; edição preserva apenas identificadores históricos',{timeout:45000},async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'portal-registration-minimum-'));
 const historical=structuredClone(DEMO_PROCESSES[0]);
 historical.id='historic-identifiers';historical.protocolo='TCC-2026-0099';historical.status='AGUARDANDO_CONFIRMACAO_LOCAL';historical.avaliacao={status:'PENDENTE'};historical.acervo=undefined;
 historical.defesa={startAt:'2026-12-10T13:00:00-03:00',endAt:'2026-12-10T14:30:00-03:00',local:'Sala de Reuniões',localStatus:'PENDENTE'};
 historical.aluno1.matricula='HISTORICO-MAT';historical.orientador.siape='HISTORICO-SIAPE';
 historical.orientador.email='historico-orientador@example.invalid';historical.coorientador=null;
 historical.banca=historical.banca.filter(member=>member.funcao!=='ORIENTADOR').slice(0,2).map((member,index)=>({...member,email:`historico-examinador-${index}@example.invalid`,funcao:index===0?'EXAMINER_2':'EXAMINER_3'}));
 await writeFile(path.join(dir,'portal-state.json'),JSON.stringify({settings:INITIAL_SETTINGS,processes:[historical],signatureJobs:[],memberships:[],authorizedStudents:[]}));
 const port=47600+Math.floor(Math.random()*300),base=`http://127.0.0.1:${port}`;
 const child=spawn(process.execPath,['--import','tsx','server.ts'],{cwd:process.cwd(),env:{PATH:process.env.PATH,HOME:process.env.HOME,NODE_ENV:'development',HOST:'127.0.0.1',PORT:String(port),APP_URL:base,PORTAL_PUBLIC_URL:base,PORTAL_DATA_DIR:dir,PORTAL_PERSISTENCE_PROVIDER:'local_file',PORTAL_ALLOW_INSECURE_DEMO_AUTH:'true',PORTAL_ALLOW_LOCAL_OTP_STORE:'true',PORTAL_ALLOW_LOCAL_SECRET_STORE:'true',PORTAL_TEST_DOCUMENT_RENDERER:'true',PORTAL_SESSION_SECRET:'registration-minimum-session-0123456789abcdef',PORTAL_OTP_PEPPER:'registration-minimum-otp-0123456789abcdef',ASTEN_INTEGRATION_ENABLED:'false',SUPABASE_URL:'',SUPABASE_SECRET_KEY:'',SUPABASE_SERVICE_ROLE_KEY:'',VERCEL:''},stdio:'ignore'});
 const headers={'content-type':'application/json','x-demo-user-email':'master@portal.local'};
 const send=(route:string,body:unknown,method='POST')=>fetch(base+route,{method,headers,body:JSON.stringify(body)});
 try{
  const deadline=Date.now()+20000;while(true){try{if((await fetch(base+'/api/health')).ok)break;}catch{}if(Date.now()>deadline||child.exitCode!==null)throw Error('Servidor local não iniciou');await new Promise(r=>setTimeout(r,100));}
  const schema=await (await fetch(base+'/api/forms/registration-schema',{headers})).json();
  assert.doesNotMatch(JSON.stringify(schema.formTemplates),/MATRICULA|_SIAPE|_CIAP|_CPF/);
  const access=await send('/api/admin/access-list',{nome:'Nova Pessoa',email:'nova@example.invalid',matricula:'NOVO-DESCARTAR',siape:'NOVO-DESCARTAR',cpf:'NOVO-DESCARTAR'});
  assert.equal(access.status,201,await access.clone().text());const accessEntry=await access.json();assert.equal(accessEntry.matricula,undefined);
  const imported=await send('/api/admin/access-list/import',{records:[{nome:'Pessoa Importada',email:'importada@example.invalid',matricula:'NOVO-DESCARTAR'}]});assert.equal(imported.status,201,await imported.clone().text());
  const list=await (await fetch(base+'/api/admin/access-list',{headers})).json();assert.equal(list.find((entry:any)=>entry.email==='importada@example.invalid')?.matricula,undefined);
  const lookup=await fetch(base+'/api/forms/registration-suggestions?field=matricula&q=HIST',{headers});assert.equal(lookup.status,200);assert.deepEqual(await lookup.json(),[]);
  const response=await send('/api/processes',{registrationAnswers:{
   ALUNO_1_NOME:'Ana Silva Costa',ALUNO_1_EMAIL:'nova@example.invalid',TEM_ALUNO_2:'Não',TEM_COORIENTADOR:'Não',
   ORIENTADOR_NOME:'Maria Souza Lima',ORIENTADOR_EMAIL:'orientadora@example.invalid',
   EXAMINADOR_2_NOME:'Carlos Pereira Souza',EXAMINADOR_2_EMAIL:'examinador@example.invalid',EXAMINADOR_2_INSTITUICAO:'UFES',
   EXAMINADOR_3_NOME:'Beatriz Mendes Lima',EXAMINADOR_3_EMAIL:'examinadora@example.invalid',EXAMINADOR_3_INSTITUICAO:'UFES',
   TITULO:'Cuidado de Enfermagem',DEFESA_DATA_HORA:'2026-12-11T10:00',DEFESA_LOCAL:'Auditório do Prédio do Departamento de Enfermagem - CCS/UFES',
   ALUNO_1_CPF:'NOVO-DESCARTAR',ORIENTADOR_SIAPE:'NOVO-DESCARTAR',ALUNO_1_MATRICULA:'NOVO-DESCARTAR',
  }});
  assert.ok([201,202].includes(response.status),await response.clone().text());const created=await response.json();
  assert.equal(created.aluno1.matricula,'');assert.equal(created.orientador.siape,undefined);assert.doesNotMatch(JSON.stringify(created),/NOVO-DESCARTAR/);
  const edit=await send(`/api/processes/${created.id}`,{aluno1:{...created.aluno1,nome:'Ana Silva de Costa',matricula:'NOVO-DESCARTAR',cpf:'NOVO-DESCARTAR',registro:'NOVO-DESCARTAR',ra:'NOVO-DESCARTAR',dados:{cpf:'NOVO-DESCARTAR'}},orientador:{...created.orientador,siape:'NOVO-DESCARTAR'}},'PATCH');
  assert.equal(edit.status,200,await edit.clone().text());assert.doesNotMatch(JSON.stringify(await edit.json()),/NOVO-DESCARTAR/);
  const oldEdit=await send(`/api/processes/${historical.id}`,{aluno1:{...historical.aluno1,nome:'Nome Histórico Atualizado',matricula:'NOVO-DESCARTAR'},orientador:{...historical.orientador,siape:'NOVO-DESCARTAR'}},'PATCH');
  assert.equal(oldEdit.status,200,await oldEdit.clone().text());const old=await oldEdit.json();assert.equal(old.aluno1.matricula,'HISTORICO-MAT');assert.equal(old.orientador.siape,'HISTORICO-SIAPE');
  const disk=JSON.parse(await readFile(path.join(dir,'portal-state.json'),'utf8'));assert.doesNotMatch(JSON.stringify(disk),/NOVO-DESCARTAR/);
  assert.equal(disk.processes.find((p:any)=>p.id===historical.id).aluno1.matricula,'HISTORICO-MAT');
 }finally{
  if(child.exitCode===null){const stopped=new Promise(r=>child.once('exit',r));child.kill('SIGTERM');await stopped;}
  await rm(dir,{recursive:true,force:true});
 }
});
