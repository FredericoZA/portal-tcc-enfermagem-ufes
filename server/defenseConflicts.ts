import type {ProcessData} from '../src/types';
import {defenseEndAt} from '../src/utils/defenseSchedule';
export const normalizeDefenseLocation=(value:string)=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
/** Pending requests hold both accepted locations; a refusal releases both. */
export function reservedDefenseLocations(process:ProcessData):string[]{
 if(process.defesa.departmentResponse?.decision==='UNAVAILABLE')return[];
 const locations=[process.defesa.local];
 return [...new Set(locations.filter(Boolean).map(value=>normalizeDefenseLocation(String(value))).filter(Boolean))];
}
export function inspectDefenseConflicts(processes:ProcessData[],input:{startAt:string;local:string;alternateLocation?:string;emails:string[];excludeProcessId?:string},checkPeople=true){
 const start=Date.parse(input.startAt);if(!Number.isFinite(start))return[];
 const end=Date.parse(defenseEndAt(input.startAt)),locations=new Set([input.local].filter(Boolean).map(value=>normalizeDefenseLocation(String(value))).filter(Boolean)),emails=new Set(input.emails.map(value=>value.trim().toLowerCase()));
 return processes.filter(process=>process.id!==input.excludeProcessId&&process.defesa.departmentResponse?.decision!=='UNAVAILABLE'&&Number.isFinite(Date.parse(process.defesa.startAt))&&Date.parse(process.defesa.startAt)<end&&Date.parse(defenseEndAt(process.defesa.startAt))>start).flatMap(process=>{
  const participants=[process.aluno1.email,process.aluno2?.email,process.orientador.email,process.coorientador?.email,...process.banca.map(member=>member.email)].filter(Boolean).map(value=>String(value).trim().toLowerCase());
  const sharedPeople=new Set(checkPeople?participants.filter(email=>emails.has(email)):[]);
  const sameLocation=reservedDefenseLocations(process).some(location=>locations.has(location));
  return sameLocation||sharedPeople.size?[{processId:process.id,protocol:process.protocolo,startAt:process.defesa.startAt,endAt:defenseEndAt(process.defesa.startAt),sameLocation,sharedPeopleCount:sharedPeople.size}]:[];
 });
}
