import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeRegistrationValue} from '../src/utils/registrationNormalization';
import {registrationQuestions,registrationPayload} from '../src/utils/operationalConfig';
import {adaptDocumentLanguage} from '../src/utils/documentLanguage';
import {DEMO_PROCESSES} from '../src/services/demoSeed';
import {declarationDateLayoutRequests} from './integrations/documentPresentation';
test('document name uses chosen spelling and references, including social name',()=>{
 const chosen='Alex Mcdonald D’Ávila';assert.equal(normalizeRegistrationValue('ALUNO_1_NOME','text','  Alex McDonald d’Ávila  '),chosen);
 const a={ALUNO_1_NOME:chosen,ALUNO_1_TRATAMENTO:'Aluna',TEM_ALUNO_2:'Não',TEM_COORIENTADOR:'Não',ORIENTADOR_NOME:'Noa de Souza',ORIENTADOR_TRATAMENTO:'Professor',ORIENTADOR_TITULACAO:'Mestre',DEFESA_DATA_HORA:'2026-10-30T14:00'};
 const payload=registrationPayload(a,'America/Sao_Paulo');assert.equal(payload.aluno1.nome,chosen);
 const p=structuredClone(DEMO_PROCESSES[0]);p.aluno1={...p.aluno1,...payload.aluno1,tratamento:'Aluna'};p.aluno2=null;p.orientador={...p.orientador,...payload.orientador,tratamento:'Professor'};
 for(const type of ['ATA','CONVITE','TERMO','DECLARACAO']){
  const out=adaptDocumentLanguage(`pelo(a)(s) graduando(a)(s) ${chosen}\nOrientação e presidência: Professor Mestre Noa de Souza`,p,type);
  assert.match(out,/pela graduanda Alex Mcdonald D’Ávila/);assert.match(out,/Orientador e Presidente: Prof\. Me\. Noa de Souza/);
 }
 const fields=registrationQuestions();for(const key of ['ALUNO_1_NOME','ALUNO_2_NOME','ORIENTADOR_NOME','EXAMINADOR_2_NOME'])assert.match(fields.find(field=>field.fieldKey===key)!.helpText||'',/nome social/);
});
test('declaration date loses one spacer and receives compact spacing without changing text',()=>{
 let start=1;const paragraphs=['Examinadora Prof.ª Ma. Ana Silva\n','\n','\n','Vitória - ES, 15 de outubro de 2026.\n','Comissão de TCC\n'].map(text=>{const node={startIndex:start,endIndex:start+text.length,paragraph:{elements:[{textRun:{content:text}}]}};start+=text.length;return node;});
 const requests=declarationDateLayoutRequests({body:{content:paragraphs}});
 assert.deepEqual(requests[0].updateParagraphStyle.range,{startIndex:paragraphs[3].startIndex,endIndex:paragraphs[3].endIndex});
 assert.deepEqual(requests[1],{deleteContentRange:{range:{startIndex:paragraphs[2].startIndex,endIndex:paragraphs[2].endIndex}}});
 assert.equal(requests.length,2);
});
