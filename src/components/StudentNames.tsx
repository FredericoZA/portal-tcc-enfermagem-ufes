import React from 'react';
import { formatNameTitleCase } from '../utils/formatters';

export interface StudentInfo {
  nome: string;
  matricula: string;
}

interface StudentNamesProps {
  aluno1?: StudentInfo | null;
  aluno2?: StudentInfo | null;
  align?: 'center' | 'left' | 'right';
  className?: string;
  itemClassName?: string;
  showIcon?: boolean;
  truncate?: boolean;
  showMatricula?: boolean;
}

export const StudentNames: React.FC<StudentNamesProps> = ({
  aluno1,
  aluno2,
  align = 'center',
  className = '',
  itemClassName = 'text-xs font-bold text-slate-900',
  showIcon = false,
  truncate = false,
  showMatricula = true,
}) => {
  if (!aluno1 || !aluno1.nome) return null;

  const alignClass =
    align === 'left'
      ? 'items-start text-left justify-start'
      : align === 'right'
      ? 'items-end text-right justify-end'
      : 'items-center text-center justify-center';

  // Sort students alphabetically by name (both have equal importance)
  const sortedStudents: StudentInfo[] = [];
  if (aluno1 && aluno1.nome) sortedStudents.push(aluno1);
  if (aluno2 && aluno2.nome) sortedStudents.push(aluno2);
  sortedStudents.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' }));

  return (
    <div className={`flex flex-col gap-0.5 ${alignClass} ${className}`}>
      {sortedStudents.map((st, idx) => {
        const formattedName = formatNameTitleCase(st.nome);
        const matriculaStr = showMatricula && st.matricula ? `${st.matricula} - ` : '';
        return (
          <div key={st.matricula || idx} className={`flex items-center gap-1 ${alignClass} ${itemClassName}`}>
            {showIcon && <span className="shrink-0">🪪</span>}
            <span className={truncate ? 'truncate' : ''}>
              {matriculaStr}{formattedName}
            </span>
          </div>
        );
      })}
    </div>
  );
};

interface GcalStudentNamesProps {
  alunoStr: string;
  align?: 'center' | 'left' | 'right';
  className?: string;
  itemClassName?: string;
  showIcon?: boolean;
}

export const GcalStudentNames: React.FC<GcalStudentNamesProps> = ({
  alunoStr,
  align = 'center',
  className = '',
  itemClassName = 'text-xs font-bold text-slate-900',
  showIcon = false,
}) => {
  if (!alunoStr) return null;

  const alignClass =
    align === 'left'
      ? 'items-start text-left justify-start'
      : align === 'right'
      ? 'items-end text-right justify-end'
      : 'items-center text-center justify-center';

  const cleanAlunoStr = alunoStr.replace(/🪪/g, '').replace(/\s{2,}/g, ' ').trim();
  const parts = cleanAlunoStr.split(/\s+e\s+(?=\d|\w+)|(?<=\w)\s*\/\s*(?=\w)/i);

  if (parts.length <= 1) {
    return (
      <div className={`flex items-center gap-1 ${alignClass} ${itemClassName}`}>
        {showIcon && <span className="shrink-0" aria-hidden="true">🪪</span>}
        <span>{cleanAlunoStr}</span>
      </div>
    );
  }

  return (
    <div className={`flex flex-col gap-0.5 ${alignClass} ${className}`}>
      {parts.map((p, idx) => {
        const cleanPart = p.trim();
        return (
          <div key={idx} className={`flex items-center gap-1 ${alignClass} ${itemClassName}`}>
            {showIcon && <span className="shrink-0" aria-hidden="true">🪪</span>}
            <span>{cleanPart}</span>
          </div>
        );
      })}
    </div>
  );
};
