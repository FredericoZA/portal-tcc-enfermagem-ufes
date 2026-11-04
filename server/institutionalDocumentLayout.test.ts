import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {DOCUMENT_ISSUER_LINES} from '../src/utils/institutionalIdentity';
import {createBlankAttendanceDeclarationPdf} from '../src/utils/blankAttendanceDeclaration';
import {createRegistrationSnapshotPdf} from './documents/registrationSnapshot';
import {createReservationReceiptPdf} from './documents/reservationReceipt';
import {DEMO_PROCESSES,INITIAL_SETTINGS} from '../src/services/demoSeed';

test('generated records share the three-line right-aligned issuer, separate from the letterhead',async()=>{
 const p=structuredClone(DEMO_PROCESSES[0]);
 p.defesa.departmentResponse={revision:0,decision:'UNAVAILABLE',respondedBy:'department@example.invalid',respondedAt:'2026-11-04T15:00:00Z',startAt:p.defesa.startAt,endAt:p.defesa.endAt};
 const documents=[
  {bytes:await createBlankAttendanceDeclarationPdf(new Uint8Array(await readFile('public/national-arms.png'))),right:595.28-58,date:false},
  {bytes:await createRegistrationSnapshotPdf(p,INITIAL_SETTINGS),right:553,date:true},
  {bytes:await createReservationReceiptPdf(p,INITIAL_SETTINGS),right:549,date:true},
 ];
 const {getDocument}=await import('pdfjs-dist/legacy/build/pdf.mjs');
 for(const sample of documents){
  const task=getDocument({data:new Uint8Array(sample.bytes),verbosity:0});const pdf=await task.promise;
  try{
   const page=await pdf.getPage(pdf.numPages),content=await page.getTextContent(),items=content.items as any[];
   for(const line of DOCUMENT_ISSUER_LINES){
    const item=items.find(item=>item.str===line);assert.ok(item,`Missing issuer line: ${line}`);
    assert.ok(item.transform[5]<80,'issuing unit belongs to the closing, not the letterhead');
    assert.ok(Math.abs(item.transform[4]+item.width-sample.right)<1.5,`Issuer is not right-aligned: ${line}`);
   }
   if(sample.date){const item=items.find(item=>/^Vitória - ES,/.test(item.str));assert.ok(item);assert.ok(item.transform[5]<115);assert.ok(Math.abs(item.transform[4]+item.width-sample.right)<1.5);}
  }finally{await task.destroy();}
 }
});
