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

type UserTablePreference = {
  columnOrder?: string[];
  visibleColumns?: Record<string, boolean>;
  recordsLimit?: number|'all';
  startDate?: string;
  endDate?: string;
  updatedAt?: string;
};

const normalizeEmailKey=(value:string)=>value.trim().toLowerCase().replace(/[^a-z0-9@._+-]/g,'_');
const preferenceKey=(email:string,storageKey:string)=>`portal_user_table_config_${normalizeEmailKey(email)}_${storageKey}`;

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
  const hasActiveFilters=Boolean((startDate&&startDate.trim())||(endDate&&endDate.trim())||(defaultRecordsLimit&&recordsLimit!==defaultRecordsLimit));
  const currentPreferenceKey=storageKey&&userEmail?preferenceKey(userEmail,storageKey):'';

  const fixedColumnKey=useMemo(()=>allColumns.find(column=>column.isFixed)?.key||(allColumns.some(column=>column.key==='protocolo')?'protocolo':undefined),[allColumns]);
  const normalizedOrder=useMemo(()=>{
    const valid=new Set(allColumns.map(column=>column.key));
    const order=Array.from(new Set(columnOrder)).filter(key=>valid.has(key));
    allColumns.forEach(column=>{if(!order.includes(column.key))order.push(column.key);});
    if(fixedColumnKey){const index=order.indexOf(fixedColumnKey);if(index>0){order.splice(index,1);order.unshift(fixedColumnKey);}}
    return order;
  },[allColumns,columnOrder,fixedColumnKey]);
  const columnMap=useMemo(()=>new Map(allColumns.map(column=>[column.key,column])),[allColumns]);

  useEffect(()=>{
    if(!isAuthenticated||!currentPreferenceKey||!canManageColumns)return;
    if(hydratedPreferenceRef.current===currentPreferenceKey)return;
    hydratedPreferenceRef.current=currentPreferenceKey;
    inheritMasterDefaultRef.current=false;
    try{
      const raw=localStorage.getItem(currentPreferenceKey);
      if(!raw)return;
      const saved=JSON.parse(raw) as UserTablePreference;
      if(Array.isArray(saved.columnOrder)&&saved.columnOrder.length)setColumnOrder?.(saved.columnOrder);
      if(saved.visibleColumns&&typeof saved.visibleColumns==='object')setVisibleColumns?.(saved.visibleColumns);
      if(saved.recordsLimit!==undefined)setRecordsLimit(saved.recordsLimit);
      if(saved.startDate!==undefined)setStartDate?.(saved.startDate);
      if(saved.endDate!==undefined)setEndDate?.(saved.endDate);
    }catch(error){console.warn('Não foi possível restaurar a preferência individual da planilha.',error);}
  },[isAuthenticated,currentPreferenceKey,canManageColumns,setColumnOrder,setVisibleColumns,setRecordsLimit,setStartDate,setEndDate]);

  useEffect(()=>{
    if(!isAuthenticated||!currentPreferenceKey||!canManageColumns||hydratedPreferenceRef.current!==currentPreferenceKey||inheritMasterDefaultRef.current)return;
    const timer=window.setTimeout(()=>{
      try{
        const normalizedVisible={...visibleColumns};
        if(fixedColumnKey)normalizedVisible[fixedColumnKey]=true;
        const payload:UserTablePreference={columnOrder:normalizedOrder,visibleColumns:normalizedVisible,recordsLimit,startDate:startDate||'',endDate:endDate||'',updatedAt:new Date().toISOString()};
        localStorage.setItem(currentPreferenceKey,JSON.stringify(payload));
      }catch(error){console.warn('Não foi possível salvar a preferência individual da planilha.',error);}
    },180);
    return()=>window.clearTimeout(timer);
  },[isAuthenticated,currentPreferenceKey,canManageColumns,normalizedOrder,visibleColumns,recordsLimit,startDate,endDate,fixedColumnKey]);

  const handleToggle=()=>{
    if(isOpen){setIsOpen(false);return;}
    if(gearButtonRef.current){
      const rect=gearButtonRef.current.getBoundingClientRect();
      const popupWidth=Math.min(canManageColumns?560:340,window.innerWidth-32);
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
    setRecordsLimit(loaded.recordsLimit);
    setStartDate?.(loaded.startDate||'');setEndDate?.(loaded.endDate||'');
    setSaveMessage('Visualização restaurada para o padrão desta planilha.');
  };

  const saveMasterDefault=()=>{
    if(!isMaster||!storageKey)return;
    try{
      const existingRaw=localStorage.getItem(`default_table_config_${storageKey}`);
      const existing=existingRaw?JSON.parse(existingRaw):{};
      localStorage.setItem(`default_table_config_${storageKey}`,JSON.stringify({...existing,columnOrder:normalizedOrder,visibleColumns:{...visibleColumns,...(fixedColumnKey?{[fixedColumnKey]:true}:{})},recordsLimit,startDate:startDate||'',endDate:endDate||'',updatedAt:new Date().toISOString(),updatedBy:userEmail}));
      setSaveMessage('Padrão desta planilha atualizado pelo Master. Publique a Personalização para distribuir o padrão.');
    }catch{setSaveMessage('Não foi possível salvar o padrão desta planilha.');}
  };

  return <div className="inline-flex items-center gap-1.5 shrink-0">
    <button ref={gearButtonRef} type="button" onClick={handleToggle} className={`${styles.toolbarButtonClass} relative`} style={styles.toolbarButtonStyle} title={canManageColumns?'Exibição da planilha: linhas, período, colunas e ordem':'Exibição da planilha: linhas e período'} aria-label="Configurar exibição da planilha">
      <Settings className="h-3.5 w-3.5 text-current"/>{hasActiveFilters&&<span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-[#6f8f79] ring-2 ring-white"/>}
    </button>
    {isOpen&&createPortal(
      <div ref={popupRef} data-portal-table-master={isMaster?'true':'false'} className="portal-table-settings-popover fixed z-[1000001] max-h-[calc(100vh-1.5rem)] w-[min(560px,calc(100vw-2rem))] overflow-y-auto rounded-xl border border-slate-300 bg-white p-3.5 text-slate-800 shadow-2xl animate-in fade-in zoom-in-95 duration-150" style={{top:popoverPos.top,left:popoverPos.left}}>
        <div className="mb-3 flex items-center justify-between border-b border-slate-200 pb-2">
          <span className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-slate-900"><Settings className="h-3.5 w-3.5 text-slate-600"/>Exibição da planilha</span>
          <button type="button" onClick={()=>setIsOpen(false)} className="rounded-md p-1 text-xs font-bold text-slate-400 hover:text-slate-700" aria-label="Fechar">✕</button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <section className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div className="mb-1.5 flex items-center justify-between"><span className="flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-slate-700"><ListFilter className="h-3 w-3"/>Linhas por página</span><span className="text-[9px] font-bold text-slate-400">Atual: {recordsLimit==='all'?'Todos':recordsLimit}</span></div>
            <div className="grid grid-cols-4 gap-1">{allowedLimits.map(limit=><button key={String(limit)} type="button" onClick={()=>{markPersonal();setRecordsLimit(limit);}} className="rounded-lg border px-2 py-1.5 text-center text-[10px] font-black" style={recordsLimit===limit?{background:'#d7ded9',borderColor:'#9aac9f',color:'#1f2937'}:{background:'#fff',borderColor:'#cbd5e1',color:'#334155'}}>{limit==='all'?'Todos':limit}</button>)}</div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-700">Filtro de período</span>
            <div className="mt-1.5 grid grid-cols-2 gap-2"><label><span className="text-[9px] font-bold text-slate-500">Data inicial</span><input type="date" value={startDate||''} onChange={e=>{markPersonal();setStartDate?.(e.target.value);}} className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1 text-[11px] font-bold text-slate-800 outline-none"/></label><label><span className="text-[9px] font-bold text-slate-500">Data final</span><input type="date" value={endDate||''} onChange={e=>{markPersonal();setEndDate?.(e.target.value);}} className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1 text-[11px] font-bold text-slate-800 outline-none"/></label></div>
            {(startDate||endDate)&&<button type="button" onClick={()=>{markPersonal();setStartDate?.('');setEndDate?.('');}} className="mt-1 text-[9.5px] font-extrabold text-[#9f3131]">Limpar datas</button>}
          </section>
        </div>

        {canManageColumns&&<section className="mt-3 rounded-xl border border-slate-200 bg-[#eef1ef] p-3" aria-label={`Colunas e ordem de ${defaultTableTitle||'planilha'}`}>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div><span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-slate-800"><Columns3 className="h-3.5 w-3.5"/>Colunas e ordem</span><p className="mt-0.5 text-[9.5px] text-slate-500">Marque para exibir. Use as setas para alterar a ordem.</p></div>
            {isMaster&&<button type="button" onClick={saveMasterDefault} className="inline-flex items-center gap-1 rounded-lg border border-[#9aac9f] bg-white px-2.5 py-1.5 text-[9px] font-black uppercase text-[#315b43]"><Star className="h-3 w-3"/>Definir padrão</button>}
          </div>
          <div className="grid max-h-72 gap-1.5 overflow-y-auto pr-1 sm:grid-cols-2">
            {normalizedOrder.map((key,index)=>{const column=columnMap.get(key)||{key,label:key};const fixed=key===fixedColumnKey;const shown=fixed||visibleColumns[key]!==false;return <div key={key} className={`flex items-center gap-2 rounded-lg border px-2 py-1.5 ${shown?'border-slate-300 bg-white':'border-slate-200 bg-slate-100 text-slate-400'}`}>
              <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-[10.5px] font-semibold"><input type="checkbox" checked={shown} disabled={fixed} onChange={e=>toggleColumn(key,e.target.checked)} className="h-3.5 w-3.5"/><span className="truncate">{column.label}</span></label>
              {fixed?<span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-1.5 py-1 text-[8px] font-black uppercase text-slate-500"><Lock className="h-2.5 w-2.5"/>Fixa</span>:<div className="flex items-center"><button type="button" disabled={index<=(fixedColumnKey?1:0)} onClick={()=>moveColumn(index,-1)} className="rounded p-1 text-slate-600 hover:bg-slate-100 disabled:opacity-20" aria-label={`Mover ${column.label} para cima`}><ArrowUp className="h-3.5 w-3.5"/></button><button type="button" disabled={index>=normalizedOrder.length-1} onClick={()=>moveColumn(index,1)} className="rounded p-1 text-slate-600 hover:bg-slate-100 disabled:opacity-20" aria-label={`Mover ${column.label} para baixo`}><ArrowDown className="h-3.5 w-3.5"/></button></div>}
            </div>;})}
          </div>
        </section>}

        {saveMessage&&<div role="status" className="mt-2 rounded-lg border border-[#b8c7bc] bg-[#edf3ef] px-3 py-2 text-[10px] font-semibold text-[#315b43]">{saveMessage}</div>}
        <div className="mt-3 flex items-center justify-between border-t border-slate-200 pt-2"><button type="button" onClick={restoreDefault} className="inline-flex items-center gap-1 text-[9.5px] font-bold text-slate-600 hover:text-slate-900"><RotateCcw className="h-3 w-3"/>Restaurar padrão</button><button type="button" onClick={()=>setIsOpen(false)} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-[10px] font-extrabold uppercase text-slate-800">Concluir</button></div>
      </div>,document.body)}
  </div>;
};
