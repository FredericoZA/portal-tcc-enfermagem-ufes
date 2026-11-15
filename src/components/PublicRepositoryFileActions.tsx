import React,{lazy,Suspense,useState} from 'react';
import {PortalModalShell} from './PortalModalShell';
const Preview=lazy(()=>import('./DocumentFilePreview').then(m=>({default:m.DocumentFilePreview})));
import {ProcessDocumentActions} from './ProcessDocumentCard';
import {apiClient} from '../services/apiClient';
import {portalNotice} from '../services/portalDialogs';
/** Buttons are mounted only for publication-authorized catalog URLs. Server rechecks consent. */
export function PublicRepositoryFileActions({url}:{url:string}){
 const [working,setWorking]=useState(false);
 const [preview,setPreview]=useState(false);
 const open=async(mode:'view'|'download')=>{
  const tab=window.open('about:blank','_blank');if(tab)tab.opener=null;
  setWorking(true);
  try{
   const {links}=await apiClient.getPublicRepositoryDriveLinks(url);
   if(!links){if(mode==='view'){tab?.close();setPreview(true);}else if(tab)tab.location.replace(url);return;}
   if(tab)tab.location.replace(mode==='view'?links.view:links.download);
   else portalNotice('Permita a abertura de uma nova aba para acessar o PDF.');
  }catch(error){tab?.close();portalNotice(error instanceof Error?error.message:'Não foi possível abrir o PDF público.');}
  finally{setWorking(false);}
 };
 return <><ProcessDocumentActions available working={working} onView={()=>void open('view')} onDownload={()=>void open('download')}/>
 <PortalModalShell open={preview} onClose={()=>setPreview(false)} title="PDF público" maxWidthClass="max-w-5xl" bodyClassName="p-3 overflow-auto" footer={<button type="button" className="portal-action" onClick={()=>setPreview(false)}>Fechar</button>}>
 {preview&&<Suspense fallback={<p role="status">Carregando PDF…</p>}><Preview url={url} format="pdf" label="PDF público"/></Suspense>}
 </PortalModalShell></>;
}
