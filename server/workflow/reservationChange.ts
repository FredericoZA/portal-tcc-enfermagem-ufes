import { OTHER_DEFENSE_LOCATION, isOtherDefenseLocation, renderCustomLocationName } from '../../src/utils/customDefenseLocation';
import { formatDatePt, formatTimeExtenso } from '../../src/utils/formatters';
import { localDateTimeToIso } from '../../src/utils/operationalConfig';
import type { ProcessData } from '../../src/types';

export type ReservationChangeInput = {
  date?: string;
  time?: string;
  locationChoice?: string;
  customLocation?: string;
};

export function validateReservationChange(
  input: ReservationChangeInput,
  current: ProcessData,
  publishedLocations: string[],
  slotDurationMinutes: number,
  now = new Date(),
): { startAt: string; endAt: string; local: string; custom: boolean } {
  const date = String(input.date ?? '').trim();
  const time = String(input.time ?? '').trim();
  const choice = String(input.locationChoice ?? '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) {
    throw new Error('Informe data e horário válidos para a nova solicitação.');
  }
  const requested = new Date(localDateTimeToIso(`${date}T${time}`, 'America/Sao_Paulo'));
  if (!Number.isFinite(requested.getTime()) || requested.getTime() <= now.getTime()) {
    throw new Error('Informe uma data e um horário futuros para a nova reserva.');
  }
  if ([0, 6].includes(new Date(`${date}T12:00:00Z`).getUTCDay())) {
    throw new Error('As defesas devem ser marcadas de segunda a sexta-feira.');
  }

  const custom = isOtherDefenseLocation(choice);
  const allowed = publishedLocations.includes(choice) || choice === current.defesa.local;
  if (!custom && !allowed) throw new Error('Selecione um local publicado pela instituição.');
  let local = choice;
  if (custom) {
    const raw = String(input.customLocation ?? '').trim();
    if (!raw || raw.length > 200) throw new Error('Informe o nome completo do outro local (até 200 caracteres).');
    if ((raw.match(/\*/g) || []).length % 2 !== 0) throw new Error('Confira os asteriscos usados para as siglas do local.');
    local = renderCustomLocationName(raw);
    if (!/[\p{L}]{2}/u.test(local)) throw new Error('Informe um nome válido para o outro local.');
  }
  if (!local) throw new Error('Informe o local da nova reserva.');

  const duration = Number.isFinite(slotDurationMinutes) && slotDurationMinutes > 0
    ? slotDurationMinutes : 90;
  return {
    startAt: requested.toISOString(),
    endAt: new Date(requested.getTime() + duration * 60_000).toISOString(),
    local,
    custom,
  };
}

export function buildReservationChangeEmail(
  process: ProcessData,
  proposal: { startAt: string; local: string },
  custom: boolean,
): { subject: string; text: string } {
  const subject = `[TCC ${process.protocolo}] Nova solicitação de reserva para defesa`;
  const text = [
    'Prezados(as),',
    '',
    `Solicitamos nova confirmação de reserva para o TCC ${process.protocolo}.`,
    `Título: ${process.titulo}`,
    `Aluno(s): ${[process.aluno1.nome, process.aluno2?.nome].filter(Boolean).join(' e ')}`,
    `Orientador(a): ${process.orientador.nome}`,
    '',
    'Reserva informada anteriormente:',
    `Data: ${formatDatePt(process.defesa.startAt)}`,
    `Horário: ${formatTimeExtenso(process.defesa.startAt)}`,
    `Local: ${process.defesa.local}`,
    '',
    'Nova solicitação:',
    `Data: ${formatDatePt(proposal.startAt)}`,
    `Horário: ${formatTimeExtenso(proposal.startAt)}`,
    `Local: ${proposal.local}`,
    '',
    custom
      ? 'Solicitamos ao orientador a confirmação da disponibilidade e autorização de uso do local informado.'
      : 'Solicitamos ao departamento que confirme a disponibilidade e a reserva do espaço.',
    'A reserva anteriormente informada permanecerá no Portal até o registro da nova confirmação.',
    '',
    'Atenciosamente,',
    'Portal TCC — Enfermagem e Obstetrícia',
  ].join('\n');
  return { subject, text };
}
