import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Columns3, ListFilter, Settings } from 'lucide-react';
import { DEFAULT_TABLE_TEXT_FORMAT, TableColumnSelectorPanel, TableTextFormat } from './TableColumnSelectorPanel';
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
  const {recordsLimit,setRecordsLimit,allowedLimits=[25,50,100,'all'],textFormat=DEFAULT_TABLE_TEXT_FORMAT,defaultRecordsLimit=25,startDate,setStartDate,endDate,setEndDate,allColumns,visibleColumns,setVisibleColumns,columnOrder,setColumnOrder,storageKey,defaultColumnOrder,defaultVisibleColumns,defaultTableTitle}=props;
  const {globalRoles,userEmail,isAuthenticated}=useAuth();
  const isMaster=globalRoles.includes('MASTER_ADMIN');
  const canManageColumns=Boolean(storageKey&&allColumns?.length&&visibleColumns&&setVisibleColumns&&columnOrder&&setColumnOrder);
  const [isOpen,setIsOpen]=useState(false); const [columnMode,setColumnMode]=useState(false); const styles=getTableStyles(textFormat);
  const gearButtonRef=useRef<HTMLButtonElement>(null); const popupRef=useRef<HTMLDivElement>(null); const [popoverPos,setPopoverPos]=useState({top:0,left:0});
  const hydratedPreferenceRef=useRef('');
  const inheritMasterDefaultRef=useRef(false);
  const hasActiveFilters=Boolean((startDate&&startDate.trim())||(endDate&&endDate.trim())||(defaultRecordsLimit&&recordsLimit!==defaultRecordsLimit));

  const currentPreferenceKey=storageKey&&userEmail?preferenceKey(userEmail,storageKey):'';

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
        const fixedKey=allColumns?.find(column=>column.isFixed)?.key||allColumns?.[0]?.key;
        const normalizedVisible={...(visibleColumns||{})};
        if(fixedKey)normalizedVisible[fixedKey]=true;
        const normalizedOrder=[...(columnOrder||[])];
        if(fixedKey){const index=normalizedOrder.indexOf(fixedKey);if(index>0){normalizedOrder.splice(index,1);normalizedOrder.unshift(fixedKey);}}
        const payload:UserTablePreference={columnOrder:normalizedOrder,visibleColumns:normalizedVisible,recordsLimit,startDate:startDate||'',endDate:endDate||'',updatedAt:new Date().toISOString()};
        localStorage.setItem(currentPreferenceKey,JSON.stringify(payload));
      }catch(error){console.warn('Não foi possível salvar a preferência individual da planilha.',error);}
    },180);
    return()=>window.clearTimeout(timer);
  },[isAuthenticated,currentPreferenceKey,canManageColumns,columnOrder,visibleColumns,recordsLimit,startDate,endDate,allColumns]);

  const handleToggle=()=>{if(isOpen){setIsOpen(false);setColumnMode(false);return;}if(gearButtonRef.current){const rect=gearButtonRef.current.getBoundingClientRect();const popupWidth=Math.min(canManageColumns?430:320,window.innerWidth-32);let left=Math.min(rect.right-popupWidth,window.innerWidth-popupWidth-16);left=Math.max(16,left);let top=rect.bottom+8;if(top+520>window.innerHeight&&rect.top>520)top=Math.max(16,rect.top-520);setPopoverPos({top,left});}setIsOpen(true);};
  useEffect(()=>{if(!isOpen)return;const key=(e:KeyboardEvent)=>{if(e.key==='Escape'){if(columnMode)setColumnMode(false);else setIsOpen(false);}};const outside=(e:MouseEvent)=>{if(popupRef.current&&!popupRef.current.contains(e.target as Node)&&!gearButtonRef.current?.contains(e.target as Node)){setIsOpen(false);setColumnMode(false);}};window.addEventListener('keydown',key);document.addEventListener('mousedown',outside);return()=>{window.removeEventListener('keydown',key);document.removeEventListener('mousedown',outside);};},[isOpen,columnMode]);

  const handlePanelClickCapture=(event:React.MouseEvent<HTMLDivElement>)=>{
    const target=event.target as HTMLElement;
    const restoreButton=target.closest('button');
    if(!restoreButton||!currentPreferenceKey)return;
    if((restoreButton.textContent||'').toLowerCase().includes('restaurar padrão')){
      try{localStorage.removeItem(currentPreferenceKey);}catch{/* noop */}
      inheritMasterDefaultRef.current=true;
    }else if(columnMode&&!isMaster){
      inheritMasterDefaultRef.current=false;
    }
  };

  return <div className="inline-flex items-center gap-1.5 shrink-0"><button ref={gearButtonRef} type="button" onClick={handleToggle} className={`${styles.toolbarButtonClass} relative`} style={styles.toolbarButtonStyle} title={canManageColumns?'Exibição da planilha: linhas, período, colunas e ordem':'Exibição da planilha: linhas e período'}><Settings className="h-3.5 w-3.5 text-current"/>{hasActiveFilters&&<span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-white"/>}</button>{isOpen&&createPortal(<div ref={popupRef} onClickCapture={handlePanelClickCapture} data-portal-table-master={isMaster?'true':'false'} className={`fixed z-[1000001] max-h-[calc(100vh-1rem)] overflow-y-auto rounded-xl border border-slate-300 bg-white p-3.5 text-slate-800 shadow-2xl animate-in fade-in zoom-in-95 duration-150 ${columnMode?'w-[min(430px,calc(100vw-2rem))]':'w-72 sm:w-80'}`} style={{top:popoverPos.top,left:popoverPos.left}}>{columnMode&&canManageColumns?<TableColumnSelectorPanel storageKey={storageKey!} tabTitle={defaultTableTitle||'Planilha'} allColumns={allColumns!} columnOrder={columnOrder!} setColumnOrder={setColumnOrder!} visibleColumns={visibleColumns!} setVisibleColumns={setVisibleColumns!} defaultColumnOrder={defaultColumnOrder||allColumns!.map(c=>c.key)} defaultVisibleColumns={defaultVisibleColumns||Object.fromEntries(allColumns!.map(c=>[c.key,true]))} onClose={()=>setColumnMode(false)}/>:<><div className="mb-3 flex items-center justify-between border-b border-slate-200 pb-2"><span className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-slate-900"><Settings className="h-3.5 w-3.5 text-slate-600"/>Exibição da planilha</span><button type="button" onClick={()=>setIsOpen(false)} className="rounded-md p-1 text-xs font-bold text-slate-400 hover:text-slate-700">✕</button></div><div className="space-y-3"><div><div className="mb-1.5 flex items-center justify-between"><span className="flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-slate-700"><ListFilter className="h-3 w-3"/>Linhas por página</span><span className="text-[9px] font-bold text-slate-400">Atual: {recordsLimit==='all'?'Todos':recordsLimit}</span></div><div className="grid grid-cols-4 gap-1">{allowedLimits.map(limit=><button key={String(limit)} type="button" onClick={()=>{inheritMasterDefaultRef.current=false;setRecordsLimit(limit);}} className="rounded-lg border px-2 py-1.5 text-center text-[10px] font-black" style={recordsLimit===limit?{background:'#AEB0B3',borderColor:'#979a9d',color:'#111827'}:{background:'#fff',borderColor:'#cbd5e1',color:'#334155'}}>{limit==='all'?'Todos':limit}</button>)}</div></div><div className="border-t border-slate-200 pt-2.5"><span className="text-[10px] font-black uppercase tracking-wider text-slate-700">Filtro de período</span><div className="mt-1.5 grid grid-cols-2 gap-2"><label><span className="text-[9px] font-bold text-slate-500">Data inicial</span><input type="date" value={startDate||''} onChange={e=>{inheritMasterDefaultRef.current=false;setStartDate?.(e.target.value);}} className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1 text-[11px] font-bold text-slate-800 outline-none"/></label><label><span className="text-[9px] font-bold text-slate-500">Data final</span><input type="date" value={endDate||''} onChange={e=>{inheritMasterDefaultRef.current=false;setEndDate?.(e.target.value);}} className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1 text-[11px] font-bold text-slate-800 outline-none"/></label></div>{(startDate||endDate)&&<button type="button" onClick={()=>{inheritMasterDefaultRef.current=false;setStartDate?.('');setEndDate?.('');}} className="mt-1 text-[9.5px] font-extrabold text-rose-700">Limpar datas</button>}</div>{canManageColumns&&<button type="button" onClick={()=>setColumnMode(true)} className="flex w-full items-center justify-between rounded-lg border border-slate-300 bg-[#f0f0f0] px-3 py-2 text-[10px] font-black uppercase tracking-wide text-slate-800 hover:bg-slate-200"><span className="flex items-center gap-2"><Columns3 className="h-3.5 w-3.5"/>Colunas e ordem</span><span>{isMaster?'Master':'Minha visualização'}</span></button>}</div><div className="mt-3 flex items-center justify-between border-t border-slate-200 pt-2"><span className="text-[9px] text-slate-400">ESC para fechar</span><button type="button" onClick={()=>setIsOpen(false)} className="rounded-lg border border-slate-300 bg-[#f0f0f0] px-3 py-1.5 text-[10px] font-extrabold uppercase text-slate-800">Concluir</button></div></>}</div>,document.body)}</div>;
};
