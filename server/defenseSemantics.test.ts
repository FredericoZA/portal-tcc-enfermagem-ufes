import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatDefenseCalendarSummary,
  getDefenseCalendarSummaryParts,
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

test('estado da defesa considera o término da sessão antes de marcá-la como realizada', () => {
  assert.equal(
    getDefenseStateFromTimes('2026-09-25T11:30:00.000Z', '2026-09-25T13:00:00.000Z', NOW),
    'upcoming',
  );
  assert.equal(
    getDefenseStateFromTimes('2026-09-25T10:00:00.000Z', '2026-09-25T11:30:00.000Z', NOW),
    'defended',
  );
});

test('etapas pós-defesa são realizadas mesmo quando a agenda está ausente ou inconsistente', () => {
  const process = processAt('AGUARDANDO_ASSINATURA', '2026-10-25T10:00:00.000Z');
  assert.equal(getDefenseState(process, NOW), 'defended');
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

test('resumo do calendário preserva horário e título e separa os alunos na segunda linha', () => {
  const process = {
    status: 'AGUARDANDO_DEFESA',
    titulo: '  Um   título muito longo para testar a leitura completa do calendário mensal  ',
    aluno1: { nome: 'Ana Maria' },
    aluno2: { nome: 'Bruno Souza' },
    defesa: { startAt: '2026-09-26T15:00:00.000Z', endAt: '2026-09-26T16:30:00.000Z' },
  } as Pick<ProcessData, 'status' | 'titulo' | 'aluno1' | 'aluno2' | 'defesa'>;

  const parts = getDefenseCalendarSummaryParts(process);
  const summary = formatDefenseCalendarSummary(process, 30);
  assert.match(parts.primary, /^\d{2}:\d{2} · /);
  assert.ok(parts.primary.includes('Um título muito longo para testar a leitura completa do calendário mensal'));
  assert.equal(parts.secondary, 'Ana Maria · Bruno Souza');
  assert.ok(summary.includes('\nAna Maria · Bruno Souza'));
  assert.ok(!summary.includes('  '));
  assert.ok(!summary.endsWith('…'));
});
