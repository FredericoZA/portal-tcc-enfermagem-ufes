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
  assert.ok(layout.includes("'fluxo-tcc':'Fluxo do TCC'"));
});

test('hotfix visual restaura aba lateral verde e divisor branco do Como usar', async () => {
  const [main, css] = await Promise.all([
    source('src/main.tsx'),
    source('src/portal-update-32.css'),
  ]);

  assert.ok(main.includes("import './portal-update-32.css'"));
  assert.ok(!main.includes("import './portal-update-29.css'"));
  assert.ok(css.includes('border-left: 3px solid #337959'));
  assert.ok(css.includes('box-shadow:'));
  assert.ok(css.includes('border-top-color: #ffffff'));
  assert.ok(css.includes('padding-top: 0.5rem'));
});
