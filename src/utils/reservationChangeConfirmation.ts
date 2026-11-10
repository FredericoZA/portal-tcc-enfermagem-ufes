import type {ProcessData} from '../types';
import {isOtherDefenseLocation,renderCustomLocationName} from './customDefenseLocation';
import {localDateTimeToIso} from './operationalConfig';

/** A readback confirms only the exact proposed schedule in a newer reservation.
 * It never changes state or repeats the POST. Unrelated edits are not proof. */
export function savedReservationMatches(
 latest:ProcessData,before:ProcessData,
 proposal:{date:string;time:string;locationChoice:string;customLocation?:string;expectedDataRevision:number},
 timezone='America/Sao_Paulo',
):boolean{
 if(latest.id!==before.id||latest.dataRevision<=proposal.expectedDataRevision
   ||(latest.defesa?.reservationRevision||0)<=(before.defesa?.reservationRevision||0))return false;
 try{
  const location=isOtherDefenseLocation(proposal.locationChoice)?renderCustomLocationName(proposal.customLocation||''):proposal.locationChoice;
  const normalize=(value:string)=>value.trim().replace(/\s+/g,' ').toLocaleLowerCase('pt-BR');
  return Date.parse(latest.defesa.startAt)===Date.parse(localDateTimeToIso(`${proposal.date}T${proposal.time}`,timezone))
   &&Boolean(location.trim())&&normalize(latest.defesa.local)===normalize(location);
 }catch{return false;}
}
