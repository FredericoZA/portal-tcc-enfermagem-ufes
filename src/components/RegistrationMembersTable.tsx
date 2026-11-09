import React from 'react';
import type { RegistrationAnswers } from '../types/operationalConfig';
import { buildRegistrationMemberRows } from '../utils/registrationMembers';

interface RegistrationMembersTableProps {
  answers: RegistrationAnswers;
  studentInstitution?: string;
}

const cellClass = 'border-b border-slate-300 px-1.5 py-1.5 text-center align-middle text-[11px] leading-4 text-slate-700';
const pillClass = 'block min-h-6 rounded-md bg-slate-100 px-2 py-1 text-slate-700';

export const RegistrationMembersTable: React.FC<RegistrationMembersTableProps> = ({
  answers,
  studentInstitution = 'UFES',
}) => {
  const rows = buildRegistrationMemberRows(answers, studentInstitution);

  if (!rows.length) return null;

  return (
    <section
      id="registration-members-summary"
      data-portal-review="members"
      className="rounded-xl border border-slate-300 bg-[#dbe2e6] p-3 shadow-sm"
      aria-labelledby="registration-members-summary-title"
    >
      <h2 id="registration-members-summary-title" className="mb-2 text-sm font-black text-slate-950">
        Dados dos membros
      </h2>
      <div
        role="region"
        aria-label="Resumo dos membros do TCC"
        tabIndex={0}
        className="overflow-x-auto rounded-md border border-slate-300"
      >
        <table className="w-full min-w-[1050px] table-fixed border-collapse bg-[#d4dde2]">
          <colgroup>
            <col className="w-[10%]" />
            <col className="w-[24%]" />
            <col className="w-[10%]" />
            <col className="w-[9%]" />
            <col className="w-[23%]" />
            <col className="w-[24%]" />
          </colgroup>
          <thead className="bg-[#bac7ce] text-[11px] font-bold text-slate-950">
            <tr>
              {['Função', 'Nome', 'Referência', 'Titulação', 'E-mail', 'Instituição'].map((heading) => (
                <th key={heading} scope="col" className="px-2 py-2 text-center font-bold">
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((member) => (
              <tr key={member.key} className="border-b border-slate-300 last:border-b-0">
                <th scope="row" className={`${cellClass} font-normal`}>{member.role}</th>
                <td className={cellClass}><span className={`${pillClass} font-bold text-slate-900`}>{member.name}</span></td>
                <td className={cellClass}><span className={pillClass}>{member.reference}</span></td>
                <td className={cellClass}><span className={pillClass}>{member.qualification}</span></td>
                <td className={cellClass}><span className={`${pillClass} break-all`}>{member.email}</span></td>
                <td className={cellClass}><span className={`${pillClass} break-words`}>{member.institution}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
};
