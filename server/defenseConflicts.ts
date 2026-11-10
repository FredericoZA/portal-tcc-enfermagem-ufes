import {isDefenseReservationDeclined} from '../src/utils/defenseReservationState';
import type {ProcessData} from '../src/types';
import {defenseEndAt, defenseIntervalsOverlap, normalizeDefenseLocation} from '../src/utils/defenseSchedule';
export {normalizeDefenseLocation} from '../src/utils/defenseSchedule';
/** Pending requests hold the chosen location; a refusal releases rooms and people. */
export function reservedDefenseLocations(process:ProcessData):string[]{
 if(isDefenseReservationDeclined(process))return[];
 const locations=[process.defesa.local];
 return [...new Set(locations.filter(Boolean).map(value=>normalizeDefenseLocation(String(value))).filter(Boolean))];
}
export function inspectDefenseConflicts(processes:ProcessData[],input:{startAt:string;local:string;alternateLocation?:string;emails:string[];excludeProcessId?:string},checkPeople=true){
 const start=Date.parse(input.startAt);if(!Number.isFinite(start))return[];
 const end=Date.parse(defenseEndAt(input.startAt)),locations=new Set([input.local].filter(Boolean).map(value=>normalizeDefenseLocation(String(value))).filter(Boolean)),emails=new Set(input.emails.map(value=>value.trim().toLowerCase()));
 return processes.filter(process=>process.id!==input.excludeProcessId&&!isDefenseReservationDeclined(process)&&Number.isFinite(Date.parse(process.defesa.startAt))&&defenseIntervalsOverlap(start,end,Date.parse(process.defesa.startAt),Date.parse(defenseEndAt(process.defesa.startAt)))).flatMap(process=>{
  const participants=[process.aluno1.email,process.aluno2?.email,process.orientador.email,process.coorientador?.email,...process.banca.map(member=>member.email)].filter(Boolean).map(value=>String(value).trim().toLowerCase());
  const sharedPeople=new Set(checkPeople?participants.filter(email=>emails.has(email)):[]);
  const sameLocation=reservedDefenseLocations(process).some(location=>locations.has(location));
  return sameLocation||sharedPeople.size?[{processId:process.id,protocol:process.protocolo,startAt:process.defesa.startAt,endAt:defenseEndAt(process.defesa.startAt),sameLocation,sharedPeopleCount:sharedPeople.size}]:[];
 });
}
