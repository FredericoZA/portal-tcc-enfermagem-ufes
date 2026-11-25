import { DEFAULT_INSTALLATION_PROFILE } from '../src/constants/installation';
import type { LegacyAcademicRecord, PublicLegacyAcademicRecord } from '../src/types/legacyArchive';
import { plainPersonName, recordedAcademicName } from '../src/utils/personPresentation';
import { isDepartmentFacultyName } from './ufesFacultyInstitution';

const officialCatalog = 'https://enfermagem.vitoria.ufes.br/pt-br/trabalhos-de-conclusao-de-curso-defendidos';
const normalized = (s: unknown) => typeof s === 'string'
  ? s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^\p{L}\d]+/gu, ' ').trim()
  : '';
const nameKey = (nome: string) => normalized(plainPersonName({nome}));

function recordedAdvisorDegree(record: LegacyAcademicRecord): PublicLegacyAcademicRecord['advisorAcademic'] {
  const {pageUrl, pageRecords} = record.provenance;
  if (pageUrl !== officialCatalog || !Array.isArray(pageRecords)) return;
  const advisor = nameKey(record.orientador);
  if (!advisor) return;
  const authors = new Set([record.autores.join(' '), [...record.autores].reverse().join(' ')].map(normalized));
  const matches = new Map<string, NonNullable<PublicLegacyAcademicRecord['advisorAcademic']>>();
  for (const row of pageRecords) {
    if (typeof row?.advisorOriginal !== 'string' || row.defenseDate !== record.dataDefesa ||
        normalized(row.titleOriginal) !== normalized(record.titulo) || !authors.has(normalized(row.authorsOriginal)) ||
        nameKey(row.advisorOriginal) !== advisor) continue;
    const {tratamento, titulacao} = recordedAcademicName({nome:row.advisorOriginal});
    if (tratamento || titulacao) matches.set(`${tratamento || ''}|${titulacao || ''}`, {tratamento, titulacao});
  }
  if (matches.size !== 1) return;
  const saved = recordedAcademicName({nome:record.orientador});
  const [fromCatalog] = matches.values();
  return {tratamento:saved.tratamento || fromCatalog.tratamento, titulacao:saved.titulacao || fromCatalog.titulacao};
}

function archivedExaminerRoles(record: LegacyAcademicRecord) {
  const projected = record.provenance.repositoryExaminerRoles;
  const source = record.provenance.submissionWorkbook as { rows?: { peopleOriginal?: unknown }[] } | undefined;
  const rows = Array.isArray(projected) ? projected : Array.isArray(source?.rows) ? source.rows.map(row=>row?.peopleOriginal) : [];
  const names = (key: string) => new Set(rows.flatMap(row=>{
    const value = row?.[key];
    return typeof value === 'string' && value.length <= 1000 ? value.split(/\s+[-–—]\s*|[;\n]+/u).map(nameKey).filter(Boolean) : [];
  }));
  return {internal: names('examinadorInterno'), external: names('examinadorExterno')};
}

export function legacyFacultyPresentation(record: LegacyAcademicRecord): Pick<PublicLegacyAcademicRecord,'advisorAcademic'|'examinadores'> {
  const advisorAcademic = recordedAdvisorDegree(record);
  const {internal, external} = archivedExaminerRoles(record);
  // The archived registration must identify this person as an internal examiner
  // in this defense, in addition to an exact match in the departmental directory.
  const examinadores = record.examinadores.map(person=>{
    const key = nameKey(person.nome);
    if (person.instituicao?.trim() || !internal.has(key) || external.has(key) || !isDepartmentFacultyName(person.nome)) return person;
    return {...person,instituicao:DEFAULT_INSTALLATION_PROFILE.institutionName};
  });
  return {...(advisorAcademic ? {advisorAcademic} : {}), examinadores};
}
