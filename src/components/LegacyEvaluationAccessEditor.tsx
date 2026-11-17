import React, {useId, useRef, useState} from 'react';
import {ShieldCheck} from 'lucide-react';
import {apiClient} from '../services/apiClient';
import type {LegacyEvaluationParticipantsView} from '../types/legacyArchive';
import {PortalModalShell} from './PortalModalShell';

/** Mounted only in the Master document card. Participant names stay fixed. */
export function LegacyEvaluationAccessEditor({processId,onSaved}:{processId:string;onSaved?:()=>void}) {
  const formId=useId(),scope=useRef(processId),requestVersion=useRef(0);scope.current=processId;
  const [open,setOpen]=useState(false),[openedFor,setOpenedFor]=useState<string|null>(null),[view,setView]=useState<LegacyEvaluationParticipantsView|null>(null);
  const [loading,setLoading]=useState(false),[saving,setSaving]=useState(false),[error,setError]=useState('');
  const [reason,setReason]=useState(''),[source,setSource]=useState('');
  const close=()=>{if(!saving){requestVersion.current++;setOpen(false);}};
  async function show(){
    const id=processId,version=++requestVersion.current;setOpenedFor(id);setOpen(true);setLoading(true);setSaving(false);setView(null);setError('');setReason('');setSource('');
    try{const result=await apiClient.getLegacyEvaluationParticipants(id);if(scope.current===id&&requestVersion.current===version)setView(result);}
    catch{if(scope.current===id&&requestVersion.current===version)setError('Não foi possível consultar os acessos. Feche e tente novamente.');}
    finally{if(scope.current===id&&requestVersion.current===version)setLoading(false);}
  }
  async function save(clear=false){
    if(!view||saving)return;
    if(reason.trim().length<10||source.trim().length<10){setError('Informe o motivo e a fonte da confirmação, com ao menos 10 caracteres cada.');return;}
    const id=processId;setSaving(true);setError('');
    try{
      const common={expectedRevision:view.revision,reason:reason.trim(),source:source.trim()};
      const result=await apiClient.saveLegacyEvaluationParticipants(id,clear?{...common,clear:true}:{...common,authorEmails:view.authors.map(person=>person.email),advisorEmail:view.advisor.email});
      if(scope.current!==id)return;
      setView(result);setOpen(false);onSaved?.();
    }catch(error){if(scope.current===id)setError(error instanceof Error?error.message:'Não foi possível salvar os acessos. Reabra a confirmação.');}
    finally{if(scope.current===id)setSaving(false);}
  }
  return <>
    <button type="button" className="portal-action text-xs" onClick={()=>void show()}>Confirmar acessos</button>
    <PortalModalShell open={open&&openedFor===processId} onClose={close} title="Acessos ao instrumento de avaliação" icon={ShieldCheck}
      maxWidthClass="max-w-xl" heightClass="max-h-[90vh]" bodyClassName="p-4 space-y-3"
      closeOnBackdrop={!saving} closeOnEscape={!saving}
      footer={<div className="flex w-full flex-wrap items-center justify-end gap-2">
        {view?.hasStoredBinding&&<button type="button" className="portal-action text-[var(--portal-danger)]" disabled={saving||loading} onClick={()=>void save(true)}>Revogar acessos</button>}
        <button type="button" className="portal-action" disabled={saving} onClick={close}>Cancelar</button>
        <button type="submit" form={formId} className="portal-action-primary" disabled={saving||loading||!view}>{saving?'Salvando…':'Salvar acessos'}</button>
      </div>}>
      <p className="text-xs leading-relaxed">Confirme os e-mails dos alunos e do orientador antes de liberar a consulta ao instrumento de avaliação no Portal. O documento permanece privado.</p>
      {loading&&<p role="status" className="text-xs">Consultando acessos…</p>}
      {error&&<p role="alert" className="portal-instruction p-3 text-xs">{error}</p>}
      {view&&<form id={formId} className="space-y-3" onSubmit={event=>{event.preventDefault();void save();}}>
        {view.authors.map((person,index)=><label key={index} className="block text-xs font-bold">Aluno: {person.nome}
          <input type="email" required autoComplete="off" className="portal-input mt-1 w-full" value={person.email} maxLength={254} disabled={saving}
            onChange={event=>setView(current=>current?{...current,authors:current.authors.map((author,i)=>i===index?{...author,email:event.target.value}:author)}:current)}/>
        </label>)}
        <label className="block text-xs font-bold">Orientador: {view.advisor.nome}
          <input type="email" required autoComplete="off" className="portal-input mt-1 w-full" value={view.advisor.email} maxLength={254} disabled={saving}
            onChange={event=>setView(current=>current?{...current,advisor:{...current.advisor,email:event.target.value}}:current)}/>
        </label>
        <label className="block text-xs font-bold">Fonte da confirmação
          <input type="text" required minLength={10} maxLength={1000} className="portal-input mt-1 w-full" value={source} disabled={saving}
            placeholder="Documento ou registro que comprova o vínculo" onChange={event=>setSource(event.target.value)}/>
        </label>
        <label className="block text-xs font-bold">Motivo
          <input type="text" required minLength={10} maxLength={1000} className="portal-input mt-1 w-full" value={reason} disabled={saving}
            onChange={event=>setReason(event.target.value)}/>
        </label>
      </form>}
    </PortalModalShell>
  </>;
}
