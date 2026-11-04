import test from 'node:test';
import assert from 'node:assert/strict';
import {PDFDocument,StandardFonts} from 'pdf-lib';
import {DEMO_PROCESSES} from '../src/services/demoSeed';
import {assertPublicAcademicPdf} from './publicAcademicDocuments';
async function pdf(text:string,subject=''){
 const document=await PDFDocument.create();const font=await document.embedFont(StandardFonts.Helvetica);document.addPage().drawText(text,{font,size:12});document.setSubject(subject);return Buffer.from(await document.save());
}
test('documento público sem dados restritos preserva os bytes originais',async()=>{
 const bytes=await pdf('Ata da defesa. Banca examinadora e autores. Reserva confirmada.');const before=Buffer.from(bytes);await assertPublicAcademicPdf(bytes,structuredClone(DEMO_PROCESSES[0]));assert.deepEqual(bytes,before);
});
test('cópias públicas recusam contato, CPF, registro alfanumérico e metadados privados',async()=>{
 const process=structuredClone(DEMO_PROCESSES[0]);process.aluno1.matricula='REG-AZXY-TEST';
 for(const text of ['Contato: pessoa@example.invalid','CPF: 000.000.000-00','Documento 000.000.000-00','Telefone: (27) 3000-0000','Registro: REG-AZXY-TEST'])await assert.rejects(assertPublicAcademicPdf(await pdf('Ata da defesa. '+text),process));
 await assert.rejects(assertPublicAcademicPdf(await pdf('Ata da defesa. Banca examinadora e autores.','CPF: 000.000.000-00'),process));
});
