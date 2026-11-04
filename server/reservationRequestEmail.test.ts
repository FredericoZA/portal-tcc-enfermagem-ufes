import test from 'node:test';
import assert from 'node:assert/strict';
import {reservationRequestEmail} from '../src/utils/reservationRequestEmail';
import {DEMO_PROCESSES} from '../src/services/demoSeed';
const fixture=()=>{const p=structuredClone(DEMO_PROCESSES[0]);p.orientador={...p.orientador,tratamento:'Professora',titulacao:'Doutora'};p.defesa.startAt='2026-10-30T14:00:00-03:00';p.defesa.local='Auditório do Departamento de Enfermagem';p.defesa.alternateLocation='Sala de reuniões do Departamento de Enfermagem';return p;};
test('pedido usa um único local e pede aceite ou recusa sem alternativa',()=>{
 const p=fixture(),message=reservationRequestEmail({process:p,baseUrl:'https://portal.example/',courseName:'Curso de Enfermagem'});
 assert.ok(message.text.startsWith('Prezado Departamento,'));assert.match(message.text,/reserva do auditório/);assert.match(message.text,/Horário: 14:00 às 15:30/);
 assert.match(message.text,/Data: sexta-feira, 30\/10\/2026/);
 assert.match(message.text,/Local: Auditório/);assert.match(message.text,/Orientador: Prof/);
 assert.doesNotMatch(message.text,/alternativa|Observação:/);
 assert.doesNotMatch(message.text,/Sala de reuniões/);
 assert.match(message.text,/aceite ou recuse/);
 assert.match(message.text,/avisará os envolvidos/);assert.doesNotMatch(message.text,/Não é necessário anexar/);
 assert.doesNotMatch(message.text,/preferido|preferencial|recebem.*cópia|E-mail de acesso|código recebido|1 MB/);
 const guidance=message.text.split('ORIENTAÇÕES DO PROCESSO')[1];assert.doesNotMatch(guidance,/responda.*e-mail|anexem.*PDF/);
 assert.equal((message.html.match(/<a\b/g)||[]).length,1);assert.ok(message.html.indexOf('<a ')<message.html.indexOf('<h2'));assert.match(message.html,/margin:24px 0;text-align:center/);assert.ok(message.html.includes(`tcc=${p.id}&amp;secao=geral`));
 assert.ok(message.text.includes(p.aluno1.nome));if(p.aluno2)assert.ok(message.text.includes(p.aluno2.nome));
});
test('sala selecionada aparece no pedido e a alternativa não é inventada quando ausente',()=>{
 const p=fixture();p.defesa.local='Sala de reuniões';p.defesa.alternateLocation='';
 const message=reservationRequestEmail({process:p,baseUrl:'https://portal.example/',courseName:'Curso'});
 assert.match(message.text,/reserva da sala de reuniões/);assert.doesNotMatch(message.text,/Observação:|auditório/);
});
test('conteúdo preenchido fica escapado no HTML',()=>{
 const p=fixture();p.titulo='<script>não executar</script>';
 const message=reservationRequestEmail({process:p,baseUrl:'https://portal.example/',courseName:'Curso'});
 assert.ok(message.html.includes('&lt;script&gt;'));assert.ok(!message.html.includes('<script>'));
});
