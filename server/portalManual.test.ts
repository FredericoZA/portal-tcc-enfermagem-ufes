import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PDFDocument} from 'pdf-lib';

test('manual público é PDF legível, com navegação e seções dos quatro perfis',async()=>{
  const bytes=readFileSync('public/manual/manual-portal-tcc.pdf');
  assert.equal(bytes.subarray(0,5).toString(),'%PDF-');
  const pdf=await PDFDocument.load(bytes);
  assert.equal(pdf.getPageCount(),21);
  assert.match(pdf.getTitle()||'',/Manual do Portal de TCC/);
  assert.match(pdf.getSubject()||'',/Aluno, orientador e examinador/);
  assert.match(pdf.getSubject()||'',/entrega obrigatória, publicação opcional/);
  assert.match(pdf.getSubject()||'',/visitante.*Asten e Gov.br/);
  assert.ok(pdf.getPages()[0].node.Annots()?.size(),'Capa com links para as seções');
  for (const page of pdf.getPages()) {
    assert.ok(page.getWidth()>590&&page.getHeight()>840,'Páginas A4');
  }
});

test('manual em PDF fica abaixo do tutorial e é compartilhado pelos perfis',()=>{
  const sidebar=readFileSync('src/components/Sidebar.tsx','utf8');
  const tutorial=readFileSync('src/pages/PortalTutorialPage.tsx','utf8');
  assert.doesNotMatch(sidebar,/id="nav-item-manual"/);
  assert.match(tutorial,/id="tutorial-manual-pdf" href="\/manual\/manual-portal-tcc\.pdf" target="_blank" rel="noopener noreferrer"/);
  const headerEnd=tutorial.indexOf('</section>'),guideStart=tutorial.indexOf('<PortalIllustratedGuide');
  const linkStart=tutorial.indexOf('id="tutorial-manual-pdf"');
  assert.ok(headerEnd>=0&&guideStart>headerEnd);
  const linkWrapper = tutorial.lastIndexOf('<div', linkStart);
  assert.ok(linkWrapper > guideStart);
  assert.match(tutorial.slice(guideStart, linkWrapper), /<PortalIllustratedGuide[^>]*\/>\s*<\/div>\s*<\/div>\s*$/);
  assert.match(tutorial.slice(linkWrapper, linkStart), /mt-4 flex justify-center/);
  assert.match(tutorial, /Acesse o manual detalhado em PDF/);
  assert.doesNotMatch(tutorial, /tutorial-manual-notice/);
});
