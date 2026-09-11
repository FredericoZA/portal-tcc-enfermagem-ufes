import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiClient } from '../services/apiClient';
import { portalNotice } from '../services/portalDialogs';
import { evaluateStudioCondition, validateStudioAnswer } from '../utils/courseStudioValidator';
import { registrationQuestions, registrationPayload } from '../utils/operationalConfig';
import { registrationFindings, workflowPolicy } from '../utils/workflowOperations';
import type { RegistrationAnswers, RegistrationQuestion } from '../types/operationalConfig';
import type { IntegrationStudioSettings } from '../types/integrationStudio';

function Question({ field, value, readOnly, onChange }: { field: RegistrationQuestion; value: unknown; readOnly: boolean; onChange: (value: string|boolean)=>void }) {
  return <label className={`block ${field.fieldType==='textarea'?'sm:col-span-2':''}`}>
    <span className="mb-2 block text-sm font-semibold">{field.label}{field.required?' *':''}</span>
    {field.fieldType==='checkbox'?<input type="checkbox" className="h-6 w-6" checked={value===true} onChange={e=>onChange(e.target.checked)}/>:
      field.fieldType==='textarea'?<textarea className="portal-input" rows={5} value={String(value??'')} maxLength={field.validation?.maxLength||10000} onChange={e=>onChange(e.target.value)}/>:
      ['select','radio'].includes(field.fieldType)?<select className="portal-input" value={String(value??'')} onChange={e=>onChange(e.target.value)}><option value="">Selecione…</option>{field.options?.map(option=><option key={option}>{option}</option>)}</select>:
      <input className="portal-input" type={['email','number','date','datetime-local'].includes(field.fieldType)?field.fieldType:'text'} readOnly={readOnly} value={String(value??'')} placeholder={field.placeholder} maxLength={field.validation?.maxLength||500} onChange={e=>onChange(e.target.value)}/>}
    {field.helpText&&<span className="mt-1 block text-sm opacity-80">{field.helpText}</span>}
  </label>;
}
export function ConfigurableRegistration({ onSuccess, onCancel }: { onSuccess:(id:string)=>void; onCancel:()=>void }) {
  const { userEmail, settings, isMasterAdmin }=useAuth();
  const [studio,setStudio]=useState<Partial<IntegrationStudioSettings>|undefined>(settings?.integrationStudio);
  const [answers,setAnswers]=useState<RegistrationAnswers>({ALUNO_1_EMAIL:userEmail,TEM_ALUNO_2:'Não',TEM_COORIENTADOR:'Não'});
  const [section,setSection]=useState(0);
  const [error,setError]=useState('');
  const [busy,setBusy]=useState(false);
  const [eligibility,setEligibility]=useState<'loading'|'ready'|'existing'|'error'>('loading');
  const [draftStatus,setDraftStatus]=useState('');
  const [draftReview,setDraftReview]=useState(false);
  const draftRevision=useRef(0), draftQueue=useRef(Promise.resolve()), paused=useRef(false);
  const fields=registrationQuestions(studio);
  const sections=[...new Set(fields.map(f=>f.section||'Trabalho'))].filter(s=>s!=='Reserva do local').concat('Reserva do local');
  const currentSection=Math.min(section,sections.length-1);
  const visible=fields.filter(f=>evaluateStudioCondition(f.visibleWhen,answers));
  const selected=visible.filter(f=>(f.section||'Trabalho')===sections[currentSection]);
  const findings=registrationFindings(Object.fromEntries(visible.map(f=>[f.fieldKey,answers[f.fieldKey]??''])),workflowPolicy(studio));
  useEffect(()=>{
    let cancelled=false;
    Promise.all([apiClient.getProcesses(),apiClient.getRegistrationSchema(),apiClient.getRegistrationDraft()]).then(([processes,schema,draft])=>{
      if(cancelled)return;setStudio(schema);
      const existing=!isMasterAdmin&&processes.some(p=>[p.aluno1.email,p.aluno2?.email].some(email=>email?.toLowerCase()===userEmail.toLowerCase()));
      if(draft&&!existing&&!isMasterAdmin){setAnswers({...draft.answers,ALUNO_1_EMAIL:userEmail});setSection(draft.section);draftRevision.current=draft.revision;setDraftStatus('Rascunho recuperado do servidor.');if(draft.schemaRevision!==schema.revision){paused.current=true;setDraftReview(true);}}
      setEligibility(existing?'existing':'ready');
    }).catch(()=>{if(!cancelled)setEligibility('error');});
    return()=>{cancelled=true;};
  },[userEmail,isMasterAdmin]);
  const queueSave=()=>{
    if(paused.current||isMasterAdmin)return;
    setDraftStatus('Salvando rascunho…');
    draftQueue.current=draftQueue.current.then(async()=>{
      if(paused.current)return;
      try{const saved=await apiClient.saveRegistrationDraft({answers,section:currentSection,expectedRevision:draftRevision.current,schemaRevision:Number(studio?.revision||0)});draftRevision.current=saved.revision;setDraftStatus('Rascunho salvo no servidor.');}
      catch(e){paused.current=true;setDraftStatus(e instanceof Error?e.message:'Falha ao salvar. Seus campos continuam nesta tela.');}
    });
  };
  useEffect(()=>{
    if(eligibility!=='ready'||busy||paused.current||isMasterAdmin)return;
    const timer=setTimeout(queueSave,900);return()=>clearTimeout(timer);
  },[answers,currentSection,eligibility,busy,studio?.revision,isMasterAdmin,draftReview]);
  const check=(all:boolean)=>{
    for(const field of all?visible:selected){const value=answers[field.fieldKey];
      if(field.required&&(!String(value??'').trim()||field.fieldType==='checkbox'&&value!==true))return `Preencha: ${field.label}.`;
      if(value&&field.fieldType==='email'&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value)))return `Revise o e-mail: ${field.label}.`;
      if(value&&field.options?.length&&!field.options.includes(String(value)))return `Selecione uma opção válida: ${field.label}.`;
      const issue=value!==undefined&&value!==''?validateStudioAnswer(value,field.validation):null;if(issue)return `${field.label}: ${issue}`;
    }return '';
  };
  const submit=async(event:React.FormEvent)=>{
    event.preventDefault();const problem=check(currentSection===sections.length-1);if(problem){setError(problem);return;}setError('');
    if(currentSection<sections.length-1){setSection(currentSection+1);return;}
    if(draftReview){setError('Confira a mudança do formulário e aceite a revisão atual antes de enviar.');return;}
    setBusy(true);paused.current=true;
    try{await draftQueue.current;const accepted=Object.fromEntries(visible.map(f=>[f.fieldKey,answers[f.fieldKey]??'']));const result=await apiClient.createProcess(registrationPayload(accepted,studio?.operationsPolicy?.timezone||'America/Sao_Paulo'));if(result.workflowPending)portalNotice(`Cadastro salvo. O pedido de reserva ainda está pendente: ${result.workflowError||'a secretaria deve acompanhar a etapa.'}`);onSuccess(result.id);}
    catch(e){setError(e instanceof Error?e.message:'Não foi possível cadastrar o TCC.');paused.current=false;}
    finally{setBusy(false);}
  };
  if(eligibility!=='ready')return <section className="portal-card p-6" aria-live="polite"><p>{eligibility==='loading'?'Verificando acesso e rascunho…':eligibility==='existing'?'Você já possui um TCC. Continue em Meus TCCs.':'Não foi possível carregar o cadastro. Atualize a página para tentar novamente.'}</p><button type="button" onClick={onCancel} className="portal-action mt-4">Voltar</button></section>;
  return <form onSubmit={submit} className="portal-workspace mx-auto max-w-4xl space-y-5" aria-labelledby="registration-title">
    <header className="portal-card p-5"><p>Etapa {currentSection+1} de {sections.length}</p><h1 id="registration-title" className="mt-1 text-2xl font-bold">{String(studio?.formTemplates?.find(f=>f.id==='form-reserva-aluno')?.title||'Cadastrar meu TCC')}</h1><p className="mt-2">O departamento receberá o pedido de reserva. Após a confirmação, registre o local autorizado para enviar o convite à banca.</p><progress aria-label="Progresso do cadastro" className="mt-3 h-2 w-full" value={currentSection+1} max={sections.length}/>{!isMasterAdmin&&<p role="status" className="mt-2 text-sm">{draftStatus} Expiração após {workflowPolicy(studio).draftExpiryDays} dias sem salvar.</p>}</header>
    {draftReview&&<aside role="alert" className="portal-card p-4"><p>O Master publicou uma nova versão do formulário. Confira os campos recuperados; perguntas removidas não entrarão no cadastro.</p><button type="button" className="portal-action mt-3" onClick={()=>{paused.current=false;setDraftReview(false);}}>Conferi e vou usar a versão atual</button></aside>}
    {error&&<p role="alert" className="rounded-xl border border-red-300 bg-red-50 p-4 text-red-900">{error}</p>}
    <fieldset disabled={busy} className="portal-card grid gap-5 p-5 sm:grid-cols-2"><legend className="px-2 text-lg font-bold">{sections[currentSection]}</legend>{selected.map(field=><React.Fragment key={field.fieldKey}><Question field={field} value={answers[field.fieldKey]} readOnly={field.fieldKey==='ALUNO_1_EMAIL'&&!isMasterAdmin} onChange={value=>setAnswers(a=>({...a,[field.fieldKey]:value}))}/></React.Fragment>)}</fieldset>
    {currentSection===sections.length-1&&<><p className="portal-card p-4">Horário no fuso {studio?.operationsPolicy?.timezone||'America/Sao_Paulo'}. A reserva deve ser confirmada antes do convite.</p>{findings.length>0&&<aside className="portal-card p-4"><h2 className="font-bold">Confira antes de gerar os documentos</h2><ul className="mt-2 list-disc space-y-2 pl-5">{findings.map((item,i)=><li key={i}>{fields.find(f=>f.fieldKey===item.fieldKey)?.label||item.fieldKey}: {item.message}</li>)}</ul><p className="mt-2 text-sm">São alertas de conferência. Nenhuma identidade será alterada automaticamente.</p></aside>}</>}
    <footer className="flex flex-wrap justify-between gap-3"><button type="button" className="portal-action" disabled={busy} onClick={async()=>{queueSave();await draftQueue.current;if(currentSection)setSection(currentSection-1);else if(paused.current&&!isMasterAdmin)setError('O rascunho não foi salvo. Mantenha esta tela aberta e confira a mensagem de salvamento antes de sair.');else onCancel();}}>{currentSection?'Voltar':isMasterAdmin?'Voltar':'Salvar e sair'}</button><button type="submit" className="portal-action portal-action-primary" disabled={busy}>{busy?'Cadastrando…':currentSection<sections.length-1?'Continuar':'Cadastrar e solicitar reserva'}</button></footer>
  </form>;
}
