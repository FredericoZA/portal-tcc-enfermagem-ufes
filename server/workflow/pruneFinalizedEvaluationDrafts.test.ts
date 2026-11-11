import assert from 'node:assert/strict';
import test from 'node:test';
import {pruneFinalizedEvaluationDrafts} from './pruneFinalizedEvaluationDrafts';

test('expurgo remove somente autosave com conclusao e arquivo definitivo verificado',()=>{
  const complete={id:'tcc-completo',status:'CONCLUIDO',avaliacao:{status:'CONCLUIDO'},acervo:{submittedAt:'2026-11-10'}};
  const pending={id:'tcc-pendente',status:'CONCLUIDO',avaliacao:{status:'CONCLUIDO'},acervo:{submittedAt:'2026-11-10'}};
  const active={id:'tcc-ativo',status:'EM_ANDAMENTO',avaliacao:{status:'PENDENTE'},acervo:{}};
  const drafts=new Map([['tcc-completo',{answers:{a:1}}],['tcc-pendente',{answers:{a:2}}],['tcc-ativo',{answers:{a:3}}]]);
  const proof=(item:{id:string})=>item.id==='tcc-completo';
  assert.equal(pruneFinalizedEvaluationDrafts([complete,pending,active],drafts,proof),1);
  assert.deepEqual([...drafts.keys()],['tcc-pendente','tcc-ativo']);
  assert.equal(pruneFinalizedEvaluationDrafts([complete,pending,active],drafts,proof),0);
});
test('ausencia de comprovacao documental nao expurga rascunho de TCC concluido',()=>{
  const process={id:'tcc',status:'CONCLUIDO',avaliacao:{status:'CONCLUIDO'},acervo:{submittedAt:'2026-11-10'}};
  const drafts=new Map([['tcc',{text:'important'}]]);
  assert.equal(pruneFinalizedEvaluationDrafts([process],drafts,()=>false),0);
  assert.equal(drafts.has('tcc'),true);
});
