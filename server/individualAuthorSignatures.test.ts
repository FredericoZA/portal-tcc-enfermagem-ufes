import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DEMO_PROCESSES} from '../src/services/demoSeed';
import {individualAuthorSignatureRequests,individualAuthorSignatureStyleRequests,ataCoadvisorBlockRequests,coadvisorIdentificationRequests} from './integrations/documentPresentation';
import {adaptDocumentLanguage} from '../src/utils/documentLanguage';
const document=(text:string)=>{
 let index=1;
 return {tabs:[{tabProperties:{tabId:'main'},documentTab:{body:{content:text.split('\n').map(line=>{const startIndex=index;index+=line.length+1;return {startIndex,endIndex:index,paragraph:{elements:[{startIndex,textRun:{content:line+'\n'}}]}};})}}}]};
};
function apply(text:string,requests:any[]){
 for(const request of requests){
  if(request.deleteContentRange){const r=request.deleteContentRange.range;text=text.slice(0,r.startIndex-1)+text.slice(r.endIndex-1);}
  if(request.insertText){const r=request.insertText;text=text.slice(0,r.location.index-1)+r.text+text.slice(r.location.index-1);}
 }
 return text;
}
test('ata inclui coorientador no texto e após os autores, sem duplicar',()=>{
 const p=structuredClone(DEMO_PROCESSES[0]);p.aluno1.nome='Alex Silva';p.aluno2={...p.aluno1,nome:'Maria Souza',tratamento:'Aluna'};p.coorientador={nome:'Paula Souza',email:'paula@example.invalid',tratamento:'Professora',titulacao:'Doutora'};
 const body='A orientadora prosseguiu, apresentando os demais examinadores: Prof. Dr. João Lima e Prof. Dr. Rui Silva. Foi dada a palavra aos autores.';
 const adapted=adaptDocumentLanguage(body,p,'ATA');assert.match(adapted,/coorientadora Prof\.ª Dr\.ª Paula Souza/);assert.equal(adaptDocumentLanguage(adapted,p,'ATA'),adapted);
 const source='Alex Silva\nAluno autor\nMaria Souza\nAluna autora\nRodapé\n';
 const rendered=apply(source,ataCoadvisorBlockRequests(document(source),p));assert.match(rendered,/Maria Souza\nAluna autora\n\nProf\.ª Dr\.ª Paula Souza\nCoorientadora\nRodapé/);
 assert.equal(ataCoadvisorBlockRequests(document(rendered),p).length,0);
 p.coorientador=null;assert.deepEqual(ataCoadvisorBlockRequests(document(source),p),[]);assert.equal(adaptDocumentLanguage(body,p,'ATA'),body);
});
for(const second of [false,true])for(const feminine of [false,true])test(`each author has an individual role: two=${second}, feminine=${feminine}`,()=>{
 const p=structuredClone(DEMO_PROCESSES[0]);
 p.aluno1={...p.aluno1,nome:'Alex Silva',tratamento:feminine?'Aluna':'Aluno'};
 p.aluno2=second?{...p.aluno1,nome:'Maria Souza',tratamento:'Aluna'}:null;
 const source=`Texto do trabalho de Alex Silva.\nProf. Dr. José Silva\nOrientador e Presidente\n\n${p.aluno1.nome}\n${second?'\nMaria Souza\n':''}${second?'Alunos':'Aluno'}\nRodapé institucional\n`;
 const requests=individualAuthorSignatureRequests(document(source),p);
 const rendered=apply(source,requests);
 assert.ok(rendered.includes(`Alex Silva\n${feminine?'Aluna autora':'Aluno autor'}`));
 assert.equal(rendered.includes('Maria Souza\nAluna autora'),second);
 assert.ok(rendered.startsWith('Texto do trabalho de Alex Silva.\nProf. Dr. José Silva\nOrientador e Presidente\n'));
 assert.ok(rendered.endsWith('Rodapé institucional\n'));
 assert.equal(individualAuthorSignatureRequests(document(rendered),p).length,0,'formatting is idempotent');
 const styles=individualAuthorSignatureStyleRequests(document(rendered),p);
 const bold=styles.filter(request=>request.updateTextStyle).map(request=>request.updateTextStyle.textStyle.bold);
 assert.deepEqual(bold,second?[true,false,true,false]:[true,false]);
 assert.ok(styles.every(request=>(request.updateTextStyle||request.updateParagraphStyle).range.tabId==='main'));
});
test('keeps the configured author order and ignores names in body prose',()=>{
 const p=structuredClone(DEMO_PROCESSES[0]);p.aluno1.nome='Alex Silva';p.aluno2={...p.aluno1,nome:'Maria Souza',tratamento:'Aluna'};p.authorOrder='ALUNO_2_FIRST';
 const text='Alex Silva e Maria Souza são autores do trabalho.\nAlex Silva\nMaria Souza\nAlunos\n';
 const result=apply(text,individualAuthorSignatureRequests(document(text),p));
 assert.ok(result.startsWith('Alex Silva e Maria Souza são autores do trabalho.\nMaria Souza\nAluna autora\nAlex Silva\n'));
 assert.deepEqual(individualAuthorSignatureRequests(document('Alex Silva\nTexto principal\n'),p),[]);
});

test('convite e declaração incluem coorientador depois do último examinador, sem duplicação',()=>{
 const p=structuredClone(DEMO_PROCESSES[0]);p.coorientador={nome:'Paula Souza',email:'paula@example.invalid',tratamento:'Professora',titulacao:'Doutora'};
 const members=p.banca.filter(member=>member.email!==p.orientador.email);
 const source=members.map(member=>`Examinador: ${member.nome}`).join('\n')+'\nData: 20/11/2026\n';
 for(const type of ['CONVITE','DECLARACAO']){
  const requests=coadvisorIdentificationRequests(document(source),p,type),rendered=apply(source,requests);
  assert.match(rendered,/Coorientadora: Prof\.ª Dr\.ª Paula Souza/);
  assert.ok(rendered.indexOf('Paula Souza')>rendered.lastIndexOf(members.at(-1)!.nome));
  assert.equal(coadvisorIdentificationRequests(document(rendered),p,type).length,0);
  assert.equal(requests.at(-1).updateTextStyle.textStyle.bold,false);
  assert.equal(requests[0].insertText.location.tabId,'main');
 }
 assert.equal(coadvisorIdentificationRequests(document(source),p,'TERMO').length,0);
});
