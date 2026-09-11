import type { IntegrationStudioSettings } from './integrationStudio';

export interface NotificationPreferences {
  email: boolean;
  inPortal: boolean;
  dailyDigest: boolean;
  workflowEvents: boolean;
  signatureEvents: boolean;
  failureEvents: boolean;
  updatedAt: string;
}

export interface PortalNotification {
  id: string;
  severity: 'INFO' | 'WARNING' | 'ERROR' | 'SUCCESS';
  category: 'WORKFLOW' | 'EMAIL' | 'SIGNATURE' | 'DRIVE' | 'SYSTEM';
  title: string;
  message: string;
  processId?: string;
  createdAt: string;
}

export interface StudioVersionRecord {
  id: string;
  revision: number;
  createdAt: string;
  createdBy: string;
  validationScore: number;
  checksum: string;
  snapshot: IntegrationStudioSettings;
}

export type DataSubjectRequestKind = 'ACCESS' | 'CORRECTION' | 'ANONYMIZATION' | 'PORTABILITY' | 'INFORMATION';
export interface DataSubjectRequest {
  id: string;
  requesterEmail: string;
  kind: DataSubjectRequestKind;
  description: string;
  status: 'RECEIVED' | 'IN_REVIEW' | 'COMPLETED' | 'REJECTED';
  createdAt: string;
  updatedAt: string;
  resolvedBy?: string;
  resolutionNote?: string;
}

export interface LegalHold {
  id: string;
  processId: string;
  reason: string;
  active: boolean;
  createdAt: string;
  createdBy: string;
  releasedAt?: string;
  releasedBy?: string;
}

export interface BackupDrillReport {
  id: string;
  executedAt: string;
  schemaVersion: number;
  checksumValid: boolean;
  restorable: boolean;
  counts: Record<string, number>;
  issues: string[];
}

export interface OperationalHealthReport {
  generatedAt: string;
  overall: 'HEALTHY' | 'DEGRADED' | 'UNAVAILABLE';
  checks: Array<{
    id: string;
    label: string;
    status: 'PASS' | 'WARNING' | 'FAIL' | 'NOT_CONFIRMED';
    message: string;
  }>;
}

export interface StudioFormSubmission {
  id: string;
  processId: string;
  formId: string;
  formRevision: number;
  submittedBy: string;
  submittedAt: string;
  answers: Record<string, string | number | boolean>;
  checksum: string;
  archiveStatus: 'PENDING' | 'ARCHIVED' | 'FAILED';
  driveFileId?: string;
  archiveError?: string;
  formSnapshot?: { title: string; questions: import('./operationalConfig').RegistrationQuestion[] };
  workflowPending?: boolean;
  workflowError?: string;
}
