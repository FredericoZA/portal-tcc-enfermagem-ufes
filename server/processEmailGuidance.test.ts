import test from 'node:test';
import assert from 'node:assert/strict';
import {processEmailGuidance,withProcessEmailGuidance,PROCESS_EMAIL_GUIDANCE_TITLE} from '../src/utils/processEmailGuidance';
import {upgradeOperationalEmailTemplate} from '../src/utils/operationalEmails';
const process={id:'proc-123',protocolo:'TCC-2026-0042',etapaAtual:'CADASTRO' as const};
const base='https://portal.example/?tcc=outro&secao=geral';
test('cadastro orienta departamento, autores e orientação com link específico autenticado',()=>{
 const text=processEmailGuidance(process,base,'TCC_CREATED');
 for(const expected of ['Departamento:','Autores:','Orientação:','Banca:','código recebido','1. Departamento','Confirmar local e enviar convite'])assert.ok(text.includes(expected),expected);
 const links=text.match(/https:\/\/[^\s)]+/g)||[];
 assert.ok(links.length>=3);
 for(const raw of links){const url=new URL(raw);assert.equal(url.searchParams.get('tcc'),process.id);assert.equal(url.searchParams.has('token'),false);}
});
test('convite, assinatura e conclusão apresentam as ações e abas próprias',()=>{
 const invitation=processEmailGuidance(process,base,'INVITATION_SENT');
 assert.ok(invitation.includes('secao=avaliacao'));assert.ok(invitation.includes('Após a apresentação'));assert.ok(invitation.includes('secao=docs'));
 const signatures=processEmailGuidance(process,base,'SIGNATURE_REQUESTED');
 assert.ok(signatures.includes('secao=acervo'));assert.ok(signatures.includes('Asten'));assert.ok(signatures.includes('Gov.br'));assert.ok(signatures.includes('carta-convite não exige assinatura'));
 const completed=processEmailGuidance(process,base,'PROCESS_COMPLETED');assert.ok(completed.includes('Não é necessário repetir etapas concluídas'));
});
test('texto e HTML recebem orientações uma vez, com links e conteúdo escapado',()=>{
 const guidance=processEmailGuidance(process,base,'TCC_CREATED')+'\n\n<script>alert(1)</script>';
 const once=withProcessEmailGuidance({text:'Corpo original',html:'<p>Corpo original</p>'},guidance);
 assert.equal(once.text.split(PROCESS_EMAIL_GUIDANCE_TITLE).length,2);
 assert.ok(once.html?.includes('<a href="https://portal.example/'));
 assert.ok(once.html?.includes('&lt;script&gt;'));assert.ok(!once.html?.includes('<script>'));
 assert.deepEqual(withProcessEmailGuidance(once,guidance),once);
});
test('modelos personalizados e HTML que já possui corpo recebem a variável de orientações sem duplicação',()=>{
 const original={id:'personalizado',body:'Texto mantido',htmlBody:'<p>Texto mantido</p>',recipient:'pessoa@example.org',attachments:['doc']};
 const result=upgradeOperationalEmailTemplate(original);
 assert.ok(result.body.includes('<<ORIENTACOES_ACESSO>>'));assert.ok(result.htmlBody.includes('<<ORIENTACOES_ACESSO>>'));
 assert.deepEqual(upgradeOperationalEmailTemplate(result),result);assert.equal(original.body,'Texto mantido');assert.deepEqual(result.attachments,[]);
});
test('convite e conclusão identificam o e-mail e abrem diretamente os documentos sem anexos',()=>{
 for(const event of ['INVITATION_SENT','PROCESS_COMPLETED','SIGNATURE_COMPLETED']){
  const text=processEmailGuidance(process,base,event,'','participante@example.org');
  assert.match(text,/E-mail de acesso: participante@example.org/);
  assert.match(text.split('\n')[2],/secao=docs/);
  assert.match(text,/não leva PDFs anexados/);
 }
});
