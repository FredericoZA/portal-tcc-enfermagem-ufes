import { inspectPdfLayout, markPreview } from './server/workflow/documentQuality';
import { acceptEvaluation, EvaluationError } from './server/workflow/evaluation';
import { EVALUATION_FORM_ID } from './src/utils/evaluationForm';
import { NATIVE_PROCESS_FORM_IDS, validateFormAnswers } from './src/utils/studioFormAnswers';
import { createPortalHttpApp, portalHttpError } from './server/httpApp';
import { normalizeUnifiedAppearance } from './src/utils/unifiedAppearance';
import { previewProcess } from './server/workflow/modelPreview';
import { compareStudioVersions } from './src/utils/studioDiff';
import { plannedDeadlines, claimableReminder } from './server/workflow/deadlines';
import { buildRecoveryQueue } from './server/workflow/recovery';
import { renderReminder } from './server/workflow/reminders';
import { buildInstitutionalReport, institutionalReportTheme } from './server/institutionalReport';
import { saveRegistrationDraft, pruneDrafts, DraftConflict } from './server/workflow/drafts';
import { workflowPolicy, registrationFindings } from './src/utils/workflowOperations';
import type { RegistrationDraft, ReminderRecord } from './src/types/workflowOperations';
import { buildAdvancedAnalytics, analyticsCsv, analyticsMarkdown } from './server/advancedAnalytics';
import { simulateWorkflow } from './server/workflow/simulator';
import { acceptRegistration } from './server/workflow/registration';
import { ataArchived, declarationReady } from './server/workflow/gates';
import { operationalConfig, presentVariables } from './src/utils/operationalConfig';
import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'fs';
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'crypto';
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
  SignatureJobStatus,
  AuthorizedStudent,
  NotificationPreferences,
  DataSubjectRequest,
  LegalHold,
  StudioVersionRecord,
  StudioFormSubmission,
  ContinuousIntelligenceState,
  ContinuousIntelligenceOverview,
  ImprovementStatus,
  LivingPortalArtifactKind
} from './src/types';
import type { AcademicCycle, PortalFeatureKey } from './src/types';
import type { AstenWebhookEvent, EmailDeliveryRecord, WorkflowRun, WorkflowEventCode } from './src/types/automation';
import { normalizeEmail, formatStudentsString, formatDatePt, formatDateExtensoTotal, formatTimeExtenso } from './src/utils/formatters';
import {
  enrichProcessDocumentsWithDrive
} from './src/services/serverDriveSync';
import { updateRuntimeDocumentTemplates } from './src/utils/documentTemplateEngine';
import { assertPortalSessionConfigured, attachPortalIdentity, clearPortalSessionCookie, getPortalIdentity, hasRecentAuthentication, requireAuthenticated, setPortalSessionCookie } from './server/security/firebaseAuth';
import { assertAstenEnvelopeSigners, buildAstenEnvelopeParams, callAsten, connectPersistentAsten, extractAstenEnvelopeIdentity, getAstenSecurityPreflight, getPersistentAstenConnection, getPersistentAstenStatus, safeCompareWebhookSecret } from './server/integrations/asten';
import { appendSupabaseAuditEvent, claimAstenEnvelopeDispatch, getSupabaseRuntimeStatus, loadPortalRuntimeState, savePortalRuntimeState, testSupabaseRuntimeConnection, updateAstenEnvelopeDispatch } from './server/integrations/supabase';
import { createProfessionalPdf } from './server/documents/simplePdf';
import { extractAstenSignedPdf } from './server/integrations/asten';
import { buildProcessArchiveFileName, downloadDrivePdf, ensurePortalProcessDriveFolder, uploadGeneratedPdfToDrive, uploadProcessFormPdf, uploadProcessSourcePdf, uploadSignedPdfToDrive, type ProcessFormArchiveType } from './server/integrations/googleDriveArchive';
import { renderGoogleDriveTemplateToPdf } from './server/integrations/googleDocsRenderer';
import { dispatchTrackedEmail } from './server/integrations/trackedGmail';
import { buildProcessVariables, compileWorkflow, executeWorkflowEvent, mergeWorkflowHtmlVariables, mergeWorkflowVariables, normalizeWorkflowEventCode, parseRecipients } from './server/workflow/runtime';
import { buildAstenOperationalDashboard, mapAstenEventToJobStatus, normalizeAstenWebhookEvent } from './server/integrations/astenEventLedger';
import { buildPortalDriveFileName } from './src/services/googleDriveOrganizer';
import { getOtpRuntimeStatus, requestPortalOtp, verifyPortalOtp } from './server/security/portalOtp';
import { bootstrapGoogleDriveStructure, buildGoogleAuthorizationUrl, decodeGoogleOAuthState, exchangeGoogleAuthorizationCode, getGoogleOAuthSecurityPreflight, getGoogleWorkspaceAccessToken, getGoogleWorkspaceStatus, persistGoogleWorkspaceAuthorization, publishMasterDocumentModel, registerMasterDocumentModelFromDrive, sendGmailMessage, synchronizeDefenseCalendar, upsertLivingIntelligenceFile, verifyMasterDocumentModelFingerprint, verifyPrivateDriveFolder } from './server/integrations/googleWorkspace';
import { deleteIntegrationSecret, getSecretStoreStatus } from './server/integrations/integrationSecrets';
import { buildProtocol, emailMatchesDomains, isPortalFeatureEnabled, resolveInstallationProfile } from './src/utils/installationProfile';
import { evaluateStudioCondition, validateCourseStudio, validateStudioAnswer } from './src/utils/courseStudioValidator';
import { cleanupExpiredDownloadTransfers, cleanupExpiredStagedUploads, createSupabaseEphemeralDownload, createSupabaseStagedUpload, getSupabaseStagingSecurityStatus, shouldUseSupabaseDownloadGateway, withSupabaseStagedUpload, type StagedUploadPurpose } from './server/integrations/supabaseStorageStaging';
import { buildContinuousIntelligenceState, renderStatisticalReport, type ContinuousIntelligenceInput } from './server/continuousIntelligence';

// A Vercel injeta as variáveis diretamente. Em desenvolvimento, carregamos
// primeiro o arquivo recomendado pelo guia e depois o .env convencional, sem
// sobrescrever valores fornecidos pelo sistema operacional.
dotenv.config({path:'.env.local',override:false,quiet:true});
dotenv.config({path:'.env',override:false,quiet:true});

interface PersistedPortalState {
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
  formArchiveJobs?: FormArchiveJob[];
  emailDeliveries?: EmailDeliveryRecord[];
  workflowRuns?: WorkflowRun[];
  astenWebhookEvents?: AstenWebhookEvent[];
  administrationTransfers?: AdministrationTransfer[];
  notificationPreferences?: Record<string, NotificationPreferences>;
  dataSubjectRequests?: DataSubjectRequest[];
  legalHolds?: LegalHold[];
  studioVersions?: StudioVersionRecord[];
  studioFormSubmissions?: StudioFormSubmission[];
  continuousIntelligence?: ContinuousIntelligenceState;
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
  status:'PENDING'|'ARCHIVED'|'FAILED';driveFileId?:string;fileName?:string;lastError?:string;createdAt:string;updatedAt:string;
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
let reminderRecordsStore:ReminderRecord[]=persistedPortalState.reminders||[];
const productionRuntime=process.env.NODE_ENV==='production'||Boolean(process.env.VERCEL);
const bootstrapMasterEmail=normalizeEmail(String(process.env.PORTAL_BOOTSTRAP_MASTER_EMAIL||''));

// The integrated configuration and its audit history survive server restarts.
let currentSettings: GlobalSettings = productionRuntime
  ? {...INITIAL_SETTINGS,masterEmail:bootstrapMasterEmail,ownerEmail:bootstrapMasterEmail,commissionPresidentEmail:'',masterRecoveryEmails:[],...(persistedPortalState.settings||{})}
  : { ...INITIAL_SETTINGS, ...(persistedPortalState.settings || {}) };
delete (currentSettings as any).recoverySecretKey;
delete (currentSettings as any).courseCoordinatorEmail;
delete (currentSettings as any).courseCoordinatorName;
for(const model of Object.values(currentSettings.documentModels||{}))if(model)model.templateContentText='';
if(!productionRuntime&&process.env.PORTAL_TEST_DOCUMENT_RENDERER==='true'){
  const now=new Date().toISOString();const labels={CONVITE:'Carta-convite',ATA:'Ata de defesa',TERMO:'Termo de autorização',DECLARACAO:'Declaração'} as const;
  currentSettings.documentModels=Object.fromEntries(Object.entries(labels).map(([type,label])=>[type,{id:`test-${type.toLowerCase()}`,type,label,fileName:`${type}.docx`,templateContentText:'',driveFileId:`test_drive_${type.toLowerCase()}_001`,driveFileUrl:'',variables:[],uploadedAt:now,uploadedBy:'test@local'}])) as GlobalSettings['documentModels'];
}
let processesStore: ProcessData[] = persistedPortalState.processes?.length ? persistedPortalState.processes : productionRuntime?[]:JSON.parse(JSON.stringify(DEMO_PROCESSES));
let membershipsStore: ProcessMembership[] = persistedPortalState.memberships?.length ? persistedPortalState.memberships : productionRuntime?[]:JSON.parse(JSON.stringify(DEMO_MEMBERSHIPS));
let auditLogsStore: AuditLog[] = persistedPortalState.auditLogs?.length
  ? persistedPortalState.auditLogs
  : productionRuntime?[]:JSON.parse(JSON.stringify(DEMO_AUDIT_LOGS));
let correctionRequestsStore: DocumentCorrectionRequest[] = persistedPortalState.correctionRequests || [];
let signatureJobsStore: SignatureJob[] = (persistedPortalState.signatureJobs || []).filter((job) => job.documentType !== ('FOLHA_APROVACAO' as any));
let astenCallbackFingerprints = new Set<string>(persistedPortalState.astenCallbackFingerprints || []);
let revokedSessionIdsStore = new Set<string>(persistedPortalState.revokedSessionIds || []);
let authorizedStudentsStore: AuthorizedStudent[] = persistedPortalState.authorizedStudents || (productionRuntime?[]:DEMO_PROCESSES.flatMap((process) => [process.aluno1, process.aluno2].filter(Boolean).map((student: any) => ({
  id: `student-${normalizeEmail(student.email).replace(/[^a-z0-9]/g, '-')}`,
  nome: student.nome,
  email: normalizeEmail(student.email),
  matricula: student.matricula,
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
let notificationPreferencesStore:Record<string,NotificationPreferences>=persistedPortalState.notificationPreferences||{};
let dataSubjectRequestsStore:DataSubjectRequest[]=persistedPortalState.dataSubjectRequests||[];
let legalHoldsStore:LegalHold[]=persistedPortalState.legalHolds||[];
let studioVersionsStore:StudioVersionRecord[]=persistedPortalState.studioVersions||[];
let studioFormSubmissionsStore:StudioFormSubmission[]=persistedPortalState.studioFormSubmissions||[];
let continuousIntelligenceStore:ContinuousIntelligenceState=persistedPortalState.continuousIntelligence||buildContinuousIntelligenceState({
  processes:processesStore,
  workflowRuns:workflowRunsStore,
  emailDeliveries:emailDeliveriesStore,
  signatureJobs:signatureJobsStore,
  formSubmissions:studioFormSubmissionsStore,
  correctionRequests:correctionRequestsStore,
  courseName:resolveInstallationProfile(currentSettings).courseName,
  institutionName:resolveInstallationProfile(currentSettings).institutionName,
  actor:'SYSTEM'
});
let intelligenceRefreshPromise:Promise<ContinuousIntelligenceState>|null=null;
const otpIpBuckets=new Map<string,{startedAt:number;count:number}>();
function allowOtpRequestFromIp(ip:string):boolean{const key=createHash('sha256').update(`${process.env.PORTAL_OTP_PEPPER||'local'}|${ip||'unknown'}`).digest('hex');const now=Date.now();const current=otpIpBuckets.get(key);if(!current||now-current.startedAt>15*60_000){otpIpBuckets.set(key,{startedAt:now,count:1});return true;}current.count++;return current.count<=10;}
const publicDownloadBuckets=new Map<string,{startedAt:number;count:number}>();
function allowPublicDownload(ip:string):boolean{const key=createHash('sha256').update(`${process.env.PORTAL_OTP_PEPPER||'local'}|download|${ip||'unknown'}`).digest('hex');const now=Date.now();const current=publicDownloadBuckets.get(key);if(!current||now-current.startedAt>60_000){publicDownloadBuckets.set(key,{startedAt:now,count:1});return true;}current.count++;return current.count<=20;}
async function enforceMinimumResponseTime(startedAt:number,milliseconds=800):Promise<void>{const remaining=milliseconds-(Date.now()-startedAt);if(remaining>0)await new Promise(resolve=>setTimeout(resolve,remaining));}

function sessionUploadBinding(identity:{uid:string;issuedAt:number}):string{return `session:${identity.uid}:${identity.issuedAt}`;}
function verificationUploadBinding(code:string):string{return `public-verification:${code}`;}
function safeDownloadFileName(value:string):string{return String(value||'documento.pdf').normalize('NFKC').replace(/[\u0000-\u001f\u007f\\/]/g,'_').trim().slice(0,180)||'documento.pdf';}
function supabaseConnectOrigin():string{
  try{const parsed=new URL(String(process.env.SUPABASE_URL||''));return parsed.protocol==='https:'?parsed.origin:'';}catch{return'';}
}
async function deliverPortalDownload(input:{res:express.Response;bytes:Buffer;fileName:string;mimeType:'application/pdf'|'application/zip';requesterBinding:string;cacheControl:string}):Promise<void>{
  const fileName=safeDownloadFileName(input.fileName);
  input.res.setHeader('Cache-Control',input.cacheControl);
  input.res.setHeader('X-Content-Type-Options','nosniff');
  if(shouldUseSupabaseDownloadGateway()){
    const transfer=await createSupabaseEphemeralDownload({bytes:input.bytes,fileName,mimeType:input.mimeType,requesterBinding:input.requesterBinding,expiresInSeconds:60});
    input.res.setHeader('X-Portal-Download-Expires-At',transfer.expiresAt);
    input.res.redirect(303,transfer.url);
    return;
  }
  input.res.setHeader('Content-Type',input.mimeType);
  input.res.setHeader('Content-Disposition',`attachment; filename="${fileName.replace(/"/g,'_')}"; filename*=UTF-8''${encodeURIComponent(fileName)}`);
  input.res.send(input.bytes);
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

function upsertAuthorizedAccess(input:{nome:string;email:string;processId?:string;matricula?:string;role:ProcessRole;origin:'MASTER_LIST'|'TCC_FORM';actor:string;active?:boolean}):AuthorizedStudent{
  const email=normalizeEmail(input.email);const now=new Date().toISOString();
  const index=authorizedStudentsStore.findIndex(entry=>normalizeEmail(entry.email)===email);
  const accessType=input.role;
  if(index>=0){
    const current=authorizedStudentsStore[index];
    const shouldRemainRevoked=Boolean(current.manualRevocation&&input.active===undefined);
    const updated:AuthorizedStudent={...current,nome:input.nome||current.nome,matricula:input.matricula||current.matricula,active:shouldRemainRevoked?false:(input.active??(input.processId?true:current.active)),processIds:Array.from(new Set([...current.processIds,...(input.processId?[input.processId]:[])])),roles:Array.from(new Set([...(current.roles||[current.accessType||'STUDENT']),input.role])) as ProcessRole[],accessType:current.accessType||accessType,origin:current.origin==='MASTER_LIST'?'MASTER_LIST':input.origin,updatedAt:now};
    authorizedStudentsStore[index]=updated;return updated;
  }
  const entry:AuthorizedStudent={id:`access-${Date.now()}-${Math.random().toString(36).slice(2,8)}`,nome:input.nome,email,matricula:input.matricula,active:input.active??true,processIds:input.processId?[input.processId]:[],createdAt:now,createdBy:input.actor,updatedAt:now,accessType,origin:input.origin,roles:[input.role]};
  authorizedStudentsStore.push(entry);return entry;
}

function reconcileAuthorizationListFromProcesses():void{
  for(const process of processesStore){
    upsertAuthorizedAccess({nome:process.aluno1.nome,email:process.aluno1.email,matricula:process.aluno1.matricula,processId:process.id,role:'STUDENT',origin:'TCC_FORM',actor:process.createdByEmail});
    if(process.aluno2)upsertAuthorizedAccess({nome:process.aluno2.nome,email:process.aluno2.email,matricula:process.aluno2.matricula,processId:process.id,role:'STUDENT',origin:'TCC_FORM',actor:process.createdByEmail});
    upsertAuthorizedAccess({nome:process.orientador.nome,email:process.orientador.email,processId:process.id,role:'ADVISOR',origin:'TCC_FORM',actor:process.createdByEmail});
    if(process.coorientador)upsertAuthorizedAccess({nome:process.coorientador.nome,email:process.coorientador.email,processId:process.id,role:'CO_ADVISOR',origin:'TCC_FORM',actor:process.createdByEmail});
    for(const examiner of process.banca)upsertAuthorizedAccess({nome:examiner.nome,email:examiner.email,processId:process.id,role:examiner.funcao==='ORIENTADOR'?'ADVISOR':'EXAMINER',origin:'TCC_FORM',actor:process.createdByEmail});
  }
}
reconcileAuthorizationListFromProcesses();

function synchronizeProcessParticipants(process:ProcessData,actor:string):void{
  const participants=new Map<string,{nome:string;matricula?:string;roles:Set<ProcessRole>}>();
  const add=(nome:string,email:string,role:ProcessRole,matricula?:string)=>{const key=normalizeEmail(email);const current=participants.get(key)||{nome,matricula,roles:new Set<ProcessRole>()};current.nome=nome||current.nome;current.matricula=matricula||current.matricula;current.roles.add(role);participants.set(key,current);};
  add(process.aluno1.nome,process.aluno1.email,'STUDENT',process.aluno1.matricula);if(process.aluno2)add(process.aluno2.nome,process.aluno2.email,'STUDENT',process.aluno2.matricula);add(process.orientador.nome,process.orientador.email,'ADVISOR');if(process.coorientador)add(process.coorientador.nome,process.coorientador.email,'CO_ADVISOR');for(const examiner of process.banca)add(examiner.nome,examiner.email,examiner.funcao==='ORIENTADOR'?'ADVISOR':'EXAMINER');
  for(const entry of authorizedStudentsStore){if(entry.processIds.includes(process.id)&&!participants.has(normalizeEmail(entry.email))){entry.processIds=entry.processIds.filter(id=>id!==process.id);if(entry.origin==='TCC_FORM'&&!entry.processIds.length)entry.active=false;entry.updatedAt=new Date().toISOString();}}
  membershipsStore=membershipsStore.filter(membership=>membership.processId!==process.id);
  let index=0;for(const[email,participant]of participants){const roles=Array.from(participant.roles);for(const role of roles)upsertAuthorizedAccess({nome:participant.nome,email,matricula:participant.matricula,processId:process.id,role,origin:'TCC_FORM',actor});membershipsStore.push({id:`mem-${process.id}-${index++}`,processId:process.id,email,roles,active:true,createdAt:process.createdAt,updatedAt:new Date().toISOString()});}
}

let remotePersistenceQueue: Promise<void> = Promise.resolve();

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
  return { registrationDrafts:registrationDraftsStore, reminders:reminderRecordsStore, settings: currentSettings, processes: processesStore, memberships: membershipsStore, correctionRequests: correctionRequestsStore, signatureJobs: signatureMetadata, astenCallbackFingerprints: Array.from(astenCallbackFingerprints).slice(-5000), revokedSessionIds:Array.from(revokedSessionIdsStore).slice(-10000), authorizedStudents: authorizedStudentsStore, formArchiveJobs:formMetadata, studioFormSubmissions:studioFormSubmissionsStore.slice(-10000),emailDeliveries:emailDeliveriesStore.slice(-10000),workflowRuns:workflowRunsStore.slice(-10000),astenWebhookEvents:astenWebhookEventsStore.slice(-10000),administrationTransfers:administrationTransfersStore.slice(-1000),notificationPreferences:notificationPreferencesStore,dataSubjectRequests:dataSubjectRequestsStore.slice(-5000),legalHolds:legalHoldsStore.slice(-5000),studioVersions:studioVersionsStore.slice(-30),continuousIntelligence:continuousIntelligenceStore,auditLogs: auditLogsStore.slice(-5000) };
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
  registrationDraftsStore=pruneDrafts(state.registrationDrafts||{});
  reminderRecordsStore=state.reminders||[];
  if (state.settings) { currentSettings = normalizeUnifiedAppearance({ ...INITIAL_SETTINGS, ...state.settings }); delete (currentSettings as any).recoverySecretKey;delete (currentSettings as any).courseCoordinatorEmail;delete (currentSettings as any).courseCoordinatorName;for(const model of Object.values(currentSettings.documentModels||{}))if(model)model.templateContentText=''; }
  if (state.processes) processesStore = state.processes;
  if (state.memberships) membershipsStore = state.memberships;
  if (state.auditLogs) auditLogsStore = state.auditLogs;
  if (state.correctionRequests) correctionRequestsStore = state.correctionRequests;
  if (state.signatureJobs) signatureJobsStore = state.signatureJobs.filter((job) => job.documentType !== ('FOLHA_APROVACAO' as any));
  if (state.astenCallbackFingerprints) astenCallbackFingerprints = new Set(state.astenCallbackFingerprints);
  if (state.revokedSessionIds) revokedSessionIdsStore = new Set(state.revokedSessionIds);
  if (state.authorizedStudents) authorizedStudentsStore = state.authorizedStudents;
  if (state.formArchiveJobs) formArchiveJobsStore = state.formArchiveJobs;
  if (state.emailDeliveries) emailDeliveriesStore = state.emailDeliveries;
  if (state.workflowRuns) workflowRunsStore = state.workflowRuns;
  if (state.astenWebhookEvents) astenWebhookEventsStore = state.astenWebhookEvents;
  if (state.administrationTransfers) administrationTransfersStore = state.administrationTransfers;
  if (state.notificationPreferences) notificationPreferencesStore = state.notificationPreferences;
  if (state.dataSubjectRequests) dataSubjectRequestsStore = state.dataSubjectRequests;
  if (state.legalHolds) legalHoldsStore = state.legalHolds;
  if (state.studioVersions) studioVersionsStore = state.studioVersions;
  if (state.studioFormSubmissions) studioFormSubmissionsStore = state.studioFormSubmissions;
  if (state.continuousIntelligence) continuousIntelligenceStore = state.continuousIntelligence;
  protocolCounter = processesStore.length + 1;
  googleCalendarEventsStore = generateGoogleEventsFromProcesses(processesStore);
  publishRuntimeTemplatesFromSettings();
}

function publicContinuousIntelligence():ContinuousIntelligenceOverview{
  const artifacts=Object.fromEntries(Object.entries(continuousIntelligenceStore.artifacts).map(([kind,artifact])=>{
    const{markdown:_markdown,...summary}=artifact;
    return[kind,summary];
  })) as ContinuousIntelligenceOverview['artifacts'];
  return{...continuousIntelligenceStore,artifacts};
}

async function refreshContinuousIntelligence(actor:'SYSTEM'|'MASTER',actorEmail='system@portal.local',syncDrive=true):Promise<ContinuousIntelligenceState>{
  if(intelligenceRefreshPromise)return intelligenceRefreshPromise;
  intelligenceRefreshPromise=(async()=>{
    const profile=resolveInstallationProfile(currentSettings);
    const intelligenceInput:ContinuousIntelligenceInput={
      studio:currentSettings.integrationStudio,
      processes:processesStore,
      workflowRuns:workflowRunsStore,
      emailDeliveries:emailDeliveriesStore,
      signatureJobs:signatureJobsStore,
      formSubmissions:studioFormSubmissionsStore,
      correctionRequests:correctionRequestsStore,
      courseName:profile.courseName,
      institutionName:profile.institutionName,
      actor,
      previous:continuousIntelligenceStore
    };
    const next=buildContinuousIntelligenceState({...intelligenceInput,statisticalAppendix:analyticsMarkdown(buildAdvancedAnalytics(intelligenceInput))});
    if(!syncDrive||!currentSettings.driveRootFolderId){
      for(const artifact of Object.values(next.artifacts))artifact.driveSyncStatus='NOT_CONFIGURED';
    }else{
      try{
        const accessToken=await getGoogleWorkspaceAccessToken();
        for(const artifact of Object.values(next.artifacts)){
          try{
            const uploaded=await upsertLivingIntelligenceFile({
              accessToken,
              rootFolderId:currentSettings.driveRootFolderId,
              fileName:artifact.fileName,
              content:artifact.markdown,
              kind:artifact.kind,
              sha256:artifact.sha256,
              version:artifact.version,
              generatedAt:artifact.generatedAt
            });
            artifact.driveSyncStatus='SYNCED';
            artifact.driveFileId=uploaded.id;
            artifact.driveWebViewLink=uploaded.webViewLink;
            artifact.driveSyncedAt=new Date().toISOString();
            delete artifact.driveError;
          }catch(error){
            artifact.driveSyncStatus='FAILED';
            artifact.driveError=(error instanceof Error?error.message:'Falha ao sincronizar com o Drive.').slice(0,500);
          }
        }
      }catch(error){
        const message=(error instanceof Error?error.message:'Conta Google indisponível.').slice(0,500);
        for(const artifact of Object.values(next.artifacts)){artifact.driveSyncStatus='FAILED';artifact.driveError=message;}
      }
    }
    continuousIntelligenceStore=next;
    const now=new Date().toISOString();
    auditLogsStore.push({id:`log-${Date.now()}-continuous-intelligence`,actorEmail,actorRoles:actor==='MASTER'?getUserRolesForEmail(actorEmail).globalRoles:[],action:'ATUALIZACAO_INTELIGENCIA_CONTINUA',entityType:'continuous_intelligence',entityId:`version-${next.artifacts.TCC_STATISTICAL_REPORT.version}`,after:{actor,proposalsActive:next.proposals.filter(item=>item.evidenceActive).length,drive:Array.from(new Set(Object.values(next.artifacts).map(item=>item.driveSyncStatus)))},timestamp:now});
    await persistPortalStateDurably();
    return next;
  })().finally(()=>{intelligenceRefreshPromise=null;});
  return intelligenceRefreshPromise;
}

function publishRuntimeTemplatesFromSettings() {
  // Os modelos pertencem ao Drive do Master. O portal mantém somente metadados
  // e nunca persiste uma cópia textual ou binária do conteúdo do modelo.
  updateRuntimeDocumentTemplates([]);
}

function decodeXmlEntities(value:string):string{return value.replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&apos;/g,"'");}
export async function extractDocxTemplateText(buffer:Buffer):Promise<{text:string;variables:string[]}>{
  const zip=await JSZip.loadAsync(buffer);const names=Object.keys(zip.files).filter(name=>/^word\/(document|header\d*|footer\d*)\.xml$/.test(name));
  if(!names.includes('word/document.xml'))throw new Error('DOCX inválido: o documento principal não foi encontrado.');
  const pieces:string[]=[];
  for(const name of names){const xml=await zip.file(name)!.async('string');const text=decodeXmlEntities(xml.replace(/<w:tab\/?\s*>/g,'\t').replace(/<\/w:p>/g,'\n').replace(/<\/w:tr>/g,'\n').replace(/<[^>]+>/g,''));if(text.trim())pieces.push(text.trim());}
  const text=pieces.join('\n\n').replace(/\n{3,}/g,'\n\n').trim();if(!text)throw new Error('O modelo DOCX não contém texto utilizável.');
  const variables=Array.from(new Set(text.match(/<<[^<>]{2,100}>>|\{\{[^{}]{2,100}\}\}|-[A-Z][A-Z0-9_]{2,80}-/g)||[]));
  return {text,variables};
}

// Helper to sync Google Calendar Store from Processes Store
function generateGoogleEventsFromProcesses(procs: ProcessData[]): GoogleCalendarSyncedEvent[] {
  return procs
    .filter(p => p.defesa && p.defesa.startAt && p.defesa.localStatus === 'CONFIRMADO')
    .map(p => {
      const studentName = formatStudentsString(p.aluno1, p.aluno2);
      const coorientadorPart = p.coorientador ? `\nCoorientador: ${p.coorientador.nome}` : '';
      const bancaPart = p.banca && p.banca.length > 0 ? `\nBanca: ${p.banca.map(b => b.nome).join(', ')}` : '';
      return {
        id: `gcal-${p.id}`,
        summary: `Defesa de TCC - Apresentação: ${studentName}`,
        description: `Trabalho: ${p.titulo}\nOrientador: ${p.orientador?.nome || 'Não definido'}${coorientadorPart}${bancaPart}\nProtocolo: ${p.protocolo}`,
        location: p.defesa.local || resolveInstallationProfile(currentSettings).defaultDefenseLocation,
        start: p.defesa.startAt,
        end: p.defesa.endAt || new Date(new Date(p.defesa.startAt).getTime() + 90 * 60 * 1000).toISOString(),
        syncedAt: new Date().toISOString()
      };
    });
}

// Cache of Google Calendar synced events from the Master Account
let googleCalendarEventsStore: GoogleCalendarSyncedEvent[] = generateGoogleEventsFromProcesses(processesStore);

// Helper counter for TCC protocols
let protocolCounter = processesStore.length + 1;

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
  );

  return { globalRoles, memberships };
}

// Generate default simulated documents for a process using official base model templates
function generateDefaultDocuments(process: ProcessData): ProcessDocument[] {
  const isEvaluated = process.avaliacao.status === 'CONCLUIDO';
  const locationConfirmed = process.defesa.localStatus === 'CONFIRMADO';
  const invitationReady=locationConfirmed&&Boolean(process.defesa.invitationDriveFileId&&process.defesa.invitationSentAt);
  const repositoryReady = repositoryDataComplete(process);
  const needsPublicationTerm = publicationRequested(process) && Boolean(process.acervo?.authorizationConfirmedAt);
  const configuredModels=currentSettings.documentModels||{};

  const rawDocs: ProcessDocument[] = [
    {
      id: 'doc-convite',
      type: 'CONVITE',
      title: `1. Convite de Banca Examinadora - ${process.titulo}`,
      status: invitationReady && Boolean(configuredModels.CONVITE) ? 'DISPONIVEL' : 'NAO_DISPONIVEL',
      visibleToRoles: ['STUDENT', 'ADVISOR', 'CO_ADVISOR', 'EXAMINER'],
      requiresSignature: false,
      currentVersion: 1,
      createdAt: process.createdAt,
      updatedAt: process.updatedAt,
      driveFileId:process.defesa.invitationDriveFileId,
      driveDownloadUrl:invitationReady?`/api/processes/${process.id}/documents/doc-convite/download`:undefined,
      versions: invitationReady && configuredModels.CONVITE ? [
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
      title: `2. Ata Oficial da Defesa Final - ${process.titulo}`,
      status: isEvaluated && Boolean(configuredModels.ATA) ? 'AGUARDANDO_ASSINATURA' : 'NAO_DISPONIVEL',
      visibleToRoles: ['STUDENT', 'ADVISOR', 'CO_ADVISOR', 'EXAMINER'],
      requiresSignature: true,
      currentVersion: 1,
      createdAt: process.createdAt,
      updatedAt: process.updatedAt,
      versions: isEvaluated && configuredModels.ATA ? [
        {
          id: 'v1',
          version: 1,
          sourceDataRevision: process.dataRevision,
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
      title: `3. Termo de Autorização para Publicação - ${process.titulo}`,
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
      title: `4. Declaração da Banca Examinadora - ${process.titulo}`,
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

  const applicableDocs=rawDocs.filter(doc=>doc.type!=='TERMO'||publicationRequested(process));
  const latestJobs=new Map<string,SignatureJob>();
  for(const job of signatureJobsStore.filter(item=>item.processId===process.id&&item.status!=='CANCELED')){const current=latestJobs.get(job.documentType);if(!current||job.documentVersion>current.documentVersion)latestJobs.set(job.documentType,job);}
  const withSignatureState=applicableDocs.map(doc=>{
    const job=latestJobs.get(doc.type);if(!job)return doc;
    const status=job.status==='ARCHIVED'?'ASSINADO':job.status==='PROVIDER_ERROR'||job.status==='DECLINED'||job.status==='EXPIRED'?'COM_ERRO':'AGUARDANDO_ASSINATURA';
    return{...doc,status:status as ProcessDocument['status'],currentVersion:job.documentVersion,updatedAt:job.updatedAt,driveFileId:job.driveSignedFileId,driveDownloadUrl:job.status==='ARCHIVED'?`/api/processes/${process.id}/documents/${doc.id}/download`:undefined};
  });
  return enrichProcessDocumentsWithDrive(withSignatureState, process);
}

function redactSensitiveValues<T>(input:T):T{if(Array.isArray(input))return input.map(redactSensitiveValues) as T;if(!input||typeof input!=='object')return input;const output:Record<string,unknown>={};for(const[key,value]of Object.entries(input as Record<string,unknown>)){if(/(secret|token|password|credential|api[_-]?key)/i.test(key))continue;output[key]=redactSensitiveValues(value);}return output as T;}
function containsSensitiveConfigurationKey(input: unknown): boolean { if (!input || typeof input !== 'object') return false; if (Array.isArray(input)) return input.some(containsSensitiveConfigurationKey); return Object.entries(input as Record<string, unknown>).some(([key, value]) => /(secret|token|password|credential|api[_-]?key|service[_-]?role|private[_-]?key)/i.test(key) || containsSensitiveConfigurationKey(value)); }
function publicSettingsForRequest(admin:boolean):GlobalSettings{const safe=normalizeUnifiedAppearance(redactSensitiveValues(JSON.parse(JSON.stringify(currentSettings))) as GlobalSettings);delete (safe as any).courseCoordinatorEmail;delete (safe as any).courseCoordinatorName;if(!admin){delete safe.masterRecoveryEmails;delete safe.documentModels;delete safe.templateIds;delete safe.emailConfig;delete safe.integrationStudio;delete safe.masterEmail;delete safe.ownerEmail;delete safe.commissionPresidentEmail;delete safe.driveRootFolderId;}return safe;}
function preserveCurrentDriveBindings(snapshot:any,current?:ProcessData):ProcessData{
  const restored=JSON.parse(JSON.stringify(snapshot||{}));
  restored.driveFolderId=current?.driveFolderId;restored.driveFolderUrl=current?.driveFolderUrl;restored.driveSyncedAt=current?.driveSyncedAt;
  restored.defesa={...(restored.defesa||{}),invitationDriveFileId:current?.defesa?.invitationDriveFileId,locationProof:current?.defesa?.locationProof||restored.defesa?.locationProof};
  const source=current?.acervo||{};const target=restored.acervo||{};
  for(const key of ['trabalhoCompletoFileId','trabalhoCompletoFileName','trabalhoCompletoFileUrl','trabalhoCompletoSha256','trabalhoCompletoVersion','resumoExpandidoFileId','resumoExpandidoFileName','resumoExpandidoFileUrl','resumoExpandidoSha256','resumoExpandidoVersion'] as const){if((source as any)[key]!==undefined)(target as any)[key]=(source as any)[key];else delete (target as any)[key];}
  restored.acervo=target;return restored as ProcessData;
}
function publicationRequested(p:ProcessData):boolean{return Boolean(p.acervo?.publishFullWork||p.acervo?.publishExpandedAbstract);}
function publicProcessView(p:ProcessData):any{
  // DTO por lista branca: nenhum campo interno é propagado por spread a uma rota anônima.
  return {
    id:p.id,protocolo:p.protocolo,titulo:p.titulo,etapaAtual:p.etapaAtual,status:p.status,
    aluno1:{nome:p.aluno1.nome,email:'',matricula:p.aluno1.matricula},aluno2:p.aluno2?{nome:p.aluno2.nome,email:'',matricula:p.aluno2.matricula}:null,
    orientador:{nome:p.orientador.nome,email:''},coorientador:p.coorientador?{nome:p.coorientador.nome,email:'',instituicao:p.coorientador.instituicao||''}:null,
    banca:p.banca.map(member=>({id:member.id,nome:member.nome,email:'',funcao:member.funcao,membroTipo:member.membroTipo,instituicao:member.instituicao,profissao:member.profissao,titulacao:member.titulacao})),
    defesa:{startAt:p.defesa.startAt,endAt:p.defesa.endAt,local:p.defesa.local,localStatus:p.defesa.localStatus},
    avaliacao:{status:p.avaliacao.status,resultadoCode:p.avaliacao.resultadoCode,resultadoLabel:p.avaliacao.resultadoLabel},
    acervo:p.acervo?{palavrasChave:[...(p.acervo.palavrasChave||[])],resumoSintese:p.acervo.resumoSintese,publishFullWork:Boolean(p.acervo.publishFullWork),publishExpandedAbstract:Boolean(p.acervo.publishExpandedAbstract),trabalhoCompletoFileUrl:p.acervo.publishFullWork?`/api/public/processes/${p.id}/files/trabalho-completo/download`:undefined,resumoExpandidoFileUrl:p.acervo.publishExpandedAbstract?`/api/public/processes/${p.id}/files/resumo-expandido/download`:undefined,submittedAt:p.acervo.submittedAt}:undefined,
    dataRevision:p.dataRevision,createdAt:p.createdAt,updatedAt:p.updatedAt
  };
}
function canAccessProcess(email:string,id:string):boolean{const r=getUserRolesForEmail(email);if(r.globalRoles.length>0)return true;const authorized=authorizedStudentsStore.some(entry=>entry.active&&normalizeEmail(entry.email)===normalizeEmail(email));return authorized&&r.memberships.some(m=>m.processId===id&&m.active);}
function hasFullAdministration(email:string):boolean{const roles=getUserRolesForEmail(email).globalRoles;return roles.includes('MASTER_ADMIN')||roles.includes('COMMISSION_PRESIDENT');}
function getActiveProcessRoles(email:string,processId:string):ProcessRole[]{return getUserRolesForEmail(email).memberships.filter(m=>m.processId===processId&&m.active).flatMap(m=>m.roles);}
function canUseStudioForm(email:string,processId:string,form:{targetRole?:string}):boolean{
  const roles=getActiveProcessRoles(email,processId);
  const global=getUserRolesForEmail(email).globalRoles;
  if(global.includes('MASTER_ADMIN')||global.includes('COMMISSION_PRESIDENT'))return true;
  const target=String(form.targetRole||'');
  if(target==='Aluno')return roles.includes('STUDENT');
  if(target==='Orientador')return roles.includes('ADVISOR')||roles.includes('CO_ADVISOR');
  if(target==='Banca')return roles.some(role=>['ADVISOR','CO_ADVISOR','EXAMINER'].includes(role));
  if(target==='Presidente da Comissão')return global.includes('COMMISSION_PRESIDENT');
  return false;
}
function studioFormIsReleased(email:string,processId:string,formId:string):boolean{
  if (NATIVE_PROCESS_FORM_IDS.has(formId)) return false;
  if(hasFullAdministration(email))return true;
  if(studioFormSubmissionsStore.some(item=>item.processId===processId&&item.formId===formId&&item.submittedBy===normalizeEmail(email)))return true;
  const taskId=`form_task_${formId}`;
  return workflowRunsStore.some(run=>run.processId===processId&&run.actions.some(action=>action.kind==='FORM'&&action.status==='COMPLETED'&&action.externalId===taskId));
}
function canInitiateSignature(email:string,process:ProcessData,type:'ATA'|'TERMO'|'DECLARACAO'):boolean{
  if(hasFullAdministration(email))return true;
  const norm=normalizeEmail(email);
  if(type==='ATA')return normalizeEmail(process.orientador.email)===norm;
  if(type==='TERMO')return normalizeEmail(process.orientador.email)===norm||[process.aluno1,process.aluno2].filter(Boolean).some(student=>normalizeEmail((student as any).email)===norm);
  return normalizeEmail(currentSettings.commissionPresidentEmail||'')===norm;
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
  if(administrationTransfersStore.some(transfer=>transfer.status==='PENDING_TARGET_ACCEPTANCE'&&new Date(transfer.expiresAt).getTime()>Date.now()&&transfer.targetEmail===normalized))return true;
  return authorizedStudentsStore.some(entry=>entry.active&&normalizeEmail(entry.email)===normalized);
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
function nextProcessProtocol():string{
  const profile=resolveInstallationProfile(currentSettings);const cycle=currentAcademicCycle();const year=cycle?.year||new Date().getFullYear();
  const prefix=profile.protocolPrefix.toUpperCase().replace(/[^A-Z0-9_-]/g,'')||'TCC';const matcher=new RegExp(`^${prefix.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}-${year}-(\\d+)$`);
  const max=processesStore.reduce((value,process)=>{const match=process.protocolo.match(matcher);return match?Math.max(value,Number(match[1])||0):value;},0);
  return buildProtocol(profile,year,max+1);
}
function participantEmails(process:ProcessData):string[]{return Array.from(new Set([process.aluno1.email,process.aluno2?.email,process.orientador.email,process.coorientador?.email,...process.banca.map(member=>member.email)].filter(Boolean).map(value=>normalizeEmail(String(value)))));}
function normalizeLocation(value:string):string{return value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();}
function findDefenseConflicts(input:{startAt:string;endAt:string;local:string;emails:string[];excludeProcessId?:string}){
  const start=Date.parse(input.startAt),end=Date.parse(input.endAt);if(!Number.isFinite(start)||!Number.isFinite(end)||end<=start)return[];
  const normalizedLocal=normalizeLocation(input.local);const emails=new Set(input.emails.map(normalizeEmail));
  return processesStore.filter(process=>process.id!==input.excludeProcessId&&process.status!=='CONCLUIDO'&&Date.parse(process.defesa.startAt)<end&&Date.parse(process.defesa.endAt)>start).flatMap(process=>{
    const sharedPeople=participantEmails(process).filter(email=>emails.has(email));const sameLocation=Boolean(normalizedLocal&&normalizeLocation(process.defesa.local)===normalizedLocal);
    return sameLocation||sharedPeople.length?[{processId:process.id,protocol:process.protocolo,startAt:process.defesa.startAt,endAt:process.defesa.endAt,sameLocation,sharedPeopleCount:sharedPeople.length}]:[];
  });
}
function coauthorIsPending(process:ProcessData):boolean{return Boolean(process.aluno2&&process.coauthorAcceptance?.status==='PENDING');}
function rejectPendingCoauthor(process:ProcessData,res:express.Response):boolean{if(coauthorIsPending(process)){res.status(409).json({error:'O segundo autor precisa aceitar o vínculo antes de o fluxo continuar.',code:'COAUTHOR_ACCEPTANCE_REQUIRED'});return true;}return false;}
function missingDocumentModels(types:Array<'CONVITE'|'ATA'|'TERMO'|'DECLARACAO'>):string[]{return types.filter(type=>!currentSettings.documentModels?.[type]?.driveFileId);}
function publicSignatureJob(job:SignatureJob):SignatureJob{const{artifactBase64:_artifact,...safe}=job;return safe as SignatureJob;}
function escapeHtml(v:string){return v.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]||c));}
function documentPreviewSummary(type:'CONVITE'|'ATA'|'TERMO'|'DECLARACAO',p:ProcessData):string{return `${type} • ${p.protocolo} • ${formatStudentsString(p.aluno1,p.aluno2)} • ${p.titulo}. A aparência final é preservada a partir do modelo ativo no Google Drive do Master.`;}
function publicPortalBaseUrl():string{const explicit=String(process.env.PORTAL_PUBLIC_URL||process.env.APP_URL||'').trim();if(explicit)return explicit.replace(/\/$/,'');const vercel=String(process.env.VERCEL_PROJECT_PRODUCTION_URL||'').trim();return vercel?`https://${vercel.replace(/^https?:\/\//,'').replace(/\/$/,'')}`:'';}
function buildDocumentVerificationCode(p:ProcessData,type:'ATA'|'TERMO'|'DECLARACAO'):string{const secret=String(process.env.PORTAL_VERIFICATION_SECRET||process.env.PORTAL_SESSION_SECRET||(productionRuntime?'':'portal-tcc-development-verification-secret')).trim();if(secret.length<32)throw new Error('Configure PORTAL_VERIFICATION_SECRET com pelo menos 32 caracteres.');return createHmac('sha256',secret).update(`${resolveInstallationProfile(currentSettings).installationId}|${p.id}|${type}|${p.dataRevision}`).digest('base64url').slice(0,32);}
function buildOfficialTemplateReplacements(p:ProcessData,verificationCode?:string,extraVariables?:Record<string,unknown>):Record<string,string>{
  const students=[p.aluno1.nome,p.aluno2?.nome].filter(Boolean).join(' e ');const banca=(p.banca||[]).map(item=>`${item.nome}${item.instituicao?` (${item.instituicao})`:''}`).join(', ');const date=p.defesa?.startAt?formatDateExtensoTotal(p.defesa.startAt):'';const time=p.defesa?.startAt?formatTimeExtenso(p.defesa.startAt):'';const dateTime=[date,time&&`às ${time}`].filter(Boolean).join(' ');const local=p.defesa?.local||'';const result=p.avaliacao?.resultadoLabel||p.avaliacao?.resultadoCode||'';const grade=p.avaliacao?.notaFinal??p.avaliacao?.nota;const replacements:Record<string,string>={
    CAMPO_01:students,CAMPO_02:p.titulo,CAMPO_03:p.orientador.nome,CAMPO_04:dateTime,CAMPO_06:banca,CAMPO_07_LOCAL:local,CAMPO_09:result,CAMPO_10:grade===undefined?'':String(grade),CAMPO_11:p.avaliacao?.parecer||'',CAMPO_12:p.protocolo,CAMPO_13:p.driveFolderUrl||'',CAMPO_COORIENTADOR:p.coorientador?.nome||'',
    ALUNOS_NOMES:students,ALUNO_NOME:p.aluno1.nome,NOME_ALUNO:p.aluno1.nome,ALUNO_2_NOME:p.aluno2?.nome||'',ALUNO_MATRICULA:p.aluno1.matricula,ALUNO_EMAIL:p.aluno1.email,EMAIL_ALUNO:p.aluno1.email,TCC_TITULO:p.titulo,TITULO_TRABALHO:p.titulo,ORIENTADOR_NOME:p.orientador.nome,NOME_ORIENTADOR:p.orientador.nome,COORIENTADOR_NOME:p.coorientador?.nome||'',DEFESA_DATA_HORA_EXTENSO:dateTime,DEFESA_DATA:date,DATA_DEFESA:date,DEFESA_HORA:time,DEFESA_LOCAL:local,LOCAL_DEFESA:local,BANCA_NOMES:banca,AVALIACAO_RESULTADO:result,AVALIACAO_NOTA:grade===undefined?'':String(grade),AVALIACAO_PARECER:p.avaliacao?.parecer||'',PROTOCOLO:p.protocolo,DRIVE_PASTA_URL:p.driveFolderUrl||'',PALAVRAS_CHAVE:p.acervo?.palavrasChave?.join('; ')||'',RESUMO_SINTETICO:p.acervo?.resumoSintese||'',PUBLICAR_TRABALHO_COMPLETO:p.acervo?.publishFullWork?'SIM':'NÃO',PUBLICAR_RESUMO_EXPANDIDO:p.acervo?.publishExpandedAbstract?'SIM':'NÃO',VALIDACAO_CODIGO:verificationCode||'',VALIDACAO_URL:verificationCode&&publicPortalBaseUrl()?`${publicPortalBaseUrl()}/validar/${verificationCode}`:'',
    'data do preenchimento':formatDatePt(new Date().toISOString()),'alunos':students,'titulo do trabalho':p.titulo,'orientador (1)':p.orientador.nome,'examinador (2)':(p.banca||[]).find(item=>item.funcao==='EXAMINER_2')?.nome||(p.banca||[])[0]?.nome||'','examinador (3)':(p.banca||[]).find(item=>item.funcao==='EXAMINER_3')?.nome||(p.banca||[])[1]?.nome||'','data da defesa (extenso total)':date,'hora de inicio da defesa (extenso)':time,'local da defesa':local,'hora de início da defesa (por extenso)':time,'data da defesa (por extenso total)':date,'situação':result,'parecer':p.avaliacao?.parecer||'','data da defesa (por extenso)':formatDatePt(p.defesa?.startAt||''),'nome completo aluno (1)':p.aluno1.nome,'nome completo aluno (2)':p.aluno2?.nome||'','coorientador':p.coorientador?.nome||'','Coorientador(a) Prof(ª). Dr(ª).':p.coorientador?'Coorientador(a) Prof(ª). Dr(ª).':''
  };
  for(const[rawKey,value]of Object.entries(extraVariables||{})){const normalized=String(rawKey).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9]+/g,'_').replace(/^_+|_+$/g,'').toUpperCase();if(normalized)replacements[normalized]=value===null||value===undefined?'':String(value);}
  return replacements;
}
async function renderOfficialTemplatePdf(p:ProcessData,type:'CONVITE'|'ATA'|'TERMO'|'DECLARACAO',verificationCode?:string,extraVariables?:Record<string,unknown>,studioOverride=currentSettings.integrationStudio):Promise<Buffer>{
  const model=currentSettings.documentModels?.[type];if(!model?.driveFileId)throw new Error(`Cadastre o modelo ${type} no Google Drive em Configurações.`);
  if(p.id!=='model-preview'&&!productionRuntime&&process.env.PORTAL_TEST_DOCUMENT_RENDERER==='true')return createProfessionalPdf({title:`TESTE ${type}`,protocol:p.protocolo,body:documentPreviewSummary(type,p)});
  if(!model.contentSha256)throw new Error(`Publique novamente o modelo ${type} para fixar sua versão e o hash de integridade.`);
  const accessToken=await getGoogleWorkspaceAccessToken();const outputName=buildPortalDriveFileName({protocol:p.protocolo,title:p.titulo,studentNames:[p.aluno1.nome,p.aluno2?.nome].filter(Boolean) as string[],documentType:type,version:p.dataRevision,lifecycle:'GERADO'});
  await verifyMasterDocumentModelFingerprint({accessToken,fileId:model.driveFileId,contentSha256:model.contentSha256,driveRevisionId:model.driveRevisionId,driveModifiedTime:model.driveModifiedTime});
  const artifactId=String(studioOverride?.docTemplates.find(item=>String(item.type).toUpperCase()===type)?.id||`tmpl-${type.toLowerCase()}`);
  const rendered=await renderGoogleDriveTemplateToPdf({accessToken,templateUrlOrId:model.driveFileId,replacements:presentVariables(buildOfficialTemplateReplacements(p,verificationCode,extraVariables),artifactId,studioOverride),boldMarkers:(operationalConfig(studioOverride).presentations[artifactId]||[]).filter(rule=>rule.bold).map(rule=>rule.marker),temporaryParentId:p.driveFolderId,outputName});
  await verifyMasterDocumentModelFingerprint({accessToken,fileId:model.driveFileId,contentSha256:model.contentSha256,driveRevisionId:model.driveRevisionId,driveModifiedTime:model.driveModifiedTime});
  if(rendered.replacementsChanged<1)throw new Error(`O modelo ${type} não contém nenhum marcador reconhecido. Revise as variáveis antes de solicitar assinatura.`);
  if(rendered.unresolvedMarkers.length)throw new Error(`O modelo ${type} ainda contém marcadores sem valor: ${rendered.unresolvedMarkers.join(', ')}.`);
  return rendered.pdf;
}
function buildFormSnapshotBody(process:ProcessData,formType:ProcessFormArchiveType):string{
  const common=[`Protocolo: ${process.protocolo}`,`Aluno(s): ${formatStudentsString(process.aluno1,process.aluno2)}`,`Matrícula(s): ${[process.aluno1.matricula,process.aluno2?.matricula].filter(Boolean).join(' / ')}`,`Título: ${process.titulo}`,`Orientador(a): ${process.orientador.nome}`,`E-mails participantes: ${Array.from(new Set([process.aluno1.email,process.aluno2?.email,process.orientador.email,process.coorientador?.email,...process.banca.map(item=>item.email)].filter(Boolean))).join('; ')}`];
  if(formType==='CADASTRO_INICIAL')return [...common,...Object.entries(process.registrationAnswers||{}).map(([key,value])=>`${key}: ${value}`),`Defesa solicitada: ${formatDatePt(process.defesa.startAt)}`,`Banca: ${process.banca.map(item=>`${item.nome} — ${item.instituicao||'Instituição não informada'}`).join('; ')}`].join('\n');
  if(formType==='CONFIRMACAO_LOCAL')return [...common,`Local confirmado: ${process.defesa.local}`,`Declarado pelo aluno: ${process.defesa.localConfirmedBy||'não confirmado'}`,`Confirmado em: ${process.defesa.localConfirmedAt||''}`,`Comprovante informado: ${process.defesa.localEvidenceUrl||'Não informado'}`].join('\n');
  if (formType === 'AVALIACAO') return [...common,
    `Resultado: ${process.avaliacao.resultadoLabel || process.avaliacao.resultadoCode || ''}`,
    `Nota: ${process.avaliacao.notaFinal ?? process.avaliacao.nota ?? ''}`,
    `Parecer: ${process.avaliacao.parecer || ''}`,
    `Conferido por: ${process.avaliacao.dataReview?.confirmedBy || 'não confirmado'}`,
    `Conferido em: ${process.avaliacao.dataReview?.confirmedAt || 'não confirmado'}`,
    `Revisão conferida: ${process.avaliacao.dataReview?.sourceDataRevision ?? 'não confirmado'}`,
    ...(process.avaliacao.dataReview?.fields || []).map(([label, value]) => `${label}: ${value}`),
    ...Object.entries(process.avaliacao.answers || {}).map(([key, value]) => `${key}: ${value}`),
  ].join('\n');
  return [...common,`Palavras-chave: ${process.acervo?.palavrasChave?.join('; ')||''}`,`Resumo sintético: ${process.acervo?.resumoSintese||''}`,`Trabalho completo público: ${process.acervo?.publishFullWork?'SIM':'NÃO'}`,`Resumo expandido público: ${process.acervo?.publishExpandedAbstract?'SIM':'NÃO'}`,`Autorização confirmada: ${process.acervo?.authorizationConfirmedAt||'NÃO SE APLICA'}`].join('\n');
}
async function archiveProcessFormSnapshot(process:ProcessData,formType:ProcessFormArchiveType):Promise<FormArchiveJob>{
  const pdf=createProfessionalPdf({title:`FORMULÁRIO — ${formType.replaceAll('_',' ')}`,protocol:process.protocolo,body:buildFormSnapshotBody(process,formType),institution:currentSettings.integrationStudio?.brandKit?.institutionName,course:currentSettings.integrationStudio?.brandKit?.courseName,footer:'Cópia imutável arquivada pelo Portal de TCC'});const sha256=createHash('sha256').update(pdf).digest('hex');const id=createHash('sha256').update(`${process.id}|${formType}|${process.dataRevision}|${sha256}`).digest('hex').slice(0,28);let job=formArchiveJobsStore.find(item=>item.id===`form_${id}`);if(!job){const now=new Date().toISOString();job={id:`form_${id}`,processId:process.id,formType,version:process.dataRevision,sha256,artifactBase64:pdf.toString('base64'),status:'PENDING',createdAt:now,updatedAt:now};formArchiveJobsStore.push(job);}try{const accessToken=await getGoogleWorkspaceAccessToken();if(!currentSettings.driveRootFolderId)throw new Error('Pasta raiz do Drive não configurada.');if(!process.driveFolderId){const folder=await ensurePortalProcessDriveFolder({accessToken,rootFolderId:currentSettings.driveRootFolderId,protocol:process.protocolo,processId:process.id});process.driveFolderId=folder.id;process.driveFolderUrl=folder.webViewLink;process.driveSyncedAt=new Date().toISOString();}const uploaded=await uploadProcessFormPdf({accessToken,processFolderId:process.driveFolderId,processId:process.id,protocol:process.protocolo,studentNames:[process.aluno1.nome,process.aluno2?.nome].filter(Boolean) as string[],formType,version:process.dataRevision,pdf,sha256});job.status='ARCHIVED';job.driveFileId=String(uploaded.id);job.fileName=String(uploaded.name||'');job.artifactBase64='';job.lastError=undefined;job.updatedAt=new Date().toISOString();}catch(error){job.status='FAILED';job.lastError=error instanceof Error?error.message:'Falha ao arquivar o formulário.';job.updatedAt=new Date().toISOString();}await persistPortalStateDurably();return job;
}
async function resumeWorkflowAfterNativeFormArchive(process:ProcessData,formType:ProcessFormArchiveType,actorEmail:string,resumeRun?:WorkflowRun):Promise<void>{
  if(formType==='CADASTRO_INICIAL'){await executeConfiguredWorkflowEvent(process,'TCC_CREATED',actorEmail,undefined,resumeRun);return;}
  if(formType==='CONFIRMACAO_LOCAL'){
    const run=await executeConfiguredWorkflowEvent(process,'LOCATION_CONFIRMED',actorEmail,undefined,resumeRun);
    if(run?.status==='COMPLETED'&&process.defesa.invitationDriveFileId){
      const deliveryIds=run.actions.filter(action=>action.kind==='EMAIL'&&action.status==='COMPLETED').flatMap(action=>String(action.externalId||'').split(',').filter(Boolean));
      process.etapaAtual='CONVITE';process.status='AGUARDANDO_DEFESA';process.defesa.invitationSentAt=new Date().toISOString();process.defesa.invitationRecipients=Array.from(new Set(deliveryIds.map(id=>emailDeliveriesStore.find(item=>item.id===id)?.recipient).filter(Boolean) as string[]));process.updatedAt=new Date().toISOString();
      await persistPortalStateDurably();await executeConfiguredWorkflowEvent(process,'INVITATION_SENT',actorEmail);
    }
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
  const pdf=createProfessionalPdf({title:`FORMULÁRIO — ${String(form.title||submission.formId)}`,protocol:process.protocolo,body,institution:currentSettings.integrationStudio?.brandKit?.institutionName,course:currentSettings.integrationStudio?.brandKit?.courseName,footer:`Checksum ${submission.checksum}`});
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
async function createInstitutionalDossier(process:ProcessData,actorEmail:string):Promise<{zip:Buffer;fileName:string;manifestHash:string;included:number;missing:string[]}>{
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
    path:`00_FORMULARIOS/COMPROVANTE_RESERVA/${process.defesa.locationProof.fileName}`,
    fileId:process.defesa.locationProof.driveFileId,
    kind:'LOCATION_PROOF'
  });
  for(const archive of formArchiveJobsStore.filter(job=>job.processId===process.id&&job.status==='ARCHIVED'))candidates.push({path:`00_FORMULARIOS/${archive.formType}/${archive.fileName||`${archive.formType}.pdf`}`,fileId:archive.driveFileId,kind:`FORM_${archive.formType}`});
  for(const job of signatureJobsStore.filter(item=>item.processId===process.id&&item.status==='ARCHIVED')){const signedName=buildPortalDriveFileName({protocol:process.protocolo,title:process.titulo,studentNames:[process.aluno1.nome,process.aluno2?.nome].filter(Boolean) as string[],documentType:job.documentType,version:job.documentVersion,lifecycle:'ASSINADO'});candidates.push({path:`DOCUMENTOS_ASSINADOS/${job.documentType}/${signedName}`,fileId:job.driveSignedFileId,kind:`SIGNED_${job.documentType}`});}
  for(const candidate of candidates){if(!candidate.fileId){if(!['EXPANDED_ABSTRACT','INVITATION'].includes(candidate.kind))missing.push(`${candidate.kind}: arquivo não localizado.`);continue;}if(!accessToken){missing.push(`${candidate.kind}: Google indisponível.`);continue;}try{const downloaded=await downloadDrivePdf(accessToken,candidate.fileId,{processId:process.id});addBuffer(candidate.path,downloaded.pdf,candidate.kind);}catch(error){missing.push(`${candidate.kind}: ${error instanceof Error?error.message:'falha no download'}`);}if(files.reduce((sum,file)=>sum+file.bytes,0)>100*1024*1024)throw new Error('O dossiê ultrapassou o limite de 100 MB.');}
  const profile=resolveInstallationProfile(currentSettings);const manifest={schemaVersion:1,installation:{id:profile.installationId,institution:profile.institutionName,course:profile.courseName},protocol:process.protocolo,generatedAt:new Date().toISOString(),generatedBy:actorEmail,files,missing};const manifestBuffer=Buffer.from(JSON.stringify(manifest,null,2),'utf8'),manifestHash=createHash('sha256').update(manifestBuffer).digest('hex');zip.file('00_MANIFESTO/manifest.json',manifestBuffer);zip.file('00_MANIFESTO/manifest.sha256',`${manifestHash}  manifest.json\n`);const output=await zip.generateAsync({type:'nodebuffer',compression:'DEFLATE',compressionOptions:{level:6}});return{zip:output,fileName:`${process.protocolo}__DOSSIER_INSTITUCIONAL.zip`,manifestHash,included:files.length,missing};
}
const emailDeliveryJournal={
  async findByIdempotencyKey(key:string){return emailDeliveriesStore.find(item=>item.idempotencyKey===key)||null;},
  async save(record:EmailDeliveryRecord){const index=emailDeliveriesStore.findIndex(item=>item.id===record.id);if(index>=0)emailDeliveriesStore[index]=record;else emailDeliveriesStore.push(record);persistPortalState();}
};
async function sendTrackedPortalEmail(input:{process?:ProcessData;recipient:string;subject:string;text:string;html?:string;templateId?:string;workflowEventCode?:WorkflowEventCode;workflowEventVariables?:Record<string,string>;idempotencyKey:string;attachments?:Array<{fileName:string;mimeType:string;content:Buffer}>}){
  return dispatchTrackedEmail({processId:input.process?.id,protocol:input.process?.protocolo,templateId:input.templateId,workflowEventCode:input.workflowEventCode,workflowEventVariables:input.workflowEventVariables,recipient:input.recipient,subject:input.subject,text:input.text,html:input.html,idempotencyKey:input.idempotencyKey,attachments:input.attachments},{send:sendGmailMessage,journal:emailDeliveryJournal});
}
function buildPublishedInvitationEmail(portalProcess:ProcessData,actorEmail:string):{templateId:string;subject:string;text:string;html?:string}{
  const templates=currentSettings.integrationStudio?.emailTemplates||[];
  const template=templates.find(item=>String(item.id||'').trim()==='email-convite'||String(item.templateId||'').trim()==='CARTA_CONVITE');
  if(!template)throw new Error('Publique o modelo de e-mail "Convite para banca" no Estúdio antes de confirmar o local.');
  const variables=buildProcessVariables({process:portalProcess,eventCode:'INVITATION_SENT',actorEmail,actorRoles:getActiveProcessRoles(actorEmail,portalProcess.id),extraVariables:{LINK_PORTAL:String(process.env.PORTAL_PUBLIC_URL||process.env.VERCEL_PROJECT_PRODUCTION_URL||'').replace(/\/$/,'')}});
  const subject=mergeWorkflowVariables(String(template.subject||''),variables).trim();
  const text=mergeWorkflowVariables(String(template.body||template.text||''),variables).trim();
  const htmlSource=String(template.htmlBody||template.html||'').trim();
  if(!subject||!text)throw new Error('O modelo de e-mail do convite precisa ter assunto e corpo publicados no Estúdio.');
  return{templateId:String(template.id||template.templateId||'CARTA_CONVITE'),subject,text,html:htmlSource?mergeWorkflowVariables(htmlSource,variables):undefined};
}
async function loadInvitationAttachment(portalProcess:ProcessData):Promise<Array<{fileName:string;mimeType:string;content:Buffer}>>{
  if(!portalProcess.defesa.invitationDriveFileId)throw new Error('O PDF da carta-convite não está arquivado no Drive. Gere novamente o convite antes de reenviar.');
  const accessToken=await getGoogleWorkspaceAccessToken();
  const file=await downloadDrivePdf(accessToken,portalProcess.defesa.invitationDriveFileId,{processId:portalProcess.id,artifactType:'CONVITE'});
  return[{fileName:file.fileName,mimeType:'application/pdf',content:file.pdf}];
}
function configuredDocumentType(template:Record<string,unknown>):'CONVITE'|'ATA'|'TERMO'|'DECLARACAO'{
  const direct=String(template.type||template.documentType||'').toUpperCase();
  const inferred=String(template.id||'').toUpperCase();
  const type=['CONVITE','ATA','TERMO','DECLARACAO'].find(candidate=>direct===candidate||inferred.includes(candidate));
  if(!type)throw new Error(`O modelo ${String(template.id||template.label||'')} não possui um tipo documental reconhecido.`);
  return type as 'CONVITE'|'ATA'|'TERMO'|'DECLARACAO';
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
async function executeConfiguredDocumentAction(portalProcess:ProcessData,template:Record<string,unknown>,actorEmail:string,idempotencyKey:string,variables:Record<string,string>,eventCode:WorkflowEventCode):Promise<{externalId?:string}>{
  const type=configuredDocumentType(template);
  assertSafeWorkflowDocumentEvent(type,eventCode);
  if(type==='TERMO'&&!publicationRequested(portalProcess))return{externalId:'NOT_APPLICABLE_NO_PUBLICATION'};
  if(type==='CONVITE'&&portalProcess.defesa.invitationDriveFileId)return{externalId:portalProcess.defesa.invitationDriveFileId};
  if(type!=='CONVITE'){
    const job=await createSignatureJob(portalProcess,type,actorEmail,variables);
    await dispatchSignatureJobAutomatically(job);
    auditLogsStore.push({id:`log-${Date.now()}-workflow-document`,processId:portalProcess.id,actorEmail,actorRoles:[...getUserRolesForEmail(actorEmail).globalRoles,...getActiveProcessRoles(actorEmail,portalProcess.id)],action:'DOCUMENTO_GERADO_PELO_FLUXO',entityType:'signature_job',entityId:job.id,after:{documentType:type,status:job.status,provider:'ASTEN'},timestamp:new Date().toISOString()});
    await persistPortalStateDurably();
    if(job.status==='WAITING_INTEGRATION'||job.status==='PROVIDER_ERROR')throw new Error(job.lastError||`O documento ${type} não foi enviado à Asten.`);
    return{externalId:job.id};
  }
  const {accessToken,folderId}=await ensureWorkflowProcessFolder(portalProcess);
  const pdf=await renderOfficialTemplatePdf(portalProcess,'CONVITE',undefined,variables);
  const sha256=createHash('sha256').update(pdf).digest('hex');
  const fileName=buildPortalDriveFileName({protocol:portalProcess.protocolo,title:portalProcess.titulo,studentNames:[portalProcess.aluno1.nome,portalProcess.aluno2?.nome].filter(Boolean) as string[],documentType:'CONVITE',version:portalProcess.dataRevision,lifecycle:'GERADO'});
  const uploaded=await uploadGeneratedPdfToDrive({rootFolderId:currentSettings.driveRootFolderId,protocol:portalProcess.protocolo,accessToken,processFolderId:folderId,processId:portalProcess.id,jobId:`workflow_${idempotencyKey}`,documentType:'CONVITE',fileName,pdf,sha256});
  portalProcess.defesa.invitationDriveFileId=String(uploaded.id);
  auditLogsStore.push({id:`log-${Date.now()}-workflow-invitation`,processId:portalProcess.id,actorEmail,actorRoles:[...getUserRolesForEmail(actorEmail).globalRoles,...getActiveProcessRoles(actorEmail,portalProcess.id)],action:'CONVITE_GERADO_PELO_FLUXO',entityType:'process_document',entityId:String(uploaded.id),after:{documentType:'CONVITE',sha256,fileName},timestamp:new Date().toISOString()});
  await persistPortalStateDurably();
  return{externalId:String(uploaded.id)};
}
async function resolveWorkflowEmailAttachments(portalProcess:ProcessData,template:Record<string,unknown>):Promise<Array<{fileName:string;mimeType:string;content:Buffer}>>{
  const refs=Array.isArray(template.attachments)?template.attachments.map(String):[];
  if(!refs.length)return[];
  let accessToken='';
  const output:Array<{fileName:string;mimeType:string;content:Buffer}>=[];
  const download=async(fileId:string)=>{accessToken=accessToken||await getGoogleWorkspaceAccessToken();return downloadDrivePdf(accessToken,fileId,{processId:portalProcess.id});};
  for(const ref of refs){
    const normalized=ref.toUpperCase();
    if(normalized==='TCC-PDF'||normalized==='TCC_PDF'){
      if(portalProcess.acervo?.trabalhoCompletoFileId){const file=await download(portalProcess.acervo.trabalhoCompletoFileId);output.push({fileName:file.fileName,mimeType:'application/pdf',content:file.pdf});}
      continue;
    }
    const type=(['CONVITE','ATA','TERMO','DECLARACAO'] as const).find(candidate=>normalized.includes(candidate));
    if(!type)continue;
    if(type==='TERMO'&&!publicationRequested(portalProcess))continue;
    if(type==='CONVITE'){
      if(!portalProcess.defesa.invitationDriveFileId)throw new Error('O e-mail exige o convite, mas o PDF ainda não foi gerado. Coloque a ação de documento antes do e-mail.');
      const file=await download(portalProcess.defesa.invitationDriveFileId);output.push({fileName:file.fileName,mimeType:'application/pdf',content:file.pdf});continue;
    }
    const job=signatureJobsStore.filter(item=>item.processId===portalProcess.id&&item.documentType===type).sort((a,b)=>b.documentVersion-a.documentVersion)[0];
    if(!job)throw new Error(`O e-mail exige ${type}, mas o documento ainda não foi gerado.`);
    if(job.status==='ARCHIVED'&&job.driveSignedFileId){const file=await download(job.driveSignedFileId);output.push({fileName:file.fileName,mimeType:'application/pdf',content:file.pdf});}
    else throw new Error(`O e-mail exige ${type} assinado, mas o PDF ainda não foi arquivado pelo retorno da Asten.`);
  }
  return output;
}
function historicalStudioAnswers(processId:string):Record<string,string|number|boolean>{
  const answers:Record<string,string|number|boolean>={...(processesStore.find(p=>p.id===processId)?.registrationAnswers||{})};
  for(const submission of studioFormSubmissionsStore.filter(item=>item.processId===processId&&item.archiveStatus==='ARCHIVED').sort((a,b)=>a.submittedAt.localeCompare(b.submittedAt))){
    Object.assign(answers,submission.answers);
  }
  return answers;
}
async function executeConfiguredWorkflowEvent(process:ProcessData,eventCode:WorkflowEventCode,actorEmail:string,extraVariables?:Record<string,unknown>,resumeRun?:WorkflowRun):Promise<WorkflowRun|undefined>{
  const studio=currentSettings.integrationStudio;if(!studio)return;
  const customFormEvent=String(eventCode).match(/^FORM_(.+)_SUBMITTED$/i);
  if(customFormEvent){
    const latest=studioFormSubmissionsStore.filter(item=>item.processId===process.id&&item.formId===customFormEvent[1]).sort((a,b)=>b.submittedAt.localeCompare(a.submittedAt))[0];
    if(!latest||latest.archiveStatus!=='ARCHIVED')return;
  }
  const effectiveVariables={...(process.registrationAnswers||{}),...historicalStudioAnswers(process.id),...(extraVariables||{}),DEPARTAMENTO_EMAIL:operationalConfig(studio).reservation.departmentEmail,LOCAL_ALTERNATIVO:process.defesa.alternateLocation||''};
  const run=await executeWorkflowEvent(studio,{process,eventCode,actorEmail,actorRoles:getActiveProcessRoles(actorEmail,process.id),extraVariables:effectiveVariables,completedActions:resumeRun?.actions},{
    createDocument:async({template,idempotencyKey,variables})=>executeConfiguredDocumentAction(process,template,actorEmail,idempotencyKey,variables,eventCode),
    createFormTask:async({form,idempotencyKey})=>({externalId:`form_task_${String(form.id||idempotencyKey)}`}),
    sendEmail:async({template,to,subject,text,html,eventVariables,idempotencyKey})=>{const templateId=String(template.id||'');const attachments=await resolveWorkflowEmailAttachments(process,template);const records=[];for(const recipient of to){const accepted=emailDeliveriesStore.find(record=>record.processId===process.id&&record.templateId===templateId&&record.recipient===normalizeEmail(recipient)&&record.status==='ACCEPTED_BY_GMAIL');if(eventCode==='LOCATION_CONFIRMED'&&process.defesa.invitationSentAt&&accepted){records.push(accepted);continue;}records.push(await sendTrackedPortalEmail({process,recipient,subject,text,html,templateId,workflowEventCode:eventCode,workflowEventVariables:eventVariables,idempotencyKey:`${idempotencyKey}:${recipient}`,attachments}));}if(records.some(record=>record.status!=='ACCEPTED_BY_GMAIL')){const error=new Error('Um ou mais e-mails do fluxo aguardam nova tentativa.') as Error&{externalId:string};error.externalId=records.map(record=>record.id).join(',');throw error;}return{externalId:records.map(record=>record.id).join(',')};},
    executeSystemAction:async({action})=>{throw new Error(`A ação interna “${action.title}” não possui executor publicado. Use uma ação de formulário, documento ou e-mail.`);}
  });
  const existing=workflowRunsStore.findIndex(item=>item.id===run.id);if(existing>=0)workflowRunsStore[existing]=run;else workflowRunsStore.push(run);
  if(run.status!=='COMPLETED')auditLogsStore.push({id:`log-${Date.now()}-workflow`,processId:process.id,actorEmail,actorRoles:getUserRolesForEmail(actorEmail).globalRoles,action:'FLUXO_CONFIGURADO_COM_PENDENCIA',entityType:'workflow_run',entityId:run.id,after:{eventCode,status:run.status,issues:run.issues,actions:run.actions},timestamp:new Date().toISOString()});persistPortalState();
  return run;
}
function workflowOperationsOverview(){
  const studio=currentSettings.integrationStudio;
  const queue=buildRecoveryQueue({processes:processesStore,runs:workflowRunsStore,jobs:signatureJobsStore,emails:emailDeliveriesStore,forms:formArchiveJobsStore,customForms:studioFormSubmissionsStore});
  let deadlines:ReturnType<typeof plannedDeadlines>=[],planningError:string|undefined;
  try{deadlines=plannedDeadlines(processesStore,signatureJobsStore,workflowPolicy(studio),studio?.operationsPolicy?.timezone||'America/Sao_Paulo');}
  catch(error){planningError=error instanceof Error?error.message:'Não foi possível calcular os prazos publicados.';}
  return {studioRevision:studio?.revision||0,queueTotal:queue.length,queue:queue.slice(0,500),deadlineTotal:deadlines.length,deadlineOverdueTotal:deadlines.filter(item=>item.overdue).length,deadlines:deadlines.slice(0,500),reminders:reminderRecordsStore.slice(-200).reverse(),planningError};
}
async function runWorkflowMaintenance(){
  const now=new Date(),studio=currentSettings.integrationStudio,policy=workflowPolicy(studio);
  const previousDraftCount=Object.keys(registrationDraftsStore).length;registrationDraftsStore=pruneDrafts(registrationDraftsStore,now);
  // Resolve only acknowledgements already persisted by Gmail; an ambiguous send
  // remains visible and never becomes an automatic new delivery.
  for(const record of reminderRecordsStore.filter(item=>item.status!=='SENT')){
    const accepted=emailDeliveriesStore.find(item=>item.idempotencyKey===`reminder:${record.id}`&&item.status==='ACCEPTED_BY_GMAIL');
    if(accepted){record.status='SENT';record.sentAt=accepted.attempts.at(-1)?.completedAt;record.error=undefined;}
  }
  await persistPortalStateDurably();
  const result={expiredDrafts:previousDraftCount-Object.keys(registrationDraftsStore).length,sent:0,failed:0,configurationErrors:[] as string[],deferred:false};
  if(!studio)return result;
  const validation=validateCourseStudio(studio);if(!validation.ready){result.configurationErrors=validation.issues.filter(issue=>issue.severity==='ERROR'&&(issue.area==='WORKFLOW'||issue.area==='EMAIL'||issue.area==='OPERATIONS')).slice(0,20).map(issue=>issue.message);return result;}
  const plans=plannedDeadlines(processesStore,signatureJobsStore,policy,studio.operationsPolicy?.timezone||'America/Sao_Paulo',now);
  for(const plan of plans){
    if(!plan.overdue)continue;
    const portalProcess=processesStore.find(p=>p.id===plan.processId);if(!portalProcess)continue;
    let mail:ReturnType<typeof renderReminder>;
    try{mail=renderReminder(studio,portalProcess,plan.rule.emailTemplateId,plan.label,plan.dueDate,historicalStudioAnswers(portalProcess.id));}
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
  if(type==='ATA')return[{id:`advisor:${normalizeEmail(p.orientador.email)}`,role:'ADVISOR' as const,name:p.orientador.nome,email:normalizeEmail(p.orientador.email),signingOrder:1,status:'WAITING' as const}];
  if(type==='TERMO'){const students=[p.aluno1,p.aluno2].filter(Boolean) as Array<NonNullable<ProcessData['aluno2']>>;return[...students.map((s)=>({id:`student:${normalizeEmail(s.email)}`,role:'STUDENT' as const,name:s.nome,email:normalizeEmail(s.email),signingOrder:1,status:'WAITING' as const})),{id:`advisor:${normalizeEmail(p.orientador.email)}`,role:'ADVISOR' as const,name:p.orientador.nome,email:normalizeEmail(p.orientador.email),signingOrder:1,status:'WAITING' as const}];}
  const email=normalizeEmail(currentSettings.commissionPresidentEmail||''),name=currentSettings.commissionPresidentName||'Presidente da Comissão';if(!email)throw new Error('Configure o e-mail do Presidente da Comissão.');return[{id:`president:${email}`,role:'PRESIDENT' as const,name,email,signingOrder:1,status:'WAITING' as const}];
}
function repositoryDataComplete(p:ProcessData):boolean{return Boolean(p.acervo?.palavrasChave?.length===5&&p.acervo?.resumoSintese?.trim()&&p.acervo?.trabalhoCompletoFileUrl&&(!p.acervo?.publishExpandedAbstract||p.acervo?.resumoExpandidoFileId));}
async function createSignatureJob(p:ProcessData,type:'ATA'|'TERMO'|'DECLARACAO',actor:string,renderVariables:Record<string,string>={}):Promise<SignatureJob>{
  if(p.avaliacao.status!=='CONCLUIDO')throw new Error(`${p.protocolo}: avaliação pendente.`);
  if((type==='TERMO'||type==='DECLARACAO')&&!repositoryDataComplete(p))throw new Error(`${p.protocolo}: dados finais do repositório ainda não foram concluídos.`);
  if(type==='DECLARACAO'&&!declarationReady(p,signatureJobsStore))throw new Error('A declaração aguarda a Ata e o Termo aplicável assinados e arquivados.');
  if(type==='TERMO'&&!publicationRequested(p))throw new Error(`${p.protocolo}: o termo só é aplicável quando o aluno solicita publicação.`);
  if(type==='TERMO'&&!p.acervo?.authorizationConfirmedAt)throw new Error(`${p.protocolo}: a autorização de publicação ainda não foi confirmada.`);
  const signers=deriveSignatureSigners(p,type);
  if(signers.some(s=>!isValidPortalEmail(s.email)))throw new Error(`${p.protocolo}: signatário sem e-mail válido.`);
  const verificationCode=buildDocumentVerificationCode(p,type);
  const documentTitle=type==='ATA'?'Ata oficial da defesa':type==='TERMO'?'Termo de autorização e publicação':'Declaração de participação';
  const pdf=await renderOfficialTemplatePdf(p,type,verificationCode,renderVariables);
  const contentSha256=createHash('sha256').update(pdf).digest('hex');
  const signerHash=signers.map(s=>`${s.role}:${s.email}:${s.signingOrder}`).join('|');
  const idempotencyKey=createHash('sha256').update(`${p.id}|${type}|${p.dataRevision}|${contentSha256}|${signerHash}`).digest('hex');
  const existing=signatureJobsStore.find(j=>j.idempotencyKey===idempotencyKey);if(existing)return existing;
  const documentVersion=1+Math.max(0,...signatureJobsStore.filter(j=>j.processId===p.id&&j.documentType===type).map(j=>j.documentVersion));
  const now=new Date().toISOString();const studentNames=[p.aluno1.nome,p.aluno2?.nome].filter(Boolean) as string[];
  const job:SignatureJob={id:`sig_${idempotencyKey.slice(0,24)}`,processId:p.id,protocol:p.protocolo,documentType:type,documentTitle,documentVersion,sourceDataRevision:p.dataRevision,fileName:buildPortalDriveFileName({protocol:p.protocolo,title:p.titulo,studentNames,documentType:type,version:documentVersion,lifecycle:'GERADO'}),mimeType:'application/pdf',contentSha256,idempotencyKey,status:'QUEUED',signers,createdAt:now,createdBy:actor,updatedAt:now,provider:'ASTEN',providerCreationState:'PENDING',verificationCode,renderVariables:{...renderVariables}};
  const {accessToken,folderId}=await ensureWorkflowProcessFolder(p);
  const uploaded=await uploadGeneratedPdfToDrive({rootFolderId:currentSettings.driveRootFolderId,protocol:p.protocolo,accessToken,processFolderId:folderId,processId:p.id,jobId:job.id,documentType:type,fileName:job.fileName,pdf,sha256:contentSha256});
  job.driveUnsignedFileId=String(uploaded.id);
  signatureJobsStore.push(job);
  await persistPortalStateDurably();
  return job;
}
const signatureDispatchLocks=new Set<string>();
async function dispatchSignatureJobAutomatically(job:SignatureJob):Promise<SignatureJob>{
  if(job.status==='DRIVE_SYNC_PENDING')return archiveSignatureJobAutomatically(job);
  if(['SENT','PARTIALLY_SIGNED','SIGNED','ARCHIVED'].includes(job.status)||signatureDispatchLocks.has(job.id))return job;
  if(job.providerCreationState==='UNCERTAIN'&&!job.providerEnvelopeId){job.status='PROVIDER_ERROR';job.lastError='A criação do envelope ficou com resultado incerto. Não repita automaticamente: confira a conta Asten e faça a reconciliação administrativa.';job.updatedAt=new Date().toISOString();return job;}
  const connection=await getPersistentAstenConnection();
  if(!connection){job.status='WAITING_INTEGRATION';job.lastError='Conecte a conta Asten em Configurações para concluir o envio.';job.updatedAt=new Date().toISOString();return job;}
  signatureDispatchLocks.add(job.id);
  try{
    job.status='SENDING';job.lastError=undefined;job.updatedAt=new Date().toISOString();await persistPortalStateDurably();
    const process=processesStore.find(item=>item.id===job.processId);if(!process)throw new Error('Processo do documento não encontrado.');
    const googleAccessToken=await getGoogleWorkspaceAccessToken();
    if(!currentSettings.driveRootFolderId)throw new Error('Pasta raiz do Google Drive não configurada.');
    if(!process.driveFolderId){const folder=await ensurePortalProcessDriveFolder({accessToken:googleAccessToken,rootFolderId:currentSettings.driveRootFolderId,protocol:process.protocolo,processId:process.id});process.driveFolderId=folder.id;process.driveFolderUrl=folder.webViewLink;process.driveSyncedAt=new Date().toISOString();}
    let artifactPdf:Buffer;
    if(job.artifactBase64)artifactPdf=Buffer.from(job.artifactBase64,'base64');
    else if(job.driveUnsignedFileId)artifactPdf=(await downloadDrivePdf(googleAccessToken,job.driveUnsignedFileId,{processId:process.id,artifactType:job.documentType,signatureJobId:job.id})).pdf;
    else artifactPdf=await renderOfficialTemplatePdf(process,job.documentType,job.verificationCode,job.renderVariables);
    const regeneratedHash=createHash('sha256').update(artifactPdf).digest('hex');if(regeneratedHash!==job.contentSha256)throw new Error('O PDF regenerado diverge do hash aprovado. Crie uma nova versão do documento.');
    if(!job.driveUnsignedFileId){const uploaded=await uploadGeneratedPdfToDrive({accessToken:googleAccessToken,processFolderId:process.driveFolderId,processId:process.id,jobId:job.id,documentType:job.documentType,fileName:job.fileName,pdf:artifactPdf,sha256:job.contentSha256});job.driveUnsignedFileId=String(uploaded.id);await persistPortalStateDurably();}
    if(!job.providerEnvelopeId){
      const claim=await claimAstenEnvelopeDispatch({idempotencyKey:job.idempotencyKey,jobId:job.id,contentSha256:job.contentSha256});
      if(claim.outcome==='BUSY'){job.status='SENDING';job.lastError='Outra instância já está criando este envelope.';job.updatedAt=new Date().toISOString();await persistPortalStateDurably();return job;}
      if(claim.outcome==='UNCERTAIN'){job.providerCreationState='UNCERTAIN';throw new Error('A criação anterior do envelope ficou com resultado incerto. Confira a Asten antes de qualquer nova tentativa.');}
      if((claim.outcome==='ALREADY_CREATED'||claim.outcome==='DISPATCHED')&&claim.providerEnvelopeId){
        job.providerEnvelopeId=claim.providerEnvelopeId;job.providerEnvelopeHash=claim.providerEnvelopeHash;job.providerCreationState='CONFIRMED';job.artifactBase64=undefined;await persistPortalStateDurably();
        if(claim.outcome==='DISPATCHED'){job.status='SENT';job.sentAt=job.updatedAt=new Date().toISOString();await persistPortalStateDurably();return job;}
      }else{
        job.providerCreationState='CREATING';await persistPortalStateDurably();
        let envelope:{id:string;hash?:string};
        try{
          const creation=await callAsten('inserirEnvelope',buildAstenEnvelopeParams({description:`${job.protocol} - ${job.documentTitle}`,fileName:job.fileName,mimeType:job.mimeType,contentBase64:artifactPdf.toString('base64'),signers:job.signers.map(s=>({name:s.name,email:s.email,order:s.signingOrder})),repositoryId:connection.repositoryId}),connection.token);
          envelope=extractAstenEnvelopeIdentity(creation);
        }catch(error){
          job.providerCreationState='UNCERTAIN';
          await updateAstenEnvelopeDispatch({idempotencyKey:job.idempotencyKey,state:'UNCERTAIN',claimToken:claim.claimToken,errorCode:'PROVIDER_CREATION_RESULT_UNKNOWN'}).catch(()=>undefined);
          throw new Error(`A Asten não confirmou se o envelope foi criado. O reenvio automático foi bloqueado para evitar duplicidade. ${error instanceof Error?error.message:''}`.trim());
        }
        await updateAstenEnvelopeDispatch({idempotencyKey:job.idempotencyKey,state:'ENVELOPE_CREATED',claimToken:claim.claimToken,providerEnvelopeId:envelope.id,providerEnvelopeHash:envelope.hash});
        job.providerEnvelopeId=envelope.id;job.providerEnvelopeHash=envelope.hash;job.providerCreationState='CONFIRMED';job.artifactBase64=undefined;await persistPortalStateDurably();
      }
    }
    await callAsten('encaminharEnvelopeParaAssinaturas',{Envelope:{id:job.providerEnvelopeId}},connection.token);
    await updateAstenEnvelopeDispatch({idempotencyKey:job.idempotencyKey,state:'DISPATCHED',providerEnvelopeId:job.providerEnvelopeId,providerEnvelopeHash:job.providerEnvelopeHash});
    job.status='SENT';job.sentAt=job.updatedAt=new Date().toISOString();
  }catch(error){job.status='PROVIDER_ERROR';job.lastError=error instanceof Error?error.message:'Falha no envio à Asten.';job.updatedAt=new Date().toISOString();}
  finally{signatureDispatchLocks.delete(job.id);}
  persistPortalState();return job;
}
function updateProcessCompletion(processId:string):void{
  const process=processesStore.find(item=>item.id===processId);if(!process)return;
  const latestByType=new Map<string,SignatureJob>();
  signatureJobsStore.filter(job=>job.processId===processId&&job.status!=='CANCELED').forEach(job=>{const current=latestByType.get(job.documentType);if(!current||job.documentVersion>=current.documentVersion)latestByType.set(job.documentType,job);});
  const requiredTypes=publicationRequested(process)?['ATA','TERMO','DECLARACAO']:['ATA','DECLARACAO'];
  if(requiredTypes.every(type=>{const job=latestByType.get(type);return job?.status==='ARCHIVED'&&Boolean(job.driveSignedFileId)&&(type!=='TERMO'||job.sourceDataRevision===process.dataRevision);})){ 
    process.etapaAtual='CONCLUIDO';process.status='CONCLUIDO';process.completedAt=process.completedAt||new Date().toISOString();process.updatedAt=process.completedAt;
  }
}
function missingSignatureJobsForRevision(process:ProcessData,types:Array<'ATA'|'TERMO'|'DECLARACAO'>):string[]{
  return types.filter(type=>!signatureJobsStore.some(job=>job.processId===process.id&&job.documentType===type&&job.sourceDataRevision===process.dataRevision&&job.status!=='CANCELED'));
}
async function archiveSignatureJobAutomatically(job:SignatureJob):Promise<SignatureJob>{
  if(job.status==='ARCHIVED')return job;
  if(!job.providerEnvelopeId)return job;
  const process=processesStore.find(item=>item.id===job.processId);if(!process)return job;
  try{
    const[asten,googleAccessToken]=await Promise.all([getPersistentAstenConnection(),getGoogleWorkspaceAccessToken()]);
    if(!asten)throw new Error('Conta Asten não conectada.');
    if(!currentSettings.driveRootFolderId)throw new Error('Pasta raiz do Google Drive não configurada.');
    if(!process.driveFolderId){const folder=await ensurePortalProcessDriveFolder({accessToken:googleAccessToken,rootFolderId:currentSettings.driveRootFolderId,protocol:process.protocolo,processId:process.id});process.driveFolderId=folder.id;process.driveFolderUrl=folder.webViewLink;process.driveSyncedAt=new Date().toISOString();}
    job.signedAt=job.signedAt||job.completedAt||new Date().toISOString();
    const signerEvidence=await callAsten('getSignatariosPorEnvelope',{idEnvelope:job.providerEnvelopeId},asten.token);
    assertAstenEnvelopeSigners(signerEvidence,job.signers.map(signer=>({email:signer.email,order:signer.signingOrder})));
    const response=await callAsten('downloadPDFEnvelopeDocs',{idEnvelope:job.providerEnvelopeId},asten.token);
    const pdf=extractAstenSignedPdf(response);
    const fileName=buildPortalDriveFileName({protocol:process.protocolo,title:process.titulo,studentNames:[process.aluno1.nome,process.aluno2?.nome].filter(Boolean) as string[],documentType:job.documentType,version:job.documentVersion,lifecycle:'ASSINADO'});
    const signedSha256=createHash('sha256').update(pdf).digest('hex');
    const driveFile=await uploadSignedPdfToDrive({rootFolderId:currentSettings.driveRootFolderId,protocol:process.protocolo,accessToken:googleAccessToken,processFolderId:process.driveFolderId,processId:process.id,jobId:job.id,documentType:job.documentType,fileName,pdf,sha256:signedSha256});
    const wasCompleted=process.status==='CONCLUIDO';job.driveSignedFileId=String(driveFile.id);job.driveSignedWebViewLink=String(driveFile.webViewLink||'');job.signedSha256=signedSha256;job.verificationCode=job.verificationCode||randomBytes(18).toString('base64url');job.status='ARCHIVED';job.completedAt=job.updatedAt=new Date().toISOString();job.lastError=undefined;if(job.documentType==='ATA'&&!process.acervo?.submittedAt){process.status='AGUARDANDO_DADOS_FINAIS';process.etapaAtual='REPOSITORIO';}if(declarationReady(process,signatureJobsStore))await executeConfiguredWorkflowEvent(process,'PUBLICATION_CLEARED','webhook@asten.local');updateProcessCompletion(process.id);await executeConfiguredWorkflowEvent(process,'SIGNATURE_COMPLETED','webhook@asten.local');if(!wasCompleted&&process.status==='CONCLUIDO')await executeConfiguredWorkflowEvent(process,'PROCESS_COMPLETED','webhook@asten.local');
  }catch(error){job.status='DRIVE_SYNC_PENDING';job.lastError=error instanceof Error?error.message:'Falha ao arquivar PDF assinado.';job.updatedAt=new Date().toISOString();}
  persistPortalState();return job;
}
function findAstenEnvelopeId(b:any):string|null{const f=[b?.idEnvelope,b?.Envelope?.id,b?.envelope?.id,b?.data?.idEnvelope,b?.response?.data?.idEnvelope].find(v=>v!==undefined&&v!==null&&String(v));return f?String(f):null;}
function inferAstenJobStatus(b:any,current:SignatureJobStatus):SignatureJobStatus{if(['ARCHIVED','SIGNED'].includes(current))return current;const s=Number(b?.Envelope?.status??b?.envelope?.status??b?.statusEnvelope??b?.status);if(s===3)return'SIGNED';if(s===5)return'CANCELED';if(s===6)return'EXPIRED';if(s===2)return'SENT';const op=String(b?.operacao||b?.evento||'').toLowerCase();if(op.includes('recus'))return'DECLINED';if(op.includes('assin'))return'PARTIALLY_SIGNED';return current;}

export async function createPortalApp() {
  if(productionRuntime&&!bootstrapMasterEmail&&!persistedPortalState.settings?.masterEmail)throw new Error('Implantação bloqueada: configure PORTAL_BOOTSTRAP_MASTER_EMAIL para definir o primeiro Master sem usar dados de demonstração.');
  if((process.env.NODE_ENV==='production'||Boolean(process.env.VERCEL))&&!getSupabaseRuntimeStatus().durablePersistenceReady)throw new Error('Implantação bloqueada: configure a persistência durável do Supabase antes de iniciar o portal em produção.');
  if(productionRuntime){
    assertPortalSessionConfigured();
    const otpStatus=getOtpRuntimeStatus();if(!otpStatus.configured||!otpStatus.durable)throw new Error('Implantação bloqueada: configure PORTAL_OTP_PEPPER exclusivo e o armazenamento durável de códigos no Supabase.');
    const oauthSecurity=getGoogleOAuthSecurityPreflight();if(!oauthSecurity.ready)throw new Error(`Implantação bloqueada: ${oauthSecurity.issues.join(' ')}`);
    const secretStore=getSecretStoreStatus();if(!secretStore.configured||!secretStore.durable)throw new Error('Implantação bloqueada: configure PORTAL_SECRET_ENCRYPTION_KEY e o cofre durável de integrações no Supabase.');
    const fileTransport=getSupabaseStagingSecurityStatus();if(!fileTransport.configured)throw new Error('Implantação bloqueada: configure o bucket privado de transporte e um PORTAL_UPLOAD_BINDING_SECRET exclusivo com pelo menos 32 caracteres.');
    const cronSecret=String(process.env.CRON_SECRET||'').trim();
    const cronSecretReused=[process.env.PORTAL_SESSION_SECRET,process.env.PORTAL_OTP_PEPPER,process.env.PORTAL_UPLOAD_BINDING_SECRET,process.env.PORTAL_VERIFICATION_SECRET,process.env.ASTEN_WEBHOOK_SECRET].map(value=>String(value||'').trim()).filter(Boolean).includes(cronSecret);
    if(process.env.VERCEL&&(cronSecret.length<32||cronSecretReused))throw new Error('Implantação bloqueada: configure CRON_SECRET exclusivo com pelo menos 32 caracteres para a limpeza diária do transporte privado.');
    const verificationSecret=String(process.env.PORTAL_VERIFICATION_SECRET||'').trim();if(verificationSecret.length<32)throw new Error('Implantação bloqueada: configure PORTAL_VERIFICATION_SECRET com pelo menos 32 caracteres.');
    if(process.env.ASTEN_INTEGRATION_ENABLED==='true'){const astenSecurity=getAstenSecurityPreflight();if(!astenSecurity.callbackConfigured)throw new Error(`Implantação bloqueada: ${astenSecurity.issues.join(' ')}`);}
    const databaseStatus=await testSupabaseRuntimeConnection();if(!databaseStatus.connected||!databaseStatus.transactionalRuntimeReady)throw new Error('Implantação bloqueada: aplique todas as migrações do Supabase, incluindo a outbox transacional Asten v6, antes de iniciar o portal em produção.');
  }
  if (getSupabaseRuntimeStatus().durablePersistenceReady) {
    try {
      const remote = await loadPortalRuntimeState<PersistedPortalState>();
      if (remote) applyPersistedState(remote);
    } catch (error) {
      throw new Error(`Persistência Supabase configurada, mas indisponível: ${error instanceof Error ? error.message : error}`);
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
    const storageOrigin=supabaseConnectOrigin();
    res.setHeader('Content-Security-Policy',`default-src 'self'; script-src 'self'${developmentNonce?` 'nonce-${developmentNonce}'`:''}; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data:; connect-src 'self'${storageOrigin?` ${storageOrigin}`:''}${developmentNonce?' ws: wss:':''}; frame-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'`);
    if(productionRuntime)res.setHeader('Strict-Transport-Security','max-age=31536000; includeSubDomains');
    next();
  });

  // Em produção os binários vão direto ao bucket privado. O limite abaixo só
  // cobre JSON e o fallback local de até 2 MB, nunca os PDFs/DOCX completos.
  app.use(express.json({ limit: '4mb' }));

  app.use('/api', async (req, res, next) => {
    const durable = getSupabaseRuntimeStatus().durablePersistenceReady;
    const publicRead = req.method === 'GET' && (req.path.startsWith('/public/') || req.path === '/health');
    if (!durable || publicRead) return next();
    try {
      await remotePersistenceQueue;
      const remote = await loadPortalRuntimeState<PersistedPortalState>();
      if (remote) applyPersistedState(remote);
      next();
    } catch (error) {
      console.error('[Security] Falha ao atualizar a autorização pelo Supabase:', error);
      res.status(503).json({ error: 'Não foi possível confirmar as permissões atuais. Tente novamente.' });
    }
  });

  app.use('/api', (req, res, next) => {
    if (!['POST', 'PATCH', 'PUT', 'DELETE'].includes(req.method) || !getSupabaseRuntimeStatus().durablePersistenceReady) return next();
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
      console.log(`[API] ${req.method} ${req.path}`);
    }
    next();
  });

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  app.use('/api', attachPortalIdentity);
  app.use('/api',(req,res,next)=>{const identity=getPortalIdentity(req);if(identity&&(identity.issuedAt<Number(currentSettings.sessionValidAfter||0)||revokedSessionIdsStore.has(identity.sessionId))){(req as any).portalIdentity=null;clearPortalSessionCookie(res);}next();});
  app.use('/api',(req,res,next)=>{if(!['POST','PATCH','PUT','DELETE'].includes(req.method))return next();if(String(req.get('sec-fetch-site')||'').toLowerCase()==='cross-site')return res.status(403).json({error:'Requisição entre sites bloqueada.',code:'CROSS_SITE_REQUEST_BLOCKED'});const origin=String(req.get('origin')||'').trim();if(!origin)return next();const configured=String(process.env.PORTAL_PUBLIC_URL||process.env.APP_URL||'').trim();const expected=configured?new URL(/^https?:\/\//i.test(configured)?configured:`https://${configured}`).origin:`${req.protocol}://${req.get('host')}`;try{if(new URL(origin).origin!==expected)return res.status(403).json({error:'Origem da requisição não autorizada.',code:'ORIGIN_NOT_ALLOWED'});}catch{return res.status(403).json({error:'Origem da requisição inválida.',code:'ORIGIN_NOT_ALLOWED'});}next();});
  const requireGlobalRoles=(...roles:GlobalRole[])=>(req:express.Request,res:express.Response,next:express.NextFunction)=>{const identity=getPortalIdentity(req);if(!identity)return res.status(401).json({error:'Autenticação institucional obrigatória.'});const userRoles=getUserRolesForEmail(identity.email).globalRoles;if(!roles.some(role=>userRoles.includes(role)))return res.status(403).json({error:'Seu perfil não tem permissão para esta operação.'});next();};
  const requireAdministrator=requireGlobalRoles('MASTER_ADMIN','COMMISSION_PRESIDENT');
  const requireAdministrativeOperator=requireGlobalRoles('MASTER_ADMIN','COMMISSION_PRESIDENT');

  app.post('/api/uploads/staging',async(req,res)=>{
    const purpose=String(req.body?.purpose||'') as StagedUploadPurpose;
    const identity=getPortalIdentity(req);
    let requesterBinding='';
    let processId:string|undefined;
    let verificationCode:string|undefined;
    if(purpose==='DOCUMENT_MODEL'){
      if(!identity)return res.status(401).json({error:'Autenticação institucional obrigatória.'});
      if(!hasFullAdministration(identity.email))return res.status(403).json({error:'Somente o Master ou o Presidente pode enviar modelos.'});
      requesterBinding=sessionUploadBinding(identity);
    }else if(purpose==='PROCESS_FULL_WORK'||purpose==='PROCESS_EXPANDED_ABSTRACT'){
      if(!identity)return res.status(401).json({error:'Autenticação institucional obrigatória.'});
      processId=String(req.body?.processId||'').trim();
      const process=processesStore.find(item=>item.id===processId);
      if(!process||!canAccessProcess(identity.email,process.id))return res.status(404).json({error:'Processo não encontrado.'});
      const roles=getActiveProcessRoles(identity.email,process.id);
      if(!hasFullAdministration(identity.email)&&!roles.includes('STUDENT'))return res.status(403).json({error:'Seu perfil não pode anexar arquivos finais.'});
      if(process.avaliacao.status!=='CONCLUIDO')return res.status(409).json({error:'A avaliação precisa ser concluída antes do envio dos arquivos finais.'});
      requesterBinding=sessionUploadBinding(identity);
    }else if(purpose==='VERIFICATION_PDF'){
      verificationCode=String(req.body?.verificationCode||'').trim();
      const job=signatureJobsStore.find(item=>item.verificationCode===verificationCode&&item.status==='ARCHIVED');
      if(!job)return res.status(404).json({error:'Registro de validação não localizado.'});
      if(!allowPublicDownload(req.ip||''))return res.status(429).json({error:'Limite temporário de validações atingido. Tente novamente em instantes.'});
      requesterBinding=verificationUploadBinding(verificationCode);
    }else return res.status(400).json({error:'Finalidade de upload inválida.'});
    try{
      const ticket=await createSupabaseStagedUpload({purpose,requesterBinding,processId,verificationCode,fileName:String(req.body?.fileName||''),size:Number(req.body?.size),mimeType:String(req.body?.mimeType||'').toLowerCase(),sha256:String(req.body?.sha256||'').toLowerCase()});
      res.status(201).json(ticket);
    }catch(error){
      const message=error instanceof Error?error.message:'Não foi possível autorizar o upload.';
      const unavailable=message.includes('exige Supabase')||message.includes('configurado');
      res.status(unavailable?503:400).json({error:message});
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
    const[uploadsResult,downloadsResult,intelligenceResult]=await Promise.allSettled([cleanupExpiredStagedUploads(500),cleanupExpiredDownloadTransfers(500),refreshContinuousIntelligence('SYSTEM','system@portal.local',true)]);
    const failures=[uploadsResult,downloadsResult,intelligenceResult].filter(result=>result.status==='rejected').map(result=>result.status==='rejected'?(result.reason instanceof Error?result.reason.message:String(result.reason)):'');
    const intelligence=intelligenceResult.status==='fulfilled'?{version:intelligenceResult.value.artifacts.TCC_STATISTICAL_REPORT.version,proposalsActive:intelligenceResult.value.proposals.filter(item=>item.evidenceActive).length,driveStatus:Object.fromEntries(Object.entries(intelligenceResult.value.artifacts).map(([kind,artifact])=>[kind,artifact.driveSyncStatus]))}:null;
    let workflow:Awaited<ReturnType<typeof runWorkflowMaintenance>>|null=null;
    try{workflow=await runWorkflowMaintenance();if(workflow.failed||workflow.configurationErrors.length)failures.push('Há lembretes com falha; confira a central de andamento.');}catch(error){failures.push(error instanceof Error?error.message:'Falha na manutenção do fluxo.');}
    res.setHeader('Cache-Control','no-store');
    res.status(failures.length?502:200).json({ok:failures.length===0,uploads:uploadsResult.status==='fulfilled'?uploadsResult.value:null,downloads:downloadsResult.status==='fulfilled'?downloadsResult.value:null,intelligence,workflow,failures,executedAt:new Date().toISOString()});
  });

  // GET /api/me
  app.get('/api/me', (req, res) => {
    const identity=getPortalIdentity(req); const email=identity?.email||'visitante@publico.local';
    const { globalRoles, memberships } = getUserRolesForEmail(email);

    res.json({
      userEmail: email,
      globalRoles,
      memberships,
      isAuthenticated: Boolean(identity), authenticationMode:identity?.method||'PUBLIC'
    });
  });

  app.post('/api/auth/request-code', async (req,res)=>{
    const startedAt=Date.now();
    const email=normalizeEmail(String(req.body?.email||''));
    if(!isValidPortalEmail(email))return res.status(400).json({error:'Informe um e-mail válido.'});
    const allowedByIp=allowOtpRequestFromIp(req.ip||'');
    if(allowedByIp&&canRequestPortalAccess(email))await requestPortalOtp({email,ip:req.ip,portalName:resolveInstallationProfile(currentSettings).portalName}).catch(()=>undefined);
    await enforceMinimumResponseTime(startedAt);
    res.json({sent:true,expiresInMinutes:10,message:'Se o e-mail estiver autorizado, um código será enviado.'});
  });

  app.post('/api/auth/verify-code',async(req,res)=>{
    const startedAt=Date.now();
    const email=normalizeEmail(String(req.body?.email||''));
    if(!canRequestPortalAccess(email)){await enforceMinimumResponseTime(startedAt);return res.status(401).json({error:'Código inválido ou expirado.'});}
    try{
      assertPortalSessionConfigured();
      await verifyPortalOtp({email,code:String(req.body?.code||'')});
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
    if(allowed&&allowedByIp)await requestPortalOtp({email,ip:req.ip,portalName:resolveInstallationProfile(currentSettings).portalName}).catch(()=>undefined);
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
      if(!bootstrap&&(!identity||!hasFullAdministration(identity.email)))return res.status(403).json({error:'Somente o usuário Master ou o Presidente da Comissão pode autorizar ou substituir a conta Google do portal.'});
      if(!bootstrap&&identity&&!hasRecentAuthentication(identity))return res.status(428).json({error:'Entre novamente antes de substituir a conta Google do portal.',code:'REAUTHENTICATION_REQUIRED'});
      const email=bootstrap?normalizeEmail(String(process.env.PORTAL_BOOTSTRAP_MASTER_EMAIL||'')):identity!.email;
      if(bootstrap&&!email)return res.status(409).json({error:'Configure PORTAL_BOOTSTRAP_MASTER_EMAIL antes do primeiro acesso.'});
      const requestedReturnTo=String(req.query.returnTo||'/?google=connected');
      const returnTo=requestedReturnTo.startsWith('/')&&!requestedReturnTo.startsWith('//')?requestedReturnTo:'/?google=connected';
      res.redirect(buildGoogleAuthorizationUrl({email,bootstrap,returnTo}));
    }catch(error){res.status(400).json({error:error instanceof Error?error.message:'Não foi possível iniciar a autorização Google.'});}
  });

  app.get('/api/integrations/google/oauth/callback',async(req,res)=>{
    try{
      const state=decodeGoogleOAuthState(String(req.query.state||''));
      const authorization=await exchangeGoogleAuthorizationCode(String(req.query.code||''));
      const expected=normalizeEmail(state.email||process.env.PORTAL_BOOTSTRAP_MASTER_EMAIL||'');
      if(expected&&normalizeEmail(authorization.email)!==expected)throw new Error(`Autorize a conta Google esperada (${expected}).`);
      await persistGoogleWorkspaceAuthorization(authorization);
      const manifest=await bootstrapGoogleDriveStructure(authorization.accessToken,{rootFolderName:resolveInstallationProfile(currentSettings).driveRootFolderName});
      currentSettings={...currentSettings,driveRootFolderId:manifest.rootFolderId,updatedAt:new Date().toISOString()};
      if(state.bootstrap)currentSettings.masterEmail=authorization.email;
      auditLogsStore.push({id:`log-${Date.now()}`,actorEmail:authorization.email,actorRoles:getUserRolesForEmail(authorization.email).globalRoles,action:'CONEXAO_GOOGLE_WORKSPACE',entityType:'integration',entityId:'google_workspace',after:{rootFolderId:manifest.rootFolderId,modelFiles:manifest.modelFiles},timestamp:new Date().toISOString()});
      await persistPortalStateDurably();
      res.redirect(state.returnTo.startsWith('/')&&!state.returnTo.startsWith('//')?state.returnTo:'/?google=connected');
    }catch(error){res.status(400).send(`Falha na autorização Google: ${escapeHtml(error instanceof Error?error.message:'erro desconhecido')}`);}
  });

  // GET /api/settings
  app.get('/api/registration/draft',requireAuthenticated,(req,res)=>{
    const email=getPortalIdentity(req)!.email;registrationDraftsStore=pruneDrafts(registrationDraftsStore);
    res.setHeader('Cache-Control','private, no-store');res.json(registrationDraftsStore[email]||null);
  });
  app.put('/api/registration/draft',requireAuthenticated,async(req,res)=>{
    const email=getPortalIdentity(req)!.email;
    if(processesStore.some(p=>[p.aluno1.email,p.aluno2?.email].includes(email)))return res.status(409).json({error:'Você já tem um TCC. Continue pelo processo existente.'});
    try{const draft=saveRegistrationDraft(registrationDraftsStore[email],req.body,email,currentSettings.integrationStudio);registrationDraftsStore[email]=draft;await persistPortalStateDurably();res.setHeader('Cache-Control','private, no-store');res.json(draft);}
    catch(error){res.status(error instanceof DraftConflict?409:400).json({error:error instanceof Error?error.message:'Rascunho inválido.'});}
  });
  app.delete('/api/registration/draft',requireAuthenticated,async(req,res)=>{const email=getPortalIdentity(req)!.email;delete registrationDraftsStore[email];await persistPortalStateDurably();res.json({deleted:true});});
  app.get('/api/forms/registration-schema',requireAuthenticated,(_req,res)=>{const studio=currentSettings.integrationStudio;const config=operationalConfig(studio);res.setHeader('Cache-Control','private, no-store');res.json({revision:studio?.revision||0,formTemplates:(studio?.formTemplates||[]).filter(form=>form.id==='form-reserva-aluno'),operationsPolicy:{timezone:studio?.operationsPolicy?.timezone||'America/Sao_Paulo'},operationalConfig:{reservation:{departmentEmail:'',locations:config.reservation.locations},catalogs:config.catalogs,diagnostics:config.diagnostics,presentations:{},workflow:{...workflowPolicy(studio),deadlines:[],holidays:[]}}});});
  app.get('/api/settings', (req, res) => {
    const identity=getPortalIdentity(req);res.json(publicSettingsForRequest(Boolean(identity&&getUserRolesForEmail(identity.email).globalRoles.length)));
  });

  app.get('/api/public/installation-profile',(_req,res)=>res.json(resolveInstallationProfile(currentSettings)));
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
    const identity=getPortalIdentity(req)!;if(!hasRecentAuthentication(identity))return res.status(428).json({error:'Entre novamente antes de alterar os contatos de recuperação.',code:'REAUTHENTICATION_REQUIRED'});
    const input:unknown[]=Array.isArray(req.body?.emails)?req.body.emails:[];
    const emails:string[]=Array.from(new Set<string>(input.map((value:unknown)=>normalizeEmail(String(value))).filter((value:string)=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))));
    if(!emails.length||emails.length>5)return res.status(400).json({error:'Cadastre de um a cinco e-mails válidos de recuperação.'});
    const before=(currentSettings.masterRecoveryEmails||[]).map(value=>createHash('sha256').update(normalizeEmail(value)).digest('hex'));
    currentSettings={...currentSettings,masterRecoveryEmails:emails,updatedAt:new Date().toISOString()};
    auditLogsStore.push({id:`log-${Date.now()}-recovery-contacts`,actorEmail:identity.email,actorRoles:getUserRolesForEmail(identity.email).globalRoles,action:'ALTERACAO_CONTATOS_RECUPERACAO',entityType:'security',entityId:'master_recovery_emails',before:{emailHashes:before},after:{emailHashes:emails.map(value=>createHash('sha256').update(value).digest('hex')),count:emails.length},timestamp:currentSettings.updatedAt});
    await persistPortalStateDurably();res.json(publicSettingsForRequest(true));
  });

  app.get('/api/admin/administration-transfers',requireAuthenticated,requireAdministrator,requireFeature('ADMIN_TRANSFER'),(_req,res)=>res.json(administrationTransfersStore.slice().reverse()));
  app.get('/api/administration-transfers/pending',requireAuthenticated,requireFeature('ADMIN_TRANSFER'),(req,res)=>{const identity=getPortalIdentity(req)!;res.json(administrationTransfersStore.filter(item=>item.targetEmail===identity.email&&item.status==='PENDING_TARGET_ACCEPTANCE'&&Date.parse(item.expiresAt)>Date.now()));});
  app.post('/api/admin/administration-transfers',requireAuthenticated,requireAdministrator,requireFeature('ADMIN_TRANSFER'),async(req,res)=>{
    const identity=getPortalIdentity(req)!;if(!hasRecentAuthentication(identity))return res.status(428).json({error:'Entre novamente antes de iniciar uma transferência.'});const role=String(req.body?.role||'') as AdministrationTransfer['role'],targetEmail=normalizeEmail(String(req.body?.targetEmail||''));if(!['MASTER_ADMIN','COMMISSION_PRESIDENT'].includes(role)||!isValidPortalEmail(targetEmail))return res.status(400).json({error:'Informe o papel e o novo e-mail válidos.'});const actorRoles=getUserRolesForEmail(identity.email).globalRoles;if(role==='MASTER_ADMIN'&&!actorRoles.includes('MASTER_ADMIN'))return res.status(403).json({error:'Somente o Master atual pode transferir a titularidade Master.'});if(administrationTransfersStore.some(item=>item.role===role&&item.status==='PENDING_TARGET_ACCEPTANCE'&&Date.parse(item.expiresAt)>Date.now()))return res.status(409).json({error:'Já existe uma transferência pendente para este papel.'});
    const now=new Date(),transfer:AdministrationTransfer={id:`transfer-${randomBytes(12).toString('hex')}`,role,targetEmail,requestedBy:identity.email,status:'PENDING_TARGET_ACCEPTANCE',requestedAt:now.toISOString(),expiresAt:new Date(now.getTime()+30*60_000).toISOString(),googleReconnectRequired:role==='MASTER_ADMIN'};administrationTransfersStore.push(transfer);await requestPortalOtp({email:targetEmail,ip:req.ip,portalName:resolveInstallationProfile(currentSettings).portalName});auditLogsStore.push({id:`log-${Date.now()}`,actorEmail:identity.email,actorRoles,action:'INICIO_TRANSFERENCIA_ADMINISTRACAO',entityType:'administration_transfer',entityId:transfer.id,after:{role,targetEmailHash:createHash('sha256').update(targetEmail).digest('hex'),expiresAt:transfer.expiresAt},timestamp:transfer.requestedAt});await persistPortalStateDurably();res.status(201).json(transfer);
  });
  app.post('/api/admin/administration-transfers/:id/accept',requireAuthenticated,requireFeature('ADMIN_TRANSFER'),async(req,res)=>{
    const identity=getPortalIdentity(req)!;const transfer=administrationTransfersStore.find(item=>item.id===req.params.id);if(!transfer||transfer.targetEmail!==identity.email)return res.status(404).json({error:'Transferência não encontrada.'});if(transfer.status!=='PENDING_TARGET_ACCEPTANCE'||Date.parse(transfer.expiresAt)<=Date.now()){if(transfer.status==='PENDING_TARGET_ACCEPTANCE')transfer.status='EXPIRED';return res.status(409).json({error:'A transferência expirou ou já foi concluída.'});}if(!hasRecentAuthentication(identity))return res.status(428).json({error:'Valide novamente o código recebido por e-mail.'});const before={masterEmail:currentSettings.masterEmail,ownerEmail:currentSettings.ownerEmail,commissionPresidentEmail:currentSettings.commissionPresidentEmail};if(transfer.role==='MASTER_ADMIN')currentSettings={...currentSettings,masterEmail:identity.email,ownerEmail:identity.email};else currentSettings={...currentSettings,commissionPresidentEmail:identity.email};transfer.status='COMPLETED';transfer.completedAt=new Date().toISOString();currentSettings.updatedAt=transfer.completedAt;auditLogsStore.push({id:`log-${Date.now()}`,actorEmail:identity.email,actorRoles:[transfer.role],action:'CONCLUSAO_TRANSFERENCIA_ADMINISTRACAO',entityType:'administration_transfer',entityId:transfer.id,before,after:{role:transfer.role,targetEmailHash:createHash('sha256').update(identity.email).digest('hex'),googleReconnectRequired:transfer.googleReconnectRequired},timestamp:transfer.completedAt});await persistPortalStateDurably();res.json({transfer,googleReconnectRequired:transfer.googleReconnectRequired,message:transfer.googleReconnectRequired?'Titularidade transferida. O novo Master deve autorizar a própria conta Google antes de desativar o acesso anterior.':'Presidência transferida com sucesso.'});
  });
  app.post('/api/admin/administration-transfers/:id/cancel',requireAuthenticated,requireAdministrator,requireFeature('ADMIN_TRANSFER'),async(req,res)=>{const identity=getPortalIdentity(req)!;const transfer=administrationTransfersStore.find(item=>item.id===req.params.id);if(!transfer)return res.status(404).json({error:'Transferência não encontrada.'});const actorRoles=getUserRolesForEmail(identity.email).globalRoles;if(transfer.role==='MASTER_ADMIN'&&!actorRoles.includes('MASTER_ADMIN'))return res.status(403).json({error:'Somente o Master atual pode cancelar a transferência Master.'});if(transfer.status!=='PENDING_TARGET_ACCEPTANCE')return res.status(409).json({error:'Somente transferências pendentes podem ser canceladas.'});transfer.status='CANCELED';transfer.canceledAt=new Date().toISOString();auditLogsStore.push({id:`log-${Date.now()}`,actorEmail:identity.email,actorRoles,action:'CANCELAMENTO_TRANSFERENCIA_ADMINISTRACAO',entityType:'administration_transfer',entityId:transfer.id,timestamp:transfer.canceledAt});await persistPortalStateDurably();res.json(transfer);});

  app.post('/api/admin/studio/compare',requireAuthenticated,requireAdministrator,(req,res)=>{
    const before=req.body?.baseRevision?studioVersionsStore.find(item=>item.revision===Number(req.body.baseRevision))?.snapshot:currentSettings.integrationStudio;
    if(!before)return res.status(404).json({error:'Versão de referência indisponível.'});
    const changes=compareStudioVersions(before,req.body?.studio||{});
    res.setHeader('Cache-Control','private, no-store');res.json({baseRevision:before.revision,changes,activeProcesses:processesStore.filter(p=>p.status!=='CONCLUIDO').length,notice:'Processos em andamento usam a revisão publicada nos próximos eventos. Documentos já expedidos permanecem preservados.'});
  });
  app.post('/api/admin/models/:type/preview',requireAuthenticated,requireAdministrator,async(req,res)=>{
    const identity=getPortalIdentity(req)!;if(!hasRecentAuthentication(identity))return res.status(428).json({error:'Entre novamente antes de gerar uma amostra com os modelos do Drive.'});
    const type=String(req.params.type).toUpperCase() as 'CONVITE'|'ATA'|'TERMO'|'DECLARACAO';if(!['CONVITE','ATA','TERMO','DECLARACAO'].includes(type))return res.status(404).json({error:'Modelo inválido.'});
    try{
      const studio=req.body?.studio||currentSettings.integrationStudio;if(!studio)throw new Error('Configure o Estúdio primeiro.');
      const sample=previewProcess(studio,req.body?.answers||{});const pdf=await renderOfficialTemplatePdf(sample.process,type,undefined,sample.variables,studio);
      const analysis=await inspectPdfLayout(pdf,{...workflowPolicy(studio).documentLayout,needsSignature:type!=='CONVITE'});
      const marked=await markPreview(pdf),fileName=`AMOSTRA_SEM_VALIDADE_${type}.pdf`;
      const download=shouldUseSupabaseDownloadGateway()?await createSupabaseEphemeralDownload({bytes:marked,fileName,mimeType:'application/pdf',requesterBinding:sessionUploadBinding(identity),expiresInSeconds:60}):null;
      if(!download&&marked.length>2*1024*1024)throw new Error('Conecte o transporte privado Supabase para baixar uma amostra acima de 2 MB.');
      res.setHeader('Cache-Control','private, no-store');res.json({analysis,fileName,downloadUrl:download?.url,expiresAt:download?.expiresAt,contentBase64:download?undefined:marked.toString('base64'),templateSha256:currentSettings.documentModels?.[type]?.contentSha256,studioRevision:studio.revision,signed:false});
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
  app.post('/api/admin/workflow/simulate',requireAuthenticated,requireAdministrator,async(req,res)=>{try{const studio=req.body?.studio||currentSettings.integrationStudio;if(!studio)return res.status(400).json({error:'Configure o Estúdio primeiro.'});res.setHeader('Cache-Control','private, no-store');res.json(await simulateWorkflow(studio,req.body?.scenario||{}));}catch(error){res.status(400).json({error:error instanceof Error?error.message:'Simulação inválida.'});}});
  app.get('/api/admin/continuous-intelligence',requireAuthenticated,requireAdministrator,(_req,res)=>{
    res.setHeader('Cache-Control','private, no-store');
    res.json(publicContinuousIntelligence());
  });
  app.post('/api/admin/continuous-intelligence/refresh',requireAuthenticated,requireAdministrator,async(req,res)=>{
    const identity=getPortalIdentity(req)!;
    try{
      await refreshContinuousIntelligence('MASTER',identity.email,true);
      res.setHeader('Cache-Control','private, no-store');
      res.json(publicContinuousIntelligence());
    }catch(error){res.status(502).json({error:error instanceof Error?error.message:'Não foi possível atualizar os arquivos vivos.'});}
  });
  app.patch('/api/admin/continuous-intelligence/proposals/:id',requireAuthenticated,requireAdministrator,async(req,res)=>{
    const identity=getPortalIdentity(req)!;
    if(!hasRecentAuthentication(identity))return res.status(428).json({error:'Entre novamente antes de registrar a decisão sobre uma melhoria.',code:'REAUTHENTICATION_REQUIRED'});
    const proposal=continuousIntelligenceStore.proposals.find(item=>item.id===req.params.id);
    if(!proposal)return res.status(404).json({error:'Proposta de melhoria não encontrada.'});
    const status=String(req.body?.status||'') as ImprovementStatus;
    if(!['PROPOSED','APPROVED','REJECTED','IMPLEMENTED'].includes(status))return res.status(400).json({error:'Decisão inválida.'});
    const before={status:proposal.status,reviewNote:proposal.reviewNote};
    proposal.status=status;
    proposal.reviewedAt=new Date().toISOString();
    proposal.reviewedBy=identity.email;
    proposal.reviewNote=String(req.body?.reviewNote||'').trim().slice(0,1000)||undefined;
    auditLogsStore.push({id:`log-${Date.now()}-improvement-decision`,actorEmail:identity.email,actorRoles:getUserRolesForEmail(identity.email).globalRoles,action:'DECISAO_PROPOSTA_MELHORIA',entityType:'improvement_proposal',entityId:proposal.id,before,after:{status,hasReviewNote:Boolean(proposal.reviewNote)},timestamp:proposal.reviewedAt});
    try{
      await refreshContinuousIntelligence('MASTER',identity.email,true);
      res.json(publicContinuousIntelligence());
    }catch(error){res.status(502).json({error:error instanceof Error?error.message:'A decisão foi registrada, mas o arquivo não pôde ser atualizado.'});}
  });
  app.get('/api/admin/continuous-intelligence/files/:kind',requireAuthenticated,requireAdministrator,(req,res)=>{
    const kind=String(req.params.kind||'') as LivingPortalArtifactKind;
    if(!['FLOW_IMPROVEMENT_MEMORY','TCC_STATISTICAL_REPORT'].includes(kind))return res.status(404).json({error:'Arquivo vivo não encontrado.'});
    const artifact=continuousIntelligenceStore.artifacts[kind];
    res.setHeader('Cache-Control','private, no-store');
    res.setHeader('Content-Type','text/markdown; charset=utf-8');
    res.setHeader('X-Content-Type-Options','nosniff');
    res.setHeader('Content-Disposition',`attachment; filename="${safeDownloadFileName(artifact.fileName)}"`);
    res.send(artifact.markdown);
  });

  app.get('/api/admin/metrics/definitions',requireAuthenticated,requireAdministrator,requireFeature('OPERATIONS_KPIS'),(_req,res)=>res.json([
    {key:'processes',label:'Trabalhos cadastrados',unit:'count'},{key:'completionRate',label:'Taxa de conclusão',unit:'percent'},{key:'publicationRate',label:'Taxa de publicação',unit:'percent'},{key:'signatures',label:'Assinaturas Asten',unit:'count'},{key:'emails',label:'Entregas de e-mail',unit:'count'}
  ]));
  app.get('/api/admin/metrics',requireAuthenticated,requireAdministrator,requireFeature('OPERATIONS_KPIS'),(req,res)=>{
    const cycleId=String(req.query.cycleId||'');const selected=processesStore.filter(process=>!cycleId||process.academicCycleId===cycleId);const total=selected.length,completed=selected.filter(process=>process.status==='CONCLUIDO').length,published=selected.filter(publicationRequested).length;const processIds=new Set(selected.map(process=>process.id));const jobs=signatureJobsStore.filter(job=>processIds.has(job.processId));const emails=emailDeliveriesStore.filter(record=>!record.processId||processIds.has(record.processId));const byStatus=Object.fromEntries(Array.from(new Set(selected.map(process=>process.status))).map(status=>[status,selected.filter(process=>process.status===status).length]));const completedDurations=selected.filter(process=>process.status==='CONCLUIDO').map(process=>Date.parse(process.updatedAt)-Date.parse(process.createdAt)).filter(value=>Number.isFinite(value)&&value>=0).sort((a,b)=>a-b);const middle=Math.floor(completedDurations.length/2),medianMs=completedDurations.length?(completedDurations.length%2?completedDurations[middle]:(completedDurations[middle-1]+completedDurations[middle])/2):null;
    const outcomes=total>=5?Object.fromEntries(Array.from(new Set(selected.map(process=>process.avaliacao.resultadoCode).filter(Boolean))).map(code=>[String(code),selected.filter(process=>process.avaliacao.resultadoCode===code).length])):null;
    res.setHeader('Cache-Control','private, no-store');res.json({generatedAt:new Date().toISOString(),cycleId:cycleId||null,privacy:{containsPersonalData:false,smallGroupSuppressed:total>0&&total<5},processes:{total,completed,byStatus,completionRate:total?Number((completed/total*100).toFixed(1)):0,medianCompletionDays:medianMs===null?null:Number((medianMs/86_400_000).toFixed(1)),outcomes},publication:{published,rate:total?Number((published/total*100).toFixed(1)):0},signatures:{total:jobs.length,archived:jobs.filter(job=>job.status==='ARCHIVED').length,failed:jobs.filter(job=>['PROVIDER_ERROR','DECLINED','EXPIRED','DRIVE_SYNC_PENDING'].includes(job.status)).length},emails:{total:emails.length,accepted:emails.filter(record=>record.status==='ACCEPTED_BY_GMAIL').length,failed:emails.filter(record=>record.status==='FAILED').length},quality:{pendingCoauthor:selected.filter(coauthorIsPending).length,missingFinalData:selected.filter(process=>process.avaliacao.status==='CONCLUIDO'&&!repositoryDataComplete(process)).length}});
  });

  app.get('/api/public/calendar.ics',(req,res)=>{
    const escapeIcs=(value:unknown)=>String(value||'').replace(/\\/g,'\\\\').replace(/\r?\n/g,'\\n').replace(/,/g,'\\,').replace(/;/g,'\\;');
    const date=(value:string)=>{const parsed=new Date(value);return Number.isFinite(parsed.getTime())?parsed.toISOString().replace(/[-:]/g,'').replace(/\.\d{3}Z$/,'Z'):'';};
    const host=String(req.get('host')||'portal.local');
    const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Portal Institucional de TCC//Agenda//PT','CALSCALE:GREGORIAN','METHOD:PUBLISH',`X-WR-CALNAME:${escapeIcs(resolveInstallationProfile(currentSettings).portalName)}`,`X-WR-TIMEZONE:${escapeIcs(currentSettings.integrationStudio?.operationsPolicy?.timezone||currentSettings.timezone||'America/Sao_Paulo')}`];
    for(const process of processesStore.filter(item=>item.defesa?.localStatus==='CONFIRMADO'&&item.defesa.startAt))lines.push('BEGIN:VEVENT',`UID:${escapeIcs(process.id)}@${escapeIcs(host)}`,`DTSTAMP:${date(process.updatedAt)}`,`DTSTART:${date(process.defesa.startAt)}`,`DTEND:${date(process.defesa.endAt)}`,`SUMMARY:${escapeIcs(`Defesa de TCC — ${formatStudentsString(process.aluno1,process.aluno2)}`)}`,`DESCRIPTION:${escapeIcs(`${process.titulo} | ${process.protocolo}`)}`,`LOCATION:${escapeIcs(process.defesa.local)}`,'END:VEVENT');
    lines.push('END:VCALENDAR');res.setHeader('Content-Type','text/calendar; charset=utf-8');res.setHeader('Content-Disposition','attachment; filename="agenda-defesas.ics"');res.setHeader('Cache-Control','public, max-age=300');res.send(lines.join('\r\n'));
  });

  app.get('/api/notification-preferences',requireAuthenticated,(req,res)=>{const email=getPortalIdentity(req)!.email;res.setHeader('Cache-Control','private, no-store');res.json(notificationPreferencesStore[email]||{email:true,inPortal:true,dailyDigest:false,workflowEvents:true,signatureEvents:true,failureEvents:true,updatedAt:new Date(0).toISOString()});});
  app.patch('/api/notification-preferences',requireAuthenticated,(req,res)=>{const identity=getPortalIdentity(req)!;const previous=notificationPreferencesStore[identity.email]||{} as NotificationPreferences;const next:NotificationPreferences={email:req.body?.email!==false,inPortal:req.body?.inPortal!==false,dailyDigest:Boolean(req.body?.dailyDigest),workflowEvents:req.body?.workflowEvents!==false,signatureEvents:req.body?.signatureEvents!==false,failureEvents:req.body?.failureEvents!==false,updatedAt:new Date().toISOString()};notificationPreferencesStore[identity.email]={...previous,...next};persistPortalState();res.json(notificationPreferencesStore[identity.email]);});
  app.get('/api/notifications',requireAuthenticated,(req,res)=>{
    const identity=getPortalIdentity(req)!;
    const admin=hasFullAdministration(identity.email);
    const allowedIds=new Set(admin?processesStore.map(item=>item.id):membershipsStore.filter(item=>item.active&&normalizeEmail(item.email)===identity.email).map(item=>item.processId));
    const notifications:any[]=[];
    for(const item of emailDeliveriesStore.filter(item=>(!item.processId||allowedIds.has(item.processId))&&item.status!=='ACCEPTED_BY_GMAIL').slice(-50))notifications.push({id:`email-${item.id}`,severity:item.status==='FAILED'?'ERROR':'WARNING',category:'EMAIL',title:'Entrega de e-mail requer atenção',message:`${item.subject} — ${item.status}`,processId:item.processId,createdAt:item.updatedAt});
    for(const job of signatureJobsStore.filter(item=>allowedIds.has(item.processId)&&['PROVIDER_ERROR','DECLINED','EXPIRED','DRIVE_SYNC_PENDING'].includes(item.status)).slice(-50))notifications.push({id:`signature-${job.id}`,severity:'ERROR',category:'SIGNATURE',title:'Assinatura requer atenção',message:`${job.documentType} — ${job.status}`,processId:job.processId,createdAt:job.updatedAt});
    if(admin){
      for(const job of formArchiveJobsStore.filter(item=>item.status==='FAILED').slice(-50))notifications.push({id:`form-archive-${job.id}`,severity:'ERROR',category:'FORM_ARCHIVE',title:'Formulário aguardando arquivamento',message:`${job.formType} — ${job.lastError||'Falha no Google Drive'}`,processId:job.processId,createdAt:job.updatedAt});
      for(const submission of studioFormSubmissionsStore.filter(item=>item.archiveStatus==='FAILED').slice(-50))notifications.push({id:`studio-form-${submission.id}`,severity:'ERROR',category:'FORM_ARCHIVE',title:'Formulário personalizado aguardando arquivamento',message:`${submission.formId} — ${submission.archiveError||'Falha no Google Drive'}`,processId:submission.processId,createdAt:submission.submittedAt});
      for(const run of workflowRunsStore.filter(item=>item.status!=='COMPLETED').slice(-50))notifications.push({id:`workflow-${run.id}`,severity:'ERROR',category:'WORKFLOW',title:'Etapa do fluxo requer atenção',message:`${run.eventCode} — ${run.issues.map(issue=>issue.message).join('; ')||'Ação não concluída'}`,processId:run.processId,createdAt:run.completedAt});
      for(const artifact of Object.values(continuousIntelligenceStore.artifacts).filter(item=>item.driveSyncStatus==='FAILED'))notifications.push({id:`intelligence-${artifact.kind}`,severity:'ERROR',category:'DRIVE',title:'Arquivo vivo aguardando sincronização',message:`${artifact.fileName} — ${artifact.driveError||'Falha no Google Drive'}`,createdAt:artifact.generatedAt});
    }
    res.setHeader('Cache-Control','private, no-store');
    res.json(notifications.sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).slice(0,100));
  });

  app.post('/api/admin/studio/validate',requireAuthenticated,requireAdministrator,(req,res)=>res.json(validateCourseStudio(req.body?.studio||currentSettings.integrationStudio||{})));
  app.get('/api/admin/studio/versions',requireAuthenticated,requireAdministrator,(_req,res)=>res.json(studioVersionsStore.slice().sort((a,b)=>b.revision-a.revision).map(({snapshot,...item})=>({...item,counts:{documents:snapshot.docTemplates.length,emails:snapshot.emailTemplates.length,forms:snapshot.formTemplates.length,stages:snapshot.workflowStages.length,variables:snapshot.matrixColumns.length}}))));
  app.get('/api/admin/studio/versions/:revision/compare',requireAuthenticated,requireAdministrator,(req,res)=>{const target=studioVersionsStore.find(item=>item.revision===Number(req.params.revision));const current=currentSettings.integrationStudio;if(!target||!current)return res.status(404).json({error:'Revisão não encontrada.'});const count=(value:any)=>Array.isArray(value)?value.length:0;res.json({fromRevision:target.revision,toRevision:current.revision,changed:target.checksum!==createHash('sha256').update(JSON.stringify(current)).digest('hex'),counts:{documents:[count(target.snapshot.docTemplates),count(current.docTemplates)],emails:[count(target.snapshot.emailTemplates),count(current.emailTemplates)],forms:[count(target.snapshot.formTemplates),count(current.formTemplates)],stages:[count(target.snapshot.workflowStages),count(current.workflowStages)],variables:[count(target.snapshot.matrixColumns),count(current.matrixColumns)]}});});
  app.post('/api/admin/studio/versions/:revision/restore',requireAuthenticated,requireAdministrator,(req,res)=>{const identity=getPortalIdentity(req)!;if(!hasRecentAuthentication(identity))return res.status(428).json({error:'Reautentique-se para restaurar uma versão do Estúdio.'});const target=studioVersionsStore.find(item=>item.revision===Number(req.params.revision));if(!target)return res.status(404).json({error:'Revisão não encontrada.'});const restored=JSON.parse(JSON.stringify(target.snapshot));restored.revision=Number(currentSettings.integrationStudio?.revision||0)+1;restored.savedAt=new Date().toISOString();restored.savedBy=identity.email;restored.publication={status:'PUBLISHED',publishedRevision:restored.revision,publishedAt:restored.savedAt,validationScore:validateCourseStudio(restored).score};const report=validateCourseStudio(restored);if(!report.ready)return res.status(409).json({error:'Esta revisão antiga não atende às validações atuais.',issues:report.issues});currentSettings={...currentSettings,integrationStudio:restored,updatedAt:restored.savedAt};auditLogsStore.push({id:`log-${Date.now()}`,actorEmail:identity.email,actorRoles:getUserRolesForEmail(identity.email).globalRoles,action:'RESTAURACAO_VERSAO_ESTUDIO',entityType:'integration_studio',entityId:String(target.revision),after:{restoredAsRevision:restored.revision},timestamp:restored.savedAt});persistPortalState();res.json({message:'Versão restaurada como uma nova revisão auditável.',studio:restored});});

  app.post('/api/admin/backup/drill',requireAuthenticated,requireAdministrator,(req,res)=>{const identity=getPortalIdentity(req)!;if(!hasRecentAuthentication(identity))return res.status(428).json({error:'Reautentique-se para executar o ensaio de restauração.'});const snapshot=snapshotPortalState();const serialized=JSON.stringify(snapshot);const checksum=createHash('sha256').update(serialized).digest('hex');const roundTrip=JSON.parse(serialized) as PersistedPortalState;const issues:string[]=[];if(!roundTrip.settings)issues.push('Configurações ausentes.');if(!Array.isArray(roundTrip.processes))issues.push('Coleção de processos ausente.');if((roundTrip.processes||[]).some(item=>!item.id||!item.protocolo))issues.push('Processo sem identificação obrigatória.');if(new Set((roundTrip.processes||[]).map(item=>item.id)).size!==(roundTrip.processes||[]).length)issues.push('IDs de processo duplicados.');const report={id:`drill-${Date.now()}`,executedAt:new Date().toISOString(),schemaVersion:3,checksumValid:checksum===createHash('sha256').update(JSON.stringify(roundTrip)).digest('hex'),restorable:issues.length===0,counts:{processes:roundTrip.processes?.length||0,memberships:roundTrip.memberships?.length||0,authorized:roundTrip.authorizedStudents?.length||0,studioVersions:roundTrip.studioVersions?.length||0},issues};auditLogsStore.push({id:`log-${Date.now()}-drill`,actorEmail:identity.email,actorRoles:getUserRolesForEmail(identity.email).globalRoles,action:'ENSAIO_RESTAURACAO_BACKUP',entityType:'system_backup',entityId:report.id,after:{restorable:report.restorable,counts:report.counts},timestamp:report.executedAt});persistPortalState();res.json(report);});

  app.get('/api/admin/retention/preview',requireAuthenticated,requireAdministrator,(_req,res)=>{const policy=currentSettings.integrationStudio?.operationsPolicy?.retention;const now=Date.now();const emailCutoff=now-(policy?.emailDeliveryDays||365)*86_400_000;const auditCutoff=now-(policy?.auditYears||10)*365.25*86_400_000;const heldIds=new Set(legalHoldsStore.filter(item=>item.active).map(item=>item.processId));res.json({generatedAt:new Date().toISOString(),policy:policy||null,previewOnly:true,candidates:{emailDeliveries:emailDeliveriesStore.filter(item=>Date.parse(item.updatedAt)<emailCutoff&&(!item.processId||!heldIds.has(item.processId))).length,auditLogs:auditLogsStore.filter(item=>Date.parse(item.timestamp)<auditCutoff&&(!item.processId||!heldIds.has(item.processId))).length},legalHolds:legalHoldsStore.filter(item=>item.active).length,message:'Prévia sem exclusão automática. Qualquer descarte exige revisão administrativa e trilha de auditoria.'});});
  app.get('/api/admin/legal-holds',requireAuthenticated,requireAdministrator,(_req,res)=>res.json(legalHoldsStore.slice().sort((a,b)=>b.createdAt.localeCompare(a.createdAt))));
  app.post('/api/admin/legal-holds',requireAuthenticated,requireAdministrator,(req,res)=>{const identity=getPortalIdentity(req)!;const processId=String(req.body?.processId||'').trim(),reason=String(req.body?.reason||'').trim();if(!processesStore.some(item=>item.id===processId)||reason.length<5)return res.status(400).json({error:'Informe um processo válido e uma justificativa.'});const hold:LegalHold={id:`hold-${Date.now()}`,processId,reason,active:true,createdAt:new Date().toISOString(),createdBy:identity.email};legalHoldsStore.push(hold);persistPortalState();res.status(201).json(hold);});
  app.post('/api/admin/legal-holds/:id/release',requireAuthenticated,requireAdministrator,(req,res)=>{const identity=getPortalIdentity(req)!;if(!hasRecentAuthentication(identity))return res.status(428).json({error:'Reautentique-se para liberar o bloqueio legal.'});const hold=legalHoldsStore.find(item=>item.id===req.params.id);if(!hold)return res.status(404).json({error:'Bloqueio não encontrado.'});hold.active=false;hold.releasedAt=new Date().toISOString();hold.releasedBy=identity.email;persistPortalState();res.json(hold);});

  app.post('/api/privacy/requests',requireAuthenticated,(req,res)=>{const identity=getPortalIdentity(req)!;const kind=String(req.body?.kind||'INFORMATION') as DataSubjectRequest['kind'],description=String(req.body?.description||'').trim();if(!['ACCESS','CORRECTION','ANONYMIZATION','PORTABILITY','INFORMATION'].includes(kind)||description.length<10)return res.status(400).json({error:'Informe o direito solicitado e descreva o pedido com ao menos 10 caracteres.'});const now=new Date().toISOString();const request:DataSubjectRequest={id:`privacy-${Date.now()}`,requesterEmail:identity.email,kind,description,status:'RECEIVED',createdAt:now,updatedAt:now};dataSubjectRequestsStore.push(request);persistPortalState();res.status(201).json(request);});
  app.get('/api/privacy/requests',requireAuthenticated,(req,res)=>{const identity=getPortalIdentity(req)!;const admin=hasFullAdministration(identity.email);res.setHeader('Cache-Control','private, no-store');res.json(dataSubjectRequestsStore.filter(item=>admin||item.requesterEmail===identity.email).sort((a,b)=>b.createdAt.localeCompare(a.createdAt)));});
  app.patch('/api/admin/privacy/requests/:id',requireAuthenticated,requireAdministrator,(req,res)=>{const identity=getPortalIdentity(req)!;const item=dataSubjectRequestsStore.find(row=>row.id===req.params.id);if(!item)return res.status(404).json({error:'Solicitação não encontrada.'});const status=String(req.body?.status||'');if(!['IN_REVIEW','COMPLETED','REJECTED'].includes(status))return res.status(400).json({error:'Status inválido.'});item.status=status as DataSubjectRequest['status'];item.updatedAt=new Date().toISOString();item.resolvedBy=identity.email;item.resolutionNote=String(req.body?.resolutionNote||'').slice(0,2000);persistPortalState();res.json(item);});

  app.get('/api/admin/health',requireAuthenticated,requireAdministrator,async(_req,res)=>{const [asten,google]=await Promise.all([getPersistentAstenStatus(),getGoogleWorkspaceStatus()]);const supabase=getSupabaseRuntimeStatus();const astenReady=Boolean(asten.configured&&asten.dispatchEnabled);const intelligenceStatuses=Object.values(continuousIntelligenceStore.artifacts).map(item=>item.driveSyncStatus);const checks=[{id:'studio',label:'Pacote do curso',status:currentSettings.integrationStudio&&validateCourseStudio(currentSettings.integrationStudio).ready?'PASS':'FAIL',message:currentSettings.integrationStudio?'Validação estrutural executada.':'Estúdio ainda não publicado.'},{id:'supabase',label:'Supabase',status:supabase.durablePersistenceReady?'NOT_CONFIRMED':'WARNING',message:supabase.message},{id:'google',label:'Google Workspace',status:google.connected?'NOT_CONFIRMED':'WARNING',message:google.connected?'Autorização encontrada; execute homologação real para confirmar.':'Google não conectado.'},{id:'asten',label:'Asten',status:astenReady?'NOT_CONFIRMED':'WARNING',message:astenReady?'Credencial encontrada; execute piloto controlado para confirmar.':'Asten não conectado.'},{id:'drive-root',label:'Pasta raiz do Drive',status:currentSettings.driveRootFolderId?'NOT_CONFIRMED':'FAIL',message:currentSettings.driveRootFolderId?'Pasta configurada; privacidade e escrita precisam de homologação real.':'Pasta raiz não configurada.'},{id:'continuous-intelligence',label:'Arquivos vivos',status:intelligenceStatuses.includes('FAILED')?'WARNING':intelligenceStatuses.every(status=>status==='SYNCED')?'PASS':'NOT_CONFIRMED',message:intelligenceStatuses.includes('FAILED')?'Há arquivo vivo aguardando sincronização com o Drive.':intelligenceStatuses.every(status=>status==='SYNCED')?'Os dois arquivos foram atualizados no Drive.':'Os relatórios existem no portal; execute a atualização com o Google conectado.'},{id:'email-failures',label:'Fila de e-mails',status:emailDeliveriesStore.some(item=>item.status==='FAILED')?'WARNING':'PASS',message:`${emailDeliveriesStore.filter(item=>item.status==='FAILED').length} falha(s) pendente(s).`}];const overall=checks.some(item=>item.status==='FAIL')?'UNAVAILABLE':checks.some(item=>item.status==='WARNING'||item.status==='NOT_CONFIRMED')?'DEGRADED':'HEALTHY';res.setHeader('Cache-Control','private, no-store');res.json({generatedAt:new Date().toISOString(),overall,checks});});

  // PATCH /api/admin/settings
  app.patch('/api/admin/settings', requireAuthenticated, requireAdministrator, async (req, res) => {
    const identity=getPortalIdentity(req)!;
    const actorEmail=identity.email;
    const { globalRoles } = getUserRolesForEmail(actorEmail);

    if (!hasFullAdministration(actorEmail)) {
      return res.status(403).json({ error: 'Apenas o Master ou o Presidente da Comissão pode alterar configurações.' });
    }

    if(req.body?.integrationStudio&&!hasRecentAuthentication(identity))return res.status(428).json({
      error:'Entre novamente antes de publicar formulários, destinatários, modelos ou etapas do fluxo.',
      code:'REAUTHENTICATION_REQUIRED'
    });

    if(containsSensitiveConfigurationKey(req.body))return res.status(400).json({error:'Segredos não podem ser salvos nas configurações.'});
    if (req.body?.integrationStudio && currentSettings.integrationStudio && Number(req.body.integrationStudio.revision) <= Number(currentSettings.integrationStudio.revision)) {
      return res.status(409).json({ error: 'O Estúdio foi alterado em outra aba ou sessão. Recarregue antes de publicar novamente.', code: 'STUDIO_REVISION_CONFLICT' });
    }
    if(req.body?.integrationStudio){
      const workflowValidation=compileWorkflow(req.body.integrationStudio);
      const packageValidation=validateCourseStudio(req.body.integrationStudio);
      const errors=[...workflowValidation.issues.filter(issue=>issue.severity==='ERROR'),...packageValidation.issues.filter(issue=>issue.severity==='ERROR')];
      if(errors.length)return res.status(400).json({error:'O pacote do curso ainda contém pendências. Corrija aparência, modelos, formulários, e-mails e etapas antes de publicar.',code:'COURSE_PACKAGE_VALIDATION_FAILED',score:packageValidation.score,issues:errors.slice(0,40)});
    }
    const before = { ...currentSettings };
    const settingsPatch={...(req.body||{})};for(const protectedKey of ['courseCoordinatorEmail','courseCoordinatorName','documentModels','masterEmail','ownerEmail','commissionPresidentEmail','masterRecoveryEmails','sessionValidAfter','driveRootFolderId','calendarId','installationProfile','academicCycles','featureFlags'])delete settingsPatch[protectedKey];
    currentSettings = {
      ...currentSettings,
      ...settingsPatch,
      updatedAt: new Date().toISOString()
    };
    currentSettings = normalizeUnifiedAppearance(currentSettings);
    if (req.body?.integrationStudio) publishRuntimeTemplatesFromSettings();

    if(req.body?.integrationStudio){
      const studioSnapshot=JSON.parse(JSON.stringify(currentSettings.integrationStudio));
      for(const template of studioSnapshot?.docTemplates||[])template.templateContentText='';
      const serialized=JSON.stringify(studioSnapshot);
      const revision=Number(studioSnapshot?.revision||0);
      studioVersionsStore=[...studioVersionsStore.filter(item=>item.revision!==revision),{
        id:`studio-version-${revision}`,
        revision,
        createdAt:new Date().toISOString(),
        createdBy:actorEmail,
        validationScore:validateCourseStudio(studioSnapshot).score,
        checksum:createHash('sha256').update(serialized).digest('hex'),
        snapshot:studioSnapshot
      }].sort((a,b)=>a.revision-b.revision).slice(-30);
    }

    const isStudioPublication = Boolean(req.body?.integrationStudio);
    const summarizeStudio = (settings: GlobalSettings) => settings.integrationStudio ? {
      schemaVersion: settings.integrationStudio.schemaVersion,
      revision: settings.integrationStudio.revision,
      savedAt: settings.integrationStudio.savedAt,
      savedBy: settings.integrationStudio.savedBy,
      variables: settings.integrationStudio.matrixColumns?.length || 0,
      documents: settings.integrationStudio.docTemplates?.length || 0,
      emails: settings.integrationStudio.emailTemplates?.length || 0,
      forms: settings.integrationStudio.formTemplates?.length || 0,
      auditEvents: settings.integrationStudio.auditTrail?.length || 0,
      driveStatus: settings.integrationStudio.lastDriveSyncStatus || 'never'
    } : undefined;

    auditLogsStore.push({
      id: `log-${Date.now()}`,
      actorEmail,
      actorRoles: globalRoles,
      action: isStudioPublication ? 'PUBLICACAO_ESTUDIO_INTEGRADO' : 'ALTERACAO_CONFIGURACOES',
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
  app.post('/api/admin/models/:type',requireAuthenticated,requireAdministrator,async(req,res)=>{
    const identity=getPortalIdentity(req)!;const type=String(req.params.type||'').toUpperCase() as 'CONVITE'|'ATA'|'TERMO'|'DECLARACAO';
    if(!hasRecentAuthentication(identity))return res.status(428).json({error:'Entre novamente antes de publicar um modelo documental.',code:'REAUTHENTICATION_REQUIRED'});
    if(!['CONVITE','ATA','TERMO','DECLARACAO'].includes(type))return res.status(400).json({error:'Tipo de modelo inválido.'});
    try{
      const publish=async(file:{bytes:Buffer;fileName:string})=>{
        if(!file.fileName.toLowerCase().endsWith('.docx'))throw new Error('Envie um arquivo DOCX.');
        const extracted=await extractDocxTemplateText(file.bytes);const drive=await publishMasterDocumentModel({type,fileName:file.fileName,content:file.bytes,rootFolderName:resolveInstallationProfile(currentSettings).driveRootFolderName});const now=new Date().toISOString();
        const labels={CONVITE:'Carta-convite',ATA:'Ata de defesa',TERMO:'Termo de autorização para publicação',DECLARACAO:'Declaração de participação na banca'};
        const before=currentSettings.documentModels?.[type];const previousVersions=before?.versions?.length?before.versions:(before?[{version:1,fileName:before.fileName,driveFileId:before.driveFileId,driveFileUrl:before.driveFileUrl,variables:before.variables,uploadedAt:before.uploadedAt,uploadedBy:before.uploadedBy,contentSha256:before.contentSha256,driveRevisionId:before.driveRevisionId,driveModifiedTime:before.driveModifiedTime}]:[]);const nextVersion=Math.max(0,...previousVersions.map(item=>item.version))+1;const version={version:nextVersion,fileName:drive.name,driveFileId:drive.id,driveFileUrl:drive.webViewLink,variables:extracted.variables,uploadedAt:now,uploadedBy:identity.email,contentSha256:drive.contentSha256,driveRevisionId:drive.driveRevisionId,driveModifiedTime:drive.driveModifiedTime};const model={id:`master-${type.toLowerCase()}`,type,label:labels[type],fileName:drive.name,templateContentText:'',driveFileId:drive.id,driveFileUrl:drive.webViewLink,variables:extracted.variables,uploadedAt:now,uploadedBy:identity.email,contentSha256:drive.contentSha256,driveRevisionId:drive.driveRevisionId,driveModifiedTime:drive.driveModifiedTime,activeVersion:nextVersion,versions:[...previousVersions,version].slice(-30)};
        currentSettings={...currentSettings,driveRootFolderId:drive.rootFolderId,documentModels:{...(currentSettings.documentModels||{}),[type]:model},updatedAt:now};publishRuntimeTemplatesFromSettings();
        auditLogsStore.push({id:`log-${Date.now()}`,actorEmail:identity.email,actorRoles:getUserRolesForEmail(identity.email).globalRoles,action:'MODELO_DOCUMENTAL_PUBLICADO',entityType:'document_model',entityId:type,before:before?{fileName:before.fileName,driveFileId:before.driveFileId}:undefined,after:{fileName:model.fileName,driveFileId:model.driveFileId,variables:model.variables},timestamp:now});await persistPortalStateDurably();
        return{type,fileName:model.fileName,driveFileId:model.driveFileId,driveFileUrl:model.driveFileUrl,variables:model.variables,uploadedAt:model.uploadedAt,uploadedBy:model.uploadedBy,contentSha256:model.contentSha256,driveRevisionId:model.driveRevisionId,driveModifiedTime:model.driveModifiedTime,configured:true};
      };
      const uploadId=String(req.body?.stagedUploadId||'').trim();
      const result=uploadId
        ?await withSupabaseStagedUpload({uploadId,purpose:'DOCUMENT_MODEL',requesterBinding:sessionUploadBinding(identity)},publish)
        :await publish({bytes:readLegacyDevelopmentUpload({contentBase64:req.body?.contentBase64,fileName:String(req.body?.fileName||''),expected:'DOCX'}),fileName:String(req.body?.fileName||'')});
      res.status(201).json(result);
    }catch(error){res.status(400).json({error:error instanceof Error?error.message:'Não foi possível cadastrar o modelo.'});}
  });
  app.post('/api/admin/models/:type/link',requireAuthenticated,requireAdministrator,async(req,res)=>{
    const identity=getPortalIdentity(req)!;const type=String(req.params.type||'').toUpperCase() as 'CONVITE'|'ATA'|'TERMO'|'DECLARACAO';
    if(!hasRecentAuthentication(identity))return res.status(428).json({error:'Entre novamente antes de importar um modelo documental.',code:'REAUTHENTICATION_REQUIRED'});
    if(!['CONVITE','ATA','TERMO','DECLARACAO'].includes(type))return res.status(400).json({error:'Tipo de modelo inválido.'});
    const linkOrId=String(req.body?.linkOrId||'').trim();if(!linkOrId)return res.status(400).json({error:'Informe o link ou ID do modelo no Google Drive.'});
    try{
      const drive=await registerMasterDocumentModelFromDrive({type,linkOrId,rootFolderName:resolveInstallationProfile(currentSettings).driveRootFolderName});const now=new Date().toISOString();
      const labels={CONVITE:'Carta-convite',ATA:'Ata de defesa',TERMO:'Termo de autorização para publicação',DECLARACAO:'Declaração de participação na banca'};
      const before=currentSettings.documentModels?.[type];const previousVersions=before?.versions?.length?before.versions:(before?[{version:1,fileName:before.fileName,driveFileId:before.driveFileId,driveFileUrl:before.driveFileUrl,variables:before.variables,uploadedAt:before.uploadedAt,uploadedBy:before.uploadedBy,contentSha256:before.contentSha256,driveRevisionId:before.driveRevisionId,driveModifiedTime:before.driveModifiedTime}]:[]);const nextVersion=Math.max(0,...previousVersions.map(item=>item.version))+1;const version={version:nextVersion,fileName:drive.name,driveFileId:drive.id,driveFileUrl:drive.webViewLink,variables:drive.variables,uploadedAt:now,uploadedBy:identity.email,contentSha256:drive.contentSha256,driveRevisionId:drive.driveRevisionId,driveModifiedTime:drive.driveModifiedTime};const model={id:`master-${type.toLowerCase()}`,type,label:labels[type],fileName:drive.name,templateContentText:'',driveFileId:drive.id,driveFileUrl:drive.webViewLink,variables:drive.variables,uploadedAt:now,uploadedBy:identity.email,contentSha256:drive.contentSha256,driveRevisionId:drive.driveRevisionId,driveModifiedTime:drive.driveModifiedTime,activeVersion:nextVersion,versions:[...previousVersions,version].slice(-30)};
      currentSettings={...currentSettings,driveRootFolderId:drive.rootFolderId,documentModels:{...(currentSettings.documentModels||{}),[type]:model},updatedAt:now};publishRuntimeTemplatesFromSettings();
      auditLogsStore.push({id:`log-${Date.now()}`,actorEmail:identity.email,actorRoles:getUserRolesForEmail(identity.email).globalRoles,action:'MODELO_DOCUMENTAL_IMPORTADO_DO_DRIVE',entityType:'document_model',entityId:type,before:before?{fileName:before.fileName,driveFileId:before.driveFileId}:undefined,after:{fileName:model.fileName,driveFileId:model.driveFileId,variables:model.variables,source:'GOOGLE_DRIVE'},timestamp:now});await persistPortalStateDurably();
      res.status(201).json({type,fileName:model.fileName,driveFileId:model.driveFileId,driveFileUrl:model.driveFileUrl,variables:model.variables,uploadedAt:model.uploadedAt,uploadedBy:model.uploadedBy,contentSha256:model.contentSha256,driveRevisionId:model.driveRevisionId,driveModifiedTime:model.driveModifiedTime,configured:true});
    }catch(error){res.status(400).json({error:error instanceof Error?error.message:'Não foi possível importar o modelo do Drive.'});}
  });

  app.post('/api/admin/models/:type/versions/:version/restore',requireAuthenticated,requireAdministrator,(req,res)=>{const identity=getPortalIdentity(req)!;if(!hasRecentAuthentication(identity))return res.status(428).json({error:'Reautentique-se para restaurar um modelo.'});const type=String(req.params.type||'').toUpperCase() as 'CONVITE'|'ATA'|'TERMO'|'DECLARACAO';const model=currentSettings.documentModels?.[type],selected=model?.versions?.find(item=>item.version===Number(req.params.version));if(!model||!selected)return res.status(404).json({error:'Versão do modelo não encontrada.'});if(!selected.contentSha256)return res.status(409).json({error:'Esta versão antiga não possui hash de integridade. Importe ou envie novamente o modelo para publicá-la com segurança.'});const before={activeVersion:model.activeVersion,driveFileId:model.driveFileId};currentSettings.documentModels={...(currentSettings.documentModels||{}),[type]:{...model,...selected,templateContentText:'',activeVersion:selected.version,versions:model.versions}};currentSettings.updatedAt=new Date().toISOString();auditLogsStore.push({id:`log-${Date.now()}`,actorEmail:identity.email,actorRoles:getUserRolesForEmail(identity.email).globalRoles,action:'RESTAURACAO_VERSAO_MODELO',entityType:'document_model',entityId:type,before,after:{activeVersion:selected.version,driveFileId:selected.driveFileId,contentSha256:selected.contentSha256},timestamp:currentSettings.updatedAt});persistPortalState();res.json({type,activeVersion:selected.version,fileName:selected.fileName,driveFileId:selected.driveFileId,driveFileUrl:selected.driveFileUrl,variables:selected.variables,contentSha256:selected.contentSha256,configured:true});});

  app.get(['/api/admin/access-list','/api/admin/students'],requireAuthenticated,requireAdministrator,(_req,res)=>res.json(authorizedStudentsStore));
  app.post(['/api/admin/access-list','/api/admin/students'],requireAuthenticated,requireAdministrator,(req,res)=>{
    const identity=getPortalIdentity(req)!;
    const email=normalizeEmail(String(req.body?.email||''));
    const nome=String(req.body?.nome||'').trim();
    if(!nome||!isValidPortalEmail(email))return res.status(400).json({error:'Nome e e-mail válido são obrigatórios.'});
    if(authorizedStudentsStore.some(student=>normalizeEmail(student.email)===email))return res.status(409).json({error:'Este aluno já está na lista.'});
    const now=new Date().toISOString();
    const student=upsertAuthorizedAccess({nome,email,matricula:String(req.body?.matricula||'').trim()||undefined,role:'STUDENT',origin:'MASTER_LIST',actor:identity.email});
    auditLogsStore.push({id:`log-${Date.now()}`,actorEmail:identity.email,actorRoles:getUserRolesForEmail(identity.email).globalRoles,action:'AUTORIZACAO_ALUNO',entityType:'authorized_student',entityId:student.id,after:student,timestamp:now});
    persistPortalState();res.status(201).json(student);
  });
  app.patch(['/api/admin/access-list/:id','/api/admin/students/:id'],requireAuthenticated,requireAdministrator,(req,res)=>{
    const identity=getPortalIdentity(req)!;const index=authorizedStudentsStore.findIndex(student=>student.id===req.params.id);
    if(index<0)return res.status(404).json({error:'Aluno não encontrado.'});
    const before={...authorizedStudentsStore[index]};
    const active=req.body?.active!==undefined?Boolean(req.body.active):before.active;
    const updatedAt=new Date().toISOString();
    const updated:AuthorizedStudent={...before,...(req.body?.nome!==undefined?{nome:String(req.body.nome).trim()}:{}),...(req.body?.matricula!==undefined?{matricula:String(req.body.matricula).trim()||undefined}:{}),active,manualRevocation:req.body?.active!==undefined?!active:before.manualRevocation,revokedAt:!active?updatedAt:undefined,revokedBy:!active?identity.email:undefined,revocationReason:!active?String(req.body?.reason||'Acesso revogado pelo administrador.').trim():undefined,updatedAt};
    authorizedStudentsStore[index]=updated;
    auditLogsStore.push({id:`log-${Date.now()}`,actorEmail:identity.email,actorRoles:getUserRolesForEmail(identity.email).globalRoles,action:'ALTERACAO_ALUNO_AUTORIZADO',entityType:'authorized_student',entityId:updated.id,before,after:updated,timestamp:updated.updatedAt});
    persistPortalState();res.json(updated);
  });
  app.post('/api/admin/access-list/import',requireAuthenticated,requireAdministrator,requireFeature('STUDENT_BULK_IMPORT'),async(req,res)=>{
    const identity=getPortalIdentity(req)!;const records=Array.isArray(req.body?.records)?req.body.records:[];
    if(!records.length||records.length>1000)return res.status(400).json({error:'Envie de 1 a 1.000 alunos por lote.'});
    const normalized=records.map((record:any,index:number)=>({row:index+2,nome:String(record?.nome||'').trim(),email:normalizeEmail(String(record?.email||'')),matricula:String(record?.matricula||'').trim()||undefined}));
    const duplicateEmails=new Set<string>(),seen=new Set<string>();for(const record of normalized){if(seen.has(record.email))duplicateEmails.add(record.email);seen.add(record.email);}
    const profile=resolveInstallationProfile(currentSettings);const invalid=normalized.filter(record=>!record.nome||!isValidPortalEmail(record.email)||!emailMatchesDomains(record.email,profile.studentEmailDomains)||duplicateEmails.has(record.email));
    if(invalid.length)return res.status(400).json({error:'O lote contém linhas inválidas ou duplicadas.',invalidRows:invalid.map(record=>({row:record.row,email:record.email,reason:duplicateEmails.has(record.email)?'E-mail duplicado no arquivo':'Nome, e-mail institucional ou domínio inválido'}))});
    const batchHash=createHash('sha256').update(JSON.stringify(normalized.map(({nome,email,matricula})=>({nome,email,matricula})))).digest('hex');const already=auditLogsStore.find(log=>log.action==='IMPORTACAO_ALUNOS'&&(log.after as any)?.batchHash===batchHash);if(already)return res.json({batchHash,created:0,updated:0,reused:true});
    let created=0,updated=0,preservedRevocations=0;for(const record of normalized){const before=authorizedStudentsStore.find(entry=>normalizeEmail(entry.email)===record.email);if(before){before.nome=record.nome;before.matricula=record.matricula||before.matricula;before.updatedAt=new Date().toISOString();updated++;if(before.manualRevocation){before.active=false;preservedRevocations++;}}else{upsertAuthorizedAccess({nome:record.nome,email:record.email,matricula:record.matricula,role:'STUDENT',origin:'MASTER_LIST',actor:identity.email});created++;}}
    const now=new Date().toISOString();auditLogsStore.push({id:`log-${Date.now()}`,actorEmail:identity.email,actorRoles:getUserRolesForEmail(identity.email).globalRoles,action:'IMPORTACAO_ALUNOS',entityType:'authorized_student_batch',entityId:batchHash.slice(0,20),after:{batchHash,rows:normalized.length,created,updated,preservedRevocations},timestamp:now});await persistPortalStateDurably();res.status(201).json({batchHash,created,updated,preservedRevocations,reused:false});
  });

  // GET /api/processes
  app.get('/api/processes', (req, res) => {
    const identity=getPortalIdentity(req);if(!identity)return res.json(processesStore.filter(p=>p.status!=='EM_RASCUNHO').map(publicProcessView));const email=identity.email;
    const { memberships } = getUserRolesForEmail(email);

    // Master e Presidente da Comissão visualizam todos os processos.
    if (hasFullAdministration(email)) {
      return res.json(processesStore);
    }

    // Filter by process IDs where user has an active membership
    const accessibleProcessIds = new Set(memberships.map((m) => m.processId));
    
    const filtered = processesStore.filter((p) => accessibleProcessIds.has(p.id)&&canAccessProcess(email,p.id));
    res.json(filtered);
  });

  // POST /api/processes
  app.post('/api/processes', requireAuthenticated, async (req, res) => {
    const actorEmail=getPortalIdentity(req)!.email;
    const isAdministrative = getUserRolesForEmail(actorEmail).globalRoles.length>0;

    try { req.body = { ...req.body, ...acceptRegistration(req.body, currentSettings.integrationStudio) }; }
    catch (error) { return res.status(400).json({ error: error instanceof Error ? error.message : 'Cadastro inválido.' }); }
    const {
      aluno1,
      aluno2,
      orientador,
      coorientador,
      titulo,
      banca,
      defesa
    } = req.body;

    if (!aluno1 || !aluno1.nome || !aluno1.matricula || !aluno1.email) {
      return res.status(400).json({ error: 'Dados do Aluno 1 são obrigatórios.' });
    }

    const aluno1Email = normalizeEmail(aluno1.email);

    // Rule: Only students with @edu.ufes.br institutional email can initiate a TCC process
    if (!isAdministrative && actorEmail!==aluno1Email) {
      return res.status(403).json({error:'O aluno deve cadastrar o próprio TCC usando o e-mail autorizado.'});
    }
    if (!isAdministrative && !authorizedStudentsStore.some(student=>student.active&&normalizeEmail(student.email)===actorEmail)) {
      return res.status(403).json({error:'Seu e-mail ainda não foi incluído na lista de alunos autorizados.'});
    }
    const studentEmails=[aluno1Email,aluno2?.email?normalizeEmail(aluno2.email):''].filter(Boolean);const installationProfile=resolveInstallationProfile(currentSettings);
    if(studentEmails.some(email=>!emailMatchesDomains(email,installationProfile.studentEmailDomains)))return res.status(400).json({error:`Os alunos autores devem usar um dos domínios institucionais configurados: ${installationProfile.studentEmailDomains.join(', ')}.`});
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

    const academicError=validateAcademicWindow(defesa?.startAt);if(academicError&&!isAdministrative)return res.status(409).json({error:academicError,code:'ACADEMIC_WINDOW_CLOSED'});

    protocolCounter++;
    const protocolo = nextProcessProtocol();
    const newId = `proc-${Date.now()}`;
    const nowISO = new Date().toISOString();

    // End time is start time + 90 min by default
    const startDate = new Date(defesa?.startAt || nowISO);
    const endDate = new Date(startDate.getTime() + (currentSettings.slotDurationMinutes || 90) * 60000);
    const defenseConflicts=isPortalFeatureEnabled(currentSettings,'DEFENSE_CONFLICTS')?findDefenseConflicts({startAt:startDate.toISOString(),endAt:endDate.toISOString(),local:String(defesa?.local||''),emails:[...studentEmails,normalizeEmail(orientador.email),coorientador?.email?normalizeEmail(coorientador.email):'',...banca.map((member:any)=>normalizeEmail(String(member.email||'')))].filter(Boolean)}):[];
    if(defenseConflicts.length&&(!isAdministrative||!String(req.body?.conflictOverrideReason||'').trim()))return res.status(409).json({error:'O agendamento conflita com outra defesa, sala ou participante.',code:'DEFENSE_CONFLICT',conflicts:defenseConflicts});

    const newProcess: ProcessData = {
      id: newId,
      protocolo,
      titulo,
      etapaAtual: 'CONFIRMACAO_LOCAL',
      status: 'AGUARDANDO_CONFIRMACAO_LOCAL',
      registrationAnswers: req.body.registrationAnswers,
      registrationRevision: currentSettings.integrationStudio?.revision || 0,
      createdByEmail: actorEmail,
      academicCycleId: currentAcademicCycle()?.id,
      coauthorAcceptance: aluno2&&aluno2.nome?{status:'PENDING',invitedEmail:normalizeEmail(aluno2.email),requestedAt:nowISO}:{status:'NOT_REQUIRED'},
      aluno1: {
        nome: aluno1.nome.trim(),
        matricula: String(aluno1.matricula).trim(),
        email: normalizeEmail(aluno1.email)
      },
      aluno2: aluno2 && aluno2.nome ? {
        nome: aluno2.nome.trim(),
        matricula: String(aluno2.matricula).trim(),
        email: normalizeEmail(aluno2.email)
      } : null,
      orientador: {
        nome: orientador.nome.trim(),
        email: normalizeEmail(orientador.email),
        siape: String(orientador.siape || ''),
        instituicao: String(orientador.instituicao || '')
      },
      coorientador: coorientador && coorientador.nome ? {
        nome: coorientador.nome.trim(),
        email: normalizeEmail(coorientador.email),
        instituicao: coorientador.instituicao ? coorientador.instituicao.trim() : ''
      } : null,
      banca: banca.map((b: any, idx: number) => ({
        id: `b-${idx + 1}`,
        nome: b.nome.trim(),
        email: normalizeEmail(b.email),
        funcao: ['EXAMINER_2','EXAMINER_3','EXAMINER_4'].includes(String(b.funcao))?b.funcao:(`EXAMINER_${idx+2}` as any),
        membroTipo: b.membroTipo || (idx === 0 ? 'INTERNO' : 'EXTERNO'),
        instituicao: b.instituicao ? b.instituicao.trim() : (idx === 0 ? installationProfile.defaultInstitutionName : 'Instituição externa'),
        siape: String(b.siape || ''),
        profissao: b.profissao || '',
        titulacao: b.titulacao || ''
      })),
      defesa: {
        startAt: startDate.toISOString(),
        endAt: endDate.toISOString(),
        local: defesa?.local || '',
        alternateLocation: String(defesa?.alternateLocation || ''),
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
    upsertAuthorizedAccess({nome:newProcess.aluno1.nome,email:newProcess.aluno1.email,matricula:newProcess.aluno1.matricula,processId:newId,role:'STUDENT',origin:'TCC_FORM',actor:actorEmail});
    if(newProcess.aluno2)upsertAuthorizedAccess({nome:newProcess.aluno2.nome,email:newProcess.aluno2.email,matricula:newProcess.aluno2.matricula,processId:newId,role:'STUDENT',origin:'TCC_FORM',actor:actorEmail});
    upsertAuthorizedAccess({nome:newProcess.orientador.nome,email:newProcess.orientador.email,processId:newId,role:'ADVISOR',origin:'TCC_FORM',actor:actorEmail});
    if(newProcess.coorientador)upsertAuthorizedAccess({nome:newProcess.coorientador.nome,email:newProcess.coorientador.email,processId:newId,role:'CO_ADVISOR',origin:'TCC_FORM',actor:actorEmail});
    for(const examiner of newProcess.banca)upsertAuthorizedAccess({nome:examiner.nome,email:examiner.email,processId:newId,role:examiner.funcao==='ORIENTADOR'?'ADVISOR':'EXAMINER',origin:'TCC_FORM',actor:actorEmail});

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
    if(defenseConflicts.length)auditLogsStore.push({id:`log-${Date.now()}-conflict`,processId:newId,actorEmail,actorRoles:getUserRolesForEmail(actorEmail).globalRoles,action:'SOBRESCRITA_CONFLITO_DEFESA',entityType:'defense_schedule',entityId:newId,after:{reason:String(req.body?.conflictOverrideReason||'').trim(),conflicts:defenseConflicts},timestamp:nowISO});

    delete registrationDraftsStore[actorEmail];await persistPortalStateDurably();const initialArchive=await archiveProcessFormSnapshot(newProcess,'CADASTRO_INICIAL');if(initialArchive.status!=='ARCHIVED')return res.status(202).json({...newProcess,workflowPending:true,workflowError:initialArchive.lastError});const initialRun=await executeConfiguredWorkflowEvent(newProcess,'TCC_CREATED',actorEmail);if(!initialRun||initialRun.status!=='COMPLETED')return res.status(202).json({...newProcess,workflowPending:true,workflowError:initialRun?.actions.find(action=>action.status==='FAILED')?.error||'O fluxo inicial ainda não foi concluído.'});res.status(201).json(newProcess);
  });

  app.post('/api/processes/defense-conflicts/check',requireAuthenticated,requireFeature('DEFENSE_CONFLICTS'),(req,res)=>{
    const startAt=String(req.body?.startAt||'');if(!Number.isFinite(Date.parse(startAt)))return res.status(400).json({error:'Data inicial inválida.'});const endAt=String(req.body?.endAt||new Date(Date.parse(startAt)+(currentSettings.slotDurationMinutes||90)*60_000).toISOString());
    res.json({conflicts:findDefenseConflicts({startAt,endAt,local:String(req.body?.local||''),emails:Array.isArray(req.body?.emails)?req.body.emails.map((value:any)=>normalizeEmail(String(value))):[],excludeProcessId:String(req.body?.excludeProcessId||'')||undefined})});
  });
  app.post('/api/processes/:id/coauthor-acceptance',requireAuthenticated,requireFeature('PAIR_ACCEPTANCE'),async(req,res)=>{
    const identity=getPortalIdentity(req)!;const process=processesStore.find(item=>item.id===req.params.id);if(!process||!canAccessProcess(identity.email,process.id))return res.status(404).json({error:'Trabalho não encontrado.'});
    const invited=normalizeEmail(process.coauthorAcceptance?.invitedEmail||process.aluno2?.email||'');if(!invited||invited!==identity.email)return res.status(404).json({error:'Convite não encontrado.'});if(process.coauthorAcceptance?.status!=='PENDING')return res.status(409).json({error:'Este convite já foi respondido.'});
    const decision=String(req.body?.decision||'').toUpperCase();if(!['ACCEPT','REJECT'].includes(decision))return res.status(400).json({error:'Informe ACCEPT ou REJECT.'});const now=new Date().toISOString();const before=process.coauthorAcceptance;process.coauthorAcceptance={...before,status:decision==='ACCEPT'?'ACCEPTED':'REJECTED',respondedAt:now,respondedBy:identity.email};process.updatedAt=now;process.dataRevision++;
    auditLogsStore.push({id:`log-${Date.now()}`,processId:process.id,actorEmail:identity.email,actorRoles:getUserRolesForEmail(identity.email).globalRoles,action:decision==='ACCEPT'?'ACEITE_SEGUNDO_AUTOR':'RECUSA_SEGUNDO_AUTOR',entityType:'coauthor_acceptance',entityId:process.id,before,after:process.coauthorAcceptance,timestamp:now});await persistPortalStateDurably();res.json(process);
  });

  app.use('/api/processes/:id/forms/:formId/submissions',requireAuthenticated,(req,res,next)=>{const identity=getPortalIdentity(req)!;const form=(currentSettings.integrationStudio?.formTemplates||[]).find(item=>String(item.id)===req.params.formId);if(!form||form.isActive===false||!canUseStudioForm(identity.email,req.params.id,form)||!studioFormIsReleased(identity.email,req.params.id,req.params.formId))return res.status(404).json({error:'Formulário não encontrado ou ainda não liberado nesta etapa.'});next();});
  app.get('/api/processes/:id/forms',requireAuthenticated,(req,res)=>{const identity=getPortalIdentity(req)!;const process=processesStore.find(item=>item.id===req.params.id);if(!process||!canAccessProcess(identity.email,process.id))return res.status(404).json({error:'Processo não encontrado.'});res.setHeader('Cache-Control','private, no-store');res.json((currentSettings.integrationStudio?.formTemplates||[]).filter(form=>form.isActive!==false&&canUseStudioForm(identity.email,process.id,form)&&studioFormIsReleased(identity.email,process.id,String(form.id))).map(form=>({...form,revision:currentSettings.integrationStudio?.revision||0})));});
  app.get('/api/processes/:id/forms/:formId',requireAuthenticated,(req,res)=>{const identity=getPortalIdentity(req)!;const process=processesStore.find(item=>item.id===req.params.id);if(!process||!canAccessProcess(identity.email,process.id))return res.status(404).json({error:'Formulário não encontrado.'});const form=(currentSettings.integrationStudio?.formTemplates||[]).find(item=>String(item.id)===req.params.formId);if(!form||form.isActive===false||!canUseStudioForm(identity.email,process.id,form)||!studioFormIsReleased(identity.email,process.id,req.params.formId))return res.status(404).json({error:'Formulário não encontrado ou ainda não liberado nesta etapa.'});res.setHeader('Cache-Control','private, no-store');res.json({...form,revision:currentSettings.integrationStudio?.revision||0});});
  app.get('/api/processes/:id/form-submissions',requireAuthenticated,(req,res)=>{const identity=getPortalIdentity(req)!;if(!canAccessProcess(identity.email,req.params.id))return res.status(404).json({error:'Processo não encontrado.'});const admin=hasFullAdministration(identity.email);res.setHeader('Cache-Control','private, no-store');res.json(studioFormSubmissionsStore.filter(item=>item.processId===req.params.id&&(admin||item.submittedBy===identity.email)).map(item=>({...item,answers:admin||item.submittedBy===identity.email?item.answers:{}})));});
  app.post('/api/processes/:id/forms/:formId/submissions', requireAuthenticated, async (req, res) => {
    const identity = getPortalIdentity(req)!;
    const process = processesStore.find(item => item.id === req.params.id);
    if (!process || !canAccessProcess(identity.email, process.id)) return res.status(404).json({ error: 'Formulário não encontrado.' });
    if (rejectPendingCoauthor(process, res)) return;
    if (process.status === 'CONCLUIDO') return res.status(409).json({ error: 'O processo está concluído. Solicite uma correção formal à secretaria.' });
    const form = currentSettings.integrationStudio?.formTemplates?.find(item => String(item.id) === req.params.formId);
    if (!form || form.isActive === false) return res.status(404).json({ error: 'Formulário não encontrado ou não publicado.' });
    const formRevision = Number(currentSettings.integrationStudio?.revision || 0);
    if (!Number.isInteger(req.body?.expectedFormRevision) || req.body.expectedFormRevision !== formRevision) return res.status(409).json({ error: 'O formulário foi atualizado. Recarregue e confira os campos antes de enviar.', code: 'STALE_FORM_REVISION' });
    const questions = (Array.isArray(form.questions) ? form.questions : []) as import('./src/types/operationalConfig').RegistrationQuestion[];
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

  app.post('/api/processes/:id/location-proof',requireAuthenticated,async(req,res)=>{
    const identity=getPortalIdentity(req)!;const process=processesStore.find(p=>p.id===req.params.id);
    if(!process||!canAccessProcess(identity.email,process.id))return res.status(404).json({error:'Processo não encontrado.'});
    if(!hasFullAdministration(identity.email)&&!getActiveProcessRoles(identity.email,process.id).includes('STUDENT'))return res.status(403).json({error:'Somente o aluno ou a administração pode anexar o comprovante.'});
    if(process.defesa.invitationSentAt||process.defesa.localStatus==='CONFIRMADO')return res.status(409).json({error:'A confirmação já foi registrada. Preserve o comprovante usado.'});
    try{
      const encoded=String(req.body?.contentBase64||'');if(encoded.length>1400000||!/^[A-Za-z0-9+/]*={0,2}$/.test(encoded))throw new Error('Envie um PDF de até 1 MB.');
      const pdf=Buffer.from(encoded,'base64');if(!pdf.length||pdf.length>1024*1024||!pdf.subarray(0,5).equals(Buffer.from('%PDF-')))throw new Error('Envie um PDF válido de até 1 MB.');
      const analysis=await inspectPdfLayout(pdf,{maximumPages:10});if(analysis.issues.some(issue=>issue.severity==='ERROR'))throw new Error('Revise o PDF: conteúdo ativo, marcadores pendentes ou páginas em excesso.');
      if(!currentSettings.driveRootFolderId)throw new Error('Configure a pasta raiz do Drive.');const accessToken=await getGoogleWorkspaceAccessToken();
      if(!process.driveFolderId){const folder=await ensurePortalProcessDriveFolder({accessToken,rootFolderId:currentSettings.driveRootFolderId,protocol:process.protocolo,processId:process.id});process.driveFolderId=folder.id;process.driveFolderUrl=folder.webViewLink;}
      const previous=process.defesa.locationProof,sha256=createHash('sha256').update(pdf).digest('hex');
      if(previous?.sha256===sha256)return res.json(previous);
      const version=(previous?.version||0)+1,fileName=buildProcessArchiveFileName({protocol:process.protocolo,studentNames:[process.aluno1.nome,process.aluno2?.nome||''],artifactLabel:'COMPROVANTE_LOCAL',version});
      const uploaded=await uploadProcessSourcePdf({accessToken,processFolderId:process.driveFolderId,processId:process.id,artifactType:'COMPROVANTE_LOCAL',fileName,version,previousFileId:previous?.driveFileId,pdf,sha256});
      const now=new Date().toISOString();process.defesa.locationProof={driveFileId:String(uploaded.id),fileName,sha256,version,uploadedBy:identity.email,uploadedAt:now};process.updatedAt=now;
      auditLogsStore.push({id:`log-${Date.now()}-proof`,processId:process.id,actorEmail:identity.email,actorRoles:getUserRolesForEmail(identity.email).globalRoles,action:'COMPROVANTE_LOCAL_ARQUIVADO',entityType:'process_file',entityId:String(uploaded.id),after:{sha256,version},timestamp:now});
      await persistPortalStateDurably();res.status(201).json(process.defesa.locationProof);
    }catch(error){res.status(422).json({error:error instanceof Error?error.message:'Falha ao arquivar o comprovante.'});}
  });
  app.get('/api/processes/:id/location-proof/download',requireAuthenticated,async(req,res)=>{
    const identity=getPortalIdentity(req)!;const process=processesStore.find(p=>p.id===req.params.id);
    if(!process||!canAccessProcess(identity.email,process.id)||!process.defesa.locationProof)return res.status(404).json({error:'Comprovante não encontrado.'});
    try{const file=await downloadDrivePdf(await getGoogleWorkspaceAccessToken(),process.defesa.locationProof.driveFileId,{processId:process.id,artifactType:'COMPROVANTE_LOCAL'});await deliverPortalDownload({res,bytes:file.pdf,fileName:process.defesa.locationProof.fileName,mimeType:'application/pdf',requesterBinding:sessionUploadBinding(identity),cacheControl:'private, no-store'});}catch(error){res.status(502).json({error:'Não foi possível consultar o comprovante no Drive.'});}
  });
  app.post('/api/processes/:id/confirm-location',requireAuthenticated,async(req,res)=>{
    const identity=getPortalIdentity(req)!;
    const index=processesStore.findIndex(process=>process.id===req.params.id);
    if(index<0)return res.status(404).json({error:'Processo não encontrado.'});
    const process=processesStore[index];
    if(!canAccessProcess(identity.email,process.id))return res.status(404).json({error:'Processo não encontrado.'});
    if(rejectPendingCoauthor(process,res))return;
    const roles=getActiveProcessRoles(identity.email,process.id);
    if(!hasFullAdministration(identity.email)&&!roles.includes('STUDENT'))return res.status(403).json({error:'Somente o aluno, o Master ou o Presidente da Comissão pode confirmar o local.'});
    const local=String(req.body?.local||'').trim();
    if(process.defesa.invitationSentAt)return res.status(409).json({error:'A carta-convite já foi enviada. Para preservar o documento expedido, o local não pode ser confirmado novamente.',code:'INVITATION_ALREADY_SENT'});
    if(process.defesa.invitationDriveFileId&&normalizeLocation(local)!==normalizeLocation(process.defesa.local||''))return res.status(409).json({error:'Já existe uma carta-convite gerada para outro local. Conclua ou corrija formalmente a etapa antes de reenviar.',code:'INVITATION_DOCUMENT_LOCKED'});
    const missing=missingDocumentModels(['CONVITE']);if(missing.length)return res.status(409).json({error:'O Master precisa cadastrar o modelo da carta-convite antes de confirmar o local.',code:'DOCUMENT_MODEL_REQUIRED',missingModels:missing});
    const evidence=process.defesa.locationProof?`/api/processes/${process.id}/location-proof/download`:String(req.body?.localEvidenceUrl||'').trim();
    if(req.body?.confirmationReceived!==true)return res.status(400).json({error:'Confirme que recebeu a autorização do departamento.'});
    if(!local)return res.status(400).json({error:'Informe o local autorizado para a defesa.'});
    if (process.defesa.localStatus === 'CONFIRMADO') {
      if (normalizeLocation(local) !== normalizeLocation(process.defesa.local || '')) return res.status(409).json({ error: 'O local já foi confirmado. Solicite uma correção formal à secretaria.', code: 'LOCATION_ALREADY_CONFIRMED' });
      return res.status(202).json({ ...process, workflowPending: true, workflowError: 'A confirmação já está salva. A secretaria deve retomar o convite na fila de pendências.' });
    }
    const conflicts=isPortalFeatureEnabled(currentSettings,'DEFENSE_CONFLICTS')?findDefenseConflicts({startAt:process.defesa.startAt,endAt:process.defesa.endAt,local,emails:participantEmails(process),excludeProcessId:process.id}):[];const overrideReason=String(req.body?.conflictOverrideReason||'').trim();if(conflicts.length&&(!hasFullAdministration(identity.email)||!overrideReason))return res.status(409).json({error:'O local ou um participante já está comprometido em outra defesa.',code:'DEFENSE_CONFLICT',conflicts});
    try{
      const now=new Date().toISOString();
      if(!currentSettings.driveRootFolderId)return res.status(409).json({error:'O Master ainda não concluiu a configuração do Google Drive.'});
      const updated:ProcessData={...process,defesa:{...process.defesa,local,localStatus:'CONFIRMADO',localEvidenceUrl:evidence||undefined,localConfirmedAt:now,localConfirmedBy:identity.email},dataRevision:process.dataRevision+1,updatedAt:now};
      processesStore[index]=updated;
      if(conflicts.length)auditLogsStore.push({id:`log-${Date.now()}-conflict`,processId:process.id,actorEmail:identity.email,actorRoles:getUserRolesForEmail(identity.email).globalRoles,action:'SOBRESCRITA_CONFLITO_DEFESA',entityType:'defense_schedule',entityId:process.id,after:{reason:overrideReason,conflicts},timestamp:now});
      googleCalendarEventsStore=generateGoogleEventsFromProcesses(processesStore);
      auditLogsStore.push({id:`log-${Date.now()}`,processId:process.id,actorEmail:identity.email,actorRoles:[...getUserRolesForEmail(identity.email).globalRoles,...roles],action:'CONFIRMACAO_LOCAL',entityType:'processo',entityId:process.id,before:{defesa:process.defesa},after:{defesa:updated.defesa},timestamp:now});
      await persistPortalStateDurably();
      const locationArchive=await archiveProcessFormSnapshot(updated,'CONFIRMACAO_LOCAL');if(locationArchive.status!=='ARCHIVED')return res.status(202).json({...updated,workflowPending:true,workflowError:locationArchive.lastError});
      const workflowRun=await executeConfiguredWorkflowEvent(updated,'LOCATION_CONFIRMED',identity.email);
      if(!workflowRun||workflowRun.status!=='COMPLETED'||!updated.defesa.invitationDriveFileId)return res.status(202).json({...updated,workflowPending:true,workflowError:workflowRun?.actions.find(action=>action.status==='FAILED')?.error||'O fluxo do convite ainda não foi concluído. Revise as ações publicadas no Estúdio.'});
      const deliveryIds=workflowRun.actions.filter(action=>action.kind==='EMAIL'&&action.status==='COMPLETED').flatMap(action=>String(action.externalId||'').split(',').filter(Boolean));
      const recipients=Array.from(new Set(deliveryIds.map(id=>emailDeliveriesStore.find(item=>item.id===id)?.recipient).filter(Boolean) as string[]));
      updated.etapaAtual='CONVITE';updated.status='AGUARDANDO_DEFESA';updated.defesa.invitationSentAt=now;updated.defesa.invitationRecipients=recipients;updated.updatedAt=new Date().toISOString();
      auditLogsStore.push({id:`log-${Date.now()}-invite`,processId:process.id,actorEmail:identity.email,actorRoles:[...getUserRolesForEmail(identity.email).globalRoles,...roles],action:'FLUXO_CONVITE_CONCLUIDO',entityType:'processo',entityId:process.id,after:{driveFileId:updated.defesa.invitationDriveFileId,recipients},timestamp:updated.updatedAt});
      await persistPortalStateDurably();await executeConfiguredWorkflowEvent(updated,'INVITATION_SENT',identity.email);res.json(updated);
    }catch(error){res.status(502).json({error:error instanceof Error?error.message:'Não foi possível executar o fluxo da carta-convite.'});}
  });

  // GET /api/processes/:id
  app.get('/api/processes/:id', (req, res) => {
    const proc = processesStore.find((p) => p.id === req.params.id);
    if (!proc) {
      return res.status(404).json({ error: 'Processo não encontrado.' });
    }
    const identity=getPortalIdentity(req);if(!identity){if(proc.status==='EM_RASCUNHO')return res.status(404).json({error:'Processo não encontrado.'});return res.json(publicProcessView(proc));}if(!canAccessProcess(identity.email,proc.id))return res.status(404).json({error:'Processo não encontrado.'});res.json(proc);
  });

  // PATCH /api/processes/:id (Edit by student or advisor)
  app.patch('/api/processes/:id', requireAuthenticated, async (req, res) => {
    const actorEmail=getPortalIdentity(req)!.email;
    const procIndex = processesStore.findIndex((p) => p.id === req.params.id);

    if (procIndex === -1) {
      return res.status(404).json({ error: 'Processo não encontrado.' });
    }

    const existing = processesStore[procIndex];
    if(!canAccessProcess(actorEmail,existing.id))return res.status(404).json({error:'Processo não encontrado.'});
    const activeRoles=getActiveProcessRoles(actorEmail,existing.id);
    const isFullAdministrator=hasFullAdministration(actorEmail);
    if(!isFullAdministrator&&!activeRoles.includes('STUDENT'))return res.status(403).json({error:'Somente o aluno, o Master ou o Presidente da Comissão pode alterar os dados cadastrais do TCC.'});
    if(signatureJobsStore.some(job=>job.processId===existing.id&&['SENDING','SENT','PARTIALLY_SIGNED','SIGNED','DRIVE_SYNC_PENDING'].includes(job.status)))return res.status(409).json({error:'Há documento em assinatura. Cancele ou conclua o envelope antes de alterar os dados do TCC.',code:'ACTIVE_SIGNATURE_ENVELOPE'});
    if((existing.defesa.invitationDriveFileId||signatureJobsStore.some(job=>job.processId===existing.id&&job.status!=='CANCELED'&&(job.driveUnsignedFileId||job.driveSignedFileId)))&&Object.keys(req.body||{}).some(key=>['titulo','aluno1','aluno2','orientador','coorientador','banca','defesa'].includes(key)))return res.status(409).json({error:'Já existe documento emitido com estes dados. Use a reabertura formal da etapa ou registre uma correção, preservando o histórico.',code:'ISSUED_DOCUMENT_LOCK'});

    // Check edit locks: Student cannot edit after evaluation submitted
    if (existing.avaliacao.status === 'CONCLUIDO' && currentSettings.defaultEditLockMode === 'UNTIL_EVALUATION_SUBMITTED') {
      const { globalRoles } = getUserRolesForEmail(actorEmail);
      if (!hasFullAdministration(actorEmail)) {
        return res.status(403).json({ error: 'A avaliação já foi concluída. Edições comuns estão bloqueadas.' });
      }
    }

    const before = JSON.parse(JSON.stringify(existing));
    const {globalRoles}=getUserRolesForEmail(actorEmail),isAdministrative=isFullAdministrator;
    const allowedKeys=isAdministrative?['titulo','aluno1','aluno2','orientador','coorientador','banca']:['titulo'];
    const forbiddenKeys=Object.keys(req.body||{}).filter(key=>['avaliacao','acervo','etapaAtual','status','driveFolderId','driveFolderUrl','driveSyncedAt'].includes(key));
    if(forbiddenKeys.length)return res.status(400).json({error:'Avaliação, entrega final, estado e vínculos do Drive só podem mudar pelas ações próprias do fluxo.',code:'PROTECTED_WORKFLOW_FIELDS'});
    const acceptedUpdates:any=Object.fromEntries(Object.entries(req.body||{}).filter(([key])=>allowedKeys.includes(key)));
    if(isAdministrative&&req.body?.defesa){
      if(existing.defesa.localStatus==='CONFIRMADO'||existing.defesa.invitationDriveFileId)return res.status(409).json({error:'O agendamento não pode ser alterado após a confirmação do departamento ou geração do convite. Reabra formalmente a etapa antes de corrigir.',code:'DEFENSE_ALREADY_CONFIRMED'});
      const proposed=req.body.defesa,allowedDefense=['startAt','endAt','local','alternateLocation','formato'];
      if(Object.keys(proposed).some(key=>!allowedDefense.includes(key)))return res.status(400).json({error:'A confirmação, o comprovante e o convite não podem ser alterados por edição comum.',code:'PROTECTED_DEFENSE_FIELDS'});
      const defenseUpdates:any=Object.fromEntries(Object.entries(proposed).filter(([key])=>allowedDefense.includes(key)));
      if(defenseUpdates.startAt&&!Number.isFinite(Date.parse(String(defenseUpdates.startAt))))return res.status(400).json({error:'Informe data e hora válidas para a defesa.'});
      if(defenseUpdates.endAt&&!Number.isFinite(Date.parse(String(defenseUpdates.endAt))))return res.status(400).json({error:'Informe um horário final válido para a defesa.'});
      if(defenseUpdates.startAt&&!Object.hasOwn(defenseUpdates,'endAt'))defenseUpdates.endAt=new Date(Date.parse(String(defenseUpdates.startAt))+(currentSettings.slotDurationMinutes||90)*60_000).toISOString();
      acceptedUpdates.defesa={...existing.defesa,...defenseUpdates};
    }
    const updated: ProcessData = {
      ...existing,
      ...acceptedUpdates,
      dataRevision: existing.dataRevision + 1,
      updatedAt: new Date().toISOString()
    };
    const authors=[updated.aluno1,updated.aluno2].filter(Boolean) as Array<NonNullable<ProcessData['aluno2']>>;
    if(!updated.titulo?.trim()||authors.some(author=>!author.nome?.trim()||!author.matricula?.trim()||!isValidPortalEmail(author.email))||!updated.orientador?.nome?.trim()||!isValidPortalEmail(updated.orientador?.email)||!Array.isArray(updated.banca)||updated.banca.length<2||updated.banca.some(member=>!member.nome?.trim()||!isValidPortalEmail(member.email)))return res.status(400).json({error:'Preserve título, autores com matrícula e e-mail, orientador e os dois examinadores com dados válidos.'});
    const previousCoauthor=normalizeEmail(existing.aluno2?.email||''),nextCoauthor=normalizeEmail(updated.aluno2?.email||'');
    if(previousCoauthor!==nextCoauthor)updated.coauthorAcceptance=nextCoauthor?{status:'PENDING',invitedEmail:nextCoauthor,requestedAt:updated.updatedAt}:{status:'NOT_REQUIRED'};
    if(!isAdministrative&&!([updated.aluno1.email,updated.aluno2?.email].filter(Boolean).map(value=>normalizeEmail(String(value))).includes(normalizeEmail(actorEmail))))return res.status(403).json({error:'O aluno autenticado não pode retirar o próprio vínculo de autoria do TCC.'});
    const participantConflict=validateDistinctProcessParticipants(updated);if(participantConflict)return res.status(400).json({error:participantConflict,code:'INVALID_PARTICIPANT_COMPOSITION'});
    {const studentEmails=[updated.aluno1.email,updated.aluno2?.email].filter(Boolean).map(email=>normalizeEmail(String(email)));const profile=resolveInstallationProfile(currentSettings);if(studentEmails.some(email=>!emailMatchesDomains(email,profile.studentEmailDomains)))return res.status(400).json({error:`Os alunos autores devem usar os domínios institucionais configurados: ${profile.studentEmailDomains.join(', ')}.`});const conflict=processesStore.find(process=>process.id!==existing.id&&studentEmails.some(email=>[process.aluno1.email,process.aluno2?.email].filter(Boolean).map(value=>normalizeEmail(String(value))).includes(email)));if(conflict)return res.status(409).json({error:`Cada aluno pode participar como autor de apenas um TCC. Já existe o processo ${conflict.protocolo}.`});}
    if(updated.defesa?.startAt){const endAt=updated.defesa.endAt||new Date(Date.parse(updated.defesa.startAt)+(currentSettings.slotDurationMinutes||90)*60_000).toISOString();const conflicts=isPortalFeatureEnabled(currentSettings,'DEFENSE_CONFLICTS')?findDefenseConflicts({startAt:updated.defesa.startAt,endAt,local:updated.defesa.local,emails:participantEmails(updated),excludeProcessId:updated.id}):[];if(conflicts.length&&!String(req.body?.conflictOverrideReason||'').trim())return res.status(409).json({error:'A alteração cria conflito de sala ou participante.',code:'DEFENSE_CONFLICT',conflicts});}

    processesStore[procIndex] = updated;
    synchronizeProcessParticipants(updated,actorEmail);

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

    signatureJobsStore.forEach(job=>{if(job.processId===existing.id&&['WAITING_INTEGRATION','QUEUED','READY_FOR_REVIEW','APPROVED'].includes(job.status)){job.status='CANCELED';job.lastError='Item invalidado porque os dados do TCC foram alterados.';job.updatedAt=new Date().toISOString();}});await persistPortalStateDurably();res.json(updated);
  });

  // DELETE /api/processes/:id (Master admin deletes a process)
  app.delete('/api/processes/:id', requireAuthenticated, requireAdministrator, (req, res) => {
    const actorEmail=getPortalIdentity(req)!.email;
    const { globalRoles } = getUserRolesForEmail(actorEmail);

    if (!hasFullAdministration(actorEmail)) {
      return res.status(403).json({ error: 'Apenas o Master ou o Presidente da Comissão pode excluir trabalhos de TCC.' });
    }
    if(!hasRecentAuthentication(getPortalIdentity(req)!))return res.status(428).json({error:'Entre novamente antes de excluir um processo.',code:'REAUTHENTICATION_REQUIRED'});

    const procIndex = processesStore.findIndex((p) => p.id === req.params.id);
    if (procIndex === -1) {
      return res.status(404).json({ error: 'Processo não encontrado.' });
    }

    const target=processesStore[procIndex];
    const hasExternalRecord=Boolean(target.driveFolderId||target.defesa.invitationDriveFileId||formArchiveJobsStore.some(job=>job.processId===target.id)||signatureJobsStore.some(job=>job.processId===target.id));
    if(hasExternalRecord)return res.status(409).json({error:'Este TCC já possui registros institucionais no Drive ou na Asten e não pode ser apagado. Preserve a auditoria e use retirada de publicação ou correção formal.',code:'PROCESS_HAS_EXTERNAL_RECORDS'});
    const deleted = processesStore.splice(procIndex, 1)[0];
    membershipsStore = membershipsStore.filter((m) => m.processId !== req.params.id);
    for(const entry of authorizedStudentsStore){if(entry.processIds.includes(req.params.id)){entry.processIds=entry.processIds.filter(id=>id!==req.params.id);if(entry.origin==='TCC_FORM'&&!entry.processIds.length)entry.active=false;entry.updatedAt=new Date().toISOString();}}

    auditLogsStore.push({
      id: `log-${Date.now()}`,
      processId: req.params.id,
      actorEmail,
      actorRoles: globalRoles,
      action: 'EXCLUSAO_PROCESSO_TCC',
      entityType: 'processo',
      entityId: req.params.id,
      before: deleted,
      timestamp: new Date().toISOString()
    });

    signatureJobsStore=signatureJobsStore.filter(job=>job.processId!==req.params.id);persistPortalState();res.json({ message: 'Trabalho de TCC excluído com sucesso.' });
  });

  app.get('/api/processes/:id/evaluation/schema', requireAuthenticated, (req, res) => {
    const actorEmail = getPortalIdentity(req)!.email;
    const process = processesStore.find(p => p.id === req.params.id);
    if (!process || !canAccessProcess(actorEmail, process.id)) return res.status(404).json({ error: 'Processo não encontrado.' });
    if (!hasFullAdministration(actorEmail) && !getActiveProcessRoles(actorEmail, process.id).includes('ADVISOR')) return res.status(403).json({ error: 'O formulário de avaliação pertence ao orientador.' });
    const studio = currentSettings.integrationStudio;
    res.setHeader('Cache-Control', 'private, no-store');
    res.json({ outcomes: currentSettings.evaluationOutcomeOptions, studio: {
      revision: studio?.revision || 0,
      formTemplates: (studio?.formTemplates || []).filter(f => f.id === EVALUATION_FORM_ID || f.id === 'form-reserva-aluno'),
      operationalConfig: { ...operationalConfig(studio), reservation: { ...operationalConfig(studio).reservation, departmentEmail: '' }, presentations: {}, workflow: undefined },
      operationsPolicy: { timezone: studio?.operationsPolicy?.timezone || currentSettings.timezone || 'America/Sao_Paulo' },
    } });
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
    if(rejectPendingCoauthor(proc,res))return;
    const evaluatorRoles=getUserRolesForEmail(actorEmail);const canEvaluate=hasFullAdministration(actorEmail)||evaluatorRoles.memberships.some(m=>m.processId===proc.id&&m.roles.includes('ADVISOR'));
    if(!canEvaluate)return res.status(403).json({error:'Somente o orientador ou um administrador pode registrar a avaliação.'});
    if(proc.avaliacao.status==='CONCLUIDO'||signatureJobsStore.some(job=>job.processId===proc.id&&job.documentType==='ATA'&&job.status!=='CANCELED'))return res.status(409).json({error:'A avaliação já foi concluída e vinculada à Ata. Somente uma reabertura administrativa formal pode criar nova versão.',code:'EVALUATION_ALREADY_SUBMITTED'});
    if(proc.defesa.localStatus!=='CONFIRMADO'||!proc.defesa.invitationSentAt)return res.status(409).json({error:'Confirme o local e envie a carta-convite antes de registrar a avaliação.',code:'PREVIOUS_STAGE_REQUIRED'});
    let evaluation: ReturnType<typeof acceptEvaluation>;
    try { evaluation = acceptEvaluation(proc, req.body, currentSettings, actorEmail); }
    catch (error) {
      if (error instanceof EvaluationError) return res.status(error.status).json({ error: error.message, code: error.code });
      throw error;
    }
    const missing=missingDocumentModels(['ATA']);if(missing.length)return res.status(409).json({error:'O Master precisa cadastrar o modelo da ata antes da avaliação.',code:'DOCUMENT_MODEL_REQUIRED',missingModels:missing});
    const nowISO = new Date().toISOString();
    const before = JSON.parse(JSON.stringify(proc));

    const updated: ProcessData = {
      ...proc,
      etapaAtual: 'REPOSITORIO',
      status: 'AGUARDANDO_DADOS_FINAIS',
      avaliacao: {
        status: 'CONCLUIDO',
        ...evaluation,
        submittedBy: actorEmail,
        submittedAt: nowISO,
        updatedAt: nowISO
      },
      dataRevision: proc.dataRevision + 1,
      updatedAt: nowISO
    };

    processesStore[procIndex] = updated;

    auditLogsStore.push({
      id: `log-${Date.now()}`,
      processId: proc.id,
      actorEmail,
      actorRoles: [...evaluatorRoles.globalRoles, ...getActiveProcessRoles(actorEmail, proc.id)],
      action: 'CONCLUSAO_AVALIACAO',
      entityType: 'avaliacao',
      entityId: proc.id,
      before,
      after: updated.avaliacao,
      timestamp: nowISO
    });

    persistPortalState();const evaluationArchive=await archiveProcessFormSnapshot(updated,'AVALIACAO');if(evaluationArchive.status!=='ARCHIVED')return res.status(202).json({...updated,workflowPending:true,workflowError:evaluationArchive.lastError});const evaluationRun=await executeConfiguredWorkflowEvent(updated,'EVALUATION_SUBMITTED',actorEmail);const missingEvaluationDocuments=missingSignatureJobsForRevision(updated,['ATA']);if(!evaluationRun||evaluationRun.status!=='COMPLETED'||missingEvaluationDocuments.length)return res.status(202).json({...updated,workflowPending:true,workflowError:evaluationRun?.actions.find(action=>action.status==='FAILED')?.error||`O fluxo posterior à avaliação não criou: ${missingEvaluationDocuments.join(', ')||'ATA'}.`});res.json(updated);
  });

  app.post('/api/processes/:id/files/:kind',requireAuthenticated,async(req,res)=>{
    const identity=getPortalIdentity(req)!;
    const index=processesStore.findIndex(process=>process.id===req.params.id);
    if(index<0)return res.status(404).json({error:'Processo não encontrado.'});
    const process=processesStore[index];
    if(!canAccessProcess(identity.email,process.id))return res.status(404).json({error:'Processo não encontrado.'});
    const roles=getActiveProcessRoles(identity.email,process.id);
    if(!hasFullAdministration(identity.email)&&!roles.includes('STUDENT'))return res.status(403).json({error:'Somente o aluno, o Master ou o Presidente da Comissão pode anexar os arquivos finais.'});
    if(process.avaliacao.status!=='CONCLUIDO')return res.status(409).json({error:'A avaliação precisa ser concluída antes do envio dos arquivos finais.'});
    const artifactType=req.params.kind==='trabalho-completo'?'TRABALHO_COMPLETO':req.params.kind==='resumo-expandido'?'RESUMO_EXPANDIDO':null;
    if(!artifactType)return res.status(404).json({error:'Tipo de arquivo não reconhecido.'});
    if(!currentSettings.driveRootFolderId)return res.status(409).json({error:'O Master ainda não concluiu a configuração da pasta raiz do Google Drive.'});
    try{
      const archive=async(file:{bytes:Buffer;fileName:string})=>{
        if(!file.fileName.toLowerCase().endsWith('.pdf')||!file.bytes.subarray(0,5).equals(Buffer.from('%PDF-')))throw new Error('Selecione um arquivo PDF válido.');
        const accessToken=await getGoogleWorkspaceAccessToken();
        if(!process.driveFolderId){const folder=await ensurePortalProcessDriveFolder({accessToken,rootFolderId:currentSettings.driveRootFolderId!,protocol:process.protocolo,processId:process.id});process.driveFolderId=folder.id;process.driveFolderUrl=folder.webViewLink;process.driveSyncedAt=new Date().toISOString();}
        const sha256=createHash('sha256').update(file.bytes).digest('hex');
        const previousId=artifactType==='TRABALHO_COMPLETO'?process.acervo?.trabalhoCompletoFileId:process.acervo?.resumoExpandidoFileId;
        const previousHash=artifactType==='TRABALHO_COMPLETO'?process.acervo?.trabalhoCompletoSha256:process.acervo?.resumoExpandidoSha256;
        const previousVersion=artifactType==='TRABALHO_COMPLETO'?process.acervo?.trabalhoCompletoVersion:process.acervo?.resumoExpandidoVersion;
        const localUrl=`/api/processes/${process.id}/files/${req.params.kind}/download`;
        if(previousId&&previousHash===sha256)return{status:200,body:{id:previousId,fileName:artifactType==='TRABALHO_COMPLETO'?process.acervo?.trabalhoCompletoFileName:process.acervo?.resumoExpandidoFileName,downloadUrl:localUrl,sha256,version:previousVersion||1,reused:true}};
        const version=Math.max(1,Number(previousVersion||0)+1);
        const canonicalName=buildProcessArchiveFileName({protocol:process.protocolo,studentNames:[process.aluno1.nome,process.aluno2?.nome||''].filter(Boolean),title:process.titulo,artifactLabel:artifactType,version});
        const uploaded=await uploadProcessSourcePdf({accessToken,processFolderId:process.driveFolderId,processId:process.id,artifactType,fileName:canonicalName,version,previousFileId:previousId,pdf:file.bytes,sha256});
        const now=new Date().toISOString();const nextAcervo={...(process.acervo||{})};
        if(artifactType==='TRABALHO_COMPLETO'){nextAcervo.trabalhoCompletoFileId=String(uploaded.id);nextAcervo.trabalhoCompletoFileName=String(uploaded.name||canonicalName);nextAcervo.trabalhoCompletoFileUrl=localUrl;nextAcervo.trabalhoCompletoSha256=sha256;nextAcervo.trabalhoCompletoVersion=version;}
        else{nextAcervo.resumoExpandidoFileId=String(uploaded.id);nextAcervo.resumoExpandidoFileName=String(uploaded.name||canonicalName);nextAcervo.resumoExpandidoFileUrl=localUrl;nextAcervo.resumoExpandidoSha256=sha256;nextAcervo.resumoExpandidoVersion=version;}
        processesStore[index]={...process,acervo:nextAcervo,dataRevision:process.dataRevision+1,updatedAt:now};
        auditLogsStore.push({id:`log-${Date.now()}`,processId:process.id,actorEmail:identity.email,actorRoles:[...getUserRolesForEmail(identity.email).globalRoles,...roles],action:'UPLOAD_PDF_DRIVE',entityType:'process_file',entityId:String(uploaded.id),before:previousId?{driveFileId:previousId,version:previousVersion||1,lifecycle:'SUPERSEDED'}:undefined,after:{artifactType,fileName:String(uploaded.name||canonicalName),sha256,version,lifecycle:'CURRENT'},timestamp:now});
        await persistPortalStateDurably();
        return{status:201,body:{id:String(uploaded.id),fileName:String(uploaded.name||canonicalName),downloadUrl:localUrl,sha256,version}};
      };
      const uploadId=String(req.body?.stagedUploadId||'').trim();
      const result=uploadId
        ?await withSupabaseStagedUpload({uploadId,purpose:artifactType==='TRABALHO_COMPLETO'?'PROCESS_FULL_WORK':'PROCESS_EXPANDED_ABSTRACT',requesterBinding:sessionUploadBinding(identity),processId:process.id},archive)
        :await archive({bytes:readLegacyDevelopmentUpload({contentBase64:req.body?.contentBase64,fileName:String(req.body?.fileName||''),expected:'PDF'}),fileName:String(req.body?.fileName||'')});
      res.status(result.status).json(result.body);
    }catch(error){const message=error instanceof Error?error.message:'Falha ao armazenar o PDF no Google Drive.';const clientError=/arquivo|upload|checksum|MIME|sessão|processo|finalidade|fallback/i.test(message);res.status(clientError?400:502).json({error:message});}
  });

  app.get('/api/public/processes/:id/files/:kind/download',async(req,res)=>{
    if(!allowPublicDownload(req.ip||''))return res.status(429).json({error:'Limite temporário de downloads atingido. Tente novamente em instantes.'});
    const process=processesStore.find(item=>item.id===req.params.id);
    const isFull=req.params.kind==='trabalho-completo';
    const isExpanded=req.params.kind==='resumo-expandido';
    const allowed=process?.status==='CONCLUIDO'&&((isFull&&process.acervo?.publishFullWork===true)||(isExpanded&&process.acervo?.publishExpandedAbstract===true));
    if(!process||!allowed)return res.status(404).json({error:'Arquivo não encontrado.'});
    const fileId=isFull?process.acervo?.trabalhoCompletoFileId:isExpanded?process.acervo?.resumoExpandidoFileId:'';
    if(!fileId)return res.status(404).json({error:'Arquivo não encontrado.'});
    try{const accessToken=await getGoogleWorkspaceAccessToken();const artifactType=isFull?'TRABALHO_COMPLETO':'RESUMO_EXPANDIDO';const file=await downloadDrivePdf(accessToken,fileId,{processId:process.id,artifactType});const event={id:`log-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,processId:process.id,actorEmail:'public@portal.local',actorRoles:[] as UserRole[],action:'DOWNLOAD_PUBLICO_AUTORIZADO',entityType:'process_file',entityId:artifactType,after:{protocol:process.protocolo,kind:req.params.kind},timestamp:new Date().toISOString()};auditLogsStore.push(event);void appendSupabaseAuditEvent({externalId:event.id,occurredAt:event.timestamp,processCode:process.protocolo,eventType:event.action,entityType:event.entityType,entityId:event.entityId,details:event.after}).catch(error=>console.warn('[Audit] Falha no registro leve do download público:',error));await deliverPortalDownload({res,bytes:file.pdf,fileName:file.fileName,mimeType:'application/pdf',requesterBinding:`public:${req.ip||'unknown'}:${process.id}:${artifactType}`,cacheControl:'no-store, max-age=0'});}catch(error){res.status(502).json({error:error instanceof Error?error.message:'Falha ao recuperar o PDF.'});}
  });

  app.get('/api/processes/:id/files/:kind/download',requireAuthenticated,async(req,res)=>{
    const identity=getPortalIdentity(req)!;
    const process=processesStore.find(item=>item.id===req.params.id);
    if(!process||!canAccessProcess(identity.email,process.id))return res.status(404).json({error:'Arquivo não encontrado.'});
    const fileId=req.params.kind==='trabalho-completo'?process.acervo?.trabalhoCompletoFileId:req.params.kind==='resumo-expandido'?process.acervo?.resumoExpandidoFileId:'';
    if(!fileId)return res.status(404).json({error:'Arquivo não encontrado.'});
    try{const accessToken=await getGoogleWorkspaceAccessToken();const artifactType=req.params.kind==='trabalho-completo'?'TRABALHO_COMPLETO':'RESUMO_EXPANDIDO';const file=await downloadDrivePdf(accessToken,fileId,{processId:process.id,artifactType});await deliverPortalDownload({res,bytes:file.pdf,fileName:file.fileName,mimeType:'application/pdf',requesterBinding:sessionUploadBinding(identity),cacheControl:'private, no-store'});}catch(error){res.status(502).json({error:error instanceof Error?error.message:'Falha ao recuperar o PDF.'});}
  });

  app.post('/api/processes/:id/final-data',requireAuthenticated,async(req,res)=>{
    const identity=getPortalIdentity(req)!;
    const index=processesStore.findIndex(process=>process.id===req.params.id);
    if(index<0)return res.status(404).json({error:'Processo não encontrado.'});
    const process=processesStore[index];
    if(!canAccessProcess(identity.email,process.id))return res.status(404).json({error:'Processo não encontrado.'});
    if(rejectPendingCoauthor(process,res))return;
    const finalDataRoles=getActiveProcessRoles(identity.email,process.id);
    if(!hasFullAdministration(identity.email)&&!finalDataRoles.includes('STUDENT'))return res.status(403).json({error:'Somente o aluno, o Master ou o Presidente da Comissão pode concluir os dados de publicação.'});
    if(process.avaliacao.status!=='CONCLUIDO')return res.status(409).json({error:'A avaliação precisa ser concluída antes dos dados finais.'});
    if(!ataArchived(process,signatureJobsStore))return res.status(409).json({error:'Aguarde a Ata assinada pelo orientador e arquivada no Drive.',code:'ATA_SIGNATURE_REQUIRED'});
    if(process.status==='CONCLUIDO'||signatureJobsStore.some(job=>job.processId===process.id&&job.documentType!=='ATA'&&job.status!=='CANCELED'))return res.status(409).json({error:'Os dados finais ficam bloqueados após a criação do Termo ou da Declaração. Use o fluxo administrativo de retirada ou gere uma nova versão formal.',code:'FINAL_DATA_LOCKED_BY_SIGNATURE'});
    const palavrasChave=Array.isArray(req.body?.palavrasChave)?req.body.palavrasChave.map((value:unknown)=>String(value).trim()).filter(Boolean):[];
    const resumoSintese=String(req.body?.resumoSintese||'').trim();
    const trabalhoCompletoFileUrl=String(process.acervo?.trabalhoCompletoFileUrl||'').trim();
    const publishFullWork=Boolean(req.body?.publishFullWork);
    const publishExpandedAbstract=Boolean(req.body?.publishExpandedAbstract);
    const wantsPublication=publishFullWork||publishExpandedAbstract;
    const missing=missingDocumentModels(wantsPublication?['TERMO','DECLARACAO']:['DECLARACAO']);if(missing.length)return res.status(409).json({error:`O Master precisa cadastrar ${wantsPublication?'os modelos do termo e da declaração':'o modelo da declaração'} antes desta etapa.`,code:'DOCUMENT_MODEL_REQUIRED',missingModels:missing});
    if(palavrasChave.length!==5)return res.status(400).json({error:'Informe exatamente cinco palavras-chave.'});
    if(resumoSintese.split(/\n\s*\n/).filter(part=>part.trim()).length<3||resumoSintese.split(/\n\s*\n/).filter(part=>part.trim()).length>5)return res.status(400).json({error:'O resumo sintético deve conter de três a cinco parágrafos separados por uma linha em branco.'});
    if(!trabalhoCompletoFileUrl)return res.status(400).json({error:'Anexe o trabalho de conclusão de curso.'});
    if(publishExpandedAbstract&&!process.acervo?.resumoExpandidoFileId)return res.status(400).json({error:'Anexe o resumo expandido antes de autorizar sua publicação.'});
    if(wantsPublication&&req.body?.authorizationConfirmed!==true)return res.status(400).json({error:'Confirme expressamente quais arquivos serão publicados.'});
    const now=new Date().toISOString();
    const updated:ProcessData={...process,etapaAtual:'ASSINATURA',status:'AGUARDANDO_ASSINATURA',acervo:{...process.acervo,palavrasChave,resumoSintese,trabalhoCompletoFileUrl,publishFullWork,publishExpandedAbstract,workType:req.body?.workType||'MONOGRAFIA',isPublic:publishFullWork,authorizationConfirmedAt:wantsPublication?now:undefined,publicationRequestedAt:wantsPublication?now:undefined,publicationWithdrawnAt:undefined,publicationWithdrawnBy:undefined,publicationWithdrawalReason:undefined,submittedAt:now,submittedBy:identity.email},dataRevision:process.dataRevision+1,updatedAt:now};
    processesStore[index]=updated;
    auditLogsStore.push({id:`log-${Date.now()}`,processId:process.id,actorEmail:identity.email,actorRoles:getUserRolesForEmail(identity.email).memberships.flatMap(m=>m.roles),action:'CONCLUSAO_DADOS_REPOSITORIO',entityType:'acervo',entityId:process.id,before:process.acervo,after:updated.acervo,timestamp:now});
    persistPortalState();const finalArchive=await archiveProcessFormSnapshot(updated,'DADOS_FINAIS');if(finalArchive.status!=='ARCHIVED')return res.status(202).json({...updated,workflowPending:true,workflowError:finalArchive.lastError});const repositoryRun=await executeConfiguredWorkflowEvent(updated,'REPOSITORY_SUBMITTED',identity.email);if(declarationReady(updated,signatureJobsStore))await executeConfiguredWorkflowEvent(updated,'PUBLICATION_CLEARED',identity.email);const requiredFinalDocuments:Array<'TERMO'|'DECLARACAO'>=wantsPublication?['TERMO']:['DECLARACAO'];const missingFinalDocuments=missingSignatureJobsForRevision(updated,requiredFinalDocuments);if(!repositoryRun||repositoryRun.status!=='COMPLETED'||missingFinalDocuments.length)return res.status(202).json({...updated,workflowPending:true,workflowError:repositoryRun?.actions.find(action=>action.status==='FAILED')?.error||`O fluxo de documentos finais não criou: ${missingFinalDocuments.join(', ')||'documento obrigatório'}.`});res.json(updated);
  });

  app.post('/api/admin/processes/:id/publication/withdraw',requireAuthenticated,requireAdministrator,(req,res)=>{
    const identity=getPortalIdentity(req)!;
    const index=processesStore.findIndex(process=>process.id===req.params.id);
    if(index<0)return res.status(404).json({error:'Processo não encontrado.'});
    const reason=String(req.body?.reason||'').trim();
    if(reason.length<10)return res.status(400).json({error:'Informe o motivo da retirada com pelo menos 10 caracteres.'});
    const process=processesStore[index];
    if(!publicationRequested(process))return res.status(409).json({error:'Este TCC não possui publicação ativa.'});
    const now=new Date().toISOString();
    const before={publishFullWork:process.acervo?.publishFullWork,publishExpandedAbstract:process.acervo?.publishExpandedAbstract};
    const updated:ProcessData={...process,acervo:{...process.acervo,publishFullWork:false,publishExpandedAbstract:false,isPublic:false,publicationWithdrawnAt:now,publicationWithdrawnBy:identity.email,publicationWithdrawalReason:reason},dataRevision:process.dataRevision+1,updatedAt:now};
    processesStore[index]=updated;
    auditLogsStore.push({id:`log-${Date.now()}`,processId:process.id,actorEmail:identity.email,actorRoles:getUserRolesForEmail(identity.email).globalRoles,action:'RETIRADA_PUBLICACAO_REPOSITORIO',entityType:'publication',entityId:process.id,before,after:{reason,withdrawnAt:now},timestamp:now});
    persistPortalState();res.json({processId:process.id,withdrawnAt:now,public:false});
  });

  // POST /api/processes/:id/reopen (Master reopens evaluation)
  app.post('/api/processes/:id/reopen', requireAuthenticated, requireAdministrator, (req, res) => {
    const identity=getPortalIdentity(req)!;const actorEmail=identity.email;
    const { globalRoles } = getUserRolesForEmail(actorEmail);

    if (!hasFullAdministration(actorEmail)) {
      return res.status(403).json({ error: 'Apenas o Master ou o Presidente da Comissão pode reabrir avaliações.' });
    }
    if(!hasRecentAuthentication(identity))return res.status(428).json({error:'Entre novamente antes de reabrir uma avaliação.',code:'REAUTHENTICATION_REQUIRED'});

    const procIndex = processesStore.findIndex((p) => p.id === req.params.id);
    if (procIndex === -1) {
      return res.status(404).json({ error: 'Processo não encontrado.' });
    }

    const proc = processesStore[procIndex];
    const reason=String(req.body?.reason||'').trim();
    if(reason.length<10)return res.status(400).json({error:'Informe o motivo da reabertura com pelo menos 10 caracteres.'});
    const jobs=signatureJobsStore.filter(job=>job.processId===proc.id&&job.status!=='CANCELED');
    if(jobs.some(job=>job.providerEnvelopeId||['SENT','PARTIALLY_SIGNED','SIGNED','ARCHIVED','DRIVE_SYNC_PENDING'].includes(job.status)))return res.status(409).json({error:'Há documento já encaminhado à Asten. A reabertura foi bloqueada para não invalidar um registro externo; reconcilie ou cancele formalmente o envelope antes.',code:'ACTIVE_EXTERNAL_SIGNATURE'});
    const before = JSON.parse(JSON.stringify(proc));
    const now=new Date().toISOString();
    for(const job of jobs){job.status='CANCELED';job.lastError=`Invalidado pela reabertura administrativa: ${reason}`;job.updatedAt=now;}

    const updated: ProcessData = {
      ...proc,
      etapaAtual: 'AVALIACAO',
      status: 'EM_AVALIACAO',
      avaliacao: {
        ...proc.avaliacao,
        status: 'PENDENTE',
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
      actorRoles: globalRoles,
      action: 'REABERTURA_AVALIACAO',
      entityType: 'processo',
      entityId: proc.id,
      before,
      after: {...updated,reopenReason:reason},
      timestamp: now
    });

    persistPortalState();res.json(updated);
  });

  // GET /api/processes/:id/documents
  app.get('/api/processes/:id/documents', requireAuthenticated, (req, res) => {
    const proc = processesStore.find((p) => p.id === req.params.id);
    if (!proc) {
      return res.status(404).json({ error: 'Processo não encontrado.' });
    }

    const actorEmail=getPortalIdentity(req)!.email;
    if(!canAccessProcess(actorEmail,proc.id))return res.status(404).json({error:'Processo não encontrado.'});
    const roles=getActiveProcessRoles(actorEmail,proc.id);
    const docs=generateDefaultDocuments(proc).filter(doc=>hasFullAdministration(actorEmail)||doc.visibleToRoles.some(role=>roles.includes(role)));
    res.json(docs);
  });

  app.get('/api/processes/:id/documents/:docId/download',requireAuthenticated,async(req,res)=>{
    const identity=getPortalIdentity(req)!;
    const process=processesStore.find(item=>item.id===req.params.id);
    if(!process||!canAccessProcess(identity.email,process.id))return res.status(404).json({error:'Documento não encontrado.'});
    const roles=getActiveProcessRoles(identity.email,process.id);
    const document=generateDefaultDocuments(process).find(doc=>doc.id===req.params.docId&&(hasFullAdministration(identity.email)||doc.visibleToRoles.some(role=>roles.includes(role))));
    if(!document||!['DISPONIVEL','ASSINADO'].includes(document.status))return res.status(404).json({error:'Documento não encontrado.'});
    let fileId='';let signatureJob:SignatureJob|undefined;
    if(document.type==='CONVITE')fileId=String(process.defesa.invitationDriveFileId||'');
    else{signatureJob=signatureJobsStore.filter(job=>job.processId===process.id&&job.documentType===document.type&&job.status==='ARCHIVED'&&job.driveSignedFileId).sort((a,b)=>b.documentVersion-a.documentVersion)[0];fileId=String(signatureJob?.driveSignedFileId||'');}
    if(!fileId)return res.status(404).json({error:'Documento não encontrado.'});
    try{const accessToken=await getGoogleWorkspaceAccessToken();const file=await downloadDrivePdf(accessToken,fileId,{processId:process.id,artifactType:document.type,...(signatureJob?{signatureJobId:signatureJob.id}:{})});await deliverPortalDownload({res,bytes:file.pdf,fileName:file.fileName,mimeType:'application/pdf',requesterBinding:sessionUploadBinding(identity),cacheControl:'private, no-store'});}catch(error){res.status(502).json({error:error instanceof Error?error.message:'Falha ao recuperar o documento.'});}
  });

  app.get('/api/processes/:id/signatures',requireAuthenticated,(req,res)=>{
    const identity=getPortalIdentity(req)!;
    const process=processesStore.find(item=>item.id===req.params.id);
    if(!process||!canAccessProcess(identity.email,process.id))return res.status(404).json({error:'Processo não encontrado.'});
    res.json(signatureJobsStore.filter(job=>job.processId===process.id).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)).map(publicSignatureJob));
  });

  app.get('/api/processes/:id/verifications',requireAuthenticated,requireFeature('PUBLIC_AUTHENTICITY'),(req,res)=>{const identity=getPortalIdentity(req)!;const process=processesStore.find(item=>item.id===req.params.id);if(!process||!canAccessProcess(identity.email,process.id))return res.status(404).json({error:'Trabalho não encontrado.'});res.json(signatureJobsStore.filter(job=>job.processId===process.id&&job.status==='ARCHIVED'&&job.verificationCode).map(job=>({documentType:job.documentType,version:job.documentVersion,code:job.verificationCode,url:`/validar/${job.verificationCode}`,sha256:job.signedSha256,signedAt:job.completedAt})));});
  app.get('/api/public/verification/:code',requireFeature('PUBLIC_AUTHENTICITY'),(req,res)=>{const code=String(req.params.code||'');const job=signatureJobsStore.find(item=>item.verificationCode===code&&item.status==='ARCHIVED');if(!job)return res.status(404).json({valid:false,status:'NOT_FOUND'});const process=processesStore.find(item=>item.id===job.processId);if(!process)return res.status(404).json({valid:false,status:'NOT_FOUND'});const profile=resolveInstallationProfile(currentSettings);res.setHeader('Cache-Control','public, max-age=300');res.json({valid:true,status:'VALID',institution:profile.institutionName,course:profile.courseName,protocol:process.protocolo,documentType:job.documentType,version:job.documentVersion,signedAt:job.completedAt,sha256:job.signedSha256});});
  app.get('/api/public/verification/:code/qr.svg',requireFeature('PUBLIC_AUTHENTICITY'),async(req,res)=>{const code=String(req.params.code||'');const job=signatureJobsStore.find(item=>item.verificationCode===code&&item.status==='ARCHIVED');if(!job)return res.status(404).send('Código não encontrado.');const base=String(process.env.PORTAL_PUBLIC_URL||process.env.APP_URL||`${req.protocol}://${req.get('host')}`).replace(/\/$/,'');const svg=await QRCode.toString(`${base}/validar/${encodeURIComponent(code)}`,{type:'svg',errorCorrectionLevel:'M',margin:2,width:256,color:{dark:'#0f172a',light:'#ffffff'}});res.setHeader('Content-Type','image/svg+xml; charset=utf-8');res.setHeader('Cache-Control','public, max-age=86400');res.send(svg);});
  app.post('/api/public/verification/:code/check-file',requireFeature('PUBLIC_AUTHENTICITY'),async(req,res)=>{
    const code=String(req.params.code||'');const job=signatureJobsStore.find(item=>item.verificationCode===code&&item.status==='ARCHIVED');if(!job)return res.status(404).json({valid:false,status:'NOT_FOUND'});
    try{
      const check=async(file:{bytes:Buffer})=>{if(!file.bytes.subarray(0,5).equals(Buffer.from('%PDF-')))throw new Error('Envie um PDF válido.');const sha256=createHash('sha256').update(file.bytes).digest('hex');const matches=Boolean(job.signedSha256&&sha256===job.signedSha256);return{valid:matches,status:matches?'MATCH':'MISMATCH',sha256};};
      const uploadId=String(req.body?.stagedUploadId||'').trim();
      const result=uploadId
        ?await withSupabaseStagedUpload({uploadId,purpose:'VERIFICATION_PDF',requesterBinding:verificationUploadBinding(code),verificationCode:code},check)
        :await check({bytes:readLegacyDevelopmentUpload({contentBase64:req.body?.contentBase64,fileName:'verificacao.pdf',expected:'PDF'})});
      res.setHeader('Cache-Control','no-store');res.json(result);
    }catch(error){res.status(400).json({error:error instanceof Error?error.message:'Não foi possível conferir o PDF.'});}
  });
  app.get('/api/admin/processes/:id/dossier',requireAuthenticated,requireAdministrator,requireFeature('INSTITUTIONAL_DOSSIER'),async(req,res)=>{const identity=getPortalIdentity(req)!;if(!hasRecentAuthentication(identity))return res.status(428).json({error:'Entre novamente antes de gerar um dossiê integral.'});const process=processesStore.find(item=>item.id===req.params.id);if(!process)return res.status(404).json({error:'Trabalho não encontrado.'});try{const dossier=await createInstitutionalDossier(process,identity.email);auditLogsStore.push({id:`log-${Date.now()}`,processId:process.id,actorEmail:identity.email,actorRoles:getUserRolesForEmail(identity.email).globalRoles,action:'GERACAO_DOSSIE_INSTITUCIONAL',entityType:'process_dossier',entityId:dossier.manifestHash.slice(0,24),after:{manifestHash:dossier.manifestHash,included:dossier.included,missing:dossier.missing.length},timestamp:new Date().toISOString()});await persistPortalStateDurably();await deliverPortalDownload({res,bytes:dossier.zip,fileName:dossier.fileName,mimeType:'application/zip',requesterBinding:sessionUploadBinding(identity),cacheControl:'private, no-store'});}catch(error){res.status(502).json({error:error instanceof Error?error.message:'Não foi possível gerar o dossiê.'});}});

  app.post('/api/processes/:id/documents/:type/sign',requireAuthenticated,async(req,res)=>{
    const identity=getPortalIdentity(req)!;
    const process=processesStore.find(item=>item.id===req.params.id);
    if(!process||!canAccessProcess(identity.email,process.id))return res.status(404).json({error:'Processo não encontrado.'});
    if(rejectPendingCoauthor(process,res))return;
    const type=String(req.params.type).toUpperCase() as 'ATA'|'TERMO'|'DECLARACAO';
    if(!['ATA','TERMO','DECLARACAO'].includes(type))return res.status(400).json({error:'Este documento não utiliza assinatura Asten.'});
    if(type==='TERMO'&&!publicationRequested(process))return res.status(409).json({error:'O termo não é necessário porque o aluno não solicitou publicação.',code:'PUBLICATION_NOT_REQUESTED'});
    if(!canInitiateSignature(identity.email,process,type))return res.status(403).json({error:'Seu perfil não pode solicitar a assinatura deste documento.'});
    const missing=missingDocumentModels([type]);if(missing.length)return res.status(409).json({error:`O modelo de ${type} ainda não foi cadastrado pelo Master.`,code:'DOCUMENT_MODEL_REQUIRED',missingModels:missing});
    try{
      const job=await createSignatureJob(process,type,identity.email);
      await dispatchSignatureJobAutomatically(job);
      await executeConfiguredWorkflowEvent(process,'SIGNATURE_REQUESTED',identity.email);
      auditLogsStore.push({id:`log-${Date.now()}`,processId:process.id,actorEmail:identity.email,actorRoles:[...getUserRolesForEmail(identity.email).globalRoles,...getActiveProcessRoles(identity.email,process.id)],action:'SOLICITACAO_ASSINATURA_ASTEN',entityType:'signature_job',entityId:job.id,after:{documentType:type,status:job.status,contentSha256:job.contentSha256,providerEnvelopeId:job.providerEnvelopeId},timestamp:new Date().toISOString()});
      persistPortalState();
      const status=job.status==='WAITING_INTEGRATION'||job.status==='PROVIDER_ERROR'?409:200;
      res.status(status).json({job:publicSignatureJob(job),message:job.status==='SENT'?'Documento enviado à Asten. Os signatários receberão o acesso diretamente pela plataforma.':job.lastError||'Solicitação registrada.'});
    }catch(error){res.status(409).json({error:error instanceof Error?error.message:'Não foi possível solicitar a assinatura.'});}
  });

  // POST /api/processes/:id/documents/:docId/correction-request
  app.post('/api/processes/:id/documents/:docId/correction-request', requireAuthenticated, (req, res) => {
    const actorEmail=getPortalIdentity(req)!.email;if(!canAccessProcess(actorEmail,req.params.id))return res.status(404).json({error:'Processo não encontrado.'});
    const { description } = req.body;

    if (!description) {
      return res.status(400).json({ error: 'Descrição do ajuste é obrigatória.' });
    }

    const newTicket: DocumentCorrectionRequest = {
      id: `req-${Date.now()}`,
      processId: req.params.id,
      documentId: req.params.docId,
      documentVersion: req.body.documentVersion || 1,
      requestedByEmail: actorEmail,
      requestedByRoles: ['STUDENT'],
      description: description.trim(),
      status: 'ABERTO',
      createdAt: new Date().toISOString()
    };

    correctionRequestsStore.push(newTicket);

    auditLogsStore.push({
      id: `log-${Date.now()}`,
      processId: req.params.id,
      actorEmail,
      actorRoles: ['STUDENT'],
      action: 'SOLICITACAO_AJUSTE_DOCUMENTO',
      entityType: 'ticket_correcao',
      entityId: newTicket.id,
      after: newTicket,
      timestamp: new Date().toISOString()
    });

    persistPortalState();res.status(201).json(newTicket);
  });

  // GET /api/coordinator/signature-queue
  app.get(['/api/president/signature-queue','/api/coordinator/signature-queue'], requireAuthenticated, requireAdministrator, (req, res) => {
    // Master e Presidente visualizam os processos aguardando assinaturas.
    const pending = processesStore
      .filter((p) => p.etapaAtual === 'ASSINATURA' || p.status === 'AGUARDANDO_ASSINATURA')
      .map((p) => ({
        process: p,
        documents: generateDefaultDocuments(p).filter((d) => d.requiresSignature && d.status === 'AGUARDANDO_ASSINATURA')
      }));

    res.json(pending);
  });

  // POST /api/coordinator/upload-signed
  app.post(['/api/president/upload-signed','/api/coordinator/upload-signed'], requireAuthenticated, requireAdministrator, (_req,res)=>res.status(410).json({error:'O upload simulado foi desativado. Use a assinatura Asten dentro do TCC.',code:'LEGACY_SIGNATURE_UPLOAD_DISABLED'}));

  app.get('/api/integrations/asten/status',requireAuthenticated,requireAdministrativeOperator,async(_req,res)=>res.json(await getPersistentAstenStatus()));
  app.get('/api/integrations/status',requireAuthenticated,requireAdministrativeOperator,async(req,res)=>{const testedSupabase=await testSupabaseRuntimeConnection();const fileTransport=getSupabaseStagingSecurityStatus();const provider=String(process.env.PORTAL_PERSISTENCE_PROVIDER||'local_file');const vercelDetected=Boolean(process.env.VERCEL);const snapshotReady=provider==='supabase'&&testedSupabase.durablePersistenceReady&&testedSupabase.connected;const transactionalRuntimeReady=Boolean(testedSupabase.transactionalRuntimeReady);const productionSafe=transactionalRuntimeReady&&testedSupabase.normalizedSchemaReady&&fileTransport.configured;const[asten,google]=await Promise.all([getPersistentAstenStatus(),getGoogleWorkspaceStatus()]);const configuredCallback=String(process.env.ASTEN_CALLBACK_URL||`${process.env.APP_URL||`${req.protocol}://${req.get('host')}`}/api/integrations/asten/webhook`);res.json({asten:{...asten,callbackUrl:configuredCallback},googleDrive:{...google,configured:google.connected&&Boolean(currentSettings.driveRootFolderId),rootFolderIdPresent:Boolean(currentSettings.driveRootFolderId)},supabase:{...testedSupabase,fileTransport},vercel:{detected:vercelDetected,production:process.env.VERCEL_ENV==='production',projectIdPresent:Boolean(process.env.VERCEL_PROJECT_ID),message:vercelDetected?'Runtime Vercel detectado.':'Execute a implantação pela Vercel depois de configurar os segredos.'},persistence:{provider,snapshotReady,normalizedSchemaReady:testedSupabase.normalizedSchemaReady,transactionalRuntimeReady,productionSafe,message:productionSafe?'Runtime v6, controle otimista, transporte privado e outbox Asten ativos. Faça o piloto real antes de liberar usuários.':snapshotReady?'Persistência conectada, mas a migração v6 e a outbox Asten ainda não foram confirmadas.':'O armazenamento local não é durável na Vercel. Configure o Supabase e aplique todas as migrações antes de publicar.'}});});
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
    const checks:Array<{id:string;label:string;status:'PASS'|'FAIL'|'PENDING';message:string}> = [];
    const supabase=await testSupabaseRuntimeConnection();
    checks.push({id:'supabase',label:'Supabase e persistência básica',status:supabase.connected&&supabase.durablePersistenceReady?'PASS':'FAIL',message:supabase.message});
    checks.push({id:'supabase-transactional',label:'Runtime seguro v6',status:supabase.transactionalRuntimeReady&&getSupabaseStagingSecurityStatus().configured?'PASS':'FAIL',message:supabase.transactionalRuntimeReady&&getSupabaseStagingSecurityStatus().configured?'Commit atômico, transporte privado e outbox Asten v6 confirmados.':'Aplique todas as migrações até 202609060001_asten_transactional_outbox_v6.sql e configure PORTAL_UPLOAD_BINDING_SECRET.'});
    const google=await getGoogleWorkspaceStatus();
    if(!google.connected){checks.push({id:'google',label:'Google Workspace e Drive',status:'FAIL',message:'Autorize a conta Google do portal.'});}
    else if(!currentSettings.driveRootFolderId){checks.push({id:'google',label:'Google Workspace e Drive',status:'FAIL',message:'A pasta raiz do portal ainda não foi definida.'});}
    else{
      try{const accessToken=await getGoogleWorkspaceAccessToken();await verifyPrivateDriveFolder(accessToken,currentSettings.driveRootFolderId);checks.push({id:'google',label:'Google Workspace e Drive',status:'PASS',message:`Conta ${google.connectedEmail} conectada e pasta raiz privada validada.`});}
      catch(error){checks.push({id:'google',label:'Google Workspace e Drive',status:'FAIL',message:error instanceof Error?error.message:'Falha ao validar o Google Drive.'});}
    }
    const asten=await getPersistentAstenStatus();
    checks.push({id:'asten',label:'Asten Assinatura',status:asten.configured&&asten.callbackConfigured?'PASS':'FAIL',message:asten.configured?(asten.callbackConfigured?'Token cifrado e callback autenticado configurados.':'Token conectado; configure o segredo do callback antes da produção.'):'Conecte o token da conta Asten.'});
    const vercelDetected=Boolean(process.env.VERCEL);const vercelProduction=process.env.VERCEL_ENV==='production';
    checks.push({id:'vercel',label:'Vercel',status:vercelDetected&&vercelProduction?'PASS':'PENDING',message:vercelDetected?(vercelProduction?'Implantação de produção detectada.':'Ambiente Vercel detectado, mas ainda não é produção.'):'A Vercel será verificada depois da primeira implantação.'});
    const models=['CONVITE','ATA','TERMO','DECLARACAO'].filter(type=>Boolean(currentSettings.documentModels?.[type as keyof typeof currentSettings.documentModels]?.driveFileId));
    checks.push({id:'models',label:'Modelos no Drive',status:models.length===4?'PASS':'FAIL',message:`${models.length}/4 modelos obrigatórios configurados pelo Master.`});
    const report={id:`homologation-${Date.now()}`,executedAt:new Date().toISOString(),executedBy:identity.email,readyForProduction:checks.every(check=>check.status==='PASS')&&vercelProduction,checks};
    auditLogsStore.push({id:`log-${Date.now()}`,actorEmail:identity.email,actorRoles:getUserRolesForEmail(identity.email).globalRoles,action:'HOMOLOGACAO_ASSISTIDA_INTEGRACOES',entityType:'integration_homologation',entityId:report.id,after:{readyForProduction:report.readyForProduction,checks:checks.map(check=>({id:check.id,status:check.status}))},timestamp:report.executedAt});
    persistPortalState();res.json(report);
  });
  app.post('/api/integrations/asten/session',requireAuthenticated,requireAdministrator,(_req,res)=>res.status(410).json({error:'A sessão temporária legada foi desativada. Configure a Asten uma vez e use o botão do documento.',code:'LEGACY_ASTEN_SESSION_DISABLED'}));
  app.post('/api/integrations/asten/connect',requireAuthenticated,requireAdministrator,async(req,res)=>{
    const identity=getPortalIdentity(req)!;if(!hasRecentAuthentication(identity))return res.status(428).json({error:'Entre novamente antes de alterar a integração Asten.'});
    try{const result=await connectPersistentAsten(String(req.body?.token||''));auditLogsStore.push({id:`log-${Date.now()}`,actorEmail:identity.email,actorRoles:getUserRolesForEmail(identity.email).globalRoles,action:'CONEXAO_ASTEN',entityType:'integration',entityId:'asten',after:{identifier:result.identifier,repositoryId:result.repositoryId},timestamp:new Date().toISOString()});persistPortalState();res.json(await getPersistentAstenStatus());}catch(error){res.status(400).json({error:error instanceof Error?error.message:'Não foi possível conectar a conta Asten.'});}
  });
  app.get('/api/signatures/jobs',requireAuthenticated,requireAdministrator,(_req,res)=>res.json(signatureJobsStore.slice().reverse().map(publicSignatureJob)));
  app.get('/api/admin/asten/dashboard',requireAuthenticated,requireAdministrator,(_req,res)=>res.json(buildAstenOperationalDashboard({jobs:signatureJobsStore,events:astenWebhookEventsStore})));
  app.get('/api/admin/email-deliveries',requireAuthenticated,requireAdministrator,(req,res)=>{const status=String(req.query.status||'').toUpperCase();const rows=emailDeliveriesStore.slice().reverse().filter(item=>!status||item.status===status).map(item=>({...item,recipient:item.recipient.replace(/^(.{2}).*(@.*)$/,'$1***$2')}));res.json(rows);});
  app.post('/api/admin/email-deliveries/:id/retry',requireAuthenticated,requireAdministrator,async(req,res)=>{const identity=getPortalIdentity(req)!;const record=emailDeliveriesStore.find(item=>item.id===req.params.id);if(!record)return res.status(404).json({error:'Entrega não encontrada.'});if(record.status==='ACCEPTED_BY_GMAIL')return res.json(record);const process=record.processId?processesStore.find(item=>item.id===record.processId):undefined;if(!process)return res.status(409).json({error:'O processo associado não está disponível para reconstruir o e-mail.'});const template=(currentSettings.integrationStudio?.emailTemplates||[]).find(item=>String(item.id||item.templateId||'')===String(record.templateId||''));if(!template&&!record.renderedText)return res.status(409).json({error:'O conteúdo original deste e-mail não está disponível. Publique novamente o modelo no Estúdio.'});record.nextRetryAt=new Date().toISOString();record.maxAttempts=Math.min(10,Math.max(record.maxAttempts,record.attempts.length+1));const variables=buildProcessVariables({process,eventCode:record.workflowEventCode||'EMAIL_RETRY',actorEmail:identity.email,actorRoles:getActiveProcessRoles(identity.email,process.id),extraVariables:{...historicalStudioAnswers(process.id),...(record.workflowEventVariables||{})}});const text=record.renderedText||mergeWorkflowVariables(String(template?.body||template?.text||''),variables);const html=template?.htmlBody?mergeWorkflowHtmlVariables(String(template.htmlBody),variables):undefined;const attachments=template?await resolveWorkflowEmailAttachments(process,template):[];const retried=await sendTrackedPortalEmail({process,recipient:record.recipient,subject:record.subject,text,html,templateId:record.templateId,workflowEventCode:record.workflowEventCode,workflowEventVariables:record.workflowEventVariables,idempotencyKey:record.idempotencyKey,attachments});if(retried.status==='ACCEPTED_BY_GMAIL'&&record.workflowEventCode)await executeConfiguredWorkflowEvent(process,record.workflowEventCode,identity.email,record.workflowEventVariables);res.status(retried.status==='ACCEPTED_BY_GMAIL'?200:409).json(retried);});
  app.get('/api/admin/workflow/operations',requireAuthenticated,requireAdministrator,(_req,res)=>{res.setHeader('Cache-Control','private, no-store');res.json(workflowOperationsOverview());});
  app.post('/api/admin/workflow/maintenance',requireAuthenticated,requireAdministrator,async(req,res)=>{
    if(!hasRecentAuthentication(getPortalIdentity(req)!))return res.status(428).json({error:'Entre novamente antes de executar os lembretes publicados.'});
    try{res.json(await runWorkflowMaintenance());}catch(error){res.status(409).json({error:error instanceof Error?error.message:'Não foi possível executar a rotina.'});}
  });
  app.post('/api/admin/workflow/runs/:id/retry',requireAuthenticated,requireAdministrator,async(req,res)=>{
    const identity=getPortalIdentity(req)!;
    if(!hasRecentAuthentication(identity))return res.status(428).json({error:'Entre novamente antes de retomar o fluxo.'});
    const run=workflowRunsStore.find(item=>item.id===req.params.id);if(!run)return res.status(404).json({error:'Execução não encontrada.'});
    const portalProcess=processesStore.find(p=>p.id===run.processId);if(!portalProcess||portalProcess.status==='CONCLUIDO')return res.status(409).json({error:'Este processo não está disponível para retomada.'});
    const newer=workflowRunsStore.filter(item=>item.processId===run.processId&&item.eventCode===run.eventCode).sort((a,b)=>b.startedAt.localeCompare(a.startedAt))[0];
    if(newer?.id!==run.id||run.status==='COMPLETED')return res.status(409).json({error:'A execução mudou. Atualize a central antes de retomar.'});
    if(run.sourceDataRevision!==undefined&&run.sourceDataRevision!==portalProcess.dataRevision)return res.status(409).json({error:'Os dados do TCC mudaram desde esta falha. Revise a etapa no processo; a execução antiga foi preservada.'});
    const revision=currentSettings.integrationStudio?.revision;
    if(run.studioRevision!==revision&&req.body?.reviewedStudioRevision!==revision)return res.status(409).json({error:'O Estúdio mudou. Confira a nova revisão e confirme a retomada; ações já concluídas serão preservadas.'});
    if(signatureJobsStore.some(job=>job.processId===portalProcess.id&&['CREATING','UNCERTAIN'].includes(job.providerCreationState||'')&&!job.providerEnvelopeId))return res.status(409).json({error:'Confira primeiro o envelope Asten com resultado incerto. A retomada não pode criar outra assinatura.'});
    const native:Record<string,ProcessFormArchiveType>={TCC_CREATED:'CADASTRO_INICIAL',LOCATION_CONFIRMED:'CONFIRMACAO_LOCAL',EVALUATION_SUBMITTED:'AVALIACAO',REPOSITORY_SUBMITTED:'DADOS_FINAIS'};
    try{
      if(native[run.eventCode]){
        if(!formArchiveJobsStore.some(form=>form.processId===portalProcess.id&&form.formType===native[run.eventCode]&&form.status==='ARCHIVED'))return res.status(409).json({error:'Retome primeiro o arquivamento do formulário desta etapa.'});
        await resumeWorkflowAfterNativeFormArchive(portalProcess,native[run.eventCode],identity.email,run);
      }else await executeConfiguredWorkflowEvent(portalProcess,run.eventCode,identity.email,run.eventVariables,run);
      updateProcessCompletion(portalProcess.id);await persistPortalStateDurably();res.json(workflowOperationsOverview());
    }catch(error){res.status(409).json({error:error instanceof Error?error.message:'Falha na retomada.'});}
  });
  app.post('/api/admin/workflow/reminders/:id/retry',requireAuthenticated,requireAdministrator,async(req,res)=>{
    const identity=getPortalIdentity(req)!;if(!hasRecentAuthentication(identity))return res.status(428).json({error:'Entre novamente antes de tentar o lembrete.'});
    const claim=reminderRecordsStore.find(item=>item.id===req.params.id),studio=currentSettings.integrationStudio;
    if(!claim||!studio)return res.status(404).json({error:'Lembrete não encontrado.'});
    if(claim.status!=='FAILED')return res.status(409).json({error:'Somente uma falha revisada pode ser reenviada. Confira no Gmail envios com resultado incerto.'});
    const policy=workflowPolicy(studio);const plan=plannedDeadlines(processesStore,signatureJobsStore,policy,studio.operationsPolicy?.timezone||'America/Sao_Paulo').find(p=>p.processId===claim.processId&&p.rule.id===claim.policyId&&p.dueDate===claim.dueDate&&p.milestone===claim.milestone);
    if(!plan)return res.status(409).json({error:'O prazo mudou ou esta etapa já foi concluída. Preserve o registro histórico.'});
    try{
      const p=processesStore.find(p=>p.id===claim.processId)!;const mail=renderReminder(studio,p,plan.rule.emailTemplateId,plan.label,plan.dueDate,historicalStudioAnswers(p.id));
      if(!mail.to.includes(claim.recipient))return res.status(409).json({error:'O destinatário não pertence mais a este lembrete.'});
      const previousDelivery=emailDeliveriesStore.find(item=>item.idempotencyKey===`reminder:${claim.id}`);
      if(previousDelivery&&previousDelivery.status!=='ACCEPTED_BY_GMAIL'){previousDelivery.nextRetryAt=new Date().toISOString();previousDelivery.maxAttempts=Math.min(10,Math.max(previousDelivery.maxAttempts,previousDelivery.attempts.length+1));}
      claim.status='SENDING';await persistPortalStateDurably();
      const delivery=await sendTrackedPortalEmail({process:p,recipient:claim.recipient,subject:mail.subject,text:mail.text,html:mail.html,templateId:plan.rule.emailTemplateId,idempotencyKey:`reminder:${claim.id}`});
      claim.status=delivery.status==='ACCEPTED_BY_GMAIL'?'SENT':'FAILED';claim.sentAt=claim.status==='SENT'?new Date().toISOString():undefined;claim.error=delivery.attempts.at(-1)?.errorMessage;
      await persistPortalStateDurably();res.json(claim);
    }catch(error){res.status(409).json({error:error instanceof Error?error.message:'Confira o resultado do envio no Gmail antes de repetir.'});}
  });
  app.get('/api/admin/workflow-runs',requireAuthenticated,requireAdministrator,(_req,res)=>res.json(workflowRunsStore.slice().reverse()));
  app.get('/api/admin/form-archives',requireAuthenticated,requireAdministrator,(_req,res)=>res.json(formArchiveJobsStore.slice().reverse().map(({artifactBase64:_artifact,...item})=>item)));
  app.post('/api/admin/form-archives/:id/retry',requireAuthenticated,requireAdministrator,async(req,res)=>{const identity=getPortalIdentity(req)!;const job=formArchiveJobsStore.find(item=>item.id===req.params.id);if(!job)return res.status(404).json({error:'Arquivamento não encontrado.'});const process=processesStore.find(item=>item.id===job.processId);if(!process)return res.status(409).json({error:'O processo do formulário não está disponível.'});const updated=await archiveProcessFormSnapshot(process,job.formType);if(updated.status==='ARCHIVED')await resumeWorkflowAfterNativeFormArchive(process,updated.formType,identity.email);const{artifactBase64:_artifact,...safe}=updated;res.status(updated.status==='ARCHIVED'?200:409).json(safe);});
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
  app.post('/api/signatures/jobs/:id/retry',requireAuthenticated,requireAdministrator,async(req,res)=>{const identity=getPortalIdentity(req)!;if(!hasRecentAuthentication(identity))return res.status(428).json({error:'Entre novamente antes de repetir o envio.',code:'REAUTHENTICATION_REQUIRED'});const job=signatureJobsStore.find(item=>item.id===req.params.id);if(!job)return res.status(404).json({error:'Item não encontrado.'});await dispatchSignatureJobAutomatically(job);const failed=['PROVIDER_ERROR','WAITING_INTEGRATION','DRIVE_SYNC_PENDING'].includes(job.status);if(!failed){const process=processesStore.find(item=>item.id===job.processId);if(process){const eventCode:WorkflowEventCode=job.documentType==='ATA'?'EVALUATION_SUBMITTED':job.documentType==='DECLARACAO'?'PUBLICATION_CLEARED':'REPOSITORY_SUBMITTED';await executeConfiguredWorkflowEvent(process,eventCode,identity.email);}}res.status(failed?409:200).json(publicSignatureJob(job));});
  app.post('/api/signatures/jobs/generate',requireAuthenticated,requireAdministrator,(_req,res)=>res.status(410).json({error:'A geração em lote foi desativada. Use a ação do documento dentro do TCC.',code:'LEGACY_SIGNATURE_GENERATION_DISABLED'}));
  app.post('/api/signatures/jobs/:id/approve',requireAuthenticated,requireAdministrator,(_req,res)=>res.status(410).json({error:'A aprovação de buffer foi desativada. Use a ação do documento dentro do TCC.',code:'LEGACY_SIGNATURE_APPROVAL_DISABLED'}));
  app.post('/api/signatures/jobs/:id/dispatch',requireAuthenticated,requireAdministrativeOperator,(_req,res)=>res.status(410).json({error:'O disparo de buffer foi desativado. Use a ação do documento dentro do TCC.',code:'LEGACY_SIGNATURE_DISPATCH_DISABLED'}));
  app.post('/api/signatures/jobs/:id/reconcile',requireAuthenticated,requireAdministrativeOperator,async(req,res)=>{const job=signatureJobsStore.find(j=>j.id===req.params.id);if(!job?.providerEnvelopeId)return res.status(404).json({error:'Envelope não encontrado.'});try{if(job.status==='DRIVE_SYNC_PENDING'){await archiveSignatureJobAutomatically(job);return res.status((job as SignatureJob).status==='ARCHIVED'?200:409).json(publicSignatureJob(job));}const connection=await getPersistentAstenConnection();if(!connection)throw new Error('Conecte a conta Asten em Configurações.');const response=await callAsten('getDadosEnvelope',{idEnvelope:job.providerEnvelopeId,getLobs:'N'},connection.token);job.status=inferAstenJobStatus(response,job.status);job.updatedAt=new Date().toISOString();if(job.status==='SIGNED'){job.completedAt=job.updatedAt;await archiveSignatureJobAutomatically(job);}persistPortalState();res.json(publicSignatureJob(job));}catch(error){res.status(502).json({error:error instanceof Error?error.message:'Falha na reconciliação.'});}});
  app.post('/api/signatures/jobs/:id/archive',requireAuthenticated,requireAdministrator,(_req,res)=>res.status(410).json({error:'O arquivamento manual legado foi desativado; o callback Asten arquiva automaticamente no Drive.',code:'LEGACY_SIGNATURE_ARCHIVE_DISABLED'}));
  app.post('/api/integrations/asten/webhook',async(req,res)=>{
    if(!safeCompareWebhookSecret(String(req.headers['x-portal-webhook-key']||'')))return res.status(401).json({error:'Callback não autorizado.'});
    const event=normalizeAstenWebhookEvent({payload:req.body,knownFingerprints:astenCallbackFingerprints,jobs:signatureJobsStore});astenWebhookEventsStore.push(event);
    if(event.duplicate)return res.status(200).json({received:true,duplicate:true});
    astenCallbackFingerprints.add(event.fingerprint);
    const job=event.matchedJobId?signatureJobsStore.find(item=>item.id===event.matchedJobId):undefined;
    if(job){
      const proposedStatus=mapAstenEventToJobStatus(event.status,job.status);job.updatedAt=event.receivedAt;
      try{
        const connection=await getPersistentAstenConnection();if(!connection||!job.providerEnvelopeId)throw new Error('Conexão Asten ou envelope indisponível para confirmação.');
        const providerState=await callAsten('getDadosEnvelope',{idEnvelope:job.providerEnvelopeId,getLobs:'N'},connection.token);
        const verifiedStatus=inferAstenJobStatus(providerState,job.status);
        if(proposedStatus==='SIGNED'&&verifiedStatus!=='SIGNED')throw new Error('A Asten ainda não confirmou a conclusão de todos os signatários.');
        job.status=verifiedStatus;
        if(job.status==='SIGNED'){job.completedAt=job.updatedAt;await archiveSignatureJobAutomatically(job);}
        else job.lastError=undefined;
      }catch(error){job.lastError=`Callback recebido, aguardando reconciliação com a Asten: ${error instanceof Error?error.message:'falha de confirmação'}`;}
      auditLogsStore.push({id:`log-${Date.now()}`,processId:job.processId,actorEmail:'webhook@asten.local',actorRoles:[],action:'CALLBACK_ASTEN_RECEBIDO',entityType:'signature_job',entityId:job.id,after:{envelopeId:event.envelopeId,status:job.status,callbackFingerprint:event.fingerprint,providerVerified:job.status==='SIGNED'||job.status==='ARCHIVED'},timestamp:job.updatedAt});
    }
    persistPortalState();res.status(200).json({received:true,matched:Boolean(job)});
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
    const tag = inner.replace(/<[^>]*>/g, '').trim().replace(/\s+/g, ' ');
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
    let cleanText = rawContent
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<!--[\s\S]*?-->/g, '');

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

    // 3. Pattern for << ... >>
    const doubleBracketRegex = /<<([\s\S]*?)>>/g;
    let match: RegExpExecArray | null;

    while ((match = doubleBracketRegex.exec(cleanText)) !== null) {
      let inner = match[1];
      inner = inner.replace(/<[^>]*>/g, '').trim().replace(/\s+/g, ' ');
      if (isValidDocTag(inner)) {
        tagsSet.add(`<<${inner}>>`);
      }
    }

    // 4. Pattern for {{ ... }} (Double Curly Braces)
    const doubleCurlyRegex = /\{\{([\s\S]*?)\}\}/g;
    while ((match = doubleCurlyRegex.exec(cleanText)) !== null) {
      let inner = match[1];
      inner = inner.replace(/<[^>]*>/g, '').trim().replace(/\s+/g, ' ');
      if (isValidDocTag(inner)) {
        tagsSet.add(`<<${inner}>>`);
      }
    }

    // 5. Pattern for [[ ... ]] (Double Square Braces)
    const doubleSquareRegex = /\[\[([\s\S]*?)\]\]/g;
    while ((match = doubleSquareRegex.exec(cleanText)) !== null) {
      let inner = match[1];
      inner = inner.replace(/<[^>]*>/g, '').trim().replace(/\s+/g, ' ');
      if (isValidDocTag(inner)) {
        tagsSet.add(`<<${inner}>>`);
      }
    }

    // 6. Pattern for « ... »
    const guillemetRegex = /«([\s\S]*?)»/g;
    while ((match = guillemetRegex.exec(cleanText)) !== null) {
      let inner = match[1];
      inner = inner.replace(/<[^>]*>/g, '').trim().replace(/\s+/g, ' ');
      if (isValidDocTag(inner)) {
        tagsSet.add(`<<${inner}>>`);
      }
    }

    // 7. Pattern for < ... > (Single angle brackets)
    const htmlTagNames = /^(p|span|div|br|b|i|u|strong|em|a|img|h[1-6]|table|tr|td|th|tbody|thead|tfoot|ul|ol|li|font|xml|code|pre|hr|blockquote|canvas)$/i;
    const singleBracketRegex = /<([a-zA-Z0-9\u00C0-\u024F\s_()#-]+)>/g;
    while ((match = singleBracketRegex.exec(cleanText)) !== null) {
      let inner = match[1].trim();
      inner = inner.replace(/<[^>]*>/g, '').trim().replace(/\s+/g, ' ');
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
      const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/) || url.match(/id=([a-zA-Z0-9_-]+)/);
      const docId = match ? match[1] : (url.trim().length > 20 && !url.includes('/') ? url.trim() : null);

      if (docId) {
        // 1. If OAuth accessToken is provided, call Google Docs API v1 first
        if (accessToken) {
          try {
            const gdocRes = await fetch(`https://docs.googleapis.com/v1/documents/${docId}`, {
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
              const driveRes = await fetch(`https://www.googleapis.com/drive/v3/files/${docId}/export?mimeType=text/plain`, {
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
              const mediaRes = await fetch(`https://www.googleapis.com/drive/v3/files/${docId}?alt=media`, {
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
    let accessToken='';try{accessToken=await getGoogleWorkspaceAccessToken();}catch(error){return res.status(409).json({error:error instanceof Error?error.message:'Autorize o Google Workspace antes de varrer modelos.',files:[]});}

    if (!folderUrl || typeof folderUrl !== 'string') {
      return res.status(400).json({ error: 'Folder URL is required', files: [] });
    }

    const match = folderUrl.match(/\/folders\/([a-zA-Z0-9_-]+)/) || folderUrl.match(/id=([a-zA-Z0-9_-]+)/);
    const folderId = match ? match[1] : (folderUrl.trim().length >= 15 && !folderUrl.includes('/') ? folderUrl.trim() : null);

    if (!folderId) {
      return res.status(400).json({ error: 'Invalid Google Drive folder ID', files: [] });
    }

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

    // Public web scrape fallback if no access token or API returned 0 files
    if (files.length === 0) {
      try {
        const publicUrl = `https://drive.google.com/drive/folders/${folderId}`;
        const pageRes = await fetch(publicUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
          }
        });
        if (pageRes.ok) {
          const html = await pageRes.text();
          // Match document or file IDs
          const docMatches = html.match(/\/document\/d\/([a-zA-Z0-9_-]+)/g) || html.match(/\/file\/d\/([a-zA-Z0-9_-]+)/g);
          if (docMatches) {
            const uniqueIds = Array.from(new Set(docMatches.map(m => m.split('/d/')[1])));
            uniqueIds.forEach(id => {
              if (id && id !== folderId) {
                files.push({
                  id,
                  name: `Modelo Google Drive (${id.substring(0, 6)})`,
                  driveFileUrl: `https://docs.google.com/document/d/${id}/edit`
                });
              }
            });
          }
        }
      } catch (e) {
        console.error('[ScanFolder] Public scrape exception:', e);
      }
    }

    res.json({ folderId, files });
  });

  // GET /api/admin/audit-logs
  app.get('/api/admin/audit-logs', requireAuthenticated, requireAdministrator, (req, res) => {
    const query=String(req.query.q||req.query.search||'').trim().toLocaleLowerCase('pt-BR');
    const rows=auditLogsStore.slice().reverse().map(log=>{
      const process=log.processId?processesStore.find(item=>item.id===log.processId):undefined;
      const searchContext=process?`${process.protocolo} ${process.titulo} ${process.aluno1.nome} ${process.aluno2?.nome||''}`.trim():'';
      return {...log,searchContext};
    }).filter(log=>!query||JSON.stringify(log).toLocaleLowerCase('pt-BR').includes(query));
    res.json(redactSensitiveValues(rows));
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
    res.json(googleCalendarEventsStore);
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
    if(!hasRecentAuthentication(identity))return res.status(428).json({error:'Entre novamente antes de restaurar uma versão histórica.',code:'REAUTHENTICATION_REQUIRED'});

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
    const backup={schemaVersion:3,title:'Backup administrativo do Portal de TCC',exportedAt,settings:publicSettingsForRequest(true),processes:processesStore,authorizedStudents:authorizedStudentsStore,memberships:membershipsStore,notificationPreferences:notificationPreferencesStore,dataSubjectRequests:dataSubjectRequestsStore,legalHolds:legalHoldsStore,studioVersions:studioVersionsStore};
    const checksum=createHash('sha256').update(JSON.stringify(backup)).digest('hex');
    auditLogsStore.push({id:`log-${Date.now()}`,actorEmail:identity.email,actorRoles:getUserRolesForEmail(identity.email).globalRoles,action:'EXPORTACAO_BACKUP_ADMINISTRATIVO',entityType:'system_backup',entityId:checksum,after:{schemaVersion:3,processCount:processesStore.length},timestamp:exportedAt});
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
    const { settings, processes, authorizedStudents, notificationPreferences, dataSubjectRequests, legalHolds, studioVersions, confirmHash } = req.body||{};
    if(!settings||typeof settings!=='object'||Array.isArray(settings)||!Array.isArray(processes))return res.status(400).json({error:'Backup inválido: configurações e processos são obrigatórios.'});
    if(containsSensitiveConfigurationKey(settings))return res.status(400).json({error:'O backup contém campos de segredo e não pode ser restaurado.'});
    if(processes.length>10_000||processes.some((process:any)=>!process||typeof process!=='object'||!String(process.id||'').trim()||!String(process.protocolo||'').trim()||!String(process.titulo||'').trim()))return res.status(400).json({error:'Backup inválido: coleção de processos fora do formato esperado.'});
    const ids=processes.map((process:any)=>String(process.id));const protocols=processes.map((process:any)=>String(process.protocolo));
    if(new Set(ids).size!==ids.length||new Set(protocols).size!==protocols.length)return res.status(400).json({error:'Backup inválido: processos ou protocolos duplicados.'});
    const safeSettings={...redactSensitiveValues(settings),masterEmail:currentSettings.masterEmail,ownerEmail:currentSettings.ownerEmail,commissionPresidentEmail:currentSettings.commissionPresidentEmail,masterRecoveryEmails:currentSettings.masterRecoveryEmails,sessionValidAfter:currentSettings.sessionValidAfter,driveRootFolderId:currentSettings.driveRootFolderId,calendarId:currentSettings.calendarId,documentModels:currentSettings.documentModels};
    const safeProcesses=processes.map((process:any)=>preserveCurrentDriveBindings(process,processesStore.find(current=>current.id===String(process.id))));
    const restorePayload={schemaVersion:Number(req.body?.schemaVersion||1),settings:safeSettings,processes:safeProcesses,authorizedStudents:Array.isArray(authorizedStudents)?authorizedStudents:authorizedStudentsStore,notificationPreferences:notificationPreferences&&typeof notificationPreferences==='object'&&!Array.isArray(notificationPreferences)?notificationPreferences:{},dataSubjectRequests:Array.isArray(dataSubjectRequests)?dataSubjectRequests:[],legalHolds:Array.isArray(legalHolds)?legalHolds:[],studioVersions:Array.isArray(studioVersions)?studioVersions:[]};
    const expectedHash=createHash('sha256').update(JSON.stringify(restorePayload)).digest('hex');
    if(String(confirmHash||'')!==expectedHash)return res.json({requiresConfirmation:true,confirmHash:expectedHash,summary:{processCount:processes.length,authorizedCount:restorePayload.authorizedStudents.length,administratorsPreserved:true,auditTrailPreserved:true}});

    currentSettings={...INITIAL_SETTINGS,...safeSettings,updatedAt:new Date().toISOString()};
    processesStore=JSON.parse(JSON.stringify(safeProcesses));
    authorizedStudentsStore=JSON.parse(JSON.stringify(restorePayload.authorizedStudents));
    notificationPreferencesStore=JSON.parse(JSON.stringify(restorePayload.notificationPreferences));
    dataSubjectRequestsStore=JSON.parse(JSON.stringify(restorePayload.dataSubjectRequests));
    legalHoldsStore=JSON.parse(JSON.stringify(restorePayload.legalHolds));
    studioVersionsStore=JSON.parse(JSON.stringify(restorePayload.studioVersions)).slice(-30);
    membershipsStore=[];for(const process of processesStore)synchronizeProcessParticipants(process,actorEmail);
    signatureJobsStore=[];formArchiveJobsStore=[];emailDeliveriesStore=[];workflowRunsStore=[];astenWebhookEventsStore=[];

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
    res.json({ message: 'Backup restaurado com validação. Papéis administrativos e auditoria anterior foram preservados.', processCount: processesStore.length });
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
    try{await verifyPortalOtp({email:normRecovery,code:String(verificationCode)});}catch{return res.status(403).json({error:'Código de recuperação inválido ou expirado.'});}

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
    if(process.env.NODE_ENV==='production')return res.status(404).json({error:'Rota de demonstração desativada em produção.'});
    processesStore = JSON.parse(JSON.stringify(DEMO_PROCESSES));
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
    const port=Number(process.env.PORT||3000);
    app.listen(port,'0.0.0.0',()=>console.log(`[Portal TCC] Server listening on http://0.0.0.0:${port}`));
  }).catch((error)=>{console.error('[Portal TCC] Falha ao iniciar:',error);process.exitCode=1;});
}
