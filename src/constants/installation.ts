import type { InstallationProfile, PortalFeatureFlag } from '../types';

/**
 * Este repositório é a instalação oficial do Portal TCC da Enfermagem/UFES.
 * Manter aqui um fallback institucional seguro evita que uma perda/indisponibilidade
 * temporária da configuração persistida faça a interface voltar a textos genéricos.
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
  // Há histórico institucional de endereços estudantis em ambos os domínios.
  // A lista continua configurável pelo Master e serve apenas para validação de alunos.
  studentEmailDomains: ['edu.ufes.br', 'aluno.ufes.br'],
  internalEmailDomains: ['ufes.br'],
  protocolPrefix: 'TCC',
  driveRootFolderName: 'Portal de TCC',
  defaultInstitutionName: 'Universidade Federal do Espírito Santo',
  defaultDefenseLocation: 'Auditório do Prédio do Departamento de Enfermagem - CCS/UFES'
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
