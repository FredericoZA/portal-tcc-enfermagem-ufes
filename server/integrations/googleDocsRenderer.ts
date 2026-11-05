import {institutionalClosingRequests,institutionalClosingStyleRequests,assertInvitationIdentification} from './institutionalClosing';
import {institutionalLogoRequests,institutionalHeadingRequests} from './institutionalLogo';
import {ataPageLayoutRequests,numberAtaLines} from '../documents/ataLayout';
import {documentMainBody,bodyEditRequests} from './googleDocsBody';
import {presentationEditRequests,individualAuthorSignatureRequests,individualAuthorSignatureStyleRequests,optionalAuthorBlockRequests,authorizationSignatureLayoutRequests,declarationDateLayoutRequests,ataStudentSignatureLayoutRequests,authorizationOptionsLayoutRequests,ataCoadvisorBlockRequests,coadvisorIdentificationRequests} from './documentPresentation';
import {academicName,personPresentationVariables} from '../../src/utils/personPresentation';
import type {ProcessData} from '../../src/types';
import { buildValueBoldRequests,buildMarkerBoldRequests,buildAtaOpeningNormalRequests,buildAuthorizationChoiceStyleRequests,buildDeclarationCoAdvisorNormalRequests } from './googleDocsStyles';
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
  institutionalCrestUrl?:string;
  presentation?:{process:ProcessData;documentType:string};
  templateUrlOrId: string;
  replacements: Record<string, string | number | boolean | null | undefined>;
  /** Substituições pontuais na cópia temporária, sem modificar o modelo original. */
  literalReplacements?: Array<{find:string;replace:string}>;
  invitationLayout?: boolean;
  boldMarkers?: string[];
  documentText?: string;
  legacyDefenseLocations?: {selected:string;alternatives:string[]};
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
  documentText?: string;
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
  let key = String(raw || '').trim();
  for (const [opening, closing] of [['<<', '>>'], ['{{', '}}'], ['[[', ']]'], ['«', '»']]) {
    if (key.startsWith(opening)) key = key.slice(opening.length).trimStart();
    if (key.endsWith(closing)) key = key.slice(0, -closing.length).trimEnd();
  }
  key = key.replace(/^-|-$/g, '').trim();
  if (!/^[\p{L}\p{N}_ ().,-]{1,100}$/u.test(key)) throw new Error(`Variável de modelo inválida: ${String(raw).slice(0, 80)}`);
  return key;
}

function replacementMarkers(key: string): string[] {
  return [`<<${key}>>`, `{{${key}}}`, `[[${key}]]`, `«${key}»`, `-${key}-`];
}

/** Apply compatibility replacements only to the temporary document copy. */
export function buildLegacyLocationRequests(input:GoogleTemplateRenderInput['legacyDefenseLocations'],tabIds:string[]=[]){
 if(!input?.selected.trim())return [];
 return [...new Set(input.alternatives.map(value=>value.trim()).filter(value=>value&&value!==input.selected))].map(location=>({replaceAllText:{containsText:{text:location,matchCase:true},replaceText:input.selected,...(tabIds.length?{tabsCriteria:{tabIds}}:{})}}));
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
  const matches = source.match(/<<[^<>\r\n]{2,100}>>|\{\{[^{}\r\n]{2,100}\}\}|\[\[[^\[\]\r\n]{2,100}\]\]|«[^«»\r\n]{2,100}»|(?<![\p{L}\p{N}_])-(?:CAMPO_)?[A-Z][A-Z0-9_]{2,80}-(?![\p{L}\p{N}_])/gu) || [];
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
 * Alinhamento final aplicado somente à cópia transitória da carta-convite.
 * Os índices vêm da estrutura real do Docs, não de posições calculadas à mão.
 */
export function buildOfficialInvitationParagraphStyles(document: unknown): Array<Record<string,unknown>> {
  const requests:Array<Record<string,unknown>>=[];
  const visit=(node:any,tabId?:string):void=>{
    if(!node||typeof node!=='object')return;
    if(Array.isArray(node)){node.forEach(item=>visit(item,tabId));return;}
    if(node.tabProperties?.tabId)tabId=String(node.tabProperties.tabId);
    if(node.paragraph&&Number.isFinite(node.startIndex)&&Number.isFinite(node.endIndex)){
      const text=(node.paragraph.elements||[]).map((element:any)=>String(element.textRun?.content||'')).join('').trim();
      let alignment:'JUSTIFIED'|'END'|'START'|''='';
      let indentStart:number|undefined;
      if(/^(?:A Comissão de Trabalho de Conclusão de Curso do Curso|Agradecemos a participação)/.test(text))alignment='JUSTIFIED';
      if(/^(?:Atenciosamente,?|Vitória\s*[-–—]?\s*ES,)/u.test(text))alignment='END';
      if(/^(?:Comissão de Trabalho de Conclusão de Curso|Departamento de Enfermagem$|Curso de Enfermagem e Obstetrícia)/.test(text)){
        alignment='END';indentStart=0;
      }
      if(alignment){
        const paragraphStyle:Record<string,unknown>={alignment};
        if(indentStart!==undefined)paragraphStyle.indentStart={magnitude:indentStart,unit:'PT'};
        requests.push({updateParagraphStyle:{
          range:{startIndex:node.startIndex,endIndex:node.endIndex,...(tabId?{tabId}:{})},
          paragraphStyle,fields:indentStart!==undefined?'alignment,indentStart':'alignment',
        }});
      }
    }
    for(const [key,value] of Object.entries(node)){
      if(key==='paragraph')continue;
      visit(value,tabId);
    }
  };
  visit(document);
  return requests;
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
    if(String(readback.documentId||'')!==temporaryFileId)throw new Error('O Google Docs devolveu um documento diferente da cópia temporária.');
    const logoRequests=institutionalLogoRequests(readback,input.institutionalCrestUrl);
    if(logoRequests.length)await googleRequest(fetchImpl,input.accessToken,`${DOCS_API}/documents/${encodeURIComponent(temporaryFileId)}:batchUpdate`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({requests:logoRequests,...(readback.revisionId?{writeControl:{requiredRevisionId:readback.revisionId}}:{})})},'Falha ao aplicar o brasão institucional');
    // The logo batch advances the revision; read it back before writing text.
    if(logoRequests.length){const fresh=await googleRequest(fetchImpl,input.accessToken,`${DOCS_API}/documents/${encodeURIComponent(temporaryFileId)}?includeTabsContent=true`,{},'Falha ao conferir o brasão institucional');Object.assign(readback,await fresh.json());}
    if (String(readback.documentId || '') !== temporaryFileId) throw new Error('O Google Docs devolveu um documento diferente da cópia temporária.');
    const tabIds = collectTabIds(readback.tabs);
    const invitationLiteralRequests=(input.literalReplacements||[]).filter(item=>item.find).map(item=>({replaceAllText:{containsText:{text:item.find,matchCase:true},replaceText:item.replace,...(tabIds.length?{tabsCriteria:{tabIds}}:{})}}));
    const literalRequests=[...buildLegacyLocationRequests(input.legacyDefenseLocations,tabIds),...invitationLiteralRequests];
    const openingRequests=input.presentation?.documentType==='ATA'?buildAtaOpeningNormalRequests(readback):[];
    const boldRequests=buildMarkerBoldRequests(readback,[...new Set([...Object.keys(input.replacements||{}).map(normalizeVariableKey),...(input.boldMarkers||[]).map(normalizeVariableKey)])]);
    const optionalRequests=input.presentation?optionalAuthorBlockRequests(readback,input.presentation.process):[];
    const pageLayoutRequests=input.presentation?.documentType==='ATA'?ataPageLayoutRequests():[];
    const requests = [...openingRequests,...boldRequests, ...optionalRequests, ...literalRequests, ...buildGoogleDocsReplacementRequests(input.replacements, tabIds),...pageLayoutRequests];
    let replacementsChanged = 0;
    if (requests.length) {
      const batchResponse = await googleRequest(fetchImpl, input.accessToken, `${DOCS_API}/documents/${encodeURIComponent(temporaryFileId)}:batchUpdate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requests, ...(readback.revisionId ? { writeControl: { requiredRevisionId: readback.revisionId } } : {}) })
      }, 'Falha ao mesclar as variáveis no modelo');
      const batch = await batchResponse.json() as { documentId?: string; replies?: Array<{ replaceAllText?: { occurrencesChanged?: number } }> };
      if (String(batch.documentId || '') !== temporaryFileId) throw new Error('A atualização não confirmou o documento temporário correto.');
      replacementsChanged = (batch.replies || []).slice(openingRequests.length+boldRequests.length+optionalRequests.length+literalRequests.length).reduce((total, reply) => total + Number(reply.replaceAllText?.occurrencesChanged || 0), 0);

    }

    const mergedReadbackResponse = await googleRequest(
      fetchImpl,
      input.accessToken,
      `${DOCS_API}/documents/${encodeURIComponent(temporaryFileId)}?includeTabsContent=true`,
      {},
      'Falha ao conferir marcadores restantes no documento preenchido'
    );
    let mergedDocument=await mergedReadbackResponse.json();
    let documentText=documentMainBody(mergedDocument)?.text;
    if(input.documentText!==undefined){
      const edits=bodyEditRequests(mergedDocument,input.documentText);
      if(edits.length)await googleRequest(fetchImpl,input.accessToken,`${DOCS_API}/documents/${encodeURIComponent(temporaryFileId)}:batchUpdate`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({requests:edits,...(mergedDocument.revisionId?{writeControl:{requiredRevisionId:mergedDocument.revisionId}}:{})})},'Falha ao aplicar a revisão integral da ata');
      documentText=input.documentText;
    }
    if(input.presentation){
      const readCurrent=async()=>{const response=await googleRequest(fetchImpl,input.accessToken,`${DOCS_API}/documents/${encodeURIComponent(temporaryFileId)}?includeTabsContent=true`,{},'Falha ao conferir a redação documental');return response.json();};
      if(input.documentText!==undefined)mergedDocument=await readCurrent();
      const edits=presentationEditRequests(mergedDocument,input.presentation.process,input.presentation.documentType);
      if(edits.length){await googleRequest(fetchImpl,input.accessToken,`${DOCS_API}/documents/${encodeURIComponent(temporaryFileId)}:batchUpdate`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({requests:edits,...(mergedDocument.revisionId?{writeControl:{requiredRevisionId:mergedDocument.revisionId}}:{})})},'Falha ao adequar tratamentos e encerramento');mergedDocument=await readCurrent();}
      const coIdentification=coadvisorIdentificationRequests(mergedDocument,input.presentation.process,input.presentation.documentType);
      if(coIdentification.length){await googleRequest(fetchImpl,input.accessToken,`${DOCS_API}/documents/${encodeURIComponent(temporaryFileId)}:batchUpdate`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({requests:coIdentification,...(mergedDocument.revisionId?{writeControl:{requiredRevisionId:mergedDocument.revisionId}}:{})})},'Falha ao identificar o coorientador');mergedDocument=await readCurrent();}
      if(['ATA','TERMO','DECLARACAO'].includes(input.presentation.documentType)){
        const layout=input.presentation.documentType==='ATA'?ataStudentSignatureLayoutRequests(mergedDocument,input.presentation.process):input.presentation.documentType==='TERMO'?[...authorizationSignatureLayoutRequests(mergedDocument,input.presentation.process),...authorizationOptionsLayoutRequests(mergedDocument)]:declarationDateLayoutRequests(mergedDocument);
        if(layout.length){await googleRequest(fetchImpl,input.accessToken,`${DOCS_API}/documents/${encodeURIComponent(temporaryFileId)}:batchUpdate`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({requests:layout,...(mergedDocument.revisionId?{writeControl:{requiredRevisionId:mergedDocument.revisionId}}:{})})},'Falha ao organizar o espaçamento do documento');mergedDocument=await readCurrent();}
      }
      if(['ATA','TERMO'].includes(input.presentation.documentType)){
        const authorEdits=individualAuthorSignatureRequests(mergedDocument,input.presentation.process);
        if(authorEdits.length){await googleRequest(fetchImpl,input.accessToken,`${DOCS_API}/documents/${encodeURIComponent(temporaryFileId)}:batchUpdate`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({requests:authorEdits,...(mergedDocument.revisionId?{writeControl:{requiredRevisionId:mergedDocument.revisionId}}:{})})},'Falha ao separar os blocos de autoria');mergedDocument=await readCurrent();}
      }
      if(input.presentation.documentType==='ATA'){
        const coadvisorEdits=ataCoadvisorBlockRequests(mergedDocument,input.presentation.process);
        if(coadvisorEdits.length){await googleRequest(fetchImpl,input.accessToken,`${DOCS_API}/documents/${encodeURIComponent(temporaryFileId)}:batchUpdate`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({requests:coadvisorEdits,...(mergedDocument.revisionId?{writeControl:{requiredRevisionId:mergedDocument.revisionId}}:{})})},'Falha ao incluir o coorientador na ata');mergedDocument=await readCurrent();}
      }
      if(input.institutionalCrestUrl?.endsWith('/national-arms.png')){
        const closing=institutionalClosingRequests(mergedDocument,input.presentation.documentType);
        if(closing.length){await googleRequest(fetchImpl,input.accessToken,`${DOCS_API}/documents/${encodeURIComponent(temporaryFileId)}:batchUpdate`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({requests:closing,...(mergedDocument.revisionId?{writeControl:{requiredRevisionId:mergedDocument.revisionId}}:{})})},'Falha ao organizar o encerramento institucional');mergedDocument=await readCurrent();}
      }
      const p=input.presentation.process;
      // Grammar adaptation may insert abbreviated prefixes after marker replacement.
      // Reapply emphasis to the complete participant names as well as the opinion.
      const names=[p.aluno1?.nome,p.aluno2?.nome,...[p.orientador,p.coorientador,...(p.banca||[])].filter(Boolean).map(person=>academicName(person,'abbreviated'))].filter((value):value is string=>Boolean(value));
      const emphasis=[...(input.institutionalCrestUrl?.endsWith('/national-arms.png')?institutionalClosingStyleRequests(mergedDocument):[]),...(['ATA','TERMO'].includes(input.presentation.documentType)?individualAuthorSignatureStyleRequests(mergedDocument,p):[]),...buildValueBoldRequests(mergedDocument,[...names,p.avaliacao?.resultadoLabel||'',personPresentationVariables(p).RESULTADO_CONCORDANTE,p.avaliacao?.parecer||'']),...(input.presentation.documentType==='TERMO'?buildAuthorizationChoiceStyleRequests(mergedDocument):[]),...(input.presentation.documentType==='DECLARACAO'?buildDeclarationCoAdvisorNormalRequests(mergedDocument):[])];
      if(emphasis.length)await googleRequest(fetchImpl,input.accessToken,`${DOCS_API}/documents/${encodeURIComponent(temporaryFileId)}:batchUpdate`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({requests:emphasis,...(mergedDocument.revisionId?{writeControl:{requiredRevisionId:mergedDocument.revisionId}}:{})})},'Falha ao formatar resultado e parecer');
      documentText=documentMainBody(mergedDocument)?.text||documentText;
    }
    if(input.institutionalCrestUrl?.endsWith('/national-arms.png')){
      const readLetterhead=async()=>{
        const response=await googleRequest(fetchImpl,input.accessToken,`${DOCS_API}/documents/${encodeURIComponent(temporaryFileId)}?includeTabsContent=true`,{},'Falha ao conferir o cabeçalho institucional');
        const current=await response.json();
        if(String(current.documentId||'')!==temporaryFileId)throw new Error('O Google Docs devolveu um documento diferente da cópia temporária.');
        return current;
      };
      mergedDocument=await readLetterhead();
      const headings=institutionalHeadingRequests(mergedDocument);
      if(headings.length){
        await googleRequest(fetchImpl,input.accessToken,`${DOCS_API}/documents/${encodeURIComponent(temporaryFileId)}:batchUpdate`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({requests:headings,...(mergedDocument.revisionId?{writeControl:{requiredRevisionId:mergedDocument.revisionId}}:{})})},'Falha ao padronizar o cabeçalho institucional');
        mergedDocument=await readLetterhead();
        documentText=documentMainBody(mergedDocument)?.text||documentText;
      }
    }
    const unresolvedMarkers = input.documentText!==undefined?findUnresolvedTemplateMarkers({textRun:{content:documentText||input.documentText}}):findUnresolvedTemplateMarkers(mergedDocument);
    if(input.invitationLayout&&input.presentation)assertInvitationIdentification(mergedDocument,input.presentation.process);
    if(input.invitationLayout){
      const layoutRequests=buildOfficialInvitationParagraphStyles(mergedDocument);
      if(layoutRequests.length){
        await googleRequest(fetchImpl,input.accessToken,`${DOCS_API}/documents/${encodeURIComponent(temporaryFileId)}:batchUpdate`,{
          method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({requests:layoutRequests}),
        },'Falha ao formatar os parágrafos da carta-convite');
      }
    }

    const exportResponse = await googleRequest(
      fetchImpl,
      input.accessToken,
      `${DRIVE_API}/files/${encodeURIComponent(temporaryFileId)}/export?mimeType=${encodeURIComponent('application/pdf')}`,
      {},
      'Falha ao exportar o modelo preenchido como PDF'
    );
    let pdf = Buffer.from(await exportResponse.arrayBuffer());
    if (!pdf.subarray(0, 5).equals(Buffer.from('%PDF-')) || pdf.length > MAX_EXPORTED_PDF_BYTES) {
      throw new Error('O Google não devolveu um PDF válido de até 32 MB.');
    }
    if(input.presentation?.documentType==='ATA')pdf=await numberAtaLines(pdf);
    result = {
      pdf,
      fileName: safeOutputName(input.outputName || source.name),
      sourceFileId,
      sourceMimeType: source.mimeType as typeof GOOGLE_DOC_MIME | typeof DOCX_MIME,
      convertedFromDocx: source.mimeType === DOCX_MIME,
      replacementsChanged,
      unresolvedMarkers,
      tabCount: Math.max(1, tabIds.length),
      documentText
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
