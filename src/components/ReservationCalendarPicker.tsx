import { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays } from 'lucide-react';
import { apiClient } from '../services/apiClient';
import { DEFENSE_DURATION_MINUTES, defenseIntervalsOverlap, isDefenseWeekday, normalizeDefenseLocation } from '../utils/defenseSchedule';
import { localDateTimeToIso } from '../utils/operationalConfig';
import { buildCalendarMonthGrid, CALENDAR_WEEKDAY_LABELS } from '../utils/calendarMonthGrid';
import { getDefenseCalendarSummaryParts, getDefenseState } from '../utils/defenseSemantics';
import { getPortalToneCssVars } from '../utils/portalSemanticTokens';
import { PortalModalShell } from './PortalModalShell';

const dayFormat = (timezone:string) => new Intl.DateTimeFormat('sv-SE', {timeZone:timezone, year:'numeric', month:'2-digit', day:'2-digit'});
const utcDay = (date:Date) => date.toISOString().slice(0,10);
const minuteMs = 60_000;
const duration = DEFENSE_DURATION_MINUTES * minuteMs;
const clock = (minute:number) => [Math.floor(minute / 60) % 24, minute % 60].map(n=>String(n).padStart(2,'0')).join(':');
const dateLabel = new Intl.DateTimeFormat('pt-BR',{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'});
const monthLabel = new Intl.DateTimeFormat('pt-BR', {month:'long', year:'numeric', timeZone:'UTC'});
type CalendarProcess = Awaited<ReturnType<typeof apiClient.getPublicCalendarData>>['processes'][number];
type Slot = {start:number;end:number;pending:boolean};

export function ReservationCalendarPicker({value, location, timezone, onSelect}: {
  value:string; location:string; timezone:string; onSelect:(value:string)=>void;
}) {
  const [open,setOpen] = useState(false);
  const today = dayFormat(timezone).format(new Date());
  const [day,setDay] = useState(today);
  const [month,setMonth] = useState(today.slice(0,7));
  const [showDay,setShowDay] = useState(false);
  const [time,setTime] = useState('14:00');
  const [attempt,reload] = useState(0);
  const [processes,setProcesses] = useState<CalendarProcess[] | null>(null);
  const [error,setError] = useState(false);
  useEffect(()=>{
    if(!open) return;
    const controller = new AbortController();
    setError(false);
    setProcesses(null);
    apiClient.getPublicCalendarData({signal:controller.signal}).then(({processes})=>{
      if(!controller.signal.aborted) setProcesses(processes);
    }).catch(()=>{if(!controller.signal.aborted)setError(true);});
    return ()=>controller.abort();
  },[open,attempt]);
  const entries = useMemo(() => processes?.flatMap(({defesa}): Slot[] => {
    const start = Date.parse(defesa?.startAt || '');
    if (!Number.isFinite(start) || normalizeDefenseLocation(defesa.local || '') !== normalizeDefenseLocation(location)) return [];
    return [{start,end:start+duration,pending:defesa.localStatus==='PENDENTE'}];
  }), [processes,location]);

  const grabOffset = useRef(0);
  const instant = (date:string, hour:string) => {
    try { return Date.parse(localDateTimeToIso(`${date}T${hour}`,timezone)); }
    catch { return NaN; }
  };
  const dayStart=instant(day,'00:00');
  const visibleSlots=entries?.filter(slot=>defenseIntervalsOverlap(dayStart,dayStart+1440*minuteMs,slot.start,slot.end)) ?? [];
  const start=instant(day,time);
  const clash=entries?.some(slot=>defenseIntervalsOverlap(start,start+duration,slot.start,slot.end));
  const invalid=!Number.isFinite(start)||day<today||!isDefenseWeekday(day);
  const minute = time ? Number(time.slice(0,2))*60+Number(time.slice(3)) : 0;
  const firstDay = new Date(month+'-01T00:00:00Z');
  const {weekdays,days,leading}=buildCalendarMonthGrid(firstDay.getUTCFullYear(),firstDay.getUTCMonth(),[]);
  const changeMonth = (offset:number) => {
    const next = new Date(month+'-01T00:00:00Z');
    next.setUTCMonth(next.getUTCMonth()+offset);
    return utcDay(next).slice(0,7);
  };
  const defensesByDay = useMemo(() => {
    const format = dayFormat(timezone);
    const groups = new Map<string, CalendarProcess[]>();
    for (const proc of processes || []) {
      const start = Date.parse(proc.defesa?.startAt || '');
      if (!Number.isFinite(start)) continue;
      const date = format.format(start);
      const group = groups.get(date) ?? [];
      group.push(proc);
      groups.set(date,group);
    }
    for (const group of groups.values()) {
      group.sort((a,b) => Date.parse(a.defesa.startAt)-Date.parse(b.defesa.startAt));
    }
    return groups;
  }, [processes, timezone]);
  const defensesOn = (date:string) => defensesByDay.get(date) ?? [];
  const formatTime = (timestamp:number) => new Intl.DateTimeFormat('pt-BR',{timeZone:timezone,hour:'2-digit',minute:'2-digit'}).format(timestamp);

  return <div className="sm:col-span-2" onKeyDown={event=>{if(open&&event.key==='Enter'&&event.target instanceof HTMLInputElement)event.preventDefault();}}>
    <button type="button" className="portal-action inline-flex items-center gap-2" disabled={!normalizeDefenseLocation(location)} onClick={()=>{
      const [date,hour]=value.split('T');
      const initial=/^\d{4}-\d{2}-\d{2}$/.test(date)&&date>=today?date:today;
      setDay(initial);setMonth(initial.slice(0,7));setShowDay(false);setTime(/^\d{2}:\d{2}$/.test(hour)?hour:'14:00');
      setProcesses(null);setError(false);setOpen(true);
    }}><CalendarDays size={16} aria-hidden="true"/> Ver calendário de horários</button>
    {!normalizeDefenseLocation(location)&&<p className="mt-1 text-sm">Informe o local para consultar os horários.</p>}
    <PortalModalShell key={showDay?'day':'month'} open={open} onClose={()=>showDay?setShowDay(false):setOpen(false)} title={showDay?`Horários da defesa — ${dateLabel.format(new Date(day+'T00:00:00Z'))}`:'Calendário de Defesas'} icon={CalendarDays} maxWidthClass={showDay?'max-w-3xl':'max-w-5xl'} heightClass="max-h-[90dvh]" className="portal-reservation-calendar-modal" zIndexClass="z-[1000020]" footer={<div className="flex flex-wrap justify-end gap-2">
      <button type="button" className="portal-action" onClick={()=>showDay?setShowDay(false):setOpen(false)}>{showDay?'Voltar ao calendário':'Cancelar'}</button>
      {showDay&&<button type="button" className="portal-action portal-action-primary disabled:opacity-50" disabled={!entries||invalid||clash} onClick={()=>{onSelect(`${day}T${time}`);setOpen(false);}}>Usar data e horário</button>}
    </div>}>
      <p className="mb-4 text-sm"><strong>{location}</strong> · O calendário mostra as reservas do Portal, inclusive as que aguardam confirmação. Agendamentos externos precisam ser consultados com o responsável pelo espaço.</p>
      {error?<div role="alert"><p>Não foi possível consultar os horários.</p><button type="button" className="portal-action mt-2" onClick={()=>reload(n=>n+1)}>Tentar novamente</button></div>:
       !entries?<p role="status">Carregando horários…</p>:
       !showDay?<section className="overflow-hidden rounded-xl border border-slate-200 bg-[var(--portal-surface-page)]" aria-label="Calendário mensal de defesas">
          <div className="portal-modal-header flex flex-wrap items-center justify-between gap-2">
            <strong className="capitalize">{monthLabel.format(firstDay)}</strong>
            <div className="flex flex-wrap gap-2 text-slate-900">
              <button type="button" className="portal-action !bg-white" aria-label="Mês anterior" onClick={()=>setMonth(changeMonth(-1))}>‹</button>
              <button type="button" className="portal-action !bg-white" onClick={()=>setMonth(today.slice(0,7))}>Hoje</button>
              <button type="button" className="portal-action !bg-white" aria-label="Próximo mês" onClick={()=>setMonth(changeMonth(1))}>›</button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <div className="min-w-[700px]">
              <div data-portal-sheet-column-header="true" className="grid grid-cols-5 bg-[var(--portal-primary,#055532)] py-2.5 text-center text-xs font-black text-white">
                {weekdays.map(weekday=><span key={weekday}>{CALENDAR_WEEKDAY_LABELS[weekday]}</span>)}
              </div>
              <div className="grid grid-cols-5 border-l border-t border-slate-200">
                {Array.from({length:leading}, (_, index)=><span key={index} aria-hidden="true" className="portal-calendar-empty-cell border-b border-r border-slate-200"/>)}
                {days.map(dayNumber=>{const date=month+'-'+String(dayNumber).padStart(2,'0');return <button key={date} type="button" aria-label={dateLabel.format(new Date(date+'T00:00:00Z'))} className="portal-calendar-day-cell !rounded-none min-h-14 min-w-0 border-b border-r border-slate-200 p-1.5 text-left align-top text-[11px] flex flex-col" onClick={()=>{setDay(date);setShowDay(true);}}>
                  <span className={`portal-calendar-day-number self-start rounded px-2 py-0.5 font-black ${date===today?'bg-slate-800 text-white':'text-slate-700'}`}>{Number(date.slice(8))}</span>
                  {defensesOn(date).slice(0,2).map(proc=>{
                    const state=getDefenseState(proc);
                    const summary=getDefenseCalendarSummaryParts(proc);
                    const pending=proc.defesa.localStatus==='PENDENTE';
                    return <span key={proc.id} className="portal-calendar-defense-summary portal-semantic-tone mt-1 w-full" style={getPortalToneCssVars(state)} data-defense-state={state} data-reservation-status={pending?'pending':undefined}>
                      <span className="portal-calendar-defense-primary line-clamp-2 !text-[10px]">{formatTime(Date.parse(proc.defesa.startAt))}{pending?' (aguardando confirmação)':''} · {summary.title}</span>
                      <span className="portal-calendar-defense-secondary truncate !text-[10px] font-semibold">{summary.location}</span>
                    </span>;
                  })}
                  {defensesOn(date).length>2&&<span className="mt-1 font-semibold">+{defensesOn(date).length-2} no dia</span>}
                </button>;})}
              </div>
            </div>
          </div>
          <p className="p-3 text-sm">Selecione um dia para ver as defesas e escolher o horário.</p>
        </section>:
        <section className="portal-card min-w-0 p-3" aria-label="Horários do dia">
          <h3 className="font-bold">Faixa de horários do local</h3>
          <p className="my-2 text-sm">Arraste o bloco de 1h30 na linha do tempo ou informe a hora ao minuto.</p>
          <label className="block text-sm">Início da defesa <input type="time" step={60} className="portal-input mt-1 block !w-32" value={time} onChange={event=>setTime(event.target.value)}/></label>
          <div className="relative mt-4 h-12 touch-none overflow-hidden rounded border border-slate-300 bg-white"
            onPointerDown={event=>{if(event.button!==0)return;event.currentTarget.setPointerCapture(event.pointerId); const rect=event.currentTarget.getBoundingClientRect();const point=Math.round((event.clientX-rect.left)/rect.width*1440);grabOffset.current=time&&point>=minute&&point<minute+DEFENSE_DURATION_MINUTES?point-minute:0;setTime(clock(Math.max(0,Math.min(1439,point-grabOffset.current))));}}
            onPointerMove={event=>{if(!event.currentTarget.hasPointerCapture(event.pointerId))return;const rect=event.currentTarget.getBoundingClientRect();setTime(clock(Math.max(0,Math.min(1439,Math.round((event.clientX-rect.left)/rect.width*1440)-grabOffset.current))));}} aria-hidden="true">
            {visibleSlots.map((slot,index)=><span key={index} className="pointer-events-none absolute inset-y-0 bg-amber-300" style={{left:`${Math.max(0,slot.start-dayStart)/(1440*minuteMs)*100}%`,width:`${(Math.min(dayStart+1440*minuteMs,slot.end)-Math.max(dayStart,slot.start))/(1440*minuteMs)*100}%`}}/>)}
            {time&&<span className={`pointer-events-none absolute inset-y-1 rounded border-2 ${clash?'border-red-800 bg-red-600/70':'border-emerald-900 bg-emerald-600/70'}`} style={{left:`${minute/1440*100}%`,width:`${DEFENSE_DURATION_MINUTES/1440*100}%`}}/>}
          </div>
          <div className="flex justify-between text-xs" aria-hidden="true"><span>00h</span><span>06h</span><span>12h</span><span>18h</span><span>24h</span></div>
          <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs" aria-label="Legenda da faixa de horários">
            <li className="flex items-center gap-1.5"><span aria-hidden="true" className="size-3 rounded-sm bg-emerald-600/70"/>Seu horário (arraste o bloco)</li>
            <li className="flex items-center gap-1.5"><span aria-hidden="true" className="size-3 rounded-sm bg-amber-300"/>Outras defesas no mesmo local</li>
            <li className="flex items-center gap-1.5"><span aria-hidden="true" className="size-3 rounded-sm bg-red-600/70"/>Seu horário em conflito</li>
          </ul>
          <p className={`mt-3 text-sm font-semibold ${clash?'text-red-800':''}`} role="status">{time&&(invalid?(day<today?'Esta data já passou.':'Horário inválido.'):`${time}–${clock(minute+DEFENSE_DURATION_MINUTES)}${minute+DEFENSE_DURATION_MINUTES>=1440?' (dia seguinte)':''} · ${clash?'Horário ocupado':'Sem conflito no calendário do local'}`)}</p>
          {visibleSlots.length>0&&<ul className="mt-2 space-y-1 text-xs">{visibleSlots.map((slot,index)=>{
            const format=(timestamp:number)=>new Intl.DateTimeFormat('pt-BR',{timeZone:timezone,hour:'2-digit',minute:'2-digit'}).format(timestamp);
            return <li key={index}>{format(slot.start)}–{format(slot.end)} · {slot.pending?'Aguardando confirmação':'Ocupado'}</li>;
          })}</ul>}
          <h3 className="mt-4 font-bold">Defesas do dia</h3>
          {defensesOn(day).length ? <ul className="mt-2 space-y-2 text-sm">{defensesOn(day).map(proc=><li key={proc.id}>
            <strong>{formatTime(Date.parse(proc.defesa.startAt))} · {getDefenseCalendarSummaryParts(proc).title}</strong>
            <span className="block">{proc.defesa.local}{proc.defesa.localStatus==='PENDENTE'?' · Aguardando confirmação':''}</span>
          </li>)}</ul> : <p className="mt-1 text-sm">Nenhuma defesa registrada para este dia.</p>}
        </section>}
    </PortalModalShell>
  </div>;
}
