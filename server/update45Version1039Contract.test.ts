import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read=(p:string)=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('1.0.40 mantém cabeçalhos estáveis e separadores brancos em camadas',()=>{
  const enhancer=read('src/components/PortalSpreadsheetEnhancer.tsx');
  const css=read('src/portal-version-1040.css');
  assert.match(enhancer,/canonicalizeHeader/);
  assert.match(enhancer,/wrapper\.className='portal-column-header-content'/);
  assert.match(css,/border-bottom:4px solid #fff/);
  assert.match(css,/portal-defense-filter-row/);
});

test('1.0.40 mantém seleção em lote e registro de assinaturas independente do provedor',()=>{
  const coordinator=read('src/pages/CoordenadorPage.tsx');
  const signatures=read('src/pages/AstenLogsPage.tsx');
  assert.match(coordinator,/toggleSelectAllPending/);
  assert.match(coordinator,/handleSignSelected/);
  assert.match(signatures,/Registros de Assinatura/);
  assert.match(signatures,/providerLabel/);
  assert.doesNotMatch(signatures,/getAstenStatus/);
});

test('1.0.40 mantém workspaces administrativos e consolida download dos modelos em um zip',()=>{
  const enhancer=read('src/components/PortalVersion1040Enhancer.tsx');
  const replication=read('src/pages/PortalReplicationPage.tsx');
  const replicationApi=read('api/replication-model.ts');
  const integrations=read('src/components/InfrastructureIntegrationsPanel.tsx');
  assert.match(enhancer,/identity: 'Rodapé'/);
  assert.match(enhancer,/keepPortalDialogsAboveWorkspaces/);
  assert.match(replication,/replication-models\/all\/download/);
  assert.doesNotMatch(replication,/downloadAllModels/);
  assert.match(replicationApi,/modelos-portal-tcc\.zip/);
  assert.match(integrations,/Testar conexão/);
  assert.doesNotMatch(integrations,/>Conexões</);
});

test('release atual está marcado como 1.0.41',()=>{
  const pkg=JSON.parse(read('package.json'));
  assert.equal(pkg.version,'1.0.41');
});