import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('Portal TCC11 mantém a hierarquia global branco gelo, cinzas e branco', () => {
  const tokens = read('src/styles/portal-tokens.css');
  const css = read('src/styles/portal-components.css');
  assert.match(tokens, /--portal-surface-page:\s*#f1f5f9/);
  assert.match(tokens, /--portal-surface-panel:\s*#e1e6e9/);
  assert.match(tokens, /--portal-surface-card:\s*#d5dce0/);
  assert.match(tokens, /--portal-surface-inner:\s*#ffffff/);
  assert.match(css, /\.portal-modal-surface,[\s\S]*background:\s*var\(--portal-surface-page\)/);
});

test('filtro de coluna usa checkboxes verdes e lista rolável', () => {
  const css = read('src/styles/portal-components.css');
  assert.match(css, /\.portal-core-filter-values \{[\s\S]*max-height:\s*220px[\s\S]*overflow:\s*auto/);
  assert.match(css, /portal-core-filter-value input\[type="checkbox"\][\s\S]*accent-color:\s*var\(--portal-brand-header\)/);
});

test('modal de defesa fecha pelo fundo e não exibe contador nem X', () => {
  const home = read('src/pages/HomePage.tsx');
  assert.match(home, /id="day-defenses-modal"[\s\S]*onClick=\{\(\) => \{[\s\S]*setSelectedDayDefenses\(null\)/);
  assert.doesNotMatch(home, /totalSelectedEvents === 1 \? 'APRESENTAÇÃO'/);
  assert.doesNotMatch(home, /title="Fechar visualização"/);
});

test('assinatura em lote usa a fila pendente como fonte do cliente e revalida no servidor', () => {
  const page = read('src/pages/CoordenadorPage.tsx');
  const helper = read('src/utils/coordinatorSignatureActions.ts');
  const server = read('server.ts');
  assert.match(page, /canSendAsten/);
  assert.match(page, /canPrepareGov/);
  assert.match(helper, /hasPendingDeclaration/);
  assert.match(server, /function assertSignatureEligibility/);
  assert.match(server, /SIGNATURE_FLOW_GATE/);
  assert.match(server, /assertSignatureEligibility\(signatureProcess/);
});

test('rodapé credita Sabrina e centraliza comissão com um único membro', () => {
  const footer = read('src/components/Footer.tsx');
  assert.match(footer, /Sabrina Lemos Rodrigues — PPGEMF/);
  assert.match(footer, /membersList\.length === 1 \? 'grid-cols-1'/);
});

test('identidade e rodapé usam formulário único com salvamento automático', () => {
  const identity = read('src/components/CommissionIdentityPanel.tsx');
  const config = read('src/pages/ConfiguracoesPage.tsx');
  assert.match(identity, /aria-label="Dados de rodapé e identidade"/);
  assert.doesNotMatch(identity, /Identidade e dados do rodapé/);
  assert.match(identity, /setTimeout\(\(\) => \{ void persistRegularFields\(\); \}, 700\)/);
  assert.doesNotMatch(identity, /Alterações salvas automaticamente/);
  assert.match(identity, /Adicionar membro/);
  assert.doesNotMatch(identity, /Salvar membros|Salvar Contas Administrativas/);
  assert.doesNotMatch(config, /MasterAndPresidentConfigForm/);
});

test('release Portal TCC11 é 1.0.78', () => {
  assert.equal(JSON.parse(read('package.json')).version, '1.0.78');
});
