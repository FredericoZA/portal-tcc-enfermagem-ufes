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

test('funções especializadas não empacotam o servidor monolítico nem fontes de documentos',()=>{
  const functions=JSON.parse(readFileSync(new URL('../vercel.json',import.meta.url),'utf8')).functions as Record<string,{includeFiles:string}>;
  const core=functions['api/index.ts'].includeFiles;
  assert.match(core,/dist\/server\/server\.cjs/);
  assert.match(core,/dist\/server\/vercel\/index\.cjs/);
  assert.match(core,/server\/documents\/fonts/);
  for(const route of ['runtime-asset','public-indicators','replication-model']){
    const include=functions[`api/${route}.ts`].includeFiles;
    assert.equal(include,`dist/server/vercel/${route}.cjs`);
    assert.doesNotMatch(include,/server\.cjs|dist\/server\/\*\*|documents\/fonts/);
  }
});
