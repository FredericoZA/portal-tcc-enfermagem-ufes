import React, { useEffect, useState } from 'react';
import type { ProcessData, SignatureJob } from '../types';
import { apiClient } from '../services/apiClient';

export function ProcessFlowPanel({ process, jobs, canConfirm, onUpdated }: {process:ProcessData;jobs:SignatureJob[];canConfirm:boolean;onUpdated:()=>Promise<void>}) {
  const [local,setLocal]=useState(process.defesa.local||'');
  const [received,setReceived]=useState(false);
  const [file,setFile]=useState<File|null>(null);
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState('');
  useEffect(()=>{
    setLocal(process.defesa.local||'');
    setReceived(false);
    setFile(null);
    setMessage('');
  },[process.id]);
  const signed=(type:string)=>{const latest=jobs.filter(j=>j.documentType===type&&j.status!=='CANCELED').sort((a,b)=>b.documentVersion-a.documentVersion)[0];return latest?.status==='ARCHIVED'&&Boolean(latest.driveSignedFileId);};
  const publication=Boolean(process.acervo?.publishFullWork||process.acervo?.publishExpandedAbstract);
  const steps=[['Cadastro recebido',true],['Local confirmado',process.defesa.localStatus==='CONFIRMADO'],['Convite enviado',Boolean(process.defesa.invitationSentAt)],['Avaliação registrada',process.avaliacao.status==='CONCLUIDO'],['Ata assinada e arquivada',signed('ATA')],['Entrega final recebida',Boolean(process.acervo?.submittedAt)],['Termo assinado e arquivado',Boolean(process.acervo?.submittedAt)&&(!publication||signed('TERMO'))],['Declaração assinada e arquivada',signed('DECLARACAO')]] as const;
  const next=steps.findIndex(([,done])=>!done);
  const download=async()=>{setBusy(true);setMessage('');try{const result=await apiClient.downloadLocationProof(process.id);const url=URL.createObjectURL(result.blob);const a=document.createElement('a');a.href=url;a.download=result.fileName;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}catch(e){setMessage(e instanceof Error?e.message:'Não foi possível abrir o comprovante.');}finally{setBusy(false);}};
  const confirm=async(event:React.FormEvent)=>{
    event.preventDefault();setBusy(true);setMessage('');
    try{if(file)await apiClient.uploadLocationProof(process.id,file);const result=await apiClient.confirmDefenseLocation(process.id,{local:local.trim(),confirmationReceived:received});setFile(null);await onUpdated();setMessage(result.workflowPending?`Confirmação salva. O convite ainda está pendente: ${result.workflowError||'a secretaria deve retomar a etapa.'}`:'Confirmação registrada e convite enviado. Acompanhe as próximas etapas abaixo.');}
    catch(e){setMessage(e instanceof Error?e.message:'Não foi possível confirmar.');await onUpdated();}finally{setBusy(false);}
  };
  return <section className="portal-card my-5 p-5" aria-labelledby="process-flow-title">
    <h2 id="process-flow-title" className="text-lg font-bold">Andamento do TCC</h2>
    <ol className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">{steps.map(([label,done],i)=><li key={label} aria-current={i===next?'step':undefined} className={`rounded-lg border p-3 ${i===next?'border-current font-semibold':''}`}><span className="mr-2" aria-hidden="true">{done?'✓':i+1+'.'}</span>{label}<span className="sr-only">{done?' · concluído':i===next?' · etapa atual':' · aguardando'}</span></li>)}</ol>
    {process.defesa.localStatus!=='CONFIRMADO'&&canConfirm&&<form onSubmit={confirm} className="mt-5 space-y-4 border-t pt-5">
      <h3 className="font-semibold">O departamento confirmou a reserva?</h3><p>Registre a resposta recebida e o local autorizado. Essa confirmação libera a geração do convite pelo modelo do Master e seu envio à banca.</p>
      <label className="block">Local confirmado<input required className="portal-input mt-1" value={local} maxLength={200} onChange={e=>setLocal(e.target.value)} list="confirmation-places"/></label>
      <datalist id="confirmation-places">{[...new Set([process.defesa.local,process.registrationAnswers?.LOCAL_PREFERENCIAL,process.registrationAnswers?.LOCAL_ALTERNATIVO].filter(Boolean).map(String))].map(place=><option key={place}>{place}</option>)}</datalist>
      <label className="block">Comprovante da resposta do departamento (PDF até 1 MB)<input className="portal-input mt-1" type="file" accept="application/pdf,.pdf" onChange={e=>{setFile(e.target.files?.[0]||null);}}/><span className="mt-1 block text-sm">Pode ser o e-mail de confirmação salvo como PDF. O arquivo ficará privado no Drive.</span></label>
      <label className="flex items-start gap-3"><input className="mt-1 h-5 w-5" type="checkbox" checked={received} required onChange={e=>setReceived(e.target.checked)}/><span>Recebi a confirmação do departamento para este local, na data e no horário cadastrados.</span></label>
      <button className="portal-action portal-action-primary" disabled={busy||!received||!local.trim()} type="submit">{busy?'Registrando…':'Confirmar local e enviar convite'}</button>
    </form>}
    {process.defesa.localConfirmedAt&&<p className="mt-4 text-sm">Local: {process.defesa.local}. Confirmação registrada em {new Date(process.defesa.localConfirmedAt).toLocaleString('pt-BR')} por {process.defesa.localConfirmedBy}.</p>}
    {process.defesa.locationProof&&<button type="button" className="portal-action mt-3" disabled={busy} onClick={()=>void download()}>Abrir comprovante da reserva</button>}
    {message&&<p role="status" className="mt-3 rounded-lg border p-3">{message}</p>}
  </section>;
}
