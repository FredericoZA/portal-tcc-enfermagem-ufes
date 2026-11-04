import { DEFAULT_OPERATIONAL_CONFIG } from '../src/utils/operationalConfig';
import assert from 'node:assert/strict';
import test from 'node:test';
import type { ProcessData, StudioFormSubmission } from '../src/types';
import { buildTccStatisticalSnapshot } from './statisticalSnapshot';

function process(id: string, overrides: Partial<ProcessData> = {}): ProcessData {
  return {
    id,
    protocolo: `TCC-2026-${id}`,
    titulo: `Título pessoal sensível ${id}`,
    etapaAtual: 'CADASTRO',
    status: 'EM_RASCUNHO',
    createdByEmail: `aluno-${id}@example.edu`,
    aluno1: { nome: `Pessoa ${id}`, matricula: `M${id}`, email: `aluno-${id}@example.edu` },
    aluno2: null,
    orientador: { nome: 'Orientadora', email: 'orientadora@example.edu' },
    coorientador: null,
    banca: [],
    defesa: { startAt: '', endAt: '', local: '' },
    avaliacao: { status: 'PENDENTE' },
    dataRevision: 1,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
    ...overrides
  };
}

function submission(processId: string, answers: StudioFormSubmission['answers']): StudioFormSubmission {
  return { id: `s-${processId}`, processId, formId: 'classificacao', formRevision: 1, submittedBy: 'secretaria@example.edu', submittedAt: '2026-02-01T00:00:00.000Z', answers, checksum: 'a'.repeat(64), archiveStatus: 'ARCHIVED' };
}

test('panorama calcula totais e protege categorias temáticas pequenas', () => {
  const processes = [
    process('1', { status: 'CONCLUIDO', aluno2: { nome: 'Coautora', matricula: 'M2', email: 'coautora@example.edu' }, acervo: { workType: 'ARTIGO', publishFullWork: true, palavrasChave: ['Saúde coletiva'] }, updatedAt: '2026-01-11T00:00:00.000Z' }),
    process('2', { acervo: { palavrasChave: ['Saúde coletiva'] } }),
    process('3', { acervo: { palavrasChave: ['Saúde coletiva'] } }),
    process('4')
  ];
  const forms = [
    submission('1', { AREA_TEMATICA: 'Saúde coletiva', TEMA_PRINCIPAL: 'Atenção primária' }),
    submission('2', { AREA_TEMATICA: 'Saúde coletiva', TEMA_PRINCIPAL: 'Atenção primária' }),
    submission('3', { AREA_TEMATICA: 'Saúde coletiva', TEMA_PRINCIPAL: 'Atenção primária' }),
    submission('4', { AREA_TEMATICA: 'Categoria única', TEMA_PRINCIPAL: 'Tema único' })
  ];
  const result = buildTccStatisticalSnapshot({ studio: {operationalConfig:{...DEFAULT_OPERATIONAL_CONFIG,catalogs:['Saúde coletiva','Categoria única'].map((label,i)=>({id:String(i),kind:'AREA_TEMATICA',label,aliases:[],active:true}))}}, processes, formSubmissions: forms, generatedAt: '2026-02-10T00:00:00.000Z' });
  assert.equal(result.totals.processes, 4);
  assert.equal(result.totals.authors, 5);
  assert.equal(result.rates.completion, 25);
  assert.deepEqual(result.distributions.areas.entries.map((entry) => [entry.label, entry.count]), [['Saúde coletiva', 3]]);
  assert.equal(result.distributions.areas.suppressed, 1);
  assert.equal(result.dataQuality.areaCoverage, 100);
});

test('estatísticas privadas não criam propostas nem incluem títulos ou identidades', () => {
  const data=buildTccStatisticalSnapshot({processes:[process('sigiloso')],formSubmissions:[],generatedAt:'2026-02-10T00:00:00.000Z'});
  const encoded=JSON.stringify(data);
  assert.doesNotMatch(encoded,/Título pessoal sensível|aluno-sigiloso@example.edu|Pessoa sigiloso/);
  assert.equal(data.distributions.themes.unknown,1);
  assert.equal(data.privacy.containsPersonalData,false);
});
