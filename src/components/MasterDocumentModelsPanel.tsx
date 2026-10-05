import { portalConfirm } from '../services/portalDialogs';
import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, ExternalLink, Eye, FilePlus2, FileUp, Link2, Loader2, ShieldAlert, Sparkles, Trash2 } from 'lucide-react';
import { apiClient } from '../services/apiClient';

const BASE_SLOTS: Array<[string, string]> = [
  ['CONVITE', 'Carta-convite'], ['ATA', 'Ata de defesa'], ['TERMO', 'Termo de autorização para publicação'], ['DECLARACAO', 'Declaração de participação na banca']
];

const normalizeModelKey = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 48);
const humanizeModelKey = (value: string) => value.toLowerCase().split('_').filter(Boolean).map(part => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
const action='inline-flex min-h-8 items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-[9px] font-black uppercase tracking-wide text-slate-800 shadow-sm hover:bg-slate-50 disabled:opacity-40';
const greenAction='inline-flex min-h-8 items-center justify-center gap-1.5 rounded-lg border border-[#2d6c50] bg-[#337959] px-2.5 py-1 text-[9px] font-black uppercase tracking-wide text-white shadow-sm hover:brightness-95 disabled:opacity-40';

export const MasterDocumentModelsPanel: React.FC = () => {
  const [models, setModels] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState('');
  const [message, setMessage] = useState('');
  const [links, setLinks] = useState<Record<string, string>>({});
  const [newModelName, setNewModelName] = useState('');
  const [pendingSlots, setPendingSlots] = useState<Array<[string, string]>>([]);
  const [previewType, setPreviewType] = useState('');
  const [samplePreview, setSamplePreview] = useState<Record<string, string>>({});
  const [samplePreviewLoading, setSamplePreviewLoading] = useState('');
  const linkImportEnabled = Boolean(models.__capabilities?.existingModelLinkImportEnabled);

  const slots = useMemo(() => {
    const persisted: Array<[string, string]> = Object.entries(models).filter(([key, value]) => key !== '__capabilities' && value && typeof value === 'object').map(([key, value]) => [key, String((value as any).label || humanizeModelKey(key))]);
    const merged = [...BASE_SLOTS, ...persisted, ...pendingSlots]; const seen = new Set<string>();
    return merged.filter(([type]) => { if (seen.has(type)) return false; seen.add(type); return true; });
  }, [models, pendingSlots]);

  const load = async () => { setLoading(true); try { setModels(await apiClient.getDocumentModels()); } catch (error) { setMessage(error instanceof Error ? error.message : 'Falha ao carregar os modelos.'); } finally { setLoading(false); } };
  const previewUrl = (driveFileId?: string) => driveFileId ? `https://drive.google.com/file/d/${encodeURIComponent(driveFileId)}/preview` : '';
  const sampleAnswers = {
    ALUNO_NOME: 'Ana Carolina Souza', ALUNOS_NOMES: 'Ana Carolina Souza e Bruno Martins Lima',
    TITULO: 'Segurança do paciente e qualidade da assistência de enfermagem',
    ORIENTADOR_NOME: 'Profa. Dra. Maria Silva', DEFESA_DATA_HORA: '15 de outubro de 2026 às 14h',
    DEFESA_LOCAL: 'Auditório do CCS — UFES', PROTOCOLO: '2026-999'
  };
  const generateSamplePreview = async (type: string) => {
    if (!['CONVITE','ATA','TERMO','DECLARACAO'].includes(type)) { setMessage('A prévia preenchida está disponível para os quatro documentos institucionais do fluxo.'); return; }
    setSamplePreviewLoading(type); setMessage('');
    try {
      const result = await apiClient.previewOfficialModel(type, undefined, sampleAnswers);
      const url = result.downloadUrl || (result.contentBase64 ? `data:application/pdf;base64,${result.contentBase64}` : '');
      if (!url) throw new Error('A prévia foi gerada, mas o PDF não ficou disponível.');
      setSamplePreview(current => ({ ...current, [type]: url }));
      setPreviewType(type);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Não foi possível gerar a prévia preenchida.'); }
    finally { setSamplePreviewLoading(''); }
  };
  useEffect(() => { void load(); }, []);

  const addSlot = () => {
    const label = newModelName.trim(); const type = normalizeModelKey(label);
    if (label.length < 3 || type.length < 2) { setMessage('Informe um nome descritivo para o novo modelo.'); return; }
    if (slots.some(([current]) => current === type)) { setMessage('Já existe um modelo com esse identificador.'); return; }
    setPendingSlots(current => [...current, [type, label]]); setNewModelName(''); setMessage('Novo espaço criado. Envie o DOCX para publicá-lo e versioná-lo no Drive.');
  };

  const upload = async (type: string, file?: File) => {
    if (!file) return;
    if (file.type !== 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || !file.name.toLowerCase().endsWith('.docx')) { setMessage('Envie um arquivo DOCX válido.'); return; }
    if (file.size > 12 * 1024 * 1024) { setMessage('O arquivo ultrapassa o limite de 12 MB.'); return; }
    setWorking(type); setMessage('');
    try { await apiClient.uploadDocumentModelFile(type, file); setPendingSlots(current => current.filter(([slot]) => slot !== type)); setMessage('Modelo cadastrado, versionado e publicado no Google Drive.'); await load(); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Não foi possível cadastrar o modelo.'); }
    finally { setWorking(''); }
  };

  const importLink = async (type: string) => {
    const link = (links[type] || '').trim(); if (!link) { setMessage('Informe o link ou ID do modelo no Google Drive.'); return; }
    setWorking(type); setMessage('');
    try { await apiClient.importDocumentModelFromDrive(type, link); setLinks(current => ({ ...current, [type]: '' })); setPendingSlots(current => current.filter(([slot]) => slot !== type)); setMessage('Modelo copiado, validado e versionado.'); await load(); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Não foi possível importar o modelo.'); }
    finally { setWorking(''); }
  };

  const restore = async (type: string, version: number) => {
    if (!(await portalConfirm(`Restaurar a versão ${version} deste modelo?`))) return;
    setWorking(`${type}-${version}`);
    try { await apiClient.restoreDocumentModelVersion(type, version); await load(); setMessage(`Versão ${version} restaurada como modelo ativo.`); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Não foi possível restaurar a versão.'); }
    finally { setWorking(''); }
  };

  const removeModel = async (type: string, label: string) => {
    const persisted = Boolean(models[type]);
    if (!persisted) { setPendingSlots(current => current.filter(([slot]) => slot !== type)); setLinks(current => { const next = { ...current }; delete next[type]; return next; }); setMessage('Espaço ainda não publicado removido.'); return; }
    if (!(await portalConfirm(`Excluir o modelo “${label}” do catálogo ativo? A exclusão será bloqueada se o fluxo publicado ainda depender dele.`))) return;
    setWorking(`delete-${type}`); setMessage('');
    try { await apiClient.deleteDocumentModel(type); setLinks(current => { const next = { ...current }; delete next[type]; return next; }); setMessage('Modelo removido do catálogo ativo; histórico preservado para auditoria.'); await load(); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Não foi possível excluir o modelo.'); }
    finally { setWorking(''); }
  };

  return <section className="portal-master-models-catalog overflow-hidden rounded-lg border border-slate-300 shadow-sm" style={{ backgroundColor: 'var(--portal-surface-card)' }}>
    <div className="flex flex-wrap items-center justify-end gap-1.5 border-b border-slate-300 p-2" style={{ backgroundColor: 'var(--portal-surface-inner)' }}>
      <input id="new-master-model" value={newModelName} onChange={event=>setNewModelName(event.target.value)} onKeyDown={event=>{if(event.key==='Enter'){event.preventDefault();addSlot();}}} placeholder="Nome do novo documento" className="min-h-8 min-w-[220px] flex-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-[10px] text-slate-900 outline-none sm:max-w-md"/>
      <button type="button" onClick={addSlot} disabled={!newModelName.trim()} className={action}><FilePlus2 className="h-3.5 w-3.5"/>Adicionar documento</button>
    </div>

    {message&&<p role="status" className="m-2 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[10px] font-semibold text-slate-700">{message}</p>}

    <div className="grid gap-1.5 p-1.5 md:grid-cols-2">{slots.map(([type,label])=>{
      const model=models[type]; const hasFile=Boolean(model?.driveFileId); const integrityReady=Boolean(model?.configured&&model?.contentSha256); const deleting=working===`delete-${type}`;
      return <article key={type} className="rounded-lg border border-slate-300 p-2" style={{ backgroundColor: 'var(--portal-surface-inner)' }}>
        <div className="flex items-center justify-between gap-2"><div className="min-w-0"><strong className="block truncate text-[10px] text-slate-900">{model?.label||label}</strong><span className="block truncate text-[8.5px] text-slate-500">{hasFile?`${model.fileName} · v${model.activeVersion||1}`:'Aguardando DOCX'}{model?.variables?.length?` · ${model.variables.length} variáveis`:''}</span></div><div className="flex shrink-0 items-center gap-1">{integrityReady?<CheckCircle2 className="h-4 w-4 text-[#337959]"/>:<ShieldAlert className="h-4 w-4 text-amber-700"/>}<button type="button" onClick={()=>void removeModel(type,String(model?.label||label))} disabled={Boolean(working)} aria-label={`Excluir modelo ${model?.label||label}`} title={`Excluir modelo ${model?.label||label}`} className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-300 bg-white text-[#c62828] disabled:opacity-40">{deleting?<Loader2 className="h-3.5 w-3.5 animate-spin"/>:<Trash2 className="h-3.5 w-3.5"/>}</button></div></div>
        {linkImportEnabled&&<div className="mt-1.5 flex gap-1"><input aria-label={`Link do modelo ${label}`} value={links[type]||''} onChange={event=>setLinks(current=>({...current,[type]:event.target.value}))} placeholder="Link ou ID do Drive" className="min-w-0 flex-1 rounded-md border border-slate-300 bg-white px-2 py-1 text-[9px]"/><button type="button" onClick={()=>void importLink(type)} disabled={Boolean(working)||!(links[type]||'').trim()} className={action}><Link2 className="h-3 w-3"/>Importar</button></div>}
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          <label className={`${greenAction} cursor-pointer`}>{working===type?<Loader2 className="h-3.5 w-3.5 animate-spin"/>:<FileUp className="h-3.5 w-3.5"/>}{hasFile?'Substituir DOCX':'Enviar DOCX'}<input type="file" accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" className="hidden" disabled={Boolean(working)} onChange={event=>{void upload(type,event.target.files?.[0]);event.currentTarget.value='';}}/></label>
          {hasFile&&<button type="button" onClick={()=>{setSamplePreview(current=>{const next={...current};delete next[type];return next;});setPreviewType(current=>current===type?'':type);}} className={action}><Eye className="h-3.5 w-3.5"/>{previewType===type&&!samplePreview[type]?'Fechar visualização':'Visualizar modelo original'}</button>}
          {hasFile&&['CONVITE','ATA','TERMO','DECLARACAO'].includes(type)&&<button type="button" onClick={()=>void generateSamplePreview(type)} disabled={samplePreviewLoading===type} className={greenAction}>{samplePreviewLoading===type?<Loader2 className="h-3.5 w-3.5 animate-spin"/>:<Sparkles className="h-3.5 w-3.5"/>}Prévia preenchida</button>}
          {model?.driveFileUrl&&<a href={model.driveFileUrl} target="_blank" rel="noreferrer" className={action}><ExternalLink className="h-3.5 w-3.5"/>Abrir no Drive</a>}
        </div>
        <div className="mt-2 rounded-md border border-slate-300 bg-white p-2">
          <div className="mb-1 text-[8.5px] font-black uppercase tracking-wide text-slate-600">Variáveis deste modelo</div>
          {model?.variables?.length
            ? <div className="flex flex-wrap gap-1">{model.variables.map((variable:string)=><code key={variable} className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[8.5px] font-bold text-slate-700">{variable}</code>)}</div>
            : <p className="text-[9px] text-slate-500">{hasFile?'Nenhuma variável foi detectada neste arquivo.':'As variáveis aparecerão aqui depois do envio do DOCX.'}</p>}
        </div>
        {previewType===type&&hasFile&&<div className="mt-2 overflow-hidden rounded-lg border border-slate-300 bg-white"><div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-2.5 py-1.5"><span className="text-[9px] font-black uppercase text-slate-600">{samplePreview[type]?'Amostra preenchida com dados fictícios':'Arquivo original'}</span>{samplePreview[type]&&<span className="text-[8.5px] text-slate-500">Sem validade · somente conferência visual</span>}</div><iframe title={`Visualização de ${model?.label||label}`} src={samplePreview[type]||previewUrl(model.driveFileId)} className="h-[520px] w-full bg-white" loading="lazy"/></div>}
        {model?.versions?.length>1&&<details className="mt-1.5 rounded-md border border-slate-300 bg-white px-2 py-1"><summary className="cursor-pointer text-[8.5px] font-black uppercase text-slate-600">Histórico ({model.versions.length})</summary><div className="mt-1 space-y-1">{[...model.versions].reverse().map((version:any)=><div key={version.version} className="flex items-center justify-between gap-2 text-[8.5px]"><span className="truncate"><strong>v{version.version}</strong> · {version.fileName}</span>{version.version!==model.activeVersion&&version.contentSha256&&<button type="button" onClick={()=>void restore(type,version.version)} className={action}>Restaurar</button>}</div>)}</div></details>}
      </article>;
    })}</div>
    {loading&&<p className="px-3 pb-2 text-[9px] text-slate-500">Consultando modelos…</p>}
  </section>;
};
