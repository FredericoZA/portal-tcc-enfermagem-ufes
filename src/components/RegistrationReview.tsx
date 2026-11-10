import { displayParticipantInstitution } from '../utils/institutionName';
import React from 'react';
import type { RegistrationQuestion } from '../types/operationalConfig';
import type { RegistrationFinding } from '../types/workflowOperations';
import { registrationParticipantLabel } from '../utils/workflowOperations';
import {isRegistrationIdentifierField} from '../utils/operationalConfig';
import {DEFAULT_INSTALLATION_PROFILE} from '../constants/installation';

const PERSON_FIELD = /^(?:ALUNO_[12]|ORIENTADOR|COORIENTADOR|EXAMINADOR_[23])_(?:NOME|EMAIL|INSTITUICAO|TRATAMENTO|TITULACAO)$/;
const PARTICIPANTS = [
  ['ALUNO_1', 'Autor'],
  ['ALUNO_2', 'Autor'],
  ['ORIENTADOR', 'Orientador'],
  ['EXAMINADOR_2', 'Examinador'],
  ['EXAMINADOR_3', 'Examinador'],
  ['COORIENTADOR', 'Coorientador'],
] as const;

export function RegistrationReview({ fields, valueFor, findings = [], institutionName = DEFAULT_INSTALLATION_PROFILE.institutionName }: {
  fields: RegistrationQuestion[];
  valueFor: (field: RegistrationQuestion) => string;
  findings?: RegistrationFinding[];
  institutionName?: string;
}) {
  const values = new Map(fields.map(field => [field.fieldKey, valueFor(field)]));
  const value = (key: string) => values.get(key) || '';
  const participants = PARTICIPANTS.filter(([prefix]) => value(`${prefix}_NOME`));
  const processFields = fields.filter(field => !PERSON_FIELD.test(field.fieldKey) && !isRegistrationIdentifierField(field.fieldKey, field.label) && valueFor(field) !== '');
  const processColumns = [0, 1].map(column => processFields.filter((_, index) => index % 2 === column)).filter(column => column.length > 0);

  return <section className="space-y-3" aria-labelledby="document-identification-title">
    <div className="portal-registration-review-data portal-card p-3">
      <h2 id="document-identification-title" className="mb-2 font-bold">Conferência dos dados</h2>
      <div className="portal-registration-review-columns">
        {processColumns.map((column, index) => <div key={index} className="portal-members-table-scroll" role="region" aria-label={`Conferência dos dados — caixa ${index + 1}`} tabIndex={0}>
          <table className="portal-members-table portal-registration-review-table" aria-label={`Conferência dos dados — caixa ${index + 1}`}>
            <colgroup><col style={{width:'42%'}}/><col style={{width:'58%'}}/></colgroup>
            <thead><tr><th scope="col">Campo</th><th scope="col">Informação</th></tr></thead>
            <tbody>{column.map(field => <tr key={field.fieldKey}><th scope="row">{field.label}</th><td>{valueFor(field)}</td></tr>)}</tbody>
          </table>
        </div>)}
      </div>
    </div>
    <div className="portal-card p-3">
      <h2 className="mb-2 font-bold">Dados dos participantes</h2>
      <div className="portal-members-table-scroll" role="region" aria-label="Conferência dos participantes com rolagem horizontal" tabIndex={0}>
        <table className="portal-members-table portal-registration-review-table" aria-label="Conferência dos participantes">
          <colgroup><col style={{width:'35%'}}/><col style={{width:'35%'}}/><col style={{width:'30%'}}/></colgroup>
          <thead><tr>{['Participante', 'E-mail', 'Dados institucionais'].map(label => <th key={label} scope="col">{label}</th>)}</tr></thead>
          <tbody>{participants.map(([prefix, role]) => <tr key={prefix}>
            <th scope="row"><span className="block font-normal">{role}</span><strong className="block text-[var(--portal-text-dark)]">{value(`${prefix}_NOME`)}</strong></th>
            <td>{value(`${prefix}_EMAIL`) || '—'}</td>
            <td>{[value(`${prefix}_TRATAMENTO`), value(`${prefix}_TITULACAO`)].filter(Boolean).length > 0 && <span className="block">{[value(`${prefix}_TRATAMENTO`), value(`${prefix}_TITULACAO`)].filter(Boolean).join(' · ')}</span>}<span className="block">{displayParticipantInstitution(prefix === 'ORIENTADOR' ? institutionName : value(`${prefix}_INSTITUICAO`) || (prefix.startsWith('ALUNO_') ? 'UFES' : '—'))}</span></td>
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
