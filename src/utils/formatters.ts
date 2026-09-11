// Formatadores de data, hora e texto para o fluxo acadêmico configurável.

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
  if (name.trim() === 'Comissão de TCC' || name.trim() === 'Presidência da Comissão') return name;
  const clean = cleanPersonName(name);
  const female = isFemaleName(name);
  return female ? `Profª. Drª. ${clean}` : `Prof. Dr. ${clean}`;
}

/**
 * Standardizes TCC titles: no fully uppercase titles, neat Sentence/Title case with proper acronyms preserved
 */
export function formatTccTitle(title: string): string {
  if (!title) return '';
  let clean = title.trim();
  const uppercaseAcronyms = ['SUS', 'TCC', 'UFES', 'UTI', 'UTIN', 'CCS', 'AIDS', 'HIV', 'SAMU', 'CAPS', 'UBS', 'EAD', 'EPI', 'EPIS', 'A&E', 'COVID-19', 'COVID19', 'COVID', 'ICU', 'UTI-NEONATAL', 'UTIN-NEONATAL'];
  const lowercaseWords = ['de', 'do', 'da', 'dos', 'das', 'em', 'um', 'uma', 'e', 'o', 'a', 'no', 'na', 'nos', 'nas', 'com', 'para', 'por', 'sob', 'sobre', 'ao', 'aos', 'à', 'às'];

  const parts = clean.split(':');
  const formattedParts = parts.map((part) => {
    let words = part.trim().toLowerCase().split(/\s+/);
    if (words.length === 0) return '';

    words = words.map((word, index) => {
      const cleanWord = word.replace(/^[«"'(]+/g, '').replace(/[»)"'.,;?!:]+$/g, '').toUpperCase();
      if (uppercaseAcronyms.includes(cleanWord)) {
        return word.replace(new RegExp(cleanWord, 'i'), cleanWord);
      }
      if (index > 0 && lowercaseWords.includes(word)) {
        return word;
      }
      return word.charAt(0).toUpperCase() + word.slice(1);
    });

    return words.join(' ');
  });

  return formattedParts.join(': ');
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

/**
 * Format date in numeric format: "21/07/2026".
 */
export function formatDateNumeric(dateStr: string): string {
  if (!dateStr) return '';
  const parts = parsePortalDateTime(dateStr);
  if (!parts) return dateStr;
  return `${String(parts.day).padStart(2, '0')}/${String(parts.month).padStart(2, '0')}/${parts.year}`;
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

/**
 * Format student display string for document headers and tables:
 * Always sorted alphabetically. Example: "🪪 MATRÍCULA - Nome A e 🪪 MATRÍCULA - Nome B"
 */
export function formatStudentsString(
  aluno1: { nome: string; matricula: string },
  aluno2?: { nome: string; matricula: string } | null,
  includeBadge = true
): string {
  const sorted = getSortedStudents(aluno1, aluno2);
  if (sorted.length === 0) return 'Discente não informado';

  const parts = sorted.map(a => 
    includeBadge && a.matricula
      ? `🪪 ${a.matricula} - ${formatNameTitleCase(a.nome)}`
      : `${formatNameTitleCase(a.nome)}${a.matricula ? ` (${a.matricula})` : ''}`
  );

  if (parts.length === 2) {
    return `${parts[0]} e ${parts[1]}`;
  }
  return parts[0];
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
 * Calculates process progress percentage and step label
 */
export function getProcessProgress(proc: any, totalStages: number = 6) {
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
    label = `Etapa ${stepNumber}/${totalStages}: Aguardando Assinatura do Presidente`;
  } else if (proc.status === 'EM_AVALIACAO') {
    stepNumber = Math.max(1, totalStages - 1);
    percent = Math.round((stepNumber / totalStages) * 100);
    label = `Etapa ${stepNumber}/${totalStages}: Defesa Realizada & Em Avaliação`;
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
    case 'AVALIACAO': return 'Avaliação';
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
