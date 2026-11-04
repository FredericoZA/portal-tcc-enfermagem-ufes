import test from 'node:test';
import assert from 'node:assert/strict';
import {PDFDocument} from 'pdf-lib';
import {createReservationReceiptPdf} from './documents/reservationReceipt';
import {DEMO_PROCESSES,INITIAL_SETTINGS} from '../src/services/demoSeed';

async function textOf(bytes:Buffer){const {getDocument}=await import('pdfjs-dist/legacy/build/pdf.mjs');const task=getDocument({data:new Uint8Array(bytes),verbosity:0});const pdf=await task.promise;try{const rows=[];for(let i=1;i<=pdf.numPages;i++){const content=await(await pdf.getPage(i)).getTextContent();rows.push(content.items.map((item:any)=>item.str||'').join(' '));}return rows.join('\n');}finally{await task.destroy();}}
test('department receipt has institutional identity, preserves the recorded response and excludes student registration numbers',async()=>{
 const p=structuredClone(DEMO_PROCESSES[0]);p.aluno1.matricula='202699991';p.titulo='Título atual diferente';
 p.defesa.departmentResponse={revision:0,decision:'CONFIRMED',respondedAt:'2026-10-27T02:26:01Z',respondedBy:'departamento@example.invalid',startAt:'2026-10-23T17:00:00Z',endAt:'2026-10-23T18:30:00Z',local:'Sala de reuniões',receiptBody:'Título: TÍTULO REGISTRADO NO SUS\nAutoria: 202699991 - Nome Social\n'};
 const bytes=await createReservationReceiptPdf(p,INITIAL_SETTINGS),pdf=await PDFDocument.load(bytes);assert.equal(pdf.getPageCount(),1);
 const text=await textOf(bytes);assert.match(text,/Universidade Federal do Espírito Santo/);assert.match(text,/Curso de Graduação em Enfermagem e Obstetrícia/);assert.match(text,/RESERVA CONFIRMADA/);assert.match(text,/Título Registrado no SUS/);assert.match(text,/Nome Social/);assert.match(text,/14:00 às 15:30/);assert.match(text,/sexta-feira, 23 de outubro de 2026/);assert.match(text,/26\/10\/2026, 23:26/);assert.doesNotMatch(text,/202699991|NÃO CONFIGURAD|Título atual diferente|2026-10-27T|Revisão da solicitação/);
 p.defesa.departmentResponse.decision='UNAVAILABLE';const denied=await textOf(await createReservationReceiptPdf(p,INITIAL_SETTINGS));assert.match(denied,/RESERVA RECUSADA/);assert.doesNotMatch(denied,/RESERVA CONFIRMADA/);
});

test('legacy local confirmations use the same branded receipt without inventing an unrecorded confirmation',async()=>{
 const p=structuredClone(DEMO_PROCESSES[0]);delete p.defesa.departmentResponse;
 p.defesa.localStatus='CONFIRMADO';p.defesa.localConfirmedAt='2026-10-27T02:26:01Z';p.defesa.localConfirmedBy='departamento@example.invalid';
 const text=await textOf(await createReservationReceiptPdf(p,INITIAL_SETTINGS));
 assert.match(text,/Universidade Federal do Espírito Santo/);assert.match(text,/Comprovante de reserva/);assert.match(text,/departamento@example.invalid/);
 p.defesa.localConfirmedAt=undefined;await assert.rejects(createReservationReceiptPdf(p,INITIAL_SETTINGS),/não registrada/);
});

test('public receipt excludes responder email and participant registration',async()=>{
 const p=structuredClone(DEMO_PROCESSES[0]);
 p.aluno1.matricula='PRIVATE-123456';
 p.defesa.departmentResponse={revision:0,decision:'CONFIRMED',respondedAt:'2026-10-27T02:26:01Z',respondedBy:'private-department@example.invalid',startAt:'2026-10-23T17:00:00Z',endAt:'2026-10-23T18:30:00Z',local:'Sala de reuniões',receiptBody:''};
 const text=await textOf(await createReservationReceiptPdf(p,INITIAL_SETTINGS,{publicView:true}));
 assert.doesNotMatch(text,/private-department|PRIVATE-123456|@/);
 assert.match(text,/RESERVA CONFIRMADA/);
});


test('receipt lists each author inline and publishes only the recorded institutional department address',async()=>{
 const p=structuredClone(DEMO_PROCESSES[0]);p.aluno1.nome='Ana de Souza';p.aluno2={nome:'Beatriz Lima',email:'student-private@example.invalid',matricula:'PRIVATE-7654321',tratamento:'Aluna'};
 p.defesa.departmentResponse={revision:0,decision:'UNAVAILABLE',attribution:'EMAIL_LINK',departmentEmail:'reservas@example.invalid',respondedBy:'reservas@example.invalid',respondedAt:'2026-11-04T15:41:00Z',startAt:'2026-12-07T18:30:00Z',endAt:'2026-12-07T20:00:00Z',receiptBody:'Título: Segurança do Paciente\nAutor: Ana de Souza\nAutor: Beatriz Lima'};
 const text=await textOf(await createReservationReceiptPdf(p,INITIAL_SETTINGS,{publicView:true}));
 assert.match(text,/Título do TCC: Segurança do Paciente/);assert.match(text,/Autor: Ana de Souza/);assert.match(text,/Autor: Beatriz Lima/);
 assert.match(text,/link enviado a/);assert.match(text,/reservas@example.invalid/);assert.doesNotMatch(text,/student-private|PRIVATE-7654321|Autores/);
 p.defesa.departmentResponse.departmentEmail=undefined;p.defesa.departmentResponse.respondedBy='advisor-private@example.invalid';
 const external=await textOf(await createReservationReceiptPdf(p,INITIAL_SETTINGS,{publicView:true}));assert.doesNotMatch(external,/@/);
});
