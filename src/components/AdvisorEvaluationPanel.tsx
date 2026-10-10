import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { ProcessData } from '../types';
import type { RegistrationAnswers } from '../types/operationalConfig';
import { apiClient } from '../services/apiClient';
import { acceptEvaluationAnswers, EVALUATION_FORM_ID, evaluationQuestions } from '../utils/evaluationForm';
import { evaluateStudioCondition } from '../utils/courseStudioValidator';

interface EvaluationDraft {
  processId: string;
  dataRevision: number;
  answers: RegistrationAnswers;
  confirmed: boolean;
  savedAt: string;
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

function writeDraft(process: ProcessData, answers: RegistrationAnswers, confirmed: boolean) {
  if (typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.setItem(draftKey(process.id), JSON.stringify({
      processId: process.id,
      dataRevision: process.dataRevision,
      answers,
      confirmed,
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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState(initialDraft ? 'Rascunho recuperado automaticamente após a atualização da página.' : '');
  const [now, setNow] = useState(Date.now());
  const [schemaRetry, setSchemaRetry] = useState(0);
  const [draftSavedAt, setDraftSavedAt] = useState(initialDraft?.savedAt || '');
  const [serverSavedAt,setServerSavedAt]=useState('');
  const [autosaveRetry,setAutosaveRetry]=useState(0);
  const saveInFlight=useRef(false);
  const savePending=useRef(false);
  const savedServerFingerprint=useRef('');
  const attemptedFinalization=useRef('');
  const finalizeInFlight=useRef(false);
  const fingerprint=JSON.stringify(answers);

  useEffect(() => {
    let active = true;
    const restored = readDraft(process);
    setConfirmed(Boolean(restored?.confirmed));
    setAnswers(restored?.answers || {});
    setDraftSavedAt(restored?.savedAt || '');
    setSchema(null);
    setError('');
    if (restored) setNotice('Rascunho recuperado automaticamente após a atualização da página.');
    if (canEvaluate) {
      apiClient.getEvaluationSchema(process.id).then(value => { if(active)setSchema(value); }).catch(e=>{if(active)setError(e.message);});
      apiClient.getEvaluationDraft(process.id).then(draft=>{
        if(!active||!draft||draft.dataRevision!==process.dataRevision)return;
        setAnswers(previous=>Object.keys(previous).length?previous:draft.answers);
        savedServerFingerprint.current=JSON.stringify(draft.answers);
        setServerSavedAt(draft.savedAt);
      }).catch(e=>{if(active)setError(e instanceof Error?e.message:'Não foi possível restaurar o rascunho do servidor.');});
    }
    return () => { active = false; };
  }, [process.id, process.dataRevision, canEvaluate, schemaRetry]);

  useEffect(() => {
    if (!canEvaluate || process.avaliacao.status === 'CONCLUIDO') return;
    const timer = window.setTimeout(() => {
      writeDraft(process, answers, confirmed);
      setDraftSavedAt(new Date().toISOString());
    }, 350);
    return () => window.clearTimeout(timer);
  }, [answers, confirmed, canEvaluate, process.id, process.dataRevision, process.avaliacao.status]);

  useEffect(()=>{
    if(!canEvaluate||!schema||process.avaliacao.status==='CONCLUIDO'||fingerprint===savedServerFingerprint.current)return;
    const timer=window.setTimeout(()=>{
      if(saveInFlight.current){savePending.current=true;return;}
      saveInFlight.current=true;
      const sentFingerprint=fingerprint;
      void apiClient.saveEvaluationDraft(process.id,answers,process.dataRevision).then(saved=>{
        savedServerFingerprint.current=sentFingerprint;setServerSavedAt(saved.savedAt);setError('');
      }).catch(e=>setError(e instanceof Error?e.message:'Não foi possível salvar a avaliação no servidor.')).finally(()=>{
        saveInFlight.current=false;
        if(savePending.current){savePending.current=false;setAutosaveRetry(n=>n+1);}
      });
    },600);
    return()=>window.clearTimeout(timer);
  },[answers,fingerprint,canEvaluate,schema,process.id,process.dataRevision,process.avaliacao.status,autosaveRetry]);

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
    const label = String(selected?.label || '').toLowerCase();
    if (label.includes('ressalva')) return 'A banca examinadora deliberou pela aprovação do Trabalho de Conclusão de Curso com ressalva, condicionada ao atendimento das observações registradas neste parecer.';
    if (label.includes('reprov')) return 'A banca examinadora deliberou pela reprovação do Trabalho de Conclusão de Curso, conforme fundamentação registrada neste parecer.';
    return 'A banca examinadora deliberou pela aprovação do Trabalho de Conclusão de Curso.';
  };
  const submit = async () => {
    setError(''); setNotice('');
    if (!schema) { setError('Aguarde o carregamento do formulário.'); return; }
    setBusy(true);
    try {
      const data = acceptEvaluationAnswers({ resultadoCode: answers.RESULTADO, parecer: answers.PARECER, answers }, outcomeOptions, studio);
      const response = await apiClient.submitEvaluation(process.id, { ...data, dataConfirmed: true, expectedDataRevision: process.dataRevision, expectedSchemaRevision: Number(studio.revision || 0) } as any);
      clearDraft(process.id);
      setDraftSavedAt('');
      setServerSavedAt('');
      setNotice(response.workflowPending ? `Avaliação salva. A geração ou o encaminhamento da ata está pendente: ${response.workflowError || 'a secretaria deve acompanhar a etapa.'}` : 'Avaliação salva. Acompanhe a ata e sua assinatura na Asten na área de documentos.');
      await onUpdated();
    } catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível salvar a avaliação.'); }
    finally { setBusy(false); }
  };
  useEffect(()=>{
    if(!canEvaluate||!schema||!released||busy||process.avaliacao.status==='CONCLUIDO'||!hasRequiredAnswers)return;
    if(fingerprint!==savedServerFingerprint.current||attemptedFinalization.current===fingerprint)return;
    const timer=window.setTimeout(()=>{
      if(finalizeInFlight.current||attemptedFinalization.current===fingerprint)return;
      try{acceptEvaluationAnswers({resultadoCode:answers.RESULTADO,parecer:answers.PARECER,answers},outcomeOptions,studio);}catch{return;}
      attemptedFinalization.current=fingerprint;finalizeInFlight.current=true;
      void submit().finally(()=>{finalizeInFlight.current=false;});
    },7000);
    return()=>window.clearTimeout(timer);
  },[answers,fingerprint,schema,canEvaluate,released,busy,process.avaliacao.status,serverSavedAt,hasRequiredAnswers]);

  return <section id="evaluation-section" className="portal-card overflow-hidden" aria-labelledby="evaluation-title">
    <header className="portal-section-header flex flex-wrap items-center justify-between gap-3 p-4">
      <div>
        <h2 id="evaluation-title" className="text-lg font-bold">Avaliação e ata da defesa</h2>
        {draftSavedAt && process.avaliacao.status !== 'CONCLUIDO' && <p className="mt-1 text-[11px] text-slate-500">Rascunho local salvo às {new Date(draftSavedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}.</p>}
      </div>
      {process.avaliacao.status === 'CONCLUIDO' && canReopen && <button id="reopen-evaluation-btn" type="button" className="portal-action" onClick={onReopen}>Reabrir avaliação</button>}
    </header>
    <div className="space-y-5 p-4 sm:p-5">
      {notice && <p role="status" className="portal-notice">{notice}</p>}
      {canEvaluate&&process.avaliacao.status!=='CONCLUIDO'&&<p role="status" className="text-xs font-medium text-slate-600">{busy?'Finalizando avaliação…':saveInFlight.current?'Salvando no servidor…':fingerprint===savedServerFingerprint.current&&serverSavedAt?'Salvo no servidor às '+new Date(serverSavedAt).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}):'Aguardando salvamento automático…'} {hasRequiredAnswers&&released?'· A ata será concluída automaticamente após alguns segundos sem novas edições.':''}</p>}
      {error && <p role="alert" className="portal-error">{error}<button type="button" onClick={()=>{attemptedFinalization.current='';setAutosaveRetry(n=>n+1);}} className="ml-2 rounded-full border border-slate-300 bg-white px-2 py-1 text-xs text-slate-900">Tentar novamente</button></p>}
      {process.avaliacao.status === 'CONCLUIDO' ? <>
        <dl className="grid gap-4 sm:grid-cols-2"><div><dt>Resultado</dt><dd className="font-semibold">{process.avaliacao.resultadoLabel || process.avaliacao.resultadoCode || 'Não informado'}</dd></div><div><dt>Responsável pelo registro</dt><dd>{process.avaliacao.submittedBy}</dd></div></dl>
        <p className="whitespace-pre-wrap">{process.avaliacao.parecer}</p>

      </> : !canEvaluate ? <p role="status" className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">Você não possui permissão para preencher esta avaliação. O registro é reservado ao orientador autorizado.</p> : !schema ? error ? <button type="button" className="portal-action" onClick={() => setSchemaRetry(n => n + 1)}>Tentar carregar o formulário novamente</button> : <p role="status">Carregando o formulário do orientador…</p> : <div className="space-y-5">
        <p>Informe apenas o resultado da apresentação e o parecer da banca. O Portal salva o rascunho automaticamente e conclui a ata quando todos os campos estão completos.</p>
        {!released && <p className="portal-notice">{!process.defesa.invitationSentAt ? 'O registro será liberado após a confirmação do local e o envio do convite.' : 'A avaliação será liberada no horário da apresentação.'}</p>}
        <fieldset disabled={busy || !released} className="grid gap-5 sm:grid-cols-2">
          <legend className="mb-3 text-lg font-semibold">{String(studio.formTemplates?.find(f => f.id === EVALUATION_FORM_ID)?.title || 'Resultado da apresentação')}</legend>
          {fields.filter(f=>['RESULTADO','PARECER'].includes(f.fieldKey)).map(field => {
            const key = field.fieldKey, value = answers[key] ?? '';
            const id = `evaluation-${key}`;
            const common = { id, className: 'portal-input', required: Boolean(field.required), 'aria-describedby': field.helpText ? `${id}-help` : undefined };
            return <label key={key} htmlFor={id} className={`block ${field.fieldType === 'textarea' ? 'sm:col-span-2' : ''}`}><span className="mb-2 block font-semibold">{field.label}{field.required ? ' *' : ''}</span>
              {key === 'RESULTADO' ? <select {...common} value={String(value)} onChange={e => setAnswers(a => ({ ...a, [key]: e.target.value }))}><option value="">Selecione o resultado…</option>{outcomeOptions.map(o => <option key={o.code} value={o.code}>{o.label}</option>)}</select>
                : key === 'PARECER' ? <><textarea {...common} rows={5} maxLength={field.validation?.maxLength || 10000} value={String(value)} onChange={e => setAnswers(a => ({ ...a, [key]: e.target.value }))} /><button type="button" className="portal-action mt-2" onClick={() => setAnswers(a => ({ ...a, PARECER: standardOpinion() }))}>Usar texto-padrão</button></>
                : field.fieldType === 'textarea' ? <textarea {...common} rows={5} maxLength={field.validation?.maxLength || 10000} value={String(value)} onChange={e => setAnswers(a => ({ ...a, [key]: e.target.value }))} />
                : field.fieldType === 'checkbox' ? <input {...common} className="h-5 w-5" type="checkbox" checked={value === true} onChange={e => setAnswers(a => ({ ...a, [key]: e.target.checked }))} />
                : ['select', 'radio'].includes(field.fieldType) ? <select {...common} value={String(value)} onChange={e => setAnswers(a => ({ ...a, [key]: e.target.value }))}><option value="">Selecione…</option>{field.options?.map(o => <option key={o}>{o}</option>)}</select>
                : <input {...common} type={['number', 'date', 'email'].includes(field.fieldType) ? field.fieldType : 'text'} maxLength={field.validation?.maxLength || 1000} value={String(value)} onChange={e => setAnswers(a => ({ ...a, [key]: e.target.value }))} />}
              {field.helpText && <span id={`${id}-help`} className="mt-1 block text-sm">{field.helpText}</span>}
            </label>;
          })}
        </fieldset>
      </div>}
    </div>
  </section>;
}