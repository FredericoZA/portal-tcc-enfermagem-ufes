import React, {lazy, Suspense, useEffect, useState} from 'react';
import {FileCheck} from 'lucide-react';
import {ProcessDocumentCard, ProcessDocumentsPanel, ReservationReceiptCard} from './ProcessDocumentCard';
import {apiClient} from '../services/apiClient';
import type {LegacyAdministrativeFileView} from '../types/legacyArchive';
import {PortalModalShell} from './PortalModalShell';

const Preview=lazy(()=>import('./DocumentFilePreview').then(module=>({default:module.DocumentFilePreview})));
const groups: {kind:LegacyAdministrativeFileView['kind'];label:string}[]=[
  {kind:'CONVITE',label:'Carta-Convite da Banca'},
  {kind:'ATA',label:'Ata'},
  {kind:'TERMO',label:'Termo de Autorização e Publicação'},
  {kind:'DECLARACAO',label:'Declaração de Participação na Banca'},
  {kind:'AVALIACAO',label:'Instrumento de avaliação'},
];

/** Existing administrative tab, with original historical files and no live signature actions. */
export function LegacyAdministrativeDocuments({processId, canAccessOriginals = false}:{processId:string; canAccessOriginals?:boolean}) {
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
  return <>
    <ProcessDocumentsPanel count={groups.length+1} columns={6} notices={<>
      {loading&&<p role="status" className="text-xs">Consultando documentos…</p>}
      {error&&<p role="alert" className="portal-instruction p-3 text-xs">{error}</p>}
    </>}>
      <ReservationReceiptCard historical/>
      {groups.map(group=>{
        const documents=canAccessOriginals?files.filter(file=>file.kind===group.kind):[];
        const file=documents.find(item=>item.index===selected[group.kind])||documents[0];
        return <ProcessDocumentCard key={group.kind} title={group.label}
          signerLabel="Arquivo" signerNote={!canAccessOriginals?'Consulta restrita':file?'Original importado':loading?'Consultando acervo':'Não localizado'}
          status={!canAccessOriginals?'Acesso restrito':loading?'Consultando…':file?'Disponível':'Não disponível'}
          statusDescription={!canAccessOriginals?'A consulta aos originais históricos exige uma conta autorizada.':!loading&&!file?'Não localizado no acervo importado.':undefined}
          tone={file?'available':'pending'} available={Boolean(file)&&!loading} working={downloading!==null}
          onView={()=>file&&setPreview(file)} onDownload={()=>file&&void download(file)}>
          {documents.length>1&&<label className="text-xs">Arquivo
            <select className="portal-input mt-1 w-full" value={file.index} onChange={event=>setSelected(current=>({...current,[group.kind]:Number(event.target.value)}))}>
              {documents.map(item=><option key={item.index} value={item.index}>{item.fileName}</option>)}
            </select>
          </label>}
        </ProcessDocumentCard>;
      })}
    </ProcessDocumentsPanel>
    <PortalModalShell open={canAccessOriginals&&preview!==null} onClose={()=>setPreview(null)} title="Visualizar documento" icon={FileCheck} maxWidthClass="max-w-5xl" bodyClassName="p-3 overflow-auto" footer={<button type="button" className="portal-action" onClick={()=>setPreview(null)}>Fechar</button>}>
      {preview&&<Suspense fallback={<p role="status">Carregando documento…</p>}><Preview url={preview.downloadUrl} format="pdf" label={preview.fileName}/></Suspense>}
    </PortalModalShell>
  </>;
}
