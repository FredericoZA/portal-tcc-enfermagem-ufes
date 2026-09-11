export type StudioVariableDataType = 'text' | 'date' | 'email' | 'number' | 'url';

export interface IntegrationBrandKit {
  institutionName: string;
  courseName: string;
  universityLogoUrl: string;
  courseLogoUrl: string;
  emailBannerUrl: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  textColor: string;
  fontFamily: 'Arial' | 'Calibri' | 'Georgia' | 'Times New Roman';
  documentHeaderText: string;
  documentFooterText: string;
  emailFooterText: string;
}

export interface DocumentDesignConfig {
  templateId: string;
  fontFamily: IntegrationBrandKit['fontFamily'];
  fontSize: number;
  lineSpacing: number;
  marginTop: number;
  marginBottom: number;
  marginLeft: number;
  marginRight: number;
  showUniversityLogo: boolean;
  showCourseLogo: boolean;
  showPageNumbers: boolean;
  headerText: string;
  footerText: string;
  logoAlignment: 'left' | 'center' | 'right';
}

export interface EmailDesignConfig {
  templateId: string;
  logoUrl: string;
  heroImageUrl: string;
  buttonLabel: string;
  buttonUrl: string;
  footerText: string;
  contentWidth: number;
  borderRadius: number;
}

export interface FormDesignConfig {
  templateId: string;
  logoUrl: string;
  bannerImageUrl: string;
  introText: string;
  confirmationMessage: string;
  submitLabel: string;
  showProgress: boolean;
}

export type StudioRuleOperator =
  | 'EQUALS'
  | 'NOT_EQUALS'
  | 'CONTAINS'
  | 'NOT_EMPTY'
  | 'IS_TRUE';

export interface StudioCondition {
  fieldKey: string;
  operator: StudioRuleOperator;
  value?: string;
}

export interface StudioValidationRule {
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: string;
  allowedExtensions?: string[];
  maxFileSizeMb?: number;
  errorMessage?: string;
}

export interface CourseOperationsPolicy {
  defaultLocale: 'pt-BR' | 'en-US' | 'es-ES';
  supportedLocales: Array<'pt-BR' | 'en-US' | 'es-ES'>;
  timezone: string;
  accessibility: {
    minimumContrast: 'AA' | 'AAA';
    minimumTargetSize: 44 | 48;
    reducedMotionByDefault: boolean;
    requireVisibleFocus: boolean;
  };
  notifications: {
    emailEnabled: boolean;
    inPortalEnabled: boolean;
    dailyDigestEnabled: boolean;
    failureAlertRecipients: string[];
  };
  retention: {
    processYears: number;
    auditYears: number;
    emailDeliveryDays: number;
    allowLegalHold: boolean;
  };
}

export interface PortalReplicationGuide {
  enabled: boolean;
  githubRepositoryUrl: string;
  installationGuideUrl: string;
  title: string;
  description: string;
  steps: string[];
}

export type IntegrationAuditAction =
  | 'STUDIO_SAVED'
  | 'DRIVE_SCAN'
  | 'DRIVE_TEMPLATE_UPDATED'
  | 'VARIABLE_DISCOVERED'
  | 'VARIABLE_UPDATED'
  | 'VARIABLE_MERGED'
  | 'VARIABLE_DELETED'
  | 'VARIABLE_PROPAGATED'
  | 'BRAND_UPDATED'
  | 'DOCUMENT_UPDATED'
  | 'EMAIL_UPDATED'
  | 'FORM_UPDATED';

export interface IntegrationAuditEntry {
  id: string;
  action: IntegrationAuditAction;
  entityType: 'studio' | 'drive' | 'variable' | 'document' | 'email' | 'form' | 'brand';
  entityId: string;
  description: string;
  actorEmail: string;
  timestamp: string;
  before?: unknown;
  after?: unknown;
  affectedArtifacts?: string[];
}

/**
 * Snapshot versionado do estúdio. Arrays remain structurally typed here so the
 * settings layer does not import React page types and create a circular graph.
 */
export interface IntegrationStudioSettings {
  operationalConfig?: import('./operationalConfig').OperationalConfig;
  schemaVersion: 2 | 3;
  revision: number;
  savedAt: string;
  savedBy: string;
  driveModelosFolderUrl: string;
  brandKit: IntegrationBrandKit;
  documentDesigns: Record<string, DocumentDesignConfig>;
  emailDesigns: Record<string, EmailDesignConfig>;
  formDesigns: Record<string, FormDesignConfig>;
  matrixColumns: Array<Record<string, unknown>>;
  matrixRows: Array<Record<string, unknown>>;
  docTemplates: Array<Record<string, unknown>>;
  emailTemplates: Array<Record<string, unknown>>;
  formTemplates: Array<Record<string, unknown>>;
  workflowStages: Array<Record<string, unknown>>;
  operationsPolicy?: CourseOperationsPolicy;
  replicationGuide?: PortalReplicationGuide;
  publication?: {
    status: 'DRAFT' | 'PUBLISHED';
    publishedRevision?: number;
    publishedAt?: string;
    validationScore?: number;
  };
  auditTrail: IntegrationAuditEntry[];
  lastDriveSyncAt?: string;
  lastDriveSyncStatus?: 'never' | 'success' | 'partial' | 'error';
}
