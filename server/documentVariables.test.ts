import test from 'node:test';
import assert from 'node:assert/strict';
import {DEMO_PROCESSES} from '../src/services/demoSeed';
import {documentVariables} from '../src/utils/documentVariables';
import {adaptDocumentLanguage} from '../src/utils/documentLanguage';
import {buildProcessVariables} from './workflow/runtime';
import {generateOfficialDocumentText} from '../src/utils/documentTemplateEngine';
const fixture=()=>{const p=structuredClone(DEMO_PROCESSES[0]);p.aluno1={...p.aluno1,nome:'Maria da Silva',tratamento:'Aluna'};p.aluno2={...p.aluno1,nome:'Ana Pereira',email:'ana@example.invalid'};p.authorOrder='ALUNO_2_FIRST';p.orientador={...p.orientador,nome:'Profa. Dra. Maria Oliveira',tratamento:'Professora',titulacao:'Doutora'};p.banca=[{id:'b2',nome:'Beatriz Santos',email:'beatriz@example.invalid',tratamento:'Professora',titulacao:'Mestra',funcao:'EXAMINER_2'},{id:'b3',nome:'Rafael Lima',email:'rafael@example.invalid',tratamento:'Professor',titulacao:'Doutor',funcao:'EXAMINER_3'}];p.acervo={trabalhoCompletoFileName:'TCC.pdf',trabalhoCompletoVersion:2,resumoExpandidoFileName:'Resumo.pdf',resumoExpandidoVersion:1};return p;};
test('document variables derive long, short and plain faculty names without altering source identity',()=>{
 const p=fixture(),v=documentVariables(p);assert.equal(v.ORIENTADOR_NOME_COMPLETO,'Professora Doutora Maria Oliveira');assert.equal(v.ORIENTADOR_NOME_ABREVIADO,'Prof.ª Dr.ª Maria Oliveira');assert.equal(v.ORIENTADOR_NOME_SIMPLES,'Maria Oliveira');assert.equal(v.ORIENTADOR_FUNCAO,'orientadora e presidente');assert.equal(v.EXAMINADOR_2_NOME_COMPLETO,'Professora Mestra Beatriz Santos');assert.equal(v.EXAMINADOR_2_FUNCAO,'examinadora');assert.equal(v.EXAMINADOR_3_NOME_COMPLETO,'Professor Doutor Rafael Lima');assert.equal(p.orientador.nome,'Profa. Dra. Maria Oliveira');assert.equal(v.AUTORIA_NOMES,'Ana Pereira e Maria da Silva');assert.equal(v.ALUNO_1_NOME_COMPLETO,'Maria da Silva');
});
test('declaration example and all four documents resolve each role and full name without duplicated titles',()=>{
 const p=fixture(),source='do(a)(s) graduando(a)(s) Ana Pereira e Maria da Silva\nOrientador(a) e Presidente Prof(ª). Dr(ª). Profa. Dra. Maria Oliveira\nExaminador(a) Prof(ª). Dr(ª). Beatriz Santos\nExaminador(a) Prof(ª). Dr(ª). Rafael Lima';
 for(const type of ['CONVITE','ATA','TERMO','DECLARACAO']){const out=adaptDocumentLanguage(source,p,type);assert.match(out,/das graduandas/);assert.match(out,/Orientadora e Presidente Prof\.ª Dr\.ª Maria Oliveira/);assert.match(out,/Examinadora Prof\.ª Ma\. Beatriz Santos/);assert.match(out,/Examinador Prof\. Dr\. Rafael Lima/);assert.doesNotMatch(out,/\((?:a|ª|s)\)|Professora Doutora|Professor Doutor|Professora Mestra/);assert.equal(adaptDocumentLanguage(out,p,type),out);}
});
test('workflow and preview use the same trusted work, file and faculty variables for four document types',()=>{
 const p=fixture(),v=documentVariables(p);assert.equal(v.TCC_TITULO_ENTRE_ASPAS,`“${p.titulo}”`);assert.equal(v.TCC_TITULO_MAIUSCULO,p.titulo.toLocaleUpperCase('pt-BR'));assert.equal(v.TRABALHO_COMPLETO_NOME_ARQUIVO,'TCC.pdf');assert.equal(v.TRABALHO_COMPLETO_VERSAO,'2');assert.equal(v.RESUMO_EXPANDIDO_NOME_ARQUIVO,'Resumo.pdf');
 const runtime=buildProcessVariables({process:p,eventCode:'TEST',actorEmail:'master@portal.local',actorRoles:[],extraVariables:{ORIENTADOR_NOME_COMPLETO:'spoof',TRABALHO_COMPLETO_NOME_ARQUIVO:'spoof',TCC_TITULO_ENTRE_ASPAS:'spoof'}});for(const key of ['ORIENTADOR_NOME_COMPLETO','ORIENTADOR_NOME_SIMPLES','ORIENTADOR_NOME_ABREVIADO','TRABALHO_COMPLETO_NOME_ARQUIVO','TCC_TITULO_ENTRE_ASPAS','AUTORIA_NOMES'])assert.equal(runtime[key],v[key]);
 for(const type of ['CONVITE','ATA','TERMO','DECLARACAO']){const text=generateOfficialDocumentText(type,p,'<<ORIENTADOR_NOME_COMPLETO>> — <<AUTORIA_APRESENTACAO>> — <<TCC_TITULO_ENTRE_ASPAS>> — <<TRABALHO_COMPLETO_NOME_ARQUIVO>> — <<ORIENTADOR_NOME_ABREVIADO>> — <<ORIENTADOR_NOME_SIMPLES>>');assert.equal(text,`${v.ORIENTADOR_NOME_ABREVIADO} — ${v.AUTORIA_APRESENTACAO} — ${v.TCC_TITULO_ENTRE_ASPAS} — TCC.pdf — ${v.ORIENTADOR_NOME_ABREVIADO} — ${v.ORIENTADOR_NOME_SIMPLES}`);}
});

test('invitation addresses invited faculty without implying an established board or advisor presidency',()=>{
 const p=fixture(),source='À Comissão Examinadora\nA Comissão de Trabalho de Conclusão de Curso convida Vossas Senhorias para integrar a Comissão Examinadora da defesa do trabalho identificado a seguir.\nOrientação e presidência: Professora Doutora Maria Oliveira\nDemais integrantes da comissão: Professora Mestra Beatriz Santos e Professor Doutor Rafael Lima\nAgradecemos a participação e a contribuição para a formação acadêmica em Enfermagem.';
 const out=adaptDocumentLanguage(source,p,'CONVITE');
 assert.match(out,/^Aos docentes convidados/);assert.match(out,/A Comissão de Trabalho de Conclusão de Curso convida os docentes abaixo relacionados a participar da banca de defesa/);
 assert.match(out,/Orientadora e Presidente: Prof\.ª Dr\.ª Maria Oliveira/);assert.match(out,/Examinadora:.*Beatriz Santos\nExaminador:.*Rafael Lima/);
 assert.match(out,/Agradecemos a atenção ao convite e esperamos contar/);assert.doesNotMatch(out,/Comissão Examinadora|Demais/);
 assert.equal(adaptDocumentLanguage(out,p,'CONVITE'),out);
});
test('all documents retain the advisor session presidency and the separate commission presidency',()=>{
 const p=fixture(),source='Orientação e presidência da banca: Professora Doutora Maria Oliveira\nPresidente da Comissão de TCC';
 assert.match(adaptDocumentLanguage(source,p,'ATA'),/Orientadora e Presidente/);
 for(const type of ['CONVITE','TERMO','DECLARACAO']){const out=adaptDocumentLanguage(source,p,type);assert.match(out,/Orientadora e Presidente: Prof\.ª Dr\.ª Maria Oliveira/);assert.doesNotMatch(out,/Orientação e presidência/);assert.match(out,/Presidente da Comissão de Trabalho de Conclusão de Curso/);}
});
