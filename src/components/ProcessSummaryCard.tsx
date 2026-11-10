import {DEFENSE_WEEKDAY_MESSAGE,isDefenseWeekday} from '../utils/defenseSchedule';
import {savedReservationMatches} from '../utils/reservationChangeConfirmation';
import React, { useEffect, useRef, useState } from 'react';
import { CalendarClock, Mail, MapPin, Pencil, RotateCcw } from 'lucide-react';
import type { ProcessData } from '../types';
import { apiClient, ApiRequestError } from '../services/apiClient';
import { PortalModalShell } from './PortalModalShell';
import { RegistrationFieldPreview } from './RegistrationFieldPreview';
import { formatDateWithWeekday, formatDateNumericWithWeekday, formatTimeExtenso, formatTccTitle, saoPauloCalendarDate } from '../utils/formatters';
import { isOtherDefenseLocation, OTHER_DEFENSE_LOCATION, renderCustomLocationName } from '../utils/customDefenseLocation';
import { operationalConfig } from '../utils/operationalConfig';
import { isManagedDefenseLocation } from '../utils/reservationLocation';
import { effectiveDefenseReservationStatus } from '../utils/defenseReservationState';
import { reservationStatusAlert } from '../utils/reservationStatusAlert';
import type { IntegrationStudioSettings } from '../types/integrationStudio';

type ProcessSummaryProps = {
  process: ProcessData;
  canEdit: boolean;
  canEditReservation?: boolean;
  advisorViewerEmail?: string;
  isAuthenticated?: boolean;
  onEditingChange?: (editing:boolean)=>void;
  studio?: Partial<IntegrationStudioSettings>;
  onUpdated: () => Promise<void>;
  onReservationSaved?: (saved:ProcessData)=>void;
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

const webmailByDomain = new Map([
  ['ufes.br', 'https://mail.google.com/'],
  ['edu.ufes.br', 'https://mail.google.com/'],
  ['gmail.com', 'https://mail.google.com/'],
  ['outlook.com', 'https://outlook.live.com/mail/'],
  ['hotmail.com', 'https://outlook.live.com/mail/'],
  ['live.com', 'https://outlook.live.com/mail/'],
  ['yahoo.com', 'https://mail.yahoo.com/'],
  ['icloud.com', 'https://www.icloud.com/mail/'],
]);

const compactField = 'flex min-w-0 flex-col gap-1';
const fieldLabel = 'text-[10px] font-semibold text-slate-600';
const fieldValue = 'text-[11px] font-semibold leading-4 text-slate-900';

export const ProcessSummaryCard: React.FC<ProcessSummaryProps> = ({
  process, canEdit, canEditReservation=false, advisorViewerEmail, isAuthenticated=false, onEditingChange, studio, onUpdated,onReservationSaved,
}) => {
  const [titleEditing, setTitleEditing] = useState(false);
  const [title, setTitle] = useState(process.titulo);
  const [titleSaving, setTitleSaving] = useState(false);
  const [titleBaseRevision,setTitleBaseRevision]=useState(process.dataRevision);
  const [reservationOpen, setReservationOpen] = useState(false);
  const [reservationBaseRevision,setReservationBaseRevision]=useState(process.dataRevision);
  const reservationInFlight=useRef(false);
  const reservationBaseline=useRef(process);
  const [reservationSending, setReservationSending] = useState(false);
  const [reservationReview, setReservationReview] = useState<Pick<ProcessData['defesa'],'startAt'|'local'> | null>(null);
  const [reservationNeedsRefresh, setReservationNeedsRefresh] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [requested, setRequested] = useState(() => dateTimeForInput(process.defesa?.startAt || ''));
  const [locationChoice, setLocationChoice] = useState(process.defesa?.local || '');
  const [customLocation, setCustomLocation] = useState('');
  const publishedLocations = operationalConfig(studio).reservation.locations.filter(Boolean);
  const departmentManagesSelection = isManagedDefenseLocation(locationChoice, publishedLocations);
  const alert = reservationStatusAlert(process, canEditReservation ? 'author' : isAuthenticated ? 'other' : 'visitor', publishedLocations, advisorViewerEmail);
  const webmailUrl = alert?.awaitsViewerResponse
    ? webmailByDomain.get(advisorViewerEmail?.split('@')[1] || '')
    : undefined;
  const confirmed = !alert && !process.legacyRecord && effectiveDefenseReservationStatus(process) === 'CONFIRMADO';
  const denial = alert?.kind === 'denied';
  const outstanding = !alert?.awaitsViewerResponse && alert?.kind === 'waiting' && ['PENDING', 'SENT'].includes(
    String(process.defesa?.reservationChangeRequest?.status || ''),
  );

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
    reservationBaseline.current=process;
    const previousFailed = process.defesa.reservationChangeRequest?.status === 'SEND_FAILED'
      ? process.defesa.reservationChangeRequest : null;
    setRequested(dateTimeForInput(previousFailed?.startAt || process.defesa?.startAt || ''));
    setLocationChoice(previousFailed?.locationChoice || (
      process.defesa?.local && locations.includes(process.defesa.local)
        ? process.defesa.local : OTHER_DEFENSE_LOCATION
    ));
    setCustomLocation(previousFailed && isOtherDefenseLocation(previousFailed.locationChoice) ? previousFailed.local : '');
    setError('');
    setReservationReview(null);
    setReservationNeedsRefresh(false);
    setReservationBaseRevision(process.dataRevision);
    setReservationOpen(true);
  };

  const refreshReservation = async (snapshot?:ProcessData) => {
    const latest = snapshot||await apiClient.getProcessById(process.id);
    if (latest.id !== process.id || !Number.isSafeInteger(latest.dataRevision) || !latest.defesa) {
      throw new Error('Não foi possível conferir os dados atuais do processo. Tente atualizar novamente.');
    }
    reservationBaseline.current=latest;
    setReservationBaseRevision(latest.dataRevision);
    setReservationReview({startAt:latest.defesa.startAt,local:latest.defesa.local});
    setReservationNeedsRefresh(false);
    setError('');
  };

  const acceptReservationSave=async(result:ProcessData&{reservationRestarted?:boolean;workflowPending?:boolean;workflowProcessing?:boolean},readback=false)=>{
    reservationBaseline.current=result;
    setReservationOpen(false);setReservationNeedsRefresh(false);setReservationBaseRevision(result.dataRevision);setError('');
    const message=readback?'A alteração da reserva foi confirmada no processo. Acompanhe a situação atual do pedido.'
      :!result.reservationRestarted?'Nenhuma alteração de data, horário ou local foi registrada.'
      :result.workflowProcessing?'Reserva alterada e salva. O envio automático do novo pedido está em processamento.'
      :result.workflowPending?'Reserva alterada. O novo pedido aguarda envio; acompanhe a situação no processo.'
      :'Novo pedido enviado ao responsável. Aguarde o aceite ou a recusa da reserva.';
    setNotice(message);
    if(onReservationSaved){onReservationSaved(result);return;}
    try{await onUpdated();}catch{setNotice(`${message} Não foi possível atualizar a consulta agora; a alteração salva foi preservada.`);}
  };

  const submitReservationChange = async (event: React.FormEvent) => {
    event.preventDefault();
    if(reservationInFlight.current || reservationSending || reservationNeedsRefresh)return;
    setError('');
    if (!requested.date || !requested.time || !locationChoice) {
      setError('Preencha data, horário e local da nova solicitação.');return;
    }
    if (!isDefenseWeekday(requested.date)) {
      setError(DEFENSE_WEEKDAY_MESSAGE);return;
    }
    if (isOtherDefenseLocation(locationChoice) && !renderCustomLocationName(customLocation).trim()) {
      setError('Informe o nome ou endereço completo do outro local.');return;
    }
    const before=reservationBaseline.current;
    const proposal={date:requested.date,time:requested.time,locationChoice,
      customLocation:isOtherDefenseLocation(locationChoice)?customLocation:'',expectedDataRevision:reservationBaseRevision};
    reservationInFlight.current=true;setReservationSending(true);
    try {
      const result=await apiClient.requestReservationChange(process.id,proposal);
      await acceptReservationSave(result);
    } catch (cause) {
      const uncertain=cause instanceof TypeError||(cause instanceof ApiRequestError&&(cause.code==='STALE_DATA_REVISION'||cause.status===0||cause.status>=500));
      if(uncertain){
        setReservationNeedsRefresh(true);
        try{
          const latest=await apiClient.getProcessById(process.id);
          if(savedReservationMatches(latest,before,proposal)){
            await acceptReservationSave(latest,true);return;
          }
          await refreshReservation(latest);
          setError(cause instanceof Error?cause.message:'A alteração não foi confirmada. Confira os dados atuais antes de enviar.');
        }catch{setError('Não foi possível conferir se a alteração foi salva. Seu preenchimento foi mantido. Clique em Atualizar dados antes de tentar outro envio.');}
      }else setError(cause instanceof Error?cause.message:'Não foi possível solicitar a alteração da reserva.');
    } finally {reservationInFlight.current=false;setReservationSending(false);}
  };

  const closeReservation = () => {
    if(reservationSending)return;
    setReservationOpen(false);
    if(reservationReview)void onUpdated().catch(()=>undefined);
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
          <div className={`${compactField} ${webmailUrl && canEditReservation ? 'sm:col-span-3' : 'sm:col-span-5'}`}>
            <span className={fieldLabel}>Local da defesa</span>
            <span className={`${fieldValue} break-words`}>{process.defesa?.local || 'A confirmar'}</span>
          </div>
          <div className={`flex flex-wrap items-center justify-center gap-2 ${webmailUrl && canEditReservation ? 'sm:col-span-4' : 'sm:col-span-2'}`}>
            {webmailUrl && (
              <a href={webmailUrl} target="_blank" rel="noopener noreferrer" className="portal-action inline-flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5" aria-hidden="true"/>
                Acessar e-mail para responder
              </a>
            )}
            {canEditReservation && (
              <button
                type="button"
                onClick={openReservation}
                disabled={outstanding}
                aria-label={denial ? 'Refazer reserva' : 'Alterar reserva da defesa'}
                title={outstanding ? 'Há uma solicitação de alteração aguardando resolução.' : denial ? 'Refazer a reserva negada' : 'Solicitar nova reserva'}
                className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-full border border-red-700 bg-red-700 px-3 py-1.5 text-[10px] font-bold text-white shadow-sm hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <RotateCcw className="h-3.5 w-3.5" aria-hidden="true"/>
                {denial ? 'Refazer reserva' : 'Alterar reserva'}
              </button>
            )}
          </div>
        </div>
        {confirmed && (
          <p role="status" className="mx-auto mt-2 w-fit max-w-full rounded-lg border text-center border-[var(--portal-brand-action-border)] bg-[var(--portal-brand-sage)] px-3 py-2 text-[11px] leading-4 text-[var(--portal-text-dark)]">
            <strong>Reserva confirmada.</strong>
            {canEditReservation && ' Se precisar mudar a data, o horário ou o local, use “Alterar reserva”. A mudança inicia uma nova solicitação, que precisa ser confirmada.'}
          </p>
        )}
        {alert && (
          <p role="alert" className={`mx-auto mt-2 w-fit max-w-full rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-center text-[11px] leading-4 text-red-800 ${denial ? 'font-bold' : 'font-semibold'}`}>
            {alert.text}
          </p>
        )}
        {notice && !alert && (
          <p role="status" className="mx-auto mt-2 w-fit max-w-full rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-center text-[11px] text-amber-950">
            {notice}
          </p>
        )}
        {error && !reservationOpen && <p role="alert" className="mt-2 text-[10px] text-red-700">{error}</p>}
      </section>
      <PortalModalShell
        open={reservationOpen}
        onClose={closeReservation}
        closeOnBackdrop={!reservationSending}
        closeOnEscape={!reservationSending}
        title={`${process.protocolo} - ${denial ? 'Refazer reserva' : 'Alterar reserva de defesa'}`}
        icon={CalendarClock}
        maxWidthClass="max-w-lg"
        bodyClassName="p-4"
      >
        <form id="reservation-change-form" onSubmit={(event) => void submitReservationChange(event)} className="space-y-3">
          <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-[11px] leading-4 text-amber-950">
            {locationChoice ? <>Antes de enviar, consulte {departmentManagesSelection ? 'o Departamento de Enfermagem' : 'seu orientador'} para conciliar a defesa com aulas, eventos ou outras reservas dos espaços.</> : 'Selecione o local da defesa para saber quem deve confirmar a reserva.'} O envio cria uma <strong>nova solicitação</strong> ao responsável pelo local e invalida a confirmação anterior. O novo local e horário ficam bloqueados no Portal por 1h30 de defesa enquanto aguardam aceite ou recusa.
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className={compactField}>
              <span className={fieldLabel}>Nova data *</span>
              <input required type="date" min={saoPauloCalendarDate()} value={requested.date} onChange={(event) => setRequested((current) => ({ ...current, date: event.target.value }))} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs" />
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
              <input required value={customLocation} onChange={(event) => setCustomLocation(event.target.value)} placeholder="Ex.: Auditório Central da UFES" className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs" />
              <RegistrationFieldPreview kind="location" value={customLocation}/>
              <span className="text-[10px] text-slate-600">O Portal ajusta as iniciais e reconhece siglas automaticamente.</span>
            </label>
          )}
          <div className="flex items-center gap-1.5 text-[11px] text-slate-700">
            <MapPin className="h-3.5 w-3.5 shrink-0 text-emerald-800" aria-hidden="true" />
            {locationChoice && (departmentManagesSelection
              ? 'A solicitação será enviada ao Departamento de Enfermagem.'
              : 'A confirmação será solicitada ao orientador cadastrado.')}
          </div>
          {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-800">{error}</p>}
          {reservationReview && <p role="status" className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-950">
            O processo foi atualizado. Seu preenchimento foi mantido. Confira antes de enviar novamente.<br />
            <strong>Reserva atual no processo:</strong> {formatDateNumericWithWeekday(reservationReview.startAt)}, {dateTimeForInput(reservationReview.startAt).time} — {reservationReview.local}.
          </p>}
          <div className="flex flex-wrap justify-end gap-2 border-t border-slate-200 pt-3">
            <button type="button" disabled={reservationSending} onClick={closeReservation} className="rounded-full bg-slate-200 px-4 py-2 text-xs font-semibold text-slate-800 disabled:opacity-50">Cancelar</button>
            {reservationNeedsRefresh && <button type="button" disabled={reservationSending} onClick={async()=>{setReservationSending(true);try{await refreshReservation();}catch{setError('Não foi possível atualizar os dados. Seu preenchimento continua preservado. Tente novamente.');}finally{setReservationSending(false);}}} className="rounded-full bg-slate-200 px-4 py-2 text-xs font-semibold text-slate-800 disabled:opacity-50">Atualizar dados</button>}
            <button type="submit" disabled={reservationSending || reservationNeedsRefresh} className="rounded-full bg-emerald-800 px-4 py-2 text-xs font-bold text-white disabled:opacity-50">
              {reservationSending ? 'Aguarde…' : reservationReview ? 'Enviar solicitação após revisão' : 'Enviar nova solicitação'}
            </button>
          </div>
        </form>
      </PortalModalShell>
    </>
  );
};
