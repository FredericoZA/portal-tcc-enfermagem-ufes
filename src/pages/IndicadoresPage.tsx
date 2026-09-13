import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  BarChart3,
  CheckCircle2,
  Clock3,
  FileCheck2,
  MailCheck,
  RefreshCw,
  ShieldCheck,
  Signature,
  TrendingUp
} from 'lucide-react';
import { apiClient } from '../services/apiClient';
import { OperationsMonitorPanel } from '../components/OperationsMonitorPanel';

type AdminMetrics = {
  generatedAt: string;
  processes: {
    total: number;
    completed: number;
    byStatus: Record<string, number>;
    completionRate: number;
    medianCompletionDays: number | null;
    outcomes?: Record<string, number> | null;
  };
  publication: { published: number; rate: number };
  signatures: { total: number; archived: number; failed: number };
  emails: { total: number; accepted: number; failed: number };
  quality: { pendingCoauthor: number; missingFinalData: number };
};

const formatStatus = (value: string) => value
  .toLowerCase()
  .replace(/_/g, ' ')
  .replace(/\b\w/g, (letter) => letter.toUpperCase());

const MetricCard: React.FC<{
  label: string;
  value: React.ReactNode;
  help: string;
  icon: React.ComponentType<{ className?: string }>;
}> = ({ label, value, help, icon: Icon }) => (
  <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="text-[11px] font-black uppercase tracking-[0.12em] text-slate-500">{label}</p>
        <strong className="mt-2 block text-3xl font-black text-slate-950">{value}</strong>
      </div>
      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-[#005830]">
        <Icon className="h-5 w-5" />
      </div>
    </div>
    <p className="mt-3 text-xs leading-5 text-slate-500">{help}</p>
  </article>
);

export const IndicadoresPage: React.FC = () => {
  const [metrics, setMetrics] = useState<AdminMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setMetrics(await apiClient.getAdminMetrics());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível carregar os indicadores.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const inProgress = Math.max(0, (metrics?.processes.total || 0) - (metrics?.processes.completed || 0));
  const statuses = useMemo(
    () => (Object.entries(metrics?.processes.byStatus || {}) as Array<[string, number]>).sort((a, b) => b[1] - a[1]),
    [metrics]
  );

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-emerald-900/10 bg-gradient-to-br from-[#005830] to-[#013d2b] p-5 text-white shadow-lg sm:p-7">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-emerald-100">
              <BarChart3 className="h-4 w-4" /> Análise do Portal
            </div>
            <h1 className="mt-2 text-2xl font-black tracking-tight sm:text-3xl">Análise</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-emerald-50">
              Indicadores, estatísticas e qualidade operacional do Portal TCC reunidos em um único local. Esta área não exibe nomes, e-mails, matrículas ou títulos dos trabalhos.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-2.5 text-xs font-black uppercase tracking-wide text-[#005830] shadow-sm hover:bg-emerald-50 disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Atualizar
          </button>
        </div>
      </section>

      {error && (
        <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-800">
          {error}
        </div>
      )}

      {loading && !metrics ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500 shadow-sm">
          Carregando estatísticas do Portal…
        </div>
      ) : metrics ? (
        <>
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="TCCs cadastrados" value={metrics.processes.total} help="Total de processos registrados no Portal." icon={FileCheck2} />
            <MetricCard label="Em andamento" value={inProgress} help="Processos que ainda não foram concluídos." icon={Clock3} />
            <MetricCard label="Concluídos" value={metrics.processes.completed} help="Processos que chegaram à etapa final." icon={CheckCircle2} />
            <MetricCard label="Taxa de conclusão" value={`${metrics.processes.completionRate}%`} help="Percentual de processos já concluídos." icon={TrendingUp} />
            <MetricCard label="Com publicação" value={metrics.publication.published} help="Processos com conteúdo autorizado para publicação." icon={Activity} />
            <MetricCard label="Taxa de publicação" value={`${metrics.publication.rate}%`} help="Percentual de processos com publicação autorizada." icon={ShieldCheck} />
            <MetricCard label="Assinaturas concluídas" value={metrics.signatures.archived} help={`${metrics.signatures.total} solicitação(ões) de assinatura registradas.`} icon={Signature} />
            <MetricCard label="E-mails aceitos" value={metrics.emails.accepted} help={`${metrics.emails.total} envio(s) rastreados pelo Portal.`} icon={MailCheck} />
          </section>

          <OperationsMonitorPanel />

          <section className="grid gap-4 xl:grid-cols-2">
            <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="font-black text-slate-950">Distribuição dos processos</h2>
              <p className="mt-1 text-xs text-slate-500">Quantidade de TCCs em cada situação registrada pelo sistema.</p>
              <div className="mt-4 space-y-2">
                {statuses.length ? statuses.map(([status, count]) => {
                  const percent = metrics.processes.total ? Math.round(count / metrics.processes.total * 100) : 0;
                  return (
                    <div key={status} className="rounded-xl border border-slate-200 p-3">
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <span className="font-bold text-slate-700">{formatStatus(status)}</span>
                        <strong className="text-slate-950">{count}</strong>
                      </div>
                      <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                        <div className="h-full rounded-full bg-[#005830]" style={{ width: `${percent}%` }} />
                      </div>
                    </div>
                  );
                }) : <p className="text-sm text-slate-500">Ainda não há processos cadastrados.</p>}
              </div>
            </article>

            <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="font-black text-slate-950">Qualidade operacional</h2>
              <p className="mt-1 text-xs text-slate-500">Pendências que podem exigir atenção administrativa.</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <span className="text-[10px] font-black uppercase tracking-wide text-slate-500">Coautoria pendente</span>
                  <strong className="mt-2 block text-2xl text-slate-950">{metrics.quality.pendingCoauthor}</strong>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <span className="text-[10px] font-black uppercase tracking-wide text-slate-500">Entrega final pendente</span>
                  <strong className="mt-2 block text-2xl text-slate-950">{metrics.quality.missingFinalData}</strong>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <span className="text-[10px] font-black uppercase tracking-wide text-slate-500">Falhas de assinatura</span>
                  <strong className="mt-2 block text-2xl text-slate-950">{metrics.signatures.failed}</strong>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <span className="text-[10px] font-black uppercase tracking-wide text-slate-500">Falhas de e-mail</span>
                  <strong className="mt-2 block text-2xl text-slate-950">{metrics.emails.failed}</strong>
                </div>
              </div>
              <p className="mt-4 text-[11px] text-slate-400">
                Atualizado em {new Date(metrics.generatedAt).toLocaleString('pt-BR')}.
                {metrics.processes.medianCompletionDays !== null ? ` Mediana de conclusão: ${metrics.processes.medianCompletionDays} dia(s).` : ''}
              </p>
            </article>
          </section>
        </>
      ) : null}
    </div>
  );
};
