import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = (path:string) => readFile(path,'utf8');

test('sidebar ativa usa apenas o estado canônico, sem faixa fluorescente histórica',async()=>{
  const [main,css]=await Promise.all([source('src/main.tsx'),source('src/index.css')]);
  assert.ok(main.includes("import './index.css';"));
  assert.ok(css.includes('--portal-sidebar-active: #154d41'));
  assert.ok(!css.includes('#74FF96'));
});

test('Replicar Portal oferece um único download agregado dos quatro modelos',async()=>{
  const [page,api]=await Promise.all([source('src/pages/PortalReplicationPage.tsx'),source('api/replication-model.ts')]);
  assert.ok(page.includes('Baixar modelos'));
  assert.ok(page.includes('/api/public/replication-models/all/download'));
  assert.ok(page.includes('um único arquivo ZIP'));
  assert.ok(!page.includes('Li e aceito baixar todos os modelos'));
  assert.ok(!page.includes('downloadAllModels'));
  assert.ok(api.includes("convite:"));
  assert.ok(api.includes("termo:"));
  assert.ok(api.includes("ata:"));
  assert.ok(api.includes("declaracao:"));
  assert.ok(api.includes("modelos-portal-tcc.zip"));
});

test('Indicadores mantêm carregamento automático e painel analítico denso',async()=>{
  const page=await source('src/pages/IndicadoresPage.tsx');
  assert.ok(page.includes("fetch('/api/public/indicators'"));
  assert.ok(page.includes('const LineTrend'));
  assert.ok(page.includes('const Funnel'));
  assert.ok(page.includes('Evolução anual'));
  assert.ok(page.includes('Temas recorrentes'));
  assert.ok(page.includes('Resultados das bancas'));
  assert.ok(page.includes('Volatilidade mensal'));
});