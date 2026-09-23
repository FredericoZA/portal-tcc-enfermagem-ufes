import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read=(path:string)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('runtime estrutural neutraliza hover e usa um único menu por coluna',()=>{
  const runtime=read('src/components/PortalStructuralRuntime.tsx');
  const css=read('src/portal-core-1043.css');
  assert.match(runtime,/stripHoverRules/);
  assert.match(runtime,/portal-core-column-menu/);
  assert.match(runtime,/Selecionar tudo/);
  assert.match(runtime,/Limpar tudo/);
  assert.match(css,/--portal-separator-section: 12px/);
  assert.match(css,/--portal-separator-table: 16px/);
});

test('cores do processo e calendário compartilham a mesma paleta',()=>{
  const css=read('src/portal-core-1043.css');
  assert.match(css,/--portal-defended-bg: #c2d0c2/);
  assert.match(css,/--portal-defended-border: #7e907e/);
  assert.match(css,/--portal-upcoming-bg: #d8c58e/);
  assert.match(css,/portal-core-calendar-card\.is-defended/);
  assert.match(css,/portal-core-calendar-card\.is-upcoming/);
});

test('replicação expõe somente download agregado em zip',()=>{
  const page=read('src/pages/PortalReplicationPage.tsx');
  const api=read('api/replication-model.ts');
  assert.match(page,/replication-models\/all\/download/);
  assert.doesNotMatch(page,/models\.map/);
  assert.doesNotMatch(page,/showAcceptance/);
  assert.match(api,/import JSZip from 'jszip'/);
  assert.match(api,/key === 'all'/);
  assert.match(api,/modelos-portal-tcc\.zip/);
});

test('detalhe público resolve protocolo antes da rota legada',()=>{
  const resilience=read('src/utils/authRequestResilience.ts');
  assert.match(resilience,/publicProcessProtocol/);
  assert.match(resilience,/resolvePublicProcessByProtocol/);
  assert.match(resilience,/item\?\.protocolo/);
});

test('main monta apenas a camada estrutural atual para planilhas',()=>{
  const main=read('src/main.tsx');
  assert.match(main,/PortalStructuralRuntime/);
  assert.match(main,/portal-core-1043\.css/);
  assert.doesNotMatch(main,/PortalSpreadsheetEnhancer/);
  assert.doesNotMatch(main,/PortalMaintenanceEnhancer/);
  assert.doesNotMatch(main,/PortalVersion1041Enhancer/);
  assert.doesNotMatch(main,/PortalVersion1042Enhancer/);
});