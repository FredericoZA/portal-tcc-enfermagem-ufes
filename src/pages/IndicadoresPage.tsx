import React, { useEffect, useMemo, useState } from 'react';
import { Activity, BarChart3, BookOpen, CalendarDays, CheckCircle2, Clock3, FileText, RefreshCw, ShieldCheck, Tags, TrendingUp, Users2 } from 'lucide-react';

type Bucket = { label:string; count:number; key?:string };
type PublicIndicators = {
  generatedAt:string;
  privacy:{containsPersonalData:boolean;smallGroupSuppressed:boolean;minimumGroupSize:number;minimumBucketSize:number};
  totals:{registered:number;completed:number;published:number;defended:number;inProgress:number;completionRate:number;publicationRate:number;coauthorRate:number};
  descriptive:null|{monthlyMean:number;monthlyMedian:number;monthlyStdDev:number;peakMonth:string|null;peakMonthCount:number;completionDaysMean:number;completionDaysMedian:number;observedMonths:number};
  byStatus:Array<{key:string;label:string;count:number}>;
  years:Bucket[]; months:Bucket[]; themes:Bucket[]; workTypes:Bucket[]; locations:Bucket[]; outcomes:Bucket[]; formats:Bucket[]; weekdays:Bucket[]; dayparts:Bucket[];
};

const metricCards = (data:PublicIndicators) => {
  if(data.privacy.smallGroupSuppressed){
    return [{label:'TCCs cadastrados',value:data.totals.registered,detail:'total geral; demais estatísticas ficam suprimidas até atingir o volume mínimo',icon:FileText}];
  }
  return [
    {label:'TCCs cadastrados',value:data.totals.registered,detail:'processos acadêmicos registrados',icon:FileText},
    {label:'Defesas realizadas',value:data.totals.defended,detail:'trabalhos com data de defesa já transcorrida',icon:CheckCircle2},
    {label:'TCCs concluídos',value:data.totals.completed,detail:`${data.totals.completionRate}% do total cadastrado`,icon:TrendingUp},
    {label:'Publicações',value:data.totals.published,detail:`${data.totals.publicationRate}% do total cadastrado`,icon:BookOpen},
  ];
};

const Bars:React.FC<{items:Bucket[];empty:string;percent?:boolean}> = ({items,empty,percent=false}) => {
  const max=Math.max(1,...items.map((item)=>item.count));
  const total=items.reduce((sum,item)=>sum+item.count,0);
  if(!items.length)return <div className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-8 text-center text-xs text-slate-500">{empty}</div>;
  return <div className="space-y-2">{items.map((item)=><div key={item.label} className="grid grid-cols-[minmax(90px,150px)_1fr_54px] items-center gap-2 text-[11px]"><span className="truncate font-bold text-slate-700" title={item.label}>{item.label}</span><div className="h-5 overflow-hidden rounded-md border border-slate-200 bg-white"><div className="h-full rounded-md bg-[#337959]" style={{width:`${Math.max(4,(item.count/max)*100)}%`}}/></div><span className="text-right font-black text-slate-800">{percent&&total?`${Math.round(item.count/total*100)}%`:item.count}</span></div>)}</div>;
};

const DONUT_COLORS=['#005830','#337959','#789684','#aeb8b1','#6b7280','#9ca3af','#cbd5e1'];
const Donut:React.FC<{items:Bucket[];empty:string}> = ({items,empty}) => {
  const total=items.reduce((sum,item)=>sum+item.count,0);
  if(!items.length||!total)return <div className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-8 text-center text-xs text-slate-500">{empty}</div>;
  let cursor=0;
  const segments=items.map((item,index)=>{const start=cursor;const end=cursor+(item.count/total)*100;cursor=end;return `${DONUT_COLORS[index%DONUT_COLORS.length]} ${start}% ${end}%`;});
  return <div className="grid items-center gap-4 sm:grid-cols-[150px_1fr]">
    <div className="relative mx-auto h-36 w-36 rounded-full" style={{background:`conic-gradient(${segments.join(',')})`}} aria-label={`Gráfico circular com ${total} registros`}><div className="absolute inset-[28%] flex items-center justify-center rounded-full border border-slate-200 bg-white"><span className="text-xl font-black text-slate-900">{total}</span></div></div>
    <div className="space-y-1.5">{items.map((item,index)=><div key={item.label} className="flex items-center justify-between gap-3 text-[11px]"><span className="flex min-w-0 items-center gap-2 font-semibold text-slate-700"><span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{background:DONUT_COLORS[index%DONUT_COLORS.length]}}/><span className="truncate" title={item.label}>{item.label}</span></span><strong className="shrink-0 text-slate-900">{item.count} · {Math.round(item.count/total*100)}%</strong></div>)}</div>
  </div>;
};

const formatMonth=(value:string|null)=>{
  if(!value)return '—';
  const [year,month]=value.split('-');
  const date=new Date(Number(year),Number(month)-1,1);
  return new Intl.DateTimeFormat('pt-BR',{month:'short',year:'numeric'}).format(date).replace('.','');
};

export const IndicadoresPage:React.FC = () => {
  const [data,setData]=useState<PublicIndicators|null>(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const load=async()=>{setLoading(true);setError('');try{const response=await fetch('/api/public/indicators',{headers:{Accept:'application/json'}});if(!response.ok)throw new Error('Não foi possível carregar os indicadores.');setData(await response.json());}catch(err){setError(err instanceof Error?err.message:'Indicadores indisponíveis.');}finally{setLoading(false);}};
  useEffect(()=>{void load();},[]);
  const cards=useMemo(()=>data?metricCards(data):[],[data]);
  const hasData=Boolean(data&&data.totals.registered>0);

  return <div id="indicadores-publicos-page" className="mx-auto max-w-7xl space-y-3 py-1">
    <section className="rounded-2xl border border-emerald-900/80 bg-[#005830] px-4 py-3 text-white shadow-sm">
      <div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2"><BarChart3 className="h-5 w-5 text-white"/><div><h1 className="text-sm font-black uppercase tracking-tight sm:text-base">Indicadores</h1><p className="text-[10px] font-semibold text-white/75">Panorama estatístico agregado dos TCCs</p></div></div><button type="button" onClick={()=>void load()} disabled={loading} className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-800 shadow-sm disabled:opacity-60" title="Atualizar indicadores" aria-label="Atualizar indicadores"><RefreshCw className={`h-3.5 w-3.5 ${loading?'animate-spin':''}`}/></button></div>
    </section>

    {error&&<div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-semibold text-rose-800">{error}</div>}
    {loading&&!data?<div className="rounded-2xl border border-slate-300 bg-[#f0f0f0] p-10 text-center text-xs font-bold text-slate-500">Carregando estatísticas acadêmicas…</div>:data&&<>
      {!hasData&&<section className="portal-layer-card rounded-2xl border border-slate-300 bg-[#d5dce0] p-4 shadow-sm sm:p-5"><div className="flex items-start gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white"><BarChart3 className="h-5 w-5 text-[#337959]"/></span><div className="min-w-0"><h2 className="text-sm font-black text-slate-900">Indicadores aguardando os primeiros dados</h2><p className="mt-1 max-w-4xl text-xs leading-5 text-slate-600">O painel já está preparado para evoluir automaticamente conforme os TCCs forem cadastrados, defendidos, concluídos e publicados. Enquanto não houver registros, o Portal evita gráficos de zero sem valor analítico.</p></div></div></section>}

      {hasData&&<>
        {data.privacy.smallGroupSuppressed&&<div className="flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2.5 text-[11px] leading-4 text-amber-950"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0"/><div><strong>Proteção de grupos pequenos ativa.</strong> O portal exibe apenas o total geral enquanto houver menos de {data.privacy.minimumGroupSize} TCCs. Distribuições detalhadas ficam ocultas para reduzir risco de identificação indireta.</div></div>}
        <section className={`grid gap-2 ${data.privacy.smallGroupSuppressed?'sm:grid-cols-1':'sm:grid-cols-2 xl:grid-cols-4'}`}>{cards.map(({label,value,detail,icon:Icon})=><article key={label} className="rounded-2xl border border-slate-300 bg-[#f0f0f0] p-3 shadow-sm"><div className="flex items-start justify-between gap-2"><div><div className="text-2xl font-black text-[#337959]">{value}</div><h2 className="mt-0.5 text-xs font-black uppercase tracking-wide text-slate-900">{label}</h2></div><span className="rounded-lg border border-slate-200 bg-white p-2"><Icon className="h-4 w-4 text-[#337959]"/></span></div><p className="mt-2 text-[11px] leading-4 text-slate-600">{detail}</p></article>)}</section>

        {!data.privacy.smallGroupSuppressed&&data.descriptive&&<>
          <section className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            {[
              {label:'Média por mês',value:data.descriptive.monthlyMean,detail:`${data.descriptive.observedMonths} meses observados`,icon:Activity},
              {label:'Mediana mensal',value:data.descriptive.monthlyMedian,detail:'valor central da série',icon:BarChart3},
              {label:'Desvio-padrão',value:data.descriptive.monthlyStdDev,detail:'dispersão do volume mensal',icon:TrendingUp},
              {label:'Mês de pico',value:data.descriptive.peakMonthCount,detail:formatMonth(data.descriptive.peakMonth),icon:CalendarDays},
              {label:'Tempo médio',value:`${data.descriptive.completionDaysMean} d`,detail:'cadastro até conclusão',icon:Clock3},
              {label:'Com coautoria',value:`${data.totals.coauthorRate}%`,detail:'proporção de TCCs com 2 autores',icon:Users2},
            ].map(({label,value,detail,icon:Icon})=><article key={label} className="rounded-xl border border-slate-300 bg-white p-3 shadow-sm"><div className="flex items-center justify-between gap-2"><Icon className="h-4 w-4 text-[#337959]"/><strong className="text-lg text-slate-900">{value}</strong></div><h3 className="mt-2 text-[10px] font-black uppercase text-slate-800">{label}</h3><p className="mt-0.5 text-[9.5px] text-slate-500">{detail}</p></article>)}
          </section>

          <section className="grid gap-3 xl:grid-cols-2">
            <article className="rounded-2xl border border-slate-300 bg-[#f0f0f0] p-4 shadow-sm"><h2 className="text-xs font-black uppercase tracking-wide text-slate-900">Situação dos processos</h2><p className="mb-3 mt-1 text-[11px] text-slate-500">Participação de cada estágio no conjunto de TCCs cadastrados.</p><Donut items={data.byStatus} empty="Ainda não há categorias com volume suficiente."/></article>
            <article className="rounded-2xl border border-slate-300 bg-[#f0f0f0] p-4 shadow-sm"><h2 className="text-xs font-black uppercase tracking-wide text-slate-900">Tipos de trabalho</h2><p className="mb-3 mt-1 text-[11px] text-slate-500">Composição dos TCCs concluídos ou publicados.</p><Donut items={data.workTypes} empty="Tipos ainda sem volume suficiente."/></article>
          </section>

          <section className="grid gap-3 lg:grid-cols-2"><article className="rounded-2xl border border-slate-300 bg-[#f0f0f0] p-4 shadow-sm"><h2 className="text-xs font-black uppercase tracking-wide text-slate-900">TCCs por ano</h2><p className="mb-3 mt-1 text-[11px] text-slate-500">Distribuição pela data prevista/realizada da defesa. Categorias com menos de {data.privacy.minimumBucketSize} registros não são exibidas.</p><Bars items={data.years} empty="Ainda não há anos com volume suficiente para compor o gráfico."/></article><article className="rounded-2xl border border-slate-300 bg-[#f0f0f0] p-4 shadow-sm"><h2 className="text-xs font-black uppercase tracking-wide text-slate-900">Defesas por mês</h2><p className="mb-3 mt-1 text-[11px] text-slate-500">Série temporal das defesas cadastradas, com supressão de categorias pequenas.</p><Bars items={data.months} empty="Ainda não há meses com volume suficiente para exibição."/></article></section>

          <section className="grid gap-3 lg:grid-cols-3">
            <article className="rounded-2xl border border-slate-300 bg-[#f0f0f0] p-4 shadow-sm"><h2 className="text-xs font-black uppercase text-slate-900">Defesas por dia da semana</h2><p className="mb-3 mt-1 text-[10px] text-slate-500">Concentração semanal das bancas.</p><Bars items={data.weekdays} empty="Dias ainda sem volume suficiente." percent/></article>
            <article className="rounded-2xl border border-slate-300 bg-[#f0f0f0] p-4 shadow-sm"><h2 className="text-xs font-black uppercase text-slate-900">Faixa de horário</h2><p className="mb-3 mt-1 text-[10px] text-slate-500">Manhã, tarde e noite no horário institucional.</p><Donut items={data.dayparts} empty="Horários ainda sem volume suficiente."/></article>
            <article className="rounded-2xl border border-slate-300 bg-[#f0f0f0] p-4 shadow-sm"><h2 className="text-xs font-black uppercase text-slate-900">Modalidade da defesa</h2><p className="mb-3 mt-1 text-[10px] text-slate-500">Distribuição entre formatos cadastrados.</p><Donut items={data.formats} empty="Modalidades ainda sem volume suficiente."/></article>
          </section>

          <section className="grid gap-3 lg:grid-cols-[1.2fr_.8fr]"><article className="rounded-2xl border border-slate-300 bg-[#f0f0f0] p-4 shadow-sm"><div className="flex items-center gap-2"><Tags className="h-4 w-4 text-[#337959]"/><h2 className="text-xs font-black uppercase tracking-wide text-slate-900">Temas mais recorrentes</h2></div><p className="mb-3 mt-1 text-[11px] text-slate-500">Palavras-chave dos TCCs concluídos ou publicados, apresentadas somente de forma agregada.</p>{data.themes.length?<div className="flex flex-wrap gap-2">{data.themes.map((item)=><span key={item.label} className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-3 py-1.5 text-[11px] font-bold text-slate-700"><span>{item.label}</span><strong className="rounded-full bg-[#AEB0B3] px-1.5 py-0.5 text-[9px] text-slate-950">{item.count}</strong></span>)}</div>:<div className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-6 text-center text-xs text-slate-500">As palavras-chave aparecerão quando houver volume agregado suficiente.</div>}</article><article className="rounded-2xl border border-slate-300 bg-[#f0f0f0] p-4 shadow-sm"><h2 className="text-xs font-black uppercase tracking-wide text-slate-900">Resultados acadêmicos</h2><p className="mb-3 mt-1 text-[10px] leading-4 text-slate-500">Resultados só aparecem quando cada categoria possui volume mínimo.</p><Donut items={data.outcomes} empty="Dados suprimidos ou ainda insuficientes."/></article></section>

          <section className="grid gap-3 lg:grid-cols-2"><article className="rounded-2xl border border-slate-300 bg-[#f0f0f0] p-4 shadow-sm"><h2 className="text-xs font-black uppercase text-slate-900">Locais de defesa</h2><div className="mt-3"><Bars items={data.locations} empty="Locais ainda sem volume suficiente."/></div></article><article className="rounded-2xl border border-slate-300 bg-[#f0f0f0] p-4 shadow-sm"><h2 className="text-xs font-black uppercase text-slate-900">Leitura estatística</h2><div className="mt-3 grid gap-2 sm:grid-cols-2"><div className="rounded-xl border border-slate-200 bg-white p-3"><span className="text-[9px] font-black uppercase text-slate-500">Mediana do ciclo</span><strong className="mt-1 block text-lg text-slate-900">{data.descriptive.completionDaysMedian} dias</strong><p className="text-[10px] text-slate-500">metade dos concluídos levou até esse prazo</p></div><div className="rounded-xl border border-slate-200 bg-white p-3"><span className="text-[9px] font-black uppercase text-slate-500">Coeficiente de variação mensal</span><strong className="mt-1 block text-lg text-slate-900">{data.descriptive.monthlyMean?Math.round(data.descriptive.monthlyStdDev/data.descriptive.monthlyMean*100):0}%</strong><p className="text-[10px] text-slate-500">dispersão relativa do volume de defesas</p></div></div></article></section>
        </>}
      </>}

      <p className="px-1 text-[10px] leading-4 text-slate-500">Painel público com dados agregados. Não são exibidos e-mails, matrículas, documentos privados ou informações operacionais de assinatura e infraestrutura. Categorias com menos de {data.privacy.minimumBucketSize} registros são suprimidas. Atualizado em {new Date(data.generatedAt).toLocaleString('pt-BR')}.</p>
    </>}
  </div>;
};
