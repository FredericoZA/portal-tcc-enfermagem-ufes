import test from 'node:test';
import assert from 'node:assert/strict';
import {defenseEndAt} from '../src/utils/defenseSchedule';
test('reserva mantém os minutos de início e dura 90 minutos, inclusive na virada do dia',()=>{
  assert.equal(defenseEndAt('2026-10-23T08:10:00-03:00'),'2026-10-23T12:40:00.000Z');
  assert.equal(defenseEndAt('2026-10-23T23:10:00-03:00'),'2026-10-24T03:40:00.000Z');
});
