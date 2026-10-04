import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { getDefenseStateFromTimes } from '../src/utils/defenseSemantics';

const source = (path: string) => readFile(path, 'utf8');

test('estado cromático da defesa depende somente do início comparado ao agora', () => {
  const now = Date.parse('2026-09-29T15:00:00-03:00');
  assert.equal(getDefenseStateFromTimes('2026-09-29T14:59:59-03:00', undefined, now), 'defended');
  assert.equal(getDefenseStateFromTimes('2026-09-29T15:00:00-03:00', undefined, now), 'upcoming');
  assert.equal(getDefenseStateFromTimes('2026-09-30T09:00:00-03:00', undefined, now), 'upcoming');
});

test('paleta de defesa usa verde e amarelo foscos canônicos', async () => {
  const css = await source('src/index.css');
  assert.match(css, /--portal-defense-defended-bg:\s*#bed8c3/);
  assert.match(css, /--portal-defense-defended-border:\s*#719a79/);
  assert.match(css, /--portal-defense-upcoming-bg:\s*#e8dda7/);
  assert.match(css, /--portal-defense-upcoming-border:\s*#b49d4f/);
});

test('lista de defesas não deduz mais cor pela zebra da linha', async () => {
  const css = await source('src/index.css');
  const home = await source('src/pages/HomePage.tsx');
  assert.match(home, /data-defense-state=\{defenseState\}/);
  assert.match(css, /data-defense-state="defended"/);
  assert.match(css, /data-defense-state="upcoming"/);
  assert.doesNotMatch(css, /tr\.bg-slate-100[\s\S]*data-defense-state/);
});

test('membros da comissão permanecem centralizados no rodapé', async () => {
  const footer = await source('src/components/Footer.tsx');
  assert.match(footer, /text-center/);
  assert.match(footer, /items-center/);
  assert.match(footer, /justify-center/);
});
