import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { LegacyAttachment } from '../src/types/legacyArchive';
import { localReviewFilesEnabled } from './localReviewFiles';
import { downloadDrivePdf } from './integrations/googleDriveArchive';
import { getGoogleWorkspaceAccessToken } from './integrations/googleWorkspace';

type VerifiedLegacyFile = Pick<LegacyAttachment,'driveFileId'|'fileName'|'sourceFileName'|'sha256'>;
export function verifyLegacyPdf(file: VerifiedLegacyFile, pdf: Buffer): Buffer {
  if (pdf.length > 50 * 1024 * 1024 || !pdf.subarray(0,5).equals(Buffer.from('%PDF-')) ||
      !/^[a-f0-9]{64}$/.test(file.sha256) || createHash('sha256').update(pdf).digest('hex') !== file.sha256) {
    throw new Error('O PDF não corresponde ao arquivo legado conferido.');
  }
  return pdf;
}

/** Existing Drive files remain private. The Portal serves only the authorized bytes. */
export async function readLegacyAcademicPdf(file: VerifiedLegacyFile): Promise<Buffer> {
  if (localReviewFilesEnabled()) {
    const sourceName=file.sourceFileName||file.fileName;
    if (path.basename(sourceName) !== sourceName || /[\\/]/.test(sourceName)) throw new Error('Nome de arquivo inválido.');
    const directory = path.join(process.env.PORTAL_DATA_DIR || path.join(process.cwd(),'.portal-data'),'legacy-import','drive-pdfs');
    return verifyLegacyPdf(file, await readFile(path.join(directory,sourceName)));
  }
  const stored = await downloadDrivePdf(await getGoogleWorkspaceAccessToken(),file.driveFileId);
  return verifyLegacyPdf(file,stored.pdf);
}
