import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read=(path:string)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('recursos introduzidos na 1.0.41 permanecem na camada estrutural atual',()=>{
  const runtime=read('src/components/PortalStructuralRuntime.tsx');
  const css=read('src/portal-core-1043.css');
  assert.match(runtime,/portal-core-resizer/);
  assert.match(runtime,/pointermove/);
  assert.match(runtime,/Quebra de texto/);
  assert.match(runtime,/Quebrar texto/);
  assert.match(runtime,/Uma linha/);
  assert.match(css,/portal-core-nowrap/);
});

test('seleção em massa e menu único foram incorporados ao runtime estrutural',()=>{
  const runtime=read('src/components/PortalStructuralRuntime.tsx');
  assert.match(runtime,/Selecionar tudo/);
  assert.match(runtime,/Limpar tudo/);
  assert.match(runtime,/portal-core-column-menu/);
  assert.match(runtime,/Ordenar A → Z \/ menor → maior/);
  assert.match(runtime,/Ordenar Z → A \/ maior → menor/);
});

test('separadores e texto preto permanecem como contrato visual',()=>{
  const css=read('src/portal-core-1043.css');
  assert.match(css,/--portal-separator-section: 12px/);
  assert.match(css,/--portal-separator-table: 16px/);
  assert.match(css,/color: #000 !important/);
  assert.match(css,/font-weight: 400 !important/);
});

test('1.0.41 foi absorvida e não permanece ativa como enhancer concorrente',()=>{
  const main=read('src/main.tsx');
  assert.doesNotMatch(main,/PortalVersion1041Enhancer/);
  assert.doesNotMatch(main,/portal-version-1041\.css/);
  assert.match(main,/PortalStructuralRuntime/);
});