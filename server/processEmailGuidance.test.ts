import test from 'node:test';
import assert from 'node:assert/strict';
import {processEmailGuidance,withProcessEmailGuidance,PROCESS_EMAIL_GUIDANCE_TITLE} from '../src/utils/processEmailGuidance';
import {upgradeOperationalEmailTemplate} from '../src/utils/operationalEmails';
const process={id:'proc-123',protocolo:'TCC-2026-0042',etapaAtual:'CADASTRO' as const};
const base='https://portal.example/?tcc=outro&secao=geral';
test('cadastro orienta espera pela confirmação direta do departamento, sem upload ou link repetido',()=>{
 const text=processEmailGuidance(process,base,'TCC_CREATED');
 assert.match(text,/aguardem a resposta do departamento/);assert.doesNotMatch(text,/Não é necessário anexar/);assert.doesNotMatch(text,/https?:|E-mail de acesso:|Clique em Entrar|Confirmei o recebimento/);
});
test('convite, assinatura e entrega mantêm instruções curtas próprias da etapa',()=>{
 const invitation=processEmailGuidance(process,base,'INVITATION_SENT');assert.match(invitation,/carta-convite/);assert.match(invitation,/Avaliadores e coorientador: usem o botão/);assert.doesNotMatch(invitation,/Orientador:|Participantes:|Avaliação e ata/);
 const signature=processEmailGuidance(process,base,'SIGNATURE_REQUESTED');assert.match(signature,/Asten/);assert.match(signature,/Gov.br/);assert.doesNotMatch(signature,/Repositório|https?:/);
 const ata=processEmailGuidance(process,base,'EVALUATION_SUBMITTED');assert.match(ata,/Orientador: confira a ata/);assert.match(ata,/Autores: após a assinatura do orientador, aguardem/);
 const next=processEmailGuidance({...process,etapaAtual:'REPOSITORIO'},base,'SIGNATURE_COMPLETED');assert.match(next,/ata assinada foi arquivada/);assert.match(next,/Repositório/);
});
test('texto e HTML recebem orientações uma vez e escapam conteúdo',()=>{
 const guidance=processEmailGuidance(process,base,'TCC_CREATED')+'\n\n<script>alert(1)</script>';
 const once=withProcessEmailGuidance({text:'Corpo original',html:'<p>Corpo original</p>'},guidance);
 assert.equal(once.text.split(PROCESS_EMAIL_GUIDANCE_TITLE).length,2);assert.match(once.html!,/&lt;script&gt;/);assert.doesNotMatch(once.html!,/<script>/);assert.deepEqual(withProcessEmailGuidance(once,guidance),once);
});
test('departamento recebe confirmação por formulário e não instrução para responder ou anexar PDF',()=>{
 const text=processEmailGuidance(process,base,'TCC_CREATED','email-reserva');
 assert.match(text,/Responsável pelo local: aceite ou recuse/);assert.match(text,/agendamento apresentado/);assert.doesNotMatch(text,/Não é necessário anexar/);assert.doesNotMatch(text,/https?:|responda a este e-mail|anexem.*PDF/);
});
test('agendamento confirmado orienta a avaliação e a assinatura pelo orientador no dia da defesa',()=>{
 const text=processEmailGuidance(process,base,'LOCATION_CONFIRMED','email-confirmacao');assert.match(text,/confiram a data, o horário e o local em Dados do processo/);assert.doesNotMatch(text,/confirmados|confirmem/);assert.match(text,/no dia da defesa.*Avaliação e ata.*assinatura/);
});
test('modelos personalizados e HTML que já possui corpo recebem a variável de orientações sem duplicação',()=>{
 const original={id:'personalizado',body:'Texto mantido',htmlBody:'<p>Texto mantido</p>',recipient:'pessoa@example.org',attachments:['doc']};
 const result=upgradeOperationalEmailTemplate(original);
 assert.ok(result.body.includes('<<ORIENTACOES_ACESSO>>'));assert.ok(result.htmlBody.includes('<<ORIENTACOES_ACESSO>>'));
 assert.deepEqual(upgradeOperationalEmailTemplate(result),result);assert.equal(original.body,'Texto mantido');assert.deepEqual(result.attachments,[]);
});
test('old reservation sentence is upgraded without changing a custom paragraph',()=>{
 const old={id:'email-reserva',body:'Texto personalizado.\nPor favor, confirmem o agendamento ao aluno: <<ALUNO_1_EMAIL>>.',htmlBody:'<p>Texto personalizado.</p><p>Por favor, confirmem o agendamento ao aluno: <<ALUNO_1_EMAIL>>.</p>'};
 const upgraded=upgradeOperationalEmailTemplate(old);
 assert.match(upgraded.body,/Texto personalizado/);assert.match(upgraded.body,/respondam a este e-mail/);assert.doesNotMatch(upgraded.body,/confirmem o agendamento ao aluno/);assert.deepEqual(upgradeOperationalEmailTemplate(upgraded),upgraded);
});
