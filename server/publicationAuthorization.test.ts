import {createProfessionalPdf} from './documents/simplePdf';
import {buildProcessVariables} from './workflow/runtime';
import test from 'node:test';
import assert from 'node:assert/strict';
import {DEMO_PROCESSES} from '../src/services/demoSeed';
import {publicationAuthorizationVariables} from '../src/utils/publicationAuthorization';
import {documentVariables} from '../src/utils/documentVariables';
import {adaptDocumentLanguage} from '../src/utils/documentLanguage';
import {authorizationSignatureLayoutRequests} from './integrations/documentPresentation';
import {academicName} from '../src/utils/personPresentation';
const fixture=()=>{const p=structuredClone(DEMO_PROCESSES[0]);p.aluno1.tratamento='Aluna';p.aluno2=null;p.orientador={...p.orientador,nome:'Maria Silva',tratamento:'Professora',titulacao:'Doutora'};return p;};
test('term states each persisted permission independently and never infers consent from attached files',()=>{
 for(const [work,abstract] of [[true,false],[false,true],[true,true],[false,false]]){
  const p=fixture();p.acervo={...p.acervo,publishFullWork:work,publishExpandedAbstract:abstract,trabalhoCompletoFileUrl:'private.pdf',resumoExpandidoFileUrl:'private-resumo.pdf'};
  const vars=publicationAuthorizationVariables(p);assert.equal(vars.PUBLICACAO_TRABALHO_MARCA,work?'☒':'☐');assert.equal(vars.PUBLICACAO_RESUMO_MARCA,abstract?'☒':'☐');
  assert.equal(documentVariables(p).AUTORIZACAO_PUBLICACAO_ITENS,vars.AUTORIZACAO_PUBLICACAO_ITENS);
  const trusted=buildProcessVariables({process:p,eventCode:'TEST',actorEmail:'master@portal.local',actorRoles:[],extraVariables:{AUTORIZACAO_PUBLICACAO_ITENS:'CONSENTIMENTO FALSO',PUBLICACAO_TRABALHO_MARCA:'X'}});assert.equal(trusted.AUTORIZACAO_PUBLICACAO_ITENS,vars.AUTORIZACAO_PUBLICACAO_ITENS);assert.equal(trusted.PUBLICACAO_TRABALHO_MARCA,vars.PUBLICACAO_TRABALHO_MARCA);
  const source='Eu, Ana Silva, e a orientadora Professora Doutora Maria Silva, AUTORIZAMOS a postagem da Monografia ou Resumo Expandido do Artigo produzido, em site do Curso de Graduação em Enfermagem do CCS/UFES.';
  const out=adaptDocumentLanguage(source,p,'TERMO');assert.match(out,/AUTORIZAMOS:\n/);assert.ok(out.includes(vars.AUTORIZACAO_PUBLICACAO_ITENS));assert.match(out,/no repositório público do Curso de Graduação em Enfermagem do CCS\/UFES/);assert.doesNotMatch(out,/Monografia ou|em site|Professora Doutora/);assert.match(out,/Prof\.ª Dr\.ª Maria Silva/);assert.equal(adaptDocumentLanguage(out,p,'TERMO'),out);
 }
});
test('signature compaction is bounded to the existing authorization names and retains both students',()=>{
 const p=fixture();p.aluno2={...p.aluno1,nome:'Bruno Lima',tratamento:'Aluno'};
 let offset=1;const texts=['CABEÇALHO\n','Texto da autorização\n','Vitória - ES, 15 de outubro de 2026.\n','\n','\n',academicName(p.orientador,'abbreviated')+'\n','Orientadora\n','\n','\n',p.aluno1.nome+'\n','Aluna\n','\n',p.aluno2.nome+'\n','Aluno\n'];
 const content=texts.map(text=>{const entry={startIndex:offset,endIndex:offset+text.length,paragraph:{elements:[{textRun:{content:text}}]}};offset+=text.length;return entry;});
 const requests=authorizationSignatureLayoutRequests({body:{content}},p);assert.ok(requests.some(r=>r.deleteContentRange));assert.ok(requests.some(r=>r.updateParagraphStyle?.range.startIndex===content[12].startIndex));
 assert.ok(requests.every(r=>(r.deleteContentRange?.range||r.updateParagraphStyle.range).startIndex>=content[3].startIndex));
 for(const r of requests.filter(r=>r.deleteContentRange)){const {startIndex,endIndex}=r.deleteContentRange.range;assert.equal(texts.join('').slice(startIndex-1,endIndex-1).trim(),'');}
 const order=requests.map(r=>(r.deleteContentRange?.range||r.updateParagraphStyle.range).startIndex);assert.deepEqual(order,[...order].sort((a,b)=>b-a));
});

test('local PDF preserves authorization check marks in the limited font fallback',()=>{
 const p=fixture();p.acervo={...p.acervo,publishFullWork:true,publishExpandedAbstract:false};
 const pdf=createProfessionalPdf({title:'TESTE TERMO',protocol:'TESTE',body:publicationAuthorizationVariables(p).AUTORIZACAO_PUBLICACAO_ITENS});
 assert.ok(pdf.toString('latin1').includes('[X]'));assert.ok(pdf.toString('latin1').includes('[ ]'));
});
