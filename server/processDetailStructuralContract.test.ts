import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = (path: string) => readFile(path, 'utf8');

test('modal de TCC não renderiza o cabeçalho genérico com brasão', async () => {
  const app = await source('src/App.tsx');
  assert.match(app, /ProcessoDetailPage[\s\S]*isModal=\{false\}/);
  assert.match(app, /portal-process-dialog/);
});

test('título real do TCC é o cabeçalho verde do detalhe', async () => {
  const css = await source('src/portal-process-detail.css');
  assert.match(css, /div:has\(#tcc-gear-settings-btn\)[\s\S]*background:\s*var\(--portal-green-header\)\s*!important/);
  assert.match(css, /button\.bg-white[\s\S]*background:\s*var\(--portal-green-action\)\s*!important/);
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
