import type {Express} from 'express';
import type {GlobalSettings,GoogleCalendarSyncedEvent,ProcessData} from '../src/types';
import {publicCalendarView} from './publicViews';
import {isDefenseOnCalendar,isDefenseReservationDeclined} from '../src/utils/defenseReservationState';
import {defenseEndAt} from '../src/utils/defenseSchedule';
import {formatStudentsString} from '../src/utils/formatters';
import {resolveInstallationProfile} from '../src/utils/installationProfile';

type CalendarSnapshot={processes?:ProcessData[];settings?:Pick<GlobalSettings,'installationProfile'>};
export interface PublicCalendarData {processes:ReturnType<typeof publicCalendarView>[];googleEvents:GoogleCalendarSyncedEvent[];}
/** Project only public fields from one committed snapshot, never from a mutating global runtime. */
export function projectPublicCalendarData(snapshot:CalendarSnapshot):PublicCalendarData {
 if(!Array.isArray(snapshot.processes))throw new Error('Calendário sem estado confirmado.');
 const processes=snapshot.processes.filter(p=>p.status!=='EM_RASCUNHO'&&isDefenseOnCalendar(p));
 const fallbackLocation=resolveInstallationProfile(snapshot.settings).defaultDefenseLocation;
 return {processes:processes.map(publicCalendarView),googleEvents:processes.filter(p=>p.defesa.localStatus==='CONFIRMADO'&&!isDefenseReservationDeclined(p)).map(p=>({
  id:`gcal-${p.protocolo}`,portalTccProtocol:p.protocolo,summary:`Defesa de TCC - Apresentação: ${formatStudentsString(p.aluno1,p.aluno2)}`,
  description:`Trabalho: ${p.titulo}\nOrientador: ${p.orientador?.nome||'Não definido'}${p.coorientador?`\nCoorientador: ${p.coorientador.nome}`:''}${p.banca?.length?`\nBanca: ${p.banca.map(b=>b.nome).join(', ')}`:''}\nProtocolo: ${p.protocolo}`,
  location:p.defesa.local||fallbackLocation,start:p.defesa.startAt,end:defenseEndAt(p.defesa.startAt),syncedAt:p.updatedAt||p.createdAt,
 }))};
}
/** The public projection may be reused only after a fresh authoritative revision check.
 * Never installs the private snapshot into the mutable application runtime. */
export function createPublicCalendarDataReader(ports:{durable:()=>boolean;readDurable:()=>Promise<(CalendarSnapshot & {revision:number})|null>;readRevision:()=>Promise<number|null>;readLocal:()=>CalendarSnapshot}) {
 let pending:Promise<PublicCalendarData>|undefined;
 let cached:{revision:number;data:PublicCalendarData}|undefined;
 return async():Promise<PublicCalendarData>=>{
  if(!pending){
   const task=Promise.resolve().then(async()=>{
    if(!ports.durable()){cached=undefined;return projectPublicCalendarData(structuredClone(ports.readLocal()));}
    const revision=await ports.readRevision();
    if(revision===null||!Number.isSafeInteger(revision)||revision<1)throw new Error('Revisão do calendário não confirmada.');
    if(cached?.revision===revision)return cached.data;
    cached=undefined;
    const snapshot=await ports.readDurable();
    if(!snapshot)throw new Error('Calendário sem estado confirmado.');
    const data=projectPublicCalendarData(snapshot);
    // The revision and its data come from the same committed row, even if
    // another request commits between the lightweight check and this read.
    cached={revision:snapshot.revision,data};
    return data;
   });
   pending=task;
   void task.finally(()=>{if(pending===task)pending=undefined;}).catch(()=>undefined);
  }
  return structuredClone(await pending);
 };
}
/** Install before the mutable-runtime FIFO. This route has no private authorization or side effects. */
export function installPublicCalendarDataRoute(app:Pick<Express,'get'>,read:()=>Promise<PublicCalendarData>):void {
 app.get('/api/public/calendar-data',async(_req,res)=>{
  res.setHeader('Cache-Control','no-store');
  try{res.json(await read());}
  catch{res.setHeader('Retry-After','5');res.status(503).json({code:'PUBLIC_CALENDAR_UNAVAILABLE',error:'Não foi possível carregar o calendário. Tente novamente.'});}
 });
}
