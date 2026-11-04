import {formatDateTimeWithWeekday} from '../utils/formatters';
import {participantRole} from '../utils/officialParticipants';
import {ProcessSummaryCard} from '../components/ProcessSummaryCard';
import {LegacyAdministrativeDocuments} from '../components/LegacyAdministrativeDocuments';
import {ProcessDocumentCard, ProcessDocumentsPanel, ReservationReceiptCard} from '../components/ProcessDocumentCard';
import {publicProcessDetail} from '../utils/publicProcessDetail';
import {documentSignatureCompleted,documentSignatureArchived} from '../utils/documentSignatureState';
import {defenseEndAt} from '../utils/defenseSchedule';
import {STUDENT_TREATMENTS,FACULTY_TREATMENTS,ACADEMIC_DEGREES} from '../utils/personPresentation';
import {downloadPortalDocument} from '../utils/documentDownload';
import {auditChanges} from '../utils/processAudit';
import {publicationDeclined,finalDeliveryMessage} from '../utils/finalDeliveryPresentation';
import {InlineProcessField} from '../components/InlineProcessField';
import {localDateTimeToIso} from '../utils/operationalConfig';
import {readProcessLink,setProcessLink,processLink,processWorkflowSection,type ProcessSection} from '../utils/processLink';
import { portalConfirm, portalNotice, portalPrompt } from '../services/portalDialogs';
import { AdvisorEvaluationPanel } from '../components/AdvisorEvaluationPanel';
import React, { useState, useEffect, useRef } from 'react';
import { ProcessData, ProcessDocument, ProcessRole, SignatureJob } from '../types';
import type { PrivateLegacyAcademicView } from '../types/legacyArchive';
import { TccDetailPopupFormat, DEFAULT_TCC_DETAIL_POPUP_FORMAT, loadTccDetailPopupFormat, TCC_DETAIL_POPUP_CONFIG_EVENT } from '../types/tccDetailFormat';
import { useAuth } from '../context/AuthContext';
import { apiClient, ApiRequestError } from '../services/apiClient';
import { useSignatureUpdates } from '../hooks/useSignatureUpdates';
import { PORTAL_LIVE_UPDATE_EVENT } from '../utils/portalLiveEvents';
import { formatDatePt, formatDateExtensoTotal, formatTimeExtenso, formatStudentsString, normalizeEmail, formatNameTitleCase } from '../utils/formatters';
import { ProcessFlowPanel } from '../components/ProcessFlowPanel';
import { effectiveDefenseReservationStatus } from '../utils/defenseReservationState';
import { GovbrSignatureModal } from '../components/GovbrSignatureModal';
import { PortalModalShell } from '../components/PortalModalShell';
import { EtapaProgressBar } from '../components/EtapaProgressBar';
import { StudentNames } from '../components/StudentNames';
import { DocumentPreviewModal } from '../components/DocumentPreviewModal';
import { CorrectionRequestModal } from '../components/CorrectionRequestModal';
import { resolveInstallationProfile,isPortalFeatureEnabled } from '../utils/installationProfile';
import { RegistrationFieldPreview } from '../components/RegistrationFieldPreview';
import {
  Link as LinkIcon,
  ArrowLeft,
  Calendar,
  Clock,
  MapPin,
  User,
  Users,
  Award,
  FileText,
  Eye,
  Download,
  Edit,
  Lock,
  AlertCircle,
  FileCheck,
  Send,
  MessageSquare,
  BookOpen,
  Upload,
  Save,
  Tag,
  Trash2,
  AlertTriangle,
  HardDrive,
  ExternalLink,
  Settings,
  ChevronDown,
  History,
  Check,
  ShieldCheck,
  Info,
  Building,
  GraduationCap,
  Palette,
  Sliders,
  Sparkles,
  Layers,
  Plus,
  Mail,
  IdCard
} from 'lucide-react';

interface ProcessoDetailPageProps {
  processId: string;
  onBack: () => void;
  readOnly?: boolean;
  format?: TccDetailPopupFormat;
  onUpdateFormat?: (newFormat: TccDetailPopupFormat) => void;
  isModal?: boolean;
}

interface AuditLogEntry {
  id: string;
  timestamp: string;
  user: string;
  role: string;
  action: string;
  details: string;
}


export const ProcessoDetailPage: React.FC<ProcessoDetailPageProps> = ({
  processId,
  onBack,
  readOnly = false,
  format: externalFormat,
  onUpdateFormat,
  isModal = true
}) => {
  const { isAuthenticated, userEmail, isMasterAdmin, isCommissionPresident, memberships, settings } = useAuth();
  const installationProfile = resolveInstallationProfile(settings);
  const [process, setProcess] = useState<ProcessData | null>(null);
  const [documents, setDocuments] = useState<ProcessDocument[]>([]);
  const [signatureJobs,setSignatureJobs]=useState<SignatureJob[]>([]);
  const ataIsArchived=Boolean(process&&documentSignatureArchived(signatureJobs,process.id,'ATA'));
  const [signatureWorking,setSignatureWorking]=useState('');
  const [signatureNotice,setSignatureNotice]=useState<{ok:boolean;text:string;documentType?:string}|null>(null);
  const [verifications,setVerifications]=useState<Array<{documentType:string;version:number;code:string;url:string;sha256?:string;signedAt?:string}>>([]);
  const [isDownloadingDossier,setIsDownloadingDossier]=useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const legacyAccessKey = `${processId}|${userEmail}|${isAuthenticated}|${isMasterAdmin}`;
  const legacyAccessScope = useRef(legacyAccessKey);
  legacyAccessScope.current = legacyAccessKey;
  const [privateLegacyAcademic, setPrivateLegacyAcademic] = useState<{accessKey:string;data:PrivateLegacyAcademicView|null;error:string}|null>(null);
  const privateLegacyAccess = isAuthenticated && isMasterAdmin && privateLegacyAcademic?.accessKey === legacyAccessKey ? privateLegacyAcademic : null;
  const privateLegacyData = privateLegacyAccess?.data;
  const [legacyAcademicDownload, setLegacyAcademicDownload] = useState<number|null>(null);
  const [legacyAcademicDownloadError, setLegacyAcademicDownloadError] = useState('');

  // Format and Customization State
  const [localFormat, setLocalFormat] = useState<TccDetailPopupFormat>(() => {
    if (externalFormat) return externalFormat;
    return loadTccDetailPopupFormat();
  });

  useEffect(() => {
    if (externalFormat) {
      setLocalFormat(externalFormat);
      return;
    }
    const handleFormatChange = (e: any) => {
      if (e.detail) {
        setLocalFormat(e.detail);
      } else {
        setLocalFormat(loadTccDetailPopupFormat());
      }
    };
    window.addEventListener(TCC_DETAIL_POPUP_CONFIG_EVENT, handleFormatChange);
    return () => window.removeEventListener(TCC_DETAIL_POPUP_CONFIG_EVENT, handleFormatChange);
  }, [externalFormat]);

  const [downloadPicker, setDownloadPicker] = useState(false);
  const [downloadSelection, setDownloadSelection] = useState<string[]>([]);
  const [govbrDocument, setGovbrDocument] = useState<ProcessDocument | null>(null);
  const [activeTab, setActiveTab] = useState<string>(()=>typeof window==='undefined'?'cadastral':readProcessLink(window.location.search)?.section||'cadastral');

  const [copyFeedback,setCopyFeedback]=useState<{ok:boolean;text:string;documentType?:string}|null>(null);
  useEffect(()=>{
    if(!copyFeedback)return;
    const timer=window.setTimeout(()=>setCopyFeedback(null),copyFeedback.ok?3000:6000);
    return()=>window.clearTimeout(timer);
  },[copyFeedback]);
  useEffect(()=>setCopyFeedback(null),[processId]);
  const copyProcessLink=async()=>{
    if(!process)return;
    try{
      await navigator.clipboard.writeText(processLink(window.location.origin,process.id,activeTab as ProcessSection));
      setCopyFeedback({ok:true,text:'Link do TCC copiado.'});
    }catch{setCopyFeedback({ok:false,text:'Não foi possível copiar. Use o endereço desta página.'});}
  };

  const workflowTab = useRef<{id:string;stage:string}|null>(null);
  useEffect(()=>{
    if(!process)return;
    const stage=process.legacyRecord?'cadastral':processWorkflowSection(process),previous=workflowTab.current;
    const initial=!previous||previous.id!==process.id;
    const explicitlyLinked=typeof window!=='undefined'&&new URLSearchParams(window.location.search).has('secao');
    if((initial&&!explicitlyLinked)||(!initial&&previous.stage!==stage)){
      setActiveTab(stage);setProcessLink(process.id,stage);
    }
    workflowTab.current={id:process.id,stage};
  },[process]);

  // Modals & Popovers state
  const [showGearMenu, setShowGearMenu] = useState(false);
  const [showAuditLogModal, setShowAuditLogModal] = useState(false);
  useEffect(() => {
    if (!showAuditLogModal) return;
    const closeHistoryOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setShowAuditLogModal(false); };
    window.addEventListener('keydown', closeHistoryOnEscape);
    return () => window.removeEventListener('keydown', closeHistoryOnEscape);
  }, [showAuditLogModal]);
  const [selectedPreviewDoc, setSelectedPreviewDoc] = useState<ProcessDocument | null>(null);
  const [correctionDoc, setCorrectionDoc] = useState<ProcessDocument | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmInput, setDeleteConfirmInput] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  // Section-specific Edit Mode state
  const [editingSection, setEditingSection] = useState<'cadastral' | 'defesa' | 'banca' | 'avaliacao' | 'acervo' | null>(null);
  const [remoteUpdatePending,setRemoteUpdatePending]=useState(false);
  const editingSectionRef=useRef(editingSection);
  const setSummaryEditing=React.useCallback((editing:boolean)=>{editingSectionRef.current=editing?'cadastral':null;},[]);

  const lastProcessRevision=useRef<{revision:number;updatedAt:string}|null>(null);
  const liveRefreshInFlight=useRef(false);
  const onBackRef=useRef(onBack);
  useEffect(()=>{editingSectionRef.current=editingSection;},[editingSection]);
  useEffect(()=>{onBackRef.current=onBack;},[onBack]);

  // Form states per section
  const [cadastralForm, setCadastralForm] = useState({
    titulo: '',
    cargaHoraria: '60 Horas Aula (TCC II)',
    aluno1Nome: '',
    aluno1Email: '',
    aluno1Matricula: '',
    hasAluno2: false,
    aluno2Nome: '',
    aluno2Email: '',
    aluno2Matricula: '',
    orientadorNome: '',
    orientadorEmail: '',
    orientadorInstituicao: '',
    hasCoorientador: false,
    coorientadorNome: '',
    coorientadorEmail: '',
    coorientadorInstituicao: ''
  });

  const [bancaForm, setBancaForm] = useState<any[]>([]);

  // Local Session Audit Log
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);

  // Acervo Digital Form state
  const [acervoKeywords, setAcervoKeywords] = useState('');
  const [acervoResumo, setAcervoResumo] = useState('');
  const [acervoResumoExpandido, setAcervoResumoExpandido] = useState('');
  const [acervoTrabalhoCompleto, setAcervoTrabalhoCompleto] = useState('');
  const termSignatureProvider='ASTEN' as const;
  const [acervoIsPublic, setAcervoIsPublic] = useState(false);
  const [acervoExpandedPublic, setAcervoExpandedPublic] = useState(false);
  const [isSubmittingAcervo, setIsSubmittingAcervo] = useState(false);
  const [acervoUploading, setAcervoUploading] = useState<'trabalho-completo'|'resumo-expandido'|''>('');

  const handleSaveFormat = (newFmt: TccDetailPopupFormat) => {
    setLocalFormat(newFmt);
    try {
      localStorage.setItem('tcc_detail_popup_format_v1', JSON.stringify(newFmt));
    } catch (e) {
      console.warn('Error saving tcc format:', e);
    }
    if (onUpdateFormat) onUpdateFormat(newFmt);
  };

  const loadData = async (options: { preserveAcervoDraft?: boolean; quiet?:boolean } | boolean = {}) => {
    const requestScope = legacyAccessScope.current;
    const background=options===true;
    const {preserveAcervoDraft=false,quiet=background}=typeof options==='boolean'?{}:options;
    if(!quiet)setIsLoading(true);
    if(!quiet)setErrorMsg('');
    try {
      if (readOnly) {
        const data = await apiClient.getPublicProcess(processId);
        if (isAuthenticated && data.canAccessPrivate) {
          window.dispatchEvent(new CustomEvent('portal:open-process', { detail: { id: data.privateProcessId, readOnly: false } }));
          return;
        }
        const publicDetail = publicProcessDetail(data);
        let academicAccess:typeof privateLegacyAcademic = null;
        if (data.legacyRecord && isAuthenticated && isMasterAdmin) {
          try {
            academicAccess = {accessKey:requestScope,data:await apiClient.getPrivateLegacyAcademicView(data.id),error:''};
          } catch {
            academicAccess = {accessKey:requestScope,data:null,error:'Não foi possível consultar os arquivos restritos. Reabra esta aba para tentar novamente.'};
          }
        }
        // A response started by a previous identity must never populate private content.
        if (requestScope !== legacyAccessScope.current) return;
        setPrivateLegacyAcademic(academicAccess);
        setProcess(publicDetail.process); setDocuments(publicDetail.documents);
        setSignatureJobs([]); setVerifications([]); setAuditLogs([]);
        return;
      }
      const [pData, docsData,signatureData,verificationData,recordedLogs] = await Promise.all([
        apiClient.getProcessById(processId),
        apiClient.getProcessDocuments(processId).catch(() => []),
        apiClient.getProcessSignatureJobs(processId).catch(() => []),
        isPortalFeatureEnabled(settings,'PUBLIC_AUTHENTICITY')?apiClient.getProcessVerifications(processId).catch(() => []):Promise.resolve([]),
        apiClient.getProcessAuditLogs(processId)
      ]);
      if(background && editingSectionRef.current){
        const latest=lastProcessRevision.current;
        if(latest && (latest.revision!==pData.dataRevision || latest.updatedAt!==pData.updatedAt)){
          setRemoteUpdatePending(true);
        }
        return;
      }
      lastProcessRevision.current={revision:pData.dataRevision,updatedAt:pData.updatedAt};
      setRemoteUpdatePending(false);
      setProcess(pData);
      setDocuments(docsData);
      setSignatureJobs(signatureData);
      setVerifications(verificationData);

      // Populate Cadastral Form
      setCadastralForm({
        titulo: pData.titulo || '',
        cargaHoraria: '60 Horas Aula (TCC II)',
        aluno1Nome: pData.aluno1?.nome || '',
        aluno1Email: pData.aluno1?.email || '',
        aluno1Matricula: pData.aluno1?.matricula || '',
        hasAluno2: Boolean(pData.aluno2),
        aluno2Nome: pData.aluno2?.nome || '',
        aluno2Email: pData.aluno2?.email || '',
        aluno2Matricula: pData.aluno2?.matricula || '',
        orientadorNome: pData.orientador?.nome || '',
        orientadorEmail: pData.orientador?.email || '',
        orientadorInstituicao: pData.orientador?.instituicao || installationProfile.defaultInstitutionName,
        hasCoorientador: Boolean(pData.coorientador),
        coorientadorNome: pData.coorientador?.nome || '',
        coorientadorEmail: pData.coorientador?.email || '',
        coorientadorInstituicao: pData.coorientador?.instituicao || installationProfile.defaultInstitutionName
      });

      // Populate Banca Form
      setBancaForm(pData.banca ? JSON.parse(JSON.stringify(pData.banca)) : []);

      // Populate Acervo Form
      if (pData.acervo) {
        setAcervoResumoExpandido(pData.acervo.resumoExpandidoFileName || '');
        setAcervoTrabalhoCompleto(pData.acervo.trabalhoCompletoFileName || '');
        // Upload refreshes persisted file references without replacing unsaved final-data fields.
        if (!preserveAcervoDraft) {
          setAcervoKeywords(pData.acervo.palavrasChave ? pData.acervo.palavrasChave.join(', ') : '');
          setAcervoResumo(pData.acervo.resumoSintese || '');
          setAcervoIsPublic(Boolean(pData.acervo.publishFullWork));
          setAcervoExpandedPublic(Boolean(pData.acervo.publishExpandedAbstract));
        }
      }

      setAuditLogs(recordedLogs.map(log=>({id:log.id,timestamp:formatDateTimeWithWeekday(log.timestamp),user:log.actorEmail,role:log.actorRoles.join(', '),action:log.action,details:auditChanges(log)})));

    } catch (err: any) {
      if(background && err instanceof ApiRequestError && err.status===404){
        portalNotice('Este TCC não está mais disponível. Ele pode ter sido excluído ou seu acesso foi alterado.');
        onBackRef.current();
        return;
      }
      if(!background && !quiet)setErrorMsg(err.message || 'Erro ao carregar o processo.');
      if(quiet)throw err;
    } finally {
      if(!quiet)setIsLoading(false);
    }
  };

  useEffect(() => {
    lastProcessRevision.current=null;
    setRemoteUpdatePending(false);
    setSignatureNotice(null);
    loadData();
  }, [processId, userEmail, readOnly, isAuthenticated, isMasterAdmin]);

  const downloadPrivateLegacyFile = async (index:number) => {
    if (!privateLegacyData || !process?.legacyRecord || legacyAcademicDownload !== null) return;
    const requestScope = legacyAccessScope.current;
    setLegacyAcademicDownload(index); setLegacyAcademicDownloadError('');
    try {
      const {blob,fileName} = await apiClient.downloadPrivateLegacyAcademicFile(process.id,index);
      if (requestScope !== legacyAccessScope.current) return;
      const url = URL.createObjectURL(blob), anchor = document.createElement('a');
      anchor.href = url; anchor.download = fileName; anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url),30000);
    } catch {
      if (requestScope === legacyAccessScope.current) setLegacyAcademicDownloadError('Não foi possível conferir e baixar o arquivo. O original permanece preservado.');
    } finally { setLegacyAcademicDownload(null); }
  };

  useSignatureUpdates({
    jobs: signatureJobs,
    processId,
    scopeKey: userEmail,
    enabled: !readOnly && !isLoading && !errorMsg && !editingSection && !signatureWorking,
    onChange: ()=>loadData(true),
  });

  useEffect(()=>{
    let active=true;
    const verify=async()=>{
      if(!active||liveRefreshInFlight.current||document.visibilityState==='hidden')return;
      liveRefreshInFlight.current=true;
      try{
        // Detecta exclusão mesmo quando há campos em edição, sem tocar no rascunho.
        if(editingSectionRef.current){
          const latest=await apiClient.getProcessById(processId);
          if(!active)return;
          const current=lastProcessRevision.current;
          if(current && (latest.dataRevision!==current.revision||latest.updatedAt!==current.updatedAt)){
            setRemoteUpdatePending(true);
          }
        }else{
          await loadData(true);
        }
      }catch(err){
        if(active&&err instanceof ApiRequestError&&err.status===404){
          portalNotice('Este TCC não está mais disponível. Ele pode ter sido excluído ou seu acesso foi alterado.');
          onBackRef.current();
        }
      }finally{
        liveRefreshInFlight.current=false;
      }
    };
    const onUpdate=()=>{void verify();};
    window.addEventListener(PORTAL_LIVE_UPDATE_EVENT,onUpdate);
    return()=>{
      active=false;
      window.removeEventListener(PORTAL_LIVE_UPDATE_EVENT,onUpdate);
    };
  },[processId,userEmail]);

  useEffect(()=>{
    if(!editingSection && remoteUpdatePending){
      // Cancelar a edição permite reaplicar o estado mais recente com segurança.
      void loadData(true);
    }
  },[editingSection,remoteUpdatePending]);

  if (isLoading) {
    return (
      <div className="bg-white p-12 text-center rounded-2xl border border-slate-200 text-slate-600 font-medium shadow-2xs">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-emerald-600 border-t-transparent mb-3"></div>
        <p className="text-xs font-bold normal-case tracking-wider text-emerald-950">Carregando Ficha e Dados do TCC...</p>
      </div>
    );
  }

  if (errorMsg || !process) {
    return (
      <div className="bg-white p-8 rounded-2xl border border-slate-200 space-y-4 shadow-sm">
        <div className="text-rose-600 font-bold flex items-center gap-2">
          <AlertCircle className="w-5 h-5" />
          <span>{errorMsg || 'Processo de TCC não encontrado.'}</span>
        </div>
        <button onClick={onBack} className="text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 px-4 py-2 rounded-xl transition-colors cursor-pointer">
          &larr; Voltar para Lista de Processos
        </button>
      </div>
    );
  }

  // Calculate roles of current user for this process
  const normEmail = normalizeEmail(userEmail);
  const isStudent = !readOnly && (normalizeEmail(process.aluno1.email) === normEmail || Boolean(process.aluno2 && normalizeEmail(process.aluno2.email) === normEmail));
  const isAdvisor = !readOnly && normalizeEmail(process.orientador.email) === normEmail;
  const isCoAdvisor = !readOnly && process.coorientador && normalizeEmail(process.coorientador.email) === normEmail;
  const isExaminer = process.banca.some((b) => (b.funcao === 'EXAMINER_2' || b.funcao === 'EXAMINER_3') && normalizeEmail(b.email) === normEmail);

  const isEvaluationSubmitted = Boolean(process.avaliacao?.submittedAt) || process.avaliacao?.status === 'CONCLUIDO' || process.avaliacao?.notaFinal !== undefined;
  const isAcervoSubmitted = Boolean(process.acervo?.submittedAt);
  const hasReservationReceipt = Boolean(process.defesa.departmentResponse || (process.defesa as { hasReservationReceipt?: boolean }).hasReservationReceipt);
  const canSubmitAcervo = !readOnly && Boolean(isMasterAdmin || isCommissionPresident || isStudent);
  const acervoFieldsLocked = !canSubmitAcervo || isAcervoSubmitted || !ataIsArchived || isSubmittingAcervo || Boolean(acervoUploading);

  const canStudentEdit = isStudent && !isEvaluationSubmitted && !isAcervoSubmitted && !readOnly;
  const canAdvisorEdit = (isAdvisor || isCoAdvisor) && !isAcervoSubmitted && !readOnly;
  const canCoordinatorEdit = isMasterAdmin && !readOnly && !isEvaluationSubmitted && !isAcervoSubmitted;

  const canEditData = canCoordinatorEdit || Boolean((isStudent || isAdvisor) && !isEvaluationSubmitted && !readOnly && !process.defesa.invitationDriveFileId && !process.defesa.invitationSentAt);

  const canEditDefense=canCoordinatorEdit||Boolean((isStudent||isAdvisor)&&!isEvaluationSubmitted&&!isAcervoSubmitted&&!readOnly);
  const defenseDate=new Date(process.defesa.startAt);
  const defenseLocal=Number.isFinite(defenseDate.getTime())?new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(defenseDate).replace(' ','T'):'';
  const inlineField=(label:string,value:string,patch:(value:string)=>Record<string,unknown>,type='text',display=value,editable=canEditData,confirmDefenseChange=false,options?:readonly string[])=><InlineProcessField onEditingChange={editing=>{editingSectionRef.current=editing?'cadastral':null;}} options={options} label={label} value={value} display={display} type={type} editable={!readOnly && editable} beforeEdit={confirmDefenseChange?()=>portalConfirm(`Tem certeza de que deseja alterar ${label==='Data da defesa'?'a data da defesa':label==='Horário da defesa'?'o horário da defesa':'o local da defesa'}? ${!process.defesa.invitationDriveFileId&&!process.defesa.invitationSentAt&&process.avaliacao.status!=='CONCLUIDO'?'Ao salvar, a solicitação de reserva será reenviada ao responsável pelo local e a etapa de confirmação será reiniciada. A confirmação e o comprovante anteriores deixarão de valer. O responsável receberá um novo pedido e deverá confirmar o agendamento novamente.':'Essa mudança afeta o calendário da defesa. Confirme o novo agendamento com o departamento e preserve os documentos já emitidos.'} Ao salvar, o histórico registrará quem realizou a alteração, a data e hora do registro e os valores anteriores e novos.`,{title:'Atenção: alterar agendamento da defesa',tone:'warning',confirmLabel:'Sim, quero alterar',cancelLabel:'Manter como está'}):undefined} onSave={async next=>{const result=await apiClient.updateProcess(process.id,{...patch(next.trim()),expectedDataRevision:process.dataRevision});await loadData({quiet:true,preserveAcervoDraft:true});if(result.reservationRestarted)portalNotice(result.workflowPending?`Agendamento atualizado e confirmação reiniciada. O novo pedido de reserva aguarda envio: ${result.workflowError||'a secretaria deve acompanhar a pendência.'}`:'Agendamento atualizado e novo pedido enviado ao responsável pelo local. Aguarde a confirmação pelo novo pedido.',{title:'Solicitação de reserva reiniciada'});}}/>;

  const handleSignDocument=async(doc:ProcessDocument)=>{
    setSignatureWorking(doc.type);setSignatureNotice(null);
    try{
      const result=await apiClient.signProcessDocument(process.id,doc.type);
      setSignatureNotice({ok:true,text:result.message});
      await loadData();
    }catch(error){setSignatureNotice({ok:false,documentType:doc.type,text:`${doc.type==='ATA'?'Ata':doc.type==='TERMO'?'Termo de autorização':'Declaração'}: ${error instanceof Error?error.message:'Não foi possível enviar o documento à Asten.'}`});}
    finally{setSignatureWorking('');}
  };

  const handleDownloadDossier = async () => {
    setIsDownloadingDossier(true);
    try {
      const { blob, fileName } = await apiClient.downloadInstitutionalDossier(process.id,downloadSelection);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
      setDownloadPicker(false);
    } catch (error) {
      setSignatureNotice({ok:false,text:error instanceof Error?error.message:'Não foi possível gerar o dossiê institucional.'});
    } finally {
      setIsDownloadingDossier(false);
    }
  };

  // Handlers for individual subdivision edits
  const handleSaveCadastralEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if(remoteUpdatePending){
      portalNotice('Este TCC foi alterado em outra sessão. Cancele a edição e confira os dados atuais antes de salvar.');
      return;
    }
    if (!process) return;
    try {
      const updatedAluno1 = {
        ...process.aluno1,
        nome: cadastralForm.aluno1Nome.trim(),
        email: cadastralForm.aluno1Email.trim(),
        matricula: cadastralForm.aluno1Matricula.trim()
      };

      const updatedAluno2 = cadastralForm.hasAluno2 && cadastralForm.aluno2Nome.trim() ? {
        nome: cadastralForm.aluno2Nome.trim(),
        email: cadastralForm.aluno2Email.trim(),
        matricula: cadastralForm.aluno2Matricula.trim()
      } : null;

      const updatedOrientador = {
        ...process.orientador,
        nome: cadastralForm.orientadorNome.trim(),
        email: cadastralForm.orientadorEmail.trim(),
        instituicao: cadastralForm.orientadorInstituicao.trim() || installationProfile.defaultInstitutionName
      };

      const updatedCoorientador = cadastralForm.hasCoorientador && cadastralForm.coorientadorNome.trim() ? {
        nome: cadastralForm.coorientadorNome.trim(),
        email: cadastralForm.coorientadorEmail.trim(),
        instituicao: cadastralForm.coorientadorInstituicao.trim() || installationProfile.defaultInstitutionName
      } : null;

      const result=await apiClient.updateProcess(process.id, {
        titulo: cadastralForm.titulo.trim(),
        aluno1: updatedAluno1,
        aluno2: updatedAluno2,
        orientador: updatedOrientador,
        coorientador: updatedCoorientador,
        expectedDataRevision: process.dataRevision
      });


      setEditingSection(null);
      await loadData();
      portalNotice(result.reservationRestarted?(result.workflowPending?'Agendamento atualizado. A confirmação foi reiniciada, mas o novo pedido aguarda envio. A secretaria deve acompanhar a pendência.':'Agendamento atualizado e novo pedido enviado ao responsável pelo local. Aguarde a confirmação pelo novo pedido.'):'Ficha cadastral atualizada.');
    } catch (err: any) {
      portalNotice(err.message || 'Erro ao salvar alterações da ficha cadastral.');
    }
  };

  const handleAddExaminer = () => {
    const newExaminer = {
      id: `examiner-${Date.now()}`,
      nome: '',
      email: '',
      funcao: 'EXAMINER_2',
      membroTipo: 'INTERNO',
      instituicao: installationProfile.defaultInstitutionName,
      titulacao: 'Prof. Dr.'
    };
    setBancaForm(prev => [...prev, newExaminer]);
  };

  const handleRemoveExaminer = (index: number) => {
    if (bancaForm.length <= 2) {
      portalNotice('A banca examinadora deve possuir dois avaliadores além do orientador.');
      return;
    }
    setBancaForm(prev => prev.filter((_, idx) => idx !== index));
  };

  const handleUpdateExaminer = (index: number, field: string, value: string) => {
    setBancaForm(prev => prev.map((membro, idx) => {
      if (idx === index) {
        return { ...membro, [field]: value };
      }
      return membro;
    }));
  };

  const handleSaveBancaEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if(remoteUpdatePending){
      portalNotice('A banca foi alterada em outra sessão. Cancele a edição e confira os dados atuais antes de salvar.');
      return;
    }
    if (!process) return;
    try {
      await apiClient.updateProcess(process.id, {
        banca: bancaForm,
        expectedDataRevision: process.dataRevision
      });


      setEditingSection(null);
      await loadData();
      portalNotice('Composição da banca examinadora atualizada com sucesso!');
    } catch (err: any) {
      portalNotice(err.message || 'Erro ao salvar alterações da banca.');
    }
  };

  const handleDirectDownload = (doc: ProcessDocument) => {
    const isDownloadable = doc.status === 'DISPONIVEL' || doc.status === 'ASSINADO';
    if (!isDownloadable) {
      portalNotice('Este documento ainda está em elaboração ou aguardando emissão.');
      return;
    }

    const currentVer = doc.versions?.find((v) => v.isCurrent) || doc.versions?.[0];
    const driveDownloadUrl = doc.driveDownloadUrl || currentVer?.driveDownloadUrl;

    if (driveDownloadUrl) {
      void downloadPortalDocument(driveDownloadUrl).catch(error=>portalNotice(error.message));
      return;
    }

    portalNotice('O PDF ainda não foi arquivado no Google Drive. Aguarde a conclusão da etapa correspondente.');
  };

  const handleSubmitAcervo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmitAcervo || isAcervoSubmitted || isSubmittingAcervo || acervoUploading) return;
    if (!ataIsArchived) {
      portalNotice('Aguarde o arquivamento da Ata assinada para salvar a entrega final.');
      return;
    }

    const keywordsList = acervoKeywords
      .split(',')
      .map(k => k.trim())
      .filter(Boolean);

    if (keywordsList.length !== 5) {
      portalNotice('Informe exatamente 5 (cinco) palavras-chave separadas por vírgula.');
      return;
    }

    if (!acervoResumo.trim()) {
      portalNotice('O Resumo Síntese do TCC é obrigatório.');
      return;
    }

    if (!acervoTrabalhoCompleto.trim()) {
      portalNotice('O anexo do Trabalho Completo / Monografia é obrigatório.');
      return;
    }
    if(acervoExpandedPublic&&!acervoResumoExpandido.trim()){
      portalNotice('Anexe o resumo expandido antes de autorizar sua publicação.');
      return;
    }
    const keywordsFormatted = keywordsList;

    setIsSubmittingAcervo(true);
    try {
      const result = await apiClient.submitFinalData(processId, {
        palavrasChave: keywordsFormatted,
        resumoSintese: acervoResumo.trim(),
        publishFullWork: acervoIsPublic,
        publishExpandedAbstract: acervoExpandedPublic,
        workType: 'MONOGRAFIA',
        signatureProvider: termSignatureProvider
      });


      await loadData({quiet:true});
      setActiveTab('docs');setProcessLink(process.id,'docs');
      setSignatureNotice({ok:true,text:finalDeliveryMessage(result)});
    } catch (err: any) {
      portalNotice(err.message || 'Erro ao salvar dados do acervo.');
    } finally {
      setIsSubmittingAcervo(false);
    }
  };

  const handleAcervoPdfUpload = async (kind:'trabalho-completo'|'resumo-expandido',file?:File) => {
    if(!file||acervoFieldsLocked)return;
    if(file.type!=='application/pdf'&&!file.name.toLowerCase().endsWith('.pdf')){portalNotice('Selecione um arquivo PDF.');return;}
    if(file.size>24*1024*1024){portalNotice('O PDF deve ter no máximo 24 MB.');return;}
    setAcervoUploading(kind);
    try{
      const uploaded=await apiClient.uploadProcessPdfFile(processId,kind,file);
      if(kind==='trabalho-completo')setAcervoTrabalhoCompleto(uploaded.fileName);else setAcervoResumoExpandido(uploaded.fileName);
      portalNotice(uploaded.id.startsWith('local_review_')?'PDF de demonstração salvo neste computador, vinculado a este TCC.':'PDF armazenado com segurança na pasta deste TCC no Google Drive.');
      await loadData({ preserveAcervoDraft: true });
    }catch(err:any){portalNotice(err.message||'Falha ao enviar o PDF ao Google Drive.');}
    finally{setAcervoUploading('');}
  };

  const handleReopenEvaluation = async () => {
    const reason=(await portalPrompt('Informe o motivo formal da reabertura da avaliação (mínimo de 10 caracteres):',''));
    if (reason!==null) {
      try {
        if(reason.trim().length<10){portalNotice('O motivo precisa ter pelo menos 10 caracteres.');return;}
        await apiClient.reopenEvaluation(process.id,reason.trim());
        portalNotice('Avaliação reaberta com sucesso.');
        await loadData();
      } catch (err: any) {
        portalNotice(err.message || 'Erro ao reabrir avaliação.');
      }
    }
  };

  const handleDeleteProcess = async () => {
    if (deleteConfirmInput.trim().toUpperCase() !== 'EXCLUIR') {
      portalNotice("Digite 'EXCLUIR' em maiúsculas para confirmar.");
      return;
    }
    setIsDeleting(true);
    try {
      const result=await apiClient.deleteProcess(process.id);
      portalNotice([result.message,...(result.cleanupErrors||[])].join('\n'));
      setShowDeleteModal(false);
      onBack();
    } catch (err: any) {
      portalNotice('Erro ao excluir trabalho: ' + (err.message || 'Falha na requisição'));
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCoauthorDecision = async (decision:'ACCEPT'|'REJECT') => {
    try { await apiClient.respondCoauthorInvitation(process.id,decision); await loadData(); portalNotice(decision==='ACCEPT'?'Vínculo de autoria confirmado.':'Vínculo recusado. O autor principal deverá corrigir o cadastro.'); }
    catch (error) { portalNotice(error instanceof Error?error.message:'Não foi possível responder ao convite.'); }
  };

  // Visual classes derived from localFormat
  const cardRadiusClass = localFormat.cardBorderRadius || 'rounded-xl';
  const cardPaddingClass =
    localFormat.cardPadding === 'compact'
      ? 'p-3.5 sm:p-4'
      : localFormat.cardPadding === 'spacious'
      ? 'p-6 sm:p-8'
      : 'p-5 sm:p-6';

  const cardStyleClass =
    localFormat.cardStyle === 'elevated'
      ? 'shadow-md'
      : localFormat.cardStyle === 'flat'
      ? 'shadow-none'
      : localFormat.cardStyle === 'subtle_tint'
      ? 'shadow-2xs bg-[var(--portal-surface-card)]'
      : 'shadow-2xs';

  const titleSizeClass =
    localFormat.titleFontSize === 'sm'
      ? 'text-xs sm:text-sm'
      : localFormat.titleFontSize === 'lg'
      ? 'text-sm sm:text-base font-extrabold'
      : localFormat.titleFontSize === 'xl'
      ? 'text-base sm:text-lg font-black'
      : 'text-xs sm:text-sm font-bold';

  const titleWeightClass =
    localFormat.titleFontWeight === 'black'
      ? 'font-black'
      : localFormat.titleFontWeight === 'semibold'
      ? 'font-semibold'
      : 'font-bold';

  const primaryAccentColor = localFormat.primaryActionColor || 'var(--portal-brand-header)';
  const modalWidthClass = localFormat.modalMaxWidth === '5xl'
    ? 'max-w-5xl'
    : localFormat.modalMaxWidth === '7xl'
      ? 'max-w-7xl'
      : localFormat.modalMaxWidth === 'full'
        ? 'max-w-none'
        : 'max-w-6xl';
  const modalRadiusClass = localFormat.modalBorderRadius === 'none'
    ? 'rounded-none'
    : localFormat.modalBorderRadius || 'rounded-2xl';
  const modalShadowClass = localFormat.modalShadow === 'none'
    ? 'shadow-none'
    : localFormat.modalShadow === 'subtle'
      ? 'shadow-sm'
      : localFormat.modalShadow === 'medium'
        ? 'shadow-lg'
        : 'shadow-2xl';

  const isTabVisible = (tabId: string) => {
    if (localFormat.viewMode === 'continuous') return true;
    if ((tabId === 'defesa' || tabId === 'banca') && activeTab === 'cadastral') return true;
    return activeTab === tabId;
  };

  return (
    <div
      id="process-detail-container"
      className={`portal-tcc-detail ${isModal ? 'space-y-0' : `space-y-3 mx-auto ${modalWidthClass}`} ${modalRadiusClass} ${modalShadowClass} ${isModal ? 'overflow-visible pb-5' : 'overflow-hidden'}`}
      style={{ backgroundColor: 'var(--portal-surface-page)', color: '#0f172a' }}
    >
      {isModal ? (
        <header className="portal-modal-header sticky top-0 z-30 flex items-center justify-between gap-3 px-4" style={{ backgroundColor: 'var(--portal-brand-header)', color: '#ffffff' }}>

          <div className="flex min-w-0 items-center gap-2"><FileText className="h-4 w-4 shrink-0 text-white" aria-hidden="true"/><div className="min-w-0"><h1 className="truncate text-[12px] font-black normal-case tracking-wide">Detalhes do TCC</h1></div></div>
          <div className="relative flex shrink-0 items-center gap-1.5">
            <span role="status" aria-live="polite" aria-atomic="true" className={copyFeedback?'portal-copy-feedback pointer-events-none absolute right-0 top-full z-50 mt-2 w-max max-w-[min(300px,80vw)] whitespace-normal rounded-lg border border-slate-300 bg-[var(--portal-surface-card)] px-3 py-2 text-xs font-normal normal-case text-slate-800 shadow-sm':'sr-only'}>{copyFeedback?.text||''}</span>
          <button type="button" className="portal-toolbar-icon-button rounded-full bg-white text-slate-950" aria-label="Copiar link do trabalho" title="Copiar link do trabalho" onClick={()=>void copyProcessLink()}><LinkIcon className="h-4 w-4"/></button>
            {!readOnly&&<button type="button" onClick={()=>setShowAuditLogModal(true)} className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white bg-white text-slate-950" title="Histórico de Auditoria" aria-label="Abrir histórico de auditoria"><History className="h-4 w-4"/></button>}
            {isMasterAdmin&&!readOnly&&<button type="button" onClick={()=>setShowDeleteModal(true)} className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white bg-white text-rose-700" aria-label="Excluir trabalho"><Trash2 className="h-4 w-4"/></button>}
          </div>
        </header>
      ) : null}
      {isModal && <div className="portal-modal-divider" aria-hidden="true" />}
      {remoteUpdatePending&&(
        <div role="alert" className="mx-3 mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-950">
          <span>Este TCC foi alterado em outra sessão. Seus campos em edição não foram sobrescritos. Cancele a edição para consultar os dados atuais antes de salvar.</span>
          <button type="button" onClick={()=>{setEditingSection(null);editingSectionRef.current=null;void loadData(true);}} className="rounded-lg bg-amber-800 px-3 py-2 font-bold text-white">Descartar edição e atualizar</button>
        </div>
      )}
      {localFormat.showStateMachine !== false && <div className="px-3 pt-3"><EtapaProgressBar currentEtapa={process.etapaAtual} historical={process.legacyRecord}/></div>}
      <section id="tcc-detail-workspace" className="portal-tcc-workspace mx-3 mt-3">
      <section aria-label="Seções do TCC" className="portal-tcc-workspace-tabs"><div className="portal-tcc-tab-list flex flex-wrap items-stretch gap-1">{[
        {id:'cadastral',label:'Dados do processo',icon:FileText,show:localFormat.showSectionCadastral!==false||localFormat.showSectionBanca!==false},{id:'avaliacao',label:'Conceito e Ata',icon:Award,show:localFormat.showSectionAvaliacao!==false},{id:'acervo',label:'Repositório acadêmico',icon:BookOpen,show:localFormat.showSectionAcervo!==false},{id:'docs',label:'Documentos administrativos',icon:FileCheck,show:localFormat.showSectionDocs!==false}
      ].filter(t=>t.show!==false).map(tab=>{const Icon=tab.icon;const selected=activeTab===tab.id;return <button key={tab.id} type="button" onClick={()=>{setActiveTab(tab.id);setProcessLink(process.id,tab.id as ProcessSection);}} aria-pressed={selected} className={`flex min-h-9 min-w-0 flex-1 justify-center items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[10px] font-bold ${selected?'portal-tcc-tab-selected border-[var(--portal-brand-header)] bg-white text-slate-950':'border-white bg-white text-slate-700'}`}><Icon className="h-3.5 w-3.5 text-[var(--portal-brand-action)]"/><span>{tab.label}</span></button>})}</div></section>
      <div className="portal-tcc-workspace-content p-3">

      {!readOnly && !process.legacyRecord && isTabVisible('cadastral') && effectiveDefenseReservationStatus(process) !== 'CONFIRMADO' && <ProcessFlowPanel process={process} jobs={signatureJobs} canConfirm={(isStudent || isMasterAdmin) && !readOnly} onUpdated={loadData}/> }

      {/* ========================================================================= */}
      {/* SECTION 1: FICHA CADASTRAL E IDENTIFICAÇÃO DO PROCESSO                    */}
      {/* ========================================================================= */}
      {localFormat.showSectionCadastral !== false && isTabVisible('cadastral') && (
        <div className="portal-tcc-cadastral overflow-hidden">

          <div className="p-4 sm:p-5">
            <div className="space-y-3">
              <ProcessSummaryCard process={process} canEdit={!readOnly&&canEditData} canEditReservation={!readOnly&&canEditDefense&&!process.legacyRecord} studio={settings.integrationStudio} onEditingChange={setSummaryEditing} onUpdated={()=>loadData({quiet:true,preserveAcervoDraft:true})}/>
              <section className="portal-tcc-members-box" aria-label="Dados dos membros">
                <h2 className="mb-2 text-xs font-bold normal-case">Dados dos membros</h2>
                <div className="portal-members-table-scroll" role="region" aria-label="Tabela de membros com rolagem horizontal" tabIndex={0}>
                  <table className="portal-members-table">
                    <caption className="sr-only">Participantes do TCC e seus dados cadastrais</caption>
                    {!readOnly&&<colgroup><col style={{width:'10%'}}/><col style={{width:'18%'}}/><col style={{width:'10%'}}/><col style={{width:'9%'}}/><col style={{width:'23%'}}/><col style={{width:'13%'}}/><col style={{width:'17%'}}/></colgroup>}
                    <thead><tr><th scope="col">Função</th><th scope="col">Nome</th><th scope="col">Referência</th><th scope="col">Titulação</th>{!readOnly&&<><th scope="col">E-mail</th><th scope="col" title="Matrícula, SIAPE ou outro registro">Registro</th></>}<th scope="col">Instituição</th></tr></thead>
                    <tbody>
                {[
                  {role:participantRole('student',process.registrationAnswers,'ALUNO_1',process.aluno1),person:process.aluno1,student:true,key:'aluno1'},
                  ...(process.aluno2?[{role:participantRole('student',process.registrationAnswers,'ALUNO_2',process.aluno2),person:process.aluno2,student:true,key:'aluno2'}]:[]),
                  {role:participantRole('advisor',process.registrationAnswers,'ORIENTADOR',process.orientador),person:process.orientador,student:false,key:'orientador'},
                  ...process.banca.filter(person=>readOnly?person.funcao!=='ORIENTADOR':normalizeEmail(person.email)!==normalizeEmail(process.orientador.email)&&normalizeEmail(person.email)!==normalizeEmail(process.coorientador?.email||'')).map((person,index)=>({role:participantRole('examiner',process.registrationAnswers,`EXAMINADOR_${person.funcao.match(/EXAMINER_(\d+)/)?.[1]||index+2}`,person),person,student:false,key:'banca'})),
                  ...(process.coorientador?.nome?.trim()?[{role:participantRole('coadvisor',process.registrationAnswers,'COORIENTADOR',process.coorientador),person:process.coorientador,student:false,key:'coorientador'}]:[])
                ].map(({role,person,student,key})=>{
                  const field=(property:string,value:string)=>key==='banca'?{banca:process.banca.map(member=>member===person?{...member,[property]:value}:member)}:{[key]:{...person,[property]:value}};
                  return <tr key={`${key}-${person.email||person.nome}`}>
                    <th scope="row">{role}</th>
                    <td className="font-bold">{inlineField(`Nome — ${role}`,person.nome,value=>field('nome',value))}</td>
                    <td>{inlineField(`Tratamento — ${role}`,person.tratamento||'',value=>field('tratamento',value),'text',person.tratamento||'Não informado',canEditData,false,student?STUDENT_TREATMENTS:FACULTY_TREATMENTS)}</td>
                    <td>{student?<span aria-label="Não se aplica">—</span>:inlineField(`Titulação — ${role}`,'titulacao' in person?person.titulacao||'':'',value=>field('titulacao',value),'text','titulacao' in person?person.titulacao||'Não informada':'Não informada',canEditData,false,ACADEMIC_DEGREES)}</td>
                    {!readOnly&&<><td>{(student?localFormat.showStudentEmail:localFormat.showAdvisorEmail)!==false?inlineField(`E-mail — ${role}`,person.email,value=>field('email',value),'email'):<span aria-label="Não exibido">—</span>}</td>
                    <td>{(!student||localFormat.showStudentMatricula!==false)?inlineField(`Número de registro — ${role}`,String(student?('matricula' in person?person.matricula:''):('siape' in person?person.siape||'':'')),value=>field(student?'matricula':'siape',value)):<span aria-label="Não exibido">—</span>}</td></>}
                    <td>{student?<span className="portal-inline-field-value">UFES</span>:localFormat.showAdvisorInstitution!==false?inlineField(`Instituição — ${role}`,String(('instituicao' in person&&person.instituicao)||''),value=>field('instituicao',value)):<span aria-label="Não exibido">—</span>}</td>
                  </tr>;
                })}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SECTION 3: COMPOSIÇÃO DA BANCA EXAMINADORA                                */}
      {/* ========================================================================= */}
      {/* ========================================================================= */}
      {/* SECTION 4: CAMPO DE AVALIAÇÃO E NOTAS DA BANCA                            */}
      {/* ========================================================================= */}
      {localFormat.showSectionAvaliacao !== false && isTabVisible('avaliacao') && (
        <>
        <AdvisorEvaluationPanel publicReadOnly={readOnly} process={process} canEvaluate={!process.legacyRecord && (isAdvisor || isMasterAdmin) && !readOnly}
          canReopen={!process.legacyRecord && (isMasterAdmin || isAdvisor) && !readOnly && !isAcervoSubmitted && !process.acervo?.firstSubmittedAt && process.status!=='CONCLUIDO'} onReopen={handleReopenEvaluation} onUpdated={async()=>{await loadData();setActiveTab('docs');setProcessLink(process.id,'docs');}} />
        </>
      )}

      {/* ========================================================================= */}
      {/* SECTION 5: PAINEL DE DOCUMENTOS E ASSINATURAS GERENCIADAS                */}
      {/* ========================================================================= */}
      {process.legacyRecord && localFormat.showSectionDocs !== false && isTabVisible('docs') && <LegacyAdministrativeDocuments processId={process.id} canAccessOriginals={isMasterAdmin}/>}
      {!process.legacyRecord && localFormat.showSectionDocs !== false && isTabVisible('docs') && (
        <ProcessDocumentsPanel count={documents.length+1} toolbar={
          !readOnly&&(isMasterAdmin||isCommissionPresident)?<button type="button" onClick={()=>{setDownloadSelection(documents.filter(doc=>doc.status==='DISPONIVEL'||doc.status==='ASSINADO').map(doc=>doc.type));setDownloadPicker(true);}} disabled={isDownloadingDossier} className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-700 disabled:opacity-60" aria-label="Escolher documentos para baixar" title="Baixar documentos"><Download className="h-4 w-4"/></button>:undefined
        } notices={<>
            {!readOnly&&documents.some(doc=>doc.requiresSignature&&doc.status!=='ASSINADO'&&doc.status!=='NAO_DISPONIVEL')&&<aside className="portal-instruction p-3 text-xs"><p className="font-semibold">Orientações</p><ul className="mt-1 list-disc space-y-1 pl-5"><li>Somente os responsáveis indicados em cada documento podem assiná-lo.</li><li>Prefira o Asten: solicite a assinatura pelo botão e siga o link recebido por e-mail.</li><li>Pelo Gov.br, baixe o documento, assine e devolva o PDF com todas as assinaturas exigidas.</li></ul></aside>}
            {signatureNotice&&(!signatureNotice.documentType||!documents.some(doc=>doc.type===signatureNotice.documentType&&doc.status==='ASSINADO'))&&<div role="status" className={`rounded-lg border p-3 text-xs font-bold flex items-start justify-between gap-3 ${signatureNotice.ok?'portal-instruction':'border-red-200 bg-red-50 text-red-900'}`}><span>{signatureNotice.text}</span><button type="button" onClick={()=>setSignatureNotice(null)} className="shrink-0 underline" aria-label="Fechar aviso de documento">Fechar aviso</button></div>}

            {verifications.length > 0 && (
              <div className="rounded-xl border border-[var(--portal-border)] bg-[var(--portal-surface-panel)] p-3">
                <div className="mb-2 flex items-center gap-2 text-[11px] font-black normal-case tracking-wide text-sky-950"><ShieldCheck className="h-4 w-4" />Autenticidade dos documentos assinados</div>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {verifications.map((verification) => (
                    <a key={`${verification.documentType}-${verification.version}`} href={verification.url} target="_blank" rel="noreferrer" className="flex items-center justify-between rounded-lg border border-sky-200 bg-white px-3 py-2 text-xs font-bold text-sky-900 hover:border-sky-400">
                      <span>{verification.documentType} • versão {verification.version}</span><ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  ))}
                </div>
              </div>
            )}

        </>}>

              <ReservationReceiptCard downloadUrl={hasReservationReceipt ? `/api/public/processes/${encodeURIComponent(process.protocolo)}/reservation-receipt` : undefined}/>
              {documents.map((doc) => {
                const termDeclined=doc.type==='TERMO'&&publicationDeclined(process);
                const isDownloadable = !termDeclined&&(doc.status === 'DISPONIVEL' || doc.status === 'ASSINADO');
                const canRequestSignature=!readOnly&&doc.status!=='ASSINADO'&&!documentSignatureCompleted(signatureJobs,process.id,doc.type,process.dataRevision)&&!termDeclined&&doc.requiresSignature&&doc.status!=='NAO_DISPONIVEL'&&(isMasterAdmin||isCommissionPresident||(doc.type==='ATA'&&(isAdvisor||isExaminer))||(doc.type==='TERMO'&&(isStudent||isAdvisor)));

                const getDocInfo = (type: string) => {
                  switch (type) {
                    case 'CONVITE':
                      return { title: 'Carta-Convite da Banca', signNote: 'Não requer assinatura', availability: 'Confirme o local e envie o convite à banca.' };
                    case 'ATA':
                      return { title: 'Ata', signNote: 'Orientador e dois examinadores', availability: 'Aguarda confirmação da ata após a defesa.' };
                    case 'TERMO':
                      return { title: 'Termo de Autorização e Publicação', signNote: 'Orientador e todos os autores', availability: 'Solicite publicação na entrega do Repositório.' };
                    case 'DECLARACAO':
                      return { title: 'Declaração de Participação na Banca', signNote: 'Presidência', availability: 'Aguarda entrega final, ata e termo aplicável assinados.' };
                    default:
                      return { title: doc.title, signNote: 'Assinatura gerenciada pelo portal', availability: 'Após concluir a etapa responsável pela geração deste documento.' };
                  }
                };

                const docInfo = getDocInfo(doc.type);
                const downloadPending=termDeclined?'Não foi autorizada a publicação do trabalho nem do resumo expandido por autores e orientador.':doc.status==='NAO_DISPONIVEL'?docInfo.availability:doc.status==='GERANDO'?'O PDF está sendo gerado.':doc.status==='AGUARDANDO_ASSINATURA'?'Aguarda as assinaturas e o arquivamento do PDF.':doc.status==='COM_ERRO'?'A geração falhou. A comissão deve verificar a pendência.':'Consulte a versão atual deste documento.';

                return <ProcessDocumentCard key={doc.id}
                  title={doc.type==='CONVITE'?<>Carta-Convite<br/>da Banca</>:doc.type==='ATA'?<>Ata</>:docInfo.title}
                  signerNote={termDeclined||doc.type==='CONVITE'?'Não necessária':docInfo.signNote}
                  status={termDeclined?'Não autorizado':doc.status==='NAO_DISPONIVEL'?'Não disponível':({DISPONIVEL:'Disponível',ASSINADO:'Assinado',AGUARDANDO_ASSINATURA:'Aguardando assinatura'}[doc.status]||'Não disponível')}
                  statusDescription={!isDownloadable?downloadPending:undefined}
                  tone={doc.status==='ASSINADO'||doc.status==='DISPONIVEL'?'available':doc.status==='COM_ERRO'?'error':'pending'}
                  available={isDownloadable} unavailable={!isDownloadable&&!canRequestSignature}
                  onView={()=>setSelectedPreviewDoc(doc)} onDownload={()=>void handleDirectDownload(doc)}>
                  {canRequestSignature&&<div className="portal-document-signature-actions flex flex-col gap-2">
                    <button type="button" onClick={()=>handleSignDocument(doc)} disabled={signatureWorking!==''} className="portal-action portal-signature-provider-action"><ShieldCheck className="h-4 w-4"/>Asten</button>
                    <button type="button" onClick={()=>setGovbrDocument(doc)} disabled={signatureWorking!==''} className="portal-action portal-signature-provider-action"><FileCheck className="h-4 w-4"/>Gov.br</button>
                  </div>}
                </ProcessDocumentCard>;
              })}
        </ProcessDocumentsPanel>
      )}

      {/* ========================================================================= */}
      {/* SECTION 6: FICHA E ACERVO PÚBLICO NO REPOSITÓRIO DIGITAL                  */}
      {/* ========================================================================= */}
      {localFormat.showSectionAcervo !== false && isTabVisible('acervo') && (
        <div id="acervo-digital-section" className="overflow-hidden">
          <div className="portal-repository-content">
            {readOnly ? (
              <div className="portal-repository-grid">
                {privateLegacyAccess?.error&&<p role="alert" className="portal-instruction p-3 text-xs">{privateLegacyAccess.error}</p>}
                {privateLegacyAccess&&legacyAcademicDownloadError&&<p role="alert" className="portal-instruction p-3 text-xs">{legacyAcademicDownloadError}</p>}
                <section className="rounded-xl border border-slate-200 bg-white p-4"><h3 className="mb-3 text-xs font-bold">Resumo síntese do TCC</h3><p className="whitespace-pre-wrap text-justify text-sm">{privateLegacyData?.resumo||process.acervo?.resumoSintese||(process.legacyRecord?'Resumo não localizado no acervo importado.':'Resumo ainda não informado.')}</p></section>
                <section className="rounded-xl border border-slate-200 bg-white p-4"><h3 className="mb-3 text-xs font-bold">Palavras-chave</h3><div className="grid grid-cols-1 gap-2 sm:grid-cols-5">{(privateLegacyData?.palavrasChave||process.acervo?.palavrasChave||[]).map((word,index)=><span key={index} className="rounded-lg border border-slate-200 bg-slate-50 p-2 text-xs">{word}</span>)}</div></section>
                {[
                  {kind:'TRABALHO_COMPLETO',title:'Trabalho completo',url:process.acervo?.trabalhoCompletoFileUrl},
                  {kind:'RESUMO_EXPANDIDO',title:'Resumo expandido',url:process.acervo?.resumoExpandidoFileUrl},
                  ...(privateLegacyData?.files.some(file=>file.kind==='DOCUMENTO_ACADEMICO')?[{kind:'DOCUMENTO_ACADEMICO',title:'Documento acadêmico',url:undefined}]:[]),
                ].flatMap(definition=>{
                  const originals=privateLegacyData?.files.filter(file=>file.kind===definition.kind)||[];
                  return originals.length?originals.map(file=>({...definition,url:file.downloadUrl,fileName:file.fileName,privateIndex:file.index,isPublic:file.isPublic})):[{...definition,fileName:undefined,privateIndex:undefined,isPublic:Boolean(definition.url)}];
                }).map(file=><section key={`${file.kind}-${file.privateIndex??'public'}`} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4"><div className="min-w-0"><h3 className="text-xs font-bold">{file.title}</h3><p className="mt-2 text-sm">{file.url?(file.isPublic?'Disponível para consulta pública':'Disponível para consulta restrita'):'Não disponível para consulta pública'}</p>{file.fileName&&<p className="mt-1 break-all text-xs text-slate-600">{file.fileName}</p>}</div><button type="button" disabled={!file.url||legacyAcademicDownload!==null} className="portal-action shrink-0" onClick={()=>{if(file.privateIndex!==undefined)void downloadPrivateLegacyFile(file.privateIndex);else if(file.url)window.open(file.url,'_blank','noopener,noreferrer');}}><Download className="h-4 w-4"/>{legacyAcademicDownload===file.privateIndex?'Baixando…':'Baixar'}</button></section>)}
              </div>
            ) : (
              <form id="repository-delivery-form" data-delivery-locked={acervoFieldsLocked} onSubmit={handleSubmitAcervo} className="space-y-2">
                {!isAcervoSubmitted&&<aside role="status" className="portal-instruction p-3 text-sm"><p className="font-semibold">Orientações</p><ul className="mt-1 list-disc space-y-1 pl-5">{ataIsArchived&&<li>A entrega final está liberada. Qualquer um dos autores pode enviar os documentos.</li>}<li>Preencha o resumo e as palavras-chave e anexe o PDF do trabalho completo. O envio do TCC é obrigatório.</li><li>A publicação do trabalho e do resumo expandido é opcional. Selecione apenas os arquivos que deseja tornar públicos.</li><li>Confirme a entrega. Se houver publicação autorizada, o Termo ficará disponível para assinatura em Documentos administrativos.</li></ul></aside>}
                <fieldset disabled={acervoFieldsLocked} className={`portal-repository-grid ${acervoFieldsLocked?'portal-repository-locked':''}`}>
                                  {/* Card 2: Resumo Síntese */}
                  <div className="bg-white p-3 rounded-xl border border-slate-200/90 shadow-2xs space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-extrabold normal-case tracking-wider text-slate-800 flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5 text-[var(--portal-brand-header)]" />
                        <span>Resumo Síntese do TCC</span>
                        <span className="text-rose-500">*</span>
                      </label>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${acervoResumo.trim() ? 'bg-[var(--portal-surface-inner)] text-[var(--portal-brand-header)] border-[var(--portal-border)]' : 'bg-amber-50 text-amber-800 border-amber-200'}`}>
                        {acervoResumo.trim() ? 'Preenchido' : 'Pendente'}
                      </span>
                    </div>

                    <textarea
                      required
                      disabled={!ataIsArchived} value={acervoResumo}
                      aria-label="Resumo síntese do TCC"
                      aria-describedby="acervo-resumo-limit"
                      maxLength={2000}
                      rows={8}
                      onChange={(e) => {editingSectionRef.current='acervo';setAcervoResumo(e.target.value);}}
                      placeholder="Resumo do TCC: objetivo, método, principais resultados e conclusão, em até três parágrafos e 2.000 caracteres."
                      className="w-full text-xs font-medium p-3 border border-slate-300 rounded-lg bg-[var(--portal-surface-inner)] focus:bg-white focus:ring-2 focus:ring-emerald-700 outline-none transition-all font-sans"
                    />
                    <p id="acervo-resumo-limit" className="text-right text-xs text-slate-600">{acervoResumo.length.toLocaleString('pt-BR')} / 2.000 caracteres · até três parágrafos</p>
                  </div>
                  {/* Card 1: Palavras-Chave */}
                  <div className="bg-white p-3 rounded-xl border border-slate-200/90 shadow-2xs space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-extrabold normal-case tracking-wider text-slate-800 flex items-center gap-1.5">
                        <Tag className="w-3.5 h-3.5 text-[var(--portal-brand-header)]" />
                        <span>Palavras-Chave</span>
                        <span className="text-rose-500">*</span>
                      </label>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${acervoKeywords.trim() ? 'bg-[var(--portal-surface-inner)] text-[var(--portal-brand-header)] border-[var(--portal-border)]' : 'bg-amber-50 text-amber-800 border-amber-200'}`}>
                        {acervoKeywords.trim() ? 'Preenchido' : 'Pendente'}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">{Array.from({length:5},(_,index)=><input key={index} aria-label={`Palavra-chave ${index+1}`} required disabled={!ataIsArchived} className="portal-input" value={acervoKeywords.split(',')[index]||''} onChange={event=>{editingSectionRef.current='acervo';const words=Array.from({length:5},(_,i)=>acervoKeywords.split(',')[i]||'');words[index]=event.target.value.replaceAll(',','');setAcervoKeywords(words.join(','));}}/>)}</div>
                    {/* Preview of Tags */}
                    {acervoKeywords.trim() && (
                      <div className="flex flex-wrap justify-center gap-1.5 pt-1">
                        {acervoKeywords.split(',').map(s => s.trim()).filter(Boolean).map((kw, i) => (
                          <span key={i} className="text-[11px] font-bold bg-[var(--portal-surface-inner)] text-[var(--portal-brand-header)] border border-[var(--portal-border)] px-2 py-0.5 rounded-md">
                            #{kw}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>


                  {/* Card 4: Monografia Completa */}
                  <div className="portal-repository-file-card bg-white p-3 rounded-xl border border-slate-200/90 shadow-2xs">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-extrabold normal-case tracking-wider text-slate-800 flex items-center gap-1.5">
                        <BookOpen className="w-3.5 h-3.5 text-[var(--portal-brand-header)]" />
                        <span>Arquivo do Trabalho Completo / Monografia (PDF)</span>
                        <span className="text-rose-500">*</span>
                      </label>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${acervoTrabalhoCompleto.trim() ? 'bg-[var(--portal-surface-inner)] text-[var(--portal-brand-header)] border-[var(--portal-border)]' : 'bg-rose-50 text-rose-800 border-rose-200'}`}>
                        {acervoTrabalhoCompleto.trim() ? 'Anexado' : 'Obrigatório'}
                      </span>
                    </div>

                    {!acervoFieldsLocked&&<><button type="button" className="portal-action" onClick={()=>document.getElementById('repository-upload-trabalho-completo')?.click()}><Upload className="h-4 w-4"/>Escolher arquivo</button><input id="repository-upload-trabalho-completo" aria-label="Enviar PDF do trabalho completo" type="file" accept="application/pdf,.pdf" className="hidden" disabled={acervoFieldsLocked} onChange={(e)=>{void handleAcervoPdfUpload('trabalho-completo',e.target.files?.[0]);e.target.value='';}}/></>}
                    <p className="portal-repository-file-status text-[11px] text-[var(--portal-brand-header)] font-semibold break-all" aria-hidden={!acervoTrabalhoCompleto}>{acervoTrabalhoCompleto ? <>Armazenado: {acervoTrabalhoCompleto}</> : null}</p>
                  <label htmlFor="acervo-public-toggle" className="portal-repository-choice flex items-center gap-2.5 cursor-pointer select-none rounded-lg border border-slate-200 bg-white p-3">
                    <input
                      id="acervo-public-toggle"
                      type="checkbox"
                      checked={acervoIsPublic}
                      onChange={(e) => {editingSectionRef.current='acervo';setAcervoIsPublic(e.target.checked);}}
                      className="w-4 h-4 text-[var(--portal-brand-header)] rounded border-slate-300 focus:ring-emerald-700 cursor-pointer"
                    />
                    <div>
                      <span className="text-xs font-bold text-slate-900 block">
                        Tornar este Trabalho de TCC Público no Repositório Digital
                      </span>
                      <span className="text-[10.5px] text-slate-500 block">
                        Permite consulta e visualização por alunos e comunidade acadêmica
                      </span>
                    </div>
                  </label>
                  </div>
                  {/* Card 3: Resumo Expandido */}
                  <div className="portal-repository-file-card bg-white p-3 rounded-xl border border-slate-200/90 shadow-2xs">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-extrabold normal-case tracking-wider text-slate-800 flex items-center gap-1.5">
                        <Upload className="w-3.5 h-3.5 text-[var(--portal-brand-header)]" />
                        <span>Arquivo do Resumo Expandido</span>
                      </label>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${acervoResumoExpandido.trim() ? 'bg-[var(--portal-surface-inner)] text-[var(--portal-brand-header)] border-[var(--portal-border)]' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                        {acervoResumoExpandido.trim() ? 'Anexado' : 'Opcional'}
                      </span>
                    </div>

                    {!acervoFieldsLocked&&<><button type="button" className="portal-action" onClick={()=>document.getElementById('repository-upload-resumo-expandido')?.click()}><Upload className="h-4 w-4"/>Escolher arquivo</button><input id="repository-upload-resumo-expandido" aria-label="Enviar PDF do resumo expandido" type="file" accept="application/pdf,.pdf" className="hidden" disabled={acervoFieldsLocked} onChange={(e)=>{void handleAcervoPdfUpload('resumo-expandido',e.target.files?.[0]);e.target.value='';}}/></>}
                    <p className="portal-repository-file-status text-[11px] text-[var(--portal-brand-header)] font-semibold break-all" aria-hidden={!acervoResumoExpandido}>{acervoResumoExpandido ? <>Armazenado: {acervoResumoExpandido}</> : null}</p>
                  <label htmlFor="acervo-expanded-public-toggle" className={`portal-repository-choice flex items-center gap-2.5 select-none rounded-lg border border-slate-200 bg-white p-3 ${acervoResumoExpandido?'cursor-pointer':'cursor-not-allowed opacity-60'}`}>
                    <input
                      id="acervo-expanded-public-toggle"
                      type="checkbox"
                      checked={acervoExpandedPublic}
                      disabled={!acervoResumoExpandido}
                      onChange={(e) => {setAcervoExpandedPublic(e.target.checked);}}
                      className="w-4 h-4 text-[var(--portal-brand-header)] rounded border-slate-300 focus:ring-emerald-700 cursor-pointer"
                    />
                    <div>
                      <span className="text-xs font-bold text-slate-900 block">Tornar este resumo expandido público no Repositório Digital</span>
                      <span className="text-[10.5px] text-slate-500 block">Escolha independente do trabalho completo; exige arquivo anexado.</span>
                    </div>
                  </label>
                  </div>


                </fieldset>
                {/* Card 5: Visibilidade & Ação de Salvar */}
                <div className="space-y-3">






                  <div className="flex justify-center py-2 text-center" aria-label="Confirmação da entrega final">
                    {isAcervoSubmitted ? <>
                      {canSubmitAcervo&&process.status!=='CONCLUIDO'&&!documentSignatureCompleted(signatureJobs,process.id,'DECLARACAO')&&<button type="button" disabled={isSubmittingAcervo} className="portal-action" onClick={async()=>{if(!await portalConfirm('Editar a entrega final? As solicitações pendentes serão canceladas e os dados alterados precisarão de novas assinaturas.'))return;setIsSubmittingAcervo(true);try{await apiClient.reopenRepository(process.id);await loadData();}catch(error){portalNotice(error instanceof Error?error.message:'Não foi possível reabrir a entrega.');}finally{setIsSubmittingAcervo(false);}}}>Editar entrega</button>}
                    </> : <>
                      {canSubmitAcervo ? <button type="submit" disabled={acervoFieldsLocked} className="portal-action portal-button-primary"><Save className="h-4 w-4"/>{isSubmittingAcervo?'Confirmando entrega…':'Confirmar entrega e ir para documentos'}</button> : <p className="text-xs">A confirmação da entrega é feita por um dos autores.</p>}
                    </>}
                  </div>

                </div>
              </form>
            )}
          </div>
        </div>
      )}

      </div>
      </section>

      {/* ========================================================================= */}
      {/* POPUPS & MODALS: AUDIT LOG, PREVIEWS, DELETE                               */}
      {/* ========================================================================= */}

      {/* Audit Log Modal (Full dialog view via gear) */}
      {govbrDocument&&<GovbrSignatureModal process={process} documentType={govbrDocument.type as 'ATA'|'TERMO'|'DECLARACAO'} canApprove={isMasterAdmin} initialJob={signatureJobs.find(job=>job.documentType===govbrDocument.type&&job.provider==='GOV_BR'&&job.sourceDataRevision===process.dataRevision&&job.status!=='CANCELED')} onChange={()=>void loadData({quiet:true})} onClose={()=>setGovbrDocument(null)}/>}
      <PortalModalShell zIndexClass="z-[1000002]" open={downloadPicker} onClose={()=>setDownloadPicker(false)} title="Baixar documentos" icon={Download} maxWidthClass="max-w-lg" bodyClassName="p-4" footer={<div className="flex justify-end gap-2"><button type="button" className="portal-action" onClick={()=>setDownloadPicker(false)}>Fechar</button><button type="button" disabled={isDownloadingDossier||!downloadSelection.length} className="portal-action" onClick={()=>void handleDownloadDossier()}>{isDownloadingDossier?'Preparando…':'Baixar selecionados'}</button></div>}>
        <div className="space-y-2">{documents.map(doc=><label key={doc.id} className="flex items-center gap-2 rounded-lg border p-3"><input type="checkbox" disabled={!['DISPONIVEL','ASSINADO'].includes(doc.status)} checked={downloadSelection.includes(doc.type)} onChange={event=>setDownloadSelection(current=>event.target.checked?[...current,doc.type]:current.filter(type=>type!==doc.type))}/><span>{doc.title}<small className="block">{doc.status==='DISPONIVEL'?'Disponível':doc.status==='ASSINADO'?'Assinado':'Não disponível'}</small></span></label>)}</div>
      </PortalModalShell>
      {showAuditLogModal && (
        <div
          className="portal-modal-backdrop fixed inset-0 z-[1000001] flex items-center justify-center p-4"
          onMouseDown={(event) => { if (event.target === event.currentTarget) setShowAuditLogModal(false); }}
        >
          <div role="dialog" aria-modal="true" aria-labelledby="process-audit-title" className="portal-standard-modal portal-modal-surface max-h-[85vh] w-full max-w-3xl overflow-hidden">
            <header className="portal-modal-header justify-start px-4 py-3">
              <History className="h-5 w-5 shrink-0 text-white" aria-hidden="true" />
              <div className="min-w-0">
                <h2 id="process-audit-title" className="truncate text-sm font-black normal-case text-white">Histórico & Log de Alterações do Processo</h2>
                <p className="mt-0.5 text-[10px] font-mono text-white/80">Protocolo: {process.protocolo} · Horários de Brasília</p>
              </div>
            </header>
            <div className="portal-modal-divider" aria-hidden="true" />
            <div className="flex justify-end gap-2 p-3"><button type="button" className="portal-action" onClick={()=>void apiClient.downloadProcessAuditLogs(processId).then(({blob,fileName})=>{const url=URL.createObjectURL(blob);const anchor=document.createElement('a');anchor.href=url;anchor.download=fileName;anchor.click();window.setTimeout(()=>URL.revokeObjectURL(url),1000);}).catch(error=>portalNotice(error.message))}><Download className="h-4 w-4"/>Baixar histórico em PDF</button><button type="button" className="portal-action" onClick={()=>setShowAuditLogModal(false)}>Fechar</button></div>
            <div className="max-h-[calc(85vh-140px)] overflow-y-auto" style={{ backgroundColor: 'var(--portal-surface-page)' }}>
              <div className="space-y-3 p-3 sm:p-4">
                {!auditLogs.length&&<p className="rounded-lg border border-slate-200 bg-white p-4 text-center text-sm text-slate-600">Nenhum evento registrado para este processo.</p>}
                {auditLogs.map(log=><article key={log.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-2"><h3 className="font-bold text-slate-900">{log.action}</h3><time className="text-xs font-medium text-slate-600">{log.timestamp}</time></div>
                  <p className="mt-1 break-words text-xs text-slate-600">{log.user}{log.role&&<span> · {log.role}</span>}</p>
                  <details className="mt-3 rounded-lg border border-slate-200 bg-slate-50"><summary className="cursor-pointer px-3 py-2 text-xs font-semibold text-[var(--portal-brand-action)]">Ver alterações</summary><div className="space-y-1 border-t border-slate-200 px-3 py-2 text-xs leading-5 text-slate-700">{log.details.split('\n').filter(Boolean).map((line,index)=>{const separator=line.indexOf(': ');return <div key={index} className="break-words">{separator>0?<><strong>{line.slice(0,separator)}:</strong> {line.slice(separator+2)}</>:line}</div>;})}</div></details>
                </article>)}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Document Preview & Correction Modals */}
      <DocumentPreviewModal
        readOnly={readOnly}
        document={selectedPreviewDoc}
        processProtocol={process.protocolo}
        onClose={() => setSelectedPreviewDoc(null)}
        onRequestCorrection={(doc) => {
          setSelectedPreviewDoc(null);
          setCorrectionDoc(doc);
        }}
      />

      <CorrectionRequestModal
        document={correctionDoc}
        processId={process.id}
        onClose={() => setCorrectionDoc(null)}
        onSuccess={() => loadData()}
      />

      {/* Master Admin Delete Confirmation Modal */}
      <PortalModalShell
        open={Boolean(showDeleteModal && process)}
        onClose={() => { setShowDeleteModal(false); setDeleteConfirmInput(''); }}
        title="Exclusão de Trabalho de TCC"
        subtitle="Ação administrativa do Master"
        icon={AlertTriangle}
        maxWidthClass="max-w-lg"
        zIndexClass="z-[1000003]"
      >
        <div className="space-y-4">
          <section className="rounded-xl border border-rose-300 bg-rose-50 p-4 text-xs text-rose-950">
            <p className="font-black">Você está prestes a excluir definitivamente este Trabalho de TCC.</p>
            <div className="mt-3 rounded-lg border border-rose-200 bg-white p-3 font-mono text-[11px] font-bold text-slate-900">
              <div>Protocolo: {process.protocolo}</div>
              <div className="truncate">Título: {process.titulo}</div>
              <div>Aluno(s): {formatStudentsString(process.aluno1, process.aluno2)}</div>
            </div>
            <p className="mt-3 text-[11px] font-semibold leading-5">Esta ação removerá os registros vinculados ao processo. Use somente quando a exclusão definitiva for realmente necessária.</p>
          </section>
          <section className="portal-modal-card p-4">
            <label className="mb-1 block text-xs font-bold text-slate-800">Para autorizar, digite <span className="font-mono font-black text-rose-700">Excluir</span>.</label>
            <input type="text" placeholder="Digite EXCLUIR para autorizar" value={deleteConfirmInput} onChange={(e) => setDeleteConfirmInput(e.target.value)} className="portal-input font-mono font-bold normal-case" />
          </section>
          <section className="portal-modal-card space-y-2 p-4 text-xs">
            <strong>Exclusão completa do TCC</strong>
            <p>Serão removidos os arquivos, as solicitações de assinatura, os eventos de agenda e o histórico vinculados a este trabalho nas plataformas integradas.</p>
            <p>Se algum serviço não confirmar a remoção, a limpeza continuará pendente em Configurações → Integrações e Plataforma. Modelos e registros de outros trabalhos serão preservados.</p>
          </section>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => { setShowDeleteModal(false); setDeleteConfirmInput(''); }} className="portal-action">Cancelar</button>
            <button type="button" onClick={handleDeleteProcess} disabled={isDeleting || deleteConfirmInput.trim().toUpperCase() !== 'EXCLUIR'} className="portal-action border-rose-700 bg-rose-700 text-white disabled:cursor-not-allowed disabled:opacity-40">
              {isDeleting ? 'Excluindo...' : 'Confirmar exclusão definitiva'}
            </button>
          </div>
        </div>
      </PortalModalShell>

    </div>
  );
};
