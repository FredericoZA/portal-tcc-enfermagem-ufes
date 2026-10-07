import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { readPortalCss } from './testUtils/portalCss';

const read=(path:string)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('runtime tabular é montado uma única vez na raiz',()=>{
  const main=read('src/main.tsx');
  const wrapper=read('src/components/TableScrollWrapper.tsx');
  assert.match(main,/<PortalSpreadsheetRuntime \/>/);
  assert.doesNotMatch(wrapper,/import\s+\{?\s*PortalSpreadsheetRuntime/);
  assert.doesNotMatch(wrapper,/<PortalSpreadsheetRuntime/);
  assert.doesNotMatch(wrapper,/useRef/);
});

test('paginação desaparece quando a planilha fica sem registros',()=>{
  const runtime=read('src/components/PortalSpreadsheetRuntime.tsx');
  assert.match(runtime,/if \(visibleRows\.length === 0\)/);
  assert.match(runtime,/saveCurrentPage\(key, 1\)/);
  assert.match(runtime,/portal-spreadsheet-pager\[data-portal-table-key=/);
  assert.match(runtime,/\.forEach\(\(pager\) => pager\.remove\(\)\)/);
  assert.match(runtime,/function removeOrphanPagers/);
  assert.match(runtime,/ownsAdjacentHost/);
});

test('busca e configuração copiam a geometria canônica do Portal',()=>{
  const css=readPortalCss();
  const search=read('src/components/SearchPopover.tsx');
  const settings=read('src/components/HeaderSettingsPopover.tsx');
  assert.match(css,/\.portal-core-column-popup,[\s\S]*border-radius: var\(--portal-panel-radius\)/);
  assert.match(css,/\.portal-search-popover > \.portal-modal-header,[\s\S]*margin: 0/);
  assert.match(css,/\.portal-table-settings-popover > \.portal-settings-popover-header[\s\S]*padding: 0 var\(--portal-bar-padding-x\)/);
  assert.match(css,/\.portal-settings-popover-body \{[\s\S]*background: var\(--portal-surface-panel\)/);
  assert.doesNotMatch(search,/rounded-xl/);
  assert.match(search,/aria-label="Fechar busca"/);
  assert.match(settings,/aria-label="Fechar configuração da planilha"/);
});
