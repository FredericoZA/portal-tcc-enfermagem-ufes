import {buildProcessVariables} from './workflow/runtime';
import {DEMO_PROCESSES} from '../src/services/demoSeed';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {normalizeRegistrationValue} from '../src/utils/registrationNormalization';
import {formatDateNumeric,formatTime24h} from '../src/utils/formatters';
import {reservationCopies} from './workflow/reservationEmail';
import {buildGmailRawMessage} from './integrations/googleWorkspace';
import {dispatchTrackedEmail,MemoryEmailDeliveryJournal} from './integrations/trackedGmail';

test('cadastro normaliza espaços, nomes e e-mails antes da validação, preservando acentos e siglas',()=>{
 assert.equal(normalizeRegistrationValue('EXAMINADOR_2_NOME','text','  JOÃO   DA SILVA  '),'João da Silva');
 assert.equal(normalizeRegistrationValue('ALUNO_1_EMAIL','email','  ALUNO@EDU.UFES.BR '),'aluno@edu.ufes.br');
 assert.equal(normalizeRegistrationValue('ORIENTADOR_INSTITUICAO','text',' UNIVERSIDADE FEDERAL DO ESPÍRITO SANTO - UFES '),'Universidade Federal do Espírito Santo - UFES');
 assert.equal(normalizeRegistrationValue('ALUNO_1_MATRICULA','text','00001234'),'00001234');
});
test('e-mail usa data brasileira e horário de Brasília inclusive quando o UTC muda o dia',()=>{
 assert.equal(formatDateNumeric('2026-10-23T23:00:00.000Z'),'23/10/2026');
 assert.equal(formatTime24h('2026-10-23T23:00:00.000Z'),'20:00');
 assert.equal(formatDateNumeric('2026-10-24T01:00:00.000Z'),'23/10/2026');
 assert.equal(formatTime24h('2026-10-24T01:00:00.000Z'),'22:00');
 const process=structuredClone(DEMO_PROCESSES[0]);process.defesa.startAt='2026-10-23T23:00:00.000Z';
 const variables=buildProcessVariables({process,eventCode:'TCC_CREATED',actorEmail:process.aluno1.email,actorRoles:[],extraVariables:{DEFESA_DATA_HORA:process.defesa.startAt}});
 assert.equal(variables.DEFESA_DATA_HORA,'23/10/2026 às 20:00');
});
test('reserva copia somente autores e orientador, sem duplicar destinatário nem permitir header injection',()=>{
 const p={aluno1:{email:'aluno@edu.ufes.br'},aluno2:{email:'outro@edu.ufes.br'},orientador:{email:'prof@ufes.br'}};
 assert.deepEqual(reservationCopies(p,'dept@ufes.br'),['aluno@edu.ufes.br','outro@edu.ufes.br','prof@ufes.br']);
 const raw=buildGmailRawMessage({to:'dept@ufes.br',cc:reservationCopies(p,'dept@ufes.br'),subject:'Reserva',text:'Teste'});
 assert.match(raw,/Cc: aluno@edu.ufes.br, outro@edu.ufes.br, prof@ufes.br/);
 assert.throws(()=>buildGmailRawMessage({to:'dept@ufes.br',cc:['prof@ufes.br\r\nBcc:x@ufes.br'],subject:'x',text:'x'}));
});
test('cópias persistem no journal e não são reenviadas após aceite do Gmail',async()=>{
 const journal=new MemoryEmailDeliveryJournal();let sent=0;
 const ports={journal,send:async(input:any)=>{assert.deepEqual(input.cc,['prof@ufes.br']);sent++;return {id:'gmail-id'};}};
 const input={recipient:'dept@ufes.br',cc:['prof@ufes.br'],subject:'Reserva',text:'Teste',idempotencyKey:'reserva-copy'};
 const first=await dispatchTrackedEmail(input,ports);assert.deepEqual(first.cc,['prof@ufes.br']);
 await dispatchTrackedEmail(input,ports);assert.equal(sent,1);
});
