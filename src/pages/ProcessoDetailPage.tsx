import { portalNotice, portalPrompt } from '../services/portalDialogs';
import { AdvisorEvaluationPanel } from '../components/AdvisorEvaluationPanel';
import React, { useState, useEffect } from 'react';
import { ProcessData, ProcessDocument, ProcessRole, SignatureJob } from '../types';
import { TccDetailPopupFormat, DEFAULT_TCC_DETAIL_POPUP_FORMAT, loadTccDetailPopupFormat, TCC_DETAIL_POPUP_CONFIG_EVENT } from '../types/tccDetailFormat';
import { useAuth } from '../context/AuthContext';
import { apiClient } from '../services/apiClient';
import { formatDatePt, formatDateExtensoTotal, formatTimeExtenso, formatStudentsString, normalizeEmail, formatNameTitleCase } from '../utils/formatters';
import { EtapaProgressBar } from '../components/EtapaProgressBar';
import { StudentNames } from '../components/StudentNames';
import { DocumentPreviewModal } from '../components/DocumentPreviewModal';
import { CorrectionRequestModal } from '../components/CorrectionRequestModal';
import { TableScrollWrapper } from '../components/TableScrollWrapper';
import { NursingEmblemLogo } from '../components/NursingEmblemLogo';
import { DynamicStudioForms } from '../components/DynamicStudioForms';
import { ProcessFlowPanel } from '../components/ProcessFlowPanel';
import { resolveInstallationProfile } from '../utils/installationProfile';
import {
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
  RotateCcw,
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
  X,
  Info,
  Building,
  GraduationCap,
  Palette,
  Sliders,
  Sparkles,
  Layers,
  Plus,
  ClipboardList
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

  const [activeTab, setActiveTab] = useState<string>('cadastral');

  // Modals & Popovers state
  const [showGearMenu, setShowGearMenu] = useState(false);
  const [showAuditLogModal, setShowAuditLogModal] = useState(false);
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

  const loadData = async () => {
    setIsLoading(true);
    setErrorMsg('');
    try {
      const [pData, docsData,signatureData,verificationData] = await Promise.all([
        apiClient.getProcessById(processId),
        apiClient.getProcessDocuments(processId),
        apiClient.getProcessSignatureJobs(processId),
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
        setAcervoKeywords(pData.acervo.palavrasChave ? pData.acervo.palavrasChave.join(', ') : '');
        setAcervoResumo(pData.acervo.resumoSintese || '');
        setAcervoResumoExpandido(pData.acervo.resumoExpandidoFileName || '');
        setAcervoTrabalhoCompleto(pData.acervo.trabalhoCompletoFileName || '');
        setAcervoIsPublic(Boolean(pData.acervo.publishFullWork));
        setAcervoExpandedPublic(Boolean(pData.acervo.publishExpandedAbstract));
        setAcervoAuthorizationConfirmed(Boolean(pData.acervo.authorizationConfirmedAt));
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
          action: 'LANÇAMENTO_NOTA_ATA',
          details: `Lançamento do Parecer Final e Nota: ${pData.avaliacao.notaFinal?.toFixed(2)} (${pData.avaliacao.resultadoLabel})`
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
      setErrorMsg(err.message || 'Erro ao carregar o processo.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [processId, userEmail]);

  if (isLoading) {
    return (
      <div className="bg-white p-12 text-center rounded-2xl border border-slate-200 text-slate-600 font-medium shadow-2xs">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-emerald-600 border-t-transparent mb-3"></div>
        <p className="text-xs font-bold uppercase tracking-wider text-emerald-950">Carregando Ficha e Dados do TCC...</p>
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

  const canEditData = canCoordinatorEdit;

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
      const { blob, fileName } = await apiClient.downloadInstitutionalDossier(process.id);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
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

      portalNotice(result.workflowPending
        ? `Entrega final salva. Há uma pendência no arquivamento ou nos documentos: ${result.workflowError || 'a secretaria deve acompanhar a etapa.'}`
        : 'Entrega final salva. Acompanhe os documentos e as assinaturas. A publicação autorizada será liberada após a conclusão das etapas aplicáveis.');
      await loadData();
    } catch (err: any) {
      portalNotice(err.message || 'Erro ao salvar dados do acervo.');
    } finally {
      setIsSubmittingAcervo(false);
    }
  };

  const handleAcervoPdfUpload = async (kind:'trabalho-completo'|'resumo-expandido',file?:File) => {
    if(!file)return;
    if(file.type!=='application/pdf'&&!file.name.toLowerCase().endsWith('.pdf')){portalNotice('Selecione um arquivo PDF.');return;}
    if(file.size>24*1024*1024){portalNotice('O PDF deve ter no máximo 24 MB.');return;}
    setAcervoUploading(kind);
    try{
      const uploaded=await apiClient.uploadProcessPdfFile(processId,kind,file);
      if(kind==='trabalho-completo')setAcervoTrabalhoCompleto(uploaded.fileName);else setAcervoResumoExpandido(uploaded.fileName);
      portalNotice('PDF armazenado com segurança na pasta deste TCC no Google Drive.');
      await loadData();
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
      ? 'shadow-2xs bg-slate-50/70'
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

  const primaryAccentColor = localFormat.primaryActionColor || '#005830';
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
    if (tabId === 'defesa' && activeTab === 'cadastral') return true;
    return activeTab === tabId;
  };

  return (
    <div
      id="process-detail-container"
      className={`portal-tcc-detail space-y-4 ${modalWidthClass} ${modalRadiusClass} ${modalShadowClass} mx-auto p-2 sm:p-3`}
      style={{ backgroundColor: localFormat.modalBgColor || '#f8fafc', color: '#0f172a' }}
    >
      {isModal ? (
        <header
          className={`${modalRadiusClass} flex flex-wrap items-center justify-between gap-3 border p-4`}
          style={{
            backgroundColor: localFormat.headerBgColor || '#005830',
            color: localFormat.headerTextColor || '#ffffff',
            borderColor: localFormat.headerBgColor || '#005830',
          }}
        >
          <div className="flex min-w-0 items-center gap-3">
            {localFormat.showHeaderEmblem !== false ? <NursingEmblemLogo size={38} className="shrink-0" customSrc={settings?.integrationStudio?.brandKit?.courseLogoUrl || settings?.integrationStudio?.brandKit?.universityLogoUrl || ''} /> : null}
            <div className="min-w-0">
              <h1 className="truncate text-sm font-black uppercase tracking-tight">{localFormat.headerTitleText || 'Painel de Gestão e Detalhes do TCC'}</h1>
              <p className="mt-0.5 truncate text-[11px] font-semibold opacity-90">{localFormat.headerSubtitleText || `${installationProfile.courseName} • ${installationProfile.institutionAcronym}`}</p>
            </div>
          </div>
          {localFormat.showHeaderProtocolPill !== false ? <span className="rounded-full border border-white/30 bg-black/15 px-3 py-1 text-[10px] font-black">{process.protocolo}</span> : null}
        </header>
      ) : null}
      {process.coauthorAcceptance?.status==='PENDING'&&<section className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-950"><div className="flex flex-wrap items-center justify-between gap-3"><div><strong className="text-sm">Aceite do segundo autor pendente</strong><p className="mt-1 text-xs">O fluxo documental permanece bloqueado até o e-mail convidado confirmar ou recusar o vínculo.</p></div>{normalizeEmail(process.coauthorAcceptance.invitedEmail||'')===normalizeEmail(userEmail)&&<div className="flex gap-2"><button type="button" onClick={()=>void handleCoauthorDecision('REJECT')} className="rounded-lg border border-amber-300 bg-white px-3 py-2 text-xs font-black">Recusar</button><button type="button" onClick={()=>void handleCoauthorDecision('ACCEPT')} className="rounded-lg bg-amber-800 px-3 py-2 text-xs font-black text-white">Aceitar autoria</button></div>}</div></section>}
      {process.coauthorAcceptance?.status==='REJECTED'&&<section className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-900">O segundo autor recusou o vínculo. Corrija ou remova os dados da dupla antes de continuar.</section>}
      
      {/* ========================================================================= */}
      {/* 1. TITLE & PROTOCOL SUMMARY CARD (TOP BAR WITH BADGE, GEAR, AND CLOSE)    */}
      {/* ========================================================================= */}
      <div className="bg-white rounded-xl p-4 sm:p-5 border border-slate-200/90 shadow-2xs space-y-3">
        <div className="space-y-1.5">
          {/* Top Line: Identification, Stage, Grade ON LEFT + Master User Badge, Gear, Close ON RIGHT */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            {/* Left Zone: Protocol, Stage, Grade */}
            <div className="flex items-center gap-2 flex-wrap text-xs">
              <span className="text-[11px] font-bold text-slate-700 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded">
                {process.protocolo}
              </span>
              <span
                className="text-[11px] font-bold px-2 py-0.5 rounded border shadow-2xs"
                style={{
                  backgroundColor: localFormat.badgeBgColor || '#e6f4ed',
                  color: localFormat.badgeTextColor || primaryAccentColor,
                  borderColor: localFormat.badgeBorderColor || '#a3d9be'
                }}
              >
                Etapa: {process.etapaAtual}
              </span>
              {process.avaliacao?.status === 'CONCLUIDO' && (
                <span className="text-[11px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-300 px-2 py-0.5 rounded">
                  Conceito: {process.avaliacao.resultadoLabel || 'Aprovado'}
                </span>
              )}
            </div>

            {/* Right Zone: Master Badge, Gear Settings, Close Button */}
            <div className="flex items-center gap-1.5 shrink-0">
              {/* User Role Badge */}
              {localFormat.showHeaderRoleBadge !== false && (
                <div>
                  {readOnly ? (
                    <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-2 py-1 rounded-md border border-slate-200 flex items-center gap-1">
                      <Eye className="w-3 h-3 text-slate-400" />
                      <span>Consulta</span>
                    </span>
                  ) : isStudent ? (
                    <span className="text-[10px] font-bold text-sky-800 bg-sky-50 px-2 py-1 rounded-md border border-sky-200 flex items-center gap-1">
                      <GraduationCap className="w-3 h-3 text-sky-600" />
                      <span>Discente</span>
                    </span>
                  ) : isAdvisor || isCoAdvisor ? (
                    <span className="text-[10px] font-bold text-purple-800 bg-purple-50 px-2 py-1 rounded-md border border-purple-200 flex items-center gap-1">
                      <Award className="w-3 h-3 text-purple-600" />
                      <span>Orientador</span>
                    </span>
                  ) : isCommissionPresident ? (
                    <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2 py-1 rounded-md border border-emerald-200">
                      Presidente da Comissão
                    </span>
                  ) : isMasterAdmin ? (
                    <span className="text-[10px] font-bold text-amber-800 bg-amber-50 px-2 py-1 rounded-md border border-amber-200 flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3 text-amber-600" />
                      <span>Admin Master</span>
                    </span>
                  ) : null}
                </div>
              )}

              {/* Gear Dropdown Options */}
              <div className="relative">
                <button
                  id="tcc-gear-settings-btn"
                  type="button"
                  onClick={() => setShowGearMenu(!showGearMenu)}
                  className="p-1.5 text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-50 rounded-lg border border-slate-200 shadow-2xs transition-colors cursor-pointer flex items-center justify-center"
                  title="Opções do Processo e Histórico"
                >
                  <Settings className="w-4 h-4" />
                </button>

                {showGearMenu && (
                  <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-lg border border-slate-200 z-50 p-1.5 space-y-1 animate-fadeIn text-slate-800">
                    <div className="px-3 py-1.5 border-b border-slate-100">
                      <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider block">
                        Opções do Processo
                      </span>
                      <span className="text-xs font-bold text-slate-700 font-mono">
                        {process.protocolo}
                      </span>
                    </div>

                    {/* Option: Histórico de Auditoria */}
                    <button
                      type="button"
                      onClick={() => {
                        setShowGearMenu(false);
                        setShowAuditLogModal(true);
                      }}
                      className="w-full text-left px-3 py-2 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-100 flex items-center gap-2 transition-colors cursor-pointer"
                    >
                      <History className="w-3.5 h-3.5 text-emerald-700" />
                      <span>Histórico de Auditoria ({auditLogs.length})</span>
                    </button>

                    {/* Option: Reabrir Avaliação */}
                    {isEvaluationSubmitted && isMasterAdmin && (
                      <button
                        type="button"
                        onClick={() => {
                          setShowGearMenu(false);
                          handleReopenEvaluation();
                        }}
                        className="w-full text-left px-3 py-2 rounded-lg text-xs font-semibold text-amber-900 hover:bg-amber-50 flex items-center gap-2 transition-colors cursor-pointer border-t border-slate-100"
                      >
                        <RotateCcw className="w-3.5 h-3.5 text-amber-600" />
                        <span>Reabrir Avaliação (Master)</span>
                      </button>
                    )}

                    {/* Option: Excluir Trabalho */}
                    {isMasterAdmin && (
                      <button
                        type="button"
                        onClick={() => {
                          setShowGearMenu(false);
                          setShowDeleteModal(true);
                        }}
                        className="w-full text-left px-3 py-2 rounded-lg text-xs font-semibold text-rose-700 hover:bg-rose-50 flex items-center gap-2 transition-colors cursor-pointer border-t border-slate-100"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                        <span>Excluir Trabalho (Master)</span>
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Close Button */}
              <button
                type="button"
                onClick={onBack}
                className="inline-flex items-center gap-1 text-xs font-bold text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200 shadow-2xs transition-colors cursor-pointer"
                title="Voltar / Fechar Detalhes"
              >
                <X className="w-3.5 h-3.5" />
                <span>Fechar</span>
              </button>
            </div>
          </div>

          <h1 className="text-sm sm:text-base font-bold text-slate-900 leading-snug">
            {process.titulo}
          </h1>
        </div>

        {/* Metadata in one clean row */}
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 pt-2 border-t border-slate-100 text-xs text-slate-600">
          <div className="flex items-center gap-1.5">
            <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="font-semibold text-slate-800">{process.aluno1.nome}</span>
            {process.aluno2 && <span className="text-slate-500">e {process.aluno2.nome}</span>}
          </div>

          <div className="flex items-center gap-1.5">
            <Award className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span>Orientador(a): <strong className="text-slate-800">{process.orientador.nome}</strong></span>
          </div>

          {process.defesa?.startAt && (
            <div className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span>{formatDatePt(process.defesa.startAt)} • {formatTimeExtenso(process.defesa.startAt)}</span>
            </div>
          )}

          {process.defesa?.local && (
            <div className="flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span>{process.defesa.local}</span>
            </div>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. STATE MACHINE / ETAPA PROGRESS BAR                                     */}
      {/* ========================================================================= */}
      {localFormat.showStateMachine !== false && (
        <EtapaProgressBar currentEtapa={process.etapaAtual} />
      )}

      {/* ========================================================================= */}
      {/* 3. NAVIGATION TABS ROW                                                    */}
      {/* ========================================================================= */}
      <div className="flex items-center gap-1 overflow-x-auto custom-scrollbar p-1.5 bg-slate-100/90 rounded-xl border border-slate-200 shadow-2xs">
        {[
          { id: 'cadastral', label: 'Ficha Cadastral & Defesa', icon: FileText, show: localFormat.showSectionCadastral !== false },
          { id: 'banca', label: 'Banca Examinadora', icon: Users, show: localFormat.showSectionBanca !== false },
          { id: 'avaliacao', label: 'Avaliação & Ata', icon: Award, show: localFormat.showSectionAvaliacao !== false },
          { id: 'forms', label: 'Formulários', icon: ClipboardList, show: true },
          { id: 'docs', label: 'Documentos', icon: FileCheck, show: localFormat.showSectionDocs !== false },
          { id: 'acervo', label: 'Repositório Digital', icon: BookOpen, show: localFormat.showSectionAcervo !== false },
        ]
          .filter((t) => t.show !== false)
          .map((tab) => {
            const isSelected = activeTab === tab.id;
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                  isSelected
                    ? 'bg-white text-slate-900 shadow-2xs border border-slate-200/90'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                }`}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" style={{ color: isSelected ? primaryAccentColor : '#94a3b8' }} />
                <span>{tab.label}</span>
              </button>
            );
          })}
      </div>

      <ProcessFlowPanel process={process} jobs={signatureJobs} canConfirm={Boolean((isStudent||isMasterAdmin)&&!readOnly)} onUpdated={loadData}/>

      {isTabVisible('forms') && (
        <DynamicStudioForms
          processId={process.id}
          locale={settings.integrationStudio?.operationsPolicy?.defaultLocale}
          accentColor={primaryAccentColor}
        />
      )}

      {/* ========================================================================= */}
      {/* SECTION 1: FICHA CADASTRAL E IDENTIFICAÇÃO DO PROCESSO                    */}
      {/* ========================================================================= */}
      {localFormat.showSectionCadastral !== false && isTabVisible('cadastral') && (
        <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden">
          <div className="bg-slate-50/80 border-b border-slate-200 px-4 py-3 flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-slate-700" />
              <h2 className="text-xs font-black uppercase tracking-wider text-slate-900">
                Ficha Cadastral do Trabalho & Agendamento da Defesa
              </h2>
            </div>

            <div className="flex items-center gap-2">
              {canEditData && (
                editingSection === 'cadastral' ? (
                  <button
                    type="button"
                    onClick={() => setEditingSection(null)}
                    className="inline-flex items-center gap-1 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg border border-slate-200 transition-colors cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>Cancelar</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setEditingSection('cadastral')}
                    className="inline-flex items-center gap-1 text-xs font-black text-emerald-800 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-lg border border-emerald-200 shadow-2xs transition-colors cursor-pointer"
                  >
                    <Edit className="w-3.5 h-3.5 text-emerald-700" />
                    <span>Editar Ficha & Defesa</span>
                  </button>
                )
              )}
              <span className="text-[11px] text-slate-500 font-semibold bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200">
                Registrado em {process.createdAt ? new Date(process.createdAt).toLocaleDateString('pt-BR') : '10/08/2026'}
              </span>
            </div>
          </div>

          <div className="p-4 sm:p-5">
            {editingSection === 'cadastral' && !readOnly ? (
              <form onSubmit={handleSaveCadastralEdit} className="space-y-4">
                <div className="space-y-3">
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                      Título Completo do Trabalho de TCC <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={cadastralForm.titulo}
                      onChange={(e) => setCadastralForm({ ...cadastralForm, titulo: e.target.value })}
                      className="w-full text-xs p-2.5 border border-slate-300 rounded-lg bg-white font-semibold text-slate-900 focus:ring-2 focus:ring-emerald-700 outline-none"
                    />
                  </div>

                  {/* Discente 1 */}
                  <div className="p-3.5 bg-slate-50/70 rounded-xl border border-slate-200 space-y-2">
                    <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-700">
                      Discente Autor Principal (Aluno 1)
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      <div>
                        <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Nome Completo</label>
                        <input
                          type="text"
                          required
                          value={cadastralForm.aluno1Nome}
                          onChange={(e) => setCadastralForm({ ...cadastralForm, aluno1Nome: e.target.value })}
                          className="w-full text-xs p-2 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-emerald-700 outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">E-mail Institucional</label>
                        <input
                          type="email"
                          required
                          value={cadastralForm.aluno1Email}
                          onChange={(e) => setCadastralForm({ ...cadastralForm, aluno1Email: e.target.value })}
                          className="w-full text-xs p-2 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-emerald-700 outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Matrícula institucional</label>
                        <input
                          type="text"
                          value={cadastralForm.aluno1Matricula}
                          onChange={(e) => setCadastralForm({ ...cadastralForm, aluno1Matricula: e.target.value })}
                          className="w-full text-xs p-2 border border-slate-300 rounded-lg bg-white font-mono focus:ring-2 focus:ring-emerald-700 outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Discente 2 (Coautoria) */}
                  <div className="p-3.5 bg-slate-50/70 rounded-xl border border-slate-200 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-700">
                        Discente 2 (Coautoria)
                      </span>
                      <label className="flex items-center gap-1.5 text-xs text-slate-600 font-medium cursor-pointer">
                        <input
                          type="checkbox"
                          checked={cadastralForm.hasAluno2}
                          onChange={(e) => setCadastralForm({ ...cadastralForm, hasAluno2: e.target.checked })}
                          className="w-3.5 h-3.5 text-emerald-800 rounded border-slate-300 cursor-pointer"
                        />
                        <span>Trabalho em dupla (coautoria)</span>
                      </label>
                    </div>

                    {cadastralForm.hasAluno2 && (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                        <div>
                          <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Nome Completo</label>
                          <input
                            type="text"
                            value={cadastralForm.aluno2Nome}
                            onChange={(e) => setCadastralForm({ ...cadastralForm, aluno2Nome: e.target.value })}
                            className="w-full text-xs p-2 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-emerald-700 outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">E-mail Institucional</label>
                          <input
                            type="email"
                            value={cadastralForm.aluno2Email}
                            onChange={(e) => setCadastralForm({ ...cadastralForm, aluno2Email: e.target.value })}
                            className="w-full text-xs p-2 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-emerald-700 outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Matrícula institucional</label>
                          <input
                            type="text"
                            value={cadastralForm.aluno2Matricula}
                            onChange={(e) => setCadastralForm({ ...cadastralForm, aluno2Matricula: e.target.value })}
                            className="w-full text-xs p-2 border border-slate-300 rounded-lg bg-white font-mono focus:ring-2 focus:ring-emerald-700 outline-none"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Docente Orientador */}
                  <div className="p-3.5 bg-slate-50/70 rounded-xl border border-slate-200 space-y-2">
                    <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-700">
                      Docente Orientador(a)
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      <div>
                        <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Nome do Professor</label>
                        <input
                          type="text"
                          required
                          value={cadastralForm.orientadorNome}
                          onChange={(e) => setCadastralForm({ ...cadastralForm, orientadorNome: e.target.value })}
                          className="w-full text-xs p-2 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-emerald-700 outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">E-mail</label>
                        <input
                          type="email"
                          required
                          value={cadastralForm.orientadorEmail}
                          onChange={(e) => setCadastralForm({ ...cadastralForm, orientadorEmail: e.target.value })}
                          className="w-full text-xs p-2 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-emerald-700 outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Instituição / Departamento</label>
                        <input
                          type="text"
                          value={cadastralForm.orientadorInstituicao}
                          onChange={(e) => setCadastralForm({ ...cadastralForm, orientadorInstituicao: e.target.value })}
                          className="w-full text-xs p-2 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-emerald-700 outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Coorientador */}
                  <div className="p-3.5 bg-slate-50/70 rounded-xl border border-slate-200 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-700">
                        Coorientador(a) (Opcional)
                      </span>
                      <label className="flex items-center gap-1.5 text-xs text-slate-600 font-medium cursor-pointer">
                        <input
                          type="checkbox"
                          checked={cadastralForm.hasCoorientador}
                          onChange={(e) => setCadastralForm({ ...cadastralForm, hasCoorientador: e.target.checked })}
                          className="w-3.5 h-3.5 text-emerald-800 rounded border-slate-300 cursor-pointer"
                        />
                        <span>Possui coorientador</span>
                      </label>
                    </div>

                    {cadastralForm.hasCoorientador && (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                        <div>
                          <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Nome do Coorientador</label>
                          <input
                            type="text"
                            value={cadastralForm.coorientadorNome}
                            onChange={(e) => setCadastralForm({ ...cadastralForm, coorientadorNome: e.target.value })}
                            className="w-full text-xs p-2 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-emerald-700 outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">E-mail</label>
                          <input
                            type="email"
                            value={cadastralForm.coorientadorEmail}
                            onChange={(e) => setCadastralForm({ ...cadastralForm, coorientadorEmail: e.target.value })}
                            className="w-full text-xs p-2 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-emerald-700 outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Instituição</label>
                          <input
                            type="text"
                            value={cadastralForm.coorientadorInstituicao}
                            onChange={(e) => setCadastralForm({ ...cadastralForm, coorientadorInstituicao: e.target.value })}
                            className="w-full text-xs p-2 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-emerald-700 outline-none"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Agendamento da Defesa */}
                  <div className="p-3.5 bg-slate-50/70 rounded-xl border border-slate-200 space-y-2">
                    <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-700">
                      Agendamento da Defesa Pública
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      <div>
                        <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Data e Hora da Apresentação</label>
                        <input
                          type="datetime-local"
                          value={defesaForm.startAt}
                          onChange={(e) => setDefesaForm({ ...defesaForm, startAt: e.target.value })}
                          className="w-full text-xs p-2 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-emerald-700 outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Local / Sala / Auditório</label>
                        <input
                          type="text"
                          placeholder="Ex.: sala de defesas ou link da videoconferência"
                          value={defesaForm.local}
                          onChange={(e) => setDefesaForm({ ...defesaForm, local: e.target.value })}
                          className="w-full text-xs p-2 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-emerald-700 outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Formato da Sessão</label>
                        <select
                          value={defesaForm.formato}
                          onChange={(e) => setDefesaForm({ ...defesaForm, formato: e.target.value })}
                          className="w-full text-xs p-2 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-emerald-700 outline-none cursor-pointer"
                        >
                          <option value="Presencial">Presencial</option>
                          <option value="Remoto / Online">Remoto / Online</option>
                          <option value="Híbrido">Híbrido</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={() => setEditingSection(null)}
                    className="text-xs font-bold px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg cursor-pointer transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="text-xs font-extrabold uppercase tracking-wider text-white px-5 py-2 rounded-lg bg-emerald-800 hover:bg-emerald-900 shadow-2xs cursor-pointer transition-all flex items-center gap-1.5"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>Salvar Ficha & Defesa</span>
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-4">
                
                {/* Top Metadata & Defesa Info Grid */}
                <div className="bg-slate-50/90 border border-slate-200/90 rounded-xl p-3.5 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 shadow-2xs">
                  <div>
                    <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">
                      Protocolo
                    </span>
                    <span className="font-mono font-bold text-slate-900 text-xs bg-white border border-slate-200 px-2 py-0.5 rounded-md inline-block">
                      {process.protocolo}
                    </span>
                  </div>

                  <div>
                    <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">
                      Etapa Regimental
                    </span>
                    <span className="text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md inline-block">
                      {process.etapaAtual}
                    </span>
                  </div>

                  <div>
                    <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">
                      Data da Defesa
                    </span>
                    <span className="font-semibold text-slate-900 text-xs block">
                      {formatDatePt(process.defesa?.startAt)}
                    </span>
                  </div>

                  <div>
                    <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">
                      Horário
                    </span>
                    <span className="font-semibold text-slate-900 text-xs block">
                      {formatTimeExtenso(process.defesa?.startAt)} (90 min)
                    </span>
                  </div>

                  <div className="col-span-2 sm:col-span-1">
                    <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">
                      Local / Auditório
                    </span>
                    <span className="font-semibold text-slate-900 text-xs truncate block" title={process.defesa?.local}>
                      {process.defesa?.local || installationProfile.defaultDefenseLocation}
                    </span>
                  </div>
                </div>

                {/* People Grid (Discentes e Orientadores filling 100% of row width) */}
                {(() => {
                  const hasAluno2 = Boolean(process.aluno2);
                  const hasCoorientador = Boolean(process.coorientador && process.coorientador.nome && process.coorientador.nome.trim() !== '');
                  
                  // Total cards: 2 (1 student + 1 orientador), 3 (2 students + 1 orientador OR 1 student + 1 orientador + 1 coorientador), 4 (all)
                  const totalPeople = (hasAluno2 ? 2 : 1) + 1 + (hasCoorientador ? 1 : 0);

                  let gridColsClass = 'grid-cols-1 sm:grid-cols-2';
                  if (totalPeople === 3) {
                    gridColsClass = 'grid-cols-1 sm:grid-cols-3';
                  } else if (totalPeople === 4) {
                    gridColsClass = 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4';
                  }

                  return (
                    <div className={`grid ${gridColsClass} gap-3`}>
                      {/* Aluno 1 */}
                      <div className="bg-slate-50/90 border border-slate-200/90 rounded-xl p-3.5 space-y-2 shadow-2xs">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0 shadow-2xs">
                            <GraduationCap className="w-4 h-4 text-emerald-800" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider block">
                              Discente Autor {hasAluno2 ? '1' : ''}
                            </span>
                            <span className="text-xs sm:text-sm font-extrabold text-slate-900 truncate block">
                              {process.aluno1.nome}
                            </span>
                          </div>
                        </div>
                        
                        <div className="flex flex-col gap-1 text-[11px] pt-2 border-t border-slate-200/70 text-slate-600 font-medium">
                          {localFormat.showStudentEmail !== false && process.aluno1.email && (
                            <div className="flex items-center gap-1.5 text-slate-700">
                              <span className="text-slate-400 text-xs">✉</span>
                              <span className="font-semibold text-slate-800 truncate">{process.aluno1.email}</span>
                            </div>
                          )}
                          {localFormat.showStudentMatricula !== false && process.aluno1.matricula && (
                            <div className="flex items-center gap-1.5 text-slate-700 font-mono">
                              <span className="text-slate-400 text-xs font-sans">🆔 Matrícula:</span>
                              <strong className="text-slate-900">{process.aluno1.matricula}</strong>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Aluno 2 (Se tiver) */}
                      {hasAluno2 && process.aluno2 && (
                        <div className="bg-slate-50/90 border border-slate-200/90 rounded-xl p-3.5 space-y-2 shadow-2xs">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0 shadow-2xs">
                              <GraduationCap className="w-4 h-4 text-emerald-800" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider block">
                                Discente Autor 2
                              </span>
                              <span className="text-xs sm:text-sm font-extrabold text-slate-900 truncate block">
                                {process.aluno2.nome}
                              </span>
                            </div>
                          </div>

                          <div className="flex flex-col gap-1 text-[11px] pt-2 border-t border-slate-200/70 text-slate-600 font-medium">
                            {localFormat.showStudentEmail !== false && process.aluno2.email && (
                              <div className="flex items-center gap-1.5 text-slate-700">
                                <span className="text-slate-400 text-xs">✉</span>
                                <span className="font-semibold text-slate-800 truncate">{process.aluno2.email}</span>
                              </div>
                            )}
                            {localFormat.showStudentMatricula !== false && process.aluno2.matricula && (
                              <div className="flex items-center gap-1.5 text-slate-700 font-mono">
                                <span className="text-slate-400 text-xs font-sans">🆔 Matrícula:</span>
                                <strong className="text-slate-900">{process.aluno2.matricula}</strong>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Orientador */}
                      <div className="bg-slate-50/90 border border-slate-200/90 rounded-xl p-3.5 space-y-2 shadow-2xs">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-purple-100 text-purple-800 flex items-center justify-center shrink-0 shadow-2xs">
                            <Award className="w-4 h-4 text-purple-800" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider block">
                              Docente Orientador(a)
                            </span>
                            <span className="text-xs sm:text-sm font-extrabold text-slate-900 truncate block">
                              {process.orientador.nome}
                            </span>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-1.5 text-[11px] pt-2 border-t border-slate-200/70 text-slate-600 font-medium">
                          {localFormat.showAdvisorEmail !== false && process.orientador.email && (
                            <span className="bg-white border border-slate-200 px-2 py-0.5 rounded text-slate-700 truncate">
                              ✉ {process.orientador.email}
                            </span>
                          )}
                          {localFormat.showAdvisorInstitution !== false && (
                            <span className="bg-white border border-slate-200 px-2 py-0.5 rounded text-slate-700">
                              🏛️ {process.orientador.instituicao || installationProfile.defaultInstitutionName}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Coorientador (Se tiver) */}
                      {hasCoorientador && process.coorientador && (
                        <div className="bg-slate-50/90 border border-slate-200/90 rounded-xl p-3.5 space-y-2 shadow-2xs">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-800 flex items-center justify-center shrink-0 shadow-2xs">
                              <Users className="w-4 h-4 text-indigo-800" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider block">
                                Coorientador(a)
                              </span>
                              <span className="text-xs sm:text-sm font-extrabold text-slate-900 truncate block">
                                {process.coorientador.nome}
                              </span>
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-1.5 text-[11px] pt-2 border-t border-slate-200/70 text-slate-600 font-medium">
                            {localFormat.showAdvisorEmail !== false && process.coorientador.email && (
                              <span className="bg-white border border-slate-200 px-2 py-0.5 rounded text-slate-700 truncate">
                                ✉ {process.coorientador.email}
                              </span>
                            )}
                            {localFormat.showAdvisorInstitution !== false && (
                              <span className="bg-white border border-slate-200 px-2 py-0.5 rounded text-slate-700">
                                🏛️ {process.coorientador.instituicao || installationProfile.defaultInstitutionName}
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}

              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SECTION 3: COMPOSIÇÃO DA BANCA EXAMINADORA                                */}
      {/* ========================================================================= */}
      {localFormat.showSectionBanca !== false && isTabVisible('banca') && (
        <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden">
          <div className="bg-slate-50/80 border-b border-slate-200 px-4 py-2.5 flex items-center justify-between flex-wrap gap-2">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2">
              <Users className="w-3.5 h-3.5 text-slate-600" />
              <span>Banca Examinadora</span>
            </h2>

            <div className="flex items-center gap-2">
              {canEditData && (
                editingSection === 'banca' ? (
                  <button
                    type="button"
                    onClick={() => setEditingSection(null)}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 px-2.5 py-1 rounded-lg border border-slate-200 transition-colors cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>Cancelar</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setEditingSection('banca')}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1 rounded-lg border border-emerald-200 shadow-2xs transition-colors cursor-pointer"
                  >
                    <Edit className="w-3.5 h-3.5 text-emerald-700" />
                    <span>Editar Banca</span>
                  </button>
                )
              )}
              <span className="text-[11px] text-slate-500">
                {process.banca.length} docente(s) membros
              </span>
            </div>
          </div>

          <div className="p-4 sm:p-5">
            {editingSection === 'banca' && !readOnly ? (
              <form onSubmit={handleSaveBancaEdit} className="space-y-4">
                <div className="space-y-3">
                  {bancaForm.map((membro, idx) => (
                    <div key={membro.id || idx} className="p-3.5 bg-slate-50/80 rounded-xl border border-slate-200 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-emerald-700" />
                          <span>Membro #{idx + 1} {membro.funcao === 'ORIENTADOR' ? '(Presidente)' : ''}</span>
                        </span>
                        {bancaForm.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveExaminer(idx)}
                            className="text-xs font-semibold text-rose-600 hover:text-rose-800 flex items-center gap-1 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Remover</span>
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
                        <div>
                          <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Nome do Membro</label>
                          <input
                            type="text"
                            required
                            value={membro.nome || ''}
                            onChange={(e) => handleUpdateExaminer(idx, 'nome', e.target.value)}
                            className="w-full text-xs p-2 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-emerald-700 outline-none"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">E-mail</label>
                          <input
                            type="email"
                            required
                            value={membro.email || ''}
                            onChange={(e) => handleUpdateExaminer(idx, 'email', e.target.value)}
                            className="w-full text-xs p-2 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-emerald-700 outline-none"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Instituição</label>
                          <input
                            type="text"
                            value={membro.instituicao || ''}
                            onChange={(e) => handleUpdateExaminer(idx, 'instituicao', e.target.value)}
                            placeholder="Ex.: nome da instituição"
                            className="w-full text-xs p-2 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-emerald-700 outline-none"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Titulação / Função</label>
                          <input
                            type="text"
                            value={membro.titulacao || ''}
                            onChange={(e) => handleUpdateExaminer(idx, 'titulacao', e.target.value)}
                            placeholder="Ex: Prof. Dr. / Profª. Me."
                            className="w-full text-xs p-2 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-emerald-700 outline-none"
                          />
                        </div>
                      </div>
                    </div>
                  ))}

                  <button
                    type="button"
                    onClick={handleAddExaminer}
                    className="w-full py-2.5 border-2 border-dashed border-slate-300 hover:border-emerald-600 rounded-xl text-xs font-bold text-slate-600 hover:text-emerald-800 transition-colors flex items-center justify-center gap-1.5 cursor-pointer bg-slate-50/50"
                  >
                    <Plus className="w-4 h-4 text-emerald-700" />
                    <span>Adicionar Novo Membro à Banca</span>
                  </button>
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={() => setEditingSection(null)}
                    className="text-xs font-bold px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg cursor-pointer transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="text-xs font-extrabold uppercase tracking-wider text-white px-5 py-2 rounded-lg bg-emerald-800 hover:bg-emerald-900 shadow-2xs cursor-pointer transition-all flex items-center gap-1.5"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>Salvar Banca</span>
                  </button>
                </div>
              </form>
            ) : (
              <TableScrollWrapper>
                <table className="w-full text-xs text-left border-collapse border border-slate-200 rounded-lg overflow-hidden bg-white">
                  <thead>
                    <tr className="bg-slate-50 text-slate-700 border-b border-slate-200 font-bold uppercase text-[10.5px]">
                      <th className="p-3">Função na Banca</th>
                      <th className="p-3">Examinador</th>
                      <th className="p-3">E-mail</th>
                      <th className="p-3">Instituição</th>
                      <th className="p-3 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {process.banca.map((membro, idx) => (
                      <tr key={membro.id || idx} className="hover:bg-slate-50/60 transition-colors">
                        <td className="p-3 font-semibold text-slate-800">
                          {membro.funcao === 'ORIENTADOR' ? 'Presidente (Orientador)' : `Examinador ${idx + 1}`}
                        </td>
                        <td className="p-3 font-semibold text-slate-900">
                          {membro.nome}
                          {membro.titulacao && (
                            <span className="text-[10px] text-slate-500 block font-normal">{membro.titulacao}</span>
                          )}
                        </td>
                        <td className="p-3 font-mono text-slate-600 text-[11px]">
                          {membro.email}
                        </td>
                        <td className="p-3 text-slate-700">
                          {membro.instituicao || (membro.membroTipo === 'EXTERNO' ? 'Instituição externa' : installationProfile.defaultInstitutionName)}
                        </td>
                        <td className="p-3 text-center">
                          <span className="inline-block bg-emerald-50 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded border border-emerald-200">
                            Confirmado
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableScrollWrapper>
            )}
          </div>
        </div>
      )}

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
        <div id="documents-panel-section" className="bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden space-y-0">
          <div className="bg-slate-50/80 border-b border-slate-200 px-4 py-2.5 flex items-center justify-between flex-wrap gap-2">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2">
              <FileCheck className="w-3.5 h-3.5 text-emerald-700" />
              <span>Documentos Oficiais do Processo</span>
            </h2>
            <div className="flex items-center gap-2">
              {(isMasterAdmin || isCommissionPresident) && (
                <button type="button" onClick={handleDownloadDossier} disabled={isDownloadingDossier} className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-700 hover:bg-slate-100 disabled:cursor-wait disabled:opacity-60">
                  <HardDrive className="h-3.5 w-3.5" />
                  {isDownloadingDossier ? 'Gerando dossiê…' : 'Baixar dossiê integral'}
                </button>
              )}
              <span className="px-2.5 py-1 bg-white text-slate-700 border border-slate-300 rounded-md text-[11px] font-bold shadow-2xs">
                Envio direto pela Asten
              </span>
              <span className="text-[11px] text-slate-500 font-medium">
                {documents.length} documento(s)
              </span>
            </div>
          </div>

          <div className="p-3 sm:p-4 space-y-3">
            {/* REGRAS DE ASSINATURA DERIVADAS DO TIPO DO DOCUMENTO */}
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs text-slate-700 space-y-1.5">
              <div className="font-bold text-slate-900 flex items-center gap-1.5 text-[11px] uppercase tracking-wide">
                <Info className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                <span>Regras de geração e assinatura de cada documento:</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2 text-[10.5px]">
                <div className="p-2 bg-white rounded border border-slate-200">
                  <span className="font-bold text-slate-900 block">1. Carta Convite</span>
                  <span className="text-slate-500">Não requer assinatura.</span>
                </div>
                <div className="p-2 bg-white rounded border border-slate-200">
                  <span className="font-bold text-slate-900 block">2. Ata Oficial da Defesa</span>
                  <span className="text-slate-500">Assinatura do professor orientador.</span>
                </div>
                <div className="p-2 bg-white rounded border border-slate-200">
                  <span className="font-bold text-slate-900 block">3. Termo de Autorização</span>
                  <span className="text-slate-500">Assinatura do Orientador e Discente.</span>
                </div>
                <div className="p-2 bg-white rounded border border-slate-200">
                  <span className="font-bold text-slate-900 block">4. Declaração de Banca</span>
                  <span className="text-slate-500">Assinatura do Presidente da Comissão.</span>
                </div>
              </div>
            </div>

            {signatureNotice&&<div role="status" className={`rounded-lg border p-3 text-xs font-bold ${signatureNotice.ok?'border-emerald-200 bg-emerald-50 text-emerald-900':'border-red-200 bg-red-50 text-red-900'}`}>{signatureNotice.text}</div>}

            {verifications.length > 0 && (
              <div className="rounded-xl border border-sky-200 bg-sky-50 p-3">
                <div className="mb-2 flex items-center gap-2 text-[11px] font-black uppercase tracking-wide text-sky-950"><ShieldCheck className="h-4 w-4" />Autenticidade dos documentos assinados</div>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {verifications.map((verification) => (
                    <a key={`${verification.documentType}-${verification.version}`} href={verification.url} target="_blank" rel="noreferrer" className="flex items-center justify-between rounded-lg border border-sky-200 bg-white px-3 py-2 text-xs font-bold text-sky-900 hover:border-sky-400">
                      <span>{verification.documentType} • versão {verification.version}</span><ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {documents.map((doc) => {
                const isDownloadable = doc.status === 'DISPONIVEL' || doc.status === 'ASSINADO';
                const latestJob=signatureJobs.filter(job=>job.documentType===doc.type&&job.status!=='CANCELED').sort((a,b)=>b.documentVersion-a.documentVersion)[0];
                const alreadySent=Boolean(latestJob&&['SENDING','SENT','PARTIALLY_SIGNED','SIGNED','DRIVE_SYNC_PENDING','ARCHIVED'].includes(latestJob.status));
                const canRequestSignature=doc.requiresSignature&&doc.status!=='NAO_DISPONIVEL'&&(isMasterAdmin||(doc.type==='ATA'&&isAdvisor)||(doc.type==='TERMO'&&(isStudent||isAdvisor)));

                const getDocInfo = (type: string) => {
                  switch (type) {
                    case 'CONVITE':
                      return { title: '1. Carta-Convite da Banca', signNote: 'Sem necessidade de assinatura' };
                    case 'ATA':
                      return { title: '2. Ata Oficial da Defesa Final', signNote: 'Assinatura: Professor Orientador' };
                    case 'TERMO':
                      return { title: '3. Termo de Autorização e Publicação', signNote: 'Assinatura: Orientador + Discente' };
                    case 'DECLARACAO':
                      return { title: '4. Declaração de Participação na Banca', signNote: 'Assinatura: Presidente da Comissão' };
                    default:
                      return { title: doc.title, signNote: 'Assinatura gerenciada pelo portal' };
                  }
                };

                const docInfo = getDocInfo(doc.type);

                return (
                  <div
                    key={doc.id}
                    className="bg-white border border-slate-200/90 rounded-xl p-3.5 shadow-2xs hover:shadow-xs transition-all flex flex-col justify-between gap-3"
                  >
                    {/* Header: Document Title, Version and Status Badge */}
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200/80 flex items-center justify-center shrink-0">
                            <FileCheck className="w-4 h-4 text-emerald-700" />
                          </div>
                          <div className="min-w-0">
                            <h3 className="font-extrabold text-xs sm:text-[13px] text-slate-900 leading-snug truncate" title={docInfo.title}>
                              {docInfo.title}
                            </h3>
                            <span className="text-[10px] font-mono font-bold text-slate-400">
                              Versão {doc.currentVersion}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="p-1.5 bg-slate-50 border border-slate-200 rounded text-[10px] text-slate-600 font-medium">
                        📌 {docInfo.signNote}
                      </div>

                      {/* Status Badge */}
                      <div className="flex items-center justify-between pt-1">
                        <span
                          className={`font-black uppercase text-[10px] px-2.5 py-0.5 rounded-md border tracking-wide ${
                            doc.status === 'ASSINADO' || doc.status === 'DISPONIVEL'
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                              : 'bg-amber-50 text-amber-800 border-amber-200'
                          }`}
                        >
                          {doc.status}
                        </span>

                        {doc.type === 'DECLARACAO' && (
                          <span className="text-[10px] font-bold text-emerald-900 bg-emerald-50 border border-emerald-200/90 px-2 py-0.5 rounded-md">
                            Assinatura Presidente
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Action Buttons: Ver & Baixar PDF */}
                    <div className="flex items-center gap-2 pt-2.5 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => setSelectedPreviewDoc(doc)}
                        className="flex-1 inline-flex items-center justify-center gap-1.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg border border-slate-200 transition-colors cursor-pointer"
                        title="Visualizar documento em tela"
                      >
                        <Eye className="w-3.5 h-3.5 text-slate-500" />
                        <span>Ver</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDirectDownload(doc)}
                        disabled={!isDownloadable}
                        className={`flex-1 inline-flex items-center justify-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg transition-all shadow-2xs ${
                          isDownloadable
                            ? 'text-white bg-[#005830] hover:bg-[#004827] cursor-pointer'
                            : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                        }`}
                        title="Baixar PDF do documento"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Baixar PDF</span>
                      </button>
                    </div>
                    {canRequestSignature&&<button type="button" onClick={()=>handleSignDocument(doc)} disabled={signatureWorking===doc.type||alreadySent} className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-800 px-3 py-2 text-xs font-black text-white transition-colors hover:bg-emerald-900 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-600"><ShieldCheck className="h-4 w-4"/>{alreadySent?'Enviado à Asten':signatureWorking===doc.type?'Enviando…':'Assinar documento'}</button>}
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
        <div id="acervo-digital-section" className="bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden">
          <div className="bg-slate-50/80 border-b border-slate-200 px-4 py-2.5 flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2">
              <BookOpen className="w-3.5 h-3.5 text-slate-600" />
              <span>Repositório Digital</span>
            </h2>
            <span className="text-[11px] text-slate-500 font-medium">
              Acervo {installationProfile.courseName} — {installationProfile.institutionAcronym}
            </span>
          </div>

          <div className="p-4 sm:p-5">
            {readOnly ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Card 1: Palavras-Chave */}
                <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                      <Tag className="w-3.5 h-3.5 text-emerald-700" />
                      <span>Palavras-Chave</span>
                    </span>
                    <span className="text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded-full">
                      PREENCHIDO
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {(process.acervo?.palavrasChave || []).map((kw, i) => (
                      <span key={i} className="text-xs font-bold bg-slate-100 text-slate-800 border border-slate-200 px-2.5 py-1 rounded-lg">
                        #{kw}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Card 2: Arquivos do Repositório */}
                <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-emerald-700" />
                      <span>Documentos Anexados</span>
                    </span>
                    <span className="text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded-full">
                      {[process.acervo?.resumoExpandidoFileId,process.acervo?.trabalhoCompletoFileId].filter(Boolean).length} ARQUIVO(S)
                    </span>
                  </div>

                  <div className="space-y-2 pt-0.5">
                    <div className="flex items-center justify-between gap-2 p-2.5 bg-slate-50/80 rounded-lg border border-slate-200">
                      <div className="min-w-0">
                        <span className="text-[9.5px] font-bold text-slate-400 uppercase block">Resumo Expandido</span>
                        <span className="font-bold text-slate-800 text-xs truncate block">{process.acervo?.resumoExpandidoFileName || 'Não anexado'}</span>
                      </div>
                      <button
                        type="button"
                        disabled={!process.acervo?.resumoExpandidoFileId}
                        onClick={() => window.open(`/api/processes/${process.id}/files/resumo-expandido/download`,'_blank','noopener,noreferrer')}
                        className="text-white font-bold text-xs px-3 py-1.5 rounded-lg bg-[#005830] hover:bg-[#004827] flex items-center gap-1 cursor-pointer shrink-0 shadow-2xs transition-colors"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Baixar</span>
                      </button>
                    </div>

                    <div className="flex items-center justify-between gap-2 p-2.5 bg-slate-50/80 rounded-lg border border-slate-200">
                      <div className="min-w-0">
                        <span className="text-[9.5px] font-bold text-slate-400 uppercase block">Monografia Completa</span>
                        <span className="font-bold text-slate-800 text-xs truncate block">{process.acervo?.trabalhoCompletoFileName || 'Não anexado'}</span>
                      </div>
                      <button
                        type="button"
                        disabled={!process.acervo?.trabalhoCompletoFileId}
                        onClick={() => window.open(`/api/processes/${process.id}/files/trabalho-completo/download`,'_blank','noopener,noreferrer')}
                        className="text-white font-bold text-xs px-3 py-1.5 rounded-lg bg-[#005830] hover:bg-[#004827] flex items-center gap-1 cursor-pointer shrink-0 shadow-2xs transition-colors"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Baixar</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Card 3: Resumo Síntese */}
                <div className="md:col-span-2 bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                      <BookOpen className="w-3.5 h-3.5 text-emerald-700" />
                      <span>Resumo Síntese do TCC</span>
                    </span>
                    <span className="text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200 px-2 py-0.5 rounded-md">
                      PÚBLICO NO REPOSITÓRIO
                    </span>
                  </div>
                  <p className="text-xs text-slate-700 leading-relaxed font-normal bg-slate-50/60 p-3 rounded-lg border border-slate-200/70 whitespace-pre-wrap">
                    {process.acervo?.resumoSintese || 'Resumo sintético ainda não informado.'}
                  </p>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmitAcervo} className="space-y-4">
                {!ataIsArchived&&<p role="status" className="portal-card p-4">A entrega final será liberada após a Ata assinada pelo orientador retornar da Asten e ser arquivada no Drive.</p>}
                <fieldset disabled={!ataIsArchived} className="space-y-4 disabled:opacity-60">
                {/* Row 1: Palavras-chave and Resumo Síntese */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Card 1: Palavras-Chave */}
                  <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-extrabold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                        <Tag className="w-3.5 h-3.5 text-emerald-700" />
                        <span>Palavras-Chave</span>
                        <span className="text-rose-500">*</span>
                      </label>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${acervoKeywords.trim() ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-amber-50 text-amber-800 border-amber-200'}`}>
                        {acervoKeywords.trim() ? 'PREENCHIDO' : 'PENDENTE'}
                      </span>
                    </div>

                    <input
                      type="text"
                      required
                      placeholder="Informe exatamente cinco palavras-chave, separadas por vírgula"
                      value={acervoKeywords}
                      onChange={(e) => setAcervoKeywords(e.target.value)}
                      className="w-full text-xs font-medium p-2.5 border border-slate-300 rounded-lg bg-slate-50/50 focus:bg-white focus:ring-2 focus:ring-emerald-700 outline-none transition-all"
                    />

                    {/* Preview of Tags */}
                    {acervoKeywords.trim() && (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {acervoKeywords.split(',').map(s => s.trim()).filter(Boolean).map((kw, i) => (
                          <span key={i} className="text-[11px] font-bold bg-emerald-50 text-emerald-900 border border-emerald-200 px-2 py-0.5 rounded-md">
                            #{kw}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Card 2: Resumo Síntese */}
                  <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-extrabold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5 text-emerald-700" />
                        <span>Resumo Síntese do TCC</span>
                        <span className="text-rose-500">*</span>
                      </label>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${acervoResumo.trim() ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-amber-50 text-amber-800 border-amber-200'}`}>
                        {acervoResumo.trim() ? `${acervoResumo.trim().length} CARACTERES` : 'PENDENTE'}
                      </span>
                    </div>

                    <textarea
                      rows={3}
                      required
                      placeholder="Escreva de três a cinco parágrafos sobre objetivos, metodologia, achados e conclusões, separados por uma linha em branco."
                      value={acervoResumo}
                      onChange={(e) => setAcervoResumo(e.target.value)}
                      className="w-full text-xs font-medium p-3 border border-slate-300 rounded-lg bg-slate-50/50 focus:bg-white focus:ring-2 focus:ring-emerald-700 outline-none transition-all font-sans"
                    />
                  </div>
                </div>

                {/* Row 2: Arquivos do Repositório (Resumo Expandido & Monografia Completa) */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Card 3: Resumo Expandido */}
                  <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-extrabold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                        <Upload className="w-3.5 h-3.5 text-emerald-700" />
                        <span>Arquivo do Resumo Expandido</span>
                      </label>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${acervoResumoExpandido.trim() ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                        {acervoResumoExpandido.trim() ? 'ANEXADO' : 'OPCIONAL'}
                      </span>
                    </div>

                    <input
                      type="file"
                      accept="application/pdf,.pdf"
                      disabled={Boolean(acervoUploading)}
                      onChange={(e) => handleAcervoPdfUpload('resumo-expandido',e.target.files?.[0])}
                      className="w-full text-xs font-medium p-2.5 border border-slate-300 rounded-lg bg-slate-50/50 file:mr-3 file:border-0 file:rounded-md file:bg-emerald-800 file:text-white file:px-3 file:py-1.5 file:font-bold"
                    />
                    {acervoResumoExpandido && <p className="text-[11px] text-emerald-800 font-semibold break-all">Armazenado: {acervoResumoExpandido}</p>}
                  </div>

                  {/* Card 4: Monografia Completa */}
                  <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-extrabold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                        <BookOpen className="w-3.5 h-3.5 text-emerald-700" />
                        <span>Arquivo do Trabalho Completo / Monografia (PDF)</span>
                        <span className="text-rose-500">*</span>
                      </label>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${acervoTrabalhoCompleto.trim() ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-rose-50 text-rose-800 border-rose-200'}`}>
                        {acervoTrabalhoCompleto.trim() ? 'ANEXADO' : 'OBRIGATÓRIO'}
                      </span>
                    </div>

                    <input
                      type="file"
                      accept="application/pdf,.pdf"
                      required={!acervoTrabalhoCompleto}
                      disabled={Boolean(acervoUploading)}
                      onChange={(e) => handleAcervoPdfUpload('trabalho-completo',e.target.files?.[0])}
                      className="w-full text-xs font-medium p-2.5 border border-slate-300 rounded-lg bg-slate-50/50 file:mr-3 file:border-0 file:rounded-md file:bg-emerald-800 file:text-white file:px-3 file:py-1.5 file:font-bold"
                    />
                    {acervoTrabalhoCompleto && <p className="text-[11px] text-emerald-800 font-semibold break-all">Armazenado: {acervoTrabalhoCompleto}</p>}
                  </div>
                </div>

                {/* Card 5: Visibilidade & Ação de Salvar */}
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                  <div className="grid gap-3 md:grid-cols-2">
                  <label htmlFor="acervo-public-toggle" className="flex items-center gap-2.5 cursor-pointer select-none rounded-lg border border-slate-200 bg-white p-3">
                    <input
                      id="acervo-public-toggle"
                      type="checkbox"
                      checked={acervoIsPublic}
                      onChange={(e) => {setAcervoIsPublic(e.target.checked);setAcervoAuthorizationConfirmed(false);}}
                      className="w-4 h-4 text-emerald-800 rounded border-slate-300 focus:ring-emerald-700 cursor-pointer"
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

                  <label htmlFor="acervo-expanded-public-toggle" className={`flex items-center gap-2.5 select-none rounded-lg border border-slate-200 bg-white p-3 ${acervoResumoExpandido?'cursor-pointer':'cursor-not-allowed opacity-60'}`}>
                    <input
                      id="acervo-expanded-public-toggle"
                      type="checkbox"
                      checked={acervoExpandedPublic}
                      disabled={!acervoResumoExpandido}
                      onChange={(e) => {setAcervoExpandedPublic(e.target.checked);setAcervoAuthorizationConfirmed(false);}}
                      className="w-4 h-4 text-emerald-800 rounded border-slate-300 focus:ring-emerald-700 cursor-pointer"
                    />
                    <div>
                      <span className="text-xs font-bold text-slate-900 block">Publicar também o resumo expandido</span>
                      <span className="text-[10.5px] text-slate-500 block">Escolha independente do trabalho completo; exige arquivo anexado.</span>
                    </div>
                  </label>
                  </div>

                  {(acervoIsPublic||acervoExpandedPublic)&&<label className="flex items-start gap-2.5 rounded-lg border border-amber-300 bg-amber-50 p-3 text-amber-950">
                    <input type="checkbox" required checked={acervoAuthorizationConfirmed} onChange={(event)=>setAcervoAuthorizationConfirmed(event.target.checked)} className="mt-0.5 h-4 w-4 rounded border-amber-400 text-emerald-800"/>
                    <span className="text-xs leading-5"><strong>Autorizo a publicação:</strong> {acervoIsPublic?'trabalho completo':''}{acervoIsPublic&&acervoExpandedPublic?' e ':''}{acervoExpandedPublic?'resumo expandido':''}. Esta escolha gerará o Termo de Autorização para assinatura simultânea do(s) aluno(s) e orientador pela Asten.</span>
                  </label>}

                  <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={isSubmittingAcervo}
                    className="w-full sm:w-auto flex items-center justify-center gap-2 text-white font-bold text-xs uppercase tracking-wider px-6 py-2.5 rounded-xl bg-[#005830] hover:bg-[#004827] transition-all cursor-pointer shadow-md shrink-0"
                  >
                    <Save className="w-4 h-4" />
                    <span>{isSubmittingAcervo ? 'Salvando...' : 'Salvar no Acervo'}</span>
                  </button>
                  </div>
                </div>
              </fieldset></form>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* POPUPS & MODALS: AUDIT LOG, PREVIEWS, DELETE                               */}
      {/* ========================================================================= */}

      {/* Audit Log Modal (Full dialog view via gear) */}
      {showAuditLogModal && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-300 shadow-2xl max-w-3xl w-full p-6 space-y-4 animate-fadeIn max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-emerald-700" />
                <div>
                  <h2 className="text-base font-black uppercase text-slate-900">
                    Histórico & Log de Alterações do Processo
                  </h2>
                  <p className="text-xs text-slate-500 font-mono">
                    Protocolo: {process.protocolo}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowAuditLogModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <TableScrollWrapper>
              <table className="w-full text-xs text-left border-collapse border border-slate-200 rounded-xl overflow-hidden bg-white">
                <thead>
                  <tr className="bg-slate-100 text-slate-900 border-b-2 border-slate-300 font-extrabold uppercase tracking-wider text-[11px]">
                    <th className="p-3">Data e Hora</th>
                    <th className="p-3">Usuário / Papel</th>
                    <th className="p-3">Ação Realizada</th>
                    <th className="p-3">Detalhamento</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {auditLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                      <td className="p-3 font-mono font-bold text-slate-700 whitespace-nowrap">
                        {log.timestamp}
                      </td>
                      <td className="p-3">
                        <div className="font-bold text-slate-900">{log.user}</div>
                        <span className="text-[10px] text-emerald-800 font-mono">{log.role}</span>
                      </td>
                      <td className="p-3">
                        <span className="text-[10px] font-extrabold px-2 py-0.5 rounded bg-slate-100 text-slate-800 uppercase border border-slate-300">
                          {log.action}
                        </span>
                      </td>
                      <td className="p-3 text-slate-700 leading-snug">
                        {log.details}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableScrollWrapper>

            <div className="flex justify-end pt-2 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setShowAuditLogModal(false)}
                className="px-5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl cursor-pointer"
              >
                Fechar Histórico
              </button>
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
      {showDeleteModal && process && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl border border-rose-300 shadow-2xl max-w-lg w-full p-6 space-y-4 animate-fadeIn">
            <div className="flex items-center gap-3 text-rose-700 border-b border-rose-200 pb-3">
              <div className="p-2 bg-rose-100 rounded-full">
                <AlertTriangle className="w-6 h-6 text-rose-600" />
              </div>
              <div>
                <h2 className="text-base font-black uppercase tracking-tight text-rose-900">
                  ⚠️ ATENÇÃO: EXCLUSÃO DE TRABALHO
                </h2>
                <p className="text-xs text-rose-700 font-bold">
                  Exclusão Definitiva de Processo de TCC
                </p>
              </div>
            </div>

            <div className="bg-rose-50 border border-rose-200 p-4 rounded-xl space-y-2 text-xs text-rose-950">
              <p className="font-bold leading-relaxed">
                Você está prestes a EXCLUIR DEFINITIVAMENTE o TCC:
              </p>
              <div className="bg-white p-2.5 rounded-lg border border-rose-300 font-mono text-[11px] font-bold text-slate-900">
                <div>Protocolo: {process.protocolo}</div>
                <div className="truncate">Título: {process.titulo}</div>
                <div>Aluno(s): {formatStudentsString(process.aluno1, process.aluno2)}</div>
              </div>
              <p className="leading-relaxed text-[11px] pt-1 font-semibold text-rose-900">
                Esta ação é irreversível e removerá todos os registros do discente, banca e repositório.
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1">
                Para autorizar, digite <span className="font-mono font-black text-rose-700">EXCLUIR</span> abaixo:
              </label>
              <input
                type="text"
                placeholder="Digite EXCLUIR para autorizar"
                value={deleteConfirmInput}
                onChange={(e) => setDeleteConfirmInput(e.target.value)}
                className="w-full text-xs font-mono font-bold p-2.5 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-rose-500 uppercase"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-200">
              <button
                type="button"
                onClick={() => {
                  setShowDeleteModal(false);
                  setDeleteConfirmInput('');
                }}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDeleteProcess}
                disabled={isDeleting || deleteConfirmInput.trim().toUpperCase() !== 'EXCLUIR'}
                className={`px-5 py-2 font-extrabold text-xs uppercase tracking-wider rounded-xl text-white transition-all ${
                  deleteConfirmInput.trim().toUpperCase() === 'EXCLUIR' && !isDeleting
                    ? 'bg-rose-600 hover:bg-rose-700 cursor-pointer shadow-md'
                    : 'bg-slate-300 cursor-not-allowed'
                }`}
              >
                {isDeleting ? 'Excluindo...' : 'Confirmar Exclusão Definitiva'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
