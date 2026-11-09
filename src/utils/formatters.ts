import {academicAcronym,stripAcademicCaseMarkers} from './academicTextCase';
// Formatadores de data, hora e texto para o fluxo acadêmico configurável.
import type { ProcessData } from '../types';

const PORTAL_TIME_ZONE = 'America/Sao_Paulo';
const MONTHS_PT = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'
];

interface PortalDateTimeParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
}

function parsePortalDateTime(value: string): PortalDateTimeParts | null {
  const input = String(value || '').trim();
  if (!input) return null;

  // Datas sem horário e timestamps sem offset representam valores civis do portal.
  // Preservamos esses campos literalmente para não depender do fuso do processo Node/Vercel.
  const civil = input.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::\d{2}(?:\.\d{1,3})?)?)?$/);
  if (civil) {
    const year = Number(civil[1]);
    const month = Number(civil[2]);
    const day = Number(civil[3]);
    const hour = Number(civil[4] || 0);
    const minute = Number(civil[5] || 0);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31 && hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59) {
      return { year, month, day, hour, minute };
    }
  }

  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: PORTAL_TIME_ZONE,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  }).formatToParts(date);
  const valueOf = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value || 0);
  return {
    year: valueOf('year'), month: valueOf('month'), day: valueOf('day'),
    hour: valueOf('hour'), minute: valueOf('minute')
  };
}

function numberPt0To99(value: number): string {
  const units = ['zero', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove'];
  const teens: Record<number, string> = {
    10: 'dez', 11: 'onze', 12: 'doze', 13: 'treze', 14: 'quatorze', 15: 'quinze',
    16: 'dezesseis', 17: 'dezessete', 18: 'dezoito', 19: 'dezenove'
  };
  const tens: Record<number, string> = { 20: 'vinte', 30: 'trinta', 40: 'quarenta', 50: 'cinquenta', 60: 'sessenta', 70: 'setenta', 80: 'oitenta', 90: 'noventa' };
  if (value >= 0 && value <= 9) return units[value];
  if (value >= 10 && value <= 19) return teens[value];
  if (value >= 20 && value <= 99) {
    const base = Math.floor(value / 10) * 10;
    const remainder = value % 10;
    return remainder ? `${tens[base]} e ${units[remainder]}` : tens[base];
  }
  return String(value);
}

function yearPt(year: number): string {
  if (year === 2000) return 'dois mil';
  if (year > 2000 && year < 2100) return `dois mil e ${numberPt0To99(year - 2000)}`;
  return String(year);
}

function hourNumberPt(hour: number): string {
  if (hour === 1) return 'uma';
  if (hour === 2) return 'duas';
  if (hour === 21) return 'vinte e uma';
  if (hour === 22) return 'vinte e duas';
  return numberPt0To99(hour);
}

/**
 * Normalizes email by trim and lowercase as required by specs (Seção 7)
 */
export function normalizeEmail(email: string): string {
  return email ? email.trim().toLowerCase() : '';
}

/**
 * Formats a name in nice Title Case (handling minor prepositions)
 */
export function formatNameTitleCase(name: string): string {
  if (!name) return '';
  const prepositions = ['de', 'do', 'da', 'dos', 'das', 'e'];
  return name
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .map((word, idx) => {
      if (idx > 0 && prepositions.includes(word)) {
        return word;
      }
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');
}

/**
 * Removes vocatives/prefixes from a name for clean alphabetical sorting
 */
export function cleanPersonName(name: string): string {
  if (!name) return '';
  // Remove common prefixes
  const prefixRegex = /^(prof\.ª\s*dr\.ª\s*|profª\.\s*drª\.\s*|prof\.ª\s*|profª\s*|prof\.\s*dr\.\s*|prof\s*dr\s*|dr\.\s*|dra\.\s*|me\.\s*|ma\.\s*|prof\.\s*|profª\s*|doutor\s+|doutora\s+|professor\s+|professora\s+)/i;
  let clean = name.replace(prefixRegex, '').trim();
  return formatNameTitleCase(clean);
}

/**
 * Guesses if a name refers to a female professor based on prefix or first name
 */
export function isFemaleName(originalName: string): boolean {
  const nameLower = originalName.toLowerCase().trim();
  if (
    nameLower.startsWith('dra') ||
    nameLower.startsWith('profª') ||
    nameLower.includes('drª') ||
    nameLower.startsWith('doutora') ||
    nameLower.startsWith('professora')
  ) {
    return true;
  }
  const clean = cleanPersonName(originalName);
  const firstName = clean.split(' ')[0].toLowerCase();
  const maleEndsInA = ['luca', 'lucas', 'andrea', 'bautista', 'jeová', 'josias', 'matias', 'messias', 'noé', 'pastor', 'padre'];
  if (firstName.endsWith('a') && !maleEndsInA.includes(firstName)) {
    return true;
  }
  const femaleNames = ['beatriz', 'marcia', 'márcia', 'luciana', 'mariana', 'camila', 'ana', 'carla', 'sandra', 'valéria', 'cláudia', 'patrícia', 'adriana', 'regina', 'fernanda'];
  if (femaleNames.includes(firstName)) {
    return true;
  }
  return false;
}

/**
 * Standardizes a professor's name, always prefixing with the correct vocative
 */
export function formatProfessorName(name: string): string {
  if (!name) return 'N/A';
  if (name.trim() === 'Comissão de Trabalho de Conclusão de Curso' || name.trim() === 'Presidência da Comissão') return name;
  const clean = cleanPersonName(name);
  const female = isFemaleName(name);
  return female ? `Profª. Drª. ${clean}` : `Prof. Dr. ${clean}`;
}

/**
 * Standardizes TCC titles with capitalized main words and preserved acronyms.
 */
export function formatTccTitle(title: string): string {
  if (!title) return '';
  const clean = stripAcademicCaseMarkers(title).normalize('NFC').trim().replace(/\s+/gu, ' ');
  // Preserve recognized acronyms and alphanumeric codes without keeping ordinary words in capitals.
  let wordIndex = 0;
  const smallWords = new Set(['a', 'as', 'o', 'os', 'de', 'da', 'do', 'das', 'dos', 'e', 'é', 'em', 'no', 'na', 'nos', 'nas', 'por', 'para', 'com']);
  const formatted = clean.replace(/[\p{L}\p{M}\p{N}]+(?:[-/][\p{L}\p{M}\p{N}]+)*/gu, token => {
    const first = wordIndex++ === 0;
    const code = /\p{L}/u.test(token) && /\p{N}/u.test(token);
    if (code) return token.replace(/\p{L}+/gu, part => academicAcronym(part) || part);
    if (token.includes('-') || token.includes('/')) return token.split(/([-/])/u).map(part => academicAcronym(part) || part.toLowerCase().replace(/^\p{L}/u, letter => letter.toLocaleUpperCase('pt-BR'))).join('');
    const acronym = academicAcronym(token);
    if (acronym) return acronym;
    const lower = token.toLocaleLowerCase('pt-BR');
    return !first && smallWords.has(lower) ? lower : lower.replace(/^\p{L}/u, letter => letter.toLocaleUpperCase('pt-BR'));
  });
  return formatted.replace(/\p{L}/u, letter => letter.toUpperCase());
}

/** Input, preview and documents share automatic acronym capitalization. */
export function renderTccTitle(title:string):string {
  return formatTccTitle(title).replace(/\*([^*]+)\*/g,'$1');
}

/**
 * Format date in standard Portuguese: "21 de julho de 2026".
 * Timestamps absolutos são sempre apresentados no fuso institucional de São Paulo.
 */
export function formatDatePt(dateStr: string): string {
  if (!dateStr) return '';
  const parts = parsePortalDateTime(dateStr);
  if (!parts) return dateStr;
  return `${parts.day} de ${MONTHS_PT[parts.month - 1]} de ${parts.year}`;
}

const WEEKDAYS_PT = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'] as const;

/**
 * Dia da semana da data civil apresentada pelo portal.
 * Calcula em UTC a partir dos componentes civis para que o fuso do servidor
 * não mude o dia; timestamps com offset são antes convertidos para Vitória.
 */
export function formatWeekdayPt(dateStr:string):string {
  const parts=parsePortalDateTime(dateStr);
  if(!parts)return '';
  const day=new Date(Date.UTC(parts.year,parts.month-1,parts.day));
  if(day.getUTCFullYear()!==parts.year||day.getUTCMonth()!==parts.month-1||day.getUTCDate()!==parts.day)return '';
  return WEEKDAYS_PT[day.getUTCDay()];
}

/** Exibição humana: "segunda-feira, 7 de dezembro de 2026". */
export function formatDateWithWeekday(dateStr:string):string {
  const weekday=formatWeekdayPt(dateStr);
  const date=formatDatePt(dateStr);
  return weekday?`${weekday}, ${date}`:date;
}

/** Exibição compacta: "segunda-feira, 07/12/2026". Não usar em campos date nem integrações. */
export function formatDateNumericWithWeekday(dateStr:string):string {
  const weekday=formatWeekdayPt(dateStr);
  const date=formatDateNumeric(dateStr);
  return weekday?`${weekday}, ${date}`:date;
}

/** Timestamp de leitura em Brasília; mantém o valor técnico original fora da apresentação. */
export function formatDateTimeWithWeekday(value:string,timezone='America/Sao_Paulo'):string {
 const date=new Date(value);if(!Number.isFinite(date.getTime()))return value;
 return new Intl.DateTimeFormat('pt-BR',{timeZone:timezone,weekday:'long',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(date);
}

const auditTimestampFormatter = new Intl.DateTimeFormat('pt-BR', {
  timeZone: PORTAL_TIME_ZONE,
  weekday: 'long',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

/** Exibição de registros administrativos, com o dia da semana como complemento. */
export function formatAuditTimestamp(value: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return value;
  const parts = Object.fromEntries(auditTimestampFormatter.formatToParts(date).map(({type,value}) => [type, value]));
  return `${parts.day}/${parts.month}/${parts.year}, ${parts.hour}:${parts.minute} (${parts.weekday})`;
}

/** Exibição formal: "segunda-feira, sete de dezembro de dois mil e vinte e seis". */
export function formatDateExtensoWithWeekday(dateStr:string):string {
  const weekday=formatWeekdayPt(dateStr);
  const date=formatDateExtensoTotal(dateStr);
  return weekday?`${weekday}, ${date}`:date;
}

/**
 * Format date in numeric format: "21/07/2026".
 */
export function formatDateNumeric(dateStr: string): string {
  if (!dateStr) return '';
  const parts = parsePortalDateTime(dateStr);
  if (!parts) return dateStr;
  return `${String(parts.day).padStart(2, '0')}/${String(parts.month).padStart(2, '0')}/${parts.year}`;
}

/** Horário civil do portal, independente do fuso do servidor. */
export function formatTime24h(value:string):string {
  const parts=parsePortalDateTime(value);
  return parts?`${String(parts.hour).padStart(2,'0')}:${String(parts.minute).padStart(2,'0')}`:'';
}

/**
 * Date fully written in Portuguese, e.g. "vinte e quatro de agosto de dois mil e vinte e seis".
 */
export function formatDateExtensoTotal(dateStr: string): string {
  if (!dateStr) return '';
  const parts = parsePortalDateTime(dateStr);
  if (!parts) return dateStr;
  const day = parts.day === 1 ? 'primeiro' : numberPt0To99(parts.day);
  return `${day} de ${MONTHS_PT[parts.month - 1]} de ${yearPt(parts.year)}`;
}

/**
 * Format time fully written in Portuguese, e.g. "quatorze horas e trinta minutos".
 */
export function formatTimeExtenso(timeStrOrIso: string): string {
  if (!timeStrOrIso) return '';
  let hours: number;
  let minutes: number;

  const plain = timeStrOrIso.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (plain) {
    hours = Number(plain[1]);
    minutes = Number(plain[2]);
  } else {
    const parts = parsePortalDateTime(timeStrOrIso);
    if (!parts) return timeStrOrIso;
    hours = parts.hour;
    minutes = parts.minute;
  }

  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return timeStrOrIso;
  const hourText = `${hourNumberPt(hours)} ${hours === 1 ? 'hora' : 'horas'}`;
  if (minutes === 0) return hourText;
  const minuteText = minutes === 1 ? 'um minuto' : `${numberPt0To99(minutes)} minutos`;
  return `${hourText} e ${minuteText}`;
}

/**
 * Sorts student list alphabetically by name, ensuring equal importance (no primary/secondary distinction).
 */
export function getSortedStudents<T extends { nome: string; matricula?: string }>(aluno1?: T | null, aluno2?: T | null): T[] {
  const list: T[] = [];
  if (aluno1 && aluno1.nome && aluno1.nome.trim()) list.push(aluno1);
  if (aluno2 && aluno2.nome && aluno2.nome.trim()) list.push(aluno2);
  return list.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' }));
}

/** Format student names in alphabetical order for document headers and tables. */
export function formatStudentsString(
  aluno1: { nome: string },
  aluno2?: { nome: string } | null
): string {
  const names = getSortedStudents(aluno1, aluno2).map(student => formatNameTitleCase(student.nome));
  return names.join(' e ') || 'Discente não informado';
}

/**
 * Sanitizes file names for Drive and Download (Seção 82)
 */
export function sanitizeFilename(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove accents
    .replace(/[^a-zA-Z0-9\s\-_.]/g, '')
    .trim()
    .replace(/\s+/g, '_');
}

/**
 * Reads the configured pipeline length without failing when storage is unavailable.
 * The same fallback is used by the calendar and the participant's process table.
 */
export function getWorkflowStagesCount(storage?: Pick<Storage, 'getItem'>): number {
  try {
    const saved = (storage ?? (typeof window === 'undefined' ? undefined : window.localStorage))
      ?.getItem('workflow_pipeline_stages');
    if (saved) {
      const stages: unknown = JSON.parse(saved);
      if (Array.isArray(stages) && stages.length > 0) return stages.length;
    }
  } catch {
    // A corrupt or blocked browser preference must not hide the process table.
  }
  return 5;
}

/**
 * Calculates process progress percentage and step label
 */
export function getProcessProgress(
  proc: Pick<ProcessData, 'status' | 'etapaAtual'>,
  totalStages: number = getWorkflowStagesCount()
) {
  let stepNumber = 1;
  let percent = 20;
  let label = '';
  
  if (proc.status === 'CONCLUIDO') {
    stepNumber = totalStages;
    percent = 100;
    label = `Etapa ${stepNumber}/${totalStages}: Concluído & Ata Registrada`;
  } else if (proc.status === 'AGUARDANDO_ASSINATURA') {
    stepNumber = totalStages;
    percent = Math.round(((totalStages * 2 - 1) / (totalStages * 2)) * 100);
    label = `Etapa ${stepNumber}/${totalStages}: Aguardando Assinaturas`;
  } else if (proc.status === 'AGUARDANDO_DADOS_FINAIS' || proc.etapaAtual === 'REPOSITORIO') {
    stepNumber = totalStages;
    percent = Math.round(((totalStages * 2 - 1) / (totalStages * 2)) * 100);
    label = `Etapa ${stepNumber}/${totalStages}: Dados finais e repositório`;
  } else if (proc.status === 'EM_AVALIACAO') {
    stepNumber = Math.max(1, totalStages - 1);
    percent = Math.round((stepNumber / totalStages) * 100);
    label = `Etapa ${stepNumber}/${totalStages}: Defesa realizada · Conceito e Ata`;
  } else if (proc.status === 'AGUARDANDO_DEFESA' || proc.etapaAtual === 'DEFESA' || proc.etapaAtual === 'AGENDAMENTO') {
    stepNumber = Math.max(1, totalStages - 2);
    percent = Math.round((stepNumber / totalStages) * 100);
    label = `Etapa ${stepNumber}/${totalStages}: Defesa Agendada`;
  } else if (proc.etapaAtual === 'CONVITE' || proc.etapaAtual === 'CADASTRO') {
    stepNumber = Math.min(2, totalStages);
    percent = Math.round((stepNumber / totalStages) * 100);
    label = `Etapa ${stepNumber}/${totalStages}: Banca Definida & Convites Enviados`;
  } else {
    stepNumber = 1;
    percent = Math.round((stepNumber / totalStages) * 100);
    label = `Etapa ${stepNumber}/${totalStages}: Inscrição Registrada`;
  }
  
  return { percent, label, color: 'bg-emerald-600' };
}

export function getFriendlyEtapaLabel(etapa: string): string {
  switch (etapa) {
    case 'CADASTRO': return 'Cadastro';
    case 'AGENDAMENTO': return 'Agendamento';
    case 'CONVITE': return 'Banca';
    case 'DEFESA': return 'Defesa';
    case 'AVALIACAO': return 'Conceito e Ata';
    case 'ASSINATURA': return 'Assinatura';
    case 'DOCUMENTOS': return 'Documentos';
    case 'CONCLUIDO': return 'Concluído';
    default: return etapa;
  }
}

export function getStepNumberLabel(label: string): string {
  const match = label.match(/Etapa\s+([\d.]+)\/(\d+)/i);
  if (match) {
    const current = match[1].replace('.', ',');
    return `Fase ${current}`;
  }
  return '';
}

const dateInSaoPaulo = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
});

export function saoPauloCalendarDate(now = new Date()): string {
  return dateInSaoPaulo.format(now);
}

export function timestampInSaoPauloDateRange(timestamp: string, start: string, end: string): boolean {
  if (!start && !end) return true;
  const instant = new Date(timestamp);
  if (!Number.isFinite(instant.getTime())) return false;
  const date = dateInSaoPaulo.format(instant);
  return (!start || date >= start) && (!end || date <= end);
}
