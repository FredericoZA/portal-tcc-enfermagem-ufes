import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(process.cwd());
const source = (file: string) => readFile(path.join(root, file), 'utf8');

test('navegação pública mantém apenas o Fluxo do TCC canônico', async () => {
  const [main, sidebar, app, layout] = await Promise.all([
    source('src/main.tsx'),
    source('src/components/Sidebar.tsx'),
    source('src/App.tsx'),
    source('src/utils/siteLayoutConfig.ts'),
  ]);

  assert.ok(!main.includes('PublicGuideNavigationEnhancerV2'));
  assert.ok(sidebar.includes("'fluxo-tcc'"));
  assert.ok(sidebar.includes("'Fluxo do TCC'"));
  assert.ok(!sidebar.includes('Fluxo completo do TCC'));
  assert.ok(app.includes("case 'fluxo-tcc'"));
  assert.ok(layout.includes("'fluxo-tcc': 'Fluxo do TCC'"));
});

test('navegação usa shell canônico sem hotfix visual', async () => {
  const [main, css] = await Promise.all([
    source('src/main.tsx'),
    source('src/index.css'),
  ]);
  assert.ok(main.includes("import './index.css'"));
  assert.ok(!main.includes('portal-update-'));
  assert.ok(css.includes('--portal-sidebar-footer: #011f17'));
  assert.ok(css.includes('--portal-sidebar-active: #154d41'));
  assert.ok(css.includes('--portal-surface-inner: #ffffff'));
});
