import React, {useState} from 'react';
import type {ProcessData} from '../types';
import {CUSTOM_DEFENSE_LOCATION, MANAGED_DEFENSE_LOCATIONS} from '../utils/reservationLocation';
import {localDateTimeToIso} from '../utils/operationalConfig';
import {defenseEndAt} from '../utils/defenseSchedule';
import {apiClient} from '../services/apiClient';

export function ReservationChangeForm({process,onCancel,onSaved}:{process:ProcessData;onCancel:()=>void;onSaved:(message:string)=>Promise<void>}){
 const original=new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(process.defesa.startAt)).replace(' ','T');
 const [date,setDate]=useState(original.slice(0,10)),[time,setTime]=useState(original.slice(11,16));
 const managed=MANAGED_DEFENSE_LOCATIONS.find(location=>location===process.defesa.local);
 const [location,setLocation]=useState(managed||CUSTOM_DEFENSE_LOCATION),[custom,setCustom]=useState(managed?'':process.defesa.local);
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 const nextLocation=location===CUSTOM_DEFENSE_LOCATION?custom.trim():location;
 const changed=original!==`${date}T${time}`||process.defesa.local!==nextLocation;
 const submit=async(event:React.FormEvent)=>{
  event.preventDefault();if(busy||!changed)return;setBusy(true);setError('');
  try{
   const startAt=localDateTimeToIso(`${date}T${time}`,'America/Sao_Paulo');
   const result=await apiClient.updateProcess(process.id,{defesa:{startAt,endAt:defenseEndAt(startAt),local:nextLocation}});
   await onSaved(result.workflowPending?'Reserva alterada. O novo pedido aguarda envio; acompanhe a situação no processo.':'Novo pedido de reserva enviado. Aguarde o aceite ou a recusa do responsável.');
  }catch(error){setError(error instanceof Error?error.message:'Não foi possível alterar a reserva.');}finally{setBusy(false);}
 };
 return <form onSubmit={submit} aria-label="Alterar reserva" className="mt-3 space-y-3 border-t border-[var(--portal-border)] pt-3">
  <aside className="portal-instruction p-3"><strong>Alteração de reserva</strong><p>Ao enviar, a confirmação anterior deixa de valer e o responsável receberá um novo pedido com a data, o horário e o local informados.</p></aside>
  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
   <label className="text-sm">Data<input className="portal-input mt-1" aria-label="Nova data da defesa" type="date" required disabled={busy} value={date} onChange={event=>setDate(event.target.value)}/></label>
   <label className="text-sm">Horário<input className="portal-input mt-1" aria-label="Novo horário da defesa" type="time" step={300} required disabled={busy} value={time} onChange={event=>setTime(event.target.value)}/></label>
   <label className="text-sm sm:col-span-2">Local<select className="portal-input mt-1" aria-label="Novo local da defesa" disabled={busy} value={location} onChange={event=>setLocation(event.target.value)}>{MANAGED_DEFENSE_LOCATIONS.map(value=><option key={value} value={value}>{value}</option>)}<option value={CUSTOM_DEFENSE_LOCATION}>Outro local</option></select></label>
   {location===CUSTOM_DEFENSE_LOCATION&&<label className="text-sm sm:col-span-2 lg:col-span-4">Nome completo do local<input className="portal-input mt-1" required maxLength={250} disabled={busy} value={custom} onChange={event=>setCustom(event.target.value)}/></label>}
  </div>
  {error&&<p role="alert" className="portal-instruction p-3">{error}</p>}
  <div className="flex justify-center gap-2"><button type="button" className="portal-action" disabled={busy} onClick={onCancel}>Cancelar</button><button type="submit" className="portal-action-primary" disabled={busy||!changed}>{busy?'Enviando pedido…':'Enviar novo pedido de reserva'}</button></div>
 </form>;
}
