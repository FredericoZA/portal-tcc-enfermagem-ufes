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
 const custom=structuredClone(p);custom.id='custom-room';custom.protocolo='TCC-2026-9000';custom.defesa.local='Auditório do Hospital Universitário — prédio externo';custom.defesa.alternateLocation=undefined;custom.defesa.startAt='2026-12-02T12:00:00Z';
 const settings={...INITIAL_SETTINGS,emailConfig:{...INITIAL_SETTINGS.emailConfig,roomReservationDepartmentEmail:'department@example.invalid'},documentModels:{CONVITE:{driveFileId:'fixture-model'}}};
 const memberships=DEMO_MEMBERSHIPS.filter(m=>m.processId===p.id);
 await writeFile(path.join(directory,'portal-state.json'),JSON.stringify({settings,processes:[p,custom],memberships:[...memberships,...memberships.map(m=>({...m,id:`${m.id}-custom`,processId:custom.id}))],signatureJobs:[]}));
 const port=45500+Math.floor(Math.random()*500),base=`http://127.0.0.1:${port}`,secret='department-test-secret-0123456789abcdef';
 const child=spawn(process.execPath,['--import','tsx','server.ts'],{cwd:process.cwd(),env:{...process.env,NODE_ENV:'development',HOST:'127.0.0.1',PORT:String(port),PORTAL_PUBLIC_URL:base,APP_URL:base,PORTAL_DATA_DIR:directory,PORTAL_PERSISTENCE_PROVIDER:'local_file',PORTAL_ALLOW_INSECURE_DEMO_AUTH:'true',PORTAL_ALLOW_LOCAL_OTP_STORE:'true',PORTAL_ALLOW_LOCAL_SECRET_STORE:'true',PORTAL_SESSION_SECRET:secret,PORTAL_OTP_PEPPER:'department-otp-secret-0123456789abcdef',ASTEN_INTEGRATION_ENABLED:'false',SUPABASE_URL:'',SUPABASE_SECRET_KEY:'',SUPABASE_SERVICE_ROLE_KEY:'',VERCEL:''},stdio:'ignore'});
 const token=reservationToken({processId:p.id,revision:0,recipient:'department@example.invalid',expiresAt:Date.now()+600000},secret),url=base+'/api/reservation-confirmation/'+token;
 const disk=async()=>JSON.parse(await readFile(path.join(directory,'portal-state.json'),'utf8'));
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
  const response=await post('decision=accept&confirmed=yes');assert.equal(response.status,200);assert.match(response.headers.get('content-type')||'',/application\/pdf/);assert.equal(Buffer.from(await response.arrayBuffer()).subarray(0,4).toString(),'%PDF');
  const state=await disk();const result=state.processes[0];assert.equal(result.defesa.localStatus,'CONFIRMADO');assert.equal(result.defesa.local,'Auditório');assert.equal(result.defesa.localConfirmedBy,'department@example.invalid');assert.equal(result.defesa.locationProof,undefined);assert.ok(result.defesa.departmentResponse.receiptBody);assert.ok(state.formArchiveJobs.some((j:any)=>j.formType==='CONFIRMACAO_LOCAL'));assert.ok(state.emailDeliveries.some((j:any)=>j.templateId==='email-comprovante-reserva'));assert.notEqual(result.status,'CONCLUIDO');
  assert.equal((await calendarRow()).defesa.localStatus,'CONFIRMADO','aceite mantém a defesa na agenda');
  assert.ok((await calendarExport()).includes(exportedDefense()),'o aceite libera a exportação com o mesmo identificador');
  const receipt=await fetch(url+'/receipt');assert.equal(receipt.status,200);assert.ok(Buffer.from(await receipt.arrayBuffer()).subarray(0,4).toString()==='%PDF');
  const count=state.emailDeliveries.length;assert.equal((await post('local=Auditório&confirmed=yes')).status,200);assert.equal((await disk()).emailDeliveries.length,count);assert.equal((await disk()).processes[0].defesa.local,'Auditório');
  await fetch(`${base}/api/processes/${p.id}`,{method:'PATCH',headers:{'content-type':'application/json','x-demo-user-email':p.aluno1.email},body:JSON.stringify({defesa:{startAt:'2026-12-01T12:00:00Z'}})});
  const requestEmail=(await disk()).emailDeliveries.find((e:any)=>e.templateId==='email-reserva');assert.deepEqual(requestEmail.cc||[],[INITIAL_SETTINGS.masterEmail]);assert.equal((requestEmail.renderedHtml.match(/<a /g)||[]).length,2);assert.match(requestEmail.renderedHtml,/api\/reservation-confirmation\//);assert.match(requestEmail.renderedHtml,/background:#005830/);const copies=(await disk()).emailDeliveries.filter((e:any)=>e.templateId==='email-reserva'&&e.recipient!=='department@example.invalid');assert.equal(copies.length,1);assert.deepEqual([copies[0].recipient,...(copies[0].cc||[])].sort(),[p.aluno1.email,p.aluno2?.email,p.orientador.email,INITIAL_SETTINGS.masterEmail].filter(Boolean).sort());for(const copy of copies){assert.doesNotMatch(copy.renderedHtml,/api\/reservation-confirmation\//);assert.equal((copy.renderedHtml.match(/<a /g)||[]).length,1);}
  assert.equal((await fetch(url)).status,410);assert.equal((await post('local=Auditório&confirmed=yes')).status,410);assert.equal((await disk()).processes[0].defesa.departmentResponse,undefined);
  // A recipient change applies to new requests, without revoking links already sent.
  const changedAddress=await fetch(base+'/api/admin/settings',{method:'PATCH',headers:{'content-type':'application/json','x-demo-user-email':'master@portal.local'},body:JSON.stringify({emailConfig:{roomReservationDepartmentEmail:'new-department@example.invalid'}})});
  assert.equal(changedAddress.status,200);
  assert.equal((await disk()).processes[0].defesa.reservationRequestRecipient,'department@example.invalid');
  const customRestart=await fetch(`${base}/api/processes/${custom.id}`,{method:'PATCH',headers:{'content-type':'application/json','x-demo-user-email':custom.aluno1.email},body:JSON.stringify({defesa:{startAt:'2026-12-03T12:00:00Z'}})});assert.equal(customRestart.status,202);
  const customEmails=(await disk()).emailDeliveries.filter((item:any)=>item.processId===custom.id&&item.templateId==='email-reserva');
  assert.deepEqual(customEmails.map((item:any)=>item.recipient).sort(),[...new Set([custom.orientador.email,custom.aluno1.email,custom.aluno2?.email].filter(Boolean))].sort());
  const advisorMessage=customEmails.find((item:any)=>item.recipient===custom.orientador.email);assert.match(advisorMessage.renderedText,/Prezado orientador/);assert.equal((advisorMessage.renderedHtml.match(/<a /g)||[]).length,2);assert.match(advisorMessage.renderedHtml,/decision=accept/);assert.match(advisorMessage.renderedHtml,/decision=decline/);
  for(const copy of customEmails.filter((item:any)=>item.recipient!==custom.orientador.email))assert.doesNotMatch(copy.renderedHtml,/reservation-confirmation/);
  const customToken=reservationToken({processId:custom.id,revision:1,recipient:custom.orientador.email.toLowerCase(),expiresAt:Date.now()+600000},secret);
  const customUrl=base+'/api/reservation-confirmation/'+customToken;
  const wrongCustom=reservationToken({processId:custom.id,revision:1,recipient:'department@example.invalid',expiresAt:Date.now()+600000},secret);
  assert.equal((await fetch(base+'/api/reservation-confirmation/'+wrongCustom)).status,410,'departamento não autoriza local externo');
  const customPage=await fetch(customUrl+'?decision=decline');assert.equal(customPage.status,200);const customHtml=await customPage.text();assert.match(customHtml,/Recusar reserva/);assert.doesNotMatch(customHtml,/type="radio"|name="local"/);assert.equal((await disk()).processes.find((item:any)=>item.id===custom.id).defesa.departmentResponse,undefined);
  const customReply=await fetch(customUrl,{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded',origin:base},body:'decision=decline&confirmed=yes'});assert.equal(customReply.status,200);
  const customSaved=(await disk()).processes.find((item:any)=>item.id===custom.id);assert.equal(customSaved.defesa.departmentResponse.decision,'UNAVAILABLE');assert.equal(customSaved.defesa.departmentResponse.respondedBy,custom.orientador.email.toLowerCase());
  const wrong=reservationToken({processId:p.id,revision:1,recipient:'other@example.invalid',expiresAt:Date.now()+600000},secret);assert.equal((await fetch(base+'/api/reservation-confirmation/'+wrong)).status,410);
  const next=reservationToken({processId:p.id,revision:1,recipient:'department@example.invalid',expiresAt:Date.now()+600000},secret);
  const denied=await fetch(base+'/api/reservation-confirmation/'+next,{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded',origin:base,'x-demo-user-email':'forwarding-observer@example.invalid'},body:'local=__UNAVAILABLE__&confirmed=yes'});assert.equal(denied.status,200);
  const unavailable=(await disk()).processes[0];assert.equal(unavailable.defesa.departmentResponse.decision,'UNAVAILABLE');assert.equal(unavailable.defesa.departmentResponse.respondedBy,'department@example.invalid','um link encaminhado não depende do login do Master nem inventa o e-mail de quem abriu');assert.equal(unavailable.defesa.departmentResponse.attribution,'EMAIL_LINK');assert.equal(unavailable.defesa.localStatus,'RECUSADO');assert.match(unavailable.defesa.departmentResponse.receiptBody,/Reserva recusada/);assert.equal(unavailable.defesa.invitationSentAt,undefined);const deniedNotices=(await disk()).emailDeliveries.filter((e:any)=>e.subject.includes('Agendamento recusado'));assert.ok(deniedNotices.length);for(const notice of deniedNotices){assert.match(notice.renderedText,/comprovante de indisponibilidade/i);assert.match(notice.renderedHtml,/Comprovante de indisponibilidade/);}assert.equal(await calendarRow(),undefined,'recusa retira o agendamento da agenda pública');assert.ok(!(await calendarExport()).includes(exportedDefense()),'recusa retira a defesa da exportação');assert.equal((await publicRow()).protocolo,p.protocolo);assert.equal((await publicRow()).defesa.localStatus,'RECUSADO');
  assert.ok(deniedNotices.every((notice:any)=>notice.renderedText.includes('Refazer reserva')&&notice.renderedText.includes('evitar retrabalho')));
  const deniedReceipt=await fetch(base+'/api/reservation-confirmation/'+next+'/receipt');assert.match(deniedReceipt.headers.get('content-disposition')||'',/indisponibilidade.pdf/);

  const imported=await fetch(base+'/api/calendar/sync',{method:'POST',headers:{'content-type':'application/json','x-demo-user-email':'master@portal.local'},body:JSON.stringify({events:[{id:'old-remote-event',summary:'Defesa antiga',description:`Protocolo: ${p.protocolo}`,start:unavailable.defesa.startAt,end:unavailable.defesa.endAt},{id:'unrelated-event',summary:'Evento independente',start:unavailable.defesa.startAt,end:unavailable.defesa.endAt}]})});
  assert.equal(imported.status,200);
  assert.deepEqual((await(await fetch(base+'/api/calendar/events')).json()).map((event:any)=>event.id),['unrelated-event'],'um evento antigo do TCC recusado não reaparece; eventos independentes são preservados');

  const rebook=await fetch(`${base}/api/processes/${p.id}/reservation-change`,{method:'POST',headers:{'content-type':'application/json','x-demo-user-email':p.aluno1.email},body:JSON.stringify({date:'2026-12-07',time:'14:00',locationChoice:unavailable.defesa.local,expectedDataRevision:unavailable.dataRevision})});
  assert.equal(rebook.status,202);const rebooked=await rebook.json();
  assert.equal(rebooked.id,p.id);assert.equal(rebooked.protocolo,p.protocolo);assert.equal(rebooked.defesa.localStatus,'PENDENTE');assert.equal(rebooked.defesa.reservationRequestRecipient,'new-department@example.invalid','novo agendamento usa o novo endereço configurado');
  const newCalendarRow=await calendarRow();
  assert.equal(newCalendarRow.protocolo,p.protocolo,'nova data volta ao calendário com o mesmo protocolo');
  assert.equal(newCalendarRow.defesa.localStatus,'PENDENTE');
  assert.equal(newCalendarRow.defesa.startAt,rebooked.defesa.startAt);
  assert.ok(!(await calendarExport()).includes(exportedDefense()),'novo pedido só entra no calendário externo após o aceite');

 }finally{if(child.exitCode===null){const stopped=new Promise(r=>child.once('exit',r));child.kill('SIGTERM');await stopped;}await rm(directory,{recursive:true,force:true});}
});
