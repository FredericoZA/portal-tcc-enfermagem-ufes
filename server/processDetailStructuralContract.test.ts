import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { readPortalCss } from './testUtils/portalCss';
const source = (path: string) => readFile(path, 'utf8');

test('modal de TCC não renderiza o cabeçalho genérico com brasão', async () => {
  const app = await source('src/App.tsx');
  assert.match(app, /ProcessoDetailPage[\s\S]*isModal=\{false\}/);
  assert.match(app, /portal-process-dialog/);
});

test('título real do TCC usa o contrato verde canônico do detalhe', async () => {
  const css = await readPortalCss();
  const detail = await source('src/pages/ProcessoDetailPage.tsx');
  assert.match(css, /--portal-brand-header:\s*#005830/);
  assert.match(css, /\.portal-section-header,[\s\S]*background:\s*var\(--portal-brand-header\)/);
  assert.match(detail, /tcc-gear-settings-btn/);
});

test('andamento duplicado deixa de existir sem remover confirmação operacional', async () => {
  const panel = await source('src/components/ProcessFlowPanel.tsx');
  assert.doesNotMatch(panel, /Andamento do TCC/);
  assert.doesNotMatch(panel, /const steps\s*=/);
  assert.match(panel, /Confirmação do local da defesa/);
  assert.match(panel, /confirmDefenseLocation/);
  assert.match(panel, /uploadLocationProof/);
});

test('fluxo principal oferece contexto por hover nas etapas', async () => {
  const progress = await source('src/components/EtapaProgressBar.tsx');
  assert.match(progress, /title=\{`\$\{step\.label\}: \$\{step\.description\}`\}/);
  assert.match(progress, /Fluxo do Processo/);
});
