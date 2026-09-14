import type { InstallationProfile, PortalFeatureFlag } from '../types';

/**
 * Instalação oficial do Portal TCC da Enfermagem/UFES.
 * A identidade institucional é fixa nesta implantação; outras instituições que
 * reutilizem o código devem substituir estes valores na própria instalação.
 */
export const DEFAULT_INSTALLATION_PROFILE: InstallationProfile = {
  installationId: 'ufes-enfermagem',
  portalName: 'Portal TCC Enfermagem UFES',
  institutionName: 'Universidade Federal do Espírito Santo',
  institutionAcronym: 'UFES',
  courseName: 'Curso de Graduação em Enfermagem e Obstetrícia',
  courseAcronym: 'ENF',
  departmentName: 'Departamento de Enfermagem / Centro de Ciências da Saúde',
  campusName: 'Campus de Maruípe',
  city: 'Vitória/ES',
  countryCode: 'BR',
  locale: 'pt-BR',
  studentEmailDomains: ['edu.ufes.br'],
  internalEmailDomains: ['ufes.br'],
  protocolPrefix: 'TCC',
  driveRootFolderName: 'Portal de TCC',
  defaultInstitutionName: 'Universidade Federal do Espírito Santo',
  // Este valor é apenas fallback técnico. A escolha real ocorre no formulário
  // entre os locais publicados pelo Master.
  defaultDefenseLocation: 'Auditório do Prédio do Departamento de Enfermagem - CCS/UFES'
};

/**
 * Não existe implantação gradual nesta instalação. Mantemos somente chaves
 * internas que ainda protegem comportamentos úteis do fluxo; módulos fora do
 * escopo permanecem desligados e não são expostos na interface administrativa.
 */
export const DEFAULT_FEATURE_FLAGS: PortalFeatureFlag[] = [
  ['ACADEMIC_CYCLES', 'Períodos e editais de submissão', false],
  ['STUDENT_BULK_IMPORT', 'Importação assistida de alunos', true],
  ['PAIR_ACCEPTANCE', 'Aceite do segundo autor', true],
  ['DEFENSE_CONFLICTS', 'Detecção de conflitos de defesa', true],
  ['INSTITUTIONAL_DOSSIER', 'Dossiê institucional verificável', false],
  ['PUBLIC_AUTHENTICITY', 'Consulta pública de autenticidade', false],
  ['ADMIN_TRANSFER', 'Transferência segura de administração', true],
  ['OPERATIONS_KPIS', 'Indicadores operacionais sem dados pessoais', true]
].map(([key, description, enabled]) => ({
  key: key as PortalFeatureFlag['key'],
  enabled: Boolean(enabled),
  audience: key === 'PUBLIC_AUTHENTICITY' ? 'ALL' : 'ADMIN_ONLY',
  description: String(description),
  updatedAt: new Date().toISOString(),
  updatedBy: 'system'
}));
