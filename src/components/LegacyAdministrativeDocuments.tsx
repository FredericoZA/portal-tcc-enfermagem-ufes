import React, {lazy, Suspense, useEffect, useState} from 'react';
import {FileCheck} from 'lucide-react';
import {ProcessDocumentCard, ProcessDocumentsPanel} from './ProcessDocumentCard';
import {apiClient} from '../services/apiClient';
import type {ProcessDocument} from '../types';
import type {LegacyAdministrativeFileView} from '../types/legacyArchive';
import {PortalModalShell} from './PortalModalShell';

const Preview=lazy(()=>import('./DocumentFilePreview').then(module=>({default:module.DocumentFilePreview})));
const groups: {kind:LegacyAdministrativeFileView['kind'];label:string}[]=[
  {kind:'CONVITE',label:'Carta-Convite da Banca'},
  {kind:'AVALIACAO',label:'Instrumento de avaliação'},
  {kind:'ATA',label:'Ata'},
  {kind:'TERMO',label:'Termo de Autorização e Publicação'},
  {kind:'DECLARACAO',label:'Declaração de Participação na Banca'},
];

/** Existing administrative tab, with original historical files and no live signature actions. */
export function LegacyAdministrativeDocuments({processId, canAccessOriginals = false,publicDocuments=[]}:{processId:string; canAccessOriginals?:boolean;publicDocuments?:ProcessDocument[]}) {
  const [files,setFiles]=useState<LegacyAdministrativeFileView[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const [downloading,setDownloading]=useState<number|null>(null);
  const [selected,setSelected]=useState<Record<string,number>>({});
  const [preview,setPreview]=useState<LegacyAdministrativeFileView|null>(null);
  useEffect(()=>{
    let active=true;
    setLoading(true);setFiles([]);setError('');setPreview(null);setSelected({});
    if (!canAccessOriginals) {
      setLoading(false);
      return () => { active = false; };
    }
    void apiClient.getLegacyAdministrativeDocuments(processId)
      .then(data=>{if(active)setFiles(data);})
      .catch(()=>{if(active)setError('Não foi possível consultar os documentos. Reabra esta aba para tentar novamente.');})
      .finally(()=>{if(active)setLoading(false);});
    return()=>{active=false;};
  },[processId,canAccessOriginals]);
  async function download(file:LegacyAdministrativeFileView) {
    setDownloading(file.index);setError('');
    try {
      const result=await apiClient.downloadLegacyAdministrativeDocument(processId,file.index);
      const url=URL.createObjectURL(result.blob),anchor=document.createElement('a');
      anchor.href=url;anchor.download=result.fileName;anchor.click();
      window.setTimeout(()=>URL.revokeObjectURL(url),30000);
    }catch{setError('Não foi possível conferir e baixar o documento. O original permanece preservado.');}
    finally{setDownloading(null);}
  }
  const publicPath=(file:LegacyAdministrativeFileView)=>file.downloadUrl.startsWith('/api/public/legacy-academic-records/');
  async function open(file:LegacyAdministrativeFileView,mode:'view'|'download'){
    if(!publicPath(file)){if(mode==='view')setPreview(file);else await download(file);return;}
    const tab=window.open('about:blank','_blank');if(tab)tab.opener=null;
    setDownloading(file.index);setError('');
    try{
      const {links}=await apiClient.getPublicDocumentDriveLinks(file.downloadUrl);
      if(links){if(tab)tab.location.replace(mode==='view'?links.view:links.download);else setError('Permita a abertura de uma nova aba para acessar o PDF.');}
      else if(mode==='view'){tab?.close();setPreview(file);}else if(tab)tab.location.replace(file.downloadUrl);
    }catch{tab?.close();setError('Não foi possível confirmar a consulta pública deste documento.');}
    finally{setDownloading(null);}
  }
  const visibleGroups=groups.filter(group=>group.kind!=='CONVITE'||
    canAccessOriginals&&files.some(file=>file.kind==='CONVITE'));
  return <>
    <ProcessDocumentsPanel count={visibleGroups.length} notices={<>
      {loading&&<p role="status" className="text-xs">Consultando documentos…</p>}
      {error&&<p role="alert" className="portal-instruction p-3 text-xs">{error}</p>}
    </>}>
      {visibleGroups.map(group=>{
        const published=publicDocuments.filter(doc=>['ATA','TERMO','DECLARACAO'].includes(group.kind)&&doc.type===group.kind&&doc.driveDownloadUrl&&['ASSINADO','DISPONIVEL'].includes(doc.status)).map(doc=>({kind:group.kind,index:Number(doc.id.replace('legacy-document-','')),fileName:doc.title||group.label,downloadUrl:doc.driveDownloadUrl!}));
        const documents=published.length?published:canAccessOriginals?files.filter(file=>file.kind===group.kind):[];
        const restricted=group.kind==='AVALIACAO'&&!canAccessOriginals;
        const pending=loading&&canAccessOriginals&&!published.length;
        const file=documents.find(item=>item.index===selected[group.kind])||documents[0];
        return <ProcessDocumentCard key={group.kind} title={group.label}
          signerLabel="Arquivo" signerNote={restricted?'Consulta restrita':file?'Original importado':pending?'Consultando acervo':'Não localizado'}
          status={restricted?'Acesso restrito':pending?'Consultando…':file?'Disponível':'Não disponível'}
          statusDescription={restricted?'O instrumento de avaliação exige acesso autorizado.':!pending&&!file?'Não localizado no acervo importado.':undefined}
          tone={file?'available':'pending'} available={Boolean(file)&&!pending} working={downloading!==null}
          onView={()=>file&&void open(file,'view')} onDownload={()=>file&&void open(file,'download')}>
          {documents.length>1&&<label className="text-xs">Arquivo
            <select className="portal-input mt-1 w-full" value={file.index} onChange={event=>setSelected(current=>({...current,[group.kind]:Number(event.target.value)}))}>
              {documents.map(item=><option key={item.index} value={item.index}>{item.fileName}</option>)}
            </select>
          </label>}
        </ProcessDocumentCard>;
      })}
    </ProcessDocumentsPanel>
    <PortalModalShell open={preview!==null&&(canAccessOriginals||publicPath(preview))} onClose={()=>setPreview(null)} title="Visualizar documento" icon={FileCheck} maxWidthClass="max-w-5xl" bodyClassName="p-3 overflow-auto" footer={<button type="button" className="portal-action" onClick={()=>setPreview(null)}>Fechar</button>}>
      {preview&&<Suspense fallback={<p role="status">Carregando documento…</p>}><Preview url={preview.downloadUrl} format="pdf" label={preview.fileName}/></Suspense>}
    </PortalModalShell>
  </>;
}
