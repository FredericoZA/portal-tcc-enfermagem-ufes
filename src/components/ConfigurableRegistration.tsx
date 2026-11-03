import {INSTITUTION_ACRONYM_HELP,renderInstitutionName} from '../utils/institutionName';
import {identityField,readRegistrationMemory,saveRegistrationMemory,registrationFieldHistory,matchingRegistrationSuggestions} from '../utils/registrationHistory';
import {ReservationSchedulingNotice} from './ReservationSchedulingNotice';
import {RegistrationReview} from './RegistrationReview';
import {normalizePersonName} from '../utils/personNameCase';
import {withAuthorReference,registrationIdentityNames,registrationIdentitySentence} from '../utils/registrationIdentity';
import {academicName,authorIntroduction} from '../utils/personPresentation';
import { ClipboardList } from 'lucide-react';
import {normalizeRegistrationValue} from '../utils/registrationNormalization';
import {renderTccTitle} from '../utils/formatters';
import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { RegistrationFieldPreview, registrationPreviewKind } from './RegistrationFieldPreview';
import { RegistrationMembersTable } from './RegistrationMembersTable';
import { resolveInstallationProfile } from '../utils/installationProfile';
import { isOtherDefenseLocation, normalizeCustomLocationInput } from '../utils/customDefenseLocation';
import { apiClient } from '../services/apiClient';
import { portalNotice } from '../services/portalDialogs';
import { evaluateStudioCondition, validateStudioAnswer } from '../utils/courseStudioValidator';
import { registrationQuestions, registrationPayload } from '../utils/operationalConfig';
import { registrationFindings, workflowPolicy } from '../utils/workflowOperations';
import type {StudentInfo} from '../types';
import type { RegistrationAnswers, RegistrationQuestion } from '../types/operationalConfig';
import type { IntegrationStudioSettings } from '../types/integrationStudio';

function registrationAuthorPreview(answers:RegistrationAnswers){
 answers=withAuthorReference(answers);
 const student=(n:number):StudentInfo=>({nome:normalizePersonName(String(answers[`ALUNO_${n}_NOME`]||'')),email:'',matricula:'',tratamento:answers[`ALUNO_${n}_TRATAMENTO`]==='Aluna'?'Aluna':answers[`ALUNO_${n}_TRATAMENTO`]==='Aluno'?'Aluno':undefined});
 return authorIntroduction({aluno1:student(1),aluno2:answers.TEM_ALUNO_2==='Sim'?student(2):null,authorOrder:'ALUNO_1_FIRST'});
}
function Question({ field, value, readOnly, onChange,optionLabels,recent=[] }: { field: RegistrationQuestion; value: unknown; readOnly: boolean;optionLabels?:Record<string,string>; recent?:string[]; onChange: (value: string|boolean)=>void }) {
  const previewKind = registrationPreviewKind(field.fieldKey, field.label, field.fieldType);
  const [touched,setTouched]=useState(false);
  const [directory,setDirectory]=useState<string[]>([]);
  const lookupField=/_NOME$/.test(field.fieldKey)?'nome':/_EMAIL$/.test(field.fieldKey)?'email':/_(MATRICULA|SIAPE)$/.test(field.fieldKey)?'matricula':'';
  useEffect(()=>{let alive=true;setDirectory([]);const query=String(value||'').trim();if(readOnly||!lookupField||query.length<3)return;const timer=setTimeout(()=>{apiClient.getRegistrationSuggestions(lookupField,query).then(values=>{if(alive)setDirectory(values);}).catch(()=>{});},300);return()=>{alive=false;clearTimeout(timer);};},[lookupField,value,readOnly]);
  const suggestions=matchingRegistrationSuggestions([...recent,...directory],String(value||''));

  const normalized=normalizeRegistrationValue(field.fieldKey,field.fieldType,value);
  const issue=touched?(field.required&&!String(normalized??'').trim()?'Preencha este campo.':field.fieldType==='email'&&normalized&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(normalized))?'Confira o e-mail. Use nome@domínio, sem espaços.':validateStudioAnswer(normalized,field.validation)):null;
  return <label className={`block ${field.fieldType==='textarea'||['DEFESA_LOCAL','LOCAL_ALTERNATIVO','DEFESA_DATA_HORA'].includes(field.fieldKey)?'sm:col-span-2':''}`}>
    <span className="mb-2 block text-sm font-semibold">{({DEFESA_LOCAL:'Local da defesa',LOCAL_ALTERNATIVO:'Local alternativo',DEFESA_DATA_HORA:'Data e horário da defesa'} as Record<string,string>)[field.fieldKey]||field.label.replace(/\b(?:Aluno|avaliador) [123]\b/gi, match => /^aluno/i.test(match)?'aluno autor':'examinador')}{field.required?' *':''}</span>
    {field.fieldType==='datetime-local'?<span className="portal-registration-date-time grid grid-cols-2 gap-3"><input aria-label="Data da defesa" className="portal-input" type="date" value={String(value??'').split('T')[0]||''} onChange={e=>onChange(`${e.target.value}T${String(value??'').split('T')[1]||'14:00'}`)}/><input aria-label="Horário da defesa" className="portal-input" type="time" step={300} value={String(value??'').split('T')[1]||''} onChange={e=>onChange(`${String(value??'').split('T')[0]||''}T${e.target.value}`)}/></span>:field.fieldType==='checkbox'?<input type="checkbox" className="h-6 w-6" checked={value===true} onChange={e=>onChange(e.target.checked)}/>:
      field.fieldType==='textarea'?<textarea className="portal-input" rows={5} value={String(value??'')} maxLength={field.validation?.maxLength||10000} onChange={e=>onChange(e.target.value)}/>:
      ['select','radio'].includes(field.fieldType)?<select className="portal-input" value={String(value??'')} onChange={e=>onChange(e.target.value)}><option value="">Selecione…</option>{field.options?.map(option=><option key={option} value={option}>{option==='__OUTRO_LOCAL__'?'Outro local — informar endereço/nome':optionLabels?.[option]||option}</option>)}</select>:
      <input list={identityField(field.fieldKey)?`registration-${field.fieldKey}`:undefined} autoComplete="off" className="portal-input" type={['email','number','date','datetime-local'].includes(field.fieldType)?field.fieldType:'text'} readOnly={readOnly} value={String(value??'')} aria-invalid={issue?true:undefined} onBlur={()=>{onChange(String(normalizeRegistrationValue(field.fieldKey,field.fieldType,value??'')));setTouched(true);}} placeholder={field.placeholder} maxLength={/_MATRICULA$|_SIAPE$/.test(field.fieldKey)?undefined:field.validation?.maxLength||500} onChange={e=>onChange(e.target.value)}/>}
    {identityField(field.fieldKey)&&<datalist id={`registration-${field.fieldKey}`}>{suggestions.map(item=><option key={item} value={item}/>)}</datalist>}
    {issue&&<span role="alert" className="mt-1 block text-xs text-red-800">{issue}</span>}
    {(field.fieldKey==='TITULO'||/_INSTITUICAO$/.test(field.fieldKey))&&<span className="mt-1 block text-sm opacity-80">{INSTITUTION_ACRONYM_HELP}</span>}
    {field.helpText&&field.fieldKey!=='DEFESA_LOCAL_PERSONALIZADO'&&<span className="mt-1 block text-sm opacity-80">{field.fieldKey==='ALUNO_1_EMAIL'?'Use o e-mail cadastrado na lista de acesso.':field.helpText.replace(/depois do Aluno 1/gi,'após o primeiro nome informado')}</span>}
    {previewKind && <RegistrationFieldPreview kind={previewKind} value={String(value ?? '')} />}
  </label>;
}
export function ConfigurableRegistration({ onSuccess, onCancel }: { onSuccess:(id:string)=>void; onCancel:()=>void }) {
  const { userEmail, settings, isMasterAdmin }=useAuth();
  const institutionAcronym = resolveInstallationProfile(settings).institutionAcronym;
  const [studio,setStudio]=useState<Partial<IntegrationStudioSettings>|undefined>(settings?.integrationStudio);
  const [answers,setAnswers]=useState<RegistrationAnswers>({ALUNO_1_EMAIL:userEmail,TEM_ALUNO_2:'Não',TEM_COORIENTADOR:'Não'});
  const [section,setSection]=useState(0);
  const [recent,setRecent]=useState<Record<string,string[]>>({});
  const [error,setError]=useState('');
  const [busy,setBusy]=useState(false);
  const [eligibility,setEligibility]=useState<'loading'|'ready'|'existing'|'error'>('loading');
  const [draftStatus,setDraftStatus]=useState('');
  const [draftReview,setDraftReview]=useState(false);
  const draftRevision=useRef(0), draftQueue=useRef(Promise.resolve()), paused=useRef(false);
  const fields=registrationQuestions(studio,answers);
  const sections=[...new Set(fields.map(f=>f.section||'Trabalho'))].filter(s=>s!=='Reserva do local').concat('Reserva do local');
  const currentSection=Math.min(section,sections.length-1);
  const isReservationStep=currentSection===sections.length-1;
  const visible=fields.filter(f=>evaluateStudioCondition(f.visibleWhen,answers));
  const selected=visible.filter(f=>(f.section||'Trabalho')===sections[currentSection]);
  const reviewValue=(field:RegistrationQuestion)=>{
    const value=answers[field.fieldKey];
    if(value===undefined||value===null||value==='')return '';
    if(field.fieldKey==='TITULO')return renderTccTitle(String(value));
    if(/_INSTITUICAO$/.test(field.fieldKey))return renderInstitutionName(String(value));
    if(field.fieldKey==='DEFESA_LOCAL'&&value==='__OUTRO_LOCAL__')return 'Outro local';
    if(field.fieldType==='datetime-local'){const [date,time]=String(value).split('T');const [year,month,day]=date.split('-');return `${day&&month&&year?`${day}/${month}/${year}`:date}${time?` às ${time}`:''}`;}
    return typeof value==='boolean'?(value?'Sim':'Não'):String(value);
  };
  const changeAnswer=(key:string,value:string|boolean)=>setAnswers(current=>key==='TEM_ALUNO_2'?{...current,[key]:value,AUTORIA_REFERENCIA:''}:{...current,[key]:value});
  const renderQuestion=(field:RegistrationQuestion)=><Question recent={registrationFieldHistory(recent,field.fieldKey)} field={field} value={answers[field.fieldKey]} readOnly={field.fieldKey==='ALUNO_1_EMAIL'&&!isMasterAdmin} onChange={value=>changeAnswer(field.fieldKey,value)}/>;

  const findings=registrationFindings(Object.fromEntries(visible.map(f=>[f.fieldKey,answers[f.fieldKey]??''])),workflowPolicy(studio));
  useEffect(()=>{
    let cancelled=false;
    Promise.all([apiClient.getProcesses(),apiClient.getRegistrationSchema(),apiClient.getRegistrationDraft()]).then(([processes,schema,draft])=>{
      if(cancelled)return;setStudio(schema);
      const local=readRegistrationMemory(localStorage,userEmail);if(local){setRecent(local.recent);if(isMasterAdmin){setAnswers(current=>({...current,...local.answers}));setSection(local.section);}}
      const existing=!isMasterAdmin&&processes.some(p=>[p.aluno1.email,p.aluno2?.email].some(email=>email?.toLowerCase()===userEmail.toLowerCase()));
      if(draft&&!existing&&!isMasterAdmin){setAnswers({...Object.fromEntries(Object.entries(draft.answers).map(([key,value])=>[key,/_NOME$/.test(key)&&typeof value==='string'?normalizePersonName(value):value])),ALUNO_1_EMAIL:userEmail});setSection(draft.section);draftRevision.current=draft.revision;setDraftStatus('Rascunho recuperado do servidor.');if(draft.schemaRevision!==schema.revision){paused.current=true;setDraftReview(true);}}
      setEligibility(existing?'existing':'ready');
    }).catch(()=>{if(!cancelled)setEligibility('error');});
    return()=>{cancelled=true;};
  },[userEmail,isMasterAdmin]);
  const queueSave=(targetSection=currentSection)=>{
    if(eligibility==='ready')saveRegistrationMemory(localStorage,userEmail,answers,targetSection);
    if(paused.current||isMasterAdmin)return;
    setDraftStatus('Salvando rascunho…');
    draftQueue.current=draftQueue.current.then(async()=>{
      if(paused.current)return;
      try{const saved=await apiClient.saveRegistrationDraft({answers,section:targetSection,expectedRevision:draftRevision.current,schemaRevision:Number(studio?.revision||0)});draftRevision.current=saved.revision;setDraftStatus('Rascunho salvo no servidor.');}
      catch(e){paused.current=true;setDraftStatus(e instanceof Error?e.message:'Falha ao salvar. Seus campos continuam nesta tela.');}
    });
  };
  const check=(all:boolean)=>{
    for(const field of all?visible:selected){const value=normalizeRegistrationValue(field.fieldKey,field.fieldType,answers[field.fieldKey]);
      if(field.required&&(!String(value??'').trim()||field.fieldType==='checkbox'&&value!==true))return `Preencha: ${field.label}.`;
      if(value&&field.fieldType==='email'&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value)))return `Revise o e-mail: ${field.label}.`;
      if(value&&field.options?.length&&!field.options.includes(String(value)))return `Selecione uma opção válida: ${field.label}.`;
      const issue=value!==undefined&&value!==''?validateStudioAnswer(value,field.validation):null;if(issue)return `${field.label}: ${issue}`;
    }return '';
  };
  const submit=async(event:React.FormEvent)=>{
    event.preventDefault();setAnswers(current=>Object.fromEntries(Object.entries(current).map(([key,value])=>[key,normalizeRegistrationValue(key,fields.find(f=>f.fieldKey===key)?.fieldType||'text',value)])) as RegistrationAnswers);const problem=check(currentSection===sections.length-1);if(problem){setError(problem);return;}setError('');
    if(currentSection<sections.length-1){setBusy(true);try{const next=currentSection+1;queueSave(next);await draftQueue.current;if(paused.current&&!isMasterAdmin){setError('Não foi possível salvar o rascunho. Confira a mensagem de salvamento antes de continuar.');return;}setSection(next);}finally{setBusy(false);}return;}
    if(findings.some(finding=>finding.severity==='ERROR')){setError('Corrija os e-mails repetidos antes de cadastrar.');return;}
    if(draftReview){setError('Confira a mudança do formulário e aceite a revisão atual antes de enviar.');return;}
    setBusy(true);paused.current=true;
    try{await draftQueue.current;const accepted=Object.fromEntries(visible.map(f=>[f.fieldKey,normalizeRegistrationValue(f.fieldKey,f.fieldType,answers[f.fieldKey]??'')])) as RegistrationAnswers;const result=await apiClient.createProcess(registrationPayload(accepted,studio?.operationsPolicy?.timezone||'America/Sao_Paulo'));portalNotice(result.workflowPending?`Cadastro salvo. O pedido de reserva ainda está pendente: ${result.workflowError||'a secretaria deve acompanhar a etapa.'}`:'Pedido de reserva enviado ao responsável pelo local. Aguarde o resultado por e-mail.',{title:'Cadastro concluído — próximos passos'});saveRegistrationMemory(localStorage,userEmail,accepted,currentSection,Date.now(),true);onSuccess(result.id);}
    catch(e){setError(e instanceof Error?e.message:'Não foi possível cadastrar o TCC.');paused.current=false;}
    finally{setBusy(false);}
  };
  const renderRegistrationField=(field:RegistrationQuestion)=>{
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
  if(eligibility!=='ready')return <section className="portal-card p-6" aria-live="polite"><p>{eligibility==='loading'?'Verificando acesso e rascunho…':eligibility==='existing'?'Você já possui um TCC. Continue em Meus TCCs.':'Não foi possível carregar o cadastro. Atualize a página para tentar novamente.'}</p><button type="button" onClick={onCancel} className="portal-action mt-4">Voltar</button></section>;
  return <form onSubmit={submit} className={`portal-workspace mx-auto space-y-5 ${currentSection===sections.length-1?'max-w-7xl':'max-w-4xl'}`} aria-labelledby="registration-title">
    <header className="portal-card p-5"><div className="flex items-center justify-center">{studio?.formDesigns?.['form-reserva-aluno']?.logoUrl&&<img src={studio.formDesigns['form-reserva-aluno'].logoUrl} alt="Imagem do formulário" className="mb-3 h-14 w-14 object-contain"/>}</div>{studio?.brandKit?.courseName&&<p className="mb-3 text-center text-base font-bold text-[var(--portal-brand-header)]">{studio.brandKit.courseName}</p>}<p className="text-sm">Etapa {currentSection+1} de {sections.length}</p><h1 id="registration-title" className="mt-1 flex items-center gap-2 text-xl font-bold"><ClipboardList className="h-5 w-5 shrink-0 text-[var(--portal-brand-header)]" aria-hidden="true"/><span>{String(studio?.formTemplates?.find(f=>f.id==='form-reserva-aluno')?.title||'Cadastrar meu TCC')}</span></h1><p className="mt-2 text-sm leading-5">{isReservationStep?'Escolha o local e informe a data e o horário. O departamento confirma as reservas do auditório e da sala de reuniões; outros locais são confirmados pelo orientador. Os envolvidos recebem o resultado por e-mail.':'Preencha os dados dos autores, do trabalho e da banca. O agendamento será solicitado na última etapa.'}</p><progress aria-label="Progresso do cadastro" className="mt-3 h-2 w-full" value={currentSection+1} max={sections.length}/>{!isMasterAdmin&&<p role="status" className="mt-2 text-sm">{draftStatus} Expiração após {workflowPolicy(studio).draftExpiryDays} dias sem salvar.</p>}</header>
    {isReservationStep&&<ReservationSchedulingNotice/>}
    {draftReview&&<aside role="alert" className="portal-card p-4"><p>O Master publicou uma nova versão do formulário. Confira os campos recuperados; perguntas removidas não entrarão no cadastro.</p><button type="button" className="portal-action mt-3" onClick={()=>{paused.current=false;setDraftReview(false);}}>Conferi e vou usar a versão atual</button></aside>}
    {error&&<p role="alert" className="rounded-xl border border-red-300 bg-red-50 p-4 text-red-900">{error}</p>}
    <fieldset disabled={busy} className="portal-card grid gap-5 p-5 sm:grid-cols-2"><legend className="sr-only">{sections[currentSection]}</legend><h2 className="portal-registration-section-title sm:col-span-2">{sections[currentSection]==='Segundo autor'?'Autoria nos documentos':sections[currentSection]}</h2>{renderRegistrationSection()}</fieldset>
    {currentSection===sections.length-1&&<RegistrationReview fields={visible} valueFor={reviewValue} findings={findings}/>}
    <footer className="flex flex-wrap justify-between gap-3"><button type="button" className="portal-action" disabled={busy} onClick={async()=>{setBusy(true);try{queueSave(Math.max(0,currentSection-1));await draftQueue.current;if(paused.current&&!isMasterAdmin)setError('O rascunho não foi salvo. Mantenha esta tela aberta e confira a mensagem de salvamento antes de sair.');else if(currentSection)setSection(currentSection-1);else onCancel();}finally{setBusy(false);}}}>{currentSection?'Voltar':isMasterAdmin?'Voltar':'Salvar e sair'}</button><button type="submit" className="portal-action portal-action-primary" disabled={busy}>{busy?(currentSection<sections.length-1?'Salvando…':'Cadastrando…'):currentSection<sections.length-1?'Continuar':'Cadastrar e solicitar reserva'}</button></footer>
  </form>;
}
