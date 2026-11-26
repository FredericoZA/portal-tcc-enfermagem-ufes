import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import JSZip from 'jszip';
import { PDFDocument } from 'pdf-lib';
import { createTableExportFile, type TableExportSnapshot } from '../src/utils/tableExportFiles';

const snapshot: TableExportSnapshot = {
  title: 'Lista de Defesas — Novembro de 2026',
  columns: [
    { key: 'aluno1', label: 'Discente', width: 170 },
    { key: 'titulo', label: 'Título "personalizado" & assunto', width: 320 },
    { key: 'protocolo', label: 'Processo', width: 90 },
    { key: 'orientador', label: 'Orientador(a)', width: 180 },
  ],
  rows: [
    ['João da Conceição', 'Saúde; memória e "atenção"\nSegunda linha', '00009', 'Prof.ª Dr.ª Ana Mendes\nUFES'],
    ['Ágatha Pereira', '=HYPERLINK("https://example.invalid")', '00007', 'Prof. Dr. José Oliveira\nUFES'],
  ],
  appearance: { headerBackground: 'rgb(7, 91, 56)', headerColor: '#fff', bodyColor: '#172a3a', alternateBackground: '#edf2f4' },
};

function parseCsv(text: string): string[][] {
  const result: string[][] = [], row: string[] = [];
  let value = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"') {
      if (quoted && text[i + 1] === '"') { value += '"'; i++; }
      else quoted = !quoted;
    } else if (char === ';' && !quoted) { row.push(value); value = ''; }
    else if (char === '\r' && text[i + 1] === '\n' && !quoted) { row.push(value); result.push([...row]); row.length = 0; value = ''; i++; }
    else value += char;
  }
  return result;
}

test('CSV preserves selected column order, Portuguese accents, quoted multiline cells and leading zeros', async () => {
  const file = await createTableExportFile(snapshot, 'csv');
  assert.equal(file.extension, 'csv');
  assert.equal(file.mimeType, 'text/csv;charset=utf-8');
  assert.deepEqual(Array.from(file.bytes.slice(0, 3)), [0xef, 0xbb, 0xbf]);
  const rows = parseCsv(new TextDecoder().decode(file.bytes));
  assert.deepEqual(rows[0], snapshot.columns.map(column => column.label));
  assert.deepEqual(rows[1], snapshot.rows[0]);
  assert.equal(rows[2][1], `'${snapshot.rows[1][1]}`);
  assert.equal(rows[2][2], '00007');
  assert.equal(rows.length, 3);
});

test('CSV neutralizes formulas in custom headers and cells, including prefixed whitespace', async () => {
  const attacks = ['=1+1', '+cmd', '-1+2', '@SUM(A1)', '  =1+1', '\t=1+1', '\r=1+1', '\nvalue'];
  const file = await createTableExportFile({ title: 'Teste', columns: [{ key: 'title', label: '=header' }], rows: attacks.map(value => [value]) }, 'csv');
  const rows = parseCsv(new TextDecoder().decode(file.bytes));
  assert.equal(rows[0][0], "'=header");
  attacks.forEach((value, index) => assert.equal(rows[index + 1][0], `'${value.replace(/\r\n?/g, '\n')}`));
});

test('XLSX is an OOXML workbook with text cells, exact order, styling, filters and repeated frozen headings', async () => {
  const file = await createTableExportFile(snapshot, 'xlsx');
  assert.equal(file.extension, 'xlsx');
  assert.match(file.mimeType, /spreadsheetml/);
  assert.equal(Buffer.from(file.bytes.slice(0, 2)).toString(), 'PK');
  const zip = await JSZip.loadAsync(file.bytes, { checkCRC32: true });
  for (const path of ['[Content_Types].xml', '_rels/.rels', 'xl/workbook.xml', 'xl/_rels/workbook.xml.rels', 'xl/styles.xml', 'xl/worksheets/sheet1.xml']) assert.ok(zip.file(path), path);
  const sheet = await zip.file('xl/worksheets/sheet1.xml')!.async('string');
  assert.match(sheet, /<dimension ref="A1:D3"/);
  assert.match(sheet, /<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/);
  assert.match(sheet, /<autoFilter ref="A1:D3"/);
  assert.match(sheet, /<c r="A2" s="2" t="inlineStr"><is><t xml:space="preserve">João da Conceição<\/t>/);
  assert.match(sheet, /<c r="C2" s="2" t="inlineStr"><is><t xml:space="preserve">00009<\/t>/);
  assert.match(sheet, /=HYPERLINK\(&quot;https:\/\/example.invalid&quot;\)/);
  assert.match(sheet, /Título &quot;personalizado&quot; &amp; assunto/);
  assert.match(sheet, /Saúde; memória e &quot;atenção&quot;\nSegunda linha/);
  assert.doesNotMatch(sheet, /<f(?:[ >])/);
  const styles = await zip.file('xl/styles.xml')!.async('string');
  assert.match(styles, /FF075B38/);
  assert.match(styles, /wrapText="1"/);
  assert.match(await zip.file('xl/workbook.xml')!.async('string'), /_xlnm.Print_Titles/);
});

test('XLSX refuses overlong cells instead of silently cutting the exported data', async () => {
  const input = { ...snapshot, rows: [['a'.repeat(32_768)]] };
  await assert.rejects(createTableExportFile(input, 'xlsx'), /CSV ou PDF/);
  const csv = await createTableExportFile(input, 'csv');
  assert.ok(new TextDecoder().decode(csv.bytes).includes('a'.repeat(32_768)));
});

async function localFonts() {
  const [regular, bold] = await Promise.all(['Regular', 'Bold'].map(weight => readFile(new URL(`./documents/fonts/NotoSans-${weight}.ttf`, import.meta.url))));
  return { regular, bold };
}

test('PDF paginates a long summary without clipping text, repeats headers and retains Unicode accents', async () => {
  const input: TableExportSnapshot = {
    title: 'Defesas — revisão de saúde',
    columns: [{ key: 'protocolo', label: 'Processo', width: 90 }, { key: 'resumo', label: 'Resumo', width: 480 }],
    rows: [['TCC - 00001', `${'Ação de saúde e atenção à comunidade. '.repeat(550)}FIM DO RESUMO — João, Márcia e β.`], ['TCC - 00002', 'Última defesa: Conceição.']],
  };
  const file = await createTableExportFile(input, 'pdf', await localFonts());
  assert.equal(file.mimeType, 'application/pdf');
  const doc = await PDFDocument.load(file.bytes);
  assert.ok(doc.getPageCount() >= 3);
  assert.equal(doc.getTitle(), input.title);
  assert.ok(doc.getPage(0).getWidth() > doc.getPage(0).getHeight());
  const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const loading = getDocument({ data: file.bytes.slice(), verbosity: 0 });
  const parsed = await loading.promise;
  try {
    let all = '', body = '';
    for (let pageIndex = 1; pageIndex <= parsed.numPages; pageIndex++) {
      const page = await parsed.getPage(pageIndex);
      const content = await page.getTextContent();
      const text = content.items.map((item: any) => item.str || '').join(' ');
      assert.ok(text.includes('Processo'), `page ${pageIndex} must repeat headings`);
      assert.ok(text.includes('Resumo'), `page ${pageIndex} must repeat headings`);
      assert.ok(text.includes(`Página ${pageIndex} de ${parsed.numPages}`));
      for (const item of content.items as any[]) {
        if (!item.str?.trim()) continue;
        assert.ok(item.transform[4] >= 29, `Text left of margin: ${item.str}`);
        assert.ok(item.transform[4] + item.width <= page.view[2] - 29, `Text outside right margin: ${item.str}`);
        assert.ok(item.transform[5] >= 20, `Text under footer: ${item.str}`);
      }
      all += text + ' ';
      body += content.items.filter((item: any) => item.transform?.[5] < 490 && item.transform?.[5] >= 42).map((item: any) => item.str || '').join(' ') + ' ';
    }
    assert.ok(all.includes('FIM DO RESUMO — João, Márcia e β.'));
    assert.ok(all.includes('Última defesa: Conceição.'));
    assert.equal((body.replace(/\s+/g, ' ').match(/Ação de saúde e atenção à comunidade\./g) || []).length, 550);
  } finally { await loading.destroy(); }
});

test('PDF uses readable A3 landscape for all 13 configured columns', async () => {
  const input: TableExportSnapshot = {
    title: snapshot.title,
    columns: Array.from({ length: 13 }, (_, index) => ({ key: `column${index}`, label: `Coluna ${index + 1}`, width: index === 2 ? 400 : 125 })),
    rows: [Array.from({ length: 13 }, (_, index) => `Célula ${index + 1}`)],
  };
  const file = await createTableExportFile(input, 'pdf', await localFonts());
  const doc = await PDFDocument.load(file.bytes);
  assert.equal(doc.getPageCount(), 1);
  assert.equal(doc.getPage(0).getWidth(), 1190.55);
  assert.equal(doc.getPage(0).getHeight(), 841.89);
});

test('Exports require at least one selected column', async () => {
  await assert.rejects(createTableExportFile({ title: 'Lista', columns: [], rows: [] }, 'csv'), /pelo menos uma coluna/);
});
