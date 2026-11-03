import test from 'node:test';
import assert from 'node:assert/strict';
import {presentProcessEmailLinks} from '../src/utils/processEmailLinks';
import {withProcessEmailButton} from './workflow/processEmailButton';
import {processEmailGuidance,withProcessEmailGuidance} from '../src/utils/processEmailGuidance';
const process={id:'proc-42',protocolo:'TCC-2026-0042',etapaAtual:'CADASTRO' as const};
const base='https://portal.example/';
const visible=(html:string)=>html.replace(/<[^>]*>/g,'');
test('process URLs become code-only links and retain exact destinations in every tab',()=>{
 for(const section of ['geral','docs','acervo','avaliacao']){
  const url=`${base}?tcc=${process.id}&secao=${section}`;
  const result=presentProcessEmailLinks(`<p>Acesso ao TCC ${process.protocolo}: ${url}</p><p>${url}, continue.</p>`,{baseUrl:base,processId:process.id,protocol:process.protocolo});
  assert.doesNotMatch(visible(result),/https?:\/\//);assert.match(result,/<\/a>, continue/);assert.doesNotMatch(result,/secao=[a-z]+,/);assert.match(result,new RegExp(`href="https://portal.example/\\?tcc=proc-42&amp;secao=${section}"`));assert.match(result,/>TCC-2026-0042<\/a>/);assert.doesNotMatch(visible(result),/Acesso ao TCC/);assert.equal(presentProcessEmailLinks(result,{baseUrl:base,processId:process.id,protocol:process.protocolo}),result);
 }
});
test('existing buttons and autolinks use the code while unrelated links and attributes remain intact',()=>{
 const href='https://portal.example/?tcc=proc-42&amp;secao=docs';
 const source=`<a href="${href}" style="background:#005b3b">Acessar documentos</a><a href="${href}">${href}</a><a href="https://other.example/">https://other.example/</a><img src="https://portal.example/image.png" alt="x > y">`;
 const result=presentProcessEmailLinks(source,{baseUrl:base,processId:process.id,protocol:process.protocolo});
 assert.equal((result.match(/>TCC-2026-0042<\/a>/g)||[]).length,2);assert.match(result,/<a href="https:\/\/other.example\/">https:\/\/other.example\/</);assert.match(result,/<img src="https:\/\/portal.example\/image.png" alt="x > y">/);
});
test('HTML emails hide raw process URLs in instructions and CTA without duplicate CTA on reprocessing',()=>{
 for(const [event,template] of [['TCC_CREATED','email-reserva'],['INVITATION_SENT','email-convite'],['SIGNATURE_COMPLETED','email-entrega-repositorio'],['PROCESS_COMPLETED','email-conclusao']]){
  const guidance=processEmailGuidance(process,base,event,template);
  const message=withProcessEmailGuidance({text:'Mensagem',html:'<p>Mensagem</p>'},guidance);
  const input={process,baseUrl:base,eventCode:event,templateId:template,...message};
  const html=withProcessEmailButton(input);
  assert.doesNotMatch(visible(html),/https:\/\/portal.example/);assert.match(html,/>TCC-2026-0042<\/a>/);assert.match(html,/background:#005b3b/);assert.equal(withProcessEmailButton({...input,html}),html);
  assert.doesNotMatch(message.text,/https?:\/\//,'guidance delegates the sole destination to the envelope');
 }
});
test('code labels are escaped and non-http base URLs are rejected',()=>{
 const html=presentProcessEmailLinks('<p>https://portal.example/?tcc=proc-42&secao=docs</p>',{baseUrl:base,processId:process.id,protocol:'<img src=x onerror=alert(1)>'});assert.doesNotMatch(html,/<img/);assert.match(html,/&lt;img/);
 assert.throws(()=>presentProcessEmailLinks('x',{baseUrl:'javascript:alert(1)',processId:'x',protocol:'x'}));
});
