import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('planilhas usam um único menu por coluna para ordenar e filtrar', () => {
  const enhancer = read('src/components/PortalMaintenanceEnhancer.tsx');
  assert.match(enhancer, /portal1043-column-menu-button/);
  assert.match(enhancer, /Ordenar A → Z \/ menor → maior/);
  assert.match(enhancer, /Ordenar Z → A \/ maior → menor/);
  assert.match(enhancer, /filterTitle\.textContent = 'Filtrar'/);
  assert.match(enhancer, /portal1043-filter-hidden/);
});

test('progresso é apresentado como etapa regular nas planilhas', () => {
  const enhancer = read('src/components/PortalMaintenanceEnhancer.tsx');
  const css = read('src/portal-maintenance.css');
  assert.match(enhancer, /replace\(\/\\bProgresso\\b\/gi, 'Etapa'\)/);
  assert.match(enhancer, /marker\.textContent = `Etapa \$\{match\[1\]/);
  assert.match(css, /portal1043-stage-label/);
  assert.match(css, /font-weight: 400 !important/);
});

test('calendário reserva fins de semana estreitos e indisponíveis para defesas', () => {
  const enhancer = read('src/components/PortalMaintenanceEnhancer.tsx');
  const css = read('src/portal-maintenance.css');
  assert.match(enhancer, /weekday === 0 \|\| weekday === 6/);
  assert.match(css, /grid-template-columns: \.20fr 1\.36fr 1\.36fr 1\.36fr 1\.36fr 1\.36fr \.20fr/);
  assert.match(css, /portal1043-calendar-weekend/);
  assert.match(css, /pointer-events: none !important/);
});

test('planilhas têm cabeçalho mais alto, separador branco forte, texto preto e hover neutro', () => {
  const enhancer = read('src/components/PortalMaintenanceEnhancer.tsx');
  const css = read('src/portal-maintenance.css');
  assert.match(css, /border-bottom: 20px solid #fff !important/);
  assert.match(css, /padding-top: \.95rem !important/);
  assert.match(css, /color: #000 !important/);
  assert.match(enhancer, /neutralizeHoverBehavior/);
  assert.match(enhancer, /selectorText\.includes\(':hover'\)/);
});

test('manutenção é carregada depois da camada visual 1.0.40', () => {
  const main = read('src/main.tsx');
  const css1040 = main.indexOf("import './portal-version-1040.css';");
  const cssMaintenance = main.indexOf("import './portal-maintenance.css';");
  const enhancer1040 = main.indexOf('<PortalVersion1040Enhancer />');
  const enhancerMaintenance = main.indexOf('<PortalMaintenanceEnhancer />');
  assert.ok(css1040 >= 0 && cssMaintenance > css1040);
  assert.ok(enhancer1040 >= 0 && enhancerMaintenance > enhancer1040);
});
