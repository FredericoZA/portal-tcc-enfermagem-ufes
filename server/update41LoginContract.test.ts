import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = (path:string) => readFile(path,'utf8');

test('popup de acesso diferencia discentes dos demais perfis', async () => {
  const [config, enhancer] = await Promise.all([
    source('src/utils/loginPopupConfig.ts'),
    source('src/components/PortalUiEnhancer.tsx'),
  ]);
  assert.ok(config.includes('se você é discente, utilize seu e-mail institucional @edu.ufes.br.'));
  assert.ok(config.includes('Master, Presidência, docentes, banca e demais usuários'));
  assert.ok(config.includes('Gmail, Outlook/Hotmail'));
  assert.ok(config.includes("emailPlaceholder: 'seuemail@exemplo.com'"));
  assert.ok(enhancer.includes("node.textContent = 'Demais usuários:'"));
  assert.ok(enhancer.includes("node.textContent = 'Orientação dos demais usuários:'"));
});

test('solicitação de código repete uma vez somente em falhas transitórias', async () => {
  const [resilience, main] = await Promise.all([
    source('src/utils/authRequestResilience.ts'),
    source('src/main.tsx'),
  ]);
  assert.ok(resilience.includes('new Set([502, 503, 504])'));
  assert.ok(resilience.includes("url.pathname === '/api/auth/request-code'"));
  assert.ok(resilience.includes('return nativeFetch(input, init)'));
  assert.ok(main.includes("import { installAuthRequestResilience } from './utils/authRequestResilience';"));
  assert.ok(main.includes('installAuthRequestResilience();'));
});

test('503 estruturado expõe mensagem útil e smoke monitora request-code', async () => {
  const [api, smoke] = await Promise.all([
    source('api/index.ts'),
    source('.github/workflows/production-smoke.yml'),
  ]);
  assert.ok(api.includes('error: diagnostic.message'));
  assert.ok(api.includes('message: diagnostic.message'));
  assert.ok(smoke.includes('/api/auth/request-code'));
  assert.ok(smoke.includes('production-smoke-probe@example.invalid'));
  assert.ok(smoke.includes('Solicitação pública de acesso respondeu HTTP'));
});
