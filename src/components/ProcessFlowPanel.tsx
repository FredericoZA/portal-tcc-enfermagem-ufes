import {formatDateTimeWithWeekday} from '../utils/formatters';
import {isManagedDefenseLocation} from '../utils/reservationLocation';
import React,{useState} from 'react';
import type {ProcessData,SignatureJob} from '../types';
import {apiClient} from '../services/apiClient';
import {effectiveDefenseReservationStatus} from '../utils/defenseReservationState';
import {reservationStatusAlert} from '../utils/reservationStatusAlert';

/** Reservation confirmation belongs to the department; students only follow its result. */
export function ProcessFlowPanel({process,canConfirm}:{process:ProcessData;jobs:SignatureJob[];canConfirm:boolean;onUpdated:()=>Promise<void>}){
 const [busy,setBusy]=useState(false),[message,setMessage]=useState('');
 // A recusa tem um único aviso e uma única ação em Dados do processo.
 if(reservationStatusAlert(process)?.kind==='denied')return null;
 const waiting=effectiveDefenseReservationStatus(process)!=='CONFIRMADO';
 const revision=process.defesa.reservationRevision||0;
 const proof=process.defesa.locationProof?.reservationRevision===revision||process.defesa.departmentResponse?.revision===revision;
 if(!canConfirm&&!proof&&!process.defesa.localConfirmedAt)return null;
 const download=async()=>{
  setBusy(true);setMessage('');
  try{const result=await apiClient.downloadLocationProof(process.id);const url=URL.createObjectURL(result.blob);const a=document.createElement('a');a.href=url;a.download=result.fileName;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  catch(error){setMessage(error instanceof Error?error.message:'Não foi possível abrir o comprovante.');}
  finally{setBusy(false);}
 };
 return <section id="process-operational-actions" className={`portal-process-operational-actions rounded-xl border p-3 sm:p-4 ${waiting?'border-amber-300 bg-amber-50 text-amber-950':'border-slate-300 bg-[var(--portal-surface-card)]'}`}  aria-label="Reserva do local da defesa">
  {waiting?<p role="status" className="text-sm">{`Aguardando o aceite ou a recusa do ${isManagedDefenseLocation(process.defesa.local)?'departamento':'orientador'} pelo pedido enviado por e-mail.`}</p>:<p className="text-sm">Local confirmado: <strong>{process.defesa.local}</strong>{process.defesa.localConfirmedAt&&` · ${formatDateTimeWithWeekday(process.defesa.localConfirmedAt)}`}</p>}
  <div className="mt-3 flex flex-wrap gap-2">{proof&&<button type="button" className="portal-action" disabled={busy} onClick={()=>void download()}>{busy?'Abrindo…':'Abrir comprovante da reserva'}</button>}</div>
  {message&&<p role="status" className="mt-3 text-sm">{message}</p>}
 </section>;
}
