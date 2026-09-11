import test from 'node:test';
import assert from 'node:assert/strict';
import { formatDateExtensoTotal, formatDateNumeric, formatDatePt, formatTimeExtenso } from '../src/utils/formatters';

test('formatadores preservam valores civis informados no horário institucional', () => {
  assert.equal(formatDatePt('2026-09-11T14:30:00'), '11 de setembro de 2026');
  assert.equal(formatDateNumeric('2026-09-11T14:30:00'), '11/09/2026');
  assert.equal(formatDateExtensoTotal('2026-09-11T14:30:00'), 'onze de setembro de dois mil e vinte e seis');
  assert.equal(formatTimeExtenso('2026-09-11T14:30:00'), 'quatorze horas e trinta minutos');
});

test('timestamps absolutos são convertidos para America/Sao_Paulo antes de gerar documento', () => {
  assert.equal(formatDatePt('2026-09-12T01:30:00.000Z'), '11 de setembro de 2026');
  assert.equal(formatTimeExtenso('2026-09-12T01:30:00.000Z'), 'vinte e duas horas e trinta minutos');
});

test('data por extenso não fica limitada aos anos originalmente codificados', () => {
  assert.equal(formatDateExtensoTotal('2028-01-01'), 'primeiro de janeiro de dois mil e vinte e oito');
  assert.equal(formatTimeExtenso('01:01'), 'uma hora e um minuto');
  assert.equal(formatTimeExtenso('14:00'), 'quatorze horas');
});

test('valores inválidos permanecem visíveis em vez de serem silenciosamente alterados', () => {
  assert.equal(formatDatePt('data-a-confirmar'), 'data-a-confirmar');
  assert.equal(formatTimeExtenso('hora-a-confirmar'), 'hora-a-confirmar');
});
