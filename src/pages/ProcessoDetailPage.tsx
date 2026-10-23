import {publicationDeclined,finalDeliveryMessage} from '../utils/finalDeliveryPresentation';
import {InlineProcessField} from '../components/InlineProcessField';
import {localDateTimeToIso} from '../utils/operationalConfig';
import {readProcessLink,setProcessLink,processLink,processWorkflowSection,type ProcessSection} from '../utils/processLink';
import { portalConfirm, portalNotice, portalPrompt } from '../services/portalDialogs';
import { AdvisorEvaluationPanel } from '../components/AdvisorEvaluationPanel';
import React, { useState, useEffect, useRef } from 'react';
import { ProcessData, ProcessDocument, ProcessRole, SignatureJob } from '../types';
import { TccDetailPopupFormat, DEFAULT_TCC_DETAIL_POPUP_FORMAT, loadTccDetailPopupFormat, TCC_DETAIL_POPUP_CONFIG_EVENT } from '../types/tccDetailFormat';
import { useAuth } from '../context/AuthContext';
import { apiClient } from '../services/apiClient';
import { useSignatureUpdates } from '../hooks/useSignatureUpdates';
import { formatDatePt, formatDateExtensoTotal, formatTimeExtenso, formatStudentsString, normalizeEmail, formatNameTitleCase } from '../utils/formatters';
import { ProcessFlowPanel } from '../components/ProcessFlowPanel';
import { GovbrSignatureModal } from '../components/GovbrSignatureModal';
import { PortalModalShell } from '../components/PortalModalShell';
import { EtapaProgressBar } from '../components/EtapaProgressBar';
import { StudentNames } from '../components/StudentNames';
import { DocumentPreviewModal } from '../components/DocumentPreviewModal';
import { CorrectionRequestModal } from '../components/CorrectionRequestModal';
import { TableScrollWrapper } from '../components/TableScrollWrapper';
import { resolveInstallationProfile } from '../utils/installationProfile';
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
  CheckCircle2,
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
  const { userEmail, isMasterAdmin, isCommissionPresident, memberships, settings } = useAuth();
  const installationProfile = resolveInstallationProfile(settings);
  const [process, setProcess] = useState<ProcessData | null>(null);
  const [documents, setDocuments] = useState<ProcessDocument[]>([]);
  const [signatureJobs,setSignatureJobs]=useState<SignatureJob[]>([]);
  const ataIsArchived=signatureJobs.filter(job=>job.documentType==='ATA'&&job.status!=='CANCELED').sort((a,b)=>b.documentVersion-a.documentVersion)[0]?.status==='ARCHIVED';
  const [signatureWorking,setSignatureWorking]=useState('');
  const [signatureNotice,setSignatureNotice]=useState<{ok:boolean;text:string}|null>(null);
  const [verifications,setVerifications]=useState<Array<{documentType:string;version:number;code:string;url:string;sha256?:string;signedAt?:string}>>([]);
  const [isDownloadingDossier,setIsDownloadingDossier]=useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

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

  const [copyFeedback,setCopyFeedback]=useState<{ok:boolean;text:string}|null>(null);
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
    const stage=processWorkflowSection(process),previous=workflowTab.current;
    const initial=!previous||previous.id!==process.id;
    const explicitlyLinked=typeof window!=='undefined'&&new URLSearchParams(window.location.search).has('secao');
    if((initial&&(!explicitlyLinked||process.status==='CONCLUIDO'||process.etapaAtual==='CONCLUIDO'))||(!initial&&previous.stage!==stage)){
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

  const [defesaForm, setDefesaForm] = useState({
    startAt: '',
    local: '',
    formato: 'Presencial'
  });

  const [bancaForm, setBancaForm] = useState<any[]>([]);

  // Local Session Audit Log
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);

  // Acervo Digital Form state
  const [acervoKeywords, setAcervoKeywords] = useState('');
  const [acervoResumo, setAcervoResumo] = useState('');
  const [acervoResumoExpandido, setAcervoResumoExpandido] = useState('');
  const [acervoTrabalhoCompleto, setAcervoTrabalhoCompleto] = useState('');
  const [termSignatureProvider,setTermSignatureProvider]=useState<'ASTEN'|'GOV_BR'>('ASTEN');
  const [acervoIsPublic, setAcervoIsPublic] = useState(false);
  const [acervoExpandedPublic, setAcervoExpandedPublic] = useState(false);
  const [acervoAuthorizationConfirmed, setAcervoAuthorizationConfirmed] = useState(false);
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

  const loadData = async ({ preserveAcervoDraft = false, quiet = false }: { preserveAcervoDraft?: boolean; quiet?:boolean } = {}) => {
    if(!quiet)setIsLoading(true);
    setErrorMsg('');
    try {
      const [pData, docsData,signatureData,verificationData] = await Promise.all([
        apiClient.getProcessById(processId),
        apiClient.getProcessDocuments(processId).catch(() => []),
        apiClient.getProcessSignatureJobs(processId).catch(() => []),
        apiClient.getProcessVerifications(processId).catch(() => [])
      ]);
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

      // Populate Defesa Form
      setDefesaForm({
        startAt: pData.defesa?.startAt ? pData.defesa.startAt.substring(0, 16) : '',
        local: pData.defesa?.local || '',
        formato: pData.defesa?.formato || 'Presencial'
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
          setAcervoAuthorizationConfirmed(Boolean(pData.acervo.authorizationConfirmedAt));
        }
      }

      // Generate audit log history
      const generatedLogs: AuditLogEntry[] = [
        {
          id: 'log-1',
          timestamp: pData.createdAt ? new Date(pData.createdAt).toLocaleString('pt-BR') : '10/08/2026 10:00:00',
          user: pData.createdByEmail || 'Discente',
          role: 'Discente Autor',
          action: 'CADASTRO_INICIAL',
          details: `Início do processo de TCC e submissão do protocolo ${pData.protocolo}`
        }
      ];

      if (pData.defesa?.startAt) {
        generatedLogs.push({
          id: 'log-2',
          timestamp: new Date(pData.createdAt || Date.now()).toLocaleString('pt-BR'),
          user: pData.orientador.email || 'Orientador',
          role: 'Docente Orientador',
          action: 'AGENDAMENTO_DEFESA',
          details: `Apresentação agendada para ${formatDatePt(pData.defesa.startAt)} às ${formatTimeExtenso(pData.defesa.startAt)} em ${pData.defesa.local}`
        });
      }

      if (pData.avaliacao?.status === 'CONCLUIDO') {
        generatedLogs.push({
          id: 'log-3',
          timestamp: pData.avaliacao.submittedAt ? new Date(pData.avaliacao.submittedAt).toLocaleString('pt-BR') : 'Avaliante',
          user: pData.avaliacao.submittedBy || pData.orientador.email,
          role: 'Docente Orientador',
          action: 'REGISTRO_RESULTADO_PARECER',
          details: `Registro do resultado final e parecer da avaliação`
        });
      }

      if (pData.acervo?.submittedAt) {
        generatedLogs.push({
          id: 'log-4',
          timestamp: new Date(pData.acervo.submittedAt).toLocaleString('pt-BR'),
          user: pData.acervo.submittedBy || 'Discente',
          role: 'Discente Autor',
          action: 'SUBMISSAO_REPOSITORIO',
          details: `Trabalho catalogado e submetido ao Acervo Digital com status ${pData.acervo.isPublic ? 'PÚBLICO' : 'PRIVADO'}`
        });
      }

      setAuditLogs(generatedLogs);
    } catch (err: any) {
      if(quiet)throw err;
      setErrorMsg(err.message || 'Erro ao carregar o processo.');
    } finally {
      if(!quiet)setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [processId, userEmail]);

  useSignatureUpdates({
    jobs: signatureJobs,
    processId,
    scopeKey: userEmail,
    enabled: !isLoading && !errorMsg && !editingSection && !signatureWorking,
    onChange: loadData,
  });

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
  const isStudent = normalizeEmail(process.aluno1.email) === normEmail || (process.aluno2 && normalizeEmail(process.aluno2.email) === normEmail);
  const isAdvisor = normalizeEmail(process.orientador.email) === normEmail;
  const isCoAdvisor = process.coorientador && normalizeEmail(process.coorientador.email) === normEmail;
  const isExaminer = process.banca.some((b) => normalizeEmail(b.email) === normEmail);

  const isEvaluationSubmitted = process.avaliacao?.status === 'CONCLUIDO' || process.avaliacao?.notaFinal !== undefined;
  const isAcervoSubmitted = Boolean(process.acervo?.submittedAt);

  const canStudentEdit = isStudent && !isEvaluationSubmitted && !isAcervoSubmitted && !readOnly;
  const canAdvisorEdit = (isAdvisor || isCoAdvisor) && !isAcervoSubmitted && !readOnly;
  const canCoordinatorEdit = isMasterAdmin && !readOnly;

  const canEditData = canCoordinatorEdit || Boolean((isStudent || isAdvisor) && !isEvaluationSubmitted && !readOnly && !process.defesa.invitationDriveFileId && !process.defesa.invitationSentAt);

  const canEditDefense=canCoordinatorEdit||Boolean((isStudent||isAdvisor)&&!readOnly);
  const defenseLocal=new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(process.defesa.startAt)).replace(' ','T');
  const inlineField=(label:string,value:string,patch:(value:string)=>Record<string,unknown>,type='text',display=value,editable=canEditData,confirmDefenseChange=false)=><InlineProcessField label={label} value={value} display={display} type={type} editable={editable} beforeEdit={confirmDefenseChange?()=>portalConfirm(`Tem certeza de que deseja alterar ${label==='Data da defesa'?'a data da defesa':label==='Horário da defesa'?'o horário da defesa':'o local da defesa'}? Essa mudança afeta o calendário da defesa. Informe o departamento sobre a alteração, pois ele reservou o local, a data e o horário anteriores. Confirme com o departamento a disponibilidade do novo agendamento. Ao salvar, o histórico registrará quem realizou a alteração, a data e hora do registro e os valores anteriores e novos.`,{title:'Atenção: alterar agendamento da defesa',tone:'warning',confirmLabel:'Sim, quero alterar',cancelLabel:'Manter como está'}):undefined} onSave={async next=>{await apiClient.updateProcess(process.id,patch(next.trim()));await loadData({quiet:true,preserveAcervoDraft:true});}}/>;

  const handleSignDocument=async(doc:ProcessDocument)=>{
    setSignatureWorking(doc.type);setSignatureNotice(null);
    try{
      const result=await apiClient.signProcessDocument(process.id,doc.type);
      setSignatureNotice({ok:true,text:result.message});
      await loadData();
    }catch(error){setSignatureNotice({ok:false,text:error instanceof Error?error.message:'Não foi possível enviar o documento à Asten.'});}
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

      const updatedDefesa = {
        local: defesaForm.local.trim() || process.defesa?.local || installationProfile.defaultDefenseLocation,
        startAt: defesaForm.startAt ? new Date(defesaForm.startAt).toISOString() : process.defesa.startAt,
        endAt: defesaForm.startAt ? new Date(Date.parse(defesaForm.startAt)+(settings.slotDurationMinutes||90)*60_000).toISOString() : process.defesa.endAt,
        alternateLocation: process.defesa.alternateLocation,
        formato: defesaForm.formato || 'Presencial'
      };

      await apiClient.updateProcess(process.id, {
        titulo: cadastralForm.titulo.trim(),
        aluno1: updatedAluno1,
        aluno2: updatedAluno2,
        orientador: updatedOrientador,
        coorientador: updatedCoorientador,
        defesa: updatedDefesa
      });

      const newLog: AuditLogEntry = {
        id: `log-${Date.now()}`,
        timestamp: new Date().toLocaleString('pt-BR'),
        user: userEmail || 'Usuário do Sistema',
        role: isCommissionPresident ? 'Presidente da Comissão' : isMasterAdmin ? 'Administrador Master' : 'Orientador',
        action: 'EDICAO_FICHA_CADASTRAL',
        details: `Atualização dos dados cadastrais e agendamento (Título: "${cadastralForm.titulo.substring(0, 35)}...")`
      };
      setAuditLogs(prev => [newLog, ...prev]);

      setEditingSection(null);
      await loadData();
      portalNotice('Ficha cadastral e agendamento atualizados com sucesso!');
    } catch (err: any) {
      portalNotice(err.message || 'Erro ao salvar alterações da ficha cadastral.');
    }
  };

  const handleSaveDefesaEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!process) return;
    try {
      const updatedDefesa = {
        local: defesaForm.local.trim(),
        startAt: defesaForm.startAt ? new Date(defesaForm.startAt).toISOString() : process.defesa.startAt,
        endAt: defesaForm.startAt ? new Date(Date.parse(defesaForm.startAt)+(settings.slotDurationMinutes||90)*60_000).toISOString() : process.defesa.endAt,
        alternateLocation: process.defesa.alternateLocation,
        formato: defesaForm.formato
      };

      await apiClient.updateProcess(process.id, {
        defesa: updatedDefesa
      });

      const newLog: AuditLogEntry = {
        id: `log-${Date.now()}`,
        timestamp: new Date().toLocaleString('pt-BR'),
        user: userEmail || 'Usuário do Sistema',
        role: isCommissionPresident ? 'Presidente da Comissão' : isMasterAdmin ? 'Administrador Master' : 'Orientador',
        action: 'EDICAO_DEFESA',
        details: `Alteração no agendamento da defesa: ${formatDatePt(updatedDefesa.startAt)} em ${updatedDefesa.local}`
      };
      setAuditLogs(prev => [newLog, ...prev]);

      setEditingSection(null);
      await loadData();
      portalNotice('Dados da defesa e agendamento atualizados com sucesso!');
    } catch (err: any) {
      portalNotice(err.message || 'Erro ao salvar alterações da defesa.');
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
    if (!process) return;
    try {
      await apiClient.updateProcess(process.id, {
        banca: bancaForm
      });

      const newLog: AuditLogEntry = {
        id: `log-${Date.now()}`,
        timestamp: new Date().toLocaleString('pt-BR'),
        user: userEmail || 'Usuário do Sistema',
        role: isCommissionPresident ? 'Presidente da Comissão' : isMasterAdmin ? 'Administrador Master' : 'Orientador',
        action: 'EDICAO_BANCA',
        details: `Atualização da composição da banca examinadora (${bancaForm.length} membros)`
      };
      setAuditLogs(prev => [newLog, ...prev]);

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
      window.open(driveDownloadUrl, '_blank');
      return;
    }

    portalNotice('O PDF ainda não foi arquivado no Google Drive. Aguarde a conclusão da etapa correspondente.');
  };

  const handleSubmitAcervo = async (e: React.FormEvent) => {
    e.preventDefault();
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
    if((acervoIsPublic||acervoExpandedPublic)&&!acervoAuthorizationConfirmed){
      portalNotice('Confirme expressamente os arquivos que serão publicados.');
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
        signatureProvider: termSignatureProvider,
        authorizationConfirmed: (acervoIsPublic||acervoExpandedPublic)&&acervoAuthorizationConfirmed
      });

      const newLog: AuditLogEntry = {
        id: `log-acervo-${Date.now()}`,
        timestamp: new Date().toLocaleString('pt-BR'),
        user: userEmail || 'Discente',
        role: 'Discente Autor',
        action: 'SUBMISSAO_REPOSITORIO',
        details: `Entrega final registrada. Publicação solicitada: ${acervoIsPublic || acervoExpandedPublic ? 'Sim; aguarda documentos e assinaturas aplicáveis.' : 'Não.'}`
      };
      setAuditLogs(prev => [newLog, ...prev]);

      portalNotice(finalDeliveryMessage(result));
      await loadData();
    } catch (err: any) {
      portalNotice(err.message || 'Erro ao salvar dados do acervo.');
    } finally {
      setIsSubmittingAcervo(false);
    }
  };

  const handleAcervoPdfUpload = async (kind:'trabalho-completo'|'resumo-expandido',file?:File) => {
    if(!file||acervoUploading||isSubmittingAcervo)return;
    if(file.type!=='application/pdf'&&!file.name.toLowerCase().endsWith('.pdf')){portalNotice('Selecione um arquivo PDF.');return;}
    if(file.size>24*1024*1024){portalNotice('O PDF deve ter no máximo 24 MB.');return;}
    setAcervoUploading(kind);
    try{
      const uploaded=await apiClient.uploadProcessPdfFile(processId,kind,file);
      if(kind==='trabalho-completo')setAcervoTrabalhoCompleto(uploaded.fileName);else setAcervoResumoExpandido(uploaded.fileName);
      portalNotice('PDF armazenado com segurança na pasta deste TCC no Google Drive.');
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
      await apiClient.deleteProcess(process.id);
      portalNotice('Trabalho de TCC excluído com sucesso.');
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
      className={`portal-tcc-detail ${isModal ? 'space-y-0' : 'space-y-3 mx-auto'} ${modalWidthClass} ${modalRadiusClass} ${modalShadowClass} ${isModal ? 'overflow-visible pb-5' : 'overflow-hidden'}`}
      style={{ backgroundColor: 'var(--portal-surface-page)', color: '#0f172a' }}
    >
      {isModal ? (
        <header className="portal-modal-header sticky top-0 z-30 flex items-center justify-between gap-3 px-4" style={{ backgroundColor: 'var(--portal-brand-header)', color: '#ffffff' }}>

          <div className="flex min-w-0 items-center gap-2"><FileText className="h-4 w-4 shrink-0 text-white" aria-hidden="true"/><div className="min-w-0"><h1 className="truncate text-[12px] font-black normal-case tracking-wide">Detalhes do TCC</h1></div></div>
          <div className="relative flex shrink-0 items-center gap-1.5">
            <span role="status" aria-live="polite" aria-atomic="true" className={copyFeedback?'portal-copy-feedback pointer-events-none absolute right-0 top-full z-50 mt-2 w-max max-w-[min(300px,80vw)] whitespace-normal rounded-lg border border-slate-300 bg-[var(--portal-surface-card)] px-3 py-2 text-xs font-normal normal-case text-slate-800 shadow-sm':'sr-only'}>{copyFeedback?.text||''}</span>
          <button type="button" className="portal-toolbar-icon-button rounded-full bg-white text-slate-950" aria-label="Copiar link do trabalho" title="Copiar link do trabalho" onClick={()=>void copyProcessLink()}><LinkIcon className="h-4 w-4"/></button>
            <button type="button" onClick={()=>setShowAuditLogModal(true)} className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white bg-white text-slate-950" title="Histórico de Auditoria" aria-label="Abrir histórico de auditoria"><History className="h-4 w-4"/></button>
            {isMasterAdmin&&<button type="button" onClick={()=>setShowDeleteModal(true)} className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white bg-white text-rose-700" aria-label="Excluir trabalho"><Trash2 className="h-4 w-4"/></button>}
          </div>
        </header>
      ) : null}
      {isModal && <div className="portal-modal-divider" aria-hidden="true" />}
      {localFormat.showStateMachine !== false && <div className="px-3 pt-3"><EtapaProgressBar currentEtapa={process.etapaAtual}/></div>}
      <section id="tcc-detail-workspace" className="portal-tcc-workspace mx-3 mt-3">
      <section aria-label="Seções do TCC" className="portal-tcc-workspace-tabs"><div className="portal-tcc-tab-list flex flex-wrap items-stretch gap-1">{[
        {id:'cadastral',label:'Dados do processo',icon:FileText,show:localFormat.showSectionCadastral!==false||localFormat.showSectionBanca!==false},{id:'avaliacao',label:'Avaliação e ata',icon:Award,show:localFormat.showSectionAvaliacao!==false},{id:'acervo',label:'Repositório',icon:BookOpen,show:localFormat.showSectionAcervo!==false},{id:'docs',label:'Documentos do processo',icon:FileCheck,show:localFormat.showSectionDocs!==false}
      ].filter(t=>t.show!==false).map(tab=>{const Icon=tab.icon;const selected=activeTab===tab.id;return <button key={tab.id} type="button" onClick={()=>{setActiveTab(tab.id);setProcessLink(process.id,tab.id as ProcessSection);}} aria-pressed={selected} className={`flex min-h-9 min-w-0 flex-1 justify-center items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[10px] font-bold ${selected?'portal-tcc-tab-selected border-[var(--portal-brand-header)] bg-white text-slate-950':'border-white bg-white text-slate-700'}`}><Icon className="h-3.5 w-3.5 text-[var(--portal-brand-action)]"/><span>{tab.label}</span></button>})}</div></section>
      <div className="portal-tcc-workspace-content p-3">

      {/* ========================================================================= */}
      {/* SECTION 1: FICHA CADASTRAL E IDENTIFICAÇÃO DO PROCESSO                    */}
      {/* ========================================================================= */}
      {localFormat.showSectionCadastral !== false && isTabVisible('cadastral') && (
        <div className="portal-tcc-cadastral overflow-hidden">

          <div className="p-4 sm:p-5">
            <div className="space-y-3">
              <section className="portal-tcc-data-box" aria-label="Dados do processo">
                <h2 className="mb-3 text-xs font-bold normal-case">Dados do processo</h2>
                <div className="portal-tcc-record-row portal-tcc-record-row-primary">
                  <div><span>Protocolo</span>{inlineField('Protocolo',process.protocolo,value=>({protocolo:value}),'text',process.protocolo,isMasterAdmin&&!readOnly)}</div>
                  <div className="portal-tcc-record-title"><span>Título do trabalho</span>{inlineField('Título do trabalho',process.titulo,value=>({titulo:value}))}</div>
                  <div><span>Data de registro</span><strong>{new Date(process.createdAt).toLocaleDateString('pt-BR')}</strong></div>
                </div>
                <div className="portal-tcc-record-row portal-tcc-record-row-defense">
                  <div><span>Data da defesa</span>{inlineField('Data da defesa',defenseLocal.slice(0,10),value=>({defesa:{startAt:localDateTimeToIso(`${value}T${defenseLocal.slice(11,16)}`,'America/Sao_Paulo')}}),'date',formatDatePt(process.defesa.startAt),canEditDefense,true)}</div>
                  <div><span>Horário</span>{inlineField('Horário da defesa',defenseLocal.slice(11,16),value=>({defesa:{startAt:localDateTimeToIso(`${defenseLocal.slice(0,10)}T${value}`,'America/Sao_Paulo')}}),'time',formatTimeExtenso(process.defesa.startAt),canEditDefense,true)}</div>
                  <div><span>Local da defesa</span>{inlineField('Local da defesa',process.defesa.local,value=>({defesa:{local:value}}),'text',process.defesa.local||'A confirmar',canEditDefense,true)}</div>
                </div>
              </section>
              <section className="portal-tcc-members-box"><h2 className="mb-3 text-xs font-bold normal-case">Dados dos membros</h2><dl className="portal-tcc-people-grid">
                {[
                  {role:'Discente autor 1',person:process.aluno1,student:true,key:'aluno1'},
                  ...(process.aluno2?[{role:'Discente autor 2',person:process.aluno2,student:true,key:'aluno2'}]:[]),
                  {role:'Orientador(a)',person:process.orientador,student:false,key:'orientador'},
                  ...process.banca.filter(person=>normalizeEmail(person.email)!==normalizeEmail(process.orientador.email)&&normalizeEmail(person.email)!==normalizeEmail(process.coorientador?.email||'')).map((person,index)=>({role:`Examinador ${index+1}`,person,student:false,key:'banca'})),
                  ...(process.coorientador?.nome?.trim()?[{role:'Coorientador(a)',person:process.coorientador,student:false,key:'coorientador'}]:[])
                ].map(({role,person,student,key})=>{
                  const field=(property:string,value:string)=>key==='banca'?{banca:process.banca.map(member=>member===person?{...member,[property]:value}:member)}:{[key]:{...person,[property]:value}};
                  return <div key={role}><dt>{role}</dt>
                    <dd className="portal-member-field font-bold"><span className="portal-member-field-label">Nome</span>{inlineField(`Nome — ${role}`,person.nome,value=>field('nome',value))}</dd>
                    {(student?localFormat.showStudentEmail:localFormat.showAdvisorEmail)!==false&&<dd className="portal-member-field"><span className="portal-member-field-label">E-mail</span>{inlineField(`E-mail — ${role}`,person.email,value=>field('email',value),'email')}</dd>}
                    {(!student||localFormat.showStudentMatricula!==false)&&<dd className="portal-member-field"><span className="portal-member-field-label">Número de registro<br/>(matrícula, SIAPE ou outros)</span>{inlineField(`Número de registro — ${role}`,String(student?('matricula' in person?person.matricula:''):('siape' in person?person.siape||'':'')),value=>field(student?'matricula':'siape',value))}</dd>}
                    {(student||localFormat.showAdvisorInstitution!==false)&&<dd className="portal-member-field"><span className="portal-member-field-label">Instituição</span>{student?<span className="portal-inline-field-value">UFES</span>:inlineField(`Instituição — ${role}`,String(('instituicao' in person&&person.instituicao)||''),value=>field('instituicao',value))}</dd>}
                  </div>;
                })}
              </dl></section>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SECTION 3: COMPOSIÇÃO DA BANCA EXAMINADORA                                */}
      {/* ========================================================================= */}
      {isTabVisible('cadastral') && process.defesa.localStatus !== 'CONFIRMADO' && <ProcessFlowPanel process={process} jobs={signatureJobs} canConfirm={(isStudent || isMasterAdmin) && !readOnly} onUpdated={loadData}/>}
      {/* ========================================================================= */}
      {/* SECTION 4: CAMPO DE AVALIAÇÃO E NOTAS DA BANCA                            */}
      {/* ========================================================================= */}
      {localFormat.showSectionAvaliacao !== false && isTabVisible('avaliacao') && (
        <AdvisorEvaluationPanel process={process} canEvaluate={(isAdvisor || isMasterAdmin) && !readOnly}
          canReopen={isMasterAdmin && !readOnly} onReopen={handleReopenEvaluation} onUpdated={loadData} />
      )}

      {/* ========================================================================= */}
      {/* SECTION 5: PAINEL DE DOCUMENTOS E ASSINATURAS GERENCIADAS                */}
      {/* ========================================================================= */}
      {localFormat.showSectionDocs !== false && isTabVisible('docs') && (
        <div id="documents-panel-section" className="portal-card overflow-hidden space-y-0">
          <div className="px-4 pt-3 flex items-center justify-end gap-2">

            <div className="flex items-center gap-2">
              {(isMasterAdmin || isCommissionPresident) && (
                <button type="button" onClick={()=>{setDownloadSelection(documents.filter(doc=>doc.status==='DISPONIVEL'||doc.status==='ASSINADO').map(doc=>doc.type));setDownloadPicker(true);}} disabled={isDownloadingDossier} className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-700 disabled:opacity-60" aria-label="Escolher documentos para baixar" title="Baixar documentos">
                  <Download className="h-4 w-4" />
                </button>
              )}
              <span className="text-[11px] text-slate-500 font-medium">
                {documents.length} documento(s)
              </span>
            </div>
          </div>

          <div className="p-3 sm:p-4 space-y-3">
            {signatureNotice&&<div role="status" className={`rounded-lg border p-3 text-xs font-bold ${signatureNotice.ok?'border-[var(--portal-border)] bg-[var(--portal-surface-inner)] text-[var(--portal-brand-header)]':'border-red-200 bg-red-50 text-red-900'}`}>{signatureNotice.text}</div>}

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

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3.5">
              {documents.map((doc) => {
                const termDeclined=doc.type==='TERMO'&&publicationDeclined(process);
                const isDownloadable = !termDeclined&&(doc.status === 'DISPONIVEL' || doc.status === 'ASSINADO');
                const latestJob=signatureJobs.filter(job=>job.documentType===doc.type&&job.status!=='CANCELED').sort((a,b)=>b.documentVersion-a.documentVersion)[0];
                const alreadySent=Boolean(latestJob&&['SENDING','SENT','PARTIALLY_SIGNED','SIGNED','DRIVE_SYNC_PENDING','ARCHIVED'].includes(latestJob.status));
                const canRequestSignature=!termDeclined&&doc.requiresSignature&&doc.status!=='NAO_DISPONIVEL'&&(isMasterAdmin||(doc.type==='ATA'&&isAdvisor)||(doc.type==='TERMO'&&(isStudent||isAdvisor)));

                const getDocInfo = (type: string) => {
                  switch (type) {
                    case 'CONVITE':
                      return { title: '1. Carta-Convite da Banca', signNote: 'Não requer assinatura', availability: 'Confirme o local e envie o convite à banca.' };
                    case 'ATA':
                      return { title: '2. Ata Oficial da Defesa Final', signNote: 'Professor orientador', availability: 'Aguarda confirmação da ata após a defesa.' };
                    case 'TERMO':
                      return { title: '3. Termo de Autorização e Publicação', signNote: 'Orientador e todos os autores', availability: 'Solicite publicação na entrega do Repositório.' };
                    case 'DECLARACAO':
                      return { title: '4. Declaração de Participação na Banca', signNote: 'Presidência', availability: 'Aguarda entrega final, ata e termo aplicável assinados.' };
                    default:
                      return { title: doc.title, signNote: 'Assinatura gerenciada pelo portal', availability: 'Após concluir a etapa responsável pela geração deste documento.' };
                  }
                };

                const docInfo = getDocInfo(doc.type);
                const downloadPending=termDeclined?'Não foi autorizada a publicação do trabalho nem do resumo expandido por autores e orientação.':doc.status==='NAO_DISPONIVEL'?docInfo.availability:doc.status==='GERANDO'?'O PDF está sendo gerado.':doc.status==='AGUARDANDO_ASSINATURA'?'Aguarda as assinaturas e o arquivamento do PDF.':doc.status==='COM_ERRO'?'A geração falhou. A comissão deve verificar a pendência.':'Consulte a versão atual deste documento.';

                return (
                  <div
                    key={doc.id}
                    className={`portal-tcc-document-card ${isDownloadable?'':'portal-document-unavailable'} border border-slate-200/90 rounded-xl p-3.5 flex flex-col gap-3`}
                  >
                    {/* Header: Document Title, Version and Status Badge */}
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-8 h-8 rounded-lg bg-[var(--portal-surface-inner)] text-[var(--portal-brand-header)] border border-[var(--portal-border)] flex items-center justify-center shrink-0">
                            <FileCheck className="w-4 h-4 text-[var(--portal-brand-header)]" />
                          </div>
                          <div className="min-w-0">
                            <h3 className="portal-document-title font-extrabold text-xs sm:text-[13px] text-slate-900 leading-snug" title={docInfo.title}>
                              {doc.type==='CONVITE'?<>1. Carta-Convite<br/>da Banca</>:doc.type==='ATA'?<>2. Ata Oficial<br/>da Defesa Final</>:docInfo.title}
                            </h3>
                            <span className="text-[10px] font-mono font-bold text-[var(--portal-text-muted)]">
                              Versão {doc.currentVersion}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="portal-document-signers p-1.5 bg-white border border-slate-200 rounded text-[10px] text-slate-600 font-medium">
                        <span className="font-bold">{doc.type==='CONVITE'?'Assinatura':'Quem assina'}</span>
                        <span>{termDeclined?'Não necessária':doc.type==='CONVITE'?'Não necessária':docInfo.signNote}</span>
                      </div>

                      {/* Status Badge */}
                      <div className="flex flex-wrap items-start justify-between gap-2 pt-1">
                        <span
                          className={`portal-document-status font-black normal-case text-[10px] px-2.5 py-0.5 rounded-md border tracking-wide ${
                            doc.status === 'ASSINADO' || doc.status === 'DISPONIVEL'
                              ? 'portal-document-status-available'
                              : doc.status === 'COM_ERRO'
                                ? 'bg-rose-50 text-rose-800 border-rose-200'
                                : 'bg-amber-50 text-amber-800 border-amber-200'
                          }`}
                        >
                          {termDeclined?'Não autorizado':doc.status === 'NAO_DISPONIVEL' ? 'Não disponível' : ({DISPONIVEL:'Disponível',ASSINADO:'Assinado',AGUARDANDO_ASSINATURA:'Aguardando assinatura'}[doc.status] || 'Não disponível')}
                          {!isDownloadable&&<span className="block text-[11px] font-medium normal-case leading-snug tracking-normal">{downloadPending}</span>}
                        </span>

                      </div>
                    </div>

                    {((canRequestSignature&&!alreadySent)||latestJob?.provider==='GOV_BR')&&<div className="portal-document-signature-actions flex flex-col gap-2">
                    {canRequestSignature&&!alreadySent&&<button type="button" onClick={()=>handleSignDocument(doc)} disabled={signatureWorking!==''} className="portal-document-sign inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-bold"><ShieldCheck className="h-4 w-4"/>Asten</button>}
                    {canRequestSignature&&!alreadySent&&<button type="button" onClick={()=>setGovbrDocument(doc)} className="portal-action"><FileCheck className="h-4 w-4"/>Gov.br</button>}
                    {latestJob?.provider==='GOV_BR'&&<button type="button" onClick={()=>setGovbrDocument(doc)} className="portal-action">Continuar Gov.br</button>}
                    </div>}

                    {/* Action Buttons: Ver & Baixar PDF */}
                    <div className="portal-document-actions flex items-center gap-2 pt-2.5 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => setSelectedPreviewDoc(doc)}
                        disabled={!isDownloadable}
                        className="portal-document-view flex-1 inline-flex items-center justify-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg border border-slate-200 transition-colors cursor-pointer disabled:cursor-not-allowed"
                        title="Visualizar documento em tela"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Ver</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDirectDownload(doc)}
                        disabled={!isDownloadable}
                        className={`portal-document-download flex-1 inline-flex items-center justify-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg transition-all shadow-2xs ${
                          isDownloadable
                            ? 'text-white bg-[var(--portal-brand-header)] hover:bg-[#004827] cursor-pointer'
                            : 'bg-slate-200 text-[var(--portal-text-muted)] cursor-not-allowed'
                        }`}
                        title="Baixar PDF do documento"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Baixar PDF</span>
                      </button>
                    </div>

                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SECTION 6: FICHA E ACERVO PÚBLICO NO REPOSITÓRIO DIGITAL                  */}
      {/* ========================================================================= */}
      {localFormat.showSectionAcervo !== false && isTabVisible('acervo') && (
        <div id="acervo-digital-section" className="overflow-hidden">
          <div className="portal-repository-content">
            {readOnly ? (
              <div className="portal-repository-grid">
                <section className="rounded-xl border border-slate-200 bg-white p-4"><h3 className="mb-3 text-xs font-bold">Resumo síntese do TCC</h3><p className="whitespace-pre-wrap text-sm">{process.acervo?.resumoSintese||'Resumo ainda não informado.'}</p></section>
                <section className="rounded-xl border border-slate-200 bg-white p-4"><h3 className="mb-3 text-xs font-bold">Palavras-chave</h3><div className="grid grid-cols-1 gap-2 sm:grid-cols-5">{(process.acervo?.palavrasChave||[]).map((word,index)=><span key={index} className="rounded-lg border border-slate-200 bg-slate-50 p-2 text-xs">{word}</span>)}</div></section>
                {[
                  {kind:'trabalho-completo',title:'Trabalho completo',id:process.acervo?.trabalhoCompletoFileId,name:process.acervo?.trabalhoCompletoFileName},
                  {kind:'resumo-expandido',title:'Resumo expandido',id:process.acervo?.resumoExpandidoFileId,name:process.acervo?.resumoExpandidoFileName},
                ].map(file=><section key={file.kind} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4"><div><h3 className="text-xs font-bold">{file.title}</h3><p className="mt-2 text-sm">{file.name||'Não anexado'}</p></div><button type="button" disabled={!file.id} className="portal-action" onClick={()=>window.open(`/api/processes/${process.id}/files/${file.kind}/download`,'_blank','noopener,noreferrer')}><Download className="h-4 w-4"/>Baixar</button></section>)}
              </div>
            ) : (
              <form id="repository-delivery-form" onSubmit={handleSubmitAcervo} className="space-y-2">
                <fieldset className="portal-repository-grid">
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
                      onChange={(e) => setAcervoResumo(e.target.value)}
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

                    <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">{Array.from({length:5},(_,index)=><input key={index} aria-label={`Palavra-chave ${index+1}`} required disabled={!ataIsArchived} className="portal-input" value={acervoKeywords.split(',')[index]||''} onChange={event=>{const words=Array.from({length:5},(_,i)=>acervoKeywords.split(',')[i]||'');words[index]=event.target.value.replaceAll(',','');setAcervoKeywords(words.join(','));}}/>)}</div>
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

                    <input
                      type="file"
                      accept="application/pdf,.pdf"
                      required={!acervoTrabalhoCompleto}
                      disabled={!ataIsArchived || Boolean(acervoUploading)}
                      onChange={(e) => handleAcervoPdfUpload('trabalho-completo',e.target.files?.[0])}
                      className="w-full text-xs font-medium p-2.5 border border-slate-300 rounded-lg bg-[var(--portal-surface-inner)] file:mr-3 file:border-0 file:rounded-md file:bg-[var(--portal-brand-header)] file:text-white file:px-3 file:py-1.5 file:font-bold"
                    />
                    <p className="portal-repository-file-status text-[11px] text-[var(--portal-brand-header)] font-semibold break-all" aria-hidden={!acervoTrabalhoCompleto}>{acervoTrabalhoCompleto ? <>Armazenado: {acervoTrabalhoCompleto}</> : null}</p>
                  <label htmlFor="acervo-public-toggle" className="portal-repository-choice flex items-center gap-2.5 cursor-pointer select-none rounded-lg border border-slate-200 bg-white p-3">
                    <input
                      id="acervo-public-toggle"
                      type="checkbox"
                      checked={acervoIsPublic}
                      onChange={(e) => {setAcervoIsPublic(e.target.checked);setAcervoAuthorizationConfirmed(false);}}
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

                    <input
                      type="file"
                      accept="application/pdf,.pdf"
                      disabled={!ataIsArchived || Boolean(acervoUploading)}
                      onChange={(e) => handleAcervoPdfUpload('resumo-expandido',e.target.files?.[0])}
                      className="w-full text-xs font-medium p-2.5 border border-slate-300 rounded-lg bg-[var(--portal-surface-inner)] file:mr-3 file:border-0 file:rounded-md file:bg-[var(--portal-brand-header)] file:text-white file:px-3 file:py-1.5 file:font-bold"
                    />
                    <p className="portal-repository-file-status text-[11px] text-[var(--portal-brand-header)] font-semibold break-all" aria-hidden={!acervoResumoExpandido}>{acervoResumoExpandido ? <>Armazenado: {acervoResumoExpandido}</> : null}</p>
                  <label htmlFor="acervo-expanded-public-toggle" className={`portal-repository-choice flex items-center gap-2.5 select-none rounded-lg border border-slate-200 bg-white p-3 ${acervoResumoExpandido?'cursor-pointer':'cursor-not-allowed opacity-60'}`}>
                    <input
                      id="acervo-expanded-public-toggle"
                      type="checkbox"
                      checked={acervoExpandedPublic}
                      disabled={!acervoResumoExpandido}
                      onChange={(e) => {setAcervoExpandedPublic(e.target.checked);setAcervoAuthorizationConfirmed(false);}}
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


                  {(acervoIsPublic||acervoExpandedPublic)&&<label className="block text-xs font-bold">Assinatura do Termo<select aria-label="Assinatura do Termo" className="portal-input mt-1" value={termSignatureProvider} onChange={event=>setTermSignatureProvider(event.target.value as 'ASTEN'|'GOV_BR')}><option value="ASTEN">Asten, assinatura pelo e-mail</option><option value="GOV_BR">Gov.br, devolver PDF com todas as assinaturas</option></select></label>}
                  {(acervoIsPublic||acervoExpandedPublic)&&<label className="flex items-start gap-2.5 rounded-lg border border-amber-300 bg-amber-50 p-3 text-amber-950">
                    <input type="checkbox" required checked={acervoAuthorizationConfirmed} onChange={(event)=>setAcervoAuthorizationConfirmed(event.target.checked)} className="mt-0.5 h-4 w-4 rounded border-amber-400 text-[var(--portal-brand-header)]"/>
                    <span className="text-xs leading-5"><strong>Autorizo a publicação:</strong> {acervoIsPublic?'trabalho completo':''}{acervoIsPublic&&acervoExpandedPublic?' e ':''}{acervoExpandedPublic?'resumo expandido':''}. Esta escolha gerará o Termo de Autorização para assinatura do(s) aluno(s) e orientador pelo meio selecionado.</span>
                  </label>}

            {(isMasterAdmin||isStudent)&&!isAcervoSubmitted&&!readOnly&&<div className="flex justify-center pt-2"><button type="submit" disabled={isSubmittingAcervo||Boolean(acervoUploading)||!ataIsArchived} className="portal-action portal-button-primary"><Save className="h-4 w-4"/>{isSubmittingAcervo?'Salvando e finalizando…':'Salvar no acervo e finalizar o processo'}</button></div>}

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
      {govbrDocument&&<GovbrSignatureModal process={process} documentType={govbrDocument.type as 'ATA'|'TERMO'|'DECLARACAO'} canApprove={isMasterAdmin} initialJob={signatureJobs.find(job=>job.documentType===govbrDocument.type&&job.provider==='GOV_BR'&&job.sourceDataRevision===process.dataRevision&&job.status!=='CANCELED')} onChange={()=>void loadData()} onClose={()=>setGovbrDocument(null)}/>}
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
                <p className="mt-0.5 text-[10px] font-mono text-white/80">Protocolo: {process.protocolo}</p>
              </div>
            </header>
            <div className="portal-modal-divider" aria-hidden="true" />
            <div className="max-h-[calc(85vh-58px)] overflow-y-auto" style={{ backgroundColor: 'var(--portal-surface-page)' }}>
                <TableScrollWrapper>
                  <table className="w-full border-collapse text-left text-xs" style={{ backgroundColor: 'var(--portal-surface-panel)' }}>
                    <thead>
                      <tr className="border-b border-slate-300 text-[10px] font-extrabold normal-case tracking-wider text-slate-900" style={{ backgroundColor: 'var(--portal-surface-card)' }}>
                        <th className="p-3">Data e Hora</th>
                        <th className="p-3">Usuário / Papel</th>
                        <th className="p-3">Ação Realizada</th>
                        <th className="p-3">Detalhamento</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-300">
                      {auditLogs.map((log) => (
                        <tr key={log.id} className="bg-white/70 hover:bg-white">
                          <td className="p-3 font-mono font-bold text-slate-700 whitespace-nowrap">{log.timestamp}</td>
                          <td className="p-3"><div className="font-bold text-slate-900">{log.user}</div><span className="text-[10px] font-mono text-[var(--portal-brand-action)]">{log.role}</span></td>
                          <td className="p-3"><span className="text-[10px] font-bold text-slate-800">{log.action}</span></td>
                          <td className="p-3 leading-snug text-slate-700">{log.details}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </TableScrollWrapper>
            </div>
          </div>
        </div>
      )}

      {/* Document Preview & Correction Modals */}
      <DocumentPreviewModal
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
        subtitle="Ação administrativa irreversível"
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
