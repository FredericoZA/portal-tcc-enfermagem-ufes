import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PDFDict, PDFDocument, PDFName } from 'pdf-lib';
import { createBlankAttendanceDeclarationPdf } from '../src/utils/blankAttendanceDeclaration';

test('declaração usa PDF A4 em branco, cabeçalho com logo COLENF e rodapé discreto', async () => {
  const logo = new Uint8Array(readFileSync('public/colenf-logo.png'));
  const bytes = await createBlankAttendanceDeclarationPdf(logo);
  assert.ok(bytes.byteLength > logo.byteLength);
  const pdf = await PDFDocument.load(bytes);
  assert.equal(pdf.getPageCount(), 1);
  assert.equal(pdf.getTitle(), 'Declaração de comparecimento - modelo em branco');
  const { width, height } = pdf.getPage(0).getSize();
  assert.ok(Math.abs(width - 595.28) < 1);
  assert.ok(Math.abs(height - 841.89) < 1);
  assert.equal(pdf.getForm().getFields().length, 0);
  const resources = pdf.getPage(0).node.Resources();
  const imageObjects = resources?.lookup(PDFName.of('XObject'), PDFDict);
  assert.ok(imageObjects && imageObjects.size() >= 1, 'a logomarca oficial precisa estar embutida no PDF');

  const source = readFileSync('src/utils/blankAttendanceDeclaration.ts', 'utf8');
  assert.match(source, /fetch\('\/colenf-logo\.png'/);
  assert.match(source, /COLEGIADO DO CURSO DE ENFERMAGEM E OBSTETRÍCIA/);
  assert.match(source, /Assinatura do\(a\) professor\(a\) orientador\(a\)/);
  assert.doesNotMatch(source, /page\.drawRectangle\(/, 'não usar barras ou caixas decorativas no documento');
});

test('barra lateral mantém o download público diretamente acima das sugestões', () => {
  const sidebar = readFileSync('src/components/Sidebar.tsx', 'utf8');
  for (const title of ['CONSULTA PÚBLICA', 'ÁREA DO USUÁRIO', 'INFORMAÇÕES']) {
    assert.ok(sidebar.includes(title));
  }
  const declaration = sidebar.indexOf("renderNavItem('declaracao-comparecimento', order.length)");
  const feedback = sidebar.indexOf("renderNavItem('sugestoes', order.length + 1)");
  assert.ok(declaration >= 0 && feedback > declaration);
  assert.match(sidebar, /await downloadBlankAttendanceDeclaration\(\)/);
});
