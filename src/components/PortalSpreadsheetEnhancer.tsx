import { useEffect } from 'react';
import { stripEmojis } from '../utils/tableFormatters';

type TableState = {
  filters: Map<string, Set<string>>;
  sortKey?: string;
  sortDirection?: 'asc' | 'desc';
};

type CachedIdentity = {
  userEmail?: string;
  memberships?: Array<{processId?:string;email?:string;roles?:string[]}>;
};

const tableState = new WeakMap<HTMLTableElement, TableState>();
let calendarProcesses: any[] | null = null;
let calendarFetch: Promise<any[]> | null = null;
let activeFilterPopup: HTMLElement | null = null;

const FILTER_ICON = '<svg viewBox="0 0 24 24" width="12" height="12" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5h16l-6 7v5l-4 2v-7z"></path></svg>';
const SORT_ICON = '<svg viewBox="0 0 24 24" width="12" height="12" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m8 9 4-4 4 4"></path><path d="m16 15-4 4-4-4"></path></svg>';

function readIdentity():CachedIdentity {
  try { return JSON.parse(sessionStorage.getItem('portal_tcc_identity_cache_v1') || '{}'); }
  catch { return {}; }
}

function normalize(value:string){return stripEmojis(value || '').replace(/\s+/g,' ').trim();}
function keyForHeader(th:HTMLTableCellElement,index:number){
  if(!th.dataset.portalColumnKey){
    const label=normalize(th.textContent || '') || `coluna-${index+1}`;
    th.dataset.portalColumnKey=`${index}:${label.toLowerCase()}`;
    th.dataset.portalColumnLabel=label;
  }
  return th.dataset.portalColumnKey;
}
function cellValue(row:HTMLTableRowElement,index:number){return normalize(row.cells[index]?.textContent || '—') || '—';}

function parseComparable(raw:string):string|number {
  const value=raw.trim();
  const date=value.match(/\b(\d{2})\/(\d{2})\/(\d{4})\b/);
  if(date)return Number(`${date[3]}${date[2]}${date[1]}`);
  const percent=value.match(/^(-?\d+(?:[.,]\d+)?)\s*%$/);
  if(percent)return Number(percent[1].replace(',','.'));
  const pure=value.replace(/\./g,'').replace(',','.');
  if(/^[-+]?\d+(?:\.\d+)?$/.test(pure))return Number(pure);
  return value.toLocaleLowerCase('pt-BR');
}

function applyFilters(table:HTMLTableElement){
  const state=tableState.get(table);if(!state)return;
  const headers=Array.from(table.tHead?.rows[0]?.cells || []);
  const rows=Array.from(table.tBodies[0]?.rows || []);
  rows.forEach(row=>{
    const visible=Array.from(state.filters.entries()).every(([key,allowed])=>{
      const index=headers.findIndex((th,i)=>keyForHeader(th as HTMLTableCellElement,i)===key);
      return index<0 || allowed.has(cellValue(row,index));
    });
    row.classList.toggle('portal-column-filter-hidden',!visible);
  });
  headers.forEach((th,i)=>{
    const key=keyForHeader(th as HTMLTableCellElement,i);
    th.classList.toggle('portal-column-filter-active',state.filters.has(key));
  });
}

function sortTable(table:HTMLTableElement,key:string,index:number){
  const state=tableState.get(table)||{filters:new Map<string,Set<string>>()};
  const direction=state.sortKey===key&&state.sortDirection==='asc'?'desc':'asc';
  state.sortKey=key;state.sortDirection=direction;tableState.set(table,state);
  const body=table.tBodies[0];if(!body)return;
  const collator=new Intl.Collator('pt-BR',{numeric:true,sensitivity:'base'});
  const rows=Array.from(body.rows);
  rows.sort((a,b)=>{
    const av=parseComparable(cellValue(a,index));const bv=parseComparable(cellValue(b,index));
    const result=typeof av==='number'&&typeof bv==='number'?av-bv:collator.compare(String(av),String(bv));
    return direction==='asc'?result:-result;
  });
  rows.forEach(row=>body.appendChild(row));
  Array.from(table.tHead?.rows[0]?.cells||[]).forEach(th=>th.removeAttribute('aria-sort'));
  table.tHead?.rows[0]?.cells[index]?.setAttribute('aria-sort',direction==='asc'?'ascending':'descending');
  applyFilters(table);
}

function closeFilterPopup(){activeFilterPopup?.remove();activeFilterPopup=null;}

function openFilterPopup(table:HTMLTableElement,th:HTMLTableCellElement,index:number,anchor:HTMLElement){
  closeFilterPopup();
  const state=tableState.get(table)||{filters:new Map<string,Set<string>>()};tableState.set(table,state);
  const key=keyForHeader(th,index);
  const values=Array.from(new Set(Array.from(table.tBodies[0]?.rows||[]).map(row=>cellValue(row,index)))).sort((a,b)=>a.localeCompare(b,'pt-BR',{numeric:true,sensitivity:'base'}));
  const current=state.filters.get(key);
  const popup=document.createElement('div');popup.className='portal-column-filter-popup';
  const title=document.createElement('div');title.className='portal-column-filter-title';title.textContent=th.dataset.portalColumnLabel||'Filtrar coluna';popup.appendChild(title);
  const search=document.createElement('input');search.type='search';search.placeholder='Buscar valor…';search.className='portal-column-filter-search';popup.appendChild(search);
  const list=document.createElement('div');list.className='portal-column-filter-values';popup.appendChild(list);
  const render=(term='')=>{
    list.replaceChildren();
    values.filter(value=>value.toLocaleLowerCase('pt-BR').includes(term.toLocaleLowerCase('pt-BR'))).forEach(value=>{
      const label=document.createElement('label');label.className='portal-column-filter-value';
      const checkbox=document.createElement('input');checkbox.type='checkbox';checkbox.checked=!current||current.has(value);
      checkbox.addEventListener('change',()=>{
        const allowed=state.filters.has(key)?new Set(state.filters.get(key)!):new Set(values);
        if(checkbox.checked)allowed.add(value);else allowed.delete(value);
        if(allowed.size===values.length)state.filters.delete(key);else state.filters.set(key,allowed);
        applyFilters(table);
      });
      const span=document.createElement('span');span.textContent=value;label.append(checkbox,span);list.appendChild(label);
    });
  };
  render();search.addEventListener('input',()=>render(search.value));
  const footer=document.createElement('div');footer.className='portal-column-filter-footer';
  const all=document.createElement('button');all.type='button';all.textContent='Mostrar todos';all.addEventListener('click',()=>{state.filters.delete(key);applyFilters(table);closeFilterPopup();});
  const done=document.createElement('button');done.type='button';done.textContent='Concluir';done.addEventListener('click',closeFilterPopup);footer.append(all,done);popup.appendChild(footer);
  document.body.appendChild(popup);activeFilterPopup=popup;
  const rect=anchor.getBoundingClientRect();const width=280;let left=Math.min(rect.right-width,window.innerWidth-width-12);left=Math.max(12,left);let top=rect.bottom+6;if(top+360>window.innerHeight)top=Math.max(12,rect.top-360);popup.style.left=`${left}px`;popup.style.top=`${top}px`;
  window.setTimeout(()=>search.focus(),0);
}

function cleanTableDecorations(table:HTMLTableElement){
  table.querySelectorAll<HTMLElement>('td,th').forEach(cell=>{
    const walker=document.createTreeWalker(cell,NodeFilter.SHOW_TEXT);
    const nodes:Text[]=[];let current:Node|null;while((current=walker.nextNode()))nodes.push(current as Text);
    nodes.forEach(node=>{if(!node.parentElement?.closest('button')){const clean=stripEmojis(node.data);if(clean!==node.data)node.data=clean;}});
  });
  table.querySelectorAll<SVGElement>('td svg').forEach(svg=>{if(!svg.closest('button,a'))svg.classList.add('portal-table-decorative-icon');});
}

function enhanceMeusProcessos(table:HTMLTableElement){
  if(table.id!=='meus-processos-table')return;
  const identity=readIdentity();
  const email=(identity.userEmail||'').trim().toLowerCase();
  const memberships=identity.memberships||[];
  Array.from(table.tBodies[0]?.rows||[]).forEach(row=>{
    const processId=(row.id||'').replace(/^process-row-/,'');
    const roles=memberships.filter(m=>m.processId===processId&&(!m.email||String(m.email).toLowerCase()===email)).flatMap(m=>m.roles||[]);
    const category=roles.includes('STUDENT')?'student':roles.includes('ADVISOR')||roles.includes('CO_ADVISOR')?'committee':roles.includes('EXAMINER')?'evaluator':'viewer';
    row.dataset.portalRoleCategory=category;
    const pill=row.cells[0]?.querySelector<HTMLElement>(':scope > div');if(pill)pill.dataset.portalRolePill=category;
  });
  const headers=Array.from(table.tHead?.rows[0]?.cells||[]);
  const progressHeader=headers.find(th=>normalize(th.textContent||'').toLowerCase()==='progresso') as HTMLTableCellElement|undefined;
  if(progressHeader){
    const label=Array.from(progressHeader.querySelectorAll<HTMLElement>('span')).find(node=>normalize(node.textContent||'').toLowerCase()==='progresso');
    if(label)label.textContent='Etapa';
    progressHeader.dataset.portalColumnLabel='Etapa';
  }
  const dateIndex=headers.findIndex(th=>normalize(th.textContent||'').toLowerCase().includes('data e horário'));
  if(dateIndex>=0)Array.from(table.tBodies[0]?.rows||[]).forEach(row=>row.cells[dateIndex]?.classList.add('portal-date-cell-sober'));
}

function enhanceTable(table:HTMLTableElement){
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
      const sort=document.createElement('button');sort.type='button';sort.className='portal-column-sort';sort.title='Ordenar esta coluna';sort.setAttribute('aria-label',`Ordenar ${header.dataset.portalColumnLabel||'coluna'}`);sort.innerHTML=SORT_ICON;sort.addEventListener('click',event=>{event.stopPropagation();sortTable(table,key,index);});controls.appendChild(sort);
    }
    const filter=document.createElement('button');filter.type='button';filter.className='portal-column-filter';filter.title='Filtrar valores desta coluna';filter.setAttribute('aria-label',`Filtrar ${header.dataset.portalColumnLabel||'coluna'}`);filter.innerHTML=FILTER_ICON;filter.addEventListener('click',event=>{event.stopPropagation();openFilterPopup(table,header,index,filter);});
    controls.appendChild(filter);labelHost.appendChild(controls);
  });
  applyFilters(table);
}

function directChildWithin(node:HTMLElement,parent:HTMLElement){let current:HTMLElement=node;while(current.parentElement&&current.parentElement!==parent)current=current.parentElement;return current.parentElement===parent?current:null;}
function standardizeToolbarOrder(){
  document.querySelectorAll<HTMLButtonElement>('button[title*="Exibição da planilha"],button[aria-label="Configurar exibição da planilha"]').forEach(gear=>{
    let group:HTMLElement|null=gear.parentElement;
    for(let depth=0;group&&depth<4;depth++,group=group.parentElement){
      const search=group.querySelector<HTMLButtonElement>('button[title^="Buscar"],button[aria-label^="Buscar"]');
      const refresh=group.querySelector<HTMLButtonElement>('button[title="Atualizar dados da tabela"],button[title*="Sincronizar dados"],button[aria-label^="Sincronizar dados"]');
      if(!search||!refresh)continue;
      [search,refresh,gear].forEach(button=>{const child=directChildWithin(button,group!);if(child)group!.appendChild(child);});
      break;
    }
  });
}

const MONTHS:Record<string,number>={janeiro:0,fevereiro:1,'março':2,marco:2,abril:3,maio:4,junho:5,julho:6,agosto:7,setembro:8,outubro:9,novembro:10,dezembro:11};
function dateKey(value:string){try{return new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value));}catch{return '';}}
function timeLabel(value:string){try{return new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',hour:'2-digit',minute:'2-digit'}).format(new Date(value));}catch{return '';}}
async function loadCalendarProcesses(){
  if(calendarProcesses)return calendarProcesses;if(calendarFetch)return calendarFetch;
  calendarFetch=fetch('/api/processes',{credentials:'include',headers:{Accept:'application/json'}}).then(async response=>response.ok?response.json():[]).then(data=>{calendarProcesses=Array.isArray(data)?data:[];return calendarProcesses;}).catch(()=>[]).finally(()=>{calendarFetch=null;});return calendarFetch;
}
async function enhanceCalendar(){
  const grid=document.querySelector<HTMLElement>('.portal-calendar-day-cell')?.parentElement;if(!grid)return;
  grid.classList.add('portal-calendar-grid');
  const header=grid.parentElement?.previousElementSibling as HTMLElement|null;if(header)header.classList.add('portal-calendar-week-header');
  const pageText=document.body.innerText;const match=pageText.match(/CALENDÁRIO DE DEFESAS\s*[—-]\s*([A-ZÁÀÂÃÉÊÍÓÔÕÚÇ]+)\s+DE\s+(\d{4})/i);if(!match)return;
  const month=MONTHS[match[1].toLocaleLowerCase('pt-BR')];const year=Number(match[2]);if(month===undefined||!year)return;
  const processes=await loadCalendarProcesses();
  const byDay=new Map<number,any[]>();
  processes.forEach(proc=>{const start=proc?.defesa?.startAt;if(!start)return;const key=dateKey(start);const expected=`${year}-${String(month+1).padStart(2,'0')}-`;if(!key.startsWith(expected))return;const day=Number(key.slice(-2));const list=byDay.get(day)||[];list.push(proc);byDay.set(day,list);});
  grid.querySelectorAll<HTMLElement>('.portal-calendar-day-cell').forEach(cell=>{
    const day=Number(cell.querySelector('span')?.textContent?.trim());if(!day)return;const events=byDay.get(day)||[];
    cell.querySelector('.portal-calendar-preview-list')?.remove();if(!events.length)return;
    const oldCounter=Array.from(cell.children).find(child=>(child.textContent||'').toUpperCase().includes('DEFESA'));if(oldCounter)oldCounter.remove();
    const list=document.createElement('div');list.className='portal-calendar-preview-list';
    events.slice(0,2).forEach(proc=>{
      const item=document.createElement('div');
      const defended=proc.status==='CONCLUIDO'||proc.status==='COMPLETED'||proc.status==='EM_AVALIACAO'||proc.status==='AWAITING_EVALUATION'||new Date(proc.defesa.startAt).getTime()<Date.now();
      item.className=`portal-calendar-preview ${defended?'is-defended':'is-upcoming'}`;
      const title=normalize(proc.titulo||'TCC');const local=normalize(proc.defesa?.local||'Local a confirmar');
      const strong=document.createElement('strong');strong.textContent=title;strong.title=title;
      const meta=document.createElement('span');meta.textContent=`${timeLabel(proc.defesa.startAt)} · ${local}`;
      item.append(strong,meta);list.appendChild(item);
    });
    if(events.length>2){const more=document.createElement('span');more.className='portal-calendar-preview-more';more.textContent=`+${events.length-2} defesa(s)`;list.appendChild(more);}cell.appendChild(list);
  });
}

function enhanceAll(){
  standardizeToolbarOrder();
  document.querySelectorAll<HTMLTableElement>('#portal-app-root main table').forEach(enhanceTable);
  void enhanceCalendar();
}

export function PortalSpreadsheetEnhancer(){
  useEffect(()=>{
    let frame=0;const schedule=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(enhanceAll);};
    enhanceAll();const observer=new MutationObserver(schedule);observer.observe(document.body,{childList:true,subtree:true});
    const close=(event:MouseEvent)=>{if(activeFilterPopup&&!activeFilterPopup.contains(event.target as Node)&&!(event.target as HTMLElement).closest('.portal-column-filter'))closeFilterPopup();};
    document.addEventListener('mousedown',close);
    return()=>{observer.disconnect();cancelAnimationFrame(frame);document.removeEventListener('mousedown',close);closeFilterPopup();};
  },[]);
  return null;
}
