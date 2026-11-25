import { DEFAULT_INSTALLATION_PROFILE } from '../src/constants/installation';

// Exact name AND email pairs checked on the department's public directory on 2026-11-07.
// https://enfermagem.vitoria.ufes.br/pt-br/docentes
const faculty = [
  ['Aline Piovezan Entringer', 'alineentringer@gmail.com'],
  ['Andressa Bolsoni Lopes', 'andressa.lopes@ufes.br'],
  ['Bruno Henrique Fiorin', 'brunohenf@hotmail.com'],
  ['Cândida Caniçali Primo', 'candida.primo@ufes.br'],
  ['Carolina Maia Martins Sales', 'carolina.sales@ufes.br'],
  ['Daniela Vieira Malta', 'daniela.malta@ufes.br'],
  ['Eliane de Fátima Almeida Lima', 'elianelima66@gmail.com'],
  ['Ethel Leonor Nóia Maciel', 'ethel.maciel@gmail.com'],
  ['Fabiana Gonring Xavier', 'gonring@hotmail.com'],
  ['Fábio Lúcio Tavares', 'fabiotavares54@hotmail.com'],
  ['Fátima Maria Silva', 'silva.fatima962@gmail.com'],
  ['Flávia Batista Portugal', 'flavia.portugal@ufes.br'],
  ['Franciele Marabotti Costa Leite', 'francielemarabotti@gmail.com'],
  ['Jandesson Mendes Coqueiro', 'jandesson.mc@gmail.com'],
  ['Jorge Guimarães de Souza', 'jorgegsouza2@bol.com.br'],
  ['Kallen Dettmann Wandekoken', 'kallendw@gmail.com'],
  ['Karla de Melo Batista', 'kmbati@gmail.com'],
  ['Karolini Zuqui Nunes', 'karolini.nunes@ufes.br'],
  ['Lorena Barros Furieri', 'lorenabarrosfurieri@gmail.com'],
  ['Luciana de Cássia N. Nascimento', 'lcnnascimento@yahoo.com.br'],
  ['Luís Carlos Lopes Junior', 'lopesjr.lc@gmail.com'],
  ['Márcia Valéria de Souza Almeida', 'souzamarcia30@yahoo.com.br'],
  ['Mariana Rabello Laignier', 'mariana.laignier@ufes.br'],
  ['Mirian Fioresi', 'mirian.fioresi@ufes.br'],
  ['Paula de Souza Silva Freitas', 'paulassfreitas@gmail.com'],
  ['Priscilla Ferreira e Silva', 'silvapf@yahoo.com.br'],
  ['Renata Santos de Souza', 'drarenatasantosouza@gmail.com'],
  ['Rita Inês Casagrande da Silva', 'ritainesc@gmail.com'],
  ['Roseane Vargas Rohr', 'roseane.rohr@ufes.br'],
  ['Thiago Nascimento do Prado', 'thiagonprado@gmail.com'],
  ['Walckíria Garcia Romero Sipolatti', 'walckiriagr@uol.com.br'],
  ['Welington Serra Lazarini', 'welingtonsl@hotmail.com'],
] as const;

const normalizeName = (name: string) => name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().replace(/\s+/g, ' ').toLowerCase();
const identities = new Set(faculty.map(([name, email]) => `${normalizeName(name)}|${email}`));

/** Resolve a missing current affiliation only from an exact documented identity. */
export function ufesFacultyInstitution(person: { nome?: string; email?: string; instituicao?: string }): string | undefined {
  if (person.instituicao?.trim()) return person.instituicao;
  const identity = `${normalizeName(person.nome || '')}|${(person.email || '').trim().toLowerCase()}`;
  return identities.has(identity) ? DEFAULT_INSTALLATION_PROFILE.institutionName : person.instituicao;
}

import type { ProcessData } from '../src/types';
import { plainPersonName } from '../src/utils/personPresentation';

const facultyKey = (person: { nome: string; email?: string }) =>
  `${normalizeName(plainPersonName(person))}|${person.email?.trim().toLowerCase() || ''}`;

export function advisorInstitutionResolver(processes: readonly ProcessData[]) {
  const advisors = new Map<string, Set<string>>();
  for (const process of processes) {
    if (process.status === 'EM_RASCUNHO' || !process.orientador.email) continue;
    const key = facultyKey(process.orientador);
    const institutions = advisors.get(key) ?? new Set<string>();
    institutions.add(process.orientador.instituicao?.trim() || DEFAULT_INSTALLATION_PROFILE.institutionName);
    advisors.set(key, institutions);
  }

  return (process: ProcessData): ProcessData => {
    const withInstitution = <T extends { nome: string; email: string; instituicao?: string }>(person: T): T => {
      if (person.instituicao?.trim()) return person;
      const known = advisors.get(facultyKey(person));
      const institution = ufesFacultyInstitution(person) || (known?.size === 1 ? [...known][0] : undefined);
      return institution ? { ...person, instituicao: institution } : person;
    };
    return {
      ...process,
      orientador: withInstitution(process.orientador),
      coorientador: process.coorientador && withInstitution(process.coorientador),
      banca: process.banca.map(withInstitution),
    };
  };
}
