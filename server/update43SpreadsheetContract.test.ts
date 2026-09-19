import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path:string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('planilhas recebem filtro por coluna, ordenação e toolbar canônica', () => {
  const enhancer = read('src/components/PortalSpreadsheetEnhancer.tsx');
  const main = read('src/main.tsx');
  assert.match(main, /PortalSpreadsheetEnhancer/);
  assert.match(enhancer, /portal-column-filter/);
  assert.match(enhancer, /Ordenar esta coluna/);
  assert.match(enhancer, /Filtrar valores desta coluna/);
  assert.match(enhancer, /\[search,refresh,gear\]/);
});

test('engrenagem mostra colunas e ordem sem popup secundário', () => {
  const settings = read('src/components/HeaderSettingsPopover.tsx');
  assert.match(settings, /Colunas e ordem/);
  assert.match(settings, /Marque para exibir\. Use as setas para alterar a ordem/);
  assert.doesNotMatch(settings, /columnMode/);
  assert.match(settings, /Definir padrão/);
});

test('100 e Todos podem expandir verticalmente a tabela', () => {
  const scroll = read('src/components/TableScrollWrapper.tsx');
  assert.doesNotMatch(scroll, /max-h-\[620px\]/);
  assert.match(scroll, /overflow-y-visible/);
});

test('progresso fica numérico e planilhas removem decoração infantil', () => {
  const progress = read('src/components/ProgressIndicator.tsx');
  const enhancer = read('src/components/PortalSpreadsheetEnhancer.tsx');
  assert.match(progress, /portal-progress-number/);
  assert.doesNotMatch(progress, /<svg|circle/i);
  assert.match(enhancer, /stripEmojis/);
  assert.match(enhancer, /portal-table-decorative-icon/);
});

test('calendário usa fins de semana estreitos e preview seguro', () => {
  const enhancer = read('src/components/PortalSpreadsheetEnhancer.tsx');
  const css = read('src/portal-update-43.css');
  assert.match(css, /grid-template-columns:\.30fr 1\.28fr 1\.28fr 1\.28fr 1\.28fr 1\.28fr \.30fr/);
  assert.match(enhancer, /portal-calendar-preview/);
  assert.match(enhancer, /strong\.textContent=title/);
  assert.match(enhancer, /meta\.textContent=/);
  assert.doesNotMatch(enhancer, /item\.innerHTML/);
  assert.match(css, /--portal-muted-yellow/);
  assert.match(css, /--portal-muted-green/);
});

test('Meus TCCs colore apenas pílula de processo por vínculo e simplifica datas', () => {
  const enhancer = read('src/components/PortalSpreadsheetEnhancer.tsx');
  const css = read('src/portal-update-43.css');
  assert.match(enhancer, /data\.portalRoleCategory=category/);
  assert.match(enhancer, /dataset\.portalRolePill=category/);
  assert.match(css, /data-portal-role-pill="student"/);
  assert.match(css, /data-portal-role-pill="committee"/);
  assert.match(css, /data-portal-role-pill="evaluator"/);
  assert.match(css, /data-portal-role-pill="viewer"/);
  assert.match(css, /portal-date-cell-sober/);
});

test('Registro de logs fica integrado ao cabeçalho sem barra auxiliar', () => {
  const page = read('src/pages/AuditLogsPage.tsx');
  assert.doesNotMatch(page, /Auditoria, restauração e rastreabilidade do Portal/);
  assert.doesNotMatch(page, /Histórico completo/);
  assert.match(page, /portal-audit-actions/);
  const searchIndex = page.indexOf('<SearchPopover');
  const refreshIndex = page.indexOf('title="Atualizar dados da tabela"');
  const gearIndex = page.indexOf('<HeaderSettingsPopover');
  assert.ok(searchIndex >= 0 && refreshIndex > searchIndex && gearIndex > refreshIndex);
});

test('workspaces administrativos ganham hierarquia e prevenção de sobreposição', () => {
  const css = read('src/portal-update-43.css');
  const enhancer = read('src/components/PortalUiEnhancer.tsx');
  assert.match(enhancer, /portal-settings-workspace-sidebar/);
  assert.match(css, /grid-template-columns:minmax\(180px,230px\) minmax\(0,1fr\)/);
  assert.match(css, /min-width:0!important/);
  assert.match(css, /max-width:100%!important/);
});
