export interface GoogleDriveFile {
  id: string;
  name: string;
  mimeType: string;
  webViewLink?: string;
  iconLink?: string;
  createdTime?: string;
  modifiedTime?: string;
  size?: string;
  parents?: string[];
  appProperties?: Record<string, string>;
}

function escapeDriveQueryValue(value: string): string { return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'"); }

/**
 * List files from Google Drive
 */
export async function listDriveFiles(accessToken: string, query?: string): Promise<GoogleDriveFile[]> {
  const defaultQuery = "trashed = false";
  const q = query ? `${defaultQuery} and ${query}` : defaultQuery;

  const files:GoogleDriveFile[]=[]; let pageToken=''; do { const params=new URLSearchParams({q,fields:'nextPageToken,files(id,name,mimeType,webViewLink,iconLink,createdTime,modifiedTime,size,parents,appProperties)',pageSize:'100',orderBy:'folder,modifiedTime desc',supportsAllDrives:'true',includeItemsFromAllDrives:'true'}); if(pageToken)params.set('pageToken',pageToken); const response=await fetch(`https://www.googleapis.com/drive/v3/files?${params}`,{headers:{Authorization:`Bearer ${accessToken}`}}); if(!response.ok){const errorData=await response.json().catch(()=>({}));throw new Error(errorData.error?.message||`Erro no Google Drive (${response.status})`);}const data=await response.json();files.push(...(data.files||[]));pageToken=data.nextPageToken||'';}while(pageToken); return files;
}

/**
 * Create a new folder in Google Drive
 */
export async function createDriveFolder(
  accessToken: string,
  folderName: string,
  parentFolderId?: string,
  appProperties?: Record<string, string>
): Promise<GoogleDriveFile> {
  const metadata: any = {
    name: folderName,
    mimeType: 'application/vnd.google-apps.folder',
  };

  if (parentFolderId) {
    metadata.parents = [parentFolderId];
  }
  if (appProperties) metadata.appProperties = appProperties;

  const response = await fetch('https://www.googleapis.com/drive/v3/files?fields=id,name,mimeType,webViewLink,parents,appProperties&supportsAllDrives=true', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(metadata),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || 'Erro ao criar pasta no Google Drive');
  }

  return response.json();
}

export async function findDriveFolderByName(accessToken:string,folderName:string,parentFolderId:string):Promise<GoogleDriveFile|null>{const query=`name = '${escapeDriveQueryValue(folderName)}' and mimeType = 'application/vnd.google-apps.folder' and '${escapeDriveQueryValue(parentFolderId)}' in parents`;const folders=await listDriveFiles(accessToken,query);if(folders.length>1)throw new Error(`Há ${folders.length} pastas chamadas "${folderName}" no mesmo local. Remova ou renomeie as duplicadas antes de sincronizar.`);return folders[0]||null;}

/**
 * Upload a text or JSON document to Google Drive
 */
export async function uploadTextToDrive(
  accessToken: string,
  fileName: string,
  content: string,
  mimeType: string = 'text/plain',
  parentFolderId?: string
): Promise<GoogleDriveFile> {
  const metadata: any = {
    name: fileName,
    mimeType: mimeType,
  };

  if (parentFolderId) {
    metadata.parents = [parentFolderId];
  }

  const boundary = 'foo_bar_baz';
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const multipartRequestBody =
    delimiter +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify(metadata) +
    delimiter +
    `Content-Type: ${mimeType}\r\n\r\n` +
    content +
    closeDelimiter;

  const response = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,webViewLink',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body: multipartRequestBody,
    }
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || 'Erro ao enviar arquivo para o Google Drive');
  }

  return response.json();
}

/**
 * Delete a file from Google Drive (Mandatory user confirmation required in UI)
 */
export async function deleteDriveFile(accessToken: string, fileId: string): Promise<void> {
  const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok && response.status !== 204) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || 'Erro ao excluir arquivo do Google Drive');
  }
}

/**
 * Finds or creates the "Portal de TCC" target folder in the user's Google Drive root
 */
export async function getOrCreatePortalFolder(accessToken: string): Promise<GoogleDriveFile> {
  const query = "(name = 'Portal de TCC' or name = 'Portal TCC') and mimeType = 'application/vnd.google-apps.folder' and trashed = false";
  const existingFolders = await listDriveFiles(accessToken, query);

  if (existingFolders.length > 0) {
    return existingFolders[0];
  }

  return createDriveFolder(accessToken, 'Portal de TCC');
}

/**
 * Finds or creates the "0-Modelos" subfolder directly inside "Portal de TCC"
 */
export async function getOrCreateModelosFolder(accessToken: string): Promise<GoogleDriveFile> {
  const portalFolder = await getOrCreatePortalFolder(accessToken);
  const query = `(name = '0-Modelos' or name = 'Modelos') and mimeType = 'application/vnd.google-apps.folder' and '${portalFolder.id}' in parents and trashed = false`;
  const existingFolders = await listDriveFiles(accessToken, query);

  if (existingFolders.length > 0) {
    return existingFolders[0];
  }

  return createDriveFolder(accessToken, '0-Modelos', portalFolder.id);
}

/**
 * Syncs a historical system audit report directly inside the "Portal de TCC" Google Drive folder
 */
export async function syncReportToPortalFolder(
  accessToken: string,
  reportTitle: string,
  content: string
): Promise<GoogleDriveFile> {
  const portalFolder = await getOrCreatePortalFolder(accessToken);
  return uploadTextToDrive(
    accessToken,
    `${reportTitle}.txt`,
    content,
    'text/plain',
    portalFolder.id
  );
}
