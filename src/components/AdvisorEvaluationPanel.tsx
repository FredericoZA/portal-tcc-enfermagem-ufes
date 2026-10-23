import React, { useEffect, useMemo, useRef, useState } from 'react';
import {FileText, LoaderCircle} from 'lucide-react';
import type { ProcessData } from '../types';
import type { RegistrationAnswers } from '../types/operationalConfig';
import { apiClient } from '../services/apiClient';
import { acceptEvaluationAnswers, EVALUATION_FORM_ID, evaluationQuestions, standardEvaluationOpinion, evaluationOutcomeLabel } from '../utils/evaluationForm';
import { evaluateStudioCondition } from '../utils/courseStudioValidator';
import {recoverEvaluationDocument} from '../utils/evaluationDraftModel';

const DocumentFilePreview=React.lazy(()=>import('./DocumentFilePreview').then(module=>({default:module.DocumentFilePreview})));
const GovbrSignatureModal=React.lazy(()=>import('./GovbrSignatureModal').then(module=>({default:module.GovbrSignatureModal})));

interface EvaluationDraft {
  processId: string;
  dataRevision: number;
  answers: RegistrationAnswers;
  confirmed: boolean;
  savedAt: string;
  documentText?: string;
  modelFingerprint?: string;
  documentTextReset?: boolean;
}

function draftKey(processId: string) {
  return `portal_tcc_evaluation_draft_v1:${processId}`;
}

function readDraft(process: ProcessData): EvaluationDraft | null {
  if (typeof sessionStorage === 'undefined') return null;
  try {
    const parsed = JSON.parse(sessionStorage.getItem(draftKey(process.id)) || 'null') as EvaluationDraft | null;
    if (!parsed || parsed.processId !== process.id || parsed.dataRevision !== process.dataRevision) return null;
    return parsed;
  } catch { return null; }
}

function writeDraft(process: ProcessData, answers: RegistrationAnswers, confirmed: boolean, documentText?:string, modelFingerprint?:string) {
  if (typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.setItem(draftKey(process.id), JSON.stringify({
      processId: process.id,
      dataRevision: process.dataRevision,
      answers,
      confirmed,
      documentText,
      modelFingerprint,
      savedAt: new Date().toISOString(),
    } satisfies EvaluationDraft));
  } catch { /* rascunho auxiliar; o envio final continua no servidor */ }
}

function clearDraft(processId: string) {
  if (typeof sessionStorage === 'undefined') return;
  try { sessionStorage.removeItem(draftKey(processId)); } catch { /* noop */ }
}

export function AdvisorEvaluationPanel({ process, canEvaluate, canReopen, onReopen, onUpdated }: {
  process: ProcessData; canEvaluate: boolean; canReopen: boolean; onReopen: () => void; onUpdated: () => Promise<void>;
}) {
  const [schema, setSchema] = useState<Awaited<ReturnType<typeof apiClient.getEvaluationSchema>> | null>(null);
  const initialDraft = useMemo(() => readDraft(process), [process.id, process.dataRevision]);
  const [answers, setAnswers] = useState<RegistrationAnswers>(initialDraft?.answers || {});
  const [confirmed, setConfirmed] = useState(Boolean(initialDraft?.confirmed));
  const [signatureProvider,setSignatureProvider]=useState<'ASTEN'|'GOV_BR'>(process.signatureProviderPreferences?.ATA||'ASTEN');
  const [formalConsent,setFormalConsent]=useState(false);
  const [documentText,setDocumentText]=useState(initialDraft?.documentText||'');
  const [documentEdited,setDocumentEdited]=useState(Boolean(initialDraft?.documentText));
  const [editingDocument,setEditingDocument]=useState(false);
  const [preview,setPreview]=useState<{url:string;token:string;fingerprint:string;documentText?:string}|null>(null);
  const [previewLoaded,setPreviewLoaded]=useState(false);
  const [govbrOpen,setGovbrOpen]=useState(false);
  const closePreview=()=>{if(preview?.url.startsWith('blob:'))URL.revokeObjectURL(preview.url);setPreview(null);setPreviewLoaded(false);setFormalConsent(false);setEditingDocument(false);};
  const [busy, setBusy] = useState(false);
  const [preparingSignature, setPreparingSignature] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState(initialDraft ? 'Rascunho recuperado automaticamente após a atualização da página.' : '');
  const [now, setNow] = useState(Date.now());
  const [schemaRetry, setSchemaRetry] = useState(0);
  const [draftSavedAt, setDraftSavedAt] = useState(initialDraft?.savedAt || '');
  const [serverSavedAt,setServerSavedAt]=useState('');
  const [autosaveRetry,setAutosaveRetry]=useState(0);
  const [draftLoaded,setDraftLoaded]=useState(false);
  const saveInFlight=useRef(false);
  const savePending=useRef(false);
  const savedServerFingerprint=useRef('');
  const attemptedFinalization=useRef('');
  const finalizeInFlight=useRef(false);
  const fingerprint=JSON.stringify(answers);
  const reviewFingerprint=fingerprint+signatureProvider+(documentEdited?documentText:'');
  const draftFingerprint=JSON.stringify({answers,documentText:documentEdited?documentText:undefined,modelFingerprint:schema?.ataModelFingerprint});

  useEffect(() => {
    let active=true;
    const restored=readDraft(process);
    setDraftLoaded(false);
    savedServerFingerprint.current='';
    attemptedFinalization.current='';
    setConfirmed(Boolean(restored?.confirmed));
    setFormalConsent(false);
    setAnswers(restored?.answers||{});setDocumentText(restored?.documentText||'');setDocumentEdited(Boolean(restored?.documentText));
    setDraftSavedAt(restored?.savedAt||'');
    setServerSavedAt('');
    setSchema(null);
    setError('');
    if(restored)setNotice('Rascunho local recuperado; verificando versão do servidor.');
    if(!canEvaluate||process.avaliacao?.status==='CONCLUIDO'){setDraftLoaded(true);return()=>{active=false;};}
    void Promise.all([apiClient.getEvaluationSchema(process.id),apiClient.getEvaluationDraft(process.id)]).then(([value,draft])=>{
      if(!active)return;
      const modelFingerprint=value.ataModelFingerprint||'';
      const serverDraft=draft?.dataRevision===process.dataRevision?draft:null;
      const localIsNewer=restored&&(!serverDraft||Date.parse(restored.savedAt)>Date.parse(serverDraft.savedAt));
      const recovered=recoverEvaluationDocument(localIsNewer?restored:serverDraft||restored,modelFingerprint);
      if(recovered){setAnswers(recovered.answers);setDocumentText(recovered.documentText||'');setDocumentEdited(Boolean(recovered.documentText));setDraftSavedAt(recovered.savedAt);if(recovered.documentTextReset)setNotice('Modelo padrão da ata restaurado. O resultado e o parecer foram preservados.');}
      if(serverDraft){const clean=recoverEvaluationDocument(serverDraft,modelFingerprint)!;savedServerFingerprint.current=JSON.stringify({answers:clean.answers,documentText:clean.documentText,modelFingerprint});setServerSavedAt(serverDraft.savedAt);}
      setSchema(value);
    }).catch(error=>{if(active)setError(error instanceof Error?error.message:'Não foi possível carregar a avaliação.');}).finally(()=>{if(active)setDraftLoaded(true);});
    return()=>{active=false;};
  },[process.id,process.dataRevision,process.avaliacao?.status,canEvaluate,schemaRetry]);

  useEffect(() => {
    if (!draftLoaded || !schema || !canEvaluate || process.avaliacao?.status === 'CONCLUIDO') return;
    const timer = window.setTimeout(() => {
      writeDraft(process, answers, confirmed,documentEdited?documentText:undefined,schema.ataModelFingerprint);
      setDraftSavedAt(new Date().toISOString());
    }, 350);
    return () => window.clearTimeout(timer);
  }, [answers, confirmed, documentText, documentEdited, canEvaluate, process.id, process.dataRevision, process.avaliacao?.status,draftLoaded,schema]);

  useEffect(()=>{
    if(!draftLoaded||!canEvaluate||!schema||process.avaliacao?.status==='CONCLUIDO'||draftFingerprint===savedServerFingerprint.current)return;
    const timer=window.setTimeout(()=>{
      if(saveInFlight.current){savePending.current=true;return;}
      saveInFlight.current=true;
      const sentFingerprint=draftFingerprint;
      void apiClient.saveEvaluationDraft(process.id,answers,process.dataRevision,documentEdited?documentText:undefined,schema.ataModelFingerprint).then(saved=>{
        savedServerFingerprint.current=sentFingerprint;setServerSavedAt(saved.savedAt);setError('');
      }).catch(e=>setError(e instanceof Error?e.message:'Não foi possível salvar a avaliação no servidor.')).finally(()=>{
        saveInFlight.current=false;
        if(savePending.current){savePending.current=false;setAutosaveRetry(n=>n+1);}
      });
    },600);
    return()=>window.clearTimeout(timer);
  },[answers,draftFingerprint,documentText,documentEdited,canEvaluate,schema,process.id,process.dataRevision,process.avaliacao?.status,autosaveRetry,draftLoaded]);

  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(timer); }, []);
  const studio = schema?.studio;
  const fields = evaluationQuestions(studio);
  const outcomeOptions = schema?.outcomes || [];
  const values = { ...answers };
  const started = Number.isFinite(Date.parse(process.defesa.startAt)) && Date.parse(process.defesa.startAt) <= now;
  const released = process.defesa.localStatus === 'CONFIRMADO' && Boolean(process.defesa.invitationSentAt) && started;
  const hasRequiredAnswers=Boolean(answers.RESULTADO&&String(answers.PARECER||'').trim());
  const standardOpinion = () => {
    const selected = outcomeOptions.find((option) => option.code === answers.RESULTADO);
    if(!selected){setError('Selecione o resultado deliberado pela banca antes de inserir o texto-padrão.');return '';}
    return standardEvaluationOpinion(process,selected);
  };
  const submit = async () => {
    if(finalizeInFlight.current)return;
    setError(''); setNotice('');
    if (!schema) { setError('Aguarde o carregamento do formulário.'); return; }
    if(!formalConsent||!previewLoaded||!preview||preview.fingerprint!==reviewFingerprint){setError('Confirme o encerramento da ata antes de concluir o registro.');return;}
    finalizeInFlight.current=true;
    setPreparingSignature(true);
    setBusy(true);
    try {
      const data = acceptEvaluationAnswers({ resultadoCode: answers.RESULTADO, parecer: answers.PARECER, answers }, outcomeOptions, studio);
      const response = await apiClient.submitEvaluation(process.id, { ...data, ...(documentEdited?{documentText,expectedModelFingerprint:schema?.ataModelFingerprint}:{}), signatureProvider, previewToken:preview.token, dataConfirmed: true, expectedDataRevision: process.dataRevision, expectedSchemaRevision: Number(studio.revision || 0) } as any);
      clearDraft(process.id);
      setDraftSavedAt('');
      setServerSavedAt('');
      setNotice(response.workflowPending ? `Avaliação salva. A geração ou o encaminhamento da ata está pendente: ${response.workflowError || 'a secretaria deve acompanhar a etapa.'}` : 'Avaliação salva. Acompanhe a ata e sua assinatura na Asten na área de documentos.');
      closePreview();
      if(signatureProvider==='GOV_BR')setGovbrOpen(true);
      await onUpdated();
    } catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível salvar a avaliação.'); }
    finally { finalizeInFlight.current=false;setPreparingSignature(false);setBusy(false); }
  };
  const viewAta=async()=>{
    if(!schema)return;
    setBusy(true);setError('');setFormalConsent(false);setPreviewLoaded(false);
    try{
      const data=acceptEvaluationAnswers({resultadoCode:answers.RESULTADO,parecer:answers.PARECER,answers},outcomeOptions,studio);
      const result=await apiClient.previewEvaluation(process.id,{...data,...(documentEdited?{documentText,expectedModelFingerprint:schema?.ataModelFingerprint}:{}),signatureProvider,expectedDataRevision:process.dataRevision,expectedSchemaRevision:Number(studio?.revision||0)});
      const url=result.downloadUrl||URL.createObjectURL(new Blob([Uint8Array.from(atob(result.contentBase64||''),c=>c.charCodeAt(0))],{type:'application/pdf'}));
      setPreview(previous=>{if(previous?.url.startsWith('blob:'))URL.revokeObjectURL(previous.url);return {url,token:result.previewToken,fingerprint:reviewFingerprint,documentText:result.documentText};});setEditingDocument(false);
    }catch(error){setError(error instanceof Error?error.message:'Não foi possível visualizar a Ata.');}finally{setBusy(false);}
  };

  const signatureFeedback = <div role="status" aria-live="polite" aria-atomic="true" className="flex items-center gap-3 rounded-lg border border-slate-300 bg-slate-100 p-3 text-sm text-slate-800">
    <LoaderCircle aria-hidden="true" className="h-5 w-5 shrink-0 animate-spin motion-reduce:animate-none text-[var(--portal-brand-header)]"/>
    <div><p className="font-semibold">Preparando a ata para assinatura…</p><p>Aguarde a confirmação nesta tela. Isso pode levar alguns instantes.</p></div>
  </div>;

  return <section id="evaluation-section" className="space-y-3" aria-labelledby="evaluation-title">
    <h2 id="evaluation-title" className="sr-only">Avaliação e ata da defesa</h2>
    {preparingSignature&&!preview&&signatureFeedback}
    {process.avaliacao?.status==='CONCLUIDO'&&canReopen&&<button type="button" className="portal-action m-4" onClick={onReopen}>Reabrir avaliação</button>}
    {canEvaluate&&process.avaliacao?.status!=='CONCLUIDO'&&<div role="status" className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">{notice&&<p>{notice}</p>}<p>Preencha o resultado e o parecer; depois visualize a Ata para conferir os dados e confirmar o registro.</p>{!released&&<p>{!process.defesa.invitationSentAt?'A prévia pode ser conferida agora. O registro oficial será liberado após a confirmação do local, o envio do convite e o horário da defesa.':'A prévia pode ser conferida agora. O registro oficial será liberado no horário da apresentação.'}</p>}</div>}
    <div className="portal-card space-y-5 p-4 sm:p-5">


      {error && <p role="alert" className="portal-error">{error}<button type="button" onClick={()=>{attemptedFinalization.current='';setAutosaveRetry(n=>n+1);}} className="ml-2 rounded-full border border-slate-300 bg-white px-2 py-1 text-xs text-slate-900">Tentar novamente</button></p>}
      {process.avaliacao?.status === 'CONCLUIDO' ? <>
        <dl className="grid gap-4 sm:grid-cols-2"><div><dt>Resultado</dt><dd className="font-semibold">{process.avaliacao.resultadoLabel || process.avaliacao.resultadoCode || 'Não informado'}</dd></div><div><dt>Responsável pelo registro</dt><dd>{process.avaliacao.submittedBy}</dd></div></dl>
        <p className="whitespace-pre-wrap">{process.avaliacao.parecer}</p>

      </> : !canEvaluate ? <p role="status" className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">Você não possui permissão para preencher esta avaliação. O registro é reservado ao orientador autorizado.</p> : !schema ? error ? <button type="button" className="portal-action" onClick={() => setSchemaRetry(n => n + 1)}>Tentar carregar o formulário novamente</button> : <p role="status">Carregando o formulário do orientador…</p> : <div className="space-y-5">

        <fieldset disabled={busy} className="grid gap-5 sm:grid-cols-2">
          <legend className="sr-only">{String(studio.formTemplates?.find(f => f.id === EVALUATION_FORM_ID)?.title || 'Resultado da apresentação')}</legend>
          {[...fields.filter(field=>field.fieldKey==='RESULTADO'),...fields.filter(field=>field.fieldKey!=='RESULTADO')].filter(field=>evaluateStudioCondition(field.visibleWhen,values)).map(field => {
            const key = field.fieldKey, value = answers[key] ?? '';
            const id = `evaluation-${key}`;
            const common = { id, className: 'portal-input', required: Boolean(field.required), 'aria-describedby': field.helpText ? `${id}-help` : undefined };
            return <React.Fragment key={key}><label htmlFor={id} className={`block ${field.fieldType === 'textarea' ? 'sm:col-span-2' : ''}`}><span className="mb-2 block font-semibold">{field.label}{field.required ? ' *' : ''}</span>
              {key === 'RESULTADO' ? <select {...common} value={String(value)} onChange={e => setAnswers(a => ({ ...a, [key]: e.target.value }))}><option value="">Selecione o resultado…</option>{outcomeOptions.map(o => <option key={o.code} value={o.code}>{evaluationOutcomeLabel(o)}</option>)}</select>
                : key === 'PARECER' ? <div className="relative"><textarea {...common} style={{paddingBottom:42}} rows={6} maxLength={field.validation?.maxLength || 10000} value={String(value)} onChange={e => setAnswers(a => ({ ...a, [key]: e.target.value }))} /><button type="button" className="portal-evaluation-standard-opinion absolute bottom-3 right-3" onClick={() => {const opinion=standardOpinion();if(opinion)setAnswers(a => ({ ...a, PARECER:opinion }));}}>Usar texto-padrão</button></div>
                : field.fieldType === 'textarea' ? <textarea {...common} rows={5} maxLength={field.validation?.maxLength || 10000} value={String(value)} onChange={e => setAnswers(a => ({ ...a, [key]: e.target.value }))} />
                : field.fieldType === 'checkbox' ? <input {...common} className="h-5 w-5" type="checkbox" checked={value === true} onChange={e => setAnswers(a => ({ ...a, [key]: e.target.checked }))} />
                : ['select', 'radio'].includes(field.fieldType) ? <select {...common} value={String(value)} onChange={e => setAnswers(a => ({ ...a, [key]: e.target.value }))}><option value="">Selecione…</option>{field.options?.map(o => <option key={o}>{o}</option>)}</select>
                : <input {...common} type={['number', 'date', 'email'].includes(field.fieldType) ? field.fieldType : 'text'} maxLength={field.validation?.maxLength || 1000} value={String(value)} onChange={e => setAnswers(a => ({ ...a, [key]: e.target.value }))} />}
              {field.helpText && <span id={`${id}-help`} className="mt-1 block text-sm">{field.helpText}</span>}
            </label>{key==='RESULTADO'&&<label className="block"><span className="mb-2 block font-semibold">Assinatura da ata</span><select aria-label="Assinatura da Ata" className="portal-input" value={signatureProvider} onChange={event=>setSignatureProvider(event.target.value as 'ASTEN'|'GOV_BR')}><option value="ASTEN">Asten, assinatura pelo e-mail</option><option value="GOV_BR">Gov.br, devolver PDF assinado</option></select></label>}</React.Fragment>;
          })}
        </fieldset>
        <button type="button" className="portal-action portal-action-primary" disabled={busy} onClick={()=>void viewAta()}>{busy?'Preparando Ata…':'Visualizar ata'}</button>

      </div>}
      {process.avaliacao?.status==='CONCLUIDO'&&process.signatureProviderPreferences?.ATA==='GOV_BR'&&canEvaluate&&<button type="button" className="portal-action" onClick={()=>setGovbrOpen(true)}>Enviar Ata assinada no Gov.br</button>}
    </div>
    {preview&&<div className="portal-modal-backdrop fixed inset-0 z-[1000012] flex items-center justify-center p-4" onMouseDown={event=>{if(event.currentTarget===event.target&&!busy)closePreview();}}>
      <div role="dialog" aria-modal="true" aria-label="Conferir Ata da defesa" style={preparingSignature?{cursor:'wait'}:undefined} className="flex h-full max-h-screen w-full max-w-5xl flex-col overflow-hidden rounded-xl bg-white">
        <header className="portal-modal-header"><FileText className="h-5 w-5"/><h2>{editingDocument?'Editar texto integral da ata':'Conferir ata da defesa'}</h2></header>
        {editingDocument?<div className="min-h-0 flex-1 overflow-auto p-4"><label className="block h-full font-semibold">Texto integral da ata<textarea className="portal-input mt-2 h-[95%] min-h-80 font-normal" value={documentText} maxLength={60000} disabled={busy} onChange={event=>{setDocumentText(event.target.value);setDocumentEdited(true);setFormalConsent(false);}}/></label></div>:<React.Suspense fallback={<p>Carregando Ata…</p>}><DocumentFilePreview url={preview.url} format="pdf" label="Ata da defesa" onLoaded={()=>setPreviewLoaded(true)}/></React.Suspense>}
        <div className="space-y-3 border-t p-4">
          {preparingSignature&&signatureFeedback}
          {editingDocument?<button type="button" className="portal-action portal-action-primary" disabled={busy} onClick={()=>void viewAta()}>{busy?'Gerando prévia…':'Gerar nova prévia'}</button>:<>
            <label className="flex items-start gap-2"><input type="checkbox" checked={formalConsent} disabled={!previewLoaded||busy} onChange={event=>setFormalConsent(event.target.checked)}/><span>Visualizei a ata. Confirmo que o resultado, o parecer e os dados correspondem à defesa e autorizo o registro e a preparação para assinatura.</span></label>
            <button type="button" className="portal-action" disabled={busy} onClick={()=>{if(!preview.documentText){setError('O modelo não disponibilizou texto editável. Confira o modelo ativo com a secretaria.');return;}setDocumentText(preview.documentText);setFormalConsent(false);setEditingDocument(true);}}>Voltar e corrigir</button>
            <button type="button" className="portal-action" aria-busy={preparingSignature} style={preparingSignature?{cursor:'wait'}:undefined} disabled={!formalConsent||!previewLoaded||busy} onClick={()=>void submit()}>{preparingSignature?'Preparando assinatura…':'Confirmar ata e prosseguir para assinatura'}</button>
          </>}
          {error&&<p role="alert" className="text-sm text-red-800">{error}</p>}
        </div>
      </div>
    </div>}
    {govbrOpen&&<React.Suspense fallback={<p>Carregando assinatura…</p>}><GovbrSignatureModal process={process} documentType="ATA" canApprove={canReopen} onChange={()=>{void onUpdated();}} onClose={()=>setGovbrOpen(false)}/></React.Suspense>}
  </section>;
}
