import fs from 'node:fs';

const read=(p)=>fs.readFileSync(p,'utf8');
const write=(p,v)=>fs.writeFileSync(p,v);
const replaceOrFail=(source,from,to,label)=>{
  if(!source.includes(from)) throw new Error(`Trecho não encontrado: ${label}`);
  return source.replace(from,to);
};

// 1) Corrige a quebra real da Área do Presidente: a ordenação misturava
// itens embrulhados da fila com ProcessData concluídos usando activeTab global.
{
  const p='src/pages/CoordenadorPage.tsx';
  let s=read(p);
  s=replaceOrFail(s,
`  const pendingItems = queue.filter(item => {
    const term = searchFilter.toLowerCase();
    const p = item.process;
`,
`  const pendingItems = queue.filter(item => {
    const term = searchFilter.toLowerCase();
    const p = item?.process;
    if (!p) return false;
`, 'presidente: guarda fila');
  s=replaceOrFail(s,
`  const getSortedAndFilteredItems = (items: any[]) => {
    return [...items].sort((itemA, itemB) => {
      const pA = activeTab === 'pendentes' ? itemA.process : itemA;
      const pB = activeTab === 'pendentes' ? itemB.process : itemB;

      let valA: any = '';
`,
`  const getSortedAndFilteredItems = (items: any[], wrappedQueueItem: boolean) => {
    return [...items].sort((itemA, itemB) => {
      const pA = wrappedQueueItem ? itemA?.process : itemA;
      const pB = wrappedQueueItem ? itemB?.process : itemB;
      if (!pA || !pB) return 0;

      let valA: any = '';
`, 'presidente: ordenação independente da aba');
  s=s.replaceAll("valA = activeTab === 'pendentes' ? 'Aguardando Envio' : 'Enviado';", "valA = wrappedQueueItem ? 'Aguardando Envio' : 'Enviado';")
     .replaceAll("valB = activeTab === 'pendentes' ? 'Aguardando Envio' : 'Enviado';", "valB = wrappedQueueItem ? 'Aguardando Envio' : 'Enviado';");
  s=replaceOrFail(s,
`  const sortedPending = getSortedAndFilteredItems(pendingItems);
  const sortedCompleted = getSortedAndFilteredItems(completedItems);
`,
`  const sortedPending = getSortedAndFilteredItems(pendingItems, true);
  const sortedCompleted = getSortedAndFilteredItems(completedItems, false);
`, 'presidente: chamadas de ordenação');
  write(p,s);
}

// 2) Cabeçalhos: preserva a ordenação nativa existente e injeta só o filtro.
// Tabelas sem ordenação nativa (ex.: logs) recebem uma seta simples, sem caixa.
{
  const p='src/components/PortalSpreadsheetEnhancer.tsx';
  let s=read(p);
  const start=s.indexOf('function enhanceTable(table:HTMLTableElement){');
  const end=s.indexOf('\nfunction directChildWithin', start);
  if(start<0||end<0) throw new Error('Trecho não encontrado: enhanceTable');
  const replacement=`function enhanceTable(table:HTMLTableElement){
  if(table.closest('[role="dialog"]')||table.closest('[data-portal-workspace-open="true"]'))return;
  const headerRow=table.tHead?.rows[0];const body=table.tBodies[0];if(!headerRow||!body||headerRow.cells.length<2)return;
  table.classList.add('portal-spreadsheet-table');
  if(!tableState.has(table))tableState.set(table,{filters:new Map()});
  cleanTableDecorations(table);enhanceMeusProcessos(table);
  Array.from(headerRow.cells).forEach((th,index)=>{
    const header=th as HTMLTableCellElement;const key=keyForHeader(header,index);
    if(header.querySelector('.portal-column-controls'))return;
    const controls=document.createElement('span');controls.className='portal-column-controls';
    const labelHost=header.querySelector<HTMLElement>(':scope > div')||header;
    labelHost.classList.add('portal-column-header-content');
    const hasNativeSort=header.classList.contains('cursor-pointer')||header.dataset.portalNativeSort==='true'||Boolean(header.querySelector('[data-portal-sort],button[aria-label*="Ordenar"]'));
    if(!hasNativeSort){
      const sort=document.createElement('button');sort.type='button';sort.className='portal-column-sort';sort.title='Ordenar esta coluna';sort.setAttribute('aria-label',\`Ordenar \${header.dataset.portalColumnLabel||'coluna'}\`);sort.innerHTML=SORT_ICON;sort.addEventListener('click',event=>{event.stopPropagation();sortTable(table,key,index);});controls.appendChild(sort);
    }
    const filter=document.createElement('button');filter.type='button';filter.className='portal-column-filter';filter.title='Filtrar valores desta coluna';filter.setAttribute('aria-label',\`Filtrar \${header.dataset.portalColumnLabel||'coluna'}\`);filter.innerHTML=FILTER_ICON;filter.addEventListener('click',event=>{event.stopPropagation();openFilterPopup(table,header,index,filter);});
    controls.appendChild(filter);labelHost.appendChild(controls);
  });
  applyFilters(table);
}
`;
  s=s.slice(0,start)+replacement+s.slice(end);
  // Renomeia visualmente a coluna já persistida como "progresso" sem quebrar preferências antigas.
  s=replaceOrFail(s,
`  const headers=Array.from(table.tHead?.rows[0]?.cells||[]);
  const dateIndex=headers.findIndex(th=>normalize(th.textContent||'').toLowerCase().includes('data e horário'));
`,
`  const headers=Array.from(table.tHead?.rows[0]?.cells||[]);
  const progressHeader=headers.find(th=>normalize(th.textContent||'').toLowerCase()==='progresso') as HTMLTableCellElement|undefined;
  if(progressHeader){
    const label=Array.from(progressHeader.querySelectorAll<HTMLElement>('span')).find(node=>normalize(node.textContent||'').toLowerCase()==='progresso');
    if(label)label.textContent='Etapa';
    progressHeader.dataset.portalColumnLabel='Etapa';
  }
  const dateIndex=headers.findIndex(th=>normalize(th.textContent||'').toLowerCase().includes('data e horário'));
`, 'meus TCCs: cabeçalho Etapa');
  write(p,s);
}

// 3) Meus TCCs: mantém a chave histórica "progresso" para não quebrar preferências,
// mas muda o conceito exibido e exportado para Etapa.
{
  const p='src/pages/MeusProcessosPage.tsx';
  let s=read(p);
  s=replaceOrFail(s,"  { key: 'progresso', label: 'Progresso' },","  { key: 'progresso', label: 'Etapa' },",'Meus TCCs: label etapa');
  s=replaceOrFail(s,
`            case 'progresso': return \`"\${progress.percent}% - \${getStepNumberLabel(progress.label)}"\`;`,
`            case 'progresso': return \`"\${getStepNumberLabel(progress.label).replace('Fase ', '')}"\`;`, 'Meus TCCs: CSV etapa');
  write(p,s);
}

// 4) O componente de progresso passa a mostrar só o número da etapa.
{
  const p='src/components/ProgressIndicator.tsx';
  let s=read(p);
  s=replaceOrFail(s,
`export const ProgressIndicator: React.FC<ProgressIndicatorProps> = ({ percent, label }) => {
  const value = Math.max(0, Math.min(100, Math.round(percent || 0)));
  return (
    <span
      className="portal-progress-number inline-flex min-w-[42px] items-center justify-center text-[11px] font-semibold tabular-nums text-slate-600"
      title={label}
      aria-label={label ? \`\${value}% — \${label}\` : \`\${value}%\`}
    >
      {value}%
    </span>
  );
};`,
`export const ProgressIndicator: React.FC<ProgressIndicatorProps> = ({ percent, label }) => {
  const value = Math.max(0, Math.min(100, Math.round(percent || 0)));
  const match = String(label || '').match(/Etapa\\s+([\\d.,]+)/i);
  const stage = match ? match[1].replace(',', '.') : '';
  return (
    <span
      className="portal-progress-number portal-stage-number inline-flex min-w-[28px] items-center justify-center text-[11px] font-semibold tabular-nums text-slate-600"
      title={label}
      aria-label={label || \`Etapa associada ao progresso de \${value}%\`}
    >
      {stage || '—'}
    </span>
  );
};`, 'ProgressIndicator: etapa numérica');
  write(p,s);
}

// 5) Registro de Logs herda o mesmo marcador ativo real da sidebar.
{
  const p='src/components/PortalUiEnhancer.tsx';
  let s=read(p);
  s=replaceOrFail(s,
`    existing.classList.toggle('portal-sidebar-logs-active', active);
    existing.setAttribute('aria-current', active ? 'page' : 'false');`,
`    existing.classList.toggle('portal-sidebar-logs-active', active);
    existing.classList.toggle('portal-sidebar-nav-active', active);
    existing.setAttribute('aria-current', active ? 'page' : 'false');`, 'Logs: classe ativa existente');
  s=replaceOrFail(s,
`  button.className = \`${configButton.className} portal-sidebar-logs-item\${active ? ' portal-sidebar-logs-active' : ''}\`;`,
`  button.className = \`${configButton.className} portal-sidebar-logs-item\${active ? ' portal-sidebar-logs-active portal-sidebar-nav-active' : ''}\`;`, 'Logs: classe ativa criação');
  write(p,s);
}

// 6) Acabamento visual global das planilhas e do popup de exibição.
{
  const p='src/portal-update-43.css';
  let s=read(p);
  s += `

/* Atualização 44 — acabamento final de planilhas e logs. */
.portal-spreadsheet-table thead{
  border-top:3px solid #fff!important;
  border-bottom:3px solid #fff!important;
}
.portal-spreadsheet-table thead th{
  padding-right:inherit!important;
}
.portal-column-header-content{
  display:inline-flex!important;
  align-items:center!important;
  justify-content:center!important;
  gap:3px!important;
  max-width:100%!important;
}
.portal-column-controls{
  position:static!important;
  display:inline-flex!important;
  align-items:center!important;
  gap:2px!important;
  transform:none!important;
  margin-left:2px!important;
  flex:0 0 auto!important;
}
.portal-column-controls button{
  display:inline-flex!important;
  width:auto!important;
  height:auto!important;
  min-width:0!important;
  min-height:0!important;
  padding:1px!important;
  border:0!important;
  border-radius:3px!important;
  background:transparent!important;
  color:#fff!important;
  box-shadow:none!important;
}
.portal-column-controls button:hover,
.portal-column-filter-active .portal-column-filter{
  background:rgba(255,255,255,.16)!important;
  border:0!important;
}
.portal-column-controls svg{width:11px!important;height:11px!important;}

/* Mais respiro entre os filtros e o cabeçalho das colunas. */
#meus-processos-page-container .portal-meus-processos-filter-row,
#coordenador-page-root .portal-coordinator-filter-row,
.portal-defense-filter-row{
  padding-bottom:.82rem!important;
}

/* Popup: título à esquerda e Colunas e ordem como terceiro bloco visual equivalente. */
.portal-table-settings-popover>div:first-child{text-align:left!important;justify-content:space-between!important;}
.portal-table-settings-popover>div:first-child>span{margin-right:auto!important;text-align:left!important;justify-content:flex-start!important;}
.portal-table-settings-popover section[aria-label^="Colunas e ordem"]{
  background:#e3e8eb!important;
  border:1px solid #c6d0d6!important;
  padding:14px!important;
  box-shadow:inset 0 0 0 1px rgba(255,255,255,.35)!important;
}
.portal-table-settings-popover section[aria-label^="Colunas e ordem"]>div:last-child>div{
  background:#fff!important;
}

/* Logs: uma única divisória branca grossa e cabeçalho no mesmo verde da barra superior. */
#audit-logs-page>header{border-bottom:3px solid #fff!important;}
#audit-logs-page .portal-audit-table-shell{margin:0!important;padding:0!important;}
#audit-logs-page .portal-audit-table-shell>div{margin:0!important;}
#audit-logs-page .portal-spreadsheet-table thead{border-top:0!important;background:#005830!important;}
#audit-logs-page .portal-spreadsheet-table thead tr,
#audit-logs-page .portal-spreadsheet-table thead th{background:#005830!important;color:#fff!important;}

/* Linha branca contínua entre o cabeçalho e a primeira linha de dados. */
.portal-spreadsheet-table tbody tr:first-child>td{border-top:3px solid #fff!important;}

/* O item Logs usa exatamente a mesma faixa fina dos demais itens ativos. */
#sidebar-nav .portal-sidebar-logs-active::before{
  content:""!important;
  position:absolute!important;
  left:0!important;
  top:0!important;
  bottom:0!important;
  width:4px!important;
  border-radius:12px 0 0 12px!important;
  background:#74ff96!important;
}
#sidebar-nav .portal-sidebar-logs-item{position:relative!important;}
`;
  write(p,s);
}

// 7) Versão do sistema coerente com o release publicado.
{
  const pkg=JSON.parse(read('package.json'));pkg.version='1.0.38';write('package.json',JSON.stringify(pkg,null,2)+'\n');
  const lock=JSON.parse(read('package-lock.json'));lock.version='1.0.38';if(lock.packages?.[''])lock.packages[''].version='1.0.38';write('package-lock.json',JSON.stringify(lock,null,2)+'\n');
  const p='server/update33CompletionContract.test.ts';let s=read(p);s=s.replace("assert.equal(pkg.version,'1.0.37')","assert.equal(pkg.version,'1.0.38')");write(p,s);
}

// 8) Contrato específico da rodada.
write('server/update44FinalPolishContract.test.ts',`import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read=(p:string)=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('Área do Presidente ordena fila e concluídos sem depender da aba ativa',()=>{
  const s=read('src/pages/CoordenadorPage.tsx');
  assert.match(s,/getSortedAndFilteredItems = \\(items: any\\[\\], wrappedQueueItem: boolean\\)/);
  assert.match(s,/getSortedAndFilteredItems\\(pendingItems, true\\)/);
  assert.match(s,/getSortedAndFilteredItems\\(completedItems, false\\)/);
  assert.match(s,/if \\(!pA \\|\\| !pB\\) return 0/);
});

test('cabeçalhos preservam ordenação nativa e acrescentam filtro próximo ao texto',()=>{
  const s=read('src/components/PortalSpreadsheetEnhancer.tsx');
  assert.match(s,/hasNativeSort/);
  assert.match(s,/portal-column-header-content/);
  assert.match(s,/Filtrar valores desta coluna/);
});

test('Meus TCCs usa Etapa em vez de progresso percentual',()=>{
  const p=read('src/pages/MeusProcessosPage.tsx');
  const indicator=read('src/components/ProgressIndicator.tsx');
  assert.match(p,/key: 'progresso', label: 'Etapa'/);
  assert.match(indicator,/portal-stage-number/);
  assert.doesNotMatch(indicator,/>\\s*\\{value\\}%\\s*</);
});

test('popup e logs seguem acabamento aprovado e versão foi incrementada',()=>{
  const css=read('src/portal-update-43.css');
  const ui=read('src/components/PortalUiEnhancer.tsx');
  const pkg=JSON.parse(read('package.json'));
  assert.match(css,/section\\[aria-label\\^="Colunas e ordem"\\]/);
  assert.match(css,/border-bottom:3px solid #fff/);
  assert.match(ui,/portal-sidebar-nav-active/);
  assert.equal(pkg.version,'1.0.38');
});
`);

// Autolimpeza: o commit final não carrega ferramentas temporárias de atualização.
fs.rmSync('scripts/apply-update44.mjs',{force:true});
fs.rmSync('.github/workflows/apply-update44.yml',{force:true});
console.log('Atualização 44 aplicada.');
