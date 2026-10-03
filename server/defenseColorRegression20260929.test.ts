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
  const tokens = await source('src/utils/portalSemanticTokens.ts');
  assert.match(tokens, /defended:\s*\{\s*bg:\s*'#bed8c3',\s*border:\s*'#719a79',\s*text:\s*'#23472b'\s*\}/);
  assert.match(tokens, /upcoming:\s*\{\s*bg:\s*'#e8dda7',\s*border:\s*'#b49d4f',\s*text:\s*'#4a4020'\s*\}/);
});

test('lista de defesas não deduz mais cor pela zebra da linha', async () => {
  const [hotfix, publicUx, finalCss] = await Promise.all([
    source('src/portal-hotfix-separators-palette.css'),
    source('src/portal-public-ux-1044.css'),
    source('src/portal-version-1046.css'),
  ]);

  assert.doesNotMatch(hotfix, /tr\.bg-slate-100\\\/40[\s\S]*abrir os detalhes e documentos/);
  assert.doesNotMatch(hotfix, /tr:not\(\.bg-slate-100\\\/40\)[\s\S]*abrir os detalhes e documentos/);
  assert.doesNotMatch(publicUx, /tr:not\(\[class\*="bg-slate-100"\]\)[\s\S]*abrir os detalhes e documentos/);

  for (const css of [hotfix, publicUx, finalCss]) {
    assert.match(css, /data-defense-state="defended"/);
    assert.match(css, /data-defense-state="upcoming"/);
    assert.match(css, /--portal-defense-defended-bg/);
    assert.match(css, /--portal-defense-upcoming-bg/);
  }
});

test('membros da comissão permanecem centralizados no rodapé', async () => {
  const css = await source('src/portal-version-1046.css');
  assert.match(css, /#home-page-footer-notes[\s\S]*div\.pt-2\.border-t[\s\S]*div\.mt-1[\s\S]*display:\s*flex\s*!important/);
  assert.match(css, /align-items:\s*center\s*!important/);
  assert.match(css, /text-align:\s*center\s*!important/);
});
