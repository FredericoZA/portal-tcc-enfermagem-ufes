import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Columns3, ListFilter, Settings } from 'lucide-react';
import { DEFAULT_TABLE_TEXT_FORMAT, TableTextFormat } from './TableColumnSelectorPanel';
import { PortalColumnPreferencesPanel } from './PortalColumnPreferencesPanel';
import { getTableStyles } from '../utils/tableFormatters';
import { useAuth } from '../context/AuthContext';

export interface HeaderSettingsPopoverProps {
  recordsLimit:number|'all'; setRecordsLimit:(limit:number|'all')=>void; allowedLimits?:(number|'all')[];
  allColumns?:{key:string;label:string;isFixed?:boolean}[]; visibleColumns?:Record<string,boolean>; setVisibleColumns?:(visible:Record<string,boolean>|((prev:Record<string,boolean>)=>Record<string,boolean>))=>void;
  columnOrder?:string[]; setColumnOrder?:(order:string[])=>void; storageKey?:string; customLabels?:Record<string,string>; setCustomLabels?:React.Dispatch<React.SetStateAction<Record<string,string>>>;
  columnWidths?:Record<string,string|number>; setColumnWidths?:React.Dispatch<React.SetStateAction<Record<string,string|number>>>; textFormat?:TableTextFormat; setTextFormat?:React.Dispatch<React.SetStateAction<TableTextFormat>>;
  defaultColumnOrder?:string[]; defaultVisibleColumns?:Record<string,boolean>; defaultRecordsLimit?:number|'all'; startDate?:string; setStartDate?:(val:string)=>void; endDate?:string; setEndDate?:(val:string)=>void; defaultTableTitle?:string; defaultFilterTitle?:string;
}

async function loadPreference(storageKey:string){
  const response=await fetch(`/api/table-preferences?table=${encodeURIComponent(storageKey)}`,{credentials:'include',headers:{Accept:'application/json'}});
  if(!response.ok)throw new Error('Preferências remotas indisponíveis.');
  return response.json();
}
async function patchPreference(storageKey:string,config:Record<string,unknown>){
  const response=await fetch(`/api/table-preferences?table=${encodeURIComponent(storageKey)}`,{method:'PATCH',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({tableKey:storageKey,scope:'USER',config})});
  if(!response.ok)throw new Error('Não foi possível salvar a preferência.');
}

export const HeaderSettingsPopover:React.FC<HeaderSettingsPopoverProps> = (props) => {
  const {recordsLimit,setRecordsLimit,allowedLimits=[25,50,100,'all'],textFormat=DEFAULT_TABLE_TEXT_FORMAT,defaultRecordsLimit=25,startDate,setStartDate,endDate,setEndDate,allColumns,visibleColumns,setVisibleColumns,columnOrder,setColumnOrder,storageKey,defaultColumnOrder,defaultVisibleColumns,defaultTableTitle}=props;
  const {isAuthenticated,userEmail}=useAuth();
  const canManageColumns=Boolean(isAuthenticated&&storageKey&&allColumns?.length&&visibleColumns&&setVisibleColumns&&columnOrder&&setColumnOrder);
  const [isOpen,setIsOpen]=useState(false); const [columnMode,setColumnMode]=useState(false); const styles=getTableStyles(textFormat);
  const gearButtonRef=useRef<HTMLButtonElement>(null); const popupRef=useRef<HTMLDivElement>(null); const [popoverPos,setPopoverPos]=useState({top:0,left:0});
  const hasActiveFilters=Boolean((startDate&&startDate.trim())||(endDate&&endDate.trim())||(defaultRecordsLimit&&recordsLimit!==defaultRecordsLimit));

  useEffect(()=>{
    if(!isAuthenticated||!storageKey)return;
    let cancelled=false;
    void loadPreference(storageKey).then((result)=>{
      if(cancelled)return;
      const effective=result?.effectiveConfig&&typeof result.effectiveConfig==='object'?result.effectiveConfig:{};
      if(effective.recordsLimit==='all'||typeof effective.recordsLimit==='number')setRecordsLimit(effective.recordsLimit);
      if(typeof effective.startDate==='string')setStartDate?.(effective.startDate);
      if(typeof effective.endDate==='string')setEndDate?.(effective.endDate);
      if(Array.isArray(effective.columnOrder)&&setColumnOrder)setColumnOrder(effective.columnOrder);
      if(effective.visibleColumns&&typeof effective.visibleColumns==='object'&&setVisibleColumns)setVisibleColumns((prev)=>({...prev,...effective.visibleColumns}));
    }).catch(()=>{/* fallback local/publicado permanece válido */});
    return()=>{cancelled=true;};
  },[isAuthenticated,userEmail,storageKey]);

  const persist=(config:Record<string,unknown>)=>{if(!isAuthenticated||!storageKey)return;void patchPreference(storageKey,config).catch(()=>{/* UI continua funcional; próxima abertura tentará novamente */});};
  const handleToggle=()=>{if(isOpen){setIsOpen(false);setColumnMode(false);return;}if(gearButtonRef.current){const rect=gearButtonRef.current.getBoundingClientRect();const popupWidth=Math.min(canManageColumns?430:320,window.innerWidth-32);let left=Math.min(rect.right-popupWidth,window.innerWidth-popupWidth-16);left=Math.max(16,left);let top=rect.bottom+8;if(top+520>window.innerHeight&&rect.top>520)top=Math.max(16,rect.top-520);setPopoverPos({top,left});}setIsOpen(true);};
  useEffect(()=>{if(!isOpen)return;const key=(e:KeyboardEvent)=>{if(e.key==='Escape'){if(columnMode)setColumnMode(false);else setIsOpen(false);}};const outside=(e:MouseEvent)=>{if(popupRef.current&&!popupRef.current.contains(e.target as Node)&&!gearButtonRef.current?.contains(e.target as Node)){setIsOpen(false);setColumnMode(false);}};window.addEventListener('keydown',key);document.addEventListener('mousedown',outside);return()=>{window.removeEventListener('keydown',key);document.removeEventListener('mousedown',outside);};},[isOpen,columnMode]);

  const changeLimit=(limit:number|'all')=>{setRecordsLimit(limit);persist({recordsLimit:limit});};
  const changeStart=(value:string)=>{setStartDate?.(value);persist({startDate:value});};
  const changeEnd=(value:string)=>{setEndDate?.(value);persist({endDate:value});};

  return <div className="inline-flex items-center gap-1.5 shrink-0"><button ref={gearButtonRef} type="button" onClick={handleToggle} className={`${styles.toolbarButtonClass} relative`} style={styles.toolbarButtonStyle} title={canManageColumns?'Exibição da planilha: linhas, período, colunas e ordem':'Exibição da planilha: linhas e período'}><Settings className="h-3.5 w-3.5 text-current"/>{hasActiveFilters&&<span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-white"/>}</button>{isOpen&&createPortal(<div ref={popupRef} className={`fixed z-[1000001] max-h-[calc(100vh-1rem)] overflow-y-auto rounded-xl border border-slate-300 bg-white p-3.5 text-slate-800 shadow-2xl animate-in fade-in zoom-in-95 duration-150 ${columnMode?'w-[min(430px,calc(100vw-2rem))]':'w-72 sm:w-80'}`} style={{top:popoverPos.top,left:popoverPos.left}}>{columnMode&&canManageColumns?<PortalColumnPreferencesPanel storageKey={storageKey!} tabTitle={defaultTableTitle||'Planilha'} allColumns={allColumns!} columnOrder={columnOrder!} setColumnOrder={setColumnOrder!} visibleColumns={visibleColumns!} setVisibleColumns={setVisibleColumns!} defaultColumnOrder={defaultColumnOrder||allColumns!.map(c=>c.key)} defaultVisibleColumns={defaultVisibleColumns||Object.fromEntries(allColumns!.map(c=>[c.key,true]))} onClose={()=>setColumnMode(false)}/>:<><div className="mb-3 flex items-center justify-between border-b border-slate-200 pb-2"><span className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-slate-900"><Settings className="h-3.5 w-3.5 text-slate-600"/>Exibição da planilha</span><button type="button" onClick={()=>setIsOpen(false)} className="rounded-md p-1 text-xs font-bold text-slate-400 hover:text-slate-700">✕</button></div><div className="space-y-3"><div><div className="mb-1.5 flex items-center justify-between"><span className="flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-slate-700"><ListFilter className="h-3 w-3"/>Linhas por página</span><span className="text-[9px] font-bold text-slate-400">Atual: {recordsLimit==='all'?'Todos':recordsLimit}</span></div><div className="grid grid-cols-4 gap-1">{allowedLimits.map(limit=><button key={String(limit)} type="button" onClick={()=>changeLimit(limit)} className="rounded-lg border px-2 py-1.5 text-center text-[10px] font-black" style={recordsLimit===limit?{background:'#AEB0B3',borderColor:'#979a9d',color:'#111827'}:{background:'#fff',borderColor:'#cbd5e1',color:'#334155'}}>{limit==='all'?'Todos':limit}</button>)}</div></div><div className="border-t border-slate-200 pt-2.5"><span className="text-[10px] font-black uppercase tracking-wider text-slate-700">Filtro de período</span><div className="mt-1.5 grid grid-cols-2 gap-2"><label><span className="text-[9px] font-bold text-slate-500">Data inicial</span><input type="date" value={startDate||''} onChange={e=>changeStart(e.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1 text-[11px] font-bold text-slate-800 outline-none"/></label><label><span className="text-[9px] font-bold text-slate-500">Data final</span><input type="date" value={endDate||''} onChange={e=>changeEnd(e.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1 text-[11px] font-bold text-slate-800 outline-none"/></label></div>{(startDate||endDate)&&<button type="button" onClick={()=>{changeStart('');changeEnd('');}} className="mt-1 text-[9.5px] font-extrabold text-[#b42318]">Limpar datas</button>}</div>{canManageColumns&&<button type="button" onClick={()=>setColumnMode(true)} className="flex w-full items-center justify-between rounded-lg border border-slate-300 bg-[#f0f0f0] px-3 py-2 text-[10px] font-black uppercase tracking-wide text-slate-800 hover:bg-slate-200"><span className="flex items-center gap-2"><Columns3 className="h-3.5 w-3.5"/>Colunas e ordem</span><span>Configurar</span></button>}</div><div className="mt-3 flex items-center justify-between border-t border-slate-200 pt-2"><span className="text-[9px] text-slate-400">ESC para fechar</span><button type="button" onClick={()=>setIsOpen(false)} className="rounded-lg border border-slate-300 bg-[#f0f0f0] px-3 py-1.5 text-[10px] font-extrabold uppercase text-slate-800">Concluir</button></div></>}</div>,document.body)}</div>;
};
