import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildAuthorizationChoiceStyleRequests} from './integrations/googleDocsStyles';
import {publicationAuthorizationVariables} from '../src/utils/publicationAuthorization';
for(const work of [false,true])for(const abstract of [false,true])test(`publication marks remain independent and prominent: full=${work}, abstract=${abstract}`,()=>{
 const values=publicationAuthorizationVariables({acervo:{publishFullWork:work,publishExpandedAbstract:abstract}});
 const lines=values.AUTORIZACAO_PUBLICACAO_ITENS.split('\n');
 const document={tabs:[{tabProperties:{tabId:'main'},documentTab:{body:{content:lines.map((line,index)=>({paragraph:{elements:[{startIndex:1+index*150,textRun:{content:line+'\n'}}]}}))}}}]};
 const requests=buildAuthorizationChoiceStyleRequests(document);
 const text=requests.filter(request=>request.updateTextStyle).map(request=>request.updateTextStyle);
 assert.equal(text.length,2);
 for(const [index,allowed] of [work,abstract].entries()){
  assert.equal(text[index].textStyle.fontSize.magnitude,20);
  assert.equal(text[index].textStyle.bold,allowed);
  assert.equal(text[index].range.endIndex-text[index].range.startIndex,1);
  assert.equal(text[index].range.tabId,'main');
  assert.equal(lines[index].startsWith(allowed?'☒':'☐'),true);
 }
 assert.equal(requests.filter(request=>request.updateParagraphStyle).length,2);
 assert.equal(requests.some(request=>request.insertText||request.replaceAllText||request.deleteContentRange),false);
});
test('does not restyle unrelated text',()=>assert.deepEqual(buildAuthorizationChoiceStyleRequests({body:{content:[{paragraph:{elements:[{startIndex:1,textRun:{content:'AUTORIZAMOS: texto fixo'}}]}}]}}),[]));
