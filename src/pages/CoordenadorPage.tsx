import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiClient } from '../services/apiClient';
import { ProcessData, SignatureJob, AstenIntegrationStatus } from '../types';
import { TableScrollWrapper } from '../components/TableScrollWrapper';
import { cleanPersonName, formatProfessorName, formatTccTitle, formatDateNumeric, formatTimeExtenso } from '../utils/formatters';
import { loadTableConfig, ColumnDef } from '../components/TableColumnSelectorPanel';
import { HeaderSettingsPopover } from '../components/HeaderSettingsPopover';
import { SearchPopover } from '../components/SearchPopover';
import { YinYangIcon } from '../components/YinYangIcon';
import { ColorfulHeaderIcon } from '../components/ColorfulHeaderIcon';
import { 
  TableTextFormat, 
  DEFAULT_TABLE_TEXT_FORMAT, 
  GLOBAL_TABLE_EVENT, 
  loadGlobalTableConfig,
  getTableStyles, 
  getActionPillStyles,
  getFilterChipProps,
  formatColumnLabel, 
  formatCellText, 
  getColWidthClass,
  getEditableTableText,
  getColumnWeightClass
  ,inheritsGlobalTableAppearance
} from '../utils/tableFormatters';
import { TABLE_LAYOUTS_EVENT } from '../utils/portalAppearanceLinks';
import {
  Award,
  Download,
  CheckCircle2,
  FileCheck,
  Shield,
  CheckSquare,
  Square,
  Search,
  Clock,
  ArrowRight,
  FileText,
  Filter,
  RefreshCw,
  List,
  FileSpreadsheet,
  AlertCircle,
  RotateCcw
} from 'lucide-react';
import { resolveInstallationProfile } from '../utils/installationProfile';
import { PORTAL_SEMANTIC_COLORS } from '../utils/portalSemanticTokens';
import { normalizeProcessNumber } from '../components/PortalProcessPill';

const ALL_COORDINATOR_COLUMNS: ColumnDef[] = [
  { key: 'protocolo', label: 'Processo', isFixed: true },
  { key: 'envioStatus', label: 'Envio', isFixed: true },
  { key: 'defesaDataHora', label: 'Data' },
  { key: 'titulo', label: 'Título do Trabalho' },
  { key: 'aluno1', label: 'Aluno 1' },
  { key: 'aluno2', label: 'Aluno 2' },
  { key: 'orientador', label: 'Orientador(a)' },
  { key: 'membro1', label: '1º Membro' },
  { key: 'membro2', label: '2º Membro' },
  { key: 'coorientador', label: 'Coorientador(a)' },
  { key: 'resumo', label: 'Resumo' },
  { key: 'palavrasChave', label: 'Palavras-Chave' },
  { key: 'defesaLocal', label: 'Local' }
];

const DEFAULT_COORDINATOR_ORDER = ALL_COORDINATOR_COLUMNS.map((c) => c.key);

const DEFAULT_COORDINATOR_VISIBLE: Record<string, boolean> = {
  protocolo: true,
  envioStatus: true,
  defesaDataHora: true,
  titulo: true,
  aluno1: true,
  aluno2: true,
  orientador: true,
  membro1: false,
  membro2: false,
  coorientador: false,
  resumo: false,
  palavrasChave: false,
  defesaLocal: false,
};

interface CoordenadorPageProps {
  onSelectProcess: (processId: string) => void;
}

export const CoordenadorPage: React.FC<CoordenadorPageProps> = ({ onSelectProcess }) => {
  const { settings }=useAuth();
  const installationProfile=resolveInstallationProfile(settings);
  const [queue, setQueue] = useState<any[]>([]);
  const [allProcesses, setAllProcesses] = useState<ProcessData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'pendentes' | 'concluidos'>('pendentes');
  const [searchFilter, setSearchFilter] = useState('');
  const [downloadError, setDownloadError] = useState('');
  const [signatureJobs, setSignatureJobs] = useState<SignatureJob[]>([]);
  const [astenStatus, setAstenStatus] = useState<AstenIntegrationStatus | null>(null);
  const [signingIds, setSigningIds] = useState<string[]>([]);
  const [signingMessage, setSigningMessage] = useState('');
  
  // Selection state for batch operations
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Download & Upload (Missing vs Sent) status tracking
  const [downloadedIds, setDownloadedIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('coordinator_downloaded_ids');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('coordinator_downloaded_ids', JSON.stringify(downloadedIds));
    } catch (err) {
      console.error('Erro ao salvar downloadedIds:', err);
    }
  }, [downloadedIds]);

  // Column visibility state using TableColumnSelectorPanel helper
  const initialCoordinatorConfig = loadTableConfig('coordinator', DEFAULT_COORDINATOR_ORDER, DEFAULT_COORDINATOR_VISIBLE, 25);
  const [columnOrder, setColumnOrder] = useState<string[]>(initialCoordinatorConfig.columnOrder);
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>(initialCoordinatorConfig.visibleColumns);
  const [customLabels, setCustomLabels] = useState<Record<string, string>>(initialCoordinatorConfig.customLabels || {});
  const [columnWidths, setColumnWidths] = useState<Record<string, string | number>>(initialCoordinatorConfig.columnWidths || {});
  const [recordsLimit, setRecordsLimit] = useState<number | 'all'>(initialCoordinatorConfig.recordsLimit || 25);
  const [startDate, setStartDate] = useState(initialCoordinatorConfig.startDate || '');
  const [endDate, setEndDate] = useState(initialCoordinatorConfig.endDate || '');
  const [coordTextFormat, setCoordTextFormat] = useState<TableTextFormat>(() => ({
    ...loadGlobalTableConfig(),
    ...(initialCoordinatorConfig.textFormat || {})
  }));

  useEffect(() => {
    const handler = (e: any) => {
      const newFormat = (e && e.detail) ? e.detail : loadGlobalTableConfig();
      if (inheritsGlobalTableAppearance('coordinator')) setCoordTextFormat(prev => ({ ...prev, ...newFormat }));
    };
    if (inheritsGlobalTableAppearance('coordinator')) setCoordTextFormat(prev => ({ ...prev, ...loadGlobalTableConfig() }));
    window.addEventListener(GLOBAL_TABLE_EVENT, handler);
    const handlePublishedLayout = () => {
      const loaded = loadTableConfig('coordinator', DEFAULT_COORDINATOR_ORDER, DEFAULT_COORDINATOR_VISIBLE, 25);
      setColumnOrder(loaded.columnOrder);
      setVisibleColumns(loaded.visibleColumns);
      setCustomLabels(loaded.customLabels || {});
      setColumnWidths(loaded.columnWidths || {});
      setRecordsLimit(loaded.recordsLimit ?? 25);
      setStartDate(loaded.startDate || '');
      setEndDate(loaded.endDate || '');
      setCoordTextFormat(loaded.textFormat || loadGlobalTableConfig());
    };
    window.addEventListener(TABLE_LAYOUTS_EVENT, handlePublishedLayout);
    return () => {
      window.removeEventListener(GLOBAL_TABLE_EVENT, handler);
      window.removeEventListener(TABLE_LAYOUTS_EVENT, handlePublishedLayout);
    };
  }, []);

  const styles = getTableStyles(coordTextFormat);
  const isDarkTheme = (coordTextFormat.headerTheme || 'militar') !== 'clean' && (coordTextFormat.headerTheme || 'militar') !== 'slate' && (coordTextFormat.headerTheme || 'militar') !== 'light';

  // Sorting state
  const [sortField, setSortField] = useState<string>('protocolo');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const renderSortArrow = (field: string, isDark: boolean = isDarkTheme) => {
    if (sortField !== field) {
      return <span className={`${isDark ? 'text-white/60 group-hover:text-white' : 'text-slate-400 group-hover:text-slate-900'} opacity-70 group-hover:opacity-100 transition-opacity ml-0.5`}>↕</span>;
    }
    return sortDirection === 'asc' 
      ? <span className={`${isDark ? 'text-white' : 'text-slate-900'} font-extrabold ml-0.5`}>↑</span> 
      : <span className={`${isDark ? 'text-white' : 'text-slate-900'} font-extrabold ml-0.5`}>↓</span>;
  };

  // Label Map for columns
  const labelMap: Record<string, string> = {
    protocolo: 'Processo',
    envioStatus: '📤 Envio',
    defesaDataHora: 'Data',
    titulo: '📖 Título do Trabalho',
    aluno1: '🎓 Aluno 1',
    aluno2: '🎓 Aluno 2',
    orientador: '👨‍🏫 Orientador(a)',
    membro1: '👥 1º Membro',
    membro2: '👥 2º Membro',
    coorientador: '👥 Coorientador(a)',
    resumo: '📝 Resumo',
    palavrasChave: '🔑 Palavras-Chave',
    defesaLocal: '📍 Local'
  };


  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [queueData, procsData, jobsData, integration] = await Promise.all([
        apiClient.getCoordinatorQueue(),
        apiClient.getProcesses(),
        apiClient.getSignatureJobs(),
        apiClient.getAstenStatus()
      ]);
      setQueue(queueData || []);
      setAllProcesses(procsData || []);
      setSignatureJobs(jobsData || []);
      setAstenStatus(integration || null);
    } catch (err) {
      console.error('Erro ao carregar dados do Presidente:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await loadData();
    } finally {
      setTimeout(() => {
        setIsRefreshing(false);
      }, 500);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filter pending vs completed
  const pendingItems = queue.filter(item => {
    const term = searchFilter.toLowerCase();
    const p = item?.process;
    if (!p) return false;
    const defenseDate = p.defesa?.startAt?.slice(0, 10) || '';
    if (startDate && (!defenseDate || defenseDate < startDate)) return false;
    if (endDate && (!defenseDate || defenseDate > endDate)) return false;
    return (
      (p.protocolo || '').toLowerCase().includes(term) ||
      (p.titulo || '').toLowerCase().includes(term) ||
      (p.aluno1?.nome || '').toLowerCase().includes(term) ||
      (p.orientador?.nome || '').toLowerCase().includes(term)
    );
  });

  const completedItems = allProcesses.filter(p => {
    if (p.status !== 'CONCLUIDO') return false;
    const defenseDate = p.defesa?.startAt?.slice(0, 10) || '';
    if (startDate && (!defenseDate || defenseDate < startDate)) return false;
    if (endDate && (!defenseDate || defenseDate > endDate)) return false;
    const term = searchFilter.toLowerCase();
    return (
      (p.protocolo || '').toLowerCase().includes(term) ||
      (p.titulo || '').toLowerCase().includes(term) ||
      (p.aluno1?.nome || '').toLowerCase().includes(term) ||
      (p.orientador?.nome || '').toLowerCase().includes(term)
    );
  });

  // Batch Selection Helpers
  const toggleSelectAllPending = () => {
    if (selectedIds.length === pendingItems.length && pendingItems.length > 0) {
      setSelectedIds([]);
    } else {
      setSelectedIds(pendingItems.map(item => item.process.id));
    }
  };

  const toggleSelectItem = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const getDeclarationJob = (processId: string): SignatureJob | undefined =>
    signatureJobs
      .filter((job) => job.processId === processId && job.documentType === 'DECLARACAO' && job.provider === 'ASTEN')
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];

  const canRetryDeclarationJob = (job?: SignatureJob): boolean => Boolean(
    job &&
    job.providerCreationState !== 'UNCERTAIN' &&
    ['WAITING_INTEGRATION', 'QUEUED', 'PROVIDER_ERROR'].includes(job.status)
  );

  const isDeclarationActionable = (processId: string): boolean => {
    const job = getDeclarationJob(processId);
    return !job || canRetryDeclarationJob(job);
  };

  const getDeclarationStatus = (processId: string): { label: string; tone: string } => {
    const job = getDeclarationJob(processId);
    if (!job) return { label: 'Pendente', tone: 'border-amber-300 bg-amber-50 text-amber-900' };
    if (job.providerCreationState === 'UNCERTAIN') return { label: 'Conferir na Asten', tone: 'border-amber-400 bg-amber-100 text-amber-950' };
    if (['WAITING_INTEGRATION', 'QUEUED'].includes(job.status)) return { label: 'Na fila Asten', tone: 'border-sky-300 bg-sky-50 text-sky-900' };
    if (job.status === 'SENDING') return { label: 'Enviando', tone: 'border-sky-300 bg-sky-50 text-sky-900' };
    if (job.status === 'SENT') return { label: 'Aguardando assinatura', tone: 'border-blue-300 bg-blue-50 text-blue-900' };
    if (job.status === 'PARTIALLY_SIGNED') return { label: 'Parcialmente assinada', tone: 'border-indigo-300 bg-indigo-50 text-indigo-900' };
    if (['SIGNED', 'DRIVE_SYNC_PENDING', 'ARCHIVED'].includes(job.status)) return { label: 'Assinada', tone: 'border-emerald-300 bg-emerald-50 text-emerald-900' };
    if (job.status === 'PROVIDER_ERROR') return { label: 'Falha recuperável', tone: 'border-red-300 bg-red-50 text-red-900' };
    return { label: 'Atenção', tone: 'border-red-300 bg-red-50 text-red-900' };
  };

  const dispatchDeclarationToAsten = async (processId: string) => {
    const job = getDeclarationJob(processId);
    if (job && canRetryDeclarationJob(job)) {
      await apiClient.retrySignatureJob(job.id);
      return;
    }
    if (!job) {
      await apiClient.signProcessDocument(processId, 'DECLARACAO');
      return;
    }
    throw new Error('Esta declaração já foi enviada para a Asten ou exige conferência antes de novo envio.');
  };

  const handleSignOne = async (processId: string) => {
    if (signingIds.includes(processId)) return;
    setSigningMessage('');
    setSigningIds((prev) => [...prev, processId]);
    try {
      await dispatchDeclarationToAsten(processId);
      setSigningMessage('Declaração encaminhada para assinatura pela Asten.');
      await loadData();
    } catch (error) {
      setSigningMessage(error instanceof Error ? error.message : 'Não foi possível encaminhar a declaração para a Asten.');
    } finally {
      setSigningIds((prev) => prev.filter((id) => id !== processId));
    }
  };

  const handleSignSelected = async () => {
    const pendingIds = new Set(pendingItems.map((item) => item.process.id));
    const ids = selectedIds.filter((id) => pendingIds.has(id) && isDeclarationActionable(id));
    if (!ids.length) {
      setSigningMessage('Selecione ao menos uma declaração que ainda possa ser enviada ou reprocessada na Asten.');
      return;
    }
    setSigningMessage('');
    setSigningIds((prev) => Array.from(new Set([...prev, ...ids])));
    let completed = 0;
    const failures: string[] = [];
    for (const id of ids) {
      try {
        await dispatchDeclarationToAsten(id);
        completed += 1;
      } catch (error) {
        const process = pendingItems.find((item) => item.process.id === id)?.process;
        failures.push(`${process?.protocolo || id}: ${error instanceof Error ? error.message : 'falha no envio'}`);
      }
    }
    setSigningIds((prev) => prev.filter((id) => !ids.includes(id)));
    setSelectedIds([]);
    await loadData();
    setSigningMessage(
      failures.length
        ? `${completed} declaração(ões) encaminhada(s). ${failures.length} falha(s): ${failures.join(' | ')}`
        : `${completed} declaração(ões) encaminhada(s) para assinatura pela Asten.`
    );
  };

  const downloadBrowserFile = (blob: Blob, fileName: string) => {
    const url=URL.createObjectURL(blob); const link=document.createElement('a'); link.href=url; link.download=fileName; document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url);
  };

  const handleGovOne = async (processId: string) => {
    if(signingIds.includes(processId))return;
    const signerWindow=window.open('https://assinador.iti.br/','_blank','noopener,noreferrer');
    setSigningMessage(''); setSigningIds(prev=>[...prev,processId]);
    try{const result=await apiClient.signProcessDocument(processId,'DECLARACAO','GOV_BR');const file=await apiClient.downloadGovBrSigningPdf(result.job.id);downloadBrowserFile(file.blob,file.fileName);setSigningMessage('PDF preparado e baixado. O Assinador Gov.br foi aberto em outra aba; depois da assinatura, envie o PDF assinado na ficha do TCC.');await loadData();}
    catch(error){signerWindow?.close();setSigningMessage(error instanceof Error?error.message:'Não foi possível preparar a assinatura Gov.br.');}
    finally{setSigningIds(prev=>prev.filter(id=>id!==processId));}
  };

  const handleSignSelectedGov = async () => {
    const pendingIds=new Set(pendingItems.map(item=>item.process.id));const ids=selectedIds.filter(id=>pendingIds.has(id)&&isDeclarationActionable(id));
    if(ids.length<2){setSigningMessage('Selecione pelo menos dois trabalhos para usar a assinatura em bloco.');return;}
    window.open('https://assinador.iti.br/','_blank','noopener,noreferrer');setSigningIds(prev=>Array.from(new Set([...prev,...ids])));let completed=0;const failures:string[]=[];
    for(const id of ids){try{const result=await apiClient.signProcessDocument(id,'DECLARACAO','GOV_BR');const file=await apiClient.downloadGovBrSigningPdf(result.job.id);downloadBrowserFile(file.blob,file.fileName);completed++;}catch(error){const proc=pendingItems.find(item=>item.process.id===id)?.process;failures.push(`${proc?.protocolo||id}: ${error instanceof Error?error.message:'falha'}`);}}
    setSigningIds(prev=>prev.filter(id=>!ids.includes(id)));setSelectedIds([]);await loadData();setSigningMessage(failures.length?`${completed} PDF(s) Gov.br preparados; ${failures.length} falha(s): ${failures.join(' | ')}`:`${completed} PDF(s) preparados. Assine-os no Gov.br e envie os arquivos assinados pelas fichas dos TCCs.`);
  };

  const getGovDeclarationJob = (processId: string): SignatureJob | undefined =>
    signatureJobs.filter((job) => job.processId === processId && job.documentType === 'DECLARACAO' && job.provider === 'GOV_BR').sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];

  const handleGovSignedUpload = async (processId: string, file: File) => {
    const job = getGovDeclarationJob(processId);
    if (!job) { setSigningMessage('Prepare primeiro o PDF para assinatura Gov.br.'); return; }
    if (signingIds.includes(processId)) return;
    setSigningIds((prev) => [...prev, processId]); setSigningMessage('');
    try { await apiClient.uploadGovBrSignedPdf(job.id, processId, file); setSigningMessage('Arquivo assinado no Gov.br recebido e associado ao TCC.'); await loadData(); }
    catch (error) { setSigningMessage(error instanceof Error ? error.message : 'Não foi possível enviar o arquivo assinado.'); }
    finally { setSigningIds((prev) => prev.filter((id) => id !== processId)); }
  };

  const renderSignatureActionCell = (proc: ProcessData) => {
    const job=getDeclarationJob(proc.id);const govJob=getGovDeclarationJob(proc.id);const working=signingIds.includes(proc.id);const status=getDeclarationStatus(proc.id);const actionable=isDeclarationActionable(proc.id);
    const govUploadAvailable=Boolean(govJob && !['SIGNED','ARCHIVED','CANCELED'].includes(govJob.status));
    return <td className={`${styles.cellPadClass} ${styles.borderClass} min-w-[210px] text-center align-middle`}><div className="flex flex-wrap items-center justify-center gap-1.5"><button type="button" onClick={()=>handleSignOne(proc.id)} disabled={working||!actionable} className="portal-sign-provider-btn" title="Assinar esta declaração pela Asten"><Shield className="h-3.5 w-3.5"/><span>Asten</span></button><button type="button" onClick={()=>void handleGovOne(proc.id)} disabled={working||!actionable} className="portal-sign-provider-btn" title="Preparar PDF e abrir o Assinador Gov.br"><FileCheck className="h-3.5 w-3.5"/><span>Gov</span></button>{govUploadAvailable&&<label className="portal-sign-provider-btn cursor-pointer" title="Enviar o PDF já assinado no Gov.br"><input type="file" accept="application/pdf,.pdf" className="hidden" onChange={(event)=>{const file=event.currentTarget.files?.[0];event.currentTarget.value='';if(file)void handleGovSignedUpload(proc.id,file);}}/><Download className="h-3.5 w-3.5 rotate-180"/><span>Enviar assinado</span></label>}</div>{!actionable&&<span className={`mt-1 inline-flex rounded-full border px-2 py-0.5 text-[8px] font-black uppercase ${status.tone}`} title={job?.lastError||status.label}>{status.label}</span>}</td>;
  };

  // Download only the authenticated declaration already signed by Asten and archived in Drive.
  const handleDownloadPdfs = async (procList: any[]) => {
    if (procList.length === 0) return;
    const rawProcs: ProcessData[] = procList.map((item) => item.process || item);
    setDownloadError('');

    for (const proc of rawProcs) {
      try {
        const { blob, fileName } = await apiClient.downloadProcessDocument(proc.id, 'doc-declaracao');
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        setDownloadedIds((prev) => prev.includes(proc.id) ? prev : [...prev, proc.id]);
        await new Promise((resolve) => setTimeout(resolve, 250));
      } catch (error) {
        setDownloadError(error instanceof Error ? error.message : 'Não foi possível baixar a declaração assinada.');
        break;
      }
    }
  };


  const renderHeaderCell = (colKey: string) => {
    if (!visibleColumns[colKey]) return null;

    const colDef = ALL_COORDINATOR_COLUMNS.find(c => c.key === colKey);
    const rawLabel = colDef?.label || labelMap[colKey] || colKey;
    const formattedLabel = formatColumnLabel(colKey, rawLabel, coordTextFormat, customLabels);
    const widthClass = `${getColWidthClass(colKey, columnWidths, 'min-w-[95px]')} ${getColumnWeightClass(colKey, coordTextFormat)}`;

    const sortableKeys = ['protocolo', 'envioStatus', 'defesaDataHora', 'titulo', 'aluno1', 'aluno2', 'orientador', 'defesaLocal', 'resumo', 'palavrasChave'];
    const isSortable = sortableKeys.includes(colKey);

    return (
      <th
        key={colKey}
        onClick={isSortable ? () => handleSort(colKey) : undefined}
        className={`${styles.headerThClass} ${styles.cellPadClass} ${widthClass} ${styles.headerWeightClass} ${styles.headerTextColorClass} ${styles.headerFontSizeClass} ${styles.headerCasingClass} ${styles.headerBorderClass} ${styles.headerAlignClass} align-middle ${isSortable ? `cursor-pointer ${styles.headerThHoverClass}` : ''} select-none transition-colors group`}
      >
        <div className={`flex items-center justify-center gap-1 ${styles.headerWrapClass}`}>
          <span>{formattedLabel}</span>
          {isSortable && renderSortArrow(colKey, isDarkTheme)}
        </div>
      </th>
    );
  };

  const renderCell = (item: any, colKey: string) => {
    if (!visibleColumns[colKey]) return null;

    const proc = activeTab === 'pendentes' ? item.process : item;
    const cellClass = `${styles.cellPadClass} ${getColWidthClass(colKey, columnWidths, 'min-w-[95px]')} ${getColumnWeightClass(colKey, coordTextFormat)} ${styles.borderClass} align-middle ${styles.cellAlignClass}`;

    const cleanInst = (str?: string) => {
      if (!str) return '';
      return str.replace(/^\s*\(\s*/, '').replace(/\s*\)\s*$/, '').trim();
    };

    switch (colKey) {
      case 'protocolo': {
        const job = getDeclarationJob(proc.id);
        const signed = proc.status === 'CONCLUIDO' || Boolean(job && ['SIGNED', 'DRIVE_SYNC_PENDING', 'ARCHIVED'].includes(job.status));
        const tone = signed ? PORTAL_SEMANTIC_COLORS.signature.signed : PORTAL_SEMANTIC_COLORS.signature.pending;
        return (
          <td key={colKey} onClick={(e) => { e.stopPropagation(); onSelectProcess(proc.id); }} className={`${cellClass} cursor-pointer`} title="Abrir TCC">
            <span className="portal-process-pill" style={{ backgroundColor: tone.bg, borderColor: tone.border, color: tone.text }}>
              {normalizeProcessNumber(proc.protocolo || proc.id)}
            </span>
          </td>
        );
      }

      case 'envioStatus': {
        const isSent = activeTab === 'concluidos';
        return (
          <td key={colKey} className={cellClass}>
            <div className="flex flex-col items-center gap-1 mx-auto">
              {activeTab === 'pendentes' ? (() => {
                const signatureStatus = getDeclarationStatus(proc.id);
                return (
                  <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[9px] font-black uppercase ${signatureStatus.tone}`}>
                    {signatureStatus.label}
                  </span>
                );
              })() : (
                <>
                  <span className="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 bg-emerald-100 text-emerald-950 border border-emerald-300 rounded-full select-none leading-none">
                    🟢 Enviada
                  </span>
                  <span className="text-[9.5px] text-emerald-800 font-bold flex items-center gap-0.5 select-none leading-none">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" /> Publicada
                  </span>
                </>
              )}
            </div>
          </td>
        );
      }

      case 'defesaDataHora':
        return (
          <td key={colKey} className={`${cellClass} ${styles.cellWeightClass} ${styles.cellTextColorClass}`}>
            <div className={`flex items-center justify-center ${styles.cellFontSizeClass}`}>
              <span className="font-normal text-black">{proc.defesa?.startAt ? formatDateNumeric(proc.defesa.startAt) : 'N/A'}</span>
            </div>
            {proc.defesa?.startAt && (
              <div className="text-[9.5px] font-mono font-normal text-black">{formatTimeExtenso(proc.defesa.startAt)}</div>
            )}
          </td>
        );

      case 'titulo':
        return (
          <td key={colKey} className={`${cellClass} ${styles.cellWeightClass} ${styles.cellTextColorClass}`}>
            <div className={`${styles.cellWrapClass} ${styles.cellFontSizeClass} max-w-sm mx-auto`} title={formatTccTitle(proc.titulo)}>
              {formatCellText('titulo', formatTccTitle(proc.titulo), coordTextFormat, '📖')}
            </div>
          </td>
        );

      case 'aluno1':
        return (
          <td key={colKey} className={cellClass}>
            <div className="w-full mx-auto">
              <div className={`${styles.cellWeightClass} ${styles.cellTextColorClass} ${styles.cellFontSizeClass} ${styles.cellWrapClass}`}>
                {formatCellText('aluno1', cleanPersonName(proc.aluno1?.nome || '—'), coordTextFormat, '🎓')}
              </div>
              {proc.aluno1?.matricula && (
                <div className="text-[9px] text-slate-500 font-mono font-medium mt-0.5">Matrícula: {proc.aluno1.matricula}</div>
              )}
            </div>
          </td>
        );

      case 'aluno2':
        return (
          <td key={colKey} className={cellClass}>
            <div className="w-full mx-auto">
              {proc.aluno2?.nome ? (
                <>
                  <div className={`${styles.cellWeightClass} ${styles.cellTextColorClass} ${styles.cellFontSizeClass} ${styles.cellWrapClass}`}>
                    {formatCellText('aluno2', cleanPersonName(proc.aluno2.nome), coordTextFormat, '🎓')}
                  </div>
                  {proc.aluno2?.matricula && (
                    <div className="text-[9px] text-slate-500 font-mono font-medium mt-0.5">Matrícula: {proc.aluno2.matricula}</div>
                  )}
                </>
              ) : (
                <span className="text-slate-400 font-mono text-[11px]">—</span>
              )}
            </div>
          </td>
        );

      case 'orientador':
        return (
          <td key={colKey} className={cellClass}>
            <div className="w-full mx-auto">
              <div className={`${styles.cellWeightClass} ${styles.cellTextColorClass} ${styles.cellFontSizeClass} ${styles.cellWrapClass}`}>
                {formatCellText('orientador', formatProfessorName(proc.orientador?.nome), coordTextFormat, '👨‍🏫')}
              </div>
              <div className="text-[9px] text-slate-600 font-mono font-medium mt-0.5 leading-tight break-words">
                📍 {cleanInst(proc.orientador?.instituicao || installationProfile.defaultInstitutionName)}
              </div>
            </div>
          </td>
        );

      case 'membro1': {
        const members = (proc.banca || []).filter((b: any) => b.funcao !== 'ORIENTADOR');
        const memb = members[0];
        return (
          <td key={colKey} className={cellClass}>
            <div className="w-full mx-auto">
              {memb?.nome ? (
                <>
                  <div className={`${styles.cellWeightClass} ${styles.cellTextColorClass} ${styles.cellFontSizeClass} ${styles.cellWrapClass}`}>
                    {formatCellText('membro1', formatProfessorName(memb.nome), coordTextFormat, '👥')}
                  </div>
                  <div className="text-[9px] text-slate-600 font-mono font-medium mt-0.5 leading-tight break-words">
                    📍 {cleanInst(memb.instituicao || installationProfile.defaultInstitutionName)}
                  </div>
                </>
              ) : (
                <span className="text-slate-400 font-mono text-[11px]">—</span>
              )}
            </div>
          </td>
        );
      }

      case 'membro2': {
        const members = (proc.banca || []).filter((b: any) => b.funcao !== 'ORIENTADOR');
        const memb = members[1];
        return (
          <td key={colKey} className={cellClass}>
            <div className="w-full mx-auto">
              {memb?.nome ? (
                <>
                  <div className={`${styles.cellWeightClass} ${styles.cellTextColorClass} ${styles.cellFontSizeClass} ${styles.cellWrapClass}`}>
                    {formatCellText('membro2', formatProfessorName(memb.nome), coordTextFormat, '👥')}
                  </div>
                  <div className="text-[9px] text-slate-600 font-mono font-medium mt-0.5 leading-tight break-words">
                    📍 {cleanInst(memb.instituicao || installationProfile.defaultInstitutionName)}
                  </div>
                </>
              ) : (
                <span className="text-slate-400 font-mono text-[11px]">—</span>
              )}
            </div>
          </td>
        );
      }

      case 'coorientador':
        return (
          <td key={colKey} className={cellClass}>
            <div className="w-full mx-auto">
              {proc.coorientador?.nome ? (
                <>
                  <div className={`${styles.cellWeightClass} ${styles.cellTextColorClass} ${styles.cellFontSizeClass} ${styles.cellWrapClass}`}>
                    {formatCellText('coorientador', formatProfessorName(proc.coorientador.nome), coordTextFormat, '👥')}
                  </div>
                  <div className="text-[9px] text-slate-600 font-mono font-medium mt-0.5 leading-tight break-words">
                    📍 {cleanInst(proc.coorientador.instituicao || installationProfile.defaultInstitutionName)}
                  </div>
                </>
              ) : (
                <span className="text-slate-400 font-mono text-[11px]">—</span>
              )}
            </div>
          </td>
        );

      case 'resumo': {
        const text = proc.acervo?.resumoSintese || (proc.titulo ? `TCC: ${proc.titulo}` : 'Sem resumo');
        return (
          <td key={colKey} className={`${cellClass} text-slate-500`}>
            <div className={`${styles.cellWrapClass} ${styles.cellFontSizeClass} line-clamp-2 max-w-[200px] mx-auto`} title={text}>
              {formatCellText('resumo', text, coordTextFormat, '📝')}
            </div>
          </td>
        );
      }

      case 'palavrasChave': {
        const keywords = (proc.acervo?.palavrasChave || []).slice(0, 5).join('; ');
        return (
          <td key={colKey} className={`${cellClass} text-slate-500`}>
            <div className={`${styles.cellWrapClass} ${styles.cellFontSizeClass} line-clamp-2 max-w-[150px] mx-auto`} title={keywords}>
              {formatCellText('palavrasChave', keywords, coordTextFormat, '🔑')}
            </div>
          </td>
        );
      }

      case 'defesaLocal': {
        const loc = proc.defesa?.local || 'A definir';
        return (
          <td key={colKey} className={`${cellClass} text-slate-500`}>
            <div className={`${styles.cellWrapClass} ${styles.cellFontSizeClass} line-clamp-2 max-w-[150px] mx-auto`}>
              {formatCellText('defesaLocal', loc, coordTextFormat, '📍')}
            </div>
          </td>
        );
      }

      default:
        return null;
    }
  };

  const getSortedAndFilteredItems = (items: any[], wrappedQueueItem: boolean) => {
    return [...items].sort((itemA, itemB) => {
      const pA = wrappedQueueItem ? itemA?.process : itemA;
      const pB = wrappedQueueItem ? itemB?.process : itemB;
      if (!pA || !pB) return 0;

      let valA: any = '';
      let valB: any = '';

      switch (sortField) {
        case 'protocolo':
          valA = pA.protocolo || pA.id || '';
          valB = pB.protocolo || pB.id || '';
          break;
        case 'envioStatus':
          valA = wrappedQueueItem ? 'Aguardando Envio' : 'Enviado';
          valB = wrappedQueueItem ? 'Aguardando Envio' : 'Enviado';
          break;
        case 'defesaDataHora':
          valA = pA.defesa?.startAt || '';
          valB = pB.defesa?.startAt || '';
          break;
        case 'titulo':
          valA = pA.titulo || '';
          valB = pB.titulo || '';
          break;
        case 'aluno1':
          valA = pA.aluno1?.nome || '';
          valB = pB.aluno1?.nome || '';
          break;
        case 'aluno2':
          valA = pA.aluno2?.nome || '';
          valB = pB.aluno2?.nome || '';
          break;
        case 'orientador':
          valA = pA.orientador?.nome || '';
          valB = pB.orientador?.nome || '';
          break;
        case 'membro1': {
          const membersA = (pA.banca || []).filter((b: any) => b.funcao !== 'ORIENTADOR');
          const membersB = (pB.banca || []).filter((b: any) => b.funcao !== 'ORIENTADOR');
          valA = membersA[0]?.nome || '';
          valB = membersB[0]?.nome || '';
          break;
        }
        case 'membro2': {
          const membersA = (pA.banca || []).filter((b: any) => b.funcao !== 'ORIENTADOR');
          const membersB = (pB.banca || []).filter((b: any) => b.funcao !== 'ORIENTADOR');
          valA = membersA[1]?.nome || '';
          valB = membersB[1]?.nome || '';
          break;
        }
        case 'coorientador':
          valA = pA.coorientador?.nome || '';
          valB = pB.coorientador?.nome || '';
          break;
        case 'resumo':
          valA = pA.acervo?.resumoSintese || '';
          valB = pB.acervo?.resumoSintese || '';
          break;
        case 'palavrasChave':
          valA = (pA.acervo?.palavrasChave || []).join(' ');
          valB = (pB.acervo?.palavrasChave || []).join(' ');
          break;
        case 'defesaLocal':
          valA = pA.defesa?.local || '';
          valB = pB.defesa?.local || '';
          break;
        default:
          break;
      }

      if (typeof valA === 'string') valA = valA.toLowerCase();
      if (typeof valB === 'string') valB = valB.toLowerCase();

      if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
      if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  };

  const sortedPending = getSortedAndFilteredItems(pendingItems, true);
  const sortedCompleted = getSortedAndFilteredItems(completedItems, false);

  const limitedPending = recordsLimit === 'all' ? sortedPending : sortedPending.slice(0, recordsLimit);
  const limitedCompleted = recordsLimit === 'all' ? sortedCompleted : sortedCompleted.slice(0, recordsLimit);

  const actionStyles = getActionPillStyles(coordTextFormat);

  return (
    <div id="coordenador-page-root" className="space-y-3 max-w-7xl mx-auto py-1.5">
      {downloadError && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-800">
          {downloadError}
        </div>
      )}
      {signingMessage && (
        <div role="status" className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800">
          {signingMessage}
        </div>
      )}
      {activeTab === 'pendentes' && astenStatus && !astenStatus.dispatchEnabled && (
        <div role="status" className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900">
          Asten ainda requer configuração para despacho. As declarações continuam visíveis nesta fila até a integração estar pronta.
        </div>
      )}

      {/* CABEÇALHO UNIFICADO DA COORDENAÇÃO */}
      <section className="space-y-3">
        {/* UNIFIED GRAY HEADER + TABLE CARD */}
        <div className={`bg-white border border-slate-300 rounded-2xl shadow-sm overflow-hidden ${styles.fontFamilyClass}`} style={styles.rootStyle}>
          {/* Header Banner */}
          <div className={`${styles.bannerHeaderClass} border-b transition-colors`} style={styles.bannerHeaderStyle}>
            {/* Main Title Row */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 px-3.5 py-3 sm:px-4 sm:py-3.5">
              <div className="flex items-center gap-2">
                <ColorfulHeaderIcon type="coordination" textFormat={coordTextFormat} />
                <h1 className="text-base sm:text-lg font-black uppercase tracking-tight leading-snug">
                  {getEditableTableText(customLabels, '__tableTitle', 'Gestão e Assinatura de Declarações')}
                </h1>
              </div>

              {/* Ações: provedores primeiro; depois controles padrão da tabela */}
              <div className="flex items-center shrink-0">
                {activeTab === 'pendentes' && (
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    <button type="button" disabled={selectedIds.length < 2 || signingIds.length > 0} onClick={handleSignSelected} className={`${styles.toolbarButtonClass} portal-sign-bulk-btn disabled:opacity-45`} style={styles.toolbarButtonStyle} title="Assinar selecionados pela Asten"><Shield className="h-3.5 w-3.5"/><span>Asten</span></button>
                    <button type="button" disabled={selectedIds.length < 2 || signingIds.length > 0} onClick={()=>void handleSignSelectedGov()} className={`${styles.toolbarButtonClass} portal-sign-bulk-btn disabled:opacity-45`} style={styles.toolbarButtonStyle} title="Preparar selecionados para assinatura Gov.br"><FileCheck className="h-3.5 w-3.5"/><span>Gov</span></button>
                  </div>
                )}

                <div className={`flex items-center gap-1.5 sm:gap-2 ${activeTab === 'pendentes' ? 'ml-3 border-l border-white/35 pl-3' : ''}`}>
                  <SearchPopover
                    value={searchFilter}
                    onChange={setSearchFilter}
                    placeholder="Buscar declarações..."
                    textFormat={coordTextFormat}
                  />
                  <button
                    type="button"
                    onClick={handleRefresh}
                    disabled={isRefreshing}
                    className={`${styles.toolbarButtonClass} disabled:opacity-70`}
                    style={styles.toolbarButtonStyle}
                    title="Atualizar fila de declarações"
                  >
                    <YinYangIcon className={`w-3.5 h-3.5 text-current ${isRefreshing ? 'animate-spin' : ''}`} />
                  </button>
                  <HeaderSettingsPopover
                    recordsLimit={recordsLimit}
                    setRecordsLimit={setRecordsLimit}
                    allowedLimits={[25, 50, 100, 'all']}
                    allColumns={ALL_COORDINATOR_COLUMNS}
                    visibleColumns={visibleColumns}
                    setVisibleColumns={setVisibleColumns}
                    columnOrder={columnOrder}
                    setColumnOrder={setColumnOrder}
                    storageKey="coordinator"
                    customLabels={customLabels}
                    setCustomLabels={setCustomLabels}
                    defaultColumnOrder={DEFAULT_COORDINATOR_ORDER}
                    defaultVisibleColumns={DEFAULT_COORDINATOR_VISIBLE}
                    defaultRecordsLimit={25}
                    columnWidths={columnWidths}
                    setColumnWidths={setColumnWidths}
                    textFormat={coordTextFormat}
                    setTextFormat={setCoordTextFormat}
                    startDate={startDate}
                    setStartDate={setStartDate}
                    endDate={endDate}
                    setEndDate={setEndDate}
                    defaultTableTitle="Gestão e Assinatura de Declarações"
                    defaultFilterTitle="Filtrar declarações"
                  />
                </div>
              </div>
            </div>

            {/* INTEGRATED TOOLBAR BAR (Single clean dividing line) */}
            <div className="portal-coordinator-filter-row flex flex-wrap items-center justify-between gap-3 border-t-2 border-white px-3.5 py-2.5 text-xs sm:px-4">
              {/* Filter Row Switcher with FILTRAR prefix following site standard */}
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[10px] font-extrabold uppercase tracking-wider shrink-0 mr-1 opacity-80">
                  {getEditableTableText(customLabels, '__filterTitle', 'FILTRAR:')}
                </span>
                <div className="flex flex-wrap items-center gap-1.5">
                  {([
                    { key: 'pendentes', label: getEditableTableText(customLabels, '__tabPendentes', 'Pendentes'), count: queue.length, tab: 'pendentes' as const },
                    { key: 'assinadas', label: getEditableTableText(customLabels, '__tabConcluidos', 'Assinadas'), count: completedItems.length, tab: 'concluidos' as const }
                  ]).map((filter) => {
                    const isSelected = activeTab === filter.tab;
                    const chip = getFilterChipProps(filter.key, isSelected, coordTextFormat, filter.label);
                    const semanticTone = filter.key === 'assinadas' ? PORTAL_SEMANTIC_COLORS.signature.signed : PORTAL_SEMANTIC_COLORS.signature.pending;
                    return (
                      <button
                        key={filter.key}
                        type="button"
                        onClick={() => { setActiveTab(filter.tab); setSelectedIds([]); }}
                        data-selected={isSelected ? 'true' : 'false'}
                        aria-pressed={isSelected}
                        style={{ backgroundColor: semanticTone.bg, color: semanticTone.text, borderColor: semanticTone.border, opacity: isSelected ? 1 : 0.62, boxShadow: isSelected ? `inset 0 0 0 1px ${semanticTone.border}` : 'none' }}
                        className={`portal-standard-filter-chip portal-table-filter-chip flex items-center gap-1.5 px-3 py-1 rounded-full font-black text-[10px] uppercase tracking-wider cursor-pointer transition-colors h-7 shrink-0 border select-none ${isSelected ? '' : 'opacity-85 hover:opacity-100'}`}
                        title={`Filtrar por declarações ${filter.label.toLowerCase()}`}
                      >
                        <span className="w-2 h-2 rounded-full shrink-0 shadow-2xs" style={{ backgroundColor: semanticTone.border }} />
                        <span className="whitespace-nowrap font-extrabold">{chip.label}</span>
                        <span className="text-[9px] px-1.5 py-0.2 rounded-full font-black shadow-2xs" style={{ backgroundColor: semanticTone.border, color: '#ffffff' }}>{filter.count}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* CONTEÚDO PRINCIPAL: TABELA E LISTA DE DECLARAÇÕES */}
          <div className="w-full">
            {activeTab === 'pendentes' && (
              <>
                {isLoading ? (
                  <div className="p-12 text-center text-xs font-semibold text-slate-500">
                    Carregando declarações pendentes...
                  </div>
                ) : pendingItems.length === 0 ? (
                  <div className="p-12 text-center bg-slate-50 text-slate-600 text-xs font-medium space-y-1">
                    <CheckCircle2 className="w-8 h-8 text-emerald-700 mx-auto mb-2" />
                    <p className="font-bold text-slate-900 uppercase">Sua fila de declarações está 100% assinada e limpa!</p>
                    <p className="text-slate-500">Não há declarações pendentes de assinatura do Presidente neste momento.</p>
                  </div>
                ) : (
                  <TableScrollWrapper>
                    <table className="w-full text-center border-collapse text-xs">
                      <thead className={`${styles.headerTheadClass} ${styles.headerTextColorClass} ${styles.headerFontSizeClass} ${styles.headerWeightClass} ${styles.headerCasingClass} ${styles.headerBorderClass}`} style={styles.theadStyle}>
                        <tr>
                          {/* Always show selection column for pending */}
                          <th data-portal-selection-column="true" data-portal-column-label="Seleção" className={`${styles.headerThClass} ${styles.cellPadClass} w-10 text-center align-middle ${styles.headerBorderClass}`}>
                            <button
                              type="button"
                              onClick={toggleSelectAllPending}
                              className={`cursor-pointer ${isDarkTheme ? 'text-white/80 hover:text-white' : 'text-slate-600 hover:text-emerald-800'} flex justify-center mx-auto`}
                              title="Selecionar/Deselecionar todos"
                            >
                              {selectedIds.length === pendingItems.length ? (
                                <CheckSquare className={`w-4 h-4 ${isDarkTheme ? 'text-emerald-300' : 'text-emerald-700'}`} />
                              ) : (
                                <Square className={`w-4 h-4 ${isDarkTheme ? 'text-white/60' : 'text-slate-500'}`} />
                              )}
                            </button>
                          </th>
                          {columnOrder.map((colKey) => renderHeaderCell(colKey))}
                          <th className={`${styles.headerThClass} ${styles.cellPadClass} min-w-[150px] text-center align-middle ${styles.headerBorderClass}`}>
                            <span>Asten</span>
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 bg-white">
                        {limitedPending.map((item) => {
                          const proc = item.process;
                          const isSelected = selectedIds.includes(proc.id);
                          return (
                            <tr
                              key={proc.id}
                              className={`hover:bg-slate-50 transition-colors ${isSelected ? 'bg-emerald-50/40' : ''}`}
                            >
                              {/* Selection Checkbox */}
                              <td data-portal-selection-column-cell="true" data-portal-filter-value={isSelected ? 'Selecionado' : 'Não selecionado'} className={`${styles.cellPadClass} ${styles.borderClass} text-center align-middle`}>
                                <button
                                  type="button"
                                  onClick={() => toggleSelectItem(proc.id)}
                                  className="cursor-pointer text-slate-400 hover:text-emerald-700 flex justify-center mx-auto"
                                >
                                  {isSelected ? (
                                    <CheckSquare className="w-4.5 h-4.5 text-emerald-700" />
                                  ) : (
                                    <Square className="w-4.5 h-4.5 text-slate-300" />
                                  )}
                                </button>
                              </td>
                              {columnOrder.map((colKey) => renderCell(item, colKey))}
                              {renderSignatureActionCell(proc)}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </TableScrollWrapper>
                )}
              </>
            )}

            {/* TAB 2: DECLARAÇÕES ASSINADAS (HISTÓRICO) */}
            {activeTab === 'concluidos' && (
              <>
                {completedItems.length === 0 ? (
                  <div className="p-12 text-center bg-slate-50 text-slate-600 text-xs font-medium">
                    Nenhum processo assinado encontrado com os termos pesquisados.
                  </div>
                ) : (
                  <TableScrollWrapper>
                    <table className="w-full text-center border-collapse text-xs">
                      <thead className={`${styles.headerTheadClass} ${styles.headerTextColorClass} ${styles.headerFontSizeClass} ${styles.headerWeightClass} ${styles.headerCasingClass} ${styles.headerBorderClass}`}>
                        <tr>
                          {/* Always show selection column for completed to align perfectly */}
                          <th data-portal-selection-column="true" data-portal-column-label="Seleção" className={`${styles.headerThClass} ${styles.cellPadClass} w-10 text-center align-middle ${styles.headerBorderClass}`}>
                            <button
                              type="button"
                              onClick={() => {
                                if (selectedIds.length === completedItems.length && completedItems.length > 0) {
                                  setSelectedIds([]);
                                } else {
                                  setSelectedIds(completedItems.map(p => p.id));
                                }
                              }}
                              className={`cursor-pointer ${isDarkTheme ? 'text-white/80 hover:text-white' : 'text-slate-600 hover:text-emerald-800'} flex justify-center mx-auto`}
                              title="Selecionar/Deselecionar todos"
                            >
                              {selectedIds.length === completedItems.length && completedItems.length > 0 ? (
                                <CheckSquare className={`w-4 h-4 ${isDarkTheme ? 'text-emerald-300' : 'text-emerald-700'}`} />
                              ) : (
                                <Square className={`w-4 h-4 ${isDarkTheme ? 'text-white/60' : 'text-slate-500'}`} />
                              )}
                            </button>
                          </th>
                          {columnOrder.map((colKey) => renderHeaderCell(colKey))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 bg-white">
                        {limitedCompleted.map((proc) => {
                          const isSelected = selectedIds.includes(proc.id);
                          return (
                            <tr
                              key={proc.id}
                              className={`transition-colors text-black ${isSelected ? 'bg-emerald-50/40' : ''}`}
                            >
                              {/* Selection Checkbox */}
                              <td data-portal-selection-column-cell="true" data-portal-filter-value={isSelected ? 'Selecionado' : 'Não selecionado'} className={`${styles.cellPadClass} ${styles.borderClass} text-center align-middle`}>
                                <button
                                  type="button"
                                  onClick={() => toggleSelectItem(proc.id)}
                                  className="cursor-pointer text-slate-400 hover:text-emerald-700 flex justify-center mx-auto"
                                >
                                  {isSelected ? (
                                    <CheckSquare className="w-4.5 h-4.5 text-emerald-700" />
                                  ) : (
                                    <Square className="w-4.5 h-4.5 text-slate-300" />
                                  )}
                                </button>
                              </td>
                              {columnOrder.map((colKey) => renderCell(proc, colKey))}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </TableScrollWrapper>
                )}
              </>
            )}
          </div>
        </div>
      </section>

    </div>
  );
};
