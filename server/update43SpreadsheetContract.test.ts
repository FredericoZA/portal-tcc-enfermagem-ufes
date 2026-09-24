import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

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

test('100 e Todos podem expandir verticalmente a tabela', () => {
  const scroll = read('src/components/TableScrollWrapper.tsx');
  assert.doesNotMatch(scroll, /max-h-\[620px\]/);
  assert.match(scroll, /overflow-y-visible/);
});

test('etapa permanece disponível e planilhas removem decoração infantil', () => {
  const progress = read('src/components/ProgressIndicator.tsx');
  const runtime = read('src/components/PortalStructuralRuntime.tsx');
  assert.match(progress, /portal-progress-number/);
  assert.doesNotMatch(progress, /<svg|circle/i);
  assert.match(runtime, /replace\(\/\\bProgresso\\b\/gi, 'Etapa'\)/);
  assert.match(runtime, /portal-core-stage-label/);
});

test('calendário usa fins de semana estreitos e preview seguro', () => {
  const runtime = read('src/components/PortalStructuralRuntime.tsx');
  const css = read('src/portal-core-1043.css');
  assert.match(css, /grid-template-columns: \.22fr 1\.356fr 1\.356fr 1\.356fr 1\.356fr 1\.356fr \.22fr/);
  assert.match(runtime, /portal-core-calendar-card/);
  assert.match(runtime, /title\.textContent = `HOMOLOGAÇÃO/);
  assert.match(runtime, /meta\.textContent =/);
  assert.match(css, /--portal-upcoming-bg/);
  assert.match(css, /--portal-defended-bg/);
});

test('Meus TCCs colore apenas pílula de processo por vínculo e simplifica datas', () => {
  const enhancer = read('src/components/PortalSpreadsheetEnhancer.tsx');
  const css = read('src/portal-update-43.css');
  assert.match(enhancer, /row\.dataset\.portalRoleCategory=category/);
  assert.match(enhancer, /pill\.dataset\.portalRolePill=category/);
  assert.match(css, /data-portal-role-pill="student"/);
  assert.match(css, /data-portal-role-pill="committee"/);
  assert.match(css, /data-portal-role-pill="evaluator"/);
  assert.match(css, /data-portal-role-pill="viewer"/);
  assert.match(css, /portal-date-cell-sober/);
});

test('Registro de logs mantém ações essenciais no cabeçalho e não oferece atualização redundante', () => {
  const page = read('src/pages/AuditLogsPage.tsx');
  assert.doesNotMatch(page, /Auditoria, restauração e rastreabilidade do Portal/);
  assert.doesNotMatch(page, /Histórico completo/);
  assert.match(page, /portal-audit-actions/);
  const searchIndex = page.indexOf('<SearchPopover');
  const gearIndex = page.indexOf('<HeaderSettingsPopover');
  assert.ok(searchIndex >= 0 && gearIndex > searchIndex);
  assert.doesNotMatch(page, /title="Atualizar dados da tabela"/);
  assert.doesNotMatch(page, /RefreshCw/);
});

test('workspaces administrativos ganham hierarquia e prevenção de sobreposição', () => {
  const css = read('src/portal-update-43.css');
  const enhancer = read('src/components/PortalUiEnhancer.tsx');
  assert.match(enhancer, /portal-settings-workspace-sidebar/);
  assert.match(css, /grid-template-columns:minmax\(180px,230px\) minmax\(0,1fr\)/);
  assert.match(css, /min-width:0!important/);
  assert.match(css, /max-width:100%!important/);
});

test('rodapé prioriza a Secretaria configurada como responsável técnico', () => {
  const footer = read('src/components/Footer.tsx');
  assert.match(footer, /settings\?\.portalMaintainerName\|\|settings\?\.ownerName\|\|layoutConfig\.footerDevName/);
});