import test from 'node:test';
import assert from 'node:assert/strict';
import {reservationDepartmentEmail} from './reservationEmail';
test('reserva aceita endereço com s e ponto e prioriza o destinatário publicado',()=>{
  assert.equal(reservationDepartmentEmail(' Sala.Reservas@ufes.br ','legado@ufes.br'),'sala.reservas@ufes.br');
  assert.equal(reservationDepartmentEmail('<<DEPARTAMENTO_EMAIL>>','reservas@ufes.br'),'reservas@ufes.br');
  assert.equal(reservationDepartmentEmail('invalido',''),'');
  assert.equal(reservationDepartmentEmail('reservas@ufes.br\r\nBcc:x@ufes.br',''),'');
});
