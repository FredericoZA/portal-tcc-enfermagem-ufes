import type { ProcessData, SignatureJob } from '../types';
import { isRegistrationIdentifierField } from './operationalConfig';
import type { RegistrationAnswers } from '../types/operationalConfig';
import type {
  ProcessDataReviewInput,
  ReviewedAuthor,
  ReviewedFaculty,
  ReviewedExaminer,
} from '../types/processDataReview';

export interface ProcessDataReviewValues {
  titulo: string;
  aluno1: ReviewedAuthor;
  aluno2: ReviewedAuthor | null;
  authorOrder: 'ALUNO_1_FIRST' | 'ALUNO_2_FIRST';
  orientador: ReviewedFaculty;
  coorientador: ReviewedFaculty | null;
  banca: ReviewedExaminer[];
  defesa: {
    date: string;
    time: string;
    locationChoice: string;
    customLocation?: string;
  };
  registrationAnswers: RegistrationAnswers;
}
/** Mirrors the server locks; a recorded ata always needs formal reopening. */
export function processDataReviewBlocker(process:ProcessData,jobs:readonly SignatureJob[]):string|undefined {
  if(process.avaliacao.status==='CONCLUIDO'||process.avaliacao.submittedAt||process.acervo?.submittedAt||process.status==='CONCLUIDO')return 'Os dados foram encerrados com o registro de conceito e ata.';
  const processJobs=jobs.filter(job=>job.processId===process.id);
  if(process.avaliacao.reviewedAta||processJobs.some(job=>job.documentType==='ATA'&&job.status!=='CANCELED'))return 'Reabra conceito e ata antes de corrigir os dados.';
  if(processJobs.some(job=>['SENDING','SENT','PARTIALLY_SIGNED','SIGNED','DRIVE_SYNC_PENDING'].includes(job.status)))return 'Conclua ou cancele a solicitação de assinatura antes de corrigir os dados.';
}

const author = (person: ProcessData['aluno1']): ReviewedAuthor => ({
  nome: person.nome,
  email: person.email,
  tratamento: person.tratamento || 'Aluno',
});
const faculty = (person: ProcessData['orientador'] | ProcessData['banca'][number],examiner=false): ReviewedFaculty => ({
  nome: person.nome,
  email: person.email,
  tratamento: person.tratamento || (examiner?'':'Professor'),
  titulacao: person.titulacao || '',
  instituicao: person.instituicao || '',
});

/** Structural answers have their own validated controls; never expose workflow controls as metadata. */
export function isProcessReviewMetadataField(key: string): boolean {
  return (
    !isRegistrationIdentifierField(key) &&
    !/^(ALUNO_|ORIENTADOR_|COORIENTADOR_|EXAMINADOR_|DEFESA_|LOCAL_|TEM_ALUNO|TEM_COORIENTADOR|AUTORIA_|PUBLICAR|PUBLICACAO|ASSINATURA|ASTEN|GOV_|DRIVE_|PARECER|RESULTADO|NOTA|FREQUENCIA|CONCEITO|ATA_|TERMO_|DECLARACAO|STATUS|ETAPA)/.test(
      key,
    ) &&
    key !== 'TITULO'
  );
}

/** Editable fields only: identifiers, signatures and workflow state never enter the payload. */
export function processDataReviewValues(
  process: ProcessData,
  timezone = 'America/Sao_Paulo',
): ProcessDataReviewValues {
  const parts = Number.isFinite(Date.parse(process.defesa.startAt))
    ? new Intl.DateTimeFormat('sv-SE', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
      })
        .format(new Date(process.defesa.startAt))
        .replace(' ', 'T')
    : '';
  return {
    titulo: process.titulo,
    aluno1: author(process.aluno1),
    aluno2: process.aluno2 ? author(process.aluno2) : null,
    authorOrder: process.authorOrder || 'ALUNO_1_FIRST',
    orientador: faculty(process.orientador),
    coorientador: process.coorientador ? faculty(process.coorientador) : null,
    banca: process.banca
      .filter(
        (p): p is typeof p & { funcao: 'EXAMINER_2' | 'EXAMINER_3' } =>
          p.funcao === 'EXAMINER_2' || p.funcao === 'EXAMINER_3',
      )
      .map((p) => ({
        ...faculty(p,true),
        id: p.id,
        funcao: p.funcao,
        membroTipo: p.membroTipo || 'EXTERNO',
      })),
    defesa: {
      date: parts.slice(0, 10),
      time: parts.slice(11, 16),
      locationChoice: process.defesa.local || '',
    },
    registrationAnswers: { ...process.registrationAnswers },
  };
}

export function processDataReviewPatch(
  base: ProcessDataReviewValues,
  next: ProcessDataReviewValues,
  revision: number,
  answerKeys: readonly string[],
): ProcessDataReviewInput {
  const patch: ProcessDataReviewInput = {
    expectedDataRevision: revision,
    confirmed: true,
  };
  for (const key of [
    'titulo',
    'aluno1',
    'aluno2',
    'authorOrder',
    'orientador',
    'coorientador',
    'banca',
    'defesa',
  ] as const) {
    if (JSON.stringify(base[key]) !== JSON.stringify(next[key]))
      Object.assign(patch, { [key]: next[key] });
  }
  const answers: RegistrationAnswers = {};
  for (const key of answerKeys)
    if (
      isProcessReviewMetadataField(key) &&
      base.registrationAnswers[key] !== next.registrationAnswers[key]
    )
      answers[key] = next.registrationAnswers[key] ?? '';
  if (Object.keys(answers).length) patch.registrationAnswers = answers;
  return patch;
}
export function processDataReviewHasChanges(
  patch: ProcessDataReviewInput,
): boolean {
  return Object.keys(patch).some(
    (key) => !['expectedDataRevision', 'confirmed'].includes(key),
  );
}
