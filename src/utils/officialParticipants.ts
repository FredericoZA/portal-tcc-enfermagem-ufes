import type { ProcessData } from '../types';
import { formatTccTitle } from './formatters';

type WorkParticipants = Pick<ProcessData, 'titulo'|'aluno1'|'aluno2'|'orientador'|'banca'|'coorientador'|'registrationAnswers'>;

export interface OfficialParticipantLine {
  role: 'Aluno autor'|'Aluna autora'|'Orientador'|'Orientadora'|'Examinador'|'Examinadora'|'Coorientador'|'Coorientadora';
  name: string;
  key: string;
}

function value(answers: WorkParticipants['registrationAnswers'], key: string): string {
  return String(answers?.[key] ?? '').trim();
}

/** O gênero é exclusivamente o informado no cadastro, nunca inferido pelo primeiro nome. */
export function participantIsFemale(answers: WorkParticipants['registrationAnswers'], prefix: string): boolean {
  const declared = [value(answers, prefix+'_TRATAMENTO'), value(answers, prefix+'_GENERO'), value(answers,prefix+'_REFERENCIA')].join(' ');
  return /(?:^|\s)(?:feminino|fem|f|aluna|autora|professora|profª|profa\.?|dra\.?|doutora)(?:\s|$)/iu.test(declared);
}

function roleFor(kind: 'student'|'advisor'|'examiner'|'coadvisor', female: boolean): OfficialParticipantLine['role'] {
  const names = {
    student: ['Aluno autor', 'Aluna autora'],
    advisor: ['Orientador', 'Orientadora'],
    examiner: ['Examinador', 'Examinadora'],
    coadvisor: ['Coorientador', 'Coorientadora'],
  } as const;
  return names[kind][female ? 1 : 0];
}

function displayName(name: string, answers: WorkParticipants['registrationAnswers'], prefix: string, student: boolean): string {
  const clean = String(name || '').trim();
  if (!clean || student || /^(?:prof(?:essor(?:a)?)?\.?|profª\.?|dr(?:a|ª)?\.?)(?:\s|$)/iu.test(clean)) return clean;
  const treatment = value(answers,prefix+'_TRATAMENTO').toLocaleLowerCase('pt-BR');
  const degree = value(answers,prefix+'_TITULACAO').toLocaleLowerCase('pt-BR');
  if (!treatment && !degree) return clean;
  const female = participantIsFemale(answers,prefix);
  const teacher = /prof/.test(treatment) ? (female?'Profª.':'Prof.') : '';
  const title = /doutor/.test(degree) ? (female?'Drª.':'Dr.') :
    /mest/.test(degree) ? (female?'Ma.':'Me.') : '';
  return [teacher,title,clean].filter(Boolean).join(' ');
}

export function officialParticipantLines(process: WorkParticipants): OfficialParticipantLine[] {
  const result: OfficialParticipantLine[] = [];
  const add = (prefix: string, kind: 'student'|'advisor'|'examiner'|'coadvisor', name?: string) => {
    if (!String(name || '').trim()) return;
    result.push({
      key: prefix,
      role: roleFor(kind,participantIsFemale(process.registrationAnswers,prefix)),
      name: displayName(String(name),process.registrationAnswers,prefix,kind==='student'),
    });
  };
  add('ALUNO_1','student',process.aluno1?.nome);
  add('ALUNO_2','student',process.aluno2?.nome);
  add('ORIENTADOR','advisor',process.orientador?.nome);
  const examiners = (process.banca || []).filter(item=>item.funcao !== 'ORIENTADOR');
  for(const [index, examiner] of examiners.entries()) {
    const num=examiner.funcao.match(/EXAMINER_(\d+)/)?.[1] || String(index+2);
    add('EXAMINADOR_'+num,'examiner',examiner.nome);
  }
  add('COORIENTADOR','coadvisor',process.coorientador?.nome);
  return result;
}

/** Sequência única utilizada por e-mails, carta-convite, comprovantes e resumos. */
export function officialIdentificationLines(process: WorkParticipants): string[] {
  return [
    'Título: '+formatTccTitle(process.titulo),
    ...officialParticipantLines(process).map(item=>item.role+': '+item.name),
  ];
}

export function officialIdentificationBlock(process: WorkParticipants): string {
  return officialIdentificationLines(process).join('\n');
}
