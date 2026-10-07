import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowDown, ArrowUp, Columns3, ListFilter, Lock, RotateCcw, Settings, Star, X } from 'lucide-react';
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

type UserTablePreference = {
  columnOrder?: string[];
  visibleColumns?: Record<string, boolean>;
  recordsLimit?: PageSize; // legado: páginas React antigas truncavam o DOM
  pageSize?: PageSize;
  startDate?: string;
  endDate?: string;
  updatedAt?: string;
};

const normalizeEmailKey=(value:string)=>value.trim().toLowerCase().replace(/[^a-z0-9@._+-]/g,'_');
const preferenceKey=(email:string,storageKey:string)=>`portal_user_table_config_${normalizeEmailKey(email)}_${storageKey}`;
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
    setVisibleColumns,columnOrder=[],setColumnOrder,storageKey,defaultColumnOrder,defaultVisibleColumns,defaultTableTitle
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
  const inheritMasterDefaultRef=useRef(false);
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
      try{localStorage.setItem(wrapModeKey(storageKey),next);}catch{/* preferência visual não bloqueia a tabela */}
    }
    window.dispatchEvent(new CustomEvent('portal-table-layouts-updated'));
  };

  useEffect(()=>{
    if(!isAuthenticated||!currentPreferenceKey||!canManageColumns)return;
    if(hydratedPreferenceRef.current===currentPreferenceKey)return;
    hydratedPreferenceRef.current=currentPreferenceKey;
    inheritMasterDefaultRef.current=false;
    try{
      const raw=localStorage.getItem(currentPreferenceKey);
      if(!raw){setRecordsLimit('all');return;}
      const saved=JSON.parse(raw) as UserTablePreference;
      if(Array.isArray(saved.columnOrder)&&saved.columnOrder.length)setColumnOrder?.(saved.columnOrder);
      if(saved.visibleColumns&&typeof saved.visibleColumns==='object')setVisibleColumns?.(saved.visibleColumns);
      const legacyOrPageSize=saved.pageSize??saved.recordsLimit;
      if(legacyOrPageSize!==undefined){
        const next=parsePageSize(legacyOrPageSize,allowedLimits,readStoredPageSize());
        persistPageSize(next);
      }else setRecordsLimit('all');
      if(saved.startDate!==undefined)setStartDate?.(saved.startDate);
      if(saved.endDate!==undefined)setEndDate?.(saved.endDate);
    }catch(error){console.warn('Não foi possível restaurar a preferência individual da planilha.',error);setRecordsLimit('all');}
  },[isAuthenticated,currentPreferenceKey,canManageColumns,setColumnOrder,setVisibleColumns,setRecordsLimit,setStartDate,setEndDate]);

  useEffect(()=>{
    if(!isAuthenticated||!currentPreferenceKey||!canManageColumns||hydratedPreferenceRef.current!==currentPreferenceKey||inheritMasterDefaultRef.current)return;
    const timer=window.setTimeout(()=>{
      try{
        const normalizedVisible={...visibleColumns};
        if(fixedColumnKey)normalizedVisible[fixedColumnKey]=true;
        const payload:UserTablePreference={columnOrder:normalizedOrder,visibleColumns:normalizedVisible,recordsLimit:'all',pageSize,startDate:startDate||'',endDate:endDate||'',updatedAt:new Date().toISOString()};
        localStorage.setItem(currentPreferenceKey,JSON.stringify(payload));
      }catch(error){console.warn('Não foi possível salvar a preferência individual da planilha.',error);}
    },180);
    return()=>window.clearTimeout(timer);
  },[isAuthenticated,currentPreferenceKey,canManageColumns,normalizedOrder,visibleColumns,pageSize,startDate,endDate,fixedColumnKey]);

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

  const markPersonal=()=>{inheritMasterDefaultRef.current=false;};

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

  const restoreDefault=()=>{
    if(!storageKey)return;
    try{if(currentPreferenceKey)localStorage.removeItem(currentPreferenceKey);}catch{/* noop */}
    inheritMasterDefaultRef.current=true;
    const loaded=loadTableConfig(storageKey,defaultColumnOrder||allColumns.map(c=>c.key),defaultVisibleColumns||Object.fromEntries(allColumns.map(c=>[c.key,true])),defaultRecordsLimit);
    setColumnOrder?.(loaded.columnOrder);
    setVisibleColumns?.(loaded.visibleColumns);
    setRecordsLimit('all');
    let restoredPageSize=parsePageSize(defaultRecordsLimit,allowedLimits,25);
    try{
      const raw=localStorage.getItem(`default_table_config_${storageKey}`);
      if(raw){const parsed=JSON.parse(raw);restoredPageSize=parsePageSize(parsed.pageSize??parsed.recordsLimit,allowedLimits,restoredPageSize);}
    }catch{/* noop */}
    persistPageSize(restoredPageSize);
    setStartDate?.(loaded.startDate||'');setEndDate?.(loaded.endDate||'');
    setSaveMessage('Visualização restaurada para o padrão desta planilha.');
  };

  const saveMasterDefault=()=>{
    if(!isMaster||!storageKey)return;
    try{
      const existingRaw=localStorage.getItem(`default_table_config_${storageKey}`);
      const existing=existingRaw?JSON.parse(existingRaw):{};
      localStorage.setItem(`default_table_config_${storageKey}`,JSON.stringify({...existing,columnOrder:normalizedOrder,visibleColumns:{...visibleColumns,...(fixedColumnKey?{[fixedColumnKey]:true}:{})},recordsLimit:'all',pageSize,startDate:startDate||'',endDate:endDate||'',updatedAt:new Date().toISOString(),updatedBy:userEmail}));
      setSaveMessage('Padrão desta planilha atualizado pelo Master. Publique a Personalização para distribuir o padrão.');
    }catch{setSaveMessage('Não foi possível salvar o padrão desta planilha.');}
  };

  return <div className="inline-flex items-center gap-1.5 shrink-0">
    <button ref={gearButtonRef} type="button" onClick={handleToggle} className="portal-toolbar-icon-button relative" title={canManageColumns?'Exibição da planilha: linhas, período, colunas e ordem':'Exibição da planilha: linhas e período'} aria-label="Configurar exibição da planilha">
      <Settings className="h-3.5 w-3.5 text-current"/>{hasActiveFilters&&<span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-[var(--portal-brand-action)] ring-2 ring-white"/>}
    </button>
    {isOpen&&createPortal(
      <div ref={popupRef} data-portal-table-master={isMaster?'true':'false'} className="portal-table-settings-popover portal-modal-surface fixed z-[1000001] max-h-[calc(100vh-1.5rem)] overflow-y-auto text-slate-800 shadow-2xl animate-in fade-in zoom-in-95 duration-150" style={{top:popoverPos.top,left:popoverPos.left}}>
        <div className="portal-settings-popover-header">
          <span className="flex items-center gap-1.5 text-[10.5px] font-black uppercase tracking-wider text-white"><Settings className="h-3.5 w-3.5 text-white" aria-hidden="true"/>Exibição da planilha</span>
          <button type="button" onClick={()=>setIsOpen(false)} className="portal-modal-header-close" aria-label="Fechar configuração da planilha" title="Fechar">
            <X className="h-3.5 w-3.5" aria-hidden="true"/>
          </button>
        </div>
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
            <div><span className="flex items-center gap-1.5 text-[9.5px] font-black uppercase tracking-wider text-slate-800"><Columns3 className="h-3.5 w-3.5"/>Colunas e ordem</span><p className="mt-0.5 text-[8.5px] text-slate-500">Marque para exibir. Use as setas para alterar a ordem.</p></div>
            {isMaster&&<button type="button" onClick={saveMasterDefault} className="portal-popup-action"><Star className="h-3 w-3"/>Definir padrão</button>}
          </div>
          <div className="portal-settings-column-grid">
            {normalizedOrder.map((key,index)=>{const column=columnMap.get(key)||{key,label:key};const fixed=key===fixedColumnKey;const shown=fixed||visibleColumns[key]!==false;return <div key={key} className="portal-settings-column-item" data-visible={shown?'true':'false'}>
              <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-[9.5px] font-semibold"><input type="checkbox" checked={shown} disabled={fixed} onChange={e=>toggleColumn(key,e.target.checked)} className="h-3.5 w-3.5"/><span className="truncate">{column.label}</span></label>
              {fixed?<span className="inline-flex items-center gap-1 rounded-md bg-[var(--portal-surface-card)] px-1.5 py-1 text-[8px] font-black uppercase text-slate-500"><Lock className="h-2.5 w-2.5"/>Fixa</span>:<div className="flex items-center"><button type="button" disabled={index<=(fixedColumnKey?1:0)} onClick={()=>moveColumn(index,-1)} className="rounded p-1 text-slate-600 hover:bg-[var(--portal-surface-card)] disabled:opacity-20" aria-label={`Mover ${column.label} para cima`}><ArrowUp className="h-3.5 w-3.5"/></button><button type="button" disabled={index>=normalizedOrder.length-1} onClick={()=>moveColumn(index,1)} className="rounded p-1 text-slate-600 hover:bg-[var(--portal-surface-card)] disabled:opacity-20" aria-label={`Mover ${column.label} para baixo`}><ArrowDown className="h-3.5 w-3.5"/></button></div>}
            </div>;})}
          </div>
        </section>}
        {saveMessage&&<div role="status" className="mt-2 rounded-lg border border-[var(--portal-border)] bg-[var(--portal-surface-card)] px-3 py-2 text-[9px] font-semibold text-[var(--portal-brand-action)]">{saveMessage}</div>}
        <div className="portal-settings-footer"><button type="button" onClick={restoreDefault} className="portal-popup-secondary-action"><RotateCcw className="h-3 w-3"/>Restaurar padrão</button></div>
      </div>,document.body)}
  </div>;
};
