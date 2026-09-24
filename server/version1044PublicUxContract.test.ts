import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('cabeçalho não apresenta acesso institucional nem identidade para visitante público', () => {
  const header = read('src/components/Header.tsx');
  assert.doesNotMatch(header, /Acesso Institucional/i);
  assert.match(header, /Usuário Master/);
  assert.match(header, /Acesso pelo e-mail/);
  assert.match(header, /@publico\.local/);
  assert.match(header, /showAuthenticatedIdentity/);
});

test('planilhas aplicam política única sem emojis e defesas passadas não ficam foscas', () => {
  const main = read('src/main.tsx');
  const policy = read('src/components/PortalTableTextPolicy.tsx');
  const css = read('src/portal-public-ux-1044.css');
  assert.match(main, /PortalTableTextPolicy/);
  assert.match(policy, /querySelectorAll<HTMLTableElement>\('#portal-app-root table'\)/);
  assert.match(policy, /TABLE_EMOJI_PATTERN/);
  assert.match(css, /opacity: 1 !important/);
  assert.match(css, /color: #000 !important/);
});

test('separador grosso encerra o bloco superior e não separa cabeçalho de dados', () => {
  const css = read('src/portal-public-ux-1044.css');
  assert.match(css, /--portal-separator-section: 16px/);
  assert.match(css, /--portal-separator-table: 0px/);
  assert.match(css, /portal-tutorial-filter-row[\s\S]*border-top: 2px solid #fff/);
  assert.match(css, /portal-public-header[\s\S]*border-bottom: 16px solid #fff/);
  assert.match(css, /portal-core-table thead tr:last-child > th[\s\S]*border-bottom-width: 0/);
});

test('replicar portal mantém cartões com a mesma altura', () => {
  const page = read('src/pages/PortalReplicationPage.tsx');
  assert.match(page, /auto-rows-fr/);
  assert.match(page, /flex h-full min-h-\[172px\] flex-col/);
  assert.doesNotMatch(page, /self-start/);
  assert.match(page, /mt-auto pt-3/);
});

test('tutorial público contém orientação operacional detalhada por perfil', () => {
  const page = read('src/pages/PortalTutorialPage.tsx');
  assert.match(page, /Antes de começar/);
  assert.match(page, /Conferência antes de encerrar/);
  assert.match(page, /Erros a evitar/);
  assert.match(page, /Passo a passo/);
  assert.match(page, /Presidente da Comissão/);
  assert.match(page, /autorizações? de publicação/i);
});

test('fluxo remove introdução redundante e mantém resultado alinhado no rodapé dos cards', () => {
  const page = read('src/pages/FluxoTccPage.tsx');
  assert.doesNotMatch(page, /O Portal acompanha o TCC do primeiro cadastro ao encerramento/);
  assert.match(page, /portal-flow-step flex h-full flex-col/);
  assert.match(page, /flex-1 space-y-1\.5/);
  assert.match(page, /Para avançar:/);
  assert.match(page, /Resultado:/);
});

test('indicadores oferecem painel analítico com séries, comparações e distribuições sem botão manual de atualizar', () => {
  const page = read('src/pages/IndicadoresPage.tsx');
  assert.doesNotMatch(page, /RefreshCw/);
  assert.doesNotMatch(page, /Panorama estatístico agregado dos TCCs/);
  assert.match(page, /const LineTrend/);
  assert.match(page, /const Funnel/);
  assert.match(page, /Evolução anual/);
  assert.match(page, /Defesas por mês/);
  assert.match(page, /Volatilidade mensal/);
  assert.match(page, /Dia da semana/);
  assert.match(page, /Faixa de horário/);
  assert.match(page, /Temas recorrentes/);
  assert.match(page, /Locais das defesas/);
  assert.match(page, /Resultados das bancas/);
});