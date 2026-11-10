import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildDeclarationBodyNormalRequests} from './integrations/googleDocsStyles';
import {declarationDateLayoutRequests} from './integrations/documentPresentation';
test('declaration prose and board listing use regular weight, preserving title and signature',()=>{
 const lines=['DECLARAÇÃO','Declaro, para os devidos fins','Orientadora e Presidente Prof.ª Maria','Examinadora Prof.ª Ana','Coorientadora Prof.ª Ilta','Vitória - ES, 23 de outubro de 2026.','Prof.ª Maria','Presidência da Comissão'];
 const content=lines.map((text,index)=>({paragraph:{elements:[{startIndex:index*100+1,textRun:{content:text+'\n'}}]}}));
 const requests=buildDeclarationBodyNormalRequests({tabs:[{tabProperties:{tabId:'main'},documentTab:{body:{content}}}]});
 assert.deepEqual(requests.map(request=>request.updateTextStyle.range.startIndex),[101,201,301,401,501]);
 assert.ok(requests.every(request=>request.updateTextStyle.textStyle.bold===false&&request.updateTextStyle.range.tabId==='main'));
});
test('standalone declaration date aligns to the right and keeps compact spacing',()=>{
 const text='Vitória - ES, 23 de outubro de 2026.\n';
 const requests=declarationDateLayoutRequests({body:{content:[{startIndex:1,endIndex:text.length+1,paragraph:{elements:[{startIndex:1,textRun:{content:text}}]}}]}});
 assert.equal(requests.length,1);assert.equal(requests[0].updateParagraphStyle.paragraphStyle.alignment,'END');
 assert.equal(requests[0].updateParagraphStyle.paragraphStyle.spaceAbove.magnitude,12);
 assert.ok(requests[0].updateParagraphStyle.fields.includes('alignment'));
});

test('data da declaração com dia da semana continua alinhada à direita',()=>{
 const text='Vitória - ES, terça-feira, 3 de novembro de 2026.\n';
 const requests=declarationDateLayoutRequests({body:{content:[{startIndex:1,endIndex:text.length+1,paragraph:{elements:[{startIndex:1,textRun:{content:text}}]}}]}});
 assert.equal(requests.length,1);
 assert.equal(requests[0].updateParagraphStyle.paragraphStyle.alignment,'END');
});
