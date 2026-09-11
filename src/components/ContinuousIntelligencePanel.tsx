import { AdvancedAnalyticsPanel } from './AdvancedAnalyticsPanel';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { BarChart3, Download, ExternalLink, Lightbulb, Loader2, RefreshCw, ShieldCheck } from 'lucide-react';
import { apiClient } from '../services/apiClient';
import type { ContinuousIntelligenceOverview, ImprovementStatus, LivingPortalArtifactKind } from '../types';

const button = 'inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm font-black uppercase disabled:cursor-not-allowed disabled:opacity-40';
const artifactLabels: Record<LivingPortalArtifactKind, string> = {
  FLOW_IMPROVEMENT_MEMORY: 'Memória de fluxos e melhorias',
  TCC_STATISTICAL_REPORT: 'Panorama estatístico dos TCCs'
};
const statusLabels: Record<ImprovementStatus, string> = { PROPOSED: 'Proposta', APPROVED: 'Aprovada', REJECTED: 'Rejeitada', IMPLEMENTED: 'Implementada' };

function saveDownload(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

const formatDateTime = (value?: string) => value ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value)) : 'Ainda não atualizado';

export const ContinuousIntelligencePanel: React.FC = () => {
  const [data, setData] = useState<ContinuousIntelligenceOverview | null>(null);
  const [working, setWorking] = useState('load');
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    setWorking('load');
    try { setData(await apiClient.getContinuousIntelligence()); setMessage(''); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Não foi possível carregar a inteligência contínua.'); }
    finally { setWorking(''); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const refresh = async () => {
    setWorking('refresh');
    try { setData(await apiClient.refreshContinuousIntelligence()); setMessage('Os dois arquivos foram recalculados; consulte o estado do Drive abaixo.'); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Não foi possível atualizar os arquivos.'); }
    finally { setWorking(''); }
  };

  const download = async (kind: LivingPortalArtifactKind) => {
    setWorking(`download-${kind}`);
    try { const file = await apiClient.downloadContinuousIntelligenceFile(kind); saveDownload(file.blob, file.fileName); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Não foi possível baixar o arquivo.'); }
    finally { setWorking(''); }
  };

  const decide = async (id: string, status: ImprovementStatus) => {
    setWorking(`proposal-${id}`);
    try {
      setData(await apiClient.updateImprovementProposal(id, status));
      setMessage(status === 'APPROVED' ? 'Proposta aprovada. A aprovação não modifica o fluxo: publique a alteração correspondente no Estúdio.' : `Proposta marcada como ${statusLabels[status].toLowerCase()}.`);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Não foi possível registrar a decisão.'); }
    finally { setWorking(''); }
  };

  const activeProposals = useMemo(() => data?.proposals.filter((proposal) => proposal.evidenceActive) || [], [data]);
  if (!data && working === 'load') return <section aria-label="Carregando inteligência contínua" className="rounded-2xl border border-slate-200 bg-white p-6 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin text-emerald-700"/><p className="mt-2 text-xs text-slate-600">Consolidando os indicadores do portal…</p></section>;

  return <section className="space-y-4 rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-blue-50 p-4 shadow-sm" aria-labelledby="continuous-intelligence-title">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="max-w-3xl"><div className="flex items-center gap-2"><Lightbulb className="h-5 w-5 text-emerald-700"/><h4 id="continuous-intelligence-title" className="font-black text-slate-950">Inteligência contínua do portal</h4></div><p className="mt-1 text-xs leading-5 text-slate-600">Dois arquivos vivos transformam a operação em memória institucional e estatísticas. O sistema propõe melhorias; somente o Master decide e publica qualquer mudança no fluxo.</p></div>
      <button type="button" onClick={() => void refresh()} disabled={Boolean(working)} className={`${button} border-emerald-700 bg-emerald-700 text-white`}>{working === 'refresh' ? <Loader2 className="h-4 w-4 animate-spin"/> : <RefreshCw className="h-4 w-4"/>}Atualizar os dois arquivos</button>
    </div>
    {message && <p role="status" className="rounded-xl border border-slate-200 bg-white p-3 text-xs font-semibold text-slate-800">{message}</p>}

    {data && <>
      <AdvancedAnalyticsPanel refreshKey={data.lastRefreshAt}/>
      <div className="grid gap-3 lg:grid-cols-2">
        {(Object.keys(artifactLabels) as LivingPortalArtifactKind[]).map((kind) => {
          const artifact = data.artifacts[kind];
          const statusClass = artifact.driveSyncStatus === 'SYNCED' ? 'bg-emerald-100 text-emerald-800' : artifact.driveSyncStatus === 'FAILED' ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800';
          return <article key={kind} className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex flex-wrap items-start justify-between gap-2"><div><h5 className="text-sm font-black text-slate-950">{artifactLabels[kind]}</h5><p className="mt-1 font-mono text-sm text-slate-500">{artifact.fileName}</p></div><span className={`rounded-full px-2.5 py-1 text-xs font-black uppercase ${statusClass}`}>Drive: {artifact.driveSyncStatus}</span></div>
            <p className="mt-2 text-sm text-slate-500">Versão {artifact.version} · {formatDateTime(artifact.generatedAt)} · SHA-256 {artifact.sha256.slice(0, 12)}…</p>
            {artifact.driveError && <p className="mt-2 rounded-lg bg-rose-50 p-2 text-sm text-rose-800">{artifact.driveError}</p>}
            <div className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={() => void download(kind)} disabled={Boolean(working)} className={`${button} border-slate-300 bg-white text-slate-800`}><Download className="h-4 w-4"/>Baixar Markdown</button>{artifact.driveWebViewLink && <a href={artifact.driveWebViewLink} target="_blank" rel="noreferrer" className={`${button} border-blue-700 bg-blue-700 text-white`}><ExternalLink className="h-4 w-4"/>Abrir no Drive</a>}</div>
          </article>;
        })}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-2"><div className="flex items-center gap-2"><BarChart3 className="h-5 w-5 text-blue-700"/><h5 className="text-sm font-black">Propostas baseadas na operação</h5></div><span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-black">{activeProposals.length} evidência(s) ativa(s)</span></div>
        <div className="mt-3 space-y-3">{data.proposals.slice(0, 12).map((proposal) => <article key={proposal.id} className={`rounded-xl border p-3 ${proposal.evidenceActive ? 'border-slate-200 bg-slate-50' : 'border-slate-100 bg-white opacity-70'}`}><div className="flex flex-wrap items-start justify-between gap-2"><div className="min-w-0 flex-1"><p className="text-xs font-black text-slate-900">{proposal.priority} · {proposal.title}</p><p className="mt-1 text-sm leading-5 text-slate-600">{proposal.evidence}</p><p className="mt-1 text-sm leading-4 text-slate-500"><strong>Ação sugerida:</strong> {proposal.recommendedAction}</p></div><span className="rounded-full bg-white px-2.5 py-1 text-xs font-black uppercase text-slate-700">{statusLabels[proposal.status]}</span></div><div className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={() => void decide(proposal.id, 'APPROVED')} disabled={Boolean(working)} className={`${button} border-emerald-700 bg-emerald-700 text-white`}>Aprovar</button><button type="button" onClick={() => void decide(proposal.id, 'IMPLEMENTED')} disabled={Boolean(working)} className={`${button} border-blue-700 bg-blue-700 text-white`}>Marcar implementada</button><button type="button" onClick={() => void decide(proposal.id, 'REJECTED')} disabled={Boolean(working)} className={`${button} border-slate-300 bg-white text-slate-700`}>Rejeitar</button></div></article>)}{!data.proposals.length && <p className="rounded-xl bg-slate-50 p-4 text-xs text-slate-600">A linha de base foi criada e ainda não há proposta baseada em evidência.</p>}</div>
      </div>

      <div className="flex items-start gap-2 rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm leading-5 text-blue-950"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0"/><p>Privacidade: os relatórios não incluem nomes, e-mails, matrículas, títulos ou resumos. Grupos temáticos com menos de {data.statistics.privacy.minimumCategorySize} ocorrências são agregados. A atualização diária usa a mesma rotina autenticada de manutenção do portal.</p></div>
    </>}
  </section>;
};
