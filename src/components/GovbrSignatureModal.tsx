import React,{useRef,useState} from 'react';
import {Download,ExternalLink,FileSignature,Upload} from 'lucide-react';
import type {ProcessData,SignatureJob} from '../types';
import {apiClient,ApiRequestError} from '../services/apiClient';
import {useAuth} from '../context/AuthContext';
import {isLocalDemoFrontend} from '../utils/runtimeEnvironment';
import {PortalModalShell} from './PortalModalShell';

interface Props {documentType?:'ATA'|'TERMO'|'DECLARACAO';canApprove?:boolean;process:ProcessData;initialJob?:SignatureJob;onChange:(job:SignatureJob)=>void;onClose:()=>void;}
export const GovbrSignatureModal:React.FC<Props>=({process,initialJob,onChange,onClose,documentType='DECLARACAO',canApprove=true})=>{
  const {refreshAuth}=useAuth();
  const [reauthRequired,setReauthRequired]=useState(false);
  const [resumePreparation,setResumePreparation]=useState(false);
  const [reauthEmail,setReauthEmail]=useState('');
  const [reauthCode,setReauthCode]=useState('');
  const [authMessage,setAuthMessage]=useState('');
  const [job,setJob]=useState(initialJob);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [checks,setChecks]=useState({itiApproved:false,signerMatches:false,documentMatches:false});
  const operationLock=useRef(false);
  const fileInput=useRef<HTMLInputElement>(null);
  const run=async(operation:()=>Promise<void>,prepareAfterAuth=false)=>{
    if(operationLock.current)return;
    operationLock.current=true;setBusy(true);setError('');
    try{await operation();}catch(cause){
      if(cause instanceof ApiRequestError&&(cause.code==='REAUTHENTICATION_REQUIRED'||cause.status===428)){
        setReauthRequired(true);setResumePreparation(prepareAfterAuth);setAuthMessage('');setError('');
      }else setError(cause instanceof Error?cause.message:'Não foi possível concluir esta operação.');
    }
    finally{operationLock.current=false;setBusy(false);}
  };
  const requestAccessCode=async()=>{
    const me=await apiClient.getMe();
    if(!me.userEmail)throw new Error('Não foi possível identificar seu acesso. Entre no Portal com o e-mail cadastrado.');
    const response=await apiClient.requestLoginCode(me.userEmail);
    if(!response.sent)throw new Error(response.message||'Não foi possível enviar o código de confirmação.');
    setReauthEmail(me.userEmail);setReauthCode('');setAuthMessage('Código enviado. Consulte seu e-mail e informe o código abaixo.');
  };
  const confirmAccessCode=async()=>{
    if(!/^\d{6}$/.test(reauthCode.trim()))throw new Error('Informe o código de seis dígitos recebido por e-mail.');
    const current=await apiClient.getMe();
    if(current.userEmail.toLowerCase()!==reauthEmail.toLowerCase())throw new Error('O usuário conectado mudou. Solicite um novo código para continuar com o acesso atual.');
    await apiClient.verifyLoginCode(reauthEmail,reauthCode.trim());
    await refreshAuth();
    setReauthRequired(false);setReauthCode('');setReauthEmail('');
    const prepare=resumePreparation;setResumePreparation(false);
    setAuthMessage(prepare?'Acesso confirmado. Preparando o documento…':'Acesso confirmado. Você pode continuar a operação neste documento.');
    if(prepare)await prepareDocument();
  };
  const update=(next:SignatureJob)=>{setJob(next);onChange(next);};
  const prepareDocument=async()=>update((await apiClient.signProcessDocument(process.id,documentType,'GOV_BR')).job);
  const download=async(returned=false)=>{
    if(!job)return;
    const {blob,fileName}=await apiClient.downloadGovbrPdf(job.id,returned);
    const url=URL.createObjectURL(blob),anchor=document.createElement('a');
    anchor.href=url;anchor.download=fileName;document.body.appendChild(anchor);anchor.click();anchor.remove();
    window.setTimeout(()=>URL.revokeObjectURL(url),60_000);
  };
  const upload=async(file:File)=>{
    if(!job)return;
    if(!file.name.toLowerCase().endsWith('.pdf')||file.size<=0||file.size>50*1024*1024)throw new Error('Selecione um PDF de até 50 MB.');
    const next=await apiClient.uploadGovbrPdf(job,file);
    update(next);setChecks({itiApproved:false,signerMatches:false,documentMatches:false});
  };
  const approve=async()=>{
    if(!job?.govbrReview)return;
    try{update(await apiClient.approveGovbrPdf(job.id,{sha256:job.govbrReview.sha256,...(job.govbrReview.approvedAt?{itiApproved:true,signerMatches:true,documentMatches:true}:checks)}));}
    catch(cause){
      // A conferência pode estar gravada mesmo se o Drive não concluiu a cópia.
      const latest=await apiClient.getProcessSignatureJobs(job.processId).catch(()=>[]);
      const current=latest.find(item=>item.id===job.id);if(current)update(current);
      throw cause;
    }
  };
  const review=job?.govbrReview;
  const archived=job?.status==='ARCHIVED';
  const approved=Boolean(review?.approvedAt);
  const checkLabels=[
    ['itiApproved','O VALIDAR/ITI apresentou resultado aprovado para todas as assinaturas deste PDF.'],
    ['signerMatches',`Conferi todos os titulares esperados: ${job?.signers.map(signer=>signer.name).join(', ')||'todos os signatários do documento'}.`],
    ['documentMatches','Conferi o processo, o conteúdo e a versão do documento, inclusive suas páginas e eventuais anotações.']
  ] as const;
  return <PortalModalShell zIndexClass="z-[1000002]" open onClose={()=>{if(!busy)onClose();}} closeOnBackdrop={!busy} closeOnEscape={!busy} title="Assinatura gov.br" icon={FileSignature} maxWidthClass="max-w-2xl" heightClass="max-h-[90dvh]" bodyClassName="overflow-y-auto p-4" footer={<button type="button" className="portal-action" disabled={busy} onClick={onClose}>Fechar</button>}>
    <div className="space-y-4 text-xs" aria-busy={busy}>
      <div className="rounded-lg border border-slate-300 bg-white p-3"><strong>{process.protocolo}</strong><p className="mt-1">{process.titulo}</p></div>
      {isLocalDemoFrontend()&&<p className="rounded-lg border border-amber-300 bg-amber-50 p-3">Ambiente de demonstração: o documento de teste não substitui o documento oficial.</p>}
      {reauthRequired&&<section className="space-y-3 rounded-lg border border-amber-300 bg-amber-50 p-3" aria-label="Confirmar acesso para assinatura">
        <h3 className="font-bold">Confirme seu acesso para continuar</h3>
        <p>Por segurança, a assinatura exige uma confirmação recente por código. Você pode confirmar aqui, sem sair do documento.</p>
        {reauthEmail?<form className="space-y-2" onSubmit={event=>{event.preventDefault();void run(confirmAccessCode);}}>
          <p>Código enviado para <strong className="break-all">{reauthEmail}</strong>.</p>
          <label className="block font-semibold">Código de confirmação<input autoFocus className="portal-input mt-1" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required disabled={busy} value={reauthCode} onChange={event=>setReauthCode(event.target.value.replace(/\D/g,''))}/></label>
          <div className="flex flex-wrap gap-2"><button type="submit" className="portal-action portal-button-primary" disabled={busy||reauthCode.length!==6}>{resumePreparation?'Confirmar acesso e gerar documento':'Confirmar acesso'}</button><button type="button" className="portal-action" disabled={busy} onClick={()=>void run(requestAccessCode)}>Enviar novo código</button></div>
        </form>:<button type="button" className="portal-action portal-button-primary" disabled={busy} onClick={()=>void run(requestAccessCode)}>Receber código para confirmar acesso</button>}
      </section>}
      {authMessage&&<p role="status" className="rounded-lg border border-slate-300 bg-[var(--portal-surface-panel)] p-3">{authMessage}</p>}
      {error&&<p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-red-800">{error}</p>}
      {archived?<div role="status" className="rounded-lg border border-emerald-300 bg-emerald-50 p-3"><strong>Documento conferido e arquivado</strong><p className="mt-1">Conferência manual no VALIDAR/ITI registrada por {review?.approvedBy} em {review?.approvedAt?new Date(review.approvedAt).toLocaleString('pt-BR'):''}.</p></div>:<>
        <section className="space-y-2 rounded-lg border border-slate-300 bg-white p-3">
          <h3 className="font-bold">1. Documento para assinatura</h3>
          {job?<><p>Versão {job.documentVersion} · Responsável: {job.signers.map(signer=>`${signer.name} (${signer.email})`).join(', ')}</p><div className="flex flex-wrap gap-2"><button type="button" disabled={busy||reauthRequired} className="portal-action" onClick={()=>void run(()=>download())}><Download className="h-3.5 w-3.5"/>Baixar original</button><a className="portal-action" href="https://assinador.iti.br/" target="_blank" rel="noopener noreferrer"><ExternalLink className="h-3.5 w-3.5"/>Assinar no Gov.br</a></div><p>Assine o original baixado e salve o PDF devolvido pelo Gov.br, sem editar ou imprimir novamente.</p></>:<button type="button" disabled={busy||reauthRequired} className="portal-action portal-button-primary" onClick={()=>void run(prepareDocument,true)}>Preparar documento</button>}
        </section>
        {job&&<section className="space-y-2 rounded-lg border border-slate-300 bg-white p-3">
          <h3 className="font-bold">2. PDF assinado</h3>
          <input ref={fileInput} type="file" accept="application/pdf,.pdf" className="hidden" aria-label="PDF assinado no Gov.br" disabled={busy||reauthRequired||approved} onChange={event=>{const file=event.currentTarget.files?.[0];event.currentTarget.value='';if(file)void run(()=>upload(file));}}/>
          <div className="rounded-lg border-2 border-dashed border-[var(--portal-border)] bg-[var(--portal-surface-panel)] p-4 text-center">
            <Upload className="mx-auto mb-2 h-6 w-6 text-[var(--portal-brand-header)]" aria-hidden="true"/>
            <p className="font-semibold">Envie aqui o documento assinado no Gov.br</p>
            <p className="mb-3 mt-1 text-slate-600">PDF de até 50 MB, com todas as assinaturas exigidas. Use o original preparado pelo Portal.</p>
            <button type="button" className="portal-action portal-button-primary" disabled={busy||reauthRequired||approved} onClick={()=>fileInput.current?.click()}><Upload className="h-3.5 w-3.5"/>{busy?'Enviando ou conferindo…':review?'Substituir PDF':'Devolver PDF assinado'}</button>
          </div>
          {review?<div className="space-y-1"><p className="break-words font-semibold">{review.fileName}</p><p className="break-all text-[10px] text-slate-600">SHA-256: {review.sha256}</p><button type="button" className="portal-action" disabled={busy||reauthRequired} onClick={()=>void run(()=>download(true))}><Download className="h-3.5 w-3.5"/>Baixar PDF para conferência</button></div>:<p>O envio deixa o arquivo pendente de conferência.</p>}
        </section>}
        {review&&canApprove&&<section className="space-y-3 rounded-lg border border-slate-300 bg-white p-3">
          <h3 className="font-bold">3. Conferência no VALIDAR/ITI</h3>
          <p>Envie o PDF desta versão ao serviço oficial e confira o resultado. O Portal registra sua conferência manual; não realiza validação criptográfica automática.</p>
          <a className="portal-action" href="https://validar.iti.gov.br/" target="_blank" rel="noopener noreferrer"><ExternalLink className="h-3.5 w-3.5"/>Abrir VALIDAR/ITI</a>
          {approved?<p role="status">Conferência já registrada por {review.approvedBy}. O arquivamento será repetido com o mesmo PDF.</p>:checkLabels.map(([key,label])=><label key={key} className="flex items-start gap-2"><input type="checkbox" checked={checks[key]} disabled={busy||reauthRequired} onChange={event=>setChecks(current=>({...current,[key]:event.target.checked}))}/><span>{label}</span></label>)}
          <button type="button" disabled={busy||reauthRequired||(!approved&&!Object.values(checks).every(Boolean))} className="portal-action portal-button-primary" onClick={()=>void run(approve)}>{busy?'Processando…':approved?'Repetir arquivamento':'Aprovar conferência e arquivar'}</button>
        </section>}
      </>}
    </div>
  </PortalModalShell>;
};
