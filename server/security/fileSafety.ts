import JSZip from 'jszip';

export type SafeDocumentKind = 'PDF' | 'DOCX';

export class UnsafeUploadError extends Error {
  readonly code = 'UNSAFE_UPLOAD_CONTENT';
  constructor(message: string) {
    super(message);
    this.name = 'UnsafeUploadError';
  }
}

const EICAR_SIGNATURE = 'X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*';
const PDF_ACTIVE_MARKERS = [
  /\/JavaScript\b/i,
  /\/JS\b/i,
  /\/Launch\b/i,
  /\/EmbeddedFile\b/i,
  /\/RichMedia\b/i,
  /\/SubmitForm\b/i,
  /\/ImportData\b/i,
];
const DANGEROUS_EMBEDDED_EXTENSION = /\.(?:bin|exe|dll|js|jse|vbs|vbe|ps1|psm1|cmd|bat|msi|com|scr|jar|hta|chm|lnk|iso)$/i;
const MAX_DOCX_ENTRIES = 2000;
const MAX_DOCX_UNCOMPRESSED_BYTES = 120 * 1024 * 1024;

function rejectIfEicar(bytes: Buffer): void {
  if (bytes.toString('latin1').includes(EICAR_SIGNATURE)) {
    throw new UnsafeUploadError('O arquivo foi bloqueado por conter uma assinatura de teste de malware.');
  }
}

function assertSafePdf(bytes: Buffer): void {
  if (!bytes.subarray(0, 5).equals(Buffer.from('%PDF-'))) {
    throw new UnsafeUploadError('O arquivo não possui uma assinatura PDF válida.');
  }
  const tail = bytes.subarray(Math.max(0, bytes.length - 8192)).toString('latin1');
  if (!tail.includes('%%EOF')) {
    throw new UnsafeUploadError('O PDF está incompleto ou não possui marcador de término válido.');
  }
  const text = bytes.toString('latin1');
  const marker = PDF_ACTIVE_MARKERS.find((pattern) => pattern.test(text));
  if (marker) {
    throw new UnsafeUploadError('O PDF contém recurso ativo ou incorporado não permitido pelo Portal.');
  }
}

function relationshipAttributes(xml: string): Array<Record<string, string>> {
  const entries: Array<Record<string, string>> = [];
  for (const match of xml.matchAll(/<Relationship\b([^>]*)\/?\s*>/gi)) {
    const attrs: Record<string, string> = {};
    for (const attribute of match[1].matchAll(/([A-Za-z_:][\w:.-]*)\s*=\s*["']([^"']*)["']/g)) {
      attrs[attribute[1]] = attribute[2];
    }
    entries.push(attrs);
  }
  return entries;
}

function isAllowedExternalHyperlink(type: string, target: string): boolean {
  if (!/\/hyperlink$/i.test(type)) return false;
  return /^(?:https?:|mailto:)/i.test(target.trim());
}

async function assertSafeDocx(bytes: Buffer): Promise<void> {
  if (!bytes.subarray(0, 2).equals(Buffer.from('PK'))) {
    throw new UnsafeUploadError('O arquivo não possui uma assinatura DOCX válida.');
  }

  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(bytes, { checkCRC32: true });
  } catch {
    throw new UnsafeUploadError('O DOCX está corrompido ou possui estrutura ZIP inválida.');
  }

  const entries = Object.values(zip.files);
  if (entries.length > MAX_DOCX_ENTRIES) {
    throw new UnsafeUploadError('O DOCX contém uma quantidade anormal de componentes internos.');
  }
  if (!zip.file('[Content_Types].xml') || !zip.file('word/document.xml')) {
    throw new UnsafeUploadError('O arquivo não possui a estrutura mínima de um documento DOCX.');
  }

  let uncompressedBytes = 0;
  for (const entry of entries) {
    const entryData = (entry as unknown as { _data?: { uncompressedSize?: number } })._data;
    if (Number.isFinite(entryData?.uncompressedSize)) uncompressedBytes += Number(entryData?.uncompressedSize || 0);
    const normalized = entry.name.replace(/\\/g, '/');
    if (/vbaProject\.bin$/i.test(normalized) || /(?:^|\/)activeX(?:\/|$)/i.test(normalized)) {
      throw new UnsafeUploadError('O DOCX contém macro ou componente ActiveX não permitido.');
    }
    if (/(?:^|\/)embeddings\//i.test(normalized) && DANGEROUS_EMBEDDED_EXTENSION.test(normalized)) {
      throw new UnsafeUploadError('O DOCX contém um arquivo executável ou script incorporado.');
    }
  }
  if (uncompressedBytes > MAX_DOCX_UNCOMPRESSED_BYTES) {
    throw new UnsafeUploadError('O DOCX excede o limite de expansão segura do Portal.');
  }

  const relationshipFiles = entries.filter((entry) => !entry.dir && /\.rels$/i.test(entry.name));
  for (const relationshipFile of relationshipFiles) {
    const xml = await relationshipFile.async('text');
    for (const relationship of relationshipAttributes(xml)) {
      if (String(relationship.TargetMode || '').toLowerCase() !== 'external') continue;
      const type = String(relationship.Type || '');
      const target = String(relationship.Target || '');
      if (!isAllowedExternalHyperlink(type, target)) {
        throw new UnsafeUploadError('O DOCX contém referência externa não permitida.');
      }
    }
  }
}

/**
 * Gate determinístico para conteúdo ativo e estruturas perigosas antes que o
 * documento saia da quarentena privada. Complementa — mas não substitui — um
 * motor antivírus dedicado quando esse serviço estiver disponível.
 */
export async function assertSafeUploadedDocument(bytes: Buffer, kind: SafeDocumentKind): Promise<void> {
  if (!bytes.length) throw new UnsafeUploadError('O arquivo enviado está vazio.');
  rejectIfEicar(bytes);
  if (kind === 'PDF') {
    assertSafePdf(bytes);
    return;
  }
  await assertSafeDocx(bytes);
}
