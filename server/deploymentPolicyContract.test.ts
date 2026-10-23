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

test('Vercel não dispara builds em nenhuma branch, incluindo main', () => {
  // boolean false é a configuração oficial da Vercel para desligar
  // todos os deploys de Git; exigir valor exato impede exceções acidentais.
  assert.equal(config.git?.deploymentEnabled, false);
});

test('release Asten autorizado preserva autenticação e cofre durável', () => {
  assert.equal(config.env?.ASTEN_INTEGRATION_ENABLED, 'true');
  assert.equal(config.env?.ASTEN_PRODUCTION_RELEASE_APPROVED, 'true');
  assert.equal(config.env?.PORTAL_ALLOW_INSECURE_DEMO_AUTH, 'false');
  assert.equal(config.env?.PORTAL_ALLOW_LOCAL_SECRET_STORE, 'false');
});
