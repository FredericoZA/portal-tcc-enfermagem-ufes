import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, ClipboardList, HardDrive, History } from 'lucide-react';
import type { FormQuestionItem, FormTemplateItem } from '../pages/ConfiguracoesPage';
import type { StudioFormSubmission } from '../types/courseOperations';
import { apiClient, ApiRequestError } from '../services/apiClient';
import { evaluateStudioCondition } from '../utils/courseStudioValidator';
import { normalizeAnswerKey as normalizeKey, validateFormAnswers } from '../utils/studioFormAnswers';
import { getPortalMessages } from '../utils/i18n';

type RuntimeForm = FormTemplateItem & { revision?: number };

export const DynamicStudioForms: React.FC<{ processId: string; locale?: string; accentColor?: string }> = ({ processId, locale, accentColor = '#005830' }) => {
  const copy = getPortalMessages(locale);
  const [forms, setForms] = useState<RuntimeForm[]>([]);
  const [submissions, setSubmissions] = useState<StudioFormSubmission[]>([]);
  const [answers, setAnswers] = useState<Record<string, Record<string, string | number | boolean>>>({});
  const [errors, setErrors] = useState<Record<string, Record<string, string>>>({});
  const [working, setWorking] = useState('');
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const requestGeneration = useRef(0);
  const submitting = useRef(false);
  const activeProcess = useRef<string | null>(processId);

  const refresh = async () => {
    const generation = ++requestGeneration.current;
    setLoading(true);
    try {
      const [available, previous] = await Promise.all([apiClient.getStudioForms(processId), apiClient.getStudioFormSubmissions(processId)]);
      if (generation !== requestGeneration.current) return;
      setForms(available);
      setSubmissions(previous);
    } catch (error) {
      if (generation !== requestGeneration.current) return;
      setNotice({ ok: false, text: error instanceof Error ? error.message : 'Não foi possível carregar os formulários.' });
    } finally { if (generation === requestGeneration.current) setLoading(false); }
  };

  useEffect(() => {
    activeProcess.current = processId; submitting.current = false; setWorking('');
    setForms([]); setSubmissions([]); setAnswers({}); setErrors({}); setNotice(null);
    void refresh();
    return () => { requestGeneration.current++; activeProcess.current = null; };
  }, [processId]);

  const priorByForm = useMemo(() => new Map(forms.map(form => [form.id, submissions.filter(item => item.formId === form.id)])), [forms, submissions]);

  const updateAnswer = (formId: string, question: FormQuestionItem, value: string | number | boolean) => {
    const field = normalizeKey(question.fieldKey);
    setAnswers(previous => ({ ...previous, [formId]: { ...(previous[formId] || {}), [field]: value } }));
    setErrors(previous => ({ ...previous, [formId]: { ...(previous[formId] || {}), [field]: '' } }));
  };

  const submit = async (form: RuntimeForm) => {
    if (submitting.current) return;
    const values = answers[form.id] || {};
    const { answers: accepted, issues: nextErrors } = validateFormAnswers(form.questions || [], values);
    if (Object.keys(nextErrors).length) { setErrors(previous => ({ ...previous, [form.id]: nextErrors })); return; }
    submitting.current = true; setWorking(form.id); setNotice(null);
    try {
      const result = await apiClient.submitStudioForm(processId, form.id, accepted, Number(form.revision || 0));
      if (activeProcess.current !== processId) return;
      const complete = result.archiveStatus === 'ARCHIVED' && !result.workflowPending;
      setNotice({ ok: complete, text: complete ? `${copy.saved} ${copy.archived}.` : `${copy.saved} ${result.workflowError || copy.archivePending}` });
      await refresh();
    } catch (error) {
      if (activeProcess.current !== processId) return;
      if (error instanceof ApiRequestError && error.issues) setErrors(previous => ({ ...previous, [form.id]: error.issues! }));
      setNotice({ ok: false, text: error instanceof Error ? error.message : 'Não foi possível enviar o formulário.' });
      if (error instanceof ApiRequestError && error.code === 'STALE_FORM_REVISION') await refresh();
    }
    finally { if (activeProcess.current === processId) { submitting.current = false; setWorking(''); } }
  };

  const renderField = (form: RuntimeForm, question: FormQuestionItem) => {
    const field = normalizeKey(question.fieldKey), value = answers[form.id]?.[field] ?? '', issue = errors[form.id]?.[field];
    const common = { id: `${form.id}-${field}`, name: field, 'aria-invalid': Boolean(issue), 'aria-describedby': `${form.id}-${field}-help`, className: `w-full rounded-xl border px-3 py-2.5 text-sm outline-none focus:ring-2 ${issue ? 'border-rose-400 focus:ring-rose-200' : 'border-slate-300 focus:ring-emerald-200'}` };
    if (question.fieldType === 'textarea') return <textarea {...common} rows={4} value={String(value)} placeholder={question.placeholder} onChange={event => updateAnswer(form.id, question, event.target.value)} />;
    if (question.fieldType === 'select') return <select {...common} value={String(value)} onChange={event => updateAnswer(form.id, question, event.target.value)}><option value="">{copy.select}</option>{(question.options || []).map(option => <option key={option} value={option}>{option}</option>)}</select>;
    if (question.fieldType === 'radio') return <div className="grid gap-2 sm:grid-cols-2">{(question.options || []).map(option => <label key={option} className="flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 px-3 text-sm"><input type="radio" name={`${form.id}-${field}`} value={option} checked={value === option} onChange={() => updateAnswer(form.id, question, option)} />{option}</label>)}</div>;
    if (question.fieldType === 'checkbox') return <label className="flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 px-3 text-sm"><input id={common.id} type="checkbox" checked={Boolean(value)} onChange={event => updateAnswer(form.id, question, event.target.checked)} />{question.placeholder || 'Confirmo esta informação'}</label>;
    const type = question.fieldType === 'file' ? 'url' : ['date', 'number', 'email'].includes(question.fieldType) ? question.fieldType : 'text';
    return <input {...common} type={type} value={String(value)} placeholder={question.fieldType === 'file' ? copy.fileLink : question.placeholder} onChange={event => updateAnswer(form.id, question, question.fieldType === 'number' && event.target.value !== '' ? Number(event.target.value) : event.target.value)} />;
  };

  if (loading) return <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600">Carregando formulários publicados…</div>;
  return <section className="space-y-4" aria-labelledby="studio-forms-title">
    <div className="flex items-center gap-2"><ClipboardList className="h-5 w-5" style={{ color: accentColor }} /><div><h2 id="studio-forms-title" className="text-sm font-black uppercase text-slate-900">{copy.formsTitle}</h2><p className="text-xs text-slate-500">Somente formulários publicados para o seu papel aparecem aqui.</p></div></div>
    {notice && <div role="status" className={`flex items-start gap-2 rounded-xl border p-3 text-sm ${notice.ok ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-amber-200 bg-amber-50 text-amber-950'}`}>{notice.ok ? <CheckCircle2 className="h-5 w-5 shrink-0" /> : <AlertCircle className="h-5 w-5 shrink-0" />}<span>{notice.text}</span></div>}
    {!forms.length && <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-600">{copy.emptyForms}</div>}
    {forms.map(form => {
      const values = answers[form.id] || {}, prior = priorByForm.get(form.id) || [];
      return <article key={form.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <header className="border-b border-slate-200 bg-slate-50 px-5 py-4"><div className="flex flex-wrap items-start justify-between gap-2"><div><div className="text-[10px] font-black uppercase tracking-wider" style={{ color: accentColor }}>{form.stage} · {form.targetRole}</div><h3 className="mt-1 text-base font-black text-slate-900">{form.title}</h3><p className="mt-1 text-sm text-slate-600">{form.description}</p></div><span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-bold text-slate-600">{copy.revision} {form.revision || 0}</span></div></header>
        <div className="space-y-5 p-5">{(form.questions || []).filter(question => evaluateStudioCondition(question.visibleWhen, values)).map((question, index) => { const field = normalizeKey(question.fieldKey), issue = errors[form.id]?.[field]; return <div key={question.id}><label htmlFor={`${form.id}-${field}`} className="mb-1.5 block text-sm font-bold text-slate-800">{index + 1}. {question.label}{question.required && <span className="ml-1 text-rose-600">*</span>}</label>{renderField(form, question)}<div id={`${form.id}-${field}-help`} className={`mt-1 text-xs ${issue ? 'font-semibold text-rose-700' : 'text-slate-500'}`}>{issue || question.helpText}</div></div>; })}
          <button type="button" onClick={() => void submit(form)} disabled={Boolean(working)} className="portal-action portal-action-primary min-h-11">{working === form.id ? copy.submitting : copy.submit}</button>
          {!!prior.length && <details className="rounded-xl border border-slate-200 bg-slate-50 p-3"><summary className="flex cursor-pointer items-center gap-2 text-xs font-black uppercase text-slate-700"><History className="h-4 w-4" />{copy.history} ({prior.length})</summary><div className="mt-3 space-y-2">{prior.map(item => <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white px-3 py-2 text-xs text-slate-600"><span>{new Date(item.submittedAt).toLocaleString(locale || 'pt-BR')} · v{item.formRevision}</span><span className={`inline-flex items-center gap-1 font-bold ${item.archiveStatus === 'ARCHIVED' ? 'text-emerald-700' : 'text-amber-700'}`}><HardDrive className="h-3.5 w-3.5" />{item.archiveStatus}</span></div>)}</div></details>}
        </div>
      </article>;
    })}
  </section>;
};
