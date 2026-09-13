import type { ProcessData } from '../src/types';

export type PublicArtifactState = 'NOT_PRESENTED' | 'PRIVATE' | 'PUBLIC';

const stateLabel = (state: PublicArtifactState): string =>
  state === 'PUBLIC' ? 'Publicado' : state === 'PRIVATE' ? 'Não publicado pelo autor' : 'Não apresentado';

function personName(value: { nome?: string } | null | undefined) {
  return value ? { nome: String(value.nome || '').trim() } : null;
}

/**
 * Contrato mínimo do calendário anônimo. Não leva acervo, avaliação, matrícula,
 * e-mail, IDs internos de pessoas ou vínculos do Drive.
 */
export function publicCalendarView(process: ProcessData) {
  return {
    id: process.protocolo,
    protocolo: process.protocolo,
    titulo: process.titulo,
    etapaAtual: process.etapaAtual,
    status: process.status,
    aluno1: personName(process.aluno1),
    aluno2: personName(process.aluno2),
    orientador: personName(process.orientador),
    coorientador: process.coorientador
      ? { nome: process.coorientador.nome, instituicao: process.coorientador.instituicao || '' }
      : null,
    banca: process.banca.map((member) => ({
      nome: member.nome,
      funcao: member.funcao,
      membroTipo: member.membroTipo,
      instituicao: member.instituicao,
      profissao: member.profissao,
      titulacao: member.titulacao,
    })),
    defesa: {
      startAt: process.defesa.startAt,
      endAt: process.defesa.endAt,
      local: process.defesa.local,
      localStatus: process.defesa.localStatus,
    },
    createdAt: process.createdAt,
    updatedAt: process.updatedAt,
  };
}

function fullWorkState(process: ProcessData): PublicArtifactState {
  if (process.status !== 'CONCLUIDO') return 'NOT_PRESENTED';
  const hasArchivedFile = Boolean(process.acervo?.trabalhoCompletoFileId || process.acervo?.trabalhoCompletoSha256);
  if (!hasArchivedFile) return 'NOT_PRESENTED';
  if (
    process.acervo?.publicationState === 'PUBLIC' &&
    process.acervo.publishFullWork &&
    process.acervo.publicFullWorkFileUrl
  ) return 'PUBLIC';
  return 'PRIVATE';
}

function expandedAbstractState(process: ProcessData): PublicArtifactState {
  if (process.status !== 'CONCLUIDO') return 'NOT_PRESENTED';
  const hasArchivedFile = Boolean(process.acervo?.resumoExpandidoFileId || process.acervo?.resumoExpandidoSha256);
  if (!hasArchivedFile) return 'NOT_PRESENTED';
  if (
    process.acervo?.publicationState === 'PUBLIC' &&
    process.acervo.publishExpandedAbstract &&
    process.acervo.publicExpandedAbstractFileUrl
  ) return 'PUBLIC';
  return 'PRIVATE';
}

/**
 * Contrato do repositório anônimo. Os links só existem para cópias explicitamente
 * publicadas; originais privados e seus IDs nunca são serializados.
 */
export function publicRepositoryView(process: ProcessData) {
  const workState = fullWorkState(process);
  const abstractState = expandedAbstractState(process);
  return {
    id: process.protocolo,
    protocolo: process.protocolo,
    titulo: process.titulo,
    etapaAtual: process.etapaAtual,
    status: process.status,
    aluno1: personName(process.aluno1),
    aluno2: personName(process.aluno2),
    orientador: personName(process.orientador),
    coorientador: process.coorientador
      ? { nome: process.coorientador.nome, instituicao: process.coorientador.instituicao || '' }
      : null,
    banca: process.banca.map((member) => ({
      nome: member.nome,
      funcao: member.funcao,
      membroTipo: member.membroTipo,
      instituicao: member.instituicao,
      profissao: member.profissao,
      titulacao: member.titulacao,
    })),
    defesa: {
      startAt: process.defesa.startAt,
      endAt: process.defesa.endAt,
      local: process.defesa.local,
      localStatus: process.defesa.localStatus,
    },
    avaliacao: {
      status: process.avaliacao.status,
      resultadoCode: process.avaliacao.resultadoCode,
      resultadoLabel: process.avaliacao.resultadoLabel,
    },
    acervo: process.acervo
      ? {
          palavrasChave: [...(process.acervo.palavrasChave || [])],
          resumoSintese: process.acervo.resumoSintese,
          submittedAt: process.acervo.submittedAt,
          fullWorkState: workState,
          fullWorkLabel: stateLabel(workState),
          expandedAbstractState: abstractState,
          expandedAbstractLabel: stateLabel(abstractState),
          publishFullWork: workState === 'PUBLIC',
          publishExpandedAbstract: abstractState === 'PUBLIC',
          trabalhoCompletoFileUrl: workState === 'PUBLIC' ? process.acervo.publicFullWorkFileUrl : undefined,
          resumoExpandidoFileUrl: abstractState === 'PUBLIC' ? process.acervo.publicExpandedAbstractFileUrl : undefined,
          publicationState: process.acervo.publicationState || (workState === 'PUBLIC' || abstractState === 'PUBLIC' ? 'PUBLIC' : 'NOT_REQUESTED'),
          publicationLabel:
            workState === 'PUBLIC' || abstractState === 'PUBLIC'
              ? 'Publicado'
              : workState === 'PRIVATE' || abstractState === 'PRIVATE'
                ? 'Não publicado pelo autor'
                : 'Não apresentado',
        }
      : {
          palavrasChave: [],
          fullWorkState: workState,
          fullWorkLabel: stateLabel(workState),
          expandedAbstractState: abstractState,
          expandedAbstractLabel: stateLabel(abstractState),
          publishFullWork: false,
          publishExpandedAbstract: false,
          publicationState: 'NOT_REQUESTED' as const,
          publicationLabel: 'Não apresentado',
        },
    createdAt: process.createdAt,
    updatedAt: process.updatedAt,
  };
}

/** Compatibilidade da antiga rota pública /api/processes sem ampliar dados. */
export function publicLegacyProcessView(process: ProcessData) {
  return process.status === 'CONCLUIDO' ? publicRepositoryView(process) : publicCalendarView(process);
}
