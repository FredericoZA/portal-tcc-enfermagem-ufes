import type { ProcessData, SignatureJob } from '../src/types';
import type { WorkflowRun } from '../src/types/automation';
import type { ContinuousIntelligenceInput } from './continuousIntelligence';
import { buildTccStatisticalSnapshot } from './continuousIntelligence';
import { latestSignature } from './workflow/gates';
const day = 86400000;
const median = (values: number[]) => { const sorted = values.filter(Number.isFinite).sort((a,b) => a-b); return sorted.length < 3 ? null : Number(((sorted[Math.floor(sorted.length/2)] + sorted[Math.floor((sorted.length-1)/2)])/2).toFixed(2)); };
export function processPeriod(p: ProcessData): string {
  if (p.academicCycleId) return p.academicCycleId;
  const date = p.defesa?.startAt || p.createdAt;
  return /^\d{4}-\d{2}/.test(date) ? `${date.slice(0,4)}.${Number(date.slice(5,7)) <= 6 ? 1 : 2}` : 'SEM_PERIODO';
}
export function buildAdvancedAnalytics(input: ContinuousIntelligenceInput, period?: string, compare?: string) {
  const periods = [...new Set(input.processes.map(processPeriod))].sort().reverse();
  const selected = period ? input.processes.filter(p => processPeriod(p) === period) : input.processes;
  const ids = new Set(selected.map(p => p.id));
  const jobs = input.signatureJobs.filter(j => ids.has(j.processId));
  const snapshot = buildTccStatisticalSnapshot({ ...input, processes: selected });
  const now = Date.parse(input.generatedAt || new Date().toISOString());
  const samples: Record<string, { durations: number[]; waiting: number[]; unknown: number }> = {};
  const sample = (label: string, start?: string, end?: string) => {
    const row = samples[label] ||= { durations: [], waiting: [], unknown: 0 };
    if (!start || !Number.isFinite(Date.parse(start))) { row.unknown++; return; }
    if (end && Date.parse(end) >= Date.parse(start)) row.durations.push((Date.parse(end)-Date.parse(start))/day);
    else if (!end && now >= Date.parse(start)) row.waiting.push((now-Date.parse(start))/day);
    else row.unknown++;
  };
  for (const p of selected) {
    sample('Cadastro → confirmação do local', p.createdAt, p.defesa.localConfirmedAt);
    sample('Local confirmado → convite enviado', p.defesa.localConfirmedAt, p.defesa.invitationSentAt);
    sample('Defesa agendada → avaliação', p.defesa.startAt, p.avaliacao.submittedAt);
    const ata = latestSignature(p, jobs, 'ATA');
    const archivedAta = ata?.status === 'ARCHIVED' ? ata.completedAt : undefined;
    sample('Avaliação → Ata arquivada', p.avaliacao.submittedAt, archivedAta);
    sample('Ata arquivada → entrega final', archivedAta, p.acervo?.submittedAt);
  }
  for (const job of jobs.filter(j => j.status !== 'CANCELED')) {
    sample(`${job.documentType}: geração → assinatura`, job.createdAt, job.signedAt);
    if (job.signedAt) sample(`${job.documentType}: assinatura → Drive`, job.signedAt, job.status === 'ARCHIVED' ? job.completedAt : undefined);
  }
  const actionDurations = new Map<string, number[]>();
  for (const run of input.workflowRuns.filter(r => ids.has(r.processId))) for (const action of run.actions) {
    if (!action.startedAt || !action.completedAt || action.status !== 'COMPLETED') continue;
    const label = `${run.eventCode} · ${action.kind}`;
    actionDurations.set(label, [...(actionDurations.get(label)||[]), (Date.parse(action.completedAt)-Date.parse(action.startedAt))/1000]);
  }
  const summary = (ps: ProcessData[]) => ({ period: ps.length ? processPeriod(ps[0]) : '', count: ps.length < 3 ? null : ps.length, completionRate: ps.length < 3 ? null : Number((ps.filter(p=>p.status==='CONCLUIDO').length/ps.length*100).toFixed(1)), suppressed: ps.length > 0 && ps.length < 3 });
  return {
    generatedAt: snapshot.generatedAt, period: period || 'TODOS', compare: compare || null,
    periods, snapshot,
    comparison: compare ? summary(input.processes.filter(p => processPeriod(p) === compare)) : null,
    trends: periods.map(key => ({ ...summary(input.processes.filter(p => processPeriod(p) === key)), period: key })),
    stages: Object.entries(samples).map(([label,r]) => ({ label, completed: r.durations.length >= 3 ? r.durations.length : null, waiting: r.waiting.length >= 3 ? r.waiting.length : null, medianDays: median(r.durations), medianWaitingDays: median(r.waiting), unknown: r.unknown })),
    actions: [...actionDurations].map(([label,values])=>({label, count: values.length >= 3 ? values.length : null, medianSeconds: median(values)})),
    note: 'Medianas e indicadores comparativos exigem pelo menos três observações. Ausência de medida não significa zero. Tempos históricos sem marcação específica permanecem desconhecidos.'
  };
}
export function analyticsCsv(report: ReturnType<typeof buildAdvancedAnalytics>): string {
  const cell = (value: unknown) => { const s = String(value ?? 'Não disponível'); return `"${(/^[=+@\-\t\r]/.test(s)?"'":'') + s.replace(/"/g,'""')}"`; };
  const rows: unknown[][] = [['Grupo','Indicador','Quantidade','Percentual ou mediana','Unidade']];
  rows.push(['Filtro','Período selecionado',report.period,'','']);
  for (const [key,total] of Object.entries(report.snapshot.totals)) rows.push(['Totais',key,total,'','']);
  for (const [key,dist] of Object.entries(report.snapshot.distributions)) {
    for (const entry of dist.entries) rows.push([key,entry.label,entry.count,entry.share,'% de TCCs']);
    rows.push([key,'Não classificado',dist.unknown,'','']);
    rows.push([key,'Agrupado por privacidade',dist.suppressed,'','']);
  }
  if(report.comparison) rows.push(['Comparação',report.compare,report.comparison.count,report.comparison.completionRate,'% concluído']);
  for (const stage of report.stages) rows.push(['Espera atual',stage.label,stage.waiting,stage.medianWaitingDays,'dias']);
  for (const action of report.actions) rows.push(['Execução de ação',action.label,action.count,action.medianSeconds,'segundos']);
  for (const stage of report.stages) rows.push(['Tempo por etapa',stage.label,stage.completed,stage.medianDays,'dias']);
  for (const trend of report.trends) rows.push(['Período',trend.period,trend.count,trend.completionRate,'% concluído']);
  return '\ufeff' + rows.map(row=>row.map(cell).join(';')).join('\r\n');
}

export function analyticsMarkdown(report: ReturnType<typeof buildAdvancedAnalytics>): string {
  const cell = (value: unknown) => String(value ?? 'Não disponível').replace(/\|/g, '\\|').replace(/[\r\n]/g, ' ');
  const rows = (values: unknown[][]) => values.map(row => '| ' + row.map(cell).join(' | ') + ' |').join('\n');
  return `
## Evolução por período

${report.note}

| Período | TCCs | Concluídos (%) |
|---|---:|---:|
${rows(report.trends.map(t => [t.period, t.count, t.completionRate]))}

## Tempos por etapa

| Etapa | Concluídas | Mediana (dias) | Em espera | Espera atual (dias) | Sem marcação |
|---|---:|---:|---:|---:|---:|
${rows(report.stages.map(s => [s.label, s.completed, s.medianDays, s.waiting, s.medianWaitingDays, s.unknown]))}

## Execução das ações

| Evento e ação | Execuções | Mediana (segundos) |
|---|---:|---:|
${rows(report.actions.map(a => [a.label, a.count, a.medianSeconds]))}
`;
}
