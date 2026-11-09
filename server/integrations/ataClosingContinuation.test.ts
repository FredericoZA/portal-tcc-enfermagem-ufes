import test from 'node:test';
import assert from 'node:assert/strict';
import {ataClosingContinuationRequests} from './documentPresentation';
import {adaptDocumentLanguage} from '../../src/utils/documentLanguage';
import {DEMO_PROCESSES} from '../../src/services/demoSeed';

const closing='Nada mais havendo a tratar, foi encerrada a sessão e lavrada a presente ata que será assinada.';
function document(text:string){
 let index=1;
 return {headers:{h:{content:[{paragraph:{elements:[{textRun:{content:'Cabeçalho\n'+closing+'\n'}}]}}]}},tabs:[{tabProperties:{tabId:'ata'},documentTab:{body:{content:text.split('\n').map(line=>{
  const startIndex=index;index+=line.length+1;
  return {startIndex,endIndex:index,paragraph:{elements:[{textRun:{content:line+'\n',textStyle:{bold:line.startsWith('O trabalho')}}}]}};
 })}}}]};
}
for(const separator of ['\n','\n\n',' \n\n  '])test(`closing joins a separate model paragraph (${JSON.stringify(separator)}) without rebuilding text`,()=>{
 const original='O trabalho apresenta contribuição pertinente.'+separator+closing+'\n\nProf. Orientador\nOrientador e Presidente';
 const doc=document(original),before=structuredClone(doc);
 const requests=ataClosingContinuationRequests(doc);
 assert.equal(requests.length,2);
 let result=original;
 for(const request of requests){
  if(request.deleteContentRange){const {range}=request.deleteContentRange;assert.equal(range.tabId,'ata');assert.equal(original.slice(range.startIndex-1,range.endIndex-1),separator);result=result.slice(0,range.startIndex-1)+result.slice(range.endIndex-1);}
  else {assert.equal(request.insertText.text,' ');const i=request.insertText.location.index-1;result=result.slice(0,i)+' '+result.slice(i);}
 }
 assert.equal(result,'O trabalho apresenta contribuição pertinente. '+closing+'\n\nProf. Orientador\nOrientador e Presidente');
 assert.deepEqual(doc,before,'styled opinion, signatures and header remain unchanged');
 assert.deepEqual(ataClosingContinuationRequests(document(result)),[]);
});
test('continuous body normalization removes closing breaks and preserves signature separation',()=>{
 const p=structuredClone(DEMO_PROCESSES[0]);
 for(const whitespace of [' ','\n','\r\n\r\n','\u000b']){
  const output=adaptDocumentLanguage('Parecer registrado..'+whitespace+closing+'\n\nAssinaturas',p,'ATA');
  assert.match(output,/Parecer registrado\. Nada mais havendo/);
  assert.match(output,/assinada\.\n\nAssinaturas$/);
  assert.equal(adaptDocumentLanguage(output,p,'ATA'),output);
 }
});
test('continuation leaves headers, signature blocks and an already joined body alone',()=>{
 assert.deepEqual(ataClosingContinuationRequests(document('Corpo da ata. '+closing+'\n\nOrientador')),[]);
 assert.deepEqual(ataClosingContinuationRequests({headers:document('Parecer.\n'+closing)}),[]);
});
