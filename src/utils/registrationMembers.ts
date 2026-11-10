import { formatNameTitleCase } from './formatters';
import { renderInstitutionName } from './institutionName';
import { participantIsFemale, participantRole } from './officialParticipants';
import type { RegistrationAnswers } from '../types/operationalConfig';
import {DEFAULT_INSTALLATION_PROFILE} from '../constants/installation';

export interface RegistrationMemberRow {
  key: string;
  role: string;
  name: string;
  reference: string;
  qualification: string;
  email: string;
  institution: string;
}

const PARTICIPANTS = [
  { prefix: 'ALUNO_1', kind: 'student' },
  { prefix: 'ALUNO_2', kind: 'student' },
  { prefix: 'ORIENTADOR', kind: 'advisor' },
  { prefix: 'EXAMINADOR_2', kind: 'examiner' },
  { prefix: 'EXAMINADOR_3', kind: 'examiner' },
  { prefix: 'COORIENTADOR', kind: 'coadvisor' },
] as const;

const read = (answers: RegistrationAnswers, key: string): string =>
  String(answers[key] ?? '').trim();

const firstNonempty = (answers: RegistrationAnswers, ...keys: string[]): string =>
  keys.map((key) => read(answers, key)).find(Boolean) || '';

/**
 * Constrói somente as linhas visíveis do quadro de conferência.
 * Mantém cada coluna separada, no padrão de Dados dos membros do detalhe do TCC.
 * Não persiste nem modifica valores digitados no cadastro.
 */
export function buildRegistrationMemberRows(
  answers: RegistrationAnswers,
  studentInstitution = 'UFES',
): RegistrationMemberRow[] {
  return PARTICIPANTS.flatMap(({ prefix, kind }) => {
    if (prefix === 'ALUNO_2' && read(answers, 'TEM_ALUNO_2') !== 'Sim') return [];
    if (prefix === 'COORIENTADOR' && read(answers, 'TEM_COORIENTADOR') !== 'Sim') return [];

    const name = read(answers, `${prefix}_NOME`);
    if (!name) return [];

    const student = kind === 'student';
    const female = participantIsFemale(answers,prefix);
    const institutionRaw = firstNonempty(answers, `${prefix}_INSTITUICAO`);
    return [{
      key: prefix,
      role: participantRole(kind,answers,prefix),
      name: formatNameTitleCase(name),
      reference: student
        ? (female ? 'Aluna' : 'Aluno')
        : firstNonempty(answers, `${prefix}_TRATAMENTO`, `${prefix}_REFERENCIA`) || 'Professor',
      qualification: student
        ? '—'
        : firstNonempty(answers, `${prefix}_TITULACAO`, `${prefix}_TITULACAO_ACADEMICA`) || '—',
      email: read(answers, `${prefix}_EMAIL`) || '—',
      institution: kind === 'advisor'
        ? (studentInstitution === DEFAULT_INSTALLATION_PROFILE.institutionAcronym ? DEFAULT_INSTALLATION_PROFILE.institutionName : studentInstitution)
        : institutionRaw
        ? renderInstitutionName(institutionRaw)
        : student ? studentInstitution : 'Não informado',
    }];
  });
}
