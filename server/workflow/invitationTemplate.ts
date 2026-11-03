import type { ProcessData } from '../../src/types';
import { officialParticipantLines } from '../../src/utils/officialParticipants';
import { formatDatePt } from '../../src/utils/formatters';

export type LiteralReplacement = { find: string; replace: string };

/**
 * Corrige exclusivamente a cópia temporária da carta-convite oficial no Drive.
 * O modelo publicado pelo Master permanece intacto.
 */
export function invitationTemplateCorrections(process: ProcessData, now = new Date()): LiteralReplacement[] {
  const lines = officialParticipantLines(process);
  const students = lines.filter(p => p.key.startsWith('ALUNO_'));
  const advisor = lines.find(p => p.key === 'ORIENTADOR');
  const evaluators = lines.filter(p => p.key.startsWith('EXAMINADOR_'));
  const coadvisor = lines.find(p => p.key === 'COORIENTADOR');
  const label = ({role,name}: typeof lines[number]) => `${role}: ${name}`;
  const data = formatDatePt(now.toISOString());
  return [
    {find:'Autoria: <<alunos>>',replace:students.map(label).join('\n')},
    {find:'Orientação e presidência: <<orientador (1)>>',replace:advisor?label(advisor):''},
    {find:'Demais integrantes da comissão: <<examinador (2)>> e <<examinador (3)>>',replace:[...evaluators,...(coadvisor?[coadvisor]:[])].map(label).join('\n')},
    {find:'Vitória-ES, <<data do preenchimento>>.',replace:''},
    {find:'Atenciosamente,',replace:`Atenciosamente,\nVitória-ES, ${data}.`},
  ];
}
