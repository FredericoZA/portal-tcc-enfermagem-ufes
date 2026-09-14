import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const root=path.resolve(process.cwd());
const source=(file:string)=>readFile(path.join(root,file),'utf8');

test('Asten não bloqueia a inicialização global e mantém barreira própria de despacho',async()=>{
  const [api,server,asten]=await Promise.all([source('api/index.ts'),source('server.ts'),source('server/integrations/asten.ts')]);
  assert.ok(!api.includes("missing.push('ASTEN')"));
  assert.ok(!server.includes("if(process.env.ASTEN_INTEGRATION_ENABLED==='true'){const astenSecurity=getAstenSecurityPreflight();if(!astenSecurity.callbackConfigured)throw"));
  assert.ok(asten.includes('assertAstenDispatchPreflight'));
  assert.ok(asten.includes('callbackConfigured'));
});

test('Portal oferece Asten e Gov.br como vias independentes de assinatura',async()=>{
  const [server,client,page,types]=await Promise.all([source('server.ts'),source('src/services/apiClient.ts'),source('src/pages/ProcessoDetailPage.tsx'),source('src/types/signatures.ts')]);
  assert.ok(types.includes("provider: 'ASTEN' | 'GOV_BR'"));
  assert.ok(server.includes("provider:'ASTEN'|'GOV_BR'"));
  assert.ok(server.includes("/api/signatures/jobs/:id/govbr/download"));
  assert.ok(server.includes("/api/signatures/jobs/:id/govbr/complete"));
  assert.ok(server.includes("purpose:'GOV_BR_SIGNED_PDF'"));
  assert.ok(client.includes("provider:'ASTEN'|'GOV_BR'='ASTEN'"));
  assert.ok(page.includes("handleSignDocument(doc,'ASTEN')"));
  assert.ok(page.includes("handleSignDocument(doc,'GOV_BR')"));
});

test('assinatura Gov.br preserva ordem dos signatários',async()=>{
  const server=await source('server.ts');
  const orderExpression="filter(item=>item.status!=='SIGNED').sort((a,b)=>a.signingOrder-b.signingOrder)[0]";
  assert.ok(server.split(orderExpression).length>=3);
});

test('Presidência é o contato único de recuperação do Master',async()=>{
  const [server,accounts]=await Promise.all([source('server.ts'),source('src/components/AuditAndSecuritySection.tsx')]);
  assert.ok(server.includes('masterRecoveryEmails:[configuredPresidentEmail]'));
  assert.ok(server.includes("const presidentEmail=normalizeEmail(currentSettings.commissionPresidentEmail||'')"));
  assert.ok(accounts.includes('A Presidente da Comissão é automaticamente o contato de recuperação do Master'));
  assert.ok(!accounts.includes('setRecoveryEmails'));
});

test('replicação institucional voltou sem compartilhar dados e segredos',async()=>{
  const [app,sidebar,page]=await Promise.all([source('src/App.tsx'),source('src/components/Sidebar.tsx'),source('src/pages/PortalReplicationPage.tsx')]);
  assert.ok(app.includes("case 'replicar'"));
  assert.ok(sidebar.includes("Replicar Portal"));
  assert.ok(page.includes('Nunca copie dados e segredos'));
  assert.ok(page.includes('Cada curso usa banco, Drive, OAuth, segredos e contas próprios'));
});
