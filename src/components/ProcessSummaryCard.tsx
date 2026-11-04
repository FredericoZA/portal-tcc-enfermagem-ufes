import React, { useEffect, useState } from 'react';
import { CalendarClock, MapPin, Pencil, RotateCcw } from 'lucide-react';
import type { ProcessData } from '../types';
import { apiClient } from '../services/apiClient';
import { PortalModalShell } from './PortalModalShell';
import { RegistrationFieldPreview } from './RegistrationFieldPreview';
import { formatDateWithWeekday, formatDateNumericWithWeekday, formatTimeExtenso, formatTccTitle } from '../utils/formatters';
import { isOtherDefenseLocation, OTHER_DEFENSE_LOCATION, renderCustomLocationName } from '../utils/customDefenseLocation';
import { operationalConfig } from '../utils/operationalConfig';
import { reservationStatusAlert } from '../utils/reservationStatusAlert';
import type { IntegrationStudioSettings } from '../types/integrationStudio';

type ProcessSummaryProps = {
  process: ProcessData;
  canEdit: boolean;
  canEditReservation?: boolean;
  onEditingChange?: (editing:boolean)=>void;
  studio?: Partial<IntegrationStudioSettings>;
  onUpdated: () => Promise<void>;
};

const dateTimeForInput = (iso: string): { date: string; time: string } => {
  if (!iso || !Number.isFinite(Date.parse(iso))) return { date: '', time: '' };
  const formatted = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).format(new Date(iso)).replace(' ', 'T');
  return { date: formatted.slice(0, 10), time: formatted.slice(11, 16) };
};

const compactField = 'flex min-w-0 flex-col gap-1';
const fieldLabel = 'text-[10px] font-semibold text-slate-600';
const fieldValue = 'text-[11px] font-semibold leading-4 text-slate-900';

export const ProcessSummaryCard: React.FC<ProcessSummaryProps> = ({
  process, canEdit, canEditReservation=canEdit, onEditingChange, studio, onUpdated,
}) => {
  const [titleEditing, setTitleEditing] = useState(false);
  const [title, setTitle] = useState(process.titulo);
  const [titleSaving, setTitleSaving] = useState(false);
  const [titleBaseRevision,setTitleBaseRevision]=useState(process.dataRevision);
  const [reservationOpen, setReservationOpen] = useState(false);
  const [reservationBaseRevision,setReservationBaseRevision]=useState(process.dataRevision);
  const [reservationSending, setReservationSending] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [requested, setRequested] = useState(() => dateTimeForInput(process.defesa?.startAt || ''));
  const [locationChoice, setLocationChoice] = useState(process.defesa?.local || '');
  const [customLocation, setCustomLocation] = useState('');
  const alert = reservationStatusAlert(process);
  const denial = alert?.kind === 'denied';
  const outstanding = ['PENDING', 'SENT'].includes(
    String(process.defesa?.reservationChangeRequest?.status || ''),
  );

  const publishedLocations = operationalConfig(studio).reservation.locations.filter(Boolean);
  const locations = Array.from(new Set([
    ...publishedLocations.filter((value) => !isOtherDefenseLocation(value)),
    ...(process.defesa?.local && !publishedLocations.includes(process.defesa.local) ? [process.defesa.local] : []),
    OTHER_DEFENSE_LOCATION,
  ]));

  useEffect(() => {
    // Novas revisões não podem sobrescrever campos de um modal ainda em edição.
    if(titleEditing || reservationOpen)return;
    setTitle(process.titulo);
    setTitleBaseRevision(process.dataRevision);
    setRequested(dateTimeForInput(process.defesa?.startAt || ''));
    setLocationChoice(process.defesa?.local || '');
    setCustomLocation('');
  }, [process.id, process.dataRevision, process.titulo, process.defesa?.startAt, process.defesa?.local, titleEditing, reservationOpen]);

  useEffect(()=>{onEditingChange?.(titleEditing||reservationOpen);},[titleEditing,reservationOpen,onEditingChange]);

  const saveTitle = async () => {
    const normalized = formatTccTitle(title);
    if (!normalized.trim()) { setError('Informe o título completo do trabalho.'); return; }
    setTitleSaving(true); setError('');
    try {
      await apiClient.updateProcess(process.id, { titulo: normalized, expectedDataRevision:titleBaseRevision });
      setTitleEditing(false);
      setNotice('Título atualizado.');
      await onUpdated();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível alterar o título.');
    } finally { setTitleSaving(false); }
  };

  const openReservation = () => {
    const previousFailed = process.defesa.reservationChangeRequest?.status === 'SEND_FAILED'
      ? process.defesa.reservationChangeRequest : null;
    setRequested(dateTimeForInput(previousFailed?.startAt || process.defesa?.startAt || ''));
    setLocationChoice(previousFailed?.locationChoice || (
      process.defesa?.local && locations.includes(process.defesa.local)
        ? process.defesa.local : OTHER_DEFENSE_LOCATION
    ));
    setCustomLocation(previousFailed && isOtherDefenseLocation(previousFailed.locationChoice) ? previousFailed.local : '');
    setError('');
    setReservationBaseRevision(process.dataRevision);
    setReservationOpen(true);
  };

  const submitReservationChange = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    if (!requested.date || !requested.time || !locationChoice) {
      setError('Preencha data, horário e local da nova solicitação.');
      return;
    }
    if (isOtherDefenseLocation(locationChoice) && !renderCustomLocationName(customLocation).trim()) {
      setError('Informe o nome ou endereço completo do outro local.');
      return;
    }
    setReservationSending(true);
    try {
      const result = await apiClient.requestReservationChange(process.id, {
        date: requested.date,
        time: requested.time,
        locationChoice,
        customLocation: isOtherDefenseLocation(locationChoice) ? customLocation : '',
        expectedDataRevision: reservationBaseRevision,
      });
      setReservationOpen(false);
      setNotice(result.workflowPending
        ? 'Reserva alterada. O novo pedido aguarda envio; acompanhe a situação no processo.'
        : 'Novo pedido enviado ao responsável. Aguarde o aceite ou a recusa da reserva.');
      await onUpdated();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível solicitar a alteração da reserva.');
    } finally { setReservationSending(false); }
  };

  return (
    <>
      <section className="rounded-xl border border-slate-300 bg-[#dbe2e6] p-2.5 sm:p-3" aria-labelledby="process-summary-title">
        <h3 id="process-summary-title" className="mb-2 text-[12px] font-black text-slate-950">Dados do processo</h3>
        <div className="grid min-w-0 grid-cols-1 gap-x-3 gap-y-2 sm:grid-cols-12">
          <div className={`${compactField} sm:col-span-2`}>
            <span className={fieldLabel}>Protocolo</span>
            <span className={fieldValue}>{process.protocolo}</span>
          </div>
          <div className={`portal-tcc-record-title ${compactField} sm:col-span-8`}>
            <div className="flex items-center justify-between gap-2">
              <span className={fieldLabel}>Título do trabalho</span>
              {canEdit && !titleEditing && (
                <button type="button" onClick={() => {setTitleBaseRevision(process.dataRevision);setTitleEditing(true);}} aria-label="Editar título do trabalho" title="Editar título" className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-800 hover:underline">
                  <Pencil className="h-3 w-3" aria-hidden="true" /> Editar
                </button>
              )}
            </div>
            {titleEditing ? (
              <div className="space-y-1">
                <input autoFocus type="text" value={title} maxLength={500} onChange={(event) => setTitle(event.target.value)} className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-[11px] text-slate-900" aria-label="Título completo do TCC" />
                <RegistrationFieldPreview kind="title" value={title}/>
                <div className="flex gap-2">
                  <button type="button" onClick={() => void saveTitle()} disabled={titleSaving} className="rounded-full bg-emerald-800 px-3 py-1 text-[10px] font-bold text-white disabled:opacity-50">{titleSaving ? 'Salvando…' : 'Salvar título'}</button>
                  <button type="button" disabled={titleSaving} onClick={() => { setTitleEditing(false); setTitle(process.titulo); setError(''); }} className="rounded-full bg-slate-200 px-3 py-1 text-[10px] font-bold text-slate-800">Cancelar</button>
                </div>
              </div>
            ) : (
              <div className="rounded-md border border-slate-300 bg-white/60 px-2 py-1.5 text-center text-[11px] font-semibold text-slate-900">{process.titulo}</div>
            )}
          </div>
          <div className={`${compactField} sm:col-span-2`}>
            <span className={fieldLabel}>Data de registro</span>
            <span className={fieldValue}>{process.createdAt ? formatDateNumericWithWeekday(process.createdAt) : '—'}</span>
          </div>
          <div className={`${compactField} sm:col-span-3`}>
            <span className={fieldLabel}>Data da defesa</span>
            <span className={fieldValue}>{process.defesa?.startAt ? formatDateWithWeekday(process.defesa.startAt) : 'A definir'}</span>
          </div>
          <div className={`${compactField} sm:col-span-2`}>
            <span className={fieldLabel}>Horário</span>
            <span className={fieldValue}>{process.defesa?.startAt && !/^\d{4}-\d{2}-\d{2}$/.test(process.defesa.startAt) ? formatTimeExtenso(process.defesa.startAt) : 'A definir'}</span>
          </div>
          <div className={`${compactField} sm:col-span-5`}>
            <span className={fieldLabel}>Local da defesa</span>
            <span className={`${fieldValue} break-words`}>{process.defesa?.local || 'A confirmar'}</span>
          </div>
          <div className="flex items-end justify-start sm:col-span-2 sm:justify-end">
            {canEditReservation && (
              <button
                type="button"
                onClick={openReservation}
                disabled={outstanding}
                aria-label="Alterar reserva da defesa"
                title={outstanding ? 'Há uma solicitação de alteração aguardando resolução.' : 'Solicitar nova reserva'}
                className={`inline-flex min-h-9 items-center justify-center gap-1.5 rounded-full border px-3 py-1.5 text-[10px] font-bold shadow-sm disabled:cursor-not-allowed disabled:opacity-60 ${denial
                  ? 'border-red-700 bg-red-700 text-white hover:bg-red-800'
                  : 'border-emerald-700 bg-emerald-800 text-white hover:bg-emerald-900'}`}
              >
                <RotateCcw className="h-3.5 w-3.5" aria-hidden="true"/>
                Alterar reserva
              </button>
            )}
          </div>
        </div>
        {alert && (
          <p role="alert" className="mt-2 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-[11px] font-semibold leading-4 text-red-800">
            {alert.text}
          </p>
        )}
        {notice && !alert && (
          <p role="status" className="mt-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-[11px] text-amber-950">
            {notice}
          </p>
        )}
        {error && !reservationOpen && <p role="alert" className="mt-2 text-[10px] text-red-700">{error}</p>}
      </section>
      <PortalModalShell
        open={reservationOpen}
        onClose={() => { if (!reservationSending) setReservationOpen(false); }}
        closeOnBackdrop={!reservationSending}
        closeOnEscape={!reservationSending}
        title={`Alterar reserva da defesa - ${process.protocolo}`}
        icon={CalendarClock}
        maxWidthClass="max-w-lg"
        bodyClassName="p-4"
      >
        <form id="reservation-change-form" onSubmit={(event) => void submitReservationChange(event)} className="space-y-3">
          <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-[11px] leading-4 text-amber-950">
            Antes de enviar, consulte o Departamento de Enfermagem para conciliar a defesa com aulas, eventos e outras reservas dos espaços. O envio cria uma <strong>nova solicitação</strong> ao responsável pelo local e invalida a confirmação anterior. O novo local e horário ficam bloqueados no Portal por 1h30 de defesa enquanto aguardam aceite ou recusa. Para outro local, combine a disponibilidade com o orientador.
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className={compactField}>
              <span className={fieldLabel}>Nova data *</span>
              <input required type="date" value={requested.date} onChange={(event) => setRequested((current) => ({ ...current, date: event.target.value }))} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs" />
              {requested.date&&<span className="text-[11px] font-medium text-emerald-900">{formatDateWithWeekday(requested.date)}</span>}
            </label>
            <label className={compactField}>
              <span className={fieldLabel}>Novo horário *</span>
              <input required type="time" value={requested.time} onChange={(event) => setRequested((current) => ({ ...current, time: event.target.value }))} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs" />
            </label>
          </div>
          <label className={compactField}>
            <span className={fieldLabel}>Novo local *</span>
            <select required value={locationChoice} onChange={(event) => setLocationChoice(event.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs">
              <option value="">Selecione…</option>
              {locations.map((value) => <option key={value} value={value}>{isOtherDefenseLocation(value)?'Outro local — informar endereço/nome':value}</option>)}
            </select>
          </label>
          {isOtherDefenseLocation(locationChoice) && (
            <label className={compactField}>
              <span className={fieldLabel}>Nome ou endereço do outro local *</span>
              <input required value={customLocation} onChange={(event) => setCustomLocation(event.target.value)} placeholder="Ex.: Auditório Central da *UFES*" className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs" />
              <RegistrationFieldPreview kind="location" value={customLocation}/>
              <span className="text-[10px] text-slate-600">Iniciais maiúsculas automaticamente. Para siglas em caixa alta, escreva *UFES*.</span>
            </label>
          )}
          <div className="flex items-center gap-1.5 text-[11px] text-slate-700">
            <MapPin className="h-3.5 w-3.5 shrink-0 text-emerald-800" aria-hidden="true" />
            {isOtherDefenseLocation(locationChoice)
              ? 'A confirmação será solicitada ao orientador cadastrado.'
              : 'A solicitação será enviada ao departamento responsável pela reserva.'}
          </div>
          {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-800">{error}</p>}
          <div className="flex flex-wrap justify-end gap-2 border-t border-slate-200 pt-3">
            <button type="button" disabled={reservationSending} onClick={() => setReservationOpen(false)} className="rounded-full bg-slate-200 px-4 py-2 text-xs font-semibold text-slate-800 disabled:opacity-50">Cancelar</button>
            <button type="submit" disabled={reservationSending} className="rounded-full bg-emerald-800 px-4 py-2 text-xs font-bold text-white disabled:opacity-50">
              {reservationSending ? 'Enviando…' : 'Enviar nova solicitação'}
            </button>
          </div>
        </form>
      </PortalModalShell>
    </>
  );
};
