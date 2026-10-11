import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from 'crypto';
import { loadIntegrationSecret, saveIntegrationSecret } from './integrationSecrets';

const API_BASE = 'https://plataforma.astenassinatura.com.br/api';
const SESSION_TTL_MS = 10 * 60 * 1000;
const MAX_ASTEN_JSON_BYTES = 72 * 1024 * 1024;
const MAX_ASTEN_PDF_BYTES = 50 * 1024 * 1024;
const MAX_ASTEN_TOKEN_LENGTH = 4096;
const MAX_PROVIDER_ERROR_LENGTH = 300;
const MAX_ASTEN_SESSION_ID_LENGTH = 16 * 1024;
const ASTEN_WEBHOOK_PATH = '/api/integrations/asten/webhook';
type Service = 'getIdentificador' | 'getRepositoriosDoUsuario' | 'inserirEnvelope' | 'encaminharEnvelopeParaAssinaturas' | 'getDadosEnvelope' | 'getSignatariosPorEnvelope' | 'downloadPDFEnvelopeDocs' | 'getDocumentosEXMLsAssinadosDoEnvelope' | 'reenviarLinksDeAssinatura' | 'cancelarEnvelope';
const allowed = new Set<Service>(['getIdentificador','getRepositoriosDoUsuario','inserirEnvelope','encaminharEnvelopeParaAssinaturas','getDadosEnvelope','getSignatariosPorEnvelope','downloadPDFEnvelopeDocs','getDocumentosEXMLsAssinadosDoEnvelope','reenviarLinksDeAssinatura','cancelarEnvelope']);
interface Session { token: string; ownerEmail: string; identifier: string; repositoryId?: number; expiresAt: number; }
const sessions = new Map<string, Session>();
const enabled = () => process.env.ASTEN_INTEGRATION_ENABLED === 'true';
const storedToken = () => process.env.ASTEN_ALLOW_STORED_TOKEN === 'true' ? String(process.env.ASTEN_API_KEY || '').trim() || null : null;
const MIN_WEBHOOK_SECRET_LENGTH = 32;

function assertValidAstenToken(token: string): void {
  if (token.length < 12 || token.length > MAX_ASTEN_TOKEN_LENGTH || /[\u0000-\u001f\u007f]/.test(token)) {
    throw new Error('Configuração Asten inválida.');
  }
}

function safeProviderError(value: unknown, token: string, fallback: string): string {
  let message = String(value || fallback).replace(/[\u0000-\u001f\u007f]+/g, ' ').trim();
  if (token) message = message.split(token).join('[credencial omitida]');
  return (message || fallback).slice(0, MAX_PROVIDER_ERROR_LENGTH);
}

export interface AstenSecurityPreflight {
  callbackUrl: string;
  callbackUrlSecure: boolean;
  callbackSameOrigin: boolean;
  callbackEndpointValid: boolean;
  webhookSecretStrong: boolean;
  webhookSecretSeparated: boolean;
  signerLoginRequired: boolean;
  signerCodeRequired: boolean;
  authenticationMethodSupported: boolean;
  callbackConfigured: boolean;
  issues: string[];
}

function isSecureCallbackUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' && Boolean(parsed.hostname) && !parsed.username && !parsed.password;
  } catch {
    return false;
  }
}

export function getAstenSecurityPreflight(): AstenSecurityPreflight {
  const callbackUrl = String(process.env.ASTEN_CALLBACK_URL || '').trim();
  const webhookSecret = String(process.env.ASTEN_WEBHOOK_SECRET || '').trim();
  const callbackUrlSecure = isSecureCallbackUrl(callbackUrl);
  const expectedPortalUrl = String(process.env.PORTAL_PUBLIC_URL || process.env.APP_URL || '').trim();
  let callbackSameOrigin = false;
  let callbackEndpointValid = false;
  if (callbackUrlSecure) {
    try {
      const parsedCallback = new URL(callbackUrl);
      callbackEndpointValid =
        parsedCallback.pathname === ASTEN_WEBHOOK_PATH &&
        parsedCallback.search === '' &&
        parsedCallback.hash === '';
      if (expectedPortalUrl) callbackSameOrigin = parsedCallback.origin === new URL(expectedPortalUrl).origin;
    } catch {
      callbackSameOrigin = false;
      callbackEndpointValid = false;
    }
  }
  const webhookSecretStrong =
    webhookSecret.length >= MIN_WEBHOOK_SECRET_LENGTH &&
    webhookSecret.length <= 4096 &&
    !/[\u0000-\u001f\u007f]/.test(webhookSecret);
  const otherSecrets = [
    process.env.PORTAL_SESSION_SECRET,
    process.env.PORTAL_OTP_PEPPER,
    process.env.PORTAL_SECRET_ENCRYPTION_KEY,
    process.env.PORTAL_SECRET_ENCRYPTION_KEY_V2,
    process.env.PORTAL_VERIFICATION_SECRET,
    process.env.PORTAL_UPLOAD_BINDING_SECRET,
    process.env.CRON_SECRET,
    process.env.ASTEN_SESSION_ENCRYPTION_KEY
  ].map(value => String(value || '').trim()).filter(Boolean);
  const webhookSecretSeparated = Boolean(webhookSecret) && !otherSecrets.includes(webhookSecret);
  const signerLoginRequired = process.env.ASTEN_REQUIRE_LOGIN !== 'false';
  // Asten exigirCodigo requires a manually distributed code, not delivered by the provider.
  const signerCodeRequired = process.env.ASTEN_REQUIRE_CODE !== 'false';
  const authenticationMethodSupported = [1, 2, 3, 5, 6].includes(Number(process.env.ASTEN_AUTHENTICATION_OPTION || 0));
  const issues: string[] = [];
  if (!callbackUrlSecure) issues.push('Configure ASTEN_CALLBACK_URL com uma URL HTTPS válida, sem credenciais embutidas.');
  if (!expectedPortalUrl) issues.push('Configure PORTAL_PUBLIC_URL para validar a origem do callback Asten.');
  if (!callbackSameOrigin) issues.push('ASTEN_CALLBACK_URL deve usar a mesma origem pública do portal.');
  if (!callbackEndpointValid) issues.push(`ASTEN_CALLBACK_URL deve apontar exatamente para ${ASTEN_WEBHOOK_PATH}, sem query string ou fragmento.`);
  if (!webhookSecretStrong) issues.push(`Configure ASTEN_WEBHOOK_SECRET com pelo menos ${MIN_WEBHOOK_SECRET_LENGTH} caracteres válidos e sem controles.`);
  if (!webhookSecretSeparated) issues.push('ASTEN_WEBHOOK_SECRET deve ser exclusivo e diferente dos demais segredos do portal.');
  if (!signerLoginRequired) issues.push('ASTEN_REQUIRE_LOGIN não pode ser desativado neste portal.');
  if (signerCodeRequired) issues.push('Defina ASTEN_REQUIRE_CODE=false: o código manual não dispõe de entrega independente segura.');
  if (!authenticationMethodSupported) issues.push('Configure ASTEN_AUTHENTICATION_OPTION como 1, 2, 3, 5 ou 6. SMS e WhatsApp exigem celular verificado.');
  return {
    callbackUrl,
    callbackUrlSecure,
    callbackSameOrigin,
    callbackEndpointValid,
    webhookSecretStrong,
    webhookSecretSeparated,
    signerLoginRequired,
    signerCodeRequired,
    authenticationMethodSupported,
    callbackConfigured:
      callbackUrlSecure &&
      callbackSameOrigin &&
      callbackEndpointValid &&
      webhookSecretStrong &&
      webhookSecretSeparated &&
      signerLoginRequired &&
      !signerCodeRequired &&
      authenticationMethodSupported,
    issues
  };
}

export function assertAstenDispatchPreflight(): AstenSecurityPreflight {
  const preflight = getAstenSecurityPreflight();
  if (!preflight.callbackConfigured) {
    throw new Error(`O envio Asten está bloqueado: ${preflight.issues.join(' ')}`);
  }
  return preflight;
}
const sessionEncryptionKey = (): Buffer | null => {
  const raw = String(process.env.ASTEN_SESSION_ENCRYPTION_KEY || '').trim();
  if (!raw) return null;
  if (/^[a-f0-9]{64}$/i.test(raw)) return Buffer.from(raw, 'hex');
  try { const key = Buffer.from(raw, 'base64'); return key.length === 32 ? key : null; } catch { return null; }
};

function sealSession(session: Session): string {
  const key = sessionEncryptionKey();
  if (!key) throw new Error('A chave de sessão Asten do servidor não foi configurada.');
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(Buffer.from('portal-tcc-asten-session-v1'));
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(session), 'utf8'), cipher.final()]);
  return ['v1', iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), encrypted.toString('base64url')].join('.');
}

function openSealedSession(id: string): Session | null {
  if (id.length > MAX_ASTEN_SESSION_ID_LENGTH) throw new Error('Sessão Asten inválida ou adulterada.');
  if (!id.startsWith('v1.')) return null;
  const key = sessionEncryptionKey();
  if (!key) throw new Error('A chave de sessão Asten do servidor não está disponível.');
  try {
    const [, iv, tag, encrypted] = id.split('.');
    const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64url'));
    decipher.setAAD(Buffer.from('portal-tcc-asten-session-v1'));
    decipher.setAuthTag(Buffer.from(tag, 'base64url'));
    return JSON.parse(Buffer.concat([decipher.update(Buffer.from(encrypted, 'base64url')), decipher.final()]).toString('utf8')) as Session;
  } catch { throw new Error('Sessão Asten inválida ou adulterada.'); }
}

export async function callAsten(service: Service, params: Record<string, unknown>, token: string): Promise<any> {
  // Permite testar e conectar a conta sem habilitar criação de envelopes ou envios.
  if(!enabled()&&!['getIdentificador','getRepositoriosDoUsuario'].includes(service))throw new Error('A integração Asten está bloqueada para operações de documentos.');
  if (!allowed.has(service)) throw new Error('Serviço Asten não permitido.');
  const apiToken = String(token || '').trim();
  if (new URL(API_BASE).protocol !== 'https:' || new URL(API_BASE).hostname !== 'plataforma.astenassinatura.com.br') throw new Error('Configuração Asten inválida.');
  assertValidAstenToken(apiToken);
  const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 30000);
  try {
    const response = await fetch(`${API_BASE}/${service}`, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'x-api-key': apiToken },
      body: JSON.stringify({ params }),
      signal: controller.signal,
      redirect: 'error',
      cache: 'no-store'
    });
    const contentLength = Number(response.headers.get('content-length') || 0);
    if (Number.isFinite(contentLength) && contentLength > MAX_ASTEN_JSON_BYTES) throw new Error('A resposta da Asten excedeu o limite seguro do portal.');
    const raw = await response.text();
    if (Buffer.byteLength(raw, 'utf8') > MAX_ASTEN_JSON_BYTES) throw new Error('A resposta da Asten excedeu o limite seguro do portal.');
    const payload = (() => { try { return raw ? JSON.parse(raw) : {}; } catch { return {}; } })();
    if (!response.ok || payload?.error) {
      if (response.status === 401 || response.status === 403) {
        throw new Error('Asten rejeitou a credencial ou a autorização da conta.');
      }
      const fallback = `Asten respondeu ${response.status}.`;
      throw new Error(safeProviderError(payload?.error?.message || payload?.error?.descricao, apiToken, fallback));
    }
    return payload?.response ?? payload;
  } finally { clearTimeout(timer); }
}

export function parseAstenAccountAndRepository(identity: unknown, repositories: unknown, configuredRepositoryId: string | undefined): {identifier:string;repositoryId:number} {
  const ownerId=Number((identity as any)?.Usuario?.id);
  if(!Number.isSafeInteger(ownerId)||ownerId<=0)throw new Error('A Asten não retornou Usuario.id válido para esta conta.');
  if(!Array.isArray(repositories))throw new Error('A Asten não retornou a lista de repositórios esperada.');
  const authorized=repositories.filter((item:any)=>{
    const id=Number(item?.id),owner=Number(item?.Usuario?.id);
    return Number.isSafeInteger(id)&&id>0&&owner===ownerId&&(item?.isProprietario==='S'||item?.compartilharCriacaoDocs==='S');
  });
  const requested=String(configuredRepositoryId||'').trim();
  if(requested&&!/^[1-9][0-9]*$/.test(requested))throw new Error('ASTEN_REPOSITORY_ID deve ser um ID numérico válido.');
  const selected=requested?authorized.find((item:any)=>Number(item.id)===Number(requested)):authorized.length===1?authorized[0]:undefined;
  if(!selected)throw new Error(requested?'O repositório Asten informado não pertence à conta ou não permite criar envelopes.':'Configure ASTEN_REPOSITORY_ID: nenhum repositório único e autorizado foi localizado.');
  return {identifier:String(ownerId),repositoryId:Number(selected.id)};
}
export async function createEphemeralAstenSession(ownerEmail: string, suppliedToken?: string) {
  const token = String(suppliedToken || storedToken() || '').trim();
  if (!token) throw new Error('Informe o token Asten para esta sessão protegida. Ele não será persistido.');
  const identity = await callAsten('getIdentificador', {}, token);
  const ownerId=Number(identity?.Usuario?.id);
  if(!Number.isSafeInteger(ownerId)||ownerId<=0)throw new Error('A Asten não retornou o ID da conta.');
  const repositories=await callAsten('getRepositoriosDoUsuario',{idProprietario:ownerId},token);
  const account=parseAstenAccountAndRepository(identity,repositories,process.env.ASTEN_REPOSITORY_ID);
  const id = randomBytes(32).toString('base64url');
  const session: Session = { token, ownerEmail: ownerEmail.toLowerCase(), identifier:account.identifier, repositoryId:account.repositoryId, expiresAt: Date.now() + SESSION_TTL_MS };
  const key = sessionEncryptionKey();
  if (!key && (process.env.VERCEL || process.env.NODE_ENV === 'production')) throw new Error('Configure ASTEN_SESSION_ENCRYPTION_KEY antes de usar sessões temporárias em produção.');
  const sessionId = key ? sealSession(session) : id;
  if (!key) sessions.set(id, session);
  purge();
  return { sessionId, expiresAt: new Date(session.expiresAt).toISOString(), astenIdentifier: session.identifier, repositoryConfigured: Boolean(session.repositoryId) };
}
function purge() { for (const [id, session] of sessions) if (session.expiresAt <= Date.now()) sessions.delete(id); }
export function getEphemeralAstenSession(id: string, email: string): Session { purge(); const session = openSealedSession(id) || sessions.get(id); if (!session || session.expiresAt <= Date.now()) throw new Error('Sessão Asten ausente ou expirada.'); if (session.ownerEmail !== email.toLowerCase()) throw new Error('Sessão Asten pertence a outro usuário.'); return session; }

export function getAstenIntegrationStatus() {
  const stored = Boolean(storedToken());
  purge();
  const activeSession = sessions.size > 0;
  const statelessSessionReady = Boolean(sessionEncryptionKey());
  const security = getAstenSecurityPreflight();
  const credentialReady = stored || statelessSessionReady || (!process.env.VERCEL && process.env.NODE_ENV !== 'production');
  return { enabled: enabled(), mode: enabled() ? (stored ? 'SERVER_SECRET' : statelessSessionReady ? 'STATELESS_ENCRYPTED_SESSION' : 'EPHEMERAL_SESSION') : 'DISABLED', configured: stored || statelessSessionReady || activeSession, dispatchEnabled: enabled() && credentialReady && security.callbackConfigured, sessionTtlMinutes: 10, callbackConfigured: security.callbackConfigured, securityIssues: security.issues, securityMessage: !enabled() ? 'Integração bloqueada. Ative somente depois de configurar autenticação e segredos no servidor.' : security.callbackConfigured ? 'Todo envio exige autenticação, callback HTTPS e webhook autenticado.' : `Envio bloqueado: ${security.issues.join(' ')}` } as const;
}

export async function connectPersistentAsten(tokenInput: string) {
  const token = String(tokenInput || '').trim();
  if (!token) throw new Error('Informe o token da API Asten.');
  const identity = await callAsten('getIdentificador', {}, token);
  const ownerId=Number(identity?.Usuario?.id);
  if(!Number.isSafeInteger(ownerId)||ownerId<=0)throw new Error('A Asten não retornou o ID da conta.');
  const repositories=await callAsten('getRepositoriosDoUsuario',{idProprietario:ownerId},token);
  const {repositoryId,identifier}=parseAstenAccountAndRepository(identity,repositories,process.env.ASTEN_REPOSITORY_ID);
  await saveIntegrationSecret('asten', token, {
    identifier,
    repositoryId,
    validatedContractVersion:2,
    connectedAt: new Date().toISOString()
  });
  return { identifier, repositoryId, connectedAt: new Date().toISOString() };
}

export async function getPersistentAstenConnection(): Promise<{ token: string; identifier: string; repositoryId: number } | null> {
  const stored = await loadIntegrationSecret('asten').catch(() => null);
  if (!stored?.value||stored.metadata?.validatedContractVersion!==2) return null;
  const repositoryId = Number(stored.metadata?.repositoryId || process.env.ASTEN_REPOSITORY_ID || 0);
  if (!repositoryId) return null;
  return { token: stored.value, identifier: String(stored.metadata?.identifier || ''), repositoryId };
}

export async function getPersistentAstenStatus() {
  const connection = await getPersistentAstenConnection();
  const security = getAstenSecurityPreflight();
  return {
    enabled: enabled(),
    mode: enabled() ? 'ENCRYPTED_PERSISTENT_TOKEN' : 'DISABLED',
    configured: Boolean(connection),
    dispatchEnabled: enabled() && Boolean(connection) && security.callbackConfigured,
    sessionTtlMinutes: 0,
    callbackConfigured: security.callbackConfigured,
    securityIssues: security.issues,
    connectedIdentifier: connection?.identifier || '',
    securityMessage: !connection
      ? 'Conecte a conta Asten em Configurações. O token nunca é devolvido ao navegador.'
      : security.callbackConfigured
        ? 'Token criptografado no servidor, callback HTTPS e webhook autenticado. O envio ocorre somente por ação autorizada.'
        : `Envio bloqueado: ${security.issues.join(' ')}`
  } as const;
}

export function buildAstenEnvelopeParams(input: { description: string; fileName: string; mimeType: string; contentBase64: string; signers: Array<{name:string;email:string;order:number}>; repositoryId?: number; }) {
  if (!input.repositoryId) throw new Error('Nenhum repositório Asten foi localizado.');
  const security = assertAstenDispatchPreflight();
  const description = String(input.description || '').trim();
  const fileName = String(input.fileName || '').trim();
  const mimeType = String(input.mimeType || '').trim().toLowerCase();
  const compactBase64 = String(input.contentBase64 || '').replace(/\s/g, '');
  if (!description || description.length > 300) throw new Error('Descrição do envelope Asten inválida.');
  if (!fileName.toLowerCase().endsWith('.pdf') || fileName.length > 180 || /[\r\n]/.test(fileName)) throw new Error('Nome do PDF Asten inválido.');
  if (mimeType !== 'application/pdf') throw new Error('Somente PDF pode ser encaminhado à Asten.');
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(compactBase64) || compactBase64.length > Math.ceil(MAX_ASTEN_PDF_BYTES * 4 / 3) + 4) throw new Error('Conteúdo PDF Asten inválido ou acima do limite seguro.');
  const pdf = Buffer.from(compactBase64, 'base64');
  if (!pdf.length || pdf.length > MAX_ASTEN_PDF_BYTES || pdf.subarray(0, 5).toString('ascii') !== '%PDF-') throw new Error('Conteúdo PDF Asten inválido ou acima do limite seguro.');
  if (!Array.isArray(input.signers) || input.signers.length < 1 || input.signers.length > 20) throw new Error('A lista de signatários Asten é inválida.');
  const normalizedSigners = input.signers.map((signer) => ({
    name: String(signer.name || '').trim(),
    email: String(signer.email || '').trim().toLowerCase(),
    order: Number(signer.order)
  }));
  if (normalizedSigners.some((signer) => !signer.name || signer.name.length > 200 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(signer.email) || !Number.isSafeInteger(signer.order) || signer.order < 1 || signer.order > 50)) {
    throw new Error('Há signatário Asten com nome, e-mail ou ordem inválidos.');
  }
  if (new Set(normalizedSigners.map((signer) => signer.email)).size !== normalizedSigners.length) throw new Error('A lista Asten contém signatários duplicados.');
  const requireLogin = process.env.ASTEN_REQUIRE_LOGIN === 'false' ? 'N' : 'S';
  const authenticationOption = Number(process.env.ASTEN_AUTHENTICATION_OPTION || 0);
  if(![1,2,3,5,6].includes(authenticationOption))throw new Error('ASTEN_AUTHENTICATION_OPTION não homologada. SMS/WhatsApp exigem telefone e código manual requer entrega segura.');
  const envelope: Record<string, unknown> = { descricao: description, usarOrdem:'S', Repositorio: { id: input.repositoryId }, listaDocumentos: { Documento: [{ nomeArquivo: fileName, mimeType, conteudo: compactBase64 }] }, listaSignatariosEnvelope: { SignatarioEnvelope: normalizedSigners.map((s) => ({ ordem: s.order, ConfigAssinatura: { emailSignatario: s.email, nomeSignatario: s.name, opcaoAutenticacao: authenticationOption, tipoAssinatura: 1, permitirDelegar: 'N', exigirLogin: requireLogin, exigirCodigo: 'N', exigirDadosIdentif: 'S' } })) }, confidencial: 'S', exigirLeitura: 'S', bloquearDesenhoPaginas: 'S' };
  envelope.urlCallback = security.callbackUrl;
  envelope.urlCallbackHeaderProp = 'x-portal-webhook-key';
  envelope.urlCallbackHeaderValue = String(process.env.ASTEN_WEBHOOK_SECRET || '').trim();
  return { Envelope: envelope, encaminharImediatamente: 'N', detectarCampos: 'N', verificarDuplicidadeConteudo: 'S', processarImagensEmSegundoPlano: 'N' };
}
export function extractAstenEnvelopeIdentity(response: any) { const data = response?.data ?? response; const id = data?.idEnvelope ?? data?.Envelope?.id ?? data?.id; if (!id) throw new Error('A Asten não retornou o ID do envelope; reconciliação manual necessária.'); return { id: String(id), hash: data?.hashSHA256 ? String(data.hashSHA256) : undefined }; }
export function assertAstenEnvelopeSigners(response: unknown, expected: Array<{email:string;order:number}>): void {
  const evidence:Array<{email:string;order:number;signed:boolean}>=[];
  const normalizedStatus=(value:unknown)=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const visit=(value:any):void=>{
    if(Array.isArray(value)){value.forEach(visit);return;}
    if(!value||typeof value!=='object')return;
    const config=value.ConfigAssinatura||value.configAssinatura||value.configuracaoAssinatura||{};
    const email=String(value.emailSignatario||value.email||config.emailSignatario||config.email||'').trim().toLowerCase();
    if(/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)){
      const order=Number(value.ordem??value.ordemAssinatura??value.sequencia??config.ordem??config.ordemAssinatura);
      const signedAt=value.dataAssinatura||value.dataHoraAssinatura||value.dhAssinatura||value.signedAt||value.momentoAssinatura;
      const flag=value.assinado??value.assinaturaRealizada??value.signed;
      const flagText=normalizedStatus(flag);
      const rawStatus=value.statusAssinatura??value.situacaoAssinatura??value.status??value.situacao;
      const statusText=normalizedStatus(rawStatus);
      const negativeStatus=/(^|\b)(nao[ _-]?assinado|pendente|aguardando|recusad|cancelad|expirad|nao[ _-]?conclu|nao[ _-]?finaliz)(\b|$)/.test(statusText);
      const positiveStatus=/(^|\b)(assinado|concluido|concluida|finalizado|finalizada)(\b|$)/.test(statusText);
      const numerical=String(rawStatus??'').trim();
      const signed= !negativeStatus && numerical!=='1'&&numerical!=='2'&&numerical!=='4'&&numerical!=='5'&&numerical!=='6' &&
        (numerical==='3'||Boolean(signedAt)||(typeof flag==='boolean'&&flag)||['s','sim','true','1'].includes(flagText)||positiveStatus);
      evidence.push({email,order,signed});
      return;
    }
    Object.values(value).forEach(visit);
  };
  visit(response);
  const unique=new Map<string,{email:string;order:number;signed:boolean}>();
  for(const signer of evidence){const key=`${signer.email}|${signer.order}`;const previous=unique.get(key);unique.set(key,previous?{...signer,signed:previous.signed||signer.signed}:signer);}
  const actual=[...unique.values()];
  const wanted=expected.map(signer=>({email:String(signer.email||'').trim().toLowerCase(),order:Number(signer.order)}));
  if(!actual.length)throw new Error('A Asten não devolveu evidência verificável dos signatários; o PDF não será arquivado.');
  if(actual.length!==wanted.length||wanted.some(signer=>!actual.some(item=>item.email===signer.email&&item.order===signer.order)))throw new Error('Os signatários ou a ordem do envelope Asten divergem da versão registrada no portal.');
  if(actual.some(signer=>!signer.signed))throw new Error('A Asten ainda não confirma a assinatura de todos os participantes esperados.');
}
export function extractAstenSignedPdf(response: any): Buffer {
  // API Asten: envelopeContent, com incluirDocs=N para receber PDF (S retorna ZIP).
  const data=response?.response??response;
  const mime=String(data?.mimeType||'').trim().toLowerCase();
  if(mime&&mime!=='application/pdf')throw new Error('A Asten retornou arquivo diferente de PDF. Use incluirDocs=N.');
  const raw=data?.envelopeContent??data?.pdfBase64??data?.conteudoBase64;
  if(typeof raw!=='string')throw new Error('A Asten não retornou envelopeContent Base64.');
  const encoded=raw.replace(/\s/g,'');
  if(!encoded||encoded.length>Math.ceil(MAX_ASTEN_PDF_BYTES*4/3)+4||!/^[A-Za-z0-9+/]*={0,2}$/.test(encoded))throw new Error('PDF assinado inválido ou acima do limite.');
  const pdf=Buffer.from(encoded,'base64');
  if(pdf.length<100||pdf.length>MAX_ASTEN_PDF_BYTES||pdf.subarray(0,5).toString('ascii')!=='%PDF-')throw new Error('O retorno não é um PDF assinado válido.');
  return pdf;
}
export function safeCompareWebhookSecret(received: string): boolean {
  const expected = String(process.env.ASTEN_WEBHOOK_SECRET || '').trim();
  const supplied = String(received || '').trim();
  if (expected.length < MIN_WEBHOOK_SECRET_LENGTH || supplied.length < MIN_WEBHOOK_SECRET_LENGTH) return false;
  return timingSafeEqual(createHash('sha256').update(supplied).digest(), createHash('sha256').update(expected).digest());
}
export function fingerprintWebhook(body: unknown): string { const clean = JSON.parse(JSON.stringify(body || {})); if (clean && typeof clean === 'object') { delete clean.tokenAPI; delete clean.link; delete clean.linkAssinatura; } return createHash('sha256').update(JSON.stringify(clean)).digest('hex'); }