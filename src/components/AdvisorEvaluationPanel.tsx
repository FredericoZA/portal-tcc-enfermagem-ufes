import React, { useEffect, useState } from 'react';
import type { ProcessData } from '../types';
import type { RegistrationAnswers } from '../types/operationalConfig';
import { apiClient } from '../services/apiClient';
import { acceptEvaluationAnswers, EVALUATION_FORM_ID, evaluationQuestions, evaluationReviewRows } from '../utils/evaluationForm';
import { evaluateStudioCondition } from '../utils/courseStudioValidator';

export function AdvisorEvaluationPanel({ process, canEvaluate, canReopen, onReopen, onUpdated }: {
  process: ProcessData; canEvaluate: boolean; canReopen: boolean; onReopen: () => void; onUpdated: () => Promise<void>;
}) {
  const [schema, setSchema] = useState<Awaited<ReturnType<typeof apiClient.getEvaluationSchema>> | null>(null);
  const [answers, setAnswers] = useState<RegistrationAnswers>({});
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [now, setNow] = useState(Date.now());
  const [schemaRetry, setSchemaRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setConfirmed(false); setAnswers({}); setSchema(null); setError('');
    if (canEvaluate) apiClient.getEvaluationSchema(process.id).then(value => { if (active) setSchema(value); }).catch(e => { if (active) setError(e.message); });
    return () => { active = false; };
  }, [process.id, process.dataRevision, canEvaluate, schemaRetry]);
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(timer); }, []);
  const studio = schema?.studio;
  const fields = evaluationQuestions(studio);
  const outcomeOptions = schema?.outcomes || [];
  const values = { ...answers };
  const started = Number.isFinite(Date.parse(process.defesa.startAt)) && Date.parse(process.defesa.startAt) <= now;
  const released = process.defesa.localStatus === 'CONFIRMADO' && Boolean(process.defesa.invitationSentAt) && started;
  const reviewRows = process.avaliacao.dataReview?.fields || evaluationReviewRows(process, studio);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setError(''); setNotice('');
    if (!confirmed) { setError('Confira os dados e marque a confirmação antes de enviar.'); return; }
    if (!schema) { setError('Aguarde o carregamento do formulário.'); return; }
    setBusy(true);
    try {
      const data = acceptEvaluationAnswers({ resultadoCode: answers.RESULTADO, notaFinal: answers.NOTA_FINAL, parecer: answers.PARECER, answers }, outcomeOptions, studio);
      const response = await apiClient.submitEvaluation(process.id, { ...data, dataConfirmed: true, expectedDataRevision: process.dataRevision, expectedSchemaRevision: Number(studio.revision || 0) });
      setNotice(response.workflowPending ? `Avaliação salva. A geração ou o encaminhamento da ata está pendente: ${response.workflowError || 'a secretaria deve acompanhar a etapa.'}` : 'Avaliação salva. Acompanhe a ata e sua assinatura na Asten na área de documentos.');
      await onUpdated();
    } catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível salvar a avaliação.'); }
    finally { setBusy(false); }
  };
  return <section id="evaluation-section" className="portal-card overflow-hidden" aria-labelledby="evaluation-title">
    <header className="portal-section-header flex flex-wrap items-center justify-between gap-3 p-4">
      <h2 id="evaluation-title" className="text-lg font-bold">Avaliação e ata da defesa</h2>
      {process.avaliacao.status === 'CONCLUIDO' && canReopen && <button id="reopen-evaluation-btn" type="button" className="portal-action" onClick={onReopen}>Reabrir avaliação</button>}
    </header>
    <div className="space-y-5 p-4 sm:p-5">
      {notice && <p role="status" className="portal-notice">{notice}</p>}
      {error && <p role="alert" className="portal-error">{error}</p>}
      {process.avaliacao.status === 'CONCLUIDO' ? <>
        <dl className="grid gap-4 sm:grid-cols-3"><div><dt>Resultado</dt><dd className="font-semibold">{process.avaliacao.resultadoLabel || process.avaliacao.resultadoCode || 'Não informado'}</dd></div><div><dt>Nota final</dt><dd className="text-2xl font-bold">{process.avaliacao.notaFinal?.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) ?? 'Não informada no registro anterior'}</dd></div><div><dt>Responsável pelo registro</dt><dd>{process.avaliacao.submittedBy}</dd></div></dl>
        <p className="whitespace-pre-wrap">{process.avaliacao.parecer}</p>
        <details><summary>Dados conferidos para esta ata</summary>{process.avaliacao.dataReview ? <div className="overflow-x-auto"><table className="portal-data-table"><tbody>{reviewRows.map(([label, value], i) => <tr key={i}><th scope="row">{label}</th><td>{value}</td></tr>)}</tbody></table></div> : <p>Conferência dos dados deste registro anterior: não confirmado.</p>}</details>
      </> : !canEvaluate ? <p>A avaliação será preenchida pelo orientador no dia da apresentação.</p> : !schema ? error ? <button type="button" className="portal-action" onClick={() => setSchemaRetry(n => n + 1)}>Tentar carregar o formulário novamente</button> : <p role="status">Carregando o formulário do orientador…</p> : <form onSubmit={submit} className="space-y-5">
        <p>Confira os dados informados pelo aluno, acrescente a nota e registre o parecer. O sistema preencherá o modelo DOCX da ata e encaminhará o documento para sua assinatura na Asten.</p>
        <div className="overflow-x-auto"><table className="portal-data-table"><caption className="mb-2 text-left font-semibold">Dados do cadastro do aluno</caption><tbody>{reviewRows.map(([label, value], i) => <tr key={i}><th scope="row">{label}</th><td>{value}</td></tr>)}</tbody></table></div>
        <p>Se houver erro, solicite a correção à secretaria antes de finalizar a avaliação.</p>
        <label className="portal-confirmation"><input id="evaluation-data-confirmed" type="checkbox" required checked={confirmed} onChange={e => setConfirmed(e.target.checked)} disabled={busy} /><span>Conferi nomes, matrículas, orientação, coorientação, banca, título, data, horário, local e demais respostas do aluno. Os dados acima estão corretos.</span></label>
        {!released && <p className="portal-notice">{!process.defesa.invitationSentAt ? 'O registro será liberado após a confirmação do local e o envio do convite.' : 'O registro da nota será liberado no horário da apresentação.'}</p>}
        <fieldset disabled={busy || !released} className="grid gap-5 sm:grid-cols-2">
          <legend className="mb-3 text-lg font-semibold">{String(studio.formTemplates?.find(f => f.id === EVALUATION_FORM_ID)?.title || 'Resultado da apresentação')}</legend>
          {fields.filter(f => evaluateStudioCondition(f.visibleWhen, values)).map(field => {
            const key = field.fieldKey, value = answers[key] ?? '';
            const id = `evaluation-${key}`;
            const common = { id, className: 'portal-input', required: Boolean(field.required), 'aria-describedby': field.helpText ? `${id}-help` : undefined };
            return <label key={key} htmlFor={id} className={`block ${field.fieldType === 'textarea' ? 'sm:col-span-2' : ''}`}><span className="mb-2 block font-semibold">{field.label}{field.required ? ' *' : ''}</span>
              {key === 'RESULTADO' ? <select {...common} value={String(value)} onChange={e => setAnswers(a => ({ ...a, [key]: e.target.value }))}><option value="">Selecione o resultado…</option>{outcomeOptions.map(o => <option key={o.code} value={o.code}>{o.label}</option>)}</select>
                : field.fieldType === 'textarea' ? <textarea {...common} rows={5} maxLength={field.validation?.maxLength || 10000} value={String(value)} onChange={e => setAnswers(a => ({ ...a, [key]: e.target.value }))} />
                : field.fieldType === 'checkbox' ? <input {...common} className="h-5 w-5" type="checkbox" checked={value === true} onChange={e => setAnswers(a => ({ ...a, [key]: e.target.checked }))} />
                : ['select', 'radio'].includes(field.fieldType) ? <select {...common} value={String(value)} onChange={e => setAnswers(a => ({ ...a, [key]: e.target.value }))}><option value="">Selecione…</option>{field.options?.map(o => <option key={o}>{o}</option>)}</select>
                : <input {...common} type={key === 'NOTA_FINAL' ? 'text' : ['number', 'date', 'email'].includes(field.fieldType) ? field.fieldType : 'text'} inputMode={key === 'NOTA_FINAL' ? 'decimal' : undefined} maxLength={field.validation?.maxLength || 1000} value={String(value)} onChange={e => setAnswers(a => ({ ...a, [key]: e.target.value }))} />}
              {field.helpText && <span id={`${id}-help`} className="mt-1 block text-sm">{field.helpText}</span>}
            </label>;
          })}
        </fieldset>
        <button id="submit-evaluation-btn" className="portal-action portal-action-primary" type="submit" disabled={busy || !released || !confirmed}>{busy ? 'Registrando avaliação…' : 'Registrar nota e gerar ata'}</button>
      </form>}
    </div>
  </section>;
}
