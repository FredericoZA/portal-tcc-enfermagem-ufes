import test from 'node:test';
import assert from 'node:assert/strict';
import {auditActionLabel,auditActor,auditReference,auditSearchText,auditChangesTable,auditStatusLabel,canRestoreAudit,canRetryEmailDelivery,emailAuditData,emailDeliveryStatusLabel,redactAuditText,type ReadableAuditLog} from '../src/utils/auditLogPresentation';

const log=(extra:Partial<ReadableAuditLog>={}):ReadableAuditLog=>({id:'audit-1',processId:'proc-internal-code',processProtocol:'TCC-2026-0006',processTitle:'Cuidado de Enfermagem',actorEmail:'aluna@example.invalid',actorName:'Gabriela de Exemplo',actorRoles:[],action:'CRIACAO_PROCESSO',entityType:'processo',entityId:'proc-internal-code',timestamp:'2026-11-04T15:41:00Z',...extra});

test('registros mostram o nome, a atividade e o protocolo em lugar do identificador interno',()=>{
 const item=log();assert.deepEqual(auditActor(item),{name:'Gabriela de Exemplo',email:'aluna@example.invalid'});
 assert.equal(auditActionLabel(item),'Cadastro do TCC concluído');
 assert.deepEqual(auditReference(item),{title:'TCC-2026-0006',detail:'Cuidado de Enfermagem'});
 assert.equal(auditReference(log({processProtocol:undefined,processTitle:undefined})).title,'Processo de TCC');
 assert.equal(auditReference(log({processProtocol:undefined,processTitle:undefined,after:{protocolo:'003 - Legado',titulo:'Histórico'}})).title,'003 - Legado');
 assert.equal(auditActor(log({actorName:undefined,actorEmail:'system@portal.local'})).name,'Sistema do Portal');
});

test('busca encontra a atividade em português, protocolo, participante e dados do e-mail',()=>{
 const item=log({source:'email',emailDeliveryId:'mail1',after:{status:'ACCEPTED_BY_GMAIL',recipient:'departamento@example.invalid',cc:['auditoria@example.invalid'],subject:'Comprovante da reserva'}});
 for(const term of ['gabriela','tcc-2026-0006','cuidado','aceito pelo gmail','departamento@example.invalid','auditoria@example.invalid','comprovante'])assert.ok(auditSearchText(item).includes(term),term);
});

test('aceite pelo Gmail não é apresentado como confirmação de entrega ou leitura',()=>{
 const item=log({source:'email',emailDeliveryId:'mail1',after:{status:'ACCEPTED_BY_GMAIL',recipient:'destino@example.invalid',cc:['auditoria@example.invalid'],subject:'Reserva',sender:'portal@example.invalid',acceptedAt:'2026-11-04T15:42:00Z',attempts:[{number:1,startedAt:'2026-11-04T15:41:00Z',completedAt:'2026-11-04T15:42:00Z',status:'ACCEPTED_BY_GMAIL'}]}});
 assert.equal(auditActionLabel(item),'E-mail: aceito pelo Gmail');const data=emailAuditData(item);
 assert.equal(data.sender,'portal@example.invalid');assert.equal(data.attemptCount,1);assert.equal(data.status,'Aceito pelo Gmail');
 assert.match(data.explanation,/não confirma.*caixa de entrada.*lida/);
 assert.equal(canRestoreAudit(item),false,'envio não oferece restauração de estado');
 assert.equal(auditStatusLabel('RETRY'),'Nova tentativa pendente');
 assert.equal(auditStatusLabel('FAILED'),'Falha no envio');
});

test('tabela de alterações usa rótulos compreensíveis, sem alunos numerados e sem segredos',()=>{
 const item=log({action:'EDICAO_DADOS_PROCESSO',before:{aluno1:{nome:'Nome anterior'},defesa:{local:'Sala A'},token:'private-before'},after:{aluno1:{nome:'Nome corrigido'},defesa:{local:'Sala B'},password:'private-after',artifactBase64:'private-file',dataRevision:2}});
 const table=auditChangesTable(item);assert.deepEqual(table,[{field:'Autor · Nome completo',before:'Nome anterior',after:'Nome corrigido'},{field:'Local da defesa',before:'Sala A',after:'Sala B'}]);
 assert.doesNotMatch(JSON.stringify(table),/private|aluno1|dataRevision/);
});

test('reserva, código de acesso e configurações têm atividades legíveis; e-mails nunca restauram',()=>{
 assert.equal(auditActionLabel(log({action:'SOLICITACAO_RESERVA_REGISTRADA'})),'Solicitação de reserva registrada');
 assert.equal(auditActionLabel(log({action:'CONFIRMACAO_LOCAL_ADMINISTRATIVA',after:{decision:'UNAVAILABLE'}})),'Reserva recusada');
 assert.equal(auditActionLabel(log({action:'CONFIRMACAO_LOCAL_ADMINISTRATIVA',after:{decision:'CONFIRMED'}})),'Reserva aceita');
 assert.equal(auditActionLabel(log({action:'EMAIL_CODIGO_ACESSO_SIMULADO'})),'Código de acesso: teste local sem envio');
 assert.equal(canRestoreAudit(log({action:'EMAIL_CODIGO_ACESSO_SIMULADO',after:{status:'SIMULATED'}})),false);
 assert.equal(canRestoreAudit(log({entityType:'settings',after:{portalName:'Portal'}})),true);
 assert.equal(canRestoreAudit(log({after:{id:'proc-internal-code',protocolo:'TCC-2026-0006'}})),true);
 assert.equal(canRestoreAudit(log({source:'email',after:{id:'proc-internal-code',protocolo:'TCC-2026-0006'}})),false);
 assert.equal(auditReference(log({processId:undefined,processProtocol:undefined,processTitle:undefined,entityType:'settings'})).title,'Configurações do Portal');
});

test('fila sem tentativa não é apresentada como reenvio nem como envio concluído',()=>{
 const item=log({source:'email',emailDeliveryId:'mail-queued',after:{status:'RETRY',attempts:[]}});
 assert.equal(auditActionLabel(item),'E-mail: aguardando envio');
 assert.equal(emailAuditData(item).status,'Aguardando envio');
 assert.match(emailAuditData(item).explanation,/Ainda não há tentativa/);
});

test('envio em processamento bloqueia reenvio e não aparece como pendente ainda não iniciado',()=>{
 const item=log({source:'email',emailDeliveryId:'mail-sending',after:{status:'RETRY',dispatchState:'SENDING',dispatchLeaseUntil:'2099-11-04T12:02:00Z',nextRetryAt:'2026-11-04T15:42:00Z',attempts:[]}});
 const data=emailAuditData(item);
 assert.equal(data.status,'Envio em processamento');assert.equal(data.canRetry,false);assert.equal(data.nextRetryAt,'');
 assert.equal(auditActionLabel(item),'E-mail: envio em processamento');assert.match(data.explanation,/Aguarde a conclusão/);
 assert.equal(canRetryEmailDelivery(item.after),false);assert.equal(emailDeliveryStatusLabel(item.after),data.status);
});

test('resultado incerto pede conferência no Gmail sem afirmar falha nem permitir reenvio',()=>{
 const item=log({source:'email',emailDeliveryId:'mail-uncertain',after:{status:'FAILED',dispatchState:'UNCERTAIN',acceptedAt:'2026-11-04T15:42:00Z',attempts:[{status:'FAILED',errorCode:'GMAIL_DELIVERY_UNCERTAIN',errorMessage:'O retorno do Gmail não foi confirmado.'}]}});
 const data=emailAuditData(item);
 assert.equal(data.status,'Resultado do envio não confirmado; conferir no Gmail');assert.equal(data.canRetry,false);assert.equal(data.acceptedAt,'');
 assert.equal(data.attempts[0].status,data.status);assert.match(data.explanation,/Confira a caixa Enviados do Gmail/);
 assert.doesNotMatch(auditActionLabel(item),/falhou|falha|aceito|entregue/i);
 assert.ok(auditSearchText(item).includes('resultado do envio não confirmado'));
});

test('envio sem retorno com prazo esgotado é incerto e não oferece nova tentativa',()=>{
 for(const dispatchLeaseUntil of ['2000-01-01T00:00:00Z','inválido',undefined]){
  const item=log({source:'email',emailDeliveryId:'mail-expired',after:{status:'RETRY',dispatchState:'SENDING',dispatchLeaseUntil,attempts:[]}});
  const data=emailAuditData(item);
  assert.equal(data.status,'Resultado do envio não confirmado; conferir no Gmail');assert.equal(data.canRetry,false);
  assert.match(data.explanation,/Confira a caixa Enviados do Gmail/);assert.doesNotMatch(auditActionLabel(item),/processamento/);
 }
});

test('nova tentativa pendente não promete reenvio automático em horário determinado',()=>{
 const item=log({source:'email',emailDeliveryId:'mail-retry',after:{status:'RETRY',nextRetryAt:'2026-11-04T15:42:00Z',attempts:[{status:'RETRY'}]}});
 const data=emailAuditData(item);
 assert.equal(data.status,'Nova tentativa pendente');assert.equal(data.canRetry,true);assert.ok(data.nextRetryAt);
 assert.match(data.explanation,/pendente/);assert.doesNotMatch(data.explanation,/tentará novamente|programad|no horário indicado/i);
 assert.equal(canRetryEmailDelivery({status:'ACCEPTED_BY_GMAIL'}),false);
 assert.equal(canRetryEmailDelivery({status:'FAILED'}),true);
});

test('falha ao solicitar código não afirma tentativa de envio nem autoria anônima',()=>{
 const item=log({action:'EMAIL_CODIGO_ACESSO_FALHOU',actorEmail:'Sistema',actorName:undefined,after:{status:'REQUEST_FAILED',provider:'Não confirmado',auditCopyMode:'sensitive'}});
 assert.equal(auditActionLabel(item),'Solicitação de código não concluída');
 assert.equal(emailAuditData(item).status,'Solicitação de código não concluída');
 assert.equal(emailAuditData(item).requestedBy,'Não identificada no registro');
 assert.equal(emailAuditData(item).provider,'Não confirmado');
 assert.match(emailAuditData(item).explanation,/não confirma.*tentativa de envio/);
});

test('links pessoais e credenciais não aparecem na leitura do histórico',()=>{
 const text=redactAuditText('Acesse https://portal.example/api/reservation-confirmation/private-token?decision=accept e https://asten.example/assinatura/secret e data:image/png;base64,abc123');
 assert.doesNotMatch(text,/private-token|\/secret|abc123/);assert.match(text,/omitido na auditoria/);
});
