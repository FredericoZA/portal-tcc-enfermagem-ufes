import {withPortalOperation,requestOperationLabel} from './portalOperations';
import {waitForAuditLogRetry} from '../utils/auditLogPageState';
import { ProcessData, ProcessDocument, GlobalSettings, AuditLog, DocumentCorrectionRequest, GoogleCalendarSyncedEvent, SignatureJob, AstenIntegrationStatus } from '../types';
import type { IntegrationStudioSettings } from '../types/integrationStudio';
import type { WorkflowSimulationResult, WorkflowSimulationScenario, WorkflowTraceEntry } from '../types/automation';
import type { FeedbackEntry, FeedbackPage } from '../types/feedback';
import type {AstenDocumentFoldersStatus,AstenDocumentFolderType} from '../types/signatures';
import type { PresidencyQueueItem } from '../utils/coordinatorSignatureActions';
import { isLocalDemoFrontend } from '../utils/runtimeEnvironment';
import {verifyPublicPdfLocally,type PublicDocumentVerification} from '../utils/publicPdfVerification';
import {
  fileToLegacyBase64,
  mayUseLegacyDevelopmentUpload,
  sha256File,
  StagedUploadDescriptor,
  StagedUploadTicket,
  uploadBinaryToSignedUrl
} from './secureStagedUpload';
let activeUserEmail = '';
let activeIdentityRevision = 0;
// Share only simultaneous default JSON reads. There is no response cache: once
// a request settles, the next read goes back to the server for current data.
const pendingReads = new Map<string, Promise<unknown>>();
function invalidatePendingReads() { pendingReads.clear(); }
export const PORTAL_SESSION_EXPIRED_EVENT='portal:session-expired';
function reportExpiredSession(status:number,code:string|undefined,revision:number){
  if(revision===activeIdentityRevision&&status===401&&code==='AUTHENTICATION_REQUIRED'&&typeof window!=='undefined')window.dispatchEvent(new Event(PORTAL_SESSION_EXPIRED_EVENT));
}
type WorkflowProcessResponse = ProcessData & { workflowPending?: boolean; workflowProcessing?:boolean; workflowError?: string };
export interface RegistrationBootstrap {
  schema:Partial<IntegrationStudioSettings>&{applicantName?:string};
  draft:import('../types/workflowOperations').RegistrationDraft|null;
  hasExistingProcess:boolean;
}

// RUNTIME_BUSY with Retry-After is returned before the server runs the route.
async function requestAfterRuntimeBusy<T>(path:string,options:ApiRequestOptions={},retries=1):Promise<T>{
  const signal=options.signal||new AbortController().signal;
  const identityRevision=activeIdentityRevision;
  for(let attempt=0;;attempt++){
    if(signal.aborted||identityRevision!==activeIdentityRevision)throw new ApiRequestError('Consulta cancelada.',0,'REQUEST_CANCELED');
    try{
      const result=await fetchApi<T>(path,options);
      if(identityRevision!==activeIdentityRevision)throw new ApiRequestError('Consulta cancelada.',0,'REQUEST_CANCELED');
      return result;
    }catch(error){
      const seconds=error instanceof ApiRequestError?error.retryAfterSeconds:undefined;
      if(attempt>=retries||!(error instanceof ApiRequestError)||error.status!==503||error.code!=='RUNTIME_BUSY'||typeof seconds!=='number'||!Number.isFinite(seconds)||seconds<0||seconds>30)throw error;
      await waitForAuditLogRetry(signal,seconds*1000+100);
    }
  }
}

function getRegistrationBootstrap(options:Pick<ApiRequestOptions,'signal'>={}):Promise<RegistrationBootstrap>{
  return requestAfterRuntimeBusy<RegistrationBootstrap>('/api/registration/bootstrap',{signal:options.signal||new AbortController().signal});
}

export interface AtaReviewParagraph { alignment?:'START'|'CENTER'|'END'|'JUSTIFIED'; tabStops?:Array<{offset:number;alignment?:'START'|'CENTER'|'END'}>; runs:Array<{text:string;bold?:boolean;italic?:boolean;underline?:boolean;size?:number;font?:string}> }

export class ApiRequestError extends Error {
  constructor(message: string, readonly status: number, readonly code?: string, readonly issues?: Record<string, string>, readonly retryAfterSeconds?: number) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

// Ordinary API calls are bounded independently of a stalled connection. PDF
// transfers and explicit maintenance jobs get the server's full five-minute budget.
export const API_REQUEST_TIMEOUT_MS = 120_000;
export const LONG_REQUEST_TIMEOUT_MS = 300_000;
export type ApiRequestOptions = RequestInit & { timeoutMs?: number };

export async function withApiRequestDeadline<T>(
  operation: (signal: AbortSignal) => Promise<T>,
  options: Pick<ApiRequestOptions, 'signal' | 'timeoutMs' | 'method'> = {},
): Promise<T> {
  const timeoutMs = options.timeoutMs ?? API_REQUEST_TIMEOUT_MS;
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) throw new RangeError('Prazo de requisição inválido.');
  const controller = new AbortController();
  const isMutation = !['GET', 'HEAD'].includes((options.method || 'GET').toUpperCase());
  let timer: ReturnType<typeof setTimeout> | undefined;
  let rejectInterruption!: (error: ApiRequestError) => void;
  const interrupted = new Promise<never>((_, reject) => { rejectInterruption = reject; });
  const interrupt = (code: 'REQUEST_TIMEOUT' | 'REQUEST_CANCELED', reason?: unknown) => {
    if (controller.signal.aborted) return;
    const message = code === 'REQUEST_TIMEOUT'
      ? 'O prazo de espera terminou.'
      : 'A espera foi cancelada.';
    const error = new ApiRequestError(isMutation
      ? `${message} Não foi possível confirmar o resultado. Confira o processo ou os dados antes de repetir a operação.`
      : `${message} Não foi possível concluir a consulta. Tente novamente.`, 0, code);
    // Settle the caller even if a transport ignores abort; abort still releases
    // native fetch/body reads. Neither cancellation nor timeout retries a write.
    rejectInterruption(error);
    controller.abort(code === 'REQUEST_CANCELED' ? reason : error);
  };
  const cancel = () => interrupt('REQUEST_CANCELED', options.signal?.reason);
  options.signal?.addEventListener('abort', cancel, { once: true });
  try {
    if (options.signal?.aborted) {
      cancel();
      return await interrupted;
    }
    timer = setTimeout(() => interrupt('REQUEST_TIMEOUT'), timeoutMs);
    return await Promise.race([operation(controller.signal), interrupted]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
    options.signal?.removeEventListener('abort', cancel);
  }
}

export function setActiveUserEmail(email: string) {
  invalidateIdentityRequests();
  activeUserEmail = email;
  try { if (typeof localStorage !== 'undefined') localStorage.setItem('portal_tcc_active_email', email); } catch { /* A sessão por cookie não depende do storage. */ }
}

export function invalidateIdentityRequests() { activeIdentityRevision+=1; invalidatePendingReads(); }

export function getActiveUserEmail(): string {
  try { return (typeof localStorage !== 'undefined' ? localStorage.getItem('portal_tcc_active_email') : null) ?? activeUserEmail; }
  catch { return activeUserEmail; }
}

export async function fetchApiRequest<T>(endpoint: string, options: ApiRequestOptions = {}): Promise<T> {
  const mutation=!['GET','HEAD'].includes((options.method||'GET').toUpperCase());
  if(mutation)invalidatePendingReads();
  const identityRevision=activeIdentityRevision;
  const { timeoutMs, ...requestOptions } = options;
  const headers: Record<string,string> = {
    'Content-Type': 'application/json',
    ...((options.headers || {}) as Record<string,string>)
  };
  if(isLocalDemoFrontend()&&getActiveUserEmail())headers['x-demo-user-email']=getActiveUserEmail();

  try{return await withApiRequestDeadline(async signal => {
    const response = await fetch(endpoint, {
      ...requestOptions,
      signal,
      headers,
      credentials: requestOptions.credentials ?? 'include'
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      reportExpiredSession(response.status,errorData.code,identityRevision);
      const retryAfter = response.headers.get('Retry-After');
      throw new ApiRequestError(errorData.error || errorData.message || `Erro HTTP ${response.status}`, response.status, errorData.code, errorData.issues, retryAfter && /^\d+$/.test(retryAfter) ? Number(retryAfter) : undefined);
    }

    return response.json();
  }, { ...requestOptions, timeoutMs });}
  finally{if(mutation)invalidatePendingReads();}
}

async function fetchApi<T>(endpoint:string,options:ApiRequestOptions={}):Promise<T>{
 const method=(options.method||'GET').toUpperCase();
 // A caller-owned AbortSignal, custom headers or cache policy must keep its
 // own transport and cancellation semantics. HEAD is not a JSON read.
 if(method==='GET'&&Object.keys(options).every(key=>key==='credentials')){
  const key=JSON.stringify([activeIdentityRevision,endpoint,options.credentials||'include']);
  let pending=pendingReads.get(key);
  if(!pending){
   const request=fetchApiRequest<T>(endpoint,options);
   pending=request.finally(()=>{if(pendingReads.get(key)===pending)pendingReads.delete(key);});
   pendingReads.set(key,pending);
  }
  // Components may prepare their own local view without mutating another
  // subscriber's response object.
  return structuredClone(await pending) as T;
 }
 if(['GET','HEAD'].includes(method))return fetchApiRequest<T>(endpoint,options);
 return withPortalOperation(requestOperationLabel(endpoint),()=>fetchApiRequest<T>(endpoint,options));
}

async function downloadApiFile(endpoint:string):Promise<{blob:Blob;fileName:string}>{
 return withPortalOperation('Preparando o documento para download…',()=>downloadApiFileRequest(endpoint));
}

export async function downloadApiFileRequest(endpoint: string, options: Pick<ApiRequestOptions, 'signal' | 'timeoutMs'> = {}): Promise<{ blob: Blob; fileName: string }> {
  const identityRevision=activeIdentityRevision;
  const headers: Record<string, string> = {};
  if (isLocalDemoFrontend() && getActiveUserEmail()) {
    headers['x-demo-user-email'] = getActiveUserEmail();
  }

  return withApiRequestDeadline(async signal => {
    const response = await fetch(endpoint, { signal, headers, credentials: 'include' });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      reportExpiredSession(response.status,errorData.code,identityRevision);
      throw new Error(errorData.error || errorData.message || `Erro HTTP ${response.status}`);
    }

    const disposition = response.headers.get('content-disposition') || '';
    const encodedName = disposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
    const plainName = disposition.match(/filename="?([^";]+)"?/i)?.[1];
    const fileName = encodedName
      ? decodeURIComponent(encodedName)
      : plainName || 'documento-assinado.pdf';

    return { blob: await response.blob(), fileName };
  }, { ...options, timeoutMs: options.timeoutMs ?? LONG_REQUEST_TIMEOUT_MS });
}

export async function getApiAuthHeaders():Promise<Record<string,string>>{if(isLocalDemoFrontend()&&getActiveUserEmail())return{'x-demo-user-email':getActiveUserEmail()};return{};}

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
  await withApiRequestDeadline(signal => uploadBinaryToSignedUrl(file, ticket, signal), {
    method: 'PUT', timeoutMs: LONG_REQUEST_TIMEOUT_MS,
  });
  return { uploadId: ticket.uploadId, sha256 };
}

async function withDevelopmentFallback<T>(file:File, operation:()=>Promise<T>, fallback:()=>Promise<T>):Promise<T>{
  return withPortalOperation('Enviando e conferindo o documento…',async()=>{
    if((import.meta as any).env?.VITE_PORTAL_LOCAL_DEMO_AUTH==='true'&&mayUseLegacyDevelopmentUpload(503,file.size,isLocalDemoFrontend()))return fallback();
    try{return await operation();}catch(error){
      const status=error instanceof ApiRequestError?error.status:0;
      if(!mayUseLegacyDevelopmentUpload(status,file.size,isLocalDemoFrontend()))throw error;
      return fallback();
    }
  });
}

export const apiClient = {
  importLegacyAcademicRecords:(records:unknown[],expectedRevision:string)=>fetchApi<{imported:number;total:number;revision:string}>('/api/admin/legacy-academic-records/import',{method:'POST',body:JSON.stringify({records,expectedRevision})}),
  getPublicRepository: () => fetchApi<ProcessData[]>('/api/public/repository'),
  getPublicCalendarData: (options: Pick<ApiRequestOptions, 'signal'> = {}) => fetchApi<{processes:ProcessData[];googleEvents:GoogleCalendarSyncedEvent[]}>('/api/public/calendar-data', options),
  getPrivateLegacyAcademicRecords:()=>fetchApi<{revision:string;records:import('../types/legacyArchive').LegacyAcademicRecord[]}>('/api/admin/legacy-academic-records'),
  getPrivateLegacyAcademicView:(id:string)=>fetchApi<import('../types/legacyArchive').PrivateLegacyAcademicView>(`/api/admin/legacy-academic-records/${encodeURIComponent(id)}/academic`),
  downloadPrivateLegacyAcademicFile:(id:string,index:number)=>downloadApiFile(`/api/admin/legacy-academic-records/${encodeURIComponent(id)}/files/${index}/download`),
  getLegacyAdministrativeDocuments:(id:string)=>fetchApi<import('../types/legacyArchive').LegacyAdministrativeFileView[]>(`/api/admin/legacy-academic-records/${encodeURIComponent(id)}/documents`),
  downloadLegacyAdministrativeDocument:(id:string,index:number)=>downloadApiFile(`/api/admin/legacy-academic-records/${encodeURIComponent(id)}/documents/${index}/download`),
  getRegistrationDraft:()=>fetchApi<import('../types/workflowOperations').RegistrationDraft|null>('/api/registration/draft'),
  saveRegistrationDraft:(data:unknown)=>fetchApiRequest<import('../types/workflowOperations').RegistrationDraft>('/api/registration/draft',{method:'PUT',body:JSON.stringify(data)}),
  deleteRegistrationDraft:()=>fetchApi<{deleted:boolean}>('/api/registration/draft',{method:'DELETE'}),
  getMe: () => fetchApi<{ userEmail: string; globalRoles: any[]; memberships: any[]; isAuthenticated: boolean; canRegisterProcess: boolean }>('/api/me'),
  getAuthStatus:()=>fetchApi<{otp:{configured:boolean};google:{oauthConfigured:boolean;connected:boolean};bootstrapMasterConfigured:boolean}>('/api/setup/status'),
  requestLoginCode:(email:string)=>fetchApi<{sent:boolean;expiresInMinutes:number;message:string}>('/api/auth/request-code',{method:'POST',body:JSON.stringify({email})}),
  verifyLoginCode:async(email:string,code:string)=>{
    const result=await fetchApi<any>('/api/auth/verify-code',{method:'POST',body:JSON.stringify({email,code})});
    // Successful OTP replaces the cookie, including in-place reauthentication.
    // A late denial from the previous cookie must not expire this new session.
    invalidateIdentityRequests();
    return result;
  },
  logout:()=>fetchApi<{signedOut:boolean}>('/api/auth/logout',{method:'POST'}),
  getPublicProcess:(id:string)=>fetchApi<any>(`/api/public/processes/${encodeURIComponent(id)}`),
  getSettings: () => requestAfterRuntimeBusy<GlobalSettings & { automaticAstenEnabled?: boolean }>('/api/settings'),
  saveStudioImage:(input:{kind:'email'|'form';templateId:string;field:'logoUrl'|'heroImageUrl';value:string;expectedRevision:number;expectedImageValue?:string})=>fetchApi<{revision:number;savedAt:string;imageUrl:string;studio:IntegrationStudioSettings}>('/api/admin/studio/image',{method:'PATCH',body:JSON.stringify(input)}),
  updateSettings: (settings: Partial<GlobalSettings>&{studioExpectedRevision?:number;studioSaveMode?:'autosave'|'publish'}) => (settings.studioSaveMode==='autosave'?fetchApiRequest<GlobalSettings>:fetchApi<GlobalSettings>)('/api/admin/settings', {
    method: 'PATCH',
    body: JSON.stringify(settings)
  }),
  updateDriveRootFolder:(folderId:string)=>fetchApi<{folderId:string}>('/api/admin/drive-root',{method:'POST',body:JSON.stringify({folderId})}),
  sendPublicFeedback: (data:{description:string;imageDataUrl?:string;extraField?:string}) =>
    fetchApi<{received:boolean;reference?:string}>('/api/public/feedback',{method:'POST',body:JSON.stringify(data)}),
  getFeedbackForAdmin: () => fetchApi<FeedbackEntry[]>('/api/admin/feedback'),
  getFeedbackPageForAdmin: (cursor?:string) => fetchApi<FeedbackPage>(`/api/admin/feedback?paginated=true${cursor?`&before=${encodeURIComponent(cursor)}`:''}`),
  getFeedbackImage: (id:string) => downloadApiFileRequest(`/api/admin/feedback/${encodeURIComponent(id)}/image`),
  markFeedbackReviewed: (id:string) =>
    fetchApi<{reviewed:boolean;record:FeedbackEntry}>(`/api/admin/feedback/${encodeURIComponent(id)}/review`,{method:'PATCH',body:'{}'}),
  getPortalSyncVersion:()=>fetchApi<{revision:number}>('/api/sync/version'),
  getPublicSyncVersion:()=>fetchApi<{token:string}>('/api/public/sync/version',{credentials:'omit'}),
  getProcesses: (options: Pick<ApiRequestOptions, 'signal'> = {}) => fetchApi<ProcessData[]>('/api/processes', options),
  getProcessDetail: (id: string) => requestAfterRuntimeBusy<{
    process: ProcessData;
    documents: ProcessDocument[];
    signatures: SignatureJob[];
    reservationReceipts?: import('../types/workflowOperations').ReservationReceiptSummary[];
    verifications: { documentType: string; version: number; code: string; url: string; sha256?: string; signedAt?: string }[];
    auditLogs: AuditLog[];
  }>(`/api/processes/${encodeURIComponent(id)}/detail`,{},2),
  getProcessById: (id: string, options: Pick<ApiRequestOptions, 'signal' | 'timeoutMs'> = {}) => fetchApi<ProcessData>(`/api/processes/${id}`, options),
  getRegistrationSuggestions:(field:string,q:string,options:Pick<ApiRequestOptions,'signal'>={})=>fetchApi<string[]>(`/api/forms/registration-suggestions?field=${encodeURIComponent(field)}&q=${encodeURIComponent(q)}`,options),
  getRegistrationSchema:()=>fetchApi<Partial<IntegrationStudioSettings> & {applicantName?: string}>('/api/forms/registration-schema'),
  getRegistrationBootstrap,
  createProcess: (data: any, registrationAttempt?: string) => fetchApi<WorkflowProcessResponse>('/api/processes', {
    method: 'POST',
    timeoutMs: registrationAttempt ? 25_000 : undefined,
    body: JSON.stringify({...data,registrationAttempt})
  }),
  getRegistrationAttempt: (attempt: string) => fetchApi<{id:string}>(`/api/registration/attempts/${encodeURIComponent(attempt)}`, {
    cache: 'no-store', timeoutMs: 5_000
  }),
  updateProcess: (id: string, data: Omit<Partial<ProcessData>, 'aluno1' | 'aluno2'> & { aluno1?: Partial<ProcessData['aluno1']>; aluno2?: Partial<NonNullable<ProcessData['aluno2']>> | null; expectedDataRevision?: number }) => fetchApi<WorkflowProcessResponse&{reservationRestarted?:boolean}>(`/api/processes/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data)
  }),
  requestReservationChange: (
    id: string,
    data: { date: string; time: string; locationChoice: string; customLocation?: string; expectedDataRevision: number },
  ) => fetchApi<WorkflowProcessResponse & {reservationRestarted?:boolean}>(
    `/api/processes/${encodeURIComponent(id)}/reservation-change`,
    { method: 'POST', body: JSON.stringify(data) },
  ),
  getStudioForm:(processId:string,formId:string)=>fetchApi<any>(`/api/processes/${processId}/forms/${formId}`),
  getStudioForms:(processId:string)=>fetchApi<any[]>(`/api/processes/${processId}/forms`),
  submitStudioForm:(processId:string,formId:string,answers:Record<string,unknown>,expectedFormRevision:number)=>fetchApi<import('../types/courseOperations').StudioFormSubmission>(`/api/processes/${processId}/forms/${formId}/submissions`,{method:'POST',body:JSON.stringify({answers,expectedFormRevision})}),
  getStudioFormSubmissions:(processId:string)=>fetchApi<any[]>(`/api/processes/${processId}/form-submissions`),
  deleteProcess: (id: string) => fetchApi<import('../utils/processDeletionDialog').ProcessDeletionResponse>(`/api/processes/${id}`, {
    method: 'DELETE',timeoutMs:LONG_REQUEST_TIMEOUT_MS,body:JSON.stringify({confirmation:'EXCLUIR',expectedProcessId:id,deleteFiles:true,clearHistory:true})
  }),
  getProcessDeletionStatus:(processId:string,taskId?:string,signal?:AbortSignal)=>{const query=new URLSearchParams({processId,...(taskId?{taskId}:{})});return fetchApi<import('../../server/workflow/processDeletionStatus').ProcessDeletionStatusResult>('/api/admin/process-deletions/status?'+query,{signal,timeoutMs:15_000});},
  getProcessDeletions:()=>fetchApi<import('../../server/workflow/processDeletion').ProcessDeletionSummary[]>('/api/admin/process-deletions'),
  retryProcessDeletion:(id:string)=>fetchApi<import('../../server/workflow/processDeletion').ProcessDeletionSummary>('/api/admin/process-deletions/'+encodeURIComponent(id)+'/retry',{method:'POST',timeoutMs:LONG_REQUEST_TIMEOUT_MS,body:JSON.stringify({})}),
  getEvaluationSchema: (id: string) => fetchApi<{ studio: Partial<IntegrationStudioSettings>; outcomes: GlobalSettings['evaluationOutcomeOptions'];ataModelFingerprint?:string }>(`/api/processes/${id}/evaluation/schema`),
  getEvaluationDraft:(id:string)=>fetchApi<{processId:string;dataRevision:number;answers:Record<string,string|number|boolean>;documentText?:string;savedAt:string;modelFingerprint?:string;documentTextReset?:boolean}|null>(`/api/processes/${encodeURIComponent(id)}/evaluation/draft`),
  saveEvaluationDraft:(id:string,answers:Record<string,string|number|boolean>,expectedDataRevision:number,documentText?:string,expectedModelFingerprint?:string)=>fetchApiRequest<{savedAt:string;answers:Record<string,string|number|boolean>;documentText?:string}>(`/api/processes/${encodeURIComponent(id)}/evaluation/draft`,{method:'PUT',body:JSON.stringify({answers,expectedDataRevision,documentText,expectedModelFingerprint})}),
  previewEvaluation: (id:string,data:unknown)=>fetchApi<{previewToken:string;documentText?:string;documentLayout?:AtaReviewParagraph[];downloadUrl?:string;contentBase64?:string}>(`/api/processes/${encodeURIComponent(id)}/evaluation/preview`,{method:'POST',timeoutMs:LONG_REQUEST_TIMEOUT_MS,body:JSON.stringify(data)}),
  submitEvaluation: (id: string, data: {
    resultadoCode:string; parecer:string; answers?:Record<string,string|number|boolean>;
    dataConfirmed:true; expectedDataRevision:number; expectedSchemaRevision:number;
    signatureProvider:'ASTEN'|'GOV_BR'; previewToken:string;
    documentText?:string; expectedModelFingerprint?:string; correctedDocumentText?:string;
  }) => fetchApi<WorkflowProcessResponse & {documents?:ProcessDocument[]}>(`/api/processes/${encodeURIComponent(id)}/evaluation`,{
    method:'POST',timeoutMs:LONG_REQUEST_TIMEOUT_MS,body:JSON.stringify(data),
  }),
  reopenRepository:(id:string,reason:string)=>fetchApi<ProcessData>(`/api/processes/${encodeURIComponent(id)}/repository/reopen`,{method:'POST',body:JSON.stringify({reason})}),
  reopenEvaluation: (id: string, reason: string) => fetchApi<ProcessData>(`/api/processes/${id}/reopen`, {
    method: 'POST', body: JSON.stringify({ reason })
  }),
  getProcessDocuments: (id: string) => fetchApi<any[]>(`/api/processes/${id}/documents`),
  downloadProcessDocument: (id: string, documentId: string) =>
    downloadApiFile(`/api/processes/${encodeURIComponent(id)}/documents/${encodeURIComponent(documentId)}/download`),
  downloadPublicProcessDocument: (id: string, documentId: string) =>
    downloadApiFile(`/api/public/processes/${encodeURIComponent(id)}/documents/${encodeURIComponent(documentId)}/download`),
  getProcessSignatureJobs:(id:string)=>fetchApi<SignatureJob[]>(`/api/processes/${encodeURIComponent(id)}/signatures`),
  signProcessDocument:(id:string,type:string,provider:'ASTEN'|'GOV_BR'='ASTEN')=>fetchApi<{job:SignatureJob;message:string}>(`/api/processes/${id}/documents/${type}/sign`,{method:'POST',timeoutMs:LONG_REQUEST_TIMEOUT_MS,body:JSON.stringify({provider})}),
  downloadGovbrPdf:(jobId:string,returned=false)=>downloadApiFile(`/api/signatures/jobs/${encodeURIComponent(jobId)}/govbr/download${returned?'?kind=returned':''}`),
  uploadGovbrPdf:(job:SignatureJob,file:File)=>withDevelopmentFallback(file,async()=>{
    const staged=await stageFile(file,{purpose:'GOV_BR_SIGNED_PDF',processId:job.processId});
    return fetchApi<SignatureJob>(`/api/signatures/jobs/${encodeURIComponent(job.id)}/govbr/complete`,{method:'POST',timeoutMs:LONG_REQUEST_TIMEOUT_MS,body:JSON.stringify(staged)});
  },async()=>fetchApi<SignatureJob>(`/api/signatures/jobs/${encodeURIComponent(job.id)}/govbr/complete`,{method:'POST',timeoutMs:LONG_REQUEST_TIMEOUT_MS,body:JSON.stringify({fileName:file.name,contentBase64:await fileToLegacyBase64(file)})})),
  approveGovbrPdf:(jobId:string,confirmation:{sha256:string;itiApproved:boolean;signerMatches:boolean;documentMatches:boolean})=>fetchApi<SignatureJob>(`/api/signatures/jobs/${encodeURIComponent(jobId)}/govbr/approve`,{method:'POST',body:JSON.stringify(confirmation)}),
  requestCorrection: (id: string, docId: string, data: { description: string }) => fetchApi<DocumentCorrectionRequest>(`/api/processes/${id}/documents/${docId}/correction-request`, {
    method: 'POST',
    body: JSON.stringify(data)
  }),
  getCoordinatorQueue: () => fetchApi<PresidencyQueueItem[]>('/api/coordinator/signature-queue'),
  uploadSignedDocument: (processId: string, fileName: string) => fetchApi<any>('/api/coordinator/upload-signed', {
    method: 'POST',
    body: JSON.stringify({ processId, fileName })
  }),
  getAstenStatus:()=>fetchApi<AstenIntegrationStatus>('/api/integrations/asten/status'),
  inspectAstenDeclarations:(processIds:string[])=>fetchApi<import('../types/signatures').AstenDeclarationCheck[]>('/api/president/declarations/asten-preflight',{method:'POST',body:JSON.stringify({processIds})}),
  getAstenDocumentFolders:()=>fetchApi<AstenDocumentFoldersStatus>('/api/integrations/asten/folders'),
  saveAstenDocumentFolders:(mapping:Record<AstenDocumentFolderType,number>)=>fetchApi<AstenDocumentFoldersStatus>('/api/integrations/asten/folders',{method:'PUT',body:JSON.stringify({mapping})}),
  getInfrastructureStatus:()=>fetchApi<any>('/api/integrations/status'),
  testSupabaseConnection:()=>fetchApi<{configured:boolean;connected:boolean;durablePersistenceReady:boolean;normalizedSchemaReady:boolean;transactionalRuntimeReady:boolean;keyMode:string;message:string}>('/api/integrations/supabase/test',{method:'POST'}),
  syncGoogleWorkspaceCalendar:()=>fetchApi<{calendarId:string;created:number;events:GoogleCalendarSyncedEvent[]}>('/api/integrations/google/calendar/sync',{method:'POST',timeoutMs:LONG_REQUEST_TIMEOUT_MS}),
  applyGoogleDocDesign:(documentId:string,options:any)=>fetchApi<{styledVariables:number;headerUpdated:boolean;footerUpdated:boolean}>(`/api/admin/google/docs/${encodeURIComponent(documentId)}/design`,{method:'POST',body:JSON.stringify(options)}),
  runInfrastructureHomologation:()=>fetchApi<{id:string;executedAt:string;executedBy:string;readyForProduction:boolean;checks:Array<{id:string;label:string;status:'PASS'|'FAIL'|'PENDING';message:string}>}>('/api/integrations/homologation',{method:'POST',timeoutMs:LONG_REQUEST_TIMEOUT_MS}),
  getAstenDashboard:()=>fetchApi<any>('/api/admin/asten/dashboard'),
  getEmailDeliveries:()=>fetchApi<any[]>('/api/admin/email-deliveries'),
  retryEmailDelivery:(id:string,confirmation?:{mode:'COMMUNICATION_COPY';checkedSentFolder:true;reason:string;operationId:string})=>fetchApi<any>(`/api/admin/email-deliveries/${encodeURIComponent(id)}/retry`,{method:'POST',...(confirmation?{body:JSON.stringify(confirmation)}:{})}),
  getWorkflowRuns:()=>fetchApi<any[]>('/api/admin/workflow-runs'),
  getWorkflowProcessTrace:(protocol:string)=>fetchApi<WorkflowTraceEntry[]>(`/api/admin/workflow-runs?protocol=${encodeURIComponent(protocol)}`),
  getNotificationPreferences:()=>fetchApi<any>('/api/notification-preferences'),
  updateNotificationPreferences:(data:any)=>fetchApi<any>('/api/notification-preferences',{method:'PATCH',body:JSON.stringify(data)}),
  getNotifications:()=>fetchApi<import('../types/courseOperations').PortalNotification[]>('/api/notifications'),
  getNotification:(id:string,signal?:AbortSignal)=>fetchApi<import('../types/courseOperations').PortalNotificationDetail>(`/api/notifications/${encodeURIComponent(id)}`,{signal}),
  markNotificationRead:(id:string,createdAt:string)=>fetchApiRequest<{read:true}>(`/api/notifications/${encodeURIComponent(id)}/read`,{method:'PUT',body:JSON.stringify({createdAt})}),
  validateCourseStudio:(studio?:any)=>fetchApi<any>('/api/admin/studio/validate',{method:'POST',body:JSON.stringify({studio})}),
  getStudioVersions:()=>fetchApi<any[]>('/api/admin/studio/versions'),
  compareStudioVersion:(revision:number)=>fetchApi<{fromRevision:number;toRevision:number;emailTemplates:Array<{id:string;name:string;subject:string;body:string}>;formTemplates:Array<{id:string;title:string;description?:string;questions:Array<{label:string;required:boolean}>}>;workflowStages:Array<{id:string;title:string;triggerEvent:string;actions:Array<{id:string;title:string}>}>}>(`/api/admin/studio/versions/${revision}/compare`),
  restoreStudioVersion:(revision:number,expectedRevision:number,reason:string)=>fetchApi<{studio:IntegrationStudioSettings;draft?:IntegrationStudioSettings}>(`/api/admin/studio/versions/${revision}/restore`,{method:'POST',body:JSON.stringify({expectedRevision,reason})}),
  runBackupDrill:()=>fetchApi<any>('/api/admin/backup/drill',{method:'POST',timeoutMs:LONG_REQUEST_TIMEOUT_MS}),
  getRetentionPreview:()=>fetchApi<any>('/api/admin/retention/preview'),
  getLegalHolds:()=>fetchApi<any[]>('/api/admin/legal-holds'),
  createLegalHold:(processId:string,reason:string)=>fetchApi<any>('/api/admin/legal-holds',{method:'POST',body:JSON.stringify({processId,reason})}),
  releaseLegalHold:(id:string)=>fetchApi<any>(`/api/admin/legal-holds/${id}/release`,{method:'POST'}),
  getPrivacyRequests:()=>fetchApi<any[]>('/api/privacy/requests'),
  createPrivacyRequest:(data:any)=>fetchApi<any>('/api/privacy/requests',{method:'POST',body:JSON.stringify(data)}),
  updatePrivacyRequest:(id:string,data:any)=>fetchApi<any>(`/api/admin/privacy/requests/${id}`,{method:'PATCH',body:JSON.stringify(data)}),
  getOperationalHealth:()=>fetchApi<any>('/api/admin/health'),
  runDriveIntegrityCheck:()=>fetchApi<any>('/api/admin/integrity/drive',{method:'POST',timeoutMs:LONG_REQUEST_TIMEOUT_MS}),
  getFormArchives:()=>fetchApi<any[]>('/api/admin/form-archives'),
  retryFormArchive:(id:string)=>fetchApi<any>(`/api/admin/form-archives/${encodeURIComponent(id)}/retry`,{method:'POST',timeoutMs:LONG_REQUEST_TIMEOUT_MS}),
  connectAsten:(token:string,repositoryId?:string)=>fetchApi<AstenIntegrationStatus>('/api/integrations/asten/connect',{method:'POST',body:JSON.stringify({token,repositoryId})}),
  getSignatureJobs:()=>fetchApi<SignatureJob[]>('/api/signatures/jobs'),
  retrySignatureJob:(id:string)=>fetchApi<SignatureJob>(`/api/signatures/jobs/${id}/retry`,{method:'POST'}),
  reconcileSignatureJob:(id:string)=>fetchApi<SignatureJob>(`/api/signatures/jobs/${id}/reconcile`,{method:'POST'}),
  previewReceipt:(decision:'CONFIRMED'|'UNAVAILABLE',receiptDesign:IntegrationStudioSettings['receiptDesign'],usePublishedModel=false)=>fetchApi<{contentBase64?:string;downloadUrl?:string;fileName:string}>('/api/admin/receipts/preview',{method:'POST',timeoutMs:usePublishedModel?LONG_REQUEST_TIMEOUT_MS:undefined,body:JSON.stringify({decision,receiptDesign,usePublishedModel})}),
  previewDocumentModel:(type:'CONVITE'|'ATA'|'TERMO'|'DECLARACAO',studio:any)=>fetchApi<{analysis:unknown;fileName:string;downloadUrl?:string;contentBase64?:string}>(`/api/admin/models/${type}/preview`,{method:'POST',timeoutMs:LONG_REQUEST_TIMEOUT_MS,body:JSON.stringify({studio})}),
  getAuthorizedStudents:()=>fetchApi<any[]>('/api/admin/access-list'),
  getAccessListGoogleTemplate:()=>fetchApi<{url:string}>('/api/admin/access-list/google-template',{method:'POST'}),
  getLocalDocumentModelFile:(type:string)=>downloadApiFile(`/api/admin/models/${encodeURIComponent(type)}/local-source`),
  addAuthorizedStudent:(data:{nome:string;email:string;role?:'STUDENT'|'ADVISOR'|'CO_ADVISOR'|'EXAMINER';memberType?:'INTERNAL'|'EXTERNAL'})=>fetchApi<any>('/api/admin/access-list',{method:'POST',body:JSON.stringify(data)}),
  updateAuthorizedStudent:(id:string,data:any)=>fetchApi<any>(`/api/admin/access-list/${id}`,{method:'PATCH',body:JSON.stringify(data)}),
  deleteAuthorizedStudent:(id:string)=>fetchApi<{deleted:boolean}>(`/api/admin/access-list/${id}`,{method:'DELETE'}),
  importAuthorizedStudents:(records:Array<{nome:string;email:string}>)=>fetchApi<{batchHash:string;created:number;updated:number;preservedRevocations:number;reused:boolean}>('/api/admin/access-list/import',{method:'POST',body:JSON.stringify({records})}),
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
  createAdministrationTransfer:(role:'MASTER_ADMIN'|'COMMISSION_PRESIDENT',targetEmail:string)=>requestAfterRuntimeBusy<any>('/api/admin/administration-transfers',{method:'POST',body:JSON.stringify({role,targetEmail})}),
  acceptAdministrationTransfer:(id:string)=>fetchApi<any>(`/api/admin/administration-transfers/${encodeURIComponent(id)}/accept`,{method:'POST'}),
  cancelAdministrationTransfer:(id:string)=>fetchApi<any>(`/api/admin/administration-transfers/${encodeURIComponent(id)}/cancel`,{method:'POST'}),
  updateRecoveryEmails:(emails:string[])=>fetchApi<GlobalSettings>('/api/admin/recovery-emails',{method:'PATCH',body:JSON.stringify({emails})}),
  getAdminMetrics:(cycleId?:string)=>fetchApi<any>(`/api/admin/metrics${cycleId?`?cycleId=${encodeURIComponent(cycleId)}`:''}`),
  getIndicators:(options:Pick<ApiRequestOptions,'signal'>={})=>fetchApi<any>('/api/public/indicators',options),
  getAdvancedAnalytics:(period='',compare='')=>fetchApi<any>(`/api/admin/analytics/advanced?${new URLSearchParams({period,compare})}`),
  downloadAdvancedAnalytics:(format:'csv'|'pdf',period='',compare='')=>downloadApiFile(`/api/admin/analytics/advanced?${new URLSearchParams({format,period,compare})}`),
  simulateWorkflow:(studio:IntegrationStudioSettings|undefined,scenario:WorkflowSimulationScenario)=>fetchApi<WorkflowSimulationResult>('/api/admin/workflow/simulate',{method:'POST',body:JSON.stringify({studio,scenario})}),
  getProcessVerifications:(id:string)=>fetchApi<any[]>(`/api/processes/${id}/verifications`),
  getPublicVerification:(code:string)=>fetchApi<any>(`/api/public/verification/${encodeURIComponent(code)}`),
  checkVerificationPdfFile:(code:string,file:File)=>verifyPublicPdfLocally(file,()=>fetchApi<PublicDocumentVerification>(`/api/public/verification/${encodeURIComponent(code)}`)),
  downloadInstitutionalDossier:(id:string,types?:string[])=>downloadApiFile(`/api/admin/processes/${encodeURIComponent(id)}/dossier${types?`?types=${encodeURIComponent(types.join(','))}`:''}`),
  getDocumentModels:()=>fetchApi<Record<string,any>>('/api/admin/models'),
  getReferenceDocumentModelFolder:(type:string)=>fetchApi<{name:string;url:string}>(`/api/admin/models/${encodeURIComponent(type)}/reference-folder`),
  detectDocumentModelVariables:(type:string)=>fetchApi<{type:string;variables:string[];detectedAt:string}>(`/api/admin/models/${encodeURIComponent(type)}/detect-variables`,{method:'POST'}),
  uploadDocumentModelFile:(type:string,file:File)=>withDevelopmentFallback(file,async()=>{
    const staged=await stageFile(file,{purpose:'DOCUMENT_MODEL'});
    return fetchApi<any>(`/api/admin/models/${type}`,{method:'POST',timeoutMs:LONG_REQUEST_TIMEOUT_MS,body:JSON.stringify({fileName:file.name,stagedUploadId:staged.uploadId,sha256:staged.sha256,size:file.size,mimeType:file.type})});
  },async()=>fetchApi<any>(`/api/admin/models/${type}`,{method:'POST',timeoutMs:LONG_REQUEST_TIMEOUT_MS,body:JSON.stringify({fileName:file.name,contentBase64:await fileToLegacyBase64(file)})})),
  importDocumentModelFromDrive:(type:string,linkOrId:string)=>fetchApi<any>(`/api/admin/models/${type}/link`,{method:'POST',timeoutMs:LONG_REQUEST_TIMEOUT_MS,body:JSON.stringify({linkOrId})}),
  restoreDocumentModelVersion:(type:string,version:number)=>fetchApi<any>(`/api/admin/models/${type}/versions/${version}/restore`,{method:'POST',timeoutMs:LONG_REQUEST_TIMEOUT_MS}),
  deleteDocumentModel:(type:string)=>fetchApi<{deleted:boolean;type:string}>(`/api/admin/models/${encodeURIComponent(type)}`,{method:'DELETE'}),
  downloadLocationProof:(id:string)=>downloadApiFile(`/api/processes/${encodeURIComponent(id)}/location-proof/download`),
  getReservationReceipts:(protocol:string)=>fetchApi<{items:import('../types/workflowOperations').ReservationReceiptSummary[];currentStatus?:'PENDENTE'|'CONFIRMADO'|'RECUSADO'}>(`/api/public/processes/${encodeURIComponent(protocol)}/reservation-receipts`),
  downloadReservationReceipt:(protocol:string,receiptId?:string,privateProcessId?:string)=>downloadApiFile(`${privateProcessId?`/api/processes/${encodeURIComponent(privateProcessId)}/location-proof/download`:`/api/public/processes/${encodeURIComponent(protocol)}/reservation-receipt`}${receiptId?`?receipt=${encodeURIComponent(receiptId)}`:''}`),
  publishReviewedDocumentModel:(type:string,review:{fileId:string;version:number;sha256:string})=>fetchApi<any>(`/api/admin/models/${encodeURIComponent(type)}/publish-reviewed`,{method:'POST',body:JSON.stringify(review)}),
  previewOfficialModel:(type:string,studio:unknown,answers:unknown)=>fetchApi<any>(`/api/admin/models/${encodeURIComponent(type)}/preview`,{method:'POST',timeoutMs:LONG_REQUEST_TIMEOUT_MS,body:JSON.stringify({studio,answers})}),
  compareStudioDraft:(studio:unknown,baseRevision?:number)=>fetchApi<any>('/api/admin/studio/compare',{method:'POST',body:JSON.stringify({studio,baseRevision})}),
  getWorkflowOperations:(processId?:string,view:'recovery'|'reminders'='recovery')=>fetchApi<any>('/api/admin/workflow/operations?'+new URLSearchParams({...processId?{processId}:{},view}).toString()),
  decideReservationAsMaster:(id:string,dataRevision:number,decision:'accept'|'decline',reason:string)=>
    fetchApi<{decision:'CONFIRMED'|'UNAVAILABLE'}>(`/api/admin/workflow/reservations/${encodeURIComponent(id)}/decision`,{
      method:'POST',body:JSON.stringify({dataRevision,decision,reason,confirmed:'yes'}),
    }),
  runWorkflowMaintenance:(processId?:string)=>fetchApi<any>('/api/admin/workflow/maintenance',{method:'POST',body:JSON.stringify(processId?{processId}:{}),timeoutMs:LONG_REQUEST_TIMEOUT_MS}),
  retryWorkflowOperation:(path:string,reviewedStudioRevision?:number)=>{
    if(!/^\/api\/(?:admin\/(?:workflow\/(?:runs|reminders|invitations|ata-signatures)|email-deliveries|form-archives|studio-form-submissions)|signatures\/jobs)\/[^/]+\/(?:retry|reconcile)$/.test(path))throw new Error('Ação de recuperação inválida.');
    return fetchApi<any>(path,{method:'POST',timeoutMs:LONG_REQUEST_TIMEOUT_MS,body:JSON.stringify({reviewedStudioRevision})});
  },
  submitFinalData:(id:string,data:any)=>fetchApi<WorkflowProcessResponse>(`/api/processes/${id}/final-data`,{method:'POST',body:JSON.stringify(data)}),
  uploadProcessPdfFile:(id:string,kind:'trabalho-completo'|'resumo-expandido',file:File)=>withDevelopmentFallback(file,async()=>{
    const staged=await stageFile(file,{purpose:kind==='trabalho-completo'?'PROCESS_FULL_WORK':'PROCESS_EXPANDED_ABSTRACT',processId:id});
    return fetchApi<{id:string;fileName:string;downloadUrl:string;sha256:string}>(`/api/processes/${id}/files/${kind}`,{method:'POST',timeoutMs:LONG_REQUEST_TIMEOUT_MS,body:JSON.stringify({fileName:file.name,stagedUploadId:staged.uploadId,sha256:staged.sha256,size:file.size,mimeType:file.type})});
  },async()=>fetchApi<{id:string;fileName:string;downloadUrl:string;sha256:string}>(`/api/processes/${id}/files/${kind}`,{method:'POST',timeoutMs:LONG_REQUEST_TIMEOUT_MS,body:JSON.stringify({fileName:file.name,contentBase64:await fileToLegacyBase64(file)})})),
  getProcessAuditLogs:(id:string)=>fetchApi<AuditLog[]>(`/api/processes/${encodeURIComponent(id)}/audit-logs`),
  downloadProcessAuditLogs:(id:string)=>downloadApiFile(`/api/processes/${encodeURIComponent(id)}/audit-logs/pdf`),
  getAuditLogs: () => fetchApi<AuditLog[]>('/api/admin/audit-logs'),
  getAuditLogPage: (filters: {q: string; kind: string; start: string; end: string; before?: string; focusId?: string;processId?:string}, signal?: AbortSignal) => {
    const query = new URLSearchParams({paginated:'true'});
    for (const [key, value] of Object.entries(filters)) if (value) query.set(key, value);
    return fetchApi<{items: AuditLog[]; nextCursor: string | null; total: number; focused: AuditLog | null}>(
      `/api/admin/audit-logs?${query}`, {signal},
    );
  },
  sendStudioEmailTest: (id: string, expectedRevision: number) => fetchApi<{status:'ACCEPTED_BY_GMAIL';deliveryId:string}>(`/api/admin/email-models/${encodeURIComponent(id)}/test`, {method:'POST', body:JSON.stringify({expectedRevision})}),
  getEmailDeliveryPreview: (id: string) => fetchApi<{subject:string;text:string;sensitive:boolean}>(`/api/admin/email-deliveries/${encodeURIComponent(id)}/preview`),
  rollbackAuditLog: (logId: string) => fetchApi<{ message: string; process?: ProcessData; settings?: GlobalSettings }>(`/api/admin/rollback-log/${logId}`, {
    method: 'POST'
  }),
  getFullBackup:()=>fetchApi<any>('/api/admin/backup',{timeoutMs:LONG_REQUEST_TIMEOUT_MS}),
  restoreFullBackup: (data: any) => fetchApi<{ message?: string; requiresConfirmation?:boolean; confirmHash?:string; summary?:any }>(`/api/admin/restore-full-backup`, {
    method: 'POST',
    timeoutMs: LONG_REQUEST_TIMEOUT_MS,
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
  getGoogleCalendarEvents: (options: Pick<ApiRequestOptions, 'signal'> = {}) => fetchApi<GoogleCalendarSyncedEvent[]>('/api/calendar/events', options),
  syncGoogleCalendarEvents: (events: any[]) => fetchApi<any>('/api/calendar/sync', {
    method: 'POST',
    body: JSON.stringify({ events })
  }),
  resetDemoData: () => fetchApi<any>('/api/demo/seed', { method: 'POST' })
};
