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
  assert.ok(server.includes("import { nextPendingSignatureSigner } from './server/workflow/signatureOrder'"));
  assert.ok(server.split('nextPendingSignatureSigner(job.signers)').length>=3);
  assert.ok(server.includes("role:'ADVISOR' as const,name:p.orientador.nome,email:normalizeEmail(p.orientador.email),signingOrder:2"));
  assert.ok(server.includes("code:'SIGNING_ORDER_REQUIRED'"));
});

test('Presidência é o contato único de recuperação do Master',async()=>{
  const [server,accounts]=await Promise.all([source('server.ts'),source('src/components/AuditAndSecuritySection.tsx')]);
  assert.ok(server.includes('masterRecoveryEmails:[configuredPresidentEmail]'));
  assert.ok(server.includes("const presidentEmail=normalizeEmail(currentSettings.commissionPresidentEmail||'')"));
  assert.ok(server.includes("requested.length!==1||requested[0]!==presidentEmail"));
  assert.ok(server.includes("masterRecoveryEmails:[presidentEmail]"));
  assert.ok(accounts.includes('A Presidente da Comissão é automaticamente o contato de recuperação do Master'));
  assert.ok(!accounts.includes('setRecoveryEmails'));
});

test('replicação pública oferece repositório e downloads de cópias independentes dos modelos',async()=>{
  const [app,sidebar,page,downloadApi,vercel]=await Promise.all([
    source('src/App.tsx'),
    source('src/components/Sidebar.tsx'),
    source('src/pages/PortalReplicationPage.tsx'),
    source('api/replication-model.ts'),
    source('vercel.json')
  ]);
  assert.ok(app.includes("case 'replicar'"));
  assert.ok(sidebar.includes("Replicar Portal"));
  assert.ok(page.includes('Abrir no GitHub'));
  assert.ok(page.includes('Modelos do Google Drive'));
  assert.ok(page.includes('/api/public/replication-models/'));
  assert.ok(page.includes('Baixar modelos'));
  assert.ok(downloadApi.includes('getGoogleWorkspaceAccessToken'));
  assert.ok(downloadApi.includes("application/vnd.openxmlformats-officedocument.wordprocessingml.document"));
  assert.ok(vercel.includes('/api/public/replication-models/:slug/download'));
  assert.ok(!page.includes('Nunca copie dados e segredos'));
  assert.ok(!page.includes('Cada curso usa banco, Drive, OAuth, segredos e contas próprios'));
  assert.ok(!page.includes('SUPABASE_SECRET_KEY'));
  assert.ok(!page.includes('GOOGLE_OAUTH_CLIENT_SECRET'));
});