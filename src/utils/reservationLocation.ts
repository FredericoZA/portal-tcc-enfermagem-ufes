export const CUSTOM_DEFENSE_LOCATION = '__OUTRO_LOCAL__';
export const MANAGED_DEFENSE_LOCATIONS = [
  'Auditório do Prédio do Departamento de Enfermagem - CCS/UFES',
  'Sala de reuniões do Departamento de Enfermagem - CCS/UFES'
];
const key=(value:string)=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
export function isManagedDefenseLocation(local:string, locations=MANAGED_DEFENSE_LOCATIONS){
  const normalized=key(local);
  return locations.some(location=>key(location)===normalized)||['auditorio','sala de reunioes','auditorio do ccs ufes','auditorio do departamento de enfermagem','auditorio do departamento de enfermagem ccs ufes','sala de reunioes do departamento de enfermagem','sala de reunioes do departamento de enfermagem ccs ufes'].includes(normalized);
}
