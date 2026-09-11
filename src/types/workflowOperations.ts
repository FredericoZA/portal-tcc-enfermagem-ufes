import type { RegistrationAnswers } from './operationalConfig';
export interface RegistrationDraft {
  ownerEmail: string; answers: RegistrationAnswers; section: number; revision: number;
  schemaRevision: number; updatedAt: string; expiresAt: string;
}
export type WaitingMilestone = 'LOCATION' | 'EVALUATION' | 'ATA' | 'FINAL_DELIVERY' | 'TERM' | 'DECLARATION';
export interface StageDeadline {
  id: string; milestone: WaitingMilestone; businessDays: number; reminderEveryDays: number;
  maxReminders: number; emailTemplateId: string; active: boolean;
}
export interface WorkflowOperationsPolicy {
  draftExpiryDays: number; holidays: string[]; weekdays: number[]; deadlines: StageDeadline[];
  identity: { minimumStudentIdLength: number; siapeLength: number };
  documentLayout: { signatureReservePoints: number; maximumPages: number };
}
export interface LocationProof {
  driveFileId: string; fileName: string; sha256: string; uploadedAt: string; uploadedBy: string; version: number;
}
export interface ReminderRecord {
  id: string; processId: string; milestone: WaitingMilestone; policyId: string; dueDate: string;
  recipient: string; ordinal: number; status: 'SENDING'|'SENT'|'FAILED'; createdAt: string; sentAt?: string; error?: string;
}
export interface RegistrationFinding { fieldKey: string; message: string; severity: 'WARNING'|'ERROR' }
