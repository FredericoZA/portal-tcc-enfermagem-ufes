const normalizePdfText = (value: string) => value
  .normalize('NFC')
  .replace(/[“”]/g, '"')
  .replace(/[‘’]/g, "'")
  .replace(/[–—]/g, '-')
  .replace(/…/g, '...')
  .replace(/[^\u0009\u000A\u000D\u0020-\u00FF]/g, '');

const escapeLiteral = (value: string) => normalizePdfText(value)
  .replace(/\\/g, '\\\\')
  .replace(/\(/g, '\\(')
  .replace(/\)/g, '\\)');

function wrapText(text: string, maxLength = 86): string[] {
  const output: string[] = [];
  for (const paragraph of normalizePdfText(text).split(/\r?\n/)) {
    const words = paragraph.trim().split(/\s+/).filter(Boolean);
    if (!words.length) { output.push(''); continue; }
    let line = '';
    for (const word of words) {
      if (!line) line = word;
      else if (`${line} ${word}`.length <= maxLength) line += ` ${word}`;
      else { output.push(line); line = word; }
    }
    if (line) output.push(line);
    output.push('');
  }
  return output;
}

function pageStream(title: string, protocol: string, institution: string, course: string, footer: string, lines: string[], page: number, total: number): Buffer {
  const body = lines.map((line) => `(${escapeLiteral(line)}) Tj T*`).join('\n');
  const stream = [
    '0.02 0.32 0.18 rg',
    `BT /F1 9 Tf 72 808 Td (${escapeLiteral(institution)}) Tj ET`,
    `BT /F1 8 Tf 72 796 Td (${escapeLiteral(course)}) Tj ET`,
    `BT /F1 15 Tf 72 775 Td (${escapeLiteral(title)}) Tj ET`,
    '0.12 0.16 0.22 rg',
    `BT /F1 9 Tf 72 758 Td (${escapeLiteral(protocol)}) Tj ET`,
    '0.82 0.85 0.88 RG 72 748 m 523 748 l S',
    `BT /F1 11 Tf 15 TL 72 724 Td ${body} ET`,
    '0.82 0.85 0.88 RG 72 55 m 523 55 l S',
    '0.35 0.40 0.46 rg',
    `BT /F1 8 Tf 72 40 Td (${escapeLiteral(`${footer} - página ${page} de ${total}`)}) Tj ET`
  ].join('\n');
  return Buffer.from(stream, 'latin1');
}

export function createProfessionalPdf(input: { title: string; protocol: string; body: string; institution?: string; course?: string; footer?: string }): Buffer {
  const allLines = wrapText(input.body);
  const perPage = 43;
  const pages: string[][] = [];
  for (let index = 0; index < allLines.length; index += perPage) pages.push(allLines.slice(index, index + perPage));
  if (!pages.length) pages.push(['']);

  const objects: Buffer[] = [];
  const pageRefs = pages.map((_, index) => `${4 + index * 2} 0 R`).join(' ');
  objects.push(Buffer.from('<< /Type /Catalog /Pages 2 0 R >>', 'ascii'));
  objects.push(Buffer.from(`<< /Type /Pages /Kids [${pageRefs}] /Count ${pages.length} >>`, 'ascii'));
  objects.push(Buffer.from('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>', 'ascii'));
  pages.forEach((lines, index) => {
    const pageObject = 4 + index * 2;
    const contentObject = pageObject + 1;
    const stream = pageStream(input.title, input.protocol, input.institution || 'INSTITUIÇÃO NÃO CONFIGURADA', input.course || 'CURSO NÃO CONFIGURADO', input.footer || 'Portal de TCC', lines, index + 1, pages.length);
    objects.push(Buffer.from(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentObject} 0 R >>`, 'ascii'));
    objects.push(Buffer.concat([Buffer.from(`<< /Length ${stream.length} >>\nstream\n`, 'ascii'), stream, Buffer.from('\nendstream', 'ascii')]));
  });

  const chunks: Buffer[] = [Buffer.from('%PDF-1.4\n%âãÏÓ\n', 'latin1')];
  const offsets = [0];
  let byteOffset = chunks[0].length;
  objects.forEach((object, index) => {
    offsets.push(byteOffset);
    const wrapped = Buffer.concat([Buffer.from(`${index + 1} 0 obj\n`, 'ascii'), object, Buffer.from('\nendobj\n', 'ascii')]);
    chunks.push(wrapped);
    byteOffset += wrapped.length;
  });
  const xrefOffset = byteOffset;
  const xref = [`xref\n0 ${objects.length + 1}\n`, '0000000000 65535 f \n', ...offsets.slice(1).map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`)].join('');
  chunks.push(Buffer.from(`${xref}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`, 'ascii'));
  return Buffer.concat(chunks);
}
