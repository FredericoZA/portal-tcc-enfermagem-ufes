import { createHash, createHmac, timingSafeEqual } from 'crypto';
import { loadIntegrationSecret, saveIntegrationSecret } from './integrationSecrets';
import type { GoogleCalendarSyncedEvent, ProcessData } from '../../src/types';

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v2/userinfo';
const DRIVE_API = 'https://www.googleapis.com/drive/v3';
const DRIVE_UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3';
const CALENDAR_API = 'https://www.googleapis.com/calendar/v3';

export const GOOGLE_WORKSPACE_SCOPES = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/documents',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/calendar.events'
];

export function existingDriveModelLinkImportEnabled(): boolean {
  return process.env.GOOGLE_ALLOW_EXISTING_MODEL_LINKS === 'true';
}

export function getGoogleWorkspaceScopes(): string[] {
  return existingDriveModelLinkImportEnabled()
    ? [...GOOGLE_WORKSPACE_SCOPES, 'https://www.googleapis.com/auth/drive.readonly']
    : [...GOOGLE_WORKSPACE_SCOPES];
}

export const DRIVE_FOLDER_NAMES = {
  root: 'PORTAL_TCC',
  system: '00_SISTEMA',
  continuousIntelligence: '01_INTELIGENCIA_CONTINUA',
  models: '01_DOCUMENTOS',
  processes: '02_PROCESSOS',
  publicRepository: '03_REPOSITORIO_PUBLICO',
  modelTypes: {
    CONVITE: '01_CARTA_CONVITE',
    ATA: '02_ATA_DEFESA',
    TERMO: '03_TERMO_AUTORIZACAO',
    DECLARACAO: '04_DECLARACAO_PARTICIPACAO'
  },
  modelLifecycles: ['00_MODELO_ATIVO', '01_HISTORICO_MODELOS', '02_GERADOS', '03_ASSINADOS']
} as const;

interface GoogleTokenResponse {
  access_token: string;
  expires_in?: number;
  refresh_token?: string;
  scope?: string;
  token_type?: string;
}

interface DriveFile {
  id: string;
  name: string;
  mimeType?: string;
  webViewLink?: string;
  parents?: string[];
  modifiedTime?: string;
  version?: string;
  headRevisionId?: string;
}

const GOOGLE_DOC_MIME = 'application/vnd.google-apps.document';
const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

function extractDriveFileId(value: string): string {
  const input = String(value || '').trim();
  const match = input.match(/\/(?:document|file)\/d\/([a-zA-Z0-9_-]+)/)
    || input.match(/[?&]id=([a-zA-Z0-9_-]+)/)
    || input.match(/^([a-zA-Z0-9_-]{10,})$/);
  const id = match?.[1] || '';
  if (!/^[a-zA-Z0-9_-]{10,}$/.test(id)) throw new Error('Informe um link ou ID válido do Google Drive.');
  return id;
}

function collectGoogleDocText(value: unknown, output: string[] = []): string[] {
  if (Array.isArray(value)) {
    for (const item of value) collectGoogleDocText(item, output);
    return output;
  }
  if (!value || typeof value !== 'object') return output;
  const record = value as Record<string, unknown>;
  const textRun = record.textRun as { content?: unknown } | undefined;
  if (typeof textRun?.content === 'string') output.push(textRun.content);
  for (const [key, child] of Object.entries(record)) {
    if (key !== 'textRun') collectGoogleDocText(child, output);
  }
  return output;
}

function extractModelVariables(text: string): string[] {
  return Array.from(new Set(text.match(/<<[^<>]{2,100}>>|\{\{[^{}]{2,100}\}\}|\[\[[^\[\]]{2,100}\]\]|«[^«»]{2,100}»|-[A-Z][A-Z0-9_]{2,80}-/g) || []));
}

export interface GoogleDriveManifest {
  rootFolderId: string;
  rootFolderUrl: string;
  folders: Record<string, string>;
  modelFiles: Record<string, string>;
  createdFolders: number;
  existingFolders: number;
  uploadedModels: number;
  existingModels: number;
}

function clientId(): string { return String(process.env.GOOGLE_OAUTH_CLIENT_ID || '').trim(); }
function clientSecret(): string { return String(process.env.GOOGLE_OAUTH_CLIENT_SECRET || '').trim(); }
function appUrl(): string { return String(process.env.APP_URL || 'http://localhost:3000').trim().replace(/\/$/, ''); }
function redirectUri(): string { return `${appUrl()}/api/integrations/google/oauth/callback`; }
function stateSecret(): string { return String(process.env.GOOGLE_OAUTH_STATE_SECRET || '').trim(); }

function oauthStateSecretSeparated(): boolean {
  const sessionSecret = String(process.env.PORTAL_SESSION_SECRET || '').trim();
  return process.env.NODE_ENV !== 'production' || !sessionSecret || stateSecret() !== sessionSecret;
}

export function getGoogleOAuthSecurityPreflight() {
  const stateSecretStrong = stateSecret().length >= 32;
  const stateSecretSeparated = oauthStateSecretSeparated();
  const issues: string[] = [];
  if (!stateSecretStrong) issues.push('GOOGLE_OAUTH_STATE_SECRET precisa ter pelo menos 32 caracteres.');
  if (!stateSecretSeparated) issues.push('GOOGLE_OAUTH_STATE_SECRET deve ser diferente de PORTAL_SESSION_SECRET em produção.');
  return {
    stateSecretStrong,
    stateSecretSeparated,
    ready: stateSecretStrong && stateSecretSeparated,
    issues
  } as const;
}

function assertGoogleOAuthSecurityPreflight(): void {
  const preflight = getGoogleOAuthSecurityPreflight();
  if (!preflight.ready) throw new Error(preflight.issues.join(' '));
}

function encodeState(payload: Record<string, unknown>): string {
  assertGoogleOAuthSecurityPreflight();
  const body = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const signature = createHmac('sha256', stateSecret()).update(body).digest('base64url');
  return `${body}.${signature}`;
}

export function decodeGoogleOAuthState(value: string): { email?: string; bootstrap: boolean; returnTo: string; exp: number } {
  assertGoogleOAuthSecurityPreflight();
  const [body, supplied] = String(value || '').split('.');
  if (!body || !supplied) throw new Error('Estado OAuth inválido.');
  const expected = createHmac('sha256', stateSecret()).update(body).digest();
  const received = Buffer.from(supplied, 'base64url');
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) throw new Error('Estado OAuth adulterado.');
  const parsed = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
  if (!parsed?.exp || Number(parsed.exp) <= Date.now()) throw new Error('A autorização Google expirou.');
  return {
    email: parsed.email ? String(parsed.email).toLowerCase() : undefined,
    bootstrap: Boolean(parsed.bootstrap),
    returnTo: String(parsed.returnTo || '/?google=connected'),
    exp: Number(parsed.exp)
  };
}

export function getGoogleWorkspaceConfigStatus() {
  const security = getGoogleOAuthSecurityPreflight();
  const oauthConfigured = Boolean(clientId() && clientSecret() && security.ready && process.env.PORTAL_SECRET_ENCRYPTION_KEY);
  return {
    oauthConfigured,
    stateSecretConfigured: security.stateSecretStrong,
    stateSecretSeparated: security.stateSecretSeparated,
    securityIssues: security.issues,
    redirectUri: redirectUri(),
    scopes: getGoogleWorkspaceScopes(),
    existingModelLinkImportEnabled: existingDriveModelLinkImportEnabled()
  };
}

export function buildGoogleAuthorizationUrl(input: { email?: string; bootstrap?: boolean; returnTo?: string }): string {
  const security = getGoogleOAuthSecurityPreflight();
  if (!security.ready) throw new Error(security.issues.join(' '));
  if (!getGoogleWorkspaceConfigStatus().oauthConfigured) throw new Error('OAuth do Google ainda não foi configurado no servidor.');
  const state = encodeState({
    email: input.email?.toLowerCase(),
    bootstrap: Boolean(input.bootstrap),
    returnTo: input.returnTo || '/?google=connected',
    exp: Date.now() + 10 * 60_000
  });
  const params = new URLSearchParams({
    client_id: clientId(),
    redirect_uri: redirectUri(),
    response_type: 'code',
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
    scope: getGoogleWorkspaceScopes().join(' '),
    state
  });
  if (input.email) params.set('login_hint', input.email);
  return `${GOOGLE_AUTH_URL}?${params}`;
}

async function tokenRequest(params: URLSearchParams): Promise<GoogleTokenResponse> {
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: params,
    signal: AbortSignal.timeout(20_000)
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload?.access_token) {
    throw new Error(String(payload?.error_description || payload?.error || `Google OAuth respondeu ${response.status}.`));
  }
  return payload as GoogleTokenResponse;
}

export async function exchangeGoogleAuthorizationCode(code: string): Promise<{ email: string; refreshToken: string; accessToken: string; scopes: string[] }> {
  const tokens = await tokenRequest(new URLSearchParams({
    client_id: clientId(),
    client_secret: clientSecret(),
    code,
    grant_type: 'authorization_code',
    redirect_uri: redirectUri()
  }));
  if (!tokens.refresh_token) throw new Error('O Google não devolveu autorização permanente. Revogue o acesso anterior e autorize novamente.');
  const userResponse = await fetch(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${tokens.access_token}`, Accept: 'application/json' },
    signal: AbortSignal.timeout(12_000)
  });
  const user = await userResponse.json().catch(() => ({}));
  if (!userResponse.ok || !user?.email || user?.verified_email === false) throw new Error('Não foi possível validar o e-mail da conta Google.');
  return {
    email: String(user.email).trim().toLowerCase(),
    refreshToken: tokens.refresh_token,
    accessToken: tokens.access_token,
    scopes: String(tokens.scope || '').split(/\s+/).filter(Boolean)
  };
}

export async function persistGoogleWorkspaceAuthorization(input: { email: string; refreshToken: string; scopes: string[] }): Promise<void> {
  await saveIntegrationSecret('google_workspace', input.refreshToken, {
    email: input.email,
    scopes: input.scopes,
    connectedAt: new Date().toISOString()
  });
}

export async function getGoogleWorkspaceStatus() {
  const config = getGoogleWorkspaceConfigStatus();
  if (!config.oauthConfigured) return { ...config, connected: false, connectedEmail: '', connectedAt: '' };
  const stored = await loadIntegrationSecret('google_workspace').catch(() => null);
  return {
    ...config,
    connected: Boolean(stored),
    connectedEmail: String(stored?.metadata?.email || ''),
    connectedAt: String(stored?.metadata?.connectedAt || stored?.updatedAt || '')
  };
}

export async function getGoogleWorkspaceAccessToken(): Promise<string> {
  const stored = await loadIntegrationSecret('google_workspace');
  if (!stored?.value) throw new Error('A conta Google do portal ainda não foi autorizada.');
  const tokens = await tokenRequest(new URLSearchParams({
    client_id: clientId(),
    client_secret: clientSecret(),
    refresh_token: stored.value,
    grant_type: 'refresh_token'
  }));
  return tokens.access_token;
}

async function googleCalendarJson<T>(accessToken:string,url:string,init:RequestInit={}):Promise<T>{
  const response=await fetch(url,{...init,headers:{Authorization:`Bearer ${accessToken}`,Accept:'application/json',...(init.body?{'Content-Type':'application/json'}:{}),...(init.headers||{})},signal:AbortSignal.timeout(20_000)});
  const payload=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(String(payload?.error?.message||`Google Calendar respondeu ${response.status}.`));
  return payload as T;
}

export async function synchronizeDefenseCalendar(input:{accessToken:string;processes:ProcessData[];calendarId?:string;portalName?:string;courseName?:string;institutionName?:string}):Promise<{calendarId:string;created:number;events:GoogleCalendarSyncedEvent[]}>{
  const summary=`Defesas de TCC — ${String(input.courseName||'Curso').trim()}`;
  const description=`Calendário institucional das defesas de TCC de ${String(input.courseName||'curso não configurado').trim()} — ${String(input.institutionName||'instituição não configurada').trim()}. Gerenciado por ${String(input.portalName||'Portal de TCC').trim()}.`;
  let calendarId=String(input.calendarId||'').trim();
  if(!calendarId){
    const calendars=await googleCalendarJson<{items?:Array<{id:string;summary?:string}>}>(input.accessToken,`${CALENDAR_API}/users/me/calendarList?maxResults=250`);
    calendarId=calendars.items?.find(item=>String(item.summary||'').toLocaleLowerCase('pt-BR')===summary.toLocaleLowerCase('pt-BR'))?.id||'';
    if(!calendarId){
      const created=await googleCalendarJson<{id:string}>(input.accessToken,`${CALENDAR_API}/calendars`,{method:'POST',body:JSON.stringify({summary,description,timeZone:'America/Sao_Paulo'})});
      calendarId=created.id;
    }
  }
  const encoded=encodeURIComponent(calendarId);
  const timeMin=new Date(Date.now()-366*24*60*60_000).toISOString();
  const timeMax=new Date(Date.now()+4*366*24*60*60_000).toISOString();
  const listUrl=`${CALENDAR_API}/calendars/${encoded}/events?singleEvents=true&maxResults=2500&timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}`;
  const current=await googleCalendarJson<{items?:any[]}>(input.accessToken,listUrl);
  const byProtocol=new Map((current.items||[]).map(event=>[String(event?.extendedProperties?.private?.portalTccProtocol||''),event]));
  let created=0;
  for(const process of input.processes.filter(item=>item.defesa?.startAt&&item.defesa.localStatus==='CONFIRMADO')){
    if(byProtocol.has(process.protocolo))continue;
    const students=[process.aluno1.nome,process.aluno2?.nome].filter(Boolean).join(' e ');
    const payload={summary:`Defesa de TCC — ${students}`,description:[`Trabalho: ${process.titulo}`,`Orientador: ${process.orientador.nome}`,process.coorientador?`Coorientador: ${process.coorientador.nome}`:'',`Banca: ${process.banca.map(member=>member.nome).join(', ')}`,`Protocolo: ${process.protocolo}`].filter(Boolean).join('\n'),location:process.defesa.local,start:{dateTime:process.defesa.startAt},end:{dateTime:process.defesa.endAt||new Date(new Date(process.defesa.startAt).getTime()+90*60_000).toISOString()},extendedProperties:{private:{portalTccProtocol:process.protocolo,portalTccProcessId:process.id}}};
    const event=await googleCalendarJson<any>(input.accessToken,`${CALENDAR_API}/calendars/${encoded}/events`,{method:'POST',body:JSON.stringify(payload)});byProtocol.set(process.protocolo,event);created++;
  }
  const refreshed=created?await googleCalendarJson<{items?:any[]}>(input.accessToken,listUrl):current;
  const syncedAt=new Date().toISOString();
  const events=(refreshed.items||[]).map(event=>({id:String(event.id),summary:String(event.summary||'Defesa de TCC'),description:event.description?String(event.description):undefined,location:event.location?String(event.location):undefined,start:String(event.start?.dateTime||event.start?.date||''),end:String(event.end?.dateTime||event.end?.date||''),syncedAt})).filter(event=>event.id&&event.start);
  return{calendarId,created,events};
}

async function driveJson<T>(accessToken: string, url: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init.headers || {})
    },
    signal: AbortSignal.timeout(20_000)
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(String(payload?.error?.message || `Google Drive respondeu ${response.status}.`));
  return payload as T;
}

function escapeDriveQuery(value: string): string { return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'"); }

async function findChild(accessToken: string, name: string, parentId?: string, mimeType?: string): Promise<DriveFile | null> {
  const filters = [
    `name = '${escapeDriveQuery(name)}'`,
    'trashed = false',
    parentId ? `'${escapeDriveQuery(parentId)}' in parents` : "'root' in parents"
  ];
  if (mimeType) filters.push(`mimeType = '${escapeDriveQuery(mimeType)}'`);
  const params = new URLSearchParams({
    q: filters.join(' and '),
    fields: 'files(id,name,mimeType,webViewLink,parents)',
    pageSize: '10',
    spaces: 'drive'
  });
  const result = await driveJson<{ files?: DriveFile[] }>(accessToken, `${DRIVE_API}/files?${params}`);
  if ((result.files || []).length > 1) throw new Error(`Há mais de um item chamado "${name}" no mesmo local do Drive.`);
  return result.files?.[0] || null;
}

async function ensureFolder(accessToken: string, name: string, parentId?: string): Promise<{ file: DriveFile; created: boolean }> {
  const mimeType = 'application/vnd.google-apps.folder';
  const existing = await findChild(accessToken, name, parentId, mimeType);
  if (existing) return { file: existing, created: false };
  const file = await driveJson<DriveFile>(accessToken, `${DRIVE_API}/files?fields=id,name,mimeType,webViewLink,parents`, {
    method: 'POST',
    body: JSON.stringify({
      name,
      mimeType,
      ...(parentId ? { parents: [parentId] } : {}),
      appProperties: { portal: 'portal-tcc', schema: '4' }
    })
  });
  return { file, created: true };
}

export async function verifyPrivateDriveFolder(accessToken:string,folderId:string):Promise<void>{
  const permissions=await driveJson<{permissions?:Array<{id:string;type:string;role:string;domain?:string}>}>(accessToken,`${DRIVE_API}/files/${encodeURIComponent(folderId)}/permissions?fields=permissions(id,type,role,domain)&supportsAllDrives=true`);
  const broad=(permissions.permissions||[]).filter(permission=>permission.type==='anyone'||permission.type==='domain');
  if(broad.length)throw new Error('A pasta raiz do portal está compartilhada por link ou domínio. Remova essas permissões no Google Drive antes de armazenar documentos sigilosos.');
}

async function uploadBinary(
  accessToken: string,
  input: { name: string; parentId: string; mimeType: string; content: Buffer; appProperties?: Record<string, string> }
): Promise<DriveFile> {
  const boundary = `portal-tcc-${Date.now().toString(36)}`;
  const metadata = JSON.stringify({
    name: input.name,
    parents: [input.parentId],
    appProperties: { portal: 'portal-tcc', ...(input.appProperties || {}) }
  });
  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n--${boundary}\r\nContent-Type: ${input.mimeType}\r\n\r\n`, 'utf8'),
    input.content,
    Buffer.from(`\r\n--${boundary}--`, 'utf8')
  ]);
  const response = await fetch(`${DRIVE_UPLOAD_API}/files?uploadType=multipart&fields=id,name,mimeType,webViewLink,parents`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': `multipart/related; boundary=${boundary}`,
      'Content-Length': String(body.length),
      Accept: 'application/json'
    },
    body,
    signal: AbortSignal.timeout(30_000)
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(String(payload?.error?.message || `Falha ao enviar ${input.name} ao Drive.`));
  return payload as DriveFile;
}

export interface LivingIntelligenceDriveFile {
  id: string;
  name: string;
  webViewLink: string;
  folderId: string;
  created: boolean;
}

/**
 * Mantém um único arquivo ativo por nome. Atualizações de conteúdo criam uma
 * nova revisão no próprio Google Drive, evitando cópias concorrentes na pasta.
 */
export async function upsertLivingIntelligenceFile(input: {
  accessToken: string;
  rootFolderId: string;
  fileName: string;
  content: string;
  kind: 'FLOW_IMPROVEMENT_MEMORY' | 'TCC_STATISTICAL_REPORT';
  sha256: string;
  version: number;
  generatedAt: string;
}): Promise<LivingIntelligenceDriveFile> {
  if (!/^[a-f0-9]{64}$/.test(input.sha256)) throw new Error('Hash do arquivo vivo inválido.');
  if (!/^[-A-Z0-9_]+\.md$/.test(input.fileName)) throw new Error('Nome do arquivo vivo inválido.');
  const bytes = Buffer.from(input.content, 'utf8');
  if (!bytes.length || bytes.length > 2 * 1024 * 1024) throw new Error('O arquivo vivo deve ter entre 1 byte e 2 MB.');
  await verifyPrivateDriveFolder(input.accessToken, input.rootFolderId);
  const systemFolder = await ensureFolder(input.accessToken, DRIVE_FOLDER_NAMES.system, input.rootFolderId);
  const intelligenceFolder = await ensureFolder(input.accessToken, DRIVE_FOLDER_NAMES.continuousIntelligence, systemFolder.file.id);
  const existing = await findChild(input.accessToken, input.fileName, intelligenceFolder.file.id);
  const appProperties = {
    portal: 'portal-tcc',
    schema: '8',
    lifecycle: 'living-intelligence',
    intelligenceKind: input.kind,
    sha256: input.sha256,
    reportVersion: String(input.version),
    generatedAt: input.generatedAt
  };
  if (!existing) {
    const created = await uploadBinary(input.accessToken, {
      name: input.fileName,
      parentId: intelligenceFolder.file.id,
      mimeType: 'text/markdown; charset=utf-8',
      content: bytes,
      appProperties
    });
    return {
      id: created.id,
      name: created.name,
      webViewLink: created.webViewLink || `https://drive.google.com/file/d/${created.id}/view`,
      folderId: intelligenceFolder.file.id,
      created: true
    };
  }
  const response = await fetch(`${DRIVE_UPLOAD_API}/files/${encodeURIComponent(existing.id)}?uploadType=media&fields=id,name,mimeType,webViewLink,parents`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${input.accessToken}`,
      'Content-Type': 'text/markdown; charset=utf-8',
      'Content-Length': String(bytes.length),
      Accept: 'application/json'
    },
    body: bytes,
    signal: AbortSignal.timeout(30_000)
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(String(payload?.error?.message || `Falha ao atualizar ${input.fileName} no Drive.`));
  const updated = await driveJson<DriveFile>(input.accessToken, `${DRIVE_API}/files/${encodeURIComponent(existing.id)}?fields=id,name,mimeType,webViewLink,parents`, {
    method: 'PATCH',
    body: JSON.stringify({ appProperties })
  });
  return {
    id: updated.id,
    name: updated.name,
    webViewLink: updated.webViewLink || existing.webViewLink || `https://drive.google.com/file/d/${updated.id}/view`,
    folderId: intelligenceFolder.file.id,
    created: false
  };
}

export async function storePrivatePortalBackup(input:{accessToken:string;rootFolderId:string;fileName:string;content:Buffer;sha256:string}){
  if(!/^PORTAL_TCC_BACKUP_[0-9TZ-]+\.ptb$/.test(input.fileName))throw new Error('Nome de backup inválido.');
  if(!/^[a-f0-9]{64}$/.test(input.sha256))throw new Error('Hash do backup inválido.');
  if(!input.content.length||input.content.length>32*1024*1024)throw new Error('Backup fora do limite seguro de 32 MB.');
  await verifyPrivateDriveFolder(input.accessToken,input.rootFolderId);
  const systemFolder=await ensureFolder(input.accessToken,DRIVE_FOLDER_NAMES.system,input.rootFolderId);
  const backupFolder=await ensureFolder(input.accessToken,'02_BACKUPS_CIFRADOS',systemFolder.file.id);
  await verifyPrivateDriveFolder(input.accessToken,backupFolder.file.id);
  const created=await uploadBinary(input.accessToken,{name:input.fileName,parentId:backupFolder.file.id,mimeType:'application/octet-stream',content:input.content,appProperties:{schema:'9',lifecycle:'encrypted-backup',sha256:input.sha256,createdAt:new Date().toISOString()}});
  return{id:created.id,name:created.name,webViewLink:created.webViewLink||`https://drive.google.com/file/d/${created.id}/view`,folderId:backupFolder.file.id};
}

export async function readPrivatePortalBackup(accessToken:string,fileId:string):Promise<Buffer>{
  if(!/^[a-zA-Z0-9_-]{10,}$/.test(fileId))throw new Error('ID do backup inválido.');
  const permissions=await driveJson<{permissions?:Array<{type:string;role:string}>}>(accessToken,`${DRIVE_API}/files/${encodeURIComponent(fileId)}/permissions?fields=permissions(type,role)&supportsAllDrives=true`);
  if((permissions.permissions||[]).some(permission=>permission.type==='anyone'||permission.type==='domain'||permission.type==='group'))throw new Error('O backup não está restrito a usuários nominais.');
  const response=await fetch(`${DRIVE_API}/files/${encodeURIComponent(fileId)}?alt=media&supportsAllDrives=true`,{headers:{Authorization:`Bearer ${accessToken}`},signal:AbortSignal.timeout(30_000)});
  if(!response.ok)throw new Error(`Não foi possível reler o backup cifrado no Drive (${response.status}).`);
  const bytes=Buffer.from(await response.arrayBuffer());
  if(!bytes.length||bytes.length>32*1024*1024)throw new Error('Backup relido fora do limite seguro.');
  return bytes;
}

export async function bootstrapGoogleDriveStructure(accessToken?: string, options?:{rootFolderName?:string;rootFolderId?:string}): Promise<GoogleDriveManifest> {
  const token = accessToken || await getGoogleWorkspaceAccessToken();
  const folders: Record<string, string> = {};
  const modelFiles: Record<string, string> = {};
  let createdFolders = 0;
  let existingFolders = 0;
  let uploadedModels = 0;
  let existingModels = 0;

  const rootName=String(options?.rootFolderName||process.env.PORTAL_DRIVE_ROOT_FOLDER_NAME||DRIVE_FOLDER_NAMES.root).trim()||DRIVE_FOLDER_NAMES.root;
  const pinnedRootId=String(options?.rootFolderId||process.env.PORTAL_DRIVE_ROOT_FOLDER_ID||'').trim();
  let root: {file:DriveFile;created:boolean};
  if(pinnedRootId){
    if(!/^[a-zA-Z0-9_-]{10,}$/.test(pinnedRootId))throw new Error('PORTAL_DRIVE_ROOT_FOLDER_ID deve conter somente o ID válido da pasta raiz.');
    const file=await driveJson<DriveFile & {trashed?:boolean;capabilities?:{canAddChildren?:boolean}}>(token,`${DRIVE_API}/files/${encodeURIComponent(pinnedRootId)}?fields=id,name,mimeType,webViewLink,trashed,capabilities(canAddChildren)&supportsAllDrives=true`);
    if(file.mimeType!=='application/vnd.google-apps.folder'||file.trashed)throw new Error('A raiz configurada no Drive precisa ser uma pasta ativa.');
    if(file.capabilities?.canAddChildren!==true)throw new Error('A conta Google do portal não tem permissão para gravar na pasta raiz configurada.');
    root={file,created:false};
  }else{
    root=await ensureFolder(token, rootName);
  }
  await verifyPrivateDriveFolder(token,root.file.id);
  root.created ? createdFolders++ : existingFolders++;
  folders.root = root.file.id;

  for (const [key, name] of Object.entries({
    system: DRIVE_FOLDER_NAMES.system,
    models: DRIVE_FOLDER_NAMES.models,
    processes: DRIVE_FOLDER_NAMES.processes,
    publicRepository: DRIVE_FOLDER_NAMES.publicRepository
  })) {
    const result = await ensureFolder(token, name, root.file.id);
    result.created ? createdFolders++ : existingFolders++;
    folders[key] = result.file.id;
  }

  for (const [type, folderName] of Object.entries(DRIVE_FOLDER_NAMES.modelTypes)) {
    const typeFolder = await ensureFolder(token, folderName, folders.models);
    typeFolder.created ? createdFolders++ : existingFolders++;
    folders[`documents.${type}`] = typeFolder.file.id;
    for (const lifecycle of DRIVE_FOLDER_NAMES.modelLifecycles) {
      const lifecycleFolder = await ensureFolder(token, lifecycle, typeFolder.file.id);
      lifecycleFolder.created ? createdFolders++ : existingFolders++;
      folders[`documents.${type}.${lifecycle}`] = lifecycleFolder.file.id;
    }
  }

  return {
    rootFolderId: root.file.id,
    rootFolderUrl: `https://drive.google.com/drive/folders/${root.file.id}`,
    folders,
    modelFiles,
    createdFolders,
    existingFolders,
    uploadedModels,
    existingModels
  };
}

function normalizeDocumentModelType(value:string):string{
  const normalized=String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9]+/g,'_').replace(/^_+|_+$/g,'').slice(0,48);
  if(normalized.length<2)throw new Error('Tipo de modelo documental inválido.');
  return normalized;
}

async function ensureDocumentModelFolders(accessToken:string,manifest:GoogleDriveManifest,rawType:string):Promise<{type:string;activeFolderId:string;historyFolderId:string}>{
  const type=normalizeDocumentModelType(rawType);
  let typeFolderId=manifest.folders[`documents.${type}`];
  if(!typeFolderId){
    const known=(DRIVE_FOLDER_NAMES.modelTypes as Record<string,string>)[type];
    const folderName=known||`99_${type}`;
    typeFolderId=(await ensureFolder(accessToken,folderName,manifest.folders.models)).file.id;
    manifest.folders[`documents.${type}`]=typeFolderId;
  }
  for(const lifecycle of DRIVE_FOLDER_NAMES.modelLifecycles){
    const key=`documents.${type}.${lifecycle}`;
    if(!manifest.folders[key])manifest.folders[key]=(await ensureFolder(accessToken,lifecycle,typeFolderId)).file.id;
  }
  return{type,activeFolderId:manifest.folders[`documents.${type}.00_MODELO_ATIVO`],historyFolderId:manifest.folders[`documents.${type}.01_HISTORICO_MODELOS`]};
}

async function listChildren(accessToken:string,parentId:string):Promise<DriveFile[]>{
  const params=new URLSearchParams({q:`'${escapeDriveQuery(parentId)}' in parents and trashed = false`,fields:'files(id,name,mimeType,webViewLink,parents)',pageSize:'100',spaces:'drive'});
  return (await driveJson<{files?:DriveFile[]}>(accessToken,`${DRIVE_API}/files?${params}`)).files||[];
}

export interface DriveModelFingerprint {
  contentSha256: string;
  driveRevisionId: string;
  driveModifiedTime: string;
}

async function canonicalDocxSha256(bytes:Buffer):Promise<string>{
  const JSZip=(await import('jszip')).default;
  const zip=await JSZip.loadAsync(bytes,{checkCRC32:true});
  if(!zip.file('word/document.xml'))throw new Error('O modelo não contém a estrutura obrigatória de um DOCX.');
  const digest=createHash('sha256');
  for(const name of Object.keys(zip.files).filter(name=>!zip.files[name].dir).sort()){
    digest.update(name,'utf8');digest.update('\0');digest.update(await zip.files[name].async('nodebuffer'));digest.update('\0');
  }
  return digest.digest('hex');
}

async function readDriveModelFingerprint(accessToken:string,fileId:string):Promise<DriveModelFingerprint>{
  const metadata=await driveJson<DriveFile>(accessToken,`${DRIVE_API}/files/${encodeURIComponent(fileId)}?fields=id,name,mimeType,modifiedTime,version,headRevisionId&supportsAllDrives=true`);
  const mediaUrl=metadata.mimeType===GOOGLE_DOC_MIME
    ?`${DRIVE_API}/files/${encodeURIComponent(fileId)}/export?mimeType=${encodeURIComponent(DOCX_MIME)}`
    :`${DRIVE_API}/files/${encodeURIComponent(fileId)}?alt=media&supportsAllDrives=true`;
  const response=await fetch(mediaUrl,{headers:{Authorization:`Bearer ${accessToken}`},signal:AbortSignal.timeout(30_000)});
  if(!response.ok)throw new Error(`Não foi possível fixar a versão do modelo no Drive (${response.status}).`);
  const bytes=Buffer.from(await response.arrayBuffer());
  if(!bytes.length||bytes.length>12*1024*1024||bytes.subarray(0,2).toString('hex')!=='504b')throw new Error('O modelo ativo não é um DOCX válido ou ultrapassa 12 MB.');
  return{
    contentSha256:await canonicalDocxSha256(bytes),
    driveRevisionId:String(metadata.headRevisionId||metadata.version||''),
    driveModifiedTime:String(metadata.modifiedTime||'')
  };
}

export async function verifyMasterDocumentModelFingerprint(input:{accessToken:string;fileId:string;contentSha256:string;driveRevisionId?:string;driveModifiedTime?:string}):Promise<DriveModelFingerprint>{
  if(!/^[a-f0-9]{64}$/.test(String(input.contentSha256||'')))throw new Error('O modelo ativo não possui um hash publicado. Publique uma nova versão em Configurações.');
  const current=await readDriveModelFingerprint(input.accessToken,input.fileId);
  if(current.contentSha256!==input.contentSha256||Boolean(input.driveRevisionId&&current.driveRevisionId!==input.driveRevisionId)||Boolean(input.driveModifiedTime&&current.driveModifiedTime!==input.driveModifiedTime)){
    throw new Error('O modelo foi alterado diretamente no Google Drive. Revise e publique uma nova versão em Configurações antes de gerar documentos.');
  }
  return current;
}

export async function publishMasterDocumentModel(input:{type:string;fileName:string;content:Buffer;rootFolderName?:string}){
  if(!input.content.length||input.content.length>12*1024*1024)throw new Error('O modelo deve ter entre 1 byte e 12 MB.');
  if(input.content.subarray(0,2).toString('hex')!=='504b')throw new Error('O arquivo informado não é um DOCX válido.');
  const token=await getGoogleWorkspaceAccessToken();
  const manifest=await bootstrapGoogleDriveStructure(token,{rootFolderName:input.rootFolderName});
  const {type,activeFolderId,historyFolderId}=await ensureDocumentModelFolders(token,manifest,input.type);
  for(const current of await listChildren(token,activeFolderId)){
    const stamp=new Date().toISOString().replace(/[:.]/g,'-');
    await driveJson(token,`${DRIVE_API}/files/${current.id}?addParents=${encodeURIComponent(historyFolderId)}&removeParents=${encodeURIComponent(activeFolderId)}&fields=id`,{method:'PATCH',body:JSON.stringify({name:`HISTORICO_${type}_${stamp}_${current.name}`.slice(0,180),appProperties:{documentType:type,lifecycle:'historical-model',archivedAt:new Date().toISOString()}})});
  }
  const fileName=`MODELO_ATIVO_${type}.docx`;
  const uploaded=await uploadBinary(token,{name:fileName,parentId:activeFolderId,mimeType:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',content:input.content,appProperties:{documentType:type,lifecycle:'active-model',uploadedBy:'master'}});
  const fingerprint=await readDriveModelFingerprint(token,uploaded.id);
  return {id:uploaded.id,name:uploaded.name,webViewLink:uploaded.webViewLink||`https://drive.google.com/file/d/${uploaded.id}/view`,rootFolderId:manifest.rootFolderId,...fingerprint};
}

export async function registerMasterDocumentModelFromDrive(input:{type:string;linkOrId:string;rootFolderName?:string}){
  if(!existingDriveModelLinkImportEnabled()){
    throw new Error('A importação por link está desativada nesta instalação. Envie o arquivo DOCX; para habilitar links, o administrador precisa autorizar explicitamente o escopo Google Drive somente leitura.');
  }
  const sourceId=extractDriveFileId(input.linkOrId);
  const token=await getGoogleWorkspaceAccessToken();
  const source=await driveJson<DriveFile&{trashed?:boolean;capabilities?:{canCopy?:boolean}}>(token,`${DRIVE_API}/files/${encodeURIComponent(sourceId)}?fields=id,name,mimeType,webViewLink,parents,trashed,capabilities(canCopy)&supportsAllDrives=true`);
  if(source.trashed)throw new Error('O modelo selecionado está na lixeira.');
  if(source.mimeType!==GOOGLE_DOC_MIME&&source.mimeType!==DOCX_MIME)throw new Error('O modelo deve ser um Google Docs nativo ou um arquivo DOCX.');
  if(source.capabilities?.canCopy===false)throw new Error('A conta Google conectada não pode copiar este modelo. Compartilhe o arquivo com essa conta ou envie o DOCX.');

  let variables:string[]=[];
  if(source.mimeType===GOOGLE_DOC_MIME){
    const document=await driveJson<Record<string,unknown>>(token,`https://docs.googleapis.com/v1/documents/${encodeURIComponent(sourceId)}?includeTabsContent=true`);
    variables=extractModelVariables(collectGoogleDocText(document).join('\n'));
  }else{
    const response=await fetch(`${DRIVE_API}/files/${encodeURIComponent(sourceId)}?alt=media&supportsAllDrives=true`,{headers:{Authorization:`Bearer ${token}`},signal:AbortSignal.timeout(20_000)});
    if(!response.ok)throw new Error(`Não foi possível validar o DOCX do Drive (${response.status}).`);
    const bytes=Buffer.from(await response.arrayBuffer());
    if(!bytes.length||bytes.length>12*1024*1024||bytes.subarray(0,2).toString('hex')!=='504b')throw new Error('O DOCX do Drive é inválido ou ultrapassa 12 MB.');
    // O conteúdo será inspecionado novamente pelo motor durante a geração; aqui
    // registramos as variáveis detectáveis sem armazenar o arquivo no portal.
    const JSZip=(await import('jszip')).default;
    const zip=await JSZip.loadAsync(bytes);
    const pieces:string[]=[];
    for(const name of Object.keys(zip.files).filter(name=>/^word\/(document|header\d*|footer\d*)\.xml$/.test(name))){
      const xml=await zip.file(name)!.async('string');
      pieces.push(xml.replace(/<w:tab\/?\s*>/g,'\t').replace(/<\/w:p>/g,'\n').replace(/<[^>]+>/g,'').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&'));
    }
    variables=extractModelVariables(pieces.join('\n'));
  }

  const manifest=await bootstrapGoogleDriveStructure(token,{rootFolderName:input.rootFolderName});
  const {type,activeFolderId,historyFolderId}=await ensureDocumentModelFolders(token,manifest,input.type);
  for(const current of await listChildren(token,activeFolderId)){
    const stamp=new Date().toISOString().replace(/[:.]/g,'-');
    await driveJson(token,`${DRIVE_API}/files/${current.id}?addParents=${encodeURIComponent(historyFolderId)}&removeParents=${encodeURIComponent(activeFolderId)}&fields=id`,{method:'PATCH',body:JSON.stringify({name:`HISTORICO_${type}_${stamp}_${current.name}`.slice(0,180),appProperties:{documentType:type,lifecycle:'historical-model',archivedAt:new Date().toISOString()}})});
  }
  const activeName=source.mimeType===GOOGLE_DOC_MIME?`MODELO_ATIVO_${type}`:`MODELO_ATIVO_${type}.docx`;
  const copied=await driveJson<DriveFile>(token,`${DRIVE_API}/files/${encodeURIComponent(sourceId)}/copy?fields=id,name,mimeType,webViewLink,parents&supportsAllDrives=true`,{method:'POST',body:JSON.stringify({name:activeName,parents:[activeFolderId],appProperties:{portal:'portal-tcc',documentType:type,lifecycle:'active-model',sourceModelId:sourceId}})});
  const fingerprint=await readDriveModelFingerprint(token,copied.id);
  return{id:copied.id,name:copied.name,mimeType:copied.mimeType,webViewLink:copied.webViewLink||`https://drive.google.com/file/d/${copied.id}/view`,rootFolderId:manifest.rootFolderId,variables,...fingerprint};
}

function sanitizeHeader(value: string): string { return value.replace(/[\r\n]+/g, ' ').trim(); }
function encodeMimeHeader(value: string): string {
  const safe = sanitizeHeader(value);
  return /^[\x20-\x7E]*$/.test(safe) ? safe : `=?UTF-8?B?${Buffer.from(safe, 'utf8').toString('base64')}?=`;
}

export interface GmailMessageInput { to: string; subject: string; text: string; html?: string; attachments?: Array<{ fileName: string; mimeType: string; content: Buffer }> }

export function buildGmailRawMessage(input: GmailMessageInput, boundarySeed = Date.now().toString(36)): string {
  const alternativeBoundary = `portal-tcc-alt-${boundarySeed}`;
  const body = input.html
    ? [
        `Content-Type: multipart/alternative; boundary="${alternativeBoundary}"`,
        '',
        `--${alternativeBoundary}`,
        'Content-Type: text/plain; charset="UTF-8"',
        '',
        input.text,
        `--${alternativeBoundary}`,
        'Content-Type: text/html; charset="UTF-8"',
        '',
        input.html,
        `--${alternativeBoundary}--`
      ].join('\r\n')
    : ['Content-Type: text/plain; charset="UTF-8"', '', input.text].join('\r\n');
  const attachments=input.attachments||[];
  const attachmentBytes=attachments.reduce((sum,item)=>sum+item.content.length,0);
  if(attachmentBytes>20*1024*1024)throw new Error('Os anexos do e-mail ultrapassam o limite seguro de 20 MB.');
  const mixedBoundary=`portal-tcc-mixed-${boundarySeed}`;
  const content=attachments.length?[
    `Content-Type: multipart/mixed; boundary="${mixedBoundary}"`,
    '',
    `--${mixedBoundary}`,
    body,
    ...attachments.flatMap(item=>{
      const fileName=sanitizeHeader(item.fileName).replace(/["\\]/g,'_').slice(0,180)||'documento.pdf';
      const encoded=item.content.toString('base64').match(/.{1,76}/g)?.join('\r\n')||'';
      return [`--${mixedBoundary}`,`Content-Type: ${sanitizeHeader(item.mimeType)||'application/octet-stream'}; name="${fileName}"`,'Content-Transfer-Encoding: base64',`Content-Disposition: attachment; filename="${fileName}"`,'',encoded];
    }),
    `--${mixedBoundary}--`
  ].join('\r\n'):body;
  return [
    `To: ${sanitizeHeader(input.to)}`,
    `Subject: ${encodeMimeHeader(input.subject)}`,
    'MIME-Version: 1.0',
    content
  ].join('\r\n');
}

export async function sendGmailMessage(input: GmailMessageInput): Promise<{id?:string;threadId?:string}> {
  const accessToken = await getGoogleWorkspaceAccessToken();
  const raw = buildGmailRawMessage(input);
  const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      Accept: 'application/json'
    },
    body: JSON.stringify({ raw: Buffer.from(raw, 'utf8').toString('base64url') }),
    signal: AbortSignal.timeout(20_000)
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(String(payload?.error?.message || `Gmail respondeu ${response.status}.`));
  }
  const payload=await response.json().catch(()=>({}));
  return {id:payload?.id?String(payload.id):undefined,threadId:payload?.threadId?String(payload.threadId):undefined};
}
