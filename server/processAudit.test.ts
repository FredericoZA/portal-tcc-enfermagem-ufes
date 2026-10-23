import test from 'node:test';
import assert from 'node:assert/strict';
import {auditChanges} from '../src/utils/processAudit';
import {createProfessionalPdf} from './documents/simplePdf';
test('audit differences show previous/new schedule and exclude embedded credentials and files',()=>{
 const text=auditChanges({before:{defesa:{startAt:'2026-10-15T13:00',local:'A'},token:'hidden'},after:{defesa:{startAt:'2026-10-16T14:00',local:'B'},token:'new-hidden',artifactBase64:'private'}});
 assert.match(text,/defesa.startAt: 2026-10-15T13:00 → 2026-10-16T14:00/);assert.match(text,/defesa.local: A → B/);assert.doesNotMatch(text,/hidden|private/);
});
test('PDF history retains all events across multiple pages',()=>{
 const body=Array.from({length:150},(_,i)=>`EVENT-${i} pessoa@example.org: agendamento alterado`).join('\n');
 const pdf=createProfessionalPdf({title:'Histórico',protocol:'TCC-2026-0001',body}).toString('latin1');
 assert.match(pdf,/EVENT-0 /);assert.match(pdf,/EVENT-149 /);assert.match(pdf,/\/Count [2-9]/);
});
