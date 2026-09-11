import { DEFAULT_OPERATIONAL_CONFIG } from '../src/utils/operationalConfig';
import assert from 'node:assert/strict';
import test from 'node:test';
import type { ProcessData, StudioFormSubmission } from '../src/types';
import { buildContinuousIntelligenceState, buildTccStatisticalSnapshot, LIVING_ARTIFACT_FILE_NAMES } from './continuousIntelligence';

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

test('relatórios não copiam dados pessoais nem inferem tema pelo título', () => {
  const state = buildContinuousIntelligenceState({
    processes: [process('segredo')], workflowRuns: [], emailDeliveries: [], signatureJobs: [], formSubmissions: [], correctionRequests: [],
    courseName: 'Enfermagem', institutionName: 'Universidade', generatedAt: '2026-02-10T00:00:00.000Z'
  });
  const combined = Object.values(state.artifacts).map((artifact) => artifact.markdown).join('\n');
  assert.doesNotMatch(combined, /Título pessoal sensível/i);
  assert.doesNotMatch(combined, /aluno-segredo@example\.edu/i);
  assert.equal(state.statistics.distributions.themes.unknown, 1);
  assert.equal(state.statistics.privacy.containsPersonalData, false);
  assert.equal(state.artifacts.FLOW_IMPROVEMENT_MEMORY.fileName, LIVING_ARTIFACT_FILE_NAMES.FLOW_IMPROVEMENT_MEMORY);
  assert.equal(state.artifacts.TCC_STATISTICAL_REPORT.fileName, LIVING_ARTIFACT_FILE_NAMES.TCC_STATISTICAL_REPORT);
});

test('decisão do Master e histórico permanecem quando a evidência muda', () => {
  const first = buildContinuousIntelligenceState({
    processes: [process('1')], workflowRuns: [{ id: 'run', processId: '1', protocol: 'TCC-1', eventCode: 'TCC_CREATED', actorEmail: 'x@example.edu', startedAt: '2026-01-01T00:00:00.000Z', completedAt: '2026-01-01T00:00:01.000Z', status: 'PARTIAL_FAILURE', actions: [], issues: [] }], emailDeliveries: [], signatureJobs: [], formSubmissions: [], correctionRequests: [], courseName: 'Enfermagem', institutionName: 'Universidade', generatedAt: '2026-02-10T00:00:00.000Z'
  });
  const proposal = first.proposals.find((item) => item.id === 'improvement-workflow-failures')!;
  proposal.status = 'APPROVED';
  proposal.reviewedAt = '2026-02-10T01:00:00.000Z';
  const second = buildContinuousIntelligenceState({
    processes: [process('1')], workflowRuns: [], emailDeliveries: [], signatureJobs: [], formSubmissions: [], correctionRequests: [], courseName: 'Enfermagem', institutionName: 'Universidade', generatedAt: '2026-02-11T00:00:00.000Z', previous: first
  });
  const preserved = second.proposals.find((item) => item.id === proposal.id)!;
  assert.equal(preserved.status, 'APPROVED');
  assert.equal(preserved.evidenceActive, false);
  assert.equal(second.artifacts.FLOW_IMPROVEMENT_MEMORY.version, 2);
});
