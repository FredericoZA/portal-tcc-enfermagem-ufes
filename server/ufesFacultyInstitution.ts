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
