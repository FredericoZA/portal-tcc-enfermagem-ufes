import { formatNameTitleCase } from './formatters';

export const OTHER_DEFENSE_LOCATION = 'Outro local — informar endereço/nome';
export const CUSTOM_LOCATION_FIELD = 'DEFESA_OUTRO_LOCAL_NOME';

export function isOtherDefenseLocation(value: unknown): boolean {
  const normalized = String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .replace(/[—–]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
  return /^outro local(?:\s*-\s*informar (?:endereco\/nome|nome\/endereco))?$/.test(normalized);
}

/** Aceita caixa alta apenas nos trechos marcados por asteriscos. */
export function normalizeCustomLocationInput(raw: string): string {
  const original = String(raw ?? '').normalize('NFC').trim().replace(/\s+/g, ' ');
  if (!original) return '';
  const marked: string[] = [];
  const masked = original.replace(/\*([^*]+)\*/g, (_match, acronym: string) => {
    marked.push(acronym.trim().toLocaleUpperCase('pt-BR'));
    return `locationacronym${marked.length - 1}`;
  });
  return formatNameTitleCase(masked)
    .replace(/locationacronym(\d+)/gi, (_match, index: string) => `*${marked[Number(index)]}*`);
}

/** Texto pronto para documentos e notificações, sem caracteres de edição. */
export function renderCustomLocationName(raw: string): string {
  return normalizeCustomLocationInput(raw).replace(/\*([^*]+)\*/g, '$1');
}

export function getCustomLocationFieldValue(answers: Record<string, unknown>): string {
  const candidates = [
    CUSTOM_LOCATION_FIELD, 'OUTRO_LOCAL_NOME', 'NOME_COMPLETO_LOCAL',
    'DEFESA_LOCAL_OUTRO_NOME', 'DEFESA_LOCAL_PERSONALIZADO', 'LOCAL_PERSONALIZADO_NOME',
  ];
  for (const key of candidates) {
    const value = String(answers[key] ?? '').trim();
    if (value) return value;
  }
  return '';
}

/** Filtro específico: nunca encaminhar local customizado ao departamento. */
export function isCustomLocationRegistration(answers: Record<string, unknown> | null | undefined): boolean {
  return isOtherDefenseLocation(answers?.DEFESA_LOCAL);
}
