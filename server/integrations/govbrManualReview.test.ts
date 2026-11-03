import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {PDFDocument} from 'pdf-lib';
import type {SignatureJob} from '../../src/types/signatures';
import {pdfWithTestSignature} from '../../scripts/fixtures/govbr-test-pdf.mjs';
import {inspectGovbrReturnedPdf,assertGovbrManualApproval} from './govbrManualReview';

const hash=(bytes:Buffer)=>createHash('sha256').update(bytes).digest('hex');
async function original(){const doc=await PDFDocument.create();doc.addPage().drawText('DECLARACAO TESTE TCC-123');return Buffer.from(await doc.save());}

test('PDF sem assinatura digital, original errado e conteúdo alterado não avançam para conferência',async()=>{
  const bytes=await original();
  await assert.rejects(inspectGovbrReturnedPdf(bytes,bytes,hash(bytes)),/assinatura digital/);
  await assert.rejects(inspectGovbrReturnedPdf(bytes,await pdfWithTestSignature(bytes),'0'.repeat(64)),/original/);
  await assert.rejects(inspectGovbrReturnedPdf(bytes,await pdfWithTestSignature(bytes,{alterContent:true}),hash(bytes)),/conteúdo/);
  await assert.rejects(inspectGovbrReturnedPdf(bytes,Buffer.from('<html>PDF</html>'),hash(bytes)),/PDF/);
});

test('conferência estrutural retorna hash sem afirmar validade criptográfica do CMS de teste',async()=>{
  const bytes=await original(),returned=await pdfWithTestSignature(bytes);
  assert.equal(await inspectGovbrReturnedPdf(bytes,returned,hash(bytes)),hash(returned));
  await assert.rejects(inspectGovbrReturnedPdf(bytes,Buffer.concat([returned,Buffer.from('ALTERACAO')]),hash(bytes)),/assinatura digital/);
});

test('aprovação manual exige hash exato, revisão atual, provedor correto e três confirmações explícitas',()=>{
  const job={provider:'GOV_BR',documentType:'DECLARACAO',status:'READY_FOR_REVIEW',sourceDataRevision:4,govbrReview:{sha256:'a'.repeat(64)}} as SignatureJob;
  const confirmation={sha256:'a'.repeat(64),itiApproved:true,signerMatches:true,documentMatches:true};
  assert.doesNotThrow(()=>assertGovbrManualApproval(job,4,confirmation));
  assert.throws(()=>assertGovbrManualApproval(job,5,confirmation),/dados/);
  assert.throws(()=>assertGovbrManualApproval(job,4,{...confirmation,sha256:'b'.repeat(64)}),/substituído/);
  for(const field of ['itiApproved','signerMatches','documentMatches'])assert.throws(()=>assertGovbrManualApproval(job,4,{...confirmation,[field]:false}),/Confirme/);
  assert.throws(()=>assertGovbrManualApproval({...job,provider:'ASTEN'},4,confirmation),/fluxo Gov/);
  assert.throws(()=>assertGovbrManualApproval({...job,status:'CANCELED'},4,confirmation),/fluxo Gov/);
});
