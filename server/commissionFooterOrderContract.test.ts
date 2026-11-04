import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { compareCommissionMemberNames } from '../src/utils/commissionMemberOrder';

const footer = readFileSync(new URL('../src/components/Footer.tsx', import.meta.url), 'utf8');

test('rodapé apresenta um membro por linha, independentemente da quantidade', () => {
  assert.match(footer, /className="mt-1 grid grid-cols-1 items-start gap-y-1 text-center"/);
  assert.match(footer, /membersList\.map\(\(member\)/);
  assert.doesNotMatch(footer, /membersList\.length === 1 \? 'grid-cols-1' : 'sm:grid-cols-2'/);
});

test('rodapé ordena a lista sem alterar configurações nem nomes originais', () => {
  assert.match(footer, /const membersList=\[\.\.\.\(configured\.length\?configured:legacy\.length\?legacy:layout\)\]/);
  assert.match(footer, /\.sort\(\(a,b\)=>compareCommissionMemberNames\(a\.name,b\.name\)\)/);
  const names = [
    'Profª. Drª. Roseane Vargas Rohr',
    'Profª. Drª. Luciana de Cassia Nunes Nascimento',
    'Prof. Dr. André Pereira',
  ];
  assert.deepEqual([...names].sort(compareCommissionMemberNames), [
    'Prof. Dr. André Pereira',
    'Profª. Drª. Luciana de Cassia Nunes Nascimento',
    'Profª. Drª. Roseane Vargas Rohr',
  ]);
  assert.equal(names[0], 'Profª. Drª. Roseane Vargas Rohr', 'a lista de entrada permanece intocada');
});

test('ordenação alfabética ignora títulos acadêmicos e acentos, mantendo grafia exibida', () => {
  assert.ok(compareCommissionMemberNames('Dra. Álvia', 'Prof. Dr. Beatriz') < 0);
  assert.ok(compareCommissionMemberNames('Profª. Roseane', 'Profa. Luciana') > 0);
  assert.equal(compareCommissionMemberNames('Prof. Dr. Ana', 'Dra. Ana'), 0);
});
