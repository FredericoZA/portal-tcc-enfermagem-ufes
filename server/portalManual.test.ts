import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PDFDocument} from 'pdf-lib';

test('manual público é PDF legível, com navegação e as três seções de participantes',async()=>{
  const bytes=readFileSync('public/manual/manual-portal-tcc.pdf');
  assert.equal(bytes.subarray(0,5).toString(),'%PDF-');
  const pdf=await PDFDocument.load(bytes);
  assert.equal(pdf.getPageCount(),17);
  assert.match(pdf.getTitle()||'',/Manual do Portal de TCC/);
  assert.match(pdf.getSubject()||'',/Aluno, orientador e examinador/);
  assert.match(pdf.getSubject()||'',/entrega obrigatória, publicação opcional/);
  assert.ok(pdf.getPages()[0].node.Annots()?.size(),'Capa com links para as seções');
  for (const page of pdf.getPages()) {
    assert.ok(page.getWidth()>590&&page.getHeight()>840,'Páginas A4');
  }
});

test('atalhos públicos usam o mesmo grupo e o manual abre o PDF diretamente',()=>{
  const sidebar=readFileSync('src/components/Sidebar.tsx','utf8');
  const declaration=sidebar.indexOf("renderNavItem('declaracao-comparecimento', order.length)");
  const manual=sidebar.indexOf('id="nav-item-manual"');
  const suggestions=sidebar.indexOf("renderNavItem('sugestoes', order.length + 1)");
  assert.ok(declaration>=0&&manual>declaration&&suggestions>manual);
  assert.match(sidebar,/href="\/manual\/manual-portal-tcc\.pdf" target="_blank" rel="noopener noreferrer"/);
});
