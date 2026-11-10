import { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays } from 'lucide-react';
import { apiClient } from '../services/apiClient';
import { DEFENSE_DURATION_MINUTES, defenseIntervalsOverlap, normalizeDefenseLocation } from '../utils/defenseSchedule';
import { localDateTimeToIso } from '../utils/operationalConfig';
import { PortalModalShell } from './PortalModalShell';

const dayFormat = (timezone:string) => new Intl.DateTimeFormat('sv-SE', {timeZone:timezone, year:'numeric', month:'2-digit', day:'2-digit'});
const utcDay = (date:Date) => date.toISOString().slice(0,10);
const minuteMs = 60_000;
const duration = DEFENSE_DURATION_MINUTES * minuteMs;
const clock = (minute:number) => [Math.floor(minute / 60) % 24, minute % 60].map(n=>String(n).padStart(2,'0')).join(':');
const monthLabel = new Intl.DateTimeFormat('pt-BR',{month:'long',year:'numeric',timeZone:'UTC'});
type Slot = {start:number;end:number;pending:boolean};

export function ReservationCalendarPicker({value, location, timezone, onSelect}: {
  value:string; location:string; timezone:string; onSelect:(value:string)=>void;
}) {
  const [open,setOpen] = useState(false);
  const today = dayFormat(timezone).format(new Date());
  const [day,setDay] = useState(today);
  const [month,setMonth] = useState(today.slice(0,7));
  const [time,setTime] = useState('14:00');
  const [attempt,reload] = useState(0);
  const [entries,setEntries] = useState<Slot[] | null>(null);
  const [error,setError] = useState(false);
  useEffect(()=>{
    if(!open) return;
    const controller = new AbortController();
    setError(false);
    setEntries(null);
    apiClient.getPublicCalendarData({signal:controller.signal}).then(({processes})=>{
      if(controller.signal.aborted) return;
      const locationKey = normalizeDefenseLocation(location);
      setEntries(processes.flatMap(({defesa})=>{
        if(normalizeDefenseLocation(defesa.local || '')!==locationKey) return [];
        const start=Date.parse(defesa.startAt);
        return Number.isFinite(start) ? [{start,end:start+duration,pending:defesa.localStatus==='PENDENTE'}] : [];
      }));
    }).catch(()=>{if(!controller.signal.aborted)setError(true);});
    return ()=>controller.abort();
  },[open,location,attempt]);

  const grabOffset = useRef(0);
  const instant = (date:string, hour:string) => {
    try { return Date.parse(localDateTimeToIso(`${date}T${hour}`,timezone)); }
    catch { return NaN; }
  };
  const dayStart=instant(day,'00:00');
  const visibleSlots=entries?.filter(slot=>defenseIntervalsOverlap(dayStart,dayStart+1440*minuteMs,slot.start,slot.end)) ?? [];
  const start=instant(day,time);
  const clash=entries?.some(slot=>defenseIntervalsOverlap(start,start+duration,slot.start,slot.end));
  const invalid=!Number.isFinite(start)||day<today;
  const minute = time ? Number(time.slice(0,2))*60+Number(time.slice(3)) : 0;
  const dayCells=useMemo(()=>{
    const first = new Date(`${month}-01T00:00:00Z`);
    const offset=(first.getUTCDay()+6)%7;
    const size=new Date(Date.UTC(first.getUTCFullYear(),first.getUTCMonth()+1,0)).getUTCDate();
    return Array.from({length:offset+size},(_,index)=>index<offset?null:utcDay(new Date(Date.UTC(first.getUTCFullYear(),first.getUTCMonth(),index-offset+1))));
  },[month]);
  const changeMonth=(delta:number)=>{
    const current=new Date(`${month}-01T00:00:00Z`);
    current.setUTCMonth(current.getUTCMonth()+delta);
    setMonth(utcDay(current).slice(0,7));
  };

  return <div className="sm:col-span-2" onKeyDown={event=>{if(open&&event.key==='Enter'&&event.target instanceof HTMLInputElement)event.preventDefault();}}>
    <button type="button" className="portal-action inline-flex items-center gap-2" disabled={!normalizeDefenseLocation(location)} onClick={()=>{
      const [date,hour]=value.split('T');
      const initial=/^\d{4}-\d{2}-\d{2}$/.test(date)&&date>=today?date:today;
      setDay(initial);setMonth(initial.slice(0,7));setTime(/^\d{2}:\d{2}$/.test(hour)?hour:'14:00');
      setEntries(null);setError(false);setOpen(true);
    }}><CalendarDays size={16} aria-hidden="true"/> Ver calendário de horários</button>
    {!normalizeDefenseLocation(location)&&<p className="mt-1 text-sm">Informe o local para consultar os horários.</p>}
    <PortalModalShell open={open} onClose={()=>setOpen(false)} title="Disponibilidade para a defesa" icon={CalendarDays} maxWidthClass="max-w-5xl" heightClass="max-h-[90dvh]" zIndexClass="z-[1000020]" footer={<div className="flex flex-wrap justify-end gap-2">
      <button type="button" className="portal-action" onClick={()=>setOpen(false)}>Cancelar</button>
      <button type="button" className="portal-action portal-action-primary" disabled={!entries||invalid||clash} onClick={()=>{onSelect(`${day}T${time}`);setOpen(false);}}>Usar data e horário</button>
    </div>}>
      <p className="mb-4 text-sm"><strong>{location}</strong> · O calendário mostra as reservas do Portal, inclusive as que aguardam confirmação. Agendamentos externos precisam ser consultados com o responsável pelo espaço.</p>
      {error?<div role="alert"><p>Não foi possível consultar os horários.</p><button type="button" className="portal-action mt-2" onClick={()=>reload(n=>n+1)}>Tentar novamente</button></div>:
       !entries?<p role="status">Carregando horários…</p>:
       <div className="grid gap-4 md:grid-cols-2">
        <section className="portal-card p-3" aria-label="Dias do mês">
          <div className="mb-3 flex items-center justify-between gap-2">
            <button type="button" className="portal-action" aria-label="Mês anterior" disabled={month<=today.slice(0,7)} onClick={()=>changeMonth(-1)}>‹</button>
            <strong className="capitalize">{monthLabel.format(new Date(`${month}-01T00:00:00Z`))}</strong>
            <button type="button" className="portal-action" aria-label="Próximo mês" onClick={()=>changeMonth(1)}>›</button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-sm">
            {['Seg','Ter','Qua','Qui','Sex','Sáb','Dom'].map(label=><span key={label}>{label}</span>)}
            {dayCells.map((date,index)=>{
              if(!date)return <span key={index}/>;
              const dateStart=instant(date,'00:00');
              const busy=entries.some(slot=>defenseIntervalsOverlap(dateStart,dateStart+1440*minuteMs,slot.start,slot.end));
              return <button key={date} type="button" disabled={date<today} aria-pressed={date===day} aria-label={`${date.split('-').reverse().join('/')}, ${busy?'com reservas':'sem reservas'}`} className={`min-h-9 rounded border text-sm disabled:opacity-40 ${date===day?'border-current ring-2 ring-current':busy?'border-amber-300 bg-amber-50 text-amber-950':'border-slate-300 bg-white'}`} onClick={()=>setDay(date)}>{Number(date.slice(8))}{busy&&<span aria-hidden="true"> •</span>}</button>;
            })}
          </div>
          <p className="mt-3 text-xs">• Dia com reserva. Selecione o dia para ver os intervalos.</p>
        </section>
        <section className="portal-card min-w-0 p-3" aria-label="Horários do dia">
          <h3 className="font-bold">{day.split('-').reverse().join('/')}</h3>
          <p className="my-2 text-sm">Arraste o bloco de 1h30 na linha do tempo ou informe a hora ao minuto.</p>
          <label className="block text-sm">Início da defesa <input type="time" step={60} className="portal-input mt-1" value={time} onChange={event=>setTime(event.target.value)}/></label>
          <div className="relative mt-4 h-12 touch-none overflow-hidden rounded border border-slate-300 bg-white"
            onPointerDown={event=>{if(event.button!==0)return;event.currentTarget.setPointerCapture(event.pointerId); const rect=event.currentTarget.getBoundingClientRect();const point=Math.round((event.clientX-rect.left)/rect.width*1440);grabOffset.current=time&&point>=minute&&point<minute+DEFENSE_DURATION_MINUTES?point-minute:0;setTime(clock(Math.max(0,Math.min(1439,point-grabOffset.current))));}}
            onPointerMove={event=>{if(!event.currentTarget.hasPointerCapture(event.pointerId))return;const rect=event.currentTarget.getBoundingClientRect();setTime(clock(Math.max(0,Math.min(1439,Math.round((event.clientX-rect.left)/rect.width*1440)-grabOffset.current))));}} aria-hidden="true">
            {visibleSlots.map((slot,index)=><span key={index} className="pointer-events-none absolute inset-y-0 bg-amber-300" style={{left:`${Math.max(0,slot.start-dayStart)/(1440*minuteMs)*100}%`,width:`${(Math.min(dayStart+1440*minuteMs,slot.end)-Math.max(dayStart,slot.start))/(1440*minuteMs)*100}%`}}/>)}
            {time&&<span className={`pointer-events-none absolute inset-y-1 rounded border-2 ${clash?'border-red-800 bg-red-600/70':'border-emerald-900 bg-emerald-600/70'}`} style={{left:`${minute/1440*100}%`,width:`${DEFENSE_DURATION_MINUTES/1440*100}%`}}/>}
          </div>
          <div className="flex justify-between text-xs" aria-hidden="true"><span>00h</span><span>06h</span><span>12h</span><span>18h</span><span>24h</span></div>
          <p className={`mt-3 text-sm font-semibold ${clash?'text-red-800':''}`} role="status">{time&&(invalid?'Horário inválido.':`${time}–${clock(minute+DEFENSE_DURATION_MINUTES)}${minute+DEFENSE_DURATION_MINUTES>=1440?' (dia seguinte)':''} · ${clash?'Horário ocupado':'Sem conflito no calendário do local'}`)}</p>
          {visibleSlots.length>0&&<ul className="mt-2 space-y-1 text-xs">{visibleSlots.map((slot,index)=>{
            const format=(timestamp:number)=>new Intl.DateTimeFormat('pt-BR',{timeZone:timezone,hour:'2-digit',minute:'2-digit'}).format(timestamp);
            return <li key={index}>{format(slot.start)}–{format(slot.end)} · {slot.pending?'Aguardando confirmação':'Ocupado'}</li>;
          })}</ul>}
        </section>
       </div>}
    </PortalModalShell>
  </div>;
}
