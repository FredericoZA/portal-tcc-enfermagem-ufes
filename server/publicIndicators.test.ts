import test from 'node:test';
import assert from 'node:assert/strict';
import type { ProcessData } from '../src/types';
import { buildPublicIndicators } from './publicIndicators';

const baseProcess = (patch: Partial<ProcessData> = {}): ProcessData => ({
  id: 'p1',
  protocolo: 'TCC-2026-0001',
  titulo: 'Teste',
  etapaAtual: 'CONCLUIDO',
  status: 'CONCLUIDO',
  createdByEmail: 'a@aluno.ufes.br',
  aluno1: { nome: 'Aluno Teste', email: 'a@aluno.ufes.br', matricula: '20260001' },
  aluno2: null,
  orientador: { nome: 'Prof Teste', email: 'p@ufes.br' },
  coorientador: null,
  banca: [],
  defesa: { startAt: '2026-09-10T12:00:00Z', endAt: '2026-09-10T13:30:00Z', local: 'Auditório', localStatus: 'CONFIRMADO' },
  avaliacao: { status: 'CONCLUIDO', resultadoCode: 'APROVADO', resultadoLabel: 'Aprovado', parecer: '' },
  acervo: { publicationState: 'PUBLIC', palavrasChave: ['saúde'], workType: 'ARTIGO', isPublic: true },
  dataRevision: 1,
  createdAt: '2026-08-01T12:00:00Z',
  updatedAt: '2026-09-10T14:00:00Z',
  ...patch,
});

test('indicadores públicos agregam sem expor dados pessoais', () => {
  const processes = Array.from({length:6},(_,i)=>baseProcess({
    id:`p${i+1}`,
    protocolo:`TCC-2026-000${i+1}`,
    aluno1:{ nome:`Aluno ${i+1}`, email:`aluno${i+1}@aluno.ufes.br`, matricula:`2026000${i+1}` },
  }));
  const payload = buildPublicIndicators(processes, Date.parse('2026-09-17T12:00:00Z'));
  assert.equal(payload.totals.registered,6);
  assert.equal(payload.totals.completed,6);
  assert.equal(payload.totals.defended,6);
  assert.equal(payload.privacy.smallGroupSuppressed,false);
  const json=JSON.stringify(payload);
  assert.ok(!json.includes('@aluno.ufes.br'));
  assert.ok(!json.includes('20260001'));
  assert.ok(payload.years.some(item=>item.label==='2026'&&item.count===6));
});

test('indicadores suprimem detalhamento em grupo pequeno', () => {
  const payload = buildPublicIndicators([baseProcess(),baseProcess({id:'p2',protocolo:'TCC-2026-0002'})], Date.parse('2026-09-17T12:00:00Z'));
  assert.equal(payload.privacy.smallGroupSuppressed,true);
  assert.equal(payload.totals.registered,2);
  assert.equal(payload.totals.completed,0);
  assert.deepEqual(payload.byStatus,[]);
  assert.deepEqual(payload.themes,[]);
});


test('API pública não retorna palavras-chave, locais ou resultados com texto livre', () => {
  const secret='IDENTIFICADOR_PESSOAL_TESTE';
  const cases=Array.from({length:8},(_,i)=>baseProcess({
    id:`sig-${i}`,
    protocolo:`TCC-2026-${i+1}`,
    acervo:{ publicationState:'PUBLIC', palavrasChave:[secret], workType:'ARTIGO', isPublic:true },
    defesa:{ startAt:'2026-09-10T12:00:00Z', endAt:'2026-09-10T13:30:00Z', local:secret, localStatus:'CONFIRMADO' },
    avaliacao:{ status:'CONCLUIDO', resultadoCode:'APROVADO', resultadoLabel:secret, parecer:secret },
  }));
  const result=buildPublicIndicators(cases,Date.parse('2026-09-17T12:00:00Z'));
  assert.deepEqual(result.themes,[]);
  assert.deepEqual(result.locations,[]);
  assert.equal(JSON.stringify(result).includes(secret),false);
  assert.ok(result.outcomes.some(row=>row.label==='Aprovado'&&row.count===8));
});

test('mês isolado e única duração de conclusão não são inferíveis na resposta pública', () => {
  const processes=Array.from({length:6},(_,i)=>baseProcess({
    id:`p-${i+1}`,
    defesa:{ startAt:`2026-${String(i+1).padStart(2,'0')}-10T12:00:00Z`, endAt:'', local:'Auditório', localStatus:'CONFIRMADO' },
    completedAt: i===0 ? '2026-01-12T12:00:00Z' : undefined,
  }));
  const result=buildPublicIndicators(processes,Date.parse('2026-11-01T12:00:00Z'));
  assert.equal(result.descriptive?.peakMonth,null);
  assert.equal(result.descriptive?.peakMonthCount,0);
  assert.equal(result.descriptive?.completionDaysMean,null);
  assert.equal(result.descriptive?.completionDaysMedian,null);
  assert.deepEqual(result.months,[]);
});

test('rótulos de situação inesperados nunca são devolvidos como texto livre', () => {
  const secret='IDENTIDADE_PESSOAL_NAO_CATALOGADA';
  const processes=Array.from({length:6},(_,i)=>baseProcess({id:`n-${i}`,status: secret as ProcessData['status']}));
  const result=buildPublicIndicators(processes,Date.parse('2026-11-01T12:00:00Z'));
  assert.equal(JSON.stringify(result).includes(secret),false);
  assert.deepEqual(result.byStatus,[]);
});
