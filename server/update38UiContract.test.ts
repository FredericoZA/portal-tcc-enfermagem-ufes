import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = (path:string) => readFile(path,'utf8');

test('faixa fluorescente usa exatamente o acabamento canônico da versão 1.0.36',async()=>{
  const [main,canonical,css38,css40]=await Promise.all([source('src/main.tsx'),source('src/portal-finalization.css'),source('src/portal-update-38.css'),source('src/portal-update-40.css')]);
  assert.ok(main.includes("import './portal-update-38.css';"));
  assert.ok(main.indexOf("./portal-update-40.css")>main.indexOf("./portal-update-38.css"));
  assert.ok(canonical.includes('#sidebar-nav .portal-sidebar-nav-active::before'));
  assert.ok(canonical.includes('width: 6px;'));
  assert.ok(canonical.includes('border-radius: 12px 0 0 12px;'));
  assert.ok(!css38.includes('#sidebar-nav .portal-sidebar-nav-active::before'));
  assert.ok(!css40.includes('#sidebar-nav .portal-sidebar-nav-active::before'));
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

test('Indicadores têm estado vazio útil e painel continua automático',async()=>{
  const page=await source('src/pages/IndicadoresPage.tsx');
  assert.ok(page.includes('Indicadores aguardando os primeiros dados'));
  assert.ok(page.includes('Os gráficos serão preenchidos automaticamente'));
  assert.ok(page.includes('const hasData = Boolean(data && data.totals.registered > 0)'));
  assert.ok(page.includes('TCCs por ano'));
  assert.ok(page.includes('Temas mais recorrentes'));
  assert.ok(page.includes('Resultados das bancas'));
});