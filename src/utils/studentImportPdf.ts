type PdfTextItem = { str: string; transform: number[]; width: number; hasEOL?: boolean };

/** Reconstruct table rows by position instead of concatenating unrelated columns. */
export function accessPdfPageText(items: PdfTextItem[]): string {
  const lines: { y: number; items: PdfTextItem[] }[] = [];
  for (const item of items.filter(item => item.str.trim())) {
    const y = item.transform[5];
    let line = lines.find(line => Math.abs(line.y - y) < 3);
    if (!line) { line = { y, items: [] }; lines.push(line); }
    line.items.push(item);
  }
  return lines.sort((a,b) => b.y-a.y).map(line => {
    let end = 0;
    return line.items.sort((a,b) => a.transform[4]-b.transform[4]).map((item,index) => {
      const gap = item.transform[4]-end;
      end = item.transform[4]+item.width;
      return (index ? gap > 12 ? '\t' : ' ' : '')+item.str;
    }).join('');
  }).join('\n');
}

export async function readAccessPdfText(bytes: ArrayBuffer): Promise<string> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  if (typeof window !== 'undefined') {
    const { default: workerUrl } = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
    pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  }
  const task = pdfjs.getDocument({ data: new Uint8Array(bytes) });
  try {
    const pdf = await task.promise;
    if (pdf.numPages > 100) throw new Error('Use um PDF com até 100 páginas.');
    const pages: string[] = [];
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      pages.push(accessPdfPageText(content.items.filter(item => 'str' in item) as PdfTextItem[]));
      page.cleanup();
    }
    const text = pages.join('\n');
    if (!text.trim()) throw new Error('Este PDF contém apenas imagens. Use um PDF com texto selecionável, uma planilha ou cole a lista.');
    return text;
  } catch (error) {
    if (error instanceof Error && error.name === 'PasswordException') throw new Error('O PDF está protegido por senha. Envie uma cópia sem senha ou use a planilha.');
    throw error;
  } finally { await task.destroy(); }
}
