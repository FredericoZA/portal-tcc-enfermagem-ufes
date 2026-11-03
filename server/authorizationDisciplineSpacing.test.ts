import test from 'node:test';
import assert from 'node:assert/strict';
import {DEMO_PROCESSES} from '../src/services/demoSeed';
import {adaptDocumentLanguage} from '../src/utils/documentLanguage';
import {authorizationOptionsLayoutRequests} from './integrations/documentPresentation';
const p=structuredClone(DEMO_PROCESSES[0]);
test('authorization uses ENF16130 TCC II and separates the two independent choices',()=>{
 const source='matriculada na disciplina ENF05041 Orientação a Monografia II, AUTORIZAMOS a postagem da Monografia ou Resumo Expandido do Artigo produzido, em site do Curso de Graduação em Enfermagem do CCS/UFES.';
 for(const [work,abstract] of [[true,false],[false,true],[true,true],[false,false]]){
  p.acervo={...p.acervo,publishFullWork:work,publishExpandedAbstract:abstract};
  const result=adaptDocumentLanguage(source,p,'TERMO');
  assert.match(result,/ENF16130 Trabalho de Conclusão de Curso II/);
  assert.doesNotMatch(result,/ENF05041|Orientação a Monografia II/);
  assert.match(result,/AUTORIZAMOS:\n\n[☒☐]/u);
  assert.equal((result.match(/[☒☐]/gu)||[]).length,2);
  assert.ok(result.includes(`${work?'☒':'☐'} Trabalho de Conclusão`));
  assert.ok(result.includes(`${abstract?'☒':'☐'} Resumo expandido`));
  assert.equal(adaptDocumentLanguage(result,p,'TERMO'),result);
 }
 assert.equal(adaptDocumentLanguage('Disciplina XYZ123 Pesquisa II',p,'TERMO'),'Disciplina XYZ123 Pesquisa II');
});
test('existing separate checkbox paragraphs get a gap only above the first option',()=>{
 const doc=(texts:string[])=>{let start=1;return{tabs:[{tabProperties:{tabId:'termo'},documentTab:{body:{content:texts.map(text=>{const p={startIndex:start,endIndex:start+text.length+1,paragraph:{elements:[{textRun:{content:text+'\n'}}]}};start=p.endIndex;return p;})}}}]};};
 const source=doc(['Texto fixo AUTORIZAMOS:','☒ Monografia','☐ Resumo','Texto final']);
 const requests=authorizationOptionsLayoutRequests(source);
 assert.equal(requests.length,1);assert.equal(requests[0].updateParagraphStyle.range.tabId,'termo');
 assert.deepEqual(requests[0].updateParagraphStyle.paragraphStyle,{spaceAbove:{magnitude:12,unit:'PT'}});
 assert.equal(requests[0].updateParagraphStyle.range.startIndex,source.tabs[0].documentTab.body.content[1].startIndex);
 assert.deepEqual(authorizationOptionsLayoutRequests(doc(['AUTORIZAMOS:','','☒ Monografia','☐ Resumo'])),[]);
});
