import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildAuthorizationBodyStyleRequests,buildAuthorizationChoiceStyleRequests} from './integrations/googleDocsStyles';
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
  // Google Docs BaselineOffset uses NONE to clear inherited superscript or
  // subscript; NORMAL and NORMAL_TEXT are not valid values for this field.
  assert.equal(text[index].textStyle.baselineOffset,'NONE');
  assert.ok(text[index].fields.split(',').includes('baselineOffset'));
  assert.equal(text[index].range.endIndex-text[index].range.startIndex,1);
  assert.equal(text[index].range.tabId,'main');
  assert.equal(lines[index].startsWith(allowed?'☒':'☐'),true);
 }
 assert.equal(requests.filter(request=>request.updateParagraphStyle).length,2);
 assert.equal(requests.some(request=>request.insertText||request.replaceAllText||request.deleteContentRange),false);
});
test('does not restyle unrelated text',()=>assert.deepEqual(buildAuthorizationChoiceStyleRequests({body:{content:[{paragraph:{elements:[{startIndex:1,textRun:{content:'AUTORIZAMOS: texto fixo'}}]}}]}}),[]));

test('publication checkbox reset conforms to Docs BaselineOffset in tab footer scope',()=>{
 const document={tabs:[{tabProperties:{tabId:'authorization'},documentTab:{footers:{footer1:{content:[{paragraph:{elements:[{startIndex:17,textRun:{content:'☒ Publicar',textStyle:{baselineOffset:'SUPERSCRIPT'}}}]}}]}}}}]};
 const text=buildAuthorizationChoiceStyleRequests(document).find(request=>request.updateTextStyle)?.updateTextStyle;
 assert.ok(text);
 assert.deepEqual(text.range,{tabId:'authorization',segmentId:'footer1',startIndex:17,endIndex:18});
 const docsBaselineOffsets=new Set(['BASELINE_OFFSET_UNSPECIFIED','NONE','SUPERSCRIPT','SUBSCRIPT']);
 assert.ok(docsBaselineOffsets.has(text.textStyle.baselineOffset),'batchUpdate must use an accepted BaselineOffset enum');
 assert.equal(text.textStyle.baselineOffset,'NONE','clear inherited superscript without moving the checkbox');
 assert.equal(document.tabs[0].documentTab.footers.footer1.content[0].paragraph.elements[0].textRun.textStyle.baselineOffset,'SUPERSCRIPT','source document remains untouched');
});

test('only the authorization body and date lose inherited bold',()=>{
 const lines=['TERMO DE AUTORIZAÇÃO','Nós, Ana e João, AUTORIZAMOS:',
  '☐ Trabalho completo','☒ Resumo expandido','A autorização se limita aos itens assinalados.',
  'Vitória - ES, segunda-feira, 9 de novembro de 2026.','Ana Silva','João Souza'];
 const content=lines.map((line,index)=>({paragraph:{elements:[
  {startIndex:1+index*100,textRun:{content:line+'\n',textStyle:{bold:true}}}
 ]}}));
 const document={tabs:[{tabProperties:{tabId:'term'},documentTab:{body:{content}}}]};
 const styles=buildAuthorizationBodyStyleRequests(document).map(request=>request.updateTextStyle);
 assert.deepEqual(styles.map(style=>style.range.startIndex),[101,201,301,401,501]);
 assert.ok(styles.every(style=>style.range.tabId==='term'&&style.fields==='bold'&&style.textStyle.bold===false));
});
