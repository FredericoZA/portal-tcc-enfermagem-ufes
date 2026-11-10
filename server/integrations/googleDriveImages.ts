import { createHash, randomUUID } from 'node:crypto';
import sharp from 'sharp';

const DRIVE_API = 'https://www.googleapis.com/drive/v3';
const DRIVE_UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3';
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const MIME_EXTENSION = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' } as const;
type ImageMime = keyof typeof MIME_EXTENSION;
export type PortalImageKind = 'RUNTIME_ASSET' | 'FEEDBACK_IMAGE';
export interface PrivatePortalImage {
  driveFileId: string;
  contentSha256: string;
  mimeType: string;
  byteLength: number;
}
interface ImageContext { accessToken: string; academicRootId: string; }
export interface PortalImageInput { bytes: Buffer; mimeType: string; kind: PortalImageKind; key: string; academicRootId?: string; }

function validFileId(value: string): boolean { return /^[a-zA-Z0-9_-]{10,}$/.test(value); }
function safeKind(kind: PortalImageKind): string {
  if (kind === 'RUNTIME_ASSET') return '04_ATIVOS_VISUAIS';
  if (kind === 'FEEDBACK_IMAGE') return '05_IMAGENS_SUGESTOES';
  throw new Error('Finalidade da imagem inválida.');
}
function validMime(value: string): value is ImageMime { return Object.hasOwn(MIME_EXTENSION, value); }

/** A pending settings snapshot takes precedence, then the saved installation,
 * then the optional bootstrap environment. No process-global root cache. */
export async function resolvePortalImageRoot(snapshotRootId?: string): Promise<string> {
  let root = snapshotRootId;
  if (root === undefined) {
    const { loadRuntimeDriveRootId } = await import('./supabase');
    root = await loadRuntimeDriveRootId() || process.env.PORTAL_DRIVE_ROOT_FOLDER_ID;
  }
  const academicRootId = String(root || '').trim();
  if (!validFileId(academicRootId)) throw new Error('Configure a raiz privada do Drive antes de armazenar imagens.');
  return academicRootId;
}

/** No OAuth token or Drive identifier is ever returned to the browser. */
async function context(snapshotRootId?: string): Promise<ImageContext> {
  const academicRootId = await resolvePortalImageRoot(snapshotRootId);
  const { getGoogleWorkspaceAccessToken } = await import('./googleWorkspace');
  return { accessToken: await getGoogleWorkspaceAccessToken(), academicRootId };
}

async function json<T>(accessToken: string, path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${DRIVE_API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json', ...(init.body ? { 'Content-Type': 'application/json' } : {}) },
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`O Drive não confirmou a operação da imagem (${response.status}).`);
  return await response.json() as T;
}

async function imageFolder(kind: PortalImageKind, ctx: ImageContext, create = false): Promise<string> {
  const { resolvePortalTechnicalRoot, verifyPrivateDriveFolder } = await import('./googleWorkspace');
  const parentId = await resolvePortalTechnicalRoot(ctx.accessToken, ctx.academicRootId);
  const name = safeKind(kind);
  const params = new URLSearchParams({ q: `'${parentId}' in parents and name = '${name}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`, fields: 'files(id)', pageSize: '2' });
  const found = await json<{ files?: Array<{ id: string }> }>(ctx.accessToken, `/files?${params}`);
  if ((found.files?.length || 0) > 1) throw new Error('Há destinos de imagens duplicados no Drive.');
  if (!found.files?.[0] && !create) throw new Error('O arquivo privado de imagens não foi localizado.');
  const folder = found.files?.[0] || await json<{ id: string }>(ctx.accessToken, '/files?fields=id', {
    method: 'POST', body: JSON.stringify({ name, parents: [parentId], mimeType: 'application/vnd.google-apps.folder', appProperties: { portal: 'portal-tcc', imageKind: kind } }),
  });
  if (!validFileId(folder.id)) throw new Error('O Drive retornou um destino inválido para imagens.');
  await verifyPrivateDriveFolder(ctx.accessToken, folder.id);
  return folder.id;
}

async function validateImage(bytes: Buffer, mime: string): Promise<void> {
  if (!validMime(mime) || !bytes.length || bytes.length > MAX_IMAGE_BYTES) throw new Error('Imagem inválida ou acima de 4 MB.');
  const metadata = await sharp(bytes, { limitInputPixels: 16_000_000 }).metadata();
  const expected = { 'image/png': 'png', 'image/jpeg': 'jpeg', 'image/webp': 'webp' }[mime];
  if (metadata.format !== expected || !metadata.width || !metadata.height || (metadata.pages || 1) > 1) throw new Error('A imagem não corresponde ao tipo informado.');
}

/** The settings editor historically accepts SVG and GIF. Rasterize those
 * inputs before archiving/serving them; SVG markup is never sent to a browser.
 * Logos and backgrounds use the first GIF frame, preserving transparency. */
export async function normalizePortalImage(bytes: Buffer, mimeType: string): Promise<{ bytes: Buffer; mimeType: ImageMime }> {
  if (!bytes.length || bytes.length > MAX_IMAGE_BYTES) throw new Error('Imagem inválida ou acima de 4 MB.');
  if (mimeType === 'image/svg+xml' || mimeType === 'image/gif') {
    const image = sharp(bytes, { limitInputPixels: 16_000_000, pages: 1 });
    const metadata = await image.metadata();
    if (metadata.format !== (mimeType === 'image/gif' ? 'gif' : 'svg') || !metadata.width || !metadata.height) throw new Error('A imagem não corresponde ao tipo informado.');
    const converted = await image.timeout({ seconds: 5 }).png().toBuffer();
    await validateImage(converted, 'image/png');
    return { bytes: converted, mimeType: 'image/png' };
  }
  await validateImage(bytes, mimeType);
  return { bytes, mimeType: mimeType as ImageMime };
}

async function boundedBytes(response: Response, expectedSize: number): Promise<Buffer> {
  const announced = response.headers.get('content-length');
  if (announced && Number(announced) !== expectedSize) throw new Error('O tamanho da imagem no Drive mudou.');
  const reader = response.body?.getReader();
  if (!reader) throw new Error('Imagem indisponível no Drive.');
  const chunks: Buffer[] = []; let size = 0;
  try {
    while (true) {
      const next = await reader.read(); if (next.done) break;
      size += next.value.length;
      if (size > expectedSize || size > MAX_IMAGE_BYTES) throw new Error('A imagem excede o tamanho registrado.');
      chunks.push(Buffer.from(next.value));
    }
  } catch (error) { await reader.cancel().catch(() => undefined); throw error; }
  if (size !== expectedSize) throw new Error('A imagem no Drive está incompleta.');
  return Buffer.concat(chunks, size);
}

export async function readPrivatePortalImage(ref: PrivatePortalImage, kind: PortalImageKind, suppliedContext?: ImageContext): Promise<Buffer> {
  if (!validFileId(ref.driveFileId) || !/^[a-f0-9]{64}$/.test(ref.contentSha256) || !validMime(ref.mimeType) || !Number.isSafeInteger(ref.byteLength) || ref.byteLength < 1 || ref.byteLength > MAX_IMAGE_BYTES) throw new Error('Referência da imagem inválida.');
  const ctx = suppliedContext || await context();
  const folderId = await imageFolder(kind, ctx);
  const file = await json<{ size?: string; mimeType?: string; trashed?: boolean; parents?: string[]; appProperties?: Record<string, string> }>(ctx.accessToken, `/files/${ref.driveFileId}?fields=size,mimeType,trashed,parents,appProperties&supportsAllDrives=true`);
  if (file.trashed || !file.parents?.includes(folderId) || file.mimeType !== ref.mimeType || Number(file.size) !== ref.byteLength || file.appProperties?.imageKind !== kind || file.appProperties?.sha256 !== ref.contentSha256) throw new Error('A imagem não pertence ao arquivo privado esperado.');
  const { verifyPrivateDriveFolder } = await import('./googleWorkspace');
  await verifyPrivateDriveFolder(ctx.accessToken, ref.driveFileId);
  const response = await fetch(`${DRIVE_API}/files/${ref.driveFileId}?alt=media&supportsAllDrives=true`, { headers: { Authorization: `Bearer ${ctx.accessToken}` }, signal: AbortSignal.timeout(25_000) });
  if (!response.ok) throw new Error('Não foi possível ler a imagem no Drive.');
  const bytes = await boundedBytes(response, ref.byteLength);
  if (createHash('sha256').update(bytes).digest('hex') !== ref.contentSha256) throw new Error('A integridade da imagem não foi confirmada.');
  await validateImage(bytes, ref.mimeType);
  return bytes;
}

/** Archive validated raster bytes in Drive and verify readback before committing metadata. */
export async function storePrivatePortalImage(input: PortalImageInput, suppliedContext?: ImageContext): Promise<PrivatePortalImage> {
  if (!/^[a-f0-9-]{32,64}$/.test(input.key)) throw new Error('Identificador da imagem inválido.');
  const image = await normalizePortalImage(input.bytes, input.mimeType);
  const ctx = suppliedContext || await context(input.academicRootId);
  const folderId = await imageFolder(input.kind, ctx, true);
  const sha256 = createHash('sha256').update(image.bytes).digest('hex');
  const query = new URLSearchParams({ q: `'${folderId}' in parents and appProperties has { key='imageKey' and value='${input.key}' } and trashed = false`, fields: 'files(id)', pageSize: '2' });
  const existing = await json<{ files?: Array<{ id: string }> }>(ctx.accessToken, `/files?${query}`);
  if ((existing.files?.length || 0) > 1) throw new Error('Há imagens duplicadas no destino privado.');
  let fileId = existing.files?.[0]?.id;
  if (!fileId) {
    const boundary = `portal-image-${randomUUID()}`;
    const metadata = { name: `${input.key}.${MIME_EXTENSION[image.mimeType]}`, parents: [folderId], appProperties: { portal: 'portal-tcc', imageKind: input.kind, imageKey: input.key, sha256 } };
    const body = Buffer.concat([Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: ${image.mimeType}\r\n\r\n`), image.bytes, Buffer.from(`\r\n--${boundary}--`)]);
    const uploaded = await fetch(`${DRIVE_UPLOAD_API}/files?uploadType=multipart&fields=id&supportsAllDrives=true`, { method: 'POST', headers: { Authorization: `Bearer ${ctx.accessToken}`, 'Content-Type': `multipart/related; boundary=${boundary}` }, body, signal: AbortSignal.timeout(30_000) });
    if (!uploaded.ok) throw new Error('O Drive não confirmou o arquivo da imagem.');
    fileId = String((await uploaded.json() as { id?: string }).id || '');
  }
  const ref = { driveFileId: fileId, contentSha256: sha256, mimeType: image.mimeType, byteLength: image.bytes.length };
  await readPrivatePortalImage(ref, input.kind, ctx);
  return ref;
}
