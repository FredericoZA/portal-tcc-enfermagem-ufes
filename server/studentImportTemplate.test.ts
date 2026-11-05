import test from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import {studentImportTemplateXlsx,studentImportTemplateCsv,studentImportTemplateGoogleSheetsTsv,parseStudentImportFile,parseStudentImportText,accessImportRowsWithoutIdentifiers} from '../src/utils/studentImport';

test('modelo de acesso tem cabeçalhos, 100 linhas formatadas e orientações fora da área de importação',async()=>{
  const blob=await studentImportTemplateXlsx();const zip=await JSZip.loadAsync(await blob.arrayBuffer());
  assert.match(await zip.file('xl/workbook.xml')!.async('string'),/name="Orientações"/);
  let sheet=await zip.file('xl/worksheets/sheet1.xml')!.async('string');
  assert.match(sheet,/Nome completo/);assert.match(sheet,/E-mail/);assert.doesNotMatch(sheet,/Matrícula|SIAPE|CPF/);
  assert.equal([...sheet.matchAll(/<row /g)].length,101);assert.match(sheet,/state="frozen"/);assert.match(sheet,/<autoFilter ref="A1:B101"/);
  assert.doesNotMatch(await zip.file('xl/worksheets/sheet2.xml')!.async('string'),/Matrícula|SIAPE|CPF/);
  assert.match(await zip.file('xl/styles.xml')!.async('string'),/numFmtId="49"/);
  assert.deepEqual(await parseStudentImportFile(new File([blob],'modelo.xlsx')),[]);
  sheet=sheet.replace('<t xml:space="preserve"></t>','<t xml:space="preserve">Maria Silva</t>');
  sheet=sheet.replace('<t xml:space="preserve"></t>','<t xml:space="preserve">maria@example.invalid</t>');
  zip.file('xl/worksheets/sheet1.xml',sheet);
  const filled=await zip.generateAsync({type:'uint8array'});
  assert.deepEqual(accessImportRowsWithoutIdentifiers(await parseStudentImportFile(new File([filled],'preenchido.xlsx'))),[{row:2,nome:'Maria Silva',email:'maria@example.invalid'}]);
});

test('modelos textuais e importação nova pedem somente nome e e-mail sem transportar identificadores de listas antigas',()=>{
  for(const template of [studentImportTemplateCsv(),studentImportTemplateGoogleSheetsTsv()])assert.doesNotMatch(template,/matricula|SIAPE|CPF|000000/i);
  const old=parseStudentImportText('Nome;Email;Matrícula\nMaria Silva;maria@example.invalid;PRIVATE-001');
  assert.equal(old[0].matricula,'PRIVATE-001','o parser mantém compatibilidade com o formato antigo');
  assert.deepEqual(accessImportRowsWithoutIdentifiers(old),[{row:2,nome:'Maria Silva',email:'maria@example.invalid'}]);
  assert.equal(old[0].matricula,'PRIVATE-001','a projeção de importação não modifica a lista de origem');
});
