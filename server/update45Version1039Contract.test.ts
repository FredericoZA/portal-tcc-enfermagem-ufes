import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readPortalCss } from './testUtils/portalCss';
const read=(p:string)=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('cabeçalhos e separadores foram absorvidos pelo contrato canônico',()=>{
  const runtime=read('src/components/PortalStructuralRuntime.tsx');
  const css=readPortalCss();
  assert.match(runtime,/portal-core-column-menu/);
  assert.match(css,/--portal-sheet-title-divider:\s*5px/);
  assert.match(css,/--portal-sheet-content-divider:\s*15px/);
  assert.doesNotMatch(css,/!important/);
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
