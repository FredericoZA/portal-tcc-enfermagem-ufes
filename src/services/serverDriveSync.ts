import { ProcessData, ProcessDocument, DocumentVersion } from '../types';
import { buildPortalDriveFileName } from './googleDriveOrganizer';

/**
 * Returns the Google Drive folder ID for a given process.
 */
export function getProcessDriveFolderId(process: ProcessData): string {
  return process.driveFolderId || '';
}

/**
 * Returns the Google Drive folder web URL for a given process.
 */
export function getProcessDriveFolderUrl(process: ProcessData): string {
  if (process.driveFolderUrl) return process.driveFolderUrl;
  return '';
}

/**
 * Generates Google Drive file metadata and links for a document.
 */
export function buildDocumentDriveLinks(doc: ProcessDocument, _process: ProcessData): {
  driveFileId?: string;
  driveWebViewLink?: string;
  driveDownloadUrl?: string;
} {
  return {
    driveFileId: doc.driveFileId,
    driveWebViewLink: doc.driveWebViewLink,
    driveDownloadUrl: doc.driveDownloadUrl
  };
}

/**
 * Enriches a list of process documents with Google Drive links and file IDs.
 */
export function enrichProcessDocumentsWithDrive(documents: ProcessDocument[], process: ProcessData): ProcessDocument[] {
  return documents.map((doc) => {
    const links = buildDocumentDriveLinks(doc, process);
    const updatedVersions: DocumentVersion[] = (doc.versions || []).map((v) => {
      return {
        ...v,
        fileName: v.fileName || buildPortalDriveFileName({ protocol: process.protocolo, title: process.titulo, documentType: doc.type, version: v.version, lifecycle: 'GERADO' })
      };
    });

    return {
      ...doc,
      ...(links.driveFileId ? { driveFileId: links.driveFileId } : {}),
      ...(links.driveWebViewLink ? { driveWebViewLink: links.driveWebViewLink } : {}),
      ...(links.driveDownloadUrl ? { driveDownloadUrl: links.driveDownloadUrl } : {}),
      versions: updatedVersions
    };
  });
}
