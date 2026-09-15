import type { Request, Response } from 'express';
import { loadPortalRuntimeState } from '../server/integrations/supabase';
import type { ProcessData } from '../src/types';

type RuntimeState = { processes?: ProcessData[] };

const STATUS_LABELS: Record<string,string> = {
  EM_RASCUNHO: 'Em rascunho',
  AGUARDANDO_CONFIRMACAO_LOCAL: 'Confirmando local',
  AGUARDANDO_DEFESA: 'Aguardando defesa',
  EM_AVALIACAO: 'Em avaliação',
  AGUARDANDO_DADOS_FINAIS: 'Dados finais',
  AGUARDANDO_ASSINATURA: 'Assinaturas',
  CONCLUIDO: 'Concluído',
};
const cleanKeyword = (value: string) => value.normalize('NFKC').replace(/\s+/g,' ').trim();
const countBy = (values: string[]) => Object.entries(values.reduce<Record<string,number>>((acc,value)=>{if(value)acc[value]=(acc[value]||0)+1;return acc;},{})).sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0],'pt-BR'));

export default async function handler(req: Request, res: Response) {
  res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=300, stale-while-revalidate=600');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method !== 'GET') { res.setHeader('Allow','GET'); return res.status(405).json({error:'Método não permitido.'}); }
  try {
    const state = await loadPortalRuntimeState<RuntimeState>();
    const processes = Array.isArray(state?.processes) ? state!.processes! : [];
    const total = processes.length;
    const completed = processes.filter((p)=>p.status==='CONCLUIDO').length;
    const published = processes.filter((p)=>p.acervo?.publicationState==='PUBLIC' || (p.acervo?.isPublic && Boolean(p.acervo?.publicFullWorkFileId || p.acervo?.publicExpandedAbstractFileId))).length;
    const defended = processes.filter((p)=>Boolean(p.defesa?.startAt) && new Date(p.defesa.startAt).getTime() <= Date.now()).length;
    const byStatus = Object.entries(processes.reduce<Record<string,number>>((acc,p)=>{acc[p.status]=(acc[p.status]||0)+1;return acc;},{})).map(([key,count])=>({key,label:STATUS_LABELS[key]||key,count})).sort((a,b)=>b.count-a.count);
    const years = countBy(processes.map((p)=>String(new Date(p.defesa?.startAt || p.createdAt).getFullYear())).filter((y)=>/^20\d{2}$/.test(y))).map(([label,count])=>({label,count})).sort((a,b)=>a.label.localeCompare(b.label));
    const months = countBy(processes.filter((p)=>p.defesa?.startAt).map((p)=>String(p.defesa.startAt).slice(0,7))).map(([label,count])=>({label,count})).sort((a,b)=>a.label.localeCompare(b.label)).slice(-12);
    const completedOrPublic = processes.filter((p)=>p.status==='CONCLUIDO' || p.acervo?.publicationState==='PUBLIC');
    const themes = countBy(completedOrPublic.flatMap((p)=>(p.acervo?.palavrasChave||[]).map(cleanKeyword).filter(Boolean))).slice(0,15).map(([label,count])=>({label,count}));
    const workTypes = countBy(completedOrPublic.map((p)=>p.acervo?.workType || 'NÃO INFORMADO')).map(([label,count])=>({label,count}));
    const locations = countBy(processes.map((p)=>cleanKeyword(p.defesa?.local||'')).filter(Boolean)).slice(0,8).map(([label,count])=>({label,count}));
    const outcomes = total >= 5 ? countBy(processes.map((p)=>p.avaliacao?.resultadoLabel || p.avaliacao?.resultadoCode || '').filter(Boolean)).map(([label,count])=>({label,count})) : [];
    return res.status(200).json({
      generatedAt:new Date().toISOString(),
      privacy:{containsPersonalData:false,smallGroupSuppressed:total>0&&total<5},
      totals:{registered:total,completed,published,defended,inProgress:Math.max(0,total-completed),completionRate:total?Number((completed/total*100).toFixed(1)):0,publicationRate:total?Number((published/total*100).toFixed(1)):0},
      byStatus, years, months, themes, workTypes, locations, outcomes
    });
  } catch (error) {
    console.error('[Indicadores públicos] Falha ao gerar estatísticas:', error);
    return res.status(503).json({error:'Os indicadores estão temporariamente indisponíveis.'});
  }
}
