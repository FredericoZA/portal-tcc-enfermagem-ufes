import type { ProcessData } from '../src/types';

export type PublicIndicatorBucket = { label: string; count: number; key?: string };
export type PublicIndicatorsPayload = {
  generatedAt: string;
  privacy: {
    containsPersonalData: false;
    smallGroupSuppressed: boolean;
    minimumGroupSize: number;
    minimumBucketSize: number;
  };
  totals: {
    registered: number;
    completed: number;
    published: number;
    defended: number;
    inProgress: number;
    completionRate: number;
    publicationRate: number;
  };
  byStatus: Array<{ key: string; label: string; count: number }>;
  years: PublicIndicatorBucket[];
  months: PublicIndicatorBucket[];
  themes: PublicIndicatorBucket[];
  workTypes: PublicIndicatorBucket[];
  locations: PublicIndicatorBucket[];
  outcomes: PublicIndicatorBucket[];
};

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

const countBy = (values: string[]) =>
  Object.entries(values.reduce<Record<string,number>>((acc,value)=>{
    if(value)acc[value]=(acc[value]||0)+1;
    return acc;
  },{})).sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0],'pt-BR'));

const publicBuckets = (items: PublicIndicatorBucket[]) =>
  items.filter((item)=>item.count >= MIN_PUBLIC_BUCKET_SIZE);

export function buildPublicIndicators(processes: ProcessData[], now = Date.now()): PublicIndicatorsPayload {
  const safeProcesses = Array.isArray(processes) ? processes : [];
  const total = safeProcesses.length;
  const smallGroupSuppressed = total > 0 && total < MIN_PUBLIC_GROUP_SIZE;
  const completed = safeProcesses.filter((p)=>p.status==='CONCLUIDO').length;
  const published = safeProcesses.filter((p)=>
    p.acervo?.publicationState==='PUBLIC' ||
    (p.acervo?.isPublic && Boolean(p.acervo?.publicFullWorkFileId || p.acervo?.publicExpandedAbstractFileId))
  ).length;
  const defended = safeProcesses.filter((p)=>Boolean(p.defesa?.startAt) && new Date(p.defesa.startAt).getTime() <= now).length;

  const rawByStatus = Object.entries(safeProcesses.reduce<Record<string,number>>((acc,p)=>{
    acc[p.status]=(acc[p.status]||0)+1;
    return acc;
  },{})).map(([key,count])=>({key,label:STATUS_LABELS[key]||key,count})).sort((a,b)=>b.count-a.count);

  const rawYears = countBy(
    safeProcesses
      .map((p)=>String(new Date(p.defesa?.startAt || p.createdAt).getFullYear()))
      .filter((y)=>/^20\d{2}$/.test(y))
  ).map(([label,count])=>({label,count})).sort((a,b)=>a.label.localeCompare(b.label));

  const rawMonths = countBy(
    safeProcesses.filter((p)=>p.defesa?.startAt).map((p)=>String(p.defesa.startAt).slice(0,7))
  ).map(([label,count])=>({label,count})).sort((a,b)=>a.label.localeCompare(b.label)).slice(-12);

  const completedOrPublic = safeProcesses.filter((p)=>p.status==='CONCLUIDO' || p.acervo?.publicationState==='PUBLIC');
  const rawThemes = countBy(
    completedOrPublic.flatMap((p)=>(p.acervo?.palavrasChave||[]).map(cleanKeyword).filter(Boolean))
  ).slice(0,15).map(([label,count])=>({label,count}));

  const rawWorkTypes = countBy(
    completedOrPublic.map((p)=>p.acervo?.workType || 'NÃO INFORMADO')
  ).map(([label,count])=>({label,count}));

  const rawLocations = countBy(
    safeProcesses.map((p)=>cleanKeyword(p.defesa?.local||'')).filter(Boolean)
  ).slice(0,8).map(([label,count])=>({label,count}));

  const rawOutcomes = countBy(
    safeProcesses.map((p)=>p.avaliacao?.resultadoLabel || p.avaliacao?.resultadoCode || '').filter(Boolean)
  ).map(([label,count])=>({label,count}));

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

  return {
    generatedAt:new Date(now).toISOString(),
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
  };
}
