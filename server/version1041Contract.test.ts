import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read=(path:string)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('1.0.41 é carregada depois da camada consolidada anterior',()=>{
  const main=read('src/main.tsx');
  assert.ok(main.indexOf("./portal-version-1041.css")>main.indexOf("./portal-maintenance.css"));
  assert.ok(main.indexOf('<PortalVersion1041Enhancer />')>main.indexOf('<PortalMaintenanceEnhancer />'));
});

test('1.0.41 permite redimensionar colunas e alternar quebra de texto',()=>{
  const enhancer=read('src/components/PortalVersion1041Enhancer.tsx');
  const css=read('src/portal-version-1041.css');
  assert.match(enhancer,/portal1041-column-resizer/);
  assert.match(enhancer,/pointermove/);
  assert.match(enhancer,/Quebra de texto/);
  assert.match(enhancer,/Quebrar texto/);
  assert.match(enhancer,/Uma linha/);
  assert.match(css,/portal1041-nowrap/);
});

test('menu de coluna mantém botão único e ganha seleção em massa estilo Excel',()=>{
  const enhancer=read('src/components/PortalVersion1041Enhancer.tsx');
  const css=read('src/portal-version-1041.css');
  assert.match(enhancer,/Selecionar tudo/);
  assert.match(enhancer,/Limpar seleção/);
  assert.match(css,/portal1043-column-menu-button/);
  assert.match(css,/portal-column-controls/);
  assert.match(css,/display: none !important/);
});

test('tabelas usam texto preto e separadores brancos grossos',()=>{
  const css=read('src/portal-version-1041.css');
  assert.match(css,/border-bottom: 16px solid #fff !important/);
  assert.match(css,/border-bottom: 12px solid #fff !important/);
  assert.match(css,/color: #000 !important/);
  assert.match(css,/font-weight: 400 !important/);
});

test('calendário e botões de processo compartilham paleta sóbria',()=>{
  const css=read('src/portal-version-1041.css');
  assert.match(css,/#b8d2c0/);
  assert.match(css,/#72927c/);
  assert.match(css,/#e4d6a8/);
  assert.match(css,/#b6a164/);
  assert.match(css,/portal1041-calendar-preview-pass-through/);
  assert.match(css,/pointer-events: none !important/);
});

test('clique do calendário continua ligado ao popup nativo com todas as defesas do dia',()=>{
  const home=read('src/pages/HomePage.tsx');
  assert.match(home,/setSelectedDayDefenses\(dayDefenses\.length > 0 \? dayDefenses : null\)/);
  assert.match(home,/setSelectedDayGcalEvents\(dayGcal\.length > 0 \? dayGcal : null\)/);
  assert.match(home,/id="day-defenses-modal"/);
  assert.match(home,/selectedDayDefenses\.map/);
});

test('botões de atualização das planilhas são removidos da interface',()=>{
  const enhancer=read('src/components/PortalVersion1041Enhancer.tsx');
  const css=read('src/portal-version-1041.css');
  assert.match(enhancer,/removeTableRefreshButtons/);
  assert.match(enhancer,/Atualizar dados da tabela/);
  assert.match(css,/button\[title="Atualizar dados da tabela"\]/);
});

test('package publica a versão 1.0.41',()=>{
  const pkg=JSON.parse(read('package.json'));
  assert.equal(pkg.version,'1.0.41');
});
