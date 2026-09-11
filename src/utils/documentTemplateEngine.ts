import { ProcessData } from '../types';
import { formatDateExtensoTotal, formatTimeExtenso, formatStudentsString } from './formatters';

export interface BaseDocumentTemplate {
  id: string;
  type: string;
  label: string;
  fileName: string;
  templateContentText: string;
}

export const BASE_DOCUMENT_TEMPLATES: Record<string, BaseDocumentTemplate> = {
  CONVITE: {
    id: 'tmpl-convite', type: 'CONVITE', label: 'Carta-convite', fileName: '', templateContentText: ''
  },
  ATA: {
    id: 'tmpl-ata', type: 'ATA', label: 'Ata de defesa', fileName: '', templateContentText: ''
  },
  TERMO: {
    id: 'tmpl-termo', type: 'TERMO', label: 'Termo de autorização para publicação', fileName: '', templateContentText: ''
  },
  DECLARACAO: {
    id: 'tmpl-declaracao', type: 'DECLARACAO', label: 'Declaração de participação na banca', fileName: '', templateContentText: ''
  }
};

/**
 * Active runtime template storage (mirrored with Google Drive /Modelos)
 */
let runtimeTemplateStore: Record<string, BaseDocumentTemplate> = {};

export function updateRuntimeDocumentTemplates(templates: Record<string, BaseDocumentTemplate> | BaseDocumentTemplate[]) {
  if (Array.isArray(templates)) {
    runtimeTemplateStore = {};
    templates.forEach((tmpl) => {
      if (tmpl.templateContentText?.trim()) runtimeTemplateStore[tmpl.type || tmpl.id] = tmpl;
    });
  } else {
    runtimeTemplateStore = Object.fromEntries(Object.entries(templates).filter(([,tmpl])=>tmpl.templateContentText?.trim()));
  }
}

export function getRuntimeDocumentTemplates(): Record<string, BaseDocumentTemplate> {
  return runtimeTemplateStore;
}

/**
 * Generates the official Google Drive filename for a document based on its model template.
 */
export function getOfficialDriveDocumentFileName(docType: string, process: ProcessData): string {
  const proto = (process.protocolo || process.id).replace(/[^a-zA-Z0-9_-]/g, '_');
  const baseTmpl = runtimeTemplateStore[docType];
  const modelNameClean = (baseTmpl?.fileName || `${docType}_MODELO_DO_MASTER.docx`).replace(/\.docx$/, '').replace(/\.gdoc$/, '');
  return `${modelNameClean}_${proto}.docx`;
}

/**
 * Generates official document text based on a base template and process form data.
 */
export function generateOfficialDocumentText(
  docType: string,
  process: ProcessData,
  customTemplateText?: string
): string {
  const baseTmpl = runtimeTemplateStore[docType];
  if (!baseTmpl && !customTemplateText) return `${docType} • ${process.protocolo} • ${formatStudentsString(process.aluno1, process.aluno2)} • ${process.titulo}. A aparência final será gerada exclusivamente a partir do modelo ativo no Google Drive do usuário Master.`;
  let text = customTemplateText || baseTmpl?.templateContentText || '';
  if (!text.trim()) return `${docType} • ${process.protocolo} • ${formatStudentsString(process.aluno1, process.aluno2)} • ${process.titulo}. A aparência final será gerada exclusivamente a partir do modelo ativo no Google Drive do usuário Master.`;

  const hasTwoStudents = Boolean(process.aluno2 && process.aluno2.nome && process.aluno2.nome.trim() !== '');
  const hasCoorientador = Boolean(process.coorientador && process.coorientador.nome && process.coorientador.nome.trim() !== '');
  
  const localStr = (process.defesa?.local || '').toUpperCase();
  const formatoStr = (process.defesa?.formato || '').toUpperCase();
  const isOnline = formatoStr.includes('ONLINE') || localStr.includes('MEET') || localStr.includes('ONLINE');
  const isHibrido = formatoStr.includes('HIBRIDO') || localStr.includes('HÍBRIDO') || localStr.includes('HIBRIDO');
  const isPresencial = !isOnline && !isHibrido;

  // 1. Conditionals: {{SE_UNICO}} ... {{FIM_UNICO}} vs {{SE_DUPLA}} ... {{FIM_DUPLA}}
  if (!hasTwoStudents) {
    text = text.replace(/\{\{SE_DUPLA\}\}[\s\S]*?\{\{FIM_DUPLA\}\}/gi, '');
    text = text.replace(/\{\{SE_UNICO\}\}([\s\S]*?)\{\{FIM_UNICO\}\}/gi, '$1');
  } else {
    text = text.replace(/\{\{SE_UNICO\}\}[\s\S]*?\{\{FIM_UNICO\}\}/gi, '');
    text = text.replace(/\{\{SE_DUPLA\}\}([\s\S]*?)\{\{FIM_DUPLA\}\}/gi, '$1');
  }

  // 2. Conditionals: {{SE_COORIENTADOR}} ... {{FIM_COORIENTADOR}}
  if (!hasCoorientador) {
    text = text.replace(/\{\{SE_COORIENTADOR\}\}[\s\S]*?\{\{FIM_COORIENTADOR\}\}/gi, '');
  } else {
    text = text.replace(/\{\{SE_COORIENTADOR\}\}([\s\S]*?)\{\{FIM_COORIENTADOR\}\}/gi, '$1');
  }

  // 3. Conditionals: {{SE_ONLINE}} / {{SE_PRESENCIAL}} / {{SE_HIBRIDO}}
  if (isOnline) {
    text = text.replace(/\{\{SE_PRESENCIAL\}\}[\s\S]*?\{\{FIM_PRESENCIAL\}\}/gi, '');
    text = text.replace(/\{\{SE_HIBRIDO\}\}[\s\S]*?\{\{FIM_HIBRIDO\}\}/gi, '');
    text = text.replace(/\{\{SE_ONLINE\}\}([\s\S]*?)\{\{FIM_ONLINE\}\}/gi, '$1');
  } else if (isPresencial) {
    text = text.replace(/\{\{SE_ONLINE\}\}[\s\S]*?\{\{FIM_ONLINE\}\}/gi, '');
    text = text.replace(/\{\{SE_HIBRIDO\}\}[\s\S]*?\{\{FIM_HIBRIDO\}\}/gi, '');
    text = text.replace(/\{\{SE_PRESENCIAL\}\}([\s\S]*?)\{\{FIM_PRESENCIAL\}\}/gi, '$1');
  } else {
    text = text.replace(/\{\{SE_ONLINE\}\}[\s\S]*?\{\{FIM_ONLINE\}\}/gi, '');
    text = text.replace(/\{\{SE_PRESENCIAL\}\}[\s\S]*?\{\{FIM_PRESENCIAL\}\}/gi, '');
    text = text.replace(/\{\{SE_HIBRIDO\}\}([\s\S]*?)\{\{FIM_HIBRIDO\}\}/gi, '$1');
  }

  // 4. Form Variable Tag Replacements
  const discentesString = formatStudentsString(process.aluno1, process.aluno2);

  const bancaNames = (process.banca || [])
    .map((b) => `${b.nome}${b.instituicao ? ` (${b.instituicao})` : ''}`)
    .join(', ') || 'Professores Examinadores Designados';

  const dataHoraStr = process.defesa?.startAt
    ? `${formatDateExtensoTotal(process.defesa.startAt)} às ${formatTimeExtenso(process.defesa.startAt)}`
    : 'Data a ser agendada';

  const localFormatText = process.defesa?.local || (isOnline ? 'Defesa on-line — link ainda não informado' : 'Local da defesa ainda não informado');

  const resultadoText = process.avaliacao?.resultadoLabel || (process.avaliacao?.status === 'CONCLUIDO' ? 'APROVADO' : 'PENDENTE DE AVALIAÇÃO');
  const gradeVal = process.avaliacao?.nota ?? process.avaliacao?.notaFinal;
  const notaText = gradeVal !== undefined && Number.isFinite(gradeVal) ? gradeVal.toLocaleString('pt-BR', { maximumFractionDigits: 2 }) : '';
  const parecerText = process.avaliacao?.parecer || 'Parecer favorável registrado pela Comissão Examinadora.';
  const protocoloText = process.protocolo || process.id || 'PROTOCOLO_NAO_GERADO';
  const driveUrlText = process.driveFolderUrl || 'Pasta do processo ainda não sincronizada com o Google Drive';
  const coorientadorName = process.coorientador?.nome || 'Não possui';

  const tagReplacements: Record<string, string> = {
    '-CAMPO_01-': discentesString,
    '-CAMPO_02-': process.titulo || 'Trabalho de Conclusão de Curso',
    '-CAMPO_03-': process.orientador?.nome || 'Orientador Responsável',
    '-CAMPO_04-': dataHoraStr,
    '-CAMPO_06-': bancaNames,
    '-CAMPO_07_LOCAL-': localFormatText,
    '-CAMPO_09-': resultadoText,
    '-CAMPO_10-': notaText,
    '-CAMPO_11-': parecerText,
    '-CAMPO_12-': protocoloText,
    '-CAMPO_13-': driveUrlText,
    '-CAMPO_COORIENTADOR-': coorientadorName
  };

  Object.entries(tagReplacements).forEach(([tag, val]) => {
    text = text.replaceAll(tag, val);
  });

  const semanticValues: Record<string, string> = {
    ALUNOS_NOMES: discentesString,
    ALUNO_NOME: process.aluno1.nome,
    NOME_ALUNO: process.aluno1.nome,
    ALUNO_2_NOME: process.aluno2?.nome || '',
    ALUNO_MATRICULA: process.aluno1.matricula,
    ALUNO_EMAIL: process.aluno1.email,
    EMAIL_ALUNO: process.aluno1.email,
    TCC_TITULO: process.titulo,
    TITULO_TRABALHO: process.titulo,
    ORIENTADOR_NOME: process.orientador?.nome || '',
    NOME_ORIENTADOR: process.orientador?.nome || '',
    COORIENTADOR_NOME: coorientadorName,
    DEFESA_DATA_HORA_EXTENSO: dataHoraStr,
    DEFESA_DATA: process.defesa?.startAt ? formatDateExtensoTotal(process.defesa.startAt) : '',
    DATA_DEFESA: process.defesa?.startAt ? formatDateExtensoTotal(process.defesa.startAt) : '',
    DEFESA_LOCAL: localFormatText,
    LOCAL_DEFESA: localFormatText,
    BANCA_NOMES: bancaNames,
    AVALIACAO_RESULTADO: resultadoText,
    AVALIACAO_NOTA: notaText,
    AVALIACAO_PARECER: parecerText,
    PROTOCOLO: protocoloText,
    DRIVE_PASTA_URL: driveUrlText
    ,Alunos: discentesString
    ,'Título do Trabalho': process.titulo
    ,'Orientador (1)': process.orientador?.nome || ''
    ,'Examinador (2)': process.banca?.find(item=>item.funcao==='EXAMINER_2')?.nome || process.banca?.[1]?.nome || ''
    ,'Examinador (3)': process.banca?.find(item=>item.funcao==='EXAMINER_3')?.nome || process.banca?.[2]?.nome || ''
    ,'Data do Preenchimento': formatDateExtensoTotal(new Date().toISOString())
    ,'Data da Defesa (por extenso total)': process.defesa?.startAt ? formatDateExtensoTotal(process.defesa.startAt) : ''
    ,'Hora de Início da Defesa (por extenso)': process.defesa?.startAt ? formatTimeExtenso(process.defesa.startAt) : ''
    ,'Local da Defesa': localFormatText
    ,Situação: resultadoText
    ,Parecer: parecerText
    ,'Membros da Banca': bancaNames
    ,'Publicar Trabalho Completo': process.acervo?.publishFullWork ? 'SIM' : 'NÃO'
    ,'Publicar Resumo Expandido': process.acervo?.publishExpandedAbstract ? 'SIM' : 'NÃO'
    ,'Palavras-chave': process.acervo?.palavrasChave?.join('; ') || ''
    ,'Resumo Sintético': process.acervo?.resumoSintese || ''
  };

  const escapeKey = (key: string) => key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  Object.entries(semanticValues).forEach(([key, value]) => {
    const escaped = escapeKey(key);
    const patterns = [
      new RegExp(`<<\\s*${escaped}\\s*>>`, 'gi'),
      new RegExp(`\\{\\{\\s*${escaped}\\s*\\}\\}`, 'gi'),
      new RegExp(`\\[\\[\\s*${escaped}\\s*\\]\\]`, 'gi'),
      new RegExp(`«\\s*${escaped}\\s*»`, 'gi')
    ];
    patterns.forEach((pattern) => { text = text.replace(pattern, value); });
  });

  const unresolved = text.match(/(?:-(?:CAMPO|FIELD)_[A-Z0-9_]+-|<<\s*[A-Z][A-Z0-9_]+\s*>>|\[\[\s*[A-Z][A-Z0-9_]+\s*\]\]|«\s*[A-Z][A-Z0-9_]+\s*»|\{\{\s*(?!SE_|FIM_)[A-Z][A-Z0-9_]+\s*\}\})/g);
  if (unresolved?.length) throw new Error(`Variáveis obrigatórias não resolvidas: ${Array.from(new Set(unresolved)).join(', ')}`);

  return text.trim();
}
