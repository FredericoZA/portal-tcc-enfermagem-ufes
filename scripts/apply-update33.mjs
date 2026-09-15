import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const write = (p, content) => {
  const target = path.join(root, p);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content);
};
const replaceOnce = (source, search, replacement, label) => {
  const index = source.indexOf(search);
  if (index < 0) throw new Error(`Padrão não encontrado: ${label}`);
  return source.slice(0, index) + replacement + source.slice(index + search.length);
};
const replaceRegex = (source, regex, replacement, label) => {
  if (!regex.test(source)) throw new Error(`Regex não encontrou: ${label}`);
  regex.lastIndex = 0;
  return source.replace(regex, replacement);
};

// 1. Versão e camada visual
{
  let source = read('package.json');
  source = replaceOnce(source, '"version": "1.0.32"', '"version": "1.0.33"', 'versão package');
  write('package.json', source);
}
{
  let source = read('src/main.tsx');
  source = replaceOnce(source, "import './portal-update-32.css';", "import './portal-update-32.css';\nimport './portal-update-33.css';", 'import CSS 33');
  write('src/main.tsx', source);
}

// 2. Indicadores públicos no menu, acima de Como chegar.
{
  let source = read('src/components/Sidebar.tsx');
  source = replaceOnce(
    source,
    "analise: { id: 'analise', label: getNavLabel('indicadores', 'Indicadores'), icon: BarChart3, emoji: getNavEmoji('indicadores', '📊'), visible: isMasterAdmin && !isVisitor },",
    "analise: { id: 'analise', label: getNavLabel('indicadores', 'Indicadores'), icon: BarChart3, emoji: getNavEmoji('indicadores', '📊'), visible: true },",
    'indicadores públicos'
  );
  source = replaceOnce(
    source,
    ": ['home', 'biblioteca', 'DIVIDER_1', 'meus-processos', 'coordenador', 'configuracoes', 'analise', 'DIVIDER_2', 'como-chegar', 'tutorial', 'fluxo-tcc', 'replicar'];\n          const order = [...configuredOrder];\n          if (!order.includes('analise')) { const settingsIndex = order.indexOf('configuracoes'); order.splice(settingsIndex >= 0 ? settingsIndex + 1 : order.length, 0, 'analise'); }",
    ": ['home', 'biblioteca', 'DIVIDER_1', 'meus-processos', 'coordenador', 'configuracoes', 'DIVIDER_2', 'analise', 'como-chegar', 'tutorial', 'fluxo-tcc', 'replicar'];\n          const order = [...configuredOrder].filter((key) => key !== 'analise');\n          const indicatorsAnchor = order.indexOf('como-chegar');\n          order.splice(indicatorsAnchor >= 0 ? indicatorsAnchor : order.length, 0, 'analise');",
    'ordem pública dos indicadores'
  );
  write('src/components/Sidebar.tsx', source);
}
{
  let source = read('src/utils/siteLayoutConfig.ts');
  source = replaceOnce(
    source,
    "sidebarNavOrder: ['home', 'biblioteca', 'DIVIDER_1', 'meus-processos', 'coordenador', 'configuracoes', 'indicadores', 'DIVIDER_2', 'como-chegar', 'tutorial', 'fluxo-tcc', 'replicar'],",
    "sidebarNavOrder: ['home', 'biblioteca', 'DIVIDER_1', 'meus-processos', 'coordenador', 'configuracoes', 'DIVIDER_2', 'indicadores', 'como-chegar', 'tutorial', 'fluxo-tcc', 'replicar'],",
    'ordem default indicadores'
  );
  source = replaceOnce(
    source,
    "  if (!order.includes('indicadores')) { const i=order.indexOf('configuracoes'); order.splice(i>=0?i+1:order.length,0,'indicadores'); }\n  if (!order.includes('como-chegar')) { const i=order.indexOf('tutorial'); order.splice(i>=0?i:order.length,0,'como-chegar'); }",
    "  const withoutIndicators=order.filter(item=>item!=='indicadores');\n  const indicatorAnchor=withoutIndicators.indexOf('como-chegar');\n  withoutIndicators.splice(indicatorAnchor>=0?indicatorAnchor:withoutIndicators.length,0,'indicadores');\n  order.splice(0,order.length,...withoutIndicators);\n  if (!order.includes('como-chegar')) { const i=order.indexOf('tutorial'); order.splice(i>=0?i:order.length,0,'como-chegar'); }",
    'migração ordem indicadores'
  );
  write('src/utils/siteLayoutConfig.ts', source);
}

// 3. Endpoint público e sanitizado de indicadores.
write('api/public-indicators.ts', `import type { Request, Response } from 'express';
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
const cleanKeyword = (value: string) => value.normalize('NFKC').replace(/\\s+/g,' ').trim();
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
    const years = countBy(processes.map((p)=>String(new Date(p.defesa?.startAt || p.createdAt).getFullYear())).filter((y)=>/^20\\d{2}$/.test(y))).map(([label,count])=>({label,count})).sort((a,b)=>a.label.localeCompare(b.label));
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
`);
{
  const file = 'vercel.json';
  const config = JSON.parse(read(file));
  const rule = { source: '/api/public/indicators', destination: '/api/public-indicators' };
  config.rewrites = (config.rewrites || []).filter((item) => item.source !== rule.source);
  const genericIndex = config.rewrites.findIndex((item) => item.source === '/api/(.*)');
  config.rewrites.splice(genericIndex >= 0 ? genericIndex : 0, 0, rule);
  write(file, JSON.stringify(config, null, 2) + '\n');
}

// 4. Página pública de indicadores: somente agregados acadêmicos.
write('src/pages/IndicadoresPage.tsx', `import React, { useEffect, useMemo, useState } from 'react';
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
  {label:'TCCs concluídos',value:data.totals.completed,detail:\`\${data.totals.completionRate}% do total cadastrado\`,icon:TrendingUp},
  {label:'Publicações',value:data.totals.published,detail:\`\${data.totals.publicationRate}% do total cadastrado\`,icon:BookOpen},
];

const Bars:React.FC<{items:Bucket[];empty:string}> = ({items,empty}) => {
  const max=Math.max(1,...items.map((item)=>item.count));
  if(!items.length)return <div className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-8 text-center text-xs text-slate-500">{empty}</div>;
  return <div className="space-y-2">{items.map((item)=><div key={item.label} className="grid grid-cols-[minmax(90px,150px)_1fr_32px] items-center gap-2 text-[11px]"><span className="truncate font-bold text-slate-700" title={item.label}>{item.label}</span><div className="h-5 overflow-hidden rounded-md border border-slate-200 bg-white"><div className="h-full rounded-md bg-[#337959]" style={{width:\`\${Math.max(4,(item.count/max)*100)}%\`}}/></div><span className="text-right font-black text-slate-800">{item.count}</span></div>)}</div>;
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
      <div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2"><span className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-300 bg-white"><BarChart3 className="h-4 w-4 text-slate-700"/></span><h1 className="text-sm font-black uppercase tracking-tight sm:text-base">Indicadores</h1></div><button type="button" onClick={()=>void load()} disabled={loading} className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/70 bg-white text-slate-800 shadow-sm disabled:opacity-60" title="Atualizar indicadores"><RefreshCw className={\`h-3.5 w-3.5 \${loading?'animate-spin':''}\`}/></button></div>
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
`);

// 5. Engrenagem: linhas/datas para todos, colunas e ordem apenas para Master.
write('src/components/HeaderSettingsPopover.tsx', `import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Columns3, ListFilter, Settings } from 'lucide-react';
import { DEFAULT_TABLE_TEXT_FORMAT, TableColumnSelectorPanel, TableTextFormat } from './TableColumnSelectorPanel';
import { getTableStyles } from '../utils/tableFormatters';
import { useAuth } from '../context/AuthContext';

export interface HeaderSettingsPopoverProps {
  recordsLimit:number|'all'; setRecordsLimit:(limit:number|'all')=>void; allowedLimits?:(number|'all')[];
  allColumns?:{key:string;label:string;isFixed?:boolean}[]; visibleColumns?:Record<string,boolean>; setVisibleColumns?:(visible:Record<string,boolean>|((prev:Record<string,boolean>)=>Record<string,boolean>))=>void;
  columnOrder?:string[]; setColumnOrder?:(order:string[])=>void; storageKey?:string; customLabels?:Record<string,string>; setCustomLabels?:React.Dispatch<React.SetStateAction<Record<string,string>>>;
  columnWidths?:Record<string,string|number>; setColumnWidths?:React.Dispatch<React.SetStateAction<Record<string,string|number>>>; textFormat?:TableTextFormat; setTextFormat?:React.Dispatch<React.SetStateAction<TableTextFormat>>;
  defaultColumnOrder?:string[]; defaultVisibleColumns?:Record<string,boolean>; defaultRecordsLimit?:number|'all'; startDate?:string; setStartDate?:(val:string)=>void; endDate?:string; setEndDate?:(val:string)=>void; defaultTableTitle?:string; defaultFilterTitle?:string;
}

export const HeaderSettingsPopover:React.FC<HeaderSettingsPopoverProps> = (props) => {
  const {recordsLimit,setRecordsLimit,allowedLimits=[25,50,100,'all'],textFormat=DEFAULT_TABLE_TEXT_FORMAT,defaultRecordsLimit=25,startDate,setStartDate,endDate,setEndDate,allColumns,visibleColumns,setVisibleColumns,columnOrder,setColumnOrder,storageKey,defaultColumnOrder,defaultVisibleColumns,defaultTableTitle}=props;
  const {isMasterAdmin,globalRoles}=useAuth();
  const isMaster=isMasterAdmin||globalRoles.includes('MASTER_ADMIN');
  const canManageColumns=Boolean(isMaster&&storageKey&&allColumns?.length&&visibleColumns&&setVisibleColumns&&columnOrder&&setColumnOrder);
  const [isOpen,setIsOpen]=useState(false); const [columnMode,setColumnMode]=useState(false); const styles=getTableStyles(textFormat);
  const gearButtonRef=useRef<HTMLButtonElement>(null); const popupRef=useRef<HTMLDivElement>(null); const [popoverPos,setPopoverPos]=useState({top:0,left:0});
  const hasActiveFilters=Boolean((startDate&&startDate.trim())||(endDate&&endDate.trim())||(defaultRecordsLimit&&recordsLimit!==defaultRecordsLimit));
  const handleToggle=()=>{if(isOpen){setIsOpen(false);setColumnMode(false);return;}if(gearButtonRef.current){const rect=gearButtonRef.current.getBoundingClientRect();const popupWidth=Math.min(canManageColumns?430:320,window.innerWidth-32);let left=Math.min(rect.right-popupWidth,window.innerWidth-popupWidth-16);left=Math.max(16,left);let top=rect.bottom+8;if(top+520>window.innerHeight&&rect.top>520)top=Math.max(16,rect.top-520);setPopoverPos({top,left});}setIsOpen(true);};
  useEffect(()=>{if(!isOpen)return;const key=(e:KeyboardEvent)=>{if(e.key==='Escape'){if(columnMode)setColumnMode(false);else setIsOpen(false);}};const outside=(e:MouseEvent)=>{if(popupRef.current&&!popupRef.current.contains(e.target as Node)&&!gearButtonRef.current?.contains(e.target as Node)){setIsOpen(false);setColumnMode(false);}};window.addEventListener('keydown',key);document.addEventListener('mousedown',outside);return()=>{window.removeEventListener('keydown',key);document.removeEventListener('mousedown',outside);};},[isOpen,columnMode]);
  return <div className="inline-flex items-center gap-1.5 shrink-0"><button ref={gearButtonRef} type="button" onClick={handleToggle} className={\`\${styles.toolbarButtonClass} relative\`} style={styles.toolbarButtonStyle} title={canManageColumns?'Exibição da planilha: linhas, período, colunas e ordem':'Exibição da planilha: linhas e período'}><Settings className="h-3.5 w-3.5 text-current"/>{hasActiveFilters&&<span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-white"/>}</button>{isOpen&&createPortal(<div ref={popupRef} className={\`fixed z-[1000001] max-h-[calc(100vh-1rem)] overflow-y-auto rounded-xl border border-slate-300 bg-white p-3.5 text-slate-800 shadow-2xl animate-in fade-in zoom-in-95 duration-150 \${columnMode?'w-[min(430px,calc(100vw-2rem))]':'w-72 sm:w-80'}\`} style={{top:popoverPos.top,left:popoverPos.left}}>{columnMode&&canManageColumns?<TableColumnSelectorPanel storageKey={storageKey!} tabTitle={defaultTableTitle||'Planilha'} allColumns={allColumns!} columnOrder={columnOrder!} setColumnOrder={setColumnOrder!} visibleColumns={visibleColumns!} setVisibleColumns={setVisibleColumns!} defaultColumnOrder={defaultColumnOrder||allColumns!.map(c=>c.key)} defaultVisibleColumns={defaultVisibleColumns||Object.fromEntries(allColumns!.map(c=>[c.key,true]))} onClose={()=>setColumnMode(false)}/>:<><div className="mb-3 flex items-center justify-between border-b border-slate-200 pb-2"><span className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-slate-900"><Settings className="h-3.5 w-3.5 text-slate-600"/>Exibição da planilha</span><button type="button" onClick={()=>setIsOpen(false)} className="rounded-md p-1 text-xs font-bold text-slate-400 hover:text-slate-700">✕</button></div><div className="space-y-3"><div><div className="mb-1.5 flex items-center justify-between"><span className="flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-slate-700"><ListFilter className="h-3 w-3"/>Linhas por página</span><span className="text-[9px] font-bold text-slate-400">Atual: {recordsLimit==='all'?'Todos':recordsLimit}</span></div><div className="grid grid-cols-4 gap-1">{allowedLimits.map(limit=><button key={String(limit)} type="button" onClick={()=>setRecordsLimit(limit)} className="rounded-lg border px-2 py-1.5 text-center text-[10px] font-black" style={recordsLimit===limit?{background:'#AEB0B3',borderColor:'#979a9d',color:'#111827'}:{background:'#fff',borderColor:'#cbd5e1',color:'#334155'}}>{limit==='all'?'Todos':limit}</button>)}</div></div><div className="border-t border-slate-200 pt-2.5"><span className="text-[10px] font-black uppercase tracking-wider text-slate-700">Filtro de período</span><div className="mt-1.5 grid grid-cols-2 gap-2"><label><span className="text-[9px] font-bold text-slate-500">Data inicial</span><input type="date" value={startDate||''} onChange={e=>setStartDate?.(e.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1 text-[11px] font-bold text-slate-800 outline-none"/></label><label><span className="text-[9px] font-bold text-slate-500">Data final</span><input type="date" value={endDate||''} onChange={e=>setEndDate?.(e.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1 text-[11px] font-bold text-slate-800 outline-none"/></label></div>{(startDate||endDate)&&<button type="button" onClick={()=>{setStartDate?.('');setEndDate?.('');}} className="mt-1 text-[9.5px] font-extrabold text-rose-700">Limpar datas</button>}</div>{canManageColumns&&<button type="button" onClick={()=>setColumnMode(true)} className="flex w-full items-center justify-between rounded-lg border border-slate-300 bg-[#f0f0f0] px-3 py-2 text-[10px] font-black uppercase tracking-wide text-slate-800 hover:bg-slate-200"><span className="flex items-center gap-2"><Columns3 className="h-3.5 w-3.5"/>Colunas e ordem</span><span>Master</span></button>}</div><div className="mt-3 flex items-center justify-between border-t border-slate-200 pt-2"><span className="text-[9px] text-slate-400">ESC para fechar</span><button type="button" onClick={()=>setIsOpen(false)} className="rounded-lg border border-slate-300 bg-[#f0f0f0] px-3 py-1.5 text-[10px] font-extrabold uppercase text-slate-800">Concluir</button></div></>}</div>,document.body)}</div>;
};
`);

// 6. Meus TCCs: remove botão solto e coloca Cadastrar na barra da planilha.
{
  let source=read('src/pages/MeusProcessosPage.tsx');
  source=replaceRegex(source,/\n\s*\/\* Top Action Bar - Button Above Header \*\/[\s\S]*?\n\s*\/\* Section with Unified Gray Header & Table \*\//,"\n\n      {/* Section with Unified Gray Header & Table */}",'ação superior Meus TCCs');
  const searchBlock=`                <SearchPopover\n                  value={searchTerm}\n                  onChange={setSearchTerm}\n                  placeholder="Buscar TCCs..."\n                  textFormat={meusProcessosTextFormat}\n                />`;
  const searchReplacement=searchBlock+`\n\n                {processes.length > 0 && meusProcessosTextFormat.showCadastrarTrabalhoButton !== false && (\n                  <button\n                    id="meus-processos-btn-novo"\n                    type="button"\n                    onClick={onNavigateToWizard}\n                    className={\`\${styles.toolbarButtonClass} portal-restricted-toolbar-wide\`}\n                    style={styles.toolbarButtonStyle}\n                    title="Cadastrar novo trabalho de TCC"\n                  >\n                    <GraduationCap className="h-3.5 w-3.5" />\n                    <span>Cadastrar</span>\n                  </button>\n                )}`;
  source=replaceOnce(source,searchBlock,searchReplacement,'Cadastrar na toolbar');
  source=source.replaceAll('className={`flex items-center gap-1.5 px-3 py-1 rounded-full font-black text-[10px] uppercase tracking-wider cursor-pointer transition-all h-7 shrink-0 border select-none ${','className={`portal-standard-filter-chip flex items-center gap-1.5 px-3 py-1 rounded-full font-black text-[10px] uppercase tracking-wider cursor-pointer transition-all h-7 shrink-0 border select-none ${');
  write('src/pages/MeusProcessosPage.tsx',source);
}

// 7. Presidência: Asten/Gov.br entram na própria barra e em cada linha.
{
  let source=read('src/pages/CoordenadorPage.tsx');
  source=replaceRegex(source,/\n\s*\/\* Botões no Topo \(Acima do Cabeçalho\) \*\/[\s\S]*?\n\s*\{downloadError && \(/,"\n      {downloadError && (",'ações externas do coordenador');
  const marker=`  const renderAstenActionCell = (proc: ProcessData) => {`;
  const start=source.indexOf(marker); if(start<0)throw new Error('renderAstenActionCell não encontrado');
  const end=source.indexOf('\n\n  // Download only',start); if(end<0)throw new Error('fim renderAstenActionCell não encontrado');
  const replacement=`  const downloadBrowserFile = (blob: Blob, fileName: string) => {\n    const url=URL.createObjectURL(blob); const link=document.createElement('a'); link.href=url; link.download=fileName; document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url);\n  };\n\n  const handleGovOne = async (processId: string) => {\n    if(signingIds.includes(processId))return;\n    const signerWindow=window.open('https://assinador.iti.br/','_blank','noopener,noreferrer');\n    setSigningMessage(''); setSigningIds(prev=>[...prev,processId]);\n    try{const result=await apiClient.signProcessDocument(processId,'DECLARACAO','GOV_BR');const file=await apiClient.downloadGovBrSigningPdf(result.job.id);downloadBrowserFile(file.blob,file.fileName);setSigningMessage('PDF preparado e baixado. O Assinador Gov.br foi aberto em outra aba; depois da assinatura, envie o PDF assinado na ficha do TCC.');await loadData();}\n    catch(error){signerWindow?.close();setSigningMessage(error instanceof Error?error.message:'Não foi possível preparar a assinatura Gov.br.');}\n    finally{setSigningIds(prev=>prev.filter(id=>id!==processId));}\n  };\n\n  const handleSignSelectedGov = async () => {\n    const pendingIds=new Set(pendingItems.map(item=>item.process.id));const ids=selectedIds.filter(id=>pendingIds.has(id)&&isDeclarationActionable(id));\n    if(ids.length<2){setSigningMessage('Selecione pelo menos dois trabalhos para usar a assinatura em bloco.');return;}\n    window.open('https://assinador.iti.br/','_blank','noopener,noreferrer');setSigningIds(prev=>Array.from(new Set([...prev,...ids])));let completed=0;const failures:string[]=[];\n    for(const id of ids){try{const result=await apiClient.signProcessDocument(id,'DECLARACAO','GOV_BR');const file=await apiClient.downloadGovBrSigningPdf(result.job.id);downloadBrowserFile(file.blob,file.fileName);completed++;}catch(error){const proc=pendingItems.find(item=>item.process.id===id)?.process;failures.push(\`\${proc?.protocolo||id}: \${error instanceof Error?error.message:'falha'}\`);}}\n    setSigningIds(prev=>prev.filter(id=>!ids.includes(id)));setSelectedIds([]);await loadData();setSigningMessage(failures.length?\`\${completed} PDF(s) Gov.br preparados; \${failures.length} falha(s): \${failures.join(' | ')}\`:\`\${completed} PDF(s) preparados. Assine-os no Gov.br e envie os arquivos assinados pelas fichas dos TCCs.\`);\n  };\n\n  const renderSignatureActionCell = (proc: ProcessData) => {\n    const job=getDeclarationJob(proc.id);const working=signingIds.includes(proc.id);const status=getDeclarationStatus(proc.id);const actionable=isDeclarationActionable(proc.id);\n    return <td className={\`\${styles.cellPadClass} \${styles.borderClass} min-w-[188px] text-center align-middle\`}><div className="flex items-center justify-center gap-1.5"><button type="button" onClick={()=>handleSignOne(proc.id)} disabled={working||!actionable} className="portal-sign-provider-btn" title="Assinar esta declaração pela Asten"><Shield className="h-3.5 w-3.5"/><span>Asten</span></button><button type="button" onClick={()=>void handleGovOne(proc.id)} disabled={working||!actionable} className="portal-sign-provider-btn" title="Preparar PDF e abrir o Assinador Gov.br"><FileCheck className="h-3.5 w-3.5"/><span>Gov</span></button></div>{!actionable&&<span className={\`mt-1 inline-flex rounded-full border px-2 py-0.5 text-[8px] font-black uppercase \${status.tone}\`} title={job?.lastError||status.label}>{status.label}</span>}</td>;\n  };`;
  source=source.slice(0,start)+replacement+source.slice(end);
  source=source.replaceAll('{renderAstenActionCell(proc)}','{renderSignatureActionCell(proc)}');
  source=source.replaceAll('renderAstenActionCell','renderSignatureActionCell');
  const searchBlock=`                <SearchPopover\n                  value={searchFilter}\n                  onChange={setSearchFilter}\n                  placeholder="Buscar declarações..."\n                  textFormat={coordTextFormat}\n                />`;
  const toolbar=searchBlock+`\n\n                {activeTab === 'pendentes' && (<>\n                  <button type="button" disabled={selectedIds.length < 2 || signingIds.length > 0} onClick={handleSignSelected} className={\`\${styles.toolbarButtonClass} portal-sign-bulk-btn disabled:opacity-45\`} style={styles.toolbarButtonStyle} title="Assinar selecionados pela Asten"><Shield className="h-3.5 w-3.5"/><span>Asten</span></button>\n                  <button type="button" disabled={selectedIds.length < 2 || signingIds.length > 0} onClick={()=>void handleSignSelectedGov()} className={\`\${styles.toolbarButtonClass} portal-sign-bulk-btn disabled:opacity-45\`} style={styles.toolbarButtonStyle} title="Preparar selecionados para assinatura Gov.br"><FileCheck className="h-3.5 w-3.5"/><span>Gov</span></button>\n                </>)}`;
  source=replaceOnce(source,searchBlock,toolbar,'bulk Asten Gov toolbar');
  source=source.replaceAll('className={`flex items-center gap-1.5 px-3 py-1 rounded-full font-black text-[10px] uppercase tracking-wider cursor-pointer transition-all','className={`portal-standard-filter-chip flex items-center gap-1.5 px-3 py-1 rounded-full font-black text-[10px] uppercase tracking-wider cursor-pointer transition-all');
  write('src/pages/CoordenadorPage.tsx',source);
}

// 8. Personalização vira um único ponto de entrada; integrações continuam separadas.
write('src/components/PortalPersonalizationHubModal.tsx', `import React from 'react';
import { createPortal } from 'react-dom';
import { Palette, X } from 'lucide-react';
import type { GlobalSettings } from '../types';
import { MasterAndPresidentConfigForm } from './AuditAndSecuritySection';
import { CommissionIdentityPanel } from './CommissionIdentityPanel';

interface Props{isOpen:boolean;onClose:()=>void;onOpenAppearance:()=>void;settings:GlobalSettings;onSettingsUpdated:(settings:GlobalSettings)=>void;showNotification:(message:string)=>void;}
export const PortalPersonalizationHubModal:React.FC<Props>=({isOpen,onClose,onOpenAppearance,settings,onSettingsUpdated,showNotification})=>{
  if(!isOpen)return null;
  return createPortal(<div className="fixed inset-0 z-[1000000] flex items-start justify-center overflow-y-auto bg-slate-950/70 p-3 backdrop-blur-sm"><div role="dialog" aria-modal="true" aria-label="Personalização do Portal" className="my-4 w-full max-w-5xl overflow-hidden rounded-2xl border border-slate-300 bg-[#f0f0f0] shadow-2xl"><header className="flex items-center justify-between bg-[#005830] px-4 py-3 text-white"><div className="flex items-center gap-2"><span className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-300 bg-white"><Palette className="h-4 w-4 text-slate-700"/></span><h2 className="text-sm font-black uppercase tracking-wide">Personalização do Portal</h2></div><button type="button" onClick={onClose} className="rounded-lg border border-white/60 bg-white p-1.5 text-slate-800" aria-label="Fechar"><X className="h-4 w-4"/></button></header><div className="space-y-3 p-3 sm:p-4"><button type="button" onClick={()=>{onClose();onOpenAppearance();}} className="flex w-full items-center justify-between rounded-xl border border-slate-300 bg-white px-4 py-3 text-left shadow-sm hover:bg-slate-50"><div><div className="text-xs font-black uppercase tracking-wide text-slate-900">Aparência, barras, rodapé e planilhas</div><div className="mt-1 text-[11px] text-slate-600">Cores, textos institucionais, barra superior, barra lateral, rodapé, QR Code, botões, pop-ups e aparência das tabelas.</div></div><Palette className="h-5 w-5 text-[#337959]"/></button><MasterAndPresidentConfigForm settings={settings} onSettingsUpdated={onSettingsUpdated} showNotification={showNotification}/><CommissionIdentityPanel isMaster/></div></div></div>,document.body);
};
`);
{
  let source=read('src/pages/ConfiguracoesPage.tsx');
  source=replaceOnce(source,"import { AuditAndSecuritySection, MasterAndPresidentConfigForm, AuditLogsTable } from '../components/AuditAndSecuritySection';","import { AuditAndSecuritySection, AuditLogsTable } from '../components/AuditAndSecuritySection';\nimport { PortalPersonalizationHubModal } from '../components/PortalPersonalizationHubModal';",'import personalização hub');
  source=replaceOnce(source,"  const [unifiedEditorOpen, setUnifiedEditorOpen] = useState(false);","  const [unifiedEditorOpen, setUnifiedEditorOpen] = useState(false);\n  const [personalizationHubOpen, setPersonalizationHubOpen] = useState(false);",'state personalization hub');
  source=replaceOnce(source,"onClick={() => openUnifiedEditor('site_header')}","onClick={() => setPersonalizationHubOpen(true)}",'abrir personalização hub');
  const sectionStart=source.indexOf('<section id="section-personalizacao-portal"');if(sectionStart<0)throw new Error('seção personalização não encontrada');
  const buttonEnd=source.indexOf('</button>',sectionStart);const sectionEnd=source.indexOf('</section>',buttonEnd);if(buttonEnd<0||sectionEnd<0)throw new Error('limites personalização não encontrados');
  source=source.slice(0,buttonEnd+9)+'\n        '+source.slice(sectionEnd);
  source=replaceRegex(source,/\n\s*\{isMasterAdmin && \(\n\s*<MasterAndPresidentConfigForm[\s\S]*?\n\s*\)\}/,'','contas administrativas fora de sincronização');
  const modalMarker='      {/* Global Site Layout & Table Formatting Editor Modal */}';
  const hub=`      {personalizationHubOpen && (\n        <PortalPersonalizationHubModal\n          isOpen={personalizationHubOpen}\n          onClose={() => setPersonalizationHubOpen(false)}\n          onOpenAppearance={() => openUnifiedEditor('site_header')}\n          settings={settings}\n          onSettingsUpdated={() => { void refreshAuth(); showNotification('Configurações de personalização atualizadas.'); }}\n          showNotification={showNotification}\n        />\n      )}\n\n`;
  source=replaceOnce(source,modalMarker,hub+modalMarker,'render personalization hub');
  write('src/pages/ConfiguracoesPage.tsx',source);
}

// 9. Modelos e variáveis: apenas Documentos, E-mails, Formulários, Fluxo e Variáveis; topo simplificado.
{
  let source=read('src/components/IntegrationStudioPanel.tsx');
  source=replaceOnce(source,"  const [activeTab, setActiveTab] = useState<StudioTab>('overview');","  const [activeTab, setActiveTab] = useState<StudioTab>('documents');",'aba inicial Studio');
  source=replaceRegex(source,/  const tabs: Array<\{ id: StudioTab; label: string; icon: React\.ElementType \}> = \[[\s\S]*?\n  \];/,`  const tabs: Array<{ id: StudioTab; label: string; icon: React.ElementType }> = [\n    { id: 'documents', label: 'Documentos', icon: FileText },\n    { id: 'emails', label: 'E-mails', icon: Mail },\n    { id: 'forms', label: 'Formulários', icon: ClipboardList },\n    { id: 'workflow', label: 'Fluxo', icon: Workflow },\n    { id: 'variables', label: 'Variáveis', icon: Variable }\n  ];`,'tabs simplificadas Studio');
  source=replaceRegex(source,/      <div className="border-b border-slate-200 bg-slate-100 px-4 py-3\.5[\s\S]*?\n      <div className="border-b border-slate-200 bg-slate-50 p-2">/,`      <div className="border-b border-slate-200 bg-slate-50 p-2">`,'cabeçalho Studio removido');
  source=replaceOnce(source,'<div className="grid grid-cols-2 gap-1 sm:grid-cols-4 xl:grid-cols-8">','<div className="flex items-center gap-2"><div className="grid flex-1 grid-cols-2 gap-1 sm:grid-cols-3 xl:grid-cols-5">','grid tabs Studio');
  source=replaceOnce(source,'          })}\n        </div>\n      </div>\n\n      <div className="bg-slate-50/40 p-4 sm:p-5">','          })}\n          </div>\n          <button type="button" onClick={() => void persistSnapshot(true)} disabled={isSaving} className="inline-flex min-h-8 items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-[10px] font-black uppercase tracking-wide text-slate-800 shadow-sm disabled:opacity-50"><Save className="h-3.5 w-3.5" />{isSaving ? \'Salvando…\' : \'Salvar\'}</button>\n        </div>\n      </div>\n\n      <div className="bg-slate-50/40 p-3 sm:p-4">','salvar compacto Studio');
  write('src/components/IntegrationStudioPanel.tsx',source);
}

// 10. Backup: dois botões iguais e compactos.
{
  let source=read('src/components/AuditAndSecuritySection.tsx');
  source=replaceOnce(source,'className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 rounded-lg text-[11px] font-bold shadow-2xs transition-all cursor-pointer flex items-center gap-1"','className="portal-backup-action inline-flex min-w-[172px] items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-[#f0f0f0] px-3 py-1.5 text-[11px] font-bold text-slate-800 shadow-sm transition-all hover:bg-slate-200"','botão download backup');
  source=replaceOnce(source,'className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 rounded-lg text-[11px] font-bold shadow-2xs transition-all cursor-pointer flex items-center gap-1"','className="portal-backup-action inline-flex min-w-[172px] items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-[#f0f0f0] px-3 py-1.5 text-[11px] font-bold text-slate-800 shadow-sm transition-all hover:bg-slate-200"','botão restaurar backup');
  write('src/components/AuditAndSecuritySection.tsx',source);
}

// 11. CSS de padronização restrita e compactação.
write('src/portal-update-33.css', `/* Atualização 33 — áreas restritas e indicadores públicos. */

.portal-restricted-toolbar-wide{min-width:126px!important;width:auto!important;padding-left:14px!important;padding-right:14px!important;gap:6px!important;}
.portal-sign-bulk-btn{min-width:82px!important;width:auto!important;padding-left:10px!important;padding-right:10px!important;gap:5px!important;}
.portal-sign-provider-btn{display:inline-flex;min-height:28px;align-items:center;justify-content:center;gap:4px;border:1px solid #cbd5e1;border-radius:8px;background:#fff;padding:4px 8px;font-size:9px;font-weight:900;text-transform:uppercase;letter-spacing:.04em;color:#1f2937;box-shadow:0 1px 2px rgba(15,23,42,.08);}
.portal-sign-provider-btn:hover:not(:disabled){background:#f0f0f0}.portal-sign-provider-btn:disabled{cursor:not-allowed;opacity:.45}

/* Filtros das tabelas restritas seguem o mesmo vocabulário do calendário. */
#meus-processos-page-container .portal-standard-filter-chip,
#coordenador-page-root .portal-standard-filter-chip{background:#fff!important;border-color:#cbd5e1!important;color:#1f2937!important;box-shadow:none!important;transform:none!important;opacity:1!important;}
#meus-processos-page-container .portal-standard-filter-chip[class*="scale"],
#coordenador-page-root .portal-standard-filter-chip[class*="scale"]{background:#AEB0B3!important;border-color:#979a9d!important;color:#111827!important;}
#meus-processos-page-container section>div>div:first-child,
#coordenador-page-root section>div>div:first-child{border-bottom-width:2px!important;}
#meus-processos-page-container section>div>div:first-child>div:last-child,
#coordenador-page-root section>div>div:first-child>div:last-child{margin-top:0!important;margin-bottom:0!important;}

/* Studio compacto: reduz deslocamento sem alterar os editores funcionais. */
.portal-studio{margin-bottom:.5rem!important}.portal-studio>div:last-child{padding:.75rem!important}.portal-studio .space-y-4{gap:.5rem!important}.portal-studio article{scroll-margin-top:8px}.portal-studio [class*="rounded-2xl"]{box-shadow:0 1px 3px rgba(15,23,42,.08)}

.portal-backup-action{height:32px!important;margin:0!important;}
#indicadores-publicos-page table th{background:#005830!important;color:#fff!important;}
#portal-personalization-hub table thead{background:#005830!important;}
`);

// 12. Contratos de regressão da Atualização 33.
write('server/update33RestrictedAreaContract.test.ts', `import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
const root=path.resolve(process.cwd());const source=(file:string)=>readFile(path.join(root,file),'utf8');

test('Indicadores são públicos e ficam acima de Como chegar',async()=>{const [sidebar,layout,page,api]=await Promise.all([source('src/components/Sidebar.tsx'),source('src/utils/siteLayoutConfig.ts'),source('src/pages/IndicadoresPage.tsx'),source('api/public-indicators.ts')]);assert.ok(sidebar.includes("visible: true"));assert.ok(layout.includes("'DIVIDER_2', 'indicadores', 'como-chegar'"));assert.ok(page.includes('/api/public/indicators'));assert.ok(api.includes('containsPersonalData:false'));assert.ok(!page.includes('OperationsMonitorPanel'));});

test('Engrenagem reserva colunas e ordem ao Master',async()=>{const popover=await source('src/components/HeaderSettingsPopover.tsx');assert.ok(popover.includes('isMasterAdmin'));assert.ok(popover.includes('TableColumnSelectorPanel'));assert.ok(popover.includes('Colunas e ordem'));});

test('Meus TCCs e Presidência usam ações dentro da barra',async()=>{const [mine,coord]=await Promise.all([source('src/pages/MeusProcessosPage.tsx'),source('src/pages/CoordenadorPage.tsx')]);assert.equal((mine.match(/id="meus-processos-btn-novo"/g)||[]).length,1);assert.ok(mine.includes('portal-restricted-toolbar-wide'));assert.ok(coord.includes('portal-sign-bulk-btn'));assert.ok(coord.includes('handleSignSelectedGov'));assert.ok(coord.includes('https://assinador.iti.br/'));assert.ok(coord.includes('renderSignatureActionCell'));});

test('Configuração separa personalização, sincronização e Studio simplificado',async()=>{const [config,studio,backup]=await Promise.all([source('src/pages/ConfiguracoesPage.tsx'),source('src/components/IntegrationStudioPanel.tsx'),source('src/components/AuditAndSecuritySection.tsx')]);assert.ok(config.includes('PortalPersonalizationHubModal'));assert.ok(studio.includes("{ id: 'documents', label: 'Documentos'"));assert.ok(!studio.includes("{ id: 'operation', label: 'Oficina'"));assert.ok(!studio.includes("{ id: 'audit', label: 'Auditoria'"));assert.ok(backup.includes('portal-backup-action'));});
`);

console.log('Atualização 33 aplicada com sucesso.');
