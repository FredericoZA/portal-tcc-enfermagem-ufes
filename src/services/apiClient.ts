import { ProcessData, GlobalSettings, AuditLog, DocumentCorrectionRequest, GoogleCalendarSyncedEvent, SignatureJob, AstenIntegrationStatus, ContinuousIntelligenceOverview, ImprovementStatus, LivingPortalArtifactKind } from '../types';
import type { IntegrationStudioSettings } from '../types/integrationStudio';
import {
  fileToLegacyBase64,
  mayUseLegacyDevelopmentUpload,
  sha256File,
  StagedUploadDescriptor,
  StagedUploadTicket,
  uploadBinaryToSignedUrl
} from './secureStagedUpload';
let activeUserEmail = '';
type WorkflowProcessResponse = ProcessData & { workflowPending?: boolean; workflowError?: string };

export class ApiRequestError extends Error {
  constructor(message: string, readonly status: number, readonly code?: string, readonly issues?: Record<string, string>) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

export function setActiveUserEmail(email: string) {
  activeUserEmail = email;
  if (typeof localStorage !== 'undefined') localStorage.setItem('portal_tcc_active_email', email);
}

export function getActiveUserEmail(): string {
  return (typeof localStorage !== 'undefined' ? localStorage.getItem('portal_tcc_active_email') : '') || activeUserEmail;
}

async function fetchApi<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string,string> = {
    'Content-Type': 'application/json',
    ...((options.headers || {}) as Record<string,string>)
  };
  if((import.meta as any).env?.DEV&&getActiveUserEmail())headers['x-demo-user-email']=getActiveUserEmail();

  const response = await fetch(endpoint, {
    ...options,
    headers,
    credentials: 'include'
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new ApiRequestError(errorData.error || `Erro HTTP ${response.status}`, response.status, errorData.code, errorData.issues);
  }

  return response.json();
}

async function downloadApiFile(endpoint: string): Promise<{ blob: Blob; fileName: string }> {
  const headers: Record<string, string> = {};
  if ((import.meta as any).env?.DEV && getActiveUserEmail()) {
    headers['x-demo-user-email'] = getActiveUserEmail();
  }

  const response = await fetch(endpoint, { headers, credentials: 'include' });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Erro HTTP ${response.status}`);
  }

  const disposition = response.headers.get('content-disposition') || '';
  const encodedName = disposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  const plainName = disposition.match(/filename="?([^";]+)"?/i)?.[1];
  const fileName = encodedName
    ? decodeURIComponent(encodedName)
    : plainName || 'documento-assinado.pdf';

  return { blob: await response.blob(), fileName };
}

export async function getApiAuthHeaders():Promise<Record<string,string>>{if((import.meta as any).env?.DEV&&getActiveUserEmail())return{'x-demo-user-email':getActiveUserEmail()};return{};}

async function createStagedUpload(descriptor: StagedUploadDescriptor): Promise<StagedUploadTicket> {
  return fetchApi<StagedUploadTicket>('/api/uploads/staging', {
    method: 'POST',
    body: JSON.stringify(descriptor)
  });
}

async function stageFile(file: File, descriptor: Omit<StagedUploadDescriptor, 'fileName' | 'size' | 'mimeType' | 'sha256'>): Promise<{uploadId:string;sha256:string}> {
  const sha256 = await sha256File(file);
  const ticket = await createStagedUpload({
    ...descriptor,
    fileName: file.name,
    size: file.size,
    mimeType: file.type.toLowerCase(),
    sha256
  });
  await uploadBinaryToSignedUrl(file, ticket);
  return { uploadId: ticket.uploadId, sha256 };
}

async function withDevelopmentFallback<T>(file:File, operation:()=>Promise<T>, fallback:()=>Promise<T>):Promise<T>{
  try{return await operation();}catch(error){
    const status=error instanceof ApiRequestError?error.status:0;
    if(!mayUseLegacyDevelopmentUpload(status,file.size,Boolean((import.meta as any).env?.DEV)))throw error;
    return fallback();
  }
}

export const apiClient = {
  getRegistrationDraft:()=>fetchApi<import('../types/workflowOperations').RegistrationDraft|null>('/api/registration/draft'),
  saveRegistrationDraft:(data:unknown)=>fetchApi<import('../types/workflowOperations').RegistrationDraft>('/api/registration/draft',{method:'PUT',body:JSON.stringify(data)}),
  deleteRegistrationDraft:()=>fetchApi<{deleted:boolean}>('/api/registration/draft',{method:'DELETE'}),
  getMe: () => fetchApi<{ userEmail: string; globalRoles: any[]; memberships: any[]; isAuthenticated: boolean }>('/api/me'),
  getAuthStatus:()=>fetchApi<{otp:{configured:boolean};google:{oauthConfigured:boolean;connected:boolean};bootstrapMasterConfigured:boolean}>('/api/setup/status'),
  requestLoginCode:(email:string)=>fetchApi<{sent:boolean;expiresInMinutes:number;message:string}>('/api/auth/request-code',{method:'POST',body:JSON.stringify({email})}),
  verifyLoginCode:(email:string,code:string)=>fetchApi<any>('/api/auth/verify-code',{method:'POST',body:JSON.stringify({email,code})}),
  logout:()=>fetchApi<{signedOut:boolean}>('/api/auth/logout',{method:'POST'}),
  getSettings: () => fetchApi<GlobalSettings>('/api/settings'),
  updateSettings: (settings: Partial<GlobalSettings>) => fetchApi<GlobalSettings>('/api/admin/settings', {
    method: 'PATCH',
    body: JSON.stringify(settings)
  }),
  updateDriveRootFolder:(folderId:string)=>fetchApi<{folderId:string}>('/api/admin/drive-root',{method:'POST',body:JSON.stringify({folderId})}),
  getProcesses: () => fetchApi<ProcessData[]>('/api/processes'),
  getProcessById: (id: string) => fetchApi<ProcessData>(`/api/processes/${id}`),
  getRegistrationSchema:()=>fetchApi<Partial<import('../types/integrationStudio').IntegrationStudioSettings>>('/api/forms/registration-schema'),
  createProcess: (data: any) => fetchApi<WorkflowProcessResponse>('/api/processes', {
    method: 'POST',
    body: JSON.stringify(data)
  }),
  updateProcess: (id: string, data: Partial<ProcessData>) => fetchApi<ProcessData>(`/api/processes/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data)
  }),
  getStudioForm:(processId:string,formId:string)=>fetchApi<any>(`/api/processes/${processId}/forms/${formId}`),
  getStudioForms:(processId:string)=>fetchApi<any[]>(`/api/processes/${processId}/forms`),
  submitStudioForm:(processId:string,formId:string,answers:Record<string,unknown>,expectedFormRevision:number)=>fetchApi<import('../types/courseOperations').StudioFormSubmission>(`/api/processes/${processId}/forms/${formId}/submissions`,{method:'POST',body:JSON.stringify({answers,expectedFormRevision})}),
  getStudioFormSubmissions:(processId:string)=>fetchApi<any[]>(`/api/processes/${processId}/form-submissions`),
  deleteProcess: (id: string) => fetchApi<{ message: string }>(`/api/processes/${id}`, {
    method: 'DELETE'
  }),
  getEvaluationSchema: (id: string) => fetchApi<{ studio: Partial<IntegrationStudioSettings>; outcomes: GlobalSettings['evaluationOutcomeOptions'] }>(`/api/processes/${id}/evaluation/schema`),
  submitEvaluation: (id: string, data: { resultadoCode: string; parecer: string; answers?: Record<string, string | number | boolean>; dataConfirmed: true; expectedDataRevision: number; expectedSchemaRevision: number }) => fetchApi<ProcessData & { workflowPending?: boolean; workflowError?: string }>(`/api/processes/${id}/evaluation`, {
    method: 'POST',
    body: JSON.stringify(data)
  }),
  reopenEvaluation: (id: string, reason: string) => fetchApi<ProcessData>(`/api/processes/${id}/reopen`, {
    method: 'POST', body: JSON.stringify({ reason })
  }),
  getProcessDocuments: (id: string) => fetchApi<any[]>(`/api/processes/${id}/documents`),
  downloadProcessDocument: (id: string, documentId: string) =>
    downloadApiFile(`/api/processes/${id}/documents/${documentId}/download`),
  getProcessSignatureJobs:(id:string)=>fetchApi<SignatureJob[]>(`/api/processes/${id}/signatures`),
  signProcessDocument:(id:string,type:string,provider:'ASTEN'|'GOV_BR'='ASTEN')=>fetchApi<{job:SignatureJob;message:string}>(`/api/processes/${id}/documents/${type}/sign`,{method:'POST',body:JSON.stringify({provider})}),
  downloadGovBrSigningPdf:(jobId:string)=>downloadApiFile(`/api/signatures/jobs/${encodeURIComponent(jobId)}/govbr/download`),
  uploadGovBrSignedPdf:async(jobId:string,processId:string,file:File)=>{const staged=await stageFile(file,{purpose:'GOV_BR_SIGNED_PDF',processId});return fetchApi<SignatureJob>(`/api/signatures/jobs/${encodeURIComponent(jobId)}/govbr/complete`,{method:'POST',body:JSON.stringify({stagedUploadId:staged.uploadId})});},
  requestCorrection: (id: string, docId: string, data: { description: string }) => fetchApi<DocumentCorrectionRequest>(`/api/processes/${id}/documents/${docId}/correction-request`, {
    method: 'POST',
    body: JSON.stringify(data)
  }),
  getCoordinatorQueue: () => fetchApi<any[]>('/api/coordinator/signature-queue'),
  uploadSignedDocument: (processId: string, fileName: string) => fetchApi<any>('/api/coordinator/upload-signed', {
    method: 'POST',
    body: JSON.stringify({ processId, fileName })
  }),
  getAstenStatus:()=>fetchApi<AstenIntegrationStatus>('/api/integrations/asten/status'),
  getInfrastructureStatus:()=>fetchApi<any>('/api/integrations/status'),
  testSupabaseConnection:()=>fetchApi<{configured:boolean;connected:boolean;durablePersistenceReady:boolean;normalizedSchemaReady:boolean;transactionalRuntimeReady:boolean;keyMode:string;message:string}>('/api/integrations/supabase/test',{method:'POST'}),
  syncGoogleWorkspaceCalendar:()=>fetchApi<{calendarId:string;created:number;events:GoogleCalendarSyncedEvent[]}>('/api/integrations/google/calendar/sync',{method:'POST'}),
  applyGoogleDocDesign:(documentId:string,options:any)=>fetchApi<{styledVariables:number;headerUpdated:boolean;footerUpdated:boolean}>(`/api/admin/google/docs/${encodeURIComponent(documentId)}/design`,{method:'POST',body:JSON.stringify(options)}),
  runInfrastructureHomologation:()=>fetchApi<{id:string;executedAt:string;executedBy:string;readyForProduction:boolean;checks:Array<{id:string;label:string;status:'PASS'|'FAIL'|'PENDING';message:string}>}>('/api/integrations/homologation',{method:'POST'}),
  getAstenDashboard:()=>fetchApi<any>('/api/admin/asten/dashboard'),
  getEmailDeliveries:()=>fetchApi<any[]>('/api/admin/email-deliveries'),
  retryEmailDelivery:(id:string)=>fetchApi<any>(`/api/admin/email-deliveries/${encodeURIComponent(id)}/retry`,{method:'POST'}),
  getWorkflowRuns:()=>fetchApi<any[]>('/api/admin/workflow-runs'),
  getNotificationPreferences:()=>fetchApi<any>('/api/notification-preferences'),
  updateNotificationPreferences:(data:any)=>fetchApi<any>('/api/notification-preferences',{method:'PATCH',body:JSON.stringify(data)}),
  getNotifications:()=>fetchApi<any[]>('/api/notifications'),
  validateCourseStudio:(studio?:any)=>fetchApi<any>('/api/admin/studio/validate',{method:'POST',body:JSON.stringify({studio})}),
  getStudioVersions:()=>fetchApi<any[]>('/api/admin/studio/versions'),
  compareStudioVersion:(revision:number)=>fetchApi<any>(`/api/admin/studio/versions/${revision}/compare`),
  restoreStudioVersion:(revision:number)=>fetchApi<any>(`/api/admin/studio/versions/${revision}/restore`,{method:'POST'}),
  runBackupDrill:()=>fetchApi<any>('/api/admin/backup/drill',{method:'POST'}),
  getRetentionPreview:()=>fetchApi<any>('/api/admin/retention/preview'),
  getLegalHolds:()=>fetchApi<any[]>('/api/admin/legal-holds'),
  createLegalHold:(processId:string,reason:string)=>fetchApi<any>('/api/admin/legal-holds',{method:'POST',body:JSON.stringify({processId,reason})}),
  releaseLegalHold:(id:string)=>fetchApi<any>(`/api/admin/legal-holds/${id}/release`,{method:'POST'}),
  getPrivacyRequests:()=>fetchApi<any[]>('/api/privacy/requests'),
  createPrivacyRequest:(data:any)=>fetchApi<any>('/api/privacy/requests',{method:'POST',body:JSON.stringify(data)}),
  updatePrivacyRequest:(id:string,data:any)=>fetchApi<any>(`/api/admin/privacy/requests/${id}`,{method:'PATCH',body:JSON.stringify(data)}),
  getOperationalHealth:()=>fetchApi<any>('/api/admin/health'),
  runDriveIntegrityCheck:()=>fetchApi<any>('/api/admin/integrity/drive',{method:'POST'}),
  getFormArchives:()=>fetchApi<any[]>('/api/admin/form-archives'),
  retryFormArchive:(id:string)=>fetchApi<any>(`/api/admin/form-archives/${encodeURIComponent(id)}/retry`,{method:'POST'}),
  connectAsten:(token:string)=>fetchApi<AstenIntegrationStatus>('/api/integrations/asten/connect',{method:'POST',body:JSON.stringify({token})}),
  getSignatureJobs:()=>fetchApi<SignatureJob[]>('/api/signatures/jobs'),
  retrySignatureJob:(id:string)=>fetchApi<SignatureJob>(`/api/signatures/jobs/${id}/retry`,{method:'POST'}),
  getAuthorizedStudents:()=>fetchApi<any[]>('/api/admin/access-list'),
  addAuthorizedStudent:(data:{nome:string;email:string;matricula?:string;role?:'STUDENT'|'ADVISOR'|'CO_ADVISOR'|'EXAMINER';memberType?:'INTERNAL'|'EXTERNAL'})=>fetchApi<any>('/api/admin/access-list',{method:'POST',body:JSON.stringify(data)}),
  updateAuthorizedStudent:(id:string,data:any)=>fetchApi<any>(`/api/admin/access-list/${id}`,{method:'PATCH',body:JSON.stringify(data)}),
  deleteAuthorizedStudent:(id:string)=>fetchApi<{deleted:boolean}>(`/api/admin/access-list/${id}`,{method:'DELETE'}),
  importAuthorizedStudents:(records:Array<{nome:string;email:string;matricula?:string}>)=>fetchApi<{batchHash:string;created:number;updated:number;preservedRevocations:number;reused:boolean}>('/api/admin/access-list/import',{method:'POST',body:JSON.stringify({records})}),
  getInstallationProfile:()=>fetchApi<any>('/api/admin/installation-profile'),
  updateInstallationProfile:(profile:any,expectedUpdatedAt?:string)=>fetchApi<any>('/api/admin/installation-profile',{method:'PATCH',body:JSON.stringify({profile,expectedUpdatedAt})}),
  getAcademicCycles:()=>fetchApi<any[]>('/api/admin/academic-cycles'),
  createAcademicCycle:(data:any)=>fetchApi<any>('/api/admin/academic-cycles',{method:'POST',body:JSON.stringify(data)}),
  updateAcademicCycle:(id:string,data:any)=>fetchApi<any>(`/api/admin/academic-cycles/${encodeURIComponent(id)}`,{method:'PATCH',body:JSON.stringify(data)}),
  getFeatureFlags:()=>fetchApi<any[]>('/api/admin/feature-flags'),
  updateFeatureFlag:(key:string,data:any)=>fetchApi<any>(`/api/admin/feature-flags/${encodeURIComponent(key)}`,{method:'PATCH',body:JSON.stringify(data)}),
  checkDefenseConflicts:(data:any)=>fetchApi<{conflicts:any[]}>('/api/processes/defense-conflicts/check',{method:'POST',body:JSON.stringify(data)}),
  respondCoauthorInvitation:(id:string,decision:'ACCEPT'|'REJECT')=>fetchApi<ProcessData>(`/api/processes/${id}/coauthor-acceptance`,{method:'POST',body:JSON.stringify({decision})}),
  getAdministrationTransfers:()=>fetchApi<any[]>('/api/admin/administration-transfers'),
  getMyPendingAdministrationTransfers:()=>fetchApi<any[]>('/api/administration-transfers/pending'),
  createAdministrationTransfer:(role:'MASTER_ADMIN'|'COMMISSION_PRESIDENT',targetEmail:string)=>fetchApi<any>('/api/admin/administration-transfers',{method:'POST',body:JSON.stringify({role,targetEmail})}),
  acceptAdministrationTransfer:(id:string)=>fetchApi<any>(`/api/admin/administration-transfers/${encodeURIComponent(id)}/accept`,{method:'POST'}),
  cancelAdministrationTransfer:(id:string)=>fetchApi<any>(`/api/admin/administration-transfers/${encodeURIComponent(id)}/cancel`,{method:'POST'}),
  updateRecoveryEmails:(emails:string[])=>fetchApi<GlobalSettings>('/api/admin/recovery-emails',{method:'PATCH',body:JSON.stringify({emails})}),
  getAdminMetrics:(cycleId?:string)=>fetchApi<any>(`/api/admin/metrics${cycleId?`?cycleId=${encodeURIComponent(cycleId)}`:''}`),
  getAdvancedAnalytics:(period='',compare='')=>fetchApi<any>(`/api/admin/analytics/advanced?${new URLSearchParams({period,compare})}`),
  downloadAdvancedAnalytics:(format:'csv'|'pdf',period='',compare='')=>downloadApiFile(`/api/admin/analytics/advanced?${new URLSearchParams({format,period,compare})}`),
  simulateWorkflow:(studio: unknown,scenario: unknown)=>fetchApi<any>('/api/admin/workflow/simulate',{method:'POST',body:JSON.stringify({studio,scenario})}),
  getContinuousIntelligence:()=>fetchApi<ContinuousIntelligenceOverview>('/api/admin/continuous-intelligence'),
  refreshContinuousIntelligence:()=>fetchApi<ContinuousIntelligenceOverview>('/api/admin/continuous-intelligence/refresh',{method:'POST'}),
  updateImprovementProposal:(id:string,status:ImprovementStatus,reviewNote?:string)=>fetchApi<ContinuousIntelligenceOverview>(`/api/admin/continuous-intelligence/proposals/${encodeURIComponent(id)}`,{method:'PATCH',body:JSON.stringify({status,reviewNote})}),
  downloadContinuousIntelligenceFile:(kind:LivingPortalArtifactKind)=>downloadApiFile(`/api/admin/continuous-intelligence/files/${encodeURIComponent(kind)}`),
  getProcessVerifications:(id:string)=>fetchApi<any[]>(`/api/processes/${id}/verifications`),
  getPublicVerification:(code:string)=>fetchApi<any>(`/api/public/verification/${encodeURIComponent(code)}`),
  checkVerificationPdfFile:(code:string,file:File)=>withDevelopmentFallback(file,async()=>{
    const staged=await stageFile(file,{purpose:'VERIFICATION_PDF',verificationCode:code});
    return fetchApi<any>(`/api/public/verification/${encodeURIComponent(code)}/check-file`,{method:'POST',body:JSON.stringify({stagedUploadId:staged.uploadId,sha256:staged.sha256})});
  },async()=>fetchApi<any>(`/api/public/verification/${encodeURIComponent(code)}/check-file`,{method:'POST',body:JSON.stringify({contentBase64:await fileToLegacyBase64(file,true)})})),
  downloadInstitutionalDossier:(id:string)=>downloadApiFile(`/api/admin/processes/${encodeURIComponent(id)}/dossier`),
  getDocumentModels:()=>fetchApi<Record<string,any>>('/api/admin/models'),
  uploadDocumentModelFile:(type:string,file:File)=>withDevelopmentFallback(file,async()=>{
    const staged=await stageFile(file,{purpose:'DOCUMENT_MODEL'});
    return fetchApi<any>(`/api/admin/models/${type}`,{method:'POST',body:JSON.stringify({fileName:file.name,stagedUploadId:staged.uploadId,sha256:staged.sha256,size:file.size,mimeType:file.type})});
  },async()=>fetchApi<any>(`/api/admin/models/${type}`,{method:'POST',body:JSON.stringify({fileName:file.name,contentBase64:await fileToLegacyBase64(file)})})),
  importDocumentModelFromDrive:(type:string,linkOrId:string)=>fetchApi<any>(`/api/admin/models/${type}/link`,{method:'POST',body:JSON.stringify({linkOrId})}),
  restoreDocumentModelVersion:(type:string,version:number)=>fetchApi<any>(`/api/admin/models/${type}/versions/${version}/restore`,{method:'POST'}),
  confirmDefenseLocation:(id:string,data:{local:string;confirmationReceived:boolean;localEvidenceUrl?:string})=>fetchApi<WorkflowProcessResponse>(`/api/processes/${id}/confirm-location`,{method:'POST',body:JSON.stringify(data)}),
  uploadLocationProof:async(id:string,file:File)=>{
    if(file.size>1024*1024)throw new Error('O comprovante deve ser um PDF de até 1 MB.');
    return fetchApi<import('../types/workflowOperations').LocationProof>(`/api/processes/${encodeURIComponent(id)}/location-proof`,{method:'POST',body:JSON.stringify({fileName:file.name,contentBase64:await fileToLegacyBase64(file)})});
  },
  downloadLocationProof:(id:string)=>downloadApiFile(`/api/processes/${encodeURIComponent(id)}/location-proof/download`),
  previewOfficialModel:(type:string,studio:unknown,answers:unknown)=>fetchApi<any>(`/api/admin/models/${encodeURIComponent(type)}/preview`,{method:'POST',body:JSON.stringify({studio,answers})}),
  compareStudioDraft:(studio:unknown,baseRevision?:number)=>fetchApi<any>('/api/admin/studio/compare',{method:'POST',body:JSON.stringify({studio,baseRevision})}),
  getWorkflowOperations:()=>fetchApi<any>('/api/admin/workflow/operations'),
  runWorkflowMaintenance:()=>fetchApi<any>('/api/admin/workflow/maintenance',{method:'POST'}),
  retryWorkflowOperation:(path:string,reviewedStudioRevision?:number)=>{
    if(!/^\/api\/(?:admin\/(?:workflow\/(?:runs|reminders)|email-deliveries|form-archives|studio-form-submissions)|signatures\/jobs)\/[^/]+\/(?:retry|reconcile)$/.test(path))throw new Error('Ação de recuperação inválida.');
    return fetchApi<any>(path,{method:'POST',body:JSON.stringify({reviewedStudioRevision})});
  },
  submitFinalData:(id:string,data:any)=>fetchApi<WorkflowProcessResponse>(`/api/processes/${id}/final-data`,{method:'POST',body:JSON.stringify(data)}),
  uploadProcessPdfFile:(id:string,kind:'trabalho-completo'|'resumo-expandido',file:File)=>withDevelopmentFallback(file,async()=>{
    const staged=await stageFile(file,{purpose:kind==='trabalho-completo'?'PROCESS_FULL_WORK':'PROCESS_EXPANDED_ABSTRACT',processId:id});
    return fetchApi<{id:string;fileName:string;downloadUrl:string;sha256:string}>(`/api/processes/${id}/files/${kind}`,{method:'POST',body:JSON.stringify({fileName:file.name,stagedUploadId:staged.uploadId,sha256:staged.sha256,size:file.size,mimeType:file.type})});
  },async()=>fetchApi<{id:string;fileName:string;downloadUrl:string;sha256:string}>(`/api/processes/${id}/files/${kind}`,{method:'POST',body:JSON.stringify({fileName:file.name,contentBase64:await fileToLegacyBase64(file)})})),
  getAuditLogs: () => fetchApi<AuditLog[]>('/api/admin/audit-logs'),
  rollbackAuditLog: (logId: string) => fetchApi<{ message: string; process?: ProcessData; settings?: GlobalSettings }>(`/api/admin/rollback-log/${logId}`, {
    method: 'POST'
  }),
  getFullBackup:()=>fetchApi<any>('/api/admin/backup'),
  restoreFullBackup: (data: any) => fetchApi<{ message?: string; requiresConfirmation?:boolean; confirmHash?:string; summary?:any }>(`/api/admin/restore-full-backup`, {
    method: 'POST',
    body: JSON.stringify(data)
  }),
  requestRecoveryCode:(email:string)=>fetchApi<{sent:boolean;message:string}>('/api/auth/request-recovery-code',{method:'POST',body:JSON.stringify({email})}),
  emergencyRecoverMaster: (data: { secretKey: string; recoveryEmail: string; verificationCode:string; newMasterEmail: string }) => fetchApi<{ success: boolean; message: string; newMasterEmail: string }>('/api/emergency-recover-master', {
    method: 'POST',
    body: JSON.stringify(data)
  }),
  getCorrectionRequests: () => fetchApi<DocumentCorrectionRequest[]>('/api/admin/correction-requests'),
  resolveCorrectionRequest: (id: string, status: string, note?: string) => fetchApi<any>(`/api/admin/correction-requests/${id}/resolve`, {
    method: 'POST',
    body: JSON.stringify({ status, resolutionNote: note })
  }),
  getGoogleCalendarEvents: () => fetchApi<GoogleCalendarSyncedEvent[]>('/api/calendar/events'),
  syncGoogleCalendarEvents: (events: any[]) => fetchApi<any>('/api/calendar/sync', {
    method: 'POST',
    body: JSON.stringify({ events })
  }),
  resetDemoData: () => fetchApi<any>('/api/demo/seed', { method: 'POST' })
};
