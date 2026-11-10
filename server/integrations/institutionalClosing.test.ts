import test from 'node:test';
import assert from 'node:assert/strict';
import {institutionalClosingRequests,institutionalClosingStyleRequests,assertInvitationIdentification} from './institutionalClosing';
import {DOCUMENT_ISSUER_LINES} from '../../src/utils/institutionalIdentity';
import {adaptDocumentLanguage} from '../../src/utils/documentLanguage';
import {DEMO_PROCESSES} from '../../src/services/demoSeed';
import {officialParticipantLines} from '../../src/utils/officialParticipants';

function document(text:string){
 let at=1;return {tabs:[{tabProperties:{tabId:'main'},documentTab:{body:{content:text.split('\n').map(line=>{
  const startIndex=at;at+=line.length+1;return {startIndex,endIndex:at,paragraph:{elements:[{textRun:{content:line+'\n'}}]}};
 })}}}]};
}
function apply(text:string,requests:Array<Record<string,any>>){
 let value=text+'\n';
 for(const request of requests){
  if(request.deleteContentRange){const {startIndex,endIndex}=request.deleteContentRange.range;value=value.slice(0,startIndex-1)+value.slice(endIndex-1);}
  if(request.insertText){const {location,text}=request.insertText;value=value.slice(0,location.index-1)+text+value.slice(location.index-1);}
 }
 return value.replace(/\n$/,'');
}
const issued=new Date('2026-11-04T15:00:00Z');

test('invitation moves the date after Atenciosamente and keeps one complete issuer block',()=>{
 const source=['UNIVERSIDADE FEDERAL DO ESPÍRITO SANTO','CARTA-CONVITE','Vitória-ES, quarta-feira, 4 de novembro de 2026.','Título: Exemplo','Atenciosamente,',...DOCUMENT_ISSUER_LINES].join('\n');
 const output=apply(source,institutionalClosingRequests(document(source),'CONVITE',issued));
 assert.ok(output.indexOf('Título:')<output.indexOf('Atenciosamente,'));
 assert.match(output,/Atenciosamente,\n\nVitória-ES, quarta-feira, 4 de novembro de 2026\.\n\nComissão/);
 assert.equal(output.match(/Vitória/g)?.length,1);
 assert.equal(output.match(/Comissão de Trabalho de Conclusão de Curso/g)?.length,1);
 assert.ok(output.endsWith(DOCUMENT_ISSUER_LINES.join('\n')));
 assert.deepEqual(institutionalClosingRequests(document(output),'CONVITE',issued),[]);
 const styles=institutionalClosingStyleRequests(document(output));
 assert.equal(styles.length,5);
 for(const request of styles as any[]){assert.equal(request.updateParagraphStyle.paragraphStyle.alignment,'END');assert.equal(request.updateParagraphStyle.paragraphStyle.indentStart.magnitude,0);assert.equal(request.updateParagraphStyle.range.tabId,'main');}
});

test('ata removes the duplicate date and issuer after the closing, retaining signatures and letterhead',()=>{
 const closing='Nada mais havendo a tratar, às quinze horas foi encerrada a sessão e lavrada a presente ata, que segue para ser assinada.';
 const opening=['Departamento de Enfermagem','ATA','Aos seis dias do mês de novembro de 2026, foi realizada a defesa.',closing];
 const signatures=['Professora Maria','Orientadora','Professor João','Examinador','Professora Ana','Examinadora','Autora Clara','Aluna autora','Professora Paula','Coorientadora'];
 const footer='Av. Marechal Campos 1468, Maruípe';
 const source=[...opening,'Vitória - ES, sexta-feira, 6 de novembro de 2026.',...signatures,...DOCUMENT_ISSUER_LINES,footer].join('\n');
 const output=apply(source,institutionalClosingRequests(document(source),'ATA',issued));
 assert.equal(output,[...opening,...signatures,footer].join('\n'));
 assert.deepEqual(institutionalClosingRequests(document(output),'ATA',issued),[]);
 assert.deepEqual(institutionalClosingRequests(document([...opening,...signatures].join('\n')),'ATA',issued),[]);
});

test('existing issuer is standardized without changing the model header or actual signatures',()=>{
 const source='CURSO DE GRADUAÇÃO EM ENFERMAGEM E OBSTETRÍCIA\nDECLARAÇÃO\nAssinatura da presidência\nComissão dos Trabalhos de Conclusão de Curso\nDepartamento de Enfermagem\nCurso de Graduação em Enfermagem e Obstetrícia · CCS/UFES';
 const output=apply(source,institutionalClosingRequests(document(source),'DECLARACAO',issued));
 assert.ok(output.startsWith(source.split('\nComissão')[0]));assert.ok(output.endsWith(DOCUMENT_ISSUER_LINES.join('\n')));
});

test('merged invitation fields split each author and examiner without requiring the original markers',()=>{
 const p=structuredClone(DEMO_PROCESSES[0]);p.aluno2={...p.aluno1,nome:'Ana da Silva',email:'ana@example.invalid'};
 const rows=officialParticipantLines(p);const authors=rows.filter(person=>person.key.startsWith('ALUNO_')),examiners=rows.filter(person=>person.key.startsWith('EXAMINADOR_'));
 const source=`Autoria: ${authors.map(person=>person.name).join(' e ')}\nMembros convidados para a banca: ${examiners.map(person=>person.name).join(' e ')}`;
 const output=adaptDocumentLanguage(source,p,'CONVITE');
 for(const person of [...authors,...examiners])assert.ok(output.split('\n').some(line=>line===`${person.role}: ${person.name}`));
 assert.equal(output.split('\n').length,4);
 assert.equal(adaptDocumentLanguage(output,p,'CONVITE'),output,'a second pass must not duplicate the board');
 p.aluno2=null;
 assert.ok(!adaptDocumentLanguage(`Autoria: ${p.aluno1.nome}`,p,'CONVITE').includes('Ana da Silva'));
});

test('invitation validation rejects a missing or repeated identification instead of exporting an incomplete letter',()=>{
 const p=structuredClone(DEMO_PROCESSES[0]);const rows=officialParticipantLines(p).map(person=>`${person.role}: ${person.name}`);
 assert.doesNotThrow(()=>assertInvitationIdentification(document(rows.join('\n')),p));
 assert.throws(()=>assertInvitationIdentification(document(rows.slice(1).join('\n')),p),/linhas separadas/);
 assert.throws(()=>assertInvitationIdentification(document([...rows,rows[0]].join('\n')),p),/linhas separadas/);
});

test('declaration removes the old issuer block and keeps the date and signature',()=>{
 const date='Vitória - ES, segunda-feira, 9 de novembro de 2026.';
 const source=['DECLARAÇÃO','Declaro para os devidos fins.',date,
  'Comissão de Trabalho de Conclusão de Curso do','Departamento de Enfermagem',
  'Curso de Enfermagem e Obstetrícia CCS - UFES','Assinatura da presidência',...DOCUMENT_ISSUER_LINES].join('\n');
 const output=apply(source,institutionalClosingRequests(document(source),'DECLARACAO',issued));
 assert.equal(output,['DECLARAÇÃO','Declaro para os devidos fins.',date,'Assinatura da presidência',...DOCUMENT_ISSUER_LINES].join('\n'));
 assert.deepEqual(institutionalClosingRequests(document(output),'DECLARACAO',issued),[]);
 const styles=institutionalClosingStyleRequests(document(output),'DECLARACAO') as any[];
 assert.equal(styles.length,4);
 assert.ok(styles.every(style=>style.updateParagraphStyle.paragraphStyle.alignment==='END'));
 assert.equal(styles[0].updateParagraphStyle.paragraphStyle.spaceAbove.magnitude,12);
});
