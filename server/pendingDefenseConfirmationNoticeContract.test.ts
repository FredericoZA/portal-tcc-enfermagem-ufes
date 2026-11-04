import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const home = read('src/pages/HomePage.tsx');

test('aviso vermelho aparece somente para reserva sem resposta do departamento', () => {
  assert.match(home, /process\.defesa\?\.localStatus !== 'PENDENTE'/);
  assert.match(home, /process\.defesa\?\.departmentResponse/);
  assert.match(home, /\(Aguardando confirmação\)/);
  assert.match(home, /color: '#b91c1c'/);
});

test('aviso vem depois do título no calendário, lista e repositório', () => {
  assert.match(home, /summary\.primary}<PendingDefenseConfirmationNote process=\{proc\} \/>/);
  assert.match(home, /formatCellText\('titulo', formatTccTitle\(proc\.titulo\), defensesTextFormat, ''\)[\s\S]{0,130}<PendingDefenseConfirmationNote process=\{proc\} \/>/);
  assert.match(home, /formatCellText\('titulo', formatTccTitle\(proc\.titulo\), acervoTextFormat, ''\)[\s\S]{0,130}<PendingDefenseConfirmationNote process=\{proc\} \/>/);
  assert.match(home, /formatTccTitle\(selectedLibDoc\.titulo\)}<PendingDefenseConfirmationNote process=\{selectedLibDoc\} \/>/);
  assert.equal((home.match(/<PendingDefenseConfirmationNote process=/g) || []).length, 5);
});

test('estados cromáticos continuam vinculados à data, sem paleta nova para pendências', () => {
  const semantics = read('src/utils/defenseSemantics.ts');
  const styles = read('src/styles/portal-sheet.css');
  assert.match(semantics, /return getDefenseStateFromTimes\(process\.defesa\?\.startAt, process\.defesa\?\.endAt, now\)/);
  assert.doesNotMatch(styles, /data-reservation-status="pending"/);
});
