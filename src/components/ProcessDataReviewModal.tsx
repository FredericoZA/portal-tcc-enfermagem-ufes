import {CapitalizationReview} from './CapitalizationReview';
import {suggestSentenceTitle} from '../utils/reviewedTccTitle';
import { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarCheck, ClipboardCheck, LoaderCircle } from 'lucide-react';
import type { ProcessData, IntegrationStudioSettings } from '../types';
import type { RegistrationAnswers, RegistrationQuestion } from '../types/operationalConfig';
import type {
  ReviewedAuthor,
  ReviewedFaculty,
} from '../types/processDataReview';
import { apiClient } from '../services/apiClient';
import {
  operationalConfig,
  registrationQuestions,
} from '../utils/operationalConfig';
import {
  processDataReviewValues,
  processDataReviewPatch,
  processDataReviewHasChanges,
  isProcessReviewMetadataField,
} from '../utils/processDataReview';
import { ACADEMIC_DEGREES } from '../utils/personPresentation';
import {
  OTHER_DEFENSE_LOCATION,
  isOtherDefenseLocation,
} from '../utils/customDefenseLocation';
import { isDefenseWeekday } from '../utils/defenseSchedule';
import { PortalModalShell } from './PortalModalShell';
import { ReservationCalendarPicker } from './ReservationCalendarPicker';

const sections = [
  ['trabalho', 'Trabalho'],
  ['autores', 'Autores'],
  ['orientacao', 'Orientação'],
  ['banca', 'Examinadores'],
  ['defesa', 'Data e local'],
] as const;
type Section = (typeof sections)[number][0];
const blankAuthor: ReviewedAuthor = {
  nome: '',
  email: '',
  tratamento: 'Aluno',
};
const blankFaculty: ReviewedFaculty = {
  nome: '',
  email: '',
  tratamento: 'Professor',
  titulacao: '',
  instituicao: '',
};

export function ProcessReviewMetadataField({field,value,onChange}:{
  key?:string;
  field:RegistrationQuestion;
  value:RegistrationAnswers[string]|undefined;
  onChange:(value:RegistrationAnswers[string])=>void;
}) {
  return <label className={field.fieldType==='textarea'?'sm:col-span-2':''}>
    <span className="mb-1 block text-sm font-semibold">{field.label}{field.required?' *':''}</span>
    {field.fieldType==='checkbox'?<input type="checkbox" className="h-6 w-6" required={field.required} checked={value===true} onChange={event=>onChange(event.target.checked)}/>
      :field.options?.length?<select className="portal-input" required={field.required} value={String(value??'')} onChange={event=>onChange(event.target.value)}>
        <option value="">Selecione…</option>
        {field.options.map(option=><option key={option}>{option}</option>)}
      </select>:<input className="portal-input" required={field.required} type={field.fieldType==='number'?'number':'text'} value={String(value??'')} maxLength={field.validation?.maxLength||1000} onChange={event=>onChange(event.target.value)}/>}
  </label>;
}

export function ProcessDataReviewModal({
  process,
  canChangeAdvisorEmail = false,
  onClose,
  onSaved,
}: {
  process: ProcessData;
  canChangeAdvisorEmail?: boolean;
  onClose: () => void;
  onSaved: (saved: ProcessData) => void;
}) {
  const [studio, setStudio] = useState<Partial<IntegrationStudioSettings>>();
  const [schemaFailed, setSchemaFailed] = useState(false);
  const [schemaAttempt, retrySchema] = useState(0);
  const [section, setSection] = useState<Section>('trabalho');
  const [confirmedCases,setConfirmedCases]=useState<Record<string,string>>({});
  const [values, setValues] = useState(() => processDataReviewValues(process));
  const base = useRef(processDataReviewValues(process));
  const tabs = useRef<HTMLDivElement>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const inFlight = useRef(false);
  useEffect(() => {
    let active = true;
    setSchemaFailed(false);
    apiClient
      .getProcessDataReviewSchema(process.id)
      .then((value) => {
        if (active) setStudio(value);
      })
      .catch(() => {
        if (active) setSchemaFailed(true);
      });
    return () => {
      active = false;
    };
  }, [schemaAttempt, process.id]);
  const fields = useMemo(
    () =>
      registrationQuestions(studio, values.registrationAnswers).filter(
        (field) => isProcessReviewMetadataField(field.fieldKey),
      ),
    [studio, values.registrationAnswers],
  );
  const answerKeys = fields.map((field) => field.fieldKey);
  const patch = processDataReviewPatch(
    base.current,
    values,
    process.dataRevision,
    answerKeys,
  );
  const changed = processDataReviewHasChanges(patch);
  const config = operationalConfig(studio);
  const locations = [
    ...new Set(
      [
        ...config.reservation.locations,
        base.current.defesa.locationChoice,
        OTHER_DEFENSE_LOCATION,
      ].filter(Boolean),
    ),
  ];
  const selectedLocation = isOtherDefenseLocation(values.defesa.locationChoice)
    ? values.defesa.customLocation || ''
    : values.defesa.locationChoice;
  const defenseValid = Boolean(
    values.defesa.date &&
      values.defesa.time &&
      selectedLocation.trim() &&
      isDefenseWeekday(values.defesa.date),
  );
  const submit = async () => {
    if (
      inFlight.current ||
      !changed ||
      !confirmed ||
      !defenseValid ||
      !studio
    )
      return;
    inFlight.current = true;
    setBusy(true);
    setError('');
    try {
      onSaved(await apiClient.reviewProcessData(process.id, patch));
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Não foi possível salvar a conferência. Seus campos foram preservados.',
      );
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };
  const updateFaculty = (
    key: 'orientador' | 'coorientador',
    person: ReviewedFaculty,
  ) => setValues((current) => ({ ...current, [key]: person }));
  function personFields<T extends ReviewedAuthor | ReviewedFaculty>(
    person: T,
    onChange: (next: T) => void,
    key: string,
    faculty = false,
    lockEmail = false,
  ) {
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        <label>
          <span
            id={`process-review-${key}-name-label`}
            className="mb-1 block text-sm font-semibold"
          >
            Nome completo *
          </span>
          <input
            className="portal-input"
            aria-labelledby={`process-review-${key}-name-label`}
            aria-describedby={`process-review-${key}-name-help`}
            autoComplete="off"
            value={person.nome}
            required
            maxLength={160}
            onChange={(e) => onChange({ ...person, nome: e.target.value })}
          />
          <span
            id={`process-review-${key}-name-help`}
            className="mt-1 block text-xs text-slate-600"
          >
            Este nome será usado nos documentos. Confira a grafia e escreva-o
            por completo.
          </span>
        </label>
        <label>
          <span className="mb-1 block text-sm font-semibold">E-mail *</span>
          <input
            className="portal-input"
            type="email"
            autoComplete="off"
            value={person.email}
            required
            readOnly={lockEmail}
            maxLength={254}
            onChange={(e) => onChange({ ...person, email: e.target.value })}
          />
          {lockEmail && (
            <span className="mt-1 block text-xs text-slate-600">
              O e-mail do orientador não pode ser alterado.
            </span>
          )}
        </label>
        <label>
          <span className="mb-1 block text-sm font-semibold">
            {faculty ? 'Tratamento docente' : 'Forma de referência'} {values.banca.some(member=>member.id===key)?'':'*'}
          </span>
          <select
            className="portal-input"
            value={person.tratamento}
            onChange={(e) =>
              onChange({ ...person, tratamento: e.target.value })
            }
          >
            {faculty&&values.banca.some(member=>member.id===key)&&<option value="">Sem tratamento docente</option>}
            {(faculty ? ['Professor', 'Professora'] : ['Aluno', 'Aluna']).map(
              (option) => (
                <option key={option}>{option}</option>
              ),
            )}
          </select>
        </label>
        {faculty && (
          <>
            <label>
              <span className="mb-1 block text-sm font-semibold">
                Titulação *
              </span>
              <select
                className="portal-input"
                value={(person as ReviewedFaculty).titulacao}
                required
                onChange={(e) =>
                  onChange({ ...person, titulacao: e.target.value })
                }
              >
                <option value="">Selecione…</option>
                {ACADEMIC_DEGREES.map((option) => (
                  <option key={option}>{option}</option>
                ))}
              </select>
            </label>
            <label className="sm:col-span-2">
              <span className="mb-1 block text-sm font-semibold">
                Instituição{key === 'orientador' ? '' : ' *'}
              </span>
              <input
                className="portal-input"
                value={
                  key === 'orientador'
                    ? 'UFES'
                    : (person as ReviewedFaculty).instituicao
                }
                readOnly={key === 'orientador'}
                required
                maxLength={200}
                onChange={(e) =>
                  onChange({ ...person, instituicao: e.target.value })
                }
              />
              {key!=='orientador'&&<CapitalizationReview value={(person as ReviewedFaculty).instituicao} kind="institution" confirmed={confirmedCases[key]} onApply={instituicao=>onChange({...person,instituicao})} onKeep={text=>setConfirmedCases(current=>({...current,[key]:text}))}/>}
            </label>
          </>
        )}
      </div>
    );
  }
  return (
    <PortalModalShell
      open
      onClose={onClose}
      title="Verificar dados do processo"
      icon={ClipboardCheck}
      maxWidthClass="max-w-5xl"
      heightClass="max-h-[92dvh]"
      bodyClassName="p-4 sm:p-6"
      closeOnBackdrop={!busy}
      closeOnEscape={!busy}
      footer={
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-xs text-slate-600">
            {process.protocolo} · Conferência antes do registro da ata
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              className="portal-action"
              disabled={busy}
              onClick={onClose}
            >
              Cancelar
            </button>
            <button
              type="submit"
              form="process-data-review"
              className="portal-action portal-action-primary"
              disabled={
                busy ||
                !studio ||
                !changed ||
                !confirmed ||
                !defenseValid
              }
            >
              {busy ? 'Salvando conferência…' : 'Salvar dados e voltar à ata'}
            </button>
          </div>
        </div>
      }
    >
      <form
        id="process-data-review"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <aside className="portal-instruction mb-5 p-3 text-sm leading-6">
          Se os dados foram preenchidos incorretamente no cadastro, este é o
          momento de corrigi-los antes da geração da ata e dos demais termos.
          Confira a grafia: as informações salvas aqui serão usadas na documentação.
          Apenas o e-mail do orientador não pode ser alterado.
        </aside>
        <fieldset disabled={busy}>
          {!studio ? (
            <div
              role={schemaFailed ? 'alert' : 'status'}
              className="portal-card mb-4 p-4"
            >
              {schemaFailed ? (
                <>
                  <p>Não foi possível carregar os campos do cadastro.</p>
                  <button
                    type="button"
                    className="portal-action mt-2"
                    onClick={() => retrySchema((n) => n + 1)}
                  >
                    Tentar novamente
                  </button>
                </>
              ) : (
                <p>Carregando os campos do cadastro…</p>
              )}
            </div>
          ) : null}
          <div
            ref={tabs}
            role="tablist"
            aria-label="Dados para conferência"
            className="grid grid-cols-5 gap-1"
          >
            {sections.map(([key, label], index) => (
              <button
                key={key}
                type="button"
                role="tab"
                id={`process-review-tab-${key}`}
                aria-controls={`process-review-panel-${key}`}
                aria-selected={section === key}
                tabIndex={section === key ? 0 : -1}
                className="relative min-w-0 rounded-t-lg border px-1 py-3 text-xs leading-tight sm:px-3 sm:text-sm"
                style={{
                  background:
                    section === key
                      ? 'var(--portal-surface-card)'
                      : 'var(--portal-surface-panel)',
                  borderColor:
                    section === key
                      ? 'var(--portal-brand-header)'
                      : 'var(--portal-border)',
                  borderBottomColor:
                    section === key
                      ? 'var(--portal-surface-card)'
                      : 'var(--portal-border)',
                  color:
                    section === key
                      ? 'var(--portal-brand-header)'
                      : 'var(--portal-text-dark)',
                  fontWeight: section === key ? 700 : 500,
                  marginBottom: -1,
                  zIndex: section === key ? 1 : undefined,
                }}
                onClick={() => setSection(key)}
                onKeyDown={(event) => {
                  let nextIndex = index;
                  if (event.key === 'ArrowRight')
                    nextIndex = (index + 1) % sections.length;
                  else if (event.key === 'ArrowLeft')
                    nextIndex = (index + sections.length - 1) % sections.length;
                  else if (event.key === 'Home') nextIndex = 0;
                  else if (event.key === 'End') nextIndex = sections.length - 1;
                  else return;
                  event.preventDefault();
                  setSection(sections[nextIndex][0]);
                  tabs.current
                    ?.querySelectorAll<HTMLButtonElement>('[role="tab"]')
                    [nextIndex]?.focus();
                }}
              >
                {label}
              </button>
            ))}
          </div>
          <section
            role="tabpanel"
            id={`process-review-panel-${section}`}
            aria-labelledby={`process-review-tab-${section}`}
            className="portal-card space-y-5 rounded-t-none p-4 sm:p-5"
          >
            <h3 className="text-base font-bold">
              {sections.find(([key]) => key === section)?.[1]}
            </h3>
            {section === 'trabalho' && (
              <>
                <label className="block">
                  <span className="mb-1 block text-sm font-semibold">
                    Título do trabalho *
                  </span>
                  <textarea
                    rows={2}
                    className="portal-input"
                    required
                    value={values.titulo}
                    maxLength={500}
                    onChange={(e) => {

                      setValues((current) => ({...current,titulo:e.target.value}));
                    }}
                  />
                </label>
                <div className="space-y-2 text-sm">
                  <p>O título será usado com a grafia conferida aqui. Revise nomes próprios e siglas antes de salvar.</p>
                  <CapitalizationReview value={values.titulo} kind="title" confirmed={confirmedCases.titulo} onApply={title=>{setValues(current=>({...current,titulo:title}));setConfirmed(false);}} onKeep={title=>setConfirmedCases(current=>({...current,titulo:title}))}/>

                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  {fields.map((field) => (
                    <ProcessReviewMetadataField
                      key={field.fieldKey}
                      field={field}
                      value={values.registrationAnswers[field.fieldKey]}
                      onChange={value=>setValues(current=>({
                        ...current,
                        registrationAnswers:{...current.registrationAnswers,[field.fieldKey]:value},
                      }))}
                    />
                  ))}
                </div>
              </>
            )}
            {section === 'autores' && (
              <>
                <h4 className="text-sm font-semibold">Autor 1</h4>
                {personFields(
                  values.aluno1,
                  (next) =>
                    setValues((current) => ({ ...current, aluno1: next })),
                  'autor1',
                )}
                <label className="block">
                  <span className="mb-1 block text-sm font-semibold">
                    Há segundo autor?
                  </span>
                  <select
                    className="portal-input max-w-xs"
                    value={values.aluno2 ? 'Sim' : 'Não'}
                    onChange={(e) =>
                      setValues((current) => ({
                        ...current,
                        aluno2:
                          e.target.value === 'Sim' ? { ...blankAuthor } : null,
                        authorOrder: 'ALUNO_1_FIRST',
                      }))
                    }
                  >
                    <option>Não</option>
                    <option>Sim</option>
                  </select>
                </label>
                {values.aluno2 && (
                  <>
                    <h4 className="text-sm font-semibold">Autor 2</h4>
                    {personFields(
                      values.aluno2,
                      (next) =>
                        setValues((current) => ({ ...current, aluno2: next })),
                      'autor2',
                    )}
                    <label className="block">
                      <span className="mb-1 block text-sm font-semibold">
                        Ordem dos autores nos documentos
                      </span>
                      <select
                        className="portal-input"
                        value={values.authorOrder}
                        onChange={(e) =>
                          setValues((current) => ({
                            ...current,
                            authorOrder: e.target
                              .value as typeof current.authorOrder,
                          }))
                        }
                      >
                        <option value="ALUNO_1_FIRST">
                          {values.aluno1.nome} · {values.aluno2.nome}
                        </option>
                        <option value="ALUNO_2_FIRST">
                          {values.aluno2.nome} · {values.aluno1.nome}
                        </option>
                      </select>
                    </label>
                  </>
                )}
              </>
            )}
            {section === 'orientacao' && (
              <>
                <h4 className="text-sm font-semibold">Orientador</h4>
                {personFields(
                  values.orientador,
                  (next) => updateFaculty('orientador', next),
                  'orientador',
                  true,
                  !canChangeAdvisorEmail,
                )}
                <label className="block">
                  <span className="mb-1 block text-sm font-semibold">
                    Há coorientador?
                  </span>
                  <select
                    className="portal-input max-w-xs"
                    value={values.coorientador ? 'Sim' : 'Não'}
                    onChange={(e) =>
                      setValues((current) => ({
                        ...current,
                        coorientador:
                          e.target.value === 'Sim' ? { ...blankFaculty } : null,
                      }))
                    }
                  >
                    <option>Não</option>
                    <option>Sim</option>
                  </select>
                </label>
                {values.coorientador && (
                  <>
                    <h4 className="text-sm font-semibold">Coorientador</h4>
                    {personFields(
                      values.coorientador,
                      (next) => updateFaculty('coorientador', next),
                      'coorientador',
                      true,
                    )}
                  </>
                )}
              </>
            )}
            {section === 'banca' &&
              values.banca.map((person, index) => (
                <section
                  key={person.id}
                  className="space-y-3 border-t border-slate-300 pt-4 first:border-0 first:pt-0"
                >
                  <h4 className="text-sm font-semibold">
                    Examinador {index + 1}
                  </h4>
                  {personFields(
                    person,
                    (next) =>
                      setValues((current) => ({
                        ...current,
                        banca: current.banca.map((item, i) =>
                          i === index ? { ...item, ...next } : item,
                        ),
                      })),
                    person.id,
                    true,
                  )}
                </section>
              ))}
            {section === 'defesa' && (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label>
                    <span className="mb-1 block text-sm font-semibold">
                      Data da defesa *
                    </span>
                    <input
                      className="portal-input"
                      type="date"
                      required
                      value={values.defesa.date}
                      onChange={(e) =>
                        setValues((current) => ({
                          ...current,
                          defesa: { ...current.defesa, date: e.target.value },
                        }))
                      }
                    />
                  </label>
                  <label>
                    <span className="mb-1 block text-sm font-semibold">
                      Horário de início *
                    </span>
                    <input
                      className="portal-input"
                      type="time"
                      step={60}
                      required
                      value={values.defesa.time}
                      onChange={(e) =>
                        setValues((current) => ({
                          ...current,
                          defesa: { ...current.defesa, time: e.target.value },
                        }))
                      }
                    />
                  </label>
                  <label className="sm:col-span-2">
                    <span className="mb-1 block text-sm font-semibold">
                      Local da defesa *
                    </span>
                    <select
                      className="portal-input"
                      value={values.defesa.locationChoice}
                      required
                      onChange={(e) =>
                        setValues((current) => ({
                          ...current,
                          defesa: {
                            ...current.defesa,
                            locationChoice: e.target.value,
                          },
                        }))
                      }
                    >
                      <option value="">Selecione…</option>
                      {locations.map((option) => (
                        <option key={option} value={option}>
                          {isOtherDefenseLocation(option)
                            ? 'Outro local — informar endereço/nome'
                            : option}
                        </option>
                      ))}
                    </select>
                  </label>
                  {isOtherDefenseLocation(values.defesa.locationChoice) && (
                    <label className="sm:col-span-2">
                      <span
                        id="process-review-custom-location-label"
                        className="mb-1 block text-sm font-semibold"
                      >
                        Nome ou endereço do local *
                      </span>
                      <input
                        className="portal-input"
                        aria-labelledby="process-review-custom-location-label"
                        aria-describedby="process-review-custom-location-help"
                        value={values.defesa.customLocation || ''}
                        required
                        maxLength={300}
                        onChange={(e) =>
                          setValues((current) => ({
                            ...current,
                            defesa: {
                              ...current.defesa,
                              customLocation: e.target.value,
                            },
                          }))
                        }
                      />
                      <span
                        id="process-review-custom-location-help"
                        className="mt-2 block text-sm text-slate-600"
                      >
                        O nome ou endereço informado aqui será usado nos
                        documentos da defesa. Escreva-o por completo, sem
                        abreviações, e confira a grafia antes de salvar.
                      </span>
                    </label>
                  )}
                </div>
                <ReservationCalendarPicker
                  excludeProcessId={process.id}
                  value={`${values.defesa.date}T${values.defesa.time}`}
                  location={selectedLocation}
                  timezone="America/Sao_Paulo"
                  onSelect={(value) =>
                    setValues((current) => ({
                      ...current,
                      defesa: {
                        ...current.defesa,
                        date: value.slice(0, 10),
                        time: value.slice(11, 16),
                      },
                    }))
                  }
                />
                <p className="flex gap-2 text-sm text-slate-600">
                  <CalendarCheck className="h-4 w-4 shrink-0" />
                  Duração de 1h30. Não é possível reservar horários em conflito
                  no mesmo local.
                </p>
                {values.defesa.date &&
                  !isDefenseWeekday(values.defesa.date) && (
                    <p role="alert" className="portal-error">
                      Escolha uma data de segunda a sexta-feira.
                    </p>
                  )}
              </>
            )}
          </section>
          <div className="mt-5 grid gap-4">
            <label className="flex items-start gap-3 text-sm leading-6">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 shrink-0"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
              />
              <span>
                Conferi os dados e confirmo que correspondem à defesa. A ata
                será preparada com estas informações.
              </span>
            </label>
          </div>
        </fieldset>
        {error && (
          <p role="alert" className="portal-error mt-4">
            {error}
          </p>
        )}
        {busy && (
          <p role="status" className="mt-4 flex items-center gap-2 text-sm">
            <LoaderCircle className="h-4 w-4 animate-spin" />
            Salvando somente as informações alteradas…
          </p>
        )}
      </form>
    </PortalModalShell>
  );
}
