import { portalConfirm } from '../services/portalDialogs';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, Eye, FilePlus2, FileUp, Link2, Loader2, Merge, Plus, ShieldAlert, Sparkles, Trash2 } from 'lucide-react';
import { apiClient } from '../services/apiClient';
import { getVariableUsage, mergeVariableAcrossArtifacts, normalizeVariableKey } from '../services/integrationStudioService';
import { SettingsWorkspaceHeaderPortal } from './SettingsWorkspaceModal';

const BASE_SLOTS: Array<[string, string]> = [
  ['CONVITE', 'Carta-convite'], ['ATA', 'Ata de defesa'], ['TERMO', 'Termo de autorização para publicação'], ['DECLARACAO', 'Declaração de participação na banca']
];

const normalizeModelKey = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 48);
const humanizeModelKey = (value: string) => value.toLowerCase().split('_').filter(Boolean).map(part => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
const action='inline-flex min-h-8 items-center justify-center gap-1.5 rounded-full border border-slate-300 bg-white px-3 py-1 text-[9px] font-black tracking-wide text-slate-900 shadow-none hover:bg-slate-50 disabled:opacity-40';

type VariableColumn = { id:string; name:string; label?:string; description?:string; dataType?:'text'|'date'|'email'|'number'|'url'; aliases?:string[]; format?:{bold?:boolean;italic?:boolean;color?:string} };
type StudioMatrixRow = { id:string; name:string; driveFileUrl:string; fields:Record<string,boolean> };
type StudioDocTemplate = { id:string; type?:string; label:string; fileName:string; variables:string[]; templateContentText:string; [key:string]:any };
type StudioEmailTemplate = { id:string; name:string; recipient?:string; subject:string; body:string; htmlBody?:string; [key:string]:any };
type StudioFormTemplate = { id:string; title:string; questions:Array<{fieldKey:string;availableToTemplates?:boolean;[key:string]:any}>; [key:string]:any };

interface MasterDocumentModelsPanelProps {
  onCatalogChanged?: (models: Record<string, any>) => void;
  actorEmail?: string;
  matrixColumns: VariableColumn[];
  setMatrixColumns: React.Dispatch<React.SetStateAction<VariableColumn[]>>;
  matrixRows: StudioMatrixRow[];
  setMatrixRows: React.Dispatch<React.SetStateAction<StudioMatrixRow[]>>;
  docTemplates: StudioDocTemplate[];
  setDocTemplates: React.Dispatch<React.SetStateAction<StudioDocTemplate[]>>;
  emailTemplates: StudioEmailTemplate[];
  setEmailTemplates: React.Dispatch<React.SetStateAction<StudioEmailTemplate[]>>;
  formTemplates: StudioFormTemplate[];
  setFormTemplates: React.Dispatch<React.SetStateAction<StudioFormTemplate[]>>;
}

export const MasterDocumentModelsPanel: React.FC<MasterDocumentModelsPanelProps> = ({ onCatalogChanged, actorEmail='', matrixColumns, setMatrixColumns, matrixRows, setMatrixRows, docTemplates, setDocTemplates, emailTemplates, setEmailTemplates, formTemplates, setFormTemplates }) => {
  const [models, setModels] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState('');
  const [message, setMessage] = useState('');
  const [links, setLinks] = useState<Record<string, string>>({});
  const [newModelName, setNewModelName] = useState('');
  const [showNewModel, setShowNewModel] = useState(false);
  const [mergeTargets, setMergeTargets] = useState<Record<string,string>>({});
  const [pendingSlots, setPendingSlots] = useState<Array<[string, string]>>([]);
  const [previewType, setPreviewType] = useState('');
  const [samplePreview, setSamplePreview] = useState<Record<string, string>>({});
  const [samplePreviewLoading, setSamplePreviewLoading] = useState('');
  const [selectedType, setSelectedType] = useState('CONVITE');
  const studioAutosaveReadyRef=useRef(false);
  const studioAutosaveRequestRef=useRef(0);
  const linkImportEnabled = Boolean(models.__capabilities?.existingModelLinkImportEnabled);

  const slots = useMemo(() => {
    const persisted: Array<[string, string]> = Object.entries(models).filter(([key, value]) => key !== '__capabilities' && value && typeof value === 'object').map(([key, value]) => [key, String((value as any).label || humanizeModelKey(key))]);
    const merged = [...BASE_SLOTS, ...persisted, ...pendingSlots]; const seen = new Set<string>();
    return merged.filter(([type]) => { if (seen.has(type)) return false; seen.add(type); return true; });
  }, [models, pendingSlots]);

  useEffect(()=>{
    if(!slots.length)return;
    if(!slots.some(([type])=>type===selectedType))setSelectedType(slots[0][0]);
  },[slots,selectedType]);

  const selectedSlot=slots.find(([type])=>type===selectedType)||slots[0];
  const load = async () => { setLoading(true); try { const next=await apiClient.getDocumentModels(); setModels(next); onCatalogChanged?.(next); } catch (error) { setMessage(error instanceof Error ? error.message : 'Falha ao carregar os modelos.'); } finally { setLoading(false); } };
  const studioAutosaveFingerprint=useMemo(()=>JSON.stringify({matrixColumns,matrixRows,docTemplates,emailTemplates,formTemplates}),[matrixColumns,matrixRows,docTemplates,emailTemplates,formTemplates]);
  useEffect(()=>{
    if(!studioAutosaveReadyRef.current){studioAutosaveReadyRef.current=true;return;}
    const fingerprint=studioAutosaveFingerprint;
    const timer=window.setTimeout(()=>{
      const requestId=++studioAutosaveRequestRef.current;
      void (async()=>{
        try{
          const latest=await apiClient.getSettings();
          const base=(latest.integrationStudio||{}) as any;
          const snapshot={
            ...base,
            schemaVersion:3,
            revision:Number(base.revision||0)+1,
            savedAt:new Date().toISOString(),
            savedBy:actorEmail||base.savedBy||'',
            matrixColumns,
            matrixRows,
            docTemplates:docTemplates.map(doc=>({...doc,templateContentText:''})),
            emailTemplates,
            formTemplates,
            publication:{...(base.publication||{}),status:'DRAFT'}
          };
          await apiClient.updateSettings({integrationStudio:snapshot});
          if(requestId===studioAutosaveRequestRef.current)setMessage(current=>current||'');
        }catch(error){
          console.error('Autosave de documentos e variáveis falhou',error);
        }
      })();
    },900);
    return()=>window.clearTimeout(timer);
  },[studioAutosaveFingerprint,actorEmail]);
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
    setPendingSlots(current => [...current, [type, label]]); setSelectedType(type); setNewModelName(''); setMessage('Novo espaço criado. Envie o DOCX para publicá-lo e versioná-lo no Drive.');
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

  const detectVariables = async (type: string) => {
    setWorking(`detect-${type}`); setMessage('');
    try {
      const result = await apiClient.detectDocumentModelVariables(type);
      const normalized=result.variables.map(normalizeVariableKey).filter(Boolean);
      setMatrixColumns(previous=>{
        const next=[...previous];
        const known=new Set(next.flatMap(column=>[column.id,column.name,...(column.aliases||[])].map(value=>normalizeVariableKey(String(value||''))).filter(Boolean)));
        for(const key of normalized){
          if(known.has(key))continue;
          next.push({id:key,name:key,label:key.replace(/_/g,' ').toLowerCase().replace(/(^|\s)\S/g,letter=>letter.toUpperCase()),dataType:/EMAIL/.test(key)?'email':/DATA|HORA/.test(key)?'date':'text',aliases:[key]});
          known.add(key);
        }
        return next;
      });
      setMessage(`${result.variables.length} variável(is) detectada(s) e sincronizada(s) automaticamente.`);
      await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Não foi possível detectar as variáveis.'); }
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

  const resolveVariableColumn = (raw:string) => {
    const key=normalizeVariableKey(raw);
    return matrixColumns.find(column => [column.id,column.name,...(column.aliases||[])].some(value => normalizeVariableKey(String(value||''))===key));
  };

  const mergeDocumentVariable = async (type:string, raw:string) => {
    const source=resolveVariableColumn(raw);
    const mergeKey=`${type}:${normalizeVariableKey(raw)}`;
    const targetId=mergeTargets[mergeKey]||'';
    if(!source||!targetId||source.id===targetId)return;
    const target=matrixColumns.find(column=>column.id===targetId);
    if(!target)return;
    const usage=getVariableUsage([source.id,source.name,...(source.aliases||[])],{matrixColumns,matrixRows,docTemplates,emailTemplates,formTemplates});
    if(!(await portalConfirm(`Mesclar “${source.label||source.name}” em “${target.label||target.name}”? A variável antiga será preservada como alias.`)))return;
    const result=mergeVariableAcrossArtifacts({matrixColumns,matrixRows,docTemplates,emailTemplates,formTemplates},source.id,target.id);
    setMatrixColumns(result.matrixColumns);
    setMatrixRows(result.matrixRows);
    setDocTemplates(result.docTemplates);
    setEmailTemplates(result.emailTemplates);
    setFormTemplates(result.formTemplates);
    setMergeTargets(current=>({...current,[mergeKey]:''}));
    setMessage(`Mescla concluída em ${result.affectedArtifacts.length} artefato(s). Uso anterior: ${usage.documents.length} documento(s), ${usage.emails.length} e-mail(s) e ${usage.forms.length} formulário(s).`);
  };

  const variableUsageTitle=(raw:string)=>{
    const column=resolveVariableColumn(raw);
    const keys=(column?[column.id,column.name,...(column.aliases||[])]:[raw]).map(normalizeVariableKey);
    const usage=getVariableUsage(keys,{matrixColumns,matrixRows,docTemplates,emailTemplates,formTemplates});
    const backendDocuments=Object.entries(models)
      .filter(([modelType,value])=>modelType!=='__capabilities'&&value&&typeof value==='object'&&((value as any).variables||[]).some((item:string)=>keys.includes(normalizeVariableKey(item))))
      .map(([modelType,value])=>String((value as any).label||humanizeModelKey(modelType)));
    const documents=Array.from(new Set([...usage.documents,...backendDocuments]));
    const parts=[
      documents.length?`Documentos: ${documents.join(', ')}`:'',
      usage.emails.length?`E-mails: ${usage.emails.join(', ')}`:'',
      usage.forms.length?`Formulários: ${usage.forms.join(', ')}`:'',
    ].filter(Boolean);
    return parts.length?parts.join(' · '):'Sem outros usos registrados.';
  };

  if(!selectedSlot)return <section className="min-h-full bg-[var(--portal-surface-page)] p-3 text-xs text-slate-600">Nenhum documento cadastrado.</section>;
  const [type,label]=selectedSlot;
  const model=models[type];
  const hasFile=Boolean(model?.driveFileId);
  const integrityReady=Boolean(model?.configured&&model?.contentSha256);
  const deleting=working===`delete-${type}`;

  return <section className="portal-master-models-catalog min-h-full bg-[var(--portal-surface-page)] pb-5" data-portal-document-direct-editor="true">
    <SettingsWorkspaceHeaderPortal>
      <div className="flex min-w-0 items-center gap-1.5">
        <select value={type} onChange={event=>setSelectedType(event.target.value)} className="max-w-[280px] rounded-full border border-white bg-white px-3 py-1.5 text-[10px] font-black text-slate-950" aria-label="Selecionar documento">
          {slots.map(([slotType,slotLabel])=><option key={slotType} value={slotType}>{models[slotType]?.label||slotLabel}</option>)}
        </select>
        <button type="button" onClick={()=>setShowNewModel(value=>!value)} className="portal-toolbar-icon-button" title="Adicionar documento" aria-label="Adicionar documento"><Plus className="h-3.5 w-3.5"/></button>
        <button type="button" onClick={()=>void removeModel(type,String(model?.label||label))} disabled={Boolean(working)} className="portal-toolbar-icon-button text-rose-700 disabled:opacity-30" title="Excluir documento" aria-label="Excluir documento">{deleting?<Loader2 className="h-3.5 w-3.5 animate-spin"/>:<Trash2 className="h-3.5 w-3.5"/>}</button>
      </div>
    </SettingsWorkspaceHeaderPortal>

    {showNewModel&&<div className="mx-auto mt-3 flex max-w-xl items-center gap-2 rounded-xl border border-slate-300 bg-[var(--portal-surface-panel)] p-2.5">
      <input id="new-master-model" autoFocus value={newModelName} onChange={event=>setNewModelName(event.target.value)} onKeyDown={event=>{if(event.key==='Enter'){event.preventDefault();addSlot();setShowNewModel(false);}}} placeholder="Nome do novo documento" className="min-h-8 min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-[10px] text-slate-900 outline-none"/>
      <button type="button" onClick={()=>{addSlot();setShowNewModel(false);}} disabled={!newModelName.trim()} className={action}><FilePlus2 className="h-3.5 w-3.5"/>Criar</button>
    </div>}

    {message&&<p role="status" className="mx-3 mt-3 rounded-lg border border-slate-300 px-2.5 py-1.5 text-[10px] font-semibold text-slate-700" style={{backgroundColor:'var(--portal-surface-panel)'}}>{message}</p>}

    <article className="mx-3 mt-3 overflow-hidden rounded-xl border border-slate-300 bg-[var(--portal-surface-panel)]">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-300 p-3">
        <div className="min-w-0">
          <strong className="block truncate text-[12px] text-slate-900">{model?.label||label}</strong>
          <span className="block truncate text-[9px] text-slate-500">{hasFile?`${model.fileName} · v${model.activeVersion||1}`:'Aguardando DOCX'}{model?.variables?.length?` · ${model.variables.length} variáveis`:''}</span>
        </div>
        {integrityReady?<CheckCircle2 className="h-4 w-4 text-[var(--portal-brand-action)]"/>:<ShieldAlert className="h-4 w-4 text-amber-700"/>}
      </div>

      <div className="space-y-3 p-3">
        {linkImportEnabled&&<div className="flex gap-1.5">
          <input aria-label={`Link do modelo ${label}`} value={links[type]||''} onChange={event=>setLinks(current=>({...current,[type]:event.target.value}))} placeholder="Link ou ID do Drive" className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-[10px]"/>
          <button type="button" onClick={()=>void importLink(type)} disabled={Boolean(working)||!(links[type]||'').trim()} className={action}><Link2 className="h-3 w-3"/>Importar</button>
        </div>}

        <div className="flex flex-wrap gap-1.5">
          <label className={`${action} cursor-pointer`}>{working===type?<Loader2 className="h-3.5 w-3.5 animate-spin"/>:<FileUp className="h-3.5 w-3.5"/>}{hasFile?'Substituir DOCX':'Enviar DOCX'}<input type="file" accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" className="hidden" disabled={Boolean(working)} onChange={event=>{void upload(type,event.target.files?.[0]);event.currentTarget.value='';}}/></label>
          {hasFile&&model?.driveFileUrl&&<a href={model.driveFileUrl} target="_blank" rel="noreferrer" className={action}><Eye className="h-3.5 w-3.5"/>Visualizar modelo original</a>}
          {hasFile&&['CONVITE','ATA','TERMO','DECLARACAO'].includes(type)&&<button type="button" onClick={()=>void generateSamplePreview(type)} disabled={samplePreviewLoading===type} className={action}>{samplePreviewLoading===type?<Loader2 className="h-3.5 w-3.5 animate-spin"/>:<Sparkles className="h-3.5 w-3.5"/>}Prévia preenchida</button>}
          {hasFile&&<button type="button" onClick={()=>void detectVariables(type)} disabled={working===`detect-${type}`} className={action}>{working===`detect-${type}`?<Loader2 className="h-3 w-3 animate-spin"/>:<Sparkles className="h-3 w-3"/>}Atualizar variáveis</button>}
        </div>

        <section className="rounded-xl border border-slate-300 bg-[var(--portal-surface-card)] p-2.5" aria-label="Variáveis do documento">
          {model?.variables?.length
            ? <div className="space-y-1.5">{model.variables.map((variable:string)=>{
                const key=normalizeVariableKey(variable);
                const column=resolveVariableColumn(variable);
                const mergeKey=`${type}:${key}`;
                return <div key={variable} title={variableUsageTitle(variable)} className="grid gap-1.5 rounded-lg border border-slate-300 bg-white p-2 lg:grid-cols-[minmax(150px,.9fr)_minmax(170px,1fr)_120px_minmax(180px,1fr)_auto] lg:items-center">
                  <code className="truncate text-[8.5px] font-black text-[var(--portal-brand-action)]">{variable}</code>
                  {column?<input value={column.label||''} onChange={event=>setMatrixColumns(previous=>previous.map(item=>item.id===column.id?{...item,label:event.target.value}:item))} className="min-h-7 rounded-md border border-slate-300 bg-white px-2 text-[9px]" placeholder="Nome legível"/>:<span className="text-[9px] text-amber-800">Variável ainda não vinculada</span>}
                  {column?<select value={column.dataType||'text'} onChange={event=>setMatrixColumns(previous=>previous.map(item=>item.id===column.id?{...item,dataType:event.target.value as VariableColumn['dataType']}:item))} className="min-h-7 rounded-md border border-slate-300 bg-white px-2 text-[9px]"><option value="text">Texto</option><option value="date">Data</option><option value="email">E-mail</option><option value="number">Número</option><option value="url">URL</option></select>:<span/>}
                  {column?<select value={mergeTargets[mergeKey]||''} onChange={event=>setMergeTargets(current=>({...current,[mergeKey]:event.target.value}))} className="min-h-7 rounded-md border border-slate-300 bg-white px-2 text-[9px]"><option value="">Mesclar com…</option>{matrixColumns.filter(item=>item.id!==column.id).map(item=><option key={item.id} value={item.id}>{item.label||item.name}</option>)}</select>:<span/>}
                  {column&&mergeTargets[mergeKey]?<button type="button" onClick={()=>void mergeDocumentVariable(type,variable)} className={action}><Merge className="h-3 w-3"/>Mesclar</button>:<span className="text-right text-[8px] text-slate-400">{column?'Canônica':'Pendente'}</span>}
                </div>;
              })}</div>
            : <p className="rounded-lg border border-dashed border-slate-300 bg-white p-3 text-[9px] text-slate-500">{hasFile?'Nenhuma variável foi detectada neste arquivo. Use “Atualizar variáveis”.':'As variáveis aparecerão aqui depois do envio do DOCX.'}</p>}
        </section>

        {previewType===type&&hasFile&&samplePreview[type]&&<div className="overflow-hidden rounded-lg border border-slate-300 bg-white">
          <iframe title={`Visualização de ${model?.label||label}`} src={samplePreview[type]} className="h-[520px] w-full bg-white" loading="lazy"/>
        </div>}

        {model?.versions?.length>1&&<details className="rounded-md border border-slate-300 bg-white px-2 py-1">
          <summary className="cursor-pointer text-[8.5px] font-black uppercase text-slate-600">Histórico ({model.versions.length})</summary>
          <div className="mt-1 space-y-1">{[...model.versions].reverse().map((version:any)=><div key={version.version} className="flex items-center justify-between gap-2 text-[8.5px]"><span className="truncate"><strong>v{version.version}</strong> · {version.fileName}</span>{version.version!==model.activeVersion&&version.contentSha256&&<button type="button" onClick={()=>void restore(type,version.version)} className={action}>Restaurar</button>}</div>)}</div>
        </details>}
      </div>
    </article>
    {loading&&<p className="px-3 pb-2 pt-2 text-[9px] text-slate-500">Consultando modelos…</p>}
  </section>;
};
