import { formatTccTitle, normalizeEmail } from './formatters';

export { CUSTOM_DEFENSE_LOCATION as OTHER_DEFENSE_LOCATION } from './reservationLocation';
export const CUSTOM_LOCATION_FIELD = 'DEFESA_LOCAL_PERSONALIZADO';

export function isOtherDefenseLocation(value: unknown): boolean {
  if(value==='__OUTRO_LOCAL__')return true;
  const normalized = String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .replace(/[—–]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
  if(normalized==='outro local')return true;
  return /^outro local(?:\s*-\s*informar (?:endereco\/nome|nome\/endereco))?$/.test(normalized);
}

/** Reconhece siglas automaticamente e preserva marcações antigas por compatibilidade. */
export function normalizeCustomLocationInput(raw: string): string {
  const original = String(raw ?? '').normalize('NFC').trim().replace(/\s+/g, ' ');
  if (!original) return '';
  const marked: string[] = [];
  const masked = original.replace(/\*([^*]+)\*/g, (_match, acronym: string) => {
    marked.push(acronym.trim().toLocaleUpperCase('pt-BR'));
    return `locationacronym${marked.length - 1}`;
  });
  return formatTccTitle(masked)
    .replace(/locationacronym(\d+)/gi, (_match, index: string) => `*${marked[Number(index)]}*`);
}

/** Texto pronto para documentos e notificações, sem caracteres de edição. */
export function renderCustomLocationName(raw: string): string {
  return normalizeCustomLocationInput(raw).replace(/\*([^*]+)\*/g, '$1');
}

export function getCustomLocationFieldValue(answers: Record<string, unknown>): string {
  const candidates = [
    CUSTOM_LOCATION_FIELD, 'DEFESA_OUTRO_LOCAL_NOME', 'OUTRO_LOCAL_NOME', 'NOME_COMPLETO_LOCAL',
    'DEFESA_LOCAL_OUTRO_NOME', 'DEFESA_LOCAL_PERSONALIZADO', 'LOCAL_PERSONALIZADO_NOME',
    'LOCAL_NOME', 'LOCAL_NOME_COMPLETO', 'DEFESA_LOCAL_NOME', 'NOME_LOCAL', 'NOME_DO_LOCAL',
  ];
  for (const key of candidates) {
    const value = String(answers[key] ?? '').trim();
    if (value) return value;
  }
  const alternate = Object.entries(answers).find(([key, value]) =>
    /^(?:DEFESA_)?(?:OUTRO_)?LOCAL(?:_OUTRO)?_(?:NOME|NOME_COMPLETO|ENDERECO_NOME)$/.test(key)
    && typeof value === 'string' && value.trim()
  );
  return alternate ? String(alternate[1]).trim() : '';
}

/** Filtro específico: nunca encaminhar local customizado ao departamento. */
export function isCustomLocationRegistration(answers: Record<string, unknown> | null | undefined): boolean {
  return isOtherDefenseLocation(answers?.DEFESA_LOCAL);
}

/** Destinatário oficial do pedido de confirmação, sem fallback para outro papel. */
export function reservationConfirmationRecipient(
  answers: Record<string, unknown> | null | undefined,
  advisorEmail: string,
  departmentEmail: string,
): string {
  return normalizeEmail(isCustomLocationRegistration(answers) ? advisorEmail : departmentEmail);
}
