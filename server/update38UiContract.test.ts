import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = (path:string) => readFile(path,'utf8');

test('faixa fluorescente cobre toda a borda esquerda do item ativo',async()=>{
  const [main,css]=await Promise.all([source('src/main.tsx'),source('src/portal-update-38.css')]);
  assert.ok(main.includes("import './portal-update-38.css';"));
  assert.ok(css.includes('#sidebar-nav .portal-sidebar-nav-active::before'));
  assert.ok(css.includes('left: -1px !important'));
  assert.ok(css.includes('top: -1px !important'));
  assert.ok(css.includes('bottom: -1px !important'));
  assert.ok(css.includes('width: 8px !important'));
  assert.ok(css.includes('border-radius: 0 !important'));
});

test('Replicar Portal usa quatro ações verdes diretas para modelos',async()=>{
  const page=await source('src/pages/PortalReplicationPage.tsx');
  assert.equal((page.match(/portal-replication-model-action/g)||[]).length,1);
  assert.ok(page.includes("{ slug: 'convite', label: 'Convite de Defesa' }"));
  assert.ok(page.includes("{ slug: 'termo', label: 'Termo de Autorização' }"));
  assert.ok(page.includes("{ slug: 'ata', label: 'Ata de Defesa' }"));
  assert.ok(page.includes("{ slug: 'declaracao', label: 'Declaração da Banca' }"));
  assert.ok(!page.includes('portal-layer-inner flex flex-col justify-between'));
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
