import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PDFDocument } from 'pdf-lib';
import { createBlankAttendanceDeclarationPdf } from '../src/utils/blankAttendanceDeclaration';

test('declaração de comparecimento produz um PDF A4 em branco para preenchimento manual', async () => {
  const bytes = await createBlankAttendanceDeclarationPdf();
  assert.ok(bytes.byteLength > 800);
  const pdf = await PDFDocument.load(bytes);
  assert.equal(pdf.getPageCount(), 1);
  assert.equal(pdf.getTitle(), 'Declaração de comparecimento - modelo em branco');
  const { width, height } = pdf.getPage(0).getSize();
  assert.ok(Math.abs(width - 595.28) < 1);
  assert.ok(Math.abs(height - 841.89) < 1);
  assert.equal(pdf.getForm().getFields().length, 0);
});

test('barra lateral expõe download público direto acima das sugestões', () => {
  const sidebar = readFileSync('src/components/Sidebar.tsx', 'utf8');
  for (const title of ['CONSULTA PÚBLICA', 'ÁREA DO USUÁRIO', 'INFORMAÇÕES']) {
    assert.ok(sidebar.includes(title));
  }
  const downloadPosition = sidebar.indexOf("renderNavItem('declaracao-comparecimento', order.length)");
  const feedbackPosition = sidebar.indexOf("renderNavItem('sugestoes', order.length + 1)");
  assert.ok(downloadPosition >= 0 && feedbackPosition > downloadPosition);
  assert.match(sidebar, /await downloadBlankAttendanceDeclaration\(\)/);
});
