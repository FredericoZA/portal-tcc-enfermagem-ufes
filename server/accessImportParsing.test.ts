import test from 'node:test';
import assert from 'node:assert/strict';
import {PDFDocument,StandardFonts} from 'pdf-lib';
import JSZip from 'jszip';
import {parseStudentImportText,parseStudentImportFile,studentImportTemplateXlsx} from '../src/utils/studentImport';
import {accessImportIssues} from '../src/utils/accessImportValidation';

const person={nome:'Maria Silva',email:'maria@example.invalid',matricula:'0000123'};
test('acesso aceita cabeçalhos usuais, separadores de Excel e células entre aspas',()=>{
 for(const delimiter of [';',',','\t']){
  const rows=parseStudentImportText(`Nome completo${delimiter}E-mail institucional${delimiter}Matrícula\nMaria Silva${delimiter}maria@example.invalid${delimiter}0000123`);
  assert.deepEqual(rows,[{...person,row:2}]);
 }
 assert.deepEqual(parseStudentImportText('sep=;\r\nNome;Email;Registro\r\n"Maria; Silva";maria@example.invalid;0000123')[0],{...person,row:2,nome:'Maria; Silva'});
});
test('acesso aceita lista sem cabeçalho, email primeiro e formato de contato',()=>{
 for(const input of ['Maria Silva\tmaria@example.invalid\t0000123','maria@example.invalid;Maria Silva;0000123','Maria Silva <maria@example.invalid> 0000123'])assert.deepEqual(parseStudentImportText(input),[{...person,row:1}]);
 assert.equal(parseStudentImportText("Anne O’Neill <anne@example.invalid>")[0].nome,'Anne O’Neill');
 assert.equal(parseStudentImportText('Nome completo  E-mail  Matrícula\nMaria Silva  maria@example.invalid  0000123')[0].nome,'Maria Silva');
});
test('erros e duplicações aparecem antes da autorização sem descartar linhas silenciosamente',()=>{
 const rows=parseStudentImportText('nome;email\nMaria;maria@example.invalid\nOutra;maria@example.invalid\nInvalida;email errado\n;vazio@example.invalid');
 assert.deepEqual(accessImportIssues(rows).map(x=>x.row),[3,4,5]);
 assert.throws(()=>parseStudentImportText('Maria sem email'),/Linha 1/);
 assert.throws(()=>parseStudentImportText('nome;email\n"Maria;maria@example.invalid'),/aspas/);
 assert.throws(()=>parseStudentImportText(Array(1001).fill('Maria;maria@example.invalid').join('\n')),/1.000/);
});
test('CSV Windows preserva acentos e zeros à esquerda',async()=>{
 const content=Buffer.from('Nome;E-mail;Matrícula\r\nAndr\xe9 Silva;andre@example.invalid;0000123','latin1');
 const rows=await parseStudentImportFile(new File([content],'LISTA.CSV'));
 assert.equal(rows[0].nome,'André Silva');assert.equal(rows[0].matricula,'0000123');
});
test('cabeçalho reconhecido preserva registros alfabéticos, espaçados e zeros à esquerda',()=>{
 for(const delimiter of [';',',','\t'])for(const matricula of ['ABC','2026 001','0000123','AB 001 / XY']){
  const input=`Nome completo${delimiter}E-mail${delimiter}Matrícula\nMaria Silva${delimiter}maria@example.invalid${delimiter}${matricula}`;
  assert.deepEqual(parseStudentImportText(input),[{row:2,nome:'Maria Silva',email:'maria@example.invalid',matricula}]);
  const reordered=`Matrícula${delimiter}Nome completo${delimiter}E-mail\n${matricula}${delimiter}Maria Silva${delimiter}maria@example.invalid`;
  assert.deepEqual(parseStudentImportText(reordered),[{row:2,nome:'Maria Silva',email:'maria@example.invalid',matricula}]);
 }
 assert.deepEqual(parseStudentImportText('nome;email;matricula\n"Maria; Silva";maria@example.invalid;ABC'),[{row:2,nome:'Maria; Silva',email:'maria@example.invalid',matricula:'ABC'}]);
});
test('XLSX com colunas reconhecidas preserva registro sem números e com espaços',async()=>{
 for(const matricula of ['ABC','2026 001']){
  const blob=await studentImportTemplateXlsx(),zip=await JSZip.loadAsync(await blob.arrayBuffer());
  let sheet=await zip.file('xl/worksheets/sheet1.xml')!.async('string');
  for(const value of ['Maria Silva','maria@example.invalid',matricula])sheet=sheet.replace('<t xml:space="preserve"></t>',`<t xml:space="preserve">${value}</t>`);
  zip.file('xl/worksheets/sheet1.xml',sheet);
  const bytes=await zip.generateAsync({type:'uint8array'});
  assert.deepEqual(await parseStudentImportFile(new File([bytes],'lista.xlsx')),[{row:2,nome:'Maria Silva',email:'maria@example.invalid',matricula}]);
 }
});
test('PDF textual é lido localmente e PDF sem texto informa alternativa',async()=>{
 const doc=await PDFDocument.create(),font=await doc.embedFont(StandardFonts.Helvetica),page=doc.addPage();
 for(const [x,text] of [[40,'Nome completo'],[240,'E-mail'],[440,'Matrícula']] as const)page.drawText(text,{x,y:750,font,size:10});
 for(const [x,text] of [[40,'Maria Silva'],[240,'maria@example.invalid'],[440,'0000123']] as const)page.drawText(text,{x,y:730,font,size:10});
 assert.deepEqual(await parseStudentImportFile(new File([await doc.save()],'lista.pdf')),[{...person,row:2}]);
 const blank=await PDFDocument.create();blank.addPage();
 const bytes=await blank.save();await assert.rejects(()=>parseStudentImportFile(new File([bytes],'sem-texto.pdf')),/apenas imagens/);
});

test('lista colada recupera matrícula, nome e email quando a ordem diverge do cabeçalho',()=>{
 for(const delimiter of ['\t','  ',' ']){
  const rows=parseStudentImportText(`Nome completo E-mail Matrícula\n0002022100663${delimiter}Pessoa de Teste${delimiter}pessoa@example.invalid\n2022100660${delimiter}Outra Pessoa${delimiter}outra@example.invalid`);
  assert.deepEqual(rows,[{row:2,nome:'Pessoa de Teste',email:'pessoa@example.invalid',matricula:'0002022100663'},{row:3,nome:'Outra Pessoa',email:'outra@example.invalid',matricula:'2022100660'}]);
  assert.deepEqual(accessImportIssues(rows),[]);
 }
});

test('sem cabeçalho identifica as seis ordens, espaços mistos e matrícula alfanumérica',()=>{
 const fields=['Anne O’Neill-Silva','anne@example.invalid','000123-AB'];
 const permutations=[[0,1,2],[0,2,1],[1,0,2],[1,2,0],[2,0,1],[2,1,0]];
 for(const order of permutations)for(const separator of [' ','  ','\t',';']){
  const rows=parseStudentImportText(order.map(i=>fields[i]).join(separator));
  assert.deepEqual(rows,[{row:1,nome:fields[0],email:fields[1],matricula:fields[2]}]);
 }
 assert.deepEqual(parseStudentImportText('Maria Silva 000123 maria@example.invalid'),[{row:1,...person}].map(p=>({...p,matricula:'000123'})));
 assert.deepEqual(parseStudentImportText('anne@example.invalid Anne O’Neill'),[{row:1,nome:'Anne O’Neill',email:'anne@example.invalid',matricula:undefined}]);
 assert.throws(()=>parseStudentImportText('Maria 123 456 maria@example.invalid'),/mais de um código/);
 assert.throws(()=>parseStudentImportText('Maria maria@example.invalid outra@example.invalid'),/único e-mail/);
});
