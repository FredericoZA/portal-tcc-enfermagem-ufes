import test from 'node:test';
import assert from 'node:assert/strict';
import {reservationToken,readReservationToken} from './reservationConfirmation';
const secret='reservation-secret-test-0123456789';
test('reservation capability rejects tampering, expiration, wrong key and malformed payloads',()=>{
 const claim={processId:'p',revision:2,recipient:'department@example.invalid',expiresAt:Date.now()+60000};
 const token=reservationToken(claim,secret);assert.deepEqual(readReservationToken(token,secret),claim);
 assert.equal(readReservationToken(token+'x',secret),null);assert.equal(readReservationToken(token,'another-secret-at-least-24-characters'),null);
 assert.equal(readReservationToken(token,secret,claim.expiresAt+1),null);assert.equal(readReservationToken('bad',secret),null);
});
