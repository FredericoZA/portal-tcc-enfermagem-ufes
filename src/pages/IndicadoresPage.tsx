import React, { useEffect, useMemo, useState } from 'react';
import { BarChart3, BookOpen, CalendarDays, CheckCircle2, Clock3, FileText, Gauge, MapPin, ShieldCheck, Tags, TrendingUp, Users2 } from 'lucide-react';
import { PortalSectionDivider } from '../components/PortalSectionDivider';

type Bucket = { label: string; count: number; key?: string };
type PublicIndicators = {
  generatedAt: string;
  privacy: { containsPersonalData: boolean; smallGroupSuppressed: boolean; minimumGroupSize: number; minimumBucketSize: number };
  totals: { registered: number; completed: number; published: number; defended: number; inProgress: number; completionRate: number; publicationRate: number; coauthorRate: number };
  descriptive: null | { monthlyMean: number; monthlyMedian: number; monthlyStdDev: number; peakMonth: string | null; peakMonthCount: number; completionDaysMean: number; completionDaysMedian: number; observedMonths: number };
  byStatus: Array<{ key: string; label: string; count: number }>;
  years: Bucket[];
  months: Bucket[];
  themes: Bucket[];
  workTypes: Bucket[];
  locations: Bucket[];
  outcomes: Bucket[];
  formats: Bucket[];
  weekdays: Bucket[];
  dayparts: Bucket[];
};

const panel = 'h-full rounded-2xl border border-slate-300 bg-[#d5dce0] p-4 shadow-sm';
const pct = (n: number, d: number) => d > 0 ? Math.round((n / d) * 100) : 0;
const num = (value: number, digits = 1) => new Intl.NumberFormat('pt-BR', { maximumFractionDigits: digits }).format(value || 0);
const monthLabel = (value?: string | null) => {
  if (!value) return '—';
  const match = value.match(/(20\d{2})[-/](\d{1,2})/);
  if (!match) return value;
  return new Intl.DateTimeFormat('pt-BR', { month: 'short', year: 'numeric' }).format(new Date(Number(match[1]), Number(match[2]) - 1, 1)).replace('.', '');
};

const BarList: React.FC<{ items?: Bucket[]; percentage?: boolean; empty?: string }> = ({ items = [], percentage = false, empty = 'Sem volume suficiente.' }) => {
  if (!items.length) return <div className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center text-xs text-slate-500">{empty}</div>;
  const max = Math.max(1, ...items.map((item) => item.count));
  const total = items.reduce((sum, item) => sum + item.count, 0);
  return <div className="space-y-2">
    {items.map((item) => <div key={`${item.key || item.label}-${item.label}`} className="grid grid-cols-[minmax(96px,170px)_1fr_58px] items-center gap-2 text-[11px]">
      <span className="truncate font-bold text-slate-800" title={item.label}>{item.label}</span>
      <div className="h-5 overflow-hidden rounded-md border border-slate-300 bg-white"><div className="h-full rounded-md bg-[#337959]" style={{ width: `${Math.max(3, (item.count / max) * 100)}%` }} /></div>
      <strong className="text-right text-slate-950">{percentage && total ? `${pct(item.count, total)}%` : item.count}</strong>
    </div>)}
  </div>;
};

const LineTrend: React.FC<{ items?: Bucket[] }> = ({ items = [] }) => {
  if (items.length < 2) return <BarList items={items} />;
  const width = 760;
  const height = 210;
  const padX = 28;
  const padY = 24;
  const max = Math.max(1, ...items.map((item) => item.count));
  const points = items.map((item, index) => ({
    x: padX + (index / (items.length - 1)) * (width - padX * 2),
    y: height - padY - (item.count / max) * (height - padY * 2),
    item,
  }));
  const path = points.map((point, index) => `${index ? 'L' : 'M'} ${point.x} ${point.y}`).join(' ');
  return <div className="overflow-x-auto">
    <svg viewBox={`0 0 ${width} ${height}`} className="h-[230px] min-w-[620px] w-full" role="img" aria-label="Tendência mensal de defesas">
      {[0.25, 0.5, 0.75, 1].map((ratio) => <line key={ratio} x1={padX} x2={width - padX} y1={height - padY - ratio * (height - padY * 2)} y2={height - padY - ratio * (height - padY * 2)} stroke="#bfc8cd" strokeWidth="1" />)}
      <path d={path} fill="none" stroke="#337959" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      {points.map(({ x, y, item }) => <g key={`${item.key || item.label}-${item.label}`}>
        <circle cx={x} cy={y} r="5" fill="#fff" stroke="#337959" strokeWidth="3" />
        <text x={x} y={Math.max(13, y - 10)} textAnchor="middle" fontSize="10" fontWeight="800" fill="#17212b">{item.count}</text>
      </g>)}
    </svg>
    <div className="grid min-w-[620px] gap-1 text-[9px] text-slate-600" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
      {items.map((item) => <span key={`${item.key || item.label}-${item.label}`} className="truncate text-center" title={item.label}>{item.label}</span>)}
    </div>
  </div>;
};

const Funnel: React.FC<{ data: PublicIndicators }> = ({ data }) => {
  const rows = [
    { label: 'Cadastrados', count: data.totals.registered },
    { label: 'Defendidos', count: data.totals.defended },
    { label: 'Concluídos', count: data.totals.completed },
    { label: 'Publicados', count: data.totals.published },
  ];
  const base = Math.max(1, data.totals.registered);
  return <div className="space-y-2.5">{rows.map((row, index) => <div key={row.label} className="grid grid-cols-[100px_1fr_70px] items-center gap-2 text-[11px]">
    <strong className="text-slate-800">{row.label}</strong>
    <div className="h-8 overflow-hidden rounded-lg border border-slate-300 bg-white"><div className="flex h-full items-center justify-end rounded-lg bg-[#337959] pr-2 text-[10px] font-black text-white" style={{ width: `${Math.max(8, (row.count / base) * 100)}%` }}>{row.count}</div></div>
    <span className="text-right font-black text-slate-950">{index === 0 ? '100%' : `${pct(row.count, base)}%`}</span>
  </div>)}</div>;
};

export const IndicadoresPage: React.FC = () => {
  const [data, setData] = useState<PublicIndicators | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    fetch('/api/public/indicators', { headers: { Accept: 'application/json' } })
      .then(async (response) => {
        if (!response.ok) throw new Error('Não foi possível carregar os indicadores.');
        return response.json();
      })
      .then((payload) => {
        if (!active) return;
        const arrays = ['byStatus', 'years', 'months', 'themes', 'workTypes', 'locations', 'outcomes', 'formats', 'weekdays', 'dayparts'];
        const normalized = { ...payload, totals: { registered: 0, completed: 0, published: 0, defended: 0, inProgress: 0, completionRate: 0, publicationRate: 0, coauthorRate: 0, ...(payload?.totals || {}) } } as any;
        arrays.forEach((key) => { if (!Array.isArray(normalized[key])) normalized[key] = []; });
        setData(normalized as PublicIndicators);
      })
      .catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : 'Indicadores indisponíveis.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const analytics = useMemo(() => {
    if (!data) return null;
    const t = data.totals;
    const d = data.descriptive;
    const months = data.months;
    const latest = months.at(-1);
    const previous = months.at(-2);
    const monthOverMonth = latest && previous && previous.count > 0 ? Math.round(((latest.count - previous.count) / previous.count) * 100) : null;
    const yearly = data.years;
    const latestYear = yearly.at(-1);
    const previousYear = yearly.at(-2);
    const yearOverYear = latestYear && previousYear && previousYear.count > 0 ? Math.round(((latestYear.count - previousYear.count) / previousYear.count) * 100) : null;
    return {
      defenseRate: pct(t.defended, t.registered),
      defenseToCompletion: pct(t.completed, t.defended),
      completionToPublication: pct(t.published, t.completed),
      inProgressRate: pct(t.inProgress, t.registered),
      monthlyCv: d && d.monthlyMean > 0 ? Math.round((d.monthlyStdDev / d.monthlyMean) * 100) : 0,
      peakShare: d ? pct(d.peakMonthCount, Math.max(1, t.defended)) : 0,
      monthOverMonth,
      yearOverYear,
      latestMonth: latest?.label || '—',
      latestYear: latestYear?.label || '—',
    };
  }, [data]);

  return <div id="indicadores-publicos-page" className="mx-auto max-w-none">
    <section className="portal-public-header rounded-t-2xl border border-emerald-900/80 bg-[#005830] px-4 py-3 text-white shadow-sm">
      <div className="flex items-center gap-2"><BarChart3 className="h-5 w-5"/><h1 className="text-base font-black uppercase tracking-tight">Indicadores</h1></div>
    </section>
    <PortalSectionDivider />

    {loading && <div className={panel}>Carregando estatísticas acadêmicas…</div>}
    {error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-900">{error}</div>}

    {data && data.privacy.smallGroupSuppressed && <div className="flex gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-950"><ShieldCheck className="h-4 w-4 shrink-0"/><span>Proteção de grupos pequenos ativa. As distribuições detalhadas permanecem ocultas até o volume mínimo de {data.privacy.minimumGroupSize} TCCs.</span></div>}

    {data && !data.privacy.smallGroupSuppressed && analytics && <div className="space-y-3">
      <section className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {[
          [FileText, 'TCCs cadastrados', data.totals.registered, 'base total registrada'],
          [CheckCircle2, 'Defesas realizadas', data.totals.defended, `${analytics.defenseRate}% dos cadastrados`],
          [TrendingUp, 'TCCs concluídos', data.totals.completed, `${data.totals.completionRate}% dos cadastrados`],
          [BookOpen, 'Publicações', data.totals.published, `${data.totals.publicationRate}% dos cadastrados`],
        ].map(([Icon, label, value, detail]: any) => <article key={label} className={panel}><div className="flex items-start justify-between"><div><div className="text-3xl font-black text-[#337959]">{value}</div><h2 className="mt-1 text-xs font-black uppercase text-slate-950">{label}</h2></div><Icon className="h-5 w-5 text-[#337959]"/></div><p className="mt-2 text-[11px] text-slate-600">{detail}</p></article>)}
      </section>

      <section className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
        {[
          [Gauge, 'Taxa de defesa', `${analytics.defenseRate}%`, 'cadastrado → defendido'],
          [TrendingUp, 'Defesa → conclusão', `${analytics.defenseToCompletion}%`, 'conversão agregada'],
          [BookOpen, 'Conclusão → publicação', `${analytics.completionToPublication}%`, 'conversão agregada'],
          [Clock3, 'Em andamento', `${analytics.inProgressRate}%`, `${data.totals.inProgress} processos`],
          [BarChart3, 'Volatilidade mensal', `${analytics.monthlyCv}%`, 'coeficiente de variação'],
          [CalendarDays, 'Concentração no pico', `${analytics.peakShare}%`, monthLabel(data.descriptive?.peakMonth)],
          [Users2, 'Coautoria', `${data.totals.coauthorRate}%`, 'do acervo'],
          [TrendingUp, 'Último mês', analytics.monthOverMonth === null ? '—' : `${analytics.monthOverMonth >= 0 ? '+' : ''}${analytics.monthOverMonth}%`, analytics.latestMonth],
        ].map(([Icon, label, value, detail]: any) => <article key={label} className="rounded-xl border border-slate-300 bg-white p-3 shadow-sm"><Icon className="h-4 w-4 text-[#337959]"/><strong className="mt-2 block text-xl text-slate-950">{value}</strong><h3 className="text-[9px] font-black uppercase text-slate-800">{label}</h3><p className="mt-1 text-[9px] text-slate-500">{detail}</p></article>)}
      </section>

      <section className="grid gap-3 xl:grid-cols-[1.7fr_1fr]">
        <article className={panel}><h2 className="text-xs font-black uppercase text-slate-950">Defesas por mês — tendência</h2><p className="mb-2 mt-1 text-[10px] text-slate-600">Evolução temporal com todos os períodos agregados disponíveis.</p><LineTrend items={data.months}/></article>
        <article className={panel}><h2 className="text-xs font-black uppercase text-slate-950">Funil agregado</h2><p className="mb-3 mt-1 text-[10px] text-slate-600">Conversão acumulada da base registrada até publicação.</p><Funnel data={data}/></article>
      </section>

      <section className="grid gap-3 xl:grid-cols-2">
        <article className={panel}><h2 className="text-xs font-black uppercase text-slate-950">Evolução anual</h2><p className="mb-3 mt-1 text-[10px] text-slate-600">Comparação do volume entre os anos disponíveis. Variação mais recente: {analytics.yearOverYear === null ? 'não disponível' : `${analytics.yearOverYear >= 0 ? '+' : ''}${analytics.yearOverYear}%`}.</p><BarList items={data.years}/></article>
        <article className={panel}><h2 className="text-xs font-black uppercase text-slate-950">Situação dos processos</h2><p className="mb-3 mt-1 text-[10px] text-slate-600">Distribuição da base por situação registrada.</p><BarList items={data.byStatus} percentage/></article>
      </section>

      {data.descriptive && <section className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {[
          ['Média mensal', num(data.descriptive.monthlyMean)],
          ['Mediana mensal', num(data.descriptive.monthlyMedian)],
          ['Desvio-padrão', num(data.descriptive.monthlyStdDev)],
          ['Mês de pico', `${monthLabel(data.descriptive.peakMonth)} · ${data.descriptive.peakMonthCount}`],
          ['Tempo médio', `${num(data.descriptive.completionDaysMean)} d`],
          ['Tempo mediano', `${num(data.descriptive.completionDaysMedian)} d`],
        ].map(([label, value]) => <article key={label} className="rounded-xl border border-slate-300 bg-[#d5dce0] p-3"><strong className="text-lg text-slate-950">{value}</strong><div className="mt-1 text-[9px] font-black uppercase text-slate-700">{label}</div></article>)}
      </section>}

      <section className="grid gap-3 lg:grid-cols-3">
        <article className={panel}><h2 className="text-xs font-black uppercase">Dia da semana</h2><div className="mt-3"><BarList items={data.weekdays} percentage/></div></article>
        <article className={panel}><h2 className="text-xs font-black uppercase">Faixa de horário</h2><div className="mt-3"><BarList items={data.dayparts} percentage/></div></article>
        <article className={panel}><h2 className="text-xs font-black uppercase">Modalidade</h2><div className="mt-3"><BarList items={data.formats} percentage/></div></article>
      </section>

      <section className="grid gap-3 xl:grid-cols-2">
        <article className={panel}><div className="flex items-center gap-2"><Tags className="h-4 w-4 text-[#337959]"/><h2 className="text-xs font-black uppercase">Temas recorrentes</h2></div><div className="mt-3"><BarList items={data.themes}/></div></article>
        <article className={panel}><div className="flex items-center gap-2"><MapPin className="h-4 w-4 text-[#337959]"/><h2 className="text-xs font-black uppercase">Locais das defesas</h2></div><div className="mt-3"><BarList items={data.locations}/></div></article>
      </section>

      <section className="grid gap-3 xl:grid-cols-2">
        <article className={panel}><h2 className="text-xs font-black uppercase">Tipos de trabalho</h2><div className="mt-3"><BarList items={data.workTypes} percentage/></div></article>
        <article className={panel}><h2 className="text-xs font-black uppercase">Resultados das bancas</h2><div className="mt-3"><BarList items={data.outcomes} percentage/></div></article>
      </section>

      <div className="px-1 pb-2 text-[9px] text-slate-500">Dados agregados; categorias abaixo de {data.privacy.minimumBucketSize} registros são suprimidas. Atualizado em {new Date(data.generatedAt).toLocaleString('pt-BR')}.</div>
    </div>}
  </div>;
};