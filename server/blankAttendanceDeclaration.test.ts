import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PDFDocument, PDFName } from 'pdf-lib';
import { createBlankAttendanceDeclarationPdf } from '../src/utils/blankAttendanceDeclaration';

test('declaração aprovada gera PDF A4 íntegro, sem imagem e com Comissão de TCC', async () => {
  const bytes = await createBlankAttendanceDeclarationPdf();
  assert.ok(bytes.byteLength > 1_000, 'o PDF deve conter a declaração completa');
  const pdf = await PDFDocument.load(bytes);
  assert.equal(pdf.getPageCount(), 1);
  assert.equal(pdf.getTitle(), 'Declaração de comparecimento - Comissão de TCC');
  assert.match(pdf.getAuthor() || '', /Departamento de Enfermagem - Comissão de TCC/);
  assert.doesNotMatch(pdf.getAuthor() || '', /Colegiado/i);
  const page = pdf.getPage(0);
  const { width, height } = page.getSize();
  assert.ok(Math.abs(width - 595.28) < 1);
  assert.ok(Math.abs(height - 841.89) < 1);
  assert.equal(pdf.getForm().getFields().length, 0);
  assert.equal(page.node.Resources()?.lookup(PDFName.of('XObject')), undefined, 'modelo não deve conter imagens');
});

test('modelo contém estrutura institucional aprovada e assinatura do orientador', () => {
  const source = readFileSync('src/utils/blankAttendanceDeclaration.ts', 'utf8');
  for (const text of [
    'UNIVERSIDADE FEDERAL DO ESPÍRITO SANTO',
    'CENTRO DE CIÊNCIAS DA SAÚDE',
    'DEPARTAMENTO DE ENFERMAGEM',
    'COMISSÃO DE TCC',
    'DECLARAÇÃO DE COMPARECIMENTO',
    'Assinatura do(a) professor(a) orientador(a)',
    'Departamento de Enfermagem · Comissão de TCC · CCS/UFES',
  ]) assert.ok(source.includes(text), `Campo ausente: ${text}`);
  assert.doesNotMatch(source, /embedPng|drawImage|loadOfficialCourseLogo|fetch\('/, 'o PDF não depende de logomarcas externas');
  assert.doesNotMatch(source, /COLEGIADO DO CURSO/i);
  assert.match(source, /declaracao-de-comparecimento-comissao-tcc\.pdf/);
});

test('barra lateral tem subtítulos, botão público e sugestões imediatamente abaixo', () => {
  const sidebar = readFileSync('src/components/Sidebar.tsx', 'utf8');
  for (const title of ['CONSULTA PÚBLICA', 'ÁREA DO USUÁRIO', 'INFORMAÇÕES']) {
    assert.ok(sidebar.includes(title));
  }
  const declaration = sidebar.indexOf("renderNavItem('declaracao-comparecimento', order.length)");
  const feedback = sidebar.indexOf("renderNavItem('sugestoes', order.length + 1)");
  assert.ok(declaration >= 0 && feedback > declaration);
  assert.match(sidebar, /await downloadBlankAttendanceDeclaration\(\)/);
});
