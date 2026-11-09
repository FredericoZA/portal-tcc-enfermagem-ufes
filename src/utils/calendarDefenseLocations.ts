import type {GoogleCalendarSyncedEvent, ProcessData} from '../types';
import {calendarEventMatchesProcess, isDefenseOnCalendar} from './defenseReservationState';
import {formatStudentsString} from './formatters';
import {MANAGED_DEFENSE_LOCATIONS, CUSTOM_DEFENSE_LOCATION} from './reservationLocation';

type CalendarProcess = Pick<ProcessData, 'id' | 'protocolo' | 'defesa'> & Partial<Pick<ProcessData,'titulo'|'aluno1'|'aluno2'>>;
type CalendarEvent = Pick<GoogleCalendarSyncedEvent, 'id' | 'start'> & Partial<Pick<GoogleCalendarSyncedEvent,'portalTccProtocol'|'summary'|'description'|'location'>>;
export type CalendarLocationOption = {key: string; label: string};
/** null means all, including a location added by a later live update; [] explicitly selects none. */
export type CalendarLocationSelection = readonly string[] | null;
const cleanLocation = (value: unknown): string => String(value || '').replace(/\*([^*]+)\*/g, '$1').replace(/\s+/g, ' ').trim();
export function calendarLocationKey(value: unknown): string {
  const label=cleanLocation(value);
  return label ? `place:${label.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR')}` : 'missing-location';
}
export function calendarGoogleEventLocation(event: Pick<CalendarEvent,'location'|'description'>): string {
  return cleanLocation(event.description?.match(/^Local:\s*([^\r\n]+)/im)?.[1] || event.location);
}
export function matchesCalendarLocation(location: unknown, selected: CalendarLocationSelection): boolean {
  return selected === null || selected.includes(calendarLocationKey(location));
}

/** Stable IDs own the schedule globally; legacy textual matches only apply to eligible defenses on the same day. */
export function calendarGoogleEventDuplicatesDefense(event: CalendarEvent, processes: readonly CalendarProcess[]): boolean {
  if(processes.some(process=>calendarEventMatchesProcess(event,process)))return true;
  if(!Number.isFinite(Date.parse(event.start)))return false;
  const day=new Date(event.start).toDateString();
  return processes.some(process=>{
    if(!isDefenseOnCalendar(process)||new Date(process.defesa.startAt).toDateString()!==day)return false;
    const student=process.aluno1?.nome||process.aluno2?.nome
      ? formatStudentsString(process.aluno1||{nome:''},process.aluno2).toLowerCase() : '';
    const title=(process.titulo||'').toLowerCase(),summary=(event.summary||'').toLowerCase(),description=(event.description||'').toLowerCase();
    return Boolean((student&&summary.includes(student)) || (title&&(summary.includes(title)||description.includes(title))));
  });
}
export function calendarStandaloneGoogleEvents<T extends CalendarEvent>(processes: readonly CalendarProcess[], events: readonly T[]): T[] {
  return events.filter(event=>!calendarGoogleEventDuplicatesDefense(event,processes));
}

/** Public display choices only; do not infer locations from titles, names, files or private settings. */
export function calendarDefenseLocationOptions(
  processes: readonly CalendarProcess[], events: readonly CalendarEvent[], managed: readonly string[] = MANAGED_DEFENSE_LOCATIONS,
): CalendarLocationOption[] {
  const locations=new Map<string,string>();
  const add=(value:unknown)=>{
    if(value===CUSTOM_DEFENSE_LOCATION)return;
    const label=cleanLocation(value),key=calendarLocationKey(label);
    if(!locations.has(key))locations.set(key,label||'Sem local informado');
  };
  managed.filter(Boolean).forEach(add);
  processes.filter(isDefenseOnCalendar).forEach(process=>add(process.defesa.local));
  calendarStandaloneGoogleEvents(processes,events).filter(event=>Number.isFinite(Date.parse(event.start)))
    .forEach(event=>add(calendarGoogleEventLocation(event)));
  return [...locations].map(([key,label])=>({key,label})).sort((a,b)=>a.label.localeCompare(b.label,'pt-BR',{numeric:true,sensitivity:'base'}));
}
export function toggleCalendarLocation(selected: CalendarLocationSelection, key: string, options: readonly CalendarLocationOption[]): string[] | null {
  const keys=selected===null ? options.map(option=>option.key) : [...selected];
  const next=keys.includes(key) ? keys.filter(value=>value!==key) : [...keys,key];
  return options.length>0 && options.every(option=>next.includes(option.key)) ? null : next;
}
