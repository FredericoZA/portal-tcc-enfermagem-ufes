const departmentLabel = 'Departamento de Enfermagem - CCS UFES';
const auditoriumLabel = 'Auditório do Prédio do Departamento de Enfermagem - CCS UFES';
const ufesLocation = /\b(?:universidade federal do espirito santo|centro de ciencias da saude|campus (?:de )?maruipe|ufes|ccs|maruipe|vitoria(?: es)?)\b/gu;
const department = /\b(?:predio (?:do |de )?)?departamento de enfermage[m]?(?: e obstetricia)?\b/gu;
const genericAddress = /^(?:av(?:enida)? )?marechal campos(?: (?:n(?:o|umero)? )?\d+)?(?: cep)?(?: santos dumont)?(?: \d{5} ?\d{3})?$/u;

/** Apply institutional aliases to public catalog labels, leaving operational venues untouched. */
export function repositoryDefenseLocation(value?: string): string {
  const location = value?.trim() || '';
  if (!location) return location;
  const normalized = location.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase('pt-BR')
    .replace(/[^a-z0-9]+/g, ' ').trim();
  const withoutInstitution = normalized
    .replace(/\bauditorio de enfermagem\b/gu, 'auditorio')
    .replace(department, ' ')
    .replace(ufesLocation, ' ');
  const specific = withoutInstitution
    .replace(/\b(?:da|de|do|na|no)\b/gu, ' ')
    .replace(/\s+/g, ' ').trim();
  if (specific === 'auditorio') return auditoriumLabel;
  if ((!specific && withoutInstitution !== normalized) || genericAddress.test(specific)) return departmentLabel;
  return location;
}
