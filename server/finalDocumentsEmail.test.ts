import test from 'node:test';
import assert from 'node:assert/strict';
import {finalDocumentsEmail,isFinalDocumentsEmail} from '../src/utils/finalDocumentsEmail';
const process={id:'proc-42',protocolo:'TCC-2026-0001',titulo:'Segurança do paciente',aluno1:{nome:'Aluno Um',email:'autor@example.invalid'},aluno2:{nome:'Aluno Dois',email:'autor2@example.invalid'},orientador:{nome:'Orientador',email:'orientador@example.invalid'},banca:[{nome:'Beatriz Oliveira Santos',email:'banca@example.invalid'}]} as any;
const input={process,recipient:'banca@example.invalid',baseUrl:'https://portal.example/',courseName:'Enfermagem e Obstetrícia · CCS/UFES'};
test('final documents message has one CTA and one plain-text URL, with the same final information for all participants',()=>{
 const result=finalDocumentsEmail(input);
 assert.equal((result.html.match(/<a\s/g)||[]).length,1);
 assert.equal((result.text.match(/https?:\/\//g)||[]).length,1);
 assert.match(result.html,/href="https:\/\/portal.example\/\?tcc=proc-42&amp;secao=docs"/);
 assert.doesNotMatch(result.html.replace(/<[^>]+>/g,''),/https?:\/\//);
 assert.ok(result.text.startsWith('Prezados participantes do TCC,'));
 assert.doesNotMatch(result.text,/Autores:|Orientador:|ORIENTAÇÕES DO PROCESSO|próxima pendência|dado incorreto/);
 assert.match(result.text,/aba Repositório/);assert.match(result.text,/assinaturas do TCC foram concluídas/);assert.match(finalDocumentsEmail({...input,recipient:'autor2@example.invalid'}).text,/aba Repositório/);
});
test('message escapes process and recipient data and rejects unsafe base URLs',()=>{
 const result=finalDocumentsEmail({...input,process:{...process,titulo:'<script>bad</script>'},recipient:'<img>@example.invalid',color:'red;bad'});
 assert.doesNotMatch(result.html,/<script>|<img>/);
 assert.match(result.html,/&lt;script&gt;/);
 assert.match(result.html,/background:#005b3b/);
 assert.throws(()=>finalDocumentsEmail({...input,baseUrl:'javascript:alert(1)'}));
 assert.ok(isFinalDocumentsEmail('PROCESS_COMPLETED'));
 assert.ok(isFinalDocumentsEmail('','email-conclusao'));
 assert.equal(isFinalDocumentsEmail('TCC_CREATED','email-reserva'),false);
 assert.equal(isFinalDocumentsEmail('PROCESS_COMPLETED','custom-template'),false);
});
