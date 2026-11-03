import assert from 'node:assert/strict';
import test from 'node:test';
import JSZip from 'jszip';
import { deflateSync } from 'node:zlib';
import { PDFDocument, PDFName } from 'pdf-lib';
import { assertSafeUploadedDocument, UnsafeUploadError } from './fileSafety';

function pdf(body = '1 0 obj << /Type /Catalog >> endobj') {
  return Buffer.from(`%PDF-1.7\n${body}\n%%EOF\n`, 'latin1');
}

async function docx(options: { macro?: boolean; externalRelationship?: string; relationshipType?: string } = {}) {
  const zip = new JSZip();
  zip.file('[Content_Types].xml', '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"></Types>');
  zip.file('word/document.xml', '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Texto seguro</w:t></w:r></w:p></w:body></w:document>');
  if (options.macro) zip.file('word/vbaProject.bin', Buffer.from([0, 1, 2, 3]));
  if (options.externalRelationship) {
    const type = options.relationshipType || 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/image';
    zip.file('word/_rels/document.xml.rels', `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${type}" Target="${options.externalRelationship}" TargetMode="External"/></Relationships>`);
  }
  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}

test('aceita PDF estruturalmente simples sem conteúdo ativo', async () => {
  const document = await PDFDocument.create(); document.addPage();
  await assert.doesNotReject(assertSafeUploadedDocument(Buffer.from(await document.save()), 'PDF'));
});

test('bloqueia JavaScript e arquivos incorporados em PDF', async () => {
  await assert.rejects(assertSafeUploadedDocument(pdf('1 0 obj << /JavaScript 2 0 R >> endobj'), 'PDF'), UnsafeUploadError);
  await assert.rejects(assertSafeUploadedDocument(pdf('1 0 obj << /EmbeddedFile 2 0 R >> endobj'), 'PDF'), UnsafeUploadError);
});

test('bloqueia PDF truncado sem marcador EOF', async () => {
  await assert.rejects(assertSafeUploadedDocument(Buffer.from('%PDF-1.7\n1 0 obj <<>>'), 'PDF'), /término válido/i);
});

test('aceita DOCX mínimo e hyperlink HTTPS externo', async () => {
  await assert.doesNotReject(assertSafeUploadedDocument(await docx(), 'DOCX'));
  await assert.doesNotReject(assertSafeUploadedDocument(await docx({
    externalRelationship: 'https://www.ufes.br/',
    relationshipType: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink'
  }), 'DOCX'));
});

test('bloqueia macro e relacionamento externo ativo em DOCX', async () => {
  await assert.rejects(assertSafeUploadedDocument(await docx({ macro: true }), 'DOCX'), /macro|ActiveX/i);
  await assert.rejects(assertSafeUploadedDocument(await docx({ externalRelationship: 'https://tracker.example/pixel.png' }), 'DOCX'), /referência externa/i);
});

test('bloqueia assinatura EICAR antes do consumo', async () => {
  const eicar = 'X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*';
  await assert.rejects(assertSafeUploadedDocument(pdf(eicar), 'PDF'), /malware/i);
});

async function activePdf(compressed: boolean, escaped: boolean) {
  const document = await PDFDocument.create(); document.addPage();
  const action = document.context.obj({ S: PDFName.of('JavaScript'), JS: document.context.obj('app.alert(1)') });
  document.catalog.set(PDFName.of('OpenAction'), document.context.register(action));
  let bytes = Buffer.from(await document.save({ useObjectStreams: compressed }));
  if (escaped) bytes = Buffer.from(bytes.toString('latin1').replace('/JavaScript', '/Java#53cript').replace('/JS ', '/J#53 '), 'latin1');
  return bytes;
}
test('rejects escaped PDF names and actions hidden in object streams', async () => {
  for (const [compressed, escaped] of [[false,true],[true,false]]) {
    await assert.rejects(assertSafeUploadedDocument(await activePdf(compressed, escaped), 'PDF'), /recurso ativo/);
  }
});
test('accepts compressed ordinary PDFs and rejects malformed documents', async()=>{
  const document = await PDFDocument.create(); document.addPage().drawText('Trabalho acadêmico sem recursos ativos');
  await assert.doesNotReject(assertSafeUploadedDocument(Buffer.from(await document.save({useObjectStreams:true})), 'PDF'));
  await assert.rejects(assertSafeUploadedDocument(pdf(), 'PDF'), /corrompido|verificado/);
});
test('rejects an embedded file stream inside the parsed object graph',async()=>{
  const document = await PDFDocument.create(); document.addPage();
  await document.attach(Buffer.from('attachment'), 'anexo.txt');
  await assert.rejects(assertSafeUploadedDocument(Buffer.from(await document.save()), 'PDF'), /recurso ativo/);
});
test('rejects DOCX expansion from its directory before CRC expansion',async()=>{
  const bytes = await docx();
  const forged = Buffer.from(bytes);
  const central = forged.indexOf(Buffer.from([0x50,0x4b,0x01,0x02]));
  assert.ok(central >= 0);
  forged.writeUInt32LE(121*1024*1024, central+24);
  await assert.rejects(assertSafeUploadedDocument(forged, 'DOCX'), /expansão segura/);
});

test('rejects a small PDF with excessive compressed object expansion', async () => {
  const compressed = deflateSync(Buffer.alloc(8 * 1024 * 1024, 32));
  const bytes = Buffer.concat([
    Buffer.from('%PDF-1.7\n1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj\n3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 100 100] >> endobj\n4 0 obj << /Type /ObjStm /N 0 /First 0 /Filter /FlateDecode /Length ' + compressed.length + ' >> stream\n'),
    compressed,
    Buffer.from('\nendstream endobj\ntrailer << /Root 1 0 R >>\n%%EOF\n')
  ]);
  assert.ok(bytes.length < 10_000);
  await assert.rejects(assertSafeUploadedDocument(bytes, 'PDF'), UnsafeUploadError);
});
