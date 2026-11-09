import assert from 'node:assert/strict';
import test from 'node:test';
import {DEMO_PROCESSES} from '../../src/services/demoSeed';
import {ataSignatureColumnRequests,assertAtaSignatureColumnReadback} from './ataSignatureColumns';
import {documentMainBody,bodyEditRequests} from './googleDocsBody';
import type {SignatureSignerSnapshot} from '../../src/types/signatures';

function document(text:string){let index=1;return {documentStyle:{documentSize:{width:{magnitude:595.28,unit:'PT'}}},tabs:[{tabProperties:{tabId:'ata'},documentTab:{headers:{h:{content:'BRASÃO'}},footers:{f:{content:'ENDEREÇO'}},body:{content:text.split('\n').map(line=>{const startIndex=index;index+=line.length+1;return {startIndex,endIndex:index,paragraph:{paragraphStyle:{tabStops:[{offset:{magnitude:127.56,unit:'PT'},alignment:'CENTER'},{offset:{magnitude:382.68,unit:'PT'},alignment:'CENTER'}]},elements:[{textRun:{content:line+'\n'}}]}};})}}}]};}
function apply(text:string,requests:any[]){for(const request of requests){if(request.deleteContentRange){const r=request.deleteContentRange.range;text=text.slice(0,r.startIndex-1)+text.slice(r.endIndex-1);}if(request.insertText){const r=request.insertText;text=text.slice(0,r.location.index-1)+r.text+text.slice(r.location.index-1);}}return text;}
function fixture(second:boolean,present?:boolean){
 const p=structuredClone(DEMO_PROCESSES[0]);
 p.orientador={nome:'José Silva',email:'advisor@example.invalid',tratamento:'Professor',titulacao:'Doutor'};
 p.banca=[{id:'one',nome:'Maria Santos',email:'one@example.invalid',tratamento:'Professora',titulacao:'Doutora',funcao:'EXAMINER_2'},{id:'two',nome:'Rui Lima',email:'two@example.invalid',tratamento:'Professor',titulacao:'Mestre',funcao:'EXAMINER_3'}];
 p.aluno1={nome:'Ana Souza',email:'student@example.invalid',tratamento:'Aluna',matricula:''};
 p.aluno2=second?{nome:'Bruno Castro',email:'second@example.invalid',tratamento:'Aluno',matricula:''}:null;
 p.coorientador={nome:'Paula Costa',email:'co@example.invalid',tratamento:'Professora',titulacao:'Doutora'};
 p.avaliacao={...p.avaliacao,coadvisorPresent:present} as any;
 return p;
}
for(const second of [false,true])for(const present of [undefined,false,true])test(`assinaturas 3x2 editáveis, segundo=${second}, coorientador presente=${present}`,async()=>{
 const p=fixture(second,present);
 p.banca.reverse(); // Stored array order cannot swap examiner 1 and examiner 2.
 const prefix='ATA DA DEFESA\nTexto integral e parecer permanecem intactos.\n';
 const suffix='\nRodapé institucional';
 const source=prefix+'Prof. Dr. José Silva\nOrientador e Presidente\nProf.ª Dr.ª Maria Santos\nExaminadora\nProf. Me. Rui Lima\nExaminador\nAna Souza\nAluna autora\n'+(second?'Bruno Castro\nAluno autor\n':'')+'Prof.ª Dr.ª Paula Costa\nCoorientadora'+suffix;
 const doc=document(source),before=JSON.stringify(doc);
 const requests=await ataSignatureColumnRequests(doc,p),rendered=apply(source,requests);
 assert.ok(rendered.startsWith(prefix));assert.ok(rendered.endsWith(suffix));
 assert.match(rendered,/\tProf\. Dr\. José Silva\tAna Souza\n\tOrientador e Presidente\tAluna autora/);
 assert.ok(rendered.includes(`\tProf.ª Dr.ª Maria Santos\t${second?'Bruno Castro':''}\n\tExaminadora\t${second?'Aluno autor':''}`));
 assert.ok(rendered.includes(`\tProf. Me. Rui Lima\t${present===true?'Prof.ª Dr.ª Paula Costa':''}\n\tExaminador\t${present===true?'Coorientadora':''}`));
 assert.equal(rendered.includes('Paula Costa'),present===true);
 const styles=requests.filter(r=>r.updateParagraphStyle);
 assert.equal(styles.length,6);
 for(const {updateParagraphStyle:s} of styles){assert.equal(s.range.tabId,'ata');assert.equal('tabStops' in s.paragraphStyle,false);assert.ok(!s.fields.includes('tabStops'));}
 assertAtaSignatureColumnReadback(document(rendered),requests.signatureRows!);
 const lost=document(rendered);lost.tabs[0].documentTab.body.content.find(p=>p.paragraph.elements[0].textRun.content.startsWith('\tExaminador\t'))!.paragraph.paragraphStyle.tabStops=[];
 assert.throws(()=>assertAtaSignatureColumnReadback(lost,requests.signatureRows!),/todos os blocos/);
 assert.ok(requests.every(request=>!JSON.stringify(request).includes('segmentId')&&!request.insertTable));
 assert.equal(JSON.stringify(doc),before);
 const read=documentMainBody(document(rendered));assert.equal(read?.text,rendered);
 const edit=bodyEditRequests(document(rendered),rendered.replace('parecer permanecem','parecer revisado permanecem'));
 assert.ok(edit.every(request=>!JSON.stringify(request).includes('José Silva')&&!JSON.stringify(request).includes('Ana Souza')));
});
test('nomes longos quebram nas colunas sem abreviar ou perder palavras',async()=>{
 const p=fixture(true,true);p.orientador.nome='João Guilherme de Albuquerque Cavalcanti de Vasconcelos e Silva';
 const source=`Corpo\nProf. Dr. ${p.orientador.nome}\nOrientador e Presidente\nProf.ª Dr.ª Maria Santos\nExaminadora\nProf. Me. Rui Lima\nExaminador\nAna Souza\nAluna autora\nBruno Castro\nAluno autor\nProf.ª Dr.ª Paula Costa\nCoorientadora`;
 const requests=await ataSignatureColumnRequests(document(source),p),rendered=apply(source,requests);
 const left=rendered.split('\n').filter(line=>line.startsWith('\t')).map(line=>line.split('\t')[1]).join(' ').replace(/\s+/g,' ');
 assert.ok(left.includes(`Prof. Dr. ${p.orientador.nome}`));
 assert.ok(requests.filter(r=>r.updateParagraphStyle).length>6);
});
test('Google Docs nativo sem tabulações compatíveis falha sem emitir setter read-only',async()=>{
 const p=fixture(false,false);
 const source='Prof. Dr. José Silva\nOrientador e Presidente\nProf.ª Dr.ª Maria Santos\nExaminadora\nProf. Me. Rui Lima\nExaminador\nAna Souza\nAluna autora';
 const doc=document(source);doc.tabs[0].documentTab.body.content[0].paragraph.paragraphStyle.tabStops=[];
 await assert.rejects(ataSignatureColumnRequests(doc,p),/duas tabulações centrais/);
});

test('snapshot configurado inclui Presidência em vaga livre, preserva três colunas de banca e limita seis assinaturas',async()=>{
 const p=fixture(false,false);
 const source='Corpo e parecer preservados\nProf. Dr. José Silva\nOrientador e Presidente\nProf.ª Dr.ª Maria Santos\nExaminadora\nProf. Me. Rui Lima\nExaminador\nAna Souza\nAluna autora\nProf.ª Dr.ª Paula Costa\nCoorientadora\nRodapé';
 const person=(role:SignatureSignerSnapshot['role'],name:string,email:string):SignatureSignerSnapshot=>({id:email,role,name,email,signingOrder:1,status:'WAITING'});
 const signers=[person('ADVISOR','Prof. Dr. José Silva',p.orientador.email),person('EXAMINER','Prof.ª Dr.ª Maria Santos',p.banca[0].email),person('EXAMINER','Prof. Me. Rui Lima',p.banca[1].email),person('STUDENT','Ana Souza',p.aluno1.email),person('PRESIDENT','Márcia Presidente','president@fixture.invalid')];
 const frozen=structuredClone(signers);const requests=await ataSignatureColumnRequests(document(source),p,signers);const result=apply(source,requests);
 assert.match(result,/\tProf\.ª Dr\.ª Maria Santos\tMárcia Presidente\n\tExaminadora\tPresidência da Comissão de TCC/);
 assert.doesNotMatch(result,/Paula Costa/);assert.ok(result.startsWith('Corpo e parecer preservados\n'));assert.ok(result.endsWith('\nRodapé'));assert.deepEqual(signers,frozen);
 assertAtaSignatureColumnReadback(document(result),requests.signatureRows!);
 await assert.rejects(ataSignatureColumnRequests(document(source),p,[...signers,...signers.slice(0,2)]),/entre quatro e seis/);
 await assert.rejects(ataSignatureColumnRequests(document('Modelo sem blocos de assinatura'),p,signers),/bloco identificável/);
});
