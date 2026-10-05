import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { readPortalCss } from './testUtils/portalCss';
const read=(path:string)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('recursos introduzidos na 1.0.41 permanecem na camada estrutural atual',()=>{
  const runtime=read('src/utils/portalTableDom.ts');
  const settings=read('src/components/HeaderSettingsPopover.tsx');
  assert.match(runtime,/portal-core-resizer/);
  assert.match(runtime,/pointermove/);
  assert.match(settings,/Quebra de texto/);
  assert.match(settings,/Quebrar texto/);
  assert.match(settings,/Uma linha/);
  assert.match(runtime,/portal-core-nowrap/);
  assert.doesNotMatch(runtime,/createElement\('section'\)|portal-core-wrap-setting/);
});

test('seleção em massa e menu único foram incorporados ao runtime estrutural',()=>{
  const runtime=read('src/utils/portalTableDom.ts');
  assert.match(runtime,/Selecionar tudo/);
  assert.match(runtime,/Limpar tudo/);
  assert.match(runtime,/portal-core-column-menu/);
  assert.match(runtime,/Ordenar A → Z \/ menor → maior/);
  assert.match(runtime,/Ordenar Z → A \/ maior → menor/);
});

test('separadores e texto usam tokens do contrato visual',()=>{
  const css=readPortalCss();
  assert.match(css,/--portal-sheet-title-divider:\s*5px/);
  assert.match(css,/--portal-sheet-content-divider:\s*15px/);
  assert.match(css,/color:\s*var\(--portal-text-dark\)/);
  assert.doesNotMatch(css,/!important/);
});

test('1.0.41 foi absorvida e não permanece ativa como enhancer concorrente',()=>{
  const main=read('src/main.tsx');
  assert.doesNotMatch(main,/PortalVersion1041Enhancer/);
  assert.doesNotMatch(main,/portal-version-1041\.css/);
  assert.match(main,/PortalSpreadsheetRuntime/);
  assert.doesNotMatch(main,/PortalStructuralRuntime/);
});