import type { InstallationProfile, PortalFeatureFlag } from '../types';

export const DEFAULT_INSTALLATION_PROFILE: InstallationProfile = {
  installationId: 'portal-tcc-default',
  portalName: 'Portal de Trabalhos de Conclusão de Curso',
  institutionName: 'Instituição não configurada',
  institutionAcronym: 'IES',
  courseName: 'Curso não configurado',
  courseAcronym: 'CURSO',
  departmentName: 'Unidade acadêmica não configurada',
  campusName: 'Campus não configurado',
  city: 'Cidade/UF',
  countryCode: 'BR',
  locale: 'pt-BR',
  studentEmailDomains: [],
  internalEmailDomains: [],
  protocolPrefix: 'TCC',
  driveRootFolderName: 'PORTAL_TCC',
  defaultInstitutionName: 'Instituição não configurada',
  defaultDefenseLocation: 'Local a confirmar com a unidade acadêmica'
};

export const DEFAULT_FEATURE_FLAGS: PortalFeatureFlag[] = [
  ['ACADEMIC_CYCLES', 'Períodos e editais de submissão'],
  ['STUDENT_BULK_IMPORT', 'Importação assistida de alunos'],
  ['PAIR_ACCEPTANCE', 'Aceite do segundo autor'],
  ['DEFENSE_CONFLICTS', 'Detecção de conflitos de defesa'],
  ['INSTITUTIONAL_DOSSIER', 'Dossiê institucional verificável'],
  ['PUBLIC_AUTHENTICITY', 'Consulta pública de autenticidade'],
  ['ADMIN_TRANSFER', 'Transferência segura de administração'],
  ['OPERATIONS_KPIS', 'Indicadores operacionais sem dados pessoais']
].map(([key, description]) => ({
  key: key as PortalFeatureFlag['key'],
  enabled: true,
  audience: key === 'PUBLIC_AUTHENTICITY' ? 'ALL' : 'ADMIN_ONLY',
  description,
  updatedAt: new Date().toISOString(),
  updatedBy: 'system'
}));
