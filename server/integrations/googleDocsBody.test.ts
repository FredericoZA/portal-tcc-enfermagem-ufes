import test from 'node:test';
import assert from 'node:assert/strict';
import {bodyEditRequests,documentMainBody} from './googleDocsBody';
const doc={tabs:[{tabProperties:{tabId:'main'},documentTab:{body:{content:[{endIndex:1,sectionBreak:{}},{startIndex:1,endIndex:15,paragraph:{elements:[{textRun:{content:'Ata original.\n'}}]}}]},headers:{institution:{content:'BRASÃO'}},footers:{address:{content:'ENDEREÇO'}}}}]};
test('editor lê e substitui somente corpo principal sem tocar cabeçalhos e rodapés',()=>{
 assert.equal(documentMainBody(doc)?.text,'Ata original.');
 const requests=bodyEditRequests(doc,'Ata revisada — texto 🩺 completo.');
 assert.deepEqual(requests[0],{deleteContentRange:{range:{startIndex:5,endIndex:13,tabId:'main'}}});
 assert.equal(requests[1].insertText.location.tabId,'main');
 for(const request of requests)assert.ok(!JSON.stringify(request).includes('segmentId'));
 assert.ok(requests.every(request=>!request.updateParagraphStyle&&!request.updateTextStyle));
 assert.deepEqual(doc.tabs[0].documentTab.headers,{institution:{content:'BRASÃO'}});
});
test('revisão sem alteração não reescreve nem reformata a ata',()=>{
 assert.deepEqual(bodyEditRequests(doc,'Ata original.'),[]);
});
test('edições separadas preservam parágrafos intermediários e assinaturas',()=>{
 const original='Título original\nCorpo do documento\nParecer inicial\nNome para assinatura';
 const revised='Título corrigido\nCorpo do documento\nParecer atualizado\nNome para assinatura';
 const document={body:{content:[{startIndex:1,endIndex:original.length+2,paragraph:{elements:[{textRun:{content:original+'\n'}}]}}]}};
 const requests=bodyEditRequests(document,revised);let actual=original;
 for(const request of requests){if(request.deleteContentRange){const {startIndex,endIndex}=request.deleteContentRange.range;actual=actual.slice(0,startIndex-1)+actual.slice(endIndex-1);}else if(request.insertText){const {location,text}=request.insertText;actual=actual.slice(0,location.index-1)+text+actual.slice(location.index-1);}}
 assert.equal(actual,revised);assert.ok(requests.every(request=>!JSON.stringify(request).includes('Corpo do documento')&&!JSON.stringify(request).includes('Nome para assinatura')));
});
test('editor recusa converter tabela estruturada em texto',()=>{
 assert.equal(documentMainBody({body:{content:[{table:{}}]}}),null);
 assert.throws(()=>bodyEditRequests({body:{content:[{table:{}}]}},'Texto'),/DOCX/);
});
