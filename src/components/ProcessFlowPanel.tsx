import {isManagedDefenseLocation} from '../utils/reservationLocation';
import React,{useState} from 'react';
import type {ProcessData,SignatureJob} from '../types';
import {apiClient} from '../services/apiClient';

/** Reservation confirmation belongs to the department; students only follow its result. */
export function ProcessFlowPanel({process,canConfirm,onChangeReservation}:{process:ProcessData;jobs:SignatureJob[];canConfirm:boolean;onChangeReservation?:()=>void;onUpdated:()=>Promise<void>}){
 const [busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const waiting=process.defesa.localStatus!=='CONFIRMADO';
 const proof=Boolean(process.defesa.locationProof||process.defesa.departmentResponse);
 if(!canConfirm&&!proof&&!process.defesa.localConfirmedAt)return null;
 const download=async()=>{
  setBusy(true);setMessage('');
  try{const result=await apiClient.downloadLocationProof(process.id);const url=URL.createObjectURL(result.blob);const a=document.createElement('a');a.href=url;a.download=result.fileName;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  catch(error){setMessage(error instanceof Error?error.message:'Não foi possível abrir o comprovante.');}
  finally{setBusy(false);}
 };
 return <section id="process-operational-actions" className={`portal-process-operational-actions rounded-xl border p-3 sm:p-4 ${waiting?'border-amber-300 bg-amber-50 text-amber-950':'border-slate-300 bg-[var(--portal-surface-card)]'}`}  aria-label="Reserva do local da defesa">
  {waiting?<p role="status" className="text-sm">{process.defesa.departmentResponse?.decision==='UNAVAILABLE'?'O responsável recusou o agendamento. Use “Solicitar nova data” para enviar outro pedido de reserva.':`Aguardando o aceite ou a recusa do ${isManagedDefenseLocation(process.defesa.local)?'departamento':'orientador'} pelo pedido enviado por e-mail.`}</p>:<p className="text-sm">Local confirmado: <strong>{process.defesa.local}</strong>{process.defesa.localConfirmedAt&&` · ${new Date(process.defesa.localConfirmedAt).toLocaleString('pt-BR')}`}</p>}
  <div className="mt-3 flex flex-wrap gap-2">{proof&&<button type="button" className="portal-action" disabled={busy} onClick={()=>void download()}>{busy?'Abrindo…':process.defesa.departmentResponse?.decision==='UNAVAILABLE'?'Abrir comprovante de indisponibilidade':'Abrir comprovante da reserva'}</button>}
  {process.defesa.departmentResponse?.decision==='UNAVAILABLE'&&onChangeReservation&&<button type="button" className="portal-action-primary" onClick={onChangeReservation}>Solicitar nova data</button>}</div>
  {message&&<p role="status" className="mt-3 text-sm">{message}</p>}
 </section>;
}
