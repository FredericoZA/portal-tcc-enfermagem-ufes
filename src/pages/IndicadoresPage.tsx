import React, { useEffect, useMemo, useState } from 'react';
import { BarChart3, BookOpen, CheckCircle2, FileText, RefreshCw, Tags, TrendingUp } from 'lucide-react';

type Bucket = { label:string; count:number; key?:string };
type PublicIndicators = {
  generatedAt:string;
  privacy:{containsPersonalData:boolean;smallGroupSuppressed:boolean};
  totals:{registered:number;completed:number;published:number;defended:number;inProgress:number;completionRate:number;publicationRate:number};
  byStatus:Array<{key:string;label:string;count:number}>;
  years:Bucket[]; months:Bucket[]; themes:Bucket[]; workTypes:Bucket[]; locations:Bucket[]; outcomes:Bucket[];
};

const metricCards = (data:PublicIndicators) => [
  {label:'TCCs cadastrados',value:data.totals.registered,detail:'processos acadêmicos registrados',icon:FileText},
  {label:'Defesas realizadas',value:data.totals.defended,detail:'trabalhos com data de defesa já transcorrida',icon:CheckCircle2},
  {label:'TCCs concluídos',value:data.totals.completed,detail:`${data.totals.completionRate}% do total cadastrado`,icon:TrendingUp},
  {label:'Publicações',value:data.totals.published,detail:`${data.totals.publicationRate}% do total cadastrado`,icon:BookOpen},
];

const Bars:React.FC<{items:Bucket[];empty:string}> = ({items,empty}) => {
  const max=Math.max(1,...items.map((item)=>item.count));
  if(!items.length)return <div className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-8 text-center text-xs text-slate-500">{empty}</div>;
  return <div className="space-y-2">{items.map((item)=><div key={item.label} className="grid grid-cols-[minmax(90px,150px)_1fr_32px] items-center gap-2 text-[11px]"><span className="truncate font-bold text-slate-700" title={item.label}>{item.label}</span><div className="h-5 overflow-hidden rounded-md border border-slate-200 bg-white"><div className="h-full rounded-md bg-[#337959]" style={{width:`${Math.max(4,(item.count/max)*100)}%`}}/></div><span className="text-right font-black text-slate-800">{item.count}</span></div>)}</div>;
};

export const IndicadoresPage:React.FC = () => {
  const [data,setData]=useState<PublicIndicators|null>(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const load=async()=>{setLoading(true);setError('');try{const response=await fetch('/api/public/indicators',{headers:{Accept:'application/json'}});if(!response.ok)throw new Error('Não foi possível carregar os indicadores.');setData(await response.json());}catch(err){setError(err instanceof Error?err.message:'Indicadores indisponíveis.');}finally{setLoading(false);}};
  useEffect(()=>{void load();},[]);
  const cards=useMemo(()=>data?metricCards(data):[],[data]);
  return <div id="indicadores-publicos-page" className="mx-auto max-w-7xl space-y-3 py-1">
    <section className="rounded-2xl border border-emerald-900/80 bg-[#005830] px-4 py-3 text-white shadow-sm">
      <div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2"><span className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-300 bg-white"><BarChart3 className="h-4 w-4 text-slate-700"/></span><h1 className="text-sm font-black uppercase tracking-tight sm:text-base">Indicadores</h1></div><button type="button" onClick={()=>void load()} disabled={loading} className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/70 bg-white text-slate-800 shadow-sm disabled:opacity-60" title="Atualizar indicadores"><RefreshCw className={`h-3.5 w-3.5 ${loading?'animate-spin':''}`}/></button></div>
    </section>
    {error&&<div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-semibold text-rose-800">{error}</div>}
    {loading&&!data?<div className="rounded-2xl border border-slate-300 bg-[#f0f0f0] p-10 text-center text-xs font-bold text-slate-500">Carregando estatísticas acadêmicas…</div>:data&&<>
      <section className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">{cards.map(({label,value,detail,icon:Icon})=><article key={label} className="rounded-2xl border border-slate-300 bg-[#f0f0f0] p-3 shadow-sm"><div className="flex items-start justify-between gap-2"><div><div className="text-2xl font-black text-[#337959]">{value}</div><h2 className="mt-0.5 text-xs font-black uppercase tracking-wide text-slate-900">{label}</h2></div><span className="rounded-lg border border-slate-200 bg-white p-2"><Icon className="h-4 w-4 text-[#337959]"/></span></div><p className="mt-2 text-[11px] leading-4 text-slate-600">{detail}</p></article>)}</section>
      <section className="grid gap-3 lg:grid-cols-2"><article className="rounded-2xl border border-slate-300 bg-[#f0f0f0] p-4 shadow-sm"><h2 className="text-xs font-black uppercase tracking-wide text-slate-900">TCCs por ano</h2><p className="mb-3 mt-1 text-[11px] text-slate-500">Distribuição pela data prevista/realizada da defesa.</p><Bars items={data.years} empty="Ainda não há anos suficientes para compor o gráfico."/></article><article className="rounded-2xl border border-slate-300 bg-[#f0f0f0] p-4 shadow-sm"><h2 className="text-xs font-black uppercase tracking-wide text-slate-900">Defesas nos últimos meses</h2><p className="mb-3 mt-1 text-[11px] text-slate-500">Volume mensal das defesas cadastradas.</p><Bars items={data.months} empty="Ainda não há defesas mensais registradas."/></article></section>
      <section className="grid gap-3 lg:grid-cols-[1.2fr_.8fr]"><article className="rounded-2xl border border-slate-300 bg-[#f0f0f0] p-4 shadow-sm"><div className="flex items-center gap-2"><Tags className="h-4 w-4 text-[#337959]"/><h2 className="text-xs font-black uppercase tracking-wide text-slate-900">Temas mais recorrentes</h2></div><p className="mb-3 mt-1 text-[11px] text-slate-500">Palavras-chave dos TCCs concluídos ou publicados, apresentadas somente de forma agregada.</p>{data.themes.length?<div className="flex flex-wrap gap-2">{data.themes.map((item)=><span key={item.label} className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-3 py-1.5 text-[11px] font-bold text-slate-700"><span>{item.label}</span><strong className="rounded-full bg-[#AEB0B3] px-1.5 py-0.5 text-[9px] text-slate-950">{item.count}</strong></span>)}</div>:<div className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-6 text-center text-xs text-slate-500">As palavras-chave aparecerão à medida que os trabalhos concluídos forem catalogados.</div>}</article><article className="rounded-2xl border border-slate-300 bg-[#f0f0f0] p-4 shadow-sm"><h2 className="text-xs font-black uppercase tracking-wide text-slate-900">Situação dos processos</h2><div className="mt-3 overflow-hidden rounded-xl border border-slate-300 bg-white"><table className="w-full text-left text-[11px]"><thead className="bg-[#005830] text-white"><tr><th className="px-3 py-2 font-black uppercase">Situação</th><th className="px-3 py-2 text-right font-black uppercase">TCCs</th></tr></thead><tbody className="divide-y divide-slate-200">{data.byStatus.map((item)=><tr key={item.key}><td className="px-3 py-2 font-semibold text-slate-700">{item.label}</td><td className="px-3 py-2 text-right font-black text-slate-900">{item.count}</td></tr>)}</tbody></table></div></article></section>
      <section className="grid gap-3 lg:grid-cols-3"><article className="rounded-2xl border border-slate-300 bg-[#f0f0f0] p-4 shadow-sm"><h2 className="text-xs font-black uppercase text-slate-900">Tipos de trabalho</h2><div className="mt-3"><Bars items={data.workTypes} empty="Tipos ainda não informados."/></div></article><article className="rounded-2xl border border-slate-300 bg-[#f0f0f0] p-4 shadow-sm"><h2 className="text-xs font-black uppercase text-slate-900">Locais de defesa</h2><div className="mt-3"><Bars items={data.locations} empty="Locais ainda não cadastrados."/></div></article><article className="rounded-2xl border border-slate-300 bg-[#f0f0f0] p-4 shadow-sm"><h2 className="text-xs font-black uppercase text-slate-900">Resultados acadêmicos</h2><p className="mb-3 mt-1 text-[10px] leading-4 text-slate-500">Resultados só aparecem quando o conjunto possui volume mínimo para evitar exposição de grupos pequenos.</p><Bars items={data.outcomes} empty="Dados suprimidos ou ainda insuficientes."/></article></section>
      <p className="px-1 text-[10px] leading-4 text-slate-500">Painel público com dados agregados. Não são exibidos e-mails, matrículas, documentos privados ou informações operacionais de assinatura e infraestrutura. Atualizado em {new Date(data.generatedAt).toLocaleString('pt-BR')}.</p>
    </>}
  </div>;
};
