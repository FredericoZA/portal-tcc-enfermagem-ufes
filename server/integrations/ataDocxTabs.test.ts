import assert from 'node:assert/strict';
import test from 'node:test';
import JSZip from 'jszip';
import {prepareAtaDocxTabs} from './ataDocxTabs';

test('prepara tabs na cópia DOCX preservando texto, estilos, cabeçalhos, rodapé e original',async()=>{
 const zip=new JSZip();
 const xml='<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:pPr><w:pStyle w:val="Normal"/><w:spacing w:after="0"/><w:rPr><w:b/></w:rPr></w:pPr><w:r><w:t>Nome e parecer intactos</w:t></w:r></w:p><w:p><w:r><w:t>Assinatura</w:t></w:r></w:p><w:p><w:pPr><w:tabs><w:tab w:val="left" w:pos="100"/></w:tabs></w:pPr><w:r><w:tab/><w:t>Alinhamento próprio</w:t></w:r></w:p><w:sectPr><w:pgSz w:w="11906" w:h="16838"/></w:sectPr></w:body></w:document>';
 zip.file('word/document.xml',xml);zip.file('word/header1.xml','BRASÃO INTACTO');zip.file('word/footer1.xml','RODAPÉ INTACTO');zip.file('word/media/crest.png',Buffer.from([1,2,3]));
 const original=await zip.generateAsync({type:'nodebuffer'}),snapshot=Buffer.from(original);
 const result=await prepareAtaDocxTabs(original),copy=await JSZip.loadAsync(result);
 assert.deepEqual(original,snapshot);
 for(const path of ['word/header1.xml','word/footer1.xml','word/media/crest.png'])assert.deepEqual(await copy.file(path)!.async('nodebuffer'),await zip.file(path)!.async('nodebuffer'));
 const updated=await copy.file('word/document.xml')!.async('string');
 assert.equal(updated.replace(/<w:tabs><w:tab w:val="center"[^]*?<\/w:tabs>/g,''),xml.replace('<w:p><w:r><w:t>Assinatura','<w:p><w:pPr></w:pPr><w:r><w:t>Assinatura'));
 assert.equal((updated.match(/w:val="center"/g)||[]).length,4);
 assert.ok(updated.indexOf('<w:pStyle')<updated.indexOf('<w:tabs'));
 assert.ok(updated.indexOf('<w:tabs')<updated.indexOf('<w:spacing'));
 assert.deepEqual(await prepareAtaDocxTabs(result),result,'transformation is byte-idempotent');
});
test('recusa ZIP sem documento e tamanho inválido',async()=>{
 const zip=new JSZip();zip.file('outra-parte.xml','texto');
 await assert.rejects(prepareAtaDocxTabs(await zip.generateAsync({type:'nodebuffer'})),/document.xml/);
 await assert.rejects(prepareAtaDocxTabs(Buffer.alloc(0)),/16 MB/);
});
