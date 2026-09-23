import React, { useEffect, useMemo, useState } from 'react';
import { Activity, BarChart3, BookOpen, CalendarDays, CheckCircle2, Clock3, FileText, MapPin, ShieldCheck, Tags, TrendingUp, Users2 } from 'lucide-react';

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

const PANEL = 'h-full rounded-2xl border border-slate-300 bg-[#f0f0f0] p-4 shadow-sm';
const EMPTY = 'rounded-xl border border-dashed border-slate-300 bg-white px-4 py-8 text-center text-xs text-slate-500';
const DONUT_COLORS = ['#005830', '#337959', '#789684', '#aeb8b1', '#6b7280', '#9ca3af', '#cbd5e1'];

const Bars: React.FC<{ items: Bucket[]; empty: string; percent?: boolean }> = ({ items, empty, percent = false }) => {
  const max = Math.max(1, ...items.map((item) => item.count));
  const total = items.reduce((sum, item) => sum + item.count, 0);
  if (!items.length) return <div className={EMPTY}>{empty}</div>;
  return (
    <div className="space-y-2.5">
      {items.map((item) => (
        <div key={`${item.key || item.label}-${item.label}`} className="grid grid-cols-[minmax(92px,160px)_1fr_58px] items-center gap-2 text-[11px]">
          <span className="truncate font-bold text-slate-700" title={item.label}>{item.label}</span>
          <div className="h-5 overflow-hidden rounded-md border border-slate-200 bg-white">
            <div className="h-full rounded-md bg-[#337959]" style={{ width: `${Math.max(4, (item.count / max) * 100)}%` }} />
          </div>
          <span className="text-right font-black text-slate-900">{percent && total ? `${Math.round((item.count / total) * 100)}%` : item.count}</span>
        </div>
      ))}
    </div>
  );
};

const Donut: React.FC<{ items: Bucket[]; empty: string }> = ({ items, empty }) => {
  const total = items.reduce((sum, item) => sum + item.count, 0);
  if (!items.length || !total) return <div className={EMPTY}>{empty}</div>;
  let cursor = 0;
  const segments = items.map((item, index) => {
    const start = cursor;
    const end = cursor + (item.count / total) * 100;
    cursor = end;
    return `${DONUT_COLORS[index % DONUT_COLORS.length]} ${start}% ${end}%`;
  });
  return (
    <div className="grid items-center gap-4 sm:grid-cols-[150px_1fr]">
      <div className="relative mx-auto h-36 w-36 rounded-full" style={{ background: `conic-gradient(${segments.join(',')})` }} aria-label={`Gráfico circular com ${total} registros`}>
        <div className="absolute inset-[28%] flex items-center justify-center rounded-full border border-slate-200 bg-white">
          <span className="text-xl font-black text-slate-900">{total}</span>
        </div>
      </div>
      <div className="space-y-1.5">
        {items.map((item, index) => (
          <div key={`${item.key || item.label}-${item.label}`} className="flex items-center justify-between gap-3 text-[11px]">
            <span className="flex min-w-0 items-center gap-2 font-semibold text-slate-700">
              <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: DONUT_COLORS[index % DONUT_COLORS.length] }} />
              <span className="truncate" title={item.label}>{item.label}</span>
            </span>
            <strong className="shrink-0 text-slate-900">{item.count} · {Math.round((item.count / total) * 100)}%</strong>
          </div>
        ))}
      </div>
    </div>
  );
};

const formatMonth = (value: string | null) => {
  if (!value) return '—';
  const [year, month] = value.split('-');
  const date = new Date(Number(year), Number(month) - 1, 1);
  return new Intl.DateTimeFormat('pt-BR', { month: 'short', year: 'numeric' }).format(date).replace('.', '');
};

const formatGeneratedAt = (value: string) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(parsed);
};

export const IndicadoresPage: React.FC = () => {
  const [data, setData] = useState<PublicIndicators | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const response = await fetch('/api/public/indicators', { headers: { Accept: 'application/json' } });
        if (!response.ok) throw new Error('Não foi possível carregar os indicadores.');
        const payload = await response.json();
        if (active) setData(payload);
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : 'Indicadores indisponíveis.');
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => { active = false; };
  }, []);

  const cards = useMemo(() => {
    if (!data) return [];
    if (data.privacy.smallGroupSuppressed) {
      return [{ label: 'TCCs cadastrados', value: data.totals.registered, detail: 'total geral disponível; demais distribuições estão protegidas por regra de grupo mínimo', icon: FileText }];
    }
    return [
      { label: 'TCCs cadastrados', value: data.totals.registered, detail: 'processos acadêmicos registrados no Portal', icon: FileText },
      { label: 'Defesas realizadas', value: data.totals.defended, detail: `${data.totals.registered ? Math.round((data.totals.defended / data.totals.registered) * 100) : 0}% dos TCCs cadastrados`, icon: CheckCircle2 },
      { label: 'TCCs concluídos', value: data.totals.completed, detail: `${data.totals.completionRate}% do total cadastrado`, icon: TrendingUp },
      { label: 'Publicações', value: data.totals.published, detail: `${data.totals.publicationRate}% do total cadastrado`, icon: BookOpen },
    ];
  }, [data]);

  const hasData = Boolean(data && data.totals.registered > 0);

  return (
    <div id="indicadores-publicos-page" className="mx-auto max-w-none space-y-3 py-1">
      <section className="portal-public-header rounded-t-2xl border border-emerald-900/80 bg-[#005830] px-4 py-3 text-white shadow-sm">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-white" />
          <h1 className="text-sm font-black uppercase tracking-tight sm:text-base">Indicadores</h1>
        </div>
      </section>

      {error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-semibold text-rose-800">{error}</div>}
      {loading && !data && <div className="rounded-2xl border border-slate-300 bg-[#f0f0f0] p-10 text-center text-xs font-bold text-slate-500">Carregando estatísticas acadêmicas…</div>}

      {data && !hasData && (
        <section className="portal-layer-card rounded-2xl border border-slate-300 bg-[#d5dce0] p-5 shadow-sm">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white"><BarChart3 className="h-5 w-5 text-[#337959]" /></span>
            <div>
              <h2 className="text-sm font-black text-slate-900">Indicadores aguardando os primeiros dados</h2>
              <p className="mt-1 max-w-4xl text-xs leading-5 text-slate-600">Os gráficos serão preenchidos automaticamente conforme os TCCs forem cadastrados, defendidos, concluídos e publicados.</p>
            </div>
          </div>
        </section>
      )}

      {data && hasData && (
        <>
          {data.privacy.smallGroupSuppressed && (
            <div className="flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2.5 text-[11px] leading-4 text-amber-950">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
              <div><strong>Proteção de grupos pequenos ativa.</strong> O Portal mantém apenas o total geral enquanto houver menos de {data.privacy.minimumGroupSize} TCCs. Distribuições detalhadas ficam ocultas para reduzir risco de identificação indireta.</div>
            </div>
          )}

          <section className={`grid gap-2 ${data.privacy.smallGroupSuppressed ? 'sm:grid-cols-1' : 'sm:grid-cols-2 xl:grid-cols-4'}`}>
            {cards.map(({ label, value, detail, icon: Icon }) => (
              <article key={label} className="h-full rounded-2xl border border-slate-300 bg-[#d5dce0] p-4 shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-3xl font-black text-[#337959]">{value}</div>
                    <h2 className="mt-1 text-xs font-black uppercase tracking-wide text-slate-900">{label}</h2>
                  </div>
                  <span className="rounded-lg border border-slate-200 bg-white p-2"><Icon className="h-4 w-4 text-[#337959]" /></span>
                </div>
                <p className="mt-2 text-[11px] leading-4 text-slate-600">{detail}</p>
              </article>
            ))}
          </section>

          {!data.privacy.smallGroupSuppressed && data.descriptive && (
            <>
              <section className="grid auto-rows-fr gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
                {[
                  { label: 'Média por mês', value: data.descriptive.monthlyMean, detail: `${data.descriptive.observedMonths} meses observados`, icon: Activity },
                  { label: 'Mediana mensal', value: data.descriptive.monthlyMedian, detail: 'valor central da série mensal', icon: BarChart3 },
                  { label: 'Variação mensal', value: data.descriptive.monthlyStdDev, detail: 'desvio-padrão do volume mensal', icon: TrendingUp },
                  { label: 'Mês de pico', value: data.descriptive.peakMonthCount, detail: formatMonth(data.descriptive.peakMonth), icon: CalendarDays },
                  { label: 'Tempo médio', value: `${data.descriptive.completionDaysMean} d`, detail: `mediana de ${data.descriptive.completionDaysMedian} dias`, icon: Clock3 },
                  { label: 'Com coautoria', value: `${data.totals.coauthorRate}%`, detail: 'proporção de TCCs com dois autores', icon: Users2 },
                ].map(({ label, value, detail, icon: Icon }) => (
                  <article key={label} className="h-full rounded-xl border border-slate-300 bg-white p-3 shadow-sm">
                    <div className="flex items-center justify-between gap-2"><Icon className="h-4 w-4 text-[#337959]" /><strong className="text-lg text-slate-900">{value}</strong></div>
                    <h3 className="mt-2 text-[10px] font-black uppercase text-slate-800">{label}</h3>
                    <p className="mt-0.5 text-[9.5px] text-slate-500">{detail}</p>
                  </article>
                ))}
              </section>

              <section className="grid items-stretch gap-3 xl:grid-cols-2">
                <article className={PANEL}>
                  <h2 className="text-xs font-black uppercase tracking-wide text-slate-900">Situação dos processos</h2>
                  <p className="mb-3 mt-1 text-[11px] text-slate-500">Distribuição dos TCCs pelas situações atualmente registradas.</p>
                  <Donut items={data.byStatus} empty="Ainda não há categorias com volume suficiente." />
                </article>
                <article className={PANEL}>
                  <h2 className="text-xs font-black uppercase tracking-wide text-slate-900">Tipos de trabalho</h2>
                  <p className="mb-3 mt-1 text-[11px] text-slate-500">Composição dos trabalhos por tipo acadêmico cadastrado.</p>
                  <Donut items={data.workTypes} empty="Tipos ainda sem volume suficiente." />
                </article>
              </section>

              <section className="grid items-stretch gap-3 lg:grid-cols-2">
                <article className={PANEL}>
                  <h2 className="text-xs font-black uppercase tracking-wide text-slate-900">TCCs por ano</h2>
                  <p className="mb-3 mt-1 text-[11px] text-slate-500">Evolução do volume de trabalhos ao longo dos anos disponíveis.</p>
                  <Bars items={data.years} empty="Ainda não há anos com volume suficiente para compor o gráfico." />
                </article>
                <article className={PANEL}>
                  <h2 className="text-xs font-black uppercase tracking-wide text-slate-900">Defesas por mês</h2>
                  <p className="mb-3 mt-1 text-[11px] text-slate-500">Distribuição temporal das defesas cadastradas.</p>
                  <Bars items={data.months} empty="Ainda não há meses com volume suficiente para exibição." />
                </article>
              </section>

              <section className="grid items-stretch gap-3 lg:grid-cols-3">
                <article className={PANEL}>
                  <h2 className="text-xs font-black uppercase text-slate-900">Dia da semana</h2>
                  <p className="mb-3 mt-1 text-[10px] text-slate-500">Concentração das bancas pelos dias úteis.</p>
                  <Bars items={data.weekdays} empty="Dias ainda sem volume suficiente." percent />
                </article>
                <article className={PANEL}>
                  <h2 className="text-xs font-black uppercase text-slate-900">Faixa de horário</h2>
                  <p className="mb-3 mt-1 text-[10px] text-slate-500">Distribuição das apresentações entre manhã, tarde e noite.</p>
                  <Donut items={data.dayparts} empty="Horários ainda sem volume suficiente." />
                </article>
                <article className={PANEL}>
                  <h2 className="text-xs font-black uppercase text-slate-900">Modalidade da defesa</h2>
                  <p className="mb-3 mt-1 text-[10px] text-slate-500">Formatos de apresentação registrados no Portal.</p>
                  <Donut items={data.formats} empty="Modalidades ainda sem volume suficiente." />
                </article>
              </section>

              <section className="grid items-stretch gap-3 xl:grid-cols-2">
                <article className={PANEL}>
                  <div className="flex items-center gap-2"><Tags className="h-4 w-4 text-[#337959]" /><h2 className="text-xs font-black uppercase tracking-wide text-slate-900">Temas mais recorrentes</h2></div>
                  <p className="mb-3 mt-1 text-[11px] text-slate-500">Palavras-chave com volume suficiente para divulgação agregada.</p>
                  <Bars items={data.themes} empty="Ainda não há temas com volume suficiente para exibição." />
                </article>
                <article className={PANEL}>
                  <div className="flex items-center gap-2"><MapPin className="h-4 w-4 text-[#337959]" /><h2 className="text-xs font-black uppercase tracking-wide text-slate-900">Locais das defesas</h2></div>
                  <p className="mb-3 mt-1 text-[11px] text-slate-500">Distribuição dos espaços utilizados nas apresentações.</p>
                  <Bars items={data.locations} empty="Ainda não há locais com volume suficiente para exibição." />
                </article>
              </section>

              <section className="grid items-stretch gap-3 xl:grid-cols-2">
                <article className={PANEL}>
                  <h2 className="text-xs font-black uppercase tracking-wide text-slate-900">Resultados das bancas</h2>
                  <p className="mb-3 mt-1 text-[11px] text-slate-500">Resultados agregados quando há volume mínimo para apresentação pública.</p>
                  <Donut items={data.outcomes} empty="Resultados ainda sem volume suficiente." />
                </article>
                <article className={PANEL}>
                  <h2 className="text-xs font-black uppercase tracking-wide text-slate-900">Leitura do acervo</h2>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <div className="rounded-xl border border-slate-300 bg-white p-3"><div className="text-2xl font-black text-[#337959]">{data.totals.inProgress}</div><div className="mt-1 text-[10px] font-black uppercase text-slate-800">Em andamento</div><p className="mt-1 text-[10px] leading-4 text-slate-500">Processos que ainda não atingiram o estado final de conclusão.</p></div>
                    <div className="rounded-xl border border-slate-300 bg-white p-3"><div className="text-2xl font-black text-[#337959]">{data.totals.publicationRate}%</div><div className="mt-1 text-[10px] font-black uppercase text-slate-800">Taxa de publicação</div><p className="mt-1 text-[10px] leading-4 text-slate-500">Relação entre publicações disponíveis e TCCs cadastrados.</p></div>
                  </div>
                </article>
              </section>
            </>
          )}

          <div className="px-1 text-[9px] leading-4 text-slate-500">
            Dados agregados, sem exibição de e-mails, matrículas ou documentos privados. Categorias com menos de {data.privacy.minimumBucketSize} registros são suprimidas. {data.generatedAt ? `Atualizado em ${formatGeneratedAt(data.generatedAt)}.` : ''}
          </div>
        </>
      )}
    </div>
  );
};
