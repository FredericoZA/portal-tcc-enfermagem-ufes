import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('release Portal TCC11 é 1.0.77', () => {
  assert.equal(JSON.parse(read('package.json')).version, '1.0.77');
});

test('barra lateral usa ícones Lucide brancos e texto corrido maior', () => {
  const sidebar = read('src/components/Sidebar.tsx');
  const tokens = read('src/styles/portal-tokens.css');
  assert.match(sidebar, /<Icon className="h-5 w-5 shrink-0 text-white"/);
  assert.doesNotMatch(sidebar, /layoutConfig\.sidebarIconMode \|\| 'emoji'/);
  assert.match(tokens, /--portal-sidebar-nav-font-size:\s*13px/);
});

test('calendário mantém título principal e compacta apenas controles da direita', () => {
  const home = read('src/pages/HomePage.tsx');
  const css = read('src/styles/portal-components.css');
  assert.match(home, /Calendário de Defesas — \{monthNamesPt\[month\]\} de \{year\}/);
  assert.match(home, /<h1 className="text-base sm:text-lg font-black uppercase/);
  assert.match(css, /\.portal-calendar-period-button \{[\s\S]*height:\s*27px[\s\S]*font-size:\s*var\(--portal-sheet-filter-chip-font-size\)[\s\S]*text-transform:\s*none/);
  assert.match(css, /\.portal-calendar-today-button \{[\s\S]*height:\s*27px[\s\S]*font-size:\s*var\(--portal-sheet-filter-chip-font-size\)[\s\S]*text-transform:\s*none/);
});

test('modal de defesa remove fechamento redundante, contagem e ícone de aluno', () => {
  const home = read('src/pages/HomePage.tsx');
  const students = read('src/components/StudentNames.tsx');
  assert.doesNotMatch(home, /title="Fechar visualização"/);
  assert.doesNotMatch(home, /\{totalSelectedEvents\}\s*\{totalSelectedEvents === 1 \? 'APRESENTAÇÃO'/);
  assert.match(home, /showIcon=\{false\}/);
  assert.match(students, /showIcon = false/);
});

test('filtros usam seleção verde e lista rolável', () => {
  const css = read('src/styles/portal-components.css');
  assert.match(css, /\.portal-core-filter-values \{[\s\S]*overflow-y:\s*scroll/);
  assert.match(css, /\.portal-core-filter-value input\[type="checkbox"\] \{[\s\S]*accent-color:\s*var\(--portal-brand-header\)/);
});

test('popups seguem branco gelo, cinzas e miolo branco', () => {
  const css = read('src/styles/portal-components.css');
  const tokens = read('src/styles/portal-tokens.css');
  assert.match(tokens, /--portal-surface-page:\s*#f1f5f9/);
  assert.match(tokens, /--portal-surface-panel:\s*#e1e6e9/);
  assert.match(tokens, /--portal-surface-card:\s*#d5dce0/);
  assert.match(tokens, /--portal-surface-inner:\s*#ffffff/);
  assert.match(css, /\.portal-modal-surface \{[\s\S]*background:\s*var\(--portal-surface-page\)/);
});

test('contas administrativas salvam dados comuns sem iniciar transferência implícita', () => {
  const admin = read('src/components/AuditAndSecuritySection.tsx');
  assert.match(admin, /Salvar Contas Administrativas/);
  assert.match(admin, /<Save className="h-3\.5 w-3\.5"/);
  const component = admin.slice(admin.indexOf('export const MasterAndPresidentConfigForm'), admin.indexOf('export const AuditLogsTable'));
  assert.doesNotMatch(component, /createAdministrationTransfer/);
  assert.match(component, /readOnly[\s\S]*value=\{masterEmail\}/);
  assert.match(component, /readOnly[\s\S]*value=\{presidentEmail\}/);
});

test('assinatura revalida elegibilidade no backend inclusive em retry e lote', () => {
  const server = read('server.ts');
  const coordinator = read('src/pages/CoordenadorPage.tsx');
  assert.match(server, /function assertSignatureEligibility/);
  assert.match(server, /function assertSignatureJobDispatchEligibility/);
  assert.match(server, /assertSignatureEligibility\(p,type\)/);
  assert.match(server, /assertSignatureJobDispatchEligibility\(process,job\)/);
  assert.match(server, /p\.avaliacao\.status!=='CONCLUIDO'/);
  assert.match(coordinator, /process\.avaliacao\?\.status !== 'CONCLUIDO'/);
});

test('rodapé registra crédito da solução de referência e centraliza membro único', () => {
  const footer = read('src/components/Footer.tsx');
  assert.match(footer, /Sabrina Lemos Rodrigues — PPGEMF/);
  assert.match(footer, /membersList\.length===1\?'sm:col-span-2'/);
});

test('gestão da comissão explicita salvamento de membros', () => {
  const commission = read('src/components/CommissionIdentityPanel.tsx');
  assert.match(commission, /Salvar membros/);
});
