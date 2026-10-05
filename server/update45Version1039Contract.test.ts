import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readPortalCss } from './testUtils/portalCss';
const read=(p:string)=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('cabeçalhos e separadores foram absorvidos pelo contrato canônico',()=>{
  const runtime=read('src/utils/portalTableDom.ts');
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

test('workspaces administrativos e replicação usam componentes atuais',()=>{
  const workspace=read('src/components/SettingsWorkspaceModal.tsx');
  const replication=read('src/pages/PortalReplicationPage.tsx');
  const replicationApi=read('api/replication-model.ts');
  const integrations=read('src/components/InfrastructureIntegrationsPanel.tsx');
  assert.match(workspace,/portal-settings-workspace/);
  assert.match(workspace,/data-portal-full-bleed/);
  assert.match(replication,/replication-models\/all\/download/);
  assert.doesNotMatch(replication,/downloadAllModels/);
  assert.match(replicationApi,/modelos-portal-tcc\.zip/);
  assert.match(integrations,/Testar conexão/);
  assert.doesNotMatch(integrations,/>Conexões</);
});
