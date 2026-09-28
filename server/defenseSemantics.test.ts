import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatDefenseCalendarSummary,
  getDefenseState,
  getDefenseStateFromTimes,
  matchesDefenseFilter,
} from '../src/utils/defenseSemantics';
import type { ProcessData } from '../src/types';

const processAt = (
  status: ProcessData['status'],
  startAt: string,
  endAt?: string,
  titulo = 'Impacto da assistência de enfermagem na recuperação clínica',
) => ({
  status,
  titulo,
  defesa: { startAt, endAt },
}) as Pick<ProcessData, 'status' | 'titulo' | 'defesa'>;

const NOW = new Date('2026-09-25T12:00:00.000Z').getTime();

test('estado da defesa muda para realizada assim que a data e hora de início ficam no passado', () => {
  assert.equal(
    getDefenseStateFromTimes('2026-09-25T11:30:00.000Z', '2026-09-25T13:00:00.000Z', NOW),
    'defended',
  );
  assert.equal(
    getDefenseStateFromTimes('2026-09-25T12:30:00.000Z', '2026-09-25T14:00:00.000Z', NOW),
    'upcoming',
  );
});

test('status administrativo não força uma defesa futura para o estado realizado', () => {
  const futureProcess = processAt('AGUARDANDO_ASSINATURA', '2026-10-25T10:00:00.000Z');
  const pastProcess = processAt('AGUARDANDO_DEFESA', '2026-09-20T10:00:00.000Z');
  assert.equal(getDefenseState(futureProcess, NOW), 'upcoming');
  assert.equal(getDefenseState(pastProcess, NOW), 'defended');
});

test('filtro usa exatamente o mesmo estado semântico usado pela cor do processo', () => {
  const upcoming = processAt('AGUARDANDO_DEFESA', '2026-09-26T12:00:00.000Z', '2026-09-26T13:30:00.000Z');
  const defended = processAt('CONCLUIDO', '2026-09-20T12:00:00.000Z', '2026-09-20T13:30:00.000Z');

  assert.equal(getDefenseState(upcoming, NOW), 'upcoming');
  assert.equal(matchesDefenseFilter(upcoming, 'upcoming', NOW), true);
  assert.equal(matchesDefenseFilter(upcoming, 'defended', NOW), false);

  assert.equal(getDefenseState(defended, NOW), 'defended');
  assert.equal(matchesDefenseFilter(defended, 'defended', NOW), true);
  assert.equal(matchesDefenseFilter(defended, 'upcoming', NOW), false);
  assert.equal(matchesDefenseFilter(defended, 'all', NOW), true);
});

test('resumo do calendário contém horário e título compacto do TCC', () => {
  const process = processAt(
    'AGUARDANDO_DEFESA',
    '2026-09-26T15:00:00.000Z',
    '2026-09-26T16:30:00.000Z',
    '  Um   título muito longo para testar a compactação visual do calendário mensal  ',
  );
  const summary = formatDefenseCalendarSummary(process, 30);
  assert.match(summary, /^\d{2}:\d{2} · /);
  assert.ok(summary.includes('Um título muito longo'));
  assert.ok(summary.endsWith('…'));
  assert.ok(!summary.includes('  '));
});