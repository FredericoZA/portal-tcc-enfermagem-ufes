/** Every defense reserves exactly 1h30 in the agenda, independently of document dates. */
export const DEFENSE_DURATION_MINUTES = 90;
export function defenseEndAt(startAt:string):string {
  return new Date(Date.parse(startAt)+DEFENSE_DURATION_MINUTES*60_000).toISOString();
}

export const normalizeDefenseLocation=(value:string)=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();

export function defenseIntervalsOverlap(start:number,end:number,otherStart:number,otherEnd:number):boolean {
  return start < otherEnd && otherStart < end;
}

export const DEFENSE_WEEKDAY_MESSAGE = 'Agende a defesa de segunda a sexta-feira.';

export function isDefenseWeekday(date: string): boolean {
  const weekday = new Date(date + 'T00:00:00Z').getUTCDay();
  return weekday >= 1 && weekday <= 5;
}
