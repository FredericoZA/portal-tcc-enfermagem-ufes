import test from 'node:test';
import assert from 'node:assert/strict';
import {buildAuditFeed,emailDeliveryPreview} from './auditFeed';
import {initialEmailDelivery} from './integrations/trackedGmail';
import {DEMO_PROCESSES} from '../src/services/demoSeed';
import type {AuditLog} from '../src/types';
const p=DEMO_PROCESSES[0];
const mail=()=>initialEmailDelivery({recipient:'recipient@example.invalid',cc:['audit@example.invalid'],processId:p.id,protocol:p.protocolo,requestedBy:p.aluno1.email,subject:'Reserva do TCC',text:'Pedido de reserva registrado.',idempotencyKey:'fixture-audit'},new Date('2026-11-04T12:00:00Z'));

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

test('referência de processo excluído pode ser recuperada do próprio registro histórico',()=>{
 const row:AuditLog={id:'created',processId:p.id,actorEmail:p.aluno1.email,actorRoles:['STUDENT'],action:'CRIACAO_PROCESSO',entityType:'processo',entityId:p.id,after:p,timestamp:p.createdAt};
 const [shown]=buildAuditFeed({logs:[row],deliveries:[],processes:[]});assert.equal(shown.processProtocol,p.protocolo);assert.equal(shown.processTitle,p.titulo);assert.equal(shown.actorName,p.aluno1.nome);
});

test('feed e prévia de mensagem pessoal não expõem código, link de decisão nem HTML original',()=>{
 const record=mail();record.renderedText='Aceitar: https://portal.test/api/reservation-confirmation/private-link-secret';record.renderedHtml='<a href="https://portal.test/api/reservation-confirmation/private-link-secret">Aceitar</a>';
 const log:AuditLog={id:'error',actorEmail:'Sistema',actorRoles:[],action:'FALHA',entityType:'email',entityId:'fixture',timestamp:record.createdAt,after:{secret:'never',token:'never',renderedHtml:record.renderedHtml,errorMessage:record.renderedText}};
 const serialized=JSON.stringify(buildAuditFeed({logs:[log],deliveries:[record],processes:[]}));assert.doesNotMatch(serialized,/private-link-secret|https:\/\/portal\.test\/api\/reservation-confirmation|"secret"|"token"|renderedHtml/);
 const preview=emailDeliveryPreview(record);assert.equal(preview.sensitive,true);assert.doesNotMatch(preview.text,/private-link-secret|https:\/\//);
 record.renderedText='Seu código de acesso é 123456.';record.renderedHtml=undefined;assert.equal(emailDeliveryPreview(record).sensitive,true);assert.doesNotMatch(emailDeliveryPreview(record).text,/123456/);
});

test('prévia operacional é o texto efetivamente registrado, preservando links públicos e a recusa',()=>{
 const record=mail();record.renderedText='Reserva recusada. Comprovante: https://portal.test/api/public/processes/TCC-2026-0001/reservation-receipt';
 assert.deepEqual(emailDeliveryPreview(record),{subject:record.subject,text:record.renderedText,sensitive:false});
});
