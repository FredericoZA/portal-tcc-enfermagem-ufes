import React,{useEffect,useState} from 'react';
import {AlertTriangle,CheckCircle2,Loader2} from 'lucide-react';
import {PortalModalShell} from './PortalModalShell';
import {apiClient,ApiRequestError} from '../services/apiClient';
import {createDeletionStatusWatcher,createProcessDeletionSession,initialDeletionDialogState,type DeletionDialogState,type DeletionDialogTarget} from '../utils/processDeletionDialog';

export function ProcessDeletionProgress({target,state}:{target:DeletionDialogTarget;state:DeletionDialogState}){
 const completed=state.phase==='completed';
 return <section className="portal-modal-card space-y-3 p-4" aria-label="Andamento da exclusão">
  <p className="flex items-center gap-2 font-bold" role="status" aria-live="polite">
   {state.busy?<Loader2 className="h-4 w-4 animate-spin" aria-hidden="true"/>:completed?<CheckCircle2 className="h-4 w-4" aria-hidden="true"/>:<AlertTriangle className="h-4 w-4" aria-hidden="true"/>}
   {state.message}
  </p>
  <p className="text-xs font-semibold">Processo: {target.protocol}</p>
  {state.phase==='pending'&&<p className="text-xs leading-5">Você pode acompanhar e tentar concluir a limpeza nesta janela. A numeração continua protegida enquanto houver pendência.</p>}
  {state.phase==='completed'&&<p className="text-xs leading-5">A exclusão foi confirmada pelo Portal e a limpeza dos recursos vinculados foi concluída.</p>}
  {state.cleanup?.errors?.length? <p className="text-xs leading-5">Um ou mais serviços ainda precisam confirmar a conclusão. A pendência permanece registrada para retomada automática.</p>:null}
 </section>;
}

export const ProcessDeletionDialog:React.FC<{target:DeletionDialogTarget;onDismiss:(started:boolean)=>void}>=({target,onDismiss})=>{
 const [state,setState]=useState(initialDeletionDialogState);
 const [confirmation,setConfirmation]=useState('');
 const [session]=useState(()=>createProcessDeletionSession(target,{
  remove:apiClient.deleteProcess,
  read:apiClient.getProcessDeletionStatus,
  retry:apiClient.retryProcessDeletion,
  change:setState,
  rejectsBeforeDelete:error=>error instanceof ApiRequestError&&(error.status===403||([400,409].includes(error.status)&&['PROCESS_DELETE_CONFIRMATION_REQUIRED','PROCESS_LEGAL_HOLD','PROCESS_OPERATION_IN_PROGRESS'].includes(error.code||''))),
 }));
 const [watcher]=useState(()=>createDeletionStatusWatcher({snapshot:session.snapshot,check:signal=>session.run('check','',signal)}));
 useEffect(()=>{session.activate();watcher.start();return()=>{watcher.stop();session.dispose();};},[session,watcher]);
 useEffect(()=>{watcher.update();},[state,watcher]);
 const close=()=>{const latest=session.snapshot();if(!latest.busy)onDismiss(latest.phase!=='confirm');};
 const confirming=state.phase==='confirm';
 const processing=Date.parse(state.cleanup?.processingUntil||'')>Date.now();
 return <PortalModalShell open onClose={close} closeOnBackdrop={!state.busy} closeOnEscape={!state.busy}
  title="Exclusão de Trabalho de TCC" icon={AlertTriangle} maxWidthClass="max-w-lg" zIndexClass="z-[1000003]">
  <div className="space-y-4">
   <section className="rounded-xl border border-rose-300 bg-rose-50 p-4 text-xs text-rose-950">
    <p className="font-black">{confirming?'Você está prestes a excluir definitivamente este Trabalho de TCC.':'Exclusão deste Trabalho de TCC'}</p>
    <div className="mt-3 rounded-lg border border-rose-200 bg-white p-3 font-mono text-[11px] font-bold text-slate-900">
     <div>Protocolo: {target.protocol}</div><div className="truncate">Título: {target.title}</div><div>Aluno(s): {target.authors}</div>
    </div>
    {confirming&&<p className="mt-3 text-[11px] font-semibold leading-5">Esta ação removerá os registros vinculados ao processo. Use somente quando a exclusão definitiva for realmente necessária.</p>}
   </section>
   {confirming&&<>
    <section className="portal-modal-card p-4">
     <label htmlFor="process-delete-confirmation" className="mb-1 block text-xs font-bold text-slate-800">Para autorizar, digite <span className="font-mono font-black text-rose-700">Excluir</span>.</label>
     <input id="process-delete-confirmation" type="text" placeholder="Digite EXCLUIR para autorizar" value={confirmation} disabled={state.busy} onChange={e=>setConfirmation(e.target.value)} className="portal-input font-mono font-bold normal-case"/>
    </section>
    <section className="portal-modal-card space-y-2 p-4 text-xs">
     <strong>Exclusão completa do TCC</strong>
     <p>Ao confirmar, o Portal remove os registros deste TCC, seus arquivos no Google Drive, os eventos de agenda e o histórico vinculados ao trabalho. Modelos e registros de outros trabalhos são preservados.</p>
     <p>O Portal também solicita a exclusão definitiva dos envelopes vinculados na ASTEN, inclusive os assinados. Essa ação remove o acesso e a validação desses documentos na plataforma. A exclusão só termina após a confirmação da limpeza.</p>
     <p>A exclusão e seu resultado são acompanhados nesta janela. Se um serviço não confirmar a limpeza, você poderá consultar o andamento e tentar concluí-la aqui.</p>
    </section>
   </>}
   {(!confirming||state.message)&&<ProcessDeletionProgress target={target} state={state}/>}
   <div className="flex flex-wrap justify-end gap-2">
    <button type="button" onClick={close} disabled={state.busy} className="portal-action disabled:cursor-not-allowed disabled:opacity-40">{confirming?'Cancelar':state.phase==='completed'?'Voltar à lista':'Fechar'}</button>
    {confirming?<button type="button" onClick={()=>void session.run('delete',confirmation)} disabled={state.busy||confirmation.trim().toUpperCase()!=='EXCLUIR'} className="portal-action-primary disabled:cursor-not-allowed disabled:opacity-40">{state.busy?'Excluindo…':'Confirmar exclusão definitiva'}</button>
     :state.phase!=='completed'&&<>
      <button type="button" onClick={()=>void session.run('check')} disabled={state.busy} className="portal-action disabled:cursor-not-allowed disabled:opacity-40">Verificar andamento</button>
      {state.phase==='pending'&&<button type="button" onClick={()=>void session.run('retry')} disabled={state.busy||processing} className="portal-action-primary disabled:cursor-not-allowed disabled:opacity-40">{processing?'Limpeza em processamento':'Tentar concluir limpeza'}</button>}
     </>}
   </div>
  </div>
 </PortalModalShell>;
}
