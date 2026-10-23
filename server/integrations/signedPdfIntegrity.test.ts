import test from 'node:test';
import assert from 'node:assert/strict';
import {PDFDocument} from 'pdf-lib';
import {assertSignedPdfIntegrity} from './signedPdfIntegrity';
test('arquivamento aceita PDF válido e recusa cabeçalho falso, arquivo truncado e PDF vazio',async()=>{
  const doc=await PDFDocument.create();doc.addPage();const bytes=Buffer.from(await doc.save());
  await assertSignedPdfIntegrity(bytes);
  await assert.rejects(assertSignedPdfIntegrity(Buffer.from('%PDF-1.7\nconteudo-corrompido\n%%EOF')),/corrompido/);
  await assert.rejects(assertSignedPdfIntegrity(bytes.subarray(0,50)),/corrompido/);
  const empty=await PDFDocument.create();await assert.rejects(assertSignedPdfIntegrity(Buffer.from(await empty.save({addDefaultPage:false}))),/corrompido/);
});
