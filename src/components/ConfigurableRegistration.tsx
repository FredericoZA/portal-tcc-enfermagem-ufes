import {DEFENSE_WEEKDAY_MESSAGE,isDefenseWeekday} from '../utils/defenseSchedule';
import {ReservationCalendarPicker} from './ReservationCalendarPicker';
import { PORTAL_REPOSITORY_CHANGED_EVENT } from '../utils/portalLiveEvents';
import {studioSampleProcess} from '../utils/studioRuntimePreview';
import {INSTITUTION_ACRONYM_HELP,renderInstitutionName} from '../utils/institutionName';
import {registrationFieldHelpText} from '../utils/registrationFieldHelpText';
import {identityField,readRegistrationMemory,saveRegistrationMemory,registrationFieldHistory,matchingRegistrationSuggestions} from '../utils/registrationHistory';
import {ReservationSchedulingNotice} from './ReservationSchedulingNotice';
import {RegistrationReview} from './RegistrationReview';
import {normalizePersonName} from '../utils/personNameCase';
import {withAuthorReference,registrationIdentityNames,registrationIdentitySentence} from '../utils/registrationIdentity';
import {academicName,authorIntroduction} from '../utils/personPresentation';
import { ClipboardList } from 'lucide-react';
import {normalizeRegistrationValue} from '../utils/registrationNormalization';
import {renderTccTitle,formatDateNumericWithWeekday,formatDateWithWeekday,saoPauloCalendarDate} from '../utils/formatters';
import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { RegistrationFieldPreview, registrationPreviewKind } from './RegistrationFieldPreview';
import { RegistrationMembersTable } from './RegistrationMembersTable';
import { resolveInstallationProfile } from '../utils/installationProfile';
import { getCustomLocationFieldValue, isOtherDefenseLocation, normalizeCustomLocationInput, renderCustomLocationName } from '../utils/customDefenseLocation';
import { apiClient, ApiRequestError } from '../services/apiClient';
import { portalNotice } from '../services/portalDialogs';
import {withBlockingPortalOperation} from '../services/portalOperations';
import {RegistrationDraftRecovery,RegistrationDraftRecoveryConflict} from '../services/registrationDraftRecovery';
import { evaluateStudioCondition, validateStudioAnswer } from '../utils/courseStudioValidator';
import { registrationQuestions, registrationPayload, registrationAnswersWithoutIdentifiers } from '../utils/operationalConfig';
import { registrationFindings, workflowPolicy } from '../utils/workflowOperations';
import type {StudentInfo} from '../types';
import type { RegistrationAnswers, RegistrationQuestion } from '../types/operationalConfig';
import type { IntegrationStudioSettings } from '../types/integrationStudio';

export function registrationReviewValue(field:RegistrationQuestion,value:unknown):string {
  if(value===undefined||value===null||value==='')return '';
  if(field.fieldKey==='TITULO')return renderTccTitle(String(value));
  if(/_INSTITUICAO$/.test(field.fieldKey))return renderInstitutionName(String(value));
  if(registrationPreviewKind(field.fieldKey,field.label,field.fieldType)==='location')return renderCustomLocationName(String(value));
  if(field.fieldKey==='DEFESA_LOCAL'&&value==='__OUTRO_LOCAL__')return 'Outro local';
  if(field.fieldType==='datetime-local'){const [date,time]=String(value).split('T');return `${formatDateNumericWithWeekday(date)}${time?` às ${time}`:''}`;}
  return typeof value==='boolean'?(value?'Sim':'Não'):String(value);
}

function registrationAuthorPreview(answers:RegistrationAnswers){
 answers=withAuthorReference(answers);
 const student=(n:number):StudentInfo=>({nome:normalizePersonName(String(answers[`ALUNO_${n}_NOME`]||'')),email:'',matricula:'',tratamento:answers[`ALUNO_${n}_TRATAMENTO`]==='Aluna'?'Aluna':answers[`ALUNO_${n}_TRATAMENTO`]==='Aluno'?'Aluno':undefined});
 return authorIntroduction({aluno1:student(1),aluno2:answers.TEM_ALUNO_2==='Sim'?student(2):null,authorOrder:'ALUNO_1_FIRST'});
}
function Question({ field, value, readOnly, onChange,optionLabels,recent=[], preview=false,suspended=false }: { field: RegistrationQuestion; value: unknown; readOnly: boolean;optionLabels?:Record<string,string>; recent?:string[]; preview?:boolean;suspended?:boolean; onChange: (value: string|boolean)=>void }) {
  const previewKind = registrationPreviewKind(field.fieldKey, field.label, field.fieldType);
  const helpText = registrationFieldHelpText(field.fieldKey, field.helpText);
  const [touched,setTouched]=useState(false);
  const [directory,setDirectory]=useState<string[]>([]);
  const [lookupQuery,setLookupQuery]=useState<string|null>(null);
  const lookupField=identityField(field.fieldKey)?(/_NOME$/.test(field.fieldKey)?'nome':/_EMAIL$/.test(field.fieldKey)?'email':''):'';
  const normalizedLookupValue=String(value??'').trim().toLowerCase();
  useEffect(()=>{
    setDirectory([]);
    // Restoring a saved field is not a directory search. Only typing starts one.
    if(preview||readOnly||suspended||!lookupField||lookupQuery===null||lookupQuery.length<3||lookupQuery!==normalizedLookupValue)return;
    const controller=new AbortController();
    const timer=setTimeout(()=>{apiClient.getRegistrationSuggestions(lookupField,lookupQuery,{signal:controller.signal}).then(values=>{if(!controller.signal.aborted)setDirectory(values);}).catch(()=>{});},300);
    return()=>{clearTimeout(timer);controller.abort();};
  },[lookupField,lookupQuery,normalizedLookupValue,readOnly,preview,suspended]);
  const suggestions=matchingRegistrationSuggestions([...recent,...directory],String(value||''));

  const normalized=normalizeRegistrationValue(field.fieldKey,field.fieldType,value);
  const issue=touched?(field.required&&!String(normalized??'').trim()?'Preencha este campo.':field.fieldType==='email'&&normalized&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(normalized))?'Confira o e-mail. Use nome@domínio, sem espaços.':validateStudioAnswer(normalized,field.validation)):null;
  return <label className={`block ${field.fieldType==='textarea'||['DEFESA_LOCAL','LOCAL_ALTERNATIVO','DEFESA_DATA_HORA'].includes(field.fieldKey)?'sm:col-span-2':''}`}>
    <span className="mb-2 block text-sm font-semibold">{({DEFESA_LOCAL:'Local da defesa',LOCAL_ALTERNATIVO:'Local alternativo',DEFESA_DATA_HORA:'Data e horário da defesa'} as Record<string,string>)[field.fieldKey]||field.label.replace(/\b(?:Aluno|avaliador) [123]\b/gi, match => /^aluno/i.test(match)?'aluno autor':'examinador')}{field.required?' *':''}</span>
    {field.fieldType==='datetime-local'?<span className="portal-registration-date-time grid grid-cols-2 gap-3"><input aria-label="Data da defesa" className="portal-input" type="date" min={field.fieldKey==='DEFESA_DATA_HORA'&&!preview?saoPauloCalendarDate():undefined} value={String(value??'').split('T')[0]||''} onChange={e=>onChange(`${e.target.value}T${String(value??'').split('T')[1]||'14:00'}`)}/><input aria-label="Horário da defesa" className="portal-input" type="time" step={60} value={String(value??'').split('T')[1]||''} onChange={e=>onChange(`${String(value??'').split('T')[0]||''}T${e.target.value}`)}/></span>:field.fieldType==='checkbox'?<input type="checkbox" className="h-6 w-6" checked={value===true} onChange={e=>onChange(e.target.checked)}/>:
      field.fieldType==='textarea'?<textarea className="portal-input" rows={5} value={String(value??'')} maxLength={field.validation?.maxLength||10000} onChange={e=>onChange(e.target.value)}/>:
      ['select','radio'].includes(field.fieldType)?<select className="portal-input" value={String(value??'')} onChange={e=>onChange(e.target.value)}><option value="">Selecione…</option>{field.options?.map(option=><option key={option} value={option}>{option==='__OUTRO_LOCAL__'?'Outro local — informar endereço/nome':optionLabels?.[option]||option}</option>)}</select>:
      <input list={identityField(field.fieldKey)?`registration-${field.fieldKey}`:undefined} autoComplete="off" className="portal-input" type={['email','number','date','datetime-local'].includes(field.fieldType)?field.fieldType:'text'} readOnly={readOnly} value={String(value??'')} aria-invalid={issue?true:undefined} onBlur={()=>{onChange(String(normalizeRegistrationValue(field.fieldKey,field.fieldType,value??'')));setTouched(true);}} placeholder={field.placeholder} maxLength={field.validation?.maxLength||500} onChange={e=>{setLookupQuery(e.target.value.trim().toLowerCase());onChange(e.target.value);}}/>}
    {field.fieldType==='datetime-local' && String(value||'').split('T')[0] &&
      <span className="mt-1 block text-xs font-semibold text-emerald-900" aria-live="polite">
        {formatDateWithWeekday(String(value).split('T')[0])}
      </span>}
    {identityField(field.fieldKey)&&<datalist id={`registration-${field.fieldKey}`}>{suggestions.map(item=><option key={item} value={item}/>)}</datalist>}
    {issue&&<span role="alert" className="mt-1 block text-xs text-red-800">{issue}</span>}
    {(field.fieldKey==='TITULO'||/_INSTITUICAO$/.test(field.fieldKey))&&<span className="mt-1 block text-sm opacity-80">{INSTITUTION_ACRONYM_HELP}</span>}
    {helpText&&field.fieldKey!=='DEFESA_LOCAL_PERSONALIZADO'&&<span className="mt-1 block text-sm opacity-80">{field.fieldKey==='ALUNO_1_EMAIL'?'Use o e-mail cadastrado na lista de acesso.':helpText.replace(/depois do Aluno 1/gi,'após o primeiro nome informado')}</span>}
    {previewKind && <RegistrationFieldPreview kind={previewKind} value={String(value ?? '')} />}
  </label>;
}
export function ConfigurableRegistration({ onSuccess, onCancel, previewStudio }: { onSuccess:(id:string)=>void; onCancel:()=>void; previewStudio?:Partial<IntegrationStudioSettings> }) {
  const { userEmail, settings, isMasterAdmin }=useAuth();
  const installationProfile = resolveInstallationProfile(settings);
  const institutionAcronym = installationProfile.institutionAcronym;
  const [studio,setStudio]=useState<Partial<IntegrationStudioSettings>|undefined>(previewStudio||settings?.integrationStudio);
  const [answers,setAnswers]=useState<RegistrationAnswers>({ALUNO_1_EMAIL:userEmail,TEM_ALUNO_2:'Não',TEM_COORIENTADOR:'Não'});
  const [section,setSection]=useState(0);
  const [recent,setRecent]=useState<Record<string,string[]>>({});
  const [error,setError]=useState('');
  const [busy,setBusy]=useState(false);
  const busyRef=useRef(false);
  const [pendingRegistration,setPendingRegistration]=useState<{
    attempt:string;
    answers:RegistrationAnswers;
  }|null>(null);
  const runBusy=async(label:string,operation:()=>Promise<void>)=>{
    if(busyRef.current)return;
    busyRef.current=true;setBusy(true);
    try{await withBlockingPortalOperation(label,operation);}
    finally{busyRef.current=false;setBusy(false);}
  };
  const [eligibility,setEligibility]=useState<'loading'|'ready'|'existing'|'error'>(previewStudio?'ready':'loading');
  const [draftStatus,setDraftStatus]=useState('');
  const [loadAttempt,setLoadAttempt]=useState(0);
  const [loadError,setLoadError]=useState('');
  const [localRecovery,setLocalRecovery]=useState<ReturnType<typeof readRegistrationMemory>>(null);
  const draftRecovery=useRef<RegistrationDraftRecovery|null>(null);
  const [draftReview,setDraftReview]=useState(false);
  const [draftConflict,setDraftConflict]=useState(false);
  const draftRevision=useRef(0), draftQueue=useRef(Promise.resolve()), paused=useRef(false);
  const fields=registrationQuestions(studio,answers);
  const sections=[...new Set(fields.map(f=>f.section||'Trabalho'))].filter(s=>s!=='Reserva do local').concat('Reserva do local');
  const currentSection=Math.min(section,sections.length-1);
  const isReservationStep=currentSection===sections.length-1;
  const visible=fields.filter(f=>evaluateStudioCondition(f.visibleWhen,answers));
  const selected=visible.filter(f=>(f.section||'Trabalho')===sections[currentSection]);
  const reviewValue=(field:RegistrationQuestion)=>registrationReviewValue(field,answers[field.fieldKey]);
  const changeAnswer=(key:string,value:string|boolean)=>setAnswers(current=>key==='TEM_ALUNO_2'?{...current,[key]:value,AUTORIA_REFERENCIA:''}:{...current,[key]:value});
  const renderQuestion=(field:RegistrationQuestion)=><Question suspended={busy} preview={Boolean(previewStudio)} recent={registrationFieldHistory(recent,field.fieldKey)} field={field} value={answers[field.fieldKey]} readOnly={field.fieldKey==='ALUNO_1_EMAIL'&&(!isMasterAdmin||Boolean(previewStudio))} onChange={value=>changeAnswer(field.fieldKey,value)}/>;

  const findings=registrationFindings(Object.fromEntries(visible.map(f=>[f.fieldKey,answers[f.fieldKey]??''])),workflowPolicy(studio));
  useEffect(()=>{
    if(previewStudio){
      const p=studioSampleProcess(),sample:RegistrationAnswers={TEM_ALUNO_2:'Sim',TEM_COORIENTADOR:'Sim',AUTORIA_REFERENCIA:'os alunos',TITULO:p.titulo,DEFESA_DATA_HORA:'2026-11-20T14:00',DEFESA_LOCAL:p.defesa.local};
      for(const [prefix,person] of [['ALUNO_1',p.aluno1],['ALUNO_2',p.aluno2],['ORIENTADOR',p.orientador],['COORIENTADOR',p.coorientador],['EXAMINADOR_2',p.banca[0]],['EXAMINADOR_3',p.banca[1]]] as const){if(person){sample[prefix+'_NOME']=person.nome;sample[prefix+'_EMAIL']=person.email;sample[prefix+'_TRATAMENTO']=person.tratamento||'';if('titulacao' in person)sample[prefix+'_TITULACAO']=person.titulacao||'';if('instituicao' in person)sample[prefix+'_INSTITUICAO']=person.instituicao||'';}}
      setAnswers(sample);setStudio(previewStudio);return;
    }
    let cancelled=false;
    const controller=new AbortController();
    setEligibility('loading');setLoadError('');setError('');setDraftReview(false);setDraftConflict(false);setLocalRecovery(null);
    paused.current=false;draftRecovery.current=null;
    apiClient.getRegistrationBootstrap({signal:controller.signal}).then(({schema,draft,hasExistingProcess})=>{
      if(cancelled)return;
      const {applicantName,...registrationStudio}=schema;
      setStudio(registrationStudio);
      const local=readRegistrationMemory(localStorage,userEmail);
      if(local)setRecent(local.recent);
      const existing=!isMasterAdmin&&hasExistingProcess;
      const serverDraft=draft&&!existing&&!isMasterAdmin?draft:null;
      if(serverDraft&&serverDraft.ownerEmail.trim().toLowerCase()!==userEmail.trim().toLowerCase())throw new Error('O servidor não confirmou um rascunho desta conta.');
      const allowed=new Set(registrationQuestions(registrationStudio).map(field=>field.fieldKey));
      const clean=(values:RegistrationAnswers)=>Object.fromEntries(Object.entries(registrationAnswersWithoutIdentifiers(values)).filter(([key])=>allowed.has(key)).map(([key,value])=>[key,/_NOME$/.test(key)&&typeof value==='string'?normalizePersonName(value):value])) as RegistrationAnswers;
      const restored=serverDraft?clean(serverDraft.answers):local?clean(local.answers):undefined;
      const next:RegistrationAnswers={ALUNO_1_EMAIL:userEmail,TEM_ALUNO_2:'Não',TEM_COORIENTADOR:'Não',...restored};
      if(!isMasterAdmin)next.ALUNO_1_EMAIL=userEmail;
      if(applicantName&&!String(next.ALUNO_1_NOME||'').trim()&&String(next.ALUNO_1_EMAIL||'').trim().toLowerCase()===userEmail.trim().toLowerCase())next.ALUNO_1_NOME=applicantName;
      setAnswers(next);
      draftRevision.current=serverDraft?.revision||0;
      if(!isMasterAdmin)draftRecovery.current=new RegistrationDraftRecovery({ownerEmail:userEmail,revision:draftRevision.current,savedAnswers:serverDraft?.answers,save:apiClient.saveRegistrationDraft,getDraft:apiClient.getRegistrationDraft});
      if(serverDraft){
        setSection(serverDraft.section);setDraftStatus('Rascunho recuperado do servidor.');
        if(serverDraft.schemaRevision!==schema.revision){paused.current=true;setDraftReview(true);}
        if(local&&local.savedAt>Date.parse(serverDraft.updatedAt)&&Object.entries(clean(local.answers)).some(([key,value])=>value!==serverDraft.answers[key]))setLocalRecovery(local);
      }else if(local){
        setSection(local.section);setDraftStatus(isMasterAdmin?'':'Preenchimento recuperado neste navegador. Salve para confirmar no servidor.');
      }
      setEligibility(existing?'existing':'ready');
    }).catch(reason=>{if(!cancelled){setLoadError(reason instanceof Error?reason.message:'Não foi possível consultar o cadastro.');setEligibility('error');}});
    return()=>{cancelled=true;controller.abort();};
  },[userEmail,isMasterAdmin,previewStudio,loadAttempt]);
  const queueSave=(targetSection=currentSection):Promise<boolean>=>{
    if(previewStudio)return Promise.resolve(true);
    if(eligibility==='ready')saveRegistrationMemory(localStorage,userEmail,answers,targetSection);
    if(paused.current)return Promise.resolve(false);
    if(isMasterAdmin)return Promise.resolve(true);
    setDraftStatus('Salvando rascunho…');
    const allowed=new Set(fields.map(field=>field.fieldKey));
    const draftAnswers=registrationAnswersWithoutIdentifiers(Object.fromEntries(Object.entries(answers).filter(([key])=>allowed.has(key))) as RegistrationAnswers);
    const operation=draftQueue.current.then(async()=>{
      if(paused.current)return false;
      try{
        if(!draftRecovery.current)throw new Error('Confira o carregamento do rascunho antes de salvar.');
        const saved=await draftRecovery.current.saveStep({answers:draftAnswers,section:targetSection,schemaRevision:Number(studio?.revision||0)},userEmail);
        draftRevision.current=saved.revision;setDraftStatus('Rascunho salvo no servidor.');setError('');setDraftConflict(false);setLocalRecovery(null);return true;
      }catch(reason){
        setDraftConflict(reason instanceof RegistrationDraftRecoveryConflict);
        setDraftStatus(reason instanceof Error?reason.message:'Não foi possível confirmar o salvamento. Seus campos continuam nesta tela.');
        return false;
      }
    });
    draftQueue.current=operation.then(()=>undefined);
    return operation;
  };
  const check=(all:boolean)=>{
    for(const field of all?visible:selected){const value=normalizeRegistrationValue(field.fieldKey,field.fieldType,answers[field.fieldKey]);
      if(field.required&&(!String(value??'').trim()||field.fieldType==='checkbox'&&value!==true))return `Preencha: ${field.label}.`;
      if(field.fieldKey==='DEFESA_DATA_HORA'&&value&&String(value).split('T')[0]<saoPauloCalendarDate())return 'A data da defesa deve ser hoje ou um dia posterior.';
      if(field.fieldKey==='DEFESA_DATA_HORA'&&value&&!isDefenseWeekday(String(value).split('T')[0]))return DEFENSE_WEEKDAY_MESSAGE;
      if(value&&field.fieldType==='email'&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value)))return `Revise o e-mail: ${field.label}.`;
      if(value&&field.options?.length&&!field.options.includes(String(value)))return `Selecione uma opção válida: ${field.label}.`;
      const issue=value!==undefined&&value!==''?validateStudioAnswer(value,field.validation):null;if(issue)return `${field.label}: ${issue}`;
    }return '';
  };
  const finishRegistration=(result:{id:string;workflowPending?:boolean;workflowProcessing?:boolean;workflowError?:string},accepted:RegistrationAnswers)=>{
    setPendingRegistration(null);
    const message=result.workflowProcessing
      ? 'Cadastro salvo. Acompanhe o envio do pedido de reserva nos detalhes do TCC.'
      : result.workflowPending
        ? `Cadastro salvo. O pedido de reserva ainda está pendente: ${result.workflowError||'a secretaria deve acompanhar a etapa.'}`
        : studio?.formDesigns?.['form-reserva-aluno']?.confirmationMessage||'Pedido de reserva enviado ao responsável pelo local. Aguarde o resultado por e-mail.';
    portalNotice(message,{title:'Cadastro concluído — próximos passos'});
    saveRegistrationMemory(localStorage,userEmail,accepted,currentSection,Date.now(),true);
    window.dispatchEvent(new Event(PORTAL_REPOSITORY_CHANGED_EVENT));
    onSuccess(result.id);
  };
  const verifyRegistration=async(attempt:string,accepted:RegistrationAnswers)=>{
    try {
      const result=await apiClient.getRegistrationAttempt(attempt);
      finishRegistration({...result,workflowProcessing:true},accepted);
    } catch {
      setError('O Portal ainda não conseguiu confirmar o cadastro. Seus dados continuam nesta tela. Use “Verificar cadastro” para consultar o resultado.');
    }
  };
  const submit=async(event:React.FormEvent)=>{
    event.preventDefault();if(busyRef.current)return;
    if(pendingRegistration){
      await runBusy('Verificando cadastro…',()=>verifyRegistration(pendingRegistration.attempt,pendingRegistration.answers));
      return;
    }
    if(previewStudio){setSection(value=>Math.min(sections.length-1,value+1));return;}setAnswers(current=>Object.fromEntries(Object.entries(current).map(([key,value])=>[key,normalizeRegistrationValue(key,fields.find(f=>f.fieldKey===key)?.fieldType||'text',value)])) as RegistrationAnswers);const problem=check(currentSection===sections.length-1);if(problem){setError(problem);return;}setError('');
    if(currentSection<sections.length-1){await runBusy('Salvando rascunho…',async()=>{const next=currentSection+1;const saved=await queueSave(next);if(!saved){setError('Não foi possível confirmar o salvamento. Seus campos foram preservados. Aguarde alguns segundos e tente continuar novamente.');return;}setSection(next);});return;}
    if(findings.some(finding=>finding.severity==='ERROR')){setError('Corrija os e-mails repetidos antes de cadastrar.');return;}
    if(draftReview){setError('Confira a mudança do formulário e aceite a revisão atual antes de enviar.');return;}
    await runBusy('Cadastrando e solicitando reserva…',async()=>{
      paused.current=true;
      const attempt=crypto.randomUUID();
      const accepted=Object.fromEntries(visible.map(field=>[field.fieldKey,normalizeRegistrationValue(field.fieldKey,field.fieldType,answers[field.fieldKey]??'')])) as RegistrationAnswers;
      try {
        await draftQueue.current;
        const result=await apiClient.createProcess(registrationPayload(accepted,studio?.operationsPolicy?.timezone||'America/Sao_Paulo'),attempt);
        finishRegistration(result,accepted);
      } catch(error) {
        if(!(error instanceof ApiRequestError)||error.status===0||(error.status>=500&&!['RUNTIME_BUSY','RUNTIME_STATE_UNAVAILABLE'].includes(error.code||''))){
          setPendingRegistration({attempt,answers:accepted});
          await verifyRegistration(attempt,accepted);
          return;
        }
        setError(error.message);
        paused.current=false;
      }
    });
  };
  const renderRegistrationField=(field:RegistrationQuestion)=>{
      if(field.fieldKey==='DEFESA_DATA_HORA'){
        const selectedLocation=String(answers.DEFESA_LOCAL||'');
        const location=isOtherDefenseLocation(selectedLocation)?renderCustomLocationName(getCustomLocationFieldValue(answers)):selectedLocation;
        return <React.Fragment key={field.fieldKey}>{renderQuestion(field)}<ReservationCalendarPicker value={String(answers.DEFESA_DATA_HORA||'')} location={location} timezone={studio?.operationsPolicy?.timezone||'America/Sao_Paulo'} onSelect={value=>changeAnswer(field.fieldKey,value)}/></React.Fragment>;
      }

      if(field.fieldKey==='AUTORIA_REFERENCIA')return <div key={field.fieldKey} className="sm:col-span-2 space-y-2"><label className="block text-sm font-semibold">Complete a frase para os documentos *<span className="mt-2 flex flex-wrap items-center gap-2 rounded-lg border border-slate-300 bg-[var(--portal-surface-panel)] p-3"><span>{answers.TEM_ALUNO_2==='Sim'?'Estavam presentes':'Estava presente'}</span><select aria-label="Referência da autoria nos documentos" required className="portal-input !w-auto" value={String(answers.AUTORIA_REFERENCIA||'')} onChange={event=>changeAnswer('AUTORIA_REFERENCIA',event.target.value)}><option value="">Selecione…</option>{field.options?.map(option=><option key={option} value={option}>{option}</option>)}</select><strong>{registrationIdentityNames(answers)||'nome preenchido no cadastro'}.</strong></span></label><p className="sr-only" role="status" aria-live="polite">{registrationIdentitySentence(answers)}</p></div>;
      const prefix=field.fieldKey.replace(/_(?:TRATAMENTO|TITULACAO|NOME)$/,'');
      const faculty=/^(?:ORIENTADOR|COORIENTADOR|EXAMINADOR_[23])$/.test(prefix);
      const trio=faculty?['TRATAMENTO','TITULACAO','NOME'].map(suffix=>selected.find(item=>item.fieldKey===`${prefix}_${suffix}`)):[];
      if(trio.length===3&&trio.every(Boolean)){
        if(field.fieldKey!==`${prefix}_TRATAMENTO`)return null;
        return <div key={prefix} className="sm:col-span-2 grid gap-3 sm:grid-cols-[1fr_1fr_2fr]">{trio.map(question=><React.Fragment key={question!.fieldKey}>{renderQuestion(question!)}</React.Fragment>)}<p className="sm:col-span-3 text-sm text-slate-600" aria-live="polite">Nos documentos: {academicName({nome:normalizePersonName(String(answers[`${prefix}_NOME`]||'')),tratamento:String(answers[`${prefix}_TRATAMENTO`]||''),titulacao:String(answers[`${prefix}_TITULACAO`]||'')},'abbreviated')}</p></div>;
      }
      return <React.Fragment key={field.fieldKey}>{renderQuestion(field)}</React.Fragment>;

  };
  const renderRegistrationSection=()=>selected.map(field=>{
    const examiner=field.fieldKey.match(/^(EXAMINADOR_[23])_/);
    if(!examiner)return renderRegistrationField(field);
    const prefix=examiner[1],group=selected.filter(question=>question.fieldKey.startsWith(prefix+'_'));
    if(group[0].fieldKey!==field.fieldKey)return null;
    const title='Examinador';
    return <section key={prefix} role="group" aria-labelledby={`registration-${prefix}`} className="sm:col-span-2 grid gap-5 border-t border-slate-300 pt-5 sm:grid-cols-2"><h3 id={`registration-${prefix}`} className="sm:col-span-2 text-lg font-bold">{title}</h3>{group.map(renderRegistrationField)}</section>;
  });
  if(eligibility!=='ready')return <section className="portal-card p-6" aria-live="polite"><p>{eligibility==='loading'?'Verificando acesso e rascunho…':eligibility==='existing'?'Você já possui um TCC. Continue em Meus TCCs.':'Não foi possível carregar o cadastro.'}</p>{eligibility==='error'&&<><p role="alert" className="mt-2 text-sm">{loadError} Tente novamente sem atualizar a página.</p><button type="button" onClick={()=>setLoadAttempt(value=>value+1)} className="portal-action portal-action-primary mt-4">Tentar novamente</button></>}<button type="button" onClick={onCancel} className="portal-action mt-4">Voltar</button></section>;
  return <form onSubmit={submit} className={`portal-workspace mx-auto space-y-5 ${currentSection===sections.length-1?'max-w-7xl':'max-w-4xl'}`} aria-labelledby="registration-title" aria-busy={busy}>
    <header className="portal-card p-5">{studio?.brandKit?.courseName&&<p className="mb-3 text-center text-base font-bold text-[var(--portal-brand-header)]">{studio.brandKit.courseName}</p>}<p className="text-sm">Etapa {currentSection+1} de {sections.length}</p><h1 id="registration-title" className="mt-1 flex items-center gap-2 text-xl font-bold"><ClipboardList className="h-5 w-5 shrink-0 text-[var(--portal-brand-header)]" aria-hidden="true"/><span>{String(studio?.formTemplates?.find(f=>f.id==='form-reserva-aluno')?.title||'Cadastrar meu TCC')}</span></h1><p className="mt-2 text-sm leading-5">{isReservationStep?'Escolha o local e informe a data e o horário. O departamento confirma as reservas do auditório e da sala de reuniões; outros locais são confirmados pelo orientador. Os envolvidos recebem o resultado por e-mail.':(studio?.formDesigns?.['form-reserva-aluno']?.introText||String(studio?.formTemplates?.find(form=>form.id==='form-reserva-aluno')?.description||'Preencha os dados dos autores, do trabalho e da banca. O agendamento será solicitado na última etapa.'))}</p>{studio?.formDesigns?.['form-reserva-aluno']?.showProgress!==false&&<progress aria-label="Progresso do cadastro" className="mt-3 h-2 w-full" value={currentSection+1} max={sections.length}/>} {!isMasterAdmin&&!previewStudio&&<p role="status" className="mt-2 text-sm">{draftStatus} Expiração após {workflowPolicy(studio).draftExpiryDays} dias sem salvar.</p>}</header>
    {isReservationStep&&<ReservationSchedulingNotice/>}
    {localRecovery&&<aside role="alert" className="portal-card p-4"><p>Existe um preenchimento mais recente neste navegador que ainda não foi confirmado no servidor. Você pode recuperá-lo e conferir os campos antes de salvar.</p><div className="mt-3 flex flex-wrap gap-3"><button type="button" className="portal-action" disabled={busy} onClick={()=>{const allowed=new Set(fields.map(field=>field.fieldKey));setAnswers(current=>({...current,...Object.fromEntries(Object.entries(registrationAnswersWithoutIdentifiers(localRecovery.answers)).filter(([key])=>allowed.has(key))),ALUNO_1_EMAIL:userEmail}));setSection(localRecovery.section);setDraftStatus('Preenchimento recuperado neste navegador. Salve para confirmar no servidor.');setLocalRecovery(null);}}>Recuperar preenchimento</button><button type="button" className="portal-action" disabled={busy} onClick={()=>setLocalRecovery(null)}>Manter rascunho do servidor</button></div></aside>}

    {draftReview&&<aside role="alert" className="portal-card p-4"><p>O Master publicou uma nova versão do formulário. Confira os campos recuperados; perguntas removidas não entrarão no cadastro.</p><button type="button" className="portal-action mt-3" onClick={()=>{paused.current=false;setDraftReview(false);}}>Conferi e vou usar a versão atual</button></aside>}
    {error&&<div role="alert" className="rounded-xl border border-red-300 bg-red-50 p-4 text-red-900"><p>{error}</p>{draftConflict&&<button type="button" disabled={busy} className="portal-action mt-3" onClick={()=>setLoadAttempt(value=>value+1)}>Conferir rascunho do servidor</button>}</div>}
    <fieldset disabled={busy||!!pendingRegistration} className="portal-card grid gap-5 p-5 sm:grid-cols-2"><legend className="sr-only">{sections[currentSection]}</legend><h2 className="portal-registration-section-title sm:col-span-2">{sections[currentSection]==='Segundo autor'?'Autoria nos documentos':sections[currentSection]}</h2>{renderRegistrationSection()}</fieldset>
    {currentSection===sections.length-1&&<RegistrationReview fields={visible} valueFor={reviewValue} findings={findings} institutionName={installationProfile.institutionName}/>}
    <footer className="flex flex-wrap justify-between gap-3"><button type="button" className="portal-action" disabled={busy} onClick={async()=>{if(pendingRegistration){onCancel();return;}if(previewStudio){if(currentSection)setSection(currentSection-1);else onCancel();return;}await runBusy('Salvando rascunho…',async()=>{const saved=await queueSave(Math.max(0,currentSection-1));if(!saved)setError('Não foi possível confirmar o salvamento. Seus campos continuam nesta tela. Aguarde alguns segundos e tente novamente.');else if(currentSection)setSection(currentSection-1);else onCancel();});}}>{pendingRegistration?'Fechar cadastro':currentSection?'Voltar':isMasterAdmin?'Voltar':'Salvar e sair'}</button><button type="submit" className="portal-action portal-action-primary" disabled={busy}>{pendingRegistration?(busy?'Verificando…':'Verificar cadastro'):busy?(currentSection<sections.length-1?'Salvando…':'Cadastrando…'):currentSection<sections.length-1?'Continuar':(studio?.formDesigns?.['form-reserva-aluno']?.submitLabel||'Cadastrar e solicitar reserva')}</button></footer>
  </form>;
}
