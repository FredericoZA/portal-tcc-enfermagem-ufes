from pathlib import Path
import re


def read(path):
    return Path(path).read_text()


def write(path, text):
    Path(path).write_text(text)


def replace_once(path, old, new):
    text = read(path)
    if old not in text:
        raise SystemExit(f'Trecho não encontrado em {path}: {old[:120]!r}')
    write(path, text.replace(old, new, 1))


# 1) Enhancer global: cabeçalho seguro, nomes canônicos, hora numérica e coluna de seleção sem ordenação.
path = 'src/components/PortalSpreadsheetEnhancer.tsx'
s = read(path)
anchor = "function normalize(value:string){return stripEmojis(value || '').replace(/\\s+/g,' ').trim();}\n"
if anchor not in s:
    raise SystemExit('Âncora normalize não encontrada')
helpers = r'''
function replaceHeaderText(header:HTMLTableCellElement,replacer:(value:string)=>string){
  const walker=document.createTreeWalker(header,NodeFilter.SHOW_TEXT);const nodes:Text[]=[];let current:Node|null;
  while((current=walker.nextNode()))nodes.push(current as Text);
  nodes.forEach(node=>{if(!node.parentElement?.closest('button,.portal-column-controls'))node.data=replacer(node.data);});
}
function canonicalizeHeader(header:HTMLTableCellElement){
  let dateColumn=false;
  replaceHeaderText(header,value=>{
    let next=value.replace(/N[º°o]\\.?\\s*(?:do\\s+)?Processo/gi,'Processo');
    const datePattern=/Data\\s*(?:e|\\/)\\s*(?:Horário|Hora)/gi;
    if(datePattern.test(next)){dateColumn=true;datePattern.lastIndex=0;next=next.replace(datePattern,'Data');}
    return next;
  });
  const compact=normalize(header.textContent||'').replace(/[↕↑↓]/g,'').trim().toLocaleLowerCase('pt-BR');
  if(dateColumn||compact==='data')header.dataset.portalDateColumn='true';
}
const PT_NUMBER_WORDS:Record<string,number>={zero:0,um:1,uma:1,dois:2,duas:2,tres:3,quatro:4,cinco:5,seis:6,sete:7,oito:8,nove:9,dez:10,onze:11,doze:12,treze:13,quatorze:14,quinze:15,dezesseis:16,dezessete:17,dezoito:18,dezenove:19,vinte:20,trinta:30,quarenta:40,cinquenta:50};
function ptNumber(value:string){
  const words=value.normalize('NFD').replace(/[\\u0300-\\u036f]/g,'').toLocaleLowerCase('pt-BR').split(/\\s+e\\s+|\\s+/).filter(Boolean);
  let total=0;for(const word of words){if(PT_NUMBER_WORDS[word]===undefined)return NaN;total+=PT_NUMBER_WORDS[word];}return total;
}
function writtenTimeToNumeric(value:string){
  const match=value.trim().match(/^(.+?)\\s+horas?(?:\\s+e\\s+(.+?)\\s+minutos?)?$/i);if(!match)return null;
  const hours=ptNumber(match[1]);const minutes=match[2]?ptNumber(match[2]):0;
  if(!Number.isFinite(hours)||!Number.isFinite(minutes)||hours<0||hours>23||minutes<0||minutes>59)return null;
  return `${String(hours).padStart(2,'0')}:${String(minutes).padStart(2,'0')}`;
}
function normalizeDateCells(table:HTMLTableElement){
  const headers=Array.from(table.tHead?.rows[0]?.cells||[]);
  headers.forEach((th,index)=>{if((th as HTMLTableCellElement).dataset.portalDateColumn!=='true')return;
    Array.from(table.tBodies[0]?.rows||[]).forEach(row=>{const cell=row.cells[index];if(!cell)return;
      const walker=document.createTreeWalker(cell,NodeFilter.SHOW_TEXT);const nodes:Text[]=[];let current:Node|null;while((current=walker.nextNode()))nodes.push(current as Text);
      nodes.forEach(node=>{const numeric=writtenTimeToNumeric(node.data);if(numeric)node.data=numeric;});
    });
  });
}
'''
s = s.replace(anchor, anchor + helpers, 1)
s = s.replace(
    "function cellValue(row:HTMLTableRowElement,index:number){return normalize(row.cells[index]?.textContent || '—') || '—';}",
    "function cellValue(row:HTMLTableRowElement,index:number){const cell=row.cells[index];return normalize(cell?.dataset.portalFilterValue || cell?.textContent || '—') || '—';}",
    1,
)
old = '''    const header=th as HTMLTableCellElement;const key=keyForHeader(header,index);
    if(header.querySelector('.portal-column-controls'))return;
    const controls=document.createElement('span');controls.className='portal-column-controls';
    const labelHost=header.querySelector<HTMLElement>(':scope > div')||header;
    labelHost.classList.add('portal-column-header-content');
    const hasNativeSort=header.classList.contains('cursor-pointer')||header.dataset.portalNativeSort==='true'||Boolean(header.querySelector('[data-portal-sort],button[aria-label*="Ordenar"]'));
    if(!hasNativeSort){'''
new = '''    const header=th as HTMLTableCellElement;canonicalizeHeader(header);const key=keyForHeader(header,index);
    if(header.querySelector('.portal-column-controls'))return;
    const controls=document.createElement('span');controls.className='portal-column-controls';
    let labelHost=header.querySelector<HTMLElement>(':scope > .portal-column-header-content, :scope > div');
    if(!labelHost){const wrapper=document.createElement('span');wrapper.className='portal-column-header-content';while(header.firstChild)wrapper.appendChild(header.firstChild);header.appendChild(wrapper);labelHost=wrapper;}else labelHost.classList.add('portal-column-header-content');
    const isSelectionColumn=header.dataset.portalSelectionColumn==='true';
    const hasNativeSort=isSelectionColumn||header.classList.contains('cursor-pointer')||header.dataset.portalNativeSort==='true'||Boolean(header.querySelector('[data-portal-sort],button[aria-label*="Ordenar"]'));
    if(!hasNativeSort){'''
if old not in s:
    raise SystemExit('Bloco de cabeçalho do enhancer não encontrado')
s = s.replace(old, new, 1)
marker = '''  });
  applyFilters(table);
}'''
if marker not in s:
    raise SystemExit('Final enhanceTable não encontrado')
s = s.replace(marker, '''  });
  normalizeDateCells(table);
  applyFilters(table);
}''', 1)
write(path, s)

# 2) Arraste horizontal + vertical da página, mantendo wheel/trackpad naturais.
path = 'src/components/TableScrollWrapper.tsx'
s = read(path)
s = s.replace(
    "  const [startX, setStartX] = useState(0);\n  const [scrollLeft, setScrollLeft] = useState(0);",
    "  const [startX, setStartX] = useState(0);\n  const [startY, setStartY] = useState(0);\n  const [scrollLeft, setScrollLeft] = useState(0);\n  const [scrollTop, setScrollTop] = useState(0);\n  const scrollParentRef = useRef<HTMLElement | null>(null);",
    1,
)
insert = '''
  const findVerticalScrollParent = (node: HTMLElement | null): HTMLElement | null => {
    let current = node?.parentElement || null;
    while (current) {
      const overflowY = window.getComputedStyle(current).overflowY;
      if ((overflowY === 'auto' || overflowY === 'scroll') && current.scrollHeight > current.clientHeight) return current;
      current = current.parentElement;
    }
    return document.scrollingElement as HTMLElement | null;
  };
'''
comment = '''  // A tabela cresce naturalmente na vertical. O arraste continua exclusivamente
  // horizontal, evitando que “100/Todos” pareça não funcionar dentro de uma janela fixa.
'''
if comment not in s:
    raise SystemExit('Comentário scroll não encontrado')
s = s.replace(comment, insert + '\n  // A tabela cresce naturalmente; o arraste acompanha horizontalmente a tabela e verticalmente a página.\n', 1)
s = s.replace(
    '''    setIsMouseDown(true);
    setStartX(e.pageX - containerRef.current.offsetLeft);
    setScrollLeft(containerRef.current.scrollLeft);''',
    '''    setIsMouseDown(true);
    setStartX(e.clientX);
    setStartY(e.clientY);
    setScrollLeft(containerRef.current.scrollLeft);
    scrollParentRef.current = findVerticalScrollParent(containerRef.current);
    setScrollTop(scrollParentRef.current?.scrollTop || 0);''',
    1,
)
s = s.replace(
    '''    const x = e.pageX - containerRef.current.offsetLeft;
    const walkX = (x - startX) * 1.5;
    if (Math.abs(walkX) > 5) {
      e.preventDefault();
      setIsDragging(true);
    }
    containerRef.current.scrollLeft = scrollLeft - walkX;''',
    '''    const walkX = (e.clientX - startX) * 1.5;
    const walkY = (e.clientY - startY) * 1.15;
    if (Math.max(Math.abs(walkX), Math.abs(walkY)) > 5) {
      e.preventDefault();
      setIsDragging(true);
      containerRef.current.scrollLeft = scrollLeft - walkX;
      if (scrollParentRef.current) scrollParentRef.current.scrollTop = scrollTop - walkY;
    }''',
    1,
)
write(path, s)

# 3) Meus TCCs: nomenclatura e estado visual explícito dos filtros.
path = 'src/pages/MeusProcessosPage.tsx'
s = read(path)
s = s.replace("{ key: 'protocolo', label: 'Nº Processo', isFixed: true }", "{ key: 'protocolo', label: 'Processo', isFixed: true }", 1)
s = s.replace("{ key: 'defesaDataHora', label: 'Data e Horário' }", "{ key: 'defesaDataHora', label: 'Data' }", 1)
old = '''                      onClick={() => toggleRoleCategory(catKey)}
                      style={chip.buttonStyle}
                      className={`portal-standard-filter-chip flex items-center'''
new = '''                      onClick={() => toggleRoleCategory(catKey)}
                      data-selected={isSelected ? 'true' : 'false'}
                      aria-pressed={isSelected}
                      style={chip.buttonStyle}
                      className={`portal-standard-filter-chip portal-table-filter-chip flex items-center'''
if old not in s:
    raise SystemExit('Filtro Meus TCCs não encontrado')
s = s.replace(old, new, 1)
write(path, s)

# 4) Área do Presidente: rótulos, filtro ativo, seleção filtrável e upload Gov.br.
path = 'src/pages/CoordenadorPage.tsx'
s = read(path)
s = s.replace("{ key: 'protocolo', label: 'Nº Processo', isFixed: true }", "{ key: 'protocolo', label: 'Processo', isFixed: true }", 1)
s = s.replace("{ key: 'defesaDataHora', label: 'Data e Horário' }", "{ key: 'defesaDataHora', label: 'Data' }", 1)
s = s.replace("protocolo: '📓 Nº Processo'", "protocolo: 'Processo'", 1)
s = s.replace("defesaDataHora: '⏰ Data e Horário'", "defesaDataHora: 'Data'", 1)
old = '''                        onClick={() => { setActiveTab(filter.tab); setSelectedIds([]); }}
                        style={chip.buttonStyle}
                        className={`portal-standard-filter-chip flex items-center'''
new = '''                        onClick={() => { setActiveTab(filter.tab); setSelectedIds([]); }}
                        data-selected={isSelected ? 'true' : 'false'}
                        aria-pressed={isSelected}
                        style={chip.buttonStyle}
                        className={`portal-standard-filter-chip portal-table-filter-chip flex items-center'''
if old not in s:
    raise SystemExit('Filtro Presidente não encontrado')
s = s.replace(old, new, 1)
selection_th = '''<th className={`${styles.headerThClass} ${styles.cellPadClass} w-10 text-center align-middle ${styles.headerBorderClass}`}>'''
if s.count(selection_th) < 2:
    raise SystemExit('Cabeçalhos de seleção não encontrados')
s = s.replace(selection_th, '''<th data-portal-selection-column="true" data-portal-column-label="Seleção" className={`${styles.headerThClass} ${styles.cellPadClass} w-10 text-center align-middle ${styles.headerBorderClass}`}>''')
selection_td = '''<td className={`${styles.cellPadClass} ${styles.borderClass} text-center align-middle`}>'''
if s.count(selection_td) < 2:
    raise SystemExit('Células de seleção não encontradas')
s = s.replace(selection_td, '''<td data-portal-selection-column-cell="true" data-portal-filter-value={isSelected ? 'Selecionado' : 'Não selecionado'} className={`${styles.cellPadClass} ${styles.borderClass} text-center align-middle`}>''')
s = s.replace(
    ".filter((job) => job.processId === processId && job.documentType === 'DECLARACAO')",
    ".filter((job) => job.processId === processId && job.documentType === 'DECLARACAO' && job.provider === 'ASTEN')",
    1,
)
marker = '''  const renderSignatureActionCell = (proc: ProcessData) => {'''
if marker not in s:
    raise SystemExit('renderSignatureActionCell não encontrado')
helper = '''  const getGovDeclarationJob = (processId: string): SignatureJob | undefined =>
    signatureJobs.filter((job) => job.processId === processId && job.documentType === 'DECLARACAO' && job.provider === 'GOV_BR').sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];

  const handleGovSignedUpload = async (processId: string, file: File) => {
    const job = getGovDeclarationJob(processId);
    if (!job) { setSigningMessage('Prepare primeiro o PDF para assinatura Gov.br.'); return; }
    if (signingIds.includes(processId)) return;
    setSigningIds((prev) => [...prev, processId]); setSigningMessage('');
    try { await apiClient.uploadGovBrSignedPdf(job.id, processId, file); setSigningMessage('Arquivo assinado no Gov.br recebido e associado ao TCC.'); await loadData(); }
    catch (error) { setSigningMessage(error instanceof Error ? error.message : 'Não foi possível enviar o arquivo assinado.'); }
    finally { setSigningIds((prev) => prev.filter((id) => id !== processId)); }
  };

'''
s = s.replace(marker, helper + marker, 1)
pattern = re.compile(r"  const renderSignatureActionCell = \(proc: ProcessData\) => \{.*?\n  \};", re.S)
match = pattern.search(s)
if not match:
    raise SystemExit('Bloco renderSignatureActionCell não encontrado')
replacement = '''  const renderSignatureActionCell = (proc: ProcessData) => {
    const job=getDeclarationJob(proc.id);const govJob=getGovDeclarationJob(proc.id);const working=signingIds.includes(proc.id);const status=getDeclarationStatus(proc.id);const actionable=isDeclarationActionable(proc.id);
    const govUploadAvailable=Boolean(govJob && !['SIGNED','ARCHIVED','CANCELED'].includes(govJob.status));
    return <td className={`${styles.cellPadClass} ${styles.borderClass} min-w-[210px] text-center align-middle`}><div className="flex flex-wrap items-center justify-center gap-1.5"><button type="button" onClick={()=>handleSignOne(proc.id)} disabled={working||!actionable} className="portal-sign-provider-btn" title="Assinar esta declaração pela Asten"><Shield className="h-3.5 w-3.5"/><span>Asten</span></button><button type="button" onClick={()=>void handleGovOne(proc.id)} disabled={working||!actionable} className="portal-sign-provider-btn" title="Preparar PDF e abrir o Assinador Gov.br"><FileCheck className="h-3.5 w-3.5"/><span>Gov</span></button>{govUploadAvailable&&<label className="portal-sign-provider-btn cursor-pointer" title="Enviar o PDF já assinado no Gov.br"><input type="file" accept="application/pdf,.pdf" className="hidden" onChange={(event)=>{const file=event.currentTarget.files?.[0];event.currentTarget.value='';if(file)void handleGovSignedUpload(proc.id,file);}}/><Download className="h-3.5 w-3.5 rotate-180"/><span>Enviar assinado</span></label>}</div>{!actionable&&<span className={`mt-1 inline-flex rounded-full border px-2 py-0.5 text-[8px] font-black uppercase ${status.tone}`} title={job?.lastError||status.label}>{status.label}</span>}</td>;
  };'''
s = s[:match.start()] + replacement + s[match.end():]
write(path, s)

# 5) Logs: classe explícita para a tabela; evita regressões mesmo sem enhancer.
replace_once(
    'src/pages/AuditLogsPage.tsx',
    '<table className="w-full min-w-[860px] border-collapse text-left text-xs">',
    '<table className="portal-spreadsheet-table portal-audit-table w-full min-w-[860px] border-collapse text-left text-xs">',
)

# 6) Rota e título da nova página Registros da Asten.
path = 'src/App.tsx'
s = read(path)
import_anchor = "const AuditLogsPage = lazy(() => import('./pages/AuditLogsPage').then((module) => ({ default: module.AuditLogsPage })));"
if import_anchor not in s:
    raise SystemExit('Import AuditLogsPage não encontrado')
s = s.replace(import_anchor, import_anchor + "\nconst AstenLogsPage = lazy(() => import('./pages/AstenLogsPage').then((module) => ({ default: module.AstenLogsPage })));", 1)
route = """      case 'logs':
        return <AuditLogsPage />;"""
if route not in s:
    raise SystemExit('Rota logs não encontrada')
s = s.replace(route, route + "\n      case 'asten-logs':\n        return <AstenLogsPage />;", 1)
title = """                  : currentTab === 'logs' ? 'Registro de Logs'"""
if title not in s:
    raise SystemExit('Título logs não encontrado')
s = s.replace(title, title + "\n                  : currentTab === 'asten-logs' ? 'Registros da Asten'", 1)
write(path, s)

# 7) Botão Master na barra lateral, imediatamente depois de Registro de Logs.
path = 'src/components/PortalUiEnhancer.tsx'
s = read(path)
anchor = '''function createWorkspaceSidebar(section: HTMLElement, kind: 'sync' | 'models') {'''
if anchor not in s:
    raise SystemExit('Âncora workspace não encontrada')
fn = '''function ensureAstenLogsSidebarButton() {
  const logsButton = document.getElementById('nav-item-logs') as HTMLButtonElement | null;
  const configButton = document.getElementById('nav-item-configuracoes') as HTMLButtonElement | null;
  const existing = document.getElementById('nav-item-asten-logs') as HTMLButtonElement | null;
  const isMaster = readGlobalRoles().includes('MASTER_ADMIN');
  if (!isMaster || !configButton) { existing?.remove(); return; }
  const active = Boolean(document.getElementById('asten-logs-page'));
  if (existing) {
    existing.classList.toggle('portal-sidebar-asten-active', active);
    existing.classList.toggle('portal-sidebar-nav-active', active);
    existing.setAttribute('aria-current', active ? 'page' : 'false');
    return;
  }
  const button = document.createElement('button');
  button.type = 'button'; button.id = 'nav-item-asten-logs';
  button.className = `${configButton.className} portal-sidebar-asten-item${active ? ' portal-sidebar-asten-active portal-sidebar-nav-active' : ''}`;
  button.innerHTML = '<div class="flex items-center gap-3"><span class="text-base shrink-0 leading-none" aria-hidden="true">🛡️</span><span>Registros da Asten</span></div>';
  button.title = 'Fila e histórico da Asten'; button.setAttribute('aria-label', 'Fila e histórico da Asten');
  button.addEventListener('click', () => window.dispatchEvent(new CustomEvent('portal:navigate', { detail: 'asten-logs' })));
  (logsButton || configButton).insertAdjacentElement('afterend', button);
}

'''
s = s.replace(anchor, fn + anchor, 1)
s = s.replace(
    '''  ensureLogsSidebarButton();
  enhanceSettingsWorkspaces();''',
    '''  ensureLogsSidebarButton();
  ensureAstenLogsSidebarButton();
  enhanceSettingsWorkspaces();''',
    1,
)
s = s.replace(
    "document.querySelectorAll('.portal-repository-download-toolbar, .portal-settings-workspace-backdrop, #nav-item-logs')",
    "document.querySelectorAll('.portal-repository-download-toolbar, .portal-settings-workspace-backdrop, #nav-item-logs, #nav-item-asten-logs')",
    1,
)
write(path, s)

# 8) CSS 1.0.39: separador robusto, filtros ativos, densidade e microcoluna.
path = 'src/portal-update-43.css'
s = read(path)
css = r'''

/* Versão 1.0.39 — separadores, filtros e densidade operacional. */
.portal-spreadsheet-table thead th{display:table-cell!important;}
.portal-spreadsheet-table tbody tr:first-child>td{
  border-top:4px solid #fff!important;
  box-shadow:inset 0 4px 0 #fff!important;
}
.portal-standard-filter-chip[data-selected="true"],
.portal-table-filter-chip[data-selected="true"]{
  filter:saturate(.72) brightness(.78)!important;
  box-shadow:inset 0 0 0 1px rgba(15,23,42,.24)!important;
}
#coordenador-page-root .portal-spreadsheet-table th,
#coordenador-page-root .portal-spreadsheet-table td{padding-top:.36rem!important;padding-bottom:.36rem!important;}
#coordenador-page-root th[data-portal-selection-column="true"],
#coordenador-page-root td[data-portal-selection-column-cell="true"]{
  width:38px!important;min-width:38px!important;max-width:38px!important;padding-left:4px!important;padding-right:4px!important;
}
#coordenador-page-root th[data-portal-selection-column="true"]{background:var(--portal-sheet-green)!important;color:#fff!important;}
#sidebar-nav .portal-sidebar-asten-active::before{
  content:""!important;position:absolute!important;left:0!important;top:0!important;bottom:0!important;width:4px!important;border-radius:12px 0 0 12px!important;background:#74ff96!important;
}
#sidebar-nav .portal-sidebar-asten-item{position:relative!important;}
'''
if 'Versão 1.0.39 — separadores' not in s:
    s += css
write(path, s)

# 9) Versão do release.
path = 'package.json'
s = read(path)
s = s.replace('"version": "1.0.38"', '"version": "1.0.39"', 1)
write(path, s)
path = 'package-lock.json'
s = read(path)
count = s.count('"version": "1.0.38"')
if count < 2:
    raise SystemExit(f'package-lock esperava 2 versões 1.0.38, achou {count}')
s = s.replace('"version": "1.0.38"', '"version": "1.0.39"', 2)
write(path, s)
path = 'server/update44FinalPolishContract.test.ts'
s = read(path)
s = s.replace("assert.equal(pkg.version,'1.0.38')", "assert.equal(pkg.version,'1.0.39')", 1)
write(path, s)

# 10) Contrato da 1.0.39.
contract = r'''import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read=(p:string)=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('1.0.39 mantém cabeçalhos estáveis e separador branco robusto',()=>{
  const enhancer=read('src/components/PortalSpreadsheetEnhancer.tsx');
  const css=read('src/portal-update-43.css');
  assert.match(enhancer,/canonicalizeHeader/);
  assert.match(enhancer,/wrapper\.className='portal-column-header-content'/);
  assert.doesNotMatch(enhancer,/labelHost=header\.querySelector<HTMLElement>\(':scope > div'\)\|\|header/);
  assert.match(css,/box-shadow:inset 0 4px 0 #fff/);
});

test('1.0.39 permite filtro na seleção sem ordenar e navegação vertical por arraste',()=>{
  const enhancer=read('src/components/PortalSpreadsheetEnhancer.tsx');
  const coordinator=read('src/pages/CoordenadorPage.tsx');
  const scroll=read('src/components/TableScrollWrapper.tsx');
  assert.match(enhancer,/isSelectionColumn/);
  assert.match(enhancer,/dataset\.portalFilterValue/);
  assert.match(coordinator,/data-portal-selection-column="true"/);
  assert.match(scroll,/findVerticalScrollParent/);
  assert.match(scroll,/scrollParentRef\.current\.scrollTop/);
});

test('1.0.39 expõe envio Gov.br e registros Master da Asten',()=>{
  const coordinator=read('src/pages/CoordenadorPage.tsx');
  const app=read('src/App.tsx');
  const asten=read('src/pages/AstenLogsPage.tsx');
  const ui=read('src/components/PortalUiEnhancer.tsx');
  assert.match(coordinator,/uploadGovBrSignedPdf/);
  assert.match(coordinator,/Enviar assinado/);
  assert.match(app,/case 'asten-logs'/);
  assert.match(asten,/Registros da Asten/);
  assert.match(ui,/nav-item-asten-logs/);
});

test('release está marcado como 1.0.39',()=>{
  const pkg=JSON.parse(read('package.json'));
  assert.equal(pkg.version,'1.0.39');
});
'''
Path('server/update45Version1039Contract.test.ts').write_text(contract)

# Remove artefatos temporários no mesmo commit final.
for temp in ['.github/workflows/apply-v1039.yml', 'scripts/apply-v1039.py']:
    p = Path(temp)
    if p.exists():
        p.unlink()
