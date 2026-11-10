import test from 'node:test';
import assert from 'node:assert/strict';
import {buildAuditFeed,buildPagedAuditFeed,decodeAuditCursor,emailDeliveryPreview,pageAuditFeed} from './auditFeed';
import {initialEmailDelivery} from './integrations/trackedGmail';
import {DEMO_PROCESSES} from '../src/services/demoSeed';
import type {AuditLog} from '../src/types';
const p=DEMO_PROCESSES[0];
const mail=()=>initialEmailDelivery({recipient:'recipient@example.invalid',cc:['audit@example.invalid'],processId:p.id,protocol:p.protocolo,requestedBy:p.aluno1.email,subject:'Reserva do TCC',text:'Pedido de reserva registrado.',idempotencyKey:'fixture-audit'},new Date('2026-11-04T12:00:00Z'));

test('página de logs usa data de São Paulo e não repete registros ao inserir um evento mais recente', () => {
 const events: AuditLog[] = Array.from({length:103}, (_, index) => ({
  id:`fixture-${String(index).padStart(3,'0')}`, actorEmail:'fixture@example.invalid', actorRoles:[],
  action:'CRIACAO_PROCESSO', entityType:'processo', entityId:p.id, processId:p.id, timestamp:'2027-01-01T02:59:59.000Z'
 }));
 const feed = (logs: AuditLog[]) => buildAuditFeed({logs, deliveries:[mail()], processes:[p]});
 const query = {search:p.protocolo.toLowerCase(),kind:'activity',start:'2026-12-31',end:'2026-12-31',focusId:events[102].id};
 const first = pageAuditFeed(feed(events), query);
 assert.equal(first.items.length,100);
 assert.equal(first.total,103);
 assert.equal(first.focused?.id,events[102].id);
 const before = decodeAuditCursor(first.nextCursor || '');
 assert.ok(before);
 const second = pageAuditFeed(feed([{...events[0],id:'newer',timestamp:'2027-01-01T02:59:59.999Z'}, ...events]), {...query,before});
 assert.deepEqual(second.items.map(log=>log.id),events.slice(100).map(log=>log.id));
 assert.equal(second.nextCursor,null);
 assert.equal(decodeAuditCursor('not-valid-json'),null);
});

test('envio aparece uma vez com todas as tentativas, protocolo, ator original e destinatários reais',()=>{
 const delivery=mail();delivery.status='ACCEPTED_BY_GMAIL';delivery.attempts=[{number:1,startedAt:'2026-11-04T12:00:00Z',completedAt:'2026-11-04T12:00:01Z',status:'RETRY',errorCode:'TRANSIENT_GMAIL_ERROR',errorMessage:'Indisponível'},{number:2,startedAt:'2026-11-04T12:02:00Z',completedAt:'2026-11-04T12:02:01Z',status:'ACCEPTED_BY_GMAIL'}];delivery.acceptedAt=delivery.updatedAt='2026-11-04T12:02:01Z';
 const rows=buildAuditFeed({logs:[],deliveries:[delivery],processes:[p]});assert.equal(rows.length,1);
 assert.equal(rows[0].actorEmail,p.aluno1.email);assert.equal(rows[0].actorName,p.aluno1.nome);
 assert.equal(rows[0].processProtocol,p.protocolo);assert.equal(rows[0].processTitle,p.titulo);
 assert.equal(rows[0].action,'EMAIL_ENVIO_ACEITO_GMAIL');assert.equal(rows[0].after.attempts.length,2);
 assert.equal(rows[0].after.recipient,delivery.recipient);assert.deepEqual(rows[0].after.cc,delivery.cc);
 assert.equal(rows[0].after.renderedText,undefined);assert.equal(rows[0].after.renderedHtml,undefined);
 assert.equal(buildAuditFeed({logs:[],deliveries:[delivery],processes:[p]})[0].id,rows[0].id);
});

test('eventos sem prova de envio não são rotulados como aceitos nem atribuem o destinatário como remetente',()=>{
 const record=mail();delete record.requestedBy;
 assert.equal(buildAuditFeed({logs:[],deliveries:[record],processes:[p]})[0].action,'EMAIL_ENVIO_PENDENTE');
 assert.equal(buildAuditFeed({logs:[],deliveries:[record],processes:[p]})[0].actorEmail,'Sistema');
 record.attempts=[{number:1,startedAt:record.createdAt,completedAt:record.createdAt,status:'RETRY'}];
 assert.equal(buildAuditFeed({logs:[],deliveries:[record],processes:[p]})[0].action,'EMAIL_ENVIO_NOVA_TENTATIVA');
 record.status='FAILED';assert.equal(buildAuditFeed({logs:[],deliveries:[record],processes:[p]})[0].action,'EMAIL_ENVIO_FALHOU');
});

test('envio em processamento ou incerto preserva o estado sem afirmar falha definitiva',()=>{
 const record=mail();record.dispatchStartedAt=record.createdAt;record.dispatchLeaseUntil='2099-11-04T12:02:00Z';
 record.dispatchState='SENDING';
 let [row]=buildAuditFeed({logs:[],deliveries:[record],processes:[p]});
 assert.equal(row.action,'EMAIL_ENVIO_EM_PROCESSAMENTO');assert.equal(row.after.dispatchState,'SENDING');assert.equal(row.after.dispatchStartedAt,record.createdAt);
 assert.equal(row.after.dispatchLeaseUntil,record.dispatchLeaseUntil);
 record.dispatchLeaseUntil='2000-01-01T00:00:00Z';
 [row]=buildAuditFeed({logs:[],deliveries:[record],processes:[p]});
 assert.equal(row.action,'EMAIL_ENVIO_NAO_CONFIRMADO');assert.equal(row.after.dispatchState,'UNCERTAIN');assert.equal(record.dispatchState,'SENDING','apresentar o resultado não altera o registro persistido');
 record.dispatchState='UNCERTAIN';record.status='FAILED';
 [row]=buildAuditFeed({logs:[],deliveries:[record],processes:[p]});
 assert.equal(row.action,'EMAIL_ENVIO_NAO_CONFIRMADO');assert.equal(row.after.dispatchState,'UNCERTAIN');
});

test('referência de processo excluído pode ser recuperada do próprio registro histórico',()=>{
 const row:AuditLog={id:'created',processId:p.id,actorEmail:p.aluno1.email,actorRoles:['STUDENT'],action:'CRIACAO_PROCESSO',entityType:'processo',entityId:p.id,after:p,timestamp:p.createdAt};
 const [shown]=buildAuditFeed({logs:[row],deliveries:[],processes:[]});assert.equal(shown.processProtocol,p.protocolo);assert.equal(shown.processTitle,p.titulo);assert.equal(shown.actorName,p.aluno1.nome);
});

test('feed e prévia de mensagem pessoal não expõem código, link de decisão nem HTML original',()=>{
 const record=mail();record.renderedText='Aceitar: https://portal.test/api/reservation-confirmation/private-link-secret';record.renderedHtml='<a href="https://portal.test/api/reservation-confirmation/private-link-secret">Aceitar</a>';
 const log:AuditLog={id:'error',actorEmail:'Sistema',actorRoles:[],action:'FALHA',entityType:'email',entityId:'fixture',timestamp:record.createdAt,processTitle:record.renderedText,after:{secret:'never',token:'never',otpCode:'654321',renderedHtml:record.renderedHtml,errorMessage:record.renderedText}};
 const serialized=JSON.stringify(buildAuditFeed({logs:[log],deliveries:[record],processes:[]}));assert.doesNotMatch(serialized,/private-link-secret|https:\/\/portal\.test\/api\/reservation-confirmation|"secret"|"token"|renderedHtml|654321/);
 const preview=emailDeliveryPreview(record);assert.equal(preview.sensitive,true);assert.doesNotMatch(preview.text,/private-link-secret|https:\/\//);
 record.renderedText='Seu código de acesso é 123456.';record.renderedHtml=undefined;assert.equal(emailDeliveryPreview(record).sensitive,true);assert.doesNotMatch(emailDeliveryPreview(record).text,/123456/);
});

test('prévia operacional é o texto efetivamente registrado, preservando links públicos e a recusa',()=>{
 const record=mail();record.renderedText='Reserva recusada. Comprovante: https://portal.test/api/public/processes/TCC-2026-0001/reservation-receipt';
 assert.deepEqual(emailDeliveryPreview(record),{subject:record.subject,text:record.renderedText,sensitive:false});
});


test('exclusão pendente é acompanhada no log existente sem criar eventos, restaurar o TCC ou expor IDs externos',()=>{
 const deletion:import('./workflow/processDeletion').ProcessDeletionTask={id:'delete_fixture_123',processId:p.id,protocol:p.protocolo,rootFolderId:'private-root',fileIds:['private-document'],protectedIds:[],envelopes:['private-envelope'],jobIds:['private-job'],deleteFiles:true,clearHistory:true,status:'PENDING',errors:['Drive temporariamente indisponível.'],createdAt:'2026-11-07T12:00:00Z',attemptCount:2,lastAttemptAt:'2026-11-07T12:01:00Z',nextRetryAt:'2026-11-08T12:01:00Z'};
 const event:AuditLog={id:'log-'+deletion.id,processProtocol:p.protocolo,actorEmail:'master@example.invalid',actorRoles:['MASTER_ADMIN'],action:'EXCLUSAO_PROCESSO_TCC',entityType:'process_deletion',entityId:deletion.id,timestamp:deletion.createdAt,after:{deleteFiles:true,clearHistory:true}};
 const before=structuredClone({event,deletion});
 const rows=buildAuditFeed({logs:[event],deliveries:[],processes:[],deletionTasks:[deletion]});
 assert.equal(rows.length,1);assert.equal(rows[0].id,event.id);assert.equal(rows[0].timestamp,event.timestamp);
 assert.equal(rows[0].after.cleanupTaskId,deletion.id);assert.equal(rows[0].after.cleanupPending,true);
 assert.equal(rows[0].after.cleanupStatus,'Limpeza pendente nas plataformas externas');assert.equal(rows[0].after.attempts,2);
 assert.deepEqual(rows[0].after.errors,deletion.errors);assert.equal(rows[0].after.nextRetryAt,deletion.nextRetryAt);
 assert.doesNotMatch(JSON.stringify(rows),/private-root|private-document|private-envelope|private-job/);
 assert.deepEqual({event,deletion},before,'consultar o log não modifica fila, TCC ou evento');
 const completed=buildAuditFeed({logs:[{...event,after:{cleanupStatus:'Limpeza do Portal concluída'}}],deliveries:[],processes:[],deletionTasks:[]});
 const completedTask={...deletion,status:'COMPLETED' as const,errors:[],envelopes:[]};
 const [reconciled]=buildAuditFeed({logs:[event],deliveries:[],processes:[],deletionTasks:[completedTask]});
 assert.equal(reconciled.after.cleanupStatus,'Limpeza concluída');assert.equal(reconciled.after.cleanupPending,false);assert.equal(reconciled.after.attempts,2);
 assert.equal(completed[0].after.cleanupStatus,'Limpeza do Portal concluída');
 assert.equal(completed[0].after.cleanupTaskId,undefined);assert.equal(completed[0].after.cleanupPending,undefined);
});

test('lazy audit pages preserve full-projection filters, cursors, redaction and focused detail',()=>{
 const logs:AuditLog[]=Array.from({length:135},(_,index)=>({
  id:`paged-${String(index).padStart(3,'0')}`,actorEmail:p.aluno1.email,actorRoles:['STUDENT'],
  action:index===4?'EMAIL_CODIGO_ACESSO_ACEITO_GMAIL':'EDICAO_DADOS_PROCESSO',entityType:'processo',entityId:p.id,processId:p.id,
  timestamp:index<130?'2026-11-07T12:00:00Z':'2026-11-06T12:00:00Z',
  before:{titulo:'Título anterior',token:'must-not-leak'},after:{titulo:'Título atual',secret:'must-not-leak',details:'Texto operacional '.repeat(100)},
 }));
 const deliveries=Array.from({length:125},(_,index)=>({...mail(),id:`message-${index}`,updatedAt:'2026-11-07T12:00:00Z'}));
 const input={logs,deliveries,processes:[p]},before=structuredClone(input);
 for(const kind of ['all','activity','email'])for(const search of ['',p.protocolo.toLowerCase()]){
  const query={search,kind,start:'2026-11-06',end:'2026-11-07',focusId:logs.at(-1)!.id};
  const expected=pageAuditFeed(buildAuditFeed(input),query);
  const actual=buildPagedAuditFeed(input,query);
  assert.deepEqual(actual,expected);
  assert.doesNotMatch(JSON.stringify(actual),/must-not-leak/);
  const cursor=decodeAuditCursor(expected.nextCursor||'');
  if(cursor)assert.deepEqual(buildPagedAuditFeed(input,{...query,before:cursor}),pageAuditFeed(buildAuditFeed(input),{...query,before:cursor}));
 }
 assert.deepEqual(input,before,'viewing a page cannot alter source data or attempts');
});

test('normal navigation projects only its 100 records and one separately focused record',()=>{
 const deliveries=Array.from({length:5000},(_,index)=>({...mail(),id:`mail-${String(index).padStart(5,'0')}`,updatedAt:new Date(Date.parse('2026-11-07T12:00:00Z')-index).toISOString()}));
 let projected=0;
 const input={logs:[],deliveries,processes:[p],retryBlocker:()=>{projected++;return undefined;}};
 const query={search:'',kind:'all',start:'',end:'',focusId:''};
 const page=buildPagedAuditFeed(input,query);
 assert.equal(page.total,5000);assert.equal(page.items.length,100);assert.equal(projected,100);
 projected=0;
 const focused=buildPagedAuditFeed(input,{...query,focusId:'email-delivery:'+deliveries.at(-1)!.id});
 assert.equal(focused.focused?.emailDeliveryId,deliveries.at(-1)!.id);assert.equal(projected,101);
 projected=0;
 buildPagedAuditFeed(input,{...query,focusId:page.items[0].id});
 assert.equal(projected,100,'a focused record already in the page is projected only once');
});
