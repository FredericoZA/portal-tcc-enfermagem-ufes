import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { apiClient } from '../services/apiClient';
import type { WorkflowSimulationResult, WorkflowSimulationScenario, WorkflowTraceEntry } from '../types/automation';
import type { IntegrationStudioSettings } from '../types/integrationStudio';
import { formatDateTimeWithWeekday } from '../utils/formatters';

const eventLabels: Record<string, string> = {
  TCC_CREATED: 'Cadastro e pedido de reserva',
  LOCATION_PENDING: 'Reserva aguardando resposta',
  LOCATION_UNAVAILABLE: 'Reserva recusada',
  RESERVATION_RESCHEDULED: 'Nova solicitação de reserva',
  LOCATION_CONFIRMED: 'Reserva aceita',
  INVITATION_SENT: 'Ciência da banca',
  EVALUATION_SUBMITTED: 'Registro do conceito e da ata',
  SIGNATURE_PENDING: 'Ata aguardando assinaturas',
  ATA_ASSINADA: 'Ata arquivada',
  REPOSITORY_SUBMITTED: 'Entrega acadêmica',
  TERMO_ASSINADO: 'Termo assinado',
  PUBLICATION_CLEARED: 'Declaração de participação',
  PROCESS_COMPLETED: 'Conclusão',
};

const labels: Record<string, string> = {
  COMPLETED: 'Concluído',
  PARTIAL_FAILURE: 'Falha em uma ação',
  FAILED_VALIDATION: 'Validação bloqueada',
  FAILED: 'Falhou',
  SKIPPED: 'Não se aplica',
  DOCUMENT: 'Documento',
  EMAIL: 'E-mail',
  FORM: 'Formulário',
  SYSTEM_ACTION: 'Ação do Portal',
};

const simulationNote = 'Veja o percurso de um TCC fictício. A simulação não envia e-mails, não aciona assinaturas e não altera registros.';

function simulationEmailHtml(mail: WorkflowSimulationResult['emails'][number]) {
  const safeText = mail.text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return `<!doctype html><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{font:16px/1.5 Arial;padding:12px;overflow-wrap:anywhere}pre{white-space:pre-wrap;font:inherit}</style>${mail.html || '<pre>'+safeText+'</pre>'}`;
}

export function WorkflowSimulationPanel({ studio, showTrace = false }: { studio: IntegrationStudioSettings; showTrace?: boolean }) {
  const [scenario, setScenario] = useState<WorkflowSimulationScenario>({ locationOutcome: 'CONFIRMED', publication: true });
  const [published, setPublished] = useState(false);
  const [simulation, setSimulation] = useState<WorkflowSimulationResult | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [protocol, setProtocol] = useState('');
  const [trace, setTrace] = useState<WorkflowTraceEntry[] | null>(null);
  const [traceError, setTraceError] = useState('');
  const [traceBusy, setTraceBusy] = useState(false);

  function changeScenario(patch: Partial<WorkflowSimulationScenario>) {
    setScenario(current => ({ ...current, ...patch }));
    setSimulation(null);
  }

  async function simulate() {
    setBusy(true);
    setError('');
    setSimulation(null);
    try { setSimulation(await apiClient.simulateWorkflow(published ? undefined : studio, scenario)); }
    catch (error) { setError(error instanceof Error ? error.message : 'Não foi possível simular o fluxo.'); }
    finally { setBusy(false); }
  }

  async function searchTrace(event: React.FormEvent) {
    event.preventDefault();
    setTraceBusy(true);
    setTraceError('');
    setTrace(null);
    try { setTrace(await apiClient.getWorkflowProcessTrace(protocol.trim())); }
    catch (error) { setTraceError(error instanceof Error ? error.message : 'Não foi possível consultar a trilha.'); }
    finally { setTraceBusy(false); }
  }

  return <div className="space-y-3">
    <details className="rounded-xl border border-[var(--portal-border)] bg-[var(--portal-surface-panel)] p-3">
      <summary className="cursor-pointer font-bold">Simular o fluxo</summary>
      <p className="my-2 text-xs text-slate-700">{simulationNote}</p>
      <fieldset className="grid gap-3 text-xs sm:grid-cols-2" disabled={busy}>
        <label className="grid gap-1">Versão da configuração<select className="portal-input" value={published ? 'published' : 'editing'} onChange={event => { setPublished(event.target.value === 'published'); changeScenario({ failActionId: '' }); }}>
          <option value="editing">Em edição</option><option value="published">Publicada</option>
        </select></label>
        <label className="grid gap-1">Resposta à reserva<select className="portal-input" value={scenario.locationOutcome} onChange={event => changeScenario({ locationOutcome: event.target.value as WorkflowSimulationScenario['locationOutcome'] })}>
          <option value="CONFIRMED">Aceita</option><option value="PENDING">Aguardando resposta</option><option value="UNAVAILABLE">Recusada</option>
        </select></label>
        <div className="flex flex-wrap gap-3 sm:col-span-2">
          <label className="flex items-center gap-1.5"><input type="checkbox" checked={scenario.secondAuthor === true} onChange={event => changeScenario({ secondAuthor: event.target.checked })}/>Dois autores</label>
          <label className="flex items-center gap-1.5"><input type="checkbox" checked={scenario.publication !== false} onChange={event => changeScenario({ publication: event.target.checked })}/>Autoriza publicação</label>
          <label className="flex items-center gap-1.5"><input type="checkbox" checked={scenario.ataSignaturePending === true} onChange={event => changeScenario({ ataSignaturePending: event.target.checked })}/>Ata com assinatura pendente</label>
        </div>
        {!published && <label className="grid gap-1 sm:col-span-2">Falha simulada na geração de documento<select className="portal-input" value={scenario.failActionId || ''} onChange={event => changeScenario({ failActionId: event.target.value })}>
          <option value="">Nenhuma</option>
          {studio.workflowStages.flatMap(stage => {
            const actions = Array.isArray(stage.actions) ? stage.actions as Record<string, unknown>[] : [];
            return actions.filter(action => /^(doc|document|documento)$/i.test(String(action.type))).map(action => <option key={String(action.id)} value={String(action.id)}>{String(stage.title)} · {String(action.title)}</option>);
          })}
        </select></label>}
      </fieldset>
      <button className="portal-button-primary mt-3" type="button" disabled={busy} onClick={() => void simulate()}>{busy ? 'Simulando…' : 'Simular percurso'}</button>
      {error && <p role="alert" className="mt-2 text-xs text-red-800">{error}</p>}
      {simulation && <div className="mt-3 space-y-3">
        <p role="status" className="text-xs text-slate-700">{simulation.note}</p>
        <ol className="space-y-1" aria-label="Percurso simulado">
          {simulation.events.map((event, index) => <li key={event.event} className="text-xs">
            {index > 0 && <ChevronDown aria-hidden="true" className="ml-3 h-4 w-4 text-slate-500"/>}
            <div className="rounded-lg border border-[var(--portal-border)] bg-white p-2">
              <strong>{eventLabels[event.event] || event.event}</strong> · {event.role}
              <p>{labels[event.state] || event.state}</p>
              {!!event.details?.length && <ul className="mt-1 list-disc pl-4">
                {event.details.map(action => <li key={action.actionId}>{labels[action.kind]} · {labels[action.status]}{action.error ? ` · ${action.error}` : ''}</li>)}
              </ul>}
              {!!event.issues?.length && <ul className="mt-1 list-disc pl-4">
                {event.issues.map((issue, index) => <li key={index}>{issue.message}</li>)}
              </ul>}
            </div>
          </li>)}
        </ol>
        {!!simulation.emails.length && <details className="rounded-lg border border-[var(--portal-border)] bg-white p-2 text-xs">
          <summary className="cursor-pointer font-bold">Prévia dos e-mails simulados ({simulation.emails.length})</summary>
          <p className="my-2">Mensagens produzidas pelo executor configurável durante a simulação.</p>
          {simulation.emails.map((mail, index) => <article key={index} className="mb-3 border-t border-slate-200 pt-2">
            <h5 className="font-bold">{mail.subject}</h5>
            <p className="my-1 break-words">Destinatários da simulação · {mail.to.join(', ')}</p>
            <iframe title={`Prévia do e-mail simulado ${index + 1}`} sandbox="" referrerPolicy="no-referrer" tabIndex={-1} className="pointer-events-none h-64 w-full rounded-lg border border-slate-200" srcDoc={simulationEmailHtml(mail)}/>
          </article>)}
        </details>}
      </div>}
    </details>

    {showTrace && <details className="rounded-xl border border-[var(--portal-border)] bg-[var(--portal-surface-panel)] p-3">
      <summary className="cursor-pointer font-bold">Consultar a trilha de um TCC</summary>
      <form onSubmit={event => void searchTrace(event)} className="my-3 flex flex-wrap items-end gap-2">
        <label className="grid gap-1 text-xs">Protocolo do TCC<input className="portal-input" placeholder="TCC-2026-0001" maxLength={60} required disabled={traceBusy} value={protocol} onChange={event => { setProtocol(event.target.value); setTrace(null); }}/></label>
        <button className="portal-button-secondary" type="submit" disabled={!protocol.trim() || traceBusy}>{traceBusy ? 'Consultando…' : 'Consultar'}</button>
      </form>
      {traceError && <p role="alert" className="text-xs text-red-800">{traceError}</p>}
      {trace && (trace.length ? <div className="overflow-x-auto">
        <table className="portal-data-table text-xs">
          <caption className="sr-only">Execuções registradas para {trace[0].protocol}</caption>
          <thead><tr><th scope="col">Evento</th><th scope="col">Início</th><th scope="col">Término</th><th scope="col">Situação</th><th scope="col">Revisão</th></tr></thead>
          <tbody>{trace.map(entry => <tr key={entry.id}><th scope="row">{eventLabels[entry.eventCode] || entry.eventCode}</th><td>{formatDateTimeWithWeekday(entry.startedAt)}</td><td>{formatDateTimeWithWeekday(entry.completedAt)}</td><td>{labels[entry.status]}{entry.failedActions > 0 && <span className="block">Ações com falha · {entry.failedActions}</span>}</td><td>{entry.studioRevision ?? '—'}</td></tr>)}</tbody>
        </table>
      </div> : <p role="status" className="text-xs">O TCC ainda não tem execuções registradas.</p>)}
    </details>}
  </div>;
}
