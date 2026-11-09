import { ensurePortalRenderFolder, getGoogleWorkspaceAccessToken, verifyPrivateDriveFolder } from './googleWorkspace';

const DRIVE_ORIGIN = 'https://www.googleapis.com';
const FILES = `${DRIVE_ORIGIN}/drive/v3/files`;
const UPLOAD_PATH = '/upload/drive/v3/files';
const FILE_ID = /^[a-zA-Z0-9_-]{10,128}$/;

export function driveTransferFileId(objectPath: string): string | undefined {
  return /^(?:pending|downloads)\/drive\/([a-zA-Z0-9_-]{10,128})$/.exec(objectPath)?.[1];
}

function driveFileUrl(fileId: string, fields: string) {
  if (!FILE_ID.test(fileId)) throw new Error('Identificador de transferência inválido.');
  return `${FILES}/${fileId}?supportsAllDrives=true&${fields}`;
}

function headers(token: string) {
  return { Authorization: `Bearer ${token}` };
}

export async function openDriveTransfer(input: {
  accessToken: string; rootFolderId: string; fileId: string; transferId: string;
  mimeType: string; size: number; origin?: string;
}): Promise<string> {
  const {accessToken, rootFolderId, fileId, transferId, mimeType, size, origin} = input;
  const parent = await ensurePortalRenderFolder(accessToken, rootFolderId);
  // Reserve an existing private file before issuing a resumable PATCH.
  // Deleting that file later also prevents an expired session from recreating it.
  const created = await fetch(`${FILES}?supportsAllDrives=true&fields=id`, {
    method: 'POST',
    headers: {...headers(accessToken), 'Content-Type': 'application/json'},
    body: JSON.stringify({id:fileId, name:`transferencia-${transferId}`, mimeType, parents:[parent], appProperties:{portal:'portal-tcc', transferId}}),
    signal: AbortSignal.timeout(15_000),
  });
  if (!created.ok || (await created.json()).id !== fileId) {
    throw new Error('O Drive não confirmou o arquivo temporário.');
  }
  const upload = await fetch(`${DRIVE_ORIGIN}${UPLOAD_PATH}/${fileId}?uploadType=resumable&supportsAllDrives=true&fields=id`, {
    method: 'PATCH',
    headers: {
      ...headers(accessToken), 'Content-Type': 'application/json',
      'X-Upload-Content-Type': mimeType, 'X-Upload-Content-Length': String(size),
      ...(origin ? {Origin:origin} : {}),
    },
    body: '{}',
    redirect: 'error',
    signal: AbortSignal.timeout(15_000),
  });
  const location = upload.headers.get('location');
  if (!upload.ok || !location) throw new Error('O Drive não autorizou a transferência.');
  const url = new URL(location);
  if (url.origin !== DRIVE_ORIGIN || url.username || url.password
      || ![UPLOAD_PATH,`${UPLOAD_PATH}/${fileId}`].includes(url.pathname)
      || !url.searchParams.get('upload_id')) {
    throw new Error('O Drive retornou um destino de transferência inválido.');
  }
  return url.href;
}

async function inspectTransfer(accessToken: string, fileId: string, transferId: string) {
  const response = await fetch(driveFileUrl(fileId, 'fields=id,size,mimeType,trashed,appProperties'), {
    headers:headers(accessToken), cache:'no-store', signal:AbortSignal.timeout(15_000),
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error('Não foi possível conferir a transferência no Drive.');
  const file = await response.json();
  if (file.id !== fileId || file.appProperties?.portal !== 'portal-tcc' || file.appProperties?.transferId !== transferId) {
    throw new Error('O arquivo do Drive não pertence a esta transferência.');
  }
  return file as {size?: string; mimeType?: string; trashed?: boolean};
}

export async function readDriveTransfer(fileId: string, transferId: string, size: number, mimeType: string): Promise<Response> {
  const token = await getGoogleWorkspaceAccessToken();
  const file = await inspectTransfer(token, fileId, transferId);
  if (!file || file.trashed || Number(file.size) !== size || file.mimeType !== mimeType) {
    throw new Error('O arquivo temporário ainda não está pronto ou diverge dos dados autorizados.');
  }
  await verifyPrivateDriveFolder(token, fileId);
  return fetch(driveFileUrl(fileId, 'alt=media'), {
    headers:headers(token), cache:'no-store', signal:AbortSignal.timeout(45_000),
  });
}

export async function removeDriveTransfer(fileId: string, transferId: string): Promise<void> {
  const token = await getGoogleWorkspaceAccessToken();
  if (!await inspectTransfer(token, fileId, transferId)) return;
  const response = await fetch(driveFileUrl(fileId, 'fields=id'), {
    method:'DELETE', headers:headers(token), signal:AbortSignal.timeout(15_000),
  });
  if (!response.ok && response.status !== 404) throw new Error('A limpeza do arquivo temporário no Drive ficou pendente.');
}
