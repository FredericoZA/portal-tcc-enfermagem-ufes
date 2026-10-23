import test from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import {studentImportTemplateXlsx,parseStudentImportFile} from '../src/utils/studentImport';

test('modelo de acesso tem cabeçalhos, 100 linhas formatadas e orientações fora da área de importação',async()=>{
  const blob=await studentImportTemplateXlsx();const zip=await JSZip.loadAsync(await blob.arrayBuffer());
  assert.match(await zip.file('xl/workbook.xml')!.async('string'),/name="Orientações"/);
  let sheet=await zip.file('xl/worksheets/sheet1.xml')!.async('string');
  assert.match(sheet,/Nome completo/);assert.match(sheet,/E-mail/);assert.match(sheet,/Matrícula/);
  assert.equal([...sheet.matchAll(/<row /g)].length,101);assert.match(sheet,/state="frozen"/);assert.match(sheet,/<autoFilter ref="A1:C101"/);
  assert.match(await zip.file('xl/styles.xml')!.async('string'),/numFmtId="49"/);
  assert.deepEqual(await parseStudentImportFile(new File([blob],'modelo.xlsx')),[]);
  sheet=sheet.replace('<t xml:space="preserve"></t>','<t xml:space="preserve">Maria Silva</t>');
  sheet=sheet.replace('<t xml:space="preserve"></t>','<t xml:space="preserve">maria@example.invalid</t>');
  sheet=sheet.replace('<t xml:space="preserve"></t>','<t xml:space="preserve">000012345</t>');zip.file('xl/worksheets/sheet1.xml',sheet);
  const filled=await zip.generateAsync({type:'uint8array'});
  assert.deepEqual(await parseStudentImportFile(new File([filled],'preenchido.xlsx')),[{row:2,nome:'Maria Silva',email:'maria@example.invalid',matricula:'000012345'}]);
});
