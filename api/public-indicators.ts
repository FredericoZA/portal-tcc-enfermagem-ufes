import type { Request, Response } from 'express';
import { loadPortalRuntimeState } from '../server/integrations/supabase';
import type { ProcessData } from '../src/types';

type RuntimeState = { processes?: ProcessData[] };
type Bucket = { label: string; count: number };

const MIN_PUBLIC_GROUP_SIZE = 5;
const MIN_PUBLIC_BUCKET_SIZE = 3;

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
const countBy = (values: string[]) => Object.entries(values.reduce<Record<string,number>>((acc,value)=>{
  if(value)acc[value]=(acc[value]||0)+1;
  return acc;
},{})).sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0],'pt-BR'));
const publicBuckets = (items: Bucket[]) => items.filter((item)=>item.count >= MIN_PUBLIC_BUCKET_SIZE);

export default async function handler(req: Request, res: Response) {
  res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=300, stale-while-revalidate=600');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method !== 'GET') {
    res.setHeader('Allow','GET');
    return res.status(405).json({error:'Método não permitido.'});
  }
  try {
    const state = await loadPortalRuntimeState<RuntimeState>();
    const processes = Array.isArray(state?.processes) ? state!.processes! : [];
    const total = processes.length;
    const smallGroupSuppressed = total > 0 && total < MIN_PUBLIC_GROUP_SIZE;
    const completed = processes.filter((p)=>p.status==='CONCLUIDO').length;
    const published = processes.filter((p)=>p.acervo?.publicationState==='PUBLIC' || (p.acervo?.isPublic && Boolean(p.acervo?.publicFullWorkFileId || p.acervo?.publicExpandedAbstractFileId))).length;
    const defended = processes.filter((p)=>Boolean(p.defesa?.startAt) && new Date(p.defesa.startAt).getTime() <= Date.now()).length;

    const rawByStatus = Object.entries(processes.reduce<Record<string,number>>((acc,p)=>{
      acc[p.status]=(acc[p.status]||0)+1;
      return acc;
    },{})).map(([key,count])=>({key,label:STATUS_LABELS[key]||key,count})).sort((a,b)=>b.count-a.count);
    const rawYears = countBy(processes.map((p)=>String(new Date(p.defesa?.startAt || p.createdAt).getFullYear())).filter((y)=>/^20\d{2}$/.test(y))).map(([label,count])=>({label,count})).sort((a,b)=>a.label.localeCompare(b.label));
    const rawMonths = countBy(processes.filter((p)=>p.defesa?.startAt).map((p)=>String(p.defesa.startAt).slice(0,7))).map(([label,count])=>({label,count})).sort((a,b)=>a.label.localeCompare(b.label)).slice(-12);
    const completedOrPublic = processes.filter((p)=>p.status==='CONCLUIDO' || p.acervo?.publicationState==='PUBLIC');
    const rawThemes = countBy(completedOrPublic.flatMap((p)=>(p.acervo?.palavrasChave||[]).map(cleanKeyword).filter(Boolean))).slice(0,15).map(([label,count])=>({label,count}));
    const rawWorkTypes = countBy(completedOrPublic.map((p)=>p.acervo?.workType || 'NÃO INFORMADO')).map(([label,count])=>({label,count}));
    const rawLocations = countBy(processes.map((p)=>cleanKeyword(p.defesa?.local||'')).filter(Boolean)).slice(0,8).map(([label,count])=>({label,count}));
    const rawOutcomes = countBy(processes.map((p)=>p.avaliacao?.resultadoLabel || p.avaliacao?.resultadoCode || '').filter(Boolean)).map(([label,count])=>({label,count}));

    const detailedTotals = smallGroupSuppressed
      ? { completed:0, published:0, defended:0, inProgress:0, completionRate:0, publicationRate:0 }
      : {
          completed,
          published,
          defended,
          inProgress:Math.max(0,total-completed),
          completionRate:total?Number((completed/total*100).toFixed(1)):0,
          publicationRate:total?Number((published/total*100).toFixed(1)):0,
        };

    return res.status(200).json({
      generatedAt:new Date().toISOString(),
      privacy:{
        containsPersonalData:false,
        smallGroupSuppressed,
        minimumGroupSize:MIN_PUBLIC_GROUP_SIZE,
        minimumBucketSize:MIN_PUBLIC_BUCKET_SIZE,
      },
      totals:{registered:total,...detailedTotals},
      byStatus:smallGroupSuppressed?[]:rawByStatus.filter((item)=>item.count>=MIN_PUBLIC_BUCKET_SIZE),
      years:smallGroupSuppressed?[]:publicBuckets(rawYears),
      months:smallGroupSuppressed?[]:publicBuckets(rawMonths),
      themes:smallGroupSuppressed?[]:publicBuckets(rawThemes),
      workTypes:smallGroupSuppressed?[]:publicBuckets(rawWorkTypes),
      locations:smallGroupSuppressed?[]:publicBuckets(rawLocations),
      outcomes:smallGroupSuppressed?[]:publicBuckets(rawOutcomes),
    });
  } catch (error) {
    console.error('[Indicadores públicos] Falha ao gerar estatísticas:', error);
    return res.status(503).json({error:'Os indicadores estão temporariamente indisponíveis.'});
  }
}
