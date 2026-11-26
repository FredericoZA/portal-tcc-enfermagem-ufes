import { test } from 'node:test';
import assert from 'node:assert/strict';
import { captureTableExportSnapshot } from '../src/utils/tableExportSnapshot';
import { isPortalTableRowFilteredOut } from '../src/utils/portalTableDom';

// Small DOM fixture implements browser data structures; production code is used
// directly. Browser preview separately covers layout/computed-style integration.
class ElementFixture {
  nodeType = 1;
  dataset: Record<string, string> = {};
  hidden = false;
  style = { display: '', visibility: '', width: '' };
  css = { display: 'table-cell', visibility: 'visible', backgroundColor: 'rgba(0, 0, 0, 0)', color: '' };
  attributes = new Map<string, string>();
  classes = new Set<string>();
  classList = { contains: (key: string) => this.classes.has(key) };
  width = 120;
  parentElement: ElementFixture | null = null;
  childNodes: (ElementFixture | { nodeType: number; textContent: string })[] = [];
  ownerDocument: { defaultView?: { getComputedStyle: (element: ElementFixture) => typeof this.css } } = {
    defaultView: { getComputedStyle: element => element.css },
  };
  constructor(public tagName: string, children: (ElementFixture | string)[] = []) {
    for (const child of children) this.append(child);
  }
  append(child: ElementFixture | string) {
    if (typeof child === 'string') this.childNodes.push({ nodeType: 3, textContent: child });
    else { child.parentElement = this; this.childNodes.push(child); }
    return this;
  }
  get textContent(): string { return this.childNodes.map(child => child.textContent).join(''); }
  getAttribute(key: string) { return this.attributes.get(key) ?? null; }
  getBoundingClientRect() { return { width: this.width }; }
  cloneNode() {
    const copy = new ElementFixture(this.tagName);
    copy.classes = new Set(this.classes);
    for (const child of this.childNodes) copy.append(child instanceof ElementFixture ? child.cloneNode() : child.textContent);
    return copy;
  }
  querySelectorAll(selector: string): ElementFixture[] {
    const selectors = selector.split(',');
    return this.childNodes.flatMap(child => child instanceof ElementFixture
      ? [...(selectors.some(value => value.startsWith('.') ? child.classes.has(value.slice(1)) : child.tagName.toLowerCase() === value) ? [child] : []), ...child.querySelectorAll(selector)]
      : []);
  }
  remove() {
    if (this.parentElement) this.parentElement.childNodes = this.parentElement.childNodes.filter(child => child !== this);
  }
}

const el = (tag: string, ...children: (ElementFixture | string)[]) => new ElementFixture(tag, children);
function header(key: string, label: string) {
  const cell = el('TH', label);
  cell.dataset.portalColumnKey = key;
  return cell;
}
function row(...cells: ElementFixture[]) {
  return Object.assign(el('TR', ...cells), { cells });
}
function table(headers: ElementFixture[], rows: ReturnType<typeof row>[]) {
  const heading = row(...headers);
  const head = Object.assign(el('THEAD', heading), { rows: [heading] });
  const body = Object.assign(el('TBODY', ...rows), { rows });
  return Object.assign(el('TABLE', head, body), { tHead: head, tBodies: [body] }) as unknown as HTMLTableElement;
}

test('snapshot preserves chosen labels/column order and sorted rows across pages while excluding filtered rows', () => {
  const student = header('aluno1', 'Discente');
  const privateHeader = header('email', 'E-mail privado'); privateHeader.hidden = true;
  const process = header('protocolo', 'Processo');
  const first = row(el('TD', 'Beatriz'), el('TD', 'secret@example.invalid'), el('TD', 'TCC - 00002'));
  const second = row(el('TD', 'Ana'), el('TD', 'private@example.invalid'), el('TD', 'TCC - 00001'));
  second.classes.add('portal-runtime-page-hidden');
  const removed = row(el('TD', 'Não exportar'), el('TD', 'private'), el('TD', 'TCC - 00003'));
  removed.classes.add('portal-core-filter-hidden');
  const snapshot = captureTableExportSnapshot(table([student, privateHeader, process], [first, second, removed]), { title: 'Lista de Defesas' });
  assert.deepEqual(snapshot.columns.map(({ key, label }) => ({ key, label })), [
    { key: 'aluno1', label: 'Discente' }, { key: 'protocolo', label: 'Processo' },
  ]);
  assert.deepEqual(snapshot.rows, [['Beatriz', 'TCC - 00002'], ['Ana', 'TCC - 00001']]);
  assert.doesNotMatch(JSON.stringify(snapshot), /private|secret|Não exportar/);
});

test('snapshot reads multiline values and authorized summaries without button text or hidden content', () => {
  const advisor = el('TD', el('DIV', el('SPAN', 'Prof.ª Dr.ª Ana Souza')), el('DIV', 'UFES'));
  const hidden = el('SPAN', 'campo invisível'); hidden.css.display = 'none'; advisor.append(hidden);
  advisor.append(el('BUTTON', 'Editar participante'));
  // The visual gap between adjacent flex spans is not part of textContent.
  const date = el('TD', el('DIV', el('SPAN', '(aguardando confirmação)'), el('SPAN', 'Quinta-feira, 26/11/2026')), el('DIV', '14:00'));
  date.dataset.portalExportValue = '(aguardando confirmação)\nQuinta-feira, 26/11/2026\n14:00';
  const summary = el('TD', el('BUTTON', 'Abrir resumo'));
  summary.dataset.portalExportValue = 'Introdução\nTexto com ação e saúde.';
  summary.attributes.set('title', 'tooltip não exportável');
  const snapshot = captureTableExportSnapshot(table(
    [header('orientador', 'Orientador(a)'), header('defesaDataHora', 'Data e hora'), header('resumo', 'Resumo')],
    [row(advisor, date, summary)],
  ), { title: 'Lista de Defesas' });
  assert.deepEqual(snapshot.rows, [[
    'Prof.ª Dr.ª Ana Souza\nUFES', '(aguardando confirmação)\nQuinta-feira, 26/11/2026\n14:00', 'Introdução\nTexto com ação e saúde.',
  ]]);
});

test('snapshot excludes runtime header controls, captures resized widths and opaque palette', () => {
  const process = header('protocolo', 'Nº do Processo');
  process.append(el('BUTTON', 'Ordenar ou filtrar')); process.append(el('SVG', 'ícone'));
  process.width = 184;
  process.css.backgroundColor = 'rgb(5, 85, 50)';
  process.css.color = '#fff';
  const first = row(el('TD', 'TCC - 00001')); first.cells[0].css.color = 'rgb(15, 23, 42)';
  const second = row(el('TD', 'TCC - 00002')); second.css.backgroundColor = 'rgb(232, 237, 240)';
  const snapshot = captureTableExportSnapshot(table([process], [first, second]), { title: '  Lista\n de Defesas  ' });
  assert.deepEqual(snapshot.columns, [{ key: 'protocolo', label: 'Nº do Processo', width: 184 }]);
  assert.equal(snapshot.title, 'Lista de Defesas');
  assert.deepEqual(snapshot.appearance, {
    headerBackground: '#055532', headerColor: '#ffffff', bodyColor: '#0f172a', alternateBackground: '#e8edf0',
  });
});

test('pagination and export agree on every external hiding signal', () => {
  const cases = [
    (element: ReturnType<typeof row>) => element.classes.add('portal-core-filter-hidden'),
    (element: ReturnType<typeof row>) => { element.dataset.portalFilterHidden = 'true'; },
    (element: ReturnType<typeof row>) => { element.hidden = true; },
    (element: ReturnType<typeof row>) => { element.style.display = 'none'; },
  ];
  for (const hide of cases) {
    const hidden = row(el('TD', 'Não exportar')); hide(hidden);
    assert.equal(isPortalTableRowFilteredOut(hidden as unknown as HTMLTableRowElement), true);
    const snapshot = captureTableExportSnapshot(table([header('aluno1', 'Aluno')], [hidden]), { title: 'Lista' });
    assert.deepEqual(snapshot.rows, []);
  }
  const anotherPage = row(el('TD', 'Outro registro')); anotherPage.classes.add('portal-runtime-page-hidden');
  assert.equal(isPortalTableRowFilteredOut(anotherPage as unknown as HTMLTableRowElement), false);
});

test('zero selected columns and explicit empty values do not recover hidden data', () => {
  const hiddenHeader = header('aluno1', 'Aluno'); hiddenHeader.css.display = 'none';
  assert.deepEqual(captureTableExportSnapshot(table([hiddenHeader], [row(el('TD', 'Oculto'))]), { title: 'Lista' }).rows, []);
  const summary = el('TD', el('BUTTON', 'Resumo indisponível')); summary.dataset.portalExportValue = '';
  assert.deepEqual(captureTableExportSnapshot(table([header('resumo', 'Resumo')], [row(summary)]), { title: 'Lista' }).rows, [['']]);
});

test('export-specific columns can be reordered and excluded without changing the source sheet', () => {
  const source = table(
    [header('aluno1', 'Discente'), header('protocolo', 'Processo'), header('titulo', 'Título')],
    [row(el('TD', 'Ana'), el('TD', 'TCC - 00001'), el('TD', 'Primeira defesa'))],
  );
  const selection = captureTableExportSnapshot(source, {title: 'Lista de Defesas', columnOrder: ['titulo', 'protocolo']});
  assert.deepEqual(selection.columns.map(column => column.label), ['Título', 'Processo']);
  assert.deepEqual(selection.rows, [['Primeira defesa', 'TCC - 00001']]);
  assert.deepEqual(captureTableExportSnapshot(source, {title:'Lista de Defesas'}).rows,
    [['Ana', 'TCC - 00001', 'Primeira defesa']]);
});
