import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = (path:string) => readFile(path,'utf8');

test('faixa fluorescente mantém a correção histórica e recebe acabamento na atualização vigente',async()=>{
  const [main,css38,css40]=await Promise.all([source('src/main.tsx'),source('src/portal-update-38.css'),source('src/portal-update-40.css')]);
  assert.ok(main.includes("import './portal-update-38.css';"));
  assert.ok(main.indexOf("./portal-update-40.css")>main.indexOf("./portal-update-38.css"));
  assert.ok(css38.includes('#sidebar-nav .portal-sidebar-nav-active::before'));
  assert.ok(css38.includes('left: -1px !important'));
  assert.ok(css38.includes('width: 8px !important'));
  assert.ok(css40.includes('width: 12px !important'));
  assert.ok(css40.includes('border-radius: 0 !important'));
});

test('Replicar Portal preserva os quatro modelos dentro de uma ação compacta',async()=>{
  const page=await source('src/pages/PortalReplicationPage.tsx');
  assert.ok(page.includes('Baixar modelos'));
  assert.ok(page.includes('<details'));
  assert.ok(page.includes("{ slug: 'convite', label: 'Convite de Defesa' }"));
  assert.ok(page.includes("{ slug: 'termo', label: 'Termo de Autorização' }"));
  assert.ok(page.includes("{ slug: 'ata', label: 'Ata de Defesa' }"));
  assert.ok(page.includes("{ slug: 'declaracao', label: 'Declaração da Banca' }"));
  assert.ok(!page.includes('portal-replication-model-action'));
});

test('Indicadores têm estado vazio útil e painel continua automático',async()=>{
  const page=await source('src/pages/IndicadoresPage.tsx');
  assert.ok(page.includes('Indicadores aguardando os primeiros dados'));
  assert.ok(page.includes('O painel já está preparado para evoluir automaticamente'));
  assert.ok(page.includes('const hasData=Boolean(data&&data.totals.registered>0)'));
  assert.ok(page.includes('TCCs por ano'));
  assert.ok(page.includes('Temas mais recorrentes'));
  assert.ok(page.includes('Resultados acadêmicos'));
});
