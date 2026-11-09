export const CALENDAR_WEEKDAY_LABELS: Record<number,string> = {1:'Seg',2:'Ter',3:'Qua',4:'Qui',5:'Sex',6:'Sáb',0:'Dom'};

/** Monday–Friday always stay visible. Each weekend column depends on an event in this month. */
export function buildCalendarMonthGrid(year: number, month: number, starts: readonly string[]) {
  const eventWeekdays=new Set(starts.flatMap(value=>{
    const date=new Date(value);
    return Number.isFinite(date.getTime())&&date.getFullYear()===year&&date.getMonth()===month ? [date.getDay()] : [];
  }));
  const weekdays=[1,2,3,4,5,...(eventWeekdays.has(6)?[6]:[]),...(eventWeekdays.has(0)?[0]:[])];
  const days=Array.from({length:new Date(year,month+1,0).getDate()},(_,index)=>index+1)
    .filter(day=>weekdays.includes(new Date(year,month,day).getDay()));
  const leading=days.length?weekdays.indexOf(new Date(year,month,days[0]).getDay()):0;
  const trailing=days.length?weekdays.length-1-weekdays.indexOf(new Date(year,month,days[days.length-1]).getDay()):0;
  return {weekdays,days,leading,trailing,gridTemplateColumns:`repeat(${weekdays.length}, minmax(0, 1fr))`};
}
