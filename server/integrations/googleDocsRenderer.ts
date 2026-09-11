import { buildMarkerBoldRequests } from './googleDocsStyles';
const DRIVE_API = 'https://www.googleapis.com/drive/v3';
const DRIVE_UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3';
const DOCS_API = 'https://docs.googleapis.com/v1';

const GOOGLE_DOC_MIME = 'application/vnd.google-apps.document';
const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const MAX_TEMPLATE_BYTES = 16 * 1024 * 1024;
const MAX_EXPORTED_PDF_BYTES = 32 * 1024 * 1024;

type FetchLike = typeof fetch;

interface DriveTemplateMetadata {
  id: string;
  name: string;
  mimeType: string;
  trashed?: boolean;
  parents?: string[];
  capabilities?: { canCopy?: boolean; canDownload?: boolean };
}

interface GoogleDocumentReadback {
  documentId?: string;
  revisionId?: string;
  tabs?: Array<{ tabProperties?: { tabId?: string }; childTabs?: GoogleDocumentReadback['tabs'] }>;
  [key: string]: unknown;
}

export interface GoogleTemplateRenderInput {
  accessToken: string;
  templateUrlOrId: string;
  replacements: Record<string, string | number | boolean | null | undefined>;
  boldMarkers?: string[];
  temporaryParentId?: string;
  outputName?: string;
  fetchImpl?: FetchLike;
}

export interface GoogleTemplateRenderResult {
  pdf: Buffer;
  fileName: string;
  sourceFileId: string;
  sourceMimeType: typeof GOOGLE_DOC_MIME | typeof DOCX_MIME;
  convertedFromDocx: boolean;
  replacementsChanged: number;
  unresolvedMarkers: string[];
  tabCount: number;
}

export function extractGoogleDriveFileId(value: string): string {
  const input = String(value || '').trim();
  const match = input.match(/\/(?:document|file)\/d\/([a-zA-Z0-9_-]+)/)
    || input.match(/[?&]id=([a-zA-Z0-9_-]+)/)
    || input.match(/^([a-zA-Z0-9_-]{10,})$/);
  const id = match?.[1] || '';
  if (!/^[a-zA-Z0-9_-]{10,}$/.test(id)) throw new Error('Link ou ID do modelo Google inválido.');
  return id;
}

function safeGoogleMessage(payload: any, status: number, operation: string): string {
  const message = String(payload?.error?.message || '').replace(/[\r\n]+/g, ' ').slice(0, 360);
  return message ? `${operation}: ${message}` : `${operation}: Google respondeu ${status}.`;
}

async function googleRequest(fetchImpl: FetchLike, accessToken: string, url: string, init: RequestInit, operation: string): Promise<Response> {
  const response = await fetchImpl(url, {
    ...init,
    headers: { Authorization: `Bearer ${accessToken}`, ...(init.headers || {}) },
    signal: init.signal || AbortSignal.timeout(30_000)
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(safeGoogleMessage(payload, response.status, operation));
  }
  return response;
}

function normalizeVariableKey(raw: string): string {
  const key = String(raw || '')
    .trim()
    .replace(/^<<\s*|\s*>>$/g, '')
    .replace(/^\{\{\s*|\s*\}\}$/g, '')
    .replace(/^\[\[\s*|\s*\]\]$/g, '')
    .replace(/^«\s*|\s*»$/g, '')
    .replace(/^-|-$/g, '')
    .trim();
  if (!/^[\p{L}\p{N}_ ().,-]{1,100}$/u.test(key)) throw new Error(`Variável de modelo inválida: ${String(raw).slice(0, 80)}`);
  return key;
}

function replacementMarkers(key: string): string[] {
  return [`<<${key}>>`, `{{${key}}}`, `[[${key}]]`, `«${key}»`, `-${key}-`];
}

export function buildGoogleDocsReplacementRequests(
  replacements: GoogleTemplateRenderInput['replacements'],
  tabIds: string[] = []
): Array<{ replaceAllText: { containsText: { text: string; matchCase: boolean }; replaceText: string; tabsCriteria?: { tabIds: string[] } } }> {
  const requests: Array<{ replaceAllText: { containsText: { text: string; matchCase: boolean }; replaceText: string; tabsCriteria?: { tabIds: string[] } } }> = [];
  for (const [rawKey, rawValue] of Object.entries(replacements || {})) {
    const key = normalizeVariableKey(rawKey);
    const replaceText = rawValue == null ? '' : String(rawValue).normalize('NFC').slice(0, 60_000);
    for (const marker of replacementMarkers(key)) {
      requests.push({
        replaceAllText: {
          containsText: { text: marker, matchCase: false },
          replaceText,
          ...(tabIds.length ? { tabsCriteria: { tabIds } } : {})
        }
      });
    }
  }
  return requests;
}

function collectTabIds(tabs: GoogleDocumentReadback['tabs'], output: string[] = []): string[] {
  for (const tab of tabs || []) {
    const id = String(tab?.tabProperties?.tabId || '');
    if (id) output.push(id);
    collectTabIds(tab?.childTabs, output);
  }
  return output;
}

function collectGoogleDocumentText(value: unknown, output: string[] = []): string[] {
  if (Array.isArray(value)) {
    for (const item of value) collectGoogleDocumentText(item, output);
    return output;
  }
  if (!value || typeof value !== 'object') return output;
  const record = value as Record<string, unknown>;
  const textRun = record.textRun;
  if (textRun && typeof textRun === 'object' && typeof (textRun as Record<string, unknown>).content === 'string') {
    output.push(String((textRun as Record<string, unknown>).content));
  }
  for (const [key, item] of Object.entries(record)) {
    if (key !== 'textRun') collectGoogleDocumentText(item, output);
  }
  return output;
}

export function findUnresolvedTemplateMarkers(document: unknown): string[] {
  const source = collectGoogleDocumentText(document).join('');
  const matches = source.match(/<<[^<>\r\n]{2,100}>>|\{\{[^{}\r\n]{2,100}\}\}|\[\[[^\[\]\r\n]{2,100}\]\]|«[^«»\r\n]{2,100}»|-(?:CAMPO_)?[A-Z][A-Z0-9_]{2,80}-/g) || [];
  return Array.from(new Set(matches.map((item) => item.trim()))).slice(0, 50);
}

function safeOutputName(name: string): string {
  const stem = String(name || 'documento-gerado')
    .normalize('NFC')
    .replace(/[\x00-\x1f<>:"/\\|?*]+/g, '_')
    .replace(/\.(?:docx?|gdoc|pdf)$/i, '')
    .trim()
    .slice(0, 150) || 'documento-gerado';
  return `${stem}.pdf`;
}

async function readTemplateMetadata(fetchImpl: FetchLike, accessToken: string, fileId: string): Promise<DriveTemplateMetadata> {
  const params = new URLSearchParams({ fields: 'id,name,mimeType,trashed,parents,capabilities(canCopy,canDownload)', supportsAllDrives: 'true' });
  const response = await googleRequest(fetchImpl, accessToken, `${DRIVE_API}/files/${encodeURIComponent(fileId)}?${params}`, {}, 'Falha ao validar o modelo');
  const metadata = await response.json() as DriveTemplateMetadata;
  if (metadata.trashed) throw new Error('O modelo selecionado está na lixeira do Google Drive.');
  if (metadata.mimeType !== GOOGLE_DOC_MIME && metadata.mimeType !== DOCX_MIME) {
    throw new Error('O modelo deve ser um Google Doc ou um arquivo DOCX armazenado no Drive.');
  }
  if (metadata.capabilities?.canCopy === false) throw new Error('A conta conectada não possui permissão para copiar este modelo.');
  return metadata;
}

async function copyNativeGoogleDoc(fetchImpl: FetchLike, accessToken: string, source: DriveTemplateMetadata, parentId?: string): Promise<string> {
  const response = await googleRequest(fetchImpl, accessToken, `${DRIVE_API}/files/${encodeURIComponent(source.id)}/copy?fields=id&supportsAllDrives=true`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: `__PORTAL_TEMP__${Date.now()}__${source.name}`.slice(0, 180),
      ...(parentId ? { parents: [parentId] } : {}),
      appProperties: { portal: 'portal-tcc', lifecycle: 'temporary-render-copy', sourceModelId: source.id }
    })
  }, 'Falha ao copiar o modelo Google Docs');
  return String((await response.json() as { id?: string }).id || '');
}

async function convertDocxToGoogleDoc(fetchImpl: FetchLike, accessToken: string, source: DriveTemplateMetadata, parentId?: string): Promise<string> {
  const download = await googleRequest(fetchImpl, accessToken, `${DRIVE_API}/files/${encodeURIComponent(source.id)}?alt=media&supportsAllDrives=true`, {}, 'Falha ao baixar o modelo DOCX');
  const bytes = Buffer.from(await download.arrayBuffer());
  if (!bytes.length || bytes.length > MAX_TEMPLATE_BYTES || bytes.subarray(0, 2).toString('hex') !== '504b') {
    throw new Error('O modelo DOCX é inválido ou ultrapassa 16 MB.');
  }
  const boundary = `portal_docx_${Date.now().toString(36)}`;
  const metadata = Buffer.from(JSON.stringify({
    name: `__PORTAL_TEMP__${Date.now()}__${source.name.replace(/\.docx$/i, '')}`.slice(0, 180),
    mimeType: GOOGLE_DOC_MIME,
    ...(parentId ? { parents: [parentId] } : {}),
    appProperties: { portal: 'portal-tcc', lifecycle: 'temporary-render-conversion', sourceModelId: source.id }
  }), 'utf8');
  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n`, 'ascii'), metadata,
    Buffer.from(`\r\n--${boundary}\r\nContent-Type: ${DOCX_MIME}\r\n\r\n`, 'ascii'), bytes,
    Buffer.from(`\r\n--${boundary}--`, 'ascii')
  ]);
  const response = await googleRequest(fetchImpl, accessToken, `${DRIVE_UPLOAD_API}/files?uploadType=multipart&fields=id&supportsAllDrives=true`, {
    method: 'POST',
    headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
    body
  }, 'Falha ao converter o modelo DOCX');
  return String((await response.json() as { id?: string }).id || '');
}

async function removeTemporaryFile(fetchImpl: FetchLike, accessToken: string, fileId: string): Promise<void> {
  if (!fileId) return;
  const response = await fetchImpl(`${DRIVE_API}/files/${encodeURIComponent(fileId)}?supportsAllDrives=true`, {
    method: 'DELETE', headers: { Authorization: `Bearer ${accessToken}` }, signal: AbortSignal.timeout(20_000)
  });
  if (response.ok || response.status === 404) return;
  const fallback = await fetchImpl(`${DRIVE_API}/files/${encodeURIComponent(fileId)}?supportsAllDrives=true`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ trashed: true }),
    signal: AbortSignal.timeout(20_000)
  });
  if (!fallback.ok && fallback.status !== 404) throw new Error('Não foi possível remover o documento temporário criado para a geração.');
}

/**
 * Renders a Master-owned Drive template without changing the source. Native
 * Google Docs are copied; DOCX files are converted by Drive in a temporary
 * Google Doc. Only placeholder text is replaced, preserving the copied layout,
 * headers, footers, tables, images and paragraph styles. The temporary file is
 * deleted (or moved to trash as a fallback) before this function returns.
 */
export async function renderGoogleDriveTemplateToPdf(input: GoogleTemplateRenderInput): Promise<GoogleTemplateRenderResult> {
  if (!String(input.accessToken || '').trim()) throw new Error('Token Google ausente para gerar o documento.');
  const fetchImpl = input.fetchImpl || fetch;
  const sourceFileId = extractGoogleDriveFileId(input.templateUrlOrId);
  const source = await readTemplateMetadata(fetchImpl, input.accessToken, sourceFileId);
  let temporaryFileId = '';
  let result: GoogleTemplateRenderResult | undefined;
  let primaryError: unknown;
  let cleanupError: unknown;

  try {
    temporaryFileId = source.mimeType === GOOGLE_DOC_MIME
      ? await copyNativeGoogleDoc(fetchImpl, input.accessToken, source, input.temporaryParentId)
      : await convertDocxToGoogleDoc(fetchImpl, input.accessToken, source, input.temporaryParentId);
    if (!temporaryFileId) throw new Error('O Google Drive não devolveu o identificador da cópia temporária.');

    const readbackResponse = await googleRequest(
      fetchImpl,
      input.accessToken,
      `${DOCS_API}/documents/${encodeURIComponent(temporaryFileId)}?includeTabsContent=true`,
      {},
      'Falha ao validar a cópia do modelo'
    );
    const readback = await readbackResponse.json() as GoogleDocumentReadback;
    if (String(readback.documentId || '') !== temporaryFileId) throw new Error('O Google Docs devolveu um documento diferente da cópia temporária.');
    const tabIds = collectTabIds(readback.tabs);
    const requests = [...buildMarkerBoldRequests(readback, input.boldMarkers || []), ...buildGoogleDocsReplacementRequests(input.replacements, tabIds)];
    let replacementsChanged = 0;
    if (requests.length) {
      const batchResponse = await googleRequest(fetchImpl, input.accessToken, `${DOCS_API}/documents/${encodeURIComponent(temporaryFileId)}:batchUpdate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requests, ...(readback.revisionId ? { writeControl: { requiredRevisionId: readback.revisionId } } : {}) })
      }, 'Falha ao mesclar as variáveis no modelo');
      const batch = await batchResponse.json() as { documentId?: string; replies?: Array<{ replaceAllText?: { occurrencesChanged?: number } }> };
      if (String(batch.documentId || '') !== temporaryFileId) throw new Error('A atualização não confirmou o documento temporário correto.');
      replacementsChanged = (batch.replies || []).reduce((total, reply) => total + Number(reply.replaceAllText?.occurrencesChanged || 0), 0);
    }

    const mergedReadbackResponse = await googleRequest(
      fetchImpl,
      input.accessToken,
      `${DOCS_API}/documents/${encodeURIComponent(temporaryFileId)}?includeTabsContent=true`,
      {},
      'Falha ao conferir marcadores restantes no documento preenchido'
    );
    const unresolvedMarkers = findUnresolvedTemplateMarkers(await mergedReadbackResponse.json());

    const exportResponse = await googleRequest(
      fetchImpl,
      input.accessToken,
      `${DRIVE_API}/files/${encodeURIComponent(temporaryFileId)}/export?mimeType=${encodeURIComponent('application/pdf')}`,
      {},
      'Falha ao exportar o modelo preenchido como PDF'
    );
    const pdf = Buffer.from(await exportResponse.arrayBuffer());
    if (!pdf.subarray(0, 5).equals(Buffer.from('%PDF-')) || pdf.length > MAX_EXPORTED_PDF_BYTES) {
      throw new Error('O Google não devolveu um PDF válido de até 32 MB.');
    }
    result = {
      pdf,
      fileName: safeOutputName(input.outputName || source.name),
      sourceFileId,
      sourceMimeType: source.mimeType as typeof GOOGLE_DOC_MIME | typeof DOCX_MIME,
      convertedFromDocx: source.mimeType === DOCX_MIME,
      replacementsChanged,
      unresolvedMarkers,
      tabCount: Math.max(1, tabIds.length)
    };
  } catch (error) {
    primaryError = error;
  }

  try { await removeTemporaryFile(fetchImpl, input.accessToken, temporaryFileId); }
  catch (error) { cleanupError = error; }
  if (primaryError) throw primaryError;
  if (cleanupError) throw cleanupError;
  if (!result) throw new Error('A geração do documento não foi concluída.');
  return result;
}
