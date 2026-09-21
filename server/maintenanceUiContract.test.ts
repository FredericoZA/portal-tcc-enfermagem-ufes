import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('manutenção global neutraliza hover e usa um único menu por coluna', () => {
  const enhancer = read('src/components/PortalMaintenanceEnhancer.tsx');
  const css = read('src/portal-maintenance.css');
  assert.match(enhancer, /neutralizeHoverBehavior/);
  assert.match(enhancer, /selectorText\.includes\(':hover'\)/);
  assert.match(enhancer, /portal1043-column-menu-button/);
  assert.match(enhancer, /Ordenar A → Z \/ menor → maior/);
  assert.match(enhancer, /filterTitle\.textContent = 'Filtrar'/);
  assert.match(css, /border-bottom: 20px solid #fff !important/);
  assert.match(css, /portal1043-stage-label/);
  assert.match(css, /font-weight: 400 !important/);
});

test('cores distinguem botão de processo defendido e ocorrência do calendário', () => {
  const css = read('src/portal-maintenance.css');
  assert.match(css, /portal1040-defense-defended/);
  assert.match(css, /background-color: #718077 !important/);
  assert.match(css, /portal-calendar-preview\.is-defended/);
  assert.match(css, /background: #b8d2c0 !important/);
});

test('replicação expõe somente download agregado em zip', () => {
  const page = read('src/pages/PortalReplicationPage.tsx');
  const api = read('api/replication-model.ts');
  assert.match(page, /replication-models\/all\/download/);
  assert.doesNotMatch(page, /models\.map/);
  assert.doesNotMatch(page, /showAcceptance/);
  assert.match(api, /import JSZip from 'jszip'/);
  assert.match(api, /key === 'all'/);
  assert.match(api, /modelos-portal-tcc\.zip/);
});

test('detalhe público resolve protocolo antes de cair na rota legada por id interno', () => {
  const resilience = read('src/utils/authRequestResilience.ts');
  assert.match(resilience, /publicProcessProtocol/);
  assert.match(resilience, /resolvePublicProcessByProtocol/);
  assert.match(resilience, /item\?\.protocolo/);
});

test('main usa somente a camada consolidada da manutenção atual', () => {
  const main = read('src/main.tsx');
  assert.match(main, /PortalMaintenanceEnhancer/);
  assert.match(main, /portal-maintenance\.css/);
  assert.doesNotMatch(main, /<PortalSpreadsheetRefinementEnhancer/);
  assert.doesNotMatch(main, /<PortalInteractionRefinementEnhancer/);
});
