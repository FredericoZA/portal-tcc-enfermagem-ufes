import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {DEMO_PROCESSES,DEMO_MEMBERSHIPS,INITIAL_SETTINGS} from '../src/services/demoSeed';

import {reservationToken} from './workflow/reservationConfirmation';
test('HTTP: departamento confirma sem sessão, sem upload e sem duplicar respostas',{timeout:45000},async()=>{
 const directory=await mkdtemp(path.join(tmpdir(),'portal-department-confirm-'));
 const p=structuredClone(DEMO_PROCESSES[0]);p.acervo.submittedAt=undefined;p.avaliacao={status:'PENDENTE'};p.status='AGUARDANDO_CONFIRMACAO_LOCAL';p.etapaAtual='CONFIRMACAO_LOCAL';p.defesa={...p.defesa,local:'Auditório',alternateLocation:'Sala de reuniões',localStatus:'PENDENTE',invitationDriveFileId:undefined,invitationSentAt:undefined,locationProof:undefined};
 p.aluno2={...p.aluno1,nome:'Segundo autor',email:'second-author@example.invalid'};
 const custom=structuredClone(p);custom.id='custom-room';custom.protocolo='TCC-2026-9000';custom.defesa.local='Auditório do Hospital Universitário — prédio externo';custom.defesa.alternateLocation=undefined;custom.defesa.startAt='2026-12-02T12:00:00Z';
 const settings={...INITIAL_SETTINGS,emailConfig:{...INITIAL_SETTINGS.emailConfig,roomReservationDepartmentEmail:'department@example.invalid'},documentModels:{CONVITE:{driveFileId:'fixture-model'}}};
 const memberships=DEMO_MEMBERSHIPS.filter(m=>m.processId===p.id);
 await writeFile(path.join(directory,'portal-state.json'),JSON.stringify({settings,processes:[p,custom],memberships:[...memberships,...memberships.map(m=>({...m,id:`${m.id}-custom`,processId:custom.id}))],signatureJobs:[]}));
 const port=45500+Math.floor(Math.random()*500),base=`http://127.0.0.1:${port}`,secret='department-test-secret-0123456789abcdef';
 const child=spawn(process.execPath,['--import','tsx','server.ts'],{cwd:process.cwd(),env:{...process.env,NODE_ENV:'development',HOST:'127.0.0.1',PORT:String(port),PORTAL_PUBLIC_URL:base,APP_URL:base,PORTAL_DATA_DIR:directory,PORTAL_PERSISTENCE_PROVIDER:'local_file',PORTAL_ALLOW_INSECURE_DEMO_AUTH:'true',PORTAL_ALLOW_LOCAL_OTP_STORE:'true',PORTAL_ALLOW_LOCAL_SECRET_STORE:'true',PORTAL_SESSION_SECRET:secret,PORTAL_OTP_PEPPER:'department-otp-secret-0123456789abcdef',ASTEN_INTEGRATION_ENABLED:'false',SUPABASE_URL:'',SUPABASE_SECRET_KEY:'',SUPABASE_SERVICE_ROLE_KEY:'',VERCEL:''},stdio:'ignore'});
 const token=reservationToken({processId:p.id,revision:0,recipient:'department@example.invalid',expiresAt:Date.now()+600000},secret),url=base+'/api/reservation-confirmation/'+token;
 const disk=async()=>JSON.parse(await readFile(path.join(directory,'portal-state.json'),'utf8'));
 const waitReservationEmails=async(processId:string,count=2)=>{const deadline=Date.now()+10000;while(true){const state=await disk();if((state.emailDeliveries||[]).filter((e:any)=>e.processId===processId&&e.templateId==='email-reserva').length>=count)return;if(Date.now()>deadline)throw Error('Reservation follow-up did not deliver both notices');await new Promise(r=>setTimeout(r,20));}};
 const post=(body:string)=>fetch(url,{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded',origin:base},body});
 try{
  const deadline=Date.now()+20000;while(true){try{if((await fetch(base+'/api/health')).ok)break;}catch{}if(Date.now()>deadline||child.exitCode!==null)throw Error('Servidor não iniciou');await new Promise(r=>setTimeout(r,100));}
  const page=await fetch(url);assert.equal(page.status,200);assert.match(await page.text(),/Confirmação do agendamento/);assert.equal((await disk()).processes[0].defesa.localStatus,'PENDENTE');
  const publicRow=async()=>{const rows=await(await fetch(base+'/api/processes')).json();return rows.find((item:any)=>item.protocolo===p.protocolo);};
  const calendarRow=async()=>{
    const response=await fetch(base+'/api/public/calendar');assert.equal(response.status,200);
    return (await response.json()).find((item:{protocolo:string})=>item.protocolo===p.protocolo);
  };
  const calendarExport=async()=>{
    const response=await fetch(base+'/api/public/calendar.ics');assert.equal(response.status,200);
    return (await response.text()).split('\r\n');
  };
  const exportedDefense=()=>`UID:${p.id}@${new URL(base).host}`;
  assert.equal((await calendarRow()).defesa.localStatus,'PENDENTE','solicitação aparece antes do aceite');
  assert.ok(!(await calendarExport()).includes(exportedDefense()),'pedido pendente não entra no calendário externo');
  assert.equal((await fetch(url+'x')).status,410);
  assert.equal((await post('local=Outro&confirmed=yes')).status,400);
  assert.equal((await post('local=Auditório')).status,400);
  assert.equal((await fetch(url,{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded',origin:'https://wrong.example'},body:'local=Auditório&confirmed=yes'})).status,403);
  assert.equal((await post('local=Sala+de+reuniões&confirmed=yes')).status,400);
  const preview=await fetch(url+'?decision=accept');assert.equal(preview.status,200);assert.match(await preview.text(),/data-reservation-auto-submit="true" hidden/);assert.equal((await disk()).processes[0].defesa.localStatus,'PENDENTE','abrir o botão do e-mail não aceita a reserva');
  const responses=await Promise.all([post('decision=accept&confirmed=yes'),post('decision=accept&confirmed=yes')]);
  assert.deepEqual(responses.map(result=>result.status).sort(),[202,409]);
  const response=responses.find(result=>result.status===202)!;
  const blocked=responses.find(result=>result.status===409)!;
  assert.equal(blocked.headers.get('x-reservation-decision'),'CONFIRMED');
  assert.match(await blocked.text(),/Reserva aceita/);assert.match(response.headers.get('content-type')||'',/text\/html/);assert.match(await response.text(),/Resposta registrada/);
  const state=await disk();const result=state.processes[0];assert.equal(result.defesa.localStatus,'CONFIRMADO');assert.equal(result.defesa.local,'Auditório');assert.equal(result.defesa.localConfirmedBy,'department@example.invalid');assert.equal(result.defesa.locationProof,undefined);assert.ok(result.defesa.departmentResponse.receiptBody);assert.ok(state.formArchiveJobs.some((j:any)=>j.formType==='CONFIRMACAO_LOCAL'));assert.ok(!state.emailDeliveries.some((j:any)=>j.templateId==='email-comprovante-reserva'),'without the original participant email the receipt is not sent in a separate conversation');assert.notEqual(result.status,'CONCLUIDO');
  const currentArchive=state.formArchiveJobs.find((job:any)=>job.processId===p.id&&job.formType==='CONFIRMACAO_LOCAL'&&job.version===result.dataRevision&&job.reservationRevision===(result.defesa.reservationRevision||0));
  assert.equal(currentArchive?.status,'FAILED','without a connected Google account the archive is not claimed as durable');
  assert.ok(currentArchive.lastError,'the pending archive records its failure');
  assert.equal(result.defesa.invitationSentAt,undefined);assert.equal(result.defesa.invitationDriveFileId,undefined);
  assert.ok(!(state.emailDeliveries||[]).some((mail:any)=>mail.processId===p.id&&mail.templateId==='email-convite'));
  assert.ok(!(state.workflowRuns||[]).some((run:any)=>run.processId===p.id&&run.eventCode==='LOCATION_CONFIRMED'),'a failed receipt must not start invitation actions');
  assert.equal((await calendarRow()).defesa.localStatus,'CONFIRMADO','aceite mantém a defesa na agenda');
  const studentDetail=await fetch(base+'/api/processes/'+p.id+'/detail',{headers:{'x-demo-user-email':p.aluno1.email}});
  assert.equal(studentDetail.status,200);
  const studentView=await studentDetail.json();
  assert.equal(studentView.process.defesa.localStatus,'CONFIRMADO');
  assert.equal(studentView.process.defesa.departmentResponse.decision,'CONFIRMED');
  assert.ok((await calendarExport()).includes(exportedDefense()),'o aceite libera a exportação com o mesmo identificador');
  const receipt=await fetch(url+'/receipt');assert.equal(receipt.status,200);assert.ok(Buffer.from(await receipt.arrayBuffer()).subarray(0,4).toString()==='%PDF');
  for(const decision of ['accept','decline']){
    const used=await fetch(url+'?decision='+decision,{redirect:'manual'});
    assert.equal(used.status,200);
    const page=await used.text();
    assert.match(page,/Reserva aceita/);
    assert.match(page,/Baixar comprovante/);
    assert.doesNotMatch(page,/Os dois botões|Resposta já registrada/);
    assert.doesNotMatch(page,/data-reservation-response|<script/);
  }
  const opposite=await post('decision=decline&confirmed=yes');
  assert.equal(opposite.status,409);
  const afterReplay=await disk();
  assert.equal(afterReplay.emailDeliveries.length,state.emailDeliveries.length);
  assert.equal(afterReplay.formArchiveJobs.length,state.formArchiveJobs.length);
  assert.equal(afterReplay.auditLogs.length,state.auditLogs.length);
  assert.deepEqual(afterReplay.processes[0].defesa.departmentResponse,result.defesa.departmentResponse);
  const reschedule=await fetch(`${base}/api/processes/${p.id}/reservation-change`,{method:'POST',headers:{'content-type':'application/json','x-demo-user-email':p.aluno1.email},body:JSON.stringify({date:'2030-12-02',time:'09:00',locationChoice:p.defesa.local,expectedDataRevision:result.dataRevision})});
  assert.equal(reschedule.status,202);
  await waitReservationEmails(p.id);
  assert.equal((await disk()).emailDeliveries.filter((e:any)=>e.processId===p.id&&e.templateId==='email-reserva').length,2,'solicitação gera somente um pedido ao responsável e um aviso coletivo');
  const requestEmail=(await disk()).emailDeliveries.find((e:any)=>e.templateId==='email-reserva');assert.deepEqual(requestEmail.additionalRecipients||[],[],'pedido com os botões é exclusivo do responsável');assert.deepEqual(requestEmail.cc||[],[INITIAL_SETTINGS.masterEmail]);assert.equal((requestEmail.renderedHtml.match(/<a /g)||[]).length,2);assert.match(requestEmail.renderedHtml,/api\/reservation-confirmation\//);assert.match(requestEmail.renderedHtml,/background:#005830/);const copies=(await disk()).emailDeliveries.filter((e:any)=>e.templateId==='email-reserva'&&e.recipient!=='department@example.invalid');assert.equal(copies.length,1);assert.deepEqual([copies[0].recipient,...(copies[0].additionalRecipients||[])].sort(),[p.aluno1.email,p.aluno2?.email,p.orientador.email].filter(Boolean).sort());assert.deepEqual(copies[0].cc,[INITIAL_SETTINGS.masterEmail]);for(const copy of copies){assert.doesNotMatch(copy.renderedHtml,/api\/reservation-confirmation\//);assert.equal((copy.renderedHtml.match(/<a /g)||[]).length,1);}
  assert.equal((await fetch(url)).status,410);assert.equal((await post('local=Auditório&confirmed=yes')).status,410);assert.equal((await disk()).processes[0].defesa.departmentResponse,undefined);
  // A recipient change applies to new requests, without revoking links already sent.
  const changedAddress=await fetch(base+'/api/admin/settings',{method:'PATCH',headers:{'content-type':'application/json','x-demo-user-email':'master@portal.local'},body:JSON.stringify({emailConfig:{roomReservationDepartmentEmail:'new-department@example.invalid'}})});
  assert.equal(changedAddress.status,200);
  assert.equal((await disk()).processes[0].defesa.reservationRequestRecipient,'department@example.invalid');
  const customRestart=await fetch(`${base}/api/processes/${custom.id}/reservation-change`,{method:'POST',headers:{'content-type':'application/json','x-demo-user-email':custom.aluno1.email},body:JSON.stringify({date:'2030-12-03',time:'09:00',locationChoice:custom.defesa.local,expectedDataRevision:custom.dataRevision})});assert.equal(customRestart.status,202);
  await waitReservationEmails(custom.id);
  const customEmails=(await disk()).emailDeliveries.filter((item:any)=>item.processId===custom.id&&item.templateId==='email-reserva');
  assert.deepEqual(customEmails.map((item:any)=>item.recipient).sort(),[custom.orientador.email,custom.aluno1.email].sort());
  const participantNotice=customEmails.find((item:any)=>item.recipient===custom.aluno1.email);
  assert.deepEqual([participantNotice.recipient,...participantNotice.additionalRecipients].sort(),[custom.aluno1.email,custom.aluno2!.email,custom.orientador.email].sort());
  assert.deepEqual(participantNotice.cc,[INITIAL_SETTINGS.masterEmail]);
  const advisorMessage=customEmails.find((item:any)=>item.recipient===custom.orientador.email);
  assert.deepEqual(advisorMessage.additionalRecipients||[],[],'the personal action message is addressed only to its approver');assert.match(advisorMessage.renderedText,/Prezado orientador/);assert.equal((advisorMessage.renderedHtml.match(/<a /g)||[]).length,2);assert.match(advisorMessage.renderedHtml,/decision=accept/);assert.match(advisorMessage.renderedHtml,/decision=decline/);
  for(const copy of customEmails.filter((item:any)=>item.recipient!==custom.orientador.email))assert.doesNotMatch(copy.renderedHtml,/reservation-confirmation/);
  const customToken=reservationToken({processId:custom.id,revision:1,recipient:custom.orientador.email.toLowerCase(),expiresAt:Date.now()+600000},secret);
  const customUrl=base+'/api/reservation-confirmation/'+customToken;
  const wrongCustom=reservationToken({processId:custom.id,revision:1,recipient:'department@example.invalid',expiresAt:Date.now()+600000},secret);
  assert.equal((await fetch(base+'/api/reservation-confirmation/'+wrongCustom)).status,410,'departamento não autoriza local externo');
  const customPage=await fetch(customUrl+'?decision=decline');assert.equal(customPage.status,200);const customHtml=await customPage.text();assert.match(customHtml,/Recusar reserva/);assert.doesNotMatch(customHtml,/type="radio"|name="local"/);assert.equal((await disk()).processes.find((item:any)=>item.id===custom.id).defesa.departmentResponse,undefined);
  const customReply=await fetch(customUrl,{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded',origin:base},body:'decision=decline&confirmed=yes'});assert.equal(customReply.status,202);assert.match(await customReply.text(),/Resposta registrada/);
  const customSaved=(await disk()).processes.find((item:any)=>item.id===custom.id);assert.equal(customSaved.defesa.departmentResponse.decision,'UNAVAILABLE');assert.equal(customSaved.defesa.departmentResponse.respondedBy,custom.orientador.email.toLowerCase());
  assert.equal(customSaved.defesa.invitationSentAt,undefined);
  const customArchive=(await disk()).formArchiveJobs.find((job:any)=>job.processId===custom.id&&job.version===customSaved.dataRevision&&job.reservationRevision===1);
  assert.equal(customArchive?.status,'FAILED');assert.ok(customArchive.lastError);
  const customReceipt=await fetch(customUrl+'/receipt');assert.equal(customReceipt.status,200);assert.equal(Buffer.from(await customReceipt.arrayBuffer()).subarray(0,4).toString(),'%PDF');
  const wrong=reservationToken({processId:p.id,revision:1,recipient:'other@example.invalid',expiresAt:Date.now()+600000},secret);assert.equal((await fetch(base+'/api/reservation-confirmation/'+wrong)).status,410);
  const next=reservationToken({processId:p.id,revision:1,recipient:'department@example.invalid',expiresAt:Date.now()+600000},secret);
  const denied=await fetch(base+'/api/reservation-confirmation/'+next,{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded',origin:base,'x-demo-user-email':'forwarding-observer@example.invalid'},body:'local=__UNAVAILABLE__&confirmed=yes'});assert.equal(denied.status,202);assert.match(await denied.text(),/Resposta registrada/);
  const unavailable=(await disk()).processes[0];assert.equal(unavailable.defesa.departmentResponse.decision,'UNAVAILABLE');assert.equal(unavailable.defesa.departmentResponse.respondedBy,'department@example.invalid','um link encaminhado não depende do login do Master nem inventa o e-mail de quem abriu');assert.equal(unavailable.defesa.departmentResponse.attribution,'EMAIL_LINK');assert.equal(unavailable.defesa.localStatus,'RECUSADO');assert.match(unavailable.defesa.departmentResponse.receiptBody,/Reserva recusada/);assert.equal(unavailable.defesa.invitationSentAt,undefined);const deniedNotices=(await disk()).emailDeliveries.filter((e:any)=>e.subject.includes('Agendamento recusado'));assert.equal(deniedNotices.length,0,'unacknowledged participant request cannot produce an unthreaded refusal email');assert.ok((await disk()).auditLogs.some((event:any)=>event.action==='COMPROVANTE_AGUARDA_CONVERSA_ORIGINAL'));assert.equal(await calendarRow(),undefined,'recusa retira o agendamento da agenda pública');assert.ok(!(await calendarExport()).includes(exportedDefense()),'recusa retira a defesa da exportação');assert.equal((await publicRow()).protocolo,p.protocolo);assert.equal((await publicRow()).defesa.localStatus,'RECUSADO');
  const deniedReceipt=await fetch(base+'/api/reservation-confirmation/'+next+'/receipt');assert.equal(deniedReceipt.status,200);assert.equal(Buffer.from(await deniedReceipt.arrayBuffer()).subarray(0,4).toString(),'%PDF');assert.match(deniedReceipt.headers.get('content-disposition')||'',/indisponibilidade.pdf/);

  const imported=await fetch(base+'/api/calendar/sync',{method:'POST',headers:{'content-type':'application/json','x-demo-user-email':'master@portal.local'},body:JSON.stringify({events:[{id:'old-remote-event',summary:'Defesa antiga',description:`Protocolo: ${p.protocolo}`,start:unavailable.defesa.startAt,end:unavailable.defesa.endAt},{id:'unrelated-event',summary:'Evento independente',start:unavailable.defesa.startAt,end:unavailable.defesa.endAt}]})});
  assert.equal(imported.status,200);
  assert.deepEqual((await(await fetch(base+'/api/calendar/events')).json()).map((event:any)=>event.id),['unrelated-event'],'um evento antigo do TCC recusado não reaparece; eventos independentes são preservados');

  const rebook=await fetch(`${base}/api/processes/${p.id}/reservation-change`,{method:'POST',headers:{'content-type':'application/json','x-demo-user-email':p.aluno1.email},body:JSON.stringify({date:'2026-12-07',time:'14:00',locationChoice:unavailable.defesa.local,expectedDataRevision:unavailable.dataRevision})});
  assert.equal(rebook.status,202);await rebook.json();await waitReservationEmails(p.id,4);const rebooked=(await disk()).processes.find((item:any)=>item.id===p.id);
  assert.equal(rebooked.id,p.id);assert.equal(rebooked.protocolo,p.protocolo);assert.equal(rebooked.defesa.localStatus,'PENDENTE');assert.equal(rebooked.defesa.reservationRequestRecipient,'new-department@example.invalid','novo agendamento usa o novo endereço configurado');
  const newCalendarRow=await calendarRow();
  assert.equal(newCalendarRow.protocolo,p.protocolo,'nova data volta ao calendário com o mesmo protocolo');
  assert.equal(newCalendarRow.defesa.localStatus,'PENDENTE');
  assert.equal(newCalendarRow.defesa.startAt,rebooked.defesa.startAt);
  assert.ok(!(await calendarExport()).includes(exportedDefense()),'novo pedido só entra no calendário externo após o aceite');

  // Normal rebooking to the other managed room, followed by its existing signed decision route.
  const roomChange=await fetch(`${base}/api/processes/${p.id}/reservation-change`,{method:'POST',headers:{'content-type':'application/json','x-demo-user-email':p.aluno1.email},body:JSON.stringify({date:'2030-12-04',time:'10:00',locationChoice:'Sala de reuniões do Departamento de Enfermagem - CCS/UFES',expectedDataRevision:rebooked.dataRevision})});
  assert.equal(roomChange.status,202,await roomChange.clone().text());await roomChange.json();await waitReservationEmails(p.id,6);
  const roomPending=(await disk()).processes.find((item:any)=>item.id===p.id);
  assert.match(roomPending.defesa.local,/Sala de reuni/i);assert.equal(roomPending.defesa.localStatus,'PENDENTE');
  const roomToken=reservationToken({processId:p.id,revision:roomPending.defesa.reservationRevision||0,recipient:'new-department@example.invalid',expiresAt:Date.now()+600000},secret);
  const roomAccepted=await fetch(base+'/api/reservation-confirmation/'+roomToken,{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded',origin:base,accept:'application/json'},body:'decision=accept&confirmed=yes'});
  assert.equal(roomAccepted.status,200,await roomAccepted.clone().text());
  const roomDecision=await roomAccepted.json();
  assert.deepEqual(roomDecision,{decision:'CONFIRMED',receiptPath:'/api/reservation-confirmation/'+roomToken+'/receipt'});
  const roomReceipt=await fetch(base+roomDecision.receiptPath);
  assert.equal(roomReceipt.status,200);
  assert.equal(Buffer.from(await roomReceipt.arrayBuffer()).subarray(0,4).toString(),'%PDF');
  const roomConfirmed=(await disk()).processes.find((item:any)=>item.id===p.id);
  assert.equal(roomConfirmed.defesa.localStatus,'CONFIRMADO');assert.match(roomConfirmed.defesa.local,/Sala de reuni/i);
  assert.equal((await calendarRow()).defesa.local,roomConfirmed.defesa.local);assert.equal((await calendarRow()).defesa.localStatus,'CONFIRMADO');
  assert.equal((await publicRow()).defesa.local,roomConfirmed.defesa.local);assert.equal((await publicRow()).protocolo,p.protocolo);

 }finally{if(child.exitCode===null){const stopped=new Promise(r=>child.once('exit',r));child.kill('SIGTERM');await stopped;}await rm(directory,{recursive:true,force:true});}
});
