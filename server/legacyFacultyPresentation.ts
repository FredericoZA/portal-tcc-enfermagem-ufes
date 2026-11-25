import { DEFAULT_INSTALLATION_PROFILE } from '../src/constants/installation';
import type { LegacyAcademicPresentation, LegacyAcademicRecord, PublicLegacyAcademicRecord } from '../src/types/legacyArchive';
import { displayParticipantInstitution } from '../src/utils/institutionName';
import { plainPersonName, recordedAcademicName } from '../src/utils/personPresentation';
import { isDepartmentFacultyName } from './ufesFacultyInstitution';

const officialCatalog = 'https://enfermagem.vitoria.ufes.br/pt-br/trabalhos-de-conclusao-de-curso-defendidos';
const normalized = (s: unknown) => typeof s === 'string'
  ? s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^\p{L}\d]+/gu, ' ').trim()
  : '';
const nameKey = (nome: string) => normalized(plainPersonName({nome:nome.trim()}));

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
  const names = (field: string) => {
    const people = new Map<string, string[]>();
    for (const row of rows) {
      const value = row?.[field];
      if (typeof value !== 'string' || value.length > 1000) continue;
      for (const name of value.split(/\s+[-–—]\s*|[;\n]+/u)) {
        const key = nameKey(name);
        if (key) people.set(key, [...(people.get(key) || []), name]);
      }
    }
    return people;
  };
  return {internal: names('examinadorInterno'), external: names('examinadorExterno')};
}

// Department directory and UFRJ's dated doctoral defenses (DINTER-UFES).
// https://enfermagem.vitoria.ufes.br/pt-br/fale-conosco
// https://xn--psgraduao-s2a7b6i.eean.ufrj.br/pagina/chamadas/45/pagina/acompanhamento/36/pagina/egressos-doutorado/44/
const verifiedFaculty = [
  {name:'Márcia Valéria de Souza Almeida', aliases:[], doctorate:'2016-12-14'},
  {name:'Luciana de Cássia Nunes Nascimento', aliases:['Luciana de Cássia N. Nascimento'], doctorate:'2016-11-25'},
];
const verifiedByName = new Map(verifiedFaculty.flatMap(person =>
  [person.name, ...person.aliases].map(name => [nameKey(name), person] as const)));

function academicEvidence(name: string, recorded: string[], defenseDate: string): LegacyAcademicPresentation | undefined {
  const saved = recordedAcademicName({nome:name});
  const verified = verifiedByName.get(nameKey(name));
  const historical = verified && defenseDate >= verified.doctorate ? {tratamento:'Professora', titulacao:'Doutora'} : {};
  const candidates = recorded.map(nome => recordedAcademicName({nome}));
  const recover = (field: keyof LegacyAcademicPresentation) => {
    const values = new Set(candidates.map(candidate => candidate[field]).filter(Boolean));
    return saved[field] || (values.size === 1 ? [...values][0] : undefined) || historical[field];
  };
  const tratamento = recover('tratamento');
  const titulacao = recover('titulacao');
  if (tratamento || titulacao) return {tratamento, titulacao};
}

const isMissingInstitution = (value: string) => !normalized(value) || normalized(value) === 'nao informado';

export function legacyFacultyPresentation(record: LegacyAcademicRecord): Pick<PublicLegacyAcademicRecord,
    'advisorAcademic' | 'coadvisorAcademic' | 'coorientador' | 'coorientadorInstituicao' | 'examinadores'> {
  const catalog = recordedAdvisorDegree(record);
  const advisorAcademic = catalog || academicEvidence(record.orientador, [], record.dataDefesa);
  const {internal, external} = archivedExaminerRoles(record);
  const examinadores = record.examinadores.map(person=>{
    const key = nameKey(person.nome);
    const verified = verifiedByName.get(key);
    const knownInstitution = verified || (internal.has(key) && !external.has(key) && isDepartmentFacultyName(person.nome));
    const instituicao = knownInstitution && isMissingInstitution(person.instituicao)
      ? DEFAULT_INSTALLATION_PROFILE.institutionName : person.instituicao;
    const evidence = academicEvidence(person.nome, [...(internal.get(key) || []), ...(external.get(key) || [])], record.dataDefesa);
    return {...person, nome:verified?.name || person.nome, instituicao, ...evidence};
  });

  let {coorientador, coorientadorInstituicao} = record;
  const abbreviation = displayParticipantInstitution(coorientador);
  if (isMissingInstitution(coorientadorInstituicao) && abbreviation !== coorientador &&
      /^(?:universidade|hospital|secretaria municipal de saude)\b/u.test(normalized(coorientador))) {
    coorientadorInstituicao = coorientador;
    coorientador = '';
  }
  const coadvisor = verifiedByName.get(nameKey(coorientador));
  if (coadvisor && isMissingInstitution(coorientadorInstituicao)) {
    coorientadorInstituicao = DEFAULT_INSTALLATION_PROFILE.institutionName;
  }
  const coadvisorAcademic = academicEvidence(coorientador, [], record.dataDefesa);
  return {
    ...(advisorAcademic ? {advisorAcademic} : {}),
    ...(coadvisorAcademic ? {coadvisorAcademic} : {}),
    coorientador:coadvisor?.name || coorientador,
    coorientadorInstituicao,
    examinadores,
  };
}
