import test from 'node:test';
import assert from 'node:assert/strict';
import {ataStudentSignatureLayoutRequests} from './integrations/documentPresentation';
const process={aluno1:{nome:'Mariana Alves da Silva'}} as any;
function doc(texts:string[]){let offset=1;return {tabs:[{tabProperties:{tabId:'ata'},documentTab:{body:{content:texts.map(text=>{const value={startIndex:offset,endIndex:offset+text.length+1,paragraph:{elements:[{textRun:{content:text+'\n'}}]}};offset=value.endIndex;return value;})}}}]};}
for(const count of [1,2])test(`ata separates board from ${count} student signature(s) without inserting blank authors`,()=>{
 const p={...process,...(count===2?{aluno2:{nome:'Ana Pereira'}}:{})};
 const texts=['Ata da defesa','Prof.ª Dr.ª Maria Silva','Orientadora e Presidente','Prof.ª Ma. Beatriz Santos','Examinadora','Prof. Dr. Rafael Lima','Examinador',p.aluno1.nome,'Aluna',...(count===2?[p.aluno2.nome,'Aluna']:[])];
 const document=doc(texts),before=JSON.stringify(document);
 const result=ataStudentSignatureLayoutRequests(document,p);
 assert.equal(result.length,1);
 const style=result[0].updateParagraphStyle;
 assert.equal(style.range.startIndex,document.tabs[0].documentTab.body.content[7].startIndex);
 assert.equal(style.range.tabId,'ata');assert.deepEqual(style.paragraphStyle,{spaceAbove:{magnitude:12,unit:'PT'}});
 assert.equal(style.fields,'spaceAbove');assert.equal(JSON.stringify(document),before);
 assert.ok(result.every(r=>!r.deleteContentRange&&!r.insertText));
});
test('ata spacing leaves ordinary student mentions, board, headers and tables untouched',()=>{
 const document=doc(['Mariana Alves da Silva','Autoria','Examinador','Outro nome']);
 (document as any).headers={x:doc(['Examinador',process.aluno1.nome])};
 assert.deepEqual(ataStudentSignatureLayoutRequests(document,process),[]);
});
