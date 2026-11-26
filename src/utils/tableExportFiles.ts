import type { PDFFont, PDFPage } from 'pdf-lib';

export type TableExportFormat = 'xlsx' | 'csv' | 'pdf';

/** A snapshot contains only columns and rows already authorized for this table. */
export interface TableExportSnapshot {
  title: string;
  columns: Array<{ key: string; label: string; width?: number }>;
  rows: string[][];
  appearance?: {
    headerBackground?: string;
    headerColor?: string;
    bodyColor?: string;
    alternateBackground?: string;
  };
}

export interface TableExportFile {
  bytes: Uint8Array;
  mimeType: string;
  extension: TableExportFormat;
}

export interface TableExportPdfFonts {
  regular: Uint8Array;
  bold: Uint8Array;
}

const MIME_TYPES: Record<TableExportFormat, string> = {
  csv: 'text/csv;charset=utf-8',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  pdf: 'application/pdf',
};

const DEFAULT_COLORS = {
  headerBackground: '075B38',
  headerColor: 'FFFFFF',
  bodyColor: '172A3A',
  alternateBackground: 'EDF2F4',
};

function normalizeText(value: string): string {
  return String(value ?? '').normalize('NFC').replace(/\r\n?/g, '\n');
}

function xmlText(value: string): string {
  // XML 1.0 cannot represent these control characters, even as entities.
  return normalizeText(value).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g, '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

function colorHex(value: string | undefined, fallback: string): string {
  const hex = value?.trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i)?.[1];
  if (hex) return (hex.length === 3 ? Array.from(hex, c => c + c).join('') : hex).toUpperCase();
  const rgb = value?.trim().match(/^rgba?\(\s*(\d+(?:\.\d+)?)\s*[, ]\s*(\d+(?:\.\d+)?)\s*[, ]\s*(\d+(?:\.\d+)?)(?:\s*[,/]\s*(\d+(?:\.\d+)?))?\s*\)$/i);
  if (!rgb || (rgb[4] !== undefined && Number(rgb[4]) !== 1)) return fallback;
  return rgb.slice(1, 4).map(part => Math.min(255, Math.max(0, Math.round(Number(part)))).toString(16).padStart(2, '0')).join('').toUpperCase();
}

function exportColors(snapshot: TableExportSnapshot) {
  return {
    headerBackground: colorHex(snapshot.appearance?.headerBackground, DEFAULT_COLORS.headerBackground),
    headerColor: colorHex(snapshot.appearance?.headerColor, DEFAULT_COLORS.headerColor),
    bodyColor: colorHex(snapshot.appearance?.bodyColor, DEFAULT_COLORS.bodyColor),
    alternateBackground: colorHex(snapshot.appearance?.alternateBackground, DEFAULT_COLORS.alternateBackground),
  };
}

function cellText(row: string[], index: number): string {
  return normalizeText(row[index] ?? '');
}

function csvCell(value: string): string {
  const text = normalizeText(value);
  // Quoting alone does not stop spreadsheets from executing a formula on import.
  const safe = /^[\u0000-\u0020\uFEFF]*[=+\-@]/u.test(text) || /^[\t\r\n]/u.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
}

function csvBytes(snapshot: TableExportSnapshot): Uint8Array {
  const rows = [snapshot.columns.map(column => column.label), ...snapshot.rows.map(row => snapshot.columns.map((_, index) => cellText(row, index)))];
  return new TextEncoder().encode('\uFEFF' + rows.map(row => row.map(csvCell).join(';')).join('\r\n') + '\r\n');
}

function excelColumn(index: number): string {
  let result = '';
  for (let value = index + 1; value > 0; value = Math.floor((value - 1) / 26)) result = String.fromCharCode(65 + ((value - 1) % 26)) + result;
  return result;
}

function excelWidth(column: TableExportSnapshot['columns'][number]): number {
  const fallback = /titulo|resumo|local/i.test(column.key) ? 280 : /aluno|orientador|membro/i.test(column.key) ? 190 : 125;
  return Math.max(12, Math.min(80, ((Number.isFinite(column.width) && column.width! > 0 ? column.width! : fallback) - 5) / 7));
}

async function xlsxBytes(snapshot: TableExportSnapshot): Promise<Uint8Array> {
  if (snapshot.rows.length > 1_048_575 || snapshot.columns.length > 16_384) throw new Error('A lista ultrapassa o limite de linhas ou colunas do Excel. Reduza os filtros e tente novamente.');
  const { default: JSZip } = await import('jszip');
  const zip = new JSZip();
  const colors = exportColors(snapshot);
  const values = [snapshot.columns.map(column => column.label), ...snapshot.rows.map(row => snapshot.columns.map((_, index) => cellText(row, index)))];
  if (values.some(row => row.some(value => value.length > 32_767))) throw new Error('Uma célula ultrapassa o limite de texto do Excel. Use CSV ou PDF para preservar o conteúdo completo.');
  const widths = snapshot.columns.map(excelWidth);
  const end = `${excelColumn(snapshot.columns.length - 1)}${values.length}`;
  const rows = values.map((row, rowIndex) => {
    const style = rowIndex === 0 ? 1 : rowIndex % 2 === 1 ? 2 : 3;
    const lines = Math.max(1, ...row.map((value, i) => value.split('\n').reduce((sum, part) => sum + Math.max(1, Math.ceil(Array.from(part).length / widths[i])), 0)));
    const height = Math.min(409, Math.max(rowIndex === 0 ? 30 : 27, lines * 15 + 10));
    return `<row r="${rowIndex + 1}" ht="${height}" customHeight="1">${row.map((value, i) => `<c r="${excelColumn(i)}${rowIndex + 1}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${xmlText(value)}</t></is></c>`).join('')}</row>`;
  }).join('');
  const xml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
  zip.file('[Content_Types].xml', xml + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>');
  zip.file('_rels/.rels', xml + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>');
  zip.file('docProps/core.xml', xml + `<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>${xmlText(snapshot.title)}</dc:title></cp:coreProperties>`);
  zip.file('xl/workbook.xml', xml + '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><bookViews><workbookView/></bookViews><sheets><sheet name="Lista de Defesas" sheetId="1" r:id="rId1"/></sheets><definedNames><definedName name="_xlnm.Print_Titles" localSheetId="0">\'Lista de Defesas\'!$1:$1</definedName></definedNames></workbook>');
  zip.file('xl/_rels/workbook.xml.rels', xml + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>');
  zip.file('xl/styles.xml', xml + `<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><color rgb="FF${colors.bodyColor}"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FF${colors.headerColor}"/><name val="Calibri"/></font></fonts><fills count="4"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF${colors.headerBackground}"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FF${colors.alternateBackground}"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="2"><border/><border><left style="thin"><color rgb="FFCBD5E1"/></left><right style="thin"><color rgb="FFCBD5E1"/></right><top style="thin"><color rgb="FFCBD5E1"/></top><bottom style="thin"><color rgb="FFCBD5E1"/></bottom></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="4"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="49" fontId="1" fillId="2" borderId="1" xfId="0" applyAlignment="1" applyNumberFormat="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf><xf numFmtId="49" fontId="0" fillId="3" borderId="1" xfId="0" applyAlignment="1" applyNumberFormat="1"><alignment vertical="center" wrapText="1"/></xf><xf numFmtId="49" fontId="0" fillId="0" borderId="1" xfId="0" applyAlignment="1" applyNumberFormat="1"><alignment vertical="center" wrapText="1"/></xf></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`);
  zip.file('xl/worksheets/sheet1.xml', xml + `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetPr><pageSetUpPr fitToPage="1"/></sheetPr><dimension ref="A1:${end}"/><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="A2" sqref="A2"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="27"/><cols>${widths.map((width, i) => `<col min="${i + 1}" max="${i + 1}" width="${width.toFixed(2)}" customWidth="1"/>`).join('')}</cols><sheetData>${rows}</sheetData><autoFilter ref="A1:${end}"/><pageMargins left="0.3" right="0.3" top="0.4" bottom="0.4" header="0.2" footer="0.2"/><pageSetup paperSize="${snapshot.columns.length > 7 ? 8 : 9}" orientation="landscape" fitToWidth="1" fitToHeight="0"/></worksheet>`);
  return zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
}

let fontBytes: Promise<TableExportPdfFonts> | undefined;

async function loadPdfFonts(): Promise<TableExportPdfFonts> {
  if (!fontBytes) {
    fontBytes = (async () => {
      const urls = [
        // Reuse the bundled Noto fonts; their license is served at /licenses/table-export-fonts-OFL.txt.
        new URL('../../server/documents/fonts/NotoSans-Regular.ttf', import.meta.url),
        new URL('../../server/documents/fonts/NotoSans-Bold.ttf', import.meta.url),
      ];
      const result = await Promise.all(urls.map(async url => {
        const response = await fetch(url);
        if (!response.ok) throw new Error('Não foi possível carregar as fontes do PDF. Tente novamente.');
        return new Uint8Array(await response.arrayBuffer());
      }));
      return { regular: result[0], bold: result[1] };
    })().catch(error => { fontBytes = undefined; throw error; });
  }
  return fontBytes;
}

function wrapPdfText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const result: string[] = [];
  for (const paragraph of normalizeText(text).split('\n')) {
    let line = '';
    for (const word of paragraph.replace(/\t/g, '    ').split(/ +/u)) {
      const next = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(next, size) <= maxWidth) { line = next; continue; }
      if (line) result.push(line);
      line = '';
      // A long word/URL must wrap too, instead of painting outside the column.
      for (const char of word) {
        if (line && font.widthOfTextAtSize(line + char, size) > maxWidth) { result.push(line); line = ''; }
        line += char;
      }
    }
    result.push(line);
  }
  return result;
}

async function pdfBytes(snapshot: TableExportSnapshot, suppliedFonts?: TableExportPdfFonts): Promise<Uint8Array> {
  const [{ PDFDocument, rgb }, { default: fontkit }, fonts] = await Promise.all([
    import('pdf-lib'), import('@pdf-lib/fontkit'), suppliedFonts ?? loadPdfFonts(),
  ]);
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const [regular, bold] = await Promise.all([pdf.embedFont(fonts.regular, { subset: true }), pdf.embedFont(fonts.bold, { subset: true })]);
  const colors = exportColors(snapshot);
  const color = (hex: string) => rgb(parseInt(hex.slice(0, 2), 16) / 255, parseInt(hex.slice(2, 4), 16) / 255, parseInt(hex.slice(4, 6), 16) / 255);
  const border = rgb(0.79, 0.83, 0.87);
  const pageSize: [number, number] = snapshot.columns.length > 7 ? [1190.55, 841.89] : [841.89, 595.28];
  const margin = 30, bottom = 42, tableWidth = pageSize[0] - margin * 2, fontSize = 9, lineHeight = 13, padding = 7;
  const minimumWidth = 50;
  const weights = snapshot.columns.map(column => Math.max(70, Math.min(440, column.width || excelWidth(column) * 7)));
  const weightSum = weights.reduce((sum, width) => sum + width, 0);
  const flexibleWidth = Math.max(0, tableWidth - minimumWidth * snapshot.columns.length);
  const widths = weights.map(weight => minimumWidth + flexibleWidth * weight / weightSum);
  const titleLines = wrapPdfText(snapshot.title, bold, 16, tableWidth);
  const headerLines = snapshot.columns.map((column, i) => wrapPdfText(column.label, bold, fontSize, widths[i] - padding * 2));
  const headerHeight = Math.max(...headerLines.map(lines => lines.length)) * lineHeight + padding * 2;
  const tableTop = pageSize[1] - margin - titleLines.length * 20 - 27;
  if (tableTop - headerHeight < bottom + lineHeight + padding * 2) throw new Error('O título ou os nomes das colunas são extensos demais para o PDF. Reduza os rótulos ou use Excel/CSV.');
  pdf.setTitle(snapshot.title);
  pdf.setSubject('Lista exportada com as colunas, a ordem e os filtros selecionados.');

  const drawCellLines = (page: PDFPage, lines: string[], x: number, top: number, font: PDFFont, hex: string) => {
    lines.forEach((line, n) => page.drawText(line, { x: x + padding, y: top - padding - fontSize - n * lineHeight, size: fontSize, font, color: color(hex) }));
  };
  const newPage = () => {
    const page = pdf.addPage(pageSize);
    titleLines.forEach((title, i) => page.drawText(title, { x: margin, y: pageSize[1] - margin - 16 - i * 20, size: 16, font: bold, color: color(colors.headerBackground) }));
    page.drawText(`${snapshot.rows.length} ${snapshot.rows.length === 1 ? 'registro' : 'registros'} · ${snapshot.columns.length} ${snapshot.columns.length === 1 ? 'coluna' : 'colunas'}`, { x: margin, y: tableTop + 12, size: 9, font: regular, color: color(colors.bodyColor) });
    let x = margin;
    snapshot.columns.forEach((_, i) => {
      page.drawRectangle({ x, y: tableTop - headerHeight, width: widths[i], height: headerHeight, color: color(colors.headerBackground), borderColor: border, borderWidth: 0.4 });
      drawCellLines(page, headerLines[i], x, tableTop, bold, colors.headerColor);
      x += widths[i];
    });
    return page;
  };
  let page = newPage(), y = tableTop - headerHeight;
  if (!snapshot.rows.length) page.drawText('Nenhum registro corresponde aos filtros selecionados.', { x: margin + padding, y: y - 25, size: 10, font: regular, color: color(colors.bodyColor) });
  for (const [rowIndex, row] of snapshot.rows.entries()) {
    let remaining = snapshot.columns.map((_, i) => wrapPdfText(cellText(row, i), regular, fontSize, widths[i] - padding * 2));
    const required = Math.max(...remaining.map(lines => lines.length)) * lineHeight + padding * 2;
    // Keep ordinary rows intact; split only a row larger than a complete page.
    if (required > y - bottom && required <= tableTop - headerHeight - bottom) { page = newPage(); y = tableTop - headerHeight; }
    while (remaining.some(lines => lines.length > 0)) {
      let availableLines = Math.floor((y - bottom - padding * 2) / lineHeight);
      if (availableLines < 1) { page = newPage(); y = tableTop - headerHeight; availableLines = Math.floor((y - bottom - padding * 2) / lineHeight); }
      const take = Math.min(availableLines, Math.max(...remaining.map(lines => lines.length)));
      const height = take * lineHeight + padding * 2;
      let x = margin;
      remaining.forEach((lines, i) => {
        page.drawRectangle({ x, y: y - height, width: widths[i], height, color: rowIndex % 2 === 0 ? color(colors.alternateBackground) : rgb(1, 1, 1), borderColor: border, borderWidth: 0.4 });
        drawCellLines(page, lines.slice(0, take), x, y, regular, colors.bodyColor);
        x += widths[i];
      });
      remaining = remaining.map(lines => lines.slice(take));
      y -= height;
    }
  }
  const pages = pdf.getPages();
  pages.forEach((item, index) => {
    const text = `Página ${index + 1} de ${pages.length}`;
    item.drawText(text, { x: pageSize[0] - margin - regular.widthOfTextAtSize(text, 8), y: 22, size: 8, font: regular, color: color(colors.bodyColor) });
  });
  return pdf.save();
}

/** The optional fonts parameter lets isolated file tests reuse the bundled fonts. */
export async function createTableExportFile(snapshot: TableExportSnapshot, format: TableExportFormat, pdfFonts?: TableExportPdfFonts): Promise<TableExportFile> {
  if (!snapshot.columns.length) throw new Error('Selecione pelo menos uma coluna para baixar a lista.');
  if (!['csv', 'xlsx', 'pdf'].includes(format)) throw new Error('Formato de download não reconhecido.');
  const bytes = format === 'csv' ? csvBytes(snapshot) : format === 'xlsx' ? await xlsxBytes(snapshot) : await pdfBytes(snapshot, pdfFonts);
  return { bytes, mimeType: MIME_TYPES[format], extension: format };
}
