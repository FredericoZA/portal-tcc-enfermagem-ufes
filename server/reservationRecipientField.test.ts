import test from 'node:test';
import assert from 'node:assert/strict';
import {reservationRecipientField} from '../src/utils/reservationRecipientField';

test('old blank drafts and department markers show the saved reservation address',()=>{
 for(const value of ['',undefined,'  ','<<DEPARTAMENTO_EMAIL>>','{{DEPARTAMENTO_EMAIL}}'])assert.equal(reservationRecipientField(value,' Department@Example.invalid '),'department@example.invalid');
 assert.equal(reservationRecipientField('new@example.invalid','old@example.invalid'),'new@example.invalid');
 assert.equal(reservationRecipientField('typing','old@example.invalid'),'typing','never overwrite an in-progress explicit edit');
});
