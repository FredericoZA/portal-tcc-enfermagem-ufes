import React,{useEffect,useRef,useState} from 'react';
import {openDriveDocument} from '../utils/driveDocumentAccess';
import {ProcessDocumentActions} from './ProcessDocumentCard';
import {apiClient} from '../services/apiClient';
import {portalNotice} from '../services/portalDialogs';
/** Buttons are mounted only for publication-authorized catalog URLs. Server rechecks consent. */
export function PublicRepositoryFileActions({url}:{url:string}){
 const [working,setWorking]=useState(false);
 const currentUrl=useRef(url);currentUrl.current=url;
 useEffect(()=>{currentUrl.current=url;return()=>{currentUrl.current='';};},[url]);
 const open=async(mode:'view'|'download')=>{
  if(mode==='view'){
   setWorking(true);
   try{await openDriveDocument(()=>apiClient.getPublicRepositoryDriveLinks(url),()=>currentUrl.current===url);}
   catch(error){if(currentUrl.current===url)portalNotice(error instanceof Error?error.message:'Não foi possível abrir o arquivo no Google Drive.');}
   finally{if(currentUrl.current===url)setWorking(false);}
   return;
  }
  const tab=window.open('about:blank','_blank');if(tab)tab.opener=null;
  setWorking(true);
  try{
   const {links}=await apiClient.getPublicRepositoryDriveLinks(url);
   if(!links){if(tab)tab.location.replace(url);return;}
   if(tab)tab.location.replace(links.download);
   else portalNotice('Permita a abertura de uma nova aba para acessar o PDF.');
  }catch(error){tab?.close();portalNotice(error instanceof Error?error.message:'Não foi possível abrir o PDF público.');}
  finally{setWorking(false);}
 };
 return <ProcessDocumentActions available working={working} onView={()=>void open('view')} onDownload={()=>void open('download')}/>;
}
