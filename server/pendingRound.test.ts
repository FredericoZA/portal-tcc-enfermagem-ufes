import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {INITIAL_SETTINGS,DEMO_PROCESSES} from '../src/services/demoSeed';
import {readRegistrationMemory,saveRegistrationMemory} from '../src/utils/registrationHistory';

test('histórico pessoal: preserva última digitação, limita sugestões e expira em sete dias',()=>{
 const values=new Map<string,string>();const storage={getItem:(k:string)=>values.get(k)||null,setItem:(k:string,v:string)=>{values.set(k,v);},removeItem:(k:string)=>{values.delete(k);}};
 saveRegistrationMemory(storage,'one@example.invalid',{ALUNO_1_NOME:"D'Ávila",ALUNO_1_MATRICULA:'000123'},2,1000);
 assert.equal(readRegistrationMemory(storage,'one@example.invalid',1001)?.answers.ALUNO_1_MATRICULA,'000123');
 assert.equal(readRegistrationMemory(storage,'other@example.invalid',1001),null);
 saveRegistrationMemory(storage,'one@example.invalid',{ALUNO_1_NOME:"D'Ávila"},2,1002,true);
 assert.deepEqual(readRegistrationMemory(storage,'one@example.invalid',1003)?.answers,{});
 assert.deepEqual(readRegistrationMemory(storage,'one@example.invalid',1003)?.recent.ALUNO_1_NOME,["D'Ávila"]);
 assert.equal(readRegistrationMemory(storage,'one@example.invalid',1003+8*86400000),null);
});

test('HTTP: exclusão permanente vinculada, sugestões privadas e bloqueios progressivos',{timeout:60000},async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'portal-pending-')),port=46500+Math.floor(Math.random()*300),base=`http://127.0.0.1:${port}`;
 const processes=[0,1,2].map((_,i)=>({...structuredClone(DEMO_PROCESSES[0]),id:`pending-${i}`,protocolo:`TCC-2026-00${i+10}`,avaliacao:{status:'CONCLUIDO'},acervo:{submittedAt:i?'2026-10-28T12:00:00Z':undefined},dataRevision:2,status:i===2?'CONCLUIDO':'AGUARDANDO_ASSINATURA'}));
 const job={id:'gov-term',processId:'pending-1',documentType:'TERMO',status:'READY_FOR_REVIEW',provider:'GOV_BR',sourceDataRevision:2,documentVersion:1};
 await writeFile(path.join(dir,'portal-state.json'),JSON.stringify({settings:INITIAL_SETTINGS,processes,memberships:[],authorizedStudents:Array.from({length:75},(_,i)=>({id:`suggestion-${i}`,nome:`ZZ Cadastro ${i}`,email:`tcc+${i}@example.invalid`,matricula:`000${i}`,active:true,createdAt:'2026-10-28T12:00:00Z',updatedAt:'2026-10-28T12:00:00Z'})),signatureJobs:[job]}));
 let child:ReturnType<typeof spawn>;
 const start=async()=>{child=spawn(process.execPath,['--import','tsx','server.ts'],{cwd:process.cwd(),env:{...process.env,NODE_ENV:'development',HOST:'127.0.0.1',PORT:String(port),PORTAL_PUBLIC_URL:base,APP_URL:base,PORTAL_DATA_DIR:dir,PORTAL_PERSISTENCE_PROVIDER:'local_file',PORTAL_ALLOW_INSECURE_DEMO_AUTH:'true',PORTAL_ALLOW_LOCAL_OTP_STORE:'true',PORTAL_ALLOW_LOCAL_SECRET_STORE:'true',PORTAL_SESSION_SECRET:'pending-round-test-0123456789abcdef',PORTAL_OTP_PEPPER:'pending-round-test-otp-0123456789',ASTEN_INTEGRATION_ENABLED:'false',SUPABASE_URL:'',SUPABASE_SECRET_KEY:'',SUPABASE_SERVICE_ROLE_KEY:'',VERCEL:''},stdio:'ignore'});const until=Date.now()+20000;while(true){try{if((await fetch(base+'/api/health')).ok)return;}catch{}if(Date.now()>until||child.exitCode!==null)throw Error('Servidor não iniciou');await new Promise(r=>setTimeout(r,100));}};
 const stop=async()=>{if(child?.exitCode===null){const done=new Promise(r=>child.once('exit',r));child.kill('SIGTERM');await done;}};
 const request=(url:string,method='GET',body?:unknown,email='master@portal.local')=>fetch(base+url,{method,headers:{'content-type':'application/json',...(email?{'x-demo-user-email':email}:{})},body:body===undefined?undefined:JSON.stringify(body)});
 try{
 await start();
 assert.equal((await request('/api/forms/registration-suggestions?field=nome&q=Mar','GET',undefined,'')).status,401);
 const many=await (await request('/api/forms/registration-suggestions?field=email&q=tcc')).json();assert.equal(many.filter((value:string)=>/^tcc\+\d+@example\.invalid$/.test(value)).length,75,'all matching directory entries must be available');
 const entries=await (await request('/api/admin/access-list')).json();const target=entries.find((entry:any)=>entry.processIds?.length);assert.ok(target?.processIds.length);
 const query=await request('/api/forms/registration-suggestions?field=email&q='+encodeURIComponent(target.email.slice(0,3)));const suggestions=await query.json();assert.ok(suggestions.includes(target.email));assert.ok(suggestions.every((v:unknown)=>typeof v==='string'));
 assert.deepEqual(await (await request('/api/forms/registration-suggestions?field=email&q=a')).json(),[]);
 assert.equal((await request('/api/admin/access-list/'+target.id,'DELETE')).status,200);
 assert.ok(!(await (await request('/api/admin/access-list')).json()).some((e:any)=>e.email===target.email));
 await stop();await start();
 assert.ok(!(await (await request('/api/admin/access-list')).json()).some((e:any)=>e.email===target.email),'startup must not resurrect access');
 const saved=JSON.parse(await readFile(path.join(dir,'portal-state.json'),'utf8'));assert.equal(saved.processes.length,3);
 assert.equal((await request('/api/processes/pending-0','PATCH',{titulo:'Nova edição'})).status,409);
 assert.equal((await request('/api/processes/pending-1/reopen','POST',{reason:'Teste de reabertura'})).status,409);
 assert.equal((await request('/api/processes/pending-2/repository/reopen','POST')).status,409);
 const reopened=await request('/api/processes/pending-1/repository/reopen','POST');assert.equal(reopened.status,200,await reopened.clone().text());assert.equal((await reopened.json()).acervo.submittedAt,undefined);
 const after=JSON.parse(await readFile(path.join(dir,'portal-state.json'),'utf8'));assert.equal(after.signatureJobs[0].status,'CANCELED');assert.equal(after.processes[1].dataRevision,3);assert.ok(after.processes[1].acervo.firstSubmittedAt);assert.equal((await request('/api/processes/pending-1/reopen','POST',{reason:'Não pode retroceder'})).status,409);
 }finally{await stop();await rm(dir,{recursive:true,force:true});}
});
