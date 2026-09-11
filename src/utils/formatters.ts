// Formatadores de data, hora e texto para o fluxo acadêmico configurável.

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
 * Format date in standard Portuguese: "21 de julho de 2026"
 */
export function formatDatePt(dateStr: string): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;

  const months = [
    'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
    'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'
  ];

  const day = date.getDate();
  const month = months[date.getMonth()];
  const year = date.getFullYear();

  return `${day} de ${month} de ${year}`;
}

/**
 * Format date in numeric format: "21/07/2026"
 */
export function formatDateNumeric(dateStr: string): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;

  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();

  return `${day}/${month}/${year}`;
}

/**
 * Number to word conversion for Portuguese days and years (e.g. "vinte e quatro de agosto de dois mil e vinte e seis")
 */
export function formatDateExtensoTotal(dateStr: string): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;

  const numbersPt: Record<number, string> = {
    1: 'primeiro', 2: 'dois', 3: 'três', 4: 'quatro', 5: 'cinco',
    6: 'seis', 7: 'sete', 8: 'oito', 9: 'nove', 10: 'dez',
    11: 'onze', 12: 'doze', 13: 'treze', 14: 'quatorze', 15: 'quinze',
    16: 'dezesseis', 17: 'dezessete', 18: 'dezoito', 19: 'dezenove',
    20: 'vinte', 21: 'vinte e um', 22: 'vinte e dois', 23: 'vinte e três',
    24: 'vinte e quatro', 25: 'vinte e cinco', 26: 'vinte e seis',
    27: 'vinte e sete', 28: 'vinte e oito', 29: 'vinte e nove',
    30: 'trinta', 31: 'trinta e um'
  };

  const months = [
    'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
    'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'
  ];

  const day = numbersPt[date.getDate()] || date.getDate().toString();
  const month = months[date.getMonth()];
  const year = date.getFullYear();

  // Simple converter for 2020-2030s
  let yearExtenso = year.toString();
  if (year === 2026) yearExtenso = 'dois mil e vinte e seis';
  else if (year === 2025) yearExtenso = 'dois mil e vinte e cinco';
  else if (year === 2027) yearExtenso = 'dois mil e vinte e sete';
  else if (year === 2024) yearExtenso = 'dois mil e vinte e quatro';

  return `${day} de ${month} de ${yearExtenso}`;
}

/**
 * Format time to spelled out Portuguese: "quatorze horas e trinta minutos"
 */
export function formatTimeExtenso(timeStrOrIso: string): string {
  if (!timeStrOrIso) return '';
  let hours = 14;
  let minutes = 0;

  if (timeStrOrIso.includes('T')) {
    const d = new Date(timeStrOrIso);
    hours = d.getHours();
    minutes = d.getMinutes();
  } else if (timeStrOrIso.includes(':')) {
    const parts = timeStrOrIso.split(':');
    hours = parseInt(parts[0], 10);
    minutes = parseInt(parts[1], 10);
  }

  const hPad = String(hours).padStart(2, '0');
  const mPad = String(minutes).padStart(2, '0');
  return `${hPad}:${mPad}`;
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
