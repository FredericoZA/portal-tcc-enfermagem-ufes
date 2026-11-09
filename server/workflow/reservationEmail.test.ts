import test from 'node:test';
import assert from 'node:assert/strict';
import {reservationDepartmentEmail} from './reservationEmail';
test('reserva aceita endereço com s e ponto e prioriza o destinatário publicado',()=>{
  assert.equal(reservationDepartmentEmail(' Sala.Reservas@ufes.br ','legado@ufes.br'),'sala.reservas@ufes.br');
  assert.equal(reservationDepartmentEmail('<<DEPARTAMENTO_EMAIL>>','reservas@ufes.br'),'reservas@ufes.br');
  assert.equal(reservationDepartmentEmail('invalido',''),'');
  assert.equal(reservationDepartmentEmail('reservas@ufes.br\r\nBcc:x@ufes.br',''),'');
});

test('shared reservation contact supersedes every stale template only after an explicit shared save',()=>{
  assert.equal(reservationDepartmentEmail('recent-template@ufes.br','old-global@ufes.br'),'recent-template@ufes.br');
  for(const template of ['old-template@ufes.br','<<DEPARTAMENTO_EMAIL>>','{{DEPARTAMENTO_EMAIL}}','']){
    assert.equal(reservationDepartmentEmail(template,' NEW@ufes.br ',true),'new@ufes.br');
    assert.equal(reservationDepartmentEmail(template,'next@ufes.br',true),'next@ufes.br');
    for(const invalid of ['',undefined,'invalid','x@ufes.br\r\nBcc:y@ufes.br','one@ufes.br,two@ufes.br'])assert.equal(reservationDepartmentEmail(template,invalid,true),'');
  }
});

test('receipt directly addresses the current room contact and every author plus advisor, without duplicates',async()=>{
  const {reservationReceiptRecipients}=await import('./reservationEmail');
  const p={aluno1:{email:'one@ufes.br'},aluno2:{email:'two@ufes.br'},orientador:{email:'advisor@ufes.br'}};
  assert.deepEqual(reservationReceiptRecipients(p,'NEW@ufes.br'),['one@ufes.br','two@ufes.br','advisor@ufes.br','new@ufes.br']);
  assert.deepEqual(reservationReceiptRecipients(p,p.orientador.email),['one@ufes.br','two@ufes.br','advisor@ufes.br']);
  assert.deepEqual(reservationReceiptRecipients({...p,aluno2:undefined},'new@ufes.br'),['one@ufes.br','advisor@ufes.br','new@ufes.br']);
  assert.throws(()=>reservationReceiptRecipients(p,''));
});
