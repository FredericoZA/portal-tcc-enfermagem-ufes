import React from 'react';
import type { RegistrationQuestion } from '../types/operationalConfig';
import type { RegistrationFinding } from '../types/workflowOperations';
import { registrationParticipantLabel } from '../utils/workflowOperations';

const PERSON_FIELD = /^(?:ALUNO_[12]|ORIENTADOR|COORIENTADOR|EXAMINADOR_[23])_(?:NOME|EMAIL|MATRICULA|SIAPE|INSTITUICAO|TRATAMENTO|TITULACAO)$/;
const PARTICIPANTS = [
  ['ALUNO_1', 'Autor'],
  ['ALUNO_2', 'Autor'],
  ['ORIENTADOR', 'Orientador'],
  ['EXAMINADOR_2', 'Examinador'],
  ['EXAMINADOR_3', 'Examinador'],
  ['COORIENTADOR', 'Coorientador'],
] as const;

export function RegistrationReview({ fields, valueFor, findings = [] }: {
  fields: RegistrationQuestion[];
  valueFor: (field: RegistrationQuestion) => string;
  findings?: RegistrationFinding[];
}) {
  const values = new Map(fields.map(field => [field.fieldKey, valueFor(field)]));
  const value = (key: string) => values.get(key) || '';
  const participants = PARTICIPANTS.filter(([prefix]) => value(`${prefix}_NOME`));
  const hasHistoricalRegistration = participants.some(([prefix]) => value(`${prefix}_MATRICULA`) || value(`${prefix}_SIAPE`));
  const processFields = fields.filter(field => !PERSON_FIELD.test(field.fieldKey) && valueFor(field) !== '');
  const processRows = Array.from({ length: Math.ceil(processFields.length / 2) }, (_, index) => processFields.slice(index * 2, index * 2 + 2));

  return <section className="space-y-3" aria-labelledby="document-identification-title">
    <div className="portal-card p-3">
      <h2 id="document-identification-title" className="mb-2 font-bold">Conferência dos dados</h2>
      <div className="portal-members-table-scroll" role="region" aria-label="Conferência dos dados com rolagem horizontal" tabIndex={0}>
        <table className="portal-members-table portal-registration-review-table" aria-label="Conferência dos dados">
          <colgroup><col style={{width:'21%'}}/><col style={{width:'29%'}}/><col style={{width:'21%'}}/><col style={{width:'29%'}}/></colgroup>
          <thead><tr><th scope="col">Campo</th><th scope="col">Informação</th><th scope="col">Campo</th><th scope="col">Informação</th></tr></thead>
          <tbody>{processRows.map((row, index) => <tr key={index}>
            {row.map(field => <React.Fragment key={field.fieldKey}><th scope="row">{field.label}</th><td>{valueFor(field)}</td></React.Fragment>)}
            {row.length === 1 && <td colSpan={2} aria-label="Sem outro campo">—</td>}
          </tr>)}</tbody>
        </table>
      </div>
    </div>
    <div className="portal-card p-3">
      <h2 className="mb-2 font-bold">Dados dos participantes</h2>
      <div className="portal-members-table-scroll" role="region" aria-label="Conferência dos participantes com rolagem horizontal" tabIndex={0}>
        <table className="portal-members-table portal-registration-review-table" aria-label="Conferência dos participantes">
          <colgroup><col style={{width:hasHistoricalRegistration?'27%':'35%'}}/><col style={{width:hasHistoricalRegistration?'28%':'35%'}}/>{hasHistoricalRegistration&&<col style={{width:'20%'}}/>}<col style={{width:hasHistoricalRegistration?'25%':'30%'}}/></colgroup>
          <thead><tr>{['Participante', 'E-mail', ...(hasHistoricalRegistration?['Matrícula, SIAPE ou outro registro']:[]), 'Dados institucionais'].map(label => <th key={label} scope="col">{label}</th>)}</tr></thead>
          <tbody>{participants.map(([prefix, role]) => <tr key={prefix}>
            <th scope="row"><span className="block font-normal">{role}</span><strong className="block text-[var(--portal-text-dark)]">{value(`${prefix}_NOME`)}</strong></th>
            <td>{value(`${prefix}_EMAIL`) || '—'}</td>
            {hasHistoricalRegistration&&<td>{value(`${prefix}_MATRICULA`) || value(`${prefix}_SIAPE`) || '—'}</td>}
            <td>{[value(`${prefix}_TRATAMENTO`), value(`${prefix}_TITULACAO`)].filter(Boolean).length > 0 && <span className="block">{[value(`${prefix}_TRATAMENTO`), value(`${prefix}_TITULACAO`)].filter(Boolean).join(' · ')}</span>}<span className="block">{value(`${prefix}_INSTITUICAO`) || (prefix.startsWith('ALUNO_') ? 'UFES' : '—')}</span></td>
          </tr>)}</tbody>
        </table>
      </div>
    </div>
    {findings.length > 0 && <aside className="portal-instruction portal-registration-review-findings p-3" role="alert" aria-labelledby="registration-findings-title">
      <h2 id="registration-findings-title" className="mb-2 font-bold">Confira antes de gerar os documentos</h2>
      <div className="portal-members-table-scroll" role="region" aria-label="Dados para conferir com rolagem horizontal" tabIndex={0}>
        <table className="portal-members-table portal-registration-review-table" aria-label="Dados para conferir">
          <colgroup><col style={{width:'25%'}}/><col style={{width:'75%'}}/></colgroup>
          <thead><tr><th scope="col">Campo</th><th scope="col">O que conferir</th></tr></thead>
          <tbody>{findings.map((item, index) => <tr key={`${item.fieldKey}-${index}`}><th scope="row">{registrationParticipantLabel(item.fieldKey)}</th><td>{item.message}</td></tr>)}</tbody>
        </table>
      </div>
      <p className="mt-2 text-sm">Volte à etapa correspondente para corrigir. E-mails repetidos impedem o envio do cadastro.</p>
    </aside>}
  </section>;
}
