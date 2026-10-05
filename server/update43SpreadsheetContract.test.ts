import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { readPortalCss } from './testUtils/portalCss';
const read = (path:string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('planilhas recebem menu único de filtro e ordenação no runtime estrutural', () => {
  const runtime = read('src/components/PortalStructuralRuntime.tsx');
  const main = read('src/main.tsx');
  assert.match(main, /PortalStructuralRuntime/);
  assert.doesNotMatch(main, /PortalSpreadsheetEnhancer/);
  assert.match(runtime, /portal-core-column-menu/);
  assert.match(runtime, /Ordenar A → Z \/ menor → maior/);
  assert.match(runtime, /Ordenar Z → A \/ maior → menor/);
  assert.match(runtime, /Selecionar tudo/);
  assert.match(runtime, /Limpar tudo/);
});

test('engrenagem mostra colunas e ordem sem popup secundário', () => {
  const settings = read('src/components/HeaderSettingsPopover.tsx');
  assert.match(settings, /Colunas e ordem/);
  assert.match(settings, /Marque para exibir\. Use as setas para alterar a ordem/);
  assert.doesNotMatch(settings, /columnMode/);
  assert.match(settings, /Definir padrão/);
});

test('planilhas permitem rolagem vertical e horizontal no próprio contêiner', () => {
  const scroll = read('src/components/TableScrollWrapper.tsx');
  const runtime = read('src/components/PortalSpreadsheetRuntime.tsx');
  const css = readPortalCss();
  assert.doesNotMatch(scroll, /overflow-y-visible/);
  assert.match(scroll, /portal-spreadsheet-scroll-host/);
  assert.match(scroll, /overflow-auto/);
  assert.match(scroll, /maxHeight: 'min\(68vh, 720px\)'/);
  assert.match(runtime, /addEventListener\('mousedown'/);
  assert.match(runtime, /window\.addEventListener\('mousemove'/);
  assert.match(runtime, /addEventListener\('wheel'/);
  assert.match(runtime, /host\.scrollTop/);
  assert.match(runtime, /host\.scrollLeft/);
  assert.match(css, /\.portal-spreadsheet-scroll-host/);
  assert.match(css, /overflow:\s*auto/);
  assert.match(css, /cursor:\s*grab/);
});

test('etapa permanece disponível e planilhas removem decoração infantil', () => {
  const progress = read('src/components/ProgressIndicator.tsx');
  const runtime = read('src/components/PortalStructuralRuntime.tsx');
  assert.match(progress, /portal-progress-number/);
  assert.match(progress, /function stageLabel/);
  assert.doesNotMatch(progress, /<svg|circle/i);
  assert.doesNotMatch(runtime, /Progresso|portal-core-stage-label/);
});

test('calendário usa fins de semana estreitos e preview seguro', () => {
  const runtime = read('src/components/PortalStructuralRuntime.tsx');
  const home = read('src/pages/HomePage.tsx');
  const css = readPortalCss();
  assert.match(css, /grid-template-columns: \.22fr 1\.356fr 1\.356fr 1\.356fr 1\.356fr 1\.356fr \.22fr/);
  assert.match(home, /isWeekend = colIndex === 0 \|\| colIndex === 6/);
  assert.match(home, /portal-core-calendar-weekend/);
  assert.doesNotMatch(runtime, /enhanceCalendar|portal-core-calendar-previews|fetch\('\/api\/processes'/);
  assert.match(css, /--portal-defense-upcoming-bg/);
  assert.match(css, /--portal-defense-defended-bg/);
});

test('Meus TCCs colore a pílula de processo por vínculo e simplifica datas', () => {
  const page = read('src/pages/MeusProcessosPage.tsx');
  assert.match(page, /portal-role-process-button/);
  assert.match(page, /--portal-role-bg/);
  assert.match(page, /--portal-role-border/);
  assert.match(page, /--portal-role-text/);
  assert.match(page, /defesaDataHora/);
});

test('Registro de logs mantém ações essenciais no cabeçalho e não oferece atualização redundante', () => {
  const page = read('src/pages/AuditLogsPage.tsx');
  assert.doesNotMatch(page, /Auditoria, restauração e rastreabilidade do Portal/);
  assert.doesNotMatch(page, /Histórico completo/);
  assert.match(page, /portal-audit-toolbar/);
  const searchIndex = page.indexOf('<SearchPopover');
  const gearIndex = page.indexOf('<HeaderSettingsPopover');
  assert.ok(searchIndex >= 0 && gearIndex > searchIndex);
  assert.doesNotMatch(page, /title="Atualizar dados da tabela"/);
  assert.doesNotMatch(page, /RefreshCw/);
});

test('workspaces administrativos ganham hierarquia e prevenção de sobreposição', () => {
  const css = readPortalCss();
  const enhancer = read('src/components/PortalUiEnhancer.tsx');
  assert.match(enhancer, /portal-settings-workspace-sidebar/);
  assert.match(css, /\.portal-settings-workspace/);
  assert.doesNotMatch(css, /!important/);
});

test('rodapé prioriza a Secretaria configurada como responsável técnico', () => {
  const footer = read('src/components/Footer.tsx');
  assert.match(footer, /settings\?\.portalMaintainerName\|\|settings\?\.ownerName\|\|layoutConfig\.footerDevName/);
});