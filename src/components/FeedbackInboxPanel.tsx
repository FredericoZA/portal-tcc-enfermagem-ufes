import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {CheckCheck, Eye, Image, Lightbulb, RefreshCw} from 'lucide-react';
import {useAuth} from '../context/AuthContext';
import {apiClient} from '../services/apiClient';
import type {FeedbackEntry} from '../types/feedback';
import {SearchPopover} from './SearchPopover';
import {HeaderSettingsPopover} from './HeaderSettingsPopover';
import {SettingsWorkspaceHeaderPortal} from './SettingsWorkspaceModal';
import {TableScrollWrapper} from './TableScrollWrapper';
import {loadTableConfig, type ColumnDef} from './TableColumnSelectorPanel';
import {loadGlobalTableConfig, type TableTextFormat} from '../utils/tableFormatters';
import {PortalModalShell} from './PortalModalShell';

const COLUMNS: ColumnDef[] = [
  {key:'created_at',label:'Recebida em',isFixed:true},
  {key:'id',label:'Referência'},
  {key:'description',label:'Sugestão'},
  {key:'image',label:'Imagem'},
  {key:'status',label:'Situação'},
  {key:'reviewed_at',label:'Revisada em'},
  {key:'reviewed_by',label:'Responsável'},
  {key:'actions',label:'Ações'},
];
const ORDER=COLUMNS.map(column=>column.key);
const VISIBLE=Object.fromEntries(ORDER.map(key=>[key,true]));
const dateText=(value:string|null)=>value&&Number.isFinite(Date.parse(value))?new Date(value).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo',dateStyle:'short',timeStyle:'short'}):'—';
const searchable=(value:string)=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR');

/** The existing feedback store, presented in the same administrative sheet as logs. */
export function FeedbackInboxPanel({embedded=false}:{embedded?:boolean}) {
  const {isMasterAdmin,userEmail}=useAuth();
  const [initial]=useState(()=>loadTableConfig('feedback_inbox',ORDER,VISIBLE,25));
  const [rows,setRows]=useState<FeedbackEntry[]>([]);
  const [loading,setLoading]=useState(true);
  const [loadingMore,setLoadingMore]=useState(false);
  const [nextCursor,setNextCursor]=useState<string|null>(null);
  const [error,setError]=useState('');
  const [search,setSearch]=useState('');
  const [status,setStatus]=useState<'ALL'|'NEW'|'REVIEWED'>('ALL');
  const [recordsLimit,setRecordsLimit]=useState<number|'all'>(initial.recordsLimit||25);
  const [startDate,setStartDate]=useState(initial.startDate||'');
  const [endDate,setEndDate]=useState(initial.endDate||'');
  const [columnOrder,setColumnOrder]=useState(initial.columnOrder||ORDER);
  const [visibleColumns,setVisibleColumns]=useState<Record<string,boolean>>(initial.visibleColumns||VISIBLE);
  const [textFormat]=useState<TableTextFormat>(()=>({...loadGlobalTableConfig(),...(initial.textFormat||{})}));
  const [selected,setSelected]=useState<FeedbackEntry|null>(null);
  const [reviewingId,setReviewingId]=useState('');
  const [imageUrl,setImageUrl]=useState('');
  const [imageError,setImageError]=useState('');
  const revision=useRef(0);

  const load=useCallback(async(cursor?:string)=>{
    if(!isMasterAdmin)return;
    const current=revision.current;
    if(cursor)setLoadingMore(true);else setLoading(true);
    setError('');
    try {
      const page=await apiClient.getFeedbackPageForAdmin(cursor);
      if(current!==revision.current)return;
      setRows(previous=>cursor?[...new Map([...previous,...page.items].map(item=>[item.id,item])).values()]:page.items);
      setNextCursor(page.nextCursor);
    }catch {if(current===revision.current)setError('Não foi possível carregar as sugestões. Tente atualizar a lista.');}
    finally {if(current===revision.current){setLoading(false);setLoadingMore(false);}}
  },[isMasterAdmin,userEmail]);

  useEffect(()=>{
    revision.current+=1;
    setRows([]);setSelected(null);setNextCursor(null);
    if(isMasterAdmin)void load();
    return()=>{revision.current+=1;};
  },[isMasterAdmin,load]);

  useEffect(()=>{
    setImageUrl('');setImageError('');
    if(!isMasterAdmin||!selected?.image_mime)return;
    let active=true,url='';
    void apiClient.getFeedbackImage(selected.id).then(result=>{
      if(!active)return;
      url=URL.createObjectURL(result.blob);setImageUrl(url);
    }).catch(()=>{if(active)setImageError('Não foi possível carregar a imagem. Feche e abra os detalhes para tentar novamente.');});
    return()=>{active=false;if(url)URL.revokeObjectURL(url);};
  },[isMasterAdmin,userEmail,selected?.id,selected?.image_mime]);

  async function review(item:FeedbackEntry) {
    if(reviewingId||!isMasterAdmin||item.status!=='NEW')return;
    const current=revision.current;setReviewingId(item.id);setError('');
    try {
      const result=await apiClient.markFeedbackReviewed(item.id);
      if(current!==revision.current)return;
      if(!result.reviewed||!result.record)throw new Error('Confirmação ausente.');
      setRows(previous=>previous.map(row=>row.id===item.id?result.record:row));
      setSelected(previous=>previous?.id===item.id?result.record:previous);
    }catch {if(current===revision.current)setError('Não foi possível confirmar a revisão. Atualize a lista antes de tentar novamente.');}
    finally {if(current===revision.current)setReviewingId('');}
  }

  const filtered=useMemo(()=>{
    const term=searchable(search.trim());
    const start=startDate?Date.parse(`${startDate}T00:00:00-03:00`):0;
    const end=endDate?Date.parse(`${endDate}T23:59:59.999-03:00`):Infinity;
    return rows.filter(item=>{
      const time=Date.parse(item.created_at);
      return (status==='ALL'||item.status===status)&&time>=start&&time<=end&&(!term||searchable([item.id,item.description,item.reviewed_by||'',item.status==='NEW'?'Nova':'Revisada'].join(' ')).includes(term));
    });
  },[rows,search,status,startDate,endDate]);
  const columns=columnOrder.filter(key=>visibleColumns[key]!==false);

  if(!isMasterAdmin)return <p className="portal-instruction p-4 text-sm">Sugestões disponíveis somente para o usuário Master.</p>;

  const toolbar=<>
    <select aria-label="Filtrar sugestões por situação" value={status} onChange={event=>setStatus(event.target.value as typeof status)} className="portal-input max-w-40 text-xs">
      <option value="ALL">Todas</option><option value="NEW">Novas</option><option value="REVIEWED">Revisadas</option>
    </select>
    <button type="button" className="portal-toolbar-icon-button" disabled={loading||loadingMore||Boolean(reviewingId)} onClick={()=>void load()} title="Atualizar sugestões" aria-label="Atualizar sugestões"><RefreshCw className="h-3.5 w-3.5"/></button>
    <span className="portal-toolbar-group-divider" role="separator" aria-orientation="vertical"/>
    <SearchPopover value={search} onChange={setSearch} placeholder="Descrição, referência ou responsável" textFormat={textFormat}/>
    <HeaderSettingsPopover recordsLimit={recordsLimit} setRecordsLimit={setRecordsLimit} allowedLimits={[25,50,100,'all']} startDate={startDate} setStartDate={setStartDate} endDate={endDate} setEndDate={setEndDate} allColumns={COLUMNS} visibleColumns={visibleColumns} setVisibleColumns={setVisibleColumns} columnOrder={columnOrder} setColumnOrder={setColumnOrder} storageKey="feedback_inbox" defaultColumnOrder={ORDER} defaultVisibleColumns={VISIBLE} defaultRecordsLimit={25} defaultTableTitle="Sugestões"/>
  </>;
  function statusBadge(item:FeedbackEntry) {
    return <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-bold ${item.status==='NEW'?'border-amber-300 bg-amber-50 text-amber-900':'border-slate-300 bg-slate-100 text-slate-700'}`}>{item.status==='NEW'?'Nova':'Revisada'}</span>;
  }
  function cell(item:FeedbackEntry,key:string):React.ReactNode {
    switch(key){
      case 'created_at':case 'reviewed_at':return <span className="whitespace-nowrap">{dateText(item[key])}</span>;
      case 'id':return <span title={item.id} className="font-mono text-[10px]">{item.id.slice(0,8)}</span>;
      case 'description':return <button type="button" onClick={()=>setSelected(item)} className="max-w-96 cursor-pointer rounded px-1 text-left hover:underline" aria-label={`Ver sugestão ${item.id.slice(0,8)}`}><span className="line-clamp-2 break-words">{item.description}</span></button>;
      case 'image':return item.image_mime?<button type="button" onClick={()=>setSelected(item)} className="portal-action" aria-label={`Ver imagem da sugestão ${item.id.slice(0,8)}`}><Image className="h-3.5 w-3.5"/><span>Ver imagem</span></button>:'—';
      case 'status':return statusBadge(item);
      case 'reviewed_by':return <span className="break-all">{item.reviewed_by||'—'}</span>;
      default:return <div className="flex justify-center gap-1.5 whitespace-nowrap"><button type="button" className="portal-action" onClick={()=>setSelected(item)}><Eye className="h-3.5 w-3.5"/>Detalhes</button>{item.status==='NEW'&&<button type="button" className="portal-action" disabled={Boolean(reviewingId)} onClick={()=>void review(item)}><CheckCheck className="h-3.5 w-3.5"/>{reviewingId===item.id?'Salvando…':'Marcar revisada'}</button>}</div>;
    }
  }
  return <div id="feedback-inbox-panel" data-settings-sheet="true" data-embedded={embedded?'true':'false'} className="flex min-h-0 flex-1 flex-col" style={{backgroundColor:'var(--portal-surface-panel)'}}>
    {embedded?<SettingsWorkspaceHeaderPortal>{toolbar}</SettingsWorkspaceHeaderPortal>:<header className="portal-modal-header flex flex-wrap justify-between gap-3"><h2 className="flex items-center gap-2 text-sm font-bold"><Lightbulb className="h-4 w-4"/>Sugestões</h2><div className="flex flex-wrap items-center gap-1.5">{toolbar}</div></header>}
    {error&&<p role="alert" className="portal-instruction m-3 p-3 text-xs">{error}</p>}
    <TableScrollWrapper fillHeight>
      <table className="portal-spreadsheet-table w-full min-w-[1180px] border-collapse text-center text-xs">
        <caption className="sr-only">Sugestões recebidas e histórico de revisão. Horários de Brasília.</caption>
        <thead><tr>{columns.map(key=><th key={key} scope="col" data-portal-column-key={key} className="px-3 py-1.5 text-[10px] font-black">{COLUMNS.find(column=>column.key===key)?.label||key}</th>)}</tr></thead>
        <tbody>{(loading||filtered.length===0)&&<tr><td colSpan={columns.length} className="portal-sheet-empty-cell" role="status">{loading?'Carregando sugestões…':error?'Lista indisponível.':'Nenhuma sugestão encontrada.'}</td></tr>}{!loading&&filtered.map(item=><tr key={item.id}>{columns.map(key=><td key={key} className="px-3 py-1 text-slate-950">{cell(item,key)}</td>)}</tr>)}</tbody>
      </table>
    </TableScrollWrapper>
    {nextCursor&&<div className="flex justify-center border-t border-slate-300 p-2"><button type="button" className="portal-action" disabled={loadingMore||loading} onClick={()=>void load(nextCursor)}>{loadingMore?'Carregando…':'Carregar sugestões anteriores'}</button></div>}
    <PortalModalShell open={selected!==null} onClose={()=>setSelected(null)} title="Detalhes da sugestão" icon={Lightbulb} maxWidthClass="max-w-3xl" heightClass="max-h-[90vh]" bodyClassName="overflow-auto p-4" footer={<div className="flex justify-end gap-2">{selected?.status==='NEW'&&<button type="button" className="portal-action" disabled={Boolean(reviewingId)} onClick={()=>void review(selected)}><CheckCheck className="h-4 w-4"/>{reviewingId===selected.id?'Salvando…':'Marcar como revisada'}</button>}<button type="button" className="portal-action" onClick={()=>setSelected(null)}>Fechar</button></div>}>
      {selected&&<div data-portal-preview-dialog="true" className="space-y-4">
        <dl className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-2"><div><dt className="font-bold">Referência</dt><dd className="break-all font-mono">{selected.id}</dd></div><div><dt className="font-bold">Recebida em</dt><dd>{dateText(selected.created_at)} (Brasília)</dd></div><div><dt className="font-bold">Situação</dt><dd>{statusBadge(selected)}</dd></div>{selected.status==='REVIEWED'&&<div><dt className="font-bold">Revisão registrada</dt><dd>{dateText(selected.reviewed_at)}<br/>{selected.reviewed_by||'Responsável não informado'}</dd></div>}</dl>
        <section><h3 className="mb-2 text-xs font-bold">Sugestão</h3><p className="whitespace-pre-wrap break-words text-sm leading-5">{selected.description}</p></section>
        {selected.image_mime&&<section><h3 className="mb-2 text-xs font-bold">Imagem anexada</h3>{imageUrl?<img src={imageUrl} alt="Imagem anexada à sugestão" className="max-h-[50vh] max-w-full rounded-lg border border-slate-300 object-contain"/>:<p role={imageError?'alert':'status'} className="text-xs">{imageError||'Carregando imagem…'}</p>}</section>}
      </div>}
    </PortalModalShell>
  </div>;
}
