import {communicationCopyBlocker,sendConsciousCommunicationCopy} from './server/workflow/emailCommunicationCopy';
import {createDeletionStatusReader,installDeletionStatusRoute} from './server/processDeletionStatusRead';
import {createPublicCalendarDataReader,installPublicCalendarDataRoute} from './server/publicCalendarData';
import {resolveSignatureTemplateType} from './src/utils/signatureRecipientRoles';
import {documentSignatureProgress} from './src/utils/documentSignatureProgress';
import {afterReservationChangeResponse} from './server/workflow/reservationChangeFollowup';
import {hasPersonalEmailAccess} from './server/integrations/emailAuditCopy';
import {ATTENDANCE_MODEL,attendancePublication,publishedAttendanceBytes,attendanceBootstrap,sameAttendancePublication} from './server/documents/publicAttendanceDeclaration';
import {prepareAttendanceReferencePdf} from './server/integrations/googleWorkspace';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import {sanitizeTablePreference,validTableKey,type TablePreference} from './src/utils/tablePreferences';
import {formPresentation} from './src/utils/formPresentation';
import {reservationConfirmationView} from './src/utils/reservationConfirmationView';
import {studioEmailPreview, studioSampleProcess} from './src/utils/studioRuntimePreview';
import {isReservationDecisionEmail,operationalEmailRouting} from './src/utils/studioOperationalCatalog';
import {reconcileDeletedAstenEnvelope} from './server/workflow/astenDeletion';
import {institutionalDocumentLogo} from './src/utils/institutionalDocumentLogo';
import {calendarEventMatchesProcess, isDefenseOnCalendar, isDefenseReservationDeclined, effectiveDefenseReservationStatus} from './src/utils/defenseReservationState';
import {stripDocumentScanningBlocks,delimitedTextParts,stripInlineMarkup} from './src/utils/legacyTextProcessing';
import {isEmailAddress,isEmailHeaderAddress} from './src/utils/emailAddress';
import { legacyRepositoryProcess } from './src/utils/legacyRepository';
import { readLegacyAcademicPdf } from './server/legacyArchiveFiles';
import { validateLegacyBatch, mergeLegacyBatch, legacyCatalogRevision, publicLegacyAcademicView, privateLegacyAcademicView, canonicalLegacyRecord, legacyFileIsPublic, legacyAdministrativeFiles } from './server/legacyArchive';
import type { LegacyAcademicRecord } from './src/types/legacyArchive';
import {EVALUATION_OUTCOMES,evaluationQuestions,isConceptRegistrationReleased} from './src/utils/evaluationForm';
import {renderInstitutionName} from './src/utils/institutionName';
import {accessImportIssues} from './src/utils/accessImportValidation';
import {isManagedDefenseLocation} from './src/utils/reservationLocation';
import {prepareRegistrationSnapshot,renderRegistrationSnapshot,createBrandedTextPdf} from './server/documents/registrationSnapshot';
import {processWithPendingAtaStage,documentSignatureCompleted} from './src/utils/documentSignatureState';
import {createReservationReceiptPdf,reservationReceiptPresentation} from './server/documents/reservationReceipt';
import {renderReservationArchivePdf,renderReservationReceiptTemplate,reservationReceiptTemplate,type ReservationReceiptTemplate} from './server/documents/reservationReceiptTemplate';
import {receiptDesign} from './src/utils/receiptDesign';
import {mergeProcessProtocolCounters,ProcessProtocolExhausted,reserveNextProcessProtocol,seedProcessProtocolCounters,type ProcessProtocolCounters} from './server/workflow/processProtocol';
import {deleteProcessCalendarEvents} from './server/integrations/googleWorkspace';
import {deleteProcessSupabaseObjects} from './server/integrations/supabaseStorageStaging';
import {unlinkSync} from 'node:fs';
import {collectProcessDriveFileIds,isProcessDeletionInProgress,processDeletionLeaseMs,processDeletionNextRetryAt,processDeletionSummary,processDeletionTask,restoresDeletedProcess,selectDueProcessDeletions,type ProcessDeletionTask} from './server/workflow/processDeletion';
import {deleteProcessDriveArtifacts} from './server/integrations/googleDriveArchive';
import {loadRetainedProcessProtocols,purgeSupabaseProcessHistory} from './server/integrations/supabase';
import {notificationReadStore} from './server/integrations/notificationReadStore';
import type {PortalNotificationDetail} from './src/types/courseOperations';
import {publicAcademicDocuments,assertPublicAcademicPdf} from './server/publicAcademicDocuments';
import {withConsolidatedEmailNotifications,withApplicableProcessEmails,processEmailApplicable,finalProcessEmailKey,isConsolidatedEmailNotice} from './src/utils/consolidatedEmailNotifications';
import {operationalEmailRecipients,invitationEmailCopies} from './server/workflow/operationalEmailRecipients';
import {configuredEmailAudience,validateEmailRecipientSelection} from './src/utils/emailRecipientRoles';
import {operationalEmailRetryBlocker,type EmailRetryBlocker} from './server/workflow/emailRetryEligibility';
import {workflowRetryBlocker,nativeFormRetryEvent} from './server/workflow/retryEligibility';
import {confirmedInvitationDelivery} from './server/workflow/invitationDelivery';
import {currentReservationArchive,hasStableInvitationRecoveryIdentity,selectConfirmedInvitationRecovery} from './server/workflow/confirmedInvitationRecovery';
import {processEmailMessage} from './src/utils/processEmailMessage';
import { reservationToken, readReservationToken, reservationAlreadyAnsweredPage, readSavedReservationDecision, reservationRuntimeUnavailablePage, reservationPage, reservationEscape } from './server/workflow/reservationConfirmation';
import {RESERVATION_RESCHEDULED,reservationScheduleChanged,canRestartReservation,restartReservation,rescheduledReservationStudio} from './server/workflow/reservationReschedule';
import {normalizePersonName} from './src/utils/personNameCase';
import {formatTccTitle} from './src/utils/formatters';
import {studentRegistrationEmailAllowed} from './src/utils/studentRegistrationEmail';
import {publishReviewedModel} from './server/documents/reviewedModelPublication';
import {inspectDefenseConflicts} from './server/defenseConflicts';
import {DEFENSE_WEEKDAY_MESSAGE, defenseEndAt, isDefenseWeekday} from './src/utils/defenseSchedule';
import {DocumentModelError} from './src/utils/documentModelErrors';
import {isReferenceDocumentModel, REFERENCE_DOCUMENT_MODEL_LABELS} from './src/utils/referenceDocumentModels';
import {assertCurrentSignatureRecipients,canReturnGovbrDocument,signatureJobMatchesCurrentRevision,hasCompetingSignatureArchive,type SignableDocumentType} from './server/workflow/signaturePolicy';
import {signatureDocumentRevision} from './src/utils/documentSignatureState';
import {inspectAstenDelivery} from './server/integrations/astenReadiness';
import {documentVariables} from './src/utils/documentVariables';
import {adaptDocumentLanguage} from './src/utils/documentLanguage';
import {authorNames,orderedAuthors,academicName,STUDENT_TREATMENTS,FACULTY_TREATMENTS,ACADEMIC_DEGREES} from './src/utils/personPresentation';
import {localReviewFilesEnabled,sourceFilesAccessToken,sourceFilesFolder,uploadSourceFile,downloadSourceFile} from './server/localReviewFiles';
import {modelForRendering} from './server/workflow/modelPreviewSource';
import type {DriveModelFingerprint} from './server/integrations/googleWorkspace';
import {googleModelReference,googleFolderReference} from './server/googleModelReference';
import replicationModelHandler from './server/vercel/replication-model';
import runtimeAssetHandler from './server/vercel/runtime-asset';
import {auditChanges,sanitizeProcessAudit} from './src/utils/processAudit';
import {ataClosingTime} from './src/utils/ataClosingTime';
import {withDeclarationAfterTerm} from './src/utils/declarationWorkflow';
import {withRepositoryDeliveryEmail,repositoryDeliveryReady,repositoryDeliveryEmailKey,REPOSITORY_DELIVERY_EMAIL_ID,REPOSITORY_DELIVERY_READY} from './src/utils/repositoryDeliveryEmail';
import {localReviewData} from './server/localReviewData';
import {ataModelFingerprint,recoverEvaluationDocument} from './src/utils/evaluationDraftModel';
import {applyStudioImage} from './server/studioImages';
import {withEmailImages} from './server/workflow/emailImages';
import {consolidateProcessForms} from './src/utils/processFormConsolidation';
import {evaluationPreviewToken,readEvaluationPreview} from './server/security/evaluationPreview';
import {bindReservationContact,reservationDepartmentEnabled} from './src/utils/reservationContact';
import {canRecoverRepositorySignature,repositorySignatureEvent,safeRepositorySignatureError} from './server/workflow/automaticRepositorySignatureRecovery';
import {reservationDepartmentEmail,reservationCopies,reservationReceiptRecipients} from './server/workflow/reservationEmail';
import {localDocumentModelsEnabled,storeLocalDocumentModel,readLocalDocumentModel} from './server/localDocumentModels';
import {studentImportTemplateXlsx} from './src/utils/studentImport';
import {documentVerificationCode} from './server/security/documentVerificationCode';
import { inspectPdfLayout, markPreview } from './server/workflow/documentQuality';
import { acceptEvaluation, EvaluationError } from './server/workflow/evaluation';
import { formQuestionsWithoutIdentifiers, NATIVE_PROCESS_FORM_IDS, validateFormAnswers } from './src/utils/studioFormAnswers';
import {canUseFormRecipientSelection,type FormRecipientSelection} from './src/utils/formRecipientRoles';
import { createPortalHttpApp, portalHttpError } from './server/httpApp';
import { safeApiLogPath } from './server/security/requestLogging';
import { previewProcess } from './server/workflow/modelPreview';
import { compareStudioVersions } from './src/utils/studioDiff';
import { plannedDeadlines, claimableReminder } from './server/workflow/deadlines';
import { buildRecoveryQueue } from './server/workflow/recovery';
import { renderReminder } from './server/workflow/reminders';
import { buildInstitutionalReport, institutionalReportTheme } from './server/institutionalReport';
import { saveRegistrationDraft, pruneDrafts, DraftConflict } from './server/workflow/drafts';
import { workflowPolicy } from './src/utils/workflowOperations';
import { buildPublicRepository, publicCalendarView, publicLegacyProcessView, publicRepositoryView } from './server/publicViews';
import { buildPublicIndicatorsFromState } from './server/publicIndicators';
import type { RegistrationDraft, ReminderRecord } from './src/types/workflowOperations';
import { buildAdvancedAnalytics, analyticsCsv } from './server/advancedAnalytics';
import { simulateWorkflow } from './server/workflow/simulator';
import { acceptRegistration } from './server/workflow/registration';
import { FeedbackError, submitPublicFeedback, listFeedbackForAdmins, listFeedbackPageForAdmin, feedbackImageForAdmin, markFeedbackReviewed } from './server/publicFeedback';
import { validateReservationChange } from './server/workflow/reservationChange';
import { invitationTemplateCorrections } from './server/workflow/invitationTemplate';
import { officialParticipantLines } from './src/utils/officialParticipants';
import { ataArchived, declarationReady, latestSignature } from './server/workflow/gates';
import { reusableAstenSignatureJob } from './server/workflow/signatureOrder';
import {signatureAuditMetadata,recordSignatureAudit} from './server/workflow/signatureAuditMetadata';
import {captureSignaturePolicySnapshot,signatureSignersFromSnapshot,deriveSignatureSigners as registeredSignatureSigners,assertSignatureEligibility as assertRegisteredSignatureEligibility,canInitiateSignature as registeredSignaturePermission,assertDocumentSignatureOpen,publicationRequested,repositoryDataComplete} from './server/workflow/signaturePolicy';
import {finalDocumentFilesLocked,publicFileAuthorized} from './server/workflow/publicationAccess';
import {assertCurrentGoogleOAuthActor} from './server/security/googleOAuthPolicy';
import {mergeOperationalMetadata} from './server/backup/operationalMetadata';
import {createVerifiedPortalBackup} from './server/backup/verifiedBackup';
import { operationalConfig, presentVariables, registrationQuestions, isRegistrationIdentifierField, registrationAnswersWithoutIdentifiers } from './src/utils/operationalConfig';
import express from 'express';
import {waitUntil} from '@vercel/functions';
import {assertSignedPdfIntegrity} from './server/integrations/signedPdfIntegrity';
import {inspectAstenDeclaration} from './server/workflow/declarationBatch';
import {inspectGovbrReturnedPdf,assertGovbrManualApproval,type GovbrReviewConfirmation} from './server/integrations/govbrManualReview';
import {enqueueAstenWebhook,pendingAstenWebhooks,confirmAstenWebhookProcessed,astenWebhookInboxReady} from './server/integrations/astenWebhookInbox';
import {astenInfrastructureCheck,infrastructureReadyForProduction} from './server/integrations/infrastructureReadiness';
import {getAstenDocumentFolders,saveAstenDocumentFolders,resolveAstenDocumentFolder,validateAstenDocumentFolder} from './server/integrations/astenFolders';
import {attachRuntimeRequestLifecycle,beginRuntimeRequestTask,createRuntimeRequestQueue,settlePreviousRuntimeWrites} from './server/runtimeRequestQueue';
import {beginRegistrationRequestTiming,registrationRequestTiming} from './server/registrationTiming';
import {saveRegistrationDraftRuntimeState} from './server/integrations/supabase';
import {selectReservationNoticeRecoveries} from './server/reservationNoticeRecovery';
import path from 'path';
import dotenv from 'dotenv';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'fs';
import { createHash, randomBytes, timingSafeEqual } from 'crypto';
import JSZip from 'jszip';
import * as QRCode from 'qrcode';
import { createServer as createViteServer } from 'vite';
import {
  INITIAL_SETTINGS,
  DEMO_PROCESSES,
  DEMO_MEMBERSHIPS,
  DEMO_AUDIT_LOGS
} from './src/services/demoSeed';
import {
  ProcessData,
  ProcessMembership,
  GlobalSettings,
  AuditLog,
  ProcessDocument,
  DocumentCorrectionRequest,
  GlobalRole,
  ProcessRole,
  UserRole,
  GoogleCalendarSyncedEvent,
  SignatureJob,
  AuthorizedStudent,
  NotificationPreferences,
  DataSubjectRequest,
  LegalHold,
  StudioVersionRecord,
  StudioFormSubmission
} from './src/types';
import type { AcademicCycle, PortalFeatureKey } from './src/types';
import type { AstenWebhookEvent, EmailDeliveryRecord, WorkflowRun, WorkflowEventCode } from './src/types/automation';
import { normalizeEmail, formatStudentsString, formatDateWithWeekday, formatDateTimeWithWeekday, formatTime24h, formatDateExtensoWithWeekday, formatTimeExtenso, saoPauloCalendarDate, timestampInSaoPauloDateRange } from './src/utils/formatters';
import {
  enrichProcessDocumentsWithDrive
} from './src/services/serverDriveSync';
import { updateRuntimeDocumentTemplates } from './src/utils/documentTemplateEngine';
import { assertPortalSessionConfigured, attachPortalIdentity, clearPortalSessionCookie, getPortalIdentity, hasRecentAuthentication, requireAuthenticated, setPortalSessionCookie } from './server/security/firebaseAuth';
import {astenStatusCheckDue,ASTEN_STATUS_CHECK_INTERVAL_MS} from './server/workflow/astenAtaStatus';
import { assertAstenEnvelopeAuthentication, assertAstenEnvelopeDestination, assertAstenEnvelopeSigners, buildAstenEnvelopeParams, callAsten, connectPersistentAsten, extractAstenEnvelopeIdentity, getAstenSigningProfile, getPersistentAstenConnection, getAstenSignerPhones, getPersistentAstenStatus, inferAstenJobStatus, safeCompareWebhookSecret } from './server/integrations/asten';
import { persistStudioRuntimeImage, appendSupabaseAuditEvent, claimAstenEnvelopeDispatch, startPreparedAstenEnvelopeDispatch, currentPortalRuntimeRevision, readCachedPortalRuntimeState, readPortalRuntimeRevision, publicPortalRevisionToken, getSupabaseRuntimeStatus, getSupabaseRuntimeConnectionStatus, loadPortalCalendarSnapshot, loadPortalRuntimeState, refreshPortalRuntimeState, savePortalRuntimeState, testSupabaseRuntimeConnection, updateAstenEnvelopeDispatch } from './server/integrations/supabase';
import { createProfessionalPdf } from './server/documents/simplePdf';
import { extractAstenSignedPdf } from './server/integrations/asten';
import { buildProcessArchiveFileName, renamePortalProcessFolder, readExistingGeneratedInvitation, downloadDrivePdf, ensurePortalProcessDriveFolder, inspectPortalDriveArtifact, preparePrivatePublicationSource, withdrawDriveFilePublicAccess, uploadGeneratedPdfToDrive, uploadProcessFormPdf, uploadSignedPdfToDrive, reserveProcessFormPdfId, readProcessFormPdfById, type ProcessFormArchiveType } from './server/integrations/googleDriveArchive';
import { renderGoogleDriveTemplateToPdf,saveReviewedAta,exportReviewedAta,discardAtaCopy,cleanupExpiredAtaPreviews } from './server/integrations/googleDocsRenderer';
import { dispatchTrackedEmail, workflowEmailCopies } from './server/integrations/trackedGmail';
import { buildAuditFeed,buildPagedAuditFeed, decodeAuditCursor, emailDeliveryPreview, emailDeliveryAuditSummary } from './server/auditFeed';
import { administrativeDocumentLabels } from './src/utils/finalDeliveryPresentation';
import { reservationReceipts, reservationReceiptStatus } from './server/reservationReceipts';
import { buildProcessVariables, compileWorkflow, executeWorkflowEvent, mergeWorkflowHtmlVariables, mergeWorkflowVariables, normalizeWorkflowEventCode } from './server/workflow/runtime';
import { buildAstenOperationalDashboard, isReconcileableAstenWebhookEvent, normalizeAstenWebhookEvent } from './server/integrations/astenEventLedger';
import { buildPortalDriveFileName } from './src/services/googleDriveOrganizer';
import { getOtpRuntimeStatus, requestPortalOtp, verifyPortalOtp, setOtpChallengeCookie, readOtpChallengeCookie, OtpResendCooldownError } from './server/security/portalOtp';
import { ensurePortalRenderFolder, accessListGoogleSheetsTemplate, bootstrapGoogleDriveStructure, buildGoogleAuthorizationUrl, safeGoogleReturnTo, decodeGoogleOAuthState, exchangeGoogleAuthorizationCode, getGoogleOAuthSecurityPreflight, getGoogleWorkspaceAccessToken, getGoogleWorkspaceStatus, persistGoogleWorkspaceAuthorization, publishMasterDocumentModel, registerMasterDocumentModelFromDrive, sendGmailMessage, synchronizeDefenseCalendar, verifyMasterDocumentModelFingerprint, readDriveModelFingerprint, verifyPrivateDriveFolder, verifyDriveReferenceMetadata } from './server/integrations/googleWorkspace';
import {resolveReferenceDocumentModelFolder, verifyReferenceDocumentModelVersion} from './server/integrations/googleWorkspace';
import { deleteIntegrationSecret, getSecretStoreStatus } from './server/integrations/integrationSecrets';
import { emailMatchesDomains, isPortalFeatureEnabled, resolveInstallationProfile } from './src/utils/installationProfile';
import { emailAuditMailbox, isEmailAuditEnabled } from './src/utils/emailAuditSettings';
import { operationalDocumentType, validateCourseStudio } from './src/utils/courseStudioValidator';
import { StagedUploadCapacityError, cleanupExpiredDownloadTransfers, cleanupExpiredStagedUploads, createDrivePreviewTransfer, createDriveStagedUpload, readDrivePreviewTransfer, getSupabaseStagingSecurityStatus, withDriveStagedUpload, type StagedUploadPurpose } from './server/integrations/supabaseStorageStaging';

// A Vercel injeta as variáveis diretamente. Em desenvolvimento, carregamos
// primeiro o arquivo recomendado pelo guia e depois o .env convencional, sem
// sobrescrever valores fornecidos pelo sistema operacional.
dotenv.config({path:'.env.local',override:false,quiet:true});
dotenv.config({path:'.env',override:false,quiet:true});

const runtimePackageVersion = (() => {
  try {
    const parsed = JSON.parse(readFileSync(path.join(process.cwd(), 'package.json'), 'utf8')) as { version?: string };
    return String(parsed.version || '').trim();
  } catch {
    return '';
  }
})();

function runtimeGitCommit(): string {
  return String(
    process.env.VERCEL_GIT_COMMIT_SHA ||
    process.env.GITHUB_SHA ||
    process.env.PORTAL_GIT_COMMIT ||
    ''
  ).trim();
}

interface EvaluationAutosaveDraft {modelFingerprint?:string;documentText?:string;processId:string;dataRevision:number;answers:Record<string,string|number|boolean>;savedAt:string;savedBy:string;}
interface PersistedPortalState {
  legacyAcademicRecords?: LegacyAcademicRecord[];
  processDeletionTasks?:ProcessDeletionTask[];
  processProtocolCounters?:ProcessProtocolCounters;
  evaluationDrafts?: Record<string,EvaluationAutosaveDraft>;
  registrationDrafts?: Record<string,RegistrationDraft>;
  reminders?: ReminderRecord[];
  settings?: GlobalSettings;
  auditLogs?: AuditLog[];
  processes?: ProcessData[];
  memberships?: ProcessMembership[];
  correctionRequests?: DocumentCorrectionRequest[];
  signatureJobs?: SignatureJob[];
  astenCallbackFingerprints?: string[];
  revokedSessionIds?: string[];
  authorizedStudents?: AuthorizedStudent[];
  removedAccessProcessKeys?: string[];
  formArchiveJobs?: FormArchiveJob[];
  emailDeliveries?: EmailDeliveryRecord[];
  workflowRuns?: WorkflowRun[];
  astenWebhookEvents?: AstenWebhookEvent[];
  administrationTransfers?: AdministrationTransfer[];
  notificationPreferences?: Record<string, NotificationPreferences>;
  tablePreferences?: Record<string, Record<string, TablePreference>>;
  dataSubjectRequests?: DataSubjectRequest[];
  legalHolds?: LegalHold[];
  studioVersions?: StudioVersionRecord[];
  studioFormSubmissions?: StudioFormSubmission[];
  continuousIntelligence?: unknown;
}

interface AdministrationTransfer {
  id: string;
  role: 'MASTER_ADMIN' | 'COMMISSION_PRESIDENT';
  targetEmail: string;
  requestedBy: string;
  status: 'PENDING_TARGET_ACCEPTANCE' | 'COMPLETED' | 'CANCELED' | 'EXPIRED';
  requestedAt: string;
  expiresAt: string;
  completedAt?: string;
  canceledAt?: string;
  googleReconnectRequired?: boolean;
}

interface FormArchiveJob {
  id:string;processId:string;formType:ProcessFormArchiveType;version:number;sha256:string;artifactBase64:string;
  registrationSnapshot?: ReturnType<typeof prepareRegistrationSnapshot>;
  reservationTemplate?: ReservationReceiptTemplate;
  workflowStudioRevision?: number;
  receiptUpload?: {reservedFileId:string;candidates:Array<{sha256:string;source:'DOCX'|'CANONICAL'}>};
  receiptSource?: 'DOCX'|'CANONICAL';
  status:'PENDING'|'ARCHIVED'|'FAILED';reservationRevision?:number;driveFileId?:string;fileName?:string;lastError?:string;createdAt:string;updatedAt:string;
}

const portalDataDirectory = process.env.PORTAL_DATA_DIR || path.join(process.cwd(), '.portal-data');
const portalStateFile = path.join(portalDataDirectory, 'portal-state.json');

function loadPersistedPortalState(): PersistedPortalState {
  try {
    if (!existsSync(portalStateFile)) return {};
    const parsed = JSON.parse(readFileSync(portalStateFile, 'utf8'));
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (error) {
    console.warn('[Persistence] Não foi possível carregar o estado persistido:', error);
    return {};
  }
}

const persistedPortalState = loadPersistedPortalState();
let registrationDraftsStore=pruneDrafts(persistedPortalState.registrationDrafts||{});
let evaluationDraftsStore=new Map<string,EvaluationAutosaveDraft>(Object.entries(persistedPortalState.evaluationDrafts||{}));
let reminderRecordsStore:ReminderRecord[]=persistedPortalState.reminders||[];
const productionRuntime=process.env.NODE_ENV==='production'||Boolean(process.env.VERCEL);
const bootstrapMasterEmail=normalizeEmail(String(process.env.PORTAL_BOOTSTRAP_MASTER_EMAIL||''));
const reviewSeed=localReviewData(persistedPortalState,process.env);
if(reviewSeed)Object.assign(persistedPortalState,reviewSeed);

// The integrated configuration and its audit history survive server restarts.
let currentSettings: GlobalSettings = productionRuntime
  ? {...INITIAL_SETTINGS,masterEmail:bootstrapMasterEmail,ownerEmail:bootstrapMasterEmail,commissionPresidentEmail:'',masterRecoveryEmails:[],...(persistedPortalState.settings||{})}
  : { ...INITIAL_SETTINGS, ...(persistedPortalState.settings || {}) };
delete (currentSettings as any).recoverySecretKey;
delete (currentSettings as any).courseCoordinatorEmail;
delete (currentSettings as any).courseCoordinatorName;
const configuredPresidentEmail=normalizeEmail(currentSettings.commissionPresidentEmail||currentSettings.masterRecoveryEmails?.[0]||'');
if(configuredPresidentEmail)currentSettings={...currentSettings,commissionPresidentEmail:configuredPresidentEmail,masterRecoveryEmails:[configuredPresidentEmail]};
{const flags=currentSettings.featureFlags||[];currentSettings.featureFlags=flags.some(flag=>flag.key==='ADMIN_TRANSFER')?flags.map(flag=>flag.key==='ADMIN_TRANSFER'?{...flag,enabled:true}:flag):[...flags,{key:'ADMIN_TRANSFER',enabled:true,audience:'ADMIN_ONLY',description:'Transferência segura de administração',updatedAt:new Date().toISOString(),updatedBy:'SYSTEM'}];}
for(const model of Object.values(currentSettings.documentModels||{}))if(model)model.templateContentText='';
if(localDocumentModelsEnabled()){
  const now=new Date().toISOString();const labels={CONVITE:'Carta-convite',ATA:'Ata de defesa',TERMO:'Termo de autorização',DECLARACAO:'Declaração'} as const;
  currentSettings.documentModels=Object.fromEntries(Object.entries(labels).map(([type,label])=>[type,currentSettings.documentModels?.[type]?.contentSha256?currentSettings.documentModels[type]:{id:`test-${type.toLowerCase()}`,type,label,fileName:`${type}.docx`,templateContentText:'',driveFileId:`test_drive_${type.toLowerCase()}_001`,driveFileUrl:'',variables:[],uploadedAt:now,uploadedBy:'test@local'}])) as GlobalSettings['documentModels'];
}
let legacyAcademicRecordsStore: LegacyAcademicRecord[] = (persistedPortalState.legacyAcademicRecords || []).map(canonicalLegacyRecord);
let processDeletionTasksStore:ProcessDeletionTask[]=persistedPortalState.processDeletionTasks||[];
function isParticipantIdentifier(key: string): boolean {
  return isRegistrationIdentifierField(key) || /^(?:registro|ra)$/i.test(key);
}

function withoutParticipantIdentifiers<T extends object>(person: T): T {
  return Object.fromEntries(Object.entries(person).filter(([key]) => !isParticipantIdentifier(key))) as T;
}

type ProcessParticipants = Pick<ProcessData,'aluno1'|'aluno2'|'orientador'|'coorientador'|'banca'>;

function cleanProcessParticipants<T extends ProcessParticipants>(record: T): T {
  const cleanStudent = (student: ProcessParticipants['aluno1']) => ({
    ...withoutParticipantIdentifiers(student), matricula: ''
  });
  return {
    ...record,
    aluno1: cleanStudent(record.aluno1),
    aluno2: record.aluno2 && cleanStudent(record.aluno2),
    orientador: withoutParticipantIdentifiers(record.orientador),
    coorientador: record.coorientador && withoutParticipantIdentifiers(record.coorientador),
    banca: record.banca.map(withoutParticipantIdentifiers)
  };
}

function cleanProcessIdentifiers(process: ProcessData): ProcessData {
  const history = process.defesa.reservationHistory;
  return {
    ...cleanProcessParticipants(process),
    registrationAnswers: process.registrationAnswers && registrationAnswersWithoutIdentifiers(process.registrationAnswers),
    defesa: {
      ...process.defesa,
      reservationHistory: history?.map(entry => entry.receiptContext
        ? { ...entry, receiptContext: cleanProcessParticipants(entry.receiptContext) }
        : entry)
    }
  };
}

type HistoricalParticipantIdentifiers = Map<string, Record<string, unknown>>;
type HistoricalProcessIdentifiers = {
  participants: HistoricalParticipantIdentifiers;
  registrationAnswers: NonNullable<ProcessData['registrationAnswers']>;
  receipts: Map<string, HistoricalParticipantIdentifiers>;
};

// Keep existing identifiers out of runtime process views, documents and email.
// Reattach the original values only when serializing authoritative storage.
let historicalProcessIdentifiers = new Map<string, HistoricalProcessIdentifiers>();
let historicalAccessIdentifiers: HistoricalParticipantIdentifiers = new Map();

function captureParticipantIdentifiers(target: HistoricalParticipantIdentifiers, key: string, person: object): void {
  const fields = Object.fromEntries(Object.entries(person).filter(([name, value]) => isParticipantIdentifier(name) && value !== '' && value != null));
  if (key && Object.keys(fields).length) target.set(key, fields);
}

function historicalParticipantKey(role: string, email: string): string {
  const normalized = normalizeEmail(email || '');
  return normalized ? `${role}:${normalized}` : '';
}

function mapProcessParticipants<T extends ProcessParticipants>(
  record: T,
  mapPerson: <P extends {email: string}>(person: P, role: string) => P
): T {
  return {
    ...record,
    aluno1: mapPerson(record.aluno1, 'student'),
    aluno2: record.aluno2 && mapPerson(record.aluno2, 'student'),
    orientador: mapPerson(record.orientador, 'advisor'),
    coorientador: record.coorientador && mapPerson(record.coorientador, 'coadvisor'),
    banca: record.banca.map(member => mapPerson(member, 'examiner'))
  };
}

function receiptHistoryKey(entry: NonNullable<ProcessData['defesa']['reservationHistory']>[number]): string {
  return JSON.stringify([entry.reservationRevision, entry.invalidatedAt, entry.startAt, entry.local]);
}

function hydrateProcesses(records: ProcessData[]): ProcessData[] {
  historicalProcessIdentifiers = new Map();
  const capture = (record: ProcessParticipants) => {
    const fields: HistoricalParticipantIdentifiers = new Map();
    mapProcessParticipants(record, (person, role) => {
      captureParticipantIdentifiers(fields, historicalParticipantKey(role, person.email), person);
      return person;
    });
    return fields;
  };
  return records.map(record => {
    const participants = capture(record);
    const registrationAnswers = Object.fromEntries(Object.entries(record.registrationAnswers || {}).filter(([key]) => isRegistrationIdentifierField(key)));
    const receipts = new Map<string, HistoricalParticipantIdentifiers>();
    for (const entry of record.defesa.reservationHistory || []) {
      if (!entry.receiptContext) continue;
      const fields = capture(entry.receiptContext);
      if (fields.size) receipts.set(receiptHistoryKey(entry), fields);
    }
    if (participants.size || Object.keys(registrationAnswers).length || receipts.size) {
      historicalProcessIdentifiers.set(record.id, {participants, registrationAnswers, receipts});
    }
    return cleanProcessIdentifiers(record);
  });
}

function processForPersistence(record: ProcessData): ProcessData {
  const historical = historicalProcessIdentifiers.get(record.id);
  if (!historical) return record;
  const restore = <T extends ProcessParticipants>(participants: T, identifiers: HistoricalParticipantIdentifiers) =>
    mapProcessParticipants(participants, (person, role) => ({
      ...person, ...identifiers.get(historicalParticipantKey(role, person.email))
    }));
  return {
    ...restore(record, historical.participants),
    registrationAnswers: Object.keys(historical.registrationAnswers).length
      ? {...record.registrationAnswers, ...historical.registrationAnswers}
      : record.registrationAnswers,
    defesa: {
      ...record.defesa,
      reservationHistory: record.defesa.reservationHistory?.map(entry => {
        const identifiers = historical.receipts.get(receiptHistoryKey(entry));
        return identifiers && entry.receiptContext
          ? {...entry, receiptContext: restore(entry.receiptContext, identifiers)}
          : entry;
      })
    }
  };
}

function accessHistoryKey(entry: AuthorizedStudent): string {
  return JSON.stringify([entry.id, normalizeEmail(entry.email)]);
}

function hydrateAuthorizedStudents(entries: AuthorizedStudent[]): AuthorizedStudent[] {
  historicalAccessIdentifiers = new Map();
  return entries.map(entry => {
    captureParticipantIdentifiers(historicalAccessIdentifiers, accessHistoryKey(entry), entry);
    return withoutParticipantIdentifiers(entry);
  });
}

let processesStore: ProcessData[] = Array.isArray(persistedPortalState.processes)
  ? hydrateProcesses(persistedPortalState.processes)
  : productionRuntime ? [] : structuredClone(DEMO_PROCESSES).map(cleanProcessIdentifiers);
let processProtocolCountersStore=seedProcessProtocolCounters(persistedPortalState.processProtocolCounters,[...processesStore.map(process=>process.protocolo),...(persistedPortalState.processProtocolCounters===undefined?processDeletionTasksStore.map(task=>task.protocol):[])]);
reconcileRecordedReservationStatuses();
function reconcileRecordedReservationStatuses(): void {
  const design=receiptDesign(currentSettings.integrationStudio);
  for (const process of processesStore) {
    process.defesa.localStatus=effectiveDefenseReservationStatus(process);
    const responses=[process.defesa.departmentResponse,...(process.defesa.reservationHistory||[]).map(entry=>entry.departmentResponse)];
    for(const response of responses)if(response&&!response.receiptDesign)response.receiptDesign=design;
  }
}
let membershipsStore: ProcessMembership[] = Array.isArray(persistedPortalState.memberships) ? persistedPortalState.memberships : productionRuntime?[]:JSON.parse(JSON.stringify(DEMO_MEMBERSHIPS));
let auditLogsStore: AuditLog[] = Array.isArray(persistedPortalState.auditLogs)
  ? persistedPortalState.auditLogs
  : productionRuntime?[]:JSON.parse(JSON.stringify(DEMO_AUDIT_LOGS));
let correctionRequestsStore: DocumentCorrectionRequest[] = persistedPortalState.correctionRequests || [];
let signatureJobsStore: SignatureJob[] = (persistedPortalState.signatureJobs || []).filter((job) => job.documentType !== ('FOLHA_APROVACAO' as any));
let astenCallbackFingerprints = new Set<string>(persistedPortalState.astenCallbackFingerprints || []);
let revokedSessionIdsStore = new Set<string>(persistedPortalState.revokedSessionIds || []);
let removedAccessProcessKeys=new Set<string>(persistedPortalState.removedAccessProcessKeys||[]);
const accessProcessKey=(email:string,processId:string)=>createHash('sha256').update(`${normalizeEmail(email)}|${processId}`).digest('hex');
let authorizedStudentsStore: AuthorizedStudent[] = persistedPortalState.authorizedStudents ? hydrateAuthorizedStudents(persistedPortalState.authorizedStudents) : (productionRuntime?[]:DEMO_PROCESSES.flatMap((process) => [process.aluno1, process.aluno2].filter(Boolean).map((student: any) => ({
  id: `student-${normalizeEmail(student.email).replace(/[^a-z0-9]/g, '-')}`,
  nome: student.nome,
  email: normalizeEmail(student.email),
  active: true,
  processIds: [process.id],
  createdAt: process.createdAt,
  createdBy: currentSettings.masterEmail,
  updatedAt: process.updatedAt,
  accessType: 'STUDENT' as const,
  origin: 'MASTER_LIST' as const,
  roles: ['STUDENT'] as ProcessRole[]
}))));
let formArchiveJobsStore:FormArchiveJob[]=persistedPortalState.formArchiveJobs||[];
let emailDeliveriesStore:EmailDeliveryRecord[]=persistedPortalState.emailDeliveries||[];
let workflowRunsStore:WorkflowRun[]=persistedPortalState.workflowRuns||[];
let astenWebhookEventsStore:AstenWebhookEvent[]=persistedPortalState.astenWebhookEvents||[];
let administrationTransfersStore:AdministrationTransfer[]=persistedPortalState.administrationTransfers||[];
let tablePreferencesStore: Record<string, Record<string, TablePreference>> = persistedPortalState.tablePreferences || {};
let notificationPreferencesStore:Record<string,NotificationPreferences>=persistedPortalState.notificationPreferences||{};
let dataSubjectRequestsStore:DataSubjectRequest[]=persistedPortalState.dataSubjectRequests||[];
let legalHoldsStore:LegalHold[]=persistedPortalState.legalHolds||[];
const STUDIO_VERSION_LIMIT = 4;
function retainStudioVersions(versions: StudioVersionRecord[]) {
  return [...versions].sort((a, b) => a.revision - b.revision).slice(-STUDIO_VERSION_LIMIT);
}
let studioVersionsStore = retainStudioVersions(persistedPortalState.studioVersions || []);
let studioFormSubmissionsStore:StudioFormSubmission[]=persistedPortalState.studioFormSubmissions||[];
// Dados históricos legados são preservados, mas nenhum diagnóstico automático é executado.
let continuousIntelligenceStore:unknown=persistedPortalState.continuousIntelligence;
const otpIpBuckets=new Map<string,{startedAt:number;count:number}>();
function allowOtpRequestFromIp(ip:string):boolean{const key=createHash('sha256').update(`${process.env.PORTAL_OTP_PEPPER||'local'}|${ip||'unknown'}`).digest('hex');const now=Date.now();const current=otpIpBuckets.get(key);if(!current||now-current.startedAt>15*60_000){otpIpBuckets.set(key,{startedAt:now,count:1});return true;}current.count++;return current.count<=10;}
const publicDownloadBuckets=new Map<string,{startedAt:number;count:number}>();
function allowPublicDownload(ip:string):boolean{const key=createHash('sha256').update(`${process.env.PORTAL_OTP_PEPPER||'local'}|download|${ip||'unknown'}`).digest('hex');const now=Date.now();const current=publicDownloadBuckets.get(key);if(!current||now-current.startedAt>60_000){publicDownloadBuckets.set(key,{startedAt:now,count:1});return true;}current.count++;return current.count<=20;}
const signatureRetryBuckets=new Map<string,{startedAt:number;count:number}>();
function allowSignatureRetry(actorEmail:string,jobId:string):boolean{const key=createHash('sha256').update(`${process.env.PORTAL_OTP_PEPPER||'local'}|signature-retry|${normalizeEmail(actorEmail)}|${jobId}`).digest('hex');const now=Date.now();const current=signatureRetryBuckets.get(key);if(!current||now-current.startedAt>60_000){signatureRetryBuckets.set(key,{startedAt:now,count:1});return true;}current.count++;return current.count<=8;}
async function enforceMinimumResponseTime(startedAt:number,milliseconds=800):Promise<void>{const remaining=milliseconds-(Date.now()-startedAt);if(remaining>0)await new Promise(resolve=>setTimeout(resolve,remaining));}

function sessionUploadBinding(identity:{uid:string;issuedAt:number}):string{return `session:${identity.uid}:${identity.issuedAt}`;}
function safeDownloadFileName(value:string):string{return String(value||'documento.pdf').normalize('NFKC').replace(/[\u0000-\u001f\u007f\\/]/g,'_').trim().slice(0,180)||'documento.pdf';}
async function deliverPortalDownload(input:{res:express.Response;bytes:Buffer;fileName:string;mimeType:'application/pdf'|'application/zip';requesterBinding:string;cacheControl:string;processId?:string}):Promise<void>{
  const fileName=safeDownloadFileName(input.fileName);
  input.res.setHeader('Cache-Control',input.cacheControl);
  input.res.setHeader('X-Content-Type-Options','nosniff');
  input.res.setHeader('Content-Type',input.mimeType);
  input.res.setHeader('Content-Disposition',`attachment; filename="${fileName.replace(/[^ -~]|"/g,'_')}"; filename*=UTF-8''${encodeURIComponent(fileName)}`);
  if (input.bytes.length <= 4 * 1024 * 1024) {
    input.res.send(input.bytes);
    return;
  }
  const bytes=input.bytes;
  function* parts() {
    for (let offset=0; offset<bytes.length; offset+=256*1024) yield bytes.subarray(offset,offset+256*1024);
  }
  try { await pipeline(Readable.from(parts(),{objectMode:false}),input.res); }
  catch (error) { if (!input.res.destroyed) throw error; }
}

function readLegacyDevelopmentUpload(input:{contentBase64:unknown;fileName:string;expected:'PDF'|'DOCX'}):Buffer{
  if(productionRuntime)throw new Error('Uploads Base64 são desativados em produção. Use o envio direto ao armazenamento privado.');
  const encoded=String(input.contentBase64||'').replace(/^data:[^;]+;base64,/,'').replace(/\s/g,'');
  if(!encoded||!/^[A-Za-z0-9+/=]+$/.test(encoded))throw new Error('Conteúdo do arquivo inválido.');
  const bytes=Buffer.from(encoded,'base64');
  if(!bytes.length||bytes.length>2*1024*1024)throw new Error('O fallback de desenvolvimento aceita somente arquivos de até 2 MB.');
  if(input.expected==='PDF'&&!bytes.subarray(0,5).equals(Buffer.from('%PDF-')))throw new Error('O arquivo enviado não possui a estrutura de um PDF válido.');
  if(input.expected==='DOCX'&&!bytes.subarray(0,2).equals(Buffer.from('PK')))throw new Error('O arquivo enviado não possui a estrutura de um DOCX válido.');
  return bytes;
}

function upsertAuthorizedAccess(input:{nome:string;email:string;processId?:string;role:ProcessRole;origin:'MASTER_LIST'|'TCC_FORM';actor:string;active?:boolean}):AuthorizedStudent{
  const email=normalizeEmail(input.email);const now=new Date().toISOString();
  const index=authorizedStudentsStore.findIndex(entry=>normalizeEmail(entry.email)===email);
  const accessType=input.role;
  if(input.origin==='MASTER_LIST') { for(const process of processesStore)removedAccessProcessKeys.delete(accessProcessKey(email,process.id)); }
  if(index>=0){
    const current=authorizedStudentsStore[index];
    const shouldRemainRevoked=Boolean(current.manualRevocation&&input.active===undefined);
    const updated:AuthorizedStudent={...current,nome:input.nome||current.nome,active:shouldRemainRevoked?false:(input.active??(input.processId?true:current.active)),processIds:Array.from(new Set([...current.processIds,...(input.processId?[input.processId]:[])])),roles:Array.from(new Set([...(current.roles||[current.accessType||'STUDENT']),input.role])) as ProcessRole[],accessType:current.accessType||accessType,origin:current.origin==='MASTER_LIST'?'MASTER_LIST':input.origin,updatedAt:now};
    authorizedStudentsStore[index]=updated;return updated;
  }
  const entry:AuthorizedStudent={id:`access-${Date.now()}-${Math.random().toString(36).slice(2,8)}`,nome:input.nome,email,active:input.active??true,processIds:input.processId?[input.processId]:[],createdAt:now,createdBy:input.actor,updatedAt:now,accessType,origin:input.origin,roles:[input.role]};
  authorizedStudentsStore.push(entry);return entry;
}

function reconcileAuthorizationListFromProcesses():void{
  const reconcileAccess=(input:Parameters<typeof upsertAuthorizedAccess>[0])=>{if(!removedAccessProcessKeys.has(accessProcessKey(input.email,input.processId!)))upsertAuthorizedAccess(input);};
  for(const process of processesStore){
    reconcileAccess({nome:process.aluno1.nome,email:process.aluno1.email,processId:process.id,role:'STUDENT',origin:'TCC_FORM',actor:process.createdByEmail});
    if(process.aluno2)reconcileAccess({nome:process.aluno2.nome,email:process.aluno2.email,processId:process.id,role:'STUDENT',origin:'TCC_FORM',actor:process.createdByEmail});
    reconcileAccess({nome:process.orientador.nome,email:process.orientador.email,processId:process.id,role:'ADVISOR',origin:'TCC_FORM',actor:process.createdByEmail});
    if(process.coorientador)reconcileAccess({nome:process.coorientador.nome,email:process.coorientador.email,processId:process.id,role:'CO_ADVISOR',origin:'TCC_FORM',actor:process.createdByEmail});
    for(const examiner of process.banca)reconcileAccess({nome:examiner.nome,email:examiner.email,processId:process.id,role:normalizeEmail(examiner.email)===normalizeEmail(process.orientador.email)?'ADVISOR':'EXAMINER',origin:'TCC_FORM',actor:process.createdByEmail});
  }
}
reconcileAuthorizationListFromProcesses();

function synchronizeProcessParticipants(process:ProcessData,actor:string):void{
  const participants=new Map<string,{nome:string;roles:Set<ProcessRole>}>();
  const add=(nome:string,email:string,role:ProcessRole)=>{const key=normalizeEmail(email);const current=participants.get(key)||{nome,roles:new Set<ProcessRole>()};current.nome=nome||current.nome;current.roles.add(role);participants.set(key,current);};
  add(process.aluno1.nome,process.aluno1.email,'STUDENT');if(process.aluno2)add(process.aluno2.nome,process.aluno2.email,'STUDENT');add(process.orientador.nome,process.orientador.email,'ADVISOR');if(process.coorientador)add(process.coorientador.nome,process.coorientador.email,'CO_ADVISOR');for(const examiner of process.banca)add(examiner.nome,examiner.email,normalizeEmail(examiner.email)===normalizeEmail(process.orientador.email)?'ADVISOR':'EXAMINER');
  for(const entry of authorizedStudentsStore){if(entry.processIds.includes(process.id)&&!participants.has(normalizeEmail(entry.email))){entry.processIds=entry.processIds.filter(id=>id!==process.id);if(entry.origin==='TCC_FORM'&&!entry.processIds.length)entry.active=false;entry.updatedAt=new Date().toISOString();}}
  membershipsStore=membershipsStore.filter(membership=>membership.processId!==process.id);
  let index=0;for(const[email,participant]of participants){const roles=Array.from(participant.roles);for(const role of roles)if(!removedAccessProcessKeys.has(accessProcessKey(email,process.id)))upsertAuthorizedAccess({nome:participant.nome,email,processId:process.id,role,origin:'TCC_FORM',actor});membershipsStore.push({id:`mem-${process.id}-${index++}`,processId:process.id,email,roles,active:true,createdAt:process.createdAt,updatedAt:new Date().toISOString()});}
}

let remotePersistenceQueue: Promise<void> = Promise.resolve();
let localPortalChangeSequence = 0;

async function saveRemoteSnapshotWithRecovery(snapshot:PersistedPortalState):Promise<void>{
  try{await savePortalRuntimeState(snapshot);}catch(error){
    if(error instanceof Error&&error.message.includes('Conflito de concorrência')){
      const remote=await loadPortalRuntimeState<PersistedPortalState>().catch(()=>null);
      if(remote)applyPersistedState(remote);
    }
    throw error;
  }
}

function snapshotPortalState() {
  const signatureMetadata=signatureJobsStore.map(({artifactBase64:_artifact,...job})=>job);
  const formMetadata=formArchiveJobsStore.map(({artifactBase64:_artifact,...job})=>({...job,artifactBase64:''}));
  const authorizedStudents = authorizedStudentsStore.map(entry => {
    const identifiers = historicalAccessIdentifiers.get(accessHistoryKey(entry));
    return identifiers ? {...entry, ...identifiers} : entry;
  });
  return { processProtocolCounters:processProtocolCountersStore, legacyAcademicRecords:legacyAcademicRecordsStore, processDeletionTasks:processDeletionTasksStore, registrationDrafts:registrationDraftsStore, evaluationDrafts:Object.fromEntries(evaluationDraftsStore), reminders:reminderRecordsStore, settings: currentSettings, processes: processesStore.map(processForPersistence), memberships: membershipsStore, correctionRequests: correctionRequestsStore, signatureJobs: signatureMetadata, astenCallbackFingerprints: Array.from(astenCallbackFingerprints).slice(-5000), revokedSessionIds:Array.from(revokedSessionIdsStore).slice(-10000), authorizedStudents, removedAccessProcessKeys:Array.from(removedAccessProcessKeys), formArchiveJobs:formMetadata, studioFormSubmissions:studioFormSubmissionsStore.slice(-10000),emailDeliveries:emailDeliveriesStore.slice(-10000),workflowRuns:workflowRunsStore.slice(-10000),astenWebhookEvents:astenWebhookEventsStore.slice(-10000),administrationTransfers:administrationTransfersStore.slice(-1000),tablePreferences:tablePreferencesStore,notificationPreferences:notificationPreferencesStore,dataSubjectRequests:dataSubjectRequestsStore.slice(-5000),legalHolds:legalHoldsStore.slice(-5000),studioVersions:retainStudioVersions(studioVersionsStore),continuousIntelligence:continuousIntelligenceStore,auditLogs: auditLogsStore.slice(-5000) };
}

function persistPortalState(throwOnFailure = false): void {
  const snapshot = snapshotPortalState();
  if (getSupabaseRuntimeStatus().durablePersistenceReady) {
    remotePersistenceQueue = remotePersistenceQueue.catch(() => undefined).then(() => saveRemoteSnapshotWithRecovery(snapshot));
    return;
  }
  try {
    mkdirSync(portalDataDirectory, { recursive: true });
    const temporaryFile = `${portalStateFile}.tmp`;
    writeFileSync(temporaryFile, JSON.stringify(snapshot, null, 2), 'utf8');
    renameSync(temporaryFile, portalStateFile);
    localPortalChangeSequence += 1;
  } catch (error) {
    console.error('[Persistence] Falha ao persistir as configurações do portal:', error);
    if (throwOnFailure) throw error;
  }
}

async function persistPortalStateDurably():Promise<void>{
  if(!getSupabaseRuntimeStatus().durablePersistenceReady){persistPortalState(true);return;}
  const snapshot=snapshotPortalState();
  remotePersistenceQueue=remotePersistenceQueue.catch(()=>undefined).then(()=>saveRemoteSnapshotWithRecovery(snapshot));
  await remotePersistenceQueue;
}

function applyPersistedState(state: PersistedPortalState) {
  legacyAcademicRecordsStore=(state.legacyAcademicRecords||[]).map(canonicalLegacyRecord);
  registrationDraftsStore=pruneDrafts(state.registrationDrafts||{});
  evaluationDraftsStore=new Map(Object.entries(state.evaluationDrafts||{}));
  reminderRecordsStore=state.reminders||[];
  if(state.processDeletionTasks)processDeletionTasksStore=state.processDeletionTasks;
  if (state.settings) { currentSettings = { ...INITIAL_SETTINGS, ...state.settings };if(currentSettings.integrationStudio)currentSettings.integrationStudio=consolidateProcessForms(currentSettings.integrationStudio); delete (currentSettings as any).recoverySecretKey;delete (currentSettings as any).courseCoordinatorEmail;delete (currentSettings as any).courseCoordinatorName;for(const model of Object.values(currentSettings.documentModels||{}))if(model)model.templateContentText=''; }
  if (state.processes) { processesStore = hydrateProcesses(state.processes); reconcileRecordedReservationStatuses(); }
  processProtocolCountersStore=seedProcessProtocolCounters(state.processProtocolCounters,[...processesStore.map(process=>process.protocolo),...(state.processProtocolCounters===undefined?processDeletionTasksStore.map(task=>task.protocol):[])]);
  if (state.memberships) membershipsStore = state.memberships;
  if (state.auditLogs) auditLogsStore = state.auditLogs;
  if (state.correctionRequests) correctionRequestsStore = state.correctionRequests;
  if (state.signatureJobs) signatureJobsStore = state.signatureJobs.filter((job) => job.documentType !== ('FOLHA_APROVACAO' as any));
  if (state.astenCallbackFingerprints) astenCallbackFingerprints = new Set(state.astenCallbackFingerprints);
  if (state.revokedSessionIds) revokedSessionIdsStore = new Set(state.revokedSessionIds);
  if (state.authorizedStudents) authorizedStudentsStore = hydrateAuthorizedStudents(state.authorizedStudents);
  removedAccessProcessKeys=new Set(state.removedAccessProcessKeys||[]);
  if (state.formArchiveJobs) formArchiveJobsStore = state.formArchiveJobs;
  if (state.emailDeliveries) emailDeliveriesStore = state.emailDeliveries;
  if (state.workflowRuns) workflowRunsStore = state.workflowRuns;
  if (state.astenWebhookEvents) astenWebhookEventsStore = state.astenWebhookEvents;
  if (state.administrationTransfers) administrationTransfersStore = state.administrationTransfers;
  if (state.tablePreferences) tablePreferencesStore = state.tablePreferences;
  if (state.notificationPreferences) notificationPreferencesStore = state.notificationPreferences;
  if (state.dataSubjectRequests) dataSubjectRequestsStore = state.dataSubjectRequests;
  if (state.legalHolds) legalHoldsStore = state.legalHolds;
  if (state.studioVersions) studioVersionsStore = retainStudioVersions(state.studioVersions);
  if (state.studioFormSubmissions) studioFormSubmissionsStore = state.studioFormSubmissions;
  if (state.continuousIntelligence) continuousIntelligenceStore = state.continuousIntelligence;
  googleCalendarEventsStore = generateGoogleEventsFromProcesses(processesStore);
  publishRuntimeTemplatesFromSettings();
}

function publishRuntimeTemplatesFromSettings() {
  // Os modelos pertencem ao Drive do Master. O portal mantém somente metadados
  // e nunca persiste uma cópia textual ou binária do conteúdo do modelo.
  updateRuntimeDocumentTemplates([]);
}

function recordStudioVersion(studio:GlobalSettings['integrationStudio'],actorEmail:string) {
  if(!studio||studioVersionsStore.some(item=>item.revision===studio.revision))return;
  const snapshot=structuredClone(studio);
  for(const template of snapshot.docTemplates||[])template.templateContentText='';
  studioVersionsStore=retainStudioVersions([...studioVersionsStore,{
    id:`studio-version-${studio.revision}`,revision:studio.revision,createdAt:studio.savedAt||new Date().toISOString(),
    createdBy:studio.savedBy||actorEmail,validationScore:validateCourseStudio(snapshot).score,
    checksum:createHash('sha256').update(JSON.stringify(snapshot)).digest('hex'),snapshot
  }]);
}

function decodeXmlEntities(value:string):string{return value.replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&apos;/g,"'");}
export async function extractDocxTemplateText(buffer:Buffer):Promise<{text:string;variables:string[]}>{
  const zip=await JSZip.loadAsync(buffer);const names=Object.keys(zip.files).filter(name=>/^word\/(document|header\d*|footer\d*)\.xml$/.test(name));
  if(!names.includes('word/document.xml'))throw new Error('DOCX inválido: o documento principal não foi encontrado.');
  const pieces:string[]=[];
  for(const name of names){const xml=await zip.file(name)!.async('string');const text=decodeXmlEntities(xml.replace(/<w:tab\/?\s*>/g,'\t').replace(/<\/w:p>/g,'\n').replace(/<\/w:tr>/g,'\n').replace(/<[^<>]+>/g,''));if(text.trim())pieces.push(text.trim());}
  const text=pieces.join('\n\n').replace(/\n{3,}/g,'\n\n').trim();if(!text)throw new Error('O modelo DOCX não contém texto utilizável.');
  const variables=Array.from(new Set(text.match(/<<[^<>]{2,100}>>|\{\{[^{}]{2,100}\}\}|-[A-Z][A-Z0-9_]{2,80}-/g)||[]));
  return {text,variables};
}

// Helper to sync Google Calendar Store from Processes Store
function generateGoogleEventsFromProcesses(procs: ProcessData[]): GoogleCalendarSyncedEvent[] {
  return procs
    .filter(p => p.defesa && p.defesa.startAt && p.defesa.localStatus === 'CONFIRMADO' && !isDefenseReservationDeclined(p))
    .map(p => {
      const studentName = formatStudentsString(p.aluno1, p.aluno2);
      const coorientadorPart = p.coorientador ? `\nCoorientador: ${p.coorientador.nome}` : '';
      const bancaPart = p.banca && p.banca.length > 0 ? `\nBanca: ${p.banca.map(b => b.nome).join(', ')}` : '';
      return {
        id: `gcal-${p.id}`,
        portalTccProtocol: p.protocolo,
        summary: `Defesa de TCC - Apresentação: ${studentName}`,
        description: `Trabalho: ${p.titulo}\nOrientador: ${p.orientador?.nome || 'Não definido'}${coorientadorPart}${bancaPart}\nProtocolo: ${p.protocolo}`,
        location: p.defesa.local || resolveInstallationProfile(currentSettings).defaultDefenseLocation,
        start: p.defesa.startAt,
        end: defenseEndAt(p.defesa.startAt),
        syncedAt: new Date().toISOString()
      };
    });
}

// Cache of Google Calendar synced events from the Master Account
let googleCalendarEventsStore: GoogleCalendarSyncedEvent[] = generateGoogleEventsFromProcesses(processesStore);


// Helper to calculate user roles for an email
function getUserRolesForEmail(email: string) {
  const norm = normalizeEmail(email);
  const globalRoles: GlobalRole[] = [];

  const masterEmails = [
    normalizeEmail(currentSettings.masterEmail),
    normalizeEmail(currentSettings.ownerEmail || '')
  ].filter(Boolean);

  const presidentEmail = normalizeEmail(currentSettings.commissionPresidentEmail || '');

  if (masterEmails.includes(norm)) globalRoles.push('MASTER_ADMIN');
  if (presidentEmail && presidentEmail === norm) globalRoles.push('COMMISSION_PRESIDENT');

  const memberships = membershipsStore.filter(
    (m) => m.active && normalizeEmail(m.email) === norm
  ).map(membership => {
    if (!membership.roles.includes('ADVISOR')) return membership;
    const process = processesStore.find(item => item.id === membership.processId);
    const isAdvisor = Boolean(process && normalizeEmail(process.orientador.email) === norm);
    return isAdvisor ? membership : { ...membership, roles: membership.roles.filter(role => role !== 'ADVISOR') };
  }).filter(membership => membership.roles.length > 0);

  return { globalRoles, memberships };
}

// Generate default simulated documents for a process using official base model templates
function generateDefaultDocuments(process: ProcessData, audience: 'public' | 'participants' = 'public'): ProcessDocument[] {
  const isEvaluated = process.avaliacao.status === 'CONCLUIDO';
  const locationConfirmed = process.defesa.localStatus === 'CONFIRMADO';
  const invitationReady=locationConfirmed&&Boolean(process.defesa.invitationDriveFileId)&&(audience==='participants'||Boolean(process.defesa.invitationSentAt));
  const repositoryReady = repositoryDataComplete(process);
  const needsPublicationTerm = publicationRequested(process) && Boolean(process.acervo?.authorizationConfirmedAt);
  const configuredModels=currentSettings.documentModels||{};
  const ataReady=Boolean(process.avaliacao.reviewedAta||configuredModels.ATA);

  const rawDocs: ProcessDocument[] = [
    {
      id: 'doc-convite',
      type: 'CONVITE',
      title: `${administrativeDocumentLabels.CONVITE.title} - ${process.titulo}`,
      status: invitationReady ? 'DISPONIVEL' : 'NAO_DISPONIVEL',
      visibleToRoles: ['STUDENT', 'ADVISOR', 'CO_ADVISOR', 'EXAMINER'],
      requiresSignature: false,
      currentVersion: 1,
      createdAt: process.createdAt,
      updatedAt: process.updatedAt,
      driveFileId:process.defesa.invitationDriveFileId,
      driveDownloadUrl:invitationReady?`/api/processes/${process.id}/documents/doc-convite/download`:undefined,
      versions: invitationReady ? [
        {
          id: 'v1',
          version: 1,
          sourceDataRevision: process.dataRevision,
          generatedAt: process.createdAt,
          generatedBy: process.createdByEmail,
          isCurrent: true,
          contentPreviewText: documentPreviewSummary('CONVITE', process)
        }
      ] : []
    },
    {
      id: 'doc-ata',
      type: 'ATA',
      title: `${administrativeDocumentLabels.ATA.title} - ${process.titulo}`,
      status: isEvaluated && ataReady ? 'AGUARDANDO_ASSINATURA' : 'NAO_DISPONIVEL',
      visibleToRoles: ['STUDENT', 'ADVISOR', 'CO_ADVISOR', 'EXAMINER'],
      requiresSignature: true,
      currentVersion: 1,
      createdAt: process.createdAt,
      updatedAt: process.updatedAt,
      versions: isEvaluated && ataReady ? [
        {
          id: 'v1',
          version: 1,
          sourceDataRevision: signatureDocumentRevision(process, 'ATA'),
          generatedAt: process.avaliacao.submittedAt || process.updatedAt,
          generatedBy: process.avaliacao.submittedBy || process.orientador.email,
          isCurrent: true,
          contentPreviewText: documentPreviewSummary('ATA', process)
        }
      ] : []
    },
    {
      id: 'doc-termo',
      type: 'TERMO',
      title: `${administrativeDocumentLabels.TERMO.title} - ${process.titulo}`,
      status: isEvaluated && repositoryReady && needsPublicationTerm && Boolean(configuredModels.TERMO) ? 'AGUARDANDO_ASSINATURA' : 'NAO_DISPONIVEL',
      visibleToRoles: ['STUDENT', 'ADVISOR'],
      requiresSignature: true,
      currentVersion: 1,
      createdAt: process.createdAt,
      updatedAt: process.updatedAt,
      versions: isEvaluated && repositoryReady && needsPublicationTerm && configuredModels.TERMO ? [
        {
          id: 'v1',
          version: 1,
          sourceDataRevision: process.dataRevision,
          generatedAt: process.avaliacao.submittedAt || process.updatedAt,
          generatedBy: process.aluno1.email,
          isCurrent: true,
          contentPreviewText: documentPreviewSummary('TERMO', process)
        }
      ] : []
    },
    {
      id: 'doc-declaracao',
      type: 'DECLARACAO',
      title: `${administrativeDocumentLabels.DECLARACAO.title} - ${process.titulo}`,
      status: isEvaluated && repositoryReady && declarationReady(process,signatureJobsStore) && Boolean(configuredModels.DECLARACAO) ? 'AGUARDANDO_ASSINATURA' : 'NAO_DISPONIVEL',
      visibleToRoles: ['STUDENT', 'ADVISOR', 'CO_ADVISOR', 'EXAMINER'],
      requiresSignature: true,
      currentVersion: 1,
      createdAt: process.createdAt,
      updatedAt: process.updatedAt,
      versions: isEvaluated && repositoryReady && declarationReady(process,signatureJobsStore) && configuredModels.DECLARACAO ? [
        {
          id: 'v1',
          version: 1,
          sourceDataRevision: process.dataRevision,
          generatedAt: process.avaliacao.submittedAt || process.updatedAt,
          generatedBy: process.orientador.email,
          isCurrent: true,
          contentPreviewText: documentPreviewSummary('DECLARACAO', process)
        }
      ] : []
    }
  ];

  const applicableDocs=rawDocs;
  const latestJobs=new Map<string,SignatureJob>();
  for(const type of ['ATA','TERMO','DECLARACAO']){const job=latestSignature(process,signatureJobsStore,type);if(job)latestJobs.set(type,job);}
  const withSignatureState=applicableDocs.map(doc=>{
    const job=latestJobs.get(doc.type);
    if(!job||(doc.type!=='ATA'&&!signatureJobMatchesCurrentRevision(process,job)))return doc;
    const archived=job.status==='ARCHIVED'&&Boolean(job.driveSignedFileId)&&(doc.type!=='ATA'||ataArchived(process,[job]));
    const status=archived?'ASSINADO':job.status==='PROVIDER_ERROR'||job.status==='DECLINED'||job.status==='EXPIRED'?'COM_ERRO':'AGUARDANDO_ASSINATURA';
    return{...doc,status:status as ProcessDocument['status'],currentVersion:job.documentVersion,updatedAt:job.updatedAt,...(archived?{signatureProvider:job.provider}:{}),driveFileId:archived?job.driveSignedFileId:undefined,driveDownloadUrl:archived?`/api/processes/${process.id}/documents/${doc.id}/download`:undefined};
  });
  return enrichProcessDocumentsWithDrive(withSignatureState, process);
}

function redactSensitiveValues<T>(input:T):T{if(Array.isArray(input))return input.map(redactSensitiveValues) as T;if(!input||typeof input!=='object')return input;const output:Record<string,unknown>={};for(const[key,value]of Object.entries(input as Record<string,unknown>)){if(/(secret|token|password|credential|api[_-]?key)/i.test(key))continue;output[key]=redactSensitiveValues(value);}return output as T;}
function containsSensitiveConfigurationKey(input: unknown): boolean { if (!input || typeof input !== 'object') return false; if (Array.isArray(input)) return input.some(containsSensitiveConfigurationKey); return Object.entries(input as Record<string, unknown>).some(([key, value]) => /(secret|token|password|credential|api[_-]?key|service[_-]?role|private[_-]?key)/i.test(key) || containsSensitiveConfigurationKey(value)); }
if(currentSettings.integrationStudio)currentSettings.integrationStudio=consolidateProcessForms(currentSettings.integrationStudio);

function publicSettingsForRequest(admin: boolean): GlobalSettings {
  const visible = {...currentSettings};
  delete (visible as any).courseCoordinatorEmail;
  delete (visible as any).courseCoordinatorName;
  if (!visible.contactEmail && visible.masterEmail) visible.contactEmail = visible.masterEmail;
  if (!visible.portalMaintainerName && visible.ownerName) visible.portalMaintainerName = visible.ownerName;
  if (!admin) {
    delete visible.masterRecoveryEmails;
    delete visible.documentModels;
    delete visible.templateIds;
    delete visible.emailConfig;
    delete visible.integrationStudio;
    delete visible.integrationStudioDraft;
    delete visible.masterEmail;
    delete visible.ownerEmail;
    delete visible.commissionPresidentEmail;
    delete visible.driveRootFolderId;
  }
  return redactSensitiveValues(JSON.parse(JSON.stringify(visible))) as GlobalSettings;
}
function preserveCurrentDriveBindings(snapshot:any,current?:ProcessData):ProcessData{
  const restored=JSON.parse(JSON.stringify(snapshot||{}));
  restored.driveFolderId=current?.driveFolderId;restored.driveFolderUrl=current?.driveFolderUrl;restored.driveSyncedAt=current?.driveSyncedAt;
  restored.defesa={...(restored.defesa||{}),invitationDriveFileId:current?.defesa?.invitationDriveFileId,locationProof:current?.defesa?.locationProof||restored.defesa?.locationProof};
  const source=current?.acervo||{};const target=restored.acervo||{};
  for(const key of ['trabalhoCompletoFileId','trabalhoCompletoFileName','trabalhoCompletoFileUrl','trabalhoCompletoSha256','trabalhoCompletoVersion','resumoExpandidoFileId','resumoExpandidoFileName','resumoExpandidoFileUrl','resumoExpandidoSha256','resumoExpandidoVersion'] as const){if((source as any)[key]!==undefined)(target as any)[key]=(source as any)[key];else delete (target as any)[key];}
  restored.acervo=target;return cleanProcessIdentifiers(restored as ProcessData);
}
function canAccessProcess(email:string,id:string):boolean{
  const r=getUserRolesForEmail(email);
  if(r.globalRoles.includes('MASTER_ADMIN'))return true;
  // Re-enrollment elsewhere must not revive historical memberships removed by an administrator.
  if(removedAccessProcessKeys.has(accessProcessKey(email,id)))return false;
  const authorized=authorizedStudentsStore.some(entry=>entry.active&&normalizeEmail(entry.email)===normalizeEmail(email));
  return authorized&&r.memberships.some(m=>m.processId===id&&m.active);
}
function hasFullAdministration(email:string):boolean{return getUserRolesForEmail(email).globalRoles.includes('MASTER_ADMIN');}
function isInPresidencyDeclarationQueue(process:ProcessData):boolean{
  if(process.status==='EM_RASCUNHO')return false;
  if(process.status==='CONCLUIDO')return true;
  return repositoryDataComplete(process)&&declarationReady(process,signatureJobsStore);
}
function canAccessPresidencyDeclaration(email:string,process:ProcessData):boolean{
  return getUserRolesForEmail(email).globalRoles.includes('COMMISSION_PRESIDENT')&&isInPresidencyDeclarationQueue(process);
}
function canAccessSignatureDocument(email:string,process:ProcessData,type:string):boolean{
  return canAccessProcess(email,process.id)||(type==='DECLARACAO'&&canAccessPresidencyDeclaration(email,process));
}
function getActiveProcessRoles(email:string,processId:string):ProcessRole[]{return getUserRolesForEmail(email).memberships.filter(m=>m.processId===processId&&m.active).flatMap(m=>m.roles);}
function isReservationAuthor(email:string,process:ProcessData):boolean{
  const authorEmails=[process.aluno1.email,process.aluno2?.email].filter(Boolean).map(value=>normalizeEmail(String(value)));
  return authorEmails.includes(normalizeEmail(email))&&getActiveProcessRoles(email,process.id).includes('STUDENT');
}
function canAdministerSignatureJob(email:string,job:SignatureJob):boolean{
  if(hasFullAdministration(email))return true;
  const process=job.documentType==='DECLARACAO'&&processesStore.find(item=>item.id===job.processId);
  return Boolean(process&&canAccessPresidencyDeclaration(email,process));
}
function canUseStudioForm(email:string,processId:string,form:FormRecipientSelection):boolean{
  return canUseFormRecipientSelection(form,getActiveProcessRoles(email,processId),getUserRolesForEmail(email).globalRoles);
}
function studioFormIsReleased(email:string,processId:string,formId:string):boolean{
  if (NATIVE_PROCESS_FORM_IDS.has(formId)) return false;
  if(hasFullAdministration(email))return true;
  if(studioFormSubmissionsStore.some(item=>item.processId===processId&&item.formId===formId&&item.submittedBy===normalizeEmail(email)))return true;
  const taskId=`form_task_${formId}`;
  return workflowRunsStore.some(run=>run.processId===processId&&run.actions.some(action=>action.kind==='FORM'&&action.status==='COMPLETED'&&action.externalId===taskId));
}
function canInitiateSignature(email:string,process:ProcessData,type:'ATA'|'TERMO'|'DECLARACAO'):boolean{
  return registeredSignaturePermission(email,process,type,currentSettings,getUserRolesForEmail(email).globalRoles);
}
function isValidPortalEmail(value:unknown):boolean{
  const email=normalizeEmail(String(value||''));
  return email.length<=254&&!/[\r\n\u0000-\u001f\u007f]/.test(email)&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
function validateDistinctProcessParticipants(input:{aluno1:any;aluno2?:any;orientador:any;coorientador?:any;banca:any[]}):string|null{
  const rawParticipants=[input.aluno1?.email,input.aluno2?.email,input.orientador?.email,input.coorientador?.email,...(Array.isArray(input.banca)?input.banca.map(member=>member?.email):[])].filter(Boolean);
  if(rawParticipants.some(email=>!isValidPortalEmail(email)))return'Todos os participantes precisam ter um e-mail válido.';
  const students=[input.aluno1?.email,input.aluno2?.email].filter(Boolean).map(value=>normalizeEmail(String(value)));
  if(new Set(students).size!==students.length)return'Os alunos autores precisam ter e-mails diferentes.';
  const evaluators=[input.orientador?.email,input.coorientador?.email,...(Array.isArray(input.banca)?input.banca.map(member=>member?.email):[])].filter(Boolean).map(value=>normalizeEmail(String(value)));
  if(evaluators.some(email=>students.includes(email)))return'Um aluno autor não pode ser cadastrado como orientador, coorientador ou membro examinador do próprio TCC.';
  if(new Set(evaluators).size!==evaluators.length)return'Orientador, coorientador e membros da banca precisam usar e-mails distintos.';
  return null;
}
function canRequestPortalAccess(email:string):boolean{
  const normalized=normalizeEmail(email);
  if(!normalized)return false;
  if(getUserRolesForEmail(normalized).globalRoles.length>0)return true;
  if(administrationTransfersStore.some(transfer=>transfer.status==='PENDING_TARGET_ACCEPTANCE'&&new Date(transfer.expiresAt).getTime()>Date.now()&&transfer.targetEmail===normalized&&hasFullAdministration(transfer.requestedBy)))return true;
  return authorizedStudentsStore.some(entry=>entry.active&&normalizeEmail(entry.email)===normalized);
}
function canRegisterProcess(email:string):boolean{
  if(hasFullAdministration(email))return true;
  const normalized=normalizeEmail(email);
  return authorizedStudentsStore.some(entry=>entry.active&&normalizeEmail(entry.email)===normalized&&
    (entry.roles?.length ? entry.roles.includes('STUDENT') : (entry.accessType||'STUDENT')==='STUDENT'));
}
function requireFeature(key:PortalFeatureKey){return (_req:express.Request,res:express.Response,next:express.NextFunction)=>isPortalFeatureEnabled(currentSettings,key)?next():res.status(404).json({error:'Recurso não habilitado nesta instalação.'});}
function currentAcademicCycle():AcademicCycle|undefined{return(currentSettings.academicCycles||[]).find(cycle=>cycle.active&&cycle.status==='OPEN');}
function validateAcademicWindow(defenseAt?:string):string|null{
  if(!isPortalFeatureEnabled(currentSettings,'ACADEMIC_CYCLES'))return null;
  const cycle=currentAcademicCycle();if(!cycle)return null;
  const now=Date.now(),open=Date.parse(cycle.submissionOpenAt),close=Date.parse(cycle.submissionCloseAt);
  if(Number.isFinite(open)&&now<open)return`As inscrições do período ${cycle.label} ainda não começaram.`;
  if(Number.isFinite(close)&&now>close)return`As inscrições do período ${cycle.label} estão encerradas.`;
  if(defenseAt){const defense=Date.parse(defenseAt),start=Date.parse(cycle.defenseStartAt),end=Date.parse(cycle.defenseEndAt);if((Number.isFinite(start)&&defense<start)||(Number.isFinite(end)&&defense>end))return`A defesa precisa ocorrer dentro da janela do período ${cycle.label}.`;}
  return null;
}
function findProcessByReference(reference:string):ProcessData|undefined{
  return processesStore.find(process=>process.id===reference)||processesStore.find(process=>process.protocolo===reference)||processesStore.find(process=>process.previousProtocols?.includes(reference));
}
function participantEmails(process:ProcessData):string[]{return Array.from(new Set([process.aluno1.email,process.aluno2?.email,process.orientador.email,process.coorientador?.email,...process.banca.map(member=>member.email)].filter(Boolean).map(value=>normalizeEmail(String(value)))));}
function normalizeLocation(value:string):string{return value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();}
function findDefenseConflicts(input:{startAt:string;endAt:string;local:string;alternateLocation?:string;emails:string[];excludeProcessId?:string}){
  return inspectDefenseConflicts(processesStore,input,isPortalFeatureEnabled(currentSettings,'DEFENSE_CONFLICTS'));
}

function visibleDefenseConflicts(email:string, conflicts:ReturnType<typeof findDefenseConflicts>){
  const visible=conflicts.filter(conflict=>canAccessProcess(email,conflict.processId));
  return visible.length===conflicts.length?visible:[...visible,{restricted:true}];
}

function missingDocumentModels(types:Array<'CONVITE'|'ATA'|'TERMO'|'DECLARACAO'>):string[]{return types.filter(type=>!currentSettings.documentModels?.[type]?.driveFileId);}
function publicSignatureJob(job:SignatureJob):SignatureJob{
  const {artifactBase64:_artifact,renderVariables:_variables,providerEnvelopeHash:_envelopeHash,removedFromLogsBy:_removedBy,...safe}=job;
  return safe;
}
function visibleProcessSignatureEvidence(job:SignatureJob):boolean{
  return !job.removedFromLogsAt || (job.status==='ARCHIVED' && Boolean(job.driveSignedFileId));
}
function escapeHtml(v:string){return v.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]||c));}
function documentPreviewSummary(type:'CONVITE'|'ATA'|'TERMO'|'DECLARACAO',p:ProcessData):string{return `${type} • ${p.protocolo} • ${formatStudentsString(p.aluno1,p.aluno2)} • ${p.titulo}. A aparência final é preservada a partir do modelo ativo no Google Drive do Master.`;}
function publicPortalBaseUrl():string{const explicit=String(process.env.PORTAL_PUBLIC_URL||process.env.APP_URL||'').trim();if(explicit)return explicit.replace(/\/$/,'');const vercel=String(process.env.VERCEL_PROJECT_PRODUCTION_URL||'').trim();return vercel?`https://${vercel.replace(/^https?:\/\//,'').replace(/\/$/,'')}`:'';}
function buildDocumentVerificationCode(p:ProcessData,type:'ATA'|'TERMO'|'DECLARACAO',documentVersion=1):string{const secret=String(process.env.PORTAL_VERIFICATION_SECRET||process.env.PORTAL_SESSION_SECRET||(productionRuntime?'':'portal-tcc-development-verification-secret')).trim();return documentVerificationCode({secret,installationId:resolveInstallationProfile(currentSettings).installationId,processId:p.id,documentType:type,dataRevision:p.dataRevision,documentVersion});}
function evaluationPreviewBinding(p:ProcessData,actor:string,evaluation:ReturnType<typeof acceptEvaluation>,provider:string){return {processId:p.id,dataRevision:p.dataRevision,schemaRevision:currentSettings.integrationStudio?.revision||0,modelFingerprint:ataModelFingerprint(currentSettings.documentModels?.ATA),actor:normalizeEmail(actor),provider,ataSignerPolicy:'BOARD_AUTHORS_V1',signaturePolicyDigest:captureSignaturePolicySnapshot({...p,avaliacao:{...p.avaliacao,...evaluation}},'ATA',currentSettings).digest,coadvisorPresent:evaluation.coadvisorPresent,result: evaluation.resultadoCode,answers:evaluation.answers,parecer:evaluation.parecer,documentText:evaluation.documentText};}
function evaluationPreviewSecret(){return String(process.env.PORTAL_SESSION_SECRET||(productionRuntime?'':'local-evaluation-preview-secret'));}
function buildOfficialTemplateReplacements(p:ProcessData,verificationCode?:string,extraVariables?:Record<string,unknown>,documentType?:string):Record<string,string>{
  const students=authorNames(p);const banca=(p.banca||[]).map(item=>`${academicName(item)}${item.instituicao?` (${item.instituicao})`:''}`).join(', ');const date=p.defesa?.startAt?formatDateExtensoWithWeekday(p.defesa.startAt):'';const time=p.defesa?.startAt?formatTimeExtenso(p.defesa.startAt):'';const dateTime=[date,time&&`às ${time}`].filter(Boolean).join(' ');const local=p.defesa?.local||'';const result=p.avaliacao?.resultadoLabel||p.avaliacao?.resultadoCode||'';const replacements:Record<string,string>={
    CAMPO_01:students,CAMPO_02:p.titulo,CAMPO_03:p.orientador.nome,CAMPO_04:dateTime,CAMPO_06:banca,CAMPO_07_LOCAL:local,CAMPO_09:result,CAMPO_10:'',CAMPO_11:p.avaliacao?.parecer||'',CAMPO_12:p.protocolo,CAMPO_13:p.driveFolderUrl||'',CAMPO_COORIENTADOR:p.coorientador?.nome||'',
    ALUNOS_NOMES:students,ALUNO_NOME:p.aluno1.nome,NOME_ALUNO:p.aluno1.nome,ALUNO_2_NOME:p.aluno2?.nome||'',ALUNO_MATRICULA:'',ALUNO_EMAIL:p.aluno1.email,EMAIL_ALUNO:p.aluno1.email,TCC_TITULO:p.titulo,TITULO_TRABALHO:p.titulo,ORIENTADOR_NOME:p.orientador.nome,NOME_ORIENTADOR:p.orientador.nome,COORIENTADOR_NOME:p.coorientador?.nome||'',DEFESA_DATA_HORA_EXTENSO:dateTime,DEFESA_DATA:date,DATA_DEFESA:date,DEFESA_HORA:time,DEFESA_LOCAL:local,LOCAL_DEFESA:local,BANCA_NOMES:banca,AVALIACAO_RESULTADO:result,AVALIACAO_NOTA:'',AVALIACAO_PARECER:p.avaliacao?.parecer||'',PROTOCOLO:p.protocolo,DRIVE_PASTA_URL:p.driveFolderUrl||'',PALAVRAS_CHAVE:p.acervo?.palavrasChave?.join('; ')||'',RESUMO_SINTETICO:p.acervo?.resumoSintese||'',PUBLICAR_TRABALHO_COMPLETO:p.acervo?.publishFullWork?'SIM':'NÃO',PUBLICAR_RESUMO_EXPANDIDO:p.acervo?.publishExpandedAbstract?'SIM':'NÃO',VALIDACAO_CODIGO:verificationCode||'',VALIDACAO_URL:verificationCode&&publicPortalBaseUrl()?`${publicPortalBaseUrl()}/validar/${verificationCode}`:'',
    'data do preenchimento':formatDateWithWeekday(new Date().toISOString()),'alunos':students,'titulo do trabalho':p.titulo,'orientador (1)':p.orientador.nome,'examinador (2)':(p.banca||[]).find(item=>item.funcao==='EXAMINER_2')?.nome||(p.banca||[])[0]?.nome||'','examinador (3)':(p.banca||[]).find(item=>item.funcao==='EXAMINER_3')?.nome||(p.banca||[])[1]?.nome||'','data da defesa (extenso total)':date,'hora de inicio da defesa (extenso)':time,'local da defesa':local,'hora de início da defesa (por extenso)':time,'data da defesa (por extenso total)':date,'situação':result,'parecer':p.avaliacao?.parecer||'','data da defesa (por extenso)':formatDateWithWeekday(p.defesa?.startAt||''),'nome completo aluno (1)':p.aluno1.nome,'nome completo aluno (2)':p.aluno2?.nome||'','coorientador':p.coorientador?.nome||'','Coorientador(a) Prof(ª). Dr(ª).':p.coorientador?'Coorientador(a) Prof(ª). Dr(ª).':''
  };
  for(const[rawKey,value]of Object.entries(extraVariables||{})){const normalized=String(rawKey).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9]+/g,'_').replace(/^_+|_+$/g,'').toUpperCase();if(normalized)replacements[normalized]=value===null||value===undefined?'':String(value);}
  if(documentType==='ATA'){
    const closing=ataClosingTime(p.defesa.startAt);
    replacements.ATA_ENCERRAMENTO_DATA_HORA=closing.label;
    replacements['data da defesa (por extenso)']=formatDateWithWeekday(closing.iso);
  }
  Object.assign(replacements,documentVariables(p));
  replacements['nome completo aluno (1)']=replacements.AUTORIA_PRIMEIRO_NOME;replacements['nome completo aluno (2)']=replacements.AUTORIA_SEGUNDO_NOME;
  for(const [key,person] of [['CAMPO_03',p.orientador],['ORIENTADOR_NOME',p.orientador],['NOME_ORIENTADOR',p.orientador],['orientador (1)',p.orientador],['CAMPO_COORIENTADOR',p.coorientador],['COORIENTADOR_NOME',p.coorientador],['coorientador',p.coorientador],['examinador (2)',p.banca.find(m=>m.funcao==='EXAMINER_2')||p.banca[0]],['examinador (3)',p.banca.find(m=>m.funcao==='EXAMINER_3')||p.banca[1]]] as const)replacements[key]=academicName(person,'abbreviated');
  return replacements;
}
async function renderOfficialTemplatePdf(p:ProcessData,type:'CONVITE'|'ATA'|'TERMO'|'DECLARACAO',verificationCode?:string,extraVariables?:Record<string,unknown>,studioOverride=currentSettings.integrationStudio,onDocumentText?:(text:string)=>void,previewSource?:DriveModelFingerprint,onAtaPreview?:(result:Awaited<ReturnType<typeof renderGoogleDriveTemplateToPdf>>)=>void,signatureSignersOverride?:SignatureJob['signers']):Promise<Buffer>{
  if(type==='ATA'&&p.avaliacao.status==='CONCLUIDO'&&p.avaliacao.reviewedAta){
    return exportReviewedAta(await getGoogleWorkspaceAccessToken(),p.avaliacao.reviewedAta.fileId,p.id);
  }
  const published=currentSettings.documentModels?.[type];if(!published?.driveFileId)throw new DocumentModelError('DOCUMENT_MODEL_REQUIRED');
  const model=modelForRendering(published,p.id,previewSource);
  if(p.id!=='model-preview'&&localDocumentModelsEnabled()){const body=adaptDocumentLanguage(p.avaliacao?.documentText||documentPreviewSummary(type,p),p,type);onDocumentText?.(body);return createProfessionalPdf({title:`TESTE ${type}`,protocol:p.protocolo,body});}
  if(!model.contentSha256)throw new DocumentModelError('DOCUMENT_MODEL_UNPUBLISHED');
  const accessToken=await getGoogleWorkspaceAccessToken();const outputName=buildPortalDriveFileName({protocol:p.protocolo,title:p.titulo,studentNames:[p.aluno1.nome,p.aluno2?.nome].filter(Boolean) as string[],documentType:type,version:p.dataRevision,lifecycle:'GERADO'});
  await verifyMasterDocumentModelFingerprint({accessToken,fileId:model.driveFileId,contentSha256:model.contentSha256,driveRevisionId:model.driveRevisionId,driveModifiedTime:model.driveModifiedTime});
  const artifactId=String(studioOverride?.docTemplates.find(item=>String(item.type).toUpperCase()===type)?.id||`tmpl-${type.toLowerCase()}`);
  const crest=institutionalDocumentLogo(studioOverride);
  const rendered=await renderGoogleDriveTemplateToPdf({retainAtaPreview:Boolean(onAtaPreview),institutionalCrestUrl:crest&&publicPortalBaseUrl()?new URL(crest,publicPortalBaseUrl()).href:undefined,presentation:{process:p,documentType:type,...(type!=='CONVITE'&&(signatureSignersOverride||studioOverride?.docTemplates.some(item=>resolveSignatureTemplateType(item)===type&&item.signatureRecipientRoles!==undefined))?{signatureSigners:signatureSignersOverride||registeredSignatureSigners(p,type,{...currentSettings,integrationStudio:studioOverride})}:{})},accessToken,templateUrlOrId:model.driveFileId,documentText:type==='ATA'?(extraVariables?.ATA_TEXTO_INTEGRAL!==undefined?String(extraVariables.ATA_TEXTO_INTEGRAL):p.avaliacao?.documentText):undefined,legacyDefenseLocations:{selected:p.defesa.local,alternatives:[...operationalConfig(studioOverride).reservation.locations,resolveInstallationProfile(currentSettings).defaultDefenseLocation]},replacements:presentVariables(buildOfficialTemplateReplacements(p,verificationCode,extraVariables,type),artifactId,studioOverride),boldMarkers:(operationalConfig(studioOverride).presentations[artifactId]||[]).filter(rule=>rule.bold).map(rule=>rule.marker),temporaryParentId:await ensurePortalRenderFolder(accessToken,currentSettings.driveRootFolderId||''),outputName,...(type==='CONVITE'?{literalReplacements:invitationTemplateCorrections(p),invitationLayout:true}:{})});
  try{
    await verifyMasterDocumentModelFingerprint({accessToken,fileId:model.driveFileId,contentSha256:model.contentSha256,driveRevisionId:model.driveRevisionId,driveModifiedTime:model.driveModifiedTime});
  }catch(error){
    if(rendered.previewFileId)await discardAtaCopy(accessToken,rendered.previewFileId).catch(()=>undefined);
    throw error;
  }
  if(rendered.documentText)onDocumentText?.(rendered.documentText);
  if(rendered.replacementsChanged<1)throw new Error(`O modelo ${type} não contém nenhum marcador reconhecido. Revise as variáveis antes de solicitar assinatura.`);
  if(rendered.unresolvedMarkers.length)throw new Error(`O modelo ${type} ainda contém marcadores sem valor: ${rendered.unresolvedMarkers.join(', ')}.`);
  onAtaPreview?.(rendered);
  return rendered.pdf;
}
function queueReservationArchive(process:ProcessData,revision:number,now:string):FormArchiveJob{
  const id='form_'+createHash('sha256').update(`${process.id}|CONFIRMACAO_LOCAL|${revision}`).digest('hex').slice(0,28);
  const job:FormArchiveJob={id,processId:process.id,formType:'CONFIRMACAO_LOCAL',reservationRevision:revision,
    version:process.dataRevision,sha256:'',artifactBase64:'',status:'PENDING',createdAt:now,updatedAt:now,
    reservationTemplate:reservationReceiptTemplate(currentSettings),workflowStudioRevision:currentSettings.integrationStudio?.revision};
  formArchiveJobsStore.push(job);
  return job;
}

const reservationArchiveTasks=new Map<string,Promise<FormArchiveJob>>();
function retryExistingFormArchiveJob(job:FormArchiveJob,process:ProcessData):Promise<FormArchiveJob>{
  if(job.reservationRevision===undefined)return uploadFormArchiveJob(job,process);
  const running=reservationArchiveTasks.get(job.id);
  if(running)return running;
  const task=uploadFormArchiveJob(job,process).finally(()=>reservationArchiveTasks.delete(job.id));
  reservationArchiveTasks.set(job.id,task);
  return task;
}
async function uploadFormArchiveJob(job:FormArchiveJob,process:ProcessData):Promise<FormArchiveJob>{
  if(job.status==='ARCHIVED')return job;
  const selected=job.reservationRevision===undefined?undefined
    :reservationReceipts(process).find(item=>item.summary.revision===job.reservationRevision);
  const snapshot=selected?.process||process;
  if(job.reservationTemplate&&selected&&!job.artifactBase64)return uploadTemplatedReservationArchive(job,process,snapshot,job.reservationTemplate);
  const pdf=job.artifactBase64?Buffer.from(job.artifactBase64,'base64')
    :job.registrationSnapshot?await renderRegistrationSnapshot(job.registrationSnapshot)
    :selected?await createReservationReceiptPdf(snapshot,currentSettings):undefined;
  if(!pdf)throw new Error('A cópia imutável do formulário não está disponível para nova tentativa.');
  if(!pdf.subarray(0,5).equals(Buffer.from('%PDF-')))throw new Error('A cópia imutável do formulário não é um PDF válido.');
  const actualSha=createHash('sha256').update(pdf).digest('hex');
  if(job.sha256&&actualSha!==job.sha256)throw new Error('A cópia imutável do formulário falhou na verificação de integridade.');
  job.sha256=actualSha;
  try{
    const accessToken=await getGoogleWorkspaceAccessToken();
    if(!currentSettings.driveRootFolderId)throw new Error('Pasta raiz do Drive não configurada.');
    if(!process.driveFolderId){const folder=await ensurePortalProcessDriveFolder({accessToken,rootFolderId:currentSettings.driveRootFolderId,protocol:process.protocolo,processId:process.id});process.driveFolderId=folder.id;process.driveFolderUrl=folder.webViewLink;process.driveSyncedAt=new Date().toISOString();}
    const uploaded=await uploadProcessFormPdf({accessToken,processFolderId:process.driveFolderId,processId:process.id,protocol:process.protocolo,studentNames:[snapshot.aluno1.nome,snapshot.aluno2?.nome].filter(Boolean) as string[],formType:job.formType,version:job.version,pdf,sha256:job.sha256});
    job.status='ARCHIVED';job.driveFileId=String(uploaded.id);job.fileName=String(uploaded.name||'');job.artifactBase64='';delete job.registrationSnapshot;job.lastError=undefined;job.updatedAt=new Date().toISOString();
  }catch(error){job.status='FAILED';job.lastError=error instanceof Error?error.message:'Falha ao arquivar o formulário.';job.updatedAt=new Date().toISOString();}
  await persistPortalStateDurably();return job;
}

function receiptArchiveScope(job: FormArchiveJob, allowedHashes: readonly string[]) {
  return {processId:job.processId,formType:job.formType,formVersion:Math.max(1,Math.floor(job.version||1)),allowedHashes};
}

async function uploadTemplatedReservationArchive(job:FormArchiveJob, process:ProcessData, snapshot:ProcessData, model:ReservationReceiptTemplate):Promise<FormArchiveJob>{
  try{
    const accessToken=await getGoogleWorkspaceAccessToken();
    const rootFolderId=currentSettings.driveRootFolderId;
    if(!rootFolderId)throw new Error('Pasta raiz do Drive não configurada.');
    if(!job.receiptUpload){
      job.receiptUpload={reservedFileId:await reserveProcessFormPdfId(accessToken),candidates:[]};
      await persistPortalStateDurably();
    }
    const {reservedFileId,candidates}=job.receiptUpload;
    const archived=await readProcessFormPdfById(accessToken,reservedFileId,receiptArchiveScope(job,candidates.map(item=>item.sha256)));
    let completed:{fileName:string;sha256:string;source:'DOCX'|'CANONICAL'};
    if(archived){
      const candidate=candidates.find(item=>item.sha256===archived.sha256);
      if(!candidate)throw new Error('Não foi possível confirmar a origem do comprovante arquivado.');
      completed={fileName:archived.fileName,sha256:archived.sha256,source:candidate.source};
    }else{
      if(!process.driveFolderId){
        const folder=await ensurePortalProcessDriveFolder({accessToken,rootFolderId,protocol:process.protocolo,processId:process.id});
        process.driveFolderId=folder.id;process.driveFolderUrl=folder.webViewLink;process.driveSyncedAt=new Date().toISOString();
      }
      const {source,pdf}=await renderReservationArchivePdf(snapshot,model,currentSettings,accessToken,rootFolderId);
      const sha256=createHash('sha256').update(pdf).digest('hex');
      if(!candidates.some(item=>item.sha256===sha256)){
        if(candidates.length>=8)throw new Error('O comprovante aguarda conferência após tentativas repetidas de arquivamento.');
        candidates.push({sha256,source});
        await persistPortalStateDurably();
      }
      const uploaded=await uploadProcessFormPdf({
        accessToken,processFolderId:process.driveFolderId,processId:process.id,protocol:process.protocolo,
        studentNames:[snapshot.aluno1.nome,snapshot.aluno2?.nome].filter(Boolean) as string[],
        formType:job.formType,version:job.version,pdf,sha256,reservedFileId,
      });
      if(String(uploaded.id)!==reservedFileId)throw new Error('O Drive não confirmou o identificador reservado para o comprovante.');
      completed={fileName:String(uploaded.name||''),sha256,source};
    }
    job.status='ARCHIVED';job.driveFileId=reservedFileId;job.fileName=completed.fileName;
    job.sha256=completed.sha256;job.receiptSource=completed.source;job.lastError=undefined;
  }catch(error){job.status='FAILED';job.lastError=error instanceof Error?error.message:'Falha ao arquivar o comprovante.';}
  job.updatedAt=new Date().toISOString();
  await persistPortalStateDurably();return job;
}

async function privateReservationReceiptPdf(process:ProcessData, selected:ReturnType<typeof reservationReceipts>[number], publicFallback:boolean):Promise<Buffer>{
  const revision=selected.summary.revision;
  const archive=revision===undefined?undefined:formArchiveJobsStore.find(job=>job.processId===process.id
    &&job.reservationRevision===revision&&job.formType==='CONFIRMACAO_LOCAL'&&job.status==='ARCHIVED'&&job.receiptSource==='DOCX');
  if(archive?.driveFileId&&archive.sha256){
    try{
      const stored=await readProcessFormPdfById(await getGoogleWorkspaceAccessToken(),archive.driveFileId,receiptArchiveScope(archive,[archive.sha256]));
      if(stored)return stored.pdf;
    }catch{
      // The canonical copy remains available if a historic file cannot be verified.
    }
  }
  return createReservationReceiptPdf(selected.process,currentSettings,{publicView:publicFallback});
}

async function resumeWorkflowAfterNativeFormArchive(process:ProcessData,formType:ProcessFormArchiveType,actorEmail:string,resumeRun?:WorkflowRun):Promise<void>{
  if(formType==='CADASTRO_INICIAL'){await executeConfiguredWorkflowEvent(process,'TCC_CREATED',actorEmail,undefined,resumeRun);return;}
  if(formType==='CONFIRMACAO_LOCAL'){
    if(reservationReceiptStatus(process)!=='CONFIRMADO'||process.defesa.invitationSentAt)return;
    if(currentReservationArchive(process,formArchiveJobsStore)?.status!=='ARCHIVED')throw new Error('A confirmação do local deste agendamento ainda não foi arquivada no Drive.');
    const recorded=resumeRun||workflowRunsStore.filter(item=>item.processId===process.id&&item.eventCode==='LOCATION_CONFIRMED'&&item.sourceDataRevision===process.dataRevision)
      .slice().sort((a,b)=>b.startedAt.localeCompare(a.startedAt))[0];
    if(!resumeRun&&recorded&&(recorded.sourceDataRevision!==process.dataRevision||recorded.studioRevision!==currentSettings.integrationStudio?.revision)){
      throw new Error('A execução do convite ou a configuração mudou. Confira a revisão antes de retomar o fluxo.');
    }
    if(recorded&&!hasStableInvitationRecoveryIdentity(process,recorded))throw new Error('A tentativa anterior do convite não possui uma identidade de arquivo confirmada. Confira o registro antes de retomar.');
    const sameContext=recorded?.sourceDataRevision===process.dataRevision&&recorded?.studioRevision===currentSettings.integrationStudio?.revision;
    const eventActor=sameContext&&recorded?.actorEmail?recorded.actorEmail:(process.defesa.departmentResponse?.respondedBy||actorEmail);
    const run=await executeConfiguredWorkflowEvent(process,'LOCATION_CONFIRMED',eventActor,sameContext?recorded?.eventVariables:undefined,recorded);
    if(run)await finalizeConfirmedInvitation(process,run,eventActor);
    return;
  }
  if(formType==='AVALIACAO'){await executeConfiguredWorkflowEvent(process,'EVALUATION_SUBMITTED',actorEmail,undefined,resumeRun);return;}
  await executeConfiguredWorkflowEvent(process,'REPOSITORY_SUBMITTED',actorEmail,undefined,resumeRun);
  if(declarationReady(process,signatureJobsStore))await executeConfiguredWorkflowEvent(process,'PUBLICATION_CLEARED',actorEmail);
}
async function archiveStudioFormSubmission(process:ProcessData,form:any,submission:StudioFormSubmission):Promise<StudioFormSubmission>{
  if (submission.archiveStatus === 'ARCHIVED') return submission;
  form = submission.formSnapshot || form;
  const questions=Array.isArray(form.questions)?form.questions:[];
  const body=[`Formulário: ${String(form.title||submission.formId)}`,`Protocolo: ${process.protocolo}`,`Enviado por: ${submission.submittedBy}`,`Enviado em: ${submission.submittedAt}`,...questions.map((question:any)=>{const field=String(question.fieldKey||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9]+/g,'_').replace(/^_+|_+$/g,'').toUpperCase();return submission.answers[field]===undefined?null:`${question.label}: ${String(submission.answers[field])}`;}).filter(Boolean)].join('\n');
  const pdf=await createBrandedTextPdf({title:`Formulário - ${String(form.title||submission.formId)}`,protocol:process.protocolo,body,footer:`Checksum ${submission.checksum}`},currentSettings);
  try{
    const accessToken=await getGoogleWorkspaceAccessToken();if(!currentSettings.driveRootFolderId)throw new Error('Pasta raiz do Drive não configurada.');
    if(!process.driveFolderId){const folder=await ensurePortalProcessDriveFolder({accessToken,rootFolderId:currentSettings.driveRootFolderId,protocol:process.protocolo,processId:process.id});process.driveFolderId=folder.id;process.driveFolderUrl=folder.webViewLink;}
    const siblings=studioFormSubmissionsStore.filter(item=>item.processId===process.id&&item.formId===submission.formId).sort((a,b)=>a.submittedAt.localeCompare(b.submittedAt));
    const version=Math.max(1,siblings.findIndex(item=>item.id===submission.id)+1);
    const uploaded=await uploadProcessFormPdf({accessToken,processFolderId:process.driveFolderId,processId:process.id,protocol:process.protocolo,studentNames:[process.aluno1.nome,process.aluno2?.nome].filter(Boolean) as string[],formType:`CUSTOM_${submission.formId}`,version,pdf,sha256:createHash('sha256').update(pdf).digest('hex')});
    submission.archiveStatus='ARCHIVED';submission.driveFileId=String(uploaded.id);submission.archiveError=undefined;
  }catch(error){submission.archiveStatus='FAILED';submission.archiveError=error instanceof Error?error.message:'Falha ao arquivar no Drive.';}
  await persistPortalStateDurably();return submission;
}
async function createInstitutionalDossier(process:ProcessData,actorEmail:string,selectedTypes?:string[]):Promise<{zip:Buffer;fileName:string;manifestHash:string;included:number;missing:string[]}>{
  const zip=new JSZip();const files:Array<{path:string;sha256:string;bytes:number;kind:string}> = [];const missing:string[]=[];
  const addBuffer=(filePath:string,buffer:Buffer,kind:string)=>{zip.file(filePath,buffer);files.push({path:filePath,sha256:createHash('sha256').update(buffer).digest('hex'),bytes:buffer.length,kind});};
  const processSnapshot=Buffer.from(JSON.stringify({...process,createdByEmail:process.createdByEmail},null,2),'utf8');addBuffer('00_MANIFESTO/processo.json',processSnapshot,'PROCESS_SNAPSHOT');
  const processLogs=auditLogsStore.filter(log=>log.processId===process.id).map(log=>JSON.stringify(log)).join('\n');addBuffer('00_MANIFESTO/auditoria.jsonl',Buffer.from(processLogs,'utf8'),'AUDIT_LOG');
  let accessToken='';try{accessToken=await getGoogleWorkspaceAccessToken();}catch{missing.push('Conexão Google indisponível para copiar os PDFs.');}
  const candidates:Array<{path:string;fileId?:string;kind:string}>=[
    {path:`01_TRABALHO_COMPLETO/${process.acervo?.trabalhoCompletoFileName||'trabalho-completo.pdf'}`,fileId:process.acervo?.trabalhoCompletoFileId,kind:'FULL_WORK'},
    {path:`02_RESUMO_EXPANDIDO/${process.acervo?.resumoExpandidoFileName||'resumo-expandido.pdf'}`,fileId:process.acervo?.resumoExpandidoFileId,kind:'EXPANDED_ABSTRACT'},
    {path:'03_CARTA_CONVITE/carta-convite.pdf',fileId:process.defesa.invitationDriveFileId,kind:'INVITATION'}
  ];
  if(process.defesa.locationProof)candidates.push({
    path:`09_COMPROVANTE_RESERVA/${process.defesa.locationProof.fileName}`,
    fileId:process.defesa.locationProof.driveFileId,
    kind:'LOCATION_PROOF'
  });
  for(const archive of formArchiveJobsStore.filter(job=>job.processId===process.id&&job.status==='ARCHIVED'))candidates.push({path:`00_FORMULARIOS/${archive.formType}/${archive.fileName||`${archive.formType}.pdf`}`,fileId:archive.driveFileId,kind:`FORM_${archive.formType}`});
  for(const job of signatureJobsStore.filter(item=>item.processId===process.id&&item.status==='ARCHIVED')){const signedName=buildPortalDriveFileName({protocol:process.protocolo,title:process.titulo,studentNames:[process.aluno1.nome,process.aluno2?.nome].filter(Boolean) as string[],documentType:job.documentType,version:job.documentVersion,lifecycle:'ASSINADO'});candidates.push({path:`DOCUMENTOS_ASSINADOS/${job.documentType}/${signedName}`,fileId:job.driveSignedFileId,kind:`SIGNED_${job.documentType}`});}
  for(const candidate of candidates){if(selectedTypes&&!selectedTypes.includes(candidate.kind==='INVITATION'?'CONVITE':candidate.kind.replace(/^SIGNED_/,'')))continue;if(!candidate.fileId){if(!['EXPANDED_ABSTRACT','INVITATION'].includes(candidate.kind))missing.push(`${candidate.kind}: arquivo não localizado.`);continue;}if(!accessToken){missing.push(`${candidate.kind}: Google indisponível.`);continue;}try{const downloaded=await downloadDrivePdf(accessToken,candidate.fileId,{processId:process.id});addBuffer(candidate.path,downloaded.pdf,candidate.kind);}catch(error){missing.push(`${candidate.kind}: ${error instanceof Error?error.message:'falha no download'}`);}if(files.reduce((sum,file)=>sum+file.bytes,0)>100*1024*1024)throw new Error('O dossiê ultrapassou o limite de 100 MB.');}
  const profile=resolveInstallationProfile(currentSettings);const manifest={schemaVersion:1,installation:{id:profile.installationId,institution:profile.institutionName,course:profile.courseName},protocol:process.protocolo,generatedAt:new Date().toISOString(),generatedBy:actorEmail,files,missing};const manifestBuffer=Buffer.from(JSON.stringify(manifest,null,2),'utf8'),manifestHash=createHash('sha256').update(manifestBuffer).digest('hex');zip.file('00_MANIFESTO/manifest.json',manifestBuffer);zip.file('00_MANIFESTO/manifest.sha256',`${manifestHash}  manifest.json\n`);const output=await zip.generateAsync({type:'nodebuffer',compression:'DEFLATE',compressionOptions:{level:6}});return{zip:output,fileName:`${process.protocolo}__DOSSIER_INSTITUCIONAL.zip`,manifestHash,included:files.length,missing};
}
const emailDeliveryJournal={
  async findByIdempotencyKey(key:string){return emailDeliveriesStore.find(item=>item.idempotencyKey===key)||null;},
  async save(record:EmailDeliveryRecord){
    if(record.processId&&!processesStore.some(process=>process.id===record.processId))throw new Error('O TCC deste e-mail não está mais disponível.');
    const index=emailDeliveriesStore.findIndex(item=>item.id===record.id);
    if(index>=0)emailDeliveriesStore[index]=record;else emailDeliveriesStore.push(record);
    await persistPortalStateDurably();
  }
};
async function requestAuditedPortalOtp(input: Parameters<typeof requestPortalOtp>[0], requestedBy?: string): Promise<string> {
  const simulated = getOtpRuntimeStatus().delivery === 'DEVELOPMENT_LOG';
  const auditCopyEmail = emailAuditMailbox(currentSettings);
  const auditCopies = !simulated && auditCopyEmail && auditCopyEmail !== normalizeEmail(input.email) ? [auditCopyEmail] : [];
  const record = async (success: boolean) => {
    auditLogsStore.push({id:`otp-email-${randomBytes(12).toString('hex')}`,actorEmail:requestedBy||'Sistema',actorRoles:[],
      action:success?(simulated?'EMAIL_CODIGO_ACESSO_SIMULADO':'EMAIL_CODIGO_ACESSO_ACEITO_GMAIL'):'EMAIL_CODIGO_ACESSO_FALHOU',
      entityType:'authentication',entityId:'email-code',timestamp:new Date().toISOString(),
      after:{recipient:input.email,requestedBy,cc:auditCopies,subject:'Código de acesso ao Portal',provider:success?(simulated?'Simulação local':'Gmail'):'Não confirmado',
        status:success?(simulated?'SIMULATED':'ACCEPTED_BY_GMAIL'):'REQUEST_FAILED',auditCopyMode:'sensitive',auditCopyEmail,method:'EMAIL_OTP'}});
    // A journal failure must not invalidate a code that has already been delivered.
    await persistPortalStateDurably().catch(()=>console.warn('[Portal TCC] Auditoria do pedido de código aguarda persistência.'));
  };
  let challengeId: string;
  try { challengeId=await requestPortalOtp({...input,auditCopyEmail}); }
  catch(error){if(!(error instanceof OtpResendCooldownError))await record(false);throw error;}
  await record(true);
  return challengeId;
}
function reservationSecret(){return String(process.env.PORTAL_SESSION_SECRET||(productionRuntime?'':'portal-development-reservation-secret-2026'));}
function departmentReservationUrl(process:ProcessData,recipient:string){
 if(!process.defesa.reservationRequestRecipient&&!process.defesa.departmentResponse)process.defesa.reservationRequestRecipient=normalizeEmail(recipient);
 const token=reservationToken({processId:process.id,revision:process.defesa.reservationRevision||0,recipient:normalizeEmail(recipient),expiresAt:Date.now()+14*86400000},reservationSecret());
 return `${publicPortalBaseUrl()}/api/reservation-confirmation/${token}`;
}
function emailStudioWithPublicImages(){
 const studio=structuredClone(currentSettings.integrationStudio);
 if(!studio)return studio;
 const asset=(value:string)=>/^data:image\/(png|jpeg|webp);base64,/.test(value||'')?`${publicPortalBaseUrl()}/api/public/runtime-assets/${createHash('sha256').update(value).digest('hex')}`:value?.startsWith('/')&&!value.startsWith('//')?new URL(value,publicPortalBaseUrl()).href:value;
 const logo=asset(institutionalDocumentLogo(studio));
 studio.brandKit.courseLogoUrl=logo;studio.brandKit.universityLogoUrl=logo;
 for(const key of ['courseLogoUrl','universityLogoUrl','emailBannerUrl'] as const)studio.brandKit[key]=asset(studio.brandKit[key]);
 for(const design of Object.values(studio.emailDesigns||{})){design.logoUrl=logo;design.heroImageUrl=asset(design.heroImageUrl);}
 return studio;
}
function selectedEmailAudience(process:ProcessData,templateId:string|undefined,studio=currentSettings.integrationStudio){
 if(templateId==='email-conclusao')return{to:operationalEmailRecipients(templateId,process,'',[],currentSettings.commissionPresidentEmail),cc:[]};
 const template=studio?.emailTemplates?.find(item=>workflowEmailTemplateId(String(item.id||''))===templateId);
 const responsible=templateId==='email-reserva'?reservationApproverEmail(process,studio):(isManagedDefenseLocation(process.defesa.local,operationalConfig(studio).reservation.locations)?configuredRoomReservationDepartmentEmail(studio):normalizeEmail(process.orientador.email));
 return configuredEmailAudience(template,process,responsible,currentSettings.commissionPresidentEmail);
}
function currentEmailRetryBlocker(record:EmailDeliveryRecord,process?:ProcessData):EmailRetryBlocker|undefined{
 if(record.communicationCopy)return{code:'EMAIL_COPY_USE_ORIGINAL',error:'Consulte a comunicação original para autorizar outra cópia.'};
 if(!process)return{code:'EMAIL_PROCESS_UNAVAILABLE',error:'O processo associado não está disponível para reconstruir o e-mail.'};
 if(isConsolidatedEmailNotice(String(record.workflowEventCode||''),record.templateId))return{code:'EMAIL_CONSOLIDATED',error:'Este aviso foi reunido com outra mensagem da etapa. Consulte a comunicação atual do processo.'};
 let audience:ReturnType<typeof selectedEmailAudience>;
 try{audience=selectedEmailAudience(process,record.templateId==='email-reserva'&&normalizeEmail(record.recipient)!==reservationApproverEmail(process)?'email-reserva-autores':record.templateId);}catch{return{code:'EMAIL_RECIPIENT_CHANGED',error:'Confira os papéis e contatos atuais antes de retomar o envio.'};}
 if(audience){
  const actualTo=[...new Set([record.recipient,...(record.additionalRecipients||[])].map(normalizeEmail))].sort();
  const expectedTo=[...new Set(audience.to||actualTo)].sort();
  const actualCc=[...new Set(record.workflowCc||[])].map(normalizeEmail).sort();
  const expectedCc=[...new Set(audience.cc??actualCc)].sort();
  if(JSON.stringify(actualTo)!==JSON.stringify(expectedTo)||JSON.stringify(actualCc)!==JSON.stringify(expectedCc))return{code:'EMAIL_RECIPIENT_CHANGED',error:'Os destinatários selecionados mudaram desde a tentativa original. Consulte a comunicação atual do processo.'};
  return operationalEmailRetryBlocker(record,process,signatureJobsStore);
 }
 if(operationalEmailRouting(record.templateId)||record.templateId==='email-resposta-departamento'){
  try{
   const recipients=record.templateId==='email-resposta-departamento'
    ? [process.defesa.departmentResponse?.respondedBy||'']
    : isReservationDecisionEmail(record.templateId)
    ? currentReservationReceiptRecipients(process)
    : record.templateId==='email-reserva'
     ? [reservationApproverEmail(process),...reservationCopies(process,'')]
     :record.templateId==='email-convite'
      ?[...operationalEmailRecipients('email-convite',process,'',[]),...invitationEmailCopies(process,currentSettings.masterEmail)]
     : operationalEmailRecipients(record.templateId!,process,configuredRoomReservationDepartmentEmail(),[],currentSettings.commissionPresidentEmail);
   const currentRecipients=new Set(recipients.filter(Boolean).map(normalizeEmail));
   if([record.recipient,...(record.additionalRecipients||[])].some(email=>!currentRecipients.has(normalizeEmail(email)))){
    return{code:'EMAIL_RECIPIENT_CHANGED',error:'Os destinatários deste e-mail mudaram desde a tentativa original. Consulte a comunicação atual do processo.'};
   }
  }catch{return{code:'EMAIL_RECIPIENT_CHANGED',error:'Confira os destinatários atuais na ficha do TCC antes de solicitar outra tentativa.'};}
 }
 return operationalEmailRetryBlocker(record,process,signatureJobsStore);
}

function currentEmailCommunicationCopyBlocker(record:EmailDeliveryRecord,process?:ProcessData):EmailRetryBlocker|undefined{
 const basic=communicationCopyBlocker(record);if(basic)return basic;
 if(!process||record.sourceDataRevision!==process.dataRevision||record.studioRevision!==currentSettings.integrationStudio?.revision)return{code:'EMAIL_COPY_REVISION_CHANGED',error:'A versão do processo ou das configurações mudou. Consulte a comunicação atual.'};
 const blocker=currentEmailRetryBlocker(record,process);
 // A second communication is not a second invitation event. The original remains sent.
 if(blocker?.code==='INVITATION_EVENT_NOT_CURRENT'&&record.templateId==='email-convite'&&process.defesa.localStatus==='CONFIRMADO'&&process.defesa.invitationSentAt&&process.defesa.invitationDriveFileId)return;
 return blocker;
}

async function sendTrackedPortalEmail(input:{process?:ProcessData;requestedBy?:string;recipient:string;cc?:string[];workflowCc?:string[];subject:string;text:string;html?:string;templateId?:string;workflowEventCode?:WorkflowEventCode;workflowEventVariables?:Record<string,string>;idempotencyKey:string;attachments?:Array<{fileName:string;mimeType:string;content:Buffer}>}){
 const process=input.process;
 if(process&&!processEmailApplicable(process,input.templateId))throw new Error('O Termo de Autorização não se aplica: nenhuma publicação foi autorizada.');
 if(process&&isConsolidatedEmailNotice(String(input.workflowEventCode||''),input.templateId))throw new Error('Este aviso foi reunido com outra mensagem da etapa e não será enviado separadamente.');
 if(input.templateId==='email-conclusao'&&process?.status!=='CONCLUIDO')throw new Error('O aviso final aguarda a conclusão das assinaturas e o arquivamento dos documentos.');
 if(!process)return dispatchTrackedEmail({...input,html:withEmailImages(currentSettings.integrationStudio,input.templateId,input.html,input.text,publicPortalBaseUrl()),attachments:[]},{send:sendGmailMessage,journal:emailDeliveryJournal,auditCopyEmail:emailAuditMailbox(currentSettings)});
 if(input.templateId==='email-reserva'&&![reservationApproverEmail(process),...(selectedEmailAudience(process,'email-reserva-autores')?.to??reservationCopies(process,''))].includes(normalizeEmail(input.recipient)))throw new Error('O destinatário não corresponde ao responsável pelo local nem aos autores deste pedido.');
 const personalReservation=input.templateId==='email-reserva'&&normalizeEmail(input.recipient)===reservationApproverEmail(process);
 const selectedTemplateId=input.templateId==='email-reserva'&&!personalReservation?'email-reserva-autores':input.templateId;
 const finalNotice=input.templateId==='email-conclusao';
 const finalKey=finalNotice?finalProcessEmailKey(process):undefined;
 if(finalKey){
  const prior=emailDeliveriesStore.find(record=>record.processId===process.id&&record.templateId==='email-conclusao'
    &&record.idempotencyKey.startsWith(finalKey+':')&&(record.status==='ACCEPTED_BY_GMAIL'||record.dispatchState==='SENDING'||record.dispatchState==='UNCERTAIN'));
  if(prior)return prior;
 }
 const selected=selectedEmailAudience(process,selectedTemplateId);
 if(selected?.to){
  input={...input,recipient:selected.to[0]};
 }
 const invitation=input.templateId==='email-convite';
 const examiners=invitation?operationalEmailRecipients('email-convite',process,'',[]):[];
 if(invitation&&!selected?.to&&!examiners.includes(normalizeEmail(input.recipient)))throw new Error('O convite deve ser enviado aos dois examinadores da banca.');
 const invitationCopies=invitation?invitationEmailCopies(process):undefined;
 const reservationDecision=isReservationDecisionEmail(input.templateId);
 if(reservationDecision&&!selected?.to&&!currentReservationReceiptRecipients(process).includes(normalizeEmail(input.recipient)))throw new Error('O destinatário do comprovante não corresponde ao grupo atual da reserva.');
 const departmentLink=input.templateId==='email-reserva'&&normalizeEmail(input.recipient)===reservationApproverEmail(process);
 const reservationNotice=input.templateId==='email-reserva'&&!departmentLink;
 // Business participants are direct recipients; only the configured audit mailbox is copied.
 const auditMailbox=emailAuditMailbox(currentSettings);
 const auditAddresses=new Set([currentSettings.masterEmail,auditMailbox].filter(Boolean).map(email=>normalizeEmail(email!)));
 const businessRecipients=selected?.to??(input.templateId==='email-reserva'&&departmentLink?[]
   :reservationDecision?currentReservationReceiptRecipients(process):reservationNotice?reservationCopies(process,'')
   :invitation?examiners:input.workflowCc??input.cc??[]);
 const directRecipients=[...new Set((reservationDecision?businessRecipients:[input.recipient,...businessRecipients]).map(normalizeEmail))]
   .filter(email=>Boolean(selected?.to)||email===normalizeEmail(input.recipient)||!auditAddresses.has(email));
 const message=processEmailMessage({process,recipient:input.recipient,subject:input.subject,text:input.text,templateId:input.templateId,eventCode:input.workflowEventCode,baseUrl:publicPortalBaseUrl(),courseName:resolveInstallationProfile(currentSettings).courseName,studio:emailStudioWithPublicImages(),reservationReceiptAttached:reservationDecision,templateVariables:buildProcessVariables({process,eventCode:input.workflowEventCode||'EMAIL_NOTICE',actorEmail:input.recipient,actorRoles:[],extraVariables:{...historicalStudioAnswers(process.id),...(input.workflowEventVariables||{}),DEPARTAMENTO_EMAIL:configuredRoomReservationDepartmentEmail()}}),advisorApproval:!isManagedDefenseLocation(process.defesa.local,operationalConfig(currentSettings.integrationStudio).reservation.locations),departmentUrl:departmentLink?departmentReservationUrl(process,input.recipient):undefined});
 let reply: {subject?:string;replyThreadId?:string;replyMessageId?:string}={};
 let attachments: NonNullable<typeof input.attachments>=[];
 if(reservationDecision){
  const recorded=process.defesa.departmentResponse;
  const revision=process.defesa.reservationRevision||0;
  if(!recorded||recorded.revision!==revision)throw new Error('A resposta não corresponde à solicitação de reserva atual.');
  const existing=emailDeliveriesStore.find(record=>record.idempotencyKey===input.idempotencyKey);
  if(existing?.status==='ACCEPTED_BY_GMAIL')return existing;
  const parent=emailDeliveriesStore.find(record=>record.processId===process.id&&record.templateId==='email-reserva'
    &&normalizeEmail(record.recipient)===reservationApproverEmail(process)&&record.status==='ACCEPTED_BY_GMAIL'
    &&Number(record.workflowEventVariables?.RESERVATION_REVISION||0)===revision);
  const threadId=parent?.attempts.slice().reverse().find(attempt=>attempt.status==='ACCEPTED_BY_GMAIL'&&attempt.gmailThreadId)?.gmailThreadId;
  if(!parent?.rfcMessageId||!threadId){
    const pendingId=`reservation-parent-pending:${process.id}:${revision}`;
    if(!auditLogsStore.some(event=>event.id===pendingId))auditLogsStore.push({id:pendingId,processId:process.id,actorEmail:'system@portal.local',actorRoles:[],action:'COMPROVANTE_AGUARDA_CONVERSA_ORIGINAL',entityType:'processo',entityId:process.id,after:{reservationRevision:revision},timestamp:new Date().toISOString()});
    throw new Error('O comprovante aguarda a confirmação da mensagem enviada ao responsável pela reserva para responder na mesma conversa.');
  }
  reply={subject:parent.subject,replyThreadId:threadId,replyMessageId:parent.rfcMessageId};
  const fileName=`${process.protocolo}-${recorded.decision==='CONFIRMED'?'comprovante-de-reserva':'comprovante-de-indisponibilidade'}.pdf`;
  attachments=[{fileName,mimeType:'application/pdf',content:await createReservationReceiptPdf(process,currentSettings)}];
 }
 const delivery=await dispatchTrackedEmail({...input,...message,...reply,sourceDataRevision:process.dataRevision,studioRevision:currentSettings.integrationStudio?.revision,auditCopyMode:input.templateId==='email-reserva'&&departmentLink?'sensitive':'operational',additionalRecipients:hasPersonalEmailAccess(message.text,message.html)?[]:directRecipients,cc:selected?.cc??(invitation?invitationCopies:[]),workflowCc:selected?.cc??(invitation?invitationCopies:[]),processId:process.id,protocol:process.protocolo,idempotencyKey:finalKey??(input.templateId===REPOSITORY_DELIVERY_EMAIL_ID?repositoryDeliveryEmailKey(process,input.recipient):input.idempotencyKey),attachments},{send:sendGmailMessage,journal:emailDeliveryJournal,auditCopyEmail:emailAuditMailbox(currentSettings)});
 if(input.templateId==='email-reserva'&&departmentLink){
  const copies=[];
  const recipients=selectedEmailAudience(process,'email-reserva-autores')?.to??reservationCopies(process,'');
  // Keep the advisor in the participant notice even when also approving the room.
  for(const recipient of recipients.slice(0,1))copies.push(await sendTrackedPortalEmail({...input,templateId:selectedEmailAudience(process,'email-reserva-autores')?'email-reserva-autores':input.templateId,recipient,cc:[],workflowCc:[],idempotencyKey:`${input.idempotencyKey}:participant:${normalizeEmail(recipient)}`}));
  if(copies.some(record=>record.status!=='ACCEPTED_BY_GMAIL'))throw new Error('A solicitação de reserva tem mensagens aos autores ou ao orientador aguardando envio.');
 }
 return delivery;
}


async function notifyReservationResponse(p: ProcessData): Promise<EmailDeliveryRecord | undefined> {
  const response = p.defesa.departmentResponse;
  if (!response || response.revision !== (p.defesa.reservationRevision || 0)) return;
  const confirmed = response.decision === 'CONFIRMED';
  // Preserve the decision identity and thread; resolve the group from the current contact configuration.
  const recipients = selectedEmailAudience(p,confirmed?'email-comprovante-reserva':'email-local-indisponivel')?.to??currentReservationReceiptRecipients(p);
  const [recipient] = recipients;
  if (!recipient) return;
  const deliveryKey=`reservation-receipt:${p.id}:${response.revision}:${response.respondedBy}`;
  const previous=emailDeliveriesStore.find(record=>record.idempotencyKey===deliveryKey);
  if(previous?.status==='ACCEPTED_BY_GMAIL')return previous;
  if(previous&&(normalizeEmail(previous.recipient)!==recipient||JSON.stringify([...new Set([previous.recipient,...(previous.additionalRecipients||[])].map(normalizeEmail))].sort())!==JSON.stringify([...recipients].sort())||(previous.workflowCc||[]).length>0)){
    // Only an unsent or explicitly rejected legacy notice can update its recipients.
    // A leased/ambiguous dispatch or any Gmail acknowledgement must never be replayed.
    if(previous.dispatchState||previous.attempts.some(attempt=>attempt.status==='ACCEPTED_BY_GMAIL'))return previous;
    const beforeRecipient=previous.recipient;
    previous.recipient=recipient;previous.additionalRecipients=recipients.filter(email=>email!==recipient);
    previous.cc=[];previous.workflowCc=[];
    auditLogsStore.push({id:`log-${randomBytes(12).toString('hex')}`,processId:p.id,actorEmail:'system@portal.local',actorRoles:[],action:'EMAIL_DESTINATARIOS_ATUALIZADOS',entityType:'email_delivery',entityId:previous.id,before:{recipient:beforeRecipient},after:{recipient,additionalRecipients:previous.additionalRecipients,reason:'RESERVATION_RECEIPT_CURRENT_DIRECT_RECIPIENTS'},timestamp:new Date().toISOString()});
    await persistPortalStateDurably();
  }
  const delivery = await sendTrackedPortalEmail({
    process: p, requestedBy:response.respondedBy, recipient,
    subject: `[${p.protocolo}] ${confirmed ? 'Reserva confirmada' : 'Agendamento recusado'}`,
    text: [
      'Prezados autores e orientador,',
      confirmed ? `O departamento confirmou a reserva de ${response.local || p.defesa.local}.`
        : 'O responsável recusou o agendamento solicitado. Ajustem a proposta antes de solicitar nova data, para evitar retrabalho.',
      `${formatDateWithWeekday(response.startAt)}, ${formatTime24h(response.startAt)} às ${formatTime24h(response.endAt || defenseEndAt(response.startAt))}`,
      `Resposta registrada em ${formatDateTimeWithWeekday(response.respondedAt)}. O comprovante segue em PDF anexo.`
    ].join('\n\n'),
    templateId: confirmed ? 'email-comprovante-reserva' : 'email-local-indisponivel',
    workflowEventVariables: { RESERVATION_REVISION: String(response.revision), RESERVATION_DECISION: response.decision },
    idempotencyKey: deliveryKey
  });
  await persistPortalStateDurably();
  return delivery;
}

async function completeReservationFollowup(process:ProcessData,actor:string,revision:number,archive?:FormArchiveJob){
 const failures:unknown[]=[];
 let archiveConfirmed=!archive;
 try{await notifyReservationResponse(process);}catch(error){failures.push(error);}
 if(archive)try{const saved=await retryExistingFormArchiveJob(archive,process);archiveConfirmed=saved.status==='ARCHIVED';if(!archiveConfirmed)failures.push(new Error(saved.lastError||'A confirmação do local aguarda arquivamento no Drive.'));}catch(error){failures.push(error);}
 const response=process.defesa.departmentResponse;
 if(archiveConfirmed&&response?.revision===revision&&response.decision==='CONFIRMED'&&!process.defesa.invitationSentAt){
   await finishConfirmedReservation(process,actor).catch(error=>failures.push(error));
 }
 if(failures.length)throw failures[0];
}

async function finalizeConfirmedInvitation(process:ProcessData,run:WorkflowRun,actor:string):Promise<boolean>{
 if(process.defesa.invitationSentAt)return true;
 if(reservationReceiptStatus(process)!=='CONFIRMADO'||!process.defesa.invitationDriveFileId||currentReservationArchive(process,formArchiveJobsStore)?.status!=='ARCHIVED')return false;
 const delivered=confirmedInvitationDelivery(process,run,emailDeliveriesStore,selectedEmailAudience(process,'email-convite'));
 if(!delivered)return false;
 process.etapaAtual='CONVITE';process.status='AGUARDANDO_DEFESA';
 process.defesa.invitationSentAt=delivered.acceptedAt||delivered.attempts.at(-1)?.completedAt||new Date().toISOString();
 process.defesa.invitationRecipients=Array.from(new Set([delivered.recipient,...(delivered.additionalRecipients||[]),...(delivered.cc||[])]));process.updatedAt=new Date().toISOString();
 auditLogsStore.push({id:`log-${randomBytes(12).toString('hex')}-invite`,processId:process.id,actorEmail:actor,actorRoles:getUserRolesForEmail(actor).globalRoles,action:'FLUXO_CONVITE_CONCLUIDO',entityType:'processo',entityId:process.id,after:{driveFileId:process.defesa.invitationDriveFileId,deliveryId:delivered.id,recipients:process.defesa.invitationRecipients},timestamp:process.updatedAt});
 await persistPortalStateDurably();await executeConfiguredWorkflowEvent(process,'INVITATION_SENT',actor);return true;
}
async function finishConfirmedReservation(portalProcess:ProcessData,actor:string){
 if(currentReservationArchive(portalProcess,formArchiveJobsStore)?.status!=='ARCHIVED')return;
 const workflowRun=await executeConfiguredWorkflowEvent(portalProcess,'LOCATION_CONFIRMED',actor);
 if(workflowRun)await finalizeConfirmedInvitation(portalProcess,workflowRun,actor);
}

function configuredDocumentType(template:Record<string,unknown>):'CONVITE'|'ATA'|'TERMO'|'DECLARACAO'{
  const type=operationalDocumentType(template);
  if(!type)throw new Error(`O modelo ${String(template.id||template.label||'')} não possui um tipo documental reconhecido.`);
  return type;
}
async function ensureWorkflowProcessFolder(portalProcess:ProcessData):Promise<{accessToken:string;folderId:string}>{
  const accessToken=await getGoogleWorkspaceAccessToken();
  if(!currentSettings.driveRootFolderId)throw new Error('Configure a pasta raiz privada do Google Drive antes de executar o fluxo.');
  if(!portalProcess.driveFolderId){const folder=await ensurePortalProcessDriveFolder({accessToken,rootFolderId:currentSettings.driveRootFolderId,protocol:portalProcess.protocolo,processId:portalProcess.id});portalProcess.driveFolderId=folder.id;portalProcess.driveFolderUrl=folder.webViewLink;portalProcess.driveSyncedAt=new Date().toISOString();}
  return{accessToken,folderId:portalProcess.driveFolderId};
}
function assertSafeWorkflowDocumentEvent(type:'CONVITE'|'ATA'|'TERMO'|'DECLARACAO',eventCode:WorkflowEventCode):void{
  const expected:Record<typeof type,string>={CONVITE:'LOCATION_CONFIRMED',ATA:'EVALUATION_SUBMITTED',TERMO:'REPOSITORY_SUBMITTED',DECLARACAO:'PUBLICATION_CLEARED'};
  const received=normalizeWorkflowEventCode(eventCode);
  if(received!==expected[type])throw new Error(`O documento ${type} só pode ser gerado pelo evento seguro ${expected[type]}. Evento recebido: ${received||'VAZIO'}.`);
}
function automaticAstenEnabled(type?:SignableDocumentType):boolean{
  return type==='ATA'||process.env.ASTEN_AUTOMATIC_WORKFLOW_ENABLED==='true';
}

function queueAutomaticAsten(process:ProcessData,type:SignableDocumentType):void{
  if(!automaticAstenEnabled(type)||process.signatureProviderPreferences?.[type]==='GOV_BR')return;
  process.astenSignatureIntent={documentType:type,revision:signatureDocumentRevision(process,type),queuedAt:new Date().toISOString(),...(type!=='ATA'?{studioRevision:currentSettings.integrationStudio?.revision||0}:{})};
}

function acceptedAstenSignature(job:SignatureJob):boolean{
  return job.provider==='ASTEN'&&!job.removedFromLogsAt&&['SENT','PARTIALLY_SIGNED','SIGNED','DRIVE_SYNC_PENDING','ARCHIVED'].includes(job.status);
}

async function executeAutomaticAsten(process:ProcessData,type:SignableDocumentType,actorEmail:string):Promise<string|undefined>{
  const intent=process.astenSignatureIntent;
  if(!automaticAstenEnabled(type)||intent?.documentType!==type||!processesStore.includes(process))return;
  const currentJobs=signatureJobsStore.filter(job=>job.processId===process.id&&job.documentType===type&&job.sourceDataRevision===intent.revision);
  const completed=currentJobs.find(acceptedAstenSignature);
  const manuallyResolved=currentJobs.some(job=>job.removedFromLogsAt||job.provider==='GOV_BR'||['CANCELED','DECLINED','EXPIRED'].includes(job.status));
  if(completed||manuallyResolved||intent.revision!==signatureDocumentRevision(process,type)||process.signatureProviderPreferences?.[type]==='GOV_BR'||process.status==='CONCLUIDO'){
    process.astenSignatureIntent=undefined;
    await persistPortalStateDurably();
    return completed?.id;
  }
  if(type==='DECLARACAO'&&publicationRequested(process)&&process.acervo?.publicationState!=='PUBLIC')throw new Error('A declaração aguarda a sincronização da publicação autorizada.');
  assertSignatureEligibility(process,type);
  const readiness=await inspectAstenDelivery({status:getPersistentAstenStatus,inbox:astenWebhookInboxReady,folder:()=>resolveAstenDocumentFolder(type),google:getGoogleWorkspaceStatus,hasDriveRoot:Boolean(currentSettings.driveRootFolderId)});
  if(!readiness.ready)throw new Error(readiness.reason);
  if(!processesStore.includes(process)||process.astenSignatureIntent!==intent||intent.revision!==signatureDocumentRevision(process,type))return;
  const job=await createSignatureJob(process,type,actorEmail);
  const currentProcess=processesStore.find(item=>item.id===process.id);
  if(currentProcess!==process||currentProcess.astenSignatureIntent!==intent||currentProcess.signatureProviderPreferences?.[type]==='GOV_BR')return;
  await dispatchSignatureJobAutomatically(job);
  if(!acceptedAstenSignature(job))throw new Error(job.lastError||'O envio Asten aguarda confirmação.');
  if(process.astenSignatureIntent===intent)process.astenSignatureIntent=undefined;
  await persistPortalStateDurably();
  return job.id;
}

async function executeConfiguredDocumentAction(portalProcess:ProcessData,template:Record<string,unknown>,actorEmail:string,idempotencyKey:string,variables:Record<string,string>,eventCode:WorkflowEventCode):Promise<{externalId?:string}>{
  const type=configuredDocumentType(template);
  assertSafeWorkflowDocumentEvent(type,eventCode);
  if(type==='TERMO'&&!publicationRequested(portalProcess))return{externalId:'NOT_APPLICABLE_NO_PUBLICATION'};
  if(type!=='CONVITE'){
    const jobId=await executeAutomaticAsten(portalProcess,type,actorEmail);
    const currentJob=automaticAstenEnabled(type)&&signatureJobsStore.find(job=>job.processId===portalProcess.id&&job.documentType===type&&signatureJobMatchesCurrentRevision(portalProcess,job)&&acceptedAstenSignature(job));
    return{externalId:jobId||(currentJob?currentJob.id:`MANUAL_SIGNATURE_SELECTION:${type}`)};
  }
  const {accessToken,folderId}=await ensureWorkflowProcessFolder(portalProcess);
  const existing=await readExistingGeneratedInvitation({accessToken,rootFolderId:currentSettings.driveRootFolderId||'',processId:portalProcess.id,
    jobId:`workflow_${idempotencyKey}`,expectedFileId:portalProcess.defesa.invitationDriveFileId});
  if(existing){
    portalProcess.defesa.invitationDriveFileId=existing.id;
    return {externalId:existing.id};
  }
  const pdf=await renderOfficialTemplatePdf(portalProcess,'CONVITE',undefined,variables);
  const sha256=createHash('sha256').update(pdf).digest('hex');
  const fileName=buildPortalDriveFileName({protocol:portalProcess.protocolo,title:portalProcess.titulo,studentNames:[portalProcess.aluno1.nome,portalProcess.aluno2?.nome].filter(Boolean) as string[],documentType:'CONVITE',version:portalProcess.dataRevision,lifecycle:'GERADO'});
  const uploaded=await uploadGeneratedPdfToDrive({rootFolderId:currentSettings.driveRootFolderId,protocol:portalProcess.protocolo,accessToken,processFolderId:folderId,processId:portalProcess.id,jobId:`workflow_${idempotencyKey}`,documentType:'CONVITE',fileName,pdf,sha256});
  portalProcess.defesa.invitationDriveFileId=String(uploaded.id);
  auditLogsStore.push({id:`log-${Date.now()}-workflow-invitation`,processId:portalProcess.id,actorEmail,actorRoles:[...getUserRolesForEmail(actorEmail).globalRoles,...getActiveProcessRoles(actorEmail,portalProcess.id)],action:'CONVITE_GERADO_PELO_FLUXO',entityType:'process_document',entityId:String(uploaded.id),after:{documentType:'CONVITE',sha256,fileName},timestamp:new Date().toISOString()});
  return{externalId:String(uploaded.id)};
}
/** Portal e-mails carry authenticated process links, never document bytes. */
async function resolveWorkflowEmailAttachments(_process:ProcessData,_template:Record<string,unknown>):Promise<Array<{fileName:string;mimeType:string;content:Buffer}>>{return [];}
function historicalStudioAnswers(processId:string):Record<string,string|number|boolean>{
  const answers:Record<string,string|number|boolean>={...(processesStore.find(p=>p.id===processId)?.registrationAnswers||{})};
  for(const submission of studioFormSubmissionsStore.filter(item=>item.processId===processId&&item.archiveStatus==='ARCHIVED').sort((a,b)=>a.submittedAt.localeCompare(b.submittedAt))){
    Object.assign(answers,submission.answers);
  }
  return answers;
}
function configuredRoomReservationDepartmentEmail(studio:any=currentSettings.integrationStudio):string{
  const template=Array.isArray(studio?.emailTemplates)?studio.emailTemplates.find((item:any)=>String(item?.id||'')==='email-reserva'):undefined;
  return reservationDepartmentEmail(template?.recipient,currentSettings.emailConfig?.roomReservationDepartmentEmail,currentSettings.emailConfig?.roomReservationEmailCentralized===true);
}
function currentReservationReceiptRecipients(process:ProcessData):string[]{
 const responsible=isManagedDefenseLocation(process.defesa.local,operationalConfig(currentSettings.integrationStudio).reservation.locations)?configuredRoomReservationDepartmentEmail():normalizeEmail(process.orientador.email);
 return reservationReceiptRecipients(process,responsible);
}
function reservationApproverEmail(process:ProcessData,studio:any=currentSettings.integrationStudio):string{
 return normalizeEmail(process.defesa.reservationRequestRecipient||process.defesa.departmentResponse?.respondedBy||'')||(isManagedDefenseLocation(process.defesa.local,operationalConfig(studio).reservation.locations)?configuredRoomReservationDepartmentEmail(studio):normalizeEmail(process.orientador.email));
}
function nativeReservationWorkflowStudio(){
  return {
    schemaVersion:3,
    revision:0,
    emailTemplates:[{
      id:'email-reserva',
      name:'Solicitação de reserva ao departamento',
      recipient:configuredRoomReservationDepartmentEmail(),
      subject:'Solicitação de reserva de sala para apresentação de TCC - Curso de Enfermagem [<<PROTOCOLO>>]',
      body:'Prezados,\n\nSolicitamos a reserva de sala ou auditório para a defesa de {{CAMPO_01}}.\nTítulo: {{TITULO}}\nData e hora: {{DEFESA_DATA_HORA}}\nLocal: {{DEFESA_LOCAL}}\nCaso indisponível, solicitamos o local alternativo: {{LOCAL_ALTERNATIVO}}.\n\nPor favor, respondam a este e-mail indicando expressamente qual dos locais foi reservado e confirmando a data e o horário solicitados. Caso nenhum dos locais esteja disponível, informem a indisponibilidade.\n\nOrientador: {{ORIENTADOR_NOME}}.\n\nAtenciosamente, Secretaria do curso',
      attachments:[]
    }],
    docTemplates:[],
    formTemplates:[],
    workflowStages:[{
      id:'stage-registration-reservation-fallback',
      stageNumber:1,
      title:'Cadastro e pedido de reserva',
      triggerEvent:'TCC_CREATED',
      actions:[{id:'action-reservation-request-fallback',type:'email',refId:'email-reserva',title:'Solicitar reserva ao departamento'}]
    }],
    matrixColumns:[],
    matrixRows:[],
    brandKit:{},
    documentDesigns:{},
    emailDesigns:{},
    formDesigns:{},
    auditTrail:[]
  } as any;
}
function reservationWorkflowStudio(source:typeof currentSettings.integrationStudio, externalAdvisorEmail?:string){
  const studio:any=source?structuredClone(source):nativeReservationWorkflowStudio();
  studio.emailTemplates=Array.isArray(studio.emailTemplates)?studio.emailTemplates:[];
  const departmentDestination=configuredRoomReservationDepartmentEmail(source);
  const departmentTemplateIds=new Set(studio.emailTemplates.filter((template:any)=>{
    const recipient=String(template?.recipient||'');
    return recipient.includes('DEPARTAMENTO_EMAIL') ||
      Boolean(externalAdvisorEmail&&departmentDestination&&normalizeEmail(recipient)===departmentDestination);
  }).map((template:any)=>String(template?.id||'')).filter(Boolean));
  const nativeTemplate=nativeReservationWorkflowStudio().emailTemplates[0];
  const reservationIndex=studio.emailTemplates.findIndex((template:any)=>String(template?.id||'')==='email-reserva');
  if(reservationIndex>=0){
    const existing=studio.emailTemplates[reservationIndex];
    const legacyMarker=/^\s*(?:\{\{|<<)\s*DEPARTAMENTO_EMAIL\s*(?:\}\}|>>)\s*$/i.test(String(existing?.recipient||''));
    studio.emailTemplates[reservationIndex]={...existing,subject:existing.operationalCatalogEditable===true?existing.subject:nativeTemplate.subject,recipient:legacyMarker?configuredRoomReservationDepartmentEmail():String(existing?.recipient||'').trim()};
  }else studio.emailTemplates.push(nativeTemplate);
  studio.workflowStages=Array.isArray(studio.workflowStages)?studio.workflowStages:[];
  let initial=studio.workflowStages.find((stage:any)=>normalizeWorkflowEventCode(stage?.triggerEvent||stage?.eventCode)==='TCC_CREATED');
  if(!initial){initial={id:'stage-registration-reservation',stageNumber:1,title:'Cadastro e pedido de reserva',triggerEvent:'TCC_CREATED',actions:[]};studio.workflowStages.unshift(initial);}
  const actions=Array.isArray(initial.actions)?initial.actions:[];
  const previousReservation=actions.find((action:any)=>String(action?.refId||action?.referenceId||'')==='email-reserva');
  initial.actions=[
    {...(previousReservation||{}),id:String(previousReservation?.id||'action-reservation-request'),type:'email',refId:'email-reserva',title:String(previousReservation?.title||'Solicitar reserva ao departamento')},
    ...actions.filter((action:any)=>{const refId=String(action?.refId||action?.referenceId||'');return refId!=='email-reserva'&&!departmentTemplateIds.has(refId);})
  ];
  const guidanceId='email-instrucoes-cadastro';
  if(!studio.emailTemplates.some((email:any)=>email.id===guidanceId))studio.emailTemplates.push({id:guidanceId,name:'Orientações de acesso e confirmação da reserva',recipient:'{{ALUNO_1_EMAIL}}, {{ALUNO_2_EMAIL}}, {{ORIENTADOR_EMAIL}}',subject:'[Portal TCC] Cadastro recebido — {{PROTOCOLO}}',body:'Prezado(a) <<DESTINATARIO_NOME>>,\n\nO cadastro do TCC <<PROTOCOLO>> foi recebido. O pedido de reserva foi encaminhado ao departamento.\n\nTítulo: <<TITULO>>\nData e horário pretendidos: <<DEFESA_DATA_HORA>>\nLocal: <<DEFESA_LOCAL>>\nLocal alternativo: <<LOCAL_ALTERNATIVO>>\n\n<<ORIENTACOES_ACESSO>>\n\nAtenciosamente,\nComissão de TCC',attachments:[]});
  if(!initial.actions.some((action:any)=>action.refId===guidanceId))initial.actions.push({id:'action-registration-guidance',type:'email',refId:guidanceId,title:'Orientar autores e orientador sobre o acesso e a reserva'});
  initial.stageNumber=Number(initial.stageNumber||1);
  return studio;
}
function workflowEmailTemplateId(value:unknown):string{
  const id=String(value||'');
  return id==='CARTA_CONVITE'?'email-convite':id;
}
async function executeConfiguredWorkflowEvent(process:ProcessData,eventCode:WorkflowEventCode,actorEmail:string,extraVariables?:Record<string,unknown>,resumeRun?:WorkflowRun):Promise<WorkflowRun|undefined>{
  if(!processesStore.some(item=>item.id===process.id))return undefined;
  const normalizedEvent=normalizeWorkflowEventCode(eventCode);
  const reservationEvent=normalizedEvent==='TCC_CREATED'||normalizedEvent===RESERVATION_RESCHEDULED;
  const reservationBase=reservationEvent?reservationWorkflowStudio(currentSettings.integrationStudio):currentSettings.integrationStudio;
  const baseStudio=reservationBase&&normalizedEvent===RESERVATION_RESCHEDULED?rescheduledReservationStudio(reservationBase):reservationBase;
  const configuredStudio=baseStudio&&['REPOSITORY_SUBMITTED','PUBLICATION_CLEARED'].includes(normalizedEvent)?withDeclarationAfterTerm(baseStudio):baseStudio;
  const milestoneStudio=configuredStudio&&normalizedEvent==='SIGNATURE_COMPLETED'?withRepositoryDeliveryEmail(configuredStudio):configuredStudio;
  const studio=milestoneStudio?withApplicableProcessEmails(withConsolidatedEmailNotifications(milestoneStudio),process):undefined;
  if(!studio)return;
  if(reservationEvent&&!isManagedDefenseLocation(process.defesa.local,operationalConfig(studio).reservation.locations))studio.emailTemplates=studio.emailTemplates.map(template=>template.id==='email-reserva'?{...template,recipient:normalizeEmail(process.orientador.email)}:template);
  const departmentEmail=reservationApproverEmail(process,studio);
  if(reservationEvent&&!departmentEmail)throw new Error('Informe o e-mail do responsável pela reserva de salas em Configurações → E-mails antes de cadastrar TCCs.');
  const customFormEvent=String(eventCode).match(/^FORM_(.+)_SUBMITTED$/i);
  if(customFormEvent){
    const latest=studioFormSubmissionsStore.filter(item=>item.processId===process.id&&item.formId===customFormEvent[1]).sort((a,b)=>b.submittedAt.localeCompare(a.submittedAt))[0];
    if(!latest||latest.archiveStatus!=='ARCHIVED')return;
  }
  const effectiveVariables={...(process.registrationAnswers||{}),...historicalStudioAnswers(process.id),...(extraVariables||{}),DEPARTAMENTO_EMAIL:configuredRoomReservationDepartmentEmail(studio),DEFESA_LOCAL:process.defesa.local,LOCAL_OUTRO_NOME:process.defesa.local,LOCAL_ALTERNATIVO:process.defesa.alternateLocation||'',RESERVATION_REVISION:process.defesa.reservationRevision||0,[REPOSITORY_DELIVERY_READY]:repositoryDeliveryReady(process,signatureJobsStore)};
  const recordRun=(run:WorkflowRun)=>{
    const index=workflowRunsStore.findIndex(item=>item.id===run.id);
    if(index>=0)workflowRunsStore[index]=run;else workflowRunsStore.push(run);
  };
  const run=await executeWorkflowEvent(studio,{process,eventCode,actorEmail,actorRoles:getActiveProcessRoles(actorEmail,process.id),extraVariables:effectiveVariables,completedActions:resumeRun?.actions,preserveActionIdentity:Boolean(resumeRun&&resumeRun.sourceDataRevision===process.dataRevision&&resumeRun.studioRevision===studio.revision)},{
    checkpointBeforeAction:normalizedEvent==='LOCATION_CONFIRMED'?async checkpoint=>{
      recordRun(checkpoint);
      await persistPortalStateDurably();
    }:undefined,
    createDocument:async({template,idempotencyKey,variables})=>executeConfiguredDocumentAction(process,template,actorEmail,idempotencyKey,variables,eventCode),
    createFormTask:async({form,idempotencyKey})=>({externalId:`form_task_${String(form.id||idempotencyKey)}`}),
    resolveEmailRecipients:({template,recipients})=>{
      const templateId=workflowEmailTemplateId(template.id);
      const selected=selectedEmailAudience(process,templateId,studio);
      if(selected?.to)return selected.to;
      if(isReservationDecisionEmail(templateId))return currentReservationReceiptRecipients(process);
      return ['email-reserva','email-resposta-departamento'].includes(templateId)?[reservationApproverEmail(process,studio)]:operationalEmailRecipients(templateId,process,configuredRoomReservationDepartmentEmail(studio),recipients,currentSettings.commissionPresidentEmail);
    },
    sendEmail:async({template,to,subject,text,html,eventVariables,idempotencyKey})=>{
      const templateId=workflowEmailTemplateId(template.id);
      const recipient=to[0];
      if(templateId==='email-convite'&&(normalizedEvent!=='LOCATION_CONFIRMED'||!processesStore.includes(process)
        ||!process.defesa.invitationDriveFileId||currentReservationArchive(process,formArchiveJobsStore)?.status!=='ARCHIVED')){
        throw new Error('O convite aguarda a carta e a confirmação arquivada deste agendamento.');
      }
      if(templateId==='email-reserva'){
        const configured=reservationApproverEmail(process,studio);
        const recipients=[...new Set(to.map(normalizeEmail).filter(Boolean))];
        if(!configured)throw new Error('O e-mail do Departamento de Enfermagem não está configurado no modelo de e-mail.');
        if(recipients.length!==1||recipients[0]!==configured)throw new Error('Envio de reserva bloqueado: o destinatário diverge do responsável definido para o local escolhido.');
      }
      // The old single-To invitation used the first examiner in the action key.
      // Retain that record on retry even if the board's sort order changed.
      const previousInvitation=templateId==='email-convite'
        ?emailDeliveriesStore.find(record=>record.processId===process.id&&record.templateId===templateId
          &&record.idempotencyKey===`${idempotencyKey}:${record.recipient}`)
        :undefined;
      if(previousInvitation?.status==='ACCEPTED_BY_GMAIL')return {externalId:previousInvitation.id};
      if(eventCode==='LOCATION_CONFIRMED'&&process.defesa.invitationSentAt){
        const accepted=emailDeliveriesStore.find(record=>record.processId===process.id&&record.templateId===templateId
          &&record.recipient===normalizeEmail(recipient)&&record.status==='ACCEPTED_BY_GMAIL');
        if(accepted)return {externalId:accepted.id};
      }
      const attachments=await resolveWorkflowEmailAttachments(process,template);
      const record=await sendTrackedPortalEmail({
        process,requestedBy:actorEmail,recipient:previousInvitation?.recipient||recipient,
        cc:templateId==='email-reserva'?reservationCopies(process,recipient):to.slice(1),
        subject,text,html,templateId,workflowEventCode:eventCode,workflowEventVariables:eventVariables,
        idempotencyKey:previousInvitation?.idempotencyKey||`${idempotencyKey}:${recipient}`,attachments
      });
      if(record.status!=='ACCEPTED_BY_GMAIL'){
        throw Object.assign(new Error('Um ou mais e-mails do fluxo aguardam nova tentativa.'),{externalId:record.id});
      }
      return {externalId:record.id};
    },
    executeSystemAction:async({action})=>{throw new Error(`A ação interna “${action.title}” não possui executor publicado. Use uma ação de formulário, documento ou e-mail.`);}
  });
  recordRun(run);
  if(run.status!=='COMPLETED')auditLogsStore.push({id:`log-${Date.now()}-workflow`,processId:process.id,actorEmail,actorRoles:getUserRolesForEmail(actorEmail).globalRoles,action:'FLUXO_CONFIGURADO_COM_PENDENCIA',entityType:'workflow_run',entityId:run.id,after:{eventCode,status:run.status,issues:run.issues,actions:run.actions},timestamp:new Date().toISOString()});
  if(normalizedEvent==='LOCATION_CONFIRMED')await persistPortalStateDurably();else persistPortalState();
  return run;
}
function recoverableInvitation(processes:readonly ProcessData[]){
  const studio=currentSettings.integrationStudio;
  return selectConfirmedInvitationRecovery({processes,runs:workflowRunsStore,archives:formArchiveJobsStore,
    emails:emailDeliveriesStore,signatures:signatureJobsStore,studioRevision:studio?.revision,studio,
    departmentEmail:configuredRoomReservationDepartmentEmail(studio),presidentEmail:currentSettings.commissionPresidentEmail});
}
function recoverableAtaSignature(process:ProcessData){
  const intent=process.astenSignatureIntent;
  const revision=signatureDocumentRevision(process,'ATA');
  if(!automaticAstenEnabled('ATA')||intent?.documentType!=='ATA'||intent.revision!==revision
    ||process.signatureProviderPreferences?.ATA==='GOV_BR'||process.legacyRecord
    ||workflowRetryBlocker(process,'EVALUATION_SUBMITTED',signatureJobsStore)
    ||signatureJobsStore.some(job=>job.processId===process.id&&job.documentType==='ATA'&&job.sourceDataRevision===revision))return;
  return intent;
}

function pendingReservationRecovery(process:ProcessData){
  const defense=process.defesa;
  if(!defense||defense.localStatus!=='PENDENTE'||defense.departmentResponse||defense.invitationSentAt||defense.invitationDriveFileId||!defense.reservationRequestRecipient)return null;
  return {recipient:defense.reservationRequestRecipient,local:defense.local,startAt:defense.startAt,dataRevision:process.dataRevision};
}
function workflowOperationsOverview(processId?:string,view='recovery'){
  const selectedProcesses=processId?processesStore.filter(process=>process.id===processId):processesStore;
  const scoped=<T extends {processId?:string}>(items:T[])=>processId?items.filter(item=>item.processId===processId):items;
  const studio=currentSettings.integrationStudio;
  const queue=view==='reminders'?[]:buildRecoveryQueue({processes:selectedProcesses,runs:scoped(workflowRunsStore),jobs:scoped(signatureJobsStore),emails:scoped(emailDeliveriesStore),forms:scoped(formArchiveJobsStore),customForms:scoped(studioFormSubmissionsStore)});
  if(view!=='reminders'&&processId){
    const selected=selectedProcesses[0];
    const ataIntent=selected&&recoverableAtaSignature(selected);
    if(ataIntent){
      queue.unshift({id:selected.id,kind:'ATA_SIGNATURE',processId,protocol:selected.protocolo,
        title:'Assinatura da ata pela ASTEN',state:'PENDING',
        reason:'A ata foi registrada. O envio da solicitação de assinatura ainda está pendente.',
        retryPath:`/api/admin/workflow/ata-signatures/${encodeURIComponent(selected.id)}/retry`,
        actionLabel:'Disparar assinatura da ata pela ASTEN',completedActions:['Conceito e ata registrados']});
    }
    const recovery=recoverableInvitation(selectedProcesses);
    if(recovery){
      const archived=recovery.archive.status==='ARCHIVED';
      for(let index=queue.length-1;index>=0;index--){
        const item=queue[index];
        if(item.kind==='WORKFLOW'&&item.id===recovery.run?.id||item.kind==='FORM_ARCHIVE'&&item.id===recovery.archive.id)queue.splice(index,1);
      }
      queue.unshift({id:recovery.archive.id,kind:'INVITATION',processId,protocol:recovery.process.protocolo,
        title:'Convite à banca',state:'PENDING',reason:'A reserva está confirmada. Conclua o envio da carta-convite aos examinadores e as cópias previstas no fluxo.',
        retryPath:`/api/admin/workflow/invitations/${encodeURIComponent(recovery.archive.id)}/retry`,
        actionLabel:archived?'Disparar convite à banca':'Arquivar comprovante e retomar convite',completedActions:[archived?'Confirmação do local arquivada':'Reserva confirmada',
          ...(recovery.process.defesa.invitationDriveFileId?['Carta-convite gerada']:[])]});
    }
  }
  let deadlines:ReturnType<typeof plannedDeadlines>=[],planningError:string|undefined;
  try{deadlines=plannedDeadlines(selectedProcesses,signatureJobsStore,workflowPolicy(studio),studio?.operationsPolicy?.timezone||'America/Sao_Paulo');}
  catch(error){planningError=error instanceof Error?error.message:'Não foi possível calcular os prazos publicados.';}
  return {processId,protocol:selectedProcesses[0]?.protocolo,pendingReservation:processId&&selectedProcesses[0]?pendingReservationRecovery(selectedProcesses[0]):null,studioRevision:studio?.revision||0,queueTotal:queue.length,queue:queue.slice(0,500),deadlineTotal:deadlines.length,deadlineOverdueTotal:deadlines.filter(item=>item.overdue).length,deadlines:deadlines.slice(0,500),reminders:scoped(reminderRecordsStore).slice().sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||'')).slice(0,200).map(item=>({...item,protocol:selectedProcesses.find(process=>process.id===item.processId)?.protocolo})),planningError};
}
async function runWorkflowMaintenance(processId?:string){
  const selectedProcesses=processId?processesStore.filter(process=>process.id===processId):processesStore;
  const now=new Date(),studio=currentSettings.integrationStudio,policy=workflowPolicy(studio);
  const previousDraftCount=Object.keys(registrationDraftsStore).length;if(!processId)registrationDraftsStore=pruneDrafts(registrationDraftsStore,now);
  // Resolve only acknowledgements already persisted by Gmail; an ambiguous send
  // remains visible and never becomes an automatic new delivery.
  for(const record of reminderRecordsStore.filter(item=>item.status!=='SENT'&&(!processId||item.processId===processId))){
    const accepted=emailDeliveriesStore.find(item=>item.idempotencyKey===`reminder:${record.id}`&&item.status==='ACCEPTED_BY_GMAIL');
    if(accepted){record.status='SENT';record.sentAt=accepted.attempts.at(-1)?.completedAt;record.error=undefined;}
  }
  const existingAtaJobs=new Set(signatureJobsStore.filter(job=>job.documentType==='ATA').map(job=>`${job.processId}:${job.sourceDataRevision}`));
  for(const process of selectedProcesses){
    if(process.legacyRecord||process.status!=='AGUARDANDO_ASSINATURA'||process.astenSignatureIntent
      ||process.avaliacao.status!=='CONCLUIDO'||!process.avaliacao.submittedAt||process.signatureProviderPreferences?.ATA!=='ASTEN'
      ||existingAtaJobs.has(`${process.id}:${signatureDocumentRevision(process,'ATA')}`))continue;
    if(isConceptRegistrationReleased(process))queueAutomaticAsten(process,'ATA');
  }
  await persistPortalStateDurably();
  const workStartedAt=Date.now();
  const result={expiredDrafts:previousDraftCount-Object.keys(registrationDraftsStore).length,sent:0,failed:0,configurationErrors:[] as string[],deferred:false,archivedWorkflows:{retried:0,pending:0}};
  // Resume one recorded transient reservation/document failure through its original
  // archive + configured workflow. No new event or academic state is invented.
  const reservationRecovery=selectConfirmedInvitationRecovery({processes:selectedProcesses,runs:workflowRunsStore,archives:formArchiveJobsStore,
    emails:emailDeliveriesStore,signatures:signatureJobsStore,studioRevision:studio?.revision,studio,departmentEmail:configuredRoomReservationDepartmentEmail(studio),presidentEmail:currentSettings.commissionPresidentEmail});
  if(reservationRecovery){
    const {process,run,archive}=reservationRecovery;
    try{
      const archived=await retryExistingFormArchiveJob(archive,process);
      const stillCurrent=selectConfirmedInvitationRecovery({processes:[process],runs:workflowRunsStore,archives:formArchiveJobsStore,
        emails:emailDeliveriesStore,signatures:signatureJobsStore,studioRevision:currentSettings.integrationStudio?.revision,studio:currentSettings.integrationStudio,departmentEmail:configuredRoomReservationDepartmentEmail(),presidentEmail:currentSettings.commissionPresidentEmail});
      if(archived.status==='ARCHIVED'&&processesStore.includes(process)&&stillCurrent&&stillCurrent.run===run&&stillCurrent.archive===archive){
        await resumeWorkflowAfterNativeFormArchive(process,'CONFIRMACAO_LOCAL',reservationRecovery.actorEmail,run);
      }
      if(!process.defesa.invitationSentAt)result.configurationErrors.push(`${process.protocolo}: a confirmação e o convite ainda aguardam conclusão no fluxo normal.`);
    }catch{result.configurationErrors.push(`${process.protocolo}: a retomada da confirmação e do convite permanece pendente.`);}
  }
  const pendingArchives=signatureJobsStore.filter(job=>job.status==='ARCHIVED'&&job.postArchivePending&&(!processId||job.processId===processId)).sort((a,b)=>a.updatedAt.localeCompare(b.updatedAt));
  for(const job of pendingArchives.slice(0,3)){
    if(Date.now()-workStartedAt>20_000){result.deferred=true;break;}
    await finishArchivedSignature(job,'system@portal.local');
    result.archivedWorkflows.retried++;
    if(job.postArchivePending)result.archivedWorkflows.pending++;
  }
  {
    const pendingSignatures=selectedProcesses.filter(process=>process.astenSignatureIntent&&automaticAstenEnabled(process.astenSignatureIntent.documentType)).sort((a,b)=>{
      const left=a.astenSignatureIntent!,right=b.astenSignatureIntent!;
      return (left.attemptedAt||left.queuedAt).localeCompare(right.attemptedAt||right.queuedAt);
    });
    for(const process of pendingSignatures.slice(0,3)){
      if(Date.now()-workStartedAt>20_000){result.deferred=true;break;}
      const intent=process.astenSignatureIntent!;
      try{
        if(intent.documentType!=='ATA'){
          if(!canRecoverRepositorySignature(process,signatureJobsStore,automaticAstenEnabled(intent.documentType)))continue;
          const event=repositorySignatureEvent(intent.documentType);
          const recorded=workflowRunsStore.filter(run=>run.processId===process.id&&run.eventCode===event&&run.sourceDataRevision===process.dataRevision)
            .slice().sort((a,b)=>b.startedAt.localeCompare(a.startedAt))[0];
          const studioRevision=studio?.revision||0;
          if((intent.studioRevision!==undefined&&intent.studioRevision!==studioRevision)||(recorded&&recorded.studioRevision!==studioRevision))continue;
          try{assertSignatureEligibility(process,intent.documentType);}catch{continue;}
          intent.attemptedAt=new Date().toISOString();delete intent.lastError;delete intent.lastErrorCode;
          await persistPortalStateDurably();
          if(!processesStore.includes(process)||process.astenSignatureIntent!==intent||process.dataRevision!==intent.revision)continue;
          const actor=recorded?.actorEmail||process.acervo?.submittedBy||'system@portal.local';
          const run=await executeConfiguredWorkflowEvent(process,event,actor,recorded?.eventVariables,recorded);
          if(!processesStore.includes(process)||process.astenSignatureIntent!==intent||process.dataRevision!==intent.revision)continue;
          if(!run||run.status!=='COMPLETED'){
            Object.assign(intent,safeRepositorySignatureError(undefined,true));
            await persistPortalStateDurably();
            result.configurationErrors.push(`${process.protocolo}: uma ação do fluxo publicado permanece pendente antes da assinatura.`);
            continue;
          }
          await executeAutomaticAsten(process,intent.documentType,actor);
        }else await executeAutomaticAsten(process,intent.documentType,'system@portal.local');
      }
      catch(error){
        if(process.astenSignatureIntent!==intent||!processesStore.includes(process))continue;
        intent.attemptedAt=new Date().toISOString();
        if(intent.documentType!=='ATA')Object.assign(intent,safeRepositorySignatureError(error));
        result.configurationErrors.push(`${process.protocolo}: ${error instanceof Error?error.message:'A assinatura Asten aguarda nova tentativa.'}`);
        await persistPortalStateDurably();
      }
    }
  }
  if(!studio)return result;
  const validation=validateCourseStudio(studio);if(!validation.ready){result.configurationErrors.push(...validation.issues.filter(issue=>issue.severity==='ERROR'&&(issue.area==='WORKFLOW'||issue.area==='EMAIL'||issue.area==='OPERATIONS')).slice(0,20).map(issue=>issue.message));return result;}
  const plans=plannedDeadlines(selectedProcesses,signatureJobsStore,policy,studio.operationsPolicy?.timezone||'America/Sao_Paulo',now);
  for(const plan of plans){
    if(!plan.overdue)continue;
    const portalProcess=selectedProcesses.find(p=>p.id===plan.processId);if(!portalProcess)continue;
    let mail:ReturnType<typeof renderReminder>;
    try{mail=renderReminder(bindReservationContact(studio,configuredRoomReservationDepartmentEmail()),portalProcess,plan.rule.emailTemplateId,plan.label,plan.dueDate,historicalStudioAnswers(portalProcess.id));}
    catch(error){result.configurationErrors.push(`${plan.protocol}: ${error instanceof Error?error.message:'Lembrete inválido.'}`);continue;}
    for(const recipient of mail.to){
      if(result.sent+result.failed>=20||Date.now()-now.getTime()>45000){result.deferred=true;return result;}
      const claim=claimableReminder(plan,recipient,reminderRecordsStore,policy,now);if(!claim)continue;
      reminderRecordsStore.push(claim);
      // Optimistic Supabase commit is a cross-instance claim. A revision
      // conflict aborts before contacting Gmail, preventing duplicate sends.
      await persistPortalStateDurably();
      try{
        const delivery=await sendTrackedPortalEmail({process:portalProcess,recipient,subject:mail.subject,text:mail.text,html:mail.html,templateId:plan.rule.emailTemplateId,idempotencyKey:`reminder:${claim.id}`});
        claim.status=delivery.status==='ACCEPTED_BY_GMAIL'?'SENT':'FAILED';claim.sentAt=claim.status==='SENT'?new Date().toISOString():undefined;claim.error=claim.status==='FAILED'?delivery.attempts.at(-1)?.errorMessage:undefined;
      }catch(error){claim.status='FAILED';claim.error=error instanceof Error?error.message:'Falha no envio.';}
      if(claim.status==='SENT')result.sent++;else result.failed++;
      await persistPortalStateDurably();
    }
  }
  return result;
}
function deriveSignatureSigners(p:ProcessData,type:'ATA'|'TERMO'|'DECLARACAO'){
  return registeredSignatureSigners(p,type,currentSettings);
}
function assertSignatureEligibility(p:ProcessData,type:'ATA'|'TERMO'|'DECLARACAO'):void{
  assertRegisteredSignatureEligibility(p,type,signatureJobsStore);
}
const signatureJobCreationLocks=new Map<string,Promise<SignatureJob>>();
const signatureDocumentCreationLocks=new Map<string,Promise<SignatureJob>>();
async function createSignatureJobUnlocked(p:ProcessData,type:'ATA'|'TERMO'|'DECLARACAO',actor:string,renderVariables:Record<string,string>={},provider:'ASTEN'|'GOV_BR'='ASTEN'):Promise<SignatureJob>{
  assertDocumentSignatureOpen(p,type,signatureJobsStore);
  assertSignatureEligibility(p,type);
  const revision=signatureDocumentRevision(p,type);
  if(type==='ATA'&&p.avaliacao.documentText)renderVariables={...renderVariables,ATA_TEXTO_INTEGRAL:p.avaliacao.documentText};
  if(provider==='GOV_BR'){
    const existing=signatureJobsStore.find(job=>job.processId===p.id&&job.documentType===type&&job.provider==='GOV_BR'&&signatureJobMatchesCurrentRevision(p,job));
    if(existing){assertCurrentSignatureRecipients(p,type,existing,currentSettings);return existing;}
  }
  // Repetir o botão recupera a mesma versão, inclusive quando o resultado do provedor é incerto.
  // Não renderizar outro PDF (com metadados voláteis) e gerar outra chave para contornar a outbox.
  if(provider==='ASTEN'){
    const existing=reusableAstenSignatureJob(signatureJobsStore,p.id,type,revision);
    if(existing){assertCurrentSignatureRecipients(p,type,existing,currentSettings);return existing;}
  }
  if(type==='ATA'&&p.coorientador&&typeof p.avaliacao.coadvisorPresent!=='boolean')throw new Error('Confirme na ata se o coorientador participou da sessão antes de preparar uma nova solicitação de assinatura. Atas já registradas exigem reabertura formal pelo fluxo normal.');
  if(type==='ATA'&&getSupabaseRuntimeStatus().durablePersistenceReady){
    const schema=await getSupabaseRuntimeConnectionStatus();
    if(!schema.signatureSignerRolesReady)throw new Error('O banco ainda não suporta os examinadores da ata. O Master precisa aplicar a migração de compatibilidade das assinaturas antes de gerar o documento.');
    if(p.avaliacao.coadvisorPresent===true&&!schema.signatureCoadvisorRoleReady)throw new Error('O banco ainda não suporta a assinatura do coorientador participante. O Master precisa aplicar a migração de compatibilidade antes de gerar o documento.');
  }
  const signatureStudio=currentSettings.integrationStudio?structuredClone(currentSettings.integrationStudio):undefined;
  const explicitSignatureSelection=signatureStudio?.docTemplates.some(item=>resolveSignatureTemplateType(item)===type&&item.signatureRecipientRoles!==undefined);
  const reviewedPolicy=type==='ATA'?p.avaliacao.reviewedAta?.signaturePolicySnapshot:undefined;
  if(type==='ATA'&&p.avaliacao.reviewedAta&&!reviewedPolicy&&explicitSignatureSelection)throw new Error('A política de assinaturas mudou. Reabra a ata pelo fluxo normal e confira a nova versão antes de enviá-la.');
  const signers=reviewedPolicy?signatureSignersFromSnapshot(reviewedPolicy):deriveSignatureSigners(p,type);
  const signerPolicySnapshot=reviewedPolicy||captureSignaturePolicySnapshot(p,type,currentSettings,signers);
  assertCurrentSignatureRecipients(p,type,{signers,signerPolicySnapshot},currentSettings);
  if(signers.some(s=>!isValidPortalEmail(s.email)))throw new Error(`${p.protocolo}: signatário sem e-mail válido.`);
  const destination=provider==='ASTEN'?await getPersistentAstenConnection():null;
  const providerFolderId=provider==='ASTEN'?await resolveAstenDocumentFolder(type):undefined;
  const providerRepositoryId=destination?.repositoryId;
  const documentVersion=1+Math.max(0,...signatureJobsStore.filter(j=>j.processId===p.id&&j.documentType===type).map(j=>j.documentVersion));
  const reviewedAta=type==='ATA'?p.avaliacao.reviewedAta:undefined;
  const verificationCode=reviewedAta?.verificationCode||buildDocumentVerificationCode(p,type,documentVersion);
  const documentTitle=type==='ATA'?'Ata oficial da defesa':type==='TERMO'?'Termo de autorização e publicação':'Declaração de participação';
  const pdf=await renderOfficialTemplatePdf(p,type,verificationCode,renderVariables,signatureStudio,undefined,undefined,undefined,explicitSignatureSelection?signers:undefined);
  const contentSha256=createHash('sha256').update(pdf).digest('hex');
  const signerHash=signers.map(s=>`${s.role}:${s.email}:${s.signingOrder}`).join('|');
  const authenticationProfile=getAstenSigningProfile();
  const baseIdempotencyKey=createHash('sha256').update(`${p.id}|${type}|${provider}|${authenticationProfile}|${providerRepositoryId||''}|${providerFolderId||''}|${revision}|${contentSha256}|${signerHash}`).digest('hex');
  const idempotencyKey=signatureJobsStore.some(job=>job.idempotencyKey===baseIdempotencyKey&&job.removedFromLogsAt)?createHash('sha256').update(`${baseIdempotencyKey}|replacement:${documentVersion}`).digest('hex'):baseIdempotencyKey;
  const existing=signatureJobsStore.find(j=>j.idempotencyKey===idempotencyKey&&!j.removedFromLogsAt);if(existing)return existing;
  const now=new Date().toISOString();const studentNames=[p.aluno1.nome,p.aluno2?.nome].filter(Boolean) as string[];
  const job:SignatureJob={id:`sig_${idempotencyKey.slice(0,24)}`,processId:p.id,protocol:p.protocolo,documentType:type,...(type==='ATA'?{ataSignerPolicy:'BOARD_AUTHORS_V1' as const}:{}),documentTitle,documentVersion,sourceDataRevision:revision,fileName:buildPortalDriveFileName({protocol:p.protocolo,title:p.titulo,studentNames,documentType:type,version:documentVersion,lifecycle:'GERADO'}),mimeType:'application/pdf',contentSha256,idempotencyKey,status:provider==='GOV_BR'?'READY_FOR_REVIEW':'QUEUED',signers,signerPolicySnapshot,createdAt:now,createdBy:actor,updatedAt:now,provider,providerCreationState:provider==='ASTEN'?'PENDING':undefined,providerAuthenticationProfile:authenticationProfile,verificationCode,renderVariables:{...renderVariables}};
  if(provider==='ASTEN'){job.providerRepositoryId=providerRepositoryId;job.providerFolderId=providerFolderId;}
  if(localDocumentModelsEnabled())job.driveUnsignedFileId=storeLocalGovbrPdf(pdf);
  else{
    const {accessToken,folderId}=await ensureWorkflowProcessFolder(p);
    const uploaded=await uploadGeneratedPdfToDrive({rootFolderId:currentSettings.driveRootFolderId,protocol:p.protocolo,accessToken,processFolderId:folderId,processId:p.id,jobId:job.id,documentType:type,fileName:job.fileName,pdf,sha256:contentSha256});
    job.driveUnsignedFileId=String(uploaded.id);
  }
  signatureJobsStore.push(job);
  recordSignatureAudit(auditLogsStore,p,job,actor,'DOCUMENT_PREPARED');
  try{await persistPortalStateDurably();}
  catch(error){
    // PostgreSQL check violations abort the transaction. Do not retain an uncommitted
    // job that would poison every subsequent save; preserve the process intent.
    if(error instanceof Error&&/23514/.test(error.message)){
      const index=signatureJobsStore.indexOf(job);if(index>=0)signatureJobsStore.splice(index,1);
      const logIndex=auditLogsStore.findIndex(log=>log.id===`signature:${job.id}:DOCUMENT_PREPARED`);if(logIndex>=0)auditLogsStore.splice(logIndex,1);
    }
    throw error;
  }
  return job;
}
async function createSignatureJob(p:ProcessData,type:'ATA'|'TERMO'|'DECLARACAO',actor:string,renderVariables:Record<string,string>={},provider:'ASTEN'|'GOV_BR'='ASTEN'):Promise<SignatureJob>{
  const revision=signatureDocumentRevision(p,type);
  const lockKey=`${p.id}|${type}|${provider}|${revision}`;
  const inFlight=signatureJobCreationLocks.get(lockKey);
  if(inFlight)return inFlight;
  const documentKey=`${p.id}|${type}|${revision}`;
  const previous=signatureDocumentCreationLocks.get(documentKey);
  const task=(async()=>{await previous?.catch(()=>undefined);return createSignatureJobUnlocked(p,type,actor,renderVariables,provider);})().finally(()=>{
    signatureJobCreationLocks.delete(lockKey);
    if(signatureDocumentCreationLocks.get(documentKey)===task)signatureDocumentCreationLocks.delete(documentKey);
  });
  signatureDocumentCreationLocks.set(documentKey,task);
  signatureJobCreationLocks.set(lockKey,task);
  return task;
}
const signatureDispatchLocks=new Set<string>();
async function dispatchSignatureJobAutomatically(job:SignatureJob):Promise<SignatureJob>{
  if(signatureDispatchLocks.has(job.id))return job;
  signatureDispatchLocks.add(job.id);
  try{return await dispatchSignatureJobUnlocked(job);}
  finally{signatureDispatchLocks.delete(job.id);}
}
type AstenDispatchStage='READINESS'|'DESTINATION'|'SIGNER_CONTACTS'|'GOOGLE_AUTH'|'DRIVE_FOLDER'|'PDF_READ'|'PDF_UPLOAD'|'PERSIST_ARTIFACT'|'CLAIM'|'START_CREATE'|'PERSIST_CREATE'|'PROVIDER_CREATE'|'PERSIST_ENVELOPE'|'PROVIDER_VERIFY'|'PERSIST_SEND'|'PROVIDER_SEND'|'CONFIRM_DISPATCH';
function astenDispatchFailure(stage:AstenDispatchStage,error:unknown):string{
  const descriptions:Partial<Record<AstenDispatchStage,string>>={READINESS:'conferir a fila privada de retornos',DESTINATION:'validar a pasta de destino ASTEN',SIGNER_CONTACTS:'conferir os contatos autorizados dos signatários',GOOGLE_AUTH:'confirmar o acesso ao Google Drive',DRIVE_FOLDER:'confirmar a pasta privada do processo',PDF_READ:'obter e conferir o PDF original',PDF_UPLOAD:'arquivar o PDF original no Drive',PERSIST_ARTIFACT:'confirmar o arquivo no banco durável',CLAIM:'confirmar a reserva exclusiva do envelope',PERSIST_CREATE:'confirmar a preparação durável antes da criação do envelope',PERSIST_ENVELOPE:'confirmar a identidade do envelope no banco durável',PROVIDER_VERIFY:'conferir o destino e os signatários do envelope',PERSIST_SEND:'confirmar a preparação durável antes do encaminhamento'};
  const timeout=error instanceof Error&&(error.name==='AbortError'||error.name==='TimeoutError'||/\baborted\b|\btimeout\b|tempo.*(?:exced|esgot)/i.test(error.message));
  const description=stage==='START_CREATE'?'confirmar o início exclusivo da criação do envelope':descriptions[stage];
  if(timeout&&description)return `[${stage}] O prazo terminou ao ${description}. A solicitação existente foi preservada; confira a integração antes de retomar.`;
  return error instanceof Error?error.message:'Falha no envio à ASTEN.';
}
async function dispatchSignatureJobUnlocked(job:SignatureJob):Promise<SignatureJob>{
  if(job.status==='CANCELED'||!processesStore.some(p=>p.id===job.processId))return job;
  if(job.status==='DRIVE_SYNC_PENDING')return archiveSignatureJobAutomatically(job);
  // Se a instância caiu após solicitar o encaminhamento, NÃO solicitar novamente.
  if(job.providerEnvelopeId&&['SENDING','UNCERTAIN'].includes(job.providerDispatchState||'')){
    job.providerDispatchState='UNCERTAIN';
    job.status='PROVIDER_ERROR';
    job.lastError='Resultado do encaminhamento Asten incerto. Consulte o envelope na Asten; não reenviar automaticamente.';
    job.updatedAt=new Date().toISOString();
    await persistPortalStateDurably();
    return job;
  }
  if(job.removedFromLogsAt||['SENT','PARTIALLY_SIGNED','SIGNED','ARCHIVED'].includes(job.status))return job;
  const currentProcess=processesStore.find(item=>item.id===job.processId);
  try{
    if(!currentProcess||!signatureJobMatchesCurrentRevision(currentProcess,job))throw new Error('A solicitação de assinatura não pertence à versão atual do documento.');
    if(hasCompetingSignatureArchive(currentProcess,job,signatureJobsStore))throw new Error('Esta versão já foi arquivada por outra solicitação.');
    assertCurrentSignatureRecipients(currentProcess,job.documentType,job,currentSettings);
  }catch(error){job.status='PROVIDER_ERROR';job.lastError=error instanceof Error?error.message:'Confira o destinatário atual.';job.updatedAt=new Date().toISOString();await persistPortalStateDurably();return job;}
  if(job.providerCreationState==='UNCERTAIN'&&!job.providerEnvelopeId){job.status='PROVIDER_ERROR';job.lastError='A criação do envelope ficou com resultado incerto. Não repita automaticamente: confira a conta Asten e faça a reconciliação administrativa.';job.updatedAt=new Date().toISOString();return job;}
  // O interruptor de envios é verificado ANTES de renderizar PDF, criar arquivo no Drive
  // ou reivindicar um envelope. Conectar a conta nunca libera disparos automaticamente.
  const dispatchPreflight=await getPersistentAstenStatus();
  if(!dispatchPreflight.dispatchEnabled){
    job.status='WAITING_INTEGRATION';
    job.lastError='Envio Asten desativado ou sem autorização para o piloto. A conexão de leitura continua disponível.';
    job.updatedAt=new Date().toISOString();
    await persistPortalStateDurably();
    return job;
  }
  const connection=await getPersistentAstenConnection();
  if(!connection){job.status='WAITING_INTEGRATION';job.lastError='Conecte a conta Asten em Configurações para concluir o envio.';job.updatedAt=new Date().toISOString();await persistPortalStateDurably();return job;}
  let dispatchStage:AstenDispatchStage='READINESS';
  try{
    if(!await astenWebhookInboxReady())throw new Error('A fila privada de retornos Asten não está disponível. Confira a integração antes de enviar.');
    // Envelopes históricos enviados continuam legíveis. Novos despachos exigem
    // um destino confirmado e preservam a escolha registrada para esta versão.
    dispatchStage='DESTINATION';
    if(!job.providerFolderId&&!job.providerEnvelopeId){job.providerFolderId=await resolveAstenDocumentFolder(job.documentType);job.providerRepositoryId=connection.repositoryId;}
    if(!job.providerFolderId||!job.providerRepositoryId)throw new Error('Este envelope legado não possui uma pasta confirmada. Organize-o na Asten antes de retomar o envio.');
    await validateAstenDocumentFolder(job.providerFolderId,job.providerRepositoryId);
    // Read-only preparation does not need another aggregate commit. The durable
    // claim and CREATING barrier below still precede any ASTEN creation request.
    job.status='SENDING';job.lastError=undefined;job.updatedAt=new Date().toISOString();
    const process=processesStore.find(item=>item.id===job.processId);if(!process)throw new Error('Processo do documento não encontrado.');
    const authenticationProfile=job.providerAuthenticationProfile||getAstenSigningProfile();
    dispatchStage='SIGNER_CONTACTS';
    const signerPhones=authenticationProfile==='CONFIDENTIAL_SMS'?await getAstenSignerPhones():{};
    if(authenticationProfile==='CONFIDENTIAL_SMS'&&job.signers.some(signer=>!signerPhones[signer.email]))throw new Error('Celular autorizado ausente para um dos signatários. Configure os contatos antes de criar o envelope Asten.');
    dispatchStage='GOOGLE_AUTH';
    const googleAccessToken=await getGoogleWorkspaceAccessToken();
    if(!currentSettings.driveRootFolderId)throw new Error('Pasta raiz do Google Drive não configurada.');
    dispatchStage='DRIVE_FOLDER';
    if(!process.driveFolderId){const folder=await ensurePortalProcessDriveFolder({accessToken:googleAccessToken,rootFolderId:currentSettings.driveRootFolderId,protocol:process.protocolo,processId:process.id});process.driveFolderId=folder.id;process.driveFolderUrl=folder.webViewLink;process.driveSyncedAt=new Date().toISOString();}
    dispatchStage='PDF_READ';
    let artifactPdf:Buffer;
    if(job.artifactBase64)artifactPdf=Buffer.from(job.artifactBase64,'base64');
    else if(job.driveUnsignedFileId)artifactPdf=(await downloadDrivePdf(googleAccessToken,job.driveUnsignedFileId,{processId:process.id,artifactType:job.documentType,signatureJobId:job.id})).pdf;
    else {
      const frozenStudio=currentSettings.integrationStudio?structuredClone(currentSettings.integrationStudio):undefined;
      if(job.signerPolicySnapshot&&!job.signerPolicySnapshot.configured)for(const template of frozenStudio?.docTemplates||[])if(resolveSignatureTemplateType(template)===job.documentType)delete template.signatureRecipientRoles;
      artifactPdf=await renderOfficialTemplatePdf(process,job.documentType,job.verificationCode,job.renderVariables,frozenStudio,undefined,undefined,undefined,job.signerPolicySnapshot?.configured?job.signers:undefined);
    }
    const regeneratedHash=createHash('sha256').update(artifactPdf).digest('hex');if(regeneratedHash!==job.contentSha256)throw new Error('O PDF regenerado diverge do hash aprovado. Crie uma nova versão do documento.');
    if(!job.driveUnsignedFileId){dispatchStage='PDF_UPLOAD';const uploaded=await uploadGeneratedPdfToDrive({accessToken:googleAccessToken,processFolderId:process.driveFolderId,processId:process.id,jobId:job.id,documentType:job.documentType,fileName:job.fileName,pdf:artifactPdf,sha256:job.contentSha256});job.driveUnsignedFileId=String(uploaded.id);dispatchStage='PERSIST_ARTIFACT';await persistPortalStateDurably();}
    if(!job.providerEnvelopeId){
      // Confirm preparation before acquiring the short-lived external-effect
      // claim. A database failure here must not leave an unused claim that later
      // expires as UNCERTAIN despite no provider request having been attempted.
      dispatchStage='PERSIST_CREATE';job.providerCreationState='CREATING';await persistPortalStateDurably();
      dispatchStage='CLAIM';
      const claim=await claimAstenEnvelopeDispatch({idempotencyKey:job.idempotencyKey,jobId:job.id,contentSha256:job.contentSha256});
      if(claim.outcome==='BUSY'){job.status='SENDING';job.lastError='Outra instância já está criando este envelope.';job.updatedAt=new Date().toISOString();await persistPortalStateDurably();return job;}
      if(claim.outcome==='UNCERTAIN'){job.providerCreationState='UNCERTAIN';throw new Error('A criação anterior do envelope ficou com resultado incerto. Confira a Asten antes de qualquer nova tentativa.');}
      if((claim.outcome==='ALREADY_CREATED'||claim.outcome==='DISPATCHED')&&claim.providerEnvelopeId){
        job.providerEnvelopeId=claim.providerEnvelopeId;job.providerEnvelopeHash=claim.providerEnvelopeHash;job.providerCreationState='CONFIRMED';job.artifactBase64=undefined;
        if(claim.outcome==='DISPATCHED'){
          job.providerDispatchState='SENT';job.status='SENT';job.sentAt=job.updatedAt=new Date().toISOString();
        }
        dispatchStage='PERSIST_ENVELOPE';await persistPortalStateDurably();
        if(claim.outcome==='DISPATCHED')return job;
      }else{
        dispatchStage='START_CREATE';
        await startPreparedAstenEnvelopeDispatch({idempotencyKey:job.idempotencyKey,jobId:job.id,contentSha256:job.contentSha256,claimToken:claim.claimToken});
        let envelope:{id:string;hash?:string};
        try{
          dispatchStage='PROVIDER_CREATE';
          const creation=await callAsten('inserirEnvelope',buildAstenEnvelopeParams({description:`${job.protocol} - ${job.documentTitle}`,fileName:job.fileName,mimeType:job.mimeType,contentBase64:artifactPdf.toString('base64'),signers:job.signers.map(s=>({name:s.name,email:s.email,order:s.signingOrder,cellphone:signerPhones[s.email]})),repositoryId:job.providerRepositoryId,folderId:job.providerFolderId,authenticationProfile}),connection.token);
          envelope=extractAstenEnvelopeIdentity(creation);
        }catch(error){
          job.providerCreationState='UNCERTAIN';
          await updateAstenEnvelopeDispatch({idempotencyKey:job.idempotencyKey,state:'UNCERTAIN',claimToken:claim.claimToken,errorCode:'PROVIDER_CREATION_RESULT_UNKNOWN'}).catch(()=>undefined);
          throw new Error(`A Asten não confirmou se o envelope foi criado. O reenvio automático foi bloqueado para evitar duplicidade. ${error instanceof Error?error.message:''}`.trim());
        }
        await updateAstenEnvelopeDispatch({idempotencyKey:job.idempotencyKey,state:'ENVELOPE_CREATED',claimToken:claim.claimToken,providerEnvelopeId:envelope.id,providerEnvelopeHash:envelope.hash});
        job.providerEnvelopeId=envelope.id;job.providerEnvelopeHash=envelope.hash;job.providerCreationState='CONFIRMED';job.artifactBase64=undefined;dispatchStage='PERSIST_ENVELOPE';await persistPortalStateDurably();
      }
    }
    dispatchStage='PROVIDER_VERIFY';
    const savedDestination=await callAsten('getDadosEnvelope',{idEnvelope:job.providerEnvelopeId,getLobs:'N'},connection.token);
    assertAstenEnvelopeDestination(savedDestination,{envelopeId:job.providerEnvelopeId!,repositoryId:job.providerRepositoryId,folderId:job.providerFolderId});
    const savedSignerConfiguration=await callAsten('getSignatariosPorEnvelope',{idEnvelope:job.providerEnvelopeId},connection.token);
    assertAstenEnvelopeAuthentication(savedSignerConfiguration,job.signers.map(s=>({email:s.email,order:s.signingOrder,cellphone:signerPhones[s.email]})),authenticationProfile);
    job.providerDispatchState='SENDING';
    job.updatedAt=new Date().toISOString();
    dispatchStage='PERSIST_SEND';await persistPortalStateDurably();
    try{
      dispatchStage='PROVIDER_SEND';
      await callAsten('encaminharEnvelopeParaAssinaturas',{Envelope:{id:job.providerEnvelopeId}},connection.token);
    }catch(error){
      job.providerDispatchState='UNCERTAIN';
      await persistPortalStateDurably();
      throw new Error('A Asten não confirmou o encaminhamento. A repetição automática foi bloqueada para evitar envio duplicado.');
    }
    dispatchStage='CONFIRM_DISPATCH';
    await updateAstenEnvelopeDispatch({idempotencyKey:job.idempotencyKey,state:'DISPATCHED',providerEnvelopeId:job.providerEnvelopeId,providerEnvelopeHash:job.providerEnvelopeHash});
    job.providerDispatchState='SENT';
    job.status='SENT';job.sentAt=job.updatedAt=new Date().toISOString();
  }catch(error){job.status='PROVIDER_ERROR';job.lastError=astenDispatchFailure(dispatchStage,error);job.updatedAt=new Date().toISOString();}
  persistPortalState();return job;
}
function updateProcessCompletion(processId:string):void{
  const process=processesStore.find(item=>item.id===processId);if(!process)return;
  const latestByType=new Map<string,SignatureJob>();
  for(const type of ['TERMO','DECLARACAO']){const job=latestSignature(process,signatureJobsStore,type);if(job)latestByType.set(type,job);}
  const requiredTypes=publicationRequested(process)?['TERMO','DECLARACAO']:['DECLARACAO'];
  if(process.acervo?.submittedAt&&repositoryDataComplete(process)&&ataArchived(process,signatureJobsStore)&&requiredTypes.every(type=>{const job=latestByType.get(type);return job?.status==='ARCHIVED'&&Boolean(job.driveSignedFileId)&&job.sourceDataRevision===process.dataRevision;})) {
    process.etapaAtual='CONCLUIDO';process.status='CONCLUIDO';process.completedAt=process.completedAt||new Date().toISOString();process.updatedAt=process.completedAt;
  }
}
async function syncAuthorizedPublication(process:ProcessData,actorEmail:string):Promise<void>{
  if(!publicationRequested(process)){process.acervo={...process.acervo,publicationState:process.acervo?.publicationWithdrawnAt?'WITHDRAWN':'NOT_REQUESTED'};return;}
  if(!process.acervo?.authorizationConfirmedAt)throw new Error('A publicação foi solicitada, mas a autorização expressa não foi confirmada.');
  if(!process.driveFolderId)throw new Error('A pasta privada do processo ainda não está sincronizada com o Drive.');
  const accessToken=await getGoogleWorkspaceAccessToken();
  const next:NonNullable<ProcessData['acervo']>={...process.acervo,publicationState:'PENDING_SYNC'};
  if(process.acervo.publishFullWork){if(!process.acervo.trabalhoCompletoFileId)throw new Error('O PDF completo autorizado não está arquivado no Drive.');const published=await preparePrivatePublicationSource({accessToken,processFolderId:process.driveFolderId,sourceFileId:process.acervo.trabalhoCompletoFileId,processId:process.id,artifactType:'TRABALHO_COMPLETO',sha256:process.acervo.trabalhoCompletoSha256,version:process.acervo.trabalhoCompletoVersion});next.publicFullWorkFileId=published.id;next.publicFullWorkFileUrl=published.webViewLink;}
  if(process.acervo.publishExpandedAbstract){if(!process.acervo.resumoExpandidoFileId)throw new Error('O resumo expandido autorizado não está arquivado no Drive.');const published=await preparePrivatePublicationSource({accessToken,processFolderId:process.driveFolderId,sourceFileId:process.acervo.resumoExpandidoFileId,processId:process.id,artifactType:'RESUMO_EXPANDIDO',sha256:process.acervo.resumoExpandidoSha256,version:process.acervo.resumoExpandidoVersion});next.publicExpandedAbstractFileId=published.id;next.publicExpandedAbstractFileUrl=published.webViewLink;}
  const now=new Date().toISOString();next.publicationState='PUBLIC';next.publicationSyncedAt=now;process.acervo=next;
  const details={fullWork:next.publicFullWorkFileId?{fileId:next.publicFullWorkFileId,version:next.trabalhoCompletoVersion,sha256:next.trabalhoCompletoSha256}:null,expandedAbstract:next.publicExpandedAbstractFileId?{fileId:next.publicExpandedAbstractFileId,version:next.resumoExpandidoVersion,sha256:next.resumoExpandidoSha256}:null};
  auditLogsStore.push({id:`log-${Date.now()}-publish`,processId:process.id,actorEmail,actorRoles:getUserRolesForEmail(actorEmail).globalRoles,action:'PUBLICACAO_DRIVE_SINCRONIZADA',entityType:'publication',entityId:process.id,after:details,timestamp:now});
}

function storeLocalGovbrPdf(pdf:Buffer):string{
  if(!localDocumentModelsEnabled())throw new Error('Armazenamento de demonstração indisponível.');
  const sha256=createHash('sha256').update(pdf).digest('hex');
  const directory=path.join(portalDataDirectory,'govbr-pdfs');mkdirSync(directory,{recursive:true,mode:0o700});
  writeFileSync(path.join(directory,`${sha256}.pdf`),pdf,{mode:0o600});return `local_govbr_${sha256}`;
}
async function readGovbrPdf(job:SignatureJob,fileId:string,expectedSha256:string):Promise<Buffer>{
  let pdf:Buffer;
  if(fileId.startsWith('local_govbr_')){
    if(!localDocumentModelsEnabled()||fileId!==`local_govbr_${expectedSha256}`||!/^[a-f0-9]{64}$/.test(expectedSha256))throw new Error('Referência de demonstração inválida.');
    pdf=readFileSync(path.join(portalDataDirectory,'govbr-pdfs',`${expectedSha256}.pdf`));
  }else pdf=(await downloadDrivePdf(await getGoogleWorkspaceAccessToken(),fileId,{processId:job.processId})).pdf;
  if(createHash('sha256').update(pdf).digest('hex')!==expectedSha256)throw new Error('O PDF armazenado foi alterado. Prepare e confira uma nova versão.');
  return pdf;
}

async function finishArchivedSignature(job:SignatureJob,actorEmail:string):Promise<void>{
  if(!job.postArchivePending||job.status!=='ARCHIVED')return;
  const process=processesStore.find(item=>item.id===job.processId);
  if(!process||job.sourceDataRevision!==signatureDocumentRevision(process,job.documentType)){
    job.postArchivePending=undefined;
    job.lastError=undefined;
    await persistPortalStateDurably();
    return;
  }
  const runEvent=async(event:WorkflowEventCode)=>{
    const run=await executeConfiguredWorkflowEvent(process,event,actorEmail);
    if(run&&run.status!=='COMPLETED')throw new Error('A rotina publicada aguarda retomada.');
  };
  try{
    if(declarationReady(process,signatureJobsStore)){
      if(process.acervo?.publicationState!=='PUBLIC')await syncAuthorizedPublication(process,actorEmail);
      if(job.documentType!=='DECLARACAO'&&process.status!=='CONCLUIDO'){
        await runEvent('PUBLICATION_CLEARED');
        await executeAutomaticAsten(process,'DECLARACAO',actorEmail);
      }
    }
    updateProcessCompletion(process.id);
    await persistPortalStateDurably();
    await runEvent('SIGNATURE_COMPLETED');
    if(job.documentType==='DECLARACAO'&&process.status==='CONCLUIDO')await runEvent('PROCESS_COMPLETED');
    job.postArchivePending=undefined;
    job.lastError=undefined;
  }catch{
    if(!signatureJobsStore.includes(job))throw new Error('O arquivamento permanece salvo. A rotina aguarda nova leitura.');
    job.lastError='PDF arquivado. A publicação ou a comunicação da etapa aguarda retomada.';
  }
  job.updatedAt=new Date().toISOString();
  await persistPortalStateDurably();
}

async function commitSignatureArchive(
  process:ProcessData,job:SignatureJob,actorEmail:string,
  archive:Pick<SignatureJob,'driveSignedFileId'|'driveSignedWebViewLink'|'signedSha256'>,
):Promise<void>{
  if(!processesStore.includes(process)||!signatureJobsStore.includes(job)||!signatureJobMatchesCurrentRevision(process,job)){
    throw new Error('O documento mudou durante o arquivamento. Consulte a versão atual.');
  }
  if(job.status==='ARCHIVED')return;
  if(hasCompetingSignatureArchive(process,job,signatureJobsStore))throw new Error('Esta versão já foi arquivada por outra solicitação.');
  const beforeStatus=job.status;
  Object.assign(job,archive);
  job.verificationCode=job.verificationCode||randomBytes(18).toString('base64url');
  job.signers=job.signers.map(signer=>({...signer,status:'SIGNED'}));
  job.status='ARCHIVED';
  job.completedAt=job.updatedAt=new Date().toISOString();
  job.postArchivePending=true;
  job.lastError=undefined;
  if(job.documentType==='ATA'&&!process.acervo?.submittedAt){
    process.status='AGUARDANDO_DADOS_FINAIS';
    process.etapaAtual='REPOSITORIO';
  }
  if(process.astenSignatureIntent?.documentType===job.documentType)process.astenSignatureIntent=undefined;
  if(job.documentType!=='DECLARACAO'&&declarationReady(process,signatureJobsStore))queueAutomaticAsten(process,'DECLARACAO');
  recordSignatureAudit(auditLogsStore,process,job,actorEmail,'SIGNED_DOCUMENT_ARCHIVED',job.provider==='ASTEN'?'ASTEN_SIGNERS_READBACK':'GOV_BR_MANUAL_REVIEW',beforeStatus);
  await persistPortalStateDurably();
  await finishArchivedSignature(job,actorEmail);
}

async function archiveSignatureJobAutomatically(job:SignatureJob):Promise<SignatureJob>{
  if(job.status==='ARCHIVED')return job;
  if(!job.providerEnvelopeId)return job;
  const process=processesStore.find(item=>item.id===job.processId);if(!process||!signatureJobMatchesCurrentRevision(process,job)||hasCompetingSignatureArchive(process,job,signatureJobsStore))return job;
  let archive:Pick<SignatureJob,'driveSignedFileId'|'driveSignedWebViewLink'|'signedSha256'>;
  try{
    assertCurrentSignatureRecipients(process,job.documentType,job,currentSettings);
    const[asten,googleAccessToken]=await Promise.all([getPersistentAstenConnection(),getGoogleWorkspaceAccessToken()]);
    if(!asten)throw new Error('Conta Asten não conectada.');
    if(!currentSettings.driveRootFolderId)throw new Error('Pasta raiz do Google Drive não configurada.');
    if(!process.driveFolderId){const folder=await ensurePortalProcessDriveFolder({accessToken:googleAccessToken,rootFolderId:currentSettings.driveRootFolderId,protocol:process.protocolo,processId:process.id});process.driveFolderId=folder.id;process.driveFolderUrl=folder.webViewLink;process.driveSyncedAt=new Date().toISOString();}
    job.signedAt=job.signedAt||job.completedAt||new Date().toISOString();
    const signerEvidence=await callAsten('getSignatariosPorEnvelope',{idEnvelope:job.providerEnvelopeId},asten.token);
    const confirmedSigners=assertAstenEnvelopeSigners(signerEvidence,job.signers.map(signer=>({email:signer.email,order:signer.signingOrder})));
    job.signers=job.signers.map(signer=>({...signer,status:'SIGNED',signedAt:confirmedSigners.find(item=>item.email===signer.email&&item.order===signer.signingOrder)?.signedAt}));
    recordSignatureAudit(auditLogsStore,process,job,'webhook@asten.local','PROVIDER_SIGNERS_VERIFIED','ASTEN_SIGNERS_READBACK');
    const response=await callAsten('downloadPDFEnvelopeDocs',{idEnvelope:job.providerEnvelopeId,incluirDocs:'N',versaoSemCertificado:null},asten.token);
    const pdf=extractAstenSignedPdf(response);
    await assertSignedPdfIntegrity(pdf);
    const fileName=buildPortalDriveFileName({protocol:process.protocolo,title:process.titulo,studentNames:[process.aluno1.nome,process.aluno2?.nome].filter(Boolean) as string[],documentType:job.documentType,version:job.documentVersion,lifecycle:'ASSINADO'});
    const signedSha256=createHash('sha256').update(pdf).digest('hex');
    const driveFile=await uploadSignedPdfToDrive({rootFolderId:currentSettings.driveRootFolderId,protocol:process.protocolo,accessToken:googleAccessToken,processFolderId:process.driveFolderId,processId:process.id,jobId:job.id,documentType:job.documentType,fileName,pdf,sha256:signedSha256});
    archive={driveSignedFileId:String(driveFile.id),driveSignedWebViewLink:String(driveFile.webViewLink||''),signedSha256};
  }catch(error){
    const canonical=signatureJobsStore.find(item=>item.id===job.id&&item.status==='ARCHIVED');
    if(canonical)return canonical;
    job.status='DRIVE_SYNC_PENDING';
    job.lastError=error instanceof Error?error.message:'Falha ao arquivar PDF assinado.';
    job.updatedAt=new Date().toISOString();
    await persistPortalStateDurably();
    return job;
  }
  await commitSignatureArchive(process,job,'webhook@asten.local',archive);
  return job;
}
function findAstenEnvelopeId(b:any):string|null{const f=[b?.idEnvelope,b?.Envelope?.id,b?.envelope?.id,b?.data?.idEnvelope,b?.response?.data?.idEnvelope].find(v=>v!==undefined&&v!==null&&String(v));return f?String(f):null;}

export async function createPortalApp() {
  if(productionRuntime&&!bootstrapMasterEmail&&!persistedPortalState.settings?.masterEmail)throw new Error('Implantação bloqueada: configure PORTAL_BOOTSTRAP_MASTER_EMAIL para definir o primeiro Master sem usar dados de demonstração.');
  if((process.env.NODE_ENV==='production'||Boolean(process.env.VERCEL))&&!getSupabaseRuntimeStatus().durablePersistenceReady)throw new Error('Implantação bloqueada: configure a persistência durável do Supabase antes de iniciar o portal em produção.');
  if(productionRuntime){
    assertPortalSessionConfigured();
    const otpStatus=getOtpRuntimeStatus();if(!otpStatus.configured||!otpStatus.durable)throw new Error('Implantação bloqueada: configure PORTAL_OTP_PEPPER exclusivo e o armazenamento durável de códigos no Supabase.');
    const oauthSecurity=getGoogleOAuthSecurityPreflight();if(!oauthSecurity.ready)throw new Error(`Implantação bloqueada: ${oauthSecurity.issues.join(' ')}`);
    const secretStore=getSecretStoreStatus();if(!secretStore.configured||!secretStore.durable)throw new Error('Implantação bloqueada: configure PORTAL_SECRET_ENCRYPTION_KEY e o cofre durável de integrações no Supabase.');
    const fileTransport=getSupabaseStagingSecurityStatus();if(!fileTransport.configured)throw new Error('Implantação bloqueada: configure o bucket legado para a limpeza e um PORTAL_UPLOAD_BINDING_SECRET exclusivo com pelo menos 32 caracteres.');
    const cronSecret=String(process.env.CRON_SECRET||'').trim();
    const cronSecretReused=[process.env.PORTAL_SESSION_SECRET,process.env.PORTAL_OTP_PEPPER,process.env.PORTAL_UPLOAD_BINDING_SECRET,process.env.PORTAL_VERIFICATION_SECRET,process.env.ASTEN_WEBHOOK_SECRET].map(value=>String(value||'').trim()).filter(Boolean).includes(cronSecret);
    if(process.env.VERCEL&&(cronSecret.length<32||cronSecretReused))throw new Error('Implantação bloqueada: configure CRON_SECRET exclusivo com pelo menos 32 caracteres para a limpeza diária do transporte privado.');
    const verificationSecret=String(process.env.PORTAL_VERIFICATION_SECRET||'').trim();if(verificationSecret.length<32)throw new Error('Implantação bloqueada: configure PORTAL_VERIFICATION_SECRET com pelo menos 32 caracteres.');
    const databaseStatus = await testSupabaseRuntimeConnection();
    if (!databaseStatus.transactionalRuntimeReady) {
      const httpStatus = /^Supabase respondeu (\d{3})/.exec(databaseStatus.message)?.[1];
      const code = !databaseStatus.connected
        ? (httpStatus ? `SUPABASE_HTTP_${httpStatus}` : 'SUPABASE_CONNECTION_FAILED')
        : databaseStatus.normalizedSchemaReady ? 'SUPABASE_CAPABILITY_FAILED' : 'SUPABASE_TABLE_CHECK_FAILED';
      throw Object.assign(new Error('A validação do banco de dados do Portal falhou.'), {code});
    }
  }
  if (getSupabaseRuntimeStatus().durablePersistenceReady) {
    try {
      const remote = await loadPortalRuntimeState<PersistedPortalState>();
      if (remote) applyPersistedState(remote);
    } catch (error) {
      throw Object.assign(new Error('Persistência Supabase configurada, mas indisponível.',{cause:error}),{code:typeof (error as {code?:unknown})?.code==='string'?(error as {code:string}).code:'SUPABASE_RUNTIME_READ_FAILED'});
    }
  }
  publishRuntimeTemplatesFromSettings();
  const app = createPortalHttpApp();
  const serveCompiledClient = productionRuntime || process.env.PORTAL_SERVE_COMPILED_CLIENT === 'true';
  const developmentNonce = serveCompiledClient ? '' : randomBytes(18).toString('base64');
  if(process.env.VERCEL)app.set('trust proxy',1);

  app.use((req,res,next)=>{
    res.setHeader('X-Content-Type-Options','nosniff');
    res.setHeader('X-Frame-Options','DENY');
    res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy','camera=(), microphone=(), geolocation=(), payment=(), usb=()');
    res.setHeader('Content-Security-Policy',`default-src 'self'; script-src 'self'${developmentNonce?` 'nonce-${developmentNonce}'`:''}; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data:; connect-src 'self' blob: https://www.googleapis.com${developmentNonce?' ws: wss:':''}; frame-src 'self' https://www.google.com; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'`);
    if(productionRuntime)res.setHeader('Strict-Transport-Security','max-age=31536000; includeSubDomains');
    next();
  });

  // Health stays available without parsing bodies or hydrating the database.
  // Express also serves HEAD through this GET handler.
  app.get('/api/health', (_req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: runtimePackageVersion,
      commit: runtimeGitCommit(),
      runtime: productionRuntime ? 'production' : serveCompiledClient ? 'local-compiled' : 'local-source'
    });
  });
  app.all('/api/public/runtime-assets/:key',runtimeAssetHandler);

  app.use('/api',(req,res,next)=>{if(!['POST','PATCH','PUT','DELETE'].includes(req.method))return next();if(String(req.get('sec-fetch-site')||'').toLowerCase()==='cross-site')return res.status(403).json({error:'Requisição entre sites bloqueada.',code:'CROSS_SITE_REQUEST_BLOCKED'});const origin=String(req.get('origin')||'').trim();if(!origin)return next();const configured=String(process.env.PORTAL_PUBLIC_URL||process.env.APP_URL||'').trim();const expected=configured?new URL(/^https?:\/\//i.test(configured)?configured:`https://${configured}`).origin:`${req.protocol}://${req.get('host')}`;try{
    const allowed=new Set([expected]);
    // Cada deployment Vercel pode ter uma URL própria de prévia. Liberar somente
    // URLs fornecidas pela infraestrutura, sem aceitar um Host arbitrário.
    for(const host of [process.env.VERCEL_URL,process.env.VERCEL_BRANCH_URL]){
      const value=String(host||'').trim();
      if(value)allowed.add(new URL(/^https?:\/\//i.test(value)?value:`https://${value}`).origin);
    }
    if(!allowed.has(new URL(origin).origin))return res.status(403).json({error:'Origem da requisição não autorizada.',code:'ORIGIN_NOT_ALLOWED'});
  }catch{return res.status(403).json({error:'Origem da requisição inválida.',code:'ORIGIN_NOT_ALLOWED'});}next();});

  // Em produção os uploads vão direto ao Drive privado. O limite abaixo só
  // cobre JSON e o fallback local de até 2 MB, nunca os PDFs/DOCX completos.
  // Callbacks Asten devem ser pequenos; limitar antes do parser geral impede payloads volumosos.
  app.use('/api/integrations/asten/webhook', express.json({ limit: '64kb' }));
  app.use(express.json({ limit: '4mb' }));

  installPublicCalendarDataRoute(app,createPublicCalendarDataReader({
    durable:()=>getSupabaseRuntimeStatus().durablePersistenceReady,
    readDurable:loadPortalCalendarSnapshot,
    readRevision:readPortalRuntimeRevision,
    readLocal:()=>{const state=loadPersistedPortalState();return state.processes?state:{processes:structuredClone(processesStore),settings:structuredClone(currentSettings)};},
  }));

  installDeletionStatusRoute(app,createDeletionStatusReader({
    durable:()=>getSupabaseRuntimeStatus().durablePersistenceReady,readRevision:readPortalRuntimeRevision,
    readDurable:async revision=>readCachedPortalRuntimeState<PersistedPortalState>(revision)??await loadPortalRuntimeState<PersistedPortalState>(false),
    readLocal:()=>{const state=loadPersistedPortalState();return state.processes?{...state,settings:state.settings||structuredClone(currentSettings)}:{processes:structuredClone(processesStore),settings:structuredClone(currentSettings),revokedSessionIds:[...revokedSessionIdsStore],processDeletionTasks:structuredClone(processDeletionTasksStore),auditLogs:structuredClone(auditLogsStore)};},
  }));

  const showSavedReservationDecision=async(req:express.Request,res:express.Response)=>{
    if(req.method!=='GET'&&req.method!=='POST')return false;
    const saved=await readSavedReservationDecision(req.path,reservationSecret,()=>loadPortalCalendarSnapshot(2_000));
    if(res.destroyed||req.aborted)return true;
    if(!saved)return false;
    res.removeHeader('Retry-After');
    res.setHeader('Cache-Control','no-store');
    res.setHeader('Referrer-Policy','same-origin');
    res.setHeader('X-Robots-Tag','noindex, nofollow');
    res.setHeader('X-Reservation-Decision',saved.decision);
    res.status(req.method==='POST'?409:200).type('html')
      .send(reservationAlreadyAnsweredPage(saved.decision,saved.receiptPath));
    return true;
  };

  const acquireRuntimeRequest=createRuntimeRequestQueue();
  app.use('/api', async (req, res, next) => {
    const registrationTiming=beginRegistrationRequestTiming(req,res);
    const durable = getSupabaseRuntimeStatus().durablePersistenceReady;
    const healthRead = req.method === 'GET' && (req.path === '/health' || req.path === '/public/sync/version' || req.path.startsWith('/public/runtime-assets/'));
    if (!durable || healthRead || req.path==='/integrations/asten/webhook') return next();
    // An already-recorded decision is read from committed state. It does not
    // need the mutable runtime lock held by archive, Gmail or invitation work.
    if(req.method==='GET'&&await showSavedReservationDecision(req,res))return;
    // Fluid Compute pode atender várias requisições na mesma instância.
    // Uma leitura não pode substituir os objetos globais enquanto um envio os modifica.
    const waitingCancellation=new AbortController();
    const cancelWaiting=()=>waitingCancellation.abort();
    req.once('aborted',cancelWaiting);
    res.once('close',cancelWaiting);
    if(req.aborted||res.destroyed)cancelWaiting();
    let releaseRuntimeRequest:()=>void;
    const finishQueueTiming=registrationTiming?.measure('queue_wait');
    try{
      releaseRuntimeRequest=await acquireRuntimeRequest(waitingCancellation.signal);
    }catch{
      finishQueueTiming?.();
      if(!res.destroyed&&!req.aborted){
        res.setHeader('Retry-After','5');
        const reservationHtml=reservationRuntimeUnavailablePage(req.path,req.originalUrl);
        if(reservationHtml){
          if(req.method==='POST'&&await showSavedReservationDecision(req,res))return;
          res.setHeader('Cache-Control','no-store');res.setHeader('Referrer-Policy','same-origin');res.setHeader('X-Robots-Tag','noindex, nofollow');
          res.status(503).type('html').send(reservationHtml);
        }else res.status(503).json({error:'O Portal está ocupado. Tente novamente em alguns segundos.',code:'RUNTIME_BUSY'});
      }
      return;
    }finally{
      finishQueueTiming?.();
      req.off('aborted',cancelWaiting);
      res.off('close',cancelWaiting);
    }
    if(res.destroyed||req.aborted){releaseRuntimeRequest();return;}
    const requestLifecycle=attachRuntimeRequestLifecycle(req,releaseRuntimeRequest);
    res.once('finish',requestLifecycle.responseFinished);
    res.once('close',requestLifecycle.responseFinished);
    try {
      remotePersistenceQueue=settlePreviousRuntimeWrites(remotePersistenceQueue);
      const finishPreviousWrites=registrationTiming?.measure('previous_writes');
      await remotePersistenceQueue;
      finishPreviousWrites?.();
      const finishHydration=registrationTiming?.measure('hydrate');
      let remote:PersistedPortalState|null;
      try{remote=await refreshPortalRuntimeState<PersistedPortalState>();}finally{finishHydration?.();}
      if(res.destroyed||req.aborted)return;
      const finishApplyState=registrationTiming?.measure('apply_state');
      try{if(remote)applyPersistedState(remote);}finally{finishApplyState?.();}
      next();
    } catch (error) {
      const diagnosticCode=typeof (error as {code?:unknown})?.code==='string'&&/^SUPABASE_[A-Z0-9_]{2,40}$/.test((error as {code:string}).code)?(error as {code:string}).code:'SUPABASE_RUNTIME_READ_FAILED';
      console.error('[Runtime] Falha na hidratação autorizada.',JSON.stringify({stage:'HYDRATION',code:diagnosticCode}));
      if(!res.destroyed&&!req.aborted){
        res.setHeader('Retry-After','5');
        const reservationHtml=reservationRuntimeUnavailablePage(req.path,req.originalUrl);
        if(reservationHtml){
          if(req.method==='POST'&&await showSavedReservationDecision(req,res))return;
          res.setHeader('Cache-Control','no-store');res.setHeader('Referrer-Policy','same-origin');res.setHeader('X-Robots-Tag','noindex, nofollow');
          res.status(503).type('html').send(reservationHtml);
        }else res.status(503).json({error:'Não foi possível confirmar as permissões atuais. Tente novamente.',code:'RUNTIME_STATE_UNAVAILABLE'});
      }
    } finally {
      requestLifecycle.hydrationFinished();
    }
  });

  app.use('/api', (req, res, next) => {
    if (!['POST', 'PATCH', 'PUT', 'DELETE'].includes(req.method) || !getSupabaseRuntimeStatus().durablePersistenceReady || req.path==='/integrations/asten/webhook') return next();
    const originalJson = res.json.bind(res);
    res.json = ((body: unknown) => {
      // A rota agenda o próprio commit durante sua execução. Por isso a fila
      // precisa ser lida quando res.json é chamado, e não na entrada da
      // requisição; caso contrário a Vercel poderia confirmar uma escrita
      // antes de o snapshot correspondente chegar ao Supabase.
      remotePersistenceQueue.then(() => originalJson(body)).catch((error) => {
        if (!res.headersSent) {
          res.status(503);
          console.error('[Persistence] Supabase:', error);
          originalJson({ error: 'A alteração não foi confirmada no banco durável. Tente novamente.' });
        }
      });
      return res;
    }) as typeof res.json;
    next();
  });

  // API Middleware / Logging
  app.use((req, res, next) => {
    if (req.path.startsWith('/api')) {
      console.log(`[API] ${req.method} ${safeApiLogPath(req.path)}`);
    }
    next();
  });

  app.use('/api', attachPortalIdentity);
  app.use('/api',(req,res,next)=>{const identity=getPortalIdentity(req);if(identity&&(identity.issuedAt<Number(currentSettings.sessionValidAfter||0)||revokedSessionIdsStore.has(identity.sessionId))){(req as any).portalIdentity=null;clearPortalSessionCookie(res);}next();});
  const requireGlobalRoles=(...roles:GlobalRole[])=>(req:express.Request,res:express.Response,next:express.NextFunction)=>{const identity=getPortalIdentity(req);if(!identity)return res.status(401).json({error:'Autenticação institucional obrigatória.'});const userRoles=getUserRolesForEmail(identity.email).globalRoles;if(!roles.some(role=>userRoles.includes(role)))return res.status(403).json({error:'Seu perfil não tem permissão para esta operação.'});next();};
  const requireAdministrator=requireGlobalRoles('MASTER_ADMIN');
  const requirePresidencyOperator=requireGlobalRoles('MASTER_ADMIN','COMMISSION_PRESIDENT');
  const requireRegistrationApplicant:express.RequestHandler=(req,res,next)=>{
    if(!canRegisterProcess(getPortalIdentity(req)!.email))return res.status(403).json({error:'O cadastro está disponível para alunos autorizados.',code:'STUDENT_REGISTRATION_REQUIRED'});
    next();
  };
  // Variação pública sem contagem de processos, IDs ou campos privados.
  app.get('/api/public/sync/version',async(_req,res)=>{
    res.setHeader('Cache-Control','public, no-store, max-age=0');
    try{
      const token=getSupabaseRuntimeStatus().durablePersistenceReady
        ? await publicPortalRevisionToken()
        : createHash('sha256').update('local:'+localPortalChangeSequence).digest('hex').slice(0,24);
      if (productionRuntime) {
        res.setHeader('Cache-Control','public, max-age=0, must-revalidate');
        res.setHeader('Vercel-CDN-Cache-Control','public, s-maxage=10');
      }
      res.json({token});
    }catch{
      res.status(503).json({error:'Não foi possível consultar a atualização do portal.'});
    }
  });
  // Resposta mínima para atualização automática. A revisão já foi carregada
  // pelo middleware que valida o estado durável antes de cada rota autenticada.
  app.get('/api/sync/version',requireAuthenticated,(_req,res)=>{
    res.setHeader('Cache-Control','private, no-store, max-age=0');
    const revision=getSupabaseRuntimeStatus().durablePersistenceReady
      ? currentPortalRuntimeRevision()
      : localPortalChangeSequence;
    res.json({revision:revision ?? 0});
  });

  const requireAdministrativeOperator=requireAdministrator;
  // Sugestões públicas: sem login para o envio, mas consulta e imagens somente
  // para o Master. Nada é inserido no estado transacional dos TCCs.
  app.post('/api/public/feedback',async(req,res)=>{
    res.setHeader('Cache-Control','no-store');
    try{
      const ip=String(req.ip||req.socket.remoteAddress||'').trim();
      const result=await submitPublicFeedback(req.body,ip,String(process.env.PORTAL_SESSION_SECRET||''));
      res.status(201).json({received:true,reference:result.id||undefined});
    }catch(error){
      if(!(error instanceof FeedbackError))console.error('[Feedback] Falha ao receber sugestão:',error);
      res.status(error instanceof FeedbackError?error.status:503).json({
        error:error instanceof FeedbackError?error.message:'Não foi possível registrar a sugestão. Tente novamente.',
      });
    }
  });
  app.get('/api/admin/feedback',requireAuthenticated,requireGlobalRoles('MASTER_ADMIN'),async(req,res)=>{
    res.setHeader('Cache-Control','private, no-store');
    try{
      res.json(req.query.paginated==='true'
        ?await listFeedbackPageForAdmin(req.query.before)
        :await listFeedbackForAdmins());
    }catch(error){res.status(error instanceof FeedbackError?error.status:503).json({error:'Não foi possível consultar as sugestões.'});}
  });
  app.get('/api/admin/feedback/:id/image',requireAuthenticated,requireGlobalRoles('MASTER_ADMIN'),async(req,res)=>{
    res.setHeader('Cache-Control','private, no-store');
    res.setHeader('X-Content-Type-Options','nosniff');
    try{
      const image=await feedbackImageForAdmin(String(req.params.id||''));
      if(!image)return res.status(404).json({error:'Imagem não encontrada.'});
      res.type(image.mime);res.send(image.bytes);
    }catch(error){
      res.status(error instanceof FeedbackError?error.status:503).json({error:'Não foi possível consultar a imagem.'});
    }
  });
  app.patch('/api/admin/feedback/:id/review',requireAuthenticated,requireGlobalRoles('MASTER_ADMIN'),async(req,res)=>{
    res.setHeader('Cache-Control','private, no-store');
    try{
      const actor=getPortalIdentity(req)!.email;
      const updated=await markFeedbackReviewed(String(req.params.id||''),actor);
      if(!updated)return res.status(404).json({error:'Sugestão não encontrada.'});
      res.json({reviewed:true,record:updated});
    }catch(error){res.status(error instanceof FeedbackError?error.status:503).json({error:'Não foi possível atualizar a sugestão.'});}
  });


  app.post('/api/uploads/staging',async(req,res)=>{
    const purpose=String(req.body?.purpose||'') as StagedUploadPurpose;
    if(purpose==='VERIFICATION_PDF')return res.status(410).json({error:'A conferência de autenticidade é feita no seu navegador, sem enviar o PDF. Atualize a página.',code:'LOCAL_VERIFICATION_REQUIRED'});
    const identity=getPortalIdentity(req);
    let requesterBinding='';
    let processId:string|undefined;
    let verificationCode:string|undefined;
    if(purpose==='DOCUMENT_MODEL'){
      if(!identity)return res.status(401).json({error:'Autenticação institucional obrigatória.'});
      if(!hasFullAdministration(identity.email))return res.status(403).json({error:'Somente o Master pode enviar modelos.'});
      requesterBinding=sessionUploadBinding(identity);
    }else if(purpose==='GOV_BR_SIGNED_PDF'){
      if(!identity)return res.status(401).json({error:'Autenticação institucional obrigatória.'});
      processId=String(req.body?.processId||'').trim();
      const process=processesStore.find(item=>item.id===processId);
      if(!process||!signatureJobsStore.some(job=>job.processId===process.id&&job.provider==='GOV_BR'&&signatureJobMatchesCurrentRevision(process,job)&&job.status==='READY_FOR_REVIEW'&&!job.govbrReview?.approvedAt&&canAccessSignatureDocument(identity.email,process,job.documentType)&&canReturnGovbrDocument(identity.email,process,job.documentType as 'ATA'|'TERMO'|'DECLARACAO',currentSettings,getUserRolesForEmail(identity.email).globalRoles)))return res.status(409).json({error:'Prepare o documento Gov.br atual antes de enviar o PDF.',code:'GOVBR_JOB_REQUIRED'});
      requesterBinding=sessionUploadBinding(identity);
    }else if(purpose==='PROCESS_FULL_WORK'||purpose==='PROCESS_EXPANDED_ABSTRACT'){
      if(!identity)return res.status(401).json({error:'Autenticação institucional obrigatória.'});
      processId=String(req.body?.processId||'').trim();
      const process=processesStore.find(item=>item.id===processId);
      if(!process||!canAccessProcess(identity.email,process.id))return res.status(404).json({error:'Processo não encontrado.'});
      if(process.acervo?.submittedAt||finalDocumentFilesLocked(process,signatureJobsStore))return res.status(409).json({error:'Reabra a entrega antes de enviar novos arquivos finais.',code:'FINAL_FILES_LOCKED_BY_SIGNATURE'});
      const roles=getActiveProcessRoles(identity.email,process.id);
      if(!roles.includes('STUDENT'))return res.status(403).json({error:'Somente um dos autores pode anexar os arquivos finais.'});
      if(!ataArchived(process,signatureJobsStore))return res.status(409).json({error:'A entrega final será liberada após o arquivamento da ata assinada.',code:'ATA_SIGNATURE_REQUIRED'});
      requesterBinding=sessionUploadBinding(identity);
    }else return res.status(400).json({error:'Finalidade de upload inválida.'});
    try{
      const ticket=await createDriveStagedUpload({purpose,requesterBinding,processId,verificationCode,fileName:String(req.body?.fileName||''),size:Number(req.body?.size),mimeType:String(req.body?.mimeType||'').toLowerCase(),sha256:String(req.body?.sha256||'').toLowerCase()},{
        rootFolderId:currentSettings.driveRootFolderId||'',
        origin:new URL(req.get('origin') || publicPortalBaseUrl() || `${req.protocol}://${req.get('host')}`).origin,
      });
      res.setHeader('Cache-Control','private, no-store');
      res.status(201).json(ticket);
    }catch(error){
      const message=error instanceof Error?error.message:'Não foi possível autorizar o upload.';
      const unavailable=message.includes('exige Supabase')||message.includes('configurado');
      res.status(error instanceof StagedUploadCapacityError?429:unavailable?503:400).json({error:message});
    }
  });

  app.get('/api/files/previews/:id',requireAuthenticated,async(req,res)=>{
    const identity=getPortalIdentity(req)!;
    res.setHeader('Cache-Control','private, no-store');
    try {
      const file=await readDrivePreviewTransfer(String(req.params.id),sessionUploadBinding(identity),processId=>processId
        ? canAccessProcess(identity.email,processId)&&getActiveProcessRoles(identity.email,processId).includes('ADVISOR')
        : hasFullAdministration(identity.email));
      if(!file)return res.status(404).json({error:'Prévia indisponível. Gere uma nova prévia.'});
      await deliverPortalDownload({res,...file,requesterBinding:sessionUploadBinding(identity),cacheControl:'private, no-store'});
    } catch {
      if(!res.headersSent&&!res.destroyed)res.status(502).json({error:'Não foi possível recuperar a prévia.'});
    }
  });

  app.post('/api/admin/uploads/cleanup',requireAuthenticated,requireAdministrator,async(_req,res)=>{
    try{const [uploads,downloads]=await Promise.all([cleanupExpiredStagedUploads(500),cleanupExpiredDownloadTransfers(500)]);res.json({uploads,downloads});}
    catch(error){res.status(502).json({error:error instanceof Error?error.message:'Não foi possível executar a limpeza.'});}
  });

  app.get('/api/cron/storage-cleanup',async(req,res)=>{
    const expected=String(process.env.CRON_SECRET||'').trim();
    const supplied=String(req.headers.authorization||'').replace(/^Bearer\s+/i,'').trim();
    const expectedDigest=createHash('sha256').update(expected).digest();
    const suppliedDigest=createHash('sha256').update(supplied).digest();
    if(expected.length<32||!supplied||!timingSafeEqual(expectedDigest,suppliedDigest))return res.status(401).json({error:'Não autorizado.'});
    const[uploadsResult,downloadsResult]=await Promise.allSettled([cleanupExpiredStagedUploads(500),cleanupExpiredDownloadTransfers(500)]);
    const failures=[uploadsResult,downloadsResult].filter(result=>result.status==='rejected').map(result=>result.status==='rejected'?(result.reason instanceof Error?result.reason.message:String(result.reason)):'');
    if(currentSettings.driveRootFolderId){
      try{
        const token=await getGoogleWorkspaceAccessToken();
        await cleanupExpiredAtaPreviews(token,await ensurePortalRenderFolder(token,currentSettings.driveRootFolderId));
      }catch{failures.push('A limpeza das prévias expiradas da ata ficou pendente.');}
    }
    const processCleanups=[];for(const task of selectDueProcessDeletions(processDeletionTasksStore)){try{const result=await retryProcessDeletion(task);processCleanups.push({id:task.id,status:result.status});if(result.status==='PENDING')failures.push('Há limpezas de TCC pendentes nas plataformas integradas.');}catch(error){failures.push(error instanceof Error?error.message:'Falha na limpeza de TCC.');}}
    let workflow:Awaited<ReturnType<typeof runWorkflowMaintenance>>|null=null;
    try{workflow=await runWorkflowMaintenance();if(workflow.failed||workflow.configurationErrors.length)failures.push('Há lembretes com falha; confira a central de andamento.');}catch(error){failures.push(error instanceof Error?error.message:'Falha na manutenção do fluxo.');}
    res.setHeader('Cache-Control','no-store');
    let backup:Awaited<ReturnType<typeof createVerifiedPortalBackup>>|null=null;
    const backupDay=new Date().toISOString().slice(0,10);
    if(currentSettings.driveRootFolderId&&!auditLogsStore.some(event=>event.action==='BACKUP_CIFRADO_AUTOMATICO'&&event.timestamp.startsWith(backupDay))){
      try{
        backup=await createVerifiedPortalBackup(snapshotPortalState(),currentSettings.driveRootFolderId);
        auditLogsStore.push({id:`log-${Date.now()}-automatic-backup`,actorEmail:'system@portal.local',actorRoles:[],action:'BACKUP_CIFRADO_AUTOMATICO',entityType:'system_backup',entityId:backup.backupFileId,after:{restorable:true,encryptedSha256:backup.encryptedSha256,sourceSha256:backup.sourceSha256,counts:backup.counts},timestamp:backup.executedAt});
        await persistPortalStateDurably();
      }catch(error){failures.push(error instanceof Error?error.message:'Falha no backup cifrado automático.');}
    }
    if(failures.length)console.warn('[Maintenance] Rotina com pendências', {
      failures:failures.length,workflowDeferred:workflow?.deferred,
      workflowConfigurationErrors:workflow?.configurationErrors.length,backupCreatedInThisRun:Boolean(backup)
    });
    res.status(failures.length?502:200).json({ok:failures.length===0,backup,uploads:uploadsResult.status==='fulfilled'?uploadsResult.value:null,downloads:downloadsResult.status==='fulfilled'?downloadsResult.value:null,processCleanups,workflow,failures,executedAt:new Date().toISOString()});
  });

  // Callback confirmado com commit antes de 200; worker reivindica lease
  // persistida (CAS do runtime Supabase) ANTES de chamar provedores externos.
  async function reconcileQueuedAstenCallbacks(limit=3,requestedEventId?:string,timeBudgetMs=45_000){
    const startedAt=Date.now();
    const remainingBudget=()=>Math.max(0,timeBudgetMs-(Date.now()-startedAt));
    const {drainAstenReconciliation}=await import('./server/workflow/astenReconciliationDrain');
    // A janela de leitura é maior que o lote: retry/lease dos primeiros retornos
    // não pode esconder assinaturas posteriores prontas para arquivar.
    const queuedEvents=await pendingAstenWebhooks(200,requestedEventId);
    const completedInboxEvents:AstenWebhookEvent[]=[];
    let imported=false;
    for(const queued of queuedEvents){
      const existing=astenWebhookEventsStore.find(item=>item.fingerprint===queued.fingerprint);
      if(existing){if(existing.processedAt)completedInboxEvents.push(existing);continue;}
      const job=signatureJobsStore.find(item=>item.id===queued.matchedJobId&&item.providerEnvelopeId===queued.envelopeId);
      if(job?.removedFromLogsAt){queued.processedAt=new Date().toISOString();completedInboxEvents.push(queued);continue;}
      if(!job||job.providerDispatchState==='SENDING'||job.providerCreationState==='CREATING')continue;
      astenWebhookEventsStore.push(queued);astenCallbackFingerprints.add(queued.fingerprint);imported=true;
    }
    if(imported)await persistPortalStateDurably();
    const events=()=>{
      const known=new Map(queuedEvents.map(event=>[event.fingerprint,event]));
      for(const event of astenWebhookEventsStore)if(!requestedEventId||event.id===requestedEventId)known.set(event.fingerprint,event);
      return [...known.values()];
    };
    const eligible=(event:AstenWebhookEvent,now:number)=>{
      if(!isReconcileableAstenWebhookEvent(event,now))return false;
      const job=signatureJobsStore.find(item=>item.id===event.matchedJobId&&item.providerEnvelopeId===event.envelopeId);
      return Boolean(job&&!job.removedFromLogsAt&&job.providerDispatchState!=='SENDING'&&job.providerCreationState!=='CREATING');
    };
    const result=await drainAstenReconciliation({events,eligible,limit,timeBudgetMs:remainingBudget(),
      claim:async(event)=>{
        event.processingLeaseUntil=new Date(Date.now()+10*60_000).toISOString();
        // Se outra instância atualizou a revisão, interromper sem acessar Asten/Drive.
        await persistPortalStateDurably();
      },
      reconcile:async(event)=>{
      const job=signatureJobsStore.find(item=>item.id===event.matchedJobId&&item.providerEnvelopeId===event.envelopeId);
      let committed=false;
      try{
        if(!job)throw new Error('Evento sem envelope local reconhecido.');
        const beforeStatus=job.status;
        const process=processesStore.find(item=>item.id===job.processId);
        const current=Boolean(process&&signatureJobMatchesCurrentRevision(process,job)&&!hasCompetingSignatureArchive(process,job,signatureJobsStore));
        if(current&&job.status!=='ARCHIVED'){
          const connection=await getPersistentAstenConnection();
          if(!connection)throw new Error('Conexão Asten não configurada.');
          const providerState=await callAsten('getDadosEnvelope',{idEnvelope:job.providerEnvelopeId,getLobs:'N'},connection.token);
          const verified=inferAstenJobStatus(providerState,job.status,event.envelopeId);
          if(event.status==='SIGNED'&&!['SIGNED','ARCHIVED'].includes(verified))throw new Error('O provedor ainda não confirmou todas as assinaturas.');
          job.status=verified;
          job.updatedAt=new Date().toISOString();
          if(['SENT','PARTIALLY_SIGNED','SIGNED','ARCHIVED'].includes(job.status))job.providerDispatchState='SENT';
          if(job.status==='SIGNED'||job.status==='DRIVE_SYNC_PENDING')await archiveSignatureJobAutomatically(job);
          if(job.status==='DRIVE_SYNC_PENDING')throw new Error('O Drive ainda não confirmou o arquivamento do PDF.');
          if(!job.postArchivePending)job.lastError=undefined;
        }else if(current&&job.postArchivePending)await finishArchivedSignature(job,'webhook@asten.local');
        event.processedAt=new Date().toISOString();
        event.processingLeaseUntil=undefined;
        event.retryAfter=undefined;
        event.lastError=undefined;
        event.safePayload={...event.safePayload,processedAt:event.processedAt};
        auditLogsStore.push({id:`log-${Date.now()}-asten-reconcile`,processId:job.processId,actorEmail:'webhook@asten.local',actorRoles:[],action:current?'CALLBACK_ASTEN_RECONCILIADO':'CALLBACK_ASTEN_VERSAO_ENCERRADA',entityType:'signature_job',entityId:job.id,before:{status:beforeStatus},after:{...signatureAuditMetadata(job,current?'PROVIDER_CALLBACK_RECONCILED':'HISTORICAL_CALLBACK_IGNORED'),envelopeId:event.envelopeId,callbackFingerprint:event.fingerprint,providerVerified:current},timestamp:event.processedAt});
        await persistPortalStateDurably();
        committed=true;
        await confirmAstenWebhookProcessed(event);
        return 'confirmed';
      }catch(error){
        const failure=error instanceof Error?error.message:'Erro de reconciliação.';
        // Só um commit confirmado retira o retorno da contagem de pendências.
        if(!committed){event.processedAt=undefined;delete event.safePayload.processedAt;}
        event.processingLeaseUntil=undefined;
        event.attempts=(event.attempts||0)+1;
        event.lastError=failure.slice(0,250);
        event.retryAfter=new Date(Date.now()+Math.min(60,2**Math.min(event.attempts,5))*60_000).toISOString();
        if(job){
          job.lastError='Evento Asten gravado; reconciliação pendente: '+event.lastError;
          job.updatedAt=new Date().toISOString();
        }
        try{await persistPortalStateDurably();}catch{return 'stop';}
        return 'failed';
      }
      }
    });
    // Limpa ACKs cujo commit já existe sem atrasar novos PDFs nem prolongar uma
    // execução que parou por conflito de revisão ou esgotamento do orçamento.
    if(result.stopped!=='persistence')for(const event of completedInboxEvents){
      if(remainingBudget()<=0)break;
      try{await confirmAstenWebhookProcessed(event);}catch{result.failed++;break;}
    }
    // Com janela cheia, pending/deferred descrevem os eventos conhecidos, não
    // afirmam que toda a fila do banco já foi lida nesta invocação.
    return {...result,inboxWindowFull:queuedEvents.length===200};
  }
  function scheduleAstenCallbackReconciliation(eventId?:string):void {
    const task=(async()=>{
      const release=await acquireRuntimeRequest();
      try{
        remotePersistenceQueue=settlePreviousRuntimeWrites(remotePersistenceQueue);
        await remotePersistenceQueue;
        if(getSupabaseRuntimeStatus().durablePersistenceReady){const remote=await refreshPortalRuntimeState<PersistedPortalState>();if(remote)applyPersistedState(remote);}
        await reconcileQueuedAstenCallbacks(eventId?1:3,eventId);
      }finally{release();}
    })().catch(()=>{console.error('[Asten] Reconciliação automática pendente; evento preservado para nova tentativa.');});
    if(process.env.VERCEL)waitUntil(task);
  }

  const scheduledRepositorySignatureRecoveries=new Set<string>();
  function scheduleRepositorySignatureRecovery(portalProcess:ProcessData,actorEmail:string):void{
    if(scheduledRepositorySignatureRecoveries.has(portalProcess.id)||scheduledRepositorySignatureRecoveries.size>=2
      ||!canRecoverRepositorySignature(portalProcess,signatureJobsStore,automaticAstenEnabled(portalProcess.astenSignatureIntent?.documentType)))return;
    const processId=portalProcess.id;
    scheduledRepositorySignatureRecoveries.add(processId);
    // A separate lease starts after this GET releases its own lease. Attaching
    // a request task here would deadlock while waiting for that same release.
    const task=(async()=>{
      const release=await acquireRuntimeRequest();
      try{
        remotePersistenceQueue=settlePreviousRuntimeWrites(remotePersistenceQueue);
        await remotePersistenceQueue;
        if(getSupabaseRuntimeStatus().durablePersistenceReady){const remote=await refreshPortalRuntimeState<PersistedPortalState>();if(!remote)return;applyPersistedState(remote);}
        const current=processesStore.find(item=>item.id===processId);
        if(!current||!canAccessProcess(actorEmail,current.id)
          ||!canRecoverRepositorySignature(current,signatureJobsStore,automaticAstenEnabled(current.astenSignatureIntent?.documentType)))return;
        const intent=current.astenSignatureIntent!;
        const event=repositorySignatureEvent(intent.documentType);
        const recorded=workflowRunsStore.filter(run=>run.processId===current.id&&run.eventCode===event&&run.sourceDataRevision===current.dataRevision)
          .slice().sort((a,b)=>b.startedAt.localeCompare(a.startedAt))[0];
        const studioRevision=currentSettings.integrationStudio?.revision||0;
        // Never silently replace the published workflow of an existing attempt.
        if((intent.studioRevision!==undefined&&intent.studioRevision!==studioRevision)||(recorded&&recorded.studioRevision!==studioRevision))return;
        assertSignatureEligibility(current,intent.documentType);
        const stillCurrent=()=>processesStore.includes(current)&&current.astenSignatureIntent===intent&&current.dataRevision===intent.revision;
        intent.attemptedAt=new Date().toISOString();delete intent.lastError;delete intent.lastErrorCode;
        // Cross-worker cooldown claim: a CAS conflict stops before any action.
        await persistPortalStateDurably();
        if(!stillCurrent())return;
        const eventActor=recorded?.actorEmail||current.acervo?.submittedBy||actorEmail;
        try{
          const run=await executeConfiguredWorkflowEvent(current,event,eventActor,recorded?.eventVariables,recorded);
          if(!stillCurrent())return;
          if(!run||run.status!=='COMPLETED'){
            Object.assign(intent,safeRepositorySignatureError(undefined,true));await persistPortalStateDurably();return;
          }
          await executeAutomaticAsten(current,intent.documentType,eventActor);
        }catch(error){
          if(stillCurrent()){Object.assign(intent,safeRepositorySignatureError(error));await persistPortalStateDurably();}
        }
      }finally{release();}
    })().catch(()=>{console.error('[ASTEN] Retomada automática do repositório pendente; intenção preservada.');})
      .finally(()=>scheduledRepositorySignatureRecoveries.delete(processId));
    if(globalThis.process?.env?.VERCEL)waitUntil(task);
  }

  const astenStatusChecks=new Map<string,number>();
  const scheduledAstenChecks=new Set<string>();
  function currentAstenCheckDue(portalProcess:ProcessData,job:SignatureJob):boolean{
    const now=Date.now();
    return now-(astenStatusChecks.get(job.id)||0)>=ASTEN_STATUS_CHECK_INTERVAL_MS
      &&astenStatusCheckDue(portalProcess,job,signatureJobsStore,now);
  }

  async function checkCurrentAstenEnvelope(portalProcess:ProcessData,job:SignatureJob):Promise<boolean>{
    if(!currentAstenCheckDue(portalProcess,job))return false;
    const now=Date.now();
    for(const [id,checkedAt] of astenStatusChecks){
      if(now-checkedAt>=ASTEN_STATUS_CHECK_INTERVAL_MS)astenStatusChecks.delete(id);
    }
    astenStatusChecks.set(job.id,now);
    if(job.status==='SIGNED'||job.status==='DRIVE_SYNC_PENDING'){
      // Only archive retries need a durable claim across workers. An unchanged
      // provider read must not rewrite the aggregate or invalidate other users.
      job.providerStatusCheckedAt=new Date(now).toISOString();
      await persistPortalStateDurably();
      await archiveSignatureJobAutomatically(job);
      return true;
    }
    const connection=await getPersistentAstenConnection();
    if(!connection)throw new Error('Conexão Asten não configurada.');
    const envelopeId=job.providerEnvelopeId!;
    const state=await callAsten('getDadosEnvelope',{idEnvelope:envelopeId,getLobs:'N'},connection.token);
    const verified=inferAstenJobStatus(state,job.status,envelopeId);
    if(verified===job.status)return true;
    job.status=verified;
    job.updatedAt=new Date().toISOString();
    if(verified==='PARTIALLY_SIGNED'||verified==='SIGNED')job.providerDispatchState='SENT';
    await persistPortalStateDurably();
    if(verified==='SIGNED')await archiveSignatureJobAutomatically(job);
    return true;
  }

  function scheduleCurrentAstenCheck(portalProcess:ProcessData,allowedTypes:readonly string[]=['ATA','TERMO','DECLARACAO']):void{
    const job=signatureJobsStore.find(item=>allowedTypes.includes(item.documentType)&&currentAstenCheckDue(portalProcess,item));
    if(!job||scheduledAstenChecks.has(job.id))return;
    scheduledAstenChecks.add(job.id);
    const task=(async()=>{
      const release=await acquireRuntimeRequest();
      try{
        remotePersistenceQueue=settlePreviousRuntimeWrites(remotePersistenceQueue);
        await remotePersistenceQueue;
        if(getSupabaseRuntimeStatus().durablePersistenceReady){
          const remote=await refreshPortalRuntimeState<PersistedPortalState>();
          if(remote)applyPersistedState(remote);
        }
        const current=processesStore.find(item=>item.id===portalProcess.id);
        const envelope=signatureJobsStore.find(item=>item.id===job.id);
        if(current&&envelope)await checkCurrentAstenEnvelope(current,envelope);
      }finally{release();}
    })().catch(()=>{console.error('[ASTEN] Conferência do envelope pendente.');}).finally(()=>scheduledAstenChecks.delete(job.id));
    if(process.env.VERCEL)waitUntil(task);
  }

  async function recoverReservationNotices(actorEmail:string){
    const began=Date.now();let checked=0,failed=0;
    const candidates=selectReservationNoticeRecoveries(processesStore,emailDeliveriesStore,{now:new Date(),limit:25});
    for(const {process,processId} of candidates){
      if(Date.now()-began>20_000||processesStore.find(p=>p.id===processId)!==process)break;
      checked++;
      try{const notice=await notifyReservationResponse(process);if(notice?.status!=='ACCEPTED_BY_GMAIL')failed++;}
      catch{failed++;break;}
    }
    if(checked){
      auditLogsStore.push({id:`reservation-notice-recovery-${randomBytes(12).toString('hex')}`,actorEmail,actorRoles:getUserRolesForEmail(actorEmail).globalRoles,action:'RECUPERACAO_AVISOS_RESERVA',entityType:'email_recovery',entityId:'reservation-notices',after:{checked,failed},timestamp:new Date().toISOString()});
      await persistPortalStateDurably();
    }
    return {checked,failed};
  }

  app.get('/api/cron/reservation-notices',async(req,res)=>{
    const expected=String(process.env.CRON_SECRET||'').trim(),supplied=String(req.headers.authorization||'').replace(/^Bearer\s+/i,'').trim();
    if(expected.length<32||!supplied||!timingSafeEqual(createHash('sha256').update(expected).digest(),createHash('sha256').update(supplied).digest()))return res.status(401).json({error:'Não autorizado.'});
    if(!allowSignatureRetry('cron@portal.local','reservation-notices'))return res.status(429).json({error:'Recuperação já executada recentemente.'});
    res.setHeader('Cache-Control','no-store');
    res.json(await recoverReservationNotices('system@portal.local'));
  });

  app.post('/api/admin/reservation-notices/recover',requireAuthenticated,requireAdministrator,async(req,res)=>{
    const identity=getPortalIdentity(req)!;
    res.setHeader('Cache-Control','private, no-store');
    if(!allowSignatureRetry(identity.email,'reservation-notices')){res.setHeader('Retry-After','60');return res.status(429).json({error:'Aguarde um minuto antes de verificar os avisos novamente.'});}
    res.json(await recoverReservationNotices(identity.email));
  });

  app.get('/api/cron/asten-reconcile',async(req,res)=>{
    const expected=String(process.env.CRON_SECRET||'').trim();
    const supplied=String(req.headers.authorization||'').replace(/^Bearer\s+/i,'').trim();
    if(expected.length<32||!supplied||!timingSafeEqual(createHash('sha256').update(expected).digest(),createHash('sha256').update(supplied).digest()))return res.status(401).json({error:'Não autorizado.'});
    // Limita invocações autenticadas além do segredo dedicado; defesa contra retries duplicados.
    if(!allowSignatureRetry('cron@portal.local','asten-cron-reconcile'))return res.status(429).json({error:'Reconciliação já executada recentemente.'});
    try{
      const started=Date.now();
      const result=await reconcileQueuedAstenCallbacks(100,undefined,180_000);
      const byId=new Map(processesStore.map(process=>[process.id,process]));
      const due=signatureJobsStore.flatMap(job=>{
        const process=byId.get(job.processId);
        return process&&currentAstenCheckDue(process,job)?[{process,job}]:[];
      }).sort((a,b)=>(a.job.providerStatusCheckedAt||a.job.updatedAt||'').localeCompare(b.job.providerStatusCheckedAt||b.job.updatedAt||''));
      let signatureChecks=0,ataChecks=0;
      for(const {process,job} of due.slice(0,2)){
        if(Date.now()-started>180_000)break;
        try{if(await checkCurrentAstenEnvelope(process,job)){signatureChecks++;if(job.documentType==='ATA')ataChecks++;}}
        catch{result.failed++;break;}
      }
      res.setHeader('Cache-Control','no-store');
      res.status(result.failed?207:200).json({ok:result.failed===0,...result,signatureChecks,ataChecks});
    }catch{res.status(503).json({error:'Falha ao persistir a reconciliação Asten.'});}
  });
  // O Master pode antecipar a reconciliação manualmente, sem despachar envelopes.
  app.post('/api/admin/asten/reconcile-events',requireAuthenticated,requireAdministrator,async(req,res)=>{
    const identity=getPortalIdentity(req)!;

    if(!allowSignatureRetry(identity.email,'asten-webhook-batch'))return res.status(429).json({error:'A reconciliação foi solicitada recentemente. Tente depois.'});
    try{
      const result=await reconcileQueuedAstenCallbacks(5);
      res.setHeader('Cache-Control','no-store');
      res.status(result.failed?207:200).json({ok:result.failed===0,...result});
    }catch{
      res.status(503).json({error:'A reconciliação Asten ainda não pôde ser concluída.'});
    }
  });


  // GET /api/me
  app.get('/api/me', (req, res) => {
    const identity=getPortalIdentity(req); const email=identity?.email||'visitante@publico.local';
    const { globalRoles, memberships } = getUserRolesForEmail(email);

    res.json({
      userEmail: email,
      globalRoles,
      memberships,
      isAuthenticated: Boolean(identity), canRegisterProcess:Boolean(identity&&canRegisterProcess(identity.email)), authenticationMode:identity?.method||'PUBLIC'
    });
  });

  app.post('/api/auth/request-code', async (req,res)=>{
    const startedAt=Date.now();
    const email=normalizeEmail(String(req.body?.email||''));
    if(!isValidPortalEmail(email))return res.status(400).json({error:'Informe um e-mail válido.'});
    const allowedByIp=allowOtpRequestFromIp(req.ip||'');
    if(!allowedByIp){await enforceMinimumResponseTime(startedAt);return res.status(429).json({error:'Limite de solicitações atingido. Aguarde alguns minutos.'});}
    if(!canRequestPortalAccess(email)){
      await enforceMinimumResponseTime(startedAt);
      return res.json({sent:false,code:'EMAIL_NOT_REGISTERED',expiresInMinutes:0,message:'Este e-mail não está cadastrado ou autorizado no Portal TCC. Confira o endereço ou solicite acesso à secretaria.'});
    }
    try {
      const challengeId=await requestAuditedPortalOtp({email,ip:req.ip,portalName:resolveInstallationProfile(currentSettings).portalName,browserChallengeId:readOtpChallengeCookie(req)});
      setOtpChallengeCookie(res,challengeId);
      await enforceMinimumResponseTime(startedAt);
      return res.json({sent:true,expiresInMinutes:10,message:'Código solicitado com sucesso. Confira sua caixa de entrada.'});
    }catch(error){
      await enforceMinimumResponseTime(startedAt);
      if(error instanceof OtpResendCooldownError){
        res.setHeader('Retry-After',String(error.retryAfterSeconds));
        return res.status(429).json({
          code:error.canVerifyExistingCode?'OTP_CHALLENGE_ACTIVE':'OTP_RESEND_COOLDOWN',
          error:error.canVerifyExistingCode?'Use o código já enviado para este e-mail.':`Aguarde ${error.retryAfterSeconds} segundos antes de solicitar outro código neste navegador.`
        });
      }
      return res.status(503).json({error:error instanceof Error?error.message:'Não foi possível enviar o código. Tente novamente mais tarde.'});
    }
  });

  app.post('/api/auth/verify-code',async(req,res)=>{
    const startedAt=Date.now();
    const email=normalizeEmail(String(req.body?.email||''));
    if(!canRequestPortalAccess(email)){await enforceMinimumResponseTime(startedAt);return res.status(401).json({error:'Código inválido ou expirado.'});}
    try{
      assertPortalSessionConfigured();
      await verifyPortalOtp({email,code:String(req.body?.code||''),challengeId:readOtpChallengeCookie(req)});
      const identity=setPortalSessionCookie(res,email,'EMAIL_OTP');
      const roles=getUserRolesForEmail(email);
      await enforceMinimumResponseTime(startedAt);
      res.json({userEmail:email,globalRoles:roles.globalRoles,memberships:roles.memberships,isAuthenticated:true,expiresAt:new Date(identity.expiresAt*1000).toISOString()});
    }catch{await enforceMinimumResponseTime(startedAt);res.status(401).json({error:'Código inválido ou expirado.'});}
  });

  app.post('/api/auth/logout',async(req,res)=>{const identity=getPortalIdentity(req);if(identity?.sessionId){revokedSessionIdsStore.add(identity.sessionId);await persistPortalStateDurably();}clearPortalSessionCookie(res);res.json({signedOut:true});});

  app.post('/api/auth/request-recovery-code',async(req,res)=>{
    const startedAt=Date.now();
    const email=normalizeEmail(String(req.body?.email||''));
    const allowed=(currentSettings.masterRecoveryEmails||[]).map(normalizeEmail).includes(email);
    const allowedByIp=allowOtpRequestFromIp(req.ip||'');
    if(allowed&&allowedByIp){const challengeId=await requestAuditedPortalOtp({email,ip:req.ip,portalName:resolveInstallationProfile(currentSettings).portalName}).catch(()=>undefined);if(challengeId)setOtpChallengeCookie(res,challengeId);}
    await enforceMinimumResponseTime(startedAt);
    res.json({sent:true,message:'Se o e-mail estiver cadastrado para recuperação, o código será enviado.'});
  });

  app.get('/api/setup/status',async(_req,res)=>{
    const google=await getGoogleWorkspaceStatus();
    const otp=getOtpRuntimeStatus();
    res.json({otp:{configured:otp.configured},google:{oauthConfigured:google.oauthConfigured,connected:google.connected},bootstrapMasterConfigured:Boolean(process.env.PORTAL_BOOTSTRAP_MASTER_EMAIL)});
  });

  app.get('/api/integrations/google/oauth/start',async(req,res)=>{
    try{
      const google=await getGoogleWorkspaceStatus();
      const identity=getPortalIdentity(req);
      const bootstrap=!google.connected;
      if(!bootstrap&&(!identity||!hasFullAdministration(identity.email)))return res.status(403).json({error:'Somente o usuário Master pode autorizar ou substituir a conta Google do portal.'});
      if(!bootstrap&&identity&&!hasRecentAuthentication(identity))return res.status(428).json({error:'Entre novamente antes de substituir a conta Google do portal.',code:'REAUTHENTICATION_REQUIRED'});
      const email=bootstrap?normalizeEmail(String(currentSettings.masterEmail||'')):identity!.email;
      if(bootstrap&&!email)return res.status(409).json({error:'Configure o Master atual antes de conectar o Google.'});
      const requestedReturnTo=String(req.query.returnTo||'/?google=connected');
      const returnTo=safeGoogleReturnTo(requestedReturnTo);
      res.redirect(buildGoogleAuthorizationUrl({email,bootstrap,returnTo}));
    }catch(error){res.status(400).json({error:error instanceof Error?error.message:'Não foi possível iniciar a autorização Google.'});}
  });

  app.get('/api/integrations/google/oauth/callback',async(req,res)=>{
    try{
      const state=decodeGoogleOAuthState(String(req.query.state||''));
      const identity=getPortalIdentity(req);
      const expected=assertCurrentGoogleOAuthActor({state,masterEmail:currentSettings.masterEmail,sessionValidAfter:currentSettings.sessionValidAfter,identityEmail:identity?.email,administrator:Boolean(identity&&hasFullAdministration(identity.email)),recentAuthentication:Boolean(identity&&hasRecentAuthentication(identity))});
      const authorization=await exchangeGoogleAuthorizationCode(String(req.query.code||''));
      if(expected&&normalizeEmail(authorization.email)!==expected)throw new Error(`Autorize a conta Google esperada (${expected}).`);
      await persistGoogleWorkspaceAuthorization(authorization);
      const manifest=await bootstrapGoogleDriveStructure(authorization.accessToken,{rootFolderName:resolveInstallationProfile(currentSettings).driveRootFolderName});
      currentSettings={...currentSettings,driveRootFolderId:manifest.rootFolderId,updatedAt:new Date().toISOString()};
      auditLogsStore.push({id:`log-${Date.now()}`,actorEmail:authorization.email,actorRoles:getUserRolesForEmail(authorization.email).globalRoles,action:'CONEXAO_GOOGLE_WORKSPACE',entityType:'integration',entityId:'google_workspace',after:{rootFolderId:manifest.rootFolderId,modelFiles:manifest.modelFiles},timestamp:new Date().toISOString()});
      await persistPortalStateDurably();
      res.redirect(safeGoogleReturnTo(state.returnTo));
    }catch(error){res.status(400).send(`Falha na autorização Google: ${escapeHtml(error instanceof Error?error.message:'erro desconhecido')}`);}
  });

  // GET /api/settings
  app.get('/api/registration/draft',requireAuthenticated,requireRegistrationApplicant,(req,res)=>{
    const email=getPortalIdentity(req)!.email;registrationDraftsStore=pruneDrafts(registrationDraftsStore);
    res.setHeader('Cache-Control','private, no-store');res.json(registrationDraftsStore[email]||null);
  });
  app.put('/api/registration/draft',requireAuthenticated,requireRegistrationApplicant,async(req,res)=>{
    const email=getPortalIdentity(req)!.email;
    if(processesStore.some(p=>[p.aluno1.email,p.aluno2?.email].includes(email)))return res.status(409).json({error:'Você já tem um TCC. Continue pelo processo existente.'});
    let finishDraftCommit:(()=>void)|undefined;
    try{
      const draft=saveRegistrationDraft(registrationDraftsStore[email],req.body,email,currentSettings.integrationStudio);
      finishDraftCommit=registrationRequestTiming(req)?.measure('draft_commit');
      let committed=false;
      if(getSupabaseRuntimeStatus().durablePersistenceReady){
        const authorizedRuntimeRevision=currentPortalRuntimeRevision();
        remotePersistenceQueue=remotePersistenceQueue.catch(()=>undefined).then(async()=>{committed=await saveRegistrationDraftRuntimeState(email,draft,req.body.expectedRevision,authorizedRuntimeRevision);});
        await remotePersistenceQueue;
      }
      registrationDraftsStore[email]=draft;
      // Rolling deployment: a definite missing RPC has no effects, so retain
      // the existing durable path until its additive migration is installed.
      if(!committed)await persistPortalStateDurably();
      finishDraftCommit?.();
      res.setHeader('Cache-Control','private, no-store');res.json(draft);
    }
    catch(error){finishDraftCommit?.();res.status(error instanceof DraftConflict?409:400).json({error:error instanceof Error?error.message:'Rascunho inválido.'});}
  });
  app.delete('/api/registration/draft',requireAuthenticated,requireRegistrationApplicant,async(req,res)=>{const email=getPortalIdentity(req)!.email;delete registrationDraftsStore[email];await persistPortalStateDurably();res.json({deleted:true});});
  function registrationSchemaFor(email:string){
    const applicant=authorizedStudentsStore.find(entry=>entry.active&&normalizeEmail(entry.email)===normalizeEmail(email));
    const applicantName=applicant?.nome?.trim()||undefined;
    const studio=currentSettings.integrationStudio;const config=operationalConfig(studio);
    return {applicantName,revision:studio?.revision||0,formTemplates:(studio?.formTemplates||[]).filter(form=>form.id==='form-reserva-aluno').map(form=>({...form,questions:registrationQuestions(studio)})),formDesigns:studio?.formDesigns?.['form-reserva-aluno']?{'form-reserva-aluno':{templateId:'form-reserva-aluno',introText:studio.formDesigns['form-reserva-aluno'].introText,confirmationMessage:studio.formDesigns['form-reserva-aluno'].confirmationMessage,submitLabel:studio.formDesigns['form-reserva-aluno'].submitLabel,showProgress:studio.formDesigns['form-reserva-aluno'].showProgress}}:{},operationsPolicy:{timezone:studio?.operationsPolicy?.timezone||'America/Sao_Paulo'},operationalConfig:{reservation:{departmentEmail:'',locations:config.reservation.locations},catalogs:config.catalogs,diagnostics:config.diagnostics,presentations:{},workflow:{...workflowPolicy(studio),deadlines:[],holidays:[]}}};
  }
  app.get('/api/forms/registration-schema',requireAuthenticated,requireRegistrationApplicant,(req,res)=>{
    res.setHeader('Cache-Control','private, no-store');res.json(registrationSchemaFor(getPortalIdentity(req)!.email));
  });
  app.get('/api/registration/bootstrap',requireAuthenticated,requireRegistrationApplicant,(req,res)=>{
    const email=normalizeEmail(getPortalIdentity(req)!.email);
    const drafts=pruneDrafts(registrationDraftsStore);
    const hasExistingProcess=!hasFullAdministration(email)&&processesStore.some(process=>[process.aluno1.email,process.aluno2?.email].some(author=>normalizeEmail(author||'')===email));
    res.setHeader('Cache-Control','private, no-store');
    res.json({schema:registrationSchemaFor(email),draft:drafts[email]||null,hasExistingProcess});
  });
  app.get('/api/settings', (req, res) => {
    res.setHeader('Cache-Control','private, no-store');
    const identity=getPortalIdentity(req);res.json({...publicSettingsForRequest(Boolean(identity&&hasFullAdministration(identity.email))),automaticAstenEnabled:automaticAstenEnabled()});
  });

  app.get('/api/public/installation-profile',(_req,res)=>res.json(resolveInstallationProfile(currentSettings)));
  const indicatorsHandler:express.RequestHandler=(_req,res)=>{
    res.setHeader('Cache-Control','private, no-store, max-age=0');
    try{
      res.json(buildPublicIndicatorsFromState({processes:processesStore,legacyAcademicRecords:legacyAcademicRecordsStore}));
    }catch(error){
      console.error('[Indicadores] Falha ao gerar estatísticas:',error);
      res.status(503).json({error:'Os indicadores estão temporariamente indisponíveis.'});
    }
  };
  app.get('/api/public/indicators',indicatorsHandler);
  app.all('/api/public/indicators',(_req,res)=>{
    res.setHeader('Allow','GET, HEAD');
    res.status(405).json({error:'Método não permitido.'});
  });
  app.get('/api/admin/indicators',requireAuthenticated,requirePresidencyOperator,indicatorsHandler);

  app.get('/api/admin/installation-profile',requireAuthenticated,requireAdministrator,(_req,res)=>res.json({profile:resolveInstallationProfile(currentSettings),updatedAt:currentSettings.updatedAt}));
  app.patch('/api/admin/installation-profile',requireAuthenticated,requireAdministrator,(req,res)=>{
    const identity=getPortalIdentity(req)!;if(req.body?.expectedUpdatedAt&&req.body.expectedUpdatedAt!==currentSettings.updatedAt)return res.status(409).json({error:'A configuração foi alterada em outra sessão. Recarregue antes de salvar.'});
    const previous=resolveInstallationProfile(currentSettings);const patch=req.body?.profile||req.body||{};
    const next=resolveInstallationProfile({installationProfile:{...previous,...patch}} as GlobalSettings);
    if(!next.portalName.trim()||!next.institutionName.trim()||!next.courseName.trim())return res.status(400).json({error:'Nome do portal, instituição e curso são obrigatórios.'});
    if(!/^[a-z0-9][a-z0-9-]{2,50}$/.test(next.installationId))return res.status(400).json({error:'O identificador da instalação deve usar letras minúsculas, números e hífens.'});
    if(!next.studentEmailDomains.length)return res.status(400).json({error:'Cadastre ao menos um domínio de e-mail de aluno.'});
    const now=new Date().toISOString();currentSettings={...currentSettings,installationProfile:next,timezone:String(next.locale==='pt-BR'?currentSettings.timezone||'America/Sao_Paulo':currentSettings.timezone),updatedAt:now};
    auditLogsStore.push({id:`log-${Date.now()}`,actorEmail:identity.email,actorRoles:getUserRolesForEmail(identity.email).globalRoles,action:'ATUALIZACAO_PERFIL_INSTALACAO',entityType:'installation_profile',entityId:next.installationId,before:previous,after:next,timestamp:now});persistPortalState();res.json({profile:next,updatedAt:now});
  });

  app.get('/api/academic-cycles',(_req,res)=>res.json((currentSettings.academicCycles||[]).filter(cycle=>cycle.active||cycle.status==='OPEN')));
  app.get('/api/admin/academic-cycles',requireAuthenticated,requireAdministrator,requireFeature('ACADEMIC_CYCLES'),(_req,res)=>res.json(currentSettings.academicCycles||[]));
  app.post('/api/admin/academic-cycles',requireAuthenticated,requireAdministrator,requireFeature('ACADEMIC_CYCLES'),(req,res)=>{
    const identity=getPortalIdentity(req)!;const year=Number(req.body?.year),term=String(req.body?.term||'').trim(),label=String(req.body?.label||'').trim();
    const dates=['submissionOpenAt','submissionCloseAt','defenseStartAt','defenseEndAt'].map(key=>String(req.body?.[key]||''));
    if(!Number.isInteger(year)||year<2000||year>2200||!term||!label||dates.some(value=>!Number.isFinite(Date.parse(value))))return res.status(400).json({error:'Informe identificação, ano e todas as datas válidas do período.'});
    if(Date.parse(dates[0])>=Date.parse(dates[1])||Date.parse(dates[2])>=Date.parse(dates[3]))return res.status(400).json({error:'As datas de encerramento precisam ser posteriores às datas de início.'});
    const now=new Date().toISOString();const cycle:AcademicCycle={id:`cycle-${year}-${term.toLowerCase().replace(/[^a-z0-9]+/g,'-')}-${Date.now().toString(36)}`,label,year,term,submissionOpenAt:dates[0],submissionCloseAt:dates[1],defenseStartAt:dates[2],defenseEndAt:dates[3],status:'DRAFT',active:false,createdAt:now,updatedAt:now};
    currentSettings={...currentSettings,academicCycles:[...(currentSettings.academicCycles||[]),cycle],updatedAt:now};auditLogsStore.push({id:`log-${Date.now()}`,actorEmail:identity.email,actorRoles:getUserRolesForEmail(identity.email).globalRoles,action:'CRIACAO_PERIODO_ACADEMICO',entityType:'academic_cycle',entityId:cycle.id,after:cycle,timestamp:now});persistPortalState();res.status(201).json(cycle);
  });
  app.patch('/api/admin/academic-cycles/:id',requireAuthenticated,requireAdministrator,requireFeature('ACADEMIC_CYCLES'),(req,res)=>{
    const identity=getPortalIdentity(req)!;const cycles=currentSettings.academicCycles||[],index=cycles.findIndex(cycle=>cycle.id===req.params.id);if(index<0)return res.status(404).json({error:'Período não encontrado.'});const before=cycles[index];const requestedStatus=String(req.body?.status||before.status) as AcademicCycle['status'];if(!['DRAFT','OPEN','CLOSED','ARCHIVED'].includes(requestedStatus))return res.status(400).json({error:'Estado de período inválido.'});
    const now=new Date().toISOString();const updated:AcademicCycle={...before,...req.body,id:before.id,year:Number(req.body?.year??before.year),status:requestedStatus,active:requestedStatus==='OPEN',createdAt:before.createdAt,updatedAt:now};const nextCycles=cycles.map((cycle,position)=>position===index?updated:(updated.active?{...cycle,active:false,status:cycle.status==='OPEN'?'CLOSED':cycle.status,updatedAt:now}:cycle));currentSettings={...currentSettings,academicCycles:nextCycles,updatedAt:now};auditLogsStore.push({id:`log-${Date.now()}`,actorEmail:identity.email,actorRoles:getUserRolesForEmail(identity.email).globalRoles,action:'ALTERACAO_PERIODO_ACADEMICO',entityType:'academic_cycle',entityId:updated.id,before,after:updated,timestamp:now});persistPortalState();res.json(updated);
  });

  app.get('/api/capabilities',(_req,res)=>res.json({features:(currentSettings.featureFlags||[]).map(flag=>({key:flag.key,enabled:flag.enabled,audience:flag.audience}))}));
  app.get('/api/admin/feature-flags',requireAuthenticated,requireAdministrator,(_req,res)=>res.json(currentSettings.featureFlags||[]));
  app.patch('/api/admin/feature-flags/:key',requireAuthenticated,requireAdministrator,(req,res)=>{
    const identity=getPortalIdentity(req)!;const key=String(req.params.key||'') as PortalFeatureKey;const existing=(currentSettings.featureFlags||[]).find(flag=>flag.key===key);if(!existing)return res.status(404).json({error:'Funcionalidade desconhecida.'});const now=new Date().toISOString();const updated={...existing,enabled:Boolean(req.body?.enabled),audience:['ALL','ADMIN_ONLY','PILOT'].includes(String(req.body?.audience))?req.body.audience:existing.audience,updatedAt:now,updatedBy:identity.email};currentSettings={...currentSettings,featureFlags:(currentSettings.featureFlags||[]).map(flag=>flag.key===key?updated:flag),updatedAt:now};auditLogsStore.push({id:`log-${Date.now()}`,actorEmail:identity.email,actorRoles:getUserRolesForEmail(identity.email).globalRoles,action:'ALTERACAO_FEATURE_FLAG',entityType:'feature_flag',entityId:key,before:existing,after:updated,timestamp:now});persistPortalState();res.json(updated);
  });

  app.patch('/api/admin/recovery-emails',requireAuthenticated,requireAdministrator,async(req,res)=>{
    const identity=getPortalIdentity(req)!;
    if(!hasRecentAuthentication(identity))return res.status(428).json({error:'Entre novamente antes de alterar o contato de recuperação.',code:'REAUTHENTICATION_REQUIRED'});
    const presidentEmail=normalizeEmail(currentSettings.commissionPresidentEmail||'');
    if(!presidentEmail)return res.status(409).json({error:'Defina primeiro a Presidente da Comissão e conclua a transferência do e-mail institucional.',code:'COMMISSION_PRESIDENT_REQUIRED'});
    const input:unknown[]=Array.isArray(req.body?.emails)?req.body.emails:[];
    const requested:string[]=Array.from(new Set<string>(input.map((value:unknown)=>normalizeEmail(String(value))).filter((value:string)=>isEmailAddress(value))));
    if(requested.length!==1||requested[0]!==presidentEmail)return res.status(400).json({error:'A Presidente da Comissão é o único contato de recuperação permitido para o Master.',code:'PRESIDENT_RECOVERY_ONLY'});
    const before=(currentSettings.masterRecoveryEmails||[]).map(value=>createHash('sha256').update(normalizeEmail(value)).digest('hex'));
    currentSettings={...currentSettings,masterRecoveryEmails:[presidentEmail],updatedAt:new Date().toISOString()};
    auditLogsStore.push({id:`log-${Date.now()}-recovery-contact`,actorEmail:identity.email,actorRoles:getUserRolesForEmail(identity.email).globalRoles,action:'ALTERACAO_CONTATO_RECUPERACAO',entityType:'security',entityId:'master_recovery_email',before:{emailHashes:before},after:{emailHashes:[createHash('sha256').update(presidentEmail).digest('hex')],count:1},timestamp:currentSettings.updatedAt});
    await persistPortalStateDurably();
    res.json(publicSettingsForRequest(true));
  });

  app.get('/api/admin/administration-transfers',requireAuthenticated,requireAdministrator,(_req,res)=>res.json(administrationTransfersStore.slice().reverse()));
  app.get('/api/administration-transfers/pending',requireAuthenticated,(req,res)=>{const identity=getPortalIdentity(req)!;res.json(administrationTransfersStore.filter(item=>item.targetEmail===identity.email&&item.status==='PENDING_TARGET_ACCEPTANCE'&&Date.parse(item.expiresAt)>Date.now()&&hasFullAdministration(item.requestedBy)));});
  app.post('/api/admin/administration-transfers',requireAuthenticated,requireAdministrator,async(req,res)=>{
    const identity=getPortalIdentity(req)!;if(!hasRecentAuthentication(identity))return res.status(428).json({error:'Confirme sua identidade para alterar os e-mails administrativos.',code:'REAUTHENTICATION_REQUIRED'});const role=String(req.body?.role||'') as AdministrationTransfer['role'],targetEmail=normalizeEmail(String(req.body?.targetEmail||''));if(!['MASTER_ADMIN','COMMISSION_PRESIDENT'].includes(role)||!isValidPortalEmail(targetEmail))return res.status(400).json({error:'Informe o papel e o novo e-mail válidos.'});const actorRoles=getUserRolesForEmail(identity.email).globalRoles;
    const now=new Date().toISOString();
    const before={masterEmail:currentSettings.masterEmail,ownerEmail:currentSettings.ownerEmail,commissionPresidentEmail:currentSettings.commissionPresidentEmail,masterRecoveryEmails:currentSettings.masterRecoveryEmails};
    // The authenticated Master is the final authority; old pending requests cannot undo this decision.
    for(const pending of administrationTransfersStore)if(pending.role===role&&pending.status==='PENDING_TARGET_ACCEPTANCE'){pending.status='CANCELED';pending.canceledAt=now;}
    currentSettings=role==='MASTER_ADMIN'
      ? {...currentSettings,masterEmail:targetEmail,ownerEmail:targetEmail,updatedAt:now}
      : {...currentSettings,commissionPresidentEmail:targetEmail,masterRecoveryEmails:[targetEmail],updatedAt:now};
    const transfer:AdministrationTransfer={id:`transfer-${randomBytes(12).toString('hex')}`,role,targetEmail,requestedBy:identity.email,status:'COMPLETED',requestedAt:now,expiresAt:now,completedAt:now,googleReconnectRequired:role==='MASTER_ADMIN'};
    administrationTransfersStore.push(transfer);
    auditLogsStore.push({id:`log-${randomBytes(12).toString('hex')}`,actorEmail:identity.email,actorRoles,action:'ALTERACAO_ADMINISTRACAO_POR_MASTER',entityType:'administration_transfer',entityId:transfer.id,before,after:{role,masterEmail:currentSettings.masterEmail,ownerEmail:currentSettings.ownerEmail,commissionPresidentEmail:currentSettings.commissionPresidentEmail,masterRecoveryEmails:currentSettings.masterRecoveryEmails},timestamp:now});
    await persistPortalStateDurably();return res.status(201).json(transfer);
  });
  app.post('/api/admin/administration-transfers/:id/accept',requireAuthenticated,async(req,res)=>{
    const identity=getPortalIdentity(req)!;const transfer=administrationTransfersStore.find(item=>item.id===req.params.id);if(!transfer||transfer.targetEmail!==identity.email||!hasFullAdministration(transfer.requestedBy))return res.status(404).json({error:'Transferência não encontrada.'});if(transfer.status!=='PENDING_TARGET_ACCEPTANCE'||Date.parse(transfer.expiresAt)<=Date.now()){if(transfer.status==='PENDING_TARGET_ACCEPTANCE')transfer.status='EXPIRED';return res.status(409).json({error:'A transferência expirou ou já foi concluída.'});}if(!hasRecentAuthentication(identity))return res.status(428).json({error:'Valide novamente o código recebido por e-mail.'});const before={masterEmail:currentSettings.masterEmail,ownerEmail:currentSettings.ownerEmail,commissionPresidentEmail:currentSettings.commissionPresidentEmail};if(transfer.role==='MASTER_ADMIN')currentSettings={...currentSettings,masterEmail:identity.email,ownerEmail:identity.email};else currentSettings={...currentSettings,commissionPresidentEmail:identity.email,masterRecoveryEmails:[identity.email]};transfer.status='COMPLETED';transfer.completedAt=new Date().toISOString();currentSettings.updatedAt=transfer.completedAt;auditLogsStore.push({id:`log-${Date.now()}`,actorEmail:identity.email,actorRoles:[transfer.role],action:'CONCLUSAO_TRANSFERENCIA_ADMINISTRACAO',entityType:'administration_transfer',entityId:transfer.id,before,after:{role:transfer.role,targetEmailHash:createHash('sha256').update(identity.email).digest('hex'),googleReconnectRequired:transfer.googleReconnectRequired},timestamp:transfer.completedAt});await persistPortalStateDurably();res.json({transfer,googleReconnectRequired:transfer.googleReconnectRequired,message:transfer.googleReconnectRequired?'Titularidade transferida. O novo Master deve autorizar a própria conta Google antes de desativar o acesso anterior.':'Presidência transferida com sucesso.'});
  });
  app.post('/api/admin/administration-transfers/:id/cancel',requireAuthenticated,requireAdministrator,async(req,res)=>{const identity=getPortalIdentity(req)!;const transfer=administrationTransfersStore.find(item=>item.id===req.params.id);if(!transfer)return res.status(404).json({error:'Transferência não encontrada.'});const actorRoles=getUserRolesForEmail(identity.email).globalRoles;if(transfer.role==='MASTER_ADMIN'&&!actorRoles.some(role=>role==='MASTER_ADMIN'||role==='COMMISSION_PRESIDENT'))return res.status(403).json({error:'Somente o Master ou a Presidente da Comissão pode cancelar a transferência Master.'});if(transfer.status!=='PENDING_TARGET_ACCEPTANCE')return res.status(409).json({error:'Somente transferências pendentes podem ser canceladas.'});transfer.status='CANCELED';transfer.canceledAt=new Date().toISOString();auditLogsStore.push({id:`log-${Date.now()}`,actorEmail:identity.email,actorRoles,action:'CANCELAMENTO_TRANSFERENCIA_ADMINISTRACAO',entityType:'administration_transfer',entityId:transfer.id,timestamp:transfer.canceledAt});await persistPortalStateDurably();res.json(transfer);});

  app.post('/api/admin/studio/compare',requireAuthenticated,requireAdministrator,(req,res)=>{
    const before=req.body?.baseRevision?studioVersionsStore.find(item=>item.revision===Number(req.body.baseRevision))?.snapshot:currentSettings.integrationStudio;
    if(!before)return res.status(404).json({error:'Versão de referência indisponível.'});
    const changes=compareStudioVersions(before,req.body?.studio||{});
    res.setHeader('Cache-Control','private, no-store');res.json({baseRevision:before.revision,changes,activeProcesses:processesStore.filter(p=>p.status!=='CONCLUIDO').length,notice:'Processos em andamento usam a revisão publicada nos próximos eventos. Documentos já expedidos permanecem preservados.'});
  });
  app.post('/api/admin/receipts/preview',requireAuthenticated,requireAdministrator,async(req,res)=>{
    if(!['CONFIRMED','UNAVAILABLE'].includes(req.body?.decision))return res.status(400).json({error:'Escolha reserva confirmada ou recusada.'});
    try{
      const p=studioSampleProcess();p.defesa.departmentResponse={decision:req.body.decision,revision:0,respondedBy:'departamento@example.invalid',departmentEmail:'departamento@example.invalid',respondedAt:'2026-11-04T15:41:00.000Z',startAt:p.defesa.startAt,endAt:p.defesa.endAt,local:p.defesa.local};
      const studio={...currentSettings.integrationStudio,receiptDesign:req.body?.receiptDesign};
      const usePublishedModel=req.body?.usePublishedModel===true;
      let sourcePdf:Buffer;
      if(usePublishedModel){
        const model=reservationReceiptTemplate(currentSettings),rootFolderId=currentSettings.driveRootFolderId;
        if(!model||!rootFolderId)return res.status(409).json({error:'Publique um DOCX com as variáveis obrigatórias e configure a pasta institucional.'});
        sourcePdf=await renderReservationReceiptTemplate(p,model,await getGoogleWorkspaceAccessToken(),rootFolderId);
      }else{
        sourcePdf=await createReservationReceiptPdf(p,{...currentSettings,integrationStudio:studio} as GlobalSettings);
      }
      const pdf=await markPreview(sourcePdf);
      const fileName='AMOSTRA_SEM_VALIDADE_COMPROVANTE.pdf';
      const download=getSupabaseRuntimeStatus().durablePersistenceReady&&pdf.length>2*1024*1024
        ?await createDrivePreviewTransfer({rootFolderId:currentSettings.driveRootFolderId||'',bytes:pdf,fileName,mimeType:'application/pdf',requesterBinding:sessionUploadBinding(getPortalIdentity(req)!),expiresInSeconds:60})
        :null;
      if(!download&&pdf.length>2*1024*1024)throw new Error('O transporte privado é necessário para esta prévia.');
      res.setHeader('Cache-Control','private, no-store');
      res.json({contentBase64:download?undefined:pdf.toString('base64'),downloadUrl:download?.url,fileName});
    }catch{res.status(422).json({error:'Não foi possível gerar a prévia do comprovante. Confira o modelo publicado, as variáveis e a conexão com o Drive.'});}
  });
  app.post('/api/admin/models/:type/preview',requireAuthenticated,requireAdministrator,async(req,res)=>{
    const identity=getPortalIdentity(req)!;
    const type=String(req.params.type).toUpperCase() as 'CONVITE'|'ATA'|'TERMO'|'DECLARACAO';if(!['CONVITE','ATA','TERMO','DECLARACAO'].includes(type))return res.status(404).json({error:'Modelo inválido.'});
    try{
      const studio={...(currentSettings.integrationStudio||{}),...(req.body?.studio||{})};
      const published=currentSettings.documentModels?.[type];
      if(!published?.driveFileId)throw new DocumentModelError('DOCUMENT_MODEL_REQUIRED');
      const source=await readDriveModelFingerprint(await getGoogleWorkspaceAccessToken(),published.driveFileId);
      const sample=previewProcess(studio,req.body?.answers||{});const pdf=await renderOfficialTemplatePdf(sample.process,type,undefined,sample.variables,studio,undefined,source);
      const analysis=await inspectPdfLayout(pdf,{...workflowPolicy(studio).documentLayout,needsSignature:type!=='CONVITE'});
      const marked=await markPreview(pdf),fileName=`AMOSTRA_SEM_VALIDADE_${type}.pdf`;
      const download=getSupabaseRuntimeStatus().durablePersistenceReady&&marked.length>2*1024*1024
        ?await createDrivePreviewTransfer({rootFolderId:currentSettings.driveRootFolderId||'',bytes:marked,fileName,mimeType:'application/pdf',requesterBinding:sessionUploadBinding(identity),expiresInSeconds:60}):null;
      if(!download&&marked.length>2*1024*1024)throw new Error('A prévia acima de 2 MB exige o transporte privado do Portal.');
      res.setHeader('Cache-Control','private, no-store');res.json({analysis,fileName,downloadUrl:download?.url,expiresAt:download?.expiresAt,contentBase64:download?undefined:marked.toString('base64'),modelFileId:published.driveFileId,modelVersion:published.activeVersion||1,templateSha256:source.contentSha256,templateChangedSincePublication:source.contentSha256!==published.contentSha256,studioRevision:studio.revision,signed:false});
    }catch(error){res.status(422).json({error:error instanceof Error?error.message:'Não foi possível gerar o PDF real.'});}
  });
  app.get('/api/admin/analytics/advanced',requireAuthenticated,requireAdministrator,async(req,res)=>{
    const profile=resolveInstallationProfile(currentSettings);
    const report=buildAdvancedAnalytics({studio:currentSettings.integrationStudio,processes:processesStore,workflowRuns:workflowRunsStore,emailDeliveries:emailDeliveriesStore,signatureJobs:signatureJobsStore,formSubmissions:studioFormSubmissionsStore,correctionRequests:correctionRequestsStore,courseName:profile.courseName,institutionName:profile.institutionName},String(req.query.period||''),String(req.query.compare||''));
    res.setHeader('Cache-Control','private, no-store');
    if(req.query.format==='csv'){res.setHeader('Content-Disposition','attachment; filename="estatisticas-tcc.csv"');return res.type('text/csv; charset=utf-8').send(analyticsCsv(report));}
    if(req.query.format==='pdf'){
      try{res.setHeader('Content-Disposition','attachment; filename="relatorio-institucional-tcc.pdf"');return res.type('application/pdf').send(await buildInstitutionalReport(report,{courseName:profile.courseName,institutionName:profile.institutionName},institutionalReportTheme(currentSettings.integrationStudio?.brandKit)));}
      catch(error){return res.status(422).json({error:error instanceof Error?error.message:'Não foi possível gerar o relatório institucional.'});}
    }
    res.json(report);
  });
  app.post('/api/admin/workflow/simulate',requireAuthenticated,requireAdministrator,async(req,res)=>{res.setHeader('Cache-Control','private, no-store');if(productionRuntime)return res.status(410).json({error:'A simulação não está disponível no Portal publicado.',code:'WORKFLOW_SIMULATION_DISABLED'});try{const studio=req.body?.studio||currentSettings.integrationStudio;if(!studio)return res.status(400).json({error:'Configure o Estúdio primeiro.'});res.json(await simulateWorkflow(studio,req.body?.scenario||{}));}catch(error){res.status(400).json({error:error instanceof Error?error.message:'Simulação inválida.'});}});
  app.get('/api/admin/metrics/definitions',requireAuthenticated,requireAdministrator,(_req,res)=>res.json([
    {key:'processes',label:'Trabalhos cadastrados',unit:'count'},{key:'completionRate',label:'Taxa de conclusão',unit:'percent'},{key:'publicationRate',label:'Taxa de publicação',unit:'percent'},{key:'signatures',label:'Assinaturas Asten',unit:'count'},{key:'emails',label:'Entregas de e-mail',unit:'count'}
  ]));
  app.get('/api/admin/metrics',requireAuthenticated,requireAdministrator,(req,res)=>{
    const cycleId=String(req.query.cycleId||'');const selected=processesStore.filter(process=>!cycleId||process.academicCycleId===cycleId);const total=selected.length,completed=selected.filter(process=>process.status==='CONCLUIDO').length,published=selected.filter(publicationRequested).length;const processIds=new Set(selected.map(process=>process.id));const jobs=signatureJobsStore.filter(job=>!job.removedFromLogsAt&&processIds.has(job.processId));const emails=emailDeliveriesStore.filter(record=>!record.processId||processIds.has(record.processId));const byStatus=Object.fromEntries(Array.from(new Set(selected.map(process=>process.status))).map(status=>[status,selected.filter(process=>process.status===status).length]));const completedDurations=selected.filter(process=>process.status==='CONCLUIDO').map(process=>Date.parse(process.updatedAt)-Date.parse(process.createdAt)).filter(value=>Number.isFinite(value)&&value>=0).sort((a,b)=>a-b);const middle=Math.floor(completedDurations.length/2),medianMs=completedDurations.length?(completedDurations.length%2?completedDurations[middle]:(completedDurations[middle-1]+completedDurations[middle])/2):null;
    const outcomes=total>=5?Object.fromEntries(Array.from(new Set(selected.map(process=>process.avaliacao.resultadoCode).filter(Boolean))).map(code=>[String(code),selected.filter(process=>process.avaliacao.resultadoCode===code).length])):null;
    res.setHeader('Cache-Control','private, no-store');res.json({generatedAt:new Date().toISOString(),cycleId:cycleId||null,privacy:{containsPersonalData:false,smallGroupSuppressed:total>0&&total<5},processes:{total,completed,byStatus,completionRate:total?Number((completed/total*100).toFixed(1)):0,medianCompletionDays:medianMs===null?null:Number((medianMs/86_400_000).toFixed(1)),outcomes},publication:{published,rate:total?Number((published/total*100).toFixed(1)):0},signatures:{total:jobs.length,archived:jobs.filter(job=>job.status==='ARCHIVED').length,failed:jobs.filter(job=>['PROVIDER_ERROR','DECLINED','EXPIRED','DRIVE_SYNC_PENDING'].includes(job.status)).length},emails:{total:emails.length,accepted:emails.filter(record=>record.status==='ACCEPTED_BY_GMAIL').length,failed:emails.filter(record=>record.status==='FAILED').length},quality:{pendingCoauthor:0,missingFinalData:selected.filter(process=>process.avaliacao.status==='CONCLUIDO'&&!repositoryDataComplete(process)).length}});
  });

  app.get('/api/public/calendar.ics',(req,res)=>{
    const escapeIcs=(value:unknown)=>String(value||'').replace(/\\/g,'\\\\').replace(/\r?\n/g,'\\n').replace(/,/g,'\\,').replace(/;/g,'\\;');
    const date=(value:string)=>{const parsed=new Date(value);return Number.isFinite(parsed.getTime())?parsed.toISOString().replace(/[-:]/g,'').replace(/\.\d{3}Z$/,'Z'):'';};
    const host=String(req.get('host')||'portal.local');
    const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Portal Institucional de TCC//Agenda//PT','CALSCALE:GREGORIAN','METHOD:PUBLISH',`X-WR-CALNAME:${escapeIcs(resolveInstallationProfile(currentSettings).portalName)}`,`X-WR-TIMEZONE:${escapeIcs(currentSettings.integrationStudio?.operationsPolicy?.timezone||currentSettings.timezone||'America/Sao_Paulo')}`];
    for(const process of processesStore.filter(item=>item.status!=='EM_RASCUNHO'&&effectiveDefenseReservationStatus(item)==='CONFIRMADO'&&isDefenseOnCalendar(item)))lines.push('BEGIN:VEVENT',`UID:${escapeIcs(process.id)}@${escapeIcs(host)}`,`DTSTAMP:${date(process.updatedAt)}`,`DTSTART:${date(process.defesa.startAt)}`,`DTEND:${date(defenseEndAt(process.defesa.startAt))}`,`SUMMARY:${escapeIcs(`Defesa de TCC — ${formatStudentsString(process.aluno1,process.aluno2)}`)}`,`DESCRIPTION:${escapeIcs(`${process.titulo} | ${process.protocolo}`)}`,`LOCATION:${escapeIcs(process.defesa.local)}`,'END:VEVENT');
    lines.push('END:VCALENDAR');res.setHeader('Content-Type','text/calendar; charset=utf-8');res.setHeader('Content-Disposition','attachment; filename="agenda-defesas.ics"');res.setHeader('Cache-Control','public, max-age=300');res.send(lines.join('\r\n'));
  });

  // Table defaults are public presentation; personal preferences stay bound to the session.
  app.get('/api/table-preferences/:key',requireAuthenticated,(req,res)=>{
    if(!validTableKey(req.params.key))return res.status(400).json({error:'Planilha inválida.'});
    res.setHeader('Cache-Control','private, no-store');
    res.json(tablePreferencesStore[getPortalIdentity(req)!.email]?.[req.params.key] || null);
  });
  app.put('/api/table-preferences/:key',requireAuthenticated,async(req,res)=>{
    if(!validTableKey(req.params.key))return res.status(400).json({error:'Planilha inválida.'});
    try{const email=getPortalIdentity(req)!.email;const next=sanitizeTablePreference(req.body);tablePreferencesStore[email]={...tablePreferencesStore[email],[req.params.key]:next};await persistPortalStateDurably();res.setHeader('Cache-Control','private, no-store');res.json(next);}
    catch(error){res.status(400).json({error:error instanceof Error?error.message:'Não foi possível salvar a exibição.'});}
  });
  app.delete('/api/table-preferences/:key',requireAuthenticated,async(req,res)=>{
    if(!validTableKey(req.params.key))return res.status(400).json({error:'Planilha inválida.'});
    const email=getPortalIdentity(req)!.email;tablePreferencesStore[email]={...tablePreferencesStore[email],[req.params.key]:{}};await persistPortalStateDurably();res.json({deleted:true});
  });
  app.put('/api/admin/table-defaults/:key',requireAuthenticated,async(req,res)=>{
    if(!getUserRolesForEmail(getPortalIdentity(req)!.email).globalRoles.includes('MASTER_ADMIN'))return res.status(403).json({error:'Somente o Master pode definir o padrão.'});
    if(!validTableKey(req.params.key))return res.status(400).json({error:'Planilha inválida.'});
    try{const next=sanitizeTablePreference(req.body);currentSettings={...currentSettings,tableLayouts:{...currentSettings.tableLayouts,[req.params.key]:next},updatedAt:new Date().toISOString()};auditLogsStore.push({id:`log-${Date.now()}-${randomBytes(4).toString('hex')}`,actorEmail:getPortalIdentity(req)!.email,actorRoles:['MASTER_ADMIN'],action:'PADRAO_PLANILHA_ATUALIZADO',entityType:'settings',entityId:req.params.key,after:next,timestamp:new Date().toISOString()});await persistPortalStateDurably();res.json(next);}
    catch(error){res.status(400).json({error:error instanceof Error?error.message:'Não foi possível salvar o padrão.'});}
  });

  app.get('/api/notification-preferences',requireAuthenticated,(req,res)=>{const email=getPortalIdentity(req)!.email;res.setHeader('Cache-Control','private, no-store');res.json(notificationPreferencesStore[email]||{email:true,inPortal:true,dailyDigest:false,workflowEvents:true,signatureEvents:true,failureEvents:true,updatedAt:new Date(0).toISOString()});});
  app.patch('/api/notification-preferences',requireAuthenticated,(req,res)=>{const identity=getPortalIdentity(req)!;const previous=notificationPreferencesStore[identity.email]||{} as NotificationPreferences;const next:NotificationPreferences={email:req.body?.email!==false,inPortal:req.body?.inPortal!==false,dailyDigest:Boolean(req.body?.dailyDigest),workflowEvents:req.body?.workflowEvents!==false,signatureEvents:req.body?.signatureEvents!==false,failureEvents:req.body?.failureEvents!==false,updatedAt:new Date().toISOString()};notificationPreferencesStore[identity.email]={...previous,...next};persistPortalState();res.json(notificationPreferencesStore[identity.email]);});
  function collectNotifications(email:string, requestedId?:string): Omit<PortalNotificationDetail,'read'>[] {
    const admin=hasFullAdministration(email);
    const processes=new Map(processesStore.map(item=>[item.id,item]));
    const processAccess=new Map<string,boolean>();
    const hasProcessAccess=(processId:string)=>{
      if(!processAccess.has(processId))processAccess.set(processId,processes.has(processId)&&canAccessProcess(email,processId));
      return processAccess.get(processId);
    };
    const notifications:Omit<PortalNotificationDetail,'read'>[]=[];
    const matches=(id:string)=>!requestedId||requestedId===id;
    const emailAlerts=emailDeliveriesStore.filter(item=>matches(`email-${item.id}`)&&item.status!=='ACCEPTED_BY_GMAIL'&&(admin||(
      item.processId&&
      [item.requestedBy,item.recipient,...(item.additionalRecipients||[]),...(item.workflowCc||[])].some(address=>address&&normalizeEmail(address)===email)&&
      hasProcessAccess(item.processId)
    )));
    for(const item of emailAlerts.slice(-50))notifications.push({
      id:`email-${item.id}`,severity:item.status==='FAILED'?'ERROR':'WARNING',category:'EMAIL',
      title:'Entrega de e-mail requer atenção',message:item.subject,status:item.status,processId:item.processId,
      protocol:item.protocol,createdAt:item.updatedAt,
      context:requestedId?`Tentativas registradas: ${item.attempts?.length||0}.`:undefined,
    });
    const signatureAlerts=signatureJobsStore.filter(job=>{
      if(!matches(`signature-${job.id}`)||!visibleProcessSignatureEvidence(job)||!['PROVIDER_ERROR','DECLINED','EXPIRED','DRIVE_SYNC_PENDING'].includes(job.status))return false;
      const process=processes.get(job.processId);
      return Boolean(process&&(hasProcessAccess(job.processId)||(job.documentType==='DECLARACAO'&&canAccessPresidencyDeclaration(email,process))));
    });
    for(const job of signatureAlerts.slice(-50))notifications.push({
      id:`signature-${job.id}`,severity:'ERROR',category:'SIGNATURE',title:'Assinatura requer atenção',
      message:job.documentTitle||job.documentType,status:job.status,processId:job.processId,protocol:job.protocol,
      createdAt:job.updatedAt,context:requestedId&&job.documentVersion?`Versão do documento: ${job.documentVersion}.`:undefined,
    });
    if(admin){
      for(const job of formArchiveJobsStore.filter(item=>matches(`form-archive-${item.id}`)&&item.status==='FAILED').slice(-50))notifications.push({id:`form-archive-${job.id}`,severity:'ERROR',category:'FORM_ARCHIVE',title:'Formulário aguardando arquivamento',message:job.formType,status:job.status,processId:job.processId,createdAt:job.updatedAt});
      for(const submission of studioFormSubmissionsStore.filter(item=>matches(`studio-form-${item.id}`)&&item.archiveStatus==='FAILED').slice(-50))notifications.push({id:`studio-form-${submission.id}`,severity:'ERROR',category:'FORM_ARCHIVE',title:'Formulário personalizado aguardando arquivamento',message:submission.formId,status:submission.archiveStatus,processId:submission.processId,createdAt:submission.submittedAt});
      for(const run of workflowRunsStore.filter(item=>matches(`workflow-${item.id}`)&&item.status!=='COMPLETED').slice(-50))notifications.push({id:`workflow-${run.id}`,severity:'ERROR',category:'WORKFLOW',title:'Etapa do fluxo requer atenção',message:run.eventCode,status:run.status,processId:run.processId,createdAt:run.completedAt});
    }
    return notifications.sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).slice(0,100).map(item=>{
      const process=item.processId?processes.get(item.processId):undefined;
      const destination:PortalNotificationDetail['destination']=requestedId&&process
        ? hasProcessAccess(process.id)
          ? {kind:'PROCESS',processId:process.id,section:item.category==='SIGNATURE'?'docs':'cadastral'}
          : item.category==='SIGNATURE' ? {kind:'PRESIDENCY'} : undefined
        : undefined;
      return {...item,protocol:item.protocol||process?.protocolo,destination};
    });
  }

  const notificationReads=()=>notificationReadStore(portalDataDirectory,getSupabaseRuntimeStatus().durablePersistenceReady);
  app.get('/api/notifications',requireAuthenticated,async(req,res)=>{
    const email=normalizeEmail(getPortalIdentity(req)!.email);
    const notifications=collectNotifications(email);
    res.setHeader('Cache-Control','private, no-store');
    try {
      const reads=await notificationReads().read(email,notifications);
      res.json(notifications.map(item=>({...item,read:reads.has(item.id)})));
    } catch {
      res.status(503).json({error:'Não foi possível atualizar as notificações. Tente novamente.'});
    }
  });
  app.get('/api/notifications/:id',requireAuthenticated,async(req,res)=>{
    const email=normalizeEmail(getPortalIdentity(req)!.email);
    const [notification]=collectNotifications(email,req.params.id);
    res.setHeader('Cache-Control','private, no-store');
    if(!notification)return res.status(404).json({error:'A notificação não está mais disponível ou seu acesso foi alterado.'});
    try {
      const reads=await notificationReads().read(email,[notification]);
      res.json({...notification,read:reads.has(notification.id)});
    } catch {
      res.status(503).json({error:'Não foi possível consultar a notificação. Tente novamente.'});
    }
  });
  app.put('/api/notifications/:id/read',requireAuthenticated,async(req,res)=>{
    const email=normalizeEmail(getPortalIdentity(req)!.email);
    const [notification]=collectNotifications(email,req.params.id);
    res.setHeader('Cache-Control','private, no-store');
    if(!notification)return res.status(404).json({error:'A notificação não está mais disponível ou seu acesso foi alterado.'});
    if(req.body?.createdAt!==notification.createdAt)return res.status(409).json({error:'A notificação foi atualizada. Abra os detalhes novamente.'});
    try {
      await notificationReads().mark(email,notification);
      res.json({read:true});
    } catch {
      res.status(503).json({error:'Não foi possível confirmar a leitura. Tente novamente.'});
    }
  });

  app.post('/api/admin/studio/validate',requireAuthenticated,requireAdministrator,(req,res)=>res.json(validateCourseStudio(req.body?.studio||currentSettings.integrationStudio||{})));
  app.get('/api/admin/studio/versions',requireAuthenticated,requireAdministrator,(_req,res)=>res.json(studioVersionsStore.slice().sort((a,b)=>b.revision-a.revision).map(({snapshot,...item})=>({...item,active:item.revision===currentSettings.integrationStudio?.revision,counts:{documents:snapshot.docTemplates?.length||0,emails:snapshot.emailTemplates?.length||0,forms:snapshot.formTemplates?.length||0,stages:snapshot.workflowStages?.length||0,variables:snapshot.matrixColumns?.length||0}}))));
  app.get('/api/admin/studio/versions/:revision/compare',requireAuthenticated,requireAdministrator,(req,res)=>{const target=studioVersionsStore.find(item=>item.revision===Number(req.params.revision));const current=currentSettings.integrationStudio;if(!target||!current)return res.status(404).json({error:'Revisão não encontrada.'});const count=(value:any)=>Array.isArray(value)?value.length:0;res.json({fromRevision:target.revision,toRevision:current.revision,emailTemplates:(target.snapshot.emailTemplates||[]).map(email=>({id:String(email.id||''),name:String(email.name||''),subject:String(email.subject||''),body:String(email.body||'')})),formTemplates:(target.snapshot.formTemplates||[]).map(form=>({id:form.id,title:form.title,description:form.description,questions:(Array.isArray(form.questions)?form.questions:[]).map(question=>({label:String(question?.label||''),required:Boolean(question?.required)}))})), workflowStages:(target.snapshot.workflowStages||[]).map(stage=>({id:String(stage.id||''),title:String(stage.title||''),triggerEvent:String(stage.triggerEvent||''),actions:Array.isArray(stage.actions)?stage.actions.map(action=>({id:String(action?.id||''),title:String(action?.title||'')})):[]})),changed:target.checksum!==createHash('sha256').update(JSON.stringify(current)).digest('hex'),counts:{documents:[count(target.snapshot.docTemplates),count(current.docTemplates)],emails:[count(target.snapshot.emailTemplates),count(current.emailTemplates)],forms:[count(target.snapshot.formTemplates),count(current.formTemplates)],stages:[count(target.snapshot.workflowStages),count(current.workflowStages)],variables:[count(target.snapshot.matrixColumns),count(current.matrixColumns)]}});});
  app.post('/api/admin/studio/versions/:revision/restore',requireAuthenticated,requireAdministrator,async(req,res)=>{
    const identity=getPortalIdentity(req)!;
    if(!hasRecentAuthentication(identity))return res.status(428).json({error:'Confirme seu acesso para restaurar a configuração.',code:'REAUTHENTICATION_REQUIRED'});
    const reason=typeof req.body?.reason==='string'?req.body.reason.trim():'';
    if(reason.length<5||reason.length>300)return res.status(400).json({error:'Informe um motivo de 5 a 300 caracteres.'});
    const current=currentSettings.integrationStudio;
    const draft=currentSettings.integrationStudioDraft;
    const expectedRevision=Number((draft||current)?.revision||0);
    if(req.body?.expectedRevision!==expectedRevision)return res.status(409).json({error:'A configuração foi alterada. Reabra o histórico e confira a revisão atual.',code:'STUDIO_REVISION_CONFLICT'});
    const target=studioVersionsStore.find(item=>item.revision===Number(req.params.revision));
    if(!target)return res.status(404).json({error:'Revisão não encontrada.'});
    const restored=consolidateProcessForms(structuredClone(target.snapshot));
    const report=validateCourseStudio(restored);
    const workflowIssues=compileWorkflow(restored).issues.filter(issue=>issue.severity==='ERROR');
    if(!report.ready||workflowIssues.length)return res.status(409).json({error:'Esta revisão antiga não atende às validações atuais.',issues:[...report.issues,...workflowIssues].slice(0,40)});
    restored.revision=expectedRevision+1;
    restored.savedAt=new Date().toISOString();
    restored.savedBy=identity.email;
    restored.publication={status:'PUBLISHED',publishedRevision:restored.revision,publishedAt:restored.savedAt,validationScore:report.score};
    currentSettings={...currentSettings,integrationStudio:restored,updatedAt:restored.savedAt};
    if(draft)currentSettings.integrationStudioDraft={...draft,revision:restored.revision+1,savedAt:restored.savedAt,publication:{...draft.publication,status:'DRAFT',publishedRevision:restored.revision,publishedAt:restored.savedAt}};
    recordStudioVersion(current,identity.email);
    recordStudioVersion(restored,identity.email);
    publishRuntimeTemplatesFromSettings();
    auditLogsStore.push({id:`studio-restore-${randomBytes(12).toString('hex')}`,actorEmail:identity.email,actorRoles:getUserRolesForEmail(identity.email).globalRoles,action:'RESTAURACAO_VERSAO_ESTUDIO',entityType:'integration_studio',entityId:String(target.revision),before:{revision:current?.revision},after:{restoredAsRevision:restored.revision,reason},timestamp:restored.savedAt});
    try{await persistPortalStateDurably();}catch{return res.status(503).json({error:'Não foi possível confirmar a restauração. Reabra o histórico antes de tentar novamente.'});}
    res.json({message:'Versão restaurada como uma nova revisão auditável.',studio:restored,draft:currentSettings.integrationStudioDraft});
  });

  app.post('/api/admin/backup/drill',requireAuthenticated,requireAdministrator,async(req,res)=>{const identity=getPortalIdentity(req)!;if(!hasRecentAuthentication(identity))return res.status(428).json({error:'Reautentique-se para executar o ensaio de restauração.'});if(!currentSettings.driveRootFolderId)return res.status(409).json({error:'Defina a pasta raiz privada do Google Drive antes de executar o backup.'});try{const report=await createVerifiedPortalBackup(snapshotPortalState(),currentSettings.driveRootFolderId);const stored={id:report.backupFileId};const {encryptedSha256}=report;const checksum=report.sourceSha256;auditLogsStore.push({id:`log-${Date.now()}-drill`,actorEmail:identity.email,actorRoles:getUserRolesForEmail(identity.email).globalRoles,action:'ENSAIO_RESTAURACAO_BACKUP_CIFRADO',entityType:'system_backup',entityId:stored.id,after:{restorable:report.restorable,encryptedSha256,sourceSha256:checksum,counts:report.counts},timestamp:report.executedAt});await persistPortalStateDurably();res.json(report);}catch(error){res.status(502).json({error:error instanceof Error?error.message:'Não foi possível concluir o backup cifrado e o ensaio de restauração.'});}});

  app.get('/api/admin/retention/preview',requireAuthenticated,requireAdministrator,(_req,res)=>{const policy=currentSettings.integrationStudio?.operationsPolicy?.retention;const now=Date.now();const emailCutoff=now-(policy?.emailDeliveryDays||365)*86_400_000;const auditCutoff=now-(policy?.auditYears||10)*365.25*86_400_000;const heldIds=new Set(legalHoldsStore.filter(item=>item.active).map(item=>item.processId));res.json({generatedAt:new Date().toISOString(),policy:policy||null,previewOnly:true,candidates:{emailDeliveries:emailDeliveriesStore.filter(item=>Date.parse(item.updatedAt)<emailCutoff&&(!item.processId||!heldIds.has(item.processId))).length,auditLogs:auditLogsStore.filter(item=>Date.parse(item.timestamp)<auditCutoff&&(!item.processId||!heldIds.has(item.processId))).length},legalHolds:legalHoldsStore.filter(item=>item.active).length,message:'Prévia sem exclusão automática. Qualquer descarte exige revisão administrativa e trilha de auditoria.'});});
  app.get('/api/admin/legal-holds',requireAuthenticated,requireAdministrator,(_req,res)=>res.json(legalHoldsStore.slice().sort((a,b)=>b.createdAt.localeCompare(a.createdAt))));
  app.post('/api/admin/legal-holds',requireAuthenticated,requireAdministrator,(req,res)=>{const identity=getPortalIdentity(req)!;const processId=String(req.body?.processId||'').trim(),reason=String(req.body?.reason||'').trim();if(!processesStore.some(item=>item.id===processId)||reason.length<5)return res.status(400).json({error:'Informe um processo válido e uma justificativa.'});const hold:LegalHold={id:`hold-${Date.now()}`,processId,reason,active:true,createdAt:new Date().toISOString(),createdBy:identity.email};legalHoldsStore.push(hold);persistPortalState();res.status(201).json(hold);});
  app.post('/api/admin/legal-holds/:id/release',requireAuthenticated,requireAdministrator,(req,res)=>{const identity=getPortalIdentity(req)!;if(!hasRecentAuthentication(identity))return res.status(428).json({error:'Reautentique-se para liberar o bloqueio legal.'});const hold=legalHoldsStore.find(item=>item.id===req.params.id);if(!hold)return res.status(404).json({error:'Bloqueio não encontrado.'});hold.active=false;hold.releasedAt=new Date().toISOString();hold.releasedBy=identity.email;persistPortalState();res.json(hold);});

  app.post('/api/privacy/requests',requireAuthenticated,(req,res)=>{const identity=getPortalIdentity(req)!;const kind=String(req.body?.kind||'INFORMATION') as DataSubjectRequest['kind'],description=String(req.body?.description||'').trim();if(!['ACCESS','CORRECTION','ANONYMIZATION','PORTABILITY','INFORMATION'].includes(kind)||description.length<10)return res.status(400).json({error:'Informe o direito solicitado e descreva o pedido com ao menos 10 caracteres.'});const now=new Date().toISOString();const request:DataSubjectRequest={id:`privacy-${Date.now()}`,requesterEmail:identity.email,kind,description,status:'RECEIVED',createdAt:now,updatedAt:now};dataSubjectRequestsStore.push(request);persistPortalState();res.status(201).json(request);});
  app.get('/api/privacy/requests',requireAuthenticated,(req,res)=>{const identity=getPortalIdentity(req)!;const admin=hasFullAdministration(identity.email);res.setHeader('Cache-Control','private, no-store');res.json(dataSubjectRequestsStore.filter(item=>admin||item.requesterEmail===identity.email).sort((a,b)=>b.createdAt.localeCompare(a.createdAt)));});
  app.patch('/api/admin/privacy/requests/:id',requireAuthenticated,requireAdministrator,(req,res)=>{const identity=getPortalIdentity(req)!;const item=dataSubjectRequestsStore.find(row=>row.id===req.params.id);if(!item)return res.status(404).json({error:'Solicitação não encontrada.'});const status=String(req.body?.status||'');if(!['IN_REVIEW','COMPLETED','REJECTED'].includes(status))return res.status(400).json({error:'Status inválido.'});item.status=status as DataSubjectRequest['status'];item.updatedAt=new Date().toISOString();item.resolvedBy=identity.email;item.resolutionNote=String(req.body?.resolutionNote||'').slice(0,2000);persistPortalState();res.json(item);});


  app.post('/api/admin/integrity/drive',requireAuthenticated,requireAdministrator,async(req,res)=>{const identity=getPortalIdentity(req)!;const persistence=getSupabaseRuntimeStatus();if(!persistence.durablePersistenceReady)return res.status(503).json({error:'A persistência Supabase não está pronta; a conferência Portal × Drive não pode ser considerada confiável.'});if(!currentSettings.driveRootFolderId)return res.status(409).json({error:'Pasta raiz do Drive não configurada.'});try{const accessToken=await getGoogleWorkspaceAccessToken();await verifyPrivateDriveFolder(accessToken,currentSettings.driveRootFolderId);const findings:Array<{processId:string;protocol:string;artifact:string;fileId:string;ok:boolean;issues:string[]}> = [];for(const process of processesStore){const acervo=process.acervo;if(!acervo)continue;const checks=[{artifact:'TRABALHO_COMPLETO_PRIVADO',fileId:acervo.trabalhoCompletoFileId,sha:acervo.trabalhoCompletoSha256,version:acervo.trabalhoCompletoVersion,public:false},{artifact:'RESUMO_EXPANDIDO_PRIVADO',fileId:acervo.resumoExpandidoFileId,sha:acervo.resumoExpandidoSha256,version:acervo.resumoExpandidoVersion,public:false},{artifact:'TRABALHO_COMPLETO_PUBLICO',fileId:acervo.publicFullWorkFileId,sha:acervo.trabalhoCompletoSha256,version:acervo.trabalhoCompletoVersion,public:acervo.publicationState==='PUBLIC'&&Boolean(acervo.publishFullWork),source:acervo.trabalhoCompletoFileId},{artifact:'RESUMO_EXPANDIDO_PUBLICO',fileId:acervo.publicExpandedAbstractFileId,sha:acervo.resumoExpandidoSha256,version:acervo.resumoExpandidoVersion,public:acervo.publicationState==='PUBLIC'&&Boolean(acervo.publishExpandedAbstract),source:acervo.resumoExpandidoFileId}];for(const check of checks){if(!check.fileId)continue;const inspected=await inspectPortalDriveArtifact({accessToken,fileId:check.fileId,expectedSha256:check.sha,expectedVersion:check.version,expectPublic:check.public&&check.fileId!==check.source,expectedSourceFileId:check.fileId===check.source?undefined:check.source});findings.push({processId:process.id,protocol:process.protocolo,artifact:check.artifact,fileId:check.fileId,ok:inspected.ok,issues:inspected.issues});}}const failures=findings.filter(item=>!item.ok);const report={executedAt:new Date().toISOString(),executedBy:identity.email,checked:findings.length,failures:failures.length,ok:failures.length===0,findings};auditLogsStore.push({id:`log-${Date.now()}-integrity`,actorEmail:identity.email,actorRoles:getUserRolesForEmail(identity.email).globalRoles,action:'VERIFICACAO_INTEGRIDADE_DRIVE',entityType:'drive_integrity',entityId:String(Date.now()),after:{checked:report.checked,failures:report.failures},timestamp:report.executedAt});await persistPortalStateDurably();res.json(report);}catch(error){res.status(502).json({error:error instanceof Error?error.message:'Não foi possível verificar a integridade entre Portal e Drive.'});}});

  app.get('/api/admin/health',requireAuthenticated,requireAdministrator,async(_req,res)=>{const [asten,google]=await Promise.all([getPersistentAstenStatus(),getGoogleWorkspaceStatus()]);const supabase=await getSupabaseRuntimeConnectionStatus();const secretStore=getSecretStoreStatus();const googleSecurity=getGoogleOAuthSecurityPreflight();const astenReady=Boolean(asten.configured&&asten.dispatchEnabled);const checks=[{id:'studio',label:'Pacote do curso',status:currentSettings.integrationStudio&&validateCourseStudio(currentSettings.integrationStudio).ready?'PASS':'FAIL',message:currentSettings.integrationStudio?'Validação estrutural executada.':'Estúdio ainda não publicado.'},{id:'supabase',label:'Supabase',status:supabase.durablePersistenceReady?'NOT_CONFIRMED':'WARNING',message:supabase.message},{id:'google',label:'Google Workspace / Drive',status:google.connected&&googleSecurity.ready?'NOT_CONFIRMED':'WARNING',message:google.connected?(googleSecurity.ready?'Autorização encontrada; execute homologação real para confirmar escrita e privacidade.':googleSecurity.issues.join(' ')):'Google não conectado.'},{id:'gmail',label:'Gmail institucional',status:google.connected?'NOT_CONFIRMED':'WARNING',message:google.connected?'Escopo de envio configurado; o envio real deve ser confirmado no piloto controlado.':'Google não conectado.'},{id:'secret-store',label:'Cofre de segredos',status:secretStore.configured?'PASS':'FAIL',message:secretStore.configured?'Segredos cifrados com persistência durável.':'Cofre cifrado/durável não está pronto.'},{id:'asten',label:'Asten',status:astenReady?'NOT_CONFIRMED':'WARNING',message:astenReady?'Credencial encontrada; execute piloto controlado para confirmar.':'Asten não conectado.'},{id:'drive-root',label:'Pasta raiz do Drive',status:currentSettings.driveRootFolderId?'NOT_CONFIRMED':'FAIL',message:currentSettings.driveRootFolderId?'Pasta configurada; privacidade e escrita precisam de homologação real.':'Pasta raiz não configurada.'},{id:'signature-schema',label:'Compatibilidade dos examinadores na ata',status:supabase.signatureSignerRolesReady?'PASS':'FAIL',message:supabase.signatureSignerRolesReady?'Banco compatível com orientador e dois examinadores.':'Aplique a migração de compatibilidade dos examinadores antes de gerar atas.'},{id:'email-failures',label:'Fila de e-mails',status:emailDeliveriesStore.some(item=>item.status==='FAILED')?'WARNING':'PASS',message:`${emailDeliveriesStore.filter(item=>item.status==='FAILED').length} falha(s) pendente(s).`}];const overall=checks.some(item=>item.status==='FAIL')?'UNAVAILABLE':checks.some(item=>item.status==='WARNING'||item.status==='NOT_CONFIRMED')?'DEGRADED':'HEALTHY';res.setHeader('Cache-Control','private, no-store');res.json({generatedAt:new Date().toISOString(),overall,checks});});

  app.patch('/api/admin/studio/image', requireAuthenticated, requireAdministrator, async (req,res)=>{
    const identity=getPortalIdentity(req)!;

    if(!(currentSettings.integrationStudioDraft||currentSettings.integrationStudio))return res.status(409).json({error:'Configure o Estúdio antes de adicionar imagens.'});
    let studio;
    try{studio=applyStudioImage((currentSettings.integrationStudioDraft||currentSettings.integrationStudio)!,req.body,identity.email);}catch(error){
      const conflict=error instanceof Error&&error.message==='STUDIO_REVISION_CONFLICT';
      return res.status(conflict?409:400).json({error:conflict?'O Estúdio foi alterado. Recarregue antes de salvar a imagem.':error instanceof Error?error.message:'Imagem inválida.',code:conflict?'STUDIO_REVISION_CONFLICT':undefined});
    }
    let imageUrl=req.body.value;
    if(getSupabaseRuntimeStatus().durablePersistenceReady){
      try{imageUrl=await persistStudioRuntimeImage(req.body.value);}catch{return res.status(503).json({error:'Não foi possível armazenar a imagem. Tente novamente.'});}
      // Storage can yield while another request saves settings: recheck against the latest state.
      try{studio=applyStudioImage((currentSettings.integrationStudioDraft||currentSettings.integrationStudio)!,req.body,identity.email,imageUrl);}catch{return res.status(409).json({error:'Esta imagem foi alterada em outra sessão. Seu arquivo continua selecionado.',code:'STUDIO_REVISION_CONFLICT'});}
    }
    studio={...studio,publication:{...currentSettings.integrationStudio?.publication,status:'DRAFT'}};
    currentSettings={...currentSettings,integrationStudioDraft:studio,updatedAt:studio.savedAt};
    auditLogsStore.push({id:`studio-image-${Date.now()}`,actorEmail:identity.email,actorRoles:getUserRolesForEmail(identity.email).globalRoles,action:'ALTERACAO_IMAGEM_ESTUDIO',entityType:'integration_studio',entityId:req.body.templateId,after:{kind:req.body.kind,field:req.body.field,revision:studio.revision},timestamp:studio.savedAt});
    try{await persistPortalStateDurably();}catch{return res.status(503).json({error:'Não foi possível confirmar a gravação da imagem. Recarregue e tente novamente.'});}
    res.json({revision:studio.revision,savedAt:studio.savedAt,imageUrl,studio});
  });

  // PATCH /api/admin/settings
  app.patch('/api/admin/settings', requireAuthenticated, requireAdministrator, async (req, res) => {
    const identity=getPortalIdentity(req)!;
    const actorEmail=identity.email;
    const { globalRoles } = getUserRolesForEmail(actorEmail);

    if (!hasFullAdministration(actorEmail)) {
      return res.status(403).json({ error: 'Apenas o Master ou o Presidente da Comissão pode alterar configurações.' });
    }

    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
      return res.status(400).json({ error: 'Configurações inválidas.' });
    }
    if (Object.prototype.hasOwnProperty.call(req.body || {}, 'emailConfig')) {
      const emailConfig = req.body.emailConfig;
      if (!emailConfig || typeof emailConfig !== 'object' || Array.isArray(emailConfig)) {
        return res.status(400).json({ error: 'Configuração de e-mails inválida.' });
      }
      if (Object.prototype.hasOwnProperty.call(emailConfig, 'auditEmailsEnabled')) {
        if (!globalRoles.includes('MASTER_ADMIN')) return res.status(403).json({ error: 'Somente o Master pode alterar a auditoria de e-mails.' });
        if (typeof emailConfig.auditEmailsEnabled !== 'boolean') return res.status(400).json({ error: 'Informe se a auditoria de e-mails está ativada ou desativada.' });
      }
      if (Object.prototype.hasOwnProperty.call(emailConfig, 'auditCopyEmail')) {
        if (!globalRoles.includes('MASTER_ADMIN')) return res.status(403).json({ error: 'Somente o Master pode alterar o destino da auditoria de e-mails.' });
        if(typeof emailConfig.auditCopyEmail!=='string'||/[\u0000-\u001f\u007f]/.test(emailConfig.auditCopyEmail)||!isEmailHeaderAddress(normalizeEmail(emailConfig.auditCopyEmail)))return res.status(400).json({error:'Informe um único e-mail válido para a cópia de auditoria.'});
        emailConfig.auditCopyEmail=normalizeEmail(emailConfig.auditCopyEmail);
      }
      if(Object.prototype.hasOwnProperty.call(emailConfig,'roomReservationDepartmentEnabled')&&typeof emailConfig.roomReservationDepartmentEnabled!=='boolean'){
        return res.status(400).json({error:'Informe se o contato responsável pelas reservas está ativado ou desativado.'});
      }
    }

    if(containsSensitiveConfigurationKey(req.body))return res.status(400).json({error:'Segredos não podem ser salvos nas configurações.'});
    const updatesStudio=Object.prototype.hasOwnProperty.call(req.body,'integrationStudio');
    if(updatesStudio&&(!req.body.integrationStudio||typeof req.body.integrationStudio!=='object'||Array.isArray(req.body.integrationStudio)))return res.status(400).json({error:'Estrutura de configuração inválida.'});
    if(updatesStudio&&!['autosave','publish'].includes(req.body.studioSaveMode))return res.status(400).json({error:'Informe se a configuração deve ser salva como rascunho ou publicada.'});
    const autosave=req.body.studioSaveMode==='autosave';
    const editingStudio=currentSettings.integrationStudioDraft||currentSettings.integrationStudio;
    const expectedRevision=Number(editingStudio?.revision||0);
    if(req.body?.integrationStudio&&(req.body.studioExpectedRevision!==expectedRevision||req.body.integrationStudio.revision!==expectedRevision+1))return res.status(409).json({error:'Outra sessão salvou alterações. Seu rascunho foi preservado; confira a revisão atual antes de salvar.',code:'STUDIO_REVISION_CONFLICT'});
    if(req.body?.integrationStudio){
      if(['docTemplates','emailTemplates','formTemplates','workflowStages','matrixColumns','matrixRows'].some(key=>!Array.isArray(req.body.integrationStudio[key])))return res.status(400).json({error:'Estrutura de configuração inválida.'});
      try{for(const template of req.body.integrationStudio.emailTemplates)validateEmailRecipientSelection(template);}catch(error){return res.status(400).json({error:error instanceof Error?error.message:'Seleção de destinatários inválida.'});}
      req.body.integrationStudio=bindReservationContact(consolidateProcessForms(req.body.integrationStudio),configuredRoomReservationDepartmentEmail(),currentSettings.emailConfig?.roomReservationEmailCentralized===true);
      const workflowValidation=compileWorkflow(req.body.integrationStudio);
      const packageValidation=validateCourseStudio(req.body.integrationStudio);
      const errors=[...workflowValidation.issues.filter(issue=>issue.severity==='ERROR'),...packageValidation.issues.filter(issue=>issue.severity==='ERROR')];
      if(errors.length&&!autosave)return res.status(400).json({error:'O pacote do curso ainda contém pendências. Corrija modelos, formulários, e-mails e etapas antes de publicar.',code:'COURSE_PACKAGE_VALIDATION_FAILED',score:packageValidation.score,issues:errors.slice(0,40)});
      const now=new Date().toISOString();
      req.body.integrationStudio={...req.body.integrationStudio,savedBy:actorEmail,savedAt:now,publication:{
        status:autosave?'DRAFT':'PUBLISHED',
        publishedRevision:autosave?(currentSettings.integrationStudio?.publication?.publishedRevision ?? currentSettings.integrationStudio?.revision):req.body.integrationStudio.revision,
        publishedAt:autosave?currentSettings.integrationStudio?.publication?.publishedAt:now,
        validationScore:packageValidation.score
      }};
    }
    const publishStudio=Boolean(req.body?.integrationStudio&&!autosave);
    const before = { ...currentSettings };
    const settingsPatch={...(req.body||{})};for(const protectedKey of ['courseCoordinatorEmail','courseCoordinatorName','documentModels','masterEmail','ownerEmail','commissionPresidentEmail','masterRecoveryEmails','sessionValidAfter','driveRootFolderId','calendarId','installationProfile','academicCycles','featureFlags','portalAppearance','tableAppearance','tableLayouts','studioExpectedRevision','studioSaveMode','integrationStudioDraft'])delete settingsPatch[protectedKey];
    if(req.body?.integrationStudio&&autosave){settingsPatch.integrationStudioDraft=req.body.integrationStudio;delete settingsPatch.integrationStudio;}
    if(settingsPatch.emailConfig&&typeof settingsPatch.emailConfig==='object'&&!Array.isArray(settingsPatch.emailConfig)){
      const emailConfigPatch={...settingsPatch.emailConfig};
      // Authority is activated only by saving the shared contact, never by a template draft.
      delete emailConfigPatch.roomReservationEmailCentralized;
      if(Object.prototype.hasOwnProperty.call(emailConfigPatch,'roomReservationDepartmentEmail')){
        const departmentEmail=reservationDepartmentEmail(undefined,emailConfigPatch.roomReservationDepartmentEmail,true);
        if(typeof emailConfigPatch.roomReservationDepartmentEmail!=='string'||!departmentEmail||!isValidPortalEmail(departmentEmail))return res.status(400).json({error:'Informe um e-mail válido para o responsável pela reserva de salas.'});
        emailConfigPatch.roomReservationDepartmentEmail=departmentEmail;
        emailConfigPatch.roomReservationEmailCentralized=true;
      }
      settingsPatch.emailConfig={...(currentSettings.emailConfig||{}),...emailConfigPatch};
    }
    currentSettings = {
      ...currentSettings,
      ...settingsPatch,
      updatedAt: new Date().toISOString()
    };
    if(publishStudio){delete currentSettings.integrationStudioDraft;publishRuntimeTemplatesFromSettings();}

    if(publishStudio){
      recordStudioVersion(before.integrationStudio,actorEmail);
      recordStudioVersion(currentSettings.integrationStudio,actorEmail);
    }

    const isStudioPublication = Boolean(req.body?.integrationStudio);
    const summarizeStudio = (settings: GlobalSettings) => {const studio=settings.integrationStudioDraft||settings.integrationStudio;return studio ? {
      schemaVersion: studio.schemaVersion,
      revision: studio.revision,
      savedAt: studio.savedAt,
      savedBy: studio.savedBy,
      variables: studio.matrixColumns?.length || 0,
      documents: studio.docTemplates?.length || 0,
      emails: studio.emailTemplates?.length || 0,
      forms: studio.formTemplates?.length || 0,
      auditEvents: studio.auditTrail?.length || 0,
      driveStatus: studio.lastDriveSyncStatus || 'never'
    } : undefined;};

    auditLogsStore.push({
      id: `log-${Date.now()}`,
      actorEmail,
      actorRoles: globalRoles,
      action: isStudioPublication ? (publishStudio?'PUBLICACAO_ESTUDIO_INTEGRADO':'SALVAMENTO_AUTOMATICO_ESTUDIO') : 'ALTERACAO_CONFIGURACOES',
      entityType: isStudioPublication ? 'integration_studio' : 'settings',
      entityId: isStudioPublication ? 'studio-v2' : 'global',
      before: isStudioPublication ? summarizeStudio(before) : before,
      after: isStudioPublication ? summarizeStudio(currentSettings) : currentSettings,
      timestamp: new Date().toISOString()
    });

    try { await persistPortalStateDurably(); }
    catch { return res.status(503).json({ error: 'Não foi possível confirmar a gravação das configurações. Recarregue e tente novamente.' }); }
    res.json(publicSettingsForRequest(true));
  });

  app.post('/api/admin/drive-root',requireAuthenticated,requireAdministrator,async(req,res)=>{const identity=getPortalIdentity(req)!,folderId=String(req.body?.folderId||'').trim();if(!/^[a-zA-Z0-9_-]{10,}$/.test(folderId))return res.status(400).json({error:'ID da pasta raiz inválido.'});try{const accessToken=await getGoogleWorkspaceAccessToken();await verifyPrivateDriveFolder(accessToken,folderId);const before=currentSettings.driveRootFolderId;currentSettings={...currentSettings,driveRootFolderId:folderId,updatedAt:new Date().toISOString()};auditLogsStore.push({id:`log-${Date.now()}`,actorEmail:identity.email,actorRoles:getUserRolesForEmail(identity.email).globalRoles,action:'DEFINICAO_PASTA_RAIZ_DRIVE',entityType:'drive_root',entityId:folderId,before:{folderId:before},after:{folderId},timestamp:new Date().toISOString()});persistPortalState();res.json({folderId});}catch(error){res.status(400).json({error:error instanceof Error?error.message:'Não foi possível validar a privacidade da pasta.'});}});

  app.get('/api/admin/models',requireAuthenticated,requireAdministrator,(_req,res)=>{
    const models=Object.fromEntries(Object.entries(currentSettings.documentModels||{}).map(([type,model]:any)=>[type,{type,fileName:model.fileName,driveFileId:model.driveFileId,driveFileUrl:model.driveFileUrl,variables:model.variables,uploadedAt:model.uploadedAt,uploadedBy:model.uploadedBy,contentSha256:model.contentSha256,driveRevisionId:model.driveRevisionId,driveModifiedTime:model.driveModifiedTime,activeVersion:model.activeVersion||model.versions?.length||1,versions:(model.versions||[]).map((version:any)=>({...version,variables:version.variables||[]})),configured:Boolean(model.driveFileId&&model.contentSha256)}]));
    res.json({...models,__capabilities:{existingModelLinkImportEnabled:process.env.GOOGLE_ALLOW_EXISTING_MODEL_LINKS==='true'}});
  });
  app.get('/api/admin/models/:type/reference-folder',requireAuthenticated,requireAdministrator,async(req,res)=>{
    const type=String(req.params.type);
    res.setHeader('Cache-Control','private, no-store');
    if(!isReferenceDocumentModel(type))return res.status(404).json({error:'Modelo de referência não encontrado.'});
    try{
      const folder=await resolveReferenceDocumentModelFolder(await getGoogleWorkspaceAccessToken(),type,currentSettings.driveRootFolderId);
      res.json({name:folder.name,url:folder.url});
    }catch(error){res.status(409).json({error:error instanceof Error?error.message:'Não foi possível validar a pasta de referência.'});}
  });
  app.get('/api/admin/models/:type/local-source',requireAuthenticated,requireAdministrator,(req,res)=>{
    if(!localDocumentModelsEnabled())return res.status(404).json({error:'Arquivo local indisponível.'});
    const model=(currentSettings.documentModels as Record<string,any>|undefined)?.[String(req.params.type).toUpperCase()];
    if(!model?.driveFileId?.startsWith('local_model_'))return res.status(404).json({error:'Este modelo ainda não tem um DOCX local. Envie o arquivo para visualizar.'});
    try{
      const bytes=readLocalDocumentModel(portalDataDirectory,model.driveFileId,String(model.contentSha256||''));
      res.setHeader('Cache-Control','private, no-store');res.setHeader('Content-Disposition',`attachment; filename="${encodeURIComponent(model.fileName)}"`);
      res.type('application/vnd.openxmlformats-officedocument.wordprocessingml.document').send(bytes);
    }catch(error){res.status(409).json({error:error instanceof Error?error.message:'Não foi possível ler o DOCX local.'});}
  });
  async function persistModelPublication(type:string,active:any,previous:any){
    try{await persistPortalStateDurably();}
    catch(error){
      if(type===ATTENDANCE_MODEL&&getSupabaseRuntimeStatus().durablePersistenceReady){
        const failedQueue=remotePersistenceQueue;
        // The global writer already reads/applies authoritative state for conflicts.
        if(error instanceof Error&&error.message.includes('Conflito de concorrência'))throw error;
        let remote:PersistedPortalState|null;
        try{remote=await loadPortalRuntimeState<PersistedPortalState>();}
        catch{throw new Error('Não foi possível confirmar a publicação no banco. O resultado é incerto; atualize o catálogo antes de tentar novamente.');}
        if(!remote)throw new Error('Não foi possível confirmar a publicação no banco. O resultado é incerto; atualize o catálogo antes de tentar novamente.');
        const confirmed=sameAttendancePublication(active,remote.settings?.documentModels?.[type]);
        applyPersistedState(remote);
        if(confirmed){
          if(remotePersistenceQueue===failedQueue)remotePersistenceQueue=Promise.resolve();
          return;
        }
        throw error;
      }
      if(type===ATTENDANCE_MODEL&&currentSettings.documentModels?.[type]===active){
        const restored={...currentSettings.documentModels};if(previous)restored[type]=previous;else delete restored[type];
        currentSettings={...currentSettings,documentModels:restored};publishRuntimeTemplatesFromSettings();
        // A failed publication must not later be persisted as a successful audit event.
        const last=auditLogsStore.at(-1);if(last?.entityType==='document_model'&&last.entityId===type)auditLogsStore.pop();
      }
      throw error;
    }
  }
  app.post('/api/admin/models/:type',requireAuthenticated,requireAdministrator,async(req,res)=>{
    const identity=getPortalIdentity(req)!;const type=String(req.params.type||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9]+/g,'_').replace(/^_+|_+$/g,'').slice(0,48);

    if(type.length<2)return res.status(400).json({error:'Tipo de modelo inválido.'});
    try{
      const publish=async(file:{bytes:Buffer;fileName:string})=>{
        const observedAttendance=type===ATTENDANCE_MODEL?currentSettings.documentModels?.[type]:undefined;
        if(!file.fileName.toLowerCase().endsWith('.docx'))throw new Error('Envie um arquivo DOCX.');
        const extracted=await extractDocxTemplateText(file.bytes);const drive=localDocumentModelsEnabled()?storeLocalDocumentModel(portalDataDirectory,file.fileName,file.bytes):await publishMasterDocumentModel({type,fileName:file.fileName,content:file.bytes,rootFolderName:resolveInstallationProfile(currentSettings).driveRootFolderName,rootFolderId:currentSettings.driveRootFolderId});const now=new Date().toISOString();
        const labels:Record<string,string>={CONVITE:'Carta-convite',ATA:'Ata de defesa',TERMO:'Termo de autorização para publicação',DECLARACAO:'Declaração de participação na banca',...REFERENCE_DOCUMENT_MODEL_LABELS};
        const modelStore=(currentSettings.documentModels||{}) as Record<string,any>;const before=modelStore[type];const previousVersions=before?.versions?.length?before.versions:(before?[{version:1,fileName:before.fileName,driveFileId:before.driveFileId,driveFileUrl:before.driveFileUrl,variables:before.variables,uploadedAt:before.uploadedAt,uploadedBy:before.uploadedBy,contentSha256:before.contentSha256,driveRevisionId:before.driveRevisionId,driveModifiedTime:before.driveModifiedTime}]:[]);const nextVersion=Math.max(0,...previousVersions.map(item=>item.version))+1;const version={version:nextVersion,fileName:drive.name,driveFileId:drive.id,driveFileUrl:drive.webViewLink,variables:extracted.variables,uploadedAt:now,uploadedBy:identity.email,contentSha256:drive.contentSha256,driveRevisionId:drive.driveRevisionId,driveModifiedTime:drive.driveModifiedTime};const model={id:`master-${type.toLowerCase()}`,type,label:labels[type]||type.toLowerCase().split('_').filter(Boolean).map(part=>part.charAt(0).toUpperCase()+part.slice(1)).join(' '),fileName:drive.name,templateContentText:'',driveFileId:drive.id,driveFileUrl:drive.webViewLink,variables:extracted.variables,uploadedAt:now,uploadedBy:identity.email,contentSha256:drive.contentSha256,driveRevisionId:drive.driveRevisionId,driveModifiedTime:drive.driveModifiedTime,activeVersion:nextVersion,versions:[...previousVersions,version].slice(-30)};
        if(type===ATTENDANCE_MODEL){
          const publicPdf=await prepareAttendanceReferencePdf({fileId:model.driveFileId,sourceContentSha256:model.contentSha256,sourceVersion:nextVersion,rootFolderId:drive.rootFolderId||currentSettings.driveRootFolderId});
          if(currentSettings.documentModels?.[type]!==observedAttendance)throw new Error('O modelo mudou durante a preparação do PDF. A versão anterior foi preservada; o derivado privado não foi ativado.');
          Object.assign(model,{publicPdf});Object.assign(version,{publicPdf});
        }
        currentSettings={...currentSettings,driveRootFolderId:drive.rootFolderId||currentSettings.driveRootFolderId,documentModels:{...(currentSettings.documentModels||{}),[type]:model},updatedAt:now};publishRuntimeTemplatesFromSettings();
        auditLogsStore.push({id:`log-${Date.now()}`,actorEmail:identity.email,actorRoles:getUserRolesForEmail(identity.email).globalRoles,action:'MODELO_DOCUMENTAL_PUBLICADO',entityType:'document_model',entityId:type,before:before?{fileName:before.fileName,driveFileId:before.driveFileId}:undefined,after:{fileName:model.fileName,driveFileId:model.driveFileId,variables:model.variables},timestamp:now});await persistModelPublication(type,model,before);
        return{type,fileName:model.fileName,driveFileId:model.driveFileId,driveFileUrl:model.driveFileUrl,variables:model.variables,uploadedAt:model.uploadedAt,uploadedBy:model.uploadedBy,contentSha256:model.contentSha256,driveRevisionId:model.driveRevisionId,driveModifiedTime:model.driveModifiedTime,configured:true};
      };
      const uploadId=String(req.body?.stagedUploadId||'').trim();
      const result=uploadId
        ?await withDriveStagedUpload({uploadId,purpose:'DOCUMENT_MODEL',requesterBinding:sessionUploadBinding(identity)},publish)
        :await publish({bytes:readLegacyDevelopmentUpload({contentBase64:req.body?.contentBase64,fileName:String(req.body?.fileName||''),expected:'DOCX'}),fileName:String(req.body?.fileName||'')});
      res.status(201).json(result);
    }catch(error){res.status(400).json({error:error instanceof Error?error.message:'Não foi possível cadastrar o modelo.'});}
  });
  app.post('/api/admin/models/:type/link',requireAuthenticated,requireAdministrator,async(req,res)=>{
    const identity=getPortalIdentity(req)!;const type=String(req.params.type||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9]+/g,'_').replace(/^_+|_+$/g,'').slice(0,48);

    if(type.length<2)return res.status(400).json({error:'Tipo de modelo inválido.'});
    const linkOrId=String(req.body?.linkOrId||'').trim();if(!linkOrId)return res.status(400).json({error:'Informe o link ou ID do modelo no Google Drive.'});
    try{
      const observedAttendance=type===ATTENDANCE_MODEL?currentSettings.documentModels?.[type]:undefined;
      const drive=await registerMasterDocumentModelFromDrive({type,linkOrId,rootFolderName:resolveInstallationProfile(currentSettings).driveRootFolderName,rootFolderId:currentSettings.driveRootFolderId});const now=new Date().toISOString();
      const labels={CONVITE:'Carta-convite',ATA:'Ata de defesa',TERMO:'Termo de autorização para publicação',DECLARACAO:'Declaração de participação na banca',...REFERENCE_DOCUMENT_MODEL_LABELS};
      const before=currentSettings.documentModels?.[type];const previousVersions=before?.versions?.length?before.versions:(before?[{version:1,fileName:before.fileName,driveFileId:before.driveFileId,driveFileUrl:before.driveFileUrl,variables:before.variables,uploadedAt:before.uploadedAt,uploadedBy:before.uploadedBy,contentSha256:before.contentSha256,driveRevisionId:before.driveRevisionId,driveModifiedTime:before.driveModifiedTime}]:[]);const nextVersion=Math.max(0,...previousVersions.map(item=>item.version))+1;const version={version:nextVersion,fileName:drive.name,driveFileId:drive.id,driveFileUrl:drive.webViewLink,variables:drive.variables,uploadedAt:now,uploadedBy:identity.email,contentSha256:drive.contentSha256,driveRevisionId:drive.driveRevisionId,driveModifiedTime:drive.driveModifiedTime};const model={id:`master-${type.toLowerCase()}`,type,label:labels[type],fileName:drive.name,templateContentText:'',driveFileId:drive.id,driveFileUrl:drive.webViewLink,variables:drive.variables,uploadedAt:now,uploadedBy:identity.email,contentSha256:drive.contentSha256,driveRevisionId:drive.driveRevisionId,driveModifiedTime:drive.driveModifiedTime,activeVersion:nextVersion,versions:[...previousVersions,version].slice(-30)};
      if(type===ATTENDANCE_MODEL){
          const publicPdf=await prepareAttendanceReferencePdf({fileId:model.driveFileId,sourceContentSha256:model.contentSha256,sourceVersion:nextVersion,rootFolderId:drive.rootFolderId||currentSettings.driveRootFolderId});
          if(currentSettings.documentModels?.[type]!==observedAttendance)throw new Error('O modelo mudou durante a preparação do PDF. A versão anterior foi preservada; o derivado privado não foi ativado.');
          Object.assign(model,{publicPdf});Object.assign(version,{publicPdf});
        }
        currentSettings={...currentSettings,driveRootFolderId:drive.rootFolderId||currentSettings.driveRootFolderId,documentModels:{...(currentSettings.documentModels||{}),[type]:model},updatedAt:now};publishRuntimeTemplatesFromSettings();
      auditLogsStore.push({id:`log-${Date.now()}`,actorEmail:identity.email,actorRoles:getUserRolesForEmail(identity.email).globalRoles,action:'MODELO_DOCUMENTAL_IMPORTADO_DO_DRIVE',entityType:'document_model',entityId:type,before:before?{fileName:before.fileName,driveFileId:before.driveFileId}:undefined,after:{fileName:model.fileName,driveFileId:model.driveFileId,variables:model.variables,source:'GOOGLE_DRIVE'},timestamp:now});await persistModelPublication(type,model,before);
      res.status(201).json({type,fileName:model.fileName,driveFileId:model.driveFileId,driveFileUrl:model.driveFileUrl,variables:model.variables,uploadedAt:model.uploadedAt,uploadedBy:model.uploadedBy,contentSha256:model.contentSha256,driveRevisionId:model.driveRevisionId,driveModifiedTime:model.driveModifiedTime,configured:true});
    }catch(error){res.status(400).json({error:error instanceof Error?error.message:'Não foi possível importar o modelo do Drive.'});}
  });

  app.post('/api/admin/models/:type/publish-reviewed',requireAuthenticated,requireAdministrator,async(req,res)=>{
    const identity=getPortalIdentity(req)!;const type=String(req.params.type||'').toUpperCase();
    if(!['CONVITE','ATA','TERMO','DECLARACAO'].includes(type))return res.status(404).json({error:'Modelo inválido.'});
    try{
      const before=currentSettings.documentModels?.[type];if(!before?.driveFileId)throw new DocumentModelError('DOCUMENT_MODEL_REQUIRED');
      const current=await readDriveModelFingerprint(await getGoogleWorkspaceAccessToken(),before.driveFileId);
      // Reload after the Google read: a concurrent publication must invalidate this review.
      const latest=currentSettings.documentModels?.[type];if(!latest)throw new DocumentModelError('DOCUMENT_MODEL_REQUIRED');
      if(latest.driveFileId!==before.driveFileId)throw new Error('O modelo mudou durante a revisão. Abra uma nova prévia.');
      const now=new Date().toISOString();
      const model=publishReviewedModel(latest,current,{fileId:String(req.body?.fileId||''),version:Number(req.body?.version),sha256:String(req.body?.sha256||'')},identity.email,now);
      currentSettings={...currentSettings,documentModels:{...currentSettings.documentModels,[type]:model},updatedAt:now};publishRuntimeTemplatesFromSettings();
      auditLogsStore.push({id:`log-${randomBytes(12).toString('hex')}`,actorEmail:identity.email,actorRoles:getUserRolesForEmail(identity.email).globalRoles,action:'MODELO_DOCUMENTAL_REVISADO_NO_FLUXO_GOVBR',entityType:'document_model',entityId:type,before:{contentSha256:latest.contentSha256,activeVersion:latest.activeVersion},after:{contentSha256:model.contentSha256,activeVersion:model.activeVersion,driveFileId:model.driveFileId},timestamp:now});
      await persistPortalStateDurably();res.json({type,activeVersion:model.activeVersion});
    }catch(error){res.status(409).json({error:error instanceof Error?error.message:'Não foi possível publicar o modelo revisado.'});}
  });

  app.post('/api/admin/models/:type/detect-variables',requireAuthenticated,requireAdministrator,async(req,res)=>{
    const identity=getPortalIdentity(req)!;
    const type=String(req.params.type||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9]+/g,'_').replace(/^_+|_+$/g,'').slice(0,48);
    const model=(currentSettings.documentModels as Record<string,any>|undefined)?.[type];
    if(!model?.driveFileId)return res.status(404).json({error:'Modelo documental publicado não encontrado.'});
    // O upload/importação já inspeciona o DOCX/Google Doc e grava as variáveis
    // junto da versão publicada e do fingerprint. Não relê um arquivo mutável do
    // Drive aqui: alterações externas precisam ser publicadas como nova versão.
    const activeVersion=(model.versions||[]).find((version:any)=>version.version===model.activeVersion);
    const variables=Array.from(new Set((activeVersion?.variables||model.variables||[]).map((value:any)=>String(value||'').trim()).filter(Boolean)));
    const now=new Date().toISOString();
    const versions=(model.versions||[]).map((version:any)=>version.version===model.activeVersion?{...version,variables}:version);
    currentSettings.documentModels={...(currentSettings.documentModels||{}),[type]:{...model,variables,versions}};
    currentSettings.updatedAt=now;
    auditLogsStore.push({id:`log-${Date.now()}-model-vars`,actorEmail:identity.email,actorRoles:getUserRolesForEmail(identity.email).globalRoles,action:'DETECCAO_VARIAVEIS_MODELO',entityType:'document_model',entityId:type,before:{variables:model.variables||[]},after:{variables,source:'PUBLISHED_MODEL_VERSION'},timestamp:now});
    await persistPortalStateDurably();
    res.json({type,variables,detectedAt:now});
  });

  app.post('/api/admin/models/:type/versions/:version/restore',requireAuthenticated,requireAdministrator,async(req,res)=>{
    const identity=getPortalIdentity(req)!;
    const type=String(req.params.type||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9]+/g,'_').replace(/^_+|_+$/g,'').slice(0,48);
    const model=currentSettings.documentModels?.[type];
    const selected=model?.versions?.find(item=>item.version===Number(req.params.version));
    if(!model||!selected)return res.status(404).json({error:'Versão do modelo não encontrada.'});
    if(!selected.contentSha256)return res.status(409).json({error:'Esta versão antiga não possui hash de integridade. Importe ou envie novamente o modelo para publicá-la com segurança.'});
    try{
      if(localDocumentModelsEnabled())readLocalDocumentModel(portalDataDirectory,selected.driveFileId,selected.contentSha256);
      else if(isReferenceDocumentModel(type))await verifyReferenceDocumentModelVersion({type,rootFolderId:currentSettings.driveRootFolderId,fileId:selected.driveFileId,contentSha256:selected.contentSha256});
      else await verifyMasterDocumentModelFingerprint({accessToken:await getGoogleWorkspaceAccessToken(),fileId:selected.driveFileId,contentSha256:selected.contentSha256,driveRevisionId:selected.driveRevisionId,driveModifiedTime:selected.driveModifiedTime});
    }catch(error){return res.status(409).json({error:error instanceof Error?error.message:'Não foi possível validar a versão no Drive.'});}
    if(currentSettings.documentModels?.[type]!==model)return res.status(409).json({error:'O modelo foi alterado por outra sessão. Atualize o catálogo e tente novamente.'});
    let restoredPublicPdf=selected.publicPdf;
    if(type===ATTENDANCE_MODEL){
      const publicPdf=await prepareAttendanceReferencePdf({fileId:selected.driveFileId,sourceContentSha256:selected.contentSha256,sourceVersion:selected.version,rootFolderId:currentSettings.driveRootFolderId});
      if(currentSettings.documentModels?.[type]!==model)return res.status(409).json({error:'O modelo mudou durante a preparação do PDF. Nenhuma versão foi ativada.'});
      // Copy the version rather than mutating the active catalog before persistence.
      restoredPublicPdf=publicPdf;
    }
    const before={activeVersion:model.activeVersion,driveFileId:model.driveFileId};
    currentSettings.documentModels={...(currentSettings.documentModels||{}),[type]:{...model,...selected,...(type===ATTENDANCE_MODEL?{publicPdf:restoredPublicPdf}:{}),templateContentText:'',activeVersion:selected.version,versions:model.versions}};
    currentSettings.updatedAt=new Date().toISOString();
    auditLogsStore.push({id:`log-${Date.now()}`,actorEmail:identity.email,actorRoles:getUserRolesForEmail(identity.email).globalRoles,action:'RESTAURACAO_VERSAO_MODELO',entityType:'document_model',entityId:type,before,after:{activeVersion:selected.version,driveFileId:selected.driveFileId,contentSha256:selected.contentSha256},timestamp:currentSettings.updatedAt});
    await persistModelPublication(type,currentSettings.documentModels[type],model);
    res.json({type,activeVersion:selected.version,fileName:selected.fileName,driveFileId:selected.driveFileId,driveFileUrl:selected.driveFileUrl,variables:selected.variables,contentSha256:selected.contentSha256,configured:true});
  });

  app.delete('/api/admin/models/:type',requireAuthenticated,requireAdministrator,async(req,res)=>{
    const identity=getPortalIdentity(req)!;
    const type=String(req.params.type||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9]+/g,'_').replace(/^_+|_+$/g,'').slice(0,48);if(type.length<2)return res.status(400).json({error:'Tipo de modelo inválido.'});
    const models=(currentSettings.documentModels||{}) as Record<string,any>;const model=models[type];if(!model)return res.status(404).json({error:'Modelo não encontrado.'});
    const studio=currentSettings.integrationStudio;const refs=[...(studio?.docTemplates||[]).flatMap((item:any)=>[item.id,item.type,item.templateId,item.documentType]),...(studio?.workflowStages||[]).flatMap((stage:any)=>(stage.actions||[]).filter((action:any)=>action.type==='doc').flatMap((action:any)=>[action.refId,action.documentType]))].map(value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9]+/g,'_').replace(/^_+|_+$/g,''));
    if(refs.includes(type)||refs.includes(String(model.id||'').toUpperCase()))return res.status(409).json({error:'Este modelo ainda é referenciado pelo Estúdio/fluxo publicado. Remova ou substitua a referência antes da exclusão.',code:'DOCUMENT_MODEL_IN_USE'});
    const next={...models};delete next[type];const now=new Date().toISOString();currentSettings={...currentSettings,documentModels:next,updatedAt:now};auditLogsStore.push({id:`log-${Date.now()}-model-delete`,actorEmail:identity.email,actorRoles:getUserRolesForEmail(identity.email).globalRoles,action:'MODELO_DOCUMENTAL_REMOVIDO',entityType:'document_model',entityId:type,before:{fileName:model.fileName,driveFileId:model.driveFileId,activeVersion:model.activeVersion},after:{deleted:true,driveArtifactPreserved:true},timestamp:now});await persistPortalStateDurably();res.json({deleted:true,type});
  });

  app.get('/api/public/attendance-declaration.pdf',async(req,res)=>{
    res.setHeader('Cache-Control','public, max-age=0, must-revalidate');
    const model=currentSettings.documentModels?.[ATTENDANCE_MODEL];
    const publication=attendancePublication(model);
    if(!publication)return res.status(410).json({error:'Declaração de comparecimento indisponível. O Master precisa publicar o modelo em branco.'});
    const hash=publication.artifact?.sha256||attendanceBootstrap.sha256;
    try{
      const bytes=await publishedAttendanceBytes(publication,currentSettings.driveRootFolderId);
      if(currentSettings.documentModels?.[ATTENDANCE_MODEL]!==model)return res.status(409).json({error:'Modelo atualizado. Tente novamente.'});
      res.setHeader('ETag',`"${hash}"`);res.setHeader('Content-Disposition','attachment; filename="declaracao-de-comparecimento.pdf"');
      if(req.headers['if-none-match']===`"${hash}"`)return res.status(304).end();
      res.type('application/pdf').send(bytes);
    }catch{res.setHeader('Cache-Control','no-store');res.status(503).json({error:'PDF aprovado temporariamente indisponível. Nenhum novo documento foi gerado.'});}
  });

  app.get('/api/public/templates/access-list.xlsx',async(_req,res)=>{
    try{
      const template=await studentImportTemplateXlsx();
      res.setHeader('Cache-Control','public, max-age=300');
      res.setHeader('Content-Disposition','attachment; filename="modelo_lista_acesso.xlsx"');
      res.type('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet').send(Buffer.from(await template.arrayBuffer()));
    }catch{res.status(500).json({error:'Não foi possível preparar o modelo de planilha.'});}
  });
  app.post('/api/admin/access-list/google-template',requireAuthenticated,requireAdministrator,async(_req,res)=>{
    if(!currentSettings.driveRootFolderId)return res.status(409).json({code:'GOOGLE_TEMPLATE_UNAVAILABLE',error:'Conecte o Google Drive para abrir o modelo preenchível no Google Planilhas.'});
    try{
      const template=await studentImportTemplateXlsx();
      const result=await accessListGoogleSheetsTemplate({accessToken:await getGoogleWorkspaceAccessToken(),rootFolderId:currentSettings.driveRootFolderId,content:Buffer.from(await template.arrayBuffer())});
      res.setHeader('Cache-Control','private, no-store');res.json(result);
    }catch(error){res.status(409).json({code:'GOOGLE_TEMPLATE_UNAVAILABLE',error:error instanceof Error?error.message:'Não foi possível abrir o modelo no Google Planilhas.'});}
  });
  app.get(['/api/admin/access-list','/api/admin/students'],requireAuthenticated,requireAdministrator,(_req,res)=>res.json(authorizedStudentsStore));
  app.post(['/api/admin/access-list','/api/admin/students'],requireAuthenticated,requireAdministrator,(req,res)=>{
    const identity=getPortalIdentity(req)!;
    const email=normalizeEmail(String(req.body?.email||''));
    const nome=String(req.body?.nome||'').trim();
    const role=String(req.body?.role||'STUDENT').toUpperCase() as ProcessRole;
    const memberType=String(req.body?.memberType||'INTERNAL').toUpperCase()==='EXTERNAL'?'EXTERNAL':'INTERNAL';
    if(!nome||!isValidPortalEmail(email))return res.status(400).json({error:'Nome e e-mail válido são obrigatórios.'});
    if(!['STUDENT','ADVISOR','CO_ADVISOR','EXAMINER'].includes(role))return res.status(400).json({error:'Selecione um papel de acesso válido.'});
    const existed=authorizedStudentsStore.some(entry=>normalizeEmail(entry.email)===email);
    const entry=upsertAuthorizedAccess({nome,email,role,origin:'MASTER_LIST',actor:identity.email,active:true});
    entry.accessType=role; // qualidade administrativa única; os papéis por TCC permanecem nas memberships.
    entry.memberType=memberType;
    entry.manualRevocation=false;entry.revokedAt=undefined;entry.revokedBy=undefined;entry.revocationReason=undefined;entry.updatedAt=new Date().toISOString();
    auditLogsStore.push({id:`log-${Date.now()}-access`,actorEmail:identity.email,actorRoles:getUserRolesForEmail(identity.email).globalRoles,action:existed?'ATUALIZACAO_ACESSO_AUTORIZADO':'CRIACAO_ACESSO_AUTORIZADO',entityType:'authorized_access',entityId:entry.id,after:{emailHash:createHash('sha256').update(entry.email).digest('hex'),roles:entry.roles,memberType:entry.memberType,origin:entry.origin,active:entry.active},timestamp:entry.updatedAt});
    persistPortalState();res.status(existed?200:201).json(entry);
  });
  app.patch(['/api/admin/access-list/:id','/api/admin/students/:id'],requireAuthenticated,requireAdministrator,async(req,res)=>{
    const identity=getPortalIdentity(req)!;const index=authorizedStudentsStore.findIndex(entry=>entry.id===req.params.id);
    if(index<0)return res.status(404).json({error:'Acesso não encontrado.'});
    const before={...authorizedStudentsStore[index],roles:[...(authorizedStudentsStore[index].roles||[])]};
    const active=req.body?.active!==undefined?Boolean(req.body.active):before.active;
    const updatedAt=new Date().toISOString();
    const requestedRole=req.body?.role?String(req.body.role).toUpperCase() as ProcessRole:undefined;
    if(requestedRole&&!['STUDENT','ADVISOR','CO_ADVISOR','EXAMINER'].includes(requestedRole))return res.status(400).json({error:'Papel de acesso inválido.'});
    const roles=requestedRole?Array.from(new Set([...(before.roles||[before.accessType||'STUDENT']),requestedRole])) as ProcessRole[]:(before.roles||[before.accessType||'STUDENT']);
    const accessType=requestedRole&&req.body?.replaceRole===true?requestedRole:(before.accessType||roles[0]);
    const memberType=req.body?.memberType!==undefined?(String(req.body.memberType).toUpperCase()==='EXTERNAL'?'EXTERNAL':'INTERNAL'):before.memberType;
    const updated:AuthorizedStudent={...before,...(req.body?.nome!==undefined?{nome:String(req.body.nome).trim()}:{}),roles,accessType,memberType,active,manualRevocation:req.body?.active!==undefined?!active:before.manualRevocation,revokedAt:!active?updatedAt:undefined,revokedBy:!active?identity.email:undefined,revocationReason:!active?String(req.body?.reason||'Acesso revogado pelo administrador.').trim():undefined,updatedAt};
    authorizedStudentsStore[index]=updated;
    if(req.body?.active===true)for(const process of processesStore)removedAccessProcessKeys.delete(accessProcessKey(updated.email,process.id));
    auditLogsStore.push({id:`log-${Date.now()}-access-update`,actorEmail:identity.email,actorRoles:getUserRolesForEmail(identity.email).globalRoles,action:'ALTERACAO_ACESSO_AUTORIZADO',entityType:'authorized_access',entityId:updated.id,before:{active:before.active,roles:before.roles,memberType:before.memberType},after:{active:updated.active,roles:updated.roles,memberType:updated.memberType},timestamp:updated.updatedAt});
    await persistPortalStateDurably();res.json(updated);
  });
  app.delete(['/api/admin/access-list/:id','/api/admin/students/:id'],requireAuthenticated,requireAdministrator,async(req,res)=>{
    const identity=getPortalIdentity(req)!;const index=authorizedStudentsStore.findIndex(entry=>entry.id===req.params.id);
    if(index<0)return res.status(404).json({error:'Acesso não encontrado.'});
    const current=authorizedStudentsStore[index];
    for(const process of processesStore)removedAccessProcessKeys.add(accessProcessKey(current.email,process.id));
    authorizedStudentsStore.splice(index,1);const now=new Date().toISOString();
    auditLogsStore.push({id:`log-${Date.now()}-access-delete`,actorEmail:identity.email,actorRoles:getUserRolesForEmail(identity.email).globalRoles,action:'EXCLUSAO_ACESSO_AUTORIZADO',entityType:'authorized_access',entityId:current.id,before:{emailHash:createHash('sha256').update(current.email).digest('hex'),roles:current.roles,memberType:current.memberType,origin:current.origin},timestamp:now});
    await persistPortalStateDurably();res.json({deleted:true});
  });
  app.post('/api/admin/access-list/import',requireAuthenticated,requireAdministrator,requireFeature('STUDENT_BULK_IMPORT'),async(req,res)=>{
    const identity=getPortalIdentity(req)!;const records=Array.isArray(req.body?.records)?req.body.records:[];
    if(!records.length||records.length>1000)return res.status(400).json({error:'Envie de 1 a 1.000 pessoas por lote.'});
    const normalized=records.map((record:any,index:number)=>({row:Number.isSafeInteger(record?.row)&&record.row>0&&record.row<=100000?record.row:index+2,nome:String(record?.nome||'').trim(),email:normalizeEmail(String(record?.email||''))}));
    const invalid=accessImportIssues(normalized);
    if(invalid.length)return res.status(400).json({error:'Confira as linhas indicadas antes de importar.',code:'ACCESS_IMPORT_INVALID',issues:Object.fromEntries(invalid.map(issue=>[String(issue.row),issue.reason])),invalidRows:invalid});
    const batchHash=createHash('sha256').update(JSON.stringify(normalized.map(({nome,email})=>({nome,email})))).digest('hex');const already=auditLogsStore.find(log=>log.action==='IMPORTACAO_ALUNOS'&&(log.after as any)?.batchHash===batchHash);if(already&&normalized.every(record=>authorizedStudentsStore.some(entry=>normalizeEmail(entry.email)===record.email&&entry.nome===record.nome)))return res.json({batchHash,created:0,updated:0,reused:true});
    let created=0,updated=0,preservedRevocations=0;for(const record of normalized){const before=authorizedStudentsStore.find(entry=>normalizeEmail(entry.email)===record.email);if(before){before.nome=record.nome;before.updatedAt=new Date().toISOString();before.memberType=before.memberType||'INTERNAL';updated++;if(before.manualRevocation){before.active=false;preservedRevocations++;}}else{const createdEntry=upsertAuthorizedAccess({nome:record.nome,email:record.email,role:'STUDENT',origin:'MASTER_LIST',actor:identity.email});createdEntry.memberType='INTERNAL';created++;}}
    const now=new Date().toISOString();auditLogsStore.push({id:`log-${Date.now()}`,actorEmail:identity.email,actorRoles:getUserRolesForEmail(identity.email).globalRoles,action:'IMPORTACAO_ALUNOS',entityType:'authorized_student_batch',entityId:batchHash.slice(0,20),after:{batchHash,rows:normalized.length,created,updated,preservedRevocations},timestamp:now});await persistPortalStateDurably();res.status(201).json({batchHash,created,updated,preservedRevocations,reused:false});
  });

  // Registration lookup returns only the searched field, never an access-list record.
  const registrationLookupBuckets=new Map<string,{at:number;count:number}>();
  app.get('/api/forms/registration-suggestions',requireAuthenticated,requireRegistrationApplicant,(req,res)=>{
    const identity=getPortalIdentity(req)!;
    if(!canRequestPortalAccess(identity.email))return res.status(403).json({error:'Acesso não autorizado.'});
    res.setHeader('Cache-Control','private, no-store');
    const field=String(req.query.field||''),query=String(req.query.q||'').trim();
    const key=identity.email,now=Date.now(),bucket=registrationLookupBuckets.get(key);
    if(bucket&&now-bucket.at<60000){if(++bucket.count>90)return res.status(429).json({error:'Aguarde para consultar novamente.'});}else{if(registrationLookupBuckets.size>5000)registrationLookupBuckets.clear();registrationLookupBuckets.set(key,{at:now,count:1});}
    if(!['nome','email'].includes(field)||query.length<3||query.length>100)return res.json([]);
    const normalize=(value:string)=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
    const prefix=normalize(query);
    const matches=authorizedStudentsStore.filter(entry=>entry.active).map(entry=>String(entry[field as 'nome'|'email']||'')).filter(value=>normalize(value).startsWith(prefix));
    res.json(Array.from(new Set(matches)).sort((a,b)=>a.localeCompare(b,'pt-BR')));
  });

  // GET /api/processes
  app.get('/api/public/calendar',(_req,res)=>res.json(processesStore.filter(p=>p.status!=='EM_RASCUNHO'&&p.status!=='CONCLUIDO'&&isDefenseOnCalendar(p)).map(publicCalendarView)));
  app.get('/api/public/repository',(_req,res)=>res.json(buildPublicRepository(processesStore,legacyAcademicRecordsStore)));
  app.get('/api/public/processes/:id',(req,res)=>{
    const legacy=legacyAcademicRecordsStore.find(r=>r.id===req.params.id||r.protocolo===req.params.id);
    if(legacy){res.setHeader('Cache-Control','private, no-store');return res.json({...legacyRepositoryProcess(publicLegacyAcademicView(legacy)),canAccessPrivate:false,documents:[]});}
    const p=findProcessByReference(req.params.id);
    const identity=getPortalIdentity(req),canAccessPrivate=Boolean(p&&identity&&canAccessProcess(identity.email,p.id));
    if(!p||(p.status==='EM_RASCUNHO'&&!canAccessPrivate))return res.status(404).json({error:'TCC não disponível para consulta pública.'});
    const view=publicRepositoryView(p);
    if(view.acervo.trabalhoCompletoFileUrl)view.acervo.trabalhoCompletoFileUrl=`/api/public/processes/${encodeURIComponent(p.protocolo)}/files/trabalho-completo/download`;
    if(view.acervo.resumoExpandidoFileUrl)view.acervo.resumoExpandidoFileUrl=`/api/public/processes/${encodeURIComponent(p.protocolo)}/files/resumo-expandido/download`;
    const allDocuments=generateDefaultDocuments(p);
    const documentProgress=Object.fromEntries(allDocuments.flatMap(doc=>{const progress=documentSignatureProgress(p,doc,signatureJobsStore);return progress?[[doc.type,progress]]:[];}));
    const documents=publicAcademicDocuments(p,allDocuments);
    const outcome=documents.some(document=>document.type==='ATA')
      ? EVALUATION_OUTCOMES.find(option=>option.code===p.avaliacao.resultadoCode)
      : undefined;
    const avaliacao=outcome?{...view.avaliacao,resultadoCode:outcome.code,resultadoLabel:outcome.label}:view.avaliacao;
    res.setHeader('Cache-Control','private, no-store');res.json({...view,avaliacao,defesa:{...view.defesa,invitationSentAt:p.defesa.invitationSentAt},canAccessPrivate,...(canAccessPrivate?{privateProcessId:p.id}:{}),documents,documentProgress,reservationReceipts:reservationReceipts(p).map(item=>item.summary)});
  });
  app.get('/api/public/processes/:id/reservation-receipts',(req,res)=>{
    const p=findProcessByReference(req.params.id);
    if(!p||p.status==='EM_RASCUNHO')return res.status(404).json({error:'TCC não disponível para consulta pública.'});
    res.setHeader('Cache-Control','no-store');
    res.json({items:reservationReceipts(p).map(item=>item.summary),currentStatus:reservationReceiptStatus(p)});
  });
  app.get('/api/public/processes/:id/reservation-receipt',async(req,res)=>{
    if(!allowPublicDownload(req.ip||''))return res.status(429).json({error:'Limite temporário de downloads atingido.'});
    const p=findProcessByReference(req.params.id);
    if(!p||p.status==='EM_RASCUNHO')return res.status(404).json({error:'Comprovante não disponível.'});
    const receipts=reservationReceipts(p),receiptId=typeof req.query.receipt==='string'?req.query.receipt:undefined;
    if(req.query.receipt!==undefined&&!receiptId)return res.status(400).json({error:'Selecione um comprovante válido.'});
    const selected=receiptId?receipts.find(item=>item.summary.id===receiptId):receipts.find(item=>item.summary.current);
    if(!selected)return res.status(404).json({error:'Comprovante não disponível.'});
    res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
    const suffix=receiptId?`-${selected.summary.id}`:'';
    res.type('application/pdf').attachment(`${p.protocolo}-comprovante${suffix}.pdf`).send(await createReservationReceiptPdf(selected.process,currentSettings,{publicView:true}));
  });
  app.get('/api/public/processes/:id/documents/:docId/download',async(req,res)=>{
    if(!allowPublicDownload(req.ip||''))return res.status(429).json({error:'Limite temporário de downloads atingido.'});
    const p=processesStore.find(item=>item.id===req.params.id||item.protocolo===req.params.id);
    if(!p||p.status==='EM_RASCUNHO')return res.status(404).json({error:'Documento não disponível.'});
    const doc=publicAcademicDocuments(p,generateDefaultDocuments(p)).find(item=>item.id===req.params.docId);
    if(!doc)return res.status(404).json({error:'Documento não disponível.'});
    const job=doc.type==='CONVITE'?undefined:signatureJobsStore.filter(item=>item.processId===p.id&&item.documentType===doc.type&&item.documentVersion===doc.version&&item.status==='ARCHIVED'&&item.driveSignedFileId).sort((a,b)=>b.documentVersion-a.documentVersion)[0];
    const fileId=doc.type==='CONVITE'?p.defesa.invitationDriveFileId:job?.driveSignedFileId;
    if(!fileId)return res.status(404).json({error:'Documento não disponível.'});
    try{
      let bytes:Buffer;
      if(job?.provider==='GOV_BR'&&fileId.startsWith('local_govbr_'))bytes=await readGovbrPdf(job,fileId,String(job.signedSha256||''));
      else{const token=await (localReviewFilesEnabled()&&fileId.startsWith('local_review_')?sourceFilesAccessToken():getGoogleWorkspaceAccessToken());bytes=(await downloadSourceFile(token,fileId,{processId:p.id,artifactType:doc.type,...(job?{signatureJobId:job.id}:{})})).pdf;}
      await assertPublicAcademicPdf(bytes,p);
      await deliverPortalDownload({res,processId:p.id,bytes,fileName:`${p.protocolo}-${doc.type}.pdf`,mimeType:'application/pdf',requesterBinding:`public:${req.ip||'unknown'}:${p.protocolo}:${doc.type}`,cacheControl:'no-store, max-age=0'});
    }catch{return res.status(404).json({error:'Esta cópia não está disponível para consulta pública. Os participantes autorizados podem consultar pelo acesso restrito.'});}
  });


  // Historical archive is isolated from live processes and their protocol sequence.
  app.get('/api/legacy-academic-records',(_req,res)=>{
    res.setHeader('Cache-Control','no-store');
    res.json(legacyAcademicRecordsStore.map(publicLegacyAcademicView));
  });
  app.get('/api/legacy-academic-records/:id/files/:index/download',async(req,res)=>{
    if(!allowPublicDownload(req.ip||''))return res.status(429).json({error:'Limite temporário de downloads atingido.'});
    const record=legacyAcademicRecordsStore.find(r=>r.id===req.params.id);
    const index=/^(0|[1-9]\d?)$/.test(req.params.index)?Number(req.params.index):-1;
    const file=record?.attachments[index];
    // Denied, missing and conflicting consent never reach the storage provider.
    if(!record||!file||!legacyFileIsPublic(record,file))return res.status(404).json({error:'Arquivo não disponível para publicação.'});
    try{
      const pdf=await readLegacyAcademicPdf(file);
      await deliverPortalDownload({res,bytes:pdf,fileName:file.fileName,mimeType:'application/pdf',requesterBinding:`public:${req.ip||'unknown'}:${record.id}:${index}`,cacheControl:'no-store, max-age=0'});
    }catch{return res.status(409).json({error:'Não foi possível conferir o arquivo autorizado. A publicação permanece indisponível até a revisão.'});}
  });
  app.get('/api/admin/legacy-academic-records',requireAuthenticated,requireGlobalRoles('MASTER_ADMIN'),(_req,res)=>{
    res.setHeader('Cache-Control','private, no-store');
    res.json({revision:legacyCatalogRevision(legacyAcademicRecordsStore),records:legacyAcademicRecordsStore});
  });
  app.get('/api/admin/legacy-academic-records/:id/academic',requireAuthenticated,requireGlobalRoles('MASTER_ADMIN'),(req,res)=>{
    res.setHeader('Cache-Control','private, no-store');
    const record=legacyAcademicRecordsStore.find(r=>r.id===req.params.id);
    if(!record)return res.status(404).json({error:'Trabalho histórico não encontrado.'});
    return res.json(privateLegacyAcademicView(record));
  });
  app.get('/api/admin/legacy-academic-records/:id/files/:index/download',requireAuthenticated,requireGlobalRoles('MASTER_ADMIN'),async(req,res)=>{
    res.setHeader('Cache-Control','private, no-store');
    const record=legacyAcademicRecordsStore.find(r=>r.id===req.params.id);
    const index=/^(0|[1-9]\d?)$/.test(req.params.index)?Number(req.params.index):-1;
    const file=record?.attachments[index];
    if(!record||!file)return res.status(404).json({error:'Arquivo histórico não encontrado.'});
    try{
      const pdf=await readLegacyAcademicPdf(file);
      await deliverPortalDownload({res,bytes:pdf,fileName:file.fileName,mimeType:'application/pdf',requesterBinding:`legacy-academic-admin:${getPortalIdentity(req)!.email}:${record.id}:${index}`,cacheControl:'private, no-store, max-age=0'});
    }catch{return res.status(409).json({error:'Não foi possível conferir o arquivo histórico. O original permanece preservado para revisão.'});}
  });
  app.get('/api/admin/legacy-academic-records/:id/documents',requireAuthenticated,requireGlobalRoles('MASTER_ADMIN'),(req,res)=>{
    res.setHeader('Cache-Control','private, no-store');
    const record=legacyAcademicRecordsStore.find(r=>r.id===req.params.id);
    if(!record)return res.status(404).json({error:'Trabalho histórico não encontrado.'});
    try{return res.json(legacyAdministrativeFiles(record).map((file,index)=>({index,kind:file.kind,fileName:file.fileName,downloadUrl:`/api/admin/legacy-academic-records/${encodeURIComponent(record.id)}/documents/${index}/download`})));
    }catch{return res.status(409).json({error:'A documentação histórica precisa de conferência.'});}
  });
  app.get('/api/admin/legacy-academic-records/:id/documents/:index/download',requireAuthenticated,requireGlobalRoles('MASTER_ADMIN'),async(req,res)=>{
    res.setHeader('Cache-Control','private, no-store');
    const record=legacyAcademicRecordsStore.find(r=>r.id===req.params.id);
    const index=/^(0|[1-9]\d?)$/.test(req.params.index)?Number(req.params.index):-1;
    if(!record||index<0)return res.status(404).json({error:'Documento histórico não encontrado.'});
    try{
      const file=legacyAdministrativeFiles(record)[index];
      if(!file)return res.status(404).json({error:'Documento histórico não encontrado.'});
      const pdf=await readLegacyAcademicPdf(file);
      await deliverPortalDownload({res,bytes:pdf,fileName:file.fileName,mimeType:'application/pdf',requesterBinding:`legacy-admin:${getPortalIdentity(req)!.email}:${record.id}:${index}`,cacheControl:'private, no-store, max-age=0'});
    }catch{return res.status(409).json({error:'Não foi possível conferir o documento histórico. O arquivo permanece preservado para revisão.'});}
  });
  app.post('/api/admin/legacy-academic-records/import',requireAuthenticated,requireGlobalRoles('MASTER_ADMIN'),async(req,res)=>{
    if(req.body?.expectedRevision!==legacyCatalogRevision(legacyAcademicRecordsStore))return res.status(409).json({error:'O acervo histórico mudou. Recarregue antes de importar.',code:'STALE_LEGACY_REVISION'});
    let records:LegacyAcademicRecord[];
    try{records=mergeLegacyBatch(legacyAcademicRecordsStore,validateLegacyBatch(req.body?.records));}
    catch(error){return res.status(400).json({error:error instanceof Error?error.message:'Lote histórico inválido.'});}
    const previous=legacyAcademicRecordsStore;
    legacyAcademicRecordsStore=records;
    try{await persistPortalStateDurably();}
    catch{if(legacyAcademicRecordsStore===records)legacyAcademicRecordsStore=previous;return res.status(503).json({error:'Não foi possível confirmar a importação. Recarregue o acervo antes de tentar novamente.'});}
    res.json({imported:records.length-previous.length,total:records.length,revision:legacyCatalogRevision(records)});
  });

  app.get('/api/processes', (req, res) => {
    const identity=getPortalIdentity(req);if(!identity)return res.json(processesStore.filter(p=>p.status!=='EM_RASCUNHO').map(publicLegacyProcessView));const email=identity.email;
    const { memberships } = getUserRolesForEmail(email);

    // A fila da Presidência tem uma projeção própria de declarações.
    if (hasFullAdministration(email)) {
      return res.json(processesStore.map(process=>processWithPendingAtaStage(process,signatureJobsStore)));
    }

    // Filter by process IDs where user has an active membership
    const accessibleProcessIds = new Set(memberships.map((m) => m.processId));

    const filtered = processesStore.filter((p) => accessibleProcessIds.has(p.id)&&canAccessProcess(email,p.id));
    res.json(filtered.map(process=>processWithPendingAtaStage(process,signatureJobsStore)));
  });

  // POST /api/processes
  const registrationAttemptProcessId=(email:string,attempt:unknown)=>{
    if(typeof attempt!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(attempt))return null;
    return 'proc-'+createHash('sha256').update(email+'|'+attempt.toLowerCase()).digest('hex').slice(0,32);
  };
  app.get('/api/registration/attempts/:attempt',requireAuthenticated,(req,res)=>{
    res.setHeader('Cache-Control','private, no-store');
    const email=getPortalIdentity(req)!.email;
    const id=registrationAttemptProcessId(email,req.params.attempt);
    const process=id&&processesStore.find(item=>item.id===id);
    if(!process||!canAccessProcess(email,process.id))return res.status(404).json({error:'Cadastro ainda não localizado.'});
    return res.json({id:process.id});
  });

  app.post('/api/processes', requireAuthenticated, requireRegistrationApplicant, async (req, res) => {
    const settle=beginRuntimeRequestTask(req);
    try {
      await createProcessHandler(req,res);
    } finally {
      settle();
    }
  });

  async function createProcessHandler(req:express.Request,res:express.Response){

    const actorEmail=getPortalIdentity(req)!.email;
    const isAdministrative = hasFullAdministration(actorEmail);
    const attempt=req.body?.registrationAttempt;
    const attemptId=registrationAttemptProcessId(actorEmail,attempt);
    if(attempt!==undefined&&!attemptId)return res.status(400).json({error:'Identificador de cadastro inválido.'});
    const committed=attemptId&&processesStore.find(item=>item.id===attemptId);
    if(committed&&canAccessProcess(actorEmail,committed.id))return res.status(200).json({id:committed.id,workflowPending:true,workflowProcessing:true});

    try { req.body = { ...req.body, ...acceptRegistration(req.body, currentSettings.integrationStudio) }; }
    catch (error) { return res.status(400).json({ error: error instanceof Error ? error.message : 'Cadastro inválido.' }); }

    const requestedStudentEmails = [req.body?.aluno1?.email, req.body?.aluno2?.email]
      .map((value) => normalizeEmail(String(value || '')))
      .filter(Boolean);
    const duplicateStudentEmail = requestedStudentEmails.find((studentEmail) => processesStore.some((process) =>
      normalizeEmail(process.aluno1?.email || '') === studentEmail
      || normalizeEmail(process.aluno2?.email || '') === studentEmail
    ));
    if (duplicateStudentEmail) {
      return res.status(409).json({
        error: 'Cada aluno pode participar como autor de apenas um TCC. Já existe um TCC cadastrado para um dos alunos informados.',
        code: 'STUDENT_TCC_ALREADY_EXISTS'
      });
    }
    const {
      aluno1,
      aluno2,
      orientador,
      coorientador,
      titulo,
      banca,
      defesa
    } = req.body;

    if (!aluno1 || !aluno1.nome || !aluno1.email) {
      return res.status(400).json({ error: 'Nome e e-mail do autor são obrigatórios.' });
    }

    const aluno1Email = normalizeEmail(aluno1.email);

    // Every author creates with their own authenticated, active access-list identity.
    if (!isAdministrative && actorEmail!==aluno1Email) {
      return res.status(403).json({error:'O aluno deve cadastrar o próprio TCC usando o e-mail autorizado.'});
    }
    const studentEmails=[aluno1Email,aluno2?.email?normalizeEmail(aluno2.email):''].filter(Boolean);
    const installationProfile=resolveInstallationProfile(currentSettings);
    const invalidStudentIndex=studentEmails.findIndex(email=>!studentRegistrationEmailAllowed(email));
    if(invalidStudentIndex>=0)return res.status(400).json({error:`E-mail do ${invalidStudentIndex===0?'primeiro':'segundo'} aluno: informe um e-mail válido. Confira esse campo antes de enviar.`,code:'STUDENT_EMAIL_NOT_ALLOWED',fieldKey:invalidStudentIndex===0?'ALUNO_1_EMAIL':'ALUNO_2_EMAIL'});
    const existingTcc=processesStore.find(process=>studentEmails.some(email=>[process.aluno1.email,process.aluno2?.email].filter(Boolean).map(normalizeEmail).includes(email)));
    if (existingTcc) {
      return res.status(409).json({
        error: `Cada aluno pode autuar apenas um TCC. Já existe o processo ${existingTcc.protocolo}.`
      });
    }

    if (!orientador || !orientador.nome || !orientador.email) {
      return res.status(400).json({ error: 'Dados do Orientador são obrigatórios.' });
    }
    if (!titulo) {
      return res.status(400).json({ error: 'Título do trabalho é obrigatório.' });
    }
    if (!banca || banca.length < 2) {
      return res.status(400).json({ error: 'Banca deve ter pelo menos dois examinadores além do orientador.' });
    }
    const participantConflict=validateDistinctProcessParticipants({aluno1,aluno2,orientador,coorientador,banca});
    if(participantConflict)return res.status(400).json({error:participantConflict,code:'INVALID_PARTICIPANT_COMPOSITION'});

    if (!timestampInSaoPauloDateRange(defesa?.startAt, saoPauloCalendarDate(), '')) {
      return res.status(400).json({error:'A data da defesa deve ser hoje ou um dia posterior.',code:'DEFENSE_DATE_IN_PAST',fieldKey:'DEFESA_DATA_HORA'});
    }
    if (!isDefenseWeekday(saoPauloCalendarDate(new Date(defesa.startAt)))) {
      return res.status(400).json({error:DEFENSE_WEEKDAY_MESSAGE,code:'DEFENSE_WEEKEND',fieldKey:'DEFESA_DATA_HORA'});
    }
    const academicError=validateAcademicWindow(defesa?.startAt);if(academicError&&!isAdministrative)return res.status(409).json({error:academicError,code:'ACADEMIC_WINDOW_CLOSED'});

    if(!reservationDepartmentEnabled(currentSettings.emailConfig)&&isManagedDefenseLocation(String(defesa?.local||''),operationalConfig(currentSettings.integrationStudio).reservation.locations))return res.status(409).json({error:'O contato responsável pelas reservas de auditório e sala de reuniões está desativado. Aguarde a ativação pela comissão ou selecione outro local, cuja confirmação será solicitada ao orientador.',code:'ROOM_RESERVATION_CONTACT_DISABLED'});
    const newId = attemptId || `proc-${Date.now()}`;
    const nowISO = new Date().toISOString();

    // End time is start time + 90 min by default
    const startDate = new Date(defesa?.startAt || nowISO);
    const endDate = new Date(defenseEndAt(startDate.toISOString()));
    const reservationConflictInput={
      startAt:startDate.toISOString(),endAt:endDate.toISOString(),local:String(defesa?.local||''),
      alternateLocation:String(defesa?.alternateLocation||''),
      emails:[...studentEmails,normalizeEmail(orientador.email),coorientador?.email?normalizeEmail(coorientador.email):'',...banca.map((member:any)=>normalizeEmail(String(member.email||'')))].filter(Boolean),
    };
    const rejectDefenseConflict=(conflicts:ReturnType<typeof findDefenseConflicts>)=>res.status(409).json({
      error:'O local ou um dos participantes já tem uma defesa reservada nesse intervalo.',
      code:'DEFENSE_CONFLICT',conflicts:visibleDefenseConflicts(actorEmail,conflicts),
    });
    const mayOverrideConflict=isAdministrative&&Boolean(String(req.body?.conflictOverrideReason||'').trim());

    const finishProtocolTiming=registrationRequestTiming(req)?.measure('protocol_lookup');
    let protocolReservation: ReturnType<typeof reserveNextProcessProtocol>;
    try {
      const retainedProtocols=await loadRetainedProcessProtocols();
      const occupiedProtocols=[
        ...processesStore.map(process=>process.protocolo),
        ...processDeletionTasksStore.filter(task=>task.status!=='COMPLETED').map(task=>task.protocol),
        ...retainedProtocols,
      ];
      protocolReservation=reserveNextProcessProtocol(installationProfile,processProtocolCountersStore,occupiedProtocols);
    } catch (error) {
      if (!(error instanceof ProcessProtocolExhausted)) throw error;
      return res.status(409).json({error:error.message,code:'PROCESS_PROTOCOL_EXHAUSTED'});
    } finally {
      finishProtocolTiming?.();
    }

    const defenseConflicts=findDefenseConflicts(reservationConflictInput);
    if(defenseConflicts.length&&!mayOverrideConflict)return rejectDefenseConflict(defenseConflicts);

    const newProcess: ProcessData = {
      id: newId,
      protocolo: protocolReservation.protocol,
      titulo,
      etapaAtual: 'CONFIRMACAO_LOCAL',
      status: 'AGUARDANDO_CONFIRMACAO_LOCAL',
      authorOrder:req.body.authorOrder,
      registrationAnswers: req.body.registrationAnswers && registrationAnswersWithoutIdentifiers(req.body.registrationAnswers),
      registrationRevision: currentSettings.integrationStudio?.revision || 0,
      createdByEmail: actorEmail,
      academicCycleId: currentAcademicCycle()?.id,
      coauthorAcceptance:{status:'NOT_REQUIRED'},
      aluno1: {
        nome: aluno1.nome.trim(),
        tratamento:aluno1.tratamento||undefined,
        matricula: '',
        email: normalizeEmail(aluno1.email)
      },
      aluno2: aluno2 && aluno2.nome ? {
        nome: aluno2.nome.trim(),
        tratamento:aluno2.tratamento||undefined,
        matricula: '',
        email: normalizeEmail(aluno2.email)
      } : null,
      orientador: {
        nome: orientador.nome.trim(),
        tratamento:orientador.tratamento||undefined,titulacao:orientador.titulacao||undefined,
        email: normalizeEmail(orientador.email),
        instituicao: resolveInstallationProfile(currentSettings).institutionName
      },
      coorientador: coorientador && coorientador.nome ? {
        nome: coorientador.nome.trim(),
        tratamento:coorientador.tratamento||undefined,titulacao:coorientador.titulacao||undefined,
        email: normalizeEmail(coorientador.email),
        instituicao: coorientador.instituicao ? coorientador.instituicao.trim() : ''
      } : null,
      banca: banca.map((b: any, idx: number) => ({
        id: `b-${idx + 1}`,
        nome: b.nome.trim(),
        tratamento:b.tratamento||undefined,
        email: normalizeEmail(b.email),
        funcao: idx === 0 ? 'EXAMINER_2' : 'EXAMINER_3',
        membroTipo: b.membroTipo || (idx === 0 ? 'INTERNO' : 'EXTERNO'),
        instituicao: b.instituicao ? b.instituicao.trim() : (idx === 0 ? installationProfile.defaultInstitutionName : 'Instituição externa'),
        profissao: b.profissao || '',
        titulacao: b.titulacao || ''
      })),
      defesa: {
        startAt: startDate.toISOString(),
        endAt: endDate.toISOString(),
        local: defesa?.local || '',
        alternateLocation: undefined,
        localStatus: 'PENDENTE',
        localEvidenceUrl: undefined
      },
      avaliacao: {
        status: 'PENDENTE'
      },
      dataRevision: 1,
      createdAt: nowISO,
      updatedAt: nowISO
    };

    processesStore.push(newProcess);
    processProtocolCountersStore=protocolReservation.counters;
    upsertAuthorizedAccess({nome:newProcess.aluno1.nome,email:newProcess.aluno1.email,processId:newId,role:'STUDENT',origin:'TCC_FORM',actor:actorEmail});
    if(newProcess.aluno2)upsertAuthorizedAccess({nome:newProcess.aluno2.nome,email:newProcess.aluno2.email,processId:newId,role:'STUDENT',origin:'TCC_FORM',actor:actorEmail});
    upsertAuthorizedAccess({nome:newProcess.orientador.nome,email:newProcess.orientador.email,processId:newId,role:'ADVISOR',origin:'TCC_FORM',actor:actorEmail});
    if(newProcess.coorientador)upsertAuthorizedAccess({nome:newProcess.coorientador.nome,email:newProcess.coorientador.email,processId:newId,role:'CO_ADVISOR',origin:'TCC_FORM',actor:actorEmail});
    for(const examiner of newProcess.banca)upsertAuthorizedAccess({nome:examiner.nome,email:examiner.email,processId:newId,role:'EXAMINER',origin:'TCC_FORM',actor:actorEmail});

    // Create memberships
    membershipsStore.push({
      id: `mem-${Date.now()}-1`,
      processId: newId,
      email: newProcess.aluno1.email,
      roles: ['STUDENT'],
      active: true,
      createdAt: nowISO,
      updatedAt: nowISO
    });

    if (newProcess.aluno2) {
      membershipsStore.push({
        id: `mem-${Date.now()}-2`,
        processId: newId,
        email: newProcess.aluno2.email,
        roles: ['STUDENT'],
        active: true,
        createdAt: nowISO,
        updatedAt: nowISO
      });
    }

    membershipsStore.push({
      id: `mem-${Date.now()}-3`,
      processId: newId,
      email: newProcess.orientador.email,
      roles: ['ADVISOR'],
      active: true,
      createdAt: nowISO,
      updatedAt: nowISO
    });

    if (newProcess.coorientador) {
      membershipsStore.push({
        id: `mem-${Date.now()}-4`,
        processId: newId,
        email: newProcess.coorientador.email,
        roles: ['CO_ADVISOR'],
        active: true,
        createdAt: nowISO,
        updatedAt: nowISO
      });
    }

    newProcess.banca.forEach((examiner, idx) => {
      if (normalizeEmail(examiner.email) !== normalizeEmail(newProcess.orientador.email)) {
        membershipsStore.push({
          id: `mem-${Date.now()}-ex-${idx}`,
          processId: newId,
          email: normalizeEmail(examiner.email),
          roles: ['EXAMINER'],
          active: true,
          createdAt: nowISO,
          updatedAt: nowISO
        });
      }
    });

    // Log audit
    auditLogsStore.push({
      id: `log-${Date.now()}`,
      processId: newId,
      actorEmail,
      actorRoles: ['STUDENT'],
      action: 'CRIACAO_PROCESSO',
      entityType: 'processo',
      entityId: newId,
      after: newProcess,
      timestamp: nowISO
    });
    auditLogsStore.push({id:`reservation-request:${newId}:0`,processId:newId,actorEmail,actorRoles:['STUDENT'],action:'SOLICITACAO_RESERVA_REGISTRADA',entityType:'reservation',entityId:newId,after:{startAt:newProcess.defesa.startAt,endAt:newProcess.defesa.endAt,local:newProcess.defesa.local,reservationRevision:newProcess.defesa.reservationRevision||0},timestamp:nowISO});
    if(defenseConflicts.length)auditLogsStore.push({id:`log-${Date.now()}-conflict`,processId:newId,actorEmail,actorRoles:getUserRolesForEmail(actorEmail).globalRoles,action:'SOBRESCRITA_CONFLITO_DEFESA',entityType:'defense_schedule',entityId:newId,after:{reason:String(req.body?.conflictOverrideReason||'').trim(),conflicts:defenseConflicts},timestamp:nowISO});

    const initialArchive:FormArchiveJob={
      id:`form-registration-${newId}`,processId:newId,formType:'CADASTRO_INICIAL',
      version:newProcess.dataRevision,sha256:'',artifactBase64:'',status:'PENDING',
      registrationSnapshot:prepareRegistrationSnapshot(newProcess,currentSettings),
      createdAt:nowISO,updatedAt:nowISO,
    };
    formArchiveJobsStore.push(initialArchive);
    delete registrationDraftsStore[actorEmail];
    const finishCreateCommitTiming=registrationRequestTiming(req)?.measure('process_commit');
    try {
      await persistPortalStateDurably();
    } catch(error) {
      // The persistence layer reloads committed state after a revision conflict.
      if(error instanceof Error&&error.message.includes('Conflito de concorrência')){
        const conflicts=findDefenseConflicts({...reservationConflictInput,excludeProcessId:newId});
        if(conflicts.length&&!mayOverrideConflict)return rejectDefenseConflict(conflicts);
      }
      throw error;
    } finally {
      finishCreateCommitTiming?.();
    }

    afterReservationChangeResponse(req,res,async()=>{
      const archived=await retryExistingFormArchiveJob(initialArchive,newProcess);
      if(archived.status==='ARCHIVED')await resumeWorkflowAfterNativeFormArchive(newProcess,'CADASTRO_INICIAL',actorEmail);
    },{retain:beginRuntimeRequestTask,waitUntil:process.env.VERCEL?waitUntil:undefined,
      onError:()=>{console.error('[Cadastro] Registro salvo; ações posteriores permanecem pendentes.');}});
    if(!res.destroyed)return res.status(202).json({...newProcess,workflowPending:true,workflowProcessing:true});
  }

  app.post('/api/processes/defense-conflicts/check',requireAuthenticated,requireFeature('DEFENSE_CONFLICTS'),(req,res)=>{
    const startAt=String(req.body?.startAt||'');if(!Number.isFinite(Date.parse(startAt)))return res.status(400).json({error:'Data inicial inválida.'});const endAt=defenseEndAt(startAt);
    const email=getPortalIdentity(req)!.email;
    const excluded=String(req.body?.excludeProcessId||'');
    res.json({conflicts:visibleDefenseConflicts(email,findDefenseConflicts({startAt,endAt,local:String(req.body?.local||''),alternateLocation:String(req.body?.alternateLocation||''),emails:Array.isArray(req.body?.emails)?req.body.emails.map((value:any)=>normalizeEmail(String(value))):[],excludeProcessId:excluded&&canAccessProcess(email,excluded)?excluded:undefined}))});
  });
  app.post('/api/processes/:id/coauthor-acceptance',requireAuthenticated,(_req,res)=>res.status(410).json({error:'O cadastro por um dos autores é suficiente. Não é necessário confirmar a autoria separadamente.'}));

  app.use('/api/processes/:id/forms/:formId/submissions',requireAuthenticated,(req,res,next)=>{const identity=getPortalIdentity(req)!;const form=(currentSettings.integrationStudio?.formTemplates||[]).find(item=>String(item.id)===req.params.formId);if(!form||form.isActive===false||!canUseStudioForm(identity.email,req.params.id,form)||!studioFormIsReleased(identity.email,req.params.id,req.params.formId))return res.status(404).json({error:'Formulário não encontrado ou ainda não liberado nesta etapa.'});next();});
  app.get('/api/processes/:id/forms',requireAuthenticated,(req,res)=>{const identity=getPortalIdentity(req)!;const process=processesStore.find(item=>item.id===req.params.id);if(!process||!canAccessProcess(identity.email,process.id))return res.status(404).json({error:'Processo não encontrado.'});res.setHeader('Cache-Control','private, no-store');res.json((currentSettings.integrationStudio?.formTemplates||[]).filter(form=>form.isActive!==false&&canUseStudioForm(identity.email,process.id,form)&&studioFormIsReleased(identity.email,process.id,String(form.id))).map(form=>({...form,questions:formQuestionsWithoutIdentifiers((form.questions||[]) as import('./src/types/operationalConfig').RegistrationQuestion[]),presentation:formPresentation(currentSettings.integrationStudio,String(form.id)),revision:currentSettings.integrationStudio?.revision||0})));});
  app.get('/api/processes/:id/forms/:formId',requireAuthenticated,(req,res)=>{const identity=getPortalIdentity(req)!;const process=processesStore.find(item=>item.id===req.params.id);if(!process||!canAccessProcess(identity.email,process.id))return res.status(404).json({error:'Formulário não encontrado.'});const form=(currentSettings.integrationStudio?.formTemplates||[]).find(item=>String(item.id)===req.params.formId);if(!form||form.isActive===false||!canUseStudioForm(identity.email,process.id,form)||!studioFormIsReleased(identity.email,process.id,req.params.formId))return res.status(404).json({error:'Formulário não encontrado ou ainda não liberado nesta etapa.'});res.setHeader('Cache-Control','private, no-store');res.json({...form,questions:formQuestionsWithoutIdentifiers((form.questions||[]) as import('./src/types/operationalConfig').RegistrationQuestion[]),presentation:formPresentation(currentSettings.integrationStudio,String(form.id)),revision:currentSettings.integrationStudio?.revision||0});});
  app.get('/api/processes/:id/form-submissions',requireAuthenticated,(req,res)=>{const identity=getPortalIdentity(req)!;if(!canAccessProcess(identity.email,req.params.id))return res.status(404).json({error:'Processo não encontrado.'});const admin=hasFullAdministration(identity.email);res.setHeader('Cache-Control','private, no-store');res.json(studioFormSubmissionsStore.filter(item=>item.processId===req.params.id&&(admin||item.submittedBy===identity.email)).map(item=>({...item,answers:admin||item.submittedBy===identity.email?item.answers:{}})));});
  app.post('/api/processes/:id/forms/:formId/submissions', requireAuthenticated, async (req, res) => {
    const identity = getPortalIdentity(req)!;
    const process = processesStore.find(item => item.id === req.params.id);
    if (!process || !canAccessProcess(identity.email, process.id)) return res.status(404).json({ error: 'Formulário não encontrado.' });
    if (process.status === 'CONCLUIDO') return res.status(409).json({ error: 'O processo está concluído. Solicite uma correção formal à secretaria.' });
    const form = currentSettings.integrationStudio?.formTemplates?.find(item => String(item.id) === req.params.formId);
    if (!form || form.isActive === false) return res.status(404).json({ error: 'Formulário não encontrado ou não publicado.' });
    const formRevision = Number(currentSettings.integrationStudio?.revision || 0);
    if (!Number.isInteger(req.body?.expectedFormRevision) || req.body.expectedFormRevision !== formRevision) return res.status(409).json({ error: 'O formulário foi atualizado. Recarregue e confira os campos antes de enviar.', code: 'STALE_FORM_REVISION' });
    const questions = formQuestionsWithoutIdentifiers((Array.isArray(form.questions) ? form.questions : []) as import('./src/types/operationalConfig').RegistrationQuestion[]);
    const { answers, issues } = validateFormAnswers(questions, req.body?.answers);
    if (Object.keys(issues).length) return res.status(400).json({ error: 'Revise os campos destacados.', code: 'INVALID_FORM_ANSWERS', issues });
    const checksumData = { processId: process.id, formId: req.params.formId, formRevision, answers };
    const legacyChecksum = createHash('sha256').update(JSON.stringify(checksumData)).digest('hex');
    const checksum = createHash('sha256').update(JSON.stringify({ ...checksumData, submittedBy: identity.email })).digest('hex');
    const existing = studioFormSubmissionsStore.find(item => [checksum, legacyChecksum].includes(item.checksum) && item.submittedBy === identity.email);
    if (existing) return res.status(existing.archiveStatus === 'ARCHIVED' && !existing.workflowPending ? 200 : 202).json(existing);
    const submittedAt = new Date().toISOString();
    const submission: StudioFormSubmission = {
      id: `form-submission-${checksum.slice(0, 24)}`, processId: process.id, formId: req.params.formId, formRevision,
      submittedBy: identity.email, submittedAt, answers, checksum, archiveStatus: 'PENDING', workflowPending: true,
      formSnapshot: { title: String(form.title || form.id), questions: structuredClone(questions) },
    };
    studioFormSubmissionsStore.push(submission);
    auditLogsStore.push({ id: `log-${submission.id}`, processId: process.id, actorEmail: identity.email,
      actorRoles: [...getUserRolesForEmail(identity.email).globalRoles, ...getActiveProcessRoles(identity.email, process.id)],
      action: 'ENVIO_FORMULARIO_PERSONALIZADO', entityType: 'studio_form_submission', entityId: submission.id,
      after: { formId: submission.formId, formRevision, checksum }, timestamp: submittedAt });
    // Save the original questions and answers before calling any provider.
    await persistPortalStateDurably();
    await archiveStudioFormSubmission(process, form, submission);
    if (submission.archiveStatus === 'ARCHIVED') {
      const run = await executeConfiguredWorkflowEvent(process, `FORM_${submission.formId}_SUBMITTED`, identity.email, answers);
      submission.workflowPending = run?.status !== 'COMPLETED';
      submission.workflowError = submission.workflowPending ? run?.actions.find(a => a.status === 'FAILED')?.error || 'A secretaria deve revisar a continuidade desta etapa.' : undefined;
    } else submission.workflowError = submission.archiveError;
    await persistPortalStateDurably();
    res.status(submission.workflowPending ? 202 : 201).json(submission);
  });

  app.get('/api/processes/:id/location-proof/download',requireAuthenticated,async(req,res)=>{
    const identity=getPortalIdentity(req)!;const process=processesStore.find(p=>p.id===req.params.id);
    if(!process||!canAccessProcess(identity.email,process.id))return res.status(404).json({error:'Comprovante não encontrado.'});
    const receiptId=typeof req.query.receipt==='string'?req.query.receipt:undefined;
    if(req.query.receipt!==undefined&&!receiptId)return res.status(400).json({error:'Selecione um comprovante válido.'});
    const receipt=reservationReceipts(process).find(item=>receiptId?item.summary.id===receiptId:item.summary.current);
    if(receipt){
      const kind=receipt.summary.decision==='UNAVAILABLE'?'indisponibilidade':'reserva';
      const suffix=receiptId?`-${receipt.summary.id}`:'';
      const bytes=await privateReservationReceiptPdf(process,receipt,Boolean(receiptId));
      return deliverPortalDownload({res,processId:process.id,bytes,fileName:`${process.protocolo}-${kind}${suffix}.pdf`,
        mimeType:'application/pdf',requesterBinding:sessionUploadBinding(identity),cacheControl:'private, no-store'});
    }
    if(receiptId)return res.status(404).json({error:'Comprovante não encontrado.'});
    if(!process.defesa.locationProof || (process.defesa.locationProof.reservationRevision??0)!==(process.defesa.reservationRevision??0))return res.status(404).json({error:'Comprovante não encontrado.'});
    try{const file=await downloadSourceFile(await sourceFilesAccessToken(),process.defesa.locationProof.driveFileId,{processId:process.id,artifactType:'COMPROVANTE_LOCAL'});await deliverPortalDownload({res,processId:process.id,bytes:file.pdf,fileName:process.defesa.locationProof.fileName,mimeType:'application/pdf',requesterBinding:sessionUploadBinding(identity),cacheControl:'private, no-store'});}catch(error){res.status(502).json({error:'Não foi possível consultar o comprovante no Drive.'});}
  });
  // A scoped bearer link authorizes only this reservation revision. GET never mutates.
  app.use('/api/reservation-confirmation',express.urlencoded({extended:false,limit:'8kb'}));
  const reservationActionPath=(token:string)=>`/api/reservation-confirmation/${encodeURIComponent(token)}`;
  const reservationContext=(token:string)=>{
    const claim=readReservationToken(token,reservationSecret());
    const process=claim?processesStore.find(p=>p.id===claim.processId):undefined;
    if(!claim||!process||claim.revision!==(process.defesa.reservationRevision||0))return null;
    // Previously sent messages retain their original authority after a settings change.
    const issued=emailDeliveriesStore.some(record=>record.processId===process.id&&record.templateId==='email-reserva'&&normalizeEmail(record.recipient)===claim.recipient&&Number(record.workflowEventVariables?.RESERVATION_REVISION||0)===claim.revision&&record.renderedHtml?.includes('/api/reservation-confirmation/'+token));
    if(claim.recipient!==reservationApproverEmail(process)&&!issued)return null;
    return {claim,process};
  };
  app.get('/api/reservation-confirmation/:token', (req,res)=>{
    res.setHeader('Cache-Control','no-store');res.setHeader('Referrer-Policy','same-origin');res.setHeader('X-Robots-Tag','noindex, nofollow');
    const context=reservationContext(req.params.token);
    if(!context)return res.status(410).type('html').send(reservationPage('Solicitação indisponível','Este link expirou ou o agendamento foi alterado. Utilize a solicitação mais recente.'));
    const {process:p}=context,e=reservationEscape;
    const action=reservationActionPath(req.params.token);
    if(p.defesa.departmentResponse)return res.type('html').send(reservationAlreadyAnsweredPage(p.defesa.departmentResponse.decision,action+'/receipt'));
    const decision=req.query.decision==='accept'?'accept':req.query.decision==='decline'?'decline':'';
    const view=reservationConfirmationView({process:p,studio:currentSettings.integrationStudio,action,decision});
    res.type('html').send(reservationPage(view.title,view.content));
  });
  app.get('/api/reservation-confirmation/:token/receipt',async(req,res)=>{
    res.setHeader('Cache-Control','no-store');res.setHeader('Referrer-Policy','same-origin');
    const context=reservationContext(req.params.token);if(!context?.process.defesa.departmentResponse)return res.status(404).send('Comprovante indisponível.');
    const p=context.process;res.type('application/pdf').attachment(`${p.protocolo}-${p.defesa.departmentResponse?.decision==='UNAVAILABLE'?'indisponibilidade':'reserva'}.pdf`).send(await createReservationReceiptPdf(p,currentSettings));
  });
  const handleReservationResponse=async(req:express.Request,res:express.Response,master?:{process:ProcessData;email:string;reason:string})=>{
    let responseSaved=false;
    try{
    res.setHeader('Cache-Control','no-store');res.setHeader('Referrer-Policy','same-origin');
    const context=master?{
      process:master.process,
      claim:{recipient:reservationApproverEmail(master.process),revision:master.process.defesa.reservationRevision??0},
    }:reservationContext(String(req.params.token));
    if(!context)return res.status(410).type('html').send(reservationPage('Solicitação indisponível','Utilize a solicitação mais recente.'));
    const {process:p,claim}=context;
    const receiptPath=master?undefined:reservationActionPath(String(req.params.token))+'/receipt';
    const alreadyAnswered=(decision:'CONFIRMED'|'UNAVAILABLE')=>res.status(409)
      .setHeader('X-Reservation-Decision',decision).type('html').send(reservationAlreadyAnsweredPage(decision,receiptPath!));
    const respondError=(status:number,title:string,message:string)=>master?res.status(status).json({error:message}):res.status(status).type('html').send(reservationPage(title,message));
    const actorEmail=master?.email??claim.recipient;
    const wantsPdf=!master&&req.get('accept')==='application/pdf';
    const wantsDecision=Boolean(master)||req.get('accept')==='application/json';
    const sendReceipt=async()=>{
      const decision=p.defesa.departmentResponse!.decision;
      const pdf=await createReservationReceiptPdf(p,currentSettings);
      return res.setHeader('X-Reservation-Decision',decision).type('application/pdf')
        .attachment(`${p.protocolo}-${decision==='UNAVAILABLE'?'indisponibilidade':'reserva'}.pdf`).send(pdf);
    };
    if(p.defesa.departmentResponse)return alreadyAnswered(p.defesa.departmentResponse.decision);
    const decision=String(req.body?.decision||'');
    const local=decision==='accept'?p.defesa.local:decision==='decline'?'__UNAVAILABLE__':String(req.body?.local||'');
    if(req.body?.confirmed!=='yes'||![p.defesa.local,'__UNAVAILABLE__'].includes(local))return respondError(400,'Confira os campos','Aceite ou recuse o agendamento apresentado.');
    if(p.defesa.invitationSentAt||p.defesa.invitationDriveFileId)return respondError(409,'Agendamento encerrado','O convite deste agendamento já foi emitido. Solicite uma correção à comissão.');
    const available=local!=='__UNAVAILABLE__';
    if(available&&findDefenseConflicts({startAt:p.defesa.startAt,endAt:p.defesa.endAt,local,emails:participantEmails(p),excludeProcessId:p.id}).length)return respondError(409,'Conflito de agendamento','Este local ou um participante já está reservado nesse intervalo. Volte e selecione outro local, ou informe a indisponibilidade.');
    const before=structuredClone(p);
    p.defesa.reservationRequestRecipient=claim.recipient;
    const now=new Date().toISOString();
    p.defesa.departmentResponse={departmentEmail:isManagedDefenseLocation(p.defesa.local,operationalConfig(currentSettings.integrationStudio).reservation.locations)?claim.recipient:undefined,attribution:master?'MASTER_ADMIN':'EMAIL_LINK',receiptDesign:receiptDesign(currentSettings.integrationStudio),receiptPresentation:reservationReceiptPresentation(p,currentSettings),revision:claim.revision,decision:available?'CONFIRMED':'UNAVAILABLE',respondedAt:now,respondedBy:actorEmail,local:p.defesa.local,startAt:p.defesa.startAt,endAt:defenseEndAt(p.defesa.startAt)};
    if(available){p.defesa.local=local;p.defesa.localStatus='CONFIRMADO';p.defesa.localConfirmedAt=now;p.defesa.localConfirmedBy=actorEmail;p.defesa.localEvidenceUrl=`/api/processes/${p.id}/location-proof/download`;}
    else p.defesa.localStatus='RECUSADO';
    p.defesa.departmentResponse.receiptBody=[`Protocolo: ${p.protocolo}`,`Título: ${p.titulo}`,...officialParticipantLines(p).filter(person=>person.key.startsWith('ALUNO_')).map(person=>`Autor: ${person.name}`),`Resposta: ${available?'Reserva confirmada':'Reserva recusada'}`,`Local: ${p.defesa.local}`,`Data: ${formatDateWithWeekday(p.defesa.startAt)}`,`Horário: ${formatTime24h(p.defesa.startAt)} às ${formatTime24h(defenseEndAt(p.defesa.startAt))}`,master?`Resposta administrativa registrada por: ${actorEmail}`:`Resposta registrada pelo link enviado a: ${claim.recipient}`,`Registrado em: ${formatDateTimeWithWeekday(now)}`,`Revisão da solicitação: ${claim.revision}`].join('\n');
    p.dataRevision++;p.updatedAt=now;
    auditLogsStore.push({id:`reservation-${p.id}-${claim.revision}`,processId:p.id,actorEmail,actorRoles:master?['MASTER_ADMIN']:[],action:available?'CONFIRMACAO_LOCAL_DEPARTAMENTO':'LOCAL_INDISPONIVEL_DEPARTAMENTO',entityType:'processo',entityId:p.id,after:{...p.defesa.departmentResponse,...(master?{reason:master.reason,originalRecipient:claim.recipient}:{})},timestamp:now});
    googleCalendarEventsStore=generateGoogleEventsFromProcesses(processesStore);
    const archive=queueReservationArchive(p,claim.revision,now);
    try{await persistPortalStateDurably();responseSaved=true;}catch(error){
      // A recuperação de um conflito pode ter carregado a decisão vencedora de outra instância.
      if(processesStore.includes(p)){
        Object.assign(p,before);
        formArchiveJobsStore=formArchiveJobsStore.filter(job=>job.id!==archive.id);
        auditLogsStore=auditLogsStore.filter(log=>log.id!==`reservation-${p.id}-${claim.revision}`);
        googleCalendarEventsStore=generateGoogleEventsFromProcesses(processesStore);
      }
      const saved=master?undefined:reservationContext(String(req.params.token))?.process.defesa.departmentResponse;
      if(saved)return alreadyAnswered(saved.decision);
      throw error;
    }
    if(wantsPdf||wantsDecision){
      // Retém a exclusão mútua do runtime mesmo depois de entregar o PDF.
      const settle=beginRuntimeRequestTask(req);
      try{
        if(wantsDecision){
          return res.json({decision:p.defesa.departmentResponse.decision,receiptPath});
        }
        return await sendReceipt();
      }
      finally{
        const followup=new Promise<void>(resolve=>setImmediate(resolve))
          .then(()=>completeReservationFollowup(p,actorEmail,claim.revision,archive))
          .catch(()=>{console.error('[Reserva] Resposta salva; processamento posterior pendente.');})
          .finally(settle);
        if(process.env.VERCEL)waitUntil(followup);
      }
    }
    await completeReservationFollowup(p,claim.recipient,claim.revision,archive);
    res.redirect(303,receiptPath!);
    }catch{if(master)return res.status(503).json({error:'Não foi possível confirmar a decisão. Atualize o andamento antes de repetir a ação.'});res.status(responseSaved?202:503).type('html').send(reservationPage(responseSaved?'Resposta registrada':'Não foi possível salvar',responseSaved?'Sua resposta está salva. As próximas comunicações aguardam conclusão pela secretaria.':'Tente enviar a resposta novamente. A confirmação não foi concluída.'));}
  };
  app.post('/api/reservation-confirmation/:token',(req,res)=>handleReservationResponse(req,res));
  app.post('/api/admin/workflow/reservations/:id/decision',requireAuthenticated,requireAdministrator,(req,res)=>{
    const process=processesStore.find(item=>item.id===req.params.id);
    if(!process)return res.status(404).json({error:'Processo não encontrado.'});
    if(!pendingReservationRecovery(process)||req.body?.dataRevision!==process.dataRevision)
      return res.status(409).json({error:'A solicitação mudou ou já foi respondida. Atualize o andamento.'});
    const reason=typeof req.body?.reason==='string'?req.body.reason.trim():'';
    if(!['accept','decline'].includes(req.body?.decision)||req.body?.confirmed!=='yes'||!reason||reason.length>500)
      return res.status(400).json({error:'Informe a decisão e o motivo administrativo, com até 500 caracteres.'});
    return handleReservationResponse(req,res,{process,email:getPortalIdentity(req)!.email,reason});
  });

  // Todas as alterações usam a mesma transação de reagendamento: bloqueio,
  // histórico, invalidação da confirmação anterior e novos links de decisão.
  app.post('/api/processes/:id/reservation-change', requireAuthenticated, async (req, res) => {
    const identity=getPortalIdentity(req)!;
    const process=processesStore.find(item=>item.id===req.params.id);
    if(!process||!canAccessProcess(identity.email,process.id))return res.status(404).json({error:'Processo não encontrado.'});
    const isAdvisor=normalizeEmail(identity.email)===normalizeEmail(process.orientador.email)
      &&getActiveProcessRoles(identity.email,process.id).includes('ADVISOR');
    if(!isReservationAuthor(identity.email,process)&&!isAdvisor)return res.status(403).json({error:'Somente os autores ou o orientador deste TCC podem alterar a reserva.'});
    if(!Number.isInteger(req.body?.expectedDataRevision)||req.body.expectedDataRevision!==process.dataRevision)return res.status(409).json({error:'Os dados do TCC mudaram. Reabra o processo antes do envio.',code:'STALE_DATA_REVISION'});
    let proposed:ReturnType<typeof validateReservationChange>;
    try {
      proposed=validateReservationChange(req.body||{},process,operationalConfig(currentSettings.integrationStudio).reservation.locations.filter(Boolean),currentSettings.slotDurationMinutes||90);
    }catch(error){return res.status(400).json({error:error instanceof Error?error.message:'Confira os dados solicitados.'});}
    if(!reservationDepartmentEnabled(currentSettings.emailConfig)&&isManagedDefenseLocation(proposed.local,operationalConfig(currentSettings.integrationStudio).reservation.locations))return res.status(409).json({error:'O contato responsável pelas reservas de auditório e sala de reuniões está desativado. Aguarde a ativação pela comissão ou selecione outro local, cuja confirmação será solicitada ao orientador.',code:'ROOM_RESERVATION_CONTACT_DISABLED'});
    req.body={expectedDataRevision:req.body.expectedDataRevision};
    return updateProcessHandler(req,res,proposed);
  });

  // GET /api/processes/:id
  app.get('/api/processes/:id', (req, res) => {
    const proc = findProcessByReference(req.params.id);
    if (!proc) {
      return res.status(404).json({ error: 'Processo não encontrado.' });
    }
    const identity=getPortalIdentity(req);if(!identity){if(proc.status==='EM_RASCUNHO')return res.status(404).json({error:'Processo não encontrado.'});return res.json(publicLegacyProcessView(proc));}if(!canAccessProcess(identity.email,proc.id))return res.status(404).json({error:'Processo não encontrado.'});res.json(processWithPendingAtaStage(proc,signatureJobsStore));
  });

  // PATCH /api/processes/:id (Edit by student or advisor)
  app.patch('/api/processes/:id', requireAuthenticated, (req,res)=>updateProcessHandler(req,res));
  async function updateProcessHandler(req:express.Request, res:express.Response, proposedSchedule?:ReturnType<typeof validateReservationChange>) {
    const actorEmail=getPortalIdentity(req)!.email;
    const procIndex = processesStore.findIndex((p) => p.id === req.params.id);

    if (procIndex === -1) {
      return res.status(404).json({ error: 'Processo não encontrado.' });
    }

    const existing = processesStore[procIndex];
    if(!canAccessProcess(actorEmail,existing.id))return res.status(404).json({error:'Processo não encontrado.'});
    if(req.body?.expectedDataRevision!==undefined&&Number(req.body.expectedDataRevision)!==existing.dataRevision){
      return res.status(409).json({error:'Este TCC foi atualizado em outra sessão. Recarregue os dados antes de salvar.',code:'STALE_DATA_REVISION'});
    }
    if(['protocolo','createdAt','previousProtocols'].some(key=>Object.hasOwn(req.body||{},key)))return res.status(400).json({error:'O protocolo e a data de criação são definidos pelo sistema e não podem ser alterados.',code:'IMMUTABLE_PROCESS_IDENTITY'});
    if(existing.avaliacao.status==='CONCLUIDO'||existing.avaliacao.submittedAt||existing.acervo?.submittedAt||existing.status==='CONCLUIDO')return res.status(409).json({error:'Os dados do processo foram encerrados com o registro de conceito e ata.',code:'PROCESS_DATA_LOCKED'});
    const activeRoles=getActiveProcessRoles(actorEmail,existing.id);
    const isFullAdministrator=hasFullAdministration(actorEmail);
    if(!isFullAdministrator&&!activeRoles.some(role=>role==='STUDENT'||role==='ADVISOR'))return res.status(403).json({error:'Somente alunos autores, orientador ou administração podem alterar os dados cadastrais do TCC.'});
    if(!proposedSchedule&&Object.hasOwn(req.body||{},'defesa'))return res.status(400).json({error:'Use Alterar reserva para mudar o agendamento da defesa.',code:'RESERVATION_CHANGE_REQUIRED'});
    const scheduleOnly=Boolean(proposedSchedule);
    if(signatureJobsStore.some(job=>job.processId===existing.id&&['SENDING','SENT','PARTIALLY_SIGNED','SIGNED','DRIVE_SYNC_PENDING'].includes(job.status)))return res.status(409).json({error:'Há documento em assinatura. Cancele ou conclua o envelope antes de alterar os dados do TCC.',code:'ACTIVE_SIGNATURE_ENVELOPE'});
    const invitationIssued = Boolean(existing.defesa.invitationDriveFileId || existing.defesa.invitationSentAt);
    if(!scheduleOnly&&(invitationIssued||signatureJobsStore.some(job=>job.processId===existing.id&&job.status!=='CANCELED'&&(job.driveUnsignedFileId||job.driveSignedFileId)))&&Object.keys(req.body||{}).some(key=>['protocolo','titulo','authorOrder','aluno1','aluno2','orientador','coorientador','banca','defesa'].includes(key)))return res.status(409).json({error:'Já existe documento emitido com estes dados. Use a reabertura formal da etapa ou registre uma correção, preservando o histórico.',code:'ISSUED_DOCUMENT_LOCK'});



    if(Object.hasOwn(req.body||{},'banca')){
      const board=req.body.banca;
      if(!Array.isArray(board)||board.length!==2||board.some(member=>!member||typeof member!=='object'||Array.isArray(member)||!['EXAMINER_2','EXAMINER_3'].includes(member.funcao))||new Set(board.map(member=>member.funcao)).size!==2)return res.status(400).json({error:'Informe os dois examinadores com funções distintas. A orientação é definida no campo do orientador.',code:'INVALID_EXAMINER_ROLES'});
    }
    for(const [key,value] of Object.entries(req.body||{})){
      const people=key==='banca'&&Array.isArray(value)?value:['aluno1','aluno2','orientador','coorientador'].includes(key)?[value]:[];
      for(const [index,person] of (people as any[]).entries()){
        if(!person)continue;const student=key.startsWith('aluno');const previous=key==='banca'?(existing.banca.find(member=>member.id===person.id)||existing.banca[index]):(existing as any)[key];
        if(person.tratamento!==undefined&&person.tratamento!==previous?.tratamento&&!((student?STUDENT_TREATMENTS:FACULTY_TREATMENTS) as readonly string[]).includes(person.tratamento))return res.status(400).json({error:'Escolha um tratamento válido.'});
        if(!student&&person.titulacao!==undefined&&person.titulacao!==previous?.titulacao&&!(ACADEMIC_DEGREES as readonly string[]).includes(person.titulacao))return res.status(400).json({error:'Escolha uma titulação válida.'});
      }
    }
    if(req.body?.authorOrder!==undefined&&!['ALUNO_1_FIRST','ALUNO_2_FIRST'].includes(req.body.authorOrder))return res.status(400).json({error:'Escolha uma ordem válida para os autores.'});
    const before = JSON.parse(JSON.stringify(existing));
    const {globalRoles}=getUserRolesForEmail(actorEmail),isAdministrative=isFullAdministrator;
    const canCorrectBeforeInvitation=!invitationIssued&&activeRoles.some(role=>role==='STUDENT'||role==='ADVISOR');
    const allowedKeys=scheduleOnly?[]:isAdministrative||canCorrectBeforeInvitation?['titulo','authorOrder','aluno1','aluno2','orientador','coorientador','banca']:['titulo'];
    const forbiddenKeys=Object.keys(req.body||{}).filter(key=>['avaliacao','acervo','etapaAtual','status','driveFolderId','driveFolderUrl','driveSyncedAt'].includes(key));
    if(forbiddenKeys.length)return res.status(400).json({error:'Conceito e ata, entrega final, estado e vínculos do Drive só podem mudar pelas ações próprias do fluxo.',code:'PROTECTED_WORKFLOW_FIELDS'});
    const acceptedUpdates:any=Object.fromEntries(Object.entries(req.body||{}).filter(([key])=>allowedKeys.includes(key)));
    if(typeof acceptedUpdates.titulo==='string')acceptedUpdates.titulo=formatTccTitle(acceptedUpdates.titulo).replace(/\+([^+]+?)-/g,'$1');
    for(const key of ['aluno1','aluno2','orientador','coorientador','banca']){
      const value=acceptedUpdates[key];
      if(!value)continue;
      const normalize=(person:any)=>{
        const allowedFields=key.startsWith('aluno')?['nome','email','tratamento']:['id','nome','email','tratamento','titulacao','instituicao','profissao','funcao','membroTipo'];
        const clean=Object.fromEntries(Object.entries(person).filter(([field,value])=>allowedFields.includes(field)&&typeof value==='string'));
        return {...clean,...(key.startsWith('aluno')?{matricula:''}:{}),...(typeof person.nome==='string'?{nome:normalizePersonName(person.nome)}:{}),...(!key.startsWith('aluno')&&typeof person.instituicao==='string'?{instituicao:renderInstitutionName(person.instituicao)}:{})};
      };
      acceptedUpdates[key]=Array.isArray(value)?value.map(normalize):normalize(value);
    }
    if(proposedSchedule){
      const {startAt,local}=proposedSchedule;
      acceptedUpdates.defesa={...existing.defesa,startAt,endAt:defenseEndAt(startAt),local,alternateLocation:undefined};
    }
    let updated: ProcessData = {
      ...existing,
      ...acceptedUpdates,
      dataRevision: existing.dataRevision + 1,
      updatedAt: new Date().toISOString()
    };
    if(!scheduleOnly){
    const authors=[updated.aluno1,updated.aluno2].filter(Boolean) as Array<NonNullable<ProcessData['aluno2']>>;
    if(!updated.titulo?.trim()||authors.some(author=>!author.nome?.trim()||!isValidPortalEmail(author.email))||!updated.orientador?.nome?.trim()||!isValidPortalEmail(updated.orientador?.email)||!Array.isArray(updated.banca)||updated.banca.length<2||updated.banca.some(member=>!member.nome?.trim()||!isValidPortalEmail(member.email)))return res.status(400).json({error:'Preserve título, autores com nome e e-mail, orientador e os dois examinadores com dados válidos.'});
    const previousCoauthor=normalizeEmail(existing.aluno2?.email||''),nextCoauthor=normalizeEmail(updated.aluno2?.email||'');
    if(previousCoauthor!==nextCoauthor)updated.coauthorAcceptance={status:'NOT_REQUIRED'};
    if(!isAdministrative&&activeRoles.includes('STUDENT')&&!([updated.aluno1.email,updated.aluno2?.email].filter(Boolean).map(value=>normalizeEmail(String(value))).includes(normalizeEmail(actorEmail))))return res.status(403).json({error:'O aluno autenticado não pode retirar o próprio vínculo de autoria do TCC.'});
    if(!isAdministrative&&activeRoles.includes('ADVISOR')&&normalizeEmail(updated.orientador.email)!==normalizeEmail(actorEmail))return res.status(403).json({error:'O orientador não pode retirar o próprio vínculo. Solicite a correção do e-mail ao Master.'});
    if(['aluno1','aluno2','orientador','coorientador','banca'].some(key=>Object.hasOwn(acceptedUpdates,key))){const participantConflict=validateDistinctProcessParticipants(updated);if(participantConflict)return res.status(400).json({error:participantConflict,code:'INVALID_PARTICIPANT_COMPOSITION'});}
    if(['aluno1','aluno2'].some(key=>Object.hasOwn(acceptedUpdates,key))){const studentEmails=[updated.aluno1.email,updated.aluno2?.email].filter(Boolean).map(email=>normalizeEmail(String(email)));if(studentEmails.some(email=>!studentRegistrationEmailAllowed(email)))return res.status(400).json({error:'Informe e-mails válidos para os autores.'});const conflict=processesStore.find(process=>process.id!==existing.id&&studentEmails.some(email=>[process.aluno1.email,process.aluno2?.email].filter(Boolean).map(value=>normalizeEmail(String(value))).includes(email)));if(conflict)return res.status(409).json({error:`Cada aluno pode participar como autor de apenas um TCC. Já existe o processo ${conflict.protocolo}.`});}
    }
    const scheduleChanged=reservationScheduleChanged(existing,updated);
    if(scheduleOnly&&!scheduleChanged)return res.json({...existing,reservationRestarted:false});
    if(proposedSchedule){
      const academicError=validateAcademicWindow(updated.defesa.startAt);
      if(academicError)return res.status(409).json({error:academicError,code:'ACADEMIC_WINDOW_CLOSED'});
      if(scheduleChanged&&signatureJobsStore.some(job=>job.processId===existing.id&&job.status!=='CANCELED'&&(job.driveUnsignedFileId||job.driveSignedFileId))){
        return res.status(409).json({error:'O agendamento está vinculado a um documento emitido. Solicite uma correção administrativa.',code:'ISSUED_DOCUMENT_LOCK'});
      }
    }
    let overriddenConflicts:ReturnType<typeof findDefenseConflicts>=[];
    const conflictOverrideReason=!scheduleOnly&&typeof req.body?.conflictOverrideReason==='string'?req.body.conflictOverrideReason.trim():'';
    if(updated.defesa?.startAt&&(updated.defesa.departmentResponse?.decision!=='UNAVAILABLE'||scheduleChanged)&&(proposedSchedule||['aluno1','aluno2','orientador','coorientador','banca'].some(key=>Object.hasOwn(acceptedUpdates,key)))){
      const endAt=defenseEndAt(updated.defesa.startAt);
      const conflicts=findDefenseConflicts({startAt:updated.defesa.startAt,endAt,local:updated.defesa.local,alternateLocation:updated.defesa.localStatus==='CONFIRMADO'&&!scheduleChanged?undefined:updated.defesa.alternateLocation,emails:participantEmails(updated),excludeProcessId:updated.id});
      if(conflicts.length&&(proposedSchedule||!isFullAdministrator||!conflictOverrideReason))return res.status(409).json({error:'A alteração cria conflito de sala ou participante.',code:'DEFENSE_CONFLICT',conflicts:visibleDefenseConflicts(actorEmail,conflicts)});
      overriddenConflicts=conflicts;
    }

    const reservationRestarted=scheduleChanged&&canRestartReservation(existing)&&!signatureJobsStore.some(job=>job.processId===existing.id&&job.status!=='CANCELED'&&(job.driveUnsignedFileId||job.driveSignedFileId));
    if(reservationRestarted)updated=restartReservation(existing,updated,actorEmail,updated.updatedAt);
    const renamedFolder=updated.protocolo!==existing.protocolo&&Boolean(existing.driveFolderId);
    if(renamedFolder)await renamePortalProcessFolder({accessToken:await getGoogleWorkspaceAccessToken(),fileId:existing.driveFolderId!,previousProtocol:existing.protocolo,protocol:updated.protocolo});
    processesStore[procIndex] = updated;
    synchronizeProcessParticipants(updated,actorEmail);

    if(overriddenConflicts.length)auditLogsStore.push({id:`log-${randomBytes(12).toString('hex')}-conflict`,processId:updated.id,actorEmail,actorRoles:globalRoles,action:'SOBRESCRITA_CONFLITO_DEFESA',entityType:'defense_schedule',entityId:updated.id,after:{reason:conflictOverrideReason,conflicts:overriddenConflicts},timestamp:updated.updatedAt});

    auditLogsStore.push({
      id: `log-${Date.now()}`,
      processId: existing.id,
      actorEmail,
      actorRoles: [...globalRoles,...activeRoles],
      action: 'EDICAO_DADOS_PROCESSO',
      entityType: 'processo',
      entityId: existing.id,
      before,
      after: updated,
      timestamp: new Date().toISOString()
    });

    signatureJobsStore.forEach(job=>{if(job.processId===existing.id&&['WAITING_INTEGRATION','QUEUED','READY_FOR_REVIEW','APPROVED'].includes(job.status)){job.status='CANCELED';job.lastError='Item invalidado porque os dados do TCC foram alterados.';job.updatedAt=new Date().toISOString();}});
    if(reservationRestarted)auditLogsStore.push({id:`log-${Date.now()}-reservation-restart`,processId:updated.id,actorEmail,actorRoles:[...globalRoles,...activeRoles],action:'REINICIO_SOLICITACAO_RESERVA',entityType:'processo',entityId:updated.id,before:{defesa:before.defesa},after:{defesa:updated.defesa},timestamp:updated.updatedAt});
    try{await persistPortalStateDurably();}catch(error){
      processesStore[procIndex]=existing;
      if(renamedFolder)await renamePortalProcessFolder({accessToken:await getGoogleWorkspaceAccessToken(),fileId:existing.driveFolderId!,previousProtocol:updated.protocolo,protocol:existing.protocolo}).catch(()=>undefined);
      throw error;
    }
    if(scheduleChanged)googleCalendarEventsStore=generateGoogleEventsFromProcesses(processesStore);
    if(reservationRestarted){
      const savedRevision=updated.dataRevision,savedReservation=updated.defesa.reservationRevision;
      afterReservationChangeResponse(req,res,async()=>{
        if(!processesStore.includes(updated)||updated.dataRevision!==savedRevision||updated.defesa.reservationRevision!==savedReservation)return;
        await executeConfiguredWorkflowEvent(updated,RESERVATION_RESCHEDULED,actorEmail);
        await persistPortalStateDurably();
      },{retain:beginRuntimeRequestTask,waitUntil:process.env.VERCEL?waitUntil:undefined,
        onError:()=>{console.error('[Reserva] Alteração salva; comunicação automática permanece pendente.');}});
      return res.status(202).json({...updated,reservationRestarted:true,workflowPending:true,workflowProcessing:true});
    }
    res.json(updated);
  }

  // DELETE /api/processes/:id (Master admin deletes a process)
  const deletionCleanupLocks=new Set<string>();
  const protectedProcessDeletionFileIds=(processId:string)=>collectProcessDriveFileIds(
    processesStore.filter(process=>process.id!==processId),
    signatureJobsStore.filter(job=>job.processId!==processId),
    formArchiveJobsStore.filter(job=>job.processId!==processId),
    studioFormSubmissionsStore.filter(form=>form.processId!==processId),
    legacyAcademicRecordsStore,currentSettings
  );
  const retryProcessDeletion=async(task:ProcessDeletionTask)=>{
    if(deletionCleanupLocks.has(task.id)||isProcessDeletionInProgress(task))return task;
    deletionCleanupLocks.add(task.id);
    try{
    const now=Date.now();
    task.attemptCount=(task.attemptCount||0)+1;
    task.lastAttemptAt=new Date(now).toISOString();
    task.processingUntil=new Date(now+processDeletionLeaseMs).toISOString();
    task.nextRetryAt=processDeletionNextRetryAt(task.attemptCount,now);
    await persistPortalStateDurably();
    task.calendarId ??= currentSettings.calendarId;
    task.errors=[];
    if(processesStore.some(process=>process.id===task.processId)){
      task.errors.push('O TCC voltou ao Portal. A limpeza foi interrompida para preservar os recursos restaurados.');
      task.processingUntil=undefined;
      await persistPortalStateDurably();
      return task;
    }
    if(task.deleteFiles&&!task.driveCleaned){
      const protectedIds=[...new Set([...task.protectedIds,...protectedProcessDeletionFileIds(task.processId)])];
      if(task.rootFolderId||task.folderId||task.fileIds.some(id=>!id.startsWith('local_'))){try{await deleteProcessDriveArtifacts({...task,protectedIds,accessToken:await getGoogleWorkspaceAccessToken()});task.folderId=undefined;task.fileIds=task.fileIds.filter(id=>id.startsWith('local_'));}catch(e){task.errors.push(e instanceof Error?e.message:'Drive: limpeza pendente.');}}
      for(const id of [...task.fileIds])if(id.startsWith('local_')){
        try{
          if(protectedIds.includes(id))throw Error('Arquivo compartilhado com outro TCC foi preservado.');
          if(id.startsWith('local_review_')){const key=/^local_review_([a-f0-9]{64})$/.exec(id)?.[1];if(!key)throw Error('Arquivo local inválido.');const metadataFile=path.join(portalDataDirectory,'arquivos-demonstrativos',key+'.json');if(existsSync(metadataFile)){const metadata=JSON.parse(readFileSync(metadataFile,'utf8'));if(metadata.processId!==task.processId)throw Error('Arquivo local de outro TCC foi preservado.');for(const ext of ['.pdf','.json']){const file=path.join(portalDataDirectory,'arquivos-demonstrativos',key+ext);if(existsSync(file))unlinkSync(file);}}}
          else if(id.startsWith('local_govbr_')){const key=/^local_govbr_([a-f0-9]{64})$/.exec(id)?.[1];if(!key)throw Error('Arquivo Gov.br inválido.');const file=path.join(portalDataDirectory,'govbr-pdfs',key+'.pdf');if(existsSync(file))unlinkSync(file);}
          task.fileIds=task.fileIds.filter(file=>file!==id);
        }catch(e){task.errors.push(e instanceof Error?e.message:'Arquivo local pendente.');}
      }
      if(!task.errors.length)task.driveCleaned=true;
    }
    if(task.deleteFiles&&!task.calendarCleaned){try{if(task.calendarId)await deleteProcessCalendarEvents({accessToken:await getGoogleWorkspaceAccessToken(),calendarId:task.calendarId,processId:task.processId,protocol:task.protocol,deletedAt:task.createdAt});task.calendarCleaned=true;}catch(e){task.errors.push(e instanceof Error?e.message:'Calendário: limpeza pendente.');}}
    if(task.deleteFiles&&!task.storageCleaned){try{await deleteProcessSupabaseObjects(task.processId);task.storageCleaned=true;}catch(e){task.errors.push(e instanceof Error?e.message:'Supabase Storage: limpeza pendente.');}}
    if(task.clearHistory&&(!task.deleteFiles||task.storageCleaned)){try{await purgeSupabaseProcessHistory(task.processId,task.protocol,task.jobIds);task.clearHistory=false;}catch(e){task.errors.push(e instanceof Error?e.message:'Histórico externo pendente.');}}
    task.astenReconciliation ??= task.envelopes.map(id=>({id,state:'PENDING'}));
    const externalEnvelopes=[
      ...task.astenReconciliation.filter(envelope=>envelope.state==='PENDING'),
      ...task.astenReconciliation.filter(envelope=>envelope.state==='REVIEW'),
    ];
    if(externalEnvelopes.length){
      const connection=await getPersistentAstenConnection();
      if(!connection)task.errors.push('A consulta dos envelopes aguarda a conexão institucional com a Asten.');
      else{
        const astenDeletionEnabled=(await getPersistentAstenStatus()).enabled;
        const authorization=process.env.ASTEN_PROCESS_DELETION_CANCELLATION_APPROVED==='true' && astenDeletionEnabled;
        const sharedIds=new Set([
          ...signatureJobsStore.filter(job=>job.processId!==task.processId).map(job=>job.providerEnvelopeId),
          ...processDeletionTasksStore.filter(other=>other.processId!==task.processId).flatMap(other=>other.envelopes),
          ...auditLogsStore.filter(log=>log.action==='EXCLUSAO_PROCESSO_TCC'&&log.id!==`log-${task.id}`)
            .flatMap(log=>[log.after?.astenEnvelopeIds,log.after?.manualAstenEnvelopes]
              .flatMap(ids=>Array.isArray(ids)?ids:[])),
        ]);
        for(const envelope of externalEnvelopes.slice(0,3)){
          const timeoutMs=7500;
          if(sharedIds.has(envelope.id)){
            envelope.state='REVIEW';envelope.reason='O identificador do envelope também está registrado em outro TCC.';
            continue;
          }
          await reconcileDeletedAstenEnvelope(envelope,{
            repositoryId:connection.repositoryId,
            read:id=>callAsten('getDadosEnvelope',{idEnvelope:id,getLobs:'N'},connection.token,timeoutMs),
            readSigners:id=>callAsten('getSignatariosPorEnvelope',{idEnvelope:id},connection.token,timeoutMs),
            cancel:(envelope.purgeRequired?astenDeletionEnabled:authorization)?id=>callAsten('cancelarEnvelope',{idEnvelope:id,motivo:'Exclusão autorizada do processo de TCC.',anularAssinaturas:envelope.purgeRequired?'S':'N'},connection.token,timeoutMs):undefined,
            purge:envelope.purgeRequired&&astenDeletionEnabled?id=>callAsten('expurgarEnvelope',{idEnvelope:id},connection.token,timeoutMs):undefined,
            persist:persistPortalStateDurably,
          });
        }
      }
    }
    const internalPending=task.errors.length>0;
    const externalPending=task.astenReconciliation.filter(envelope=>envelope.state==='PENDING');
    const externalReview=task.astenReconciliation.filter(envelope=>envelope.state==='REVIEW');
    task.externalReviewRequired=!internalPending&&!externalPending.length&&externalReview.length>0;
    if(task.externalReviewRequired)task.nextRetryAt=undefined;
    for(const reason of new Set([...externalPending,...externalReview].map(envelope=>envelope.reason).filter((value):value is string=>Boolean(value))))task.errors.push(reason);
    if(!task.errors.length&&externalPending.length)task.errors.push('Há envelopes aguardando a próxima consulta à Asten.');
    task.status=internalPending||externalPending.length||externalReview.length?'PENDING':'COMPLETED';
    task.processingUntil=undefined;
    if(task.status==='COMPLETED'){
      const deletionLog=auditLogsStore.find(log=>log.id===`log-${task.id}`);
      if(deletionLog)deletionLog.after={
        deleteFiles:task.deleteFiles,
        deletedProcessId:task.processId,
        cleanupConfirmed:true,
        cleanupStatus:'Limpeza do Portal concluída',
        ...(task.envelopes.length?{
          astenEnvelopeIds:task.envelopes,
          astenCanceled:task.astenReconciliation.filter(envelope=>envelope.state==='CANCELED').length,
          astenExpired:task.astenReconciliation.filter(envelope=>envelope.state==='EXPIRED').length,
          astenPreserved:task.astenReconciliation.filter(envelope=>envelope.state==='PRESERVED').length,
          astenPurged:task.astenReconciliation.filter(envelope=>envelope.state==='PURGED').length,
        }:{}),
      };
      processDeletionTasksStore=processDeletionTasksStore.filter(item=>item.id!==task.id);
    }
    await persistPortalStateDurably();return task;
    }finally{deletionCleanupLocks.delete(task.id);}
  };
  app.get('/api/admin/process-deletions',requireAuthenticated,requireAdministrator,(req,res)=>{if(!getUserRolesForEmail(getPortalIdentity(req)!.email).globalRoles.includes('MASTER_ADMIN'))return res.status(403).json({error:'Apenas o Master pode gerenciar exclusões.'});res.json(processDeletionTasksStore.map(processDeletionSummary));});
  app.post('/api/admin/process-deletions/:id/retry',requireAuthenticated,requireAdministrator,async(req,res)=>{
    if(!getUserRolesForEmail(getPortalIdentity(req)!.email).globalRoles.includes('MASTER_ADMIN'))return res.status(403).json({error:'Apenas o Master pode gerenciar exclusões.'});
    const task=processDeletionTasksStore.find(item=>item.id===req.params.id);if(!task)return res.status(404).json({error:'Limpeza não encontrada.'});
    // Acknowledgement describes the already durable task. External cleanup must not
    // hold the HTTP response open; it keeps the same exclusive runtime lease.
    if(!deletionCleanupLocks.has(task.id)&&!isProcessDeletionInProgress(task)){
      afterReservationChangeResponse(req,res,async()=>{await retryProcessDeletion(task);},{
        retain:beginRuntimeRequestTask,waitUntil:process.env.VERCEL?waitUntil:undefined,
        onError:()=>{console.error('[Exclusão] Limpeza durável aguarda nova conferência.');},
      });
    }
    res.status(202).json(processDeletionSummary(task));
  });
  app.delete('/api/processes/:id', requireAuthenticated, requireAdministrator, async (req, res) => {
    if(req.body?.confirmation!=='EXCLUIR'||req.body?.expectedProcessId!==req.params.id)return res.status(400).json({error:'Confirme explicitamente a exclusão deste TCC.',code:'PROCESS_DELETE_CONFIRMATION_REQUIRED'});
    const actorEmail=getPortalIdentity(req)!.email;
    const { globalRoles } = getUserRolesForEmail(actorEmail);

    if (!hasFullAdministration(actorEmail)) {
      return res.status(403).json({ error: 'Apenas o Master ou o Presidente da Comissão pode excluir trabalhos de TCC.' });
    }



    const procIndex = processesStore.findIndex((p) => p.id === req.params.id);
    if (procIndex === -1) {
      return res.status(404).json({ error: 'Processo não encontrado.' });
    }

    const target=processesStore[procIndex],isMaster=globalRoles.includes('MASTER_ADMIN');
    if(legalHoldsStore.some(hold=>hold.processId===target.id&&hold.active))return res.status(409).json({error:'Este TCC está sob bloqueio legal de exclusão.',code:'PROCESS_LEGAL_HOLD'});
    const hasExternalRecord=Boolean(target.driveFolderId||target.defesa.invitationDriveFileId||formArchiveJobsStore.some(job=>job.processId===target.id)||signatureJobsStore.some(job=>job.processId===target.id));
    if(!isMaster&&hasExternalRecord)return res.status(403).json({error:'A exclusão de TCC com arquivos e assinaturas é reservada ao Master.'});
    if(!isMaster&&(req.body.deleteFiles||req.body.clearHistory))return res.status(403).json({error:'A limpeza de arquivos e histórico é reservada ao Master.'});
    const deleteFiles=isMaster,clearHistory=isMaster;
    const jobs=signatureJobsStore.filter(job=>job.processId===target.id),forms=formArchiveJobsStore.filter(job=>job.processId===target.id);
    const jobIds=new Set(jobs.map(job=>job.id));
    const hasActiveEmail=emailDeliveriesStore.some(record=>record.processId===target.id&&record.dispatchState==='SENDING'&&Date.parse(record.dispatchLeaseUntil||'')>Date.now());
    if(hasActiveEmail)return res.status(409).json({error:'Há um envio de e-mail em andamento neste TCC. Aguarde a conclusão antes de excluir.',code:'PROCESS_OPERATION_IN_PROGRESS'});
    if(forms.some(job=>reservationArchiveTasks.has(job.id)))return res.status(409).json({error:'Há um arquivamento em andamento neste TCC. Aguarde a conclusão antes de excluir.',code:'PROCESS_OPERATION_IN_PROGRESS'});
    if([...signatureJobCreationLocks.keys()].some(key=>key.startsWith(target.id+'|'))||jobs.some(job=>signatureDispatchLocks.has(job.id))||astenWebhookEventsStore.some(event=>jobIds.has(event.matchedJobId||'')&&!event.processedAt&&Date.parse(event.processingLeaseUntil||'')>Date.now()))return res.status(409).json({error:'Há uma operação de assinatura em andamento neste TCC. Aguarde a conclusão antes de excluir.',code:'PROCESS_OPERATION_IN_PROGRESS'});
    const protectedIds=protectedProcessDeletionFileIds(target.id);
    const rollback=structuredClone({...snapshotPortalState(),signatureJobs:signatureJobsStore,formArchiveJobs:formArchiveJobsStore});
    const task=processDeletionTask(target,jobs,[...forms,...studioFormSubmissionsStore.filter(form=>form.processId===target.id)],{deleteFiles,clearHistory,rootFolderId:currentSettings.driveRootFolderId||'',protectedIds});
    task.calendarId=currentSettings.calendarId;
    processesStore=processesStore.filter(p=>p.id!==target.id);membershipsStore=membershipsStore.filter(m=>m.processId!==target.id);
    const derivedAccessIds=new Set(authorizedStudentsStore.filter(entry=>entry.origin==='TCC_FORM'&&entry.processIds.includes(target.id)).map(entry=>entry.id));
    for(const entry of authorizedStudentsStore)if(entry.processIds.includes(target.id)){entry.processIds=entry.processIds.filter(id=>id!==target.id);if(entry.origin==='TCC_FORM'&&!entry.processIds.length)entry.active=false;entry.updatedAt=new Date().toISOString();}
    authorizedStudentsStore=authorizedStudentsStore.filter(entry=>!derivedAccessIds.has(entry.id)||entry.processIds.length>0);
    for(const entry of rollback.authorizedStudents||[])removedAccessProcessKeys.delete(accessProcessKey(entry.email,target.id));
    evaluationDraftsStore.delete(target.id);reminderRecordsStore=reminderRecordsStore.filter(item=>item.processId!==target.id);
    correctionRequestsStore=correctionRequestsStore.filter(item=>item.processId!==target.id);studioFormSubmissionsStore=studioFormSubmissionsStore.filter(item=>item.processId!==target.id);
    formArchiveJobsStore=formArchiveJobsStore.filter(item=>item.processId!==target.id);
    if(clearHistory){
      auditLogsStore=auditLogsStore.filter(item=>item.processId!==target.id&&item.entityId!==target.id&&!task.jobIds.includes(item.entityId||''));
      signatureJobsStore=signatureJobsStore.filter(item=>item.processId!==target.id);emailDeliveriesStore=emailDeliveriesStore.filter(item=>item.processId!==target.id);workflowRunsStore=workflowRunsStore.filter(item=>item.processId!==target.id);astenWebhookEventsStore=astenWebhookEventsStore.filter(item=>!task.jobIds.includes(item.matchedJobId||'')&&!task.envelopes.includes(item.envelopeId||''));
    }else{
      for(const job of jobs)if(job.status!=='ARCHIVED')job.status='CANCELED';
      for(const mail of emailDeliveriesStore.filter(item=>item.processId===target.id&&item.status!=='ACCEPTED_BY_GMAIL')){mail.maxAttempts=mail.attempts.length;mail.nextRetryAt=undefined;}
    }
    auditLogsStore.push({id:`log-${task.id}`,processProtocol:target.protocolo,actorEmail,actorRoles:globalRoles,action:'EXCLUSAO_PROCESSO_TCC',entityType:'process_deletion',entityId:task.id,after:{deleteFiles,clearHistory,deletedProcessId:target.id},timestamp:task.createdAt});
    processDeletionTasksStore.push(task);
    try{await persistPortalStateDurably();}catch(error){applyPersistedState(rollback);throw error;}
    googleCalendarEventsStore=generateGoogleEventsFromProcesses(processesStore);
    afterReservationChangeResponse(req,res,async()=>{await retryProcessDeletion(task);},{
      retain:beginRuntimeRequestTask,waitUntil:process.env.VERCEL?waitUntil:undefined,
      onError:()=>{console.error('[Exclusão] Exclusão salva; limpeza durável aguarda nova conferência.');},
    });
    res.status(202).json({
      message:'TCC excluído do Portal. A limpeza dos recursos vinculados está em andamento.',cleanupPending:true,
      processId:target.id,protocol:target.protocolo,cleanupTaskId:task.id,
      cleanup:processDeletionSummary(task),cleanupErrors:task.errors,astenPreserved:0,
    });

  });

  app.get('/api/processes/:id/evaluation/schema', requireAuthenticated, (req, res) => {
    const actorEmail = getPortalIdentity(req)!.email;
    const process = processesStore.find(p => p.id === req.params.id);
    if (!process || !canAccessProcess(actorEmail, process.id)) return res.status(404).json({ error: 'Processo não encontrado.' });
    if (!getActiveProcessRoles(actorEmail, process.id).includes('ADVISOR')) return res.status(403).json({ error: 'O formulário de conceito e ata pertence ao orientador responsável.' });
    if (!isConceptRegistrationReleased(process)) return res.status(409).json({error:'O registro de conceito e ata ainda não está disponível.',code:'CONCEPT_STAGE_NOT_RELEASED'});
    const studio = currentSettings.integrationStudio;
    res.setHeader('Cache-Control', 'private, no-store');
    res.json({ ataModelFingerprint:ataModelFingerprint(currentSettings.documentModels?.ATA), outcomes: EVALUATION_OUTCOMES, studio: {
      revision: studio?.revision || 0,
      formTemplates: (studio?.formTemplates || []).filter(f => f.id === 'form-reserva-aluno').map(form=>({...form,questions:registrationQuestions(studio)})),
      processFieldSchemas: {evaluation:evaluationQuestions(studio)},
      operationalConfig: { ...operationalConfig(studio), reservation: { ...operationalConfig(studio).reservation, departmentEmail: '' }, presentations: {}, workflow: undefined },
      operationsPolicy: { timezone: studio?.operationsPolicy?.timezone || currentSettings.timezone || 'America/Sao_Paulo' },
    } });
  });

  // Rascunho durável da ata, separado de ações externas de finalização.
  app.get('/api/processes/:id/evaluation/draft',requireAuthenticated,(req,res)=>{
    const email=getPortalIdentity(req)!.email;
    const process=processesStore.find(item=>item.id===req.params.id);
    if(!process||!canAccessProcess(email,process.id))return res.status(404).json({error:'Processo não encontrado.'});
    if(!getActiveProcessRoles(email,process.id).includes('ADVISOR'))return res.status(403).json({error:'Apenas o orientador autorizado pode acessar este rascunho.'});
    if(!isConceptRegistrationReleased(process))return res.status(409).json({error:'O registro de conceito e ata ainda não está disponível.',code:'CONCEPT_STAGE_NOT_RELEASED'});
    const draft=evaluationDraftsStore.get(process.id);
    res.setHeader('Cache-Control','private, no-store');
    return res.json(draft?.dataRevision===process.dataRevision?recoverEvaluationDocument(draft,ataModelFingerprint(currentSettings.documentModels?.ATA)):null);
  });
  app.put('/api/processes/:id/evaluation/draft',requireAuthenticated,async(req,res)=>{
    const email=getPortalIdentity(req)!.email;
    const process=processesStore.find(item=>item.id===req.params.id);
    if(!process||!canAccessProcess(email,process.id))return res.status(404).json({error:'Processo não encontrado.'});
    if(!getActiveProcessRoles(email,process.id).includes('ADVISOR'))return res.status(403).json({error:'Apenas o orientador autorizado pode editar este rascunho.'});
    if(!isConceptRegistrationReleased(process))return res.status(409).json({error:'O registro de conceito e ata ainda não está disponível.',code:'CONCEPT_STAGE_NOT_RELEASED'});
    if(process.avaliacao.status==='CONCLUIDO')return res.status(409).json({error:'Conceito e ata já registrados.'});
    if(Number(req.body?.expectedDataRevision)!==process.dataRevision)return res.status(409).json({error:'Os dados do TCC foram alterados. Atualize a ficha antes de continuar.'});
    const raw=req.body?.answers;
    if(!raw||typeof raw!=='object'||Array.isArray(raw))return res.status(400).json({error:'Rascunho inválido.'});
    const entries=Object.entries(raw);
    if(entries.length>40||JSON.stringify(raw).length>25000)return res.status(413).json({error:'Rascunho excede o limite permitido.'});
    for(const [key,value] of entries){
      if(!/^[A-Z][A-Z0-9_]{0,79}$/.test(key)||!['string','number','boolean'].includes(typeof value)||String(value).length>10000)return res.status(400).json({error:'O rascunho contém um campo inválido.'});
    }
    const allowedAnswers=new Set([...evaluationQuestions(currentSettings.integrationStudio).map(question=>question.fieldKey),'COORIENTADOR_PRESENTE']);
    const answers=registrationAnswersWithoutIdentifiers(Object.fromEntries(entries.filter(([key])=>allowedAnswers.has(key))) as Record<string,string|number|boolean>);
    const documentText=req.body?.documentText;
    if(documentText!==undefined&&(typeof documentText!=='string'||documentText.length>60000||/[\u0000-\u0008\u000e-\u001f]/.test(documentText)))return res.status(400).json({error:'Texto integral da ata inválido.'});
    const previous=evaluationDraftsStore.get(process.id);
    const modelFingerprint=ataModelFingerprint(currentSettings.documentModels?.ATA);
    if(documentText!==undefined&&modelFingerprint&&req.body?.expectedModelFingerprint!==modelFingerprint)return res.status(409).json({error:'O modelo da ata mudou. Atualize a página para recuperar o modelo padrão.',code:'ATA_MODEL_CHANGED'});
    const draft:EvaluationAutosaveDraft={modelFingerprint,documentText,processId:process.id,dataRevision:process.dataRevision,answers,savedAt:new Date().toISOString(),savedBy:email};
    evaluationDraftsStore.set(process.id,draft);
    try{await persistPortalStateDurably();}catch{
      if(previous)evaluationDraftsStore.set(process.id,previous);else evaluationDraftsStore.delete(process.id);
      return res.status(503).json({error:'Não foi possível persistir o rascunho.'});
    }
    res.setHeader('Cache-Control','private, no-store');
    return res.json(draft);
  });

  const evaluationSaveInFlight=new Set<string>();
  app.post('/api/processes/:id/evaluation/preview',requireAuthenticated,async(req,res)=>{
    const actor=getPortalIdentity(req)!.email;
    const p=processesStore.find(item=>item.id===req.params.id);
    if(!p||!canAccessProcess(actor,p.id))return res.status(404).json({error:'Processo não encontrado.'});
    if(!getActiveProcessRoles(actor,p.id).includes('ADVISOR'))return res.status(403).json({error:'A prévia da ata pertence ao orientador responsável.'});
    if(!isConceptRegistrationReleased(p))return res.status(409).json({error:'O registro de conceito e ata ainda não está disponível.',code:'CONCEPT_STAGE_NOT_RELEASED'});
    if(p.avaliacao.status==='CONCLUIDO')return res.status(409).json({error:'Conceito e ata já registrados. Consulte a ata em Documentos administrativos.'});
    try{
      const provider=req.body?.signatureProvider||'ASTEN';if(!['ASTEN','GOV_BR'].includes(provider))return res.status(400).json({error:'Provedor inválido.'});
      if(req.body?.documentText!==undefined&&ataModelFingerprint(currentSettings.documentModels?.ATA)&&req.body?.expectedModelFingerprint!==ataModelFingerprint(currentSettings.documentModels?.ATA))return res.status(409).json({error:'O modelo da ata mudou. Atualize a página antes de usar um texto revisado.',code:'ATA_MODEL_CHANGED'});
      const evaluation=acceptEvaluation(p,{...req.body,dataConfirmed:true},currentSettings,actor,new Date(),{previewOnly:true});
      const binding=evaluationPreviewBinding(p,actor,evaluation,provider);
      const candidate={...p,avaliacao:{...p.avaliacao,...evaluation}};
      const variables=buildProcessVariables({process:candidate,eventCode:'EVALUATION_PREVIEW',actorEmail:actor,actorRoles:getActiveProcessRoles(actor,p.id)});variables.DEFESA_DATA_HORA=p.defesa.startAt;
      let documentText='';
      let rendered:Awaited<ReturnType<typeof renderGoogleDriveTemplateToPdf>>|undefined;
      const version=1+Math.max(0,...signatureJobsStore.filter(job=>job.processId===p.id&&job.documentType==='ATA').map(job=>job.documentVersion));
      const verificationCode=buildDocumentVerificationCode({...p,dataRevision:p.dataRevision+1},'ATA',version);
      const pdf=await markPreview(await renderOfficialTemplatePdf(candidate,'ATA',verificationCode,variables,currentSettings.integrationStudio,text=>{documentText=text;},undefined,result=>{rendered=result;}));
      const download=getSupabaseRuntimeStatus().durablePersistenceReady&&pdf.length>2*1024*1024
        ?await createDrivePreviewTransfer({rootFolderId:currentSettings.driveRootFolderId||'',bytes:pdf,fileName:'PREVIA_ATA.pdf',mimeType:'application/pdf',processId:p.id,requesterBinding:sessionUploadBinding(getPortalIdentity(req)!),expiresInSeconds:600}):null;
      if(!download&&pdf.length>2*1024*1024)throw new Error('O transporte privado é necessário para esta prévia.');
      const live=processesStore.find(item=>item.id===p.id);
      if(!live||JSON.stringify(binding)!==JSON.stringify(evaluationPreviewBinding(live,actor,evaluation,provider)))return res.status(409).json({error:'Os dados ou o modelo mudaram durante a prévia. Visualize a Ata novamente.'});
      const source=rendered?.previewFileId?{fileId:rendered.previewFileId,version,verificationCode}:undefined;
      const token=evaluationPreviewToken(evaluationPreviewSecret(),binding,Date.now()+30*60_000,source);
      res.setHeader('Cache-Control','private, no-store');return res.json({previewToken:token,documentText:documentText||evaluation.documentText,documentLayout:rendered?.documentLayout,downloadUrl:download?.url,contentBase64:download?undefined:pdf.toString('base64')});
    }catch(error){return res.status(error instanceof EvaluationError?error.status:422).json({error:error instanceof Error?error.message:'Não foi possível gerar a prévia da Ata.'});}
  });

  // POST /api/processes/:id/evaluation (Orientador submits evaluation)
  app.post('/api/processes/:id/evaluation', requireAuthenticated, async (req, res) => {
    const actorEmail=getPortalIdentity(req)!.email;
    const procIndex = processesStore.findIndex((p) => p.id === req.params.id);

    if (procIndex === -1) {
      return res.status(404).json({ error: 'Processo não encontrado.' });
    }

    const proc = processesStore[procIndex];
    if(!canAccessProcess(actorEmail,proc.id))return res.status(404).json({error:'Processo não encontrado.'});
    const activeRoles=getActiveProcessRoles(actorEmail,proc.id);
    if(!activeRoles.includes('ADVISOR'))return res.status(403).json({error:'Somente o orientador responsável pode registrar o conceito e a ata.'});
    const input=req.body||{};
    const submissionSha256=typeof input.previewToken==='string'
      ?createHash('sha256').update(JSON.stringify([
        input.previewToken,input.dataConfirmed,input.expectedDataRevision,input.expectedSchemaRevision,input.signatureProvider,
        input.expectedModelFingerprint,input.resultadoCode,input.parecer,input.answers,input.documentText,input.correctedDocumentText,
      ])).digest('hex'):undefined;
    if(proc.avaliacao.status==='CONCLUIDO'&&submissionSha256&&proc.avaliacao.submissionSha256===submissionSha256
      &&normalizeEmail(proc.avaliacao.submittedBy||'')===normalizeEmail(actorEmail)){
      return res.json({...proc,documents:processDocumentsFor(proc,actorEmail)});
    }
    if(proc.avaliacao.status==='CONCLUIDO'||signatureJobsStore.some(job=>job.processId===proc.id&&job.documentType==='ATA'&&job.sourceDataRevision===proc.dataRevision&&job.status!=='CANCELED'))return res.status(409).json({error:'Conceito e ata já registrados. Somente uma reabertura formal pode criar nova versão.',code:'EVALUATION_ALREADY_SUBMITTED'});
    if(!isConceptRegistrationReleased(proc))return res.status(409).json({error:'O registro de conceito e ata ainda não está disponível.',code:'CONCEPT_STAGE_NOT_RELEASED'});
    const signatureProvider=req.body?.signatureProvider||'ASTEN';
    if(!['ASTEN','GOV_BR'].includes(signatureProvider))return res.status(400).json({error:'Provedor de assinatura inválido.'});
    if(req.body?.documentText!==undefined&&ataModelFingerprint(currentSettings.documentModels?.ATA)&&req.body?.expectedModelFingerprint!==ataModelFingerprint(currentSettings.documentModels?.ATA))return res.status(409).json({error:'O modelo da ata mudou. Atualize a página antes de usar um texto revisado.',code:'ATA_MODEL_CHANGED'});
    let evaluation: ReturnType<typeof acceptEvaluation>;
    try { evaluation = acceptEvaluation(proc, req.body, currentSettings, actorEmail); }
    catch (error) {
      if (error instanceof EvaluationError) return res.status(error.status).json({ error: error.message, code: error.code });
      throw error;
    }
    let binding:ReturnType<typeof evaluationPreviewBinding>;
    try{binding=evaluationPreviewBinding(proc,actorEmail,evaluation,signatureProvider);}catch(error){return res.status(409).json({error:error instanceof Error?error.message:'Confira os signatários da ata.',code:'SIGNATURE_POLICY_INVALID'});}
    const reviewed=readEvaluationPreview(req.body?.previewToken,evaluationPreviewSecret(),binding);
    if(!reviewed||(!reviewed.source&&!localDocumentModelsEnabled()))return res.status(409).json({error:'Visualize a ata atualizada antes de confirmar o registro.',code:'ATA_PREVIEW_REQUIRED'});
    const missing=missingDocumentModels(['ATA']);if(missing.length)return res.status(409).json({error:'O Master precisa cadastrar o modelo da ata antes do registro.',code:'DOCUMENT_MODEL_REQUIRED',missingModels:missing});
    const correction=req.body?.correctedDocumentText;
    if(correction!==undefined){
      try{evaluation=acceptEvaluation(proc,{...req.body,documentText:correction},currentSettings,actorEmail);}
      catch(error){if(error instanceof EvaluationError)return res.status(error.status).json({error:error.message,code:error.code});throw error;}
    }
    if(evaluationSaveInFlight.has(proc.id))return res.status(409).json({error:'A ata já está sendo salva. Aguarde a confirmação.'});
    evaluationSaveInFlight.add(proc.id);
    try{
      const nowISO = new Date().toISOString();
      const before = JSON.parse(JSON.stringify(proc));

      const updated: ProcessData = {
        ...proc,
        signatureProviderPreferences:{...proc.signatureProviderPreferences,ATA:signatureProvider},
        etapaAtual: 'ASSINATURA',
        status: 'AGUARDANDO_ASSINATURA',
        avaliacao: {
          status: 'CONCLUIDO',
          ...evaluation,
          submissionSha256,
          documentRevision: proc.dataRevision + 1,
          submittedBy: actorEmail,
          submittedAt: nowISO,
          updatedAt: nowISO
        },
        dataRevision: proc.dataRevision + 1,
        updatedAt: nowISO
      };

      if(reviewed.source){
        let accessToken:string|undefined;
        let savedFileId:string|undefined;
        try{
          const folder=await ensureWorkflowProcessFolder(updated);
          accessToken=folder.accessToken;
          await verifyPrivateDriveFolder(accessToken,folder.folderId);
          const fileName=buildPortalDriveFileName({
            protocol:proc.protocolo,title:proc.titulo,studentNames:orderedAuthors(proc).map(author=>author.nome),
            documentType:'ATA',version:reviewed.source.version,lifecycle:'GERADO',
          });
          savedFileId=await saveReviewedAta({
            accessToken,previewFileId:reviewed.source.fileId,folderId:folder.folderId,processId:proc.id,fileName,
            verificationCode:reviewed.source.verificationCode,text:correction===undefined?undefined:evaluation.documentText,
          });
          const live=processesStore[procIndex];
          if(live!==proc||JSON.stringify(binding)!==JSON.stringify(evaluationPreviewBinding(live,actorEmail,acceptEvaluation(proc,req.body,currentSettings,actorEmail),signatureProvider))||!getActiveProcessRoles(actorEmail,proc.id).includes('ADVISOR')){
            await discardAtaCopy(accessToken,savedFileId);
            return res.status(409).json({error:'Os dados ou o acesso mudaram durante a correção. Confira a ata atualizada.'});
          }
          updated.avaliacao.reviewedAta={...reviewed.source,fileId:savedFileId,signaturePolicySnapshot:captureSignaturePolicySnapshot(updated,'ATA',currentSettings)};
          delete updated.avaliacao.documentText;
        }catch(error){
          if(savedFileId&&accessToken)await discardAtaCopy(accessToken,savedFileId).catch(()=>undefined);
          return res.status(422).json({error:error instanceof Error?error.message:'Não foi possível salvar a ata formatada no Drive.'});
        }
      }
      queueAutomaticAsten(updated,'ATA');
      processesStore[procIndex] = updated;

      auditLogsStore.push({
        id: `log-${Date.now()}`,
        processId: proc.id,
        actorEmail,
        actorRoles: [...getUserRolesForEmail(actorEmail).globalRoles, ...activeRoles],
        action: 'CONCLUSAO_AVALIACAO',
        entityType: 'avaliacao',
        entityId: proc.id,
        before,
        after: updated.avaliacao,
        timestamp: nowISO
      });

      evaluationDraftsStore.delete(proc.id);
      try{await persistPortalStateDurably();}
      catch(error){
        // A definite revision conflict means this copy did not become the registered ata.
        if(error instanceof Error&&error.message.includes('Conflito de concorrência')&&updated.avaliacao.reviewedAta){
          const token=await getGoogleWorkspaceAccessToken().catch(()=>undefined);
          if(token)await discardAtaCopy(token,updated.avaliacao.reviewedAta.fileId).catch(()=>undefined);
          return res.status(409).json({error:'Os dados mudaram durante o salvamento. Atualize e confira a ata.'});
        }
        throw error;
      }
      if(updated.astenSignatureIntent?.documentType==='ATA'){
        const settle=beginRuntimeRequestTask(req);
        const followup=new Promise<void>(resolve=>setImmediate(resolve)).then(async()=>{
          if(!processesStore.includes(updated))return;
          try{
            const run=await executeConfiguredWorkflowEvent(updated,'EVALUATION_SUBMITTED',actorEmail);
            if(!run||run.status==='COMPLETED')await executeAutomaticAsten(updated,'ATA',actorEmail);
          }finally{
            const intent=updated.astenSignatureIntent;
            if(intent?.documentType==='ATA'&&processesStore.includes(updated)){
              intent.attemptedAt=new Date().toISOString();
              await persistPortalStateDurably();
            }
          }
        }).catch(()=>{console.error('[Ata] Registro confirmado; envio Asten pendente.');}).finally(settle);
        if(process.env.VERCEL)waitUntil(followup);
        return res.status(202).json({...updated,documents:processDocumentsFor(updated,actorEmail)});
      }
      const evaluationRun=await executeConfiguredWorkflowEvent(updated,'EVALUATION_SUBMITTED',actorEmail).catch(()=>{
        console.error('[Ata] Registro confirmado; ações posteriores pendentes.');
        return undefined;
      });
      const result={...updated,documents:processDocumentsFor(updated,actorEmail)};
      if(!evaluationRun||evaluationRun.status!=='COMPLETED')return res.status(202).json({...result,workflowPending:true,workflowError:evaluationRun?.actions.find(action=>action.status==='FAILED')?.error||'Há ações pendentes após o registro da ata.'});
      res.json(result);
    }finally{evaluationSaveInFlight.delete(proc.id);}
  });

  app.post('/api/processes/:id/files/:kind',requireAuthenticated,async(req,res)=>{
    const identity=getPortalIdentity(req)!;
    const index=processesStore.findIndex(process=>process.id===req.params.id);
    if(index<0)return res.status(404).json({error:'Processo não encontrado.'});
    const process=processesStore[index];
    if(!canAccessProcess(identity.email,process.id))return res.status(404).json({error:'Processo não encontrado.'});
    const roles=getActiveProcessRoles(identity.email,process.id);
    if(!roles.includes('STUDENT'))return res.status(403).json({error:'Somente um dos autores pode anexar os arquivos finais.'});
    if(process.avaliacao.status!=='CONCLUIDO')return res.status(409).json({error:'O conceito e a ata precisam ser registrados antes do envio dos arquivos finais.'});
    if(!ataArchived(process,signatureJobsStore))return res.status(409).json({error:'A entrega final será liberada após o recebimento, a validação e o arquivamento da ata assinada.',code:'ATA_SIGNATURE_REQUIRED'});
    if(process.acervo?.submittedAt||finalDocumentFilesLocked(process,signatureJobsStore))return res.status(409).json({error:'Os arquivos finais ficam bloqueados após a preparação do Termo ou da Declaração. Use o fluxo administrativo de nova versão.',code:'FINAL_FILES_LOCKED_BY_SIGNATURE'});
    const artifactType=req.params.kind==='trabalho-completo'?'TRABALHO_COMPLETO':req.params.kind==='resumo-expandido'?'RESUMO_EXPANDIDO':null;
    if(!artifactType)return res.status(404).json({error:'Tipo de arquivo não reconhecido.'});
    if(!currentSettings.driveRootFolderId&&!localReviewFilesEnabled())return res.status(409).json({error:'O Master ainda não concluiu a configuração da pasta raiz do Google Drive.'});
    try{
      const archive=async(file:{bytes:Buffer;fileName:string})=>{
        if(!file.fileName.toLowerCase().endsWith('.pdf')||!file.bytes.subarray(0,5).equals(Buffer.from('%PDF-')))throw new Error('Selecione um arquivo PDF válido.');
        const accessToken=await sourceFilesAccessToken();
        if(!process.driveFolderId){const folder=await sourceFilesFolder({accessToken,rootFolderId:currentSettings.driveRootFolderId!,protocol:process.protocolo,processId:process.id});process.driveFolderId=folder.id;process.driveFolderUrl=folder.webViewLink;process.driveSyncedAt=new Date().toISOString();}
        const sha256=createHash('sha256').update(file.bytes).digest('hex');
        const previousId=artifactType==='TRABALHO_COMPLETO'?process.acervo?.trabalhoCompletoFileId:process.acervo?.resumoExpandidoFileId;
        const previousHash=artifactType==='TRABALHO_COMPLETO'?process.acervo?.trabalhoCompletoSha256:process.acervo?.resumoExpandidoSha256;
        const previousVersion=artifactType==='TRABALHO_COMPLETO'?process.acervo?.trabalhoCompletoVersion:process.acervo?.resumoExpandidoVersion;
        const localUrl=`/api/processes/${process.id}/files/${req.params.kind}/download`;
        if(previousId&&previousHash===sha256)return{status:200,body:{id:previousId,fileName:artifactType==='TRABALHO_COMPLETO'?process.acervo?.trabalhoCompletoFileName:process.acervo?.resumoExpandidoFileName,downloadUrl:localUrl,sha256,version:previousVersion||1,reused:true}};
        const version=Math.max(1,Number(previousVersion||0)+1);
        const canonicalName=buildProcessArchiveFileName({protocol:process.protocolo,studentNames:[process.aluno1.nome,process.aluno2?.nome||''].filter(Boolean),title:process.titulo,artifactLabel:artifactType,version});
        const uploaded=await uploadSourceFile({accessToken,processFolderId:process.driveFolderId!,processId:process.id,artifactType,fileName:canonicalName,version,previousFileId:previousId,pdf:file.bytes,sha256});
        const replacingPrevious=Boolean(previousId&&previousId!==String(uploaded.id));
        const previousPublicFileId=artifactType==='TRABALHO_COMPLETO'?process.acervo?.publicFullWorkFileId:process.acervo?.publicExpandedAbstractFileId;
        if(replacingPrevious&&previousPublicFileId)await withdrawDriveFilePublicAccess(accessToken,previousPublicFileId);
        const now=new Date().toISOString();const nextAcervo={...(process.acervo||{})};
        if(artifactType==='TRABALHO_COMPLETO'){nextAcervo.trabalhoCompletoFileId=String(uploaded.id);nextAcervo.trabalhoCompletoFileName=String(uploaded.name||canonicalName);nextAcervo.trabalhoCompletoFileUrl=localUrl;nextAcervo.trabalhoCompletoSha256=sha256;nextAcervo.trabalhoCompletoVersion=version;if(replacingPrevious){nextAcervo.publicFullWorkFileId=undefined;nextAcervo.publicFullWorkFileUrl=undefined;}}
        else{nextAcervo.resumoExpandidoFileId=String(uploaded.id);nextAcervo.resumoExpandidoFileName=String(uploaded.name||canonicalName);nextAcervo.resumoExpandidoFileUrl=localUrl;nextAcervo.resumoExpandidoSha256=sha256;nextAcervo.resumoExpandidoVersion=version;if(replacingPrevious){nextAcervo.publicExpandedAbstractFileId=undefined;nextAcervo.publicExpandedAbstractFileUrl=undefined;}}
        if(replacingPrevious){nextAcervo.authorizationConfirmedAt=undefined;nextAcervo.publicationSyncedAt=undefined;nextAcervo.publicationState=publicationRequested(process)?'PENDING_SYNC':'NOT_REQUESTED';}
        processesStore[index]={...process,acervo:nextAcervo,dataRevision:process.dataRevision+1,updatedAt:now};
        auditLogsStore.push({id:`log-${Date.now()}`,processId:process.id,actorEmail:identity.email,actorRoles:[...getUserRolesForEmail(identity.email).globalRoles,...roles],action:replacingPrevious?'VERSAO_ARQUIVO_SUBSTITUIDA':'UPLOAD_PDF_DRIVE',entityType:'process_file',entityId:String(uploaded.id),before:previousId?{driveFileId:previousId,version:previousVersion||1,lifecycle:'SUPERSEDED',publicCopyFileId:previousPublicFileId||undefined}:undefined,after:{artifactType,fileName:String(uploaded.name||canonicalName),sha256,version,lifecycle:'CURRENT',publicationAuthorizationInvalidated:replacingPrevious,publicCopyAccessRemoved:Boolean(replacingPrevious&&previousPublicFileId)},timestamp:now});
        await persistPortalStateDurably();
        return{status:201,body:{id:String(uploaded.id),fileName:String(uploaded.name||canonicalName),downloadUrl:localUrl,sha256,version}};
      };
      const uploadId=String(req.body?.stagedUploadId||'').trim();
      const result=uploadId
        ?await withDriveStagedUpload({uploadId,purpose:artifactType==='TRABALHO_COMPLETO'?'PROCESS_FULL_WORK':'PROCESS_EXPANDED_ABSTRACT',requesterBinding:sessionUploadBinding(identity),processId:process.id},archive)
        :await archive({bytes:readLegacyDevelopmentUpload({contentBase64:req.body?.contentBase64,fileName:String(req.body?.fileName||''),expected:'PDF'}),fileName:String(req.body?.fileName||'')});
      res.status(result.status).json(result.body);
    }catch(error){const message=error instanceof Error?error.message:'Falha ao armazenar o PDF no Google Drive.';const clientError=/arquivo|upload|checksum|MIME|sessão|processo|finalidade|fallback/i.test(message);res.status(clientError?400:502).json({error:message});}
  });

  app.get('/api/public/processes/:id/files/:kind/download',async(req,res)=>{
    if(!allowPublicDownload(req.ip||''))return res.status(429).json({error:'Limite temporário de downloads atingido. Tente novamente em instantes.'});
    const process=processesStore.find(item=>item.id===req.params.id||item.protocolo===req.params.id);
    const isFull=req.params.kind==='trabalho-completo';
    const isExpanded=req.params.kind==='resumo-expandido';
    const allowed=publicFileAuthorized(process,signatureJobsStore,req.params.kind);
    if(!process||!allowed)return res.status(404).json({error:'Arquivo não encontrado.'});
    const fileId=isFull?process.acervo?.trabalhoCompletoFileId:isExpanded?process.acervo?.resumoExpandidoFileId:'';
    if(!fileId)return res.status(404).json({error:'Arquivo não encontrado.'});
    try{const accessToken=await sourceFilesAccessToken();const artifactType=isFull?'TRABALHO_COMPLETO':'RESUMO_EXPANDIDO';const file=await downloadSourceFile(accessToken,fileId,{processId:process.id,artifactType});const authorizedHash=isFull?process.acervo?.trabalhoCompletoSha256:process.acervo?.resumoExpandidoSha256;if(createHash('sha256').update(file.pdf).digest('hex')!==String(authorizedHash||'').toLowerCase())return res.status(409).json({error:'O arquivo mudou desde a autorização de publicação. A publicação precisa ser revisada.',code:'PUBLICATION_FILE_CHANGED'});const event={id:`log-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,processId:process.id,actorEmail:'public@portal.local',actorRoles:[] as UserRole[],action:'DOWNLOAD_PUBLICO_AUTORIZADO',entityType:'process_file',entityId:artifactType,after:{protocol:process.protocolo,kind:req.params.kind},timestamp:new Date().toISOString()};auditLogsStore.push(event);void appendSupabaseAuditEvent({externalId:event.id,occurredAt:event.timestamp,processCode:process.protocolo,eventType:event.action,entityType:event.entityType,entityId:event.entityId,details:event.after}).catch(error=>console.warn('[Audit] Falha no registro leve do download público:',error));await deliverPortalDownload({res,processId:process.id,bytes:file.pdf,fileName:file.fileName,mimeType:'application/pdf',requesterBinding:`public:${req.ip||'unknown'}:${process.id}:${artifactType}`,cacheControl:'no-store, max-age=0'});}catch(error){res.status(502).json({error:error instanceof Error?error.message:'Falha ao recuperar o PDF.'});}
  });

  app.get('/api/processes/:id/files/:kind/download',requireAuthenticated,async(req,res)=>{
    const identity=getPortalIdentity(req)!;
    const process=processesStore.find(item=>item.id===req.params.id);
    if(!process||!canAccessProcess(identity.email,process.id))return res.status(404).json({error:'Arquivo não encontrado.'});
    const fileId=req.params.kind==='trabalho-completo'?process.acervo?.trabalhoCompletoFileId:req.params.kind==='resumo-expandido'?process.acervo?.resumoExpandidoFileId:'';
    if(!fileId)return res.status(404).json({error:'Arquivo não encontrado.'});
    try{const accessToken=await sourceFilesAccessToken();const artifactType=req.params.kind==='trabalho-completo'?'TRABALHO_COMPLETO':'RESUMO_EXPANDIDO';const file=await downloadSourceFile(accessToken,fileId,{processId:process.id,artifactType});await deliverPortalDownload({res,processId:process.id,bytes:file.pdf,fileName:file.fileName,mimeType:'application/pdf',requesterBinding:sessionUploadBinding(identity),cacheControl:'private, no-store'});}catch(error){res.status(502).json({error:error instanceof Error?error.message:'Falha ao recuperar o PDF.'});}
  });

  const repositoryReopenLocks=new Set<string>();
  app.post('/api/processes/:id/repository/reopen',requireAuthenticated,async(req,res)=>{
    const identity=getPortalIdentity(req)!;
    const process=processesStore.find(item=>item.id===req.params.id);
    if(!process||!canAccessProcess(identity.email,process.id))return res.status(404).json({error:'Processo não encontrado.'});
    if(!getActiveProcessRoles(identity.email,process.id).includes('STUDENT'))return res.status(403).json({error:'A entrega é editada por um dos autores.'});
    if(process.status==='CONCLUIDO'||documentSignatureCompleted(signatureJobsStore,process.id,'DECLARACAO'))return res.status(409).json({error:'Os documentos finais já foram assinados. A entrega está encerrada.',code:'REPOSITORY_CLOSED'});
    if(!process.acervo?.submittedAt)return res.json(process);
    const reason=typeof req.body?.reason==='string'?req.body.reason.trim():'';
    if(reason.length<10||reason.length>1000)return res.status(400).json({error:'Informe o motivo da edição com 10 a 1.000 caracteres.',code:'REOPEN_REASON_REQUIRED'});
    if(repositoryReopenLocks.has(process.id))return res.status(409).json({error:'A entrega está sendo reaberta. Aguarde.'});
    repositoryReopenLocks.add(process.id);
    const previousProcess=structuredClone(process);
    const previousJobs=signatureJobsStore.filter(job=>job.processId===process.id).map(job=>structuredClone(job));
    let reopenAuditId:string|undefined,reopenRevision:number|undefined;
    try{
      const jobs=signatureJobsStore.filter(job=>job.processId===process.id&&job.documentType!=='ATA'&&job.sourceDataRevision===process.dataRevision&&job.status!=='CANCELED');
      for(const job of jobs){
        if(job.status==='SENDING')throw new Error('Aguarde o envio atual da assinatura antes de editar a entrega.');
        if(job.provider==='ASTEN'&&job.providerEnvelopeId&&!['SIGNED','ARCHIVED','DRIVE_SYNC_PENDING'].includes(job.status)){
          const connection=await getPersistentAstenConnection();if(!connection)throw new Error('Conecte a Asten para cancelar a solicitação anterior antes de editar.');
          const prior=await callAsten('getDadosEnvelope',{idEnvelope:job.providerEnvelopeId,getLobs:'N'},connection.token);
          const observed=inferAstenJobStatus(prior,job.status,job.providerEnvelopeId);
          if(['SIGNED','ARCHIVED','DRIVE_SYNC_PENDING'].includes(observed))throw new Error('O documento foi assinado na Asten. Aguarde seu arquivamento antes de editar a entrega.');
          if(observed!=='CANCELED'){
            await callAsten('cancelarEnvelope',{idEnvelope:job.providerEnvelopeId,motivo:reason,anularAssinaturas:'N'},connection.token);
            const result=await callAsten('getDadosEnvelope',{idEnvelope:job.providerEnvelopeId,getLobs:'N'},connection.token);
            if(inferAstenJobStatus(result,job.status,job.providerEnvelopeId)!=='CANCELED')throw new Error('O cancelamento da solicitação anterior ainda não foi confirmado pela Asten. Tente novamente após a atualização.');
          }
        }
        if(!['SIGNED','ARCHIVED','DRIVE_SYNC_PENDING'].includes(job.status)){job.status='CANCELED';job.updatedAt=new Date().toISOString();job.lastError='Substituído pela edição da entrega final.';}
      }
      // Completed files remain in the history; a new revision needs new signatures.
      const before={...process.acervo};
      process.acervo={...process.acervo,firstSubmittedAt:process.acervo.firstSubmittedAt||process.acervo.submittedAt,submittedAt:undefined,submittedBy:undefined,authorizationConfirmedAt:undefined,publicationRequestedAt:undefined,publishFullWork:false,publishExpandedAbstract:false,isPublic:false};
      process.astenSignatureIntent=undefined;
      process.dataRevision++;process.status='AGUARDANDO_DADOS_FINAIS';process.etapaAtual='REPOSITORIO';process.updatedAt=new Date().toISOString();
      reopenRevision=process.dataRevision;reopenAuditId=`log-${Date.now()}-repository-reopen`;
      auditLogsStore.push({id:reopenAuditId,processId:process.id,actorEmail:identity.email,actorRoles:getUserRolesForEmail(identity.email).globalRoles,action:'REABERTURA_ENTREGA_FINAL',entityType:'acervo',entityId:process.id,before,after:{...process.acervo,reopenReason:reason},timestamp:process.updatedAt});
      await persistPortalStateDurably();res.json(process);
    }catch(error){
      const durable=getSupabaseRuntimeStatus().durablePersistenceReady;
      if(durable){
        try{
          const remote=await loadPortalRuntimeState<PersistedPortalState>();
          if(remote){
            applyPersistedState(remote);
            // The failed write was observed and canonical state was reloaded.
            // Do not let the response barrier replay its old rejection afterward.
            remotePersistenceQueue=settlePreviousRuntimeWrites(remotePersistenceQueue);
            const current=processesStore.find(item=>item.id===process.id);
            const recorded=Boolean(reopenAuditId&&remote.auditLogs?.some(log=>log.id===reopenAuditId&&log.processId===process.id&&log.actorEmail===identity.email&&log.action==='REABERTURA_ENTREGA_FINAL'));
            if(recorded&&current?.dataRevision===reopenRevision&&current.status==='AGUARDANDO_DADOS_FINAIS'&&current.etapaAtual==='REPOSITORIO'&&!current.acervo?.submittedAt&&!current.acervo?.authorizationConfirmedAt&&!current.acervo?.publishFullWork&&!current.acervo?.publishExpandedAbstract&&!current.astenSignatureIntent&&canAccessProcess(identity.email,current.id)&&getActiveProcessRoles(identity.email,current.id).includes('STUDENT'))return res.json(current);
          }
        }catch{/* An unconfirmed write stays failed; never repeat a commit or use defaults. */}
      }else{
        const index=processesStore.findIndex(item=>item.id===process.id);if(index>=0)processesStore[index]=previousProcess;
        for(const previous of previousJobs){const index=signatureJobsStore.findIndex(job=>job.id===previous.id);if(index>=0)signatureJobsStore[index]=previous;}
        if(reopenAuditId)auditLogsStore=auditLogsStore.filter(log=>log.id!==reopenAuditId);
      }
      res.status(reopenAuditId?503:409).json({error:reopenAuditId?'Não foi possível confirmar a reabertura. Atualize o TCC antes de tentar novamente.':error instanceof Error?error.message:'Não foi possível reabrir a entrega.',...(reopenAuditId?{code:'REPOSITORY_REOPEN_NOT_CONFIRMED'}:{})});
    }
    finally{repositoryReopenLocks.delete(process.id);}
  });

  app.post('/api/processes/:id/final-data',requireAuthenticated,async(req,res)=>{
    const identity=getPortalIdentity(req)!;
    const index=processesStore.findIndex(process=>process.id===req.params.id);
    if(index<0)return res.status(404).json({error:'Processo não encontrado.'});
    const process=processesStore[index];
    if(!canAccessProcess(identity.email,process.id))return res.status(404).json({error:'Processo não encontrado.'});
    const finalDataRoles=getActiveProcessRoles(identity.email,process.id);
    if(!finalDataRoles.includes('STUDENT'))return res.status(403).json({error:'Somente um dos autores pode confirmar a entrega final.'});
    if(process.avaliacao.status!=='CONCLUIDO')return res.status(409).json({error:'O conceito e a ata precisam ser registrados antes dos dados finais.'});
    if(!ataArchived(process,signatureJobsStore))return res.status(409).json({error:'Aguarde a ata assinada pelo orientador e pelos dois examinadores e arquivada no Drive.',code:'ATA_SIGNATURE_REQUIRED'});
    if(process.status==='CONCLUIDO'||process.acervo?.submittedAt||signatureJobsStore.some(job=>job.processId===process.id&&job.documentType!=='ATA'&&job.sourceDataRevision===process.dataRevision&&job.status!=='CANCELED'))return res.status(409).json({error:'Os dados finais ficam bloqueados após a criação do Termo ou da Declaração. Use o fluxo administrativo de retirada ou gere uma nova versão formal.',code:'FINAL_DATA_LOCKED_BY_SIGNATURE'});
    const rawKeywords:unknown=req.body?.palavrasChave;
    const palavrasChave=Array.isArray(rawKeywords)&&rawKeywords.every(value=>typeof value==='string')?rawKeywords.map(value=>value.trim()).filter(Boolean):[];
    const signatureProvider=req.body?.signatureProvider||'ASTEN';
    if(!['ASTEN','GOV_BR'].includes(signatureProvider))return res.status(400).json({error:'Provedor de assinatura inválido.'});
    const resumoSintese=typeof req.body?.resumoSintese==='string'?req.body.resumoSintese.trim():'';
    const workType=req.body?.workType??'MONOGRAFIA';
    if(!['MONOGRAFIA','ARTIGO','OUTRO'].includes(workType))return res.status(400).json({error:'Informe um tipo de trabalho válido.'});
    const trabalhoCompletoFileUrl=String(process.acervo?.trabalhoCompletoFileUrl||'').trim();
    const publishFullWork=req.body?.publishFullWork===true;
    const publishExpandedAbstract=req.body?.publishExpandedAbstract===true;
    const wantsPublication=publishFullWork||publishExpandedAbstract;
    const missing=missingDocumentModels(wantsPublication?['TERMO','DECLARACAO']:['DECLARACAO']);if(missing.length)return res.status(409).json({error:`O Master precisa cadastrar ${wantsPublication?'os modelos do termo e da declaração':'o modelo da declaração'} antes desta etapa.`,code:'DOCUMENT_MODEL_REQUIRED',missingModels:missing});
    if(palavrasChave.length!==5)return res.status(400).json({error:'Informe exatamente cinco palavras-chave.'});
    if(!resumoSintese||resumoSintese.length>2000||resumoSintese.split(/\n\s*\n/).filter(part=>part.trim()).length>3)return res.status(400).json({error:'Informe o resumo do TCC em até três parágrafos e 2.000 caracteres (aproximadamente 120 palavras).'});
    if(!trabalhoCompletoFileUrl||(process.avaliacao.documentRevision!==undefined&&!process.acervo?.trabalhoCompletoFileId))return res.status(400).json({error:'Anexe o PDF do trabalho de conclusão de curso.'});
    if(publishExpandedAbstract&&!process.acervo?.resumoExpandidoFileId)return res.status(400).json({error:'Anexe o resumo expandido antes de autorizar sua publicação.'});
    const now=new Date().toISOString();
    const updated:ProcessData={...process,signatureProviderPreferences:{...process.signatureProviderPreferences,TERMO:signatureProvider},etapaAtual:'ASSINATURA',status:'AGUARDANDO_ASSINATURA',acervo:{...process.acervo,palavrasChave,resumoSintese,trabalhoCompletoFileUrl,publishFullWork,publishExpandedAbstract,workType,isPublic:publishFullWork,authorizationConfirmedAt:wantsPublication?now:undefined,publicationRequestedAt:wantsPublication?now:undefined,publicationWithdrawnAt:undefined,publicationWithdrawnBy:undefined,publicationWithdrawalReason:undefined,firstSubmittedAt:process.acervo?.firstSubmittedAt||now,submittedAt:now,submittedBy:identity.email},dataRevision:process.dataRevision+1,updatedAt:now};
    if(wantsPublication)queueAutomaticAsten(updated,'TERMO');
    else if(declarationReady(updated,signatureJobsStore))queueAutomaticAsten(updated,'DECLARACAO');
    processesStore[index]=updated;
    auditLogsStore.push({id:`log-${Date.now()}`,processId:process.id,actorEmail:identity.email,actorRoles:getUserRolesForEmail(identity.email).memberships.flatMap(m=>m.roles),action:'CONCLUSAO_DADOS_REPOSITORIO',entityType:'acervo',entityId:process.id,before:process.acervo,after:updated.acervo,timestamp:now});
    await persistPortalStateDurably();
    const submittedIntent=updated.astenSignatureIntent;
    if(submittedIntent&&(submittedIntent.documentType==='TERMO'||submittedIntent.documentType==='DECLARACAO')){
      const submittedRevision=updated.dataRevision,submittedAt=updated.acervo?.submittedAt;
      const stillCurrent=()=>processesStore.includes(updated)&&updated.dataRevision===submittedRevision&&updated.acervo?.submittedAt===submittedAt&&Boolean(submittedAt);
      const settle=beginRuntimeRequestTask(req);
      const followup=new Promise<void>(resolve=>setImmediate(resolve)).then(async()=>{
        if(!stillCurrent()||updated.astenSignatureIntent!==submittedIntent)return;
        try{
          const repositoryRun=await executeConfiguredWorkflowEvent(updated,'REPOSITORY_SUBMITTED',identity.email);
          if(!stillCurrent())return;
          const declarationRun=declarationReady(updated,signatureJobsStore)?await executeConfiguredWorkflowEvent(updated,'PUBLICATION_CLEARED',identity.email):undefined;
          if(!stillCurrent())return;
          const intent=updated.astenSignatureIntent;
          const signatureRun=intent?.documentType==='TERMO'?repositoryRun:declarationRun;
          if(intent===submittedIntent&&(!signatureRun||signatureRun.status==='COMPLETED')){
            await executeAutomaticAsten(updated,intent.documentType,identity.email);
            if(!stillCurrent())return;
          }else if(intent===submittedIntent&&signatureRun&&signatureRun.status!=='COMPLETED'){
            Object.assign(submittedIntent,safeRepositorySignatureError(undefined,true));
          }
          updateProcessCompletion(updated.id);
          if(updated.status==='CONCLUIDO')await executeConfiguredWorkflowEvent(updated,'PROCESS_COMPLETED',identity.email);
        }catch(error){
          if(stillCurrent()&&updated.astenSignatureIntent===submittedIntent)Object.assign(submittedIntent,safeRepositorySignatureError(error));
        }finally{
          if(stillCurrent()){
            if(updated.astenSignatureIntent===submittedIntent)submittedIntent.attemptedAt=new Date().toISOString();
            await persistPortalStateDurably();
          }
        }
      }).catch(()=>{console.error('[Repositório] Entrega confirmada; ações posteriores pendentes.');}).finally(settle);
      if(globalThis.process?.env?.VERCEL)waitUntil(followup);
      return res.status(202).json({...updated});
    }
    const repositoryRun=await executeConfiguredWorkflowEvent(updated,'REPOSITORY_SUBMITTED',identity.email);
    const declarationRun=declarationReady(updated,signatureJobsStore)?await executeConfiguredWorkflowEvent(updated,'PUBLICATION_CLEARED',identity.email):undefined;
    const intent=updated.astenSignatureIntent;
    const signatureRun=intent?.documentType==='TERMO'?repositoryRun:declarationRun;
    let signatureError:string|undefined;
    if(intent&&(!signatureRun||signatureRun.status==='COMPLETED')){
      try{await executeAutomaticAsten(updated,intent.documentType,identity.email);}
      catch{signatureError='A entrega foi registrada e o envio pelo ASTEN aguarda nova tentativa.';}
    }
    updateProcessCompletion(updated.id);
    if(updated.status==='CONCLUIDO')await executeConfiguredWorkflowEvent(updated,'PROCESS_COMPLETED',identity.email);
    await persistPortalStateDurably();
    if(signatureError||!repositoryRun||repositoryRun.status!=='COMPLETED'||(declarationRun&&declarationRun.status!=='COMPLETED')){
      const workflowError=declarationRun?.actions.find(action=>action.status==='FAILED')?.error||repositoryRun?.actions.find(action=>action.status==='FAILED')?.error||signatureError||'A entrega aguarda a conclusão das ações configuradas.';
      return res.status(202).json({...updated,workflowPending:true,workflowError});
    }
    res.json(updated);
  });

  app.post('/api/admin/processes/:id/publication/withdraw',requireAuthenticated,requireAdministrator,async(req,res)=>{
    const identity=getPortalIdentity(req)!;
    const index=processesStore.findIndex(process=>process.id===req.params.id);
    if(index<0)return res.status(404).json({error:'Processo não encontrado.'});
    const reason=String(req.body?.reason||'').trim();
    if(reason.length<10)return res.status(400).json({error:'Informe o motivo da retirada com pelo menos 10 caracteres.'});
    const process=processesStore[index];
    if(!publicationRequested(process))return res.status(409).json({error:'Este TCC não possui publicação ativa.'});
    const now=new Date().toISOString();
    const before={publishFullWork:process.acervo?.publishFullWork,publishExpandedAbstract:process.acervo?.publishExpandedAbstract,publicFullWorkFileId:process.acervo?.publicFullWorkFileId,publicExpandedAbstractFileId:process.acervo?.publicExpandedAbstractFileId,trabalhoCompletoVersion:process.acervo?.trabalhoCompletoVersion,trabalhoCompletoSha256:process.acervo?.trabalhoCompletoSha256,resumoExpandidoVersion:process.acervo?.resumoExpandidoVersion,resumoExpandidoSha256:process.acervo?.resumoExpandidoSha256};
    try{const accessToken=await getGoogleWorkspaceAccessToken();if(process.acervo?.publicFullWorkFileId)await withdrawDriveFilePublicAccess(accessToken,process.acervo.publicFullWorkFileId);if(process.acervo?.publicExpandedAbstractFileId)await withdrawDriveFilePublicAccess(accessToken,process.acervo.publicExpandedAbstractFileId);}catch(error){return res.status(502).json({error:error instanceof Error?error.message:'Não foi possível remover o acesso público no Drive.'});}
    const updated:ProcessData={...process,acervo:{...process.acervo,publishFullWork:false,publishExpandedAbstract:false,isPublic:false,publicationState:'WITHDRAWN',publicationWithdrawnAt:now,publicationWithdrawnBy:identity.email,publicationWithdrawalReason:reason},dataRevision:process.dataRevision+1,updatedAt:now};
    processesStore[index]=updated;
    auditLogsStore.push({id:`log-${Date.now()}`,processId:process.id,actorEmail:identity.email,actorRoles:getUserRolesForEmail(identity.email).globalRoles,action:'RETIRADA_PUBLICACAO_REPOSITORIO',entityType:'publication',entityId:process.id,before,after:{reason,withdrawnAt:now},timestamp:now});
    persistPortalState();res.json({processId:process.id,withdrawnAt:now,public:false});
  });

  // POST /api/processes/:id/reopen (registered advisor or Master reopens evaluation)
  app.post('/api/processes/:id/reopen', requireAuthenticated, (req, res) => {
    const identity=getPortalIdentity(req)!;const actorEmail=identity.email;
    // Historical membership is retained for auditing, but never overrides revoked access.
    if(!canAccessProcess(actorEmail,String(req.params.id)))return res.status(404).json({error:'Processo não encontrado.'});
    const { globalRoles } = getUserRolesForEmail(actorEmail);

    const advisor=getActiveProcessRoles(actorEmail,String(req.params.id)).includes('ADVISOR');
    if(!globalRoles.includes('MASTER_ADMIN')&&!advisor)return res.status(403).json({error:'Somente o orientador responsável ou o Master pode reabrir o registro de conceito e ata.'});

    const procIndex = processesStore.findIndex((p) => p.id === req.params.id);
    if (procIndex === -1) {
      return res.status(404).json({ error: 'Processo não encontrado.' });
    }

    const proc = processesStore[procIndex];
    if(proc.acervo?.submittedAt||proc.acervo?.firstSubmittedAt||proc.status==='CONCLUIDO')return res.status(409).json({error:'A entrega final já foi registrada. O registro de conceito e ata permanece encerrado.',code:'EVALUATION_LOCKED_BY_REPOSITORY'});
    const reason=String(req.body?.reason||'').trim();
    if(reason.length<10)return res.status(400).json({error:'Informe o motivo da reabertura com pelo menos 10 caracteres.'});
    const jobs=signatureJobsStore.filter(job=>job.processId===proc.id&&job.status!=='CANCELED');
    if(jobs.some(job=>!['SIGNED','ARCHIVED','DRIVE_SYNC_PENDING'].includes(job.status)&&(job.providerEnvelopeId||['SENDING','SENT','PARTIALLY_SIGNED'].includes(job.status))))return res.status(409).json({error:'Há documento já encaminhado à Asten. A reabertura foi bloqueada para não invalidar um registro externo; reconcilie ou cancele formalmente o envelope antes.',code:'ACTIVE_EXTERNAL_SIGNATURE'});
    const before = JSON.parse(JSON.stringify(proc));
    const now=new Date().toISOString();
    for(const job of jobs.filter(item=>!['SIGNED','ARCHIVED','DRIVE_SYNC_PENDING'].includes(item.status))){job.status='CANCELED';job.lastError=`Invalidado pela reabertura administrativa: ${reason}`;job.updatedAt=now;}

    const updated: ProcessData = {
      ...proc,
      etapaAtual: 'AVALIACAO',
      status: 'EM_AVALIACAO',
      avaliacao: {
        ...proc.avaliacao,
        reviewedAta: undefined,
        submissionSha256: undefined,
        status: 'PENDENTE',
        documentRevision: proc.dataRevision + 1,
        updatedAt: now
      },
      acervo:{...proc.acervo,publishFullWork:false,publishExpandedAbstract:false,isPublic:false,authorizationConfirmedAt:undefined,publicationRequestedAt:undefined,submittedAt:undefined,submittedBy:undefined},
      dataRevision:proc.dataRevision+1,
      updatedAt: now
    };

    processesStore[procIndex] = updated;

    auditLogsStore.push({
      id: `log-${Date.now()}`,
      processId: proc.id,
      actorEmail,
      actorRoles: [...globalRoles,...getActiveProcessRoles(actorEmail,proc.id)],
      action: 'REABERTURA_AVALIACAO',
      entityType: 'processo',
      entityId: proc.id,
      before,
      after: {...updated,reopenReason:reason},
      timestamp: now
    });

    persistPortalState();res.json(updated);
  });

  const processDocumentsFor = (process:ProcessData,email:string) => {
    const roles=getActiveProcessRoles(email,process.id);
    const admin=hasFullAdministration(email);
    return generateDefaultDocuments(process,'participants').filter(doc=>admin||doc.visibleToRoles.some(role=>roles.includes(role)));
  };
  const processSignaturesFor = (processId:string,processAccess:boolean) => signatureJobsStore
    .filter(job=>visibleProcessSignatureEvidence(job)&&job.processId===processId&&(processAccess||job.documentType==='DECLARACAO'))
    .sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)).map(publicSignatureJob);
  const processVerificationsFor = (processId:string) => signatureJobsStore
    .filter(job=>job.processId===processId&&job.status==='ARCHIVED'&&job.verificationCode)
    .map(job=>({documentType:job.documentType,version:job.documentVersion,code:job.verificationCode,
      url:`/validar/${job.verificationCode}`,sha256:job.signedSha256,signedAt:job.completedAt}));
  const processAuditFor = (processId:string) => sanitizeProcessAudit(auditLogsStore
    .filter(log=>log.processId===processId||(log.entityId===processId&&log.entityType==='processo'))
    .sort((a,b)=>b.timestamp.localeCompare(a.timestamp))) as typeof auditLogsStore;

  // One authorization refresh and one runtime lease for the private detail.
  app.get('/api/processes/:id/detail',requireAuthenticated,(req,res)=>{
    res.setHeader('Cache-Control','private, no-store');
    const identity=getPortalIdentity(req)!;
    const process=findProcessByReference(req.params.id);
    if(!process||!canAccessProcess(identity.email,process.id))return res.status(404).json({error:'Processo não encontrado.'});
    res.json({
      process:processWithPendingAtaStage(process,signatureJobsStore),
      documents:processDocumentsFor(process,identity.email),
      signatures:processSignaturesFor(process.id,true),
      reservationReceipts:reservationReceipts(process).map(item=>item.summary),
      verifications:isPortalFeatureEnabled(currentSettings,'PUBLIC_AUTHENTICITY')?processVerificationsFor(process.id):[],
      auditLogs:processAuditFor(process.id),
    });
  });

  // GET /api/processes/:id/documents
  app.get('/api/processes/:id/documents', requireAuthenticated, (req, res) => {
    const proc = processesStore.find((p) => p.id === req.params.id);
    if (!proc) {
      return res.status(404).json({ error: 'Processo não encontrado.' });
    }

    const actorEmail=getPortalIdentity(req)!.email;
    if(!canAccessProcess(actorEmail,proc.id))return res.status(404).json({error:'Processo não encontrado.'});
    res.json(processDocumentsFor(proc,actorEmail));
  });

  app.get('/api/processes/:id/documents/:docId/download',requireAuthenticated,async(req,res)=>{
    const identity=getPortalIdentity(req)!;
    const process=processesStore.find(item=>item.id===req.params.id);
    if(!process||!canAccessSignatureDocument(identity.email,process,req.params.docId==='doc-declaracao'?'DECLARACAO':''))return res.status(404).json({error:'Documento não encontrado.'});
    const roles=getActiveProcessRoles(identity.email,process.id);
    const document=generateDefaultDocuments(process,'participants').find(doc=>doc.id===req.params.docId&&(hasFullAdministration(identity.email)||doc.visibleToRoles.some(role=>roles.includes(role))||(doc.type==='DECLARACAO'&&canAccessPresidencyDeclaration(identity.email,process))));
    if(!document||!['DISPONIVEL','ASSINADO'].includes(document.status))return res.status(404).json({error:'Documento não encontrado.'});
    let fileId='';let signatureJob:SignatureJob|undefined;
    if(document.type==='CONVITE')fileId=String(process.defesa.invitationDriveFileId||'');
    else{signatureJob=signatureJobsStore.find(job=>job.processId===process.id&&job.documentType===document.type&&job.documentVersion===document.currentVersion&&job.status==='ARCHIVED'&&job.driveSignedFileId);fileId=String(signatureJob?.driveSignedFileId||'');}
    if(!fileId)return res.status(404).json({error:'Documento não encontrado.'});
    if(signatureJob?.provider==='GOV_BR'&&fileId.startsWith('local_govbr_')){try{const pdf=await readGovbrPdf(signatureJob,fileId,String(signatureJob.signedSha256||''));await deliverPortalDownload({res,processId:process.id,bytes:pdf,fileName:signatureJob.govbrReview?.fileName||signatureJob.fileName,mimeType:'application/pdf',requesterBinding:sessionUploadBinding(identity),cacheControl:'private, no-store'});}catch{return res.status(409).json({error:'PDF de demonstração indisponível.'});}return;}
    try{const accessToken=await (localReviewFilesEnabled()&&fileId.startsWith('local_review_')?sourceFilesAccessToken():getGoogleWorkspaceAccessToken());const file=await downloadSourceFile(accessToken,fileId,{processId:process.id,artifactType:document.type,...(signatureJob?{signatureJobId:signatureJob.id}:{})});await deliverPortalDownload({res,processId:process.id,bytes:file.pdf,fileName:file.fileName,mimeType:'application/pdf',requesterBinding:sessionUploadBinding(identity),cacheControl:'private, no-store'});}catch(error){res.status(502).json({error:error instanceof Error?error.message:'Falha ao recuperar o documento.'});}
  });

  app.get('/api/processes/:id/signatures',requireAuthenticated,(req,res)=>{
    const identity=getPortalIdentity(req)!;
    const process=findProcessByReference(req.params.id);
    if(!process)return res.status(404).json({error:'Processo não encontrado.'});
    const processAccess=canAccessProcess(identity.email,process.id);
    if(!processAccess&&!canAccessPresidencyDeclaration(identity.email,process))return res.status(404).json({error:'Processo não encontrado.'});
    res.setHeader('Cache-Control','private, no-store');
    if(processAccess)scheduleRepositorySignatureRecovery(process,identity.email);
    scheduleCurrentAstenCheck(process,processAccess?['ATA','TERMO','DECLARACAO']:['DECLARACAO']);
    res.json(processSignaturesFor(process.id,processAccess));
  });

  app.get('/api/processes/:id/verifications',requireAuthenticated,requireFeature('PUBLIC_AUTHENTICITY'),(req,res)=>{const identity=getPortalIdentity(req)!;const process=processesStore.find(item=>item.id===req.params.id);if(!process||!canAccessProcess(identity.email,process.id))return res.status(404).json({error:'Trabalho não encontrado.'});res.json(processVerificationsFor(process.id));});
  app.get('/api/public/verification/:code',requireFeature('PUBLIC_AUTHENTICITY'),(req,res)=>{const code=String(req.params.code||'');const job=signatureJobsStore.find(item=>item.verificationCode===code&&item.status==='ARCHIVED');if(!job)return res.status(404).json({valid:false,status:'NOT_FOUND'});const process=processesStore.find(item=>item.id===job.processId);if(!process)return res.status(404).json({valid:false,status:'NOT_FOUND'});const profile=resolveInstallationProfile(currentSettings);res.setHeader('Cache-Control','public, max-age=300');res.json({valid:true,status:'VALID',institution:profile.institutionName,course:profile.courseName,protocol:process.protocolo,documentType:job.documentType,version:job.documentVersion,signedAt:job.provider==='GOV_BR'?(job.signedAt||null):job.completedAt,archivedAt:job.completedAt,signatureValidationMethod:job.provider==='GOV_BR'?job.govbrReview?.method:'ASTEN_API',reviewedAt:job.govbrReview?.approvedAt,sha256:job.signedSha256});});
  app.get('/api/public/verification/:code/qr.svg',requireFeature('PUBLIC_AUTHENTICITY'),async(req,res)=>{const code=String(req.params.code||'');const job=signatureJobsStore.find(item=>item.verificationCode===code&&item.status==='ARCHIVED');if(!job)return res.status(404).send('Código não encontrado.');const base=String(process.env.PORTAL_PUBLIC_URL||process.env.APP_URL||`${req.protocol}://${req.get('host')}`).replace(/\/$/,'');const svg=await QRCode.toString(`${base}/validar/${encodeURIComponent(code)}`,{type:'svg',errorCorrectionLevel:'M',margin:2,width:256,color:{dark:'#0f172a',light:'#ffffff'}});res.setHeader('Content-Type','image/svg+xml; charset=utf-8');res.setHeader('Cache-Control','public, max-age=86400');res.send(svg);});
  app.post('/api/public/verification/:code/check-file',requireFeature('PUBLIC_AUTHENTICITY'),(_req,res)=>res.status(410).json({error:'A conferência de autenticidade é feita no navegador, sem enviar o PDF. Atualize a página.',code:'LOCAL_VERIFICATION_REQUIRED'}));
  app.get('/api/admin/processes/:id/dossier',requireAuthenticated,requireAdministrator,requireFeature('INSTITUTIONAL_DOSSIER'),async(req,res)=>{const identity=getPortalIdentity(req)!;const process=processesStore.find(item=>item.id===req.params.id);if(!process)return res.status(404).json({error:'Trabalho não encontrado.'});try{const dossier=await createInstitutionalDossier(process,identity.email,req.query.types?String(req.query.types).split(',').filter(type=>['CONVITE','ATA','TERMO','DECLARACAO'].includes(type)):undefined);auditLogsStore.push({id:`log-${Date.now()}`,processId:process.id,actorEmail:identity.email,actorRoles:getUserRolesForEmail(identity.email).globalRoles,action:'GERACAO_DOSSIE_INSTITUCIONAL',entityType:'process_dossier',entityId:dossier.manifestHash.slice(0,24),after:{manifestHash:dossier.manifestHash,included:dossier.included,missing:dossier.missing.length},timestamp:new Date().toISOString()});await persistPortalStateDurably();await deliverPortalDownload({res,processId:process.id,bytes:dossier.zip,fileName:dossier.fileName,mimeType:'application/zip',requesterBinding:sessionUploadBinding(identity),cacheControl:'private, no-store'});}catch(error){res.status(502).json({error:error instanceof Error?error.message:'Não foi possível gerar o dossiê.'});}});

  app.post('/api/processes/:id/documents/:type/sign',requireAuthenticated,async(req,res)=>{
    const identity=getPortalIdentity(req)!;
    const process=processesStore.find(item=>item.id===req.params.id);
    const type=String(req.params.type).toUpperCase() as 'ATA'|'TERMO'|'DECLARACAO';
    if(!process||!canAccessSignatureDocument(identity.email,process,type))return res.status(404).json({error:'Processo não encontrado.'});
    const requestedProvider=String(req.body?.provider||'ASTEN').toUpperCase();
    if(!['ASTEN','GOV_BR'].includes(requestedProvider))return res.status(400).json({error:'Provedor de assinatura inválido.'});
    const provider=requestedProvider as 'ASTEN'|'GOV_BR';

    if(!['ATA','TERMO','DECLARACAO'].includes(type))return res.status(400).json({error:'Este documento não utiliza assinatura Asten ou Gov.br.'});
    if(type==='TERMO'&&!publicationRequested(process))return res.status(409).json({error:'O termo não é necessário porque o aluno não solicitou publicação.',code:'PUBLICATION_NOT_REQUESTED'});
    if(!canInitiateSignature(identity.email,process,type))return res.status(403).json({error:'Seu perfil não pode solicitar a assinatura deste documento.'});
    if(provider==='ASTEN'&&automaticAstenEnabled(type))return res.status(409).json({error:'O encaminhamento Asten é automático. Acompanhe a situação do documento ou utilize o Gov.br.',code:'ASTEN_AUTOMATIC_WORKFLOW'});
    const missing=type==='ATA'&&process.avaliacao.reviewedAta?[]:missingDocumentModels([type]);if(missing.length)return res.status(409).json({error:`O modelo de ${type} ainda não foi cadastrado pelo Master.`,code:'DOCUMENT_MODEL_REQUIRED',missingModels:missing});
    try{
      const job=await createSignatureJob(process,type,identity.email,{},provider);
      process.signatureProviderPreferences={...process.signatureProviderPreferences,[type]:provider};
      if(provider==='ASTEN')await dispatchSignatureJobAutomatically(job);
      await executeConfiguredWorkflowEvent(process,'SIGNATURE_REQUESTED',identity.email);
      auditLogsStore.push({id:`log-${Date.now()}`,processId:process.id,actorEmail:identity.email,actorRoles:[...getUserRolesForEmail(identity.email).globalRoles,...getActiveProcessRoles(identity.email,process.id)],action:'SOLICITACAO_ASSINATURA',entityType:'signature_job',entityId:job.id,after:{documentType:type,status:job.status,provider,contentSha256:job.contentSha256,providerEnvelopeId:job.providerEnvelopeId},timestamp:new Date().toISOString()});
      persistPortalState();
      // Recolhe avisos que chegaram enquanto o envio ainda estava SENDING.
      if(job.status==='SENT')scheduleAstenCallbackReconciliation();
      const status=provider==='ASTEN'&&(job.status==='WAITING_INTEGRATION'||job.status==='PROVIDER_ERROR')?409:200;
      res.status(status).json({job:publicSignatureJob(job),message:job.status==='SENT'?'Documento enviado à Asten. Os signatários receberão o acesso diretamente pela plataforma.':job.lastError||'Solicitação registrada.'});
    }catch(error){
      const message=error instanceof Error?error.message:'Não foi possível solicitar a assinatura.';
      auditLogsStore.push({id:`log-${randomBytes(12).toString('hex')}`,processId:process.id,actorEmail:identity.email,actorRoles:getUserRolesForEmail(identity.email).globalRoles,action:'SOLICITACAO_ASSINATURA_FALHOU',entityType:'processo',entityId:process.id,after:{documentType:type,provider,error:message},timestamp:new Date().toISOString()});
      await persistPortalStateDurably();res.status(409).json({error:message,...(error instanceof DocumentModelError?{code:error.code}:{} )});
    }
  });

  // POST /api/processes/:id/documents/:docId/correction-request
  app.post('/api/processes/:id/documents/:docId/correction-request', requireAuthenticated, async (req, res) => {
    const actorEmail=getPortalIdentity(req)!.email;if(!canAccessProcess(actorEmail,req.params.id))return res.status(404).json({error:'Processo não encontrado.'});
    const process=processesStore.find(item=>item.id===req.params.id);
    const document=process&&generateDefaultDocuments(process).find(item=>item.id===req.params.docId);
    if(!document)return res.status(404).json({error:'Documento não encontrado.'});
    const rawDescription=req.body?.description;
    if(typeof rawDescription!=='string')return res.status(400).json({error:'Informe uma descrição textual válida para o ajuste.'});
    if(rawDescription.length>4000)return res.status(413).json({error:'Descreva o ajuste em até 4.000 caracteres.',code:'CORRECTION_DESCRIPTION_TOO_LONG'});
    const description=rawDescription.normalize('NFC').trim();
    if(!description||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(description))return res.status(400).json({error:'Informe uma descrição textual válida para o ajuste.'});
    if(description.length>4000)return res.status(413).json({error:'Descreva o ajuste em até 4.000 caracteres.',code:'CORRECTION_DESCRIPTION_TOO_LONG'});
    const documentVersion=req.body?.documentVersion??document.currentVersion;
    if(!Number.isSafeInteger(documentVersion)||documentVersion<1||documentVersion>document.currentVersion)return res.status(400).json({error:'Versão do documento inválida.'});
    const requesterTickets=correctionRequestsStore.filter(ticket=>ticket.processId===process.id&&normalizeEmail(String(ticket.requestedByEmail||''))===actorEmail);
    const isOpen=(ticket:DocumentCorrectionRequest)=>!['CORRIGIDO','RECUSADO'].includes(ticket.status);
    const canonicalDescription=(value:string)=>value.normalize('NFC').trim().replace(/\s+/g,' ');
    const duplicate=requesterTickets.find(ticket=>isOpen(ticket)&&ticket.documentId===document.id&&Number(ticket.documentVersion||1)===documentVersion&&typeof ticket.description==='string'&&canonicalDescription(ticket.description)===canonicalDescription(description));
    if(duplicate)return res.json(duplicate);
    // Count the durable history, including older rows. Never truncate existing tickets to make room.
    if(requesterTickets.filter(isOpen).length>=5)return res.status(429).json({error:'Você já possui cinco solicitações abertas neste processo. Aguarde a análise antes de enviar outra.',code:'CORRECTION_OPEN_LIMIT'});
    const recentTickets=requesterTickets.filter(ticket=>Date.parse(ticket.createdAt)>=Date.now()-24*60*60_000);
    if(recentTickets.length>=10)return res.status(429).json({error:'O limite de dez solicitações por processo em 24 horas foi atingido. Tente novamente mais tarde.',code:'CORRECTION_DAILY_LIMIT'});

    const newTicket: DocumentCorrectionRequest = {
      id: `req-${randomBytes(12).toString('hex')}`,
      processId: req.params.id,
      documentId: req.params.docId,
      documentVersion,
      requestedByEmail: actorEmail,
      requestedByRoles: [...getUserRolesForEmail(actorEmail).globalRoles,...getActiveProcessRoles(actorEmail,process.id)],
      description,
      status: 'ABERTO',
      createdAt: new Date().toISOString()
    };

    correctionRequestsStore.push(newTicket);

    const audit:AuditLog={
      id: `log-${newTicket.id}`,
      processId: req.params.id,
      actorEmail,
      actorRoles: newTicket.requestedByRoles,
      action: 'SOLICITACAO_AJUSTE_DOCUMENTO',
      entityType: 'ticket_correcao',
      entityId: newTicket.id,
      after: {documentId:document.id,documentVersion,descriptionLength:description.length,descriptionSha256:createHash('sha256').update(description).digest('hex'),status:newTicket.status},
      timestamp: new Date().toISOString()
    };
    auditLogsStore.push(audit);

    try{await persistPortalStateDurably();}
    catch{
      correctionRequestsStore=correctionRequestsStore.filter(ticket=>ticket!==newTicket);
      auditLogsStore=auditLogsStore.filter(item=>item!==audit);
      return res.status(503).json({error:'Não foi possível confirmar o registro da solicitação. Tente novamente.'});
    }
    res.status(201).json(newTicket);
  });

  app.get(['/api/president/signature-queue','/api/coordinator/signature-queue'],requireAuthenticated,requirePresidencyOperator,(_req,res)=>{
    const queue=processesStore.filter(isInPresidencyDeclarationQueue).map(process=>{
      const publicView=publicRepositoryView(process);
      return {
        process:{
          id:process.id,protocolo:process.protocolo,titulo:process.titulo,status:process.status,dataRevision:process.dataRevision,
          aluno1:publicView.aluno1,aluno2:publicView.aluno2,orientador:publicView.orientador,coorientador:publicView.coorientador,
          banca:publicView.banca,defesa:{startAt:publicView.defesa.startAt,local:publicView.defesa.local},
          acervo:{resumoSintese:process.acervo?.resumoSintese,palavrasChave:process.acervo?.palavrasChave}
        },
        documents:generateDefaultDocuments(process).filter(doc=>doc.type==='DECLARACAO')
          .map(({type,status,requiresSignature})=>({type,status,requiresSignature})),
        jobs:signatureJobsStore.filter(job=>job.processId===process.id&&job.documentType==='DECLARACAO'&&visibleProcessSignatureEvidence(job)).map(publicSignatureJob)
      };
    });
    res.setHeader('Cache-Control','private, no-store');
    res.json(queue);
  });

  app.post('/api/president/declarations/asten-preflight',requireAuthenticated,requirePresidencyOperator,async(req,res)=>{
    const email=getPortalIdentity(req)!.email;
    const ids=req.body?.processIds;
    if(!Array.isArray(ids)||!ids.length||ids.length>1000||ids.some(id=>typeof id!=='string'||!id||id.length>160))return res.status(400).json({error:'Selecione de 1 a 1.000 processos válidos.'});
    const checks=[...new Set<string>(ids)].map(id=>inspectAstenDeclaration(id,processesStore.find(item=>item.id===id&&(hasFullAdministration(email)||isInPresidencyDeclarationQueue(item))),signatureJobsStore,currentSettings));
    if(checks.some(item=>item.ready)){
      const delivery=await inspectAstenDelivery({status:getPersistentAstenStatus,inbox:astenWebhookInboxReady,folder:()=>resolveAstenDocumentFolder('DECLARACAO'),google:getGoogleWorkspaceStatus,hasDriveRoot:Boolean(currentSettings.driveRootFolderId)});
      if(!delivery.ready)return res.json(checks.map(item=>item.ready?{...item,ready:false,reason:delivery.reason}:item));
    }
    res.json(checks);
  });

  // POST /api/coordinator/upload-signed
  app.post(['/api/president/upload-signed','/api/coordinator/upload-signed'], requireAuthenticated, requireAdministrator, (_req,res)=>res.status(410).json({error:'O upload simulado foi desativado. Use a assinatura Asten dentro do TCC.',code:'LEGACY_SIGNATURE_UPLOAD_DISABLED'}));

  app.get('/api/integrations/asten/status',requireAuthenticated,requirePresidencyOperator,async(_req,res)=>res.json(await getPersistentAstenStatus()));
  app.get('/api/integrations/asten/folders',requireAuthenticated,requireGlobalRoles('MASTER_ADMIN'),async(_req,res)=>{
    try{res.setHeader('Cache-Control','private, no-store');res.json(await getAstenDocumentFolders());}
    catch(error){res.status(502).json({error:error instanceof Error?error.message:'Não foi possível consultar as pastas Asten.'});}
  });
  app.put('/api/integrations/asten/folders',requireAuthenticated,requireGlobalRoles('MASTER_ADMIN'),async(req,res)=>{
    const identity=getPortalIdentity(req)!;

    try{
      const result=await saveAstenDocumentFolders(req.body?.mapping);
      auditLogsStore.push({id:`log-${Date.now()}`,actorEmail:identity.email,actorRoles:['MASTER_ADMIN'],action:'CONFIGURACAO_PASTAS_ASTEN',entityType:'integration',entityId:'asten_document_folders',after:{repositoryId:result.repositoryId,mapping:result.mapping},timestamp:new Date().toISOString()});
      await persistPortalStateDurably();res.setHeader('Cache-Control','private, no-store');res.json(result);
    }catch(error){res.status(409).json({error:error instanceof Error?error.message:'Não foi possível salvar as pastas Asten.'});}
  });
  app.get('/api/integrations/status',requireAuthenticated,requireAdministrativeOperator,async(req,res)=>{const testedSupabase=await getSupabaseRuntimeConnectionStatus();const fileTransport=getSupabaseStagingSecurityStatus();const provider=String(process.env.PORTAL_PERSISTENCE_PROVIDER||'local_file');const vercelDetected=Boolean(process.env.VERCEL);const snapshotReady=provider==='supabase'&&testedSupabase.durablePersistenceReady&&testedSupabase.connected;const transactionalRuntimeReady=Boolean(testedSupabase.transactionalRuntimeReady);const productionSafe=transactionalRuntimeReady&&testedSupabase.normalizedSchemaReady&&fileTransport.configured;const[asten,google,inboxReady]=await Promise.all([getPersistentAstenStatus(),getGoogleWorkspaceStatus(),astenWebhookInboxReady()]);const configuredCallback=String(process.env.ASTEN_CALLBACK_URL||`${process.env.APP_URL||`${req.protocol}://${req.get('host')}`}/api/integrations/asten/webhook`);res.json({asten:{...asten,inboxReady,dispatchEnabled:asten.dispatchEnabled&&inboxReady,callbackUrl:configuredCallback},googleDrive:{...google,configured:google.connected&&Boolean(currentSettings.driveRootFolderId),rootFolderIdPresent:Boolean(currentSettings.driveRootFolderId)},supabase:{...testedSupabase,fileTransport},vercel:{detected:vercelDetected,production:process.env.VERCEL_ENV==='production',projectIdPresent:Boolean(process.env.VERCEL_PROJECT_ID),message:vercelDetected?'Runtime Vercel detectado.':'Execute a implantação pela Vercel depois de configurar os segredos.'},persistence:{provider,snapshotReady,normalizedSchemaReady:testedSupabase.normalizedSchemaReady,transactionalRuntimeReady,productionSafe,message:productionSafe?'Runtime v6, controle otimista, transporte privado e outbox Asten ativos. Faça o piloto real antes de liberar usuários.':snapshotReady?'Persistência conectada, mas a migração v6 e a outbox Asten ainda não foram confirmadas.':'O armazenamento local não é durável na Vercel. Configure o Supabase e aplique todas as migrações antes de publicar.'}});});
  app.post('/api/integrations/supabase/test',requireAuthenticated,requireAdministrator,async(_req,res)=>{const result=await testSupabaseRuntimeConnection();res.status(result.connected?200:503).json(result);});
  app.post('/api/integrations/google/calendar/sync',requireAuthenticated,requireAdministrator,async(req,res)=>{
    const identity=getPortalIdentity(req)!;
    try{
      const accessToken=await getGoogleWorkspaceAccessToken();
      const installation=resolveInstallationProfile(currentSettings);
      const result=await synchronizeDefenseCalendar({accessToken,processes:processesStore,calendarId:currentSettings.calendarId,portalName:installation.portalName,courseName:installation.courseName,institutionName:installation.institutionName});
      googleCalendarEventsStore=result.events;currentSettings={...currentSettings,calendarId:result.calendarId,updatedAt:new Date().toISOString()};
      auditLogsStore.push({id:`log-${Date.now()}`,actorEmail:identity.email,actorRoles:getUserRolesForEmail(identity.email).globalRoles,action:'SINCRONIZACAO_GOOGLE_CALENDAR',entityType:'google_calendar',entityId:result.calendarId,after:{created:result.created,total:result.events.length},timestamp:new Date().toISOString()});
      persistPortalState();res.json(result);
    }catch(error){res.status(502).json({error:error instanceof Error?error.message:'Não foi possível sincronizar o Google Calendar.'});}
  });
  app.post('/api/admin/google/docs/:documentId/design',requireAuthenticated,requireAdministrator,(_req,res)=>res.status(410).json({
    error:'A reestilização automática foi desativada para preservar integralmente o DOCX fornecido pelo usuário Master.',
    code:'DOCX_LAYOUT_IS_SOURCE_OF_TRUTH'
  }));
  app.post('/api/integrations/homologation',requireAuthenticated,requireAdministrator,async(req,res)=>{
    const identity=getPortalIdentity(req)!;
    if(!hasRecentAuthentication(identity))return res.status(428).json({error:'Entre novamente antes de enviar o e-mail de teste.',code:'REAUTHENTICATION_REQUIRED'});
    const checks:Array<{id:string;label:string;status:'PASS'|'FAIL'|'PENDING';message:string}> = [];
    const secretStore=getSecretStoreStatus();const oauthSecurity=getGoogleOAuthSecurityPreflight();
    checks.push({id:'secret-store',label:'Cofre cifrado de segredos',status:secretStore.configured?'PASS':'FAIL',message:secretStore.configured?'Persistência cifrada pronta.':'Configure Supabase e PORTAL_SECRET_ENCRYPTION_KEY exclusiva.'});
    checks.push({id:'google-oauth-security',label:'Segurança OAuth Google',status:oauthSecurity.ready?'PASS':'FAIL',message:oauthSecurity.ready?'State OAuth forte e separado da sessão.':oauthSecurity.issues.join(' ')});
    const probes:Array<Promise<void>>=[];
    probes.push((async()=>{try{
    const supabase=await testSupabaseRuntimeConnection();
    checks.push({id:'supabase',label:'Supabase e persistência básica',status:supabase.connected&&supabase.durablePersistenceReady?'PASS':'FAIL',message:supabase.message});
    checks.push({id:'supabase-transactional',label:'Runtime seguro v6',status:supabase.transactionalRuntimeReady&&getSupabaseStagingSecurityStatus().configured?'PASS':'FAIL',message:supabase.transactionalRuntimeReady&&getSupabaseStagingSecurityStatus().configured?'Commit atômico, transporte privado e outbox Asten v6 confirmados.':'Aplique todas as migrações até 202609060001_asten_transactional_outbox_v6.sql e configure PORTAL_UPLOAD_BINDING_SECRET.'});
    }catch{checks.push({id:'supabase',label:'Supabase e persistência básica',status:'FAIL',message:'Não foi possível consultar o Supabase.'},{id:'supabase-transactional',label:'Runtime seguro v6',status:'FAIL',message:'A conexão transacional não foi confirmada.'});}})());
    probes.push((async()=>{try{
    const google=await getGoogleWorkspaceStatus();
    if(!google.connected){checks.push({id:'google',label:'Google Workspace e Drive',status:'FAIL',message:'Autorize a conta Google do portal.'});}
    else if(!currentSettings.driveRootFolderId){checks.push({id:'google',label:'Google Workspace e Drive',status:'FAIL',message:'A pasta raiz do portal ainda não foi definida.'});}
    else{
      try{const accessToken=await getGoogleWorkspaceAccessToken();await verifyDriveReferenceMetadata(accessToken,currentSettings.driveRootFolderId,true);await verifyPrivateDriveFolder(accessToken,currentSettings.driveRootFolderId);checks.push({id:'google',label:'Google Workspace e Drive',status:'PASS',message:`Conta ${google.connectedEmail} conectada e pasta raiz privada validada.`});}
      catch(error){checks.push({id:'google',label:'Google Workspace e Drive',status:'FAIL',message:error instanceof Error?error.message:'Falha ao validar o Google Drive.'});}
    }
    }catch{checks.push({id:'google',label:'Google Workspace e Drive',status:'FAIL',message:'Não foi possível consultar a conexão Google.'});}})());
    probes.push((async()=>{try{
    const asten=await getPersistentAstenStatus();
    checks.push(astenInfrastructureCheck(asten,await astenWebhookInboxReady()));
    }catch{checks.push({id:'asten',label:'Assinatura Asten e retorno automático',status:'FAIL',message:'Não foi possível consultar a configuração Asten.'});}
    try{const folders=await getAstenDocumentFolders();checks.push({id:'asten-folders',label:'Pastas dos documentos na Asten',status:folders.configured?'PASS':'FAIL',message:folders.configured?'Atas, termos e declarações possuem destinos distintos no repositório conectado.':folders.issues.join(' ')});}
    catch{checks.push({id:'asten-folders',label:'Pastas dos documentos na Asten',status:'FAIL',message:'Não foi possível confirmar as pastas no repositório conectado.'});}
    })());
    const vercelDetected=Boolean(process.env.VERCEL);const vercelProduction=process.env.VERCEL_ENV==='production';
    checks.push({id:'vercel',label:'Vercel',status:vercelDetected&&vercelProduction?'PASS':'PENDING',message:vercelDetected?(vercelProduction?'Implantação de produção detectada.':'Ambiente Vercel detectado, mas ainda não é produção.'):'A Vercel será verificada depois da primeira implantação.'});
    probes.push((async()=>{
    const models=['CONVITE','ATA','TERMO','DECLARACAO'] as const;
    try{
      const accessToken=await getGoogleWorkspaceAccessToken();
      const results=await Promise.allSettled(models.map(async type=>{
        const fileId=currentSettings.documentModels?.[type]?.driveFileId;
        if(!fileId)throw new Error('Modelo não configurado.');
        await verifyDriveReferenceMetadata(accessToken,fileId);
      }));
      const available=results.filter(result=>result.status==='fulfilled').length;
      checks.push({id:'models',label:'Modelos no Drive',status:available===models.length?'PASS':'FAIL',message:`${available}/4 modelos acessíveis. Conferência de metadados, sem baixar arquivos.`});
    }catch{checks.push({id:'models',label:'Modelos no Drive',status:'FAIL',message:'Não foi possível consultar os modelos no Drive.'});}
    })());
    probes.push((async()=>{
    try{
      const recipient=normalizeEmail(identity.email);
      const record=await dispatchTrackedEmail({recipient,requestedBy:recipient,subject:'[Portal TCC · TESTE] Verificação das integrações',text:'Esta mensagem confirma o envio de teste solicitado em Integrações e Plataforma. Nenhum processo, reserva ou pedido de assinatura foi criado. Consulte o resultado de cada integração no Portal.',templateId:'teste:integrations',idempotencyKey:`infrastructure-email-test:${createHash('sha256').update(recipient).digest('hex')}:${Math.floor(Date.now()/60_000)}`,maxAttempts:1},{send:sendGmailMessage,journal:emailDeliveryJournal});
      checks.push({id:'gmail',label:'E-mail de teste ao Master',status:record.status==='ACCEPTED_BY_GMAIL'?'PASS':'FAIL',message:record.status==='ACCEPTED_BY_GMAIL'?`Gmail aceitou o e-mail de teste para ${recipient}. Confira o recebimento na caixa de entrada. Cliques repetidos no mesmo minuto reutilizam este envio.`:'O aceite do e-mail pelo Gmail não foi confirmado. Consulte o Registro de Logs.'});
    }catch{checks.push({id:'gmail',label:'E-mail de teste ao Master',status:'FAIL',message:'Não foi possível concluir o envio de teste. Consulte o Registro de Logs.'});}
    })());
    await Promise.all(probes);
    const order=['secret-store','google-oauth-security','supabase','supabase-transactional','google','models','asten','asten-folders','vercel','gmail'];
    checks.sort((a,b)=>order.indexOf(a.id)-order.indexOf(b.id));
    res.setHeader('Cache-Control','private, no-store');
    const report={id:`homologation-${Date.now()}`,executedAt:new Date().toISOString(),executedBy:identity.email,readyForProduction:infrastructureReadyForProduction(checks,vercelProduction),checks};
    auditLogsStore.push({id:`log-${Date.now()}`,actorEmail:identity.email,actorRoles:getUserRolesForEmail(identity.email).globalRoles,action:'HOMOLOGACAO_ASSISTIDA_INTEGRACOES',entityType:'integration_homologation',entityId:report.id,after:{readyForProduction:report.readyForProduction,checks:checks.map(check=>({id:check.id,status:check.status}))},timestamp:report.executedAt});
    persistPortalState();res.json(report);
  });
  app.post('/api/integrations/asten/session',requireAuthenticated,requireAdministrator,(_req,res)=>res.status(410).json({error:'A sessão temporária legada foi desativada. Configure a Asten uma vez e use o botão do documento.',code:'LEGACY_ASTEN_SESSION_DISABLED'}));
  app.post('/api/integrations/asten/connect',requireAuthenticated,requireAdministrator,async(req,res)=>{
    const identity=getPortalIdentity(req)!;if(!hasRecentAuthentication(identity))return res.status(428).json({error:'Entre novamente antes de alterar a integração Asten.'});
    try{const result=await connectPersistentAsten(String(req.body?.token||''), req.body?.repositoryId === undefined ? undefined : String(req.body.repositoryId));auditLogsStore.push({id:`log-${Date.now()}`,actorEmail:identity.email,actorRoles:getUserRolesForEmail(identity.email).globalRoles,action:'CONEXAO_ASTEN',entityType:'integration',entityId:'asten',after:{identifier:result.identifier,repositoryId:result.repositoryId},timestamp:new Date().toISOString()});persistPortalState();res.json(await getPersistentAstenStatus());}catch(error){
      const selection = error as Error & {code?: string; repositories?: Array<{id:number;name:string}>};
      if(selection.code==='ASTEN_REPOSITORY_SELECTION_REQUIRED' && Array.isArray(selection.repositories))return res.status(409).json({error:selection.message,code:selection.code,issues:Object.fromEntries(selection.repositories.map(item=>[String(item.id),item.name]))});
      res.status(400).json({error:error instanceof Error?error.message:'Não foi possível conectar a conta Asten.'});
    }
  });
  app.get('/api/signatures/jobs',requireAuthenticated,requireAdministrator,(_req,res)=>res.json(signatureJobsStore.filter(job=>!job.removedFromLogsAt).slice().reverse().map(publicSignatureJob)));
  app.get('/api/admin/asten/dashboard',requireAuthenticated,requireAdministrator,(_req,res)=>res.json(buildAstenOperationalDashboard({jobs:signatureJobsStore.filter(job=>!job.removedFromLogsAt),events:astenWebhookEventsStore.filter(event=>!signatureJobsStore.some(job=>job.id===event.matchedJobId&&job.removedFromLogsAt))})));
  app.get('/api/admin/email-deliveries',requireAuthenticated,requireAdministrator,(req,res)=>{const status=String(req.query.status||'').toUpperCase();const rows=emailDeliveriesStore.slice().reverse().filter(item=>!status||item.status===status).map(emailDeliveryAuditSummary);res.setHeader('Cache-Control','private, no-store');res.json(rows);});
  app.post('/api/admin/email-models/:id/test', requireAuthenticated, requireAdministrator, async (req, res) => {
    const identity = getPortalIdentity(req)!;
    if (!hasRecentAuthentication(identity)) return res.status(428).json({error:'Confirme sua identidade antes de enviar a mensagem de teste.',code:'REAUTHENTICATION_REQUIRED'});
    const id = req.params.id;
    if (!operationalEmailRouting(id)) return res.status(404).json({error:'Modelo operacional não encontrado.'});
    const studio = currentSettings.integrationStudioDraft || currentSettings.integrationStudio;
    if (!studio || !studio.emailTemplates?.some(template => template.id === id)) return res.status(404).json({error:'Modelo operacional não encontrado.'});
    if (req.body?.expectedRevision !== (studio.revision || 0)) return res.status(409).json({error:'O modelo mudou. Reabra a prévia antes de enviar a mensagem de teste.'});
    const recipient = normalizeEmail(identity.email);
    const key = `studio-email-test:${createHash('sha256').update(recipient).digest('hex')}:${Math.floor(Date.now() / 60_000)}`;
    const {subject, text, html} = studioEmailPreview(studio, id);
    try {
      const record = await dispatchTrackedEmail({recipient, requestedBy:recipient, subject:`[TESTE · DADOS FICTÍCIOS] ${subject}`, text, html, templateId:`teste:${id}`, studioRevision:studio.revision, idempotencyKey:key, maxAttempts:1}, {send:sendGmailMessage, journal:emailDeliveryJournal});
      if (record.templateId !== `teste:${id}`) {
        res.setHeader('Retry-After', String(60 - Math.floor(Date.now()/1000) % 60));
        return res.status(429).json({error:'Aguarde um minuto antes de testar outro modelo.'});
      }
      if (record.status !== 'ACCEPTED_BY_GMAIL') return res.status(502).json({error:'O aceite pelo Gmail não foi confirmado. Confira a tentativa no Registro de Logs.',deliveryId:record.id});
      return res.json({status:record.status, deliveryId:record.id});
    } catch {
      return res.status(503).json({error:'Não foi possível registrar o teste. Confira o Registro de Logs.'});
    }
  });

  app.get('/api/admin/email-deliveries/:id/preview',requireAuthenticated,requireAdministrator,(req,res)=>{
    const record=emailDeliveriesStore.find(item=>item.id===req.params.id);
    if(!record)return res.status(404).json({error:'Registro de envio não encontrado.'});
    res.setHeader('Cache-Control','private, no-store');
    res.json(emailDeliveryPreview(record));
  });
  app.post('/api/admin/email-deliveries/:id/retry',requireAuthenticated,requireAdministrator,async(req,res)=>{const identity=getPortalIdentity(req)!;const record=emailDeliveriesStore.find(item=>item.id===req.params.id);if(!record)return res.status(404).json({error:'Entrega não encontrada.'});
    if(record.communicationCopy)return res.status(409).json({code:'EMAIL_COPY_USE_ORIGINAL',error:'Consulte a comunicação original para autorizar outra cópia.'});
    if(req.body?.mode==='COMMUNICATION_COPY'){
      const process=record.processId?processesStore.find(item=>item.id===record.processId):undefined;
      const currentBlocker=currentEmailCommunicationCopyBlocker(record,process);
      const previousCopy=emailDeliveriesStore.find(item=>item.communicationCopy?.sourceDeliveryId===record.id&&item.communicationCopy.operationId!==req.body.operationId&&Date.parse(item.communicationCopy.confirmedAt)>Date.now()-60_000);
      if(previousCopy){res.setHeader('Retry-After','60');return res.status(429).json({code:'EMAIL_COPY_RATE_LIMIT',error:'Aguarde um minuto antes de autorizar outra cópia desta mensagem.'});}
      try{
        const copied=await sendConsciousCommunicationCopy({record,actorEmail:identity.email,body:req.body,currentBlocker,ports:{send:sendGmailMessage,journal:emailDeliveryJournal,auditCopyEmail:emailAuditMailbox(currentSettings)}});
        const logId=`email-communication-copy:${copied.id}`;
        if(!auditLogsStore.some(log=>log.id===logId)){auditLogsStore.push({id:logId,processId:record.processId,actorEmail:identity.email,actorRoles:['MASTER_ADMIN'],action:'COPIA_COMUNICACAO_EMAIL_SOLICITADA',entityType:'email_delivery',entityId:copied.id,after:{sourceDeliveryId:record.id,copyDeliveryId:copied.id,reason:copied.communicationCopy?.reason,status:copied.status},timestamp:new Date().toISOString()});await persistPortalStateDurably();}
        return res.json({...emailDeliveryAuditSummary(copied),sourceDeliveryId:record.id});
      }catch(error){const failure=error as Error&{status?:number;code?:string};return res.status(failure.status||409).json({error:failure.message,code:failure.code||'EMAIL_COPY_FAILED'});}
    }
    if(record.status==='ACCEPTED_BY_GMAIL')return res.json(emailDeliveryAuditSummary(record));if(record.dispatchState){const sending=record.dispatchState==='SENDING'&&!!record.dispatchLeaseUntil&&Date.parse(record.dispatchLeaseUntil)>Date.now();return res.status(409).json({error:sending?'O envio está em processamento. Aguarde a conclusão antes de conferir novamente.':'O retorno do envio não foi confirmado. Confira a caixa Enviados do Gmail antes de autorizar outra mensagem.',code:sending?'EMAIL_DELIVERY_IN_PROGRESS':'EMAIL_DELIVERY_UNCERTAIN'});}if(isConsolidatedEmailNotice(String(record.workflowEventCode||''),record.templateId))return res.status(409).json({error:'Este aviso foi reunido com outra mensagem da etapa. Consulte o pedido de reserva, o comprovante ou o aviso final do processo.',code:'EMAIL_CONSOLIDATED'});const process=record.processId?processesStore.find(item=>item.id===record.processId):undefined;if(!process)return res.status(409).json({error:'O processo associado não está disponível para reconstruir o e-mail.'});if((record.templateId==='email-reserva'||isReservationDecisionEmail(record.templateId))&&Number(record.workflowEventVariables?.RESERVATION_REVISION||0)!==(process.defesa.reservationRevision||0))return res.status(409).json({error:'Este pedido foi substituído por um novo agendamento. Use a solicitação de reserva atual.',code:'STALE_RESERVATION_REQUEST'});
    if(record.templateId==='email-reserva'){
      if(process.defesa.departmentResponse||process.defesa.localStatus!=='PENDENTE'||process.defesa.invitationSentAt||process.defesa.invitationDriveFileId){
        return res.status(409).json({error:'A solicitação de reserva já foi encerrada. Consulte a decisão registrada no processo.',code:'RESERVATION_REQUEST_CLOSED'});
      }
      const boundApprover=reservationApproverEmail(process);
      const currentApprover=isManagedDefenseLocation(process.defesa.local,operationalConfig(currentSettings.integrationStudio).reservation.locations)
        ?configuredRoomReservationDepartmentEmail():normalizeEmail(process.orientador.email);
      const recipient=normalizeEmail(record.recipient);
      if(boundApprover!==currentApprover||![currentApprover,...reservationCopies(process,'')].includes(recipient)){
        return res.status(409).json({error:'O destinatário original não corresponde mais ao responsável ou aos participantes da reserva.',code:'EMAIL_RECIPIENT_CHANGED'});
      }
    }
    if(isReservationDecisionEmail(record.templateId)&&process.defesa.departmentResponse
      &&record.idempotencyKey===`reservation-receipt:${process.id}:${process.defesa.departmentResponse.revision}:${process.defesa.departmentResponse.respondedBy}`){
      record.nextRetryAt=new Date().toISOString();record.maxAttempts=Math.min(10,Math.max(record.maxAttempts,record.attempts.length+1));
      auditLogsStore.push({id:`email-retry-${randomBytes(12).toString('hex')}`,processId:process.id,actorEmail:identity.email,actorRoles:['MASTER_ADMIN'],action:'REENVIO_EMAIL_SOLICITADO',entityType:'email_retry_request',entityId:record.id,after:{recipient:record.recipient,subject:record.subject,attemptsBefore:record.attempts.length},timestamp:new Date().toISOString()});
      const retried=await notifyReservationResponse(process);
      return res.status(retried?.status==='ACCEPTED_BY_GMAIL'?200:409).json(emailDeliveryAuditSummary(retried||record));
    }
    const retryBlocker=currentEmailRetryBlocker(record,process);
    if(retryBlocker)return res.status(409).json(retryBlocker);
    const template=(currentSettings.integrationStudio?.emailTemplates||[]).find(item=>String(item.id||item.templateId||'')===String(record.templateId||''));if(!template&&!record.renderedText)return res.status(409).json({error:'O conteúdo original deste e-mail não está disponível. Publique novamente o modelo no Estúdio.'});record.nextRetryAt=new Date().toISOString();record.maxAttempts=Math.min(10,Math.max(record.maxAttempts,record.attempts.length+1));const variables=buildProcessVariables({process,eventCode:record.workflowEventCode||'EMAIL_RETRY',actorEmail:identity.email,actorRoles:getActiveProcessRoles(identity.email,process.id),extraVariables:{...historicalStudioAnswers(process.id),...(record.workflowEventVariables||{})}});const text=record.renderedText||mergeWorkflowVariables(String(template?.body||template?.text||''),variables);const html=template?.htmlBody?mergeWorkflowHtmlVariables(String(template.htmlBody),variables):undefined;const attachments=template?await resolveWorkflowEmailAttachments(process,template):[];auditLogsStore.push({id:`email-retry-${randomBytes(12).toString('hex')}`,processId:process.id,actorEmail:identity.email,actorRoles:['MASTER_ADMIN'],action:'REENVIO_EMAIL_SOLICITADO',entityType:'email_retry_request',entityId:record.id,after:{recipient:record.recipient,subject:record.subject,attemptsBefore:record.attempts.length},timestamp:new Date().toISOString()});const knownAudience=isReservationDecisionEmail(record.templateId)?currentReservationReceiptRecipients(process):record.templateId==='email-reserva'?reservationCopies(process,''):record.templateId==='email-convite'?invitationEmailCopies(process,currentSettings.masterEmail):operationalEmailRecipients(record.templateId||'',process,configuredRoomReservationDepartmentEmail(),[],currentSettings.commissionPresidentEmail);const retryCopies=workflowEmailCopies(record,knownAudience);const retried=await sendTrackedPortalEmail({process,requestedBy:record.requestedBy,recipient:record.recipient,cc:retryCopies,workflowCc:retryCopies,subject:record.subject,text,html,templateId:record.templateId,workflowEventCode:record.workflowEventCode,workflowEventVariables:record.workflowEventVariables,idempotencyKey:record.idempotencyKey,attachments});if(retried.status==='ACCEPTED_BY_GMAIL'&&record.workflowEventCode)await executeConfiguredWorkflowEvent(process,record.workflowEventCode,identity.email,record.workflowEventVariables);res.status(retried.status==='ACCEPTED_BY_GMAIL'?200:409).json(emailDeliveryAuditSummary(retried));});
  app.get('/api/admin/workflow/operations',requireAuthenticated,requireAdministrator,(req,res)=>{const view=req.query.view;if(view!==undefined&&view!=='recovery'&&view!=='reminders')return res.status(400).json({error:'Consulta de andamento inválida.'});const processId=req.query.processId;if(processId!==undefined&&(typeof processId!=='string'||!processId||processId.length>200))return res.status(400).json({error:'Identificador do processo inválido.'});if(processId&&!processesStore.some(process=>process.id===processId))return res.status(404).json({error:'Processo não encontrado.'});res.setHeader('Cache-Control','private, no-store');res.json(workflowOperationsOverview(processId as string|undefined,view as string|undefined));});
  app.post('/api/admin/workflow/maintenance',requireAuthenticated,requireAdministrator,async(req,res)=>{

    const processId=req.body?.processId;if(processId!==undefined&&(typeof processId!=='string'||!processId||processId.length>200))return res.status(400).json({error:'Identificador do processo inválido.'});if(processId&&!processesStore.some(process=>process.id===processId))return res.status(404).json({error:'Processo não encontrado.'});
    try{res.json(await runWorkflowMaintenance(processId));}catch(error){res.status(409).json({error:error instanceof Error?error.message:'Não foi possível executar a rotina.'});}
  });
  app.post('/api/admin/workflow/invitations/:id/retry',requireAuthenticated,requireAdministrator,async(req,res)=>{
    const archive=formArchiveJobsStore.find(item=>item.id===req.params.id&&item.formType==='CONFIRMACAO_LOCAL');
    const portalProcess=archive&&processesStore.find(item=>item.id===archive.processId);
    if(!portalProcess)return res.status(404).json({error:'Confirmação da reserva não encontrada.'});
    if(currentReservationArchive(portalProcess,formArchiveJobsStore)!==archive||req.body?.reviewedStudioRevision!==currentSettings.integrationStudio?.revision){
      return res.status(409).json({error:'A reserva ou a configuração publicada mudou. Atualize o andamento antes de retomar.'});
    }
    if(portalProcess.defesa.invitationSentAt)return res.json({confirmationMessage:'O envio do convite à banca já foi confirmado.'});
    const recovery=recoverableInvitation([portalProcess]);
    if(recovery?.archive!==archive){
      return res.status(409).json({error:'O convite ainda não pode ser retomado com segurança. Confira a situação do envio no registro de logs.'});
    }
    try{
      if(archive.status!=='ARCHIVED'){
        const saved=await retryExistingFormArchiveJob(archive,portalProcess);
        if(saved.status!=='ARCHIVED'||recoverableInvitation([portalProcess])?.archive!==archive){
          return res.status(202).json({workflowPending:true,confirmationMessage:'O arquivamento do comprovante ainda precisa ser confirmado antes do convite.'});
        }
      }
      await resumeWorkflowAfterNativeFormArchive(portalProcess,'CONFIRMACAO_LOCAL',recovery.actorEmail,recovery.run);
    }catch{
      return res.status(202).json({workflowPending:true,confirmationMessage:'O envio do convite ainda não foi confirmado. Confira o andamento atualizado.'});
    }
    const confirmed=Boolean(portalProcess.defesa.invitationSentAt);
    return res.status(confirmed?200:202).json({workflowPending:!confirmed,confirmationMessage:confirmed
      ?'O Gmail aceitou o envio do convite à banca.'
      :'O convite à banca ainda aguarda confirmação do envio.'});
  });
  app.post('/api/admin/workflow/ata-signatures/:id/retry',requireAuthenticated,requireAdministrator,async(req,res)=>{
    const process=processesStore.find(item=>item.id===req.params.id);
    if(!process)return res.status(404).json({error:'Processo não encontrado.'});
    const studioRevision=currentSettings.integrationStudio?.revision||0;
    const intent=recoverableAtaSignature(process);
    if(!intent||req.body?.reviewedStudioRevision!==studioRevision){
      return res.status(409).json({error:'A ata, o envio ou o fluxo publicado mudou. Atualize o andamento antes de retomar.'});
    }
    const actorEmail=getPortalIdentity(req)!.email;
    const previous=workflowRunsStore.filter(run=>run.processId===process.id&&run.eventCode==='EVALUATION_SUBMITTED'
      &&run.sourceDataRevision===process.dataRevision)
      .sort((a,b)=>b.startedAt.localeCompare(a.startedAt))[0];
    try{
      const run=previous?.status==='COMPLETED'?previous:
        await executeConfiguredWorkflowEvent(process,'EVALUATION_SUBMITTED',actorEmail,previous?.eventVariables,previous);
      if((!run||run.status==='COMPLETED')&&process.astenSignatureIntent===intent
        &&(currentSettings.integrationStudio?.revision||0)===studioRevision){
        const jobId=await executeAutomaticAsten(process,'ATA',actorEmail);
        if(jobId)return res.json({confirmationMessage:'A ASTEN aceitou a solicitação de assinatura da ata.'});
      }
    }catch{
      console.error('[Ata] Retomada administrativa sem confirmação do envio Asten.');
    }
    return res.status(202).json({workflowPending:true,confirmationMessage:'O envio para assinatura da ata ainda não foi confirmado. Confira o andamento atualizado.'});
  });
  app.post('/api/admin/workflow/runs/:id/retry',requireAuthenticated,requireAdministrator,async(req,res)=>{
    const identity=getPortalIdentity(req)!;

    const run=workflowRunsStore.find(item=>item.id===req.params.id);if(!run)return res.status(404).json({error:'Execução não encontrada.'});
    const portalProcess=processesStore.find(p=>p.id===run.processId);if(!portalProcess||portalProcess.status==='CONCLUIDO')return res.status(409).json({error:'Este processo não está disponível para retomada.'});
    const newer=workflowRunsStore.filter(item=>item.processId===run.processId&&item.eventCode===run.eventCode).sort((a,b)=>b.startedAt.localeCompare(a.startedAt))[0];
    if(newer?.id!==run.id||run.status==='COMPLETED')return res.status(409).json({error:'A execução mudou. Atualize a central antes de retomar.'});
    if(run.sourceDataRevision!==undefined&&run.sourceDataRevision!==portalProcess.dataRevision)return res.status(409).json({error:'Os dados do TCC mudaram desde esta falha. Revise a etapa no processo; a execução antiga foi preservada.'});
    const revision=currentSettings.integrationStudio?.revision;
    if(run.studioRevision!==revision&&req.body?.reviewedStudioRevision!==revision)return res.status(409).json({error:'O Estúdio mudou. Confira a nova revisão e confirme a retomada; ações já concluídas serão preservadas.'});
    if(signatureJobsStore.some(job=>job.processId===portalProcess.id&&['CREATING','UNCERTAIN'].includes(job.providerCreationState||'')&&!job.providerEnvelopeId))return res.status(409).json({error:'Confira primeiro o envelope Asten com resultado incerto. A retomada não pode criar outra assinatura.'});
    const retryBlocker=workflowRetryBlocker(portalProcess,run.eventCode,signatureJobsStore,run.sourceDataRevision);
    if(retryBlocker)return res.status(409).json({error:retryBlocker,code:'WORKFLOW_RETRY_NOT_ELIGIBLE'});
    const native:Record<string,ProcessFormArchiveType>={TCC_CREATED:'CADASTRO_INICIAL',LOCATION_CONFIRMED:'CONFIRMACAO_LOCAL'};
    try{
      if(run.eventCode==='EVALUATION_SUBMITTED'&&portalProcess.avaliacao.status!=='CONCLUIDO')return res.status(409).json({error:'A ata ainda não foi confirmada.'});
      if(run.eventCode==='REPOSITORY_SUBMITTED'&&!portalProcess.acervo?.submittedAt)return res.status(409).json({error:'A entrega final ainda não foi confirmada.'});
      if(native[run.eventCode]){
        if(!formArchiveJobsStore.some(form=>form.processId===portalProcess.id&&form.formType===native[run.eventCode]&&form.status==='ARCHIVED'))return res.status(409).json({error:'Retome primeiro o arquivamento do formulário desta etapa.'});
        await resumeWorkflowAfterNativeFormArchive(portalProcess,native[run.eventCode],identity.email,run);
      }else await executeConfiguredWorkflowEvent(portalProcess,run.eventCode,identity.email,run.eventVariables,run);
      updateProcessCompletion(portalProcess.id);await persistPortalStateDurably();res.json(workflowOperationsOverview());
    }catch(error){res.status(409).json({error:error instanceof Error?error.message:'Falha na retomada.'});}
  });
  app.post('/api/admin/workflow/reminders/:id/retry',requireAuthenticated,requireAdministrator,async(req,res)=>{
    const identity=getPortalIdentity(req)!;
    const claim=reminderRecordsStore.find(item=>item.id===req.params.id),studio=currentSettings.integrationStudio;
    if(!claim||!studio)return res.status(404).json({error:'Lembrete não encontrado.'});
    if(claim.status!=='FAILED')return res.status(409).json({error:'Somente uma falha revisada pode ser reenviada. Confira no Gmail envios com resultado incerto.'});
    const policy=workflowPolicy(studio);const plan=plannedDeadlines(processesStore,signatureJobsStore,policy,studio.operationsPolicy?.timezone||'America/Sao_Paulo').find(p=>p.processId===claim.processId&&p.rule.id===claim.policyId&&p.dueDate===claim.dueDate&&p.milestone===claim.milestone);
    if(!plan)return res.status(409).json({error:'O prazo mudou ou esta etapa já foi concluída. Preserve o registro histórico.'});
    try{
      const p=processesStore.find(p=>p.id===claim.processId)!;const mail=renderReminder(bindReservationContact(studio,configuredRoomReservationDepartmentEmail()),p,plan.rule.emailTemplateId,plan.label,plan.dueDate,historicalStudioAnswers(p.id));
      if(!mail.to.includes(claim.recipient))return res.status(409).json({error:'O destinatário não pertence mais a este lembrete.'});
      const previousDelivery=emailDeliveriesStore.find(item=>item.idempotencyKey===`reminder:${claim.id}`);
      if(previousDelivery&&previousDelivery.status!=='ACCEPTED_BY_GMAIL'){previousDelivery.nextRetryAt=new Date().toISOString();previousDelivery.maxAttempts=Math.min(10,Math.max(previousDelivery.maxAttempts,previousDelivery.attempts.length+1));}
      claim.status='SENDING';await persistPortalStateDurably();
      const delivery=await sendTrackedPortalEmail({process:p,recipient:claim.recipient,subject:mail.subject,text:mail.text,html:mail.html,templateId:plan.rule.emailTemplateId,idempotencyKey:`reminder:${claim.id}`});
      claim.status=delivery.status==='ACCEPTED_BY_GMAIL'?'SENT':'FAILED';claim.sentAt=claim.status==='SENT'?new Date().toISOString():undefined;claim.error=delivery.attempts.at(-1)?.errorMessage;
      await persistPortalStateDurably();res.json(claim);
    }catch(error){res.status(409).json({error:error instanceof Error?error.message:'Confira o resultado do envio no Gmail antes de repetir.'});}
  });
  app.get('/api/admin/workflow-runs',requireAuthenticated,requireAdministrator,(req,res)=>{
    res.setHeader('Cache-Control','private, no-store');
    if(req.query.protocol===undefined)return res.json(workflowRunsStore.slice().reverse());
    if(typeof req.query.protocol!=='string'||req.query.protocol.length>60||!req.query.protocol.trim())return res.status(400).json({error:'Informe um protocolo de TCC válido.'});
    const protocol=req.query.protocol.trim().toUpperCase();
    const process=processesStore.find(item=>item.protocolo.toUpperCase()===protocol);
    if(!process)return res.status(404).json({error:'TCC não encontrado.'});
    const trace=workflowRunsStore.filter(item=>item.processId===process.id).slice(-100).reverse().map(({id,protocol,eventCode,startedAt,completedAt,status,studioRevision,actions})=>({id,protocol,eventCode,startedAt,completedAt,status,studioRevision,failedActions:(actions||[]).filter(action=>action.status==='FAILED').length}));
    res.json(trace);
  });
  app.get('/api/admin/form-archives',requireAuthenticated,requireAdministrator,(_req,res)=>res.json(formArchiveJobsStore.slice().reverse().map(({artifactBase64:_artifact,...item})=>item)));
  app.post('/api/admin/form-archives/:id/retry',requireAuthenticated,requireAdministrator,async(req,res)=>{
    const identity=getPortalIdentity(req)!;
    const job=formArchiveJobsStore.find(item=>item.id===req.params.id);
    if(!job)return res.status(404).json({error:'Arquivamento não encontrado.'});
    const process=processesStore.find(item=>item.id===job.processId);
    if(!process)return res.status(409).json({error:'O processo do formulário não está disponível.'});
    const updated=await retryExistingFormArchiveJob(job,process);
    let workflowError:string|undefined;
    if(updated.status==='ARCHIVED'){
      const event=nativeFormRetryEvent(updated.formType);
      const staleReservation=updated.reservationRevision!==undefined&&updated.reservationRevision!==(process.defesa.reservationRevision||0);
      const retryBlocker=!event?'O tipo deste formulário não permite retomar uma etapa nativa.'
        :staleReservation?'Este formulário pertence a outro agendamento.'
        :workflowRetryBlocker(process,event,signatureJobsStore,updated.version);
      if(retryBlocker)return res.status(409).json({error:retryBlocker,code:'WORKFLOW_RETRY_NOT_ELIGIBLE',archived:true});
      try{await resumeWorkflowAfterNativeFormArchive(process,updated.formType,identity.email);}
      catch(error){workflowError=error instanceof Error?error.message:'A continuação do fluxo ainda não foi confirmada.';}
    }
    const{artifactBase64:_artifact,...safe}=updated;
    const confirmation=updated.formType==='CONFIRMACAO_LOCAL';
    const invitationConfirmed=confirmation&&Boolean(process.defesa.invitationSentAt&&process.defesa.invitationDriveFileId);
    const workflowPending=updated.status==='ARCHIVED'&&(Boolean(workflowError)||confirmation&&!invitationConfirmed);
    const confirmationMessage=updated.status!=='ARCHIVED'?'O arquivamento ainda não foi confirmado no Drive.'
      :invitationConfirmed?'Comprovante de reserva arquivado no Drive e convite enviado à banca. O TCC avançou para Convite e Banca.'
      :confirmation?'Comprovante de reserva arquivado no Drive. O convite à banca ainda aguarda confirmação.'
      :'Formulário arquivado no Drive. Confira o andamento atualizado das próximas ações.';
    res.status(updated.status!=='ARCHIVED'?409:workflowPending?202:200).json({...safe,workflowPending,workflowError,confirmationMessage,
      ...(updated.status==='ARCHIVED'?{}:{error:updated.lastError||confirmationMessage})});
  });
  app.get('/api/admin/studio-form-submissions',requireAuthenticated,requireAdministrator,(_req,res)=>res.json(studioFormSubmissionsStore.slice().reverse()));
  app.post('/api/admin/studio-form-submissions/:id/retry', requireAuthenticated, requireAdministrator, async (req, res) => {
    const identity = getPortalIdentity(req)!;
    const submission = studioFormSubmissionsStore.find(item => item.id === req.params.id);
    if (!submission) return res.status(404).json({ error: 'Envio de formulário não encontrado.' });
    const process = processesStore.find(item => item.id === submission.processId);
    const form = submission.formSnapshot || currentSettings.integrationStudio?.formTemplates?.find(item => String(item.id) === submission.formId);
    if (!process || !form) return res.status(409).json({ error: 'O processo ou o formulário original não está disponível.' });
    const updated = await archiveStudioFormSubmission(process, form, submission);
    if (updated.archiveStatus === 'ARCHIVED') {
      const run = await executeConfiguredWorkflowEvent(process, `FORM_${submission.formId}_SUBMITTED`, submission.submittedBy, submission.answers);
      updated.workflowPending = run?.status !== 'COMPLETED';
      updated.workflowError = updated.workflowPending ? 'O formulário foi arquivado; revise a etapa na fila de pendências.' : undefined;
    } else { updated.workflowPending = true; updated.workflowError = updated.archiveError; }
    await persistPortalStateDurably();
    res.status(updated.workflowPending ? 202 : 200).json(updated);
  });
  const govbrJobForRequest=(req:express.Request,allowExaminerDownload=false)=>{
    const job=signatureJobsStore.find(item=>item.id===req.params.id&&item.provider==='GOV_BR'&&['ATA','TERMO','DECLARACAO'].includes(item.documentType)&&item.status!=='CANCELED');
    const process=job&&processesStore.find(item=>item.id===job.processId);
    const email=getPortalIdentity(req)!.email;
    if(!job||!process||!(canAccessSignatureDocument(email,process,job.documentType)||allowExaminerDownload&&job.signerPolicySnapshot&&job.signers.some(signer=>normalizeEmail(signer.email)===normalizeEmail(email))))throw Object.assign(new Error('Documento Gov.br não encontrado.'),{status:404});
    const examinerCanDownload=allowExaminerDownload&&job.signers.some(signer=>(Boolean(job.signerPolicySnapshot)||job.documentType==='ATA'&&['EXAMINER','STUDENT','CO_ADVISOR'].includes(signer.role))&&normalizeEmail(signer.email)===normalizeEmail(email));
    if(!examinerCanDownload&&!canInitiateSignature(email,process,job.documentType as 'ATA'|'TERMO'|'DECLARACAO'))throw Object.assign(new Error('Seu perfil não pode acessar esta assinatura.'),{status:403});
    if(!signatureJobMatchesCurrentRevision(process,job))throw new Error('Os dados do documento mudaram. Prepare uma nova versão.');
    if(job.status!=='ARCHIVED'&&hasCompetingSignatureArchive(process,job,signatureJobsStore))throw new Error('Esta versão já foi arquivada por outra solicitação.');
    assertSignatureEligibility(process,job.documentType as 'ATA'|'TERMO'|'DECLARACAO');
    const expected=job.signerPolicySnapshot?signatureSignersFromSnapshot(job.signerPolicySnapshot):registeredSignatureSigners(process,job.documentType as 'ATA'|'TERMO'|'DECLARACAO',{commissionPresidentName:currentSettings.commissionPresidentName,commissionPresidentEmail:currentSettings.commissionPresidentEmail},job.documentType==='ATA'&&job.ataSignerPolicy===undefined?'BOARD_ONLY_LEGACY':'BOARD_AUTHORS_V1');
    assertCurrentSignatureRecipients(process,job.documentType as 'ATA'|'TERMO'|'DECLARACAO',job,currentSettings);
    if(JSON.stringify(expected.map(item=>[item.name,item.email]))!==JSON.stringify(job.signers.map(item=>[item.name,item.email])))throw new Error('Os signatários mudaram. Prepare uma nova versão.');
    return {job,process};
  };
  app.get('/api/signatures/jobs/:id/govbr/download',requireAuthenticated,async(req,res)=>{
    try{
      const returned=req.query.kind==='returned';
      const {job}=govbrJobForRequest(req,!returned);
      const fileId=returned?job.govbrReview?.fileId:job.driveUnsignedFileId;
      const sha256=returned?job.govbrReview?.sha256:job.contentSha256;
      if(!fileId||!sha256)return res.status(404).json({error:'PDF não encontrado.'});
      const pdf=await readGovbrPdf(job,fileId,sha256);
      await deliverPortalDownload({res,processId:job.processId,bytes:pdf,fileName:returned?job.govbrReview!.fileName:job.fileName,mimeType:'application/pdf',requesterBinding:sessionUploadBinding(getPortalIdentity(req)!),cacheControl:'private, no-store'});
    }catch(error){res.status((error as {status?:number})?.status||409).json({error:error instanceof Error?error.message:'Não foi possível baixar o PDF.'});}
  });
  // Receber não aprova: o PDF permanece privado e fora do estado ARCHIVED.
  app.post('/api/signatures/jobs/:id/govbr/complete',requireAuthenticated,async(req,res)=>{
    const identity=getPortalIdentity(req)!;
    try{
      const {job,process}=govbrJobForRequest(req);
      if(!canReturnGovbrDocument(identity.email,process,job.documentType as 'ATA'|'TERMO'|'DECLARACAO',currentSettings,getUserRolesForEmail(identity.email).globalRoles))throw Object.assign(new Error('O PDF assinado deve ser devolvido pelo orientador responsável ou pela Presidência, conforme o documento.'),{status:403});
      if(job.status!=='READY_FOR_REVIEW'||job.govbrReview?.approvedAt)throw new Error('A conferência desta versão já foi aprovada.');
      const receive=async(file:{bytes:Buffer;fileName:string})=>{
        const original=await readGovbrPdf(job,String(job.driveUnsignedFileId||''),job.contentSha256);
        const sha256=await inspectGovbrReturnedPdf(original,file.bytes,job.contentSha256,job.signers.length);
        let fileId:string;
        if(localDocumentModelsEnabled())fileId=storeLocalGovbrPdf(file.bytes);
        else{
          const {accessToken,folderId}=await ensureWorkflowProcessFolder(process);
          const uploaded=await uploadGeneratedPdfToDrive({rootFolderId:currentSettings.driveRootFolderId,protocol:process.protocolo,accessToken,processFolderId:folderId,processId:process.id,jobId:`${job.id}_review_${sha256}`,documentType:job.documentType,fileName:`PENDENTE_CONFERENCIA_${job.fileName}`,pdf:file.bytes,sha256});
          fileId=String(uploaded.id);
        }
        job.govbrReview={fileId,fileName:path.basename(file.fileName).replace(/[\r\n\x00-\x1f]/g,'_').slice(0,160),sha256,uploadedAt:new Date().toISOString(),uploadedBy:identity.email};job.updatedAt=new Date().toISOString();
        auditLogsStore.push({id:`log-${randomBytes(12).toString('hex')}`,processId:process.id,actorEmail:identity.email,actorRoles:getUserRolesForEmail(identity.email).globalRoles,action:'GOVBR_PDF_RECEBIDO_PARA_CONFERENCIA',entityType:'signature_job',entityId:job.id,after:{originalSha256:job.contentSha256,signedSha256:sha256,sourceDataRevision:job.sourceDataRevision},timestamp:job.updatedAt});
        await persistPortalStateDurably();return publicSignatureJob(job);
      };
      const uploadId=String(req.body?.uploadId||'');
      const result=uploadId?await withDriveStagedUpload({uploadId,purpose:'GOV_BR_SIGNED_PDF',requesterBinding:sessionUploadBinding(identity),processId:process.id},receive):await receive({bytes:readLegacyDevelopmentUpload({contentBase64:req.body?.contentBase64,fileName:String(req.body?.fileName||''),expected:'PDF'}),fileName:String(req.body?.fileName||'documento-assinado.pdf')});
      res.json(result);
    }catch(error){res.status((error as {status?:number})?.status||409).json({error:error instanceof Error?error.message:'O PDF não pôde ser recebido.'});}
  });
  app.post('/api/signatures/jobs/:id/govbr/approve',requireAuthenticated,requirePresidencyOperator,async(req,res)=>{
    const identity=getPortalIdentity(req)!;
    try{
      const {job,process}=govbrJobForRequest(req);
      if(!canAdministerSignatureJob(identity.email,job))return res.status(403).json({error:'Seu perfil não pode aprovar este documento.'});
      const confirmation=req.body as GovbrReviewConfirmation;
      assertGovbrManualApproval(job,signatureDocumentRevision(process,job.documentType),confirmation);
      if(job.status==='ARCHIVED'){await finishArchivedSignature(job,identity.email);return res.json(publicSignatureJob(job));}
      if(!['READY_FOR_REVIEW','DRIVE_SYNC_PENDING'].includes(job.status))throw new Error('A versão não está disponível para conferência.');
      const review=job.govbrReview!;
      const [original,pdf]=await Promise.all([readGovbrPdf(job,String(job.driveUnsignedFileId||''),job.contentSha256),readGovbrPdf(job,review.fileId,review.sha256)]);
      await inspectGovbrReturnedPdf(original,pdf,job.contentSha256,job.signers.length);
      if(!review.approvedAt){
        Object.assign(review,{method:'MANUAL_VALIDAR_ITI',approvedAt:new Date().toISOString(),approvedBy:identity.email,itiApproved:true,signerMatches:true,documentMatches:true});
        job.approvedBy=identity.email;job.approvedAt=review.approvedAt;
        auditLogsStore.push({id:`log-${randomBytes(12).toString('hex')}`,processId:process.id,actorEmail:identity.email,actorRoles:getUserRolesForEmail(identity.email).globalRoles,action:'GOVBR_CONFERENCIA_MANUAL_APROVADA',entityType:'signature_job',entityId:job.id,after:{method:review.method,originalSha256:job.contentSha256,signedSha256:review.sha256,sourceDataRevision:job.sourceDataRevision,expectedSigners:job.signers.map(item=>({name:item.name,email:item.email})),itiApproved:true,signerMatches:true,documentMatches:true},timestamp:review.approvedAt!});
        job.status='DRIVE_SYNC_PENDING';await persistPortalStateDurably();
      }
      let archive:Pick<SignatureJob,'driveSignedFileId'|'driveSignedWebViewLink'|'signedSha256'>={driveSignedFileId:review.fileId,signedSha256:review.sha256};
      try{
        if(!localDocumentModelsEnabled()){
          const {accessToken,folderId}=await ensureWorkflowProcessFolder(process);
          const fileName=buildPortalDriveFileName({protocol:process.protocolo,title:process.titulo,studentNames:[process.aluno1.nome,process.aluno2?.nome].filter(Boolean) as string[],documentType:job.documentType,version:job.documentVersion,lifecycle:'ASSINADO'});
          const uploaded=await uploadSignedPdfToDrive({rootFolderId:currentSettings.driveRootFolderId,protocol:process.protocolo,accessToken,processFolderId:folderId,processId:process.id,jobId:job.id,documentType:job.documentType,fileName,pdf,sha256:review.sha256});
          archive={...archive,driveSignedFileId:String(uploaded.id),driveSignedWebViewLink:String(uploaded.webViewLink||'')};
        }
      }catch(error){
        const canonical=signatureJobsStore.find(item=>item.id===job.id&&item.status==='ARCHIVED');
        if(canonical)return res.json(publicSignatureJob(canonical));
        job.status='DRIVE_SYNC_PENDING';job.lastError=error instanceof Error?error.message:'Falha ao arquivar o PDF conferido.';job.updatedAt=new Date().toISOString();await persistPortalStateDurably();return res.status(409).json({error:`Conferência registrada. ${job.lastError} Repita o arquivamento com este mesmo PDF.`});
      }
      // A data real da assinatura consta no certificado/ITI; não inventamos signedAt.
      await commitSignatureArchive(process,job,identity.email,archive);
      res.json(publicSignatureJob(job));
    }catch(error){res.status((error as {status?:number})?.status||409).json({error:error instanceof Error?error.message:'A conferência não foi aprovada.'});}
  });

  app.post('/api/signatures/jobs/:id/retry',requireAuthenticated,requirePresidencyOperator,async(req,res)=>{const identity=getPortalIdentity(req)!;const job=signatureJobsStore.find(item=>item.id===req.params.id&&!item.removedFromLogsAt);if(!job||!canAdministerSignatureJob(identity.email,job))return res.status(404).json({error:'Item não encontrado.'});if(job.provider==='GOV_BR')return res.status(409).json({error:'Use a conferência Gov.br para continuar este documento.',code:'GOVBR_REVIEW_REQUIRED'});if(job.status==='CANCELED')return res.status(409).json({error:'Esta solicitação Asten foi cancelada. Inicie uma nova solicitação.',code:'SIGNATURE_CANCELED'});if(!allowSignatureRetry(identity.email,job.id))return res.status(429).json({error:'Muitas tentativas de reenvio em sequência. Aguarde um minuto e tente novamente.',code:'SIGNATURE_RETRY_RATE_LIMIT'});const signatureProcess=processesStore.find(item=>item.id===job.processId);if(!signatureProcess)return res.status(409).json({error:'O processo associado não está disponível.'});try{assertDocumentSignatureOpen(signatureProcess,job.documentType as 'ATA'|'TERMO'|'DECLARACAO',signatureJobsStore);assertSignatureEligibility(signatureProcess,job.documentType as 'ATA'|'TERMO'|'DECLARACAO');if(!signatureJobMatchesCurrentRevision(signatureProcess,job))throw new Error(`${signatureProcess.protocolo}: os dados mudaram desde a geração desta assinatura. Gere o documento novamente pelo fluxo atual.`);}catch(error){return res.status(409).json({error:error instanceof Error?error.message:'O processo ainda não está elegível para assinatura.',code:'SIGNATURE_FLOW_GATE'});}await dispatchSignatureJobAutomatically(job);const failed=['PROVIDER_ERROR','WAITING_INTEGRATION','DRIVE_SYNC_PENDING'].includes(job.status);if(!failed){const process=processesStore.find(item=>item.id===job.processId);if(process){const eventCode:WorkflowEventCode=job.documentType==='ATA'?'EVALUATION_SUBMITTED':job.documentType==='DECLARACAO'?'PUBLICATION_CLEARED':'REPOSITORY_SUBMITTED';await executeConfiguredWorkflowEvent(process,eventCode,identity.email);}}res.status(failed?409:200).json(publicSignatureJob(job));});
  app.post('/api/signatures/jobs/generate',requireAuthenticated,requireAdministrator,(_req,res)=>res.status(410).json({error:'A geração em lote foi desativada. Use a ação do documento dentro do TCC.',code:'LEGACY_SIGNATURE_GENERATION_DISABLED'}));
  app.post('/api/signatures/jobs/:id/approve',requireAuthenticated,requireAdministrator,(_req,res)=>res.status(410).json({error:'A aprovação de buffer foi desativada. Use a ação do documento dentro do TCC.',code:'LEGACY_SIGNATURE_APPROVAL_DISABLED'}));
  app.post('/api/signatures/jobs/:id/dispatch',requireAuthenticated,requireAdministrativeOperator,(_req,res)=>res.status(410).json({error:'O disparo de buffer foi desativado. Use a ação do documento dentro do TCC.',code:'LEGACY_SIGNATURE_DISPATCH_DISABLED'}));
  app.post('/api/signatures/jobs/:id/reconcile',requireAuthenticated,requirePresidencyOperator,async(req,res)=>{const identity=getPortalIdentity(req)!;if(!allowSignatureRetry(identity.email,req.params.id))return res.status(429).json({error:'Muitas consultas de assinatura em sequência. Tente novamente em um minuto.',code:'SIGNATURE_RECONCILE_RATE_LIMIT'});const job=signatureJobsStore.find(j=>j.id===req.params.id&&!j.removedFromLogsAt);if(!job||!canAdministerSignatureJob(identity.email,job))return res.status(404).json({error:'Envelope não encontrado.'});if(job.status==='ARCHIVED'&&job.postArchivePending){try{await finishArchivedSignature(job,identity.email);return res.json(publicSignatureJob(job));}catch{return res.status(409).json({error:'As ações posteriores ainda aguardam nova tentativa.'});}}if(!job.providerEnvelopeId)return res.status(404).json({error:'Envelope não encontrado.'});if(job.status==='ARCHIVED')return res.json(publicSignatureJob(job));const signatureProcess=processesStore.find(item=>item.id===job.processId);if(!signatureProcess||!signatureJobMatchesCurrentRevision(signatureProcess,job)||hasCompetingSignatureArchive(signatureProcess,job,signatureJobsStore))return res.status(409).json({error:'A solicitação de assinatura não está mais ativa para este documento.'});try{if(job.status==='DRIVE_SYNC_PENDING'){await archiveSignatureJobAutomatically(job);return res.status((job as SignatureJob).status==='ARCHIVED'?200:409).json(publicSignatureJob(job));}const connection=await getPersistentAstenConnection();if(!connection)throw new Error('Conecte a conta Asten em Configurações.');const response=await callAsten('getDadosEnvelope',{idEnvelope:job.providerEnvelopeId,getLobs:'N'},connection.token);job.status=inferAstenJobStatus(response,job.status,job.providerEnvelopeId);if(['SENT','PARTIALLY_SIGNED','SIGNED','ARCHIVED'].includes(job.status))job.providerDispatchState='SENT';job.updatedAt=new Date().toISOString();if(job.status==='SIGNED'){job.completedAt=job.updatedAt;await archiveSignatureJobAutomatically(job);}persistPortalState();res.json(publicSignatureJob(job));}catch(error){res.status(502).json({error:error instanceof Error?error.message:'Falha na reconciliação.'});}});
  app.post('/api/signatures/jobs/:id/archive',requireAuthenticated,requireAdministrator,(_req,res)=>res.status(410).json({error:'O arquivamento manual legado foi desativado; o callback Asten arquiva automaticamente no Drive.',code:'LEGACY_SIGNATURE_ARCHIVE_DISABLED'}));
  // A Asten aguarda resposta rápida: persistimos o evento, nunca esperamos Drive/API antes do 200.
  app.post('/api/integrations/asten/webhook',async(req,res)=>{
    if(!safeCompareWebhookSecret(String(req.headers['x-portal-webhook-key']||'')))return res.status(401).json({error:'Callback não autorizado.'});
    if(!req.body||typeof req.body!=='object'||Array.isArray(req.body))return res.status(400).json({error:'Payload inválido.'});
    const durable=getSupabaseRuntimeStatus().durablePersistenceReady;
    let persisted:PersistedPortalState|null=null;
    if(durable){try{persisted=await loadPortalRuntimeState<PersistedPortalState>(false);if(!persisted)throw new Error('Runtime ausente.');}catch{return res.status(503).json({error:'Não foi possível confirmar o envelope no banco. A Asten deve tentar novamente.'});}}
    const event=normalizeAstenWebhookEvent({payload:req.body,knownFingerprints:durable?new Set(persisted?.astenCallbackFingerprints||[]):astenCallbackFingerprints,jobs:persisted?.signatureJobs||signatureJobsStore});
    if(!event.envelopeId||!/^\d{1,24}$/.test(event.envelopeId))return res.status(400).json({error:'Identificador do envelope inválido.'});
    if((persisted?.signatureJobs||signatureJobsStore).some(job=>job.id===event.matchedJobId&&job.removedFromLogsAt))return res.json({received:true,ignored:true,reason:'SIGNATURE_RECORD_REMOVED'});
    if(!event.matchedJobId){
      const deletionTasks=persisted?.processDeletionTasks??processDeletionTasksStore;
      const deletionLogs=persisted?.auditLogs??auditLogsStore;
      const deleted=deletionTasks.some(task=>task.envelopes.includes(event.envelopeId))
        || deletionLogs.some(log=>log.action==='EXCLUSAO_PROCESSO_TCC'
          && [log.after?.astenEnvelopeIds,log.after?.manualAstenEnvelopes].some(ids=>Array.isArray(ids)&&ids.includes(event.envelopeId)));
      if(deleted)return res.json({received:true,ignored:true,reason:'PROCESS_REMOVED'});
      return res.status(409).json({error:'Envelope ainda não registrado no Portal. Solicite reprocessamento posteriormente.'});
    }
    if(durable){
      try{
        const inserted=await enqueueAstenWebhook(event);
        scheduleAstenCallbackReconciliation(event.id);
        res.setHeader('Cache-Control','no-store');
        return res.status(200).json({received:true,queued:true,duplicate:!inserted});
      }catch{return res.status(503).json({error:'Não foi possível registrar o retorno Asten. O serviço deve tentar novamente.'});}
    }
    if(event.duplicate){scheduleAstenCallbackReconciliation(event.id);return res.status(200).json({received:true,duplicate:true});}
    astenCallbackFingerprints.add(event.fingerprint);
    astenWebhookEventsStore.push(event);
    try{await persistPortalStateDurably();}
    catch{
      // Em conflito CAS o estado remoto já foi recarregado. Remover por ID apagaria
      // a confirmação gravada por outra instância com o mesmo fingerprint.
      astenWebhookEventsStore=astenWebhookEventsStore.filter(item=>item!==event);
      if(!astenWebhookEventsStore.some(item=>item.fingerprint===event.fingerprint))
        astenCallbackFingerprints.delete(event.fingerprint);
      return res.status(503).json({error:'Não foi possível registrar o evento de forma durável. A Asten deve tentar novamente.'});
    }
    res.setHeader('Cache-Control','no-store');
    scheduleAstenCallbackReconciliation(event.id);
    return res.status(200).json({received:true,queued:true});
  });

  // Extract text from binary DOCX zip buffer (Word files)
  async function extractTextFromDocxBuffer(buffer: Buffer): Promise<string> {
    try {
      const zip = await JSZip.loadAsync(buffer);
      let fullXmlText = '';
      const xmlFiles = Object.keys(zip.files).filter(f => f.startsWith('word/') && f.endsWith('.xml'));
      for (const fileName of xmlFiles) {
        const file = zip.file(fileName);
        if (file) {
          const xmlContent = await file.async('string');
          fullXmlText += ' ' + xmlContent;
        }
      }
      return fullXmlText.replace(/<[^>]+>/g, '');
    } catch (err) {
      console.error('[ScanDoc] Error unzipping docx buffer:', err);
      return '';
    }
  }

  // Extract clean text recursively from Google Docs API v1 JSON structure
  function extractTextFromGoogleDocJson(doc: any): string {
    let fullText = '';
    if (!doc) return fullText;

    function traverseContent(contentArray: any[]) {
      if (!Array.isArray(contentArray)) return;
      for (const elem of contentArray) {
        if (elem.paragraph && Array.isArray(elem.paragraph.elements)) {
          for (const pElem of elem.paragraph.elements) {
            if (pElem.textRun && pElem.textRun.content) {
              fullText += pElem.textRun.content;
            }
          }
        } else if (elem.table && Array.isArray(elem.table.tableRows)) {
          for (const row of elem.table.tableRows) {
            if (Array.isArray(row.tableCells)) {
              for (const cell of row.tableCells) {
                traverseContent(cell.content);
              }
            }
          }
        } else if (elem.tableOfContents) {
          traverseContent(elem.tableOfContents.content);
        }
      }
    }

    if (doc.body && doc.body.content) {
      traverseContent(doc.body.content);
    }
    if (doc.headers) {
      Object.values(doc.headers).forEach((h: any) => h && traverseContent(h.content));
    }
    if (doc.footers) {
      Object.values(doc.footers).forEach((f: any) => f && traverseContent(f.content));
    }

    return fullText;
  }

  // Validate if a extracted string inside <<...>> is a genuine document template tag
  function isValidDocTag(inner: string): boolean {
    if (!inner || typeof inner !== 'string') return false;

    // Clean text
    const tag = stripInlineMarkup(inner).trim().replace(/\s+/g, ' ');
    if (tag.length < 2 || tag.length > 80) return false;

    // Do not allow purely numbers
    if (/^\d+$/.test(tag)) return false;

    // Do not allow URLs or path links
    if (/^(https?:\/\/|www\.)/i.test(tag)) return false;

    // Reject JS/Code syntax operators and bracket noise
    if (/[{};=\[\]~^|&+\*\/\\?$'"><%]/.test(tag)) return false;

    // Reject JS keywords / functions
    const jsKeywords = /\b(function|return|else|break|while|for|charCodeAt|typeof|var|let|const|this|window|document|eval|undefined|null|true|false|if|switch|case)\b/i;
    if (jsKeywords.test(tag)) return false;

    // Reject tags with multiple commas (e.g. "13, g=(z=g")
    if ((tag.match(/,/g) || []).length > 1) return false;

    // Must contain at least one word character (Latin, numbers, accented characters)
    if (!/[a-zA-Z0-9\u00C0-\u024F]/.test(tag)) return false;

    return true;
  }

  // Helper to extract <<tags>> from text or HTML content
  function extractDocTags(rawContent: string): string[] {
    if (!rawContent) return [];

    // 1. Strip script, style tags, and HTML comments before extracting
    let cleanText = stripDocumentScanningBlocks(rawContent);

    // 2. Convert HTML entities
    cleanText = cleanText
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&laquo;/gi, '«')
      .replace(/&raquo;/gi, '»')
      .replace(/&#171;/g, '«')
      .replace(/&#187;/g, '»')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&');

    const tagsSet = new Set<string>();

    // Scan each legacy delimiter family in its original priority order.
    for (const [opening, closing] of [['<<', '>>'], ['{{', '}}'], ['[[', ']]'], ['«', '»']]) {
      for (const value of delimitedTextParts(cleanText, opening, closing)) {
        const inner = stripInlineMarkup(value).trim().replace(/\s+/g, ' ');
        if (isValidDocTag(inner)) tagsSet.add(`<<${inner}>>`);
      }
    }

    // 7. Pattern for < ... > (Single angle brackets)
    const htmlTagNames = /^(p|span|div|br|b|i|u|strong|em|a|img|h[1-6]|table|tr|td|th|tbody|thead|tfoot|ul|ol|li|font|xml|code|pre|hr|blockquote|canvas)$/i;
    const singleBracketRegex = /<([a-zA-Z0-9\u00C0-\u024F\s_()#-]+)>/g;
    let match: RegExpExecArray | null;
    while ((match = singleBracketRegex.exec(cleanText)) !== null) {
      let inner = match[1].trim();
      inner = stripInlineMarkup(inner).trim().replace(/\s+/g, ' ');
      if (inner && !htmlTagNames.test(inner) && isValidDocTag(inner)) {
        tagsSet.add(`<<${inner}>>`);
      }
    }

    return Array.from(tagsSet);
  }

  // POST /api/scan-drive-doc - Real Google Doc scanning and tag extraction
  app.post('/api/scan-drive-doc', requireAuthenticated, requireAdministrativeOperator, async (req, res) => {
    const { url, name, text } = req.body || {};
    let accessToken='';
    if(url){try{accessToken=await getGoogleWorkspaceAccessToken();}catch(error){return res.status(409).json({error:error instanceof Error?error.message:'Autorize o Google Workspace antes de ler modelos.',tags:[]});}}

    let fetchedContent = '';
    let fetchedViaApi = false;

    if (url && typeof url === 'string') {
      const docId=googleModelReference(url);
      if(!docId)return res.status(400).json({error:'Informe um link válido do Google Drive/Docs ou o ID do modelo.',tags:[]});

      if (docId) {
        // 1. If OAuth accessToken is provided, call Google Docs API v1 first
        if (accessToken) {
          try {
            const gdocRes = await fetch(`https://docs.googleapis.com/v1/documents/${encodeURIComponent(docId)}`, {
              headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Accept': 'application/json'
              }
            });

            if (gdocRes.ok) {
              const docJson = await gdocRes.json();
              const jsonText = extractTextFromGoogleDocJson(docJson);
              if (jsonText && jsonText.trim().length > 0) {
                fetchedContent = jsonText;
                fetchedViaApi = true;
                console.log(`[ScanDoc] Extracted ${fetchedContent.length} chars via Google Docs API v1`);
              }
            } else {
              console.warn(`[ScanDoc] Docs API returned ${gdocRes.status}`);
            }
          } catch (e) {
            console.error('[ScanDoc] Docs API exception:', e);
          }

          // 2. Drive API v3 Export as plain text
          if (!fetchedContent) {
            try {
              const driveRes = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(docId)}/export?mimeType=text/plain`, {
                headers: { 'Authorization': `Bearer ${accessToken}` }
              });
              if (driveRes.ok) {
                fetchedContent = await driveRes.text();
                fetchedViaApi = true;
              }
            } catch (e) {
              console.error('[ScanDoc] Drive export API exception:', e);
            }
          }

          // 3. Drive API v3 Media Download (for binary .docx files on Google Drive)
          if (!fetchedContent) {
            try {
              const mediaRes = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(docId)}?alt=media`, {
                headers: { 'Authorization': `Bearer ${accessToken}` }
              });
              if (mediaRes.ok) {
                const arrayBuffer = await mediaRes.arrayBuffer();
                const buffer = Buffer.from(arrayBuffer);
                const docxText = await extractTextFromDocxBuffer(buffer);
                if (docxText) {
                  fetchedContent = docxText;
                  fetchedViaApi = true;
                }
              }
            } catch (e) {
              console.error('[ScanDoc] Drive media download exception:', e);
            }
          }
        }

        // Não existe fallback por link público: modelos são lidos somente com
        // a autorização Google do servidor, preservando o caráter privado.
      }
    }

    const fullContentToScan = [fetchedContent, text, name].filter(Boolean).join('\n');
    let tags = extractDocTags(fullContentToScan);

    // If manual text was provided with comma/newline separated tags without brackets
    if (tags.length === 0 && text && typeof text === 'string') {
      const manualItems = text
        .split(/[,;\n]/)
        .map(s => s.trim().replace(/<<|>>|<|>|«|»/g, ''))
        .filter(Boolean);
      manualItems.forEach(t => {
        if (t.length < 90) tags.push(`<<${t}>>`);
      });
    }

    // Return real extracted tags from document text or manual text input
    if (tags.length === 0 && url && !fetchedViaApi && (!fetchedContent || fetchedContent.includes('Sign in - Google Accounts') || fetchedContent.length < 20)) {
      return res.json({
        tags: [],
        source: 'failed',
        unreadable: true,
        reason: 'Não foi possível ler o arquivo com a conta Google autorizada. Selecione ou envie o modelo pela área segura do portal.'
      });
    }

    res.json({ tags, source: fetchedContent ? 'google_doc' : 'text_parsed', unreadable: false });
  });

  // POST /api/scan-drive-folder - Real Google Drive Folder file scanning
  app.post('/api/scan-drive-folder', requireAuthenticated, requireAdministrativeOperator, async (req, res) => {
    const { folderUrl } = req.body || {};

    if (!folderUrl || typeof folderUrl !== 'string') {
      return res.status(400).json({ error: 'Folder URL is required', files: [] });
    }

    const folderId = googleFolderReference(folderUrl);

    if (!folderId) {
      return res.status(400).json({ error: 'Invalid Google Drive folder ID', files: [] });
    }
    let accessToken='';try{accessToken=await getGoogleWorkspaceAccessToken();}catch(error){return res.status(409).json({error:error instanceof Error?error.message:'Autorize o Google Workspace antes de varrer modelos.',files:[]});}

    let files: Array<{ id: string; name: string; driveFileUrl: string; mimeType?: string }> = [];

    if (accessToken) {
      try {
        const listChildren = async (parentId: string) => {
          const found: any[] = []; let pageToken = '';
          do {
            const params = new URLSearchParams({ q: `'${parentId}' in parents and trashed = false`, supportsAllDrives: 'true', includeItemsFromAllDrives: 'true', fields: 'nextPageToken,files(id,name,mimeType,webViewLink)', pageSize: '100' });
            if (pageToken) params.set('pageToken', pageToken);
            const response = await fetch(`https://www.googleapis.com/drive/v3/files?${params}`, { headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' } });
            if (!response.ok) throw new Error(`Google Drive respondeu ${response.status}.`);
            const data = await response.json(); found.push(...(data.files || [])); pageToken = data.nextPageToken || '';
          } while (pageToken);
          return found;
        };
        const rootChildren = await listChildren(folderId);
        const directFiles = rootChildren.filter((item) => item.mimeType !== 'application/vnd.google-apps.folder');
        const lifecycleFiles: any[] = [];
        for (const typeFolder of rootChildren.filter((item) => item.mimeType === 'application/vnd.google-apps.folder')) {
          const typeChildren = await listChildren(typeFolder.id);
          const activeFolders = typeChildren.filter((item) => item.mimeType === 'application/vnd.google-apps.folder' && ['00_MODELO_ATIVO', 'ATIVO'].includes(item.name));
          if (activeFolders.length > 1) throw new Error(`${typeFolder.name}: mais de uma pasta de modelo ativo.`);
          if (activeFolders[0]) lifecycleFiles.push(...await listChildren(activeFolders[0].id));
        }
        const allowedMime = new Set(['application/vnd.google-apps.document', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/msword']);
        files = [...directFiles, ...lifecycleFiles]
          .filter((file) => allowedMime.has(file.mimeType))
          .map((file) => ({ id: file.id, name: file.name, driveFileUrl: file.webViewLink || `https://docs.google.com/document/d/${file.id}/edit`, mimeType: file.mimeType }));
        console.log(`[ScanFolder] Found ${files.length} active model(s) in ${folderId}`);
      } catch (e) {
        console.error('[ScanFolder] Drive API exception:', e);
        return res.status(502).json({ error: e instanceof Error ? e.message : 'Falha ao varrer os modelos do Drive.', files: [] });
      }
    }

    // Sem fallback público: a varredura usa exclusivamente a conta Google autorizada no servidor.

    res.json({ folderId, files });
  });

  app.get('/api/public/replication-models/:slug/download',replicationModelHandler);

  // Process history follows the same access rules as its documents.
  app.get(['/api/processes/:id/audit-logs','/api/processes/:id/audit-logs/pdf'],requireAuthenticated,async(req,res,next)=>{
    try{
    const identity=getPortalIdentity(req)!;
    const process=processesStore.find(item=>item.id===req.params.id);
    if(!process||!canAccessProcess(identity.email,process.id))return res.status(404).json({error:'Processo não encontrado.'});
    res.setHeader('Cache-Control','private, no-store');
    const rows=processAuditFor(process.id);
    if(!req.path.endsWith('/pdf'))return res.json(rows);
    const body=rows.map(log=>`${new Date(log.timestamp).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'})} (Brasília)
${log.actorEmail} | ${log.actorRoles.join(', ')}
${log.action}
${auditChanges(log)}`).join('\n\n');
    const pdf=await createBrandedTextPdf({title:'Histórico de alterações',protocol:process.protocolo,body:body||'Nenhum evento registrado.',footer:'Registros do Portal TCC'},currentSettings);
    res.setHeader('Content-Type','application/pdf');
    res.setHeader('Content-Disposition',`attachment; filename="historico-${process.protocolo.replace(/[^a-zA-Z0-9-]/g,'')}.pdf"`);
    return res.send(pdf);
    }catch(error){next(error);}
  });

  // GET /api/admin/audit-logs
  app.get('/api/admin/audit-logs', requireAuthenticated, requireAdministrator, (req, res) => {
    const processId=req.query.processId;
    if(processId!==undefined&&(typeof processId!=='string'||!processId||processId.length>200))return res.status(400).json({error:'Identificador do processo inválido.'});
    if(processId&&!processesStore.some(process=>process.id===processId))return res.status(404).json({error:'Processo não encontrado.'});
    const query=String(req.query.q||req.query.search||'').trim().toLocaleLowerCase('pt-BR');
    res.setHeader('Cache-Control','private, no-store');
    const input={logs:processId?auditLogsStore.filter(log=>log.processId===processId||(log.entityId===processId&&log.entityType==='processo')):auditLogsStore,deliveries:processId?emailDeliveriesStore.filter(mail=>mail.processId===processId):emailDeliveriesStore,processes:processesStore,deletionTasks:processDeletionTasksStore,retryBlocker:currentEmailRetryBlocker,copyBlocker:currentEmailCommunicationCopyBlocker};
    if (req.query.paginated !== 'true') {
      return res.json(buildAuditFeed(input).filter(log=>!query||JSON.stringify(log).toLocaleLowerCase('pt-BR').includes(query)));
    }
    const rawCursor = String(req.query.before || '');
    const before = rawCursor ? decodeAuditCursor(rawCursor) : null;
    if (rawCursor && !before) return res.status(400).json({error:'Página de registros inválida. Atualize a lista.'});
    const date = (value: unknown) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : '';
    return res.json(buildPagedAuditFeed(input, {
      before: before ?? undefined, search: query.slice(0,160), kind: String(req.query.kind || ''),
      start: date(req.query.start), end: date(req.query.end), focusId: String(req.query.focusId || '').slice(0,260)
    }));
  });

  // GET /api/admin/correction-requests
  app.get('/api/admin/correction-requests', requireAuthenticated, requireAdministrativeOperator, (_req, res) => {
    res.json(correctionRequestsStore.slice().reverse());
  });

  // POST /api/admin/correction-requests/:id/resolve
  app.post('/api/admin/correction-requests/:id/resolve', requireAuthenticated, requireAdministrativeOperator, (req, res) => {
    const actorEmail=getPortalIdentity(req)!.email;
    const ticketIndex = correctionRequestsStore.findIndex((t) => t.id === req.params.id);

    if (ticketIndex === -1) {
      return res.status(404).json({ error: 'Ticket de correção não encontrado.' });
    }

    const ticket = correctionRequestsStore[ticketIndex];
    const updated = {
      ...ticket,
      status: req.body.status || 'CORRIGIDO',
      resolvedAt: new Date().toISOString(),
      resolvedBy: actorEmail,
      resolutionNote: req.body.resolutionNote || 'Ticket resolvido pelo Administrador Master.'
    };

    correctionRequestsStore[ticketIndex] = updated as DocumentCorrectionRequest;

    persistPortalState();res.json(updated);
  });

  // GET /api/calendar/events
  app.get('/api/calendar/events', (req, res) => {
    res.json(googleCalendarEventsStore.filter(event => !processesStore.some(process =>
      isDefenseReservationDeclined(process) && calendarEventMatchesProcess(event, process))));
  });

  // POST /api/calendar/sync
  app.post('/api/calendar/sync', requireAuthenticated, requireAdministrativeOperator, (req, res) => {
    const actorEmail=getPortalIdentity(req)!.email;
    const { globalRoles } = getUserRolesForEmail(actorEmail);

    if (!globalRoles.includes('MASTER_ADMIN') && !globalRoles.includes('COMMISSION_PRESIDENT')) {
      return res.status(403).json({ error: 'Apenas o Master ou o Presidente da Comissão pode sincronizar o calendário.' });
    }

    const { events } = req.body;
    if (!Array.isArray(events)) {
      return res.status(400).json({ error: 'Lista de eventos inválida.' });
    }

    // Overwrite with the newly synchronized list
    googleCalendarEventsStore = events.map((ev: any) => ({
      id: ev.id || `gcal-${Date.now()}-${Math.random()}`,
      portalTccProtocol: typeof ev.portalTccProtocol === 'string' ? ev.portalTccProtocol : undefined,
      summary: ev.summary || 'Sem Título',
      description: ev.description || '',
      location: ev.location || '',
      start: ev.start?.dateTime || ev.start?.date || ev.start || new Date().toISOString(),
      end: ev.end?.dateTime || ev.end?.date || ev.end || new Date().toISOString(),
      syncedAt: new Date().toISOString()
    }));

    auditLogsStore.push({
      id: `log-${Date.now()}`,
      actorEmail,
      actorRoles: globalRoles,
      action: 'SINCRONIZACAO_CALENDARIO_GOOGLE',
      entityType: 'calendar',
      entityId: 'primary',
      after: { eventCount: googleCalendarEventsStore.length },
      timestamp: new Date().toISOString()
    });

    res.json({ message: 'Calendário sincronizado com sucesso.', count: googleCalendarEventsStore.length });
  });

  // POST /api/admin/rollback-log/:logId (Guarantee Rollback / Restoration)
  app.post('/api/admin/rollback-log/:logId', requireAuthenticated, requireAdministrativeOperator, (req, res) => {
    const identity=getPortalIdentity(req)!;const actorEmail=identity.email;
    const { globalRoles } = getUserRolesForEmail(actorEmail);

    if (!globalRoles.includes('MASTER_ADMIN') && !globalRoles.includes('COMMISSION_PRESIDENT')) {
      return res.status(403).json({ error: 'Apenas Administrador Master ou Presidente pode restaurar versões anteriores.' });
    }


    const log = auditLogsStore.find((l) => l.id === req.params.logId);
    if (!log) {
      return res.status(404).json({ error: 'Registro de edição não encontrado.' });
    }

    const snapshotToRestore = log.before || log.after;
    if (!snapshotToRestore) {
      return res.status(400).json({ error: 'Nenhum estado válido encontrado neste registro para restauração.' });
    }

    if (log.entityType === 'processo' || (snapshotToRestore && snapshotToRestore.id && snapshotToRestore.protocolo)) {
      const targetId = snapshotToRestore.id || log.processId;
      const procIndex = processesStore.findIndex((p) => p.id === targetId);
      if(procIndex===-1&&restoresDeletedProcess([{id:targetId,protocolo:snapshotToRestore.protocolo}],[],processDeletionTasksStore,auditLogsStore)){
        return res.status(409).json({error:'Este TCC foi excluído. A restauração não pode recriar o processo.',code:'PROCESS_BACKUP_RESTORE_DELETED'});
      }
      if(signatureJobsStore.some(job=>job.processId===targetId&&['SENDING','SENT','PARTIALLY_SIGNED','SIGNED','DRIVE_SYNC_PENDING','ARCHIVED'].includes(job.status))){
        return res.status(409).json({error:'Este TCC já possui documento enviado ou assinado. Use uma correção formal e gere nova versão, preservando o histórico.',code:'SIGNED_PROCESS_ROLLBACK_BLOCKED'});
      }

      const beforeCurrent = procIndex !== -1 ? JSON.parse(JSON.stringify(processesStore[procIndex])) : null;
      const restoredProcess: ProcessData = {
        ...preserveCurrentDriveBindings(snapshotToRestore,procIndex!==-1?processesStore[procIndex]:undefined),
        dataRevision: (snapshotToRestore.dataRevision || 1) + 1,
        updatedAt: new Date().toISOString()
      };

      if (procIndex !== -1) {
        processesStore[procIndex] = restoredProcess;
      } else {
        processesStore.push(restoredProcess);
      }
      synchronizeProcessParticipants(restoredProcess,actorEmail);

      auditLogsStore.push({
        id: `log-${Date.now()}`,
        processId: targetId,
        actorEmail,
        actorRoles: globalRoles,
        action: 'RESTAURACAO_GARANTIA_HISTORICA',
        entityType: 'processo',
        entityId: targetId,
        before: beforeCurrent,
        after: restoredProcess,
        timestamp: new Date().toISOString()
      });

      persistPortalState();
      return res.json({ message: 'Versão histórica do TCC restaurada com sucesso.', process: restoredProcess });
    } else if (log.entityType === 'settings' || log.entityType === 'integration_studio') {
      const protectedGovernance={masterEmail:currentSettings.masterEmail,ownerEmail:currentSettings.ownerEmail,commissionPresidentEmail:currentSettings.commissionPresidentEmail,masterRecoveryEmails:currentSettings.masterRecoveryEmails,sessionValidAfter:currentSettings.sessionValidAfter,driveRootFolderId:currentSettings.driveRootFolderId,calendarId:currentSettings.calendarId,documentModels:currentSettings.documentModels};
      currentSettings = {
        ...currentSettings,
        ...redactSensitiveValues(snapshotToRestore),
        ...protectedGovernance,
        emailConfig: { ...(snapshotToRestore.emailConfig || currentSettings.emailConfig || {}), auditEmailsEnabled: isEmailAuditEnabled(currentSettings), auditCopyEmail:currentSettings.emailConfig?.auditCopyEmail, roomReservationDepartmentEnabled:reservationDepartmentEnabled(currentSettings.emailConfig), ...(currentSettings.emailConfig?.roomReservationEmailCentralized===true?{roomReservationDepartmentEmail:currentSettings.emailConfig.roomReservationDepartmentEmail,roomReservationEmailCentralized:true}:{}) },
        updatedAt: new Date().toISOString()
      };

      auditLogsStore.push({
        id: `log-${Date.now()}`,
        actorEmail,
        actorRoles: globalRoles,
        action: 'RESTAURACAO_CONFIGURACOES_HISTORICAS',
        entityType: 'settings',
        entityId: 'global',
        after: currentSettings,
        timestamp: new Date().toISOString()
      });

      persistPortalState();
      return res.json({ message: 'Configurações do sistema restauradas com sucesso.', settings: currentSettings });
    }

    res.status(400).json({ error: 'Tipo de entidade não suportado para restauração automática.' });
  });

  app.get('/api/admin/backup',requireAuthenticated,requireAdministrator,(req,res)=>{
    const identity=getPortalIdentity(req)!;
    if(!hasRecentAuthentication(identity))return res.status(428).json({error:'Reautentique-se para exportar um backup administrativo.'});
    const exportedAt=new Date().toISOString();
    const backup={schemaVersion:5,operationalMetadata: {signatureJobs:snapshotPortalState().signatureJobs,formArchiveJobs:snapshotPortalState().formArchiveJobs,emailDeliveries:emailDeliveriesStore,workflowRuns:workflowRunsStore,astenWebhookEvents:astenWebhookEventsStore},title:'Backup administrativo do Portal de TCC',processProtocolCounters:processProtocolCountersStore,exportedAt,settings:publicSettingsForRequest(true),processes:processesStore,legacyAcademicRecords:legacyAcademicRecordsStore,authorizedStudents:authorizedStudentsStore,memberships:membershipsStore,tablePreferences:tablePreferencesStore,notificationPreferences:notificationPreferencesStore,dataSubjectRequests:dataSubjectRequestsStore,legalHolds:legalHoldsStore,studioVersions:studioVersionsStore};
    const checksum=createHash('sha256').update(JSON.stringify(backup)).digest('hex');
    auditLogsStore.push({id:`log-${Date.now()}`,actorEmail:identity.email,actorRoles:getUserRolesForEmail(identity.email).globalRoles,action:'EXPORTACAO_BACKUP_ADMINISTRATIVO',entityType:'system_backup',entityId:checksum,after:{schemaVersion:5,processCount:processesStore.length,legacyCount:legacyAcademicRecordsStore.length},timestamp:exportedAt});
    persistPortalState();res.setHeader('Cache-Control','no-store');res.json({...backup,checksum});
  });

  // POST /api/admin/restore-full-backup — validação e confirmação em duas etapas.
  app.post('/api/admin/restore-full-backup', requireAuthenticated, requireAdministrator, (req, res) => {
    const identity=getPortalIdentity(req)!;const actorEmail=identity.email;
    const { globalRoles } = getUserRolesForEmail(actorEmail);

    if (!hasFullAdministration(actorEmail)) {
      return res.status(403).json({ error: 'Apenas o Master ou o Presidente da Comissão pode restaurar backups do sistema.' });
    }
    if(!hasRecentAuthentication(identity))return res.status(428).json({error:'Reautentique-se antes de restaurar um backup.'});
    const { settings, processes, legacyAcademicRecords, authorizedStudents, tablePreferences, notificationPreferences, dataSubjectRequests, legalHolds, studioVersions, confirmHash } = req.body||{};
    if(!settings||typeof settings!=='object'||Array.isArray(settings)||!Array.isArray(processes))return res.status(400).json({error:'Backup inválido: configurações e processos são obrigatórios.'});
    if(containsSensitiveConfigurationKey(settings))return res.status(400).json({error:'O backup contém campos de segredo e não pode ser restaurado.'});
    if(processes.length>10_000||processes.some((process:any)=>!process||typeof process!=='object'||![process.id,process.protocolo,process.titulo].every(value=>typeof value==='string'&&value.trim())))return res.status(400).json({error:'Backup inválido: coleção de processos fora do formato esperado.'});
    const ids=new Set<string>(processes.map((process:any)=>String(process.id)));
    const protocols=new Set<string>(processes.map((process:any)=>String(process.protocolo).trim().toUpperCase()));
    if(ids.size!==processes.length||protocols.size!==processes.length)return res.status(400).json({error:'Backup inválido: processos ou protocolos duplicados.'});
    if(restoresDeletedProcess(processes,processesStore,processDeletionTasksStore,auditLogsStore))return res.status(409).json({error:'O backup contém um TCC excluído. A restauração não pode recriar o processo.',code:'PROCESS_BACKUP_RESTORE_DELETED'});
    const activeLegalHolds=legalHoldsStore.filter(hold=>hold.active);
    const currentIds=new Set(processesStore.map(process=>process.id));
    if(activeLegalHolds.some(hold=>currentIds.has(hold.processId)&&!ids.has(hold.processId)))return res.status(409).json({error:'O backup deixaria de fora um TCC sob bloqueio legal de exclusão.',code:'PROCESS_LEGAL_HOLD'});
    if(processesStore.some(process=>!ids.has(process.id)))return res.status(409).json({error:'O backup deixaria de fora um TCC ativo. Use Detalhes do TCC para excluir um processo com a limpeza completa.',code:'PROCESS_BACKUP_RESTORE_WOULD_DELETE'});
    const activeHoldIds=new Set(activeLegalHolds.map(hold=>hold.id));
    const safeLegalHolds=[...(Array.isArray(legalHolds)?legalHolds:legalHoldsStore).filter(hold=>hold&&typeof hold.id==='string'&&!activeHoldIds.has(hold.id)),...activeLegalHolds];
    // Older exports omit this collection; preserve the current historical archive.
    // Explicit collections use the import validator, including consent and private Drive references.
    let safeLegacyAcademicRecords=legacyAcademicRecordsStore;
    if(legacyAcademicRecords!==undefined){
      try{
        if(!Array.isArray(legacyAcademicRecords)||legacyAcademicRecords.length>999)throw new Error('Coleção histórica inválida no backup.');
        safeLegacyAcademicRecords=[];
        for(let offset=0;offset<legacyAcademicRecords.length;offset+=500)safeLegacyAcademicRecords.push(...validateLegacyBatch(legacyAcademicRecords.slice(offset,offset+500)));
        if(new Set(safeLegacyAcademicRecords.map(record=>record.id)).size!==safeLegacyAcademicRecords.length||new Set(safeLegacyAcademicRecords.map(record=>record.sourceFingerprint)).size!==safeLegacyAcademicRecords.length)throw new Error('Trabalhos históricos duplicados no backup.');
      }catch(error){return res.status(400).json({error:error instanceof Error?error.message:'Acervo histórico inválido no backup.'});}
    }
    const safeSettings={...redactSensitiveValues(settings),emailConfig:{...(settings.emailConfig||currentSettings.emailConfig||{}),auditEmailsEnabled:isEmailAuditEnabled(currentSettings),auditCopyEmail:currentSettings.emailConfig?.auditCopyEmail,roomReservationDepartmentEnabled:reservationDepartmentEnabled(currentSettings.emailConfig),...(currentSettings.emailConfig?.roomReservationEmailCentralized===true?{roomReservationDepartmentEmail:currentSettings.emailConfig.roomReservationDepartmentEmail,roomReservationEmailCentralized:true}:{})},masterEmail:currentSettings.masterEmail,ownerEmail:currentSettings.ownerEmail,commissionPresidentEmail:currentSettings.commissionPresidentEmail,masterRecoveryEmails:currentSettings.masterRecoveryEmails,sessionValidAfter:currentSettings.sessionValidAfter,driveRootFolderId:currentSettings.driveRootFolderId,calendarId:currentSettings.calendarId,documentModels:currentSettings.documentModels};
    const safeProcesses=processes.map((process:any)=>preserveCurrentDriveBindings(process,processesStore.find(current=>current.id===String(process.id))));
    let operationalMetadata:{signatureJobs:typeof signatureJobsStore;formArchiveJobs:typeof formArchiveJobsStore;emailDeliveries:typeof emailDeliveriesStore;workflowRuns:typeof workflowRunsStore;astenWebhookEvents:typeof astenWebhookEventsStore};
    try{
      const imported=req.body?.operationalMetadata||{};const processIds=new Set<string>(safeProcesses.map((process:any)=>String(process.id)));
      operationalMetadata={
        signatureJobs:mergeOperationalMetadata(signatureJobsStore,imported.signatureJobs,processIds,new Set(['ARCHIVED','SIGNED','DECLINED','EXPIRED','CANCELED'])),
        formArchiveJobs:mergeOperationalMetadata(formArchiveJobsStore,imported.formArchiveJobs,processIds,new Set(['ARCHIVED','CANCELED'])),
        emailDeliveries:mergeOperationalMetadata(emailDeliveriesStore,imported.emailDeliveries,processIds,new Set(['ACCEPTED_BY_GMAIL','SENT','DELIVERED','CANCELED'])),
        workflowRuns:mergeOperationalMetadata(workflowRunsStore,imported.workflowRuns,processIds,new Set(['COMPLETED','SUCCESS','CANCELED'])),
        astenWebhookEvents:mergeOperationalMetadata(astenWebhookEventsStore,imported.astenWebhookEvents,processIds,event=>{const processedAt=event.processedAt||event.safePayload?.processedAt;return ['PROCESSED','IGNORED'].includes(String(event.status))||(typeof processedAt==='string'&&Number.isFinite(Date.parse(processedAt)));})
      };
    }catch(error){return res.status(409).json({error:error instanceof Error?error.message:'Não foi possível preservar os registros operacionais.'});}
    let safeTablePreferences=tablePreferencesStore;
    if(tablePreferences!==undefined){
      try{
        if(!tablePreferences||typeof tablePreferences!=='object'||Array.isArray(tablePreferences)||Object.keys(tablePreferences).length>10000)throw Error('Preferências de planilha inválidas no backup.');
        safeTablePreferences=Object.fromEntries(Object.entries(tablePreferences).map(([email,entries])=>{
          if(!isEmailAddress(email)||!entries||typeof entries!=='object'||Array.isArray(entries))throw Error('Conta de preferência inválida no backup.');
          return [normalizeEmail(email),Object.fromEntries(Object.entries(entries).map(([key,value])=>{
            if(!validTableKey(key))throw Error('Planilha inválida no backup.');
            return [key,sanitizeTablePreference(value)];
          }))];
        }));
      }catch(error){return res.status(400).json({error:error instanceof Error?error.message:'Preferências inválidas no backup.'});}
    }
    let restoredProtocolCounters:ProcessProtocolCounters;
    try{restoredProtocolCounters=seedProcessProtocolCounters(mergeProcessProtocolCounters(processProtocolCountersStore,req.body?.processProtocolCounters),safeProcesses.map(process=>process.protocolo));}catch{return res.status(400).json({error:'Contador de protocolos inválido no backup.'});}
    const restorePayload={processProtocolCounters:restoredProtocolCounters,tablePreferences:safeTablePreferences,operationalMetadata,schemaVersion:Number(req.body?.schemaVersion||1),settings:safeSettings,processes:safeProcesses,legacyAcademicRecords:safeLegacyAcademicRecords,authorizedStudents:Array.isArray(authorizedStudents)?authorizedStudents:authorizedStudentsStore,notificationPreferences:notificationPreferences&&typeof notificationPreferences==='object'&&!Array.isArray(notificationPreferences)?notificationPreferences:{},dataSubjectRequests:Array.isArray(dataSubjectRequests)?dataSubjectRequests:[],legalHolds:safeLegalHolds,studioVersions:Array.isArray(studioVersions)?studioVersions:[]};
    const expectedHash=createHash('sha256').update(JSON.stringify(restorePayload)).digest('hex');
    if(String(confirmHash||'')!==expectedHash)return res.json({requiresConfirmation:true,confirmHash:expectedHash,summary:{processCount:processes.length,legacyCount:restorePayload.legacyAcademicRecords.length,authorizedCount:restorePayload.authorizedStudents.length,administratorsPreserved:true,auditTrailPreserved:true}});

    currentSettings={...INITIAL_SETTINGS,...safeSettings,updatedAt:new Date().toISOString()};
    processesStore=JSON.parse(JSON.stringify(safeProcesses));
    processProtocolCountersStore=restoredProtocolCounters;
    legacyAcademicRecordsStore=structuredClone(restorePayload.legacyAcademicRecords);
    authorizedStudentsStore=restorePayload.authorizedStudents.map(withoutParticipantIdentifiers);
    tablePreferencesStore=structuredClone(restorePayload.tablePreferences);
    notificationPreferencesStore=JSON.parse(JSON.stringify(restorePayload.notificationPreferences));
    dataSubjectRequestsStore=JSON.parse(JSON.stringify(restorePayload.dataSubjectRequests));
    legalHoldsStore=JSON.parse(JSON.stringify(restorePayload.legalHolds));
    studioVersionsStore=retainStudioVersions(JSON.parse(JSON.stringify(restorePayload.studioVersions)));
    membershipsStore=[];for(const process of processesStore)synchronizeProcessParticipants(process,actorEmail);
    signatureJobsStore=operationalMetadata.signatureJobs;formArchiveJobsStore=operationalMetadata.formArchiveJobs;emailDeliveriesStore=operationalMetadata.emailDeliveries;workflowRunsStore=operationalMetadata.workflowRuns;astenWebhookEventsStore=operationalMetadata.astenWebhookEvents;

    auditLogsStore.push({
      id: `log-${Date.now()}`,
      actorEmail,
      actorRoles: globalRoles,
      action: 'RESTAURACAO_BACKUP_COMPLETO_JSON',
      entityType: 'system_backup',
      entityId: 'full',
      timestamp: new Date().toISOString()
    });

    persistPortalState();
    res.json({ message: 'Backup restaurado com validação. Papéis administrativos e auditoria anterior foram preservados.', processCount: processesStore.length,legacyCount:legacyAcademicRecordsStore.length });
  });

  // POST /api/emergency-recover-master (Comunicar Roubo / Troca de Dono por Link de Emergência)
  app.post('/api/emergency-recover-master', async (req, res) => {
    const { secretKey, recoveryEmail, newMasterEmail, verificationCode } = req.body || {};

    if (!secretKey || !recoveryEmail || !newMasterEmail || !verificationCode) {
      return res.status(400).json({ error: 'Preencha a chave secreta, o e-mail de segurança, o código recebido e o novo e-mail Master.' });
    }

    const expectedHash=String(process.env.MASTER_RECOVERY_SECRET_SHA256||'').trim().toLowerCase(),suppliedHash=createHash('sha256').update(String(secretKey)).digest('hex');
    if(!expectedHash||expectedHash.length!==64||!timingSafeEqual(Buffer.from(suppliedHash),Buffer.from(expectedHash))){
      return res.status(403).json({ error: 'Chave secreta de recuperação inválida ou expirada.' });
    }

    const normRecovery = normalizeEmail(recoveryEmail);
    const validRecoveryEmails = (currentSettings.masterRecoveryEmails || []).map(normalizeEmail);

    if (!validRecoveryEmails.includes(normRecovery)) {
      return res.status(403).json({
        error: 'Acesso Negado: O e-mail informado não está cadastrado na lista de e-mails de segurança/emergência do portal.'
      });
    }
    try{await verifyPortalOtp({email:normRecovery,code:String(verificationCode),challengeId:readOtpChallengeCookie(req)});}catch{return res.status(403).json({error:'Código de recuperação inválido ou expirado.'});}

    const normNewMaster = normalizeEmail(newMasterEmail);
    if(!isValidPortalEmail(normNewMaster))return res.status(400).json({error:'Informe um e-mail válido para o novo usuário Master.'});
    const installationProfile=resolveInstallationProfile(currentSettings);
    if(installationProfile.internalEmailDomains.length&&!emailMatchesDomains(normNewMaster,installationProfile.internalEmailDomains))return res.status(400).json({error:`O novo usuário Master deve usar um domínio institucional autorizado: ${installationProfile.internalEmailDomains.join(', ')}.`});
    const oldMaster = currentSettings.masterEmail;

    const sessionValidAfter=Math.floor(Date.now()/1000)+1;
    currentSettings.masterEmail = normNewMaster;
    currentSettings.ownerEmail = normNewMaster;
    currentSettings.sessionValidAfter=sessionValidAfter;
    currentSettings.isSystemBlocked = false; // Unblock system upon successful emergency recovery
    currentSettings.updatedAt = new Date().toISOString();
    administrationTransfersStore=administrationTransfersStore.map(transfer=>transfer.status==='PENDING_TARGET_ACCEPTANCE'?{...transfer,status:'CANCELED',canceledAt:currentSettings.updatedAt}:transfer);
    await Promise.all([deleteIntegrationSecret('asten'),deleteIntegrationSecret('google_workspace')]);

    auditLogsStore.push({
      id: `log-${Date.now()}`,
      actorEmail: normRecovery,
      actorRoles: ['MASTER_ADMIN'],
      action: 'TROCA_DONO_EMERGENCIA_MASTER',
      entityType: 'security',
      entityId: 'master_account',
      before: { masterEmail: oldMaster },
      after: { masterEmail: normNewMaster, recoveredBy: normRecovery, isSystemBlocked: false,allSessionsRevoked:true,integrationsDisconnected:true },
      timestamp: new Date().toISOString()
    });

    persistPortalState();

    res.json({
      success: true,
      message: `Dono do site trocado com sucesso. O novo Master é ${normNewMaster}; todas as sessões foram revogadas e Google/Asten precisam ser reconectados.`,
      newMasterEmail: normNewMaster
    });
  });

  // POST /api/demo/seed
  app.post('/api/demo/seed', requireAuthenticated, requireAdministrator, (req, res) => {
    if(productionRuntime||process.env.PORTAL_PERSISTENCE_PROVIDER!=='local_file'||!getPortalIdentity(req)?.isDemo)return res.status(404).json({error:'Rota de demonstração desativada.'});
    processesStore = structuredClone(DEMO_PROCESSES).map(cleanProcessIdentifiers);
    historicalProcessIdentifiers.clear();
    membershipsStore = JSON.parse(JSON.stringify(DEMO_MEMBERSHIPS));
    auditLogsStore = JSON.parse(JSON.stringify(DEMO_AUDIT_LOGS));
    correctionRequestsStore = [];
    signatureJobsStore=[];astenCallbackFingerprints.clear();
    currentSettings = { ...INITIAL_SETTINGS };
    googleCalendarEventsStore = generateGoogleEventsFromProcesses(processesStore);
    persistPortalState();

    res.json({ message: 'Dados de demonstração restaurados com sucesso.' });
  });

  app.use('/api', (_req, res) => { res.status(404).json({ error: 'Operação não encontrada.', code: 'API_NOT_FOUND' }); });
  app.use(portalHttpError);

  // Vite middleware for dev or Static serve for production
  if (!serveCompiledClient) {
    const vite = await createViteServer({
      html: { cspNonce: developmentNonce },
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist', 'client');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  return app;
}

if (!process.env.VERCEL) {
  createPortalApp().then((app)=>{
    if(reviewSeed){persistPortalState(true);console.log('[Portal TCC] Base local vazia preenchida com exemplos de demonstração.');}
    const port=Number(process.env.PORT||3000);
    const host=process.env.HOST||(productionRuntime?'0.0.0.0':'127.0.0.1');
    app.listen(port,host,()=>console.log(`[Portal TCC] Server listening on http://${host}:${port}`));
  }).catch((error)=>{console.error('[Portal TCC] Falha ao iniciar:',error);process.exitCode=1;});
}
