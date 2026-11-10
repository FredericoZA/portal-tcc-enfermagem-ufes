import {enqueueTablePreferenceWrite} from '../services/tablePreferenceWrites';
import {fetchApiRequest} from '../services/apiClient';
import {applyTableRuntimePreference,mergeTablePreferences,readStoredTablePreference,sanitizeTablePreference,tablePreferenceKey,TABLE_DEFAULTS_EVENT,TABLE_PREFERENCE_EVENT,type TablePreference} from '../utils/tablePreferences';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowDown, ArrowUp, Columns3, ListFilter, Lock, RotateCcw, Settings, Star } from 'lucide-react';
import { DEFAULT_TABLE_TEXT_FORMAT, TableTextFormat, loadTableConfig } from './TableColumnSelectorPanel';
import { getTableStyles } from '../utils/tableFormatters';
import { useAuth } from '../context/AuthContext';

export interface HeaderSettingsPopoverProps {
  recordsLimit:number|'all'; setRecordsLimit:(limit:number|'all')=>void; allowedLimits?:(number|'all')[];
  allColumns?:{key:string;label:string;isFixed?:boolean}[]; visibleColumns?:Record<string,boolean>; setVisibleColumns?:(visible:Record<string,boolean>|((prev:Record<string,boolean>)=>Record<string,boolean>))=>void;
  columnOrder?:string[]; setColumnOrder?:(order:string[])=>void; storageKey?:string; customLabels?:Record<string,string>; setCustomLabels?:React.Dispatch<React.SetStateAction<Record<string,string>>>;
  columnWidths?:Record<string,string|number>; setColumnWidths?:React.Dispatch<React.SetStateAction<Record<string,string|number>>>; textFormat?:TableTextFormat; setTextFormat?:React.Dispatch<React.SetStateAction<TableTextFormat>>;
  defaultColumnOrder?:string[]; defaultVisibleColumns?:Record<string,boolean>; defaultRecordsLimit?:number|'all'; startDate?:string; setStartDate?:(val:string)=>void; endDate?:string; setEndDate?:(val:string)=>void; defaultTableTitle?:string; defaultFilterTitle?:string;
}

type PageSize = number | 'all';
type WrapMode = 'wrap' | 'nowrap';

const preferenceKey = tablePreferenceKey;
const pageSizeKey=(storageKey:string)=>`portal_table_page_size_${storageKey}`;
const currentPageKey=(storageKey:string)=>`portal_table_current_page_${storageKey}`;
const wrapModeKey=(storageKey:string)=>`portal_tcc_v1043_wrap_${storageKey}`;

const parsePageSize=(value:unknown,allowedLimits:PageSize[],fallback:PageSize):PageSize=>{
  if(value==='all'&&allowedLimits.includes('all'))return'all';
  const numeric=Number(value);
  return allowedLimits.includes(numeric)?numeric:fallback;
};

export const HeaderSettingsPopover:React.FC<HeaderSettingsPopoverProps> = (props) => {
  const {
    recordsLimit,setRecordsLimit,allowedLimits=[25,50,100,'all'],textFormat=DEFAULT_TABLE_TEXT_FORMAT,
    defaultRecordsLimit=25,startDate,setStartDate,endDate,setEndDate,allColumns=[],visibleColumns={},
    setVisibleColumns,columnOrder=[],setColumnOrder,storageKey,defaultColumnOrder,defaultVisibleColumns,defaultTableTitle,
    customLabels={},setCustomLabels,columnWidths={},setColumnWidths
  }=props;
  const {globalRoles,userEmail,isAuthenticated}=useAuth();
  const isMaster=globalRoles.includes('MASTER_ADMIN');
  const canManageColumns=Boolean(storageKey&&allColumns.length&&setVisibleColumns&&setColumnOrder);
  const [isOpen,setIsOpen]=useState(false);
  const [saveMessage,setSaveMessage]=useState('');
  const styles=getTableStyles(textFormat);
  const gearButtonRef=useRef<HTMLButtonElement>(null);
  const popupRef=useRef<HTMLDivElement>(null);
  const [popoverPos,setPopoverPos]=useState({top:0,left:0});
  const hydratedPreferenceRef=useRef('');
  const personalRef=useRef<TablePreference | null>(null);
  const dirtyRef=useRef(false);
  const lastSavedPreferenceRef=useRef('');
  const [isSavingDefault,setIsSavingDefault]=useState(false);
  const currentPreferenceKey=storageKey&&userEmail?preferenceKey(userEmail,storageKey):'';

  const readStoredPageSize=():PageSize=>{
    const fallback=parsePageSize(defaultRecordsLimit,allowedLimits,25);
    if(typeof window==='undefined'||!storageKey)return fallback;
    try{return parsePageSize(localStorage.getItem(pageSizeKey(storageKey)),allowedLimits,fallback);}catch{return fallback;}
  };
  const [pageSize,setPageSize]=useState<PageSize>(()=>readStoredPageSize());
  const readStoredWrapMode=():WrapMode=>{
    if(typeof window==='undefined'||!storageKey)return'wrap';
    try{return localStorage.getItem(wrapModeKey(storageKey))==='nowrap'?'nowrap':'wrap';}catch{return'wrap';}
  };
  const [wrapMode,setWrapMode]=useState<WrapMode>(()=>readStoredWrapMode());

  useEffect(()=>{
    const next=readStoredPageSize();
    setPageSize(next);
    setWrapMode(readStoredWrapMode());
    // A paginação canônica precisa receber todas as linhas; páginas React não podem truncar o DOM.
    if(recordsLimit!=='all')setRecordsLimit('all');
  },[storageKey]);

  const hasActiveFilters=Boolean((startDate&&startDate.trim())||(endDate&&endDate.trim())||pageSize!==defaultRecordsLimit||wrapMode==='nowrap');

  const fixedColumnKey=useMemo(()=>allColumns.find(column=>column.isFixed)?.key||(allColumns.some(column=>column.key==='protocolo')?'protocolo':undefined),[allColumns]);
  const normalizedOrder=useMemo(()=>{
    const valid=new Set(allColumns.map(column=>column.key));
    const order=Array.from(new Set(columnOrder)).filter(key=>valid.has(key));
    allColumns.forEach(column=>{if(!order.includes(column.key))order.push(column.key);});
    if(fixedColumnKey){const index=order.indexOf(fixedColumnKey);if(index>0){order.splice(index,1);order.unshift(fixedColumnKey);}}
    return order;
  },[allColumns,columnOrder,fixedColumnKey]);
  const columnMap=useMemo(()=>new Map(allColumns.map(column=>[column.key,column])),[allColumns]);

  const persistPageSize=(next:PageSize)=>{
    setPageSize(next);
    setRecordsLimit('all');
    if(storageKey){
      try{
        localStorage.setItem(pageSizeKey(storageKey),String(next));
        localStorage.setItem(currentPageKey(storageKey),'1');
      }catch{/* localStorage indisponível não bloqueia a tabela */}
    }
    window.dispatchEvent(new CustomEvent('portal-table-layouts-updated'));
  };

  const persistWrapMode=(next:WrapMode)=>{
    setWrapMode(next);
    if(storageKey){
      try{localStorage.setItem(wrapModeKey(storageKey),next);localStorage.setItem(`portal_table_wrap_${storageKey}`,next);}catch{/* preferência visual não bloqueia a tabela */}
    }
    window.dispatchEvent(new CustomEvent('portal-table-layouts-updated'));
  };

  useEffect(()=>{
    if(!storageKey)return;
    let active=true;
    dirtyRef.current=false;
    hydratedPreferenceRef.current=currentPreferenceKey;
    let localRaw:string|null=null;try{localRaw=isAuthenticated&&currentPreferenceKey?localStorage.getItem(currentPreferenceKey):null;}catch{/* use server preference */}
    personalRef.current=localRaw?(()=>{try{return sanitizeTablePreference(JSON.parse(localRaw));}catch{return null;}})():null;
    const apply=()=>{
      const base=loadTableConfig(storageKey,defaultColumnOrder||allColumns.map(c=>c.key),defaultVisibleColumns||Object.fromEntries(allColumns.map(c=>[c.key,true])),defaultRecordsLimit,false);
      const merged=mergeTablePreferences(readStoredTablePreference(storageKey),personalRef.current||{});
      setColumnOrder?.(merged.columnOrder||base.columnOrder);
      setVisibleColumns?.({...base.visibleColumns,...merged.visibleColumns,...(fixedColumnKey?{[fixedColumnKey]:true}:{})});
      setCustomLabels?.(merged.customLabels||base.customLabels||{});
      setColumnWidths?.(merged.columnWidths||base.columnWidths||{});
      setPageSize(parsePageSize(merged.pageSize,allowedLimits,parsePageSize(defaultRecordsLimit,allowedLimits,25)));
      setWrapMode(merged.wrapMode||'wrap');
      setStartDate?.(merged.startDate||'');setEndDate?.(merged.endDate||'');setRecordsLimit('all');
      applyTableRuntimePreference(storageKey,{...merged,pageSize:parsePageSize(merged.pageSize,allowedLimits,parsePageSize(defaultRecordsLimit,allowedLimits,25))});
    };
    apply();
    const onDefaults=()=>{if(!dirtyRef.current)apply();};
    window.addEventListener(TABLE_DEFAULTS_EVENT,onDefaults);
    if(isAuthenticated&&currentPreferenceKey){
      const editKey=currentPreferenceKey;
      void fetchApiRequest<TablePreference|null>(`/api/table-preferences/${encodeURIComponent(storageKey)}`).then(saved=>{
        if(!active||dirtyRef.current||hydratedPreferenceRef.current!==editKey)return;
        if(saved){personalRef.current=sanitizeTablePreference(saved);try{localStorage.setItem(editKey,JSON.stringify(personalRef.current));}catch{/* optional cache */}apply();}
        else if(personalRef.current){ // Preserve and migrate preferences already saved in this browser.
          const migrated=JSON.stringify(personalRef.current);
          void enqueueTablePreferenceWrite(editKey,()=>hydratedPreferenceRef.current===editKey?fetchApiRequest(`/api/table-preferences/${encodeURIComponent(storageKey)}`,{method:'PUT',body:migrated}):Promise.resolve()).catch(()=>{if(active)setSaveMessage('Sua exibição foi mantida neste navegador; não foi possível sincronizar com sua conta.');});
        }
      }).catch(()=>{if(active)setSaveMessage('Exibição local recuperada. Não foi possível consultar a preferência da conta.');});
    }
    return()=>{active=false;window.removeEventListener(TABLE_DEFAULTS_EVENT,onDefaults);};
  },[storageKey,currentPreferenceKey,isAuthenticated]);

  useEffect(()=>{
    if(!storageKey)return;
    const resized=(event:Event)=>{if((event as CustomEvent).detail?.key!==storageKey)return;dirtyRef.current=true;setResizeRevision(value=>value+1);};
    window.addEventListener(TABLE_PREFERENCE_EVENT,resized);
    return()=>window.removeEventListener(TABLE_PREFERENCE_EVENT,resized);
  },[storageKey]);
  const [resizeRevision,setResizeRevision]=useState(0);
  useEffect(()=>{
    if(!isAuthenticated||!storageKey||!currentPreferenceKey||!dirtyRef.current||hydratedPreferenceRef.current!==currentPreferenceKey)return;
    const visible={...visibleColumns,...(fixedColumnKey?{[fixedColumnKey]:true}:{})};
    let resizedWidths={};try{resizedWidths=JSON.parse(localStorage.getItem(`portal_table_widths_${storageKey}`)||'{}');}catch{/* use empty widths */}
    const payload=sanitizeTablePreference({columnOrder:normalizedOrder,visibleColumns:visible,customLabels,columnWidths,resizedWidths,recordsLimit:'all',pageSize,wrapMode,startDate:startDate||'',endDate:endDate||''});
    const signature=currentPreferenceKey+JSON.stringify(payload);
    if(lastSavedPreferenceRef.current===signature)return;
    lastSavedPreferenceRef.current=signature;
    personalRef.current=payload;
    try{localStorage.setItem(currentPreferenceKey,JSON.stringify(payload));}catch{/* server storage still works */}
    let active=true;
    // Quiet persistence: visual preferences must not open the global loading overlay.
    void enqueueTablePreferenceWrite(currentPreferenceKey,()=>hydratedPreferenceRef.current===currentPreferenceKey?fetchApiRequest(`/api/table-preferences/${encodeURIComponent(storageKey)}`,{method:'PUT',body:JSON.stringify(payload)}):Promise.resolve()).catch(()=>{if(active)setSaveMessage('Exibição mantida neste navegador; sincronização da conta pendente.');});
    return()=>{active=false;};
  },[isAuthenticated,currentPreferenceKey,storageKey,normalizedOrder,visibleColumns,pageSize,wrapMode,startDate,endDate,customLabels,columnWidths,resizeRevision]);

  const handleToggle=()=>{
    if(isOpen){setIsOpen(false);return;}
    if(gearButtonRef.current){
      const rect=gearButtonRef.current.getBoundingClientRect();
      const popupWidth=Math.min(canManageColumns?520:360,window.innerWidth-32);
      let left=Math.min(rect.right-popupWidth,window.innerWidth-popupWidth-16);
      left=Math.max(16,left);
      let top=rect.bottom+8;
      if(top+640>window.innerHeight&&rect.top>420)top=Math.max(12,rect.top-Math.min(620,window.innerHeight-24));
      setPopoverPos({top,left});
    }
    setIsOpen(true);
  };

  useEffect(()=>{
    if(!isOpen)return;
    const key=(e:KeyboardEvent)=>{if(e.key==='Escape')setIsOpen(false);};
    const outside=(e:MouseEvent)=>{if(popupRef.current&&!popupRef.current.contains(e.target as Node)&&!gearButtonRef.current?.contains(e.target as Node))setIsOpen(false);};
    window.addEventListener('keydown',key);document.addEventListener('mousedown',outside);
    return()=>{window.removeEventListener('keydown',key);document.removeEventListener('mousedown',outside);};
  },[isOpen]);

  const markPersonal=()=>{dirtyRef.current=true;};

  const moveColumn=(index:number,direction:-1|1)=>{
    if(!setColumnOrder)return;
    const firstMovable=fixedColumnKey?1:0;
    const target=index+direction;
    if(index<firstMovable||target<firstMovable||target>=normalizedOrder.length)return;
    const next=[...normalizedOrder];
    const [moved]=next.splice(index,1);next.splice(target,0,moved);
    markPersonal();setColumnOrder(next);
  };

  const toggleColumn=(key:string,checked:boolean)=>{
    if(!setVisibleColumns||key===fixedColumnKey)return;
    markPersonal();setVisibleColumns(prev=>({...prev,[key]:checked,...(fixedColumnKey?{[fixedColumnKey]:true}:{})}));
  };

  const restoreDefault=async()=>{
    if(!storageKey)return;
    try{
      if(isAuthenticated)await enqueueTablePreferenceWrite(currentPreferenceKey,()=>fetchApiRequest(`/api/table-preferences/${encodeURIComponent(storageKey)}`,{method:'DELETE'}));
      if(currentPreferenceKey)localStorage.removeItem(currentPreferenceKey);
      dirtyRef.current=false;personalRef.current=null;
      window.dispatchEvent(new Event(TABLE_DEFAULTS_EVENT));
      setSaveMessage('Exibição restaurada para o padrão definido pelo Master.');
    }catch{setSaveMessage('Não foi possível restaurar o padrão. Sua configuração foi preservada.');}
  };

  const saveMasterDefault=async()=>{
    if(!isMaster||!storageKey||isSavingDefault)return;
    setIsSavingDefault(true);
    try{
      let resizedWidths={};try{resizedWidths=JSON.parse(localStorage.getItem(`portal_table_widths_${storageKey}`)||'{}');}catch{/* noop */}
      const payload=sanitizeTablePreference({columnOrder:normalizedOrder,visibleColumns:{...visibleColumns,...(fixedColumnKey?{[fixedColumnKey]:true}:{})},customLabels,columnWidths,resizedWidths,pageSize,wrapMode,startDate:startDate||'',endDate:endDate||''});
      const saved=await fetchApiRequest<TablePreference>(`/api/admin/table-defaults/${encodeURIComponent(storageKey)}`,{method:'PUT',body:JSON.stringify(payload)});
      localStorage.setItem(`default_table_config_${storageKey}`,JSON.stringify(saved));
      window.dispatchEvent(new Event(TABLE_DEFAULTS_EVENT));
      setSaveMessage('Padrão salvo para todos. As preferências pessoais de cada usuário foram preservadas.');
    }catch{setSaveMessage('Não foi possível salvar o padrão geral. Tente novamente.');}
    finally{setIsSavingDefault(false);}
  };

  return <div className="inline-flex items-center gap-1.5 shrink-0">
    <button ref={gearButtonRef} type="button" onClick={handleToggle} className="portal-toolbar-icon-button relative" title={canManageColumns?'Exibição da planilha: linhas, período, colunas e ordem':'Exibição da planilha: linhas e período'} aria-label="Configurar exibição da planilha">
      <Settings className="h-3.5 w-3.5 text-current"/>{hasActiveFilters&&<span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-[var(--portal-brand-action)] ring-2 ring-white"/>}
    </button>
    {isOpen&&createPortal(
      <div ref={popupRef} data-portal-table-master={isMaster?'true':'false'} className="portal-table-settings-popover portal-modal-surface fixed z-[1000001] max-h-[calc(100vh-1.5rem)] overflow-hidden text-slate-800 animate-in fade-in zoom-in-95 duration-150" style={{top:popoverPos.top,left:popoverPos.left}}>
        <div className="portal-settings-popover-header">
          <span className="flex items-center gap-1.5 text-[10.5px] font-black normal-case tracking-wider text-white"><Settings className="h-3.5 w-3.5 text-white" aria-hidden="true"/>Exibição da planilha</span>
        </div>
        <div className="portal-modal-divider" aria-hidden="true" />
        <div className="portal-settings-popover-body">
        <div className="portal-settings-top-grid">
          <section className="portal-settings-control-card">
            <div className="flex items-center justify-between gap-2"><span className="portal-settings-control-title flex items-center gap-1"><ListFilter className="h-3 w-3"/>Linhas por página</span><span className="text-[8.5px] font-bold text-slate-500">Atual: {pageSize==='all'?'Todos':pageSize}</span></div>
            <div className="portal-settings-page-size-options">{allowedLimits.map(limit=><button key={String(limit)} type="button" onClick={()=>{markPersonal();persistPageSize(limit);}} data-selected={pageSize===limit?'true':'false'} className="portal-settings-page-size-button">{limit==='all'?'Todos':limit}</button>)}</div>
          </section>
          <section className="portal-settings-control-card">
            <span className="portal-settings-control-title">Filtro de período</span>
            <div className="portal-settings-date-grid">
              <label className="portal-settings-date-field"><span>Data inicial</span><input type="date" value={startDate||''} onChange={e=>{markPersonal();setStartDate?.(e.target.value);}} /></label>
              <label className="portal-settings-date-field"><span>Data final</span><input type="date" value={endDate||''} onChange={e=>{markPersonal();setEndDate?.(e.target.value);}} /></label>
            </div>
            {(startDate||endDate)&&<button type="button" onClick={()=>{markPersonal();setStartDate?.('');setEndDate?.('');}} className="mt-1.5 text-[8.5px] font-bold text-[var(--portal-danger)]">Limpar datas</button>}
          </section>
        </div>
        {storageKey&&<section className="portal-core-wrap-setting">
          <div><strong>Quebra de texto</strong><span>Escolha como o conteúdo ocupa as células.</span></div>
          <div className="portal-core-wrap-actions">
            <button type="button" data-wrap="wrap" data-active={wrapMode==='wrap'?'true':'false'} aria-pressed={wrapMode==='wrap'} onClick={()=>{markPersonal();persistWrapMode('wrap');}}>Quebrar texto</button>
            <button type="button" data-wrap="nowrap" data-active={wrapMode==='nowrap'?'true':'false'} aria-pressed={wrapMode==='nowrap'} onClick={()=>{markPersonal();persistWrapMode('nowrap');}}>Uma linha</button>
          </div>
        </section>}
        {canManageColumns&&<section className="portal-settings-columns-card" aria-label={`Colunas e ordem de ${defaultTableTitle||'planilha'}`}>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div><span className="flex items-center gap-1.5 text-[9.5px] font-black normal-case tracking-wider text-slate-800"><Columns3 className="h-3.5 w-3.5"/>Colunas e ordem</span><p className="mt-0.5 text-[8.5px] text-slate-500">Marque para exibir. Use as setas para alterar a ordem.</p></div>
            {isMaster&&<button type="button" onClick={saveMasterDefault} disabled={isSavingDefault} className="portal-popup-action"><Star className="h-3 w-3"/>{isSavingDefault?'Salvando…':'Definir padrão'}</button>}
          </div>
          <div className="portal-settings-column-grid">
            {normalizedOrder.map((key,index)=>{const column=columnMap.get(key)||{key,label:key};const fixed=key===fixedColumnKey;const shown=fixed||visibleColumns[key]!==false;return <div key={key} className="portal-settings-column-item" data-visible={shown?'true':'false'}>
              <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-[9.5px] font-semibold"><input type="checkbox" checked={shown} disabled={fixed} onChange={e=>toggleColumn(key,e.target.checked)} className="h-3.5 w-3.5"/><span className="truncate">{column.label}</span></label>
              {fixed?<span className="inline-flex items-center gap-1 rounded-md bg-[var(--portal-surface-card)] px-1.5 py-1 text-[8px] font-black normal-case text-slate-500"><Lock className="h-2.5 w-2.5"/>Fixa</span>:<div className="flex items-center"><button type="button" disabled={index<=(fixedColumnKey?1:0)} onClick={()=>moveColumn(index,-1)} className="rounded p-1 text-slate-600 hover:bg-[var(--portal-surface-card)] disabled:opacity-20" aria-label={`Mover ${column.label} para cima`}><ArrowUp className="h-3.5 w-3.5"/></button><button type="button" disabled={index>=normalizedOrder.length-1} onClick={()=>moveColumn(index,1)} className="rounded p-1 text-slate-600 hover:bg-[var(--portal-surface-card)] disabled:opacity-20" aria-label={`Mover ${column.label} para baixo`}><ArrowDown className="h-3.5 w-3.5"/></button></div>}
            </div>;})}
          </div>
        </section>}
        {saveMessage&&<div role="status" className="mt-2 rounded-lg border border-[var(--portal-border)] bg-[var(--portal-surface-card)] px-3 py-2 text-[9px] font-semibold text-[var(--portal-brand-action)]">{saveMessage}</div>}
        <div className="portal-settings-footer"><button type="button" onClick={restoreDefault} className="portal-popup-secondary-action"><RotateCcw className="h-3 w-3"/>Restaurar padrão</button></div>
        </div>
      </div>,document.body)}
  </div>;
};
