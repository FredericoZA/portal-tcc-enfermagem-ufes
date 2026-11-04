import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PDFDict, PDFDocument, PDFName } from 'pdf-lib';
import { createBlankAttendanceDeclarationPdf } from '../src/utils/blankAttendanceDeclaration';

test('declaração aprovada gera PDF A4 íntegro, com brasão da UFES e Comissão de Trabalho de Conclusão de Curso', async () => {
  const bytes = await createBlankAttendanceDeclarationPdf(new Uint8Array(readFileSync('public/ufes-crest.png')));
  assert.ok(bytes.byteLength > 1_000, 'o PDF deve conter a declaração completa');
  const pdf = await PDFDocument.load(bytes);
  assert.equal(pdf.getPageCount(), 1);
  assert.equal(pdf.getTitle(), 'Declaração de comparecimento - Comissão de Trabalho de Conclusão de Curso');
  assert.match(pdf.getAuthor() || '', /Departamento de Enfermagem - Comissão de Trabalho de Conclusão de Curso/);
  assert.doesNotMatch(pdf.getAuthor() || '', /Colegiado/i);
  const page = pdf.getPage(0);
  const { width, height } = page.getSize();
  assert.ok(Math.abs(width - 595.28) < 1);
  assert.ok(Math.abs(height - 841.89) < 1);
  assert.equal(pdf.getForm().getFields().length, 0);
  const imageResources = page.node.Resources()?.lookup(PDFName.of('XObject'));
  assert.ok(imageResources instanceof PDFDict && imageResources.keys().length>0, 'modelo deve conter o brasão institucional');
});

test('modelo contém estrutura institucional aprovada e assinatura do orientador', () => {
  const source = readFileSync('src/utils/blankAttendanceDeclaration.ts', 'utf8');
  for (const text of [
    'UNIVERSIDADE FEDERAL DO ESPÍRITO SANTO',
    'CENTRO DE CIÊNCIAS DA SAÚDE',
    'DEPARTAMENTO DE ENFERMAGEM',
    'COMISSÃO DE TRABALHO DE CONCLUSÃO DE CURSO',
    'DECLARAÇÃO DE COMPARECIMENTO',
    'Assinatura do(a) professor(a) orientador(a)',
    'Departamento de Enfermagem · Comissão de Trabalho de Conclusão de Curso · CCS/UFES',
  ]) assert.ok(source.includes(text), `Campo ausente: ${text}`);
  assert.match(source,/fetch\('\/ufes-crest\.png'\)/, 'o brasão deve ser um arquivo da própria aplicação');
  assert.doesNotMatch(source, /COLEGIADO DO CURSO/i);
  assert.match(source, /declaracao-de-comparecimento-comissao-tcc\.pdf/);
});

test('declaração integra o grupo Informações após Sugestões e mantém download direto', () => {
  const sidebar = readFileSync('src/components/Sidebar.tsx', 'utf8');
  for (const title of ['CONSULTA PÚBLICA', 'ÁREA DO USUÁRIO', 'INFORMAÇÕES']) assert.ok(sidebar.includes(title));
  assert.match(sidebar, /order\.splice\(informationEnd, 0, 'sugestoes', 'declaracao-comparecimento'\)/);
  assert.doesNotMatch(sidebar, /id="nav-item-manual"|mt-auto shrink-0 space-y-1/);
  assert.match(sidebar, /await downloadBlankAttendanceDeclaration\(\)/);
});
