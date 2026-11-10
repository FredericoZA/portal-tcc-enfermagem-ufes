import {mergeStudioDraft} from '../utils/studioDraftMerge';
import {syncCatalogTemplates,syncCatalogColumns} from '../utils/documentCatalogSync';
import {isReferenceDocumentModel, REFERENCE_DOCUMENT_MODEL_LABELS} from '../utils/referenceDocumentModels';
import {hasReservationReceiptTemplateFields, RESERVATION_RECEIPT_TEMPLATE_FIELDS} from '../utils/reservationReceiptTemplateFields';
import {saveStudioAutomatically} from '../services/studioAutosave';
import {DocumentFilePreview} from './DocumentFilePreview';
import { portalConfirm } from '../services/portalDialogs';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, Eye, FileText, FilePlus2, FileUp, Link2, Loader2, Merge, Plus, ShieldAlert, Sparkles, Trash2 } from 'lucide-react';
import { apiClient } from '../services/apiClient';
import { downloadBlankAttendanceDeclaration } from '../utils/blankAttendanceDeclaration';
import { getVariableUsage, mergeVariableAcrossArtifacts, normalizeVariableKey, saveLocalStudio } from '../services/integrationStudioService';
import { SettingsWorkspaceHeaderPortal, SettingsWorkspaceSelector } from './SettingsWorkspaceModal';

const RESERVATION_RECEIPTS = 'COMPROVANTES_RESERVA';
const ATTENDANCE_DECLARATION = 'DECLARACAO_COMPARECIMENTO';
const BASE_SLOTS: Array<[string, string]> = [
  ['CONVITE', 'Carta-convite'], ['ATA', 'Ata de defesa'], ['TERMO', 'Termo de autorização para publicação'], ['DECLARACAO', 'Declaração de participação na banca'],
  ...Object.entries(REFERENCE_DOCUMENT_MODEL_LABELS) as Array<[string, string]>
];

const normalizeModelKey = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 48);
const humanizeModelKey = (value: string) => value.toLowerCase().split('_').filter(Boolean).map(part => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
const action='portal-button-secondary inline-flex min-h-8 items-center justify-center gap-1.5 rounded-full border border-slate-300 bg-white px-3 py-1 text-[9px] font-black tracking-wide text-slate-900 shadow-none hover:bg-slate-50 disabled:opacity-40';

type VariableColumn = { id:string; name:string; label?:string; description?:string; dataType?:'text'|'date'|'email'|'number'|'url'; aliases?:string[]; format?:{bold?:boolean;italic?:boolean;color?:string} };
type StudioMatrixRow = { id:string; name:string; driveFileUrl:string; fields:Record<string,boolean> };
type StudioDocTemplate = { id:string; type?:string; label:string; fileName:string; variables:string[]; templateContentText:string; [key:string]:any };
type StudioEmailTemplate = { id:string; name:string; recipient?:string; subject:string; body:string; htmlBody?:string; [key:string]:any };
type StudioFormTemplate = { id:string; title:string; questions:Array<{fieldKey:string;availableToTemplates?:boolean;[key:string]:any}>; [key:string]:any };

interface MasterDocumentModelsPanelProps {
  receiptEditor: (hasPublishedReceiptModel: boolean) => React.ReactNode;
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

export const MasterDocumentModelsPanel: React.FC<MasterDocumentModelsPanelProps> = ({ receiptEditor, onCatalogChanged, actorEmail='', matrixColumns, setMatrixColumns, matrixRows, setMatrixRows, docTemplates, setDocTemplates, emailTemplates, setEmailTemplates, formTemplates, setFormTemplates }) => {
  const [models, setModels] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState('');
  const [message, setMessage] = useState('');
  const [links, setLinks] = useState<Record<string, string>>({});
  const [newModelName, setNewModelName] = useState('');
  const [showNewModel, setShowNewModel] = useState(false);
  const documentInputRef=useRef<HTMLInputElement>(null);
  const [mergeTargets, setMergeTargets] = useState<Record<string,string>>({});
  const [pendingSlots, setPendingSlots] = useState<Array<[string, string]>>([]);
  const [previewType, setPreviewType] = useState('');
  useEffect(()=>{
    if(!previewType)return;
    const closePreview=(event:KeyboardEvent)=>{
      if(event.key!=='Escape')return;
      event.stopImmediatePropagation();
      setPreviewType('');
    };
    window.addEventListener('keydown',closePreview,true);
    return()=>window.removeEventListener('keydown',closePreview,true);
  },[previewType]);
  const [samplePreview, setSamplePreview] = useState<Record<string, string>>({});
  const [sampleReview,setSampleReview]=useState<Record<string,{fileId:string;version:number;sha256:string;changed:boolean}>>({});
  const [sampleLoaded,setSampleLoaded]=useState<Record<string,boolean>>({});
  const previewUrlsRef=useRef<Record<string,string>>({});
  useEffect(()=>()=>{(Object.values(previewUrlsRef.current) as string[]).forEach(url=>{if(url.startsWith('blob:'))URL.revokeObjectURL(url);});},[]);
  const [samplePreviewLoading, setSamplePreviewLoading] = useState('');
  const [selectedType, setSelectedType] = useState('CONVITE');
  const [referenceFolders,setReferenceFolders]=useState<Record<string,{name:string;url:string}>>({});
  const studioAutosaveReadyRef=useRef(false);
  const studioAutosaveInFlightRef=useRef(false);
  const studioAutosavePendingRef=useRef(false);
  const studioHasEditsRef=useRef(false);
  const linkImportEnabled = Boolean(models.__capabilities?.existingModelLinkImportEnabled);

  const lastSavedStudioFingerprintRef=useRef('');
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
  const load = async () => { setLoading(true); try {
    const next=await apiClient.getDocumentModels();setModels(next);
    const base=studioBaseCollectionsRef.current;
    const synced={...base,docTemplates:syncCatalogTemplates(base.docTemplates,next),matrixColumns:syncCatalogColumns(base.matrixColumns,next)};
    studioBaseCollectionsRef.current=synced;lastSavedStudioFingerprintRef.current=JSON.stringify(synced);
    onCatalogChanged?.(next);
  } catch (error) { setMessage(error instanceof Error ? error.message : 'Falha ao carregar os modelos.'); } finally { setLoading(false); } };
  const studioAutosaveFingerprint=useMemo(()=>JSON.stringify({matrixColumns,matrixRows,docTemplates,emailTemplates,formTemplates}),[matrixColumns,matrixRows,docTemplates,emailTemplates,formTemplates]);
  const studioAutosaveCurrentRef=useRef({matrixColumns,matrixRows,docTemplates,emailTemplates,formTemplates});
  const studioBaseCollectionsRef=useRef({matrixColumns,matrixRows,docTemplates,emailTemplates,formTemplates});
  studioAutosaveCurrentRef.current={matrixColumns,matrixRows,docTemplates,emailTemplates,formTemplates};
  const markStudioEdit=()=>{
    if(!studioHasEditsRef.current){
      studioBaseCollectionsRef.current=studioAutosaveCurrentRef.current;
      lastSavedStudioFingerprintRef.current=studioAutosaveFingerprint;
    }
    studioHasEditsRef.current=true;
  };
  if(!lastSavedStudioFingerprintRef.current)lastSavedStudioFingerprintRef.current=studioAutosaveFingerprint;
  const flushStudioRef=useRef(()=>{});
  flushStudioRef.current=()=>{
    if(!studioAutosaveReadyRef.current||!studioHasEditsRef.current||loading||lastSavedStudioFingerprintRef.current===studioAutosaveFingerprint)return;
    const current=studioAutosaveCurrentRef.current;
    void apiClient.getSettings().then(latest=>{const base=(latest.integrationStudioDraft||latest.integrationStudio||{}) as any;const merged=mergeStudioDraft({...base,...studioBaseCollectionsRef.current},{...base,...current},base);return saveStudioAutomatically(base,{...merged,schemaVersion:3,revision:Number(base.revision||0)+1,savedAt:new Date().toISOString(),savedBy:actorEmail||'',docTemplates:(merged.docTemplates||[]).map((doc:any)=>({...doc,templateContentText:''}))} as any);}).then(saveLocalStudio).catch(error=>console.error('Salvamento de documentos ao fechar falhou',error));
  };
  useEffect(()=>()=>flushStudioRef.current(),[]);
  useEffect(()=>{
    if(loading)return;
    if(!studioAutosaveReadyRef.current){studioAutosaveReadyRef.current=true;lastSavedStudioFingerprintRef.current=studioAutosaveFingerprint;studioBaseCollectionsRef.current=studioAutosaveCurrentRef.current;return;}
    if(!studioHasEditsRef.current||lastSavedStudioFingerprintRef.current===studioAutosaveFingerprint)return;
    const timer=window.setTimeout(()=>{
      if(studioAutosaveInFlightRef.current){studioAutosavePendingRef.current=true;return;}
      studioAutosaveInFlightRef.current=true;setMessage('Salvando automaticamente…');
      void (async()=>{
        try{
          do{
            studioAutosavePendingRef.current=false;
            const current=studioAutosaveCurrentRef.current;
            const latest=await apiClient.getSettings();
            const base=(latest.integrationStudioDraft||latest.integrationStudio||{}) as any;
            const merged=mergeStudioDraft({...base,...studioBaseCollectionsRef.current},{...base,...current},base);
            const snapshot={
              ...merged,
              schemaVersion:3,
              revision:Number(base.revision||0)+1,
              savedAt:new Date().toISOString(),
              savedBy:actorEmail||base.savedBy||'',
              docTemplates:(merged.docTemplates||[]).map((doc:any)=>({...doc,templateContentText:''})),
              publication:{...(base.publication||{}),status:'DRAFT'}
            };
            const saved=await saveStudioAutomatically(base,snapshot as any);
            saveLocalStudio(saved);
            lastSavedStudioFingerprintRef.current=JSON.stringify(current);studioBaseCollectionsRef.current=current;
            if(JSON.stringify(studioAutosaveCurrentRef.current)===lastSavedStudioFingerprintRef.current)studioHasEditsRef.current=false;
            setMessage('Variáveis salvas no rascunho. Use Publicar configurações na aba Variáveis para aplicar as alterações.');
          }while(studioAutosavePendingRef.current);
        }catch(error){
          console.error('Autosave de documentos e variáveis falhou',error);
          setMessage(error instanceof Error? `Não foi possível salvar no servidor: ${error.message}`:'Não foi possível salvar no servidor.');
        }finally{
          studioAutosaveInFlightRef.current=false;
        }
      })();
    },900);
    return()=>window.clearTimeout(timer);
  },[studioAutosaveFingerprint,actorEmail,loading]);
  const sampleAnswers = {
    ALUNO_NOME: 'Ana Carolina Souza', ALUNOS_NOMES: 'Ana Carolina Souza e Bruno Martins Lima',
    TITULO: 'Segurança do paciente e qualidade da assistência de enfermagem',
    ORIENTADOR_NOME: 'Profa. Dra. Maria Silva', DEFESA_DATA_HORA: '2026-10-15T14:00',
    DEFESA_LOCAL: 'Auditório do CCS — UFES', PROTOCOLO: '2026-999'
  };
  const generateSamplePreview = async (type: string) => {
    if(type===ATTENDANCE_DECLARATION){
      setSamplePreviewLoading(type);setMessage('');
      try{
        const response=await fetch('/api/public/attendance-declaration.pdf');
        if(!response.ok)throw new Error('PDF aprovado indisponível. Publique este modelo antes de visualizar.');
        const bytes=new Uint8Array(await response.arrayBuffer());
        if(bytes.length>2*1024*1024||new TextDecoder().decode(bytes.slice(0,5))!=='%PDF-')throw new Error('PDF aprovado inválido.');
        const url=URL.createObjectURL(new Blob([bytes],{type:'application/pdf'}));
        if(previewUrlsRef.current[type]?.startsWith('blob:'))URL.revokeObjectURL(previewUrlsRef.current[type]);
        previewUrlsRef.current[type]=url;setSamplePreview(current=>({...current,[type]:url}));setPreviewType(type);
      }catch(error){setMessage(error instanceof Error?error.message:'Não foi possível ler o PDF aprovado.');}
      finally{setSamplePreviewLoading('');}
      return;
    }

    if(models[type]?.driveFileId?.startsWith('local_model_')){
      setSamplePreviewLoading(type);setMessage('');
      try{
        const {blob}=await apiClient.getLocalDocumentModelFile(type);
        const url=URL.createObjectURL(blob);
        if(previewUrlsRef.current[type]?.startsWith('blob:'))URL.revokeObjectURL(previewUrlsRef.current[type]);
        previewUrlsRef.current[type]=url;setSamplePreview(current=>({...current,[type]:url}));setPreviewType(type);
      }catch(error){setMessage(error instanceof Error?error.message:'Não foi possível carregar o DOCX local.');}
      finally{setSamplePreviewLoading('');}
      return;
    }
    if(models[type]?.driveFileId?.startsWith('test_drive_')){setMessage('Este cadastro demonstrativo ainda não tem um DOCX. Envie o arquivo em Adicionar documento para visualizar e detectar as variáveis.');return;}
    if (!['CONVITE','ATA','TERMO','DECLARACAO'].includes(type)) { setMessage('A prévia preenchida está disponível para os quatro documentos institucionais do fluxo.'); return; }
    setSamplePreviewLoading(type); setMessage('');
    try {
      const result = await apiClient.previewOfficialModel(type, {matrixColumns,matrixRows,docTemplates,emailTemplates,formTemplates}, sampleAnswers);
      setSampleLoaded(current=>({...current,[type]:false}));
      if(result.modelFileId&&result.modelVersion&&result.templateSha256)setSampleReview(current=>({...current,[type]:{fileId:result.modelFileId,version:result.modelVersion,sha256:result.templateSha256,changed:Boolean(result.templateChangedSincePublication)}}));
      const bytes=result.contentBase64?Uint8Array.from(atob(result.contentBase64),(c)=>c.charCodeAt(0)):new Uint8Array(await (await fetch(result.downloadUrl,{credentials:'same-origin'})).arrayBuffer());
      if(bytes.length>32*1024*1024 || new TextDecoder().decode(bytes.slice(0,5))!=='%PDF-')throw new Error('O servidor não retornou um PDF válido para a prévia.');
      const url=URL.createObjectURL(new Blob([bytes],{type:'application/pdf'}));
      if(previewUrlsRef.current[type]?.startsWith('blob:'))URL.revokeObjectURL(previewUrlsRef.current[type]);previewUrlsRef.current[type]=url;
      if (!url) throw new Error('A prévia foi gerada, mas o PDF não ficou disponível.');
      setSamplePreview(current => ({ ...current, [type]: url }));
      setPreviewType(type);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Não foi possível gerar a prévia preenchida.'); }
    finally { setSamplePreviewLoading(''); }
  };
  const publishSampleReview=async(type:string)=>{
    const review=sampleReview[type];if(!review||!sampleLoaded[type])return;
    setWorking(`review-${type}`);setMessage('');
    try{
      await apiClient.publishReviewedDocumentModel(type,review);
      setSampleReview(current=>({...current,[type]:{...review,changed:false}}));
      setMessage('Modelo revisado publicado. Os documentos já emitidos foram preservados.');
      await load();
    }catch(error){setMessage(error instanceof Error?error.message:'Não foi possível publicar o modelo revisado.');}
    finally{setWorking('');}
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
    try { await apiClient.uploadDocumentModelFile(type, file); setPendingSlots(current => current.filter(([slot]) => slot !== type)); setMessage(isReferenceDocumentModel(type)?'DOCX de referência cadastrado e versionado.':'Modelo cadastrado e versionado.'); await load(); }
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
      setMessage(result.variables.length ? `${result.variables.length} variável(is) sincronizada(s) com a versão publicada.` : 'Este modelo não tem variáveis registradas. Envie o DOCX com os marcadores para identificá-las.');
      await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Não foi possível detectar as variáveis.'); }
    finally { setWorking(''); }
  };

  const importLink = async (type: string) => {
    const link = (links[type] || '').trim(); if (!link) { setMessage('Informe o link ou ID do modelo no Google Drive.'); return; }
    setWorking(type); setMessage('');
    try { await apiClient.importDocumentModelFromDrive(type, link); setLinks(current => ({ ...current, [type]: '' })); setPendingSlots(current => current.filter(([slot]) => slot !== type)); setMessage(isReferenceDocumentModel(type)?'DOCX de referência copiado, validado e versionado.':'Modelo copiado, validado e versionado.'); await load(); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Não foi possível importar o modelo.'); }
    finally { setWorking(''); }
  };

  const restore = async (type: string, version: number) => {
    if (!(await portalConfirm(`Restaurar a versão ${version} deste modelo?`))) return;
    setWorking(`${type}-${version}`);
    try { await apiClient.restoreDocumentModelVersion(type, version); await load(); setMessage(isReferenceDocumentModel(type)?`Versão ${version} selecionada como referência.`:`Versão ${version} restaurada como modelo ativo.`); }
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
    markStudioEdit();
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
  const referenceOnly=isReferenceDocumentModel(type);
  const referenceFolder=referenceFolders[type];
  const receiptTemplateReady=type===RESERVATION_RECEIPTS&&integrityReady
    &&!/^(?:local_model_|test_drive_)/.test(String(model?.driveFileId||''))&&hasReservationReceiptTemplateFields(model?.variables||[]);
  const verifyReferenceFolder=async()=>{
    setWorking(`folder-${type}`);setMessage('');
    try{
      const folder=await apiClient.getReferenceDocumentModelFolder(type);
      setReferenceFolders(current=>({...current,[type]:folder}));
    }catch(error){
      setReferenceFolders(current=>{const next={...current};delete next[type];return next;});
      setMessage(error instanceof Error?error.message:'Não foi possível conferir a pasta no Drive.');
    }finally{setWorking('');}
  };
  const downloadAttendance=async()=>{
    setWorking(ATTENDANCE_DECLARATION);setMessage('');
    try{await downloadBlankAttendanceDeclaration();}
    catch(error){setMessage(error instanceof Error?error.message:'Não foi possível baixar a declaração.');}
    finally{setWorking('');}
  };

  return <section className="portal-master-models-catalog min-h-0 bg-[var(--portal-surface-panel)] pb-0" data-portal-document-direct-editor="true">
    <SettingsWorkspaceHeaderPortal>
      <button type="button" onClick={()=>setShowNewModel(value=>!value)} className="portal-toolbar-icon-button" title="Criar outro modelo" aria-label="Novo modelo"><Plus className="h-3.5 w-3.5"/></button>
      <SettingsWorkspaceSelector icon={FileText} aria-label="Selecionar documento" title={String(referenceOnly?label:model?.label||label)} value={type} onChange={setSelectedType}>
        {slots.map(([slotType,slotLabel])=><option key={slotType} value={slotType}>{slotType===RESERVATION_RECEIPTS||slotType===ATTENDANCE_DECLARATION?slotLabel:models[slotType]?.label||slotLabel}</option>)}
      </SettingsWorkspaceSelector>
    </SettingsWorkspaceHeaderPortal>

    {previewType===type&&hasFile&&samplePreview[type]&&<div role="presentation" data-portal-preview-dialog="true" className="portal-modal-backdrop fixed inset-0 z-[1000013] flex items-center justify-center p-4" onMouseDown={event=>{if(event.currentTarget===event.target)setPreviewType('');}}>
      <section role="dialog" aria-modal="true" aria-label={type===ATTENDANCE_DECLARATION?'Declaração de comparecimento publicada':'Prévia do documento preenchido'} className="portal-standard-modal flex h-[min(90dvh,900px)] w-full max-w-5xl flex-col overflow-hidden bg-white">
        <header className="portal-modal-header shrink-0 justify-between"><strong className="flex items-center gap-2 text-xs font-black normal-case"><FileText className="h-4 w-4"/>{type===ATTENDANCE_DECLARATION?`PDF publicado · Versão ${model?.activeVersion||1}`:model?.driveFileId?.startsWith('local_model_')?'Modelo DOCX local · Demonstração':'Prévia preenchida · Sem validade'}</strong></header>
        <div className="flex shrink-0 items-center justify-between bg-amber-50 p-2 text-xs text-amber-950"><span>{type===ATTENDANCE_DECLARATION?'Modelo em branco publicado. Este é o mesmo PDF disponível no menu público.':model?.driveFileId?.startsWith('local_model_')?'Modelo original de demonstração. A paginação final do PDF exige conferência no Google Drive.':'Prévia do modelo atual com dados fictícios. Sem validade; nenhuma versão foi publicada.'}</span><a href={samplePreview[type]} target="_blank" rel="noreferrer" className="rounded-full border border-slate-300 bg-white px-3 py-1 text-slate-800">{type!==ATTENDANCE_DECLARATION&&model?.driveFileId?.startsWith('local_model_')?'Baixar DOCX':'Abrir / baixar PDF'}</a></div>
        {type!==ATTENDANCE_DECLARATION&&sampleReview[type]&&<div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-slate-300 bg-white px-3 py-2 text-xs"><span role="status">{sampleReview[type].changed?'O conteúdo atual difere da versão publicada. Confira a prévia antes de publicar.':'O conteúdo do modelo corresponde à versão publicada.'}</span>{sampleReview[type].changed&&<button type="button" className={action} disabled={Boolean(working)||!sampleLoaded[type]} onClick={()=>void publishSampleReview(type)}>Publicar modelo revisado</button>}</div>}
        <DocumentFilePreview url={samplePreview[type]} format={type!==ATTENDANCE_DECLARATION&&model?.driveFileId?.startsWith('local_model_')?'docx':'pdf'} label={model?.label||label} onLoaded={()=>setSampleLoaded(current=>({...current,[type]:true}))}/>
      </section>
    </div>}
    {showNewModel&&<div className="mx-auto mt-3 flex max-w-xl items-center gap-2 rounded-xl border border-slate-300 bg-[var(--portal-surface-panel)] p-2.5">
      <input id="new-master-model" autoFocus value={newModelName} onChange={event=>setNewModelName(event.target.value)} onKeyDown={event=>{if(event.key==='Enter'){event.preventDefault();addSlot();setShowNewModel(false);}}} placeholder="Nome do novo documento" className="min-h-8 min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-[10px] text-slate-900 outline-none"/>
      <button type="button" onClick={()=>{addSlot();setShowNewModel(false);}} disabled={!newModelName.trim()} className={action}><FilePlus2 className="h-3.5 w-3.5"/>Criar</button>
    </div>}

    {message&&<p role="status" className="mx-3 mt-3 rounded-lg border border-slate-300 px-2.5 py-1.5 text-[10px] font-semibold text-slate-700" style={{backgroundColor:'var(--portal-surface-panel)'}}>{message}</p>}

    {type===RESERVATION_RECEIPTS&&receiptEditor(receiptTemplateReady)}
    {type===ATTENDANCE_DECLARATION&&<article className="mt-2 space-y-3 rounded-xl border border-slate-300 bg-[var(--portal-surface-panel)] p-4">
      <h3 className="text-sm font-bold">{label}</h3>
      <p className="text-xs text-slate-700">PDF em branco da versão publicada deste modelo no Drive. O mesmo arquivo está disponível no menu lateral.</p>
      <button type="button" disabled={Boolean(working)} onClick={()=>void downloadAttendance()} className={action}><FileText className="h-3.5 w-3.5"/>{working===ATTENDANCE_DECLARATION?'Baixando…':'Baixar modelo em PDF'}</button>
    </article>}
    <article className="mt-2 overflow-hidden rounded-xl border border-slate-300 bg-[var(--portal-surface-panel)]">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-300 p-3">
        <div className="min-w-0">
          <strong className="block truncate text-[12px] text-slate-900">{referenceOnly?'DOCX de referência':model?.label||label}</strong>
          <span className="block truncate text-[9px] text-slate-500">{hasFile?`${model.fileName} · v${model.activeVersion||1}`:'Aguardando DOCX'}{model?.variables?.length?` · ${model.variables.length} variáveis`:''}</span>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-1.5">
          {hasFile&&(['CONVITE','ATA','TERMO','DECLARACAO',ATTENDANCE_DECLARATION].includes(type)||model.driveFileId.startsWith('local_model_'))&&<button type="button" onClick={()=>void generateSamplePreview(type)} disabled={samplePreviewLoading===type} className="portal-toolbar-icon-button disabled:opacity-40" title={type===ATTENDANCE_DECLARATION?'Ver PDF publicado':referenceOnly?'Ver DOCX de referência':'Ver modelo demonstrativo'} aria-label={type===ATTENDANCE_DECLARATION?'Ver PDF publicado':referenceOnly?'Ver DOCX de referência':'Ver modelo demonstrativo'} aria-busy={samplePreviewLoading===type}>{samplePreviewLoading===type?<Loader2 className="h-3.5 w-3.5 animate-spin"/>:<Eye className="h-3.5 w-3.5"/>}</button>}
          <button type="button" onClick={()=>documentInputRef.current?.click()} disabled={Boolean(working)} className="portal-toolbar-icon-button disabled:opacity-40" title={hasFile?'Substituir documento':'Adicionar documento'} aria-label={hasFile?'Substituir documento':'Adicionar documento'}>{working===type?<Loader2 className="h-3.5 w-3.5 animate-spin"/>:<FileUp className="h-3.5 w-3.5"/>}</button>
          <input ref={documentInputRef} type="file" accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" className="hidden" aria-label="Arquivo DOCX do modelo" disabled={Boolean(working)} onChange={event=>{void upload(type,event.target.files?.[0]);event.currentTarget.value='';}}/>
          <button type="button" onClick={()=>void removeModel(type,String(model?.label||label))} disabled={Boolean(working)} className="portal-toolbar-icon-button text-rose-700 disabled:opacity-40" title="Excluir somente este documento" aria-label={`Excluir o documento ${model?.label||label}`}>{deleting?<Loader2 className="h-3.5 w-3.5 animate-spin"/>:<Trash2 className="h-3.5 w-3.5"/>}</button>
          {integrityReady?<CheckCircle2 className="h-4 w-4 text-[var(--portal-brand-action)]"/>:<ShieldAlert className="h-4 w-4 text-amber-700"/>}
        </div>
      </div>

      <div className="space-y-3 p-3">
        {referenceOnly&&<div className="flex flex-wrap items-center gap-2 text-xs text-slate-700">
          {type===RESERVATION_RECEIPTS?<p className="w-full">{receiptTemplateReady
            ? 'O Portal usa esta versão publicada no comprovante privado quando consegue verificar e preencher o DOCX. O comprovante público usa o formato do Portal.'
            : 'O PDF usa o formato do Portal. Para ativar o DOCX no comprovante privado, publique o modelo com as variáveis abaixo.'}
            {' '}<span className="block">Variáveis exigidas: {RESERVATION_RECEIPT_TEMPLATE_FIELDS.map(field=>`<<${field}>>`).join(', ')}.</span></p>
            :<p className="w-full">Cadastre e versione o DOCX para consulta da administração. A declaração em branco continua disponível no formato do Portal.</p>}
          <button type="button" onClick={()=>void verifyReferenceFolder()} disabled={Boolean(working)} className={action}>{working===`folder-${type}`?<Loader2 className="h-3.5 w-3.5 animate-spin"/>:<Link2 className="h-3.5 w-3.5"/>}Conferir pasta no Drive</button>
          {referenceFolder&&<a href={referenceFolder.url} target="_blank" rel="noreferrer" className={action} aria-label={`Abrir pasta ${referenceFolder.name} no Drive`}>{referenceFolder.name}</a>}
        </div>}
        {(linkImportEnabled||!hasFile)&&<div className="space-y-2 rounded-lg border border-slate-300 bg-[var(--portal-surface-card)] p-2" aria-label="Gerenciar arquivo do modelo">
          {linkImportEnabled&&<div className="flex gap-1.5">
            <input aria-label={`Link do modelo ${label}`} value={links[type]||''} onChange={event=>setLinks(current=>({...current,[type]:event.target.value}))} placeholder={referenceOnly?'Link de um DOCX na pasta de referência':'Link ou ID do Drive'} className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-[10px]"/>
            <button type="button" onClick={()=>void importLink(type)} disabled={Boolean(working)||!(links[type]||'').trim()} className={action}><Link2 className="h-3 w-3"/>Importar</button>
          </div>}
          <label className={`${action} cursor-pointer`}>{working===type?<Loader2 className="h-3.5 w-3.5 animate-spin"/>:<FileUp className="h-3.5 w-3.5"/>}{hasFile?'Substituir DOCX':'Enviar DOCX'}<input type="file" accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" className="hidden" disabled={Boolean(working)} onChange={event=>{void upload(type,event.target.files?.[0]);event.currentTarget.value='';}}/></label>
        </div>}

        <div className="flex flex-wrap gap-1.5">
          {hasFile&&model?.driveFileUrl&&<a href={model.driveFileUrl} target="_blank" rel="noreferrer" className={action} title="Abrir modelo no Google Drive"><Eye className="h-3.5 w-3.5"/>Visualizar modelo original</a>}
          {hasFile&&!referenceOnly&&<button type="button" onClick={()=>void detectVariables(type)} disabled={working===`detect-${type}`} className={action}>{working===`detect-${type}`?<Loader2 className="h-3 w-3 animate-spin"/>:<Sparkles className="h-3 w-3"/>}Atualizar variáveis</button>}
        </div>

        {referenceOnly?<section className="border-t border-[var(--portal-border)] pt-3 text-xs" aria-label="Variáveis do DOCX de referência">
          <h4 className="font-bold">Variáveis encontradas no arquivo</h4>
          {model?.variables?.length?<ul className="mt-2 flex flex-wrap gap-2">{(model.variables as string[]).map(variable=><li key={variable}><code>{variable}</code></li>)}</ul>:<p className="mt-2 text-slate-600">{hasFile?'Nenhuma variável foi encontrada.':'As variáveis encontradas aparecerão após o envio do DOCX.'}</p>}
        </section>:<section className="border-t border-[var(--portal-border)] pt-3" aria-label="Variáveis do documento">
          {model?.variables?.length
            ? <div className="space-y-1.5">{(model.variables as string[])
              .filter((variable,index,all)=>all.findIndex(other=>normalizeVariableKey(other)===normalizeVariableKey(variable))===index)
              .map((variable:string)=>{
                const key=normalizeVariableKey(variable);
                const column=resolveVariableColumn(variable);
                const mergeKey=`${type}:${key}`;
                return <div key={variable} title={variableUsageTitle(variable)} className="grid gap-1.5 rounded-lg border border-slate-300 bg-[var(--portal-surface-nested)] p-2 lg:grid-cols-[minmax(150px,.9fr)_minmax(170px,1fr)_120px_minmax(180px,1fr)_auto] lg:items-center">
                  <code className="truncate text-[8.5px] font-black text-[var(--portal-brand-action)]">{variable}</code>
                  {column?<input value={column.label||''} onChange={event=>{markStudioEdit();setMatrixColumns(previous=>previous.map(item=>item.id===column.id?{...item,label:event.target.value}:item));}} className="min-h-7 rounded-md border border-slate-300 bg-white px-2 text-[9px]" placeholder="Nome legível"/>:<span className="text-[9px] text-amber-800">Variável ainda não vinculada</span>}
                  {column?<select value={column.dataType||'text'} onChange={event=>{markStudioEdit();setMatrixColumns(previous=>previous.map(item=>item.id===column.id?{...item,dataType:event.target.value as VariableColumn['dataType']}:item));}} className="min-h-7 rounded-md border border-slate-300 bg-white px-2 text-[9px]"><option value="text">Texto</option><option value="date">Data</option><option value="email">E-mail</option><option value="number">Número</option><option value="url">URL</option></select>:<span/>}
                  {column?<select value={mergeTargets[mergeKey]||''} onChange={event=>setMergeTargets(current=>({...current,[mergeKey]:event.target.value}))} className="min-h-7 rounded-md border border-slate-300 bg-white px-2 text-[9px]"><option value="">Mesclar com…</option>{matrixColumns.filter(item=>item.id!==column.id).map(item=><option key={item.id} value={item.id}>{item.label||item.name}</option>)}</select>:<span/>}
                  {column&&mergeTargets[mergeKey]?<button type="button" onClick={()=>void mergeDocumentVariable(type,variable)} className={action}><Merge className="h-3 w-3"/>Mesclar</button>:<span className="text-right text-[8px] text-slate-400">{column?'Canônica':'Pendente'}</span>}
                </div>;
              })}</div>
            : <p className="rounded-lg border border-dashed border-slate-300 bg-white p-3 text-[9px] text-slate-500">{hasFile?'Nenhuma variável foi detectada neste arquivo. Use “Atualizar variáveis”.':'As variáveis aparecerão aqui depois do envio do DOCX.'}</p>}
        </section>}



        {model?.versions?.length>1&&<details className="rounded-md border border-slate-300 bg-white px-2 py-1">
          <summary className="cursor-pointer text-[8.5px] font-black normal-case text-slate-600">Histórico ({model.versions.length})</summary>
          <div className="mt-1 space-y-1">{[...model.versions].reverse().map((version:any)=><div key={version.version} className="flex items-center justify-between gap-2 text-[8.5px]"><span className="truncate"><strong>v{version.version}</strong> · {version.fileName}</span>{version.version!==model.activeVersion&&version.contentSha256&&<button type="button" onClick={()=>void restore(type,version.version)} className={action}>Restaurar</button>}</div>)}</div>
        </details>}
      </div>
    </article>
    {loading&&<p className="px-3 pb-2 pt-2 text-[9px] text-slate-500">Consultando modelos…</p>}
  </section>;
};
