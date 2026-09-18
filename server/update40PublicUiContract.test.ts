import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(process.cwd());
const source = (file: string) => readFile(path.join(root, file), 'utf8');

test('Replicar Portal consolida ferramentas e reduz ações permanentes', async () => {
  const page = await source('src/pages/PortalReplicationPage.tsx');
  assert.ok(page.includes("title: 'GitHub'"));
  assert.ok(page.includes("title: 'Vercel'"));
  assert.ok(page.includes("title: 'Supabase'"));
  assert.ok(page.includes("title: 'Google Workspace'"));
  assert.ok(page.includes('Modelos do Google Drive'));
  assert.ok(page.includes('Baixar modelos'));
  assert.ok(page.includes('Abrir no GitHub'));
  assert.ok(!page.includes('Identidade institucional'));
  assert.ok(!page.includes('Código do Portal'));
  assert.ok(!page.includes('portal-replication-model-action'));
});

test('Como chegar organiza os três atalhos em uma única linha de cartões', async () => {
  const page = await source('src/pages/ComoChegarPage.tsx');
  assert.ok(page.includes('grid grid-cols-3 gap-1.5'));
  assert.ok(page.includes('min-h-[64px]'));
  assert.ok(page.includes('Google Maps'));
  assert.ok(page.includes('Waze'));
  assert.ok(page.includes('Mapa da UFES'));
  assert.ok(!page.includes('sm:grid-cols-3 md:grid-cols-1'));
});

test('destaque ativo preenche todo o raio esquerdo fluorescente', async () => {
  const [main, css] = await Promise.all([
    source('src/main.tsx'),
    source('src/portal-update-40.css'),
  ]);
  assert.ok(main.includes("import './portal-update-40.css'"));
  assert.match(css, /#sidebar-nav \.portal-sidebar-nav-active::before/);
  assert.match(css, /width:\s*12px\s*!important/);
  assert.match(css, /border-radius:\s*0\s*!important/);
});
