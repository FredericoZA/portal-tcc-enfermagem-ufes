export interface PublicDocumentVerification {
  valid: boolean;
  status: string;
  sha256?: string;
}

export interface PublicPdfVerificationResult {
  valid: boolean;
  status: 'MATCH' | 'MISMATCH';
  sha256: string;
}

export const MAX_PUBLIC_VERIFICATION_PDF_BYTES = 50 * 1024 * 1024;

/** Compare the original bytes on the visitor's device. The supplied reader
 * retrieves public metadata only; the PDF never leaves the browser. */
export async function verifyPublicPdfLocally(
  file: Blob,
  readVerification: () => Promise<PublicDocumentVerification>,
): Promise<PublicPdfVerificationResult> {
  if (!Number.isSafeInteger(file.size) || file.size <= 0 || file.size > MAX_PUBLIC_VERIFICATION_PDF_BYTES) {
    throw new Error('Selecione um PDF de até 50 MB, com conteúdo.');
  }

  const header = new Uint8Array(await file.slice(0, 5).arrayBuffer());
  if (header.length !== 5 || header.some((byte, index) => byte !== [37, 80, 68, 70, 45][index])) {
    throw new Error('O arquivo não possui uma assinatura PDF válida.');
  }
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new Error('Este navegador não oferece a verificação criptográfica exigida. Abra o Portal em uma conexão HTTPS e use um navegador atualizado.');
  }

  const verification = await readVerification();
  const expectedSha256 = typeof verification?.sha256 === 'string' ? verification.sha256.toLowerCase() : '';
  if (verification?.valid !== true || verification.status !== 'VALID' || !/^[a-f0-9]{64}$/.test(expectedSha256)) {
    throw new Error('O código consultado não possui um documento assinado disponível para conferência.');
  }

  const bytes = await file.arrayBuffer();
  if (bytes.byteLength !== file.size) throw new Error('Não foi possível ler o PDF completo. Selecione o arquivo novamente.');
  let digest: ArrayBuffer;
  try {
    digest = await subtle.digest('SHA-256', bytes);
  } catch {
    throw new Error('Não foi possível conferir o PDF neste navegador. Nenhum arquivo foi enviado ao servidor.');
  }
  const sha256 = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
  if (!/^[a-f0-9]{64}$/.test(sha256)) throw new Error('O navegador não confirmou o checksum SHA-256 do PDF.');
  const valid = sha256 === expectedSha256;
  return { valid, status: valid ? 'MATCH' : 'MISMATCH', sha256 };
}
