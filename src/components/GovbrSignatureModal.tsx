import {formatDateTimeWithWeekday} from '../utils/formatters';
import React,{useEffect,useRef,useState} from 'react';
import {Download,ExternalLink,FileSignature,Upload} from 'lucide-react';
import type {ProcessData,SignatureJob} from '../types';
import {apiClient,ApiRequestError} from '../services/apiClient';
import {useAuth} from '../context/AuthContext';
import {isLocalDemoFrontend} from '../utils/runtimeEnvironment';
import {DocumentFilePreview} from './DocumentFilePreview';
import {PortalModalShell} from './PortalModalShell';

interface Props {documentType?:'ATA'|'TERMO'|'DECLARACAO';canApprove?:boolean;process:ProcessData;initialJob?:SignatureJob;onChange:(job:SignatureJob)=>void;onClose:()=>void;}
export const GovbrSignatureModal:React.FC<Props>=({process,initialJob,onChange,onClose,documentType='DECLARACAO',canApprove=true})=>{
  const {userEmail,isMasterAdmin,isCommissionPresident}=useAuth();
  const isRegisteredAdvisor=userEmail.trim().toLowerCase()===process.orientador.email.trim().toLowerCase();
  const canReturn=isMasterAdmin||(documentType==='TERMO'?isRegisteredAdvisor:isCommissionPresident||(documentType!=='DECLARACAO'&&isRegisteredAdvisor));
  const [job,setJob]=useState(initialJob);
  const [loadingJob,setLoadingJob]=useState(!initialJob);
  useEffect(()=>{
    if(initialJob){setJob(initialJob);setLoadingJob(false);return;}
    let active=true;setLoadingJob(true);
    void apiClient.getProcessSignatureJobs(process.id).then(jobs=>{
      if(!active)return;
      const existing=jobs.filter(item=>item.documentType===documentType&&item.provider==='GOV_BR'&&item.status!=='CANCELED'&&item.sourceDataRevision===process.dataRevision).sort((a,b)=>b.documentVersion-a.documentVersion)[0];
      setJob(existing);
    }).catch(cause=>{if(active)setError(cause instanceof Error?cause.message:'Não foi possível carregar o documento preparado.');}).finally(()=>{if(active)setLoadingJob(false);});
    return()=>{active=false;};
  },[initialJob,process.id,process.dataRevision,documentType]);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [modelChanged,setModelChanged]=useState(false);
  const [modelReviewLoaded,setModelReviewLoaded]=useState(false);
  const [modelReview,setModelReview]=useState<{url:string;fileId:string;version:number;sha256:string}>();
  useEffect(()=>()=>{if(modelReview?.url.startsWith('blob:'))URL.revokeObjectURL(modelReview.url);},[modelReview?.url]);
  const [checks,setChecks]=useState({itiApproved:false,signerMatches:false,documentMatches:false});
  const operationLock=useRef(false);
  const fileInput=useRef<HTMLInputElement>(null);
  const run=async(operation:()=>Promise<void>)=>{
    if(operationLock.current)return;
    operationLock.current=true;setBusy(true);setError('');
    try{await operation();}catch(cause){if(cause instanceof ApiRequestError&&cause.code==='DOCUMENT_MODEL_CONTENT_CHANGED')setModelChanged(true);setError(cause instanceof Error?cause.message:'Não foi possível concluir esta operação.');}
    finally{operationLock.current=false;setBusy(false);}
  };
  const update=(next:SignatureJob)=>{setJob(next);onChange(next);};
  const downloadPdf=async(target:SignatureJob,returned=false)=>{
    const {blob,fileName}=await apiClient.downloadGovbrPdf(target.id,returned);
    const url=URL.createObjectURL(blob),anchor=document.createElement('a');
    anchor.href=url;anchor.download=fileName;document.body.appendChild(anchor);anchor.click();anchor.remove();
    window.setTimeout(()=>URL.revokeObjectURL(url),60_000);
  };
  const download=async(returned=false)=>{if(job)await downloadPdf(job,returned);};
  const prepareDocument=async()=>{
    const next=(await apiClient.signProcessDocument(process.id,documentType,'GOV_BR')).job;
    // Preserve the prepared job if downloading fails: retry its download, not generation.
    update(next);
    await downloadPdf(next);
  };
  const reviewModel=async()=>{
    setModelReviewLoaded(false);
    const preview=await apiClient.previewOfficialModel(documentType,undefined,{});
    if(!preview.templateSha256||!preview.modelFileId||!preview.modelVersion)throw new Error('Atualize o Portal para revisar este modelo.');
    let url=preview.downloadUrl;
    if(!url&&preview.contentBase64){const bytes=Uint8Array.from(atob(preview.contentBase64),c=>c.charCodeAt(0));url=URL.createObjectURL(new Blob([bytes],{type:'application/pdf'}));}
    if(!url)throw new Error('A prévia não retornou um PDF.');
    setModelReview({url,fileId:preview.modelFileId,version:preview.modelVersion,sha256:preview.templateSha256});
  };
  const publishAndPrepare=async()=>{
    if(!modelReview||!modelReviewLoaded)return;
    await apiClient.publishReviewedDocumentModel(documentType,{fileId:modelReview.fileId,version:modelReview.version,sha256:modelReview.sha256});
    setModelChanged(false);setModelReview(undefined);await prepareDocument();
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
  return <PortalModalShell zIndexClass="z-[1000002]" open onClose={()=>{if(!busy)onClose();}} closeOnBackdrop={!busy} closeOnEscape={!busy} title="Assinatura gov.br" icon={FileSignature} maxWidthClass="max-w-2xl" heightClass="max-h-[90dvh]" bodyClassName="portal-govbr-flow overflow-y-auto p-4" footer={<button type="button" className="portal-action" disabled={busy} onClick={onClose}>Fechar</button>}>
    <div className="space-y-4 text-xs" aria-busy={busy}>
      <div className="portal-instruction space-y-1 p-3" role="note">
        <p>Baixe o PDF, assine no Gov.br e devolva o arquivo assinado abaixo.</p>
        {!job&&<p>Baixe o documento na etapa 1 para liberar a devolução.</p>}
        {!review&&!archived&&<p>O envio deixa o arquivo pendente de conferência.</p>}
        {job&&!archived&&<p>Assine o original baixado, sem editar ou imprimir novamente.</p>}
        {!canReturn&&<p>{documentType==='DECLARACAO'?'A devolução da declaração é feita pela Presidência ou pelo Master.':'A devolução deste documento é feita pelo orientador responsável ou pelo Master.'}</p>}
        <p>{documentType==='DECLARACAO'?'A Presidência assina e devolve a declaração.':documentType==='ATA'?'O orientador e os dois examinadores assinam o mesmo PDF da ata. O orientador reúne as três assinaturas e devolve o arquivo completo.':'O orientador reúne todas as assinaturas no mesmo PDF, assina por último e devolve o arquivo.'}</p>
      </div>
      <div className="rounded-lg border border-slate-300 bg-white p-3"><strong>{process.protocolo}</strong><p className="mt-1">{process.titulo}</p></div>
      {isLocalDemoFrontend()&&<p className="rounded-lg border border-amber-300 bg-amber-50 p-3">Ambiente de demonstração: o documento de teste não substitui o documento oficial.</p>}
      {error&&<p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-red-800">{error}</p>}
      {modelChanged&&(isMasterAdmin||isCommissionPresident)&&<section className="space-y-3 rounded-lg border border-slate-300 bg-white p-3">
        <h3 className="font-bold">Revisão do modelo</h3>
        <p className="portal-instruction p-3">O arquivo atual difere da versão publicada. Confira a amostra antes de publicar uma nova versão e gerar o documento deste TCC.</p>
        <button type="button" className="portal-action" disabled={busy} onClick={()=>void run(reviewModel)}>Visualizar modelo atual</button>
        {modelReview&&<><div className="max-h-80 overflow-auto rounded border border-slate-300"><DocumentFilePreview url={modelReview.url} format="pdf" label="Amostra do modelo atual, sem validade" onLoaded={()=>setModelReviewLoaded(true)}/></div><a href={modelReview.url} target="_blank" rel="noopener noreferrer" className="portal-action">Abrir amostra em outra aba</a><button type="button" className="portal-action portal-button-primary" disabled={busy||!modelReviewLoaded} onClick={()=>void run(publishAndPrepare)}>Publicar modelo revisado e baixar PDF</button></>}
      </section>}
      {archived?<div role="status" className="rounded-lg border border-emerald-300 bg-emerald-50 p-3"><strong>Documento conferido e arquivado</strong><p className="mt-1">Conferência manual no VALIDAR/ITI registrada por {review?.approvedBy} em {review?.approvedAt?formatDateTimeWithWeekday(review.approvedAt):''}.</p></div>:<>
        <section className="space-y-2 rounded-lg border border-slate-300 bg-white p-3">
          <h3 className="font-bold">1. Baixar o documento</h3>
          {loadingJob?<p role="status">Carregando o documento…</p>:job?<><p>Versão {job.documentVersion} · Responsável: {job.signers.map(signer=>`${signer.name} (${signer.email})`).join(', ')}</p><div className="flex flex-wrap gap-2"><button type="button" disabled={busy} className="portal-action" onClick={()=>void run(()=>download())}><Download className="h-3.5 w-3.5"/>Baixar PDF para assinar</button><a className="portal-action" href="https://assinador.iti.br/" target="_blank" rel="noopener noreferrer"><ExternalLink className="h-3.5 w-3.5"/>Abrir assinador Gov.br</a></div></>:<button type="button" disabled={busy} className="portal-action portal-button-primary" onClick={()=>void run(prepareDocument)}>{busy?'Gerando e baixando PDF…':'Gerar e baixar PDF'}</button>}
        </section>
        {<section className="space-y-2 rounded-lg border border-slate-300 bg-white p-3">
          <h3 className="font-bold">2. Devolver o documento assinado</h3>
          <input ref={fileInput} type="file" accept="application/pdf,.pdf" className="hidden" aria-label="PDF assinado no Gov.br" disabled={busy||loadingJob||!job||approved||!canReturn} onChange={event=>{const file=event.currentTarget.files?.[0];event.currentTarget.value='';if(file)void run(()=>upload(file));}}/>
          <div className="rounded-lg border-2 border-dashed border-[var(--portal-border)] bg-[var(--portal-surface-panel)] p-4 text-center">
            <Upload className="mx-auto mb-2 h-6 w-6 text-[var(--portal-brand-header)]" aria-hidden="true"/>
            <p className="font-semibold">Envie aqui o documento assinado no Gov.br</p>
            <p className="mb-3 mt-1 text-slate-600">PDF de até 50 MB, com todas as assinaturas exigidas. Use o original preparado pelo Portal.</p>
            <button type="button" className="portal-action portal-button-primary" disabled={busy||loadingJob||!job||approved||!canReturn} onClick={()=>fileInput.current?.click()}><Upload className="h-3.5 w-3.5"/>{busy?'Enviando ou conferindo…':review?'Substituir PDF':'Devolver PDF assinado'}</button>
          </div>
          {review?<div className="space-y-1"><p className="break-words font-semibold">{review.fileName}</p><p className="break-all text-[10px] text-slate-600">SHA-256: {review.sha256}</p><button type="button" className="portal-action" disabled={busy} onClick={()=>void run(()=>download(true))}><Download className="h-3.5 w-3.5"/>Baixar PDF para conferência</button></div>:null}
        </section>}
        {review&&canApprove&&<section className="space-y-3 rounded-lg border border-slate-300 bg-white p-3">
          <h3 className="font-bold">3. Conferência no VALIDAR/ITI</h3>
          <p className="portal-instruction p-3">Envie o PDF desta versão ao serviço oficial e confira o resultado. O Portal registra sua conferência manual; não realiza validação criptográfica automática.</p>
          <a className="portal-action" href="https://validar.iti.gov.br/" target="_blank" rel="noopener noreferrer"><ExternalLink className="h-3.5 w-3.5"/>Abrir VALIDAR/ITI</a>
          {approved?<p role="status">Conferência já registrada por {review.approvedBy}. O arquivamento será repetido com o mesmo PDF.</p>:checkLabels.map(([key,label])=><label key={key} className="flex items-start gap-2"><input type="checkbox" checked={checks[key]} disabled={busy} onChange={event=>setChecks(current=>({...current,[key]:event.target.checked}))}/><span>{label}</span></label>)}
          <button type="button" disabled={busy||(!approved&&!Object.values(checks).every(Boolean))} className="portal-action portal-button-primary" onClick={()=>void run(approve)}>{busy?'Processando…':approved?'Repetir arquivamento':'Aprovar conferência e arquivar'}</button>
        </section>}
      </>}
    </div>
  </PortalModalShell>;
};
