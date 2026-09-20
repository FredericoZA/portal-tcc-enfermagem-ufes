import assert from 'node:assert/strict';
import test from 'node:test';
import JSZip from 'jszip';
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
  await assert.doesNotReject(assertSafeUploadedDocument(pdf(), 'PDF'));
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
