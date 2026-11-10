import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {DEMO_PROCESSES,DEMO_MEMBERSHIPS,INITIAL_SETTINGS} from '../src/services/demoSeed';

test('HTTP: alterações reiniciam reserva, invalidam comprovante e registram reenvio pendente sem duplicar salvamento idêntico',{timeout:45000},async()=>{
 const directory=await mkdtemp(path.join(tmpdir(),'portal-reservation-restart-'));
 const p=structuredClone(DEMO_PROCESSES[0]);p.acervo.submittedAt=undefined;p.avaliacao={status:'PENDENTE'};p.status='AGUARDANDO_CONFIRMACAO_LOCAL';p.etapaAtual='CONFIRMACAO_LOCAL';p.defesa={...p.defesa,localStatus:'PENDENTE',invitationDriveFileId:'old-invitation',invitationSentAt:'2026-10-01T12:00:00Z',invitationRecipients:['board@example.invalid'],locationProof:{driveFileId:'previous-proof',fileName:'proof.pdf',version:1,sha256:'a'.repeat(64),uploadedAt:new Date().toISOString(),uploadedBy:p.aluno1.email}};
 const second=structuredClone(p);second.id='reservation-competing';second.protocolo='TCC-2026-0999';second.defesa.startAt='2030-11-20T18:00:00Z';second.defesa.locationProof=undefined;second.defesa.local='Outro local';second.defesa.alternateLocation=undefined;
 second.aluno1.email='competing@edu.ufes.br';if(second.aluno2)second.aluno2.email='competing-two@edu.ufes.br';second.orientador.email='competing-advisor@ufes.br';if(second.coorientador)second.coorientador.email='competing-coadvisor@ufes.br';second.banca.forEach((member,index)=>member.email=`competing-examiner-${index}@ufes.br`);
 const settings={...INITIAL_SETTINGS,emailConfig:{...INITIAL_SETTINGS.emailConfig,roomReservationDepartmentEmail:'department@example.invalid'},documentModels:{CONVITE:{driveFileId:'fixture-model'}}};
 const memberships=DEMO_MEMBERSHIPS.filter(m=>m.processId===p.id);
 await writeFile(path.join(directory,'portal-state.json'),JSON.stringify({settings,processes:[p,second],memberships:[...memberships,{id:'member-competing-author',email:second.aluno1.email,processId:second.id,roles:['STUDENT'],active:true}],signatureJobs:[]}));
 const port=45000+Math.floor(Math.random()*500),base=`http://127.0.0.1:${port}`;
 const child=spawn(process.execPath,['--import','tsx','server.ts'],{cwd:process.cwd(),env:{...process.env,NODE_ENV:'development',HOST:'127.0.0.1',PORT:String(port),PORTAL_PUBLIC_URL:base,PORTAL_DATA_DIR:directory,PORTAL_PERSISTENCE_PROVIDER:'local_file',PORTAL_ALLOW_INSECURE_DEMO_AUTH:'true',PORTAL_ALLOW_LOCAL_OTP_STORE:'true',PORTAL_ALLOW_LOCAL_SECRET_STORE:'true',PORTAL_SESSION_SECRET:'restart-session-test-secret-0123456789abcdef',PORTAL_OTP_PEPPER:'restart-otp-test-secret-0123456789abcdef',ASTEN_INTEGRATION_ENABLED:'false',SUPABASE_URL:'',SUPABASE_SECRET_KEY:'',SUPABASE_SERVICE_ROLE_KEY:'',VERCEL:''},stdio:'ignore'});
 const change=(body:unknown,email=p.aluno1.email,processId=p.id)=>fetch(`${base}/api/processes/${processId}/reservation-change`,{method:'POST',headers:{'content-type':'application/json',...(email?{'x-demo-user-email':email}:{})},body:JSON.stringify(body)});
 const initial={date:'2030-11-20',time:'11:00',locationChoice:p.defesa.local,expectedDataRevision:p.dataRevision};
 try{
  const deadline=Date.now()+20000;while(true){try{if((await fetch(base+'/api/health')).ok)break;}catch{}if(Date.now()>deadline||child.exitCode!==null)throw Error('Servidor não iniciou');await new Promise(r=>setTimeout(r,100));}
  assert.ok([403,404].includes((await change(initial,p.banca.find(member=>member.email!==p.orientador.email)!.email)).status));
  for(const email of ['master@portal.local']){
    assert.equal((await change(initial,email)).status,403);
  }
  const changed=await change(initial);assert.equal(changed.status,202);const result=await changed.json();assert.equal(result.reservationRestarted,true);assert.equal(result.workflowPending,true);assert.equal(result.workflowProcessing,true);assert.equal(result.defesa.localStatus,'PENDENTE');assert.equal(result.defesa.locationProof,undefined);assert.equal(result.defesa.reservationRevision,1);assert.equal(result.defesa.reservationHistory[0].locationProof.driveFileId,'previous-proof');assert.equal(result.etapaAtual,'CONFIRMACAO_LOCAL');assert.equal(result.defesa.invitationSentAt,undefined);assert.equal(result.defesa.invitationDriveFileId,undefined);assert.equal(result.defesa.reservationHistory[0].invitationDriveFileId,'old-invitation');
  const disk=async()=>JSON.parse(await readFile(path.join(directory,'portal-state.json'),'utf8'));
  const afterWorkflow=async(count:number)=>{const until=Date.now()+10000;while(Date.now()<until){const state=await disk();if((state.workflowRuns||[]).length>=count&&(state.emailDeliveries||[]).length>=count*2)return state;await new Promise(resolve=>setTimeout(resolve,20));}throw Error('O fluxo automático não terminou após a confirmação do salvamento.');};
  const first=await afterWorkflow(1);assert.equal(first.workflowRuns.length,1);assert.equal(first.workflowRuns[0].eventCode,'RESERVATION_RESCHEDULED');const recipients=[...new Set(['department@example.invalid',p.aluno1.email,p.aluno2?.email,p.orientador.email,INITIAL_SETTINGS.masterEmail].filter(Boolean))];assert.equal(first.emailDeliveries.length,2);assert.deepEqual([...new Set(first.emailDeliveries.flatMap((e:any)=>[e.recipient,...(e.additionalRecipients||[]),...(e.cc||[])]))].sort(),recipients.sort());assert.notEqual(first.emailDeliveries[0].status,'ACCEPTED_BY_GMAIL');assert.match(first.emailDeliveries[0].renderedText,/20\/11\/2030/);
  const same=await change({...initial,expectedDataRevision:result.dataRevision});assert.equal(same.status,200);const unchanged=await same.json();assert.equal(unchanged.reservationRestarted,false);assert.equal(unchanged.dataRevision,result.dataRevision);assert.equal((await disk()).workflowRuns.length,1);assert.equal((await disk()).emailDeliveries.length,2);
  const confirm=await fetch(`${base}/api/processes/${p.id}/confirm-location`,{method:'POST',headers:{'content-type':'application/json','x-demo-user-email':'master@portal.local'},body:JSON.stringify({local:result.defesa.local,confirmationReceived:true,manualConfirmationReason:"Conferência administrativa de teste"})});assert.equal(confirm.status,404);assert.equal((await confirm.json()).code,'API_NOT_FOUND');
  const local=await change({...initial,locationChoice:'__OUTRO_LOCAL__',customLocation:'Sala de reuniões de teste',expectedDataRevision:result.dataRevision});assert.equal(local.status,202);const localBody=await local.json();assert.equal(localBody.defesa.reservationRevision,2);const final=await afterWorkflow(2);assert.equal(final.workflowRuns.length,2);assert.equal(final.emailDeliveries.length,4);const oldRetry=await fetch(`${base}/api/admin/email-deliveries/${final.emailDeliveries[0].id}/retry`,{method:'POST',headers:{'content-type':'application/json','x-demo-user-email':'master@portal.local'},body:'{}'});assert.equal(oldRetry.status,409);assert.equal((await oldRetry.json()).code,'STALE_RESERVATION_REQUEST');assert.match(final.emailDeliveries.at(-1).renderedText,/Local: Sala de Reuniões de Teste/);assert.ok(final.auditLogs.some((log:any)=>log.action==='REINICIO_SOLICITACAO_RESERVA'));
  // A nova interface deve usar a mesma transação de reserva e links de decisão.
  const current=(await disk()).processes.find((item:any)=>item.id===p.id);
  const proposal={date:'2030-12-03',time:'14:00',locationChoice:current.defesa.local,expectedDataRevision:current.dataRevision};
  assert.equal((await change(proposal,'')).status,401);
  for(const email of ['master@portal.local']){
    assert.equal((await change(proposal,email)).status,403);
  }
  const stale=await change({...proposal,expectedDataRevision:current.dataRevision-1});assert.equal(stale.status,409);assert.equal((await stale.json()).code,'STALE_DATA_REVISION');
  assert.equal((await change(proposal,p.banca.find(member=>member.email!==p.orientador.email)!.email)).status,403);
  const proposed=await change(proposal,p.orientador.email);assert.equal(proposed.status,202);const proposedBody=await proposed.json();assert.equal(proposedBody.reservationRestarted,true);assert.equal(proposedBody.defesa.localStatus,'PENDENTE');assert.equal(proposedBody.defesa.reservationRevision,3);assert.equal(proposedBody.defesa.startAt,'2030-12-03T17:00:00.000Z');assert.equal(proposedBody.defesa.reservationChangeRequest,undefined);
  const afterProposal=await afterWorkflow(3);assert.equal(afterProposal.workflowRuns.at(-1).eventCode,'RESERVATION_RESCHEDULED');assert.ok(afterProposal.emailDeliveries.some((delivery:any)=>delivery.templateId==='email-reserva'&&Number(delivery.workflowEventVariables?.RESERVATION_REVISION)===3));
  const compete=(candidate:typeof p,expectedDataRevision:number)=>change({date:'2030-10-30',time:'11:00',locationChoice:'__OUTRO_LOCAL__',customLocation:'Sala concorrente',expectedDataRevision},candidate.aluno1.email,candidate.id);
  const competing=await Promise.all([compete(p,proposedBody.dataRevision),compete(second,second.dataRevision)]);
  assert.deepEqual(competing.map(response=>response.status).sort(),[202,409],'somente um pedido concorrente pode bloquear o local escolhido');
  const rejected=await competing.find(response=>response.status===409)!.json();assert.equal(rejected.code,'DEFENSE_CONFLICT');assert.deepEqual(rejected.conflicts,[{restricted:true}],'o conflito bloqueia a reserva sem revelar dados do outro processo');
  const saved=await disk();assert.equal(saved.processes.filter((process:any)=>Date.parse(process.defesa.startAt)===Date.parse('2030-10-30T14:00:00Z')).length,1,'o pedido recusado não ocupa o intervalo nem substitui o vencedor');
 }finally{if(child.exitCode===null){const stopped=new Promise(r=>child.once('exit',r));child.kill('SIGTERM');await stopped;}await rm(directory,{recursive:true,force:true});}
});
