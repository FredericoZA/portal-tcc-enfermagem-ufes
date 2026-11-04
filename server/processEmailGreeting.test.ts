import test from 'node:test';
import assert from 'node:assert/strict';
import {applyProcessEmailGreeting} from '../src/utils/processEmailGreeting';
import {processEmailMessage,withoutGenericProcessFooter} from '../src/utils/processEmailMessage';
import {reservationRequestEmail} from '../src/utils/reservationRequestEmail';
import {DEMO_PROCESSES} from '../src/services/demoSeed';
test('saudação indica o papel e preserva os nomes nos dados do trabalho',()=>{
 for(const [id,event,department,greeting] of [
  ['email-reserva','TCC_CREATED',true,'Prezado Departamento,'],['email-reserva','TCC_CREATED',false,'Prezados autores e orientador,'],['email-convite','INVITATION_SENT',false,'Prezados,'],['email-assinatura-declaracao','PUBLICATION_CLEARED',false,'Prezada Presidência,'],['email-entrega-repositorio','SIGNATURE_COMPLETED',false,'Prezados autores,'],['email-assinatura-ata','EVALUATION_SUBMITTED',false,'Prezado orientador,'],['email-conclusao','PROCESS_COMPLETED',false,'Prezados participantes do TCC,']
 ] as const){
  const text=applyProcessEmailGreeting('Prezado(a) Maria Silva,\n\nOrientador: Maria Silva',id,event,department);assert.equal(text.split('\n')[0],greeting);assert.ok(text.endsWith('Orientador: Maria Silva'));assert.equal(applyProcessEmailGreeting(text,id,event,department),text);
 }
});
test('cópia para autores explica a alternativa conforme o formulário e orienta acompanhamento uma única vez',()=>{
 const p=structuredClone(DEMO_PROCESSES[0]);p.defesa.local='Auditório';p.defesa.alternateLocation='Sala de reuniões do Departamento de Enfermagem';
 const input={process:p,baseUrl:'https://portal.example',courseName:'Enfermagem'};
 const department=reservationRequestEmail(input),participants=processEmailMessage({...input,recipient:p.aluno1.email,subject:'Reserva',text:'',templateId:'email-reserva',eventCode:'TCC_CREATED'});
 assert.doesNotMatch(department.text,/alternativa/);assert.doesNotMatch(participants.text,/alternativa|Acompanhe as etapas/);assert.match(participants.text,/confirmação do departamento/);
 assert.match(participants.text,/registrará o aceite ou a recusa\. Acompanhem o resultado pelo processo e pelos avisos por e-mail\./);assert.equal((participants.text.match(/Acompanhem/g)||[]).length,1);assert.equal((participants.html.match(/<a /g)||[]).length,1);
 p.defesa.alternateLocation='';assert.doesNotMatch(reservationRequestEmail({...input,process:p,audience:'participant'}).text,/Observação:|opção alternativa/);
});
test('rodapé genérico repetido é removido sem alterar orientações específicas',()=>{
 const note='Acompanhe as etapas e os documentos no processo do TCC, pelo Portal.';
 assert.equal(withoutGenericProcessFooter('Confira a ata.\n\n'+note+'\n\n'+note+'\n\nAtenciosamente,'),'Confira a ata.\n\nAtenciosamente,');
});
test('confirmação identifica autores e comprovante do departamento registra as duas respostas',()=>{
 const process=structuredClone(DEMO_PROCESSES[0]);
 const common={process,recipient:'departamento@example.invalid',subject:'Reserva confirmada',text:'Corpo antigo',templateId:'email-comprovante-reserva',baseUrl:'https://portal.example',courseName:'Enfermagem',departmentUrl:'https://portal.example/receipt'};
 for(const decision of ['CONFIRMED','UNAVAILABLE'] as const){
  process.defesa.departmentResponse={revision:1,decision,respondedAt:'2026-10-26',respondedBy:common.recipient,startAt:process.defesa.startAt,endAt:process.defesa.endAt,local:process.defesa.local};
  const result=processEmailMessage(common);assert.match(result.subject,decision==='CONFIRMED'?/Reserva confirmada/:/Agendamento recusado/);assert.match(result.text,/Resposta registrada em [a-zçáéíóú-]+, \d{2}\/\d{2}\/\d{4}/);assert.match(result.text,decision==='CONFIRMED'?/Resultado: reserva confirmada/:/Resultado: reserva recusada/);if(decision==='CONFIRMED')assert.match(result.text,/Avaliação e ata/);assert.equal((result.html.match(/<a /g)||[]).length,1);
 }
 process.defesa.departmentResponse!.decision='CONFIRMED';
 const authors=processEmailMessage({...common,recipient:process.aluno1.email,departmentUrl:undefined});assert.match(authors.text,/^Prezados departamento, autores e orientador,/);assert.match(authors.text,/Autores: confiram/);assert.doesNotMatch(authors.text,/Participantes:/);
});
test('ata tem métodos em lista menor e termo exige um PDF conjunto, com observação da entrega sem negrito',()=>{
 const process=structuredClone(DEMO_PROCESSES[0]),common={process,recipient:process.orientador.email,subject:'Documento',text:'Prezado participante,\n\nDocumento disponível.',baseUrl:'https://portal.example',courseName:'Enfermagem'};
 const ata=processEmailMessage({...common,templateId:'email-assinatura-ata',eventCode:'EVALUATION_SUBMITTED'});assert.match(ata.text,/^Prezado orientador,/);assert.match(ata.text,/Somente o orientador/);assert.doesNotMatch(ata.text,/assinaturas dos autores|Autores e orientador:/);assert.match(ata.html,/<ul style="[^"]*font-size:13px/);assert.equal((ata.html.match(/<li /g)||[]).length,2);
 const term=processEmailMessage({...common,templateId:'email-assinatura-termo',eventCode:'REPOSITORY_SUBMITTED'});assert.match(term.text,/Todos assinam no mesmo nível/);assert.match(term.text,/único arquivo completo/);assert.match(term.text,/botão Asten em Documentos administrativos/);assert.match(term.text,/receberão o link por e-mail/);
 const delivery=processEmailMessage({...common,templateId:'email-entrega-repositorio',eventCode:'SIGNATURE_COMPLETED'});assert.match(delivery.text,/^Prezados autores,/);assert.match(delivery.text,/o Termo ficará disponível/);assert.match(delivery.html,/Observação: a entrega pode ser feita por qualquer um dos autores\./);assert.doesNotMatch(delivery.html,/<strong>Observação/);
});
test('convite mantém orientação e coorientação no mesmo bloco e não inventa coorientação',()=>{
 const process=structuredClone(DEMO_PROCESSES[0]);process.banca=[{id:'guest1',nome:'Beatriz Santos',email:'guest1@example.invalid',funcao:'EXAMINER_2'},{id:'guest2',nome:'Rafael Lima',email:'guest2@example.invalid',funcao:'EXAMINER_3'}];process.coorientador={...process.orientador,nome:'Ana Souza',email:'ana@example.invalid'};
 const common={process,recipient:'guest1@example.invalid',subject:'Convite',text:'',templateId:'email-convite',eventCode:'INVITATION_SENT',baseUrl:'https://portal.example',courseName:'Enfermagem'};
 const invitation=processEmailMessage(common);assert.match(invitation.text,/Local: [^\n]+\nOrientador: [^\n]+\nCoorientador: [^\n]+\n\nAvaliadores da banca:/);process.coorientador=null;assert.doesNotMatch(processEmailMessage(common).text,/Coorientador:/);
});
test('modelo salvo de entrega usa orientador, preserva instruções e retira alternativa de versão sem correções',()=>{
 const process=structuredClone(DEMO_PROCESSES[0]);
 const rendered=processEmailMessage({process,recipient:process.aluno1.email,subject:'Entrega final',text:'Prezados autores e orientação,\n\nConcluam os ajustes solicitados pela orientação e pela banca, se houver, e enviem o trabalho revisado pelo Portal. Se não houver alterações, enviem a versão apresentada na defesa.',templateId:'email-entrega-repositorio',eventCode:'SIGNATURE_COMPLETED',baseUrl:'https://portal.example',courseName:'Enfermagem'});
 assert.match(rendered.text,/ajustes solicitados pelo orientador e pela banca/);assert.doesNotMatch(rendered.text,/versão apresentada|Se não houver alterações|pela orientação|Orientação:/);assert.match(rendered.text,/ORIENTAÇÕES DO PROCESSO/);assert.match(rendered.html,/<strong>Orientador:<\/strong>/);
});
