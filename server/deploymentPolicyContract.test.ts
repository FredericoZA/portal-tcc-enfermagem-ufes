import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

type VercelConfiguration = {
  git?: { deploymentEnabled?: boolean | Record<string, boolean> };
  env?: Record<string, string>;
};
const config: VercelConfiguration = JSON.parse(
  readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'),
);

test('Vercel só publica automaticamente a branch de produção main', () => {
  const policy = config.git?.deploymentEnabled;
  assert.equal(typeof policy, 'object', 'a política deve discriminar a branch main');
  if (!policy || typeof policy !== 'object') return;

  // A Vercel usa minimatch, e uma regra "true" vence se várias coincidirem.
  // A regra de fallback ("**") desliga previews; main é uma exceção explícita.
  assert.deepEqual(policy, { '**': false, main: true });
  assert.equal(policy.main, true);
  assert.equal(policy['**'], false);
});

test('controle de builds não modifica configuração de segurança da Asten', () => {
  assert.equal(config.env?.ASTEN_INTEGRATION_ENABLED, 'false');
  assert.equal(config.env?.PORTAL_ALLOW_INSECURE_DEMO_AUTH, 'false');
  assert.equal(config.env?.PORTAL_ALLOW_LOCAL_SECRET_STORE, 'false');
});
