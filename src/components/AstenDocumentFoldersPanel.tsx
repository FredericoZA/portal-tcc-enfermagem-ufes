import {useEffect,useRef,useState} from 'react';
import {FolderOpen,Loader2,RefreshCw} from 'lucide-react';
import {apiClient} from '../services/apiClient';
import type {AstenDocumentFoldersStatus,AstenDocumentFolderType} from '../types/signatures';

const types:Array<{type:AstenDocumentFolderType;label:string}>=[{type:'ATA',label:'Ata de defesa'},{type:'TERMO',label:'Termo de autorização de publicação'},{type:'DECLARACAO',label:'Declaração de banca'}];
const control='min-h-8 w-full rounded-lg border border-slate-300 bg-white px-2 text-[10px] text-slate-800 disabled:opacity-50';

export function AstenDocumentFoldersPanel({onConfigured}:{onConfigured:(configured:boolean)=>void}){
  const [status,setStatus]=useState<AstenDocumentFoldersStatus|null>(null);
  const [mapping,setMapping]=useState<Partial<Record<AstenDocumentFolderType,number>>>({});
  const [working,setWorking]=useState(false);
  const [message,setMessage]=useState('');
  const active=useRef(true);
  const locked=useRef(false);
  const callback=useRef(onConfigured);callback.current=onConfigured;

  const accept=(result:AstenDocumentFoldersStatus)=>{
    setStatus(result);setMapping(result.mapping);callback.current(result.configured);
    setMessage(result.configured?'Destinos salvos. Novos envelopes serão organizados por documento.':result.issues.join(' '));
  };
  const load=async()=>{
    if(locked.current)return;
    locked.current=true;setWorking(true);setMessage('');
    try{const result=await apiClient.getAstenDocumentFolders();if(active.current)accept(result);}
    catch(error){if(active.current){setStatus(null);callback.current(false);setMessage(error instanceof Error?error.message:'Não foi possível consultar as pastas.');}}
    finally{locked.current=false;if(active.current)setWorking(false);}
  };
  useEffect(()=>{active.current=true;void load();return()=>{active.current=false;};},[]);
  const save=async()=>{
    if(locked.current)return;
    if(types.some(({type})=>!mapping[type])){setMessage('Selecione uma pasta para cada documento.');return;}
    locked.current=true;setWorking(true);setMessage('');
    try{const result=await apiClient.saveAstenDocumentFolders(mapping as Record<AstenDocumentFolderType,number>);if(active.current)accept(result);}
    catch(error){if(active.current)setMessage(error instanceof Error?error.message:'Não foi possível salvar os destinos.');}
    finally{locked.current=false;if(active.current)setWorking(false);}
  };
  return <section className="mt-3 border-t border-slate-300 pt-3" aria-labelledby="asten-document-folders-title">
    <div className="mb-2 flex items-center justify-between gap-2">
      <h5 id="asten-document-folders-title" className="flex items-center gap-1 text-[10px] font-bold text-slate-900"><FolderOpen className="h-3.5 w-3.5"/>Pastas dos documentos na Asten</h5>
      <button type="button" onClick={()=>void load()} disabled={working} aria-label="Atualizar pastas da Asten" className="rounded-full border border-slate-300 bg-white p-1.5 disabled:opacity-50">{working?<Loader2 className="h-3.5 w-3.5 animate-spin"/>:<RefreshCw className="h-3.5 w-3.5"/>}</button>
    </div>
    <div className="grid gap-2">
      {types.map(({type,label})=><label key={type} className="grid gap-1 text-[10px] font-semibold text-slate-800">{label}<select className={control} value={mapping[type]||''} disabled={working||!status?.folders.length} onChange={event=>setMapping(current=>({...current,[type]:Number(event.target.value)||undefined}))}><option value="">Selecionar pasta</option>{status?.folders.map(folder=><option key={folder.id} value={folder.id}>{folder.name}</option>)}</select></label>)}
      <button type="button" onClick={()=>void save()} disabled={working||!status?.folders.length||types.some(({type})=>!mapping[type])} className="min-h-8 rounded-full bg-[var(--portal-brand-header)] px-3 text-[10px] font-bold text-white disabled:opacity-40">Salvar pastas</button>
    </div>
    {message&&<p role="status" className="mt-2 text-[10px] leading-4 text-slate-700">{message}</p>}
  </section>;
}
