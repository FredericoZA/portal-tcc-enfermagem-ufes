import test from 'node:test';
import assert from 'node:assert/strict';
import { getDefenseState, getDefenseStateFromTimes, matchesDefenseFilter } from '../src/utils/defenseSemantics';

const NOW = new Date('2026-09-27T22:00:00-03:00').getTime();

test('defesa anterior ao instante atual é defendida', () => {
  assert.equal(getDefenseStateFromTimes('2026-09-27T21:59:59-03:00', undefined, NOW), 'defended');
});

test('defesa posterior ao instante atual é a defender', () => {
  assert.equal(getDefenseStateFromTimes('2026-09-27T22:00:01-03:00', undefined, NOW), 'upcoming');
});

test('horário de término não altera a classificação baseada no início', () => {
  assert.equal(getDefenseStateFromTimes('2026-09-27T21:00:00-03:00', '2026-09-28T01:00:00-03:00', NOW), 'defended');
});

test('status administrativo não substitui a data/hora da defesa', () => {
  const future = { status: 'CONCLUIDO', defesa: { startAt: '2026-09-28T09:00:00-03:00' } } as any;
  const past = { status: 'AGUARDANDO_AGENDAMENTO', defesa: { startAt: '2026-09-26T09:00:00-03:00' } } as any;
  assert.equal(getDefenseState(future, NOW), 'upcoming');
  assert.equal(getDefenseState(past, NOW), 'defended');
  assert.equal(matchesDefenseFilter(past, 'defended', NOW), true);
  assert.equal(matchesDefenseFilter(past, 'upcoming', NOW), false);
});
