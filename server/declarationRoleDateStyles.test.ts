import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildDeclarationCoAdvisorNormalRequests,buildValueBoldRequests} from './integrations/googleDocsStyles';
import {declarationDateLayoutRequests} from './integrations/documentPresentation';
test('declaration co-advisor role is regular while the full abbreviated name stays bold',()=>{
 const prefix='Coorientadora ',name='Prof.ª Ma. Ilta Zacché';
 const doc={tabs:[{tabProperties:{tabId:'main'},documentTab:{body:{content:[{paragraph:{elements:[{startIndex:1,textRun:{content:prefix}},{startIndex:prefix.length+1,textRun:{content:name+'\n'}}]}}]}}}]};
 const reset=buildDeclarationCoAdvisorNormalRequests(doc),names=buildValueBoldRequests(doc,[name]);
 assert.equal(reset.length,1);assert.equal(reset[0].updateTextStyle.textStyle.bold,false);
 assert.equal(names.length,1);assert.equal(names[0].updateTextStyle.textStyle.bold,true);
 assert.equal(names[0].updateTextStyle.range.startIndex,prefix.length+1);
 assert.equal(reset[0].updateTextStyle.range.tabId,'main');
 assert.deepEqual(buildDeclarationCoAdvisorNormalRequests({body:{content:[{paragraph:{elements:[{startIndex:1,textRun:{content:'Orientadora e Presidente Prof.ª Maria\n'}}]}}]}}),[]);
});
test('standalone declaration date aligns to the right and keeps compact spacing',()=>{
 const text='Vitória - ES, 23 de outubro de 2026.\n';
 const requests=declarationDateLayoutRequests({body:{content:[{startIndex:1,endIndex:text.length+1,paragraph:{elements:[{startIndex:1,textRun:{content:text}}]}}]}});
 assert.equal(requests.length,1);assert.equal(requests[0].updateParagraphStyle.paragraphStyle.alignment,'END');
 assert.equal(requests[0].updateParagraphStyle.paragraphStyle.spaceAbove.magnitude,6);
 assert.ok(requests[0].updateParagraphStyle.fields.includes('alignment'));
});

test('data da declaração com dia da semana continua alinhada à direita',()=>{
 const text='Vitória - ES, terça-feira, 3 de novembro de 2026.\n';
 const requests=declarationDateLayoutRequests({body:{content:[{startIndex:1,endIndex:text.length+1,paragraph:{elements:[{startIndex:1,textRun:{content:text}}]}}]}});
 assert.equal(requests.length,1);
 assert.equal(requests[0].updateParagraphStyle.paragraphStyle.alignment,'END');
});
