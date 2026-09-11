import { operationalConfig, resolveCatalogValue } from '../src/utils/operationalConfig';
import type { IntegrationStudioSettings } from '../src/types/integrationStudio';
import { createHash } from 'crypto';
import type {
  ContinuousIntelligenceState,
  DocumentCorrectionRequest,
  ImprovementProposal,
  ImprovementStatus,
  LivingPortalArtifact,
  LivingPortalArtifactKind,
  ProcessData,
  SignatureJob,
  StatisticalDistribution,
  StudioFormSubmission,
  TccStatisticalSnapshot
} from '../src/types';
import type { EmailDeliveryRecord, WorkflowRun } from '../src/types/automation';

export const LIVING_ARTIFACT_FILE_NAMES: Record<LivingPortalArtifactKind, string> = {
  FLOW_IMPROVEMENT_MEMORY: 'MEMORIA_CONTINUA_FLUXOS_E_MELHORIAS.md',
  TCC_STATISTICAL_REPORT: 'PANORAMA_ESTATISTICO_DOS_TCCS.md'
};

const MINIMUM_CATEGORY_SIZE = 3;
const DAY_MS = 86_400_000;

export interface ContinuousIntelligenceInput {
  statisticalAppendix?: string;
  studio?: Partial<IntegrationStudioSettings>;
  processes: ProcessData[];
  workflowRuns: WorkflowRun[];
  emailDeliveries: EmailDeliveryRecord[];
  signatureJobs: SignatureJob[];
  formSubmissions: StudioFormSubmission[];
  correctionRequests: DocumentCorrectionRequest[];
  courseName: string;
  institutionName: string;
  generatedAt?: string;
  actor?: 'SYSTEM' | 'MASTER';
  previous?: ContinuousIntelligenceState;
}

const normalizeLabel = (value: unknown): string => String(value ?? '')
  .normalize('NFKC')
  .replace(/[\u0000-\u001f\u007f]+/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()
  .slice(0, 120);

const percentage = (part: number, total: number): number => total ? Number((part / total * 100).toFixed(1)) : 0;

function median(values: number[]): number | null {
  const ordered = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!ordered.length) return null;
  const middle = Math.floor(ordered.length / 2);
  return ordered.length % 2 ? ordered[middle] : (ordered[middle - 1] + ordered[middle]) / 2;
}

function distribution(values: unknown[], denominator: number, suppressSmall = true): StatisticalDistribution {
  const counts = new Map<string, { label: string; count: number }>();
  let unknown = 0;
  for (const raw of values) {
    const label = normalizeLabel(raw);
    if (!label) { unknown++; continue; }
    const key = label.toLocaleLowerCase('pt-BR');
    const current = counts.get(key) || { label, count: 0 };
    current.count++;
    counts.set(key, current);
  }
  let suppressed = 0;
  const entries = Array.from(counts.values())
    .filter((entry) => {
      if (!suppressSmall || entry.count >= MINIMUM_CATEGORY_SIZE) return true;
      suppressed += entry.count;
      return false;
    })
    .map((entry) => ({ ...entry, share: percentage(entry.count, denominator) }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'pt-BR'));
  return { entries, unknown, suppressed };
}

function latestAnswersByProcess(submissions: StudioFormSubmission[]): Map<string, Record<string, string | number | boolean>> {
  const byProcess = new Map<string, Record<string, string | number | boolean>>();
  for (const submission of submissions.filter(s=>s.archiveStatus==='ARCHIVED').sort((a, b) => a.submittedAt.localeCompare(b.submittedAt))) {
    byProcess.set(submission.processId, { ...(byProcess.get(submission.processId) || {}), ...submission.answers });
  }
  return byProcess;
}

function firstAnswer(answers: Record<string, string | number | boolean>, keys: string[]): string {
  for (const key of keys) {
    const value = normalizeLabel(answers[key]);
    if (value) return value;
  }
  return '';
}

const STATUS_LABELS: Record<string, string> = {
  EM_RASCUNHO: 'Em rascunho',
  AGUARDANDO_CONFIRMACAO_LOCAL: 'Aguardando confirmação de local',
  AGUARDANDO_DEFESA: 'Aguardando defesa',
  EM_AVALIACAO: 'Em avaliação',
  AGUARDANDO_DADOS_FINAIS: 'Aguardando dados finais',
  AGUARDANDO_ASSINATURA: 'Aguardando assinatura',
  CONCLUIDO: 'Concluído'
};

const WORK_TYPE_LABELS: Record<string, string> = { MONOGRAFIA: 'Monografia', ARTIGO: 'Artigo', OUTRO: 'Outro' };

export function buildTccStatisticalSnapshot(input: Pick<ContinuousIntelligenceInput, 'processes' | 'formSubmissions' | 'generatedAt' | 'studio'>): TccStatisticalSnapshot {
  const generatedAt = input.generatedAt || new Date().toISOString();
  const processes = input.processes;
  const total = processes.length;
  const answersByProcess = latestAnswersByProcess(input.formSubmissions);
  const areas: string[] = [];
  const themes: string[] = [];
  const studyTypes: string[] = [];
  const purposes: string[] = [];
  const keywordValues: string[] = [];
  let keywordCovered = 0;

  for (const process of processes) {
    const answers = { ...(process.registrationAnswers || {}), ...(answersByProcess.get(process.id) || {}) };
    const catalog = operationalConfig(input.studio).catalogs;
    const classify = (kind: string, keys: string[]) => resolveCatalogValue(catalog.map(e=>({...e,active:true})), kind, firstAnswer(answers, keys), process.createdAt);
    areas.push(classify('AREA_TEMATICA', ['AREA_TEMATICA', 'AREA_DE_CONCENTRACAO', 'LINHA_DE_PESQUISA', 'AREA']));
    themes.push(classify('TEMA_PRINCIPAL', ['TEMA_PRINCIPAL', 'TEMA', 'EIXO_TEMATICO']));
    studyTypes.push(classify('TIPO_DE_ESTUDO', ['TIPO_DE_ESTUDO', 'DESENHO_DO_ESTUDO', 'METODOLOGIA']));
    purposes.push(classify('FINALIDADE_DO_TRABALHO', ['FINALIDADE_DO_TRABALHO', 'FINALIDADE', 'DESTINACAO']));
    const keywords = Array.from(new Set((process.acervo?.palavrasChave || []).map(value=>normalizeLabel(value).toLocaleLowerCase('pt-BR')).filter(value=>value&&!/@|https?:|\d{6,}/i.test(value))));
    if (keywords.length) keywordCovered++;
    keywordValues.push(...keywords);
  }

  const completionDurations = processes
    .filter((process) => process.status === 'CONCLUIDO')
    .map((process) => (Date.parse(process.completedAt || process.updatedAt) - Date.parse(process.createdAt)) / DAY_MS)
    .filter((value) => value >= 0);
  const generatedAtMs = Date.parse(generatedAt);
  const openAges = processes
    .filter((process) => process.status !== 'CONCLUIDO')
    .map((process) => (generatedAtMs - Date.parse(process.createdAt)) / DAY_MS)
    .filter((value) => value >= 0);
  const completed = processes.filter((process) => process.status === 'CONCLUIDO').length;
  const published = processes.filter((process) => Boolean(process.acervo?.publishFullWork || process.acervo?.publishExpandedAbstract)).length;
  const coauthored = processes.filter((process) => Boolean(process.aluno2)).length;
  const from = processes.map((process) => process.createdAt).filter(Boolean).sort()[0] || null;
  const to = processes.map((process) => process.updatedAt).filter(Boolean).sort().at(-1) || null;

  return {
    generatedAt,
    window: { from, to, academicCycleId: null },
    privacy: {
      containsPersonalData: false,
      minimumCategorySize: MINIMUM_CATEGORY_SIZE,
      note: 'Nomes, e-mails, matrículas, títulos e resumos não são incluídos. Categorias temáticas com menos de três ocorrências são agregadas.'
    },
    totals: {
      processes: total,
      authors: processes.reduce((sum, process) => sum + (process.aluno2 ? 2 : 1), 0),
      coauthoredProcesses: coauthored,
      defended: processes.filter((process) => process.avaliacao?.status === 'CONCLUIDO').length,
      completed,
      publicationRequested: published
    },
    rates: {
      completion: percentage(completed, total),
      publication: percentage(published, total),
      coauthorship: percentage(coauthored, total)
    },
    timing: {
      medianCompletionDays: completionDurations.length ? Number(median(completionDurations)!.toFixed(1)) : null,
      medianAgeOpenDays: openAges.length ? Number(median(openAges)!.toFixed(1)) : null
    },
    distributions: {
      status: distribution(processes.map((process) => STATUS_LABELS[process.status] || process.status), total, false),
      outcome: distribution(processes.map((process) => process.avaliacao?.resultadoLabel || process.avaliacao?.resultadoCode || ''), total),
      workType: distribution(processes.map((process) => WORK_TYPE_LABELS[process.acervo?.workType || ''] || process.acervo?.workType || ''), total),
      defenseFormat: distribution(processes.map((process) => process.defesa?.formato || ''), total),
      themes: distribution(themes, total),
      areas: distribution(areas, total),
      studyTypes: distribution(studyTypes, total),
      purposes: distribution(purposes, total),
      keywords: distribution(keywordValues, total)
    },
    dataQuality: {
      areaCoverage: percentage(areas.filter(Boolean).length, total),
      themeCoverage: percentage(themes.filter(Boolean).length, total),
      studyTypeCoverage: percentage(studyTypes.filter(Boolean).length, total),
      purposeCoverage: percentage(purposes.filter(Boolean).length, total),
      keywordCoverage: percentage(keywordCovered, total)
    }
  };
}

type ProposalDraft = Omit<ImprovementProposal, 'status' | 'firstDetectedAt' | 'lastObservedAt' | 'reviewedAt' | 'reviewedBy' | 'reviewNote'>;

function buildProposalDrafts(input: ContinuousIntelligenceInput, statistics: TccStatisticalSnapshot): ProposalDraft[] {
  const drafts: ProposalDraft[] = [];
  const add = (proposal: ProposalDraft) => drafts.push(proposal);
  const policy = operationalConfig(input.studio).diagnostics;
  const latestRuns = new Map<string, typeof input.workflowRuns[number]>();
  for (const run of input.workflowRuns.slice().sort((a,b)=>a.startedAt.localeCompare(b.startedAt))) latestRuns.set(`${run.processId}:${run.eventCode}`,run);
  const failedRuns = [...latestRuns.values()].filter(run=>run.status!=='COMPLETED').length;
  const failedEmails = input.emailDeliveries.filter((record) => record.status === 'FAILED').length;
  const failedSignatures = input.signatureJobs.filter((job) => ['PROVIDER_ERROR', 'DECLINED', 'EXPIRED', 'DRIVE_SYNC_PENDING'].includes(job.status)).length;
  const failedForms = input.formSubmissions.filter((submission) => submission.archiveStatus === 'FAILED').length;
  const openCorrections = input.correctionRequests.filter((request) => ['ABERTO', 'EM_ANALISE'].includes(request.status)).length;
  const staleProcesses = input.processes.filter((process) => process.status !== 'CONCLUIDO' && Date.parse(input.generatedAt || new Date().toISOString()) - Date.parse(process.updatedAt) > policy.staleDays * DAY_MS).length;

  if (failedRuns) add({ id: 'improvement-workflow-failures', category: 'WORKFLOW', title: 'Tratar execuções interrompidas do fluxo', evidence: `${failedRuns} execução(ões) de fluxo terminaram com validação ou ação incompleta.`, recommendedAction: 'Revisar a primeira ação com falha, corrigir a dependência e usar a retomada idempotente antes de avançar a etapa.', priority: 'P1', evidenceActive: true });
  if (failedEmails) add({ id: 'improvement-email-failures', category: 'EMAIL', title: 'Regularizar entregas de e-mail com falha', evidence: `${failedEmails} entrega(s) permanecem com falha definitiva registrada.`, recommendedAction: 'Validar destinatário canônico, autorização Gmail e anexo; depois executar a retentativa controlada.', priority: 'P1', evidenceActive: true });
  if (failedSignatures) add({ id: 'improvement-signature-failures', category: 'SIGNATURE', title: 'Resolver pendências de assinatura', evidence: `${failedSignatures} documento(s) estão recusados, expirados ou com erro de provedor/Drive.`, recommendedAction: 'Conciliar o envelope na Asten, confirmar signatários e arquivamento e somente então retomar o fluxo.', priority: 'P1', evidenceActive: true });
  if (failedForms) add({ id: 'improvement-form-archives', category: 'DRIVE', title: 'Arquivar formulários pendentes', evidence: `${failedForms} resposta(s) de formulário foram aceitas, mas ainda não foram arquivadas no Drive.`, recommendedAction: 'Verificar a conexão Google e repetir o arquivamento pelo painel operacional.', priority: 'P1', evidenceActive: true });
  if (staleProcesses) add({ id: 'improvement-stale-processes', category: 'PROCESS_TIME', title: 'Revisar processos sem movimentação recente', evidence: `${staleProcesses} processo(s) aberto(s) estão há mais de ${policy.staleDays} dias sem atualização.`, recommendedAction: 'Separar espera acadêmica legítima de bloqueio operacional e configurar lembretes na etapa correspondente.', priority: policy.priority, evidenceActive: true });
  if (openCorrections) add({ id: 'improvement-open-corrections', category: 'REWORK', title: 'Reduzir correções documentais abertas', evidence: `${openCorrections} solicitação(ões) de correção continuam abertas ou em análise.`, recommendedAction: 'Identificar os campos que mais geram correção e reforçar validações e instruções no formulário de origem.', priority: policy.priority, evidenceActive: true });
  const semanticCoverage = Math.min(statistics.dataQuality.areaCoverage, statistics.dataQuality.themeCoverage, statistics.dataQuality.studyTypeCoverage, statistics.dataQuality.purposeCoverage);
  if (statistics.totals.processes && semanticCoverage < policy.minimumCoverage) add({ id: 'improvement-analytics-coverage', category: 'DATA_QUALITY', title: 'Completar campos para análise temática', evidence: `A menor cobertura entre área, tema, tipo de estudo e finalidade é ${semanticCoverage.toFixed(1)}%.`, recommendedAction: 'Adicionar ou tornar obrigatórios os campos canônicos necessários no formulário publicado pelo Master, sem inferir categorias a partir do título.', priority: policy.priority, evidenceActive: true });
  return drafts;
}

function mergeProposals(previous: ImprovementProposal[], drafts: ProposalDraft[], now: string): ImprovementProposal[] {
  const prior = new Map(previous.map((proposal) => [proposal.id, proposal]));
  const observedIds = new Set(drafts.map((draft) => draft.id));
  const current = drafts.map<ImprovementProposal>((draft) => {
    const existing = prior.get(draft.id);
    return {
      ...draft,
      status: existing?.status || 'PROPOSED' as ImprovementStatus,
      firstDetectedAt: existing?.firstDetectedAt || now,
      lastObservedAt: now,
      reviewedAt: existing?.reviewedAt,
      reviewedBy: existing?.reviewedBy,
      reviewNote: existing?.reviewNote
    };
  });
  for (const proposal of previous) {
    if (!observedIds.has(proposal.id)) current.push({ ...proposal, evidenceActive: false });
  }
  const priorityOrder = { P1: 0, P2: 1, P3: 2 } as const;
  return current.sort((a, b) => Number(b.evidenceActive) - Number(a.evidenceActive) || priorityOrder[a.priority] - priorityOrder[b.priority] || b.lastObservedAt.localeCompare(a.lastObservedAt)).slice(0, 100);
}

function markdownTable(distributionValue: StatisticalDistribution): string {
  const lines = ['| Categoria | Quantidade | Participação |', '|---|---:|---:|'];
  for (const entry of distributionValue.entries) lines.push(`| ${entry.label.replace(/\|/g, '\\|')} | ${entry.count} | ${entry.share.toFixed(1)}% |`);
  if (distributionValue.suppressed) lines.push(`| Grupos protegidos (< ${MINIMUM_CATEGORY_SIZE}) | ${distributionValue.suppressed} | — |`);
  if (distributionValue.unknown) lines.push(`| Não informado | ${distributionValue.unknown} | — |`);
  if (lines.length === 2) lines.push('| Sem dados suficientes | 0 | — |');
  return lines.join('\n');
}

export function renderStatisticalReport(statistics: TccStatisticalSnapshot, input: Pick<ContinuousIntelligenceInput, 'courseName' | 'institutionName'>): string {
  const completionTime = statistics.timing.medianCompletionDays === null ? 'Sem base' : `${statistics.timing.medianCompletionDays} dias`;
  const openAge = statistics.timing.medianAgeOpenDays === null ? 'Sem base' : `${statistics.timing.medianAgeOpenDays} dias`;
  return `# Panorama estatístico dos TCCs

**Curso:** ${normalizeLabel(input.courseName) || 'Não configurado'}  
**Instituição:** ${normalizeLabel(input.institutionName) || 'Não configurada'}  
**Gerado em:** ${statistics.generatedAt}

## Resumo executivo

Foram considerados **${statistics.totals.processes} TCCs** e **${statistics.totals.authors} autores**. A taxa de conclusão é **${statistics.rates.completion.toFixed(1)}%**, a solicitação de publicação é **${statistics.rates.publication.toFixed(1)}%** e **${statistics.totals.coauthoredProcesses} trabalho(s)** têm coautoria. Este arquivo contém somente agregados e não inclui nomes, e-mails, matrículas, títulos ou resumos.

## Indicadores gerais

| Indicador | Resultado | Definição |
|---|---:|---|
| TCCs cadastrados | ${statistics.totals.processes} | Processos existentes no portal |
| Autores | ${statistics.totals.authors} | Um ou dois autores informados por TCC |
| Defesas avaliadas | ${statistics.totals.defended} | Avaliação marcada como concluída |
| TCCs concluídos | ${statistics.totals.completed} | Status final CONCLUIDO |
| Publicação solicitada | ${statistics.totals.publicationRequested} | Trabalho completo ou resumo expandido autorizado |
| Mediana até a conclusão | ${completionTime} | Da criação à última atualização dos processos concluídos |
| Mediana de idade dos abertos | ${openAge} | Da criação até esta atualização |

## Situação dos processos

${markdownTable(statistics.distributions.status)}

## Resultados de avaliação

${markdownTable(statistics.distributions.outcome)}

## Tipo do trabalho

${markdownTable(statistics.distributions.workType)}

## Formato da defesa

${markdownTable(statistics.distributions.defenseFormat)}

## Áreas temáticas

${markdownTable(statistics.distributions.areas)}

## Temas principais

${markdownTable(statistics.distributions.themes)}

## Tipos de estudo

${markdownTable(statistics.distributions.studyTypes)}

## Finalidades

${markdownTable(statistics.distributions.purposes)}

## Palavras-chave

${markdownTable(statistics.distributions.keywords)}

## Cobertura dos dados

| Campo | Cobertura |
|---|---:|
| Área temática | ${statistics.dataQuality.areaCoverage.toFixed(1)}% |
| Tema principal | ${statistics.dataQuality.themeCoverage.toFixed(1)}% |
| Tipo de estudo | ${statistics.dataQuality.studyTypeCoverage.toFixed(1)}% |
| Finalidade | ${statistics.dataQuality.purposeCoverage.toFixed(1)}% |
| Palavras-chave | ${statistics.dataQuality.keywordCoverage.toFixed(1)}% |

## Metodologia e limitações

- Fonte: processos e respostas de formulários aceitos pelo portal até o horário de geração.
- Campos canônicos reconhecidos: AREA_TEMATICA, TEMA_PRINCIPAL, TIPO_DE_ESTUDO e FINALIDADE_DO_TRABALHO, com aliases documentados.
- O sistema não deduz área, tema, tipo ou finalidade a partir do título ou do resumo.
- Categorias com menos de ${MINIMUM_CATEGORY_SIZE} ocorrências são agregadas para reduzir risco de reidentificação.
- Percentuais usam todos os TCCs como denominador; “não informado” permanece visível na qualidade dos dados.
`;
}

export function renderImprovementMemory(proposals: ImprovementProposal[], statistics: TccStatisticalSnapshot, input: Pick<ContinuousIntelligenceInput, 'courseName' | 'institutionName' | 'studio'>): string {
  const active = proposals.filter((proposal) => proposal.evidenceActive && proposal.status !== 'IMPLEMENTED' && proposal.status !== 'REJECTED');
  const rows = proposals.length ? proposals.map((proposal) => `| ${proposal.priority} | ${proposal.title.replace(/\|/g, '\\|')} | ${proposal.evidence.replace(/\|/g, '\\|')} | ${proposal.status} | ${proposal.evidenceActive ? 'Sim' : 'Não'} |`).join('\n') : '| — | Nenhuma proposta detectada | A linha de base foi criada. | — | — |';
  return `# Memória contínua de fluxos e melhorias

**Curso:** ${normalizeLabel(input.courseName) || 'Não configurado'}  
**Instituição:** ${normalizeLabel(input.institutionName) || 'Não configurada'}  
**Atualizado em:** ${statistics.generatedAt}

## Resumo executivo

Há **${active.length} proposta(s) ativa(s)** baseada(s) em evidências operacionais. Este arquivo observa falhas, atrasos, retrabalho e cobertura dos dados, mas **não altera formulários, documentos, e-mails, assinaturas ou etapas automaticamente**. Toda mudança de produção depende de revisão, aprovação e publicação pelo Master.

## Evidências e propostas

| Prioridade | Proposta | Evidência atual | Decisão do Master | Evidência ainda ativa |
|---|---|---|---|---|
${rows}

## Fluxo publicado de referência

A reserva precede o convite; a Ata assinada e arquivada precede a entrega final; o Termo aplicável precede a Declaração. Modelos e textos são fornecidos pelo Master. Nenhuma alteração deste arquivo substitui a publicação do Estúdio.

| Etapa | Evento | Ações configuradas |
|---|---|---:|
${(input.studio?.workflowStages || []).map((stage, index) => `| ${index + 1} | ${String(stage.triggerEvent || '').replace(/[^A-Z0-9_]/g, '')} | ${Array.isArray(stage.actions) ? stage.actions.length : 0} |`).join('\n') || '| — | Estúdio ainda não publicado | — |'}

## Procedimento de melhoria contínua

1. O portal consolida diariamente indicadores e ocorrências sem dados pessoais.
2. Uma regra objetiva registra ou atualiza uma proposta, preservando decisões anteriores.
3. O Master revisa a evidência e marca a proposta como aprovada, rejeitada ou implementada.
4. Se aprovada, a mudança é feita no Estúdio e precisa passar pela validação antes da publicação.
5. A execução real continua monitorada; desaparecer a evidência não apaga o histórico da proposta.

## Regras de observação atuais

- Qualquer falha definitiva em fluxo, Gmail, Asten ou arquivamento no Drive gera prioridade P1.
- Processo aberto além do prazo configurado pelo Master gera revisão na prioridade configurada.
- Correções abertas geram análise de retrabalho na prioridade configurada.
- Cobertura abaixo do mínimo configurado em área, tema, tipo de estudo ou finalidade gera proposta de qualidade.
- Limiares são regras diagnósticas iniciais, não metas acadêmicas; o Master deve revisá-los após formar uma linha de base confiável.

## Limites de governança

- Nenhuma proposta executa mudança em produção por conta própria.
- Nenhum dado pessoal, título ou resumo é copiado para este arquivo.
- Alterações aprovadas continuam sujeitas a autenticação recente, auditoria e versionamento do pacote publicado.
`;
}

function makeArtifact(kind: LivingPortalArtifactKind, markdown: string, generatedAt: string, previous?: LivingPortalArtifact): LivingPortalArtifact {
  return {
    kind,
    fileName: LIVING_ARTIFACT_FILE_NAMES[kind],
    version: (previous?.version || 0) + 1,
    generatedAt,
    sha256: createHash('sha256').update(markdown, 'utf8').digest('hex'),
    markdown,
    driveSyncStatus: 'PENDING',
    driveFileId: previous?.driveFileId,
    driveWebViewLink: previous?.driveWebViewLink
  };
}

export function buildContinuousIntelligenceState(input: ContinuousIntelligenceInput): ContinuousIntelligenceState {
  const generatedAt = input.generatedAt || new Date().toISOString();
  const normalizedInput = { ...input, generatedAt };
  const statistics = buildTccStatisticalSnapshot(normalizedInput);
  const proposals = mergeProposals(input.previous?.proposals || [], buildProposalDrafts(normalizedInput, statistics), generatedAt);
  const statisticalMarkdown = renderStatisticalReport(statistics, input) + (input.statisticalAppendix || '');
  const improvementMarkdown = renderImprovementMemory(proposals, statistics, input);
  return {
    schemaVersion: 1,
    lastRefreshAt: generatedAt,
    lastRefreshActor: input.actor || 'SYSTEM',
    statistics,
    proposals,
    artifacts: {
      FLOW_IMPROVEMENT_MEMORY: makeArtifact('FLOW_IMPROVEMENT_MEMORY', improvementMarkdown, generatedAt, input.previous?.artifacts.FLOW_IMPROVEMENT_MEMORY),
      TCC_STATISTICAL_REPORT: makeArtifact('TCC_STATISTICAL_REPORT', statisticalMarkdown, generatedAt, input.previous?.artifacts.TCC_STATISTICAL_REPORT)
    }
  };
}
