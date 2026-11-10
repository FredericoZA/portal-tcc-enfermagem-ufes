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
 historical.registrationAnswers={ALUNO_1_MATRICULA:'HISTORICO-RESPOSTA'};
 historical.orientador.email='historico-orientador@example.invalid';historical.coorientador=null;
 historical.banca=historical.banca.filter(member=>member.funcao!=='ORIENTADOR').slice(0,2).map((member,index)=>({...member,email:`historico-examinador-${index}@example.invalid`,funcao:index===0?'EXAMINER_2':'EXAMINER_3'}));
 const historicalAccess={id:'historical-access',nome:'Pessoa Histórica',email:'historico@example.invalid',matricula:'HISTORICO-ACESSO',active:true,processIds:[],origin:'MASTER_LIST'};
 await writeFile(path.join(dir,'portal-state.json'),JSON.stringify({settings:INITIAL_SETTINGS,processes:[historical],signatureJobs:[],memberships:[],authorizedStudents:[historicalAccess]}));
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
 assert.equal(list.find((entry:any)=>entry.id===historicalAccess.id)?.matricula,undefined);
  const lookup=await fetch(base+'/api/forms/registration-suggestions?field=matricula&q=HIST',{headers});assert.equal(lookup.status,200);assert.deepEqual(await lookup.json(),[]);
  const registrationAttempt='a4edc83e-2f09-426c-9381-2cfd7beb197e';
  const attemptPath=base+'/api/registration/attempts/'+registrationAttempt;
  assert.equal((await fetch(attemptPath,{headers})).status,404);
  const request={registrationAttempt,registrationAnswers:{
   ALUNO_1_NOME:'Ana Silva Costa',ALUNO_1_EMAIL:'nova@example.invalid',TEM_ALUNO_2:'Não',TEM_COORIENTADOR:'Não',
   ORIENTADOR_NOME:'Maria Souza Lima',ORIENTADOR_EMAIL:'orientadora@example.invalid',
   EXAMINADOR_2_NOME:'Carlos Pereira Souza',EXAMINADOR_2_EMAIL:'examinador@example.invalid',EXAMINADOR_2_INSTITUICAO:'UFES',
   EXAMINADOR_3_NOME:'Beatriz Mendes Lima',EXAMINADOR_3_EMAIL:'examinadora@example.invalid',EXAMINADOR_3_INSTITUICAO:'UFES',
   TITULO:'Cuidado de Enfermagem',DEFESA_DATA_HORA:'2026-12-11T10:00',DEFESA_LOCAL:'Auditório do Prédio do Departamento de Enfermagem - CCS/UFES',
   ALUNO_1_CPF:'NOVO-DESCARTAR',ORIENTADOR_SIAPE:'NOVO-DESCARTAR',ALUNO_1_MATRICULA:'NOVO-DESCARTAR',
  }};
  const response=await send('/api/processes',request);
  assert.equal(response.status,202,await response.clone().text());
  const created=await response.json();
  assert.equal(created.workflowProcessing,true);
  const recovered=await fetch(attemptPath,{headers});
  assert.equal(recovered.headers.get('cache-control'),'private, no-store');
  assert.deepEqual(await recovered.json(),{id:created.id});
  assert.equal((await fetch(attemptPath)).status,401);
  assert.equal((await fetch(attemptPath,{headers:{'x-demo-user-email':'nova@example.invalid'}})).status,404);
  const replay=await send('/api/processes',request);
  assert.equal(replay.status,200);
  assert.equal((await replay.json()).id,created.id);
  const committed=JSON.parse(await readFile(path.join(dir,'portal-state.json'),'utf8'));
  const archive=committed.formArchiveJobs.find((job:any)=>job.processId===created.id&&job.formType==='CADASTRO_INICIAL');
  assert.equal(archive.registrationSnapshot.protocol,created.protocolo);
  assert.equal(archive.artifactBase64,'');
  assert.equal(committed.processes.some((process:any)=>process.id===created.id),true);
  assert.equal(created.orientador.instituicao,'Universidade Federal do Espírito Santo','orientador pertence à instituição do Portal mesmo com e-mail pessoal e sem campo de instituição');
  assert.equal(created.aluno1.matricula,'');assert.equal(created.orientador.siape,undefined);assert.doesNotMatch(JSON.stringify(created),/NOVO-DESCARTAR/);
  // Complete the normal registration handler with two authors and a coadvisor.
  const pairedAccess=await send('/api/admin/access-list',{nome:'Autora em Dupla',email:'paired-author@example.invalid'});
  assert.equal(pairedAccess.status,201);
  const pairedResponse=await send('/api/processes',{registrationAnswers:{
   ALUNO_1_NOME:'Autora em Dupla',ALUNO_1_EMAIL:'paired-author@example.invalid',TEM_ALUNO_2:'Sim',
   ALUNO_2_NOME:'Segundo Autor da Dupla',ALUNO_2_EMAIL:'paired-second@example.invalid',TEM_COORIENTADOR:'Sim',
   ORIENTADOR_NOME:'Orientadora da Dupla',ORIENTADOR_EMAIL:'paired-advisor@example.invalid',
   COORIENTADOR_NOME:'Coorientadora da Dupla',COORIENTADOR_EMAIL:'paired-coadvisor@example.invalid',COORIENTADOR_INSTITUICAO:'UFES',
   EXAMINADOR_2_NOME:'Primeira Examinadora',EXAMINADOR_2_EMAIL:'paired-examiner-one@example.invalid',EXAMINADOR_2_INSTITUICAO:'UFES',
   EXAMINADOR_3_NOME:'Segunda Examinadora',EXAMINADOR_3_EMAIL:'paired-examiner-two@example.invalid',EXAMINADOR_3_INSTITUICAO:'UFES',
   TITULO:'Cuidado em Dupla',DEFESA_DATA_HORA:'2026-12-14T10:00',DEFESA_LOCAL:'Outro local — informar endereço/nome',DEFESA_LOCAL_PERSONALIZADO:'Sala fictícia da Dupla',
  }});
  assert.ok([201,202].includes(pairedResponse.status),await pairedResponse.clone().text());
  const paired=await pairedResponse.json();
  assert.equal(paired.aluno1.email,'paired-author@example.invalid');assert.equal(paired.aluno2.email,'paired-second@example.invalid');
  assert.equal(paired.coorientador.email,'paired-coadvisor@example.invalid');assert.equal(paired.orientador.email,'paired-advisor@example.invalid');
  const pairedDetail=await (await fetch(base+`/api/processes/${paired.id}`,{headers:{'x-demo-user-email':'paired-second@example.invalid'}})).json();
  assert.equal(pairedDetail.id,paired.id,'second author receives only their own normal process access');
  const foreign=await fetch(base+`/api/processes/${historical.id}`,{headers:{'x-demo-user-email':'paired-second@example.invalid'}});assert.equal(foreign.status,404,'foreign process stays undisclosed');
  const edit=await send(`/api/processes/${created.id}`,{aluno1:{...created.aluno1,nome:'Ana Silva de Costa',matricula:'NOVO-DESCARTAR',cpf:'NOVO-DESCARTAR',registro:'NOVO-DESCARTAR',ra:'NOVO-DESCARTAR',dados:{cpf:'NOVO-DESCARTAR'}},orientador:{...created.orientador,siape:'NOVO-DESCARTAR'}},'PATCH');
  assert.equal(edit.status,200,await edit.clone().text());assert.doesNotMatch(JSON.stringify(await edit.json()),/NOVO-DESCARTAR/);
  const oldEdit=await send(`/api/processes/${historical.id}`,{aluno1:{...historical.aluno1,nome:'Nome Histórico Atualizado',matricula:'NOVO-DESCARTAR'},orientador:{...historical.orientador,siape:'NOVO-DESCARTAR'}},'PATCH');
 assert.equal(oldEdit.status,200,await oldEdit.clone().text());assert.doesNotMatch(JSON.stringify(await oldEdit.json()),/HISTORICO-|NOVO-DESCARTAR/);
 for(const [route,authenticated] of [[`/api/processes/${historical.id}`,true],[`/api/processes/${historical.id}`,false],['/api/public/repository',false],['/api/public/calendar',false]] as const){
  const view=await fetch(base+route,authenticated?{headers}:undefined);
  assert.equal(view.status,200);
  assert.doesNotMatch(await view.text(),/HISTORICO-/);
 }
  const detailPath=`/api/processes/${historical.id}/detail`;
  assert.equal((await fetch(base+detailPath)).status,401);
  const detailResponse=await fetch(base+detailPath,{headers});
  assert.equal(detailResponse.status,200);
  assert.equal(detailResponse.headers.get('cache-control'),'private, no-store');
  const detail=await detailResponse.json();
  assert.doesNotMatch(JSON.stringify(detail),/HISTORICO-/);
  const outsider=await fetch(base+detailPath,{headers:{'x-demo-user-email':'nova@example.invalid'}});
  assert.equal(outsider.status,404);
  for(const [field,suffix] of [['process',''],['documents','/documents'],['signatures','/signatures'],['verifications','/verifications'],['auditLogs','/audit-logs']]){
    const part=await fetch(`${base}/api/processes/${historical.id}${suffix}`,{headers});
    if(field==='verifications'&&part.status===404)assert.deepEqual(detail[field],[]);
    else{assert.equal(part.status,200);assert.deepEqual(detail[field],await part.json());}
  }
  const disk=JSON.parse(await readFile(path.join(dir,'portal-state.json'),'utf8'));assert.doesNotMatch(JSON.stringify(disk),/NOVO-DESCARTAR/);
 const historicalOnDisk=disk.processes.find((p:any)=>p.id===historical.id);
 assert.equal(historicalOnDisk.aluno1.matricula,'HISTORICO-MAT');
 assert.equal(historicalOnDisk.orientador.siape,'HISTORICO-SIAPE');
 assert.equal(historicalOnDisk.registrationAnswers.ALUNO_1_MATRICULA,'HISTORICO-RESPOSTA');
 assert.equal(disk.authorizedStudents.find((entry:any)=>entry.id===historicalAccess.id)?.matricula,'HISTORICO-ACESSO');
 const replaceAdvisor=await send(`/api/processes/${historical.id}`,{orientador:{...historical.orientador,email:'novo-orientador@example.invalid',siape:'NOVO-DESCARTAR'}},'PATCH');
 assert.equal(replaceAdvisor.status,200,await replaceAdvisor.clone().text());
 const afterReplacement=JSON.parse(await readFile(path.join(dir,'portal-state.json'),'utf8')).processes.find((p:any)=>p.id===historical.id);
 assert.equal(afterReplacement.orientador.siape,undefined);
 assert.equal(afterReplacement.aluno1.matricula,'HISTORICO-MAT');
 }finally{
  if(child.exitCode===null){const stopped=new Promise(r=>child.once('exit',r));child.kill('SIGTERM');await stopped;}
  await rm(dir,{recursive:true,force:true});
 }
});
