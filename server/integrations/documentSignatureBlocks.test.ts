import assert from 'node:assert/strict';
import test from 'node:test';
import {DEMO_PROCESSES} from '../../src/services/demoSeed';
import type {SignatureSignerSnapshot} from '../../src/types/signatures';
import {configuredSignatureBlockRequests,assertConfiguredSignatureBlocks,signaturePresentation} from './documentSignatureBlocks';
import {documentMainBody} from './googleDocsBody';

function document(text:string){let index=1;return{tabs:[{tabProperties:{tabId:'main'},documentTab:{headers:{institution:{untouched:true}},footers:{address:{untouched:true}},body:{content:text.split('\n').map(line=>{const startIndex=index;index+=line.length+1;return{startIndex,endIndex:index,paragraph:{elements:[{textRun:{content:line+'\n'}}]}};})}}}]};}
function apply(text:string,requests:any[]){for(const request of requests){if(request.deleteContentRange){const r=request.deleteContentRange.range;text=text.slice(0,r.startIndex-1)+text.slice(r.endIndex-1);}if(request.insertText){const r=request.insertText;text=text.slice(0,r.location.index-1)+r.text+text.slice(r.location.index-1);}}return text;}
const signer=(role:SignatureSignerSnapshot['role'],name:string,email:string):SignatureSignerSnapshot=>({id:email,role,name,email,signingOrder:1,status:'WAITING'});
function fixture(){
 const p=structuredClone(DEMO_PROCESSES[0]);p.aluno1={nome:'Ana Souza',email:'author@fixture.invalid',tratamento:'Aluna',matricula:''};p.aluno2=null;
 p.orientador={nome:'José Silva',email:'advisor@fixture.invalid',tratamento:'Professor',titulacao:'Doutor'};
 p.coorientador={nome:'Paula Costa',email:'co@fixture.invalid',tratamento:'Professora',titulacao:'Doutora'};
 p.banca=[{id:'one',nome:'Maria Santos',email:'one@fixture.invalid',funcao:'EXAMINER_2',tratamento:'Professora',titulacao:'Doutora'},{id:'two',nome:'Rui Lima',email:'two@fixture.invalid',funcao:'EXAMINER_3',tratamento:'Professor',titulacao:'Mestre'}];
 return p;
}

for(const type of ['TERMO','DECLARACAO'])test(`${type}: bloco usa exatamente nomes e papéis do snapshot, sem recriar identificação ou rodapé`,()=>{
 const p=fixture();
 const selected=[signer('STUDENT','Ana Souza',p.aluno1.email),signer('ADVISOR','Prof. Dr. José Silva',p.orientador.email),signer('EXAMINER','Prof.ª Dr.ª Maria Santos',p.banca[0].email),signer('CO_ADVISOR','Prof.ª Dr.ª Paula Costa',p.coorientador!.email),signer('PRESIDENT','Márcia Presidente','president@fixture.invalid')];
 const prefix='Título institucional\nTexto da autorização e identificação permanecem iguais.\nVitória - ES, 12 de novembro de 2026.\n\n';
 const suffix='\n\nComissão de Trabalho de Conclusão de Curso\nDepartamento de Enfermagem';
 const initial=type==='TERMO'?'Ana Souza\nAluna autora\nProf. Dr. José Silva\nOrientador':'Márcia Presidente\nPresidente da Comissão de TCC';
 const text=prefix+initial+'\nNome antigo que não assina\nExaminador'+suffix,doc=document(text),before=structuredClone(doc),frozen=structuredClone(selected);
 const requests=configuredSignatureBlockRequests(doc,p,type,selected);const result=apply(text,requests);
 assert.ok(result.startsWith(prefix));assert.ok(result.endsWith(suffix));assert.deepEqual(doc,before);assert.deepEqual(selected,frozen);
 assert.doesNotMatch(result,/Nome antigo que não assina/);
 assertConfiguredSignatureBlocks(document(result),p,type,selected);
 const rendered=documentMainBody(document(result))!.text.slice(prefix.length,-suffix.length).split('\n');
 assert.deepEqual(rendered,selected.flatMap(person=>{const row=signaturePresentation(p,person,type);return[row.name,row.role];}));
 assert.ok(requests.every(request=>!JSON.stringify(request).includes('segmentId')));
 const absent=document(result.replace('Márcia Presidente','Nome removido'));
 assert.throws(()=>assertConfiguredSignatureBlocks(absent,p,type,selected),/não preservou todos/);
 // Applying the same binding again creates no text insertion/deletion.
 assert.ok(configuredSignatureBlockRequests(document(result),p,type,selected).every(request=>!request.insertText&&!request.deleteContentRange));
});

test('bloco configurado não é anexado por adivinhação a modelo incompatível ou snapshot vazio',()=>{
 const p=fixture(),selected=[signer('PRESIDENT','Márcia Presidente','president@fixture.invalid')];
 assert.throws(()=>configuredSignatureBlockRequests(document('Somente texto de conteúdo sem assinaturas'),p,'DECLARACAO',selected),/bloco de assinaturas identificável/);
 assert.throws(()=>configuredSignatureBlockRequests(document('Texto'),p,'TERMO',[]),/precisa de signatários/);
 assert.throws(()=>configuredSignatureBlockRequests({body:{content:[{table:{}}]}},p,'TERMO',selected),/conferir o bloco/);
 assert.throws(()=>signaturePresentation(p,{...selected[0],name:'Nome\nInjetado'},'TERMO'),/nome do signatário/);
});
