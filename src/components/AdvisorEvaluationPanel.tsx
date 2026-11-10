import React, { useEffect, useMemo, useRef, useState } from 'react';
import {FileText, LoaderCircle} from 'lucide-react';
import type { ProcessData, ProcessDocument } from '../types';
import type { RegistrationAnswers } from '../types/operationalConfig';
import { apiClient, ApiRequestError, type AtaReviewParagraph } from '../services/apiClient';
import { acceptEvaluationAnswers, evaluationQuestions, standardEvaluationOpinion, evaluationOutcomeLabel, conceptRegistrationBlocker } from '../utils/evaluationForm';
import { evaluateStudioCondition } from '../utils/courseStudioValidator';
import {recoverEvaluationDocument} from '../utils/evaluationDraftModel';
import {ataReviewColumns,joinAtaReviewColumns} from '../utils/ataReviewLayout';

const DocumentFilePreview=React.lazy(()=>import('./DocumentFilePreview').then(module=>({default:module.DocumentFilePreview})));

function AtaReviewEditor({paragraphs,disabled,onChange}:{
  paragraphs:AtaReviewParagraph[];disabled:boolean;onChange:(text:string)=>void;
}){
  const sheet=useRef<HTMLDivElement>(null);
  const [lines,setLines]=useState<number[]>([]);
  useEffect(()=>{
    const host=sheet.current as HTMLDivElement|null;
    if(!host)return;
    const measure=()=>setLines(Array.from(host.querySelectorAll<HTMLElement>('[data-ata-paragraph]')).map(node=>
      Math.max(1,Math.round(node.offsetHeight/parseFloat(getComputedStyle(node).lineHeight)))
    ));
    const observer=new ResizeObserver(measure);
    for(const paragraph of host.querySelectorAll('[data-ata-paragraph]'))observer.observe(paragraph);
    measure();
    return()=>observer.disconnect();
  },[paragraphs]);
  const alignment={START:'left',CENTER:'center',END:'right',JUSTIFIED:'justify'} as const;
  const edited=()=>{
    const host=sheet.current as HTMLDivElement|null;if(!host)return;
    onChange(Array.from(host.querySelectorAll<HTMLElement>('[data-ata-paragraph]'),node=>node.dataset.ataColumns==='true'
      ?joinAtaReviewColumns(Array.from(node.querySelectorAll<HTMLElement>('[data-ata-cell]'),cell=>cell.innerText))
      :node.innerText.replace(/\r/g,'')).join('\n'));
  };
  const renderRuns=(runs:AtaReviewParagraph['runs'])=>runs.map((run,index)=><span key={index} style={{fontFamily:run.font,fontSize:run.size?`${run.size}pt`:undefined,fontWeight:run.bold?'bold':undefined,fontStyle:run.italic?'italic':undefined,textDecoration:run.underline?'underline':undefined}}>{index===runs.length-1?run.text.replace(/\n$/,''):run.text}</span>);
  let nextLine=1;
  return <div className="min-h-0 flex-1 overflow-auto bg-slate-100 p-3 sm:p-5">
    <div ref={sheet} role="group" aria-label="Texto editável da ata" className="mx-auto max-w-[794px] bg-white py-8 pl-11 pr-6 text-slate-950 shadow-sm sm:pr-14">
      {paragraphs.map((paragraph,index)=>{
        const columns=ataReviewColumns(paragraph);
        const first=nextLine;
        const count=lines[index]||1;
        nextLine+=count;
        return <div key={index} className="relative text-[14px] leading-[21px]">
          <div aria-hidden="true" className="pointer-events-none absolute right-full mr-2 text-right text-[10px] text-slate-500">
            {Array.from({length:count},(_,row)=><div key={row}>{first+row}</div>)}
          </div>
          {columns?<div data-ata-paragraph data-ata-columns="true" className="grid grid-cols-2 gap-4 text-center">
            {columns.map((runs,column)=><div key={column} data-ata-cell role="textbox" aria-label={`Parágrafo ${index+1} da ata, coluna ${column+1}`} aria-multiline="false" contentEditable={disabled?false:'plaintext-only'} suppressContentEditableWarning className="min-h-[21px] whitespace-pre-wrap break-words outline-none focus-visible:ring-1 focus-visible:ring-emerald-700" onInput={edited}>{renderRuns(runs)}</div>)}
          </div>:<div data-ata-paragraph role="textbox" aria-label={`Parágrafo ${index+1} da ata`} aria-multiline="true"
            contentEditable={disabled?false:'plaintext-only'} suppressContentEditableWarning
            className="min-h-[21px] whitespace-pre-wrap break-words outline-none focus-visible:ring-1 focus-visible:ring-emerald-700"
            style={{textAlign:alignment[paragraph.alignment||'START']}}
            onInput={edited}>
            {renderRuns(paragraph.runs)}
          </div>}
        </div>;
      })}
    </div>
  </div>;
}

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

export function AdvisorEvaluationPanel({ publicReadOnly = false, process, canEvaluate, canReopen, onReopen, onUpdated }: {
  publicReadOnly?: boolean; process: ProcessData; canEvaluate: boolean; canReopen: boolean; onReopen: () => void; onUpdated: (recorded: ProcessData, documents?: ProcessDocument[], recovered?:boolean) => void;
}) {
  const [schema, setSchema] = useState<Awaited<ReturnType<typeof apiClient.getEvaluationSchema>> | null>(null);
  const initialDraft = useMemo(() => readDraft(process), [process.id, process.dataRevision]);
  const [answers, setAnswers] = useState<RegistrationAnswers>(initialDraft?.answers || {});
  const [confirmed, setConfirmed] = useState(Boolean(initialDraft?.confirmed));
  const signatureProvider='ASTEN' as const;
  const [formalConsent,setFormalConsent]=useState(false);
  const [documentText,setDocumentText]=useState(initialDraft?.documentText||'');
  const [documentEdited,setDocumentEdited]=useState(Boolean(initialDraft?.documentText));
  const [editingDocument,setEditingDocument]=useState(false);
  const [correctedText,setCorrectedText]=useState<string>();
  const [preview,setPreview]=useState<{url:string;token:string;fingerprint:string;documentText?:string;layout:AtaReviewParagraph[]}|null>(null);
  const [previewLoaded,setPreviewLoaded]=useState(false);
  const closePreview=()=>{if(preview?.url.startsWith('blob:'))URL.revokeObjectURL(preview.url);setPreview(null);setPreviewLoaded(false);setFormalConsent(false);setEditingDocument(false);setCorrectedText(undefined);};
  const [busy, setBusy] = useState(false);
  const [preparingSignature, setPreparingSignature] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState(initialDraft ? 'Rascunho recuperado automaticamente após a atualização da página.' : '');
  const [now, setNow] = useState(Date.now());
  const releaseBlocker = conceptRegistrationBlocker(process, now);
  const released = releaseBlocker === undefined;
  const canFillConcept = canEvaluate && released && process.avaliacao?.status !== 'CONCLUIDO';
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
    if(!canFillConcept){setDraftLoaded(true);return()=>{active=false;};}
    void Promise.all([apiClient.getEvaluationSchema(process.id),apiClient.getEvaluationDraft(process.id)]).then(([value,draft])=>{
      if(!active)return;
      const modelFingerprint=value.ataModelFingerprint||'';
      const serverDraft=draft?.dataRevision===process.dataRevision?draft:null;
      const localIsNewer=restored&&(!serverDraft||Date.parse(restored.savedAt)>Date.parse(serverDraft.savedAt));
      const recovered=recoverEvaluationDocument(localIsNewer?restored:serverDraft||restored,modelFingerprint);
      if(recovered){setAnswers(recovered.answers);setDocumentText(recovered.documentText||'');setDocumentEdited(Boolean(recovered.documentText));setDraftSavedAt(recovered.savedAt);if(recovered.documentTextReset)setNotice('Modelo padrão da ata restaurado. O resultado e o parecer foram preservados.');}
      if(serverDraft){const clean=recoverEvaluationDocument(serverDraft,modelFingerprint)!;savedServerFingerprint.current=JSON.stringify({answers:clean.answers,documentText:clean.documentText,modelFingerprint});setServerSavedAt(serverDraft.savedAt);}
      setSchema(value);
    }).catch(error=>{if(active)setError(error instanceof Error?error.message:'Não foi possível carregar o formulário de conceito e ata.');}).finally(()=>{if(active)setDraftLoaded(true);});
    return()=>{active=false;};
  },[process.id,process.dataRevision,canFillConcept,schemaRetry]);

  useEffect(() => {
    if (!draftLoaded || !schema || !canFillConcept) return;
    writeDraft(process, answers, confirmed,documentEdited?documentText:undefined,schema.ataModelFingerprint);
    setDraftSavedAt(new Date().toISOString());
  }, [answers, confirmed, documentText, documentEdited, canFillConcept, process.id, process.dataRevision,draftLoaded,schema]);

  useEffect(()=>{
    if(!draftLoaded||!canFillConcept||!schema||draftFingerprint===savedServerFingerprint.current)return;
    const timer=window.setTimeout(()=>{
      if(saveInFlight.current){savePending.current=true;return;}
      saveInFlight.current=true;
      const sentFingerprint=draftFingerprint;
      void apiClient.saveEvaluationDraft(process.id,answers,process.dataRevision,documentEdited?documentText:undefined,schema.ataModelFingerprint).then(saved=>{
        savedServerFingerprint.current=sentFingerprint;setServerSavedAt(saved.savedAt);setError('');
      }).catch(e=>setError(e instanceof Error?e.message:'Não foi possível salvar o rascunho de conceito e ata.')).finally(()=>{
        saveInFlight.current=false;
        if(savePending.current){savePending.current=false;setAutosaveRetry(n=>n+1);}
      });
    },30000);
    return()=>window.clearTimeout(timer);
  },[answers,draftFingerprint,documentText,documentEdited,canFillConcept,schema,process.id,process.dataRevision,autosaveRetry,draftLoaded]);

  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(timer); }, []);
  const studio = schema?.studio;
  const fields = evaluationQuestions(studio);
  const outcomeOptions = schema?.outcomes || [];
  const values = { ...answers };
  const standardOpinion = () => {
    const selected = outcomeOptions.find((option) => option.code === answers.RESULTADO);
    if(!selected){setError('Selecione o resultado deliberado pela banca antes de inserir o texto-padrão.');return '';}
    return standardEvaluationOpinion(selected, Math.random, String(answers.PARECER||''));
  };
  const requireCoadvisorAttendance=()=>{
    if(process.coorientador && !['Sim','Não'].includes(String(answers.COORIENTADOR_PRESENTE||'')))throw new Error('Informe se o coorientador participou da sessão de defesa.');
  };
  const submit = async () => {
    if(!canFillConcept||finalizeInFlight.current)return;
    setError(''); setNotice('');
    if (!schema) { setError('Aguarde o carregamento do formulário.'); return; }
    if(!formalConsent||!previewLoaded||!preview||preview.fingerprint!==reviewFingerprint){setError('Confirme o encerramento da ata antes de concluir o registro.');return;}
    finalizeInFlight.current=true;
    setPreparingSignature(true);
    setBusy(true);
    try {
      requireCoadvisorAttendance();
      const data = acceptEvaluationAnswers({ resultadoCode: answers.RESULTADO, parecer: answers.PARECER, answers }, outcomeOptions, studio);
      const response = await apiClient.submitEvaluation(process.id, { ...data, ...(documentEdited?{documentText,expectedModelFingerprint:schema?.ataModelFingerprint}:{}), signatureProvider, previewToken:preview.token, correctedDocumentText:editingDocument?correctedText:undefined, dataConfirmed: true, expectedDataRevision: process.dataRevision, expectedSchemaRevision: Number(studio?.revision || 0) });
      clearDraft(process.id);
      setDraftSavedAt('');
      setServerSavedAt('');
      setNotice(response.workflowPending ? 'Conceito e ata registrados. Há ações posteriores pendentes.' : 'Conceito e ata registrados.');
      closePreview();
      onUpdated(response,response.documents);
    } catch (e) {
      const uncertain=!(e instanceof ApiRequestError)||e.status===0||e.status>=500||e.code==='EVALUATION_ALREADY_SUBMITTED';
      const current=uncertain?await apiClient.getProcessById(process.id).catch(()=>undefined):undefined;
      if(current?.avaliacao.status==='CONCLUIDO'&&current.avaliacao.dataReview?.sourceDataRevision===process.dataRevision){
        clearDraft(process.id);
        setNotice('Já existe uma ata registrada para esta defesa. Confira a versão em Documentos administrativos.');
        closePreview();
        onUpdated(current,undefined,true);
      }else setError(e instanceof Error ? e.message : 'Não foi possível registrar o conceito e a ata.');
    }
    finally { finalizeInFlight.current=false;setPreparingSignature(false);setBusy(false); }
  };
  const viewAta=async()=>{
    if(!canFillConcept||!schema)return;
    setBusy(true);setError('');setFormalConsent(false);setPreviewLoaded(false);
    try{
      requireCoadvisorAttendance();
      const data=acceptEvaluationAnswers({resultadoCode:answers.RESULTADO,parecer:answers.PARECER,answers},outcomeOptions,studio);
      const result=await apiClient.previewEvaluation(process.id,{...data,...(documentEdited?{documentText,expectedModelFingerprint:schema?.ataModelFingerprint}:{}),signatureProvider,expectedDataRevision:process.dataRevision,expectedSchemaRevision:Number(studio?.revision||0)});
      const url=result.downloadUrl||URL.createObjectURL(new Blob([Uint8Array.from(atob(result.contentBase64||''),c=>c.charCodeAt(0))],{type:'application/pdf'}));
      setPreview(previous=>{if(previous?.url.startsWith('blob:'))URL.revokeObjectURL(previous.url);return {url,token:result.previewToken,fingerprint:reviewFingerprint,documentText:result.documentText,layout:result.documentLayout||result.documentText?.split('\n').map(text=>({runs:[{text}]}))||[]};});setEditingDocument(false);setCorrectedText(undefined);
    }catch(error){setError(error instanceof Error?error.message:'Não foi possível visualizar a Ata.');}finally{setBusy(false);}
  };

  const signatureFeedback = <div role="status" aria-live="polite" aria-atomic="true" className="flex items-center gap-3 rounded-lg border border-slate-300 bg-slate-100 p-3 text-sm text-slate-800">
    <LoaderCircle aria-hidden="true" className="h-5 w-5 shrink-0 animate-spin motion-reduce:animate-none text-[var(--portal-brand-header)]"/>
    <div><p className="font-semibold">Registrando conceito e ata…</p><p>Aguarde a confirmação nesta tela. Isso pode levar alguns instantes.</p></div>
  </div>;

  return <section id="evaluation-section" className="space-y-3" aria-labelledby="evaluation-title">
    <h2 id="evaluation-title" className="sr-only">Conceito e Ata</h2>
    {preparingSignature&&!preview&&signatureFeedback}
    {process.avaliacao?.status==='CONCLUIDO'&&canReopen&&<button type="button" className="portal-action m-4" onClick={onReopen}>Reabrir conceito e ata</button>}
    <div className="portal-card space-y-5 p-4 sm:p-5">


      {error && <p role="alert" className="portal-error">{error}<button type="button" onClick={()=>{attemptedFinalization.current='';setAutosaveRetry(n=>n+1);}} className="ml-2 rounded-full border border-slate-300 bg-white px-2 py-1 text-xs text-slate-900">Tentar novamente</button></p>}
      {publicReadOnly && !process.legacyRecord && process.avaliacao?.status === 'CONCLUIDO' && !process.avaliacao.resultadoCode
        ? <p role="status" className="text-center text-sm">Conceito e ata ainda não disponíveis.</p>
        : process.avaliacao?.status === 'CONCLUIDO' || process.legacyRecord ? <>
        <dl className="grid gap-4 sm:grid-cols-2"><div><dt>Conceito</dt><dd className="font-semibold">{process.avaliacao.resultadoLabel || process.avaliacao.resultadoCode || 'Não informado'}</dd></div>{!publicReadOnly&&<div><dt>Responsável pelo registro</dt><dd>{process.avaliacao.submittedBy}</dd></div>}</dl>
        <p className="whitespace-pre-wrap">{process.avaliacao.parecer || (process.legacyRecord ? 'Parecer não informado no acervo importado.' : '')}</p>

      </> : !canFillConcept ? !released && canEvaluate
        ? <p role="status" className="portal-instruction p-3 text-center text-sm">{releaseBlocker} A avaliação e o lançamento de notas e frequência devem ser feitos no Portal do Professor.</p>
        : <p role="status" className="text-center text-sm">{released ? 'Conceito e ata ainda não registrados.' : 'Conceito e ata ainda não disponíveis.'}</p>
        : !schema ? error ? <button type="button" className="portal-action" onClick={() => setSchemaRetry(n => n + 1)}>Tentar carregar o formulário novamente</button> : <p role="status">Carregando o formulário do orientador…</p> : <div className="space-y-5">

        <p role="note" className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm font-semibold text-red-800">Nesta tela, registre o conceito da defesa e preencha a ata. Faça a avaliação e lance as notas e a frequência diretamente no <a className="font-bold underline text-red-800" href="https://professor.ufes.br/" target="_blank" rel="noopener noreferrer">Portal do Professor</a>.</p>

        <fieldset disabled={busy} className="grid gap-5 sm:grid-cols-2">
          <legend className="sr-only">Conceito e parecer da defesa</legend>
          {[...fields.filter(field=>field.fieldKey==='RESULTADO'),...fields.filter(field=>field.fieldKey!=='RESULTADO'&&field.fieldKey!=='COORIENTADOR_PRESENTE')].filter(field=>evaluateStudioCondition(field.visibleWhen,values)).map(field => {
            const key = field.fieldKey, value = answers[key] ?? '';
            const id = `evaluation-${key}`;
            const common = { id, className: 'portal-input', required: Boolean(field.required), 'aria-describedby': field.helpText ? `${id}-help` : undefined };
            return <React.Fragment key={key}><label htmlFor={id} className={`block ${field.fieldType === 'textarea' ? 'sm:col-span-2' : ''}`}><span className="mb-2 block font-semibold">{field.label}{field.required ? ' *' : ''}</span>
              {key === 'RESULTADO' ? <select {...common} value={String(value)} onChange={e => setAnswers(a => ({ ...a, [key]: e.target.value }))}><option value="">Selecione o resultado…</option>{outcomeOptions.map(o => <option key={o.code} value={o.code}>{evaluationOutcomeLabel(o)}</option>)}</select>
                : key === 'PARECER' ? <div><div className="relative"><textarea {...common} style={{paddingBottom:42}} rows={6} maxLength={field.validation?.maxLength || 10000} value={String(value)} onChange={e => setAnswers(a => ({ ...a, [key]: e.target.value }))} /><button type="button" className="portal-evaluation-standard-opinion absolute bottom-3 right-3" onClick={() => {const opinion=standardOpinion();if(opinion)setAnswers(a => ({ ...a, PARECER:opinion }));}}>Gerar rascunho de parecer</button></div><p className="mt-2 text-xs leading-5 text-slate-600">Texto-base revisável: confira se cada afirmação corresponde ao trabalho e à defesa. Se quiser, acrescente as considerações da banca ao final.</p></div>
                : field.fieldType === 'textarea' ? <textarea {...common} rows={5} maxLength={field.validation?.maxLength || 10000} value={String(value)} onChange={e => setAnswers(a => ({ ...a, [key]: e.target.value }))} />
                : field.fieldType === 'checkbox' ? <input {...common} className="h-5 w-5" type="checkbox" checked={value === true} onChange={e => setAnswers(a => ({ ...a, [key]: e.target.checked }))} />
                : ['select', 'radio'].includes(field.fieldType) ? <select {...common} value={String(value)} onChange={e => setAnswers(a => ({ ...a, [key]: e.target.value }))}><option value="">Selecione…</option>{field.options?.map(o => <option key={o}>{o}</option>)}</select>
                : <input {...common} type={['number', 'date', 'email'].includes(field.fieldType) ? field.fieldType : 'text'} maxLength={field.validation?.maxLength || 1000} value={String(value)} onChange={e => setAnswers(a => ({ ...a, [key]: e.target.value }))} />}
              {field.helpText && <span id={`${id}-help`} className="mt-1 block text-sm">{field.helpText}</span>}
            </label>{key==='RESULTADO'&&process.coorientador&&<label className="block"><span className="mb-2 block font-semibold">O coorientador participou da sessão de defesa? *</span><select className="portal-input" value={String(answers.COORIENTADOR_PRESENTE||'')} onChange={event=>setAnswers(current=>({...current,COORIENTADOR_PRESENTE:event.target.value}))}><option value="">Selecione…</option><option value="Sim">Sim</option><option value="Não">Não</option></select><span className="mt-1 block text-sm">Se participou, o coorientador também assinará a ata.</span></label>}</React.Fragment>;
          })}
        </fieldset>
        <button type="button" className="portal-action portal-action-primary" disabled={busy} onClick={()=>void viewAta()}>{busy?'Preparando Ata…':'Visualizar ata'}</button>

      </div>}
    </div>
    {preview&&<div className="portal-modal-backdrop fixed inset-0 z-[1000012] flex items-center justify-center p-4" onMouseDown={event=>{if(event.currentTarget===event.target&&!busy&&!editingDocument)closePreview();}}>
      <div role="dialog" aria-modal="true" aria-label="Conferir Ata da defesa" style={preparingSignature?{cursor:'wait'}:undefined} className="flex h-full max-h-screen w-full max-w-5xl flex-col overflow-hidden rounded-xl bg-white">
        <header className="portal-modal-header"><FileText className="h-5 w-5"/><h2>{editingDocument?'Corrigir ata':'Conferir ata da defesa'}</h2></header>
        {editingDocument?<AtaReviewEditor paragraphs={preview.layout} disabled={busy} onChange={text=>{setCorrectedText(text.trimEnd()===preview.documentText?.trimEnd()?undefined:text);setFormalConsent(false);}}/>
          :<React.Suspense fallback={<p>Carregando Ata…</p>}><DocumentFilePreview url={preview.url} format="pdf" label="Ata da defesa" onLoaded={()=>setPreviewLoaded(true)}/></React.Suspense>}
        <div className="space-y-3 border-t p-4">
          {preparingSignature&&signatureFeedback}
          <label className="flex items-start gap-2"><input type="checkbox" checked={formalConsent} disabled={!previewLoaded||busy} onChange={event=>setFormalConsent(event.target.checked)}/><span>{editingDocument?'Conferi a ata com as correções.':'Visualizei a ata.'} Confirmo que o resultado, o parecer e os dados correspondem à defesa e autorizo o registro e a preparação para assinatura.</span></label>
          {editingDocument
            ?<button type="button" className="portal-action" disabled={busy} onClick={()=>{setEditingDocument(false);setCorrectedText(undefined);setFormalConsent(false);}}>Cancelar correção</button>
            :<button type="button" className="portal-action" disabled={!previewLoaded||busy||!preview.layout.length} onClick={()=>{setFormalConsent(false);setEditingDocument(true);}}>Corrigir ata</button>}
          <button type="button" className="portal-action portal-action-primary" aria-busy={preparingSignature} disabled={!formalConsent||!previewLoaded||busy} onClick={()=>void submit()}>
            {preparingSignature?'Registrando conceito e ata…':editingDocument?'Salvar e continuar':'Registrar conceito e ata e ir para documentos'}
          </button>
          {error&&<p role="alert" className="text-sm text-red-800">{error}</p>}
        </div>
      </div>
    </div>}
  </section>;
}
