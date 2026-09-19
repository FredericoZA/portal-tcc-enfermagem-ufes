import type { Request, Response } from 'express';
import { loadPortalRuntimeState } from '../server/integrations/supabase';
import type { ProcessData } from '../src/types';

type RuntimeState = { processes?: ProcessData[] };
type Bucket = { label: string; count: number };

const MIN_PUBLIC_GROUP_SIZE = 5;
const MIN_PUBLIC_BUCKET_SIZE = 3;
const PORTAL_TIMEZONE = 'America/Sao_Paulo';

const STATUS_LABELS: Record<string,string> = {
  EM_RASCUNHO: 'Em rascunho',
  AGUARDANDO_CONFIRMACAO_LOCAL: 'Confirmando local',
  AGUARDANDO_DEFESA: 'Aguardando defesa',
  EM_AVALIACAO: 'Em avaliação',
  AGUARDANDO_DADOS_FINAIS: 'Dados finais',
  AGUARDANDO_ASSINATURA: 'Assinaturas',
  CONCLUIDO: 'Concluído',
};
const WORK_TYPE_LABELS: Record<string,string> = { MONOGRAFIA:'Monografia', ARTIGO:'Artigo', OUTRO:'Outro', 'NÃO INFORMADO':'Não informado' };

const cleanKeyword = (value: string) => value.normalize('NFKC').replace(/\s+/g,' ').trim();
const countBy = (values: string[]) => Object.entries(values.reduce<Record<string,number>>((acc,value)=>{
  if(value)acc[value]=(acc[value]||0)+1;
  return acc;
},{})).sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0],'pt-BR'));
const publicBuckets = (items: Bucket[]) => items.filter((item)=>item.count >= MIN_PUBLIC_BUCKET_SIZE);
const round1 = (value:number) => Number(value.toFixed(1));
const mean = (values:number[]) => values.length ? values.reduce((sum,value)=>sum+value,0)/values.length : 0;
const median = (values:number[]) => {
  if(!values.length)return 0;
  const sorted=[...values].sort((a,b)=>a-b); const middle=Math.floor(sorted.length/2);
  return sorted.length%2?sorted[middle]:(sorted[middle-1]+sorted[middle])/2;
};
const stdDev = (values:number[]) => {
  if(values.length<2)return 0;
  const avg=mean(values); return Math.sqrt(values.reduce((sum,value)=>sum+Math.pow(value-avg,2),0)/values.length);
};
const localHour = (iso:string) => {
  const parts=new Intl.DateTimeFormat('pt-BR',{hour:'2-digit',hourCycle:'h23',timeZone:PORTAL_TIMEZONE}).formatToParts(new Date(iso));
  return Number(parts.find((part)=>part.type==='hour')?.value||0);
};
const localWeekday = (iso:string) => new Intl.DateTimeFormat('pt-BR',{weekday:'long',timeZone:PORTAL_TIMEZONE}).format(new Date(iso)).replace(/^./,(value)=>value.toUpperCase());
const monthKey = (iso:string) => new Intl.DateTimeFormat('sv-SE',{year:'numeric',month:'2-digit',timeZone:PORTAL_TIMEZONE}).format(new Date(iso));

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
    const completedProcesses = processes.filter((p)=>p.status==='CONCLUIDO');
    const completed = completedProcesses.length;
    const published = processes.filter((p)=>p.acervo?.publicationState==='PUBLIC' || (p.acervo?.isPublic && Boolean(p.acervo?.publicFullWorkFileId || p.acervo?.publicExpandedAbstractFileId))).length;
    const defended = processes.filter((p)=>Boolean(p.defesa?.startAt) && new Date(p.defesa.startAt).getTime() <= Date.now()).length;
    const withCoauthor = processes.filter((p)=>Boolean(p.aluno2)).length;

    const rawByStatus = Object.entries(processes.reduce<Record<string,number>>((acc,p)=>{
      acc[p.status]=(acc[p.status]||0)+1;
      return acc;
    },{})).map(([key,count])=>({key,label:STATUS_LABELS[key]||key,count})).sort((a,b)=>b.count-a.count);

    const defenseDates=processes.map((p)=>p.defesa?.startAt||'').filter(Boolean);
    const rawYears = countBy(processes.map((p)=>String(new Date(p.defesa?.startAt || p.createdAt).getFullYear())).filter((y)=>/^20\d{2}$/.test(y))).map(([label,count])=>({label,count})).sort((a,b)=>a.label.localeCompare(b.label));
    const allMonthBuckets = countBy(defenseDates.map(monthKey)).map(([label,count])=>({label,count})).sort((a,b)=>a.label.localeCompare(b.label));
    const rawMonths = allMonthBuckets.slice(-18);
    const completedOrPublic = processes.filter((p)=>p.status==='CONCLUIDO' || p.acervo?.publicationState==='PUBLIC');
    const rawThemes = countBy(completedOrPublic.flatMap((p)=>(p.acervo?.palavrasChave||[]).map(cleanKeyword).filter((value)=>Boolean(value)&&normalizeTheme(value)!=='HOMOLOGACAO'))).slice(0,15).map(([label,count])=>({label,count}));
    const rawWorkTypes = countBy(completedOrPublic.map((p)=>WORK_TYPE_LABELS[p.acervo?.workType || 'NÃO INFORMADO'] || p.acervo?.workType || 'Não informado')).map(([label,count])=>({label,count}));
    const rawLocations = countBy(processes.map((p)=>cleanKeyword(p.defesa?.local||'')).filter(Boolean)).slice(0,10).map(([label,count])=>({label,count}));
    const rawOutcomes = countBy(processes.map((p)=>p.avaliacao?.resultadoLabel || p.avaliacao?.resultadoCode || '').filter(Boolean)).map(([label,count])=>({label,count}));
    const rawFormats = countBy(processes.map((p)=>cleanKeyword(p.defesa?.formato||'')).filter(Boolean)).map(([label,count])=>({label,count}));
    const rawWeekdays = countBy(defenseDates.map(localWeekday)).map(([label,count])=>({label,count}));
    const rawDayparts = countBy(defenseDates.map((iso)=>{const hour=localHour(iso);return hour<12?'Manhã':hour<18?'Tarde':'Noite';})).map(([label,count])=>({label,count}));

    const monthlyValues=allMonthBuckets.map((bucket)=>bucket.count);
    const peakMonth=allMonthBuckets.reduce<Bucket|null>((best,current)=>!best||current.count>best.count?current:best,null);
    const completionDays=completedProcesses.map((p)=>{
      const start=new Date(p.createdAt).getTime(); const finish=new Date(p.completedAt||p.updatedAt).getTime();
      return Number.isFinite(start)&&Number.isFinite(finish)&&finish>=start?(finish-start)/86_400_000:NaN;
    }).filter(Number.isFinite) as number[];

    const detailedTotals = smallGroupSuppressed
      ? { completed:0, published:0, defended:0, inProgress:0, completionRate:0, publicationRate:0,coauthorRate:0 }
      : {
          completed,
          published,
          defended,
          inProgress:Math.max(0,total-completed),
          completionRate:total?round1(completed/total*100):0,
          publicationRate:total?round1(published/total*100):0,
          coauthorRate:total?round1(withCoauthor/total*100):0,
        };

    return res.status(200).json({
      generatedAt:new Date().toISOString(),
      privacy:{ containsPersonalData:false,smallGroupSuppressed,minimumGroupSize:MIN_PUBLIC_GROUP_SIZE,minimumBucketSize:MIN_PUBLIC_BUCKET_SIZE },
      totals:{registered:total,...detailedTotals},
      descriptive:smallGroupSuppressed?null:{
        monthlyMean:round1(mean(monthlyValues)),
        monthlyMedian:round1(median(monthlyValues)),
        monthlyStdDev:round1(stdDev(monthlyValues)),
        peakMonth:peakMonth?.label||null,
        peakMonthCount:peakMonth?.count||0,
        completionDaysMean:round1(mean(completionDays)),
        completionDaysMedian:round1(median(completionDays)),
        observedMonths:allMonthBuckets.length,
      },
      byStatus:smallGroupSuppressed?[]:rawByStatus.filter((item)=>item.count>=MIN_PUBLIC_BUCKET_SIZE),
      years:smallGroupSuppressed?[]:publicBuckets(rawYears),
      months:smallGroupSuppressed?[]:publicBuckets(rawMonths),
      themes:smallGroupSuppressed?[]:publicBuckets(rawThemes),
      workTypes:smallGroupSuppressed?[]:publicBuckets(rawWorkTypes),
      locations:smallGroupSuppressed?[]:publicBuckets(rawLocations),
      outcomes:smallGroupSuppressed?[]:publicBuckets(rawOutcomes),
      formats:smallGroupSuppressed?[]:publicBuckets(rawFormats),
      weekdays:smallGroupSuppressed?[]:publicBuckets(rawWeekdays),
      dayparts:smallGroupSuppressed?[]:publicBuckets(rawDayparts),
    });
  } catch (error) {
    console.error('[Indicadores públicos] Falha ao gerar estatísticas:', error);
    return res.status(503).json({error:'Os indicadores estão temporariamente indisponíveis.'});
  }
}

function normalizeTheme(value:string){
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^A-Za-z0-9]+/g,'_').replace(/^_+|_+$/g,'').toUpperCase();
}
