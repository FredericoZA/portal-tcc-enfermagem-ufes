import React, { useEffect, useMemo, useState } from 'react';
import { TableScrollWrapper } from './TableScrollWrapper';
import { HeaderSettingsPopover } from './HeaderSettingsPopover';
import { SearchPopover } from './SearchPopover';
import { YinYangIcon } from './YinYangIcon';
import { ColumnDef, DEFAULT_TABLE_TEXT_FORMAT, loadTableConfig, TableTextFormat } from './TableColumnSelectorPanel';
import { formatColumnLabel, getColWidthClass, getEditableTableText, getTableStyles, GLOBAL_TABLE_EVENT } from '../utils/tableFormatters';
import { ColorfulHeaderIcon } from './ColorfulHeaderIcon';
import { TutorialInfographicView } from './TutorialInfographicView';
import {
  Calendar as CalendarIcon,
  BookOpen,
  FileText,
  Award,
  Settings,
  Shield,
  Search,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Download,
  FileCheck,
  User,
  Clock,
  ShieldCheck,
  ExternalLink,
  Layers,
  GraduationCap,
  Users,
  Building2,
  FileSignature,
  Compass,
  ArrowUpRight,
  LayoutGrid,
  Table
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { resolveInstallationProfile } from '../utils/installationProfile';

interface OnlineSystemTutorialProps {
  onNavigate?: (tab: string) => void;
}

// Columns definition for the unified tutorial table
const TUTORIAL_PROFILE_COLUMNS: ColumnDef[] = [
  { key: 'etapa', label: 'Etapa / Nº', isFixed: true },
  { key: 'perfil', label: 'Perfil / Ator' },
  { key: 'acao', label: 'Ação no Portal' },
  { key: 'descricao', label: 'Instruções & Procedimento' },
  { key: 'prazo', label: 'Prazos & Requisitos' },
  { key: 'entregavel', label: 'Entregável / Documento' }
];

const TUTORIAL_MODULES_COLUMNS: ColumnDef[] = [
  { key: 'modulo', label: 'Módulo / Aba', isFixed: true },
  { key: 'publico', label: 'Público-Alvo' },
  { key: 'objetivo', label: 'Objetivo Principal' },
  { key: 'recursos', label: 'Recursos & Funcionalidades' },
  { key: 'acoes', label: 'Ações Disponíveis' }
];

const TUTORIAL_FLOW_COLUMNS: ColumnDef[] = [
  { key: 'fase', label: 'Fase Regimental', isFixed: true },
  { key: 'responsavel', label: 'Responsável' },
  { key: 'prazo', label: 'Prazo Regimental' },
  { key: 'procedimento', label: 'Procedimento no Sistema' },
  { key: 'entregavel', label: 'Documento / Entregável' }
];

const TUTORIAL_FAQ_COLUMNS: ColumnDef[] = [
  { key: 'categoria', label: 'Categoria / Papel', isFixed: true },
  { key: 'pergunta', label: 'Pergunta Frequente' },
  { key: 'resposta', label: 'Resposta Oficial & Regras' },
  { key: 'recomendacao', label: 'Ação Recomendada' }
];

// Profile-based tabulated content
const PROFILE_ROWS = [
  {
    id: '1',
    role: 'discente',
    etapa: '1. Cadastro único',
    perfil: 'Aluno (Discente)',
    acao: 'Criar seu único TCC de graduação',
    descricao: 'Acessar o assistente, informar título, autoria, orientador, coorientador, banca, data e horário. Todos os participantes passam a ter acesso ao processo pelo próprio e-mail.',
    prazo: 'Dentro do período acadêmico configurado e usando um e-mail previamente autorizado.',
    entregavel: 'Protocolo gerado e local pendente de confirmação'
  },
  {
    id: '2',
    role: 'discente',
    etapa: '2. Confirmação do local',
    perfil: 'Aluno (Discente)',
    acao: 'Comprovar e confirmar o local',
    descricao: 'Obter a autorização da unidade responsável pelo espaço e registrar o local definitivo no portal. Só então o convite é gerado e enviado à banca.',
    prazo: 'Antes do envio da carta-convite.',
    entregavel: 'Convite em PDF, e-mail aos participantes e evento no calendário'
  },
  {
    id: '3',
    role: 'discente',
    etapa: '3. Apresentação Pública',
    perfil: 'Aluno (Discente)',
    acao: 'Apresentação Oral da Defesa',
    descricao: 'Realizar a apresentação no local ou sala virtual confirmados, perante a comissão examinadora.',
    prazo: 'Dia, horário e local confirmados no portal.',
    entregavel: 'Arguição e parecer registrado pelo orientador'
  },
  {
    id: '4',
    role: 'discente',
    etapa: '4. Submissão ao Repositório',
    perfil: 'Aluno (Discente)',
    acao: 'Catalogação no Acervo Digital',
    descricao: 'Entregar o trabalho final, exatamente 5 palavras-chave e resumo sintético. A publicação do trabalho e do resumo expandido é uma escolha expressa do aluno.',
    prazo: 'Conforme o período acadêmico publicado pelo curso.',
    entregavel: 'Arquivo privado no Drive ou publicação autorizada no Repositório'
  },
  {
    id: '5',
    role: 'coordenador',
    etapa: '1. Administração integral',
    perfil: 'Presidente da Comissão',
    acao: 'Acompanhar e editar todos os processos',
    descricao: 'O Presidente possui o mesmo nível máximo de acesso do Master para usuários, configurações, processos, documentos, auditoria e integrações.',
    prazo: 'Acompanhamento contínuo.',
    entregavel: 'Processos íntegros e pendências acompanhadas'
  },
  {
    id: '6',
    role: 'coordenador',
    etapa: '2. Gestão de Declarações',
    perfil: 'Presidente da Comissão',
    acao: 'Assinar declarações',
    descricao: 'Clicar em “Assinar documento” para enviar a declaração diretamente à Asten e acompanhar seu arquivamento automático no Drive.',
    prazo: 'Fluxo contínuo pós-defesa.',
    entregavel: 'Declarações emitidas e assinadas'
  },
  {
    id: '7',
    role: 'visitante',
    etapa: '1. Consulta Livre',
    perfil: 'Visitante / Comunidade',
    acao: 'Ver Calendário de Defesas',
    descricao: 'Navegar pelo calendário mensal público para visualizar datas, salas, horários e títulos de TCC.',
    prazo: 'Acesso livre a qualquer momento sem login.',
    entregavel: 'Acompanhamento de sessões públicas'
  },
  {
    id: '8',
    role: 'visitante',
    etapa: '2. Download de Trabalhos',
    perfil: 'Visitante / Comunidade',
    acao: 'Buscar no Repositório de TCCs',
    descricao: 'Pesquisar monografias por autor, orientador, ano ou palavras-chave e fazer download gratuito dos PDFs aprovados.',
    prazo: 'Disponibilidade contínua 24/7.',
    entregavel: 'Download direto em PDF'
  },
  {
    id: '9',
    role: 'master',
    etapa: '1. Implantação e identidade',
    perfil: 'Usuário Master',
    acao: 'Configurar a instalação do curso',
    descricao: 'Definir instituição, curso, domínios de e-mail, períodos, paleta, tabelas, pop-ups, modelos externos e lista inicial de alunos.',
    prazo: 'No primeiro acesso e sempre que houver alteração institucional.',
    entregavel: 'Portal configurado sem alteração de código'
  },
  {
    id: '10',
    role: 'master',
    etapa: '2. Integrações e fluxo',
    perfil: 'Usuário Master',
    acao: 'Homologar Google, Asten, Supabase e Vercel',
    descricao: 'Publicar formulários, e-mails, variáveis e etapas executáveis; testar integrações e consultar os registros de auditoria.',
    prazo: 'Antes de liberar a instalação para uso real.',
    entregavel: 'Checklist de homologação aprovado'
  }
];

// Modules tabulated content
const MODULES_ROWS = [
  {
    modulo: 'Calendário de Defesas',
    publico: 'Público Geral, Alunos, Docentes',
    objetivo: 'Visualização mensal e em grade das bancas de TCC agendadas pelo curso.',
    recursos: 'Grade mensal, popover de mês/ano, busca rápida, paginação, paleta de cores configurável.',
    acoes: 'Consultar horários, auditórios, bancas e títulos de trabalhos.'
  },
  {
    modulo: 'Defesas Agendadas (Lista)',
    publico: 'Público Geral e Comunidade Acadêmica',
    objetivo: 'Listagem tabular completa de bancas com filtros e ordenação dinâmica.',
    recursos: 'Ordenação por colunas, busca integrada, indicador de progresso, botões de ação e visualização de ata.',
    acoes: 'Filtrar defesas, verificar orientadores e status regimental.'
  },
  {
    modulo: 'Repositório de TCCs (Acervo)',
    publico: 'Público Geral, Pesquisadores',
    objetivo: 'Biblioteca digital permanente de monografias e artigos de TCC concluídos.',
    recursos: 'Filtro por ano, autor e tema, visualização expandida com resumo e download direto de PDFs.',
    acoes: 'Baixar monografias, resumos expandidos e certificados.'
  },
  {
    modulo: 'Meus TCCs (Painel do Usuário)',
    publico: 'Alunos, Orientadores e Membros de Banca',
    objetivo: 'Painel personalizado com todos os processos de TCC vinculados ao e-mail logado.',
    recursos: 'Filtros por papel, assistente de cadastro, aceite de coautoria, avaliação, arquivos finais e acompanhamento documental.',
    acoes: 'Cadastrar um TCC como autor, atuar em outros processos e solicitar a assinatura dos documentos permitidos.'
  },
  {
    modulo: 'Área do Presidente',
    publico: 'Presidente da Comissão e Master',
    objetivo: 'Gestão integral dos processos e assinatura das declarações de participação.',
    recursos: 'Pendências, documentos, relatórios, acompanhamento Asten, auditoria e acesso administrativo completo.',
    acoes: 'Editar processos, solicitar assinatura de declarações e emitir relatórios.'
  },
  {
    modulo: 'Configurações do Sistema',
    publico: 'Usuário Master e Presidente da Comissão',
    objetivo: 'Fonte única para identidade, aparência, permissões, integrações e fluxo executável.',
    recursos: 'Modelos DOCX externos, formulários, e-mails, variáveis, paletas, componentes vinculados e configurações individuais.',
    acoes: 'Publicar layouts, modelos, regras, etapas, lista de acesso e integrações.'
  }
];

// Flow tabulated content
const FLOW_ROWS = [
  {
    fase: '1. Cadastro do TCC',
    responsavel: 'Aluno previamente autorizado',
    prazo: 'Período acadêmico configurado',
    procedimento: 'Informar autoria, título, orientador, coorientador, banca, data e horário. O local permanece pendente.',
    entregavel: 'Protocolo e acesso automático dos participantes'
  },
  {
    fase: '2. Local e convite',
    responsavel: 'Aluno e sistema',
    prazo: 'Antes da defesa',
    procedimento: 'Confirmar o espaço autorizado. O sistema gera a carta-convite, envia pelo Gmail e atualiza o calendário.',
    entregavel: 'Convite e agendamento confirmados'
  },
  {
    fase: '3. Defesa e avaliação',
    responsavel: 'Orientador',
    prazo: 'No dia da defesa',
    procedimento: 'Conferir os dados, registrar o resultado e escrever o parágrafo do parecer que será inserido na ata.',
    entregavel: 'Avaliação concluída e ata gerada'
  },
  {
    fase: '4. Dados finais',
    responsavel: 'Aluno',
    prazo: 'Depois da avaliação',
    procedimento: 'Enviar trabalho final, resumo sintético e 5 palavras-chave; escolher separadamente a publicação do trabalho e do resumo expandido.',
    entregavel: 'Entrega final arquivada e decisão de publicação registrada'
  },
  {
    fase: '5. Assinaturas Asten',
    responsavel: 'Aluno, orientador e Presidente',
    prazo: 'Após a geração de cada documento',
    procedimento: 'Ata: orientador. Termo: aluno(s) e orientador simultaneamente, somente quando houver publicação. Declaração: Presidente.',
    entregavel: 'PDFs assinados e arquivados automaticamente no Drive'
  },
  {
    fase: '6. Conclusão e repositório',
    responsavel: 'Sistema e administradores',
    prazo: 'Depois das assinaturas obrigatórias',
    procedimento: 'Concluir o processo, manter os arquivos privados por padrão e publicar somente o que foi expressamente autorizado.',
    entregavel: 'Processo concluído, rastreável e verificável'
  }
];

// FAQ tabulated content
const FAQ_ROWS = [
  {
    id: 'f1',
    role: 'discente',
    categoria: 'Aluno (Discente)',
    pergunta: 'Quais as regras para iniciar o agendamento de TCC?',
    resposta: 'O e-mail do aluno precisa estar na lista de autorização e pertencer a um domínio institucional configurado. Cada aluno pode criar apenas um TCC de graduação, sem perder a possibilidade de atuar em outros processos.',
    recomendacao: 'Conferir banca, data, horário e disponibilidade antes de concluir o primeiro formulário.'
  },
  {
    id: 'f2',
    role: 'discente',
    categoria: 'Aluno (Discente)',
    pergunta: 'Como faço o envio dos arquivos finais para o Repositório?',
    resposta: 'Acesse o processo na aba "Meus TCCs", localize a seção "Submissão para o Repositório" e anexe a monografia corrigida, resumo expandido e 5 palavras-chave.',
    recomendacao: 'Verificar se o PDF está legível e conforme as normas definidas pelo curso.'
  },
  {
    id: 'f3',
    role: 'discente',
    categoria: 'Aluno (Discente)',
    pergunta: 'Preciso entregar algum documento impresso na secretaria?',
    resposta: 'Não! Todo o fluxo é 100% digital e sem papel, desde o agendamento até a publicação pública no Repositório Digital de TCCs.',
    recomendacao: 'Guardar apenas o comprovante e protocolo digital gerado pelo portal.'
  },
  {
    id: 'f4',
    role: 'coordenador',
    categoria: 'Presidente da Comissão',
    pergunta: 'Como o Presidente acompanha processos e assina declarações?',
    resposta: 'Acesse a Área do Presidente. O perfil possui administração máxima e pode solicitar diretamente na Asten a assinatura das declarações prontas.',
    recomendacao: 'Conferir destinatários e versão antes de clicar em “Assinar documento”.'
  },
  {
    id: 'f5',
    role: 'coordenador',
    categoria: 'Presidente da Comissão',
    pergunta: 'Como emitir e assinar os Certificados de Banca?',
    resposta: 'As declarações são geradas com carga horária e título, enviadas ao Presidente pela Asten e arquivadas automaticamente após a assinatura.',
    recomendacao: 'Conferir destinatário, versão e hash antes de solicitar a assinatura.'
  },
  {
    id: 'f6',
    role: 'visitante',
    categoria: 'Visitante / Comunidade',
    pergunta: 'Como consultar o Calendário de Defesas e assistir às bancas?',
    resposta: 'Na aba inicial "Calendário de Defesas", qualquer visitante pode consultar datas, horários e locais sem login.',
    recomendacao: 'Chegar com 10 minutos de antecedência ao local indicado para assistir à sessão.'
  },
  {
    id: 'f7',
    role: 'visitante',
    categoria: 'Visitante / Comunidade',
    pergunta: 'Como pesquisar e fazer download de TCCs no Repositório?',
    resposta: 'Acesse a aba "Repositório de TCCs", busque por título, aluno ou orientador e clique em "Baixar Trabalho Completo (PDF)" ou "Resumo Expandido".',
    recomendacao: 'Utilizar palavras-chave na barra de busca para encontrar monografias por tema.'
  },
  {
    id: 'f8',
    role: 'master',
    categoria: 'Usuário Master',
    pergunta: 'Onde o curso configura o portal e o fluxo?',
    resposta: 'Na aba Configurações. Ali são publicados identidade, aparência, usuários, modelos DOCX externos, formulários, e-mails, variáveis, etapas e integrações.',
    recomendacao: 'Executar a homologação assistida antes de liberar usuários reais.'
  },
  {
    id: 'f9',
    role: 'assinaturas',
    categoria: 'Assinaturas eletrônicas',
    pergunta: 'Como funciona a assinatura digital nos documentos?',
    resposta: 'A Carta-Convite é gerada sem assinatura. Ao clicar em “Assinar documento”, Ata, Termo ou Declaração são gerados a partir do modelo ativo e enviados diretamente à Asten com os signatários definidos pelo fluxo.',
    recomendacao: 'Acompanhe versão, hash, signatários, andamento na Asten e arquivamento automático no Drive.'
  }
];

export const OnlineSystemTutorial: React.FC<OnlineSystemTutorialProps> = ({ onNavigate }) => {
  const { settings } = useAuth();
  const installationProfile = resolveInstallationProfile(settings);
  const replicationGuide = settings?.integrationStudio?.replicationGuide;
  const [activeTab, setActiveTab] = useState<'perfis' | 'modulos' | 'fluxo' | 'faq'>('perfis');
  const [selectedProfileFilter, setSelectedProfileFilter] = useState<string>('todos');
  const [tutorialSearch, setTutorialSearch] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [displayMode, setDisplayMode] = useState<'table' | 'infographic'>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('tutorial_display_mode') as 'table' | 'infographic') || 'table';
    }
    return 'table';
  });

  const handleDisplayModeChange = (mode: 'table' | 'infographic') => {
    setDisplayMode(mode);
    if (typeof window !== 'undefined') {
      localStorage.setItem('tutorial_display_mode', mode);
    }
  };

  // Table Configuration and Formatting
  const initialTutorialConfig = loadTableConfig('tutorial_main', TUTORIAL_PROFILE_COLUMNS.map(c => c.key), Object.fromEntries(TUTORIAL_PROFILE_COLUMNS.map(c => [c.key, true])), 25);
  const [tutorialOrder, setTutorialOrder] = useState<string[]>(initialTutorialConfig.columnOrder);
  const [tutorialVisible, setTutorialVisible] = useState<Record<string, boolean>>(initialTutorialConfig.visibleColumns);
  const [tutorialLabels, setTutorialLabels] = useState<Record<string, string>>(initialTutorialConfig.customLabels || {});
  const [tutorialWidths, setTutorialWidths] = useState<Record<string, string | number>>(initialTutorialConfig.columnWidths || {});
  const [tutorialLimit, setTutorialLimit] = useState<number | 'all'>(initialTutorialConfig.recordsLimit || 25);
  const [tutorialTextFormat, setTutorialTextFormat] = useState<TableTextFormat>(initialTutorialConfig.textFormat || DEFAULT_TABLE_TEXT_FORMAT);
  const [tutorialStartDate, setTutorialStartDate] = useState(initialTutorialConfig.startDate || '');
  const [tutorialEndDate, setTutorialEndDate] = useState(initialTutorialConfig.endDate || '');
  const styles = getTableStyles(tutorialTextFormat);
  const effectiveFlowRows = useMemo(() => {
    const published = settings?.integrationStudio?.workflowStages || [];
    if (!published.length) return FLOW_ROWS;
    return published.map((raw, index) => {
      const stage = raw as Record<string, any>;
      const actions = Array.isArray(stage.actions) ? stage.actions : [];
      return {
        fase: `${index + 1}. ${String(stage.title || `Etapa ${index + 1}`)}`,
        responsavel: 'Conforme perfis e permissões publicados',
        prazo: 'Conforme as regras do curso',
        procedimento: [String(stage.description || ''), ...actions.map((action: any) => String(action.title || '')).filter(Boolean)].filter(Boolean).join(' • '),
        entregavel: actions.map((action: any) => String(action.recipientOrDetail || '')).filter(Boolean).join(' • ') || `Evento ${String(stage.triggerEvent || '')}`
      };
    });
  }, [settings?.integrationStudio?.workflowStages]);

  useEffect(() => {
    const updateFormat = (event: Event) => setTutorialTextFormat((event as CustomEvent<TableTextFormat>).detail || DEFAULT_TABLE_TEXT_FORMAT);
    window.addEventListener(GLOBAL_TABLE_EVENT, updateFormat);
    return () => window.removeEventListener(GLOBAL_TABLE_EVENT, updateFormat);
  }, []);

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setIsRefreshing(false);
    }, 450);
  };

  // Filtered rows for Tab 1 (Perfis)
  const filteredProfileRows = PROFILE_ROWS.filter(r => {
    const matchProfile = selectedProfileFilter === 'todos' || r.role === selectedProfileFilter;
    if (!matchProfile) return false;
    if (!tutorialSearch.trim()) return true;
    const q = tutorialSearch.toLowerCase();
    return r.etapa.toLowerCase().includes(q) || r.perfil.toLowerCase().includes(q) || r.acao.toLowerCase().includes(q) || r.descricao.toLowerCase().includes(q);
  }).slice(0, tutorialLimit === 'all' ? undefined : tutorialLimit);

  // Filtered rows for Tab 2 (Módulos)
  const filteredModulesRows = MODULES_ROWS.filter(m => {
    if (!tutorialSearch.trim()) return true;
    const q = tutorialSearch.toLowerCase();
    return m.modulo.toLowerCase().includes(q) || m.publico.toLowerCase().includes(q) || m.objetivo.toLowerCase().includes(q) || m.recursos.toLowerCase().includes(q);
  }).slice(0, tutorialLimit === 'all' ? undefined : tutorialLimit);

  // Filtered rows for Tab 3 (Fluxo)
  const filteredFlowRows = effectiveFlowRows.filter(f => {
    if (!tutorialSearch.trim()) return true;
    const q = tutorialSearch.toLowerCase();
    return f.fase.toLowerCase().includes(q) || f.responsavel.toLowerCase().includes(q) || f.procedimento.toLowerCase().includes(q) || f.entregavel.toLowerCase().includes(q);
  }).slice(0, tutorialLimit === 'all' ? undefined : tutorialLimit);

  // Filtered rows for Tab 4 (FAQ)
  const filteredFaqRows = FAQ_ROWS.filter(faq => {
    const matchCat = selectedProfileFilter === 'todos' || faq.role === selectedProfileFilter;
    if (!matchCat) return false;
    if (!tutorialSearch.trim()) return true;
    const q = tutorialSearch.toLowerCase();
    return faq.categoria.toLowerCase().includes(q) || faq.pergunta.toLowerCase().includes(q) || faq.resposta.toLowerCase().includes(q) || faq.recomendacao.toLowerCase().includes(q);
  }).slice(0, tutorialLimit === 'all' ? undefined : tutorialLimit);

  return (
    <div id="online-system-tutorial-root" className="space-y-6 max-w-7xl mx-auto py-1">
      {replicationGuide?.enabled && /^https:\/\/github\.com\//i.test(replicationGuide.githubRepositoryUrl || '') && (
        <section className="overflow-hidden rounded-2xl border border-slate-300 bg-white shadow-sm" aria-labelledby="replication-guide-public-title">
          <div className="border-b border-slate-200 bg-slate-50 p-4 sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div><div className="flex items-center gap-2"><BookOpen className="h-5 w-5 text-slate-700"/><h2 id="replication-guide-public-title" className="text-base font-black text-slate-900">{replicationGuide.title || 'Reutilizar este projeto em outra secretaria'}</h2></div><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{replicationGuide.description}</p><p className="mt-2 text-xs font-bold text-emerald-800">Cada instalação atende um único curso. Este portal está configurado para o curso de Enfermagem.</p></div>
              <div className="flex flex-wrap gap-2"><a href={replicationGuide.githubRepositoryUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-xs font-black text-white"><ExternalLink className="h-4 w-4"/>Abrir GitHub</a>{replicationGuide.installationGuideUrl && /^https:\/\//i.test(replicationGuide.installationGuideUrl) && <a href={replicationGuide.installationGuideUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-black text-slate-800">Guia de instalação<ArrowUpRight className="h-4 w-4"/></a>}</div>
            </div>
          </div>
          <ol className="grid gap-3 p-4 sm:grid-cols-2 sm:p-5 lg:grid-cols-3">{replicationGuide.steps.map((step, index) => <li key={`${index}-${step}`} className="flex gap-3 rounded-xl border border-slate-200 bg-white p-3 text-xs leading-5 text-slate-700"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-700 font-black text-white">{index + 1}</span><span>{step}</span></li>)}</ol>
        </section>
      )}
      {/* UNIFIED CARD WITH HEADER, TOOLBAR & TABULATED DATA */}
      <div className={`bg-white border border-slate-300 rounded-2xl shadow-sm overflow-hidden ${styles.fontFamilyClass}`} style={styles.rootStyle}>
        
        {/* Banner Header (Full Palette Synchronization) */}
        <div className={`${styles.bannerHeaderClass} p-3.5 sm:p-4 border-b space-y-3.5 transition-colors`} style={styles.bannerHeaderStyle}>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <ColorfulHeaderIcon type="repository" />
              <div>
                <h1 className="text-base sm:text-lg font-black uppercase tracking-tight leading-snug">
                  {getEditableTableText(tutorialLabels, '__tableTitle', 'MANUAL E TUTORIAL DO PORTAL DE TCC')}
                </h1>
                <p className="text-[11px] opacity-90 font-medium">
                  Instruções regimentais completas tabuladas por perfil, módulos, fluxogramas e dúvidas frequentes.
                </p>
              </div>
            </div>

            {/* Toolbar: Search, Refresh, Gear (Settings) and Pencil (Master Admin Format) */}
            <div className="flex items-center gap-1.5 shrink-0">
              <SearchPopover
                value={tutorialSearch}
                onChange={setTutorialSearch}
                placeholder="Buscar no tutorial..."
                textFormat={tutorialTextFormat}
              />

              {/* Botão Yin-Yang (Refresh) */}
              <button
                type="button"
                onClick={handleRefresh}
                disabled={isRefreshing}
                className={`${styles.toolbarButtonClass} disabled:opacity-70`}
                style={styles.toolbarButtonStyle}
                title="Atualizar dados do tutorial"
              >
                <YinYangIcon className={`w-3.5 h-3.5 text-current ${isRefreshing ? 'animate-spin' : ''}`} />
              </button>

              {/* Popover de Configuração (Engrenagem + Lápis) */}
              <HeaderSettingsPopover
                recordsLimit={tutorialLimit}
                setRecordsLimit={setTutorialLimit}
                allowedLimits={[25, 50, 100, 'all']}
                allColumns={TUTORIAL_PROFILE_COLUMNS}
                visibleColumns={tutorialVisible}
                setVisibleColumns={setTutorialVisible}
                columnOrder={tutorialOrder}
                setColumnOrder={setTutorialOrder}
                storageKey="tutorial_main"
                customLabels={tutorialLabels}
                setCustomLabels={setTutorialLabels}
                defaultColumnOrder={TUTORIAL_PROFILE_COLUMNS.map(c => c.key)}
                defaultVisibleColumns={Object.fromEntries(TUTORIAL_PROFILE_COLUMNS.map(c => [c.key, true]))}
                defaultRecordsLimit={25}
                columnWidths={tutorialWidths}
                setColumnWidths={setTutorialWidths}
                textFormat={tutorialTextFormat}
                setTextFormat={setTutorialTextFormat}
                startDate={tutorialStartDate}
                setStartDate={setTutorialStartDate}
                endDate={tutorialEndDate}
                setEndDate={setTutorialEndDate}
                defaultTableTitle="Manual e Tutorial do Portal de TCC"
                defaultFilterTitle="Filtrar tutorial"
              />
            </div>
          </div>

          {/* Sub-Header / Main Tabs Filter Row */}
          <div className="pt-2.5 border-t flex flex-wrap items-center justify-between gap-3 text-xs" style={styles.filterDividerStyle}>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-[10px] font-black uppercase tracking-wider shrink-0 opacity-80">
                {getEditableTableText(tutorialLabels, '__filterTitle', 'FILTRAR:')}
              </span>
              <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                {[
                  { id: 'perfis', label: '1. Guias por Perfil', icon: Users },
                  { id: 'modulos', label: '2. Módulos do Portal', icon: Layers },
                  { id: 'fluxo', label: '3. Fluxo & Prazos', icon: GraduationCap },
                  { id: 'faq', label: '4. Dúvidas (FAQ)', icon: HelpCircle }
                ].map(tab => {
                  const Icon = tab.icon;
                  const isSelected = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => {
                        setActiveTab(tab.id as any);
                        setSelectedProfileFilter('todos');
                      }}
                      className={`inline-flex items-center gap-1.5 px-3 py-1 text-[11px] font-black uppercase rounded-full transition-all cursor-pointer border select-none ${
                        isSelected
                          ? styles.filterActiveChipClass
                          : styles.filterInactiveChipClass
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5 shrink-0" />
                      <span>{tab.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Display Mode Switcher (Tabela vs Infográfico / Mapa Mental) */}
            <div className="flex items-center gap-1 bg-black/15 p-0.5 rounded-full border border-white/20">
              <button
                type="button"
                onClick={() => handleDisplayModeChange('table')}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase transition-all cursor-pointer select-none ${
                  displayMode === 'table'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-inherit opacity-75 hover:opacity-100'
                }`}
                title="Visualização em Tabela Padronizada"
              >
                <Table className="w-3.5 h-3.5 shrink-0" />
                <span>Tabela</span>
              </button>

              <button
                type="button"
                onClick={() => handleDisplayModeChange('infographic')}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase transition-all cursor-pointer select-none ${
                  displayMode === 'infographic'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-inherit opacity-75 hover:opacity-100'
                }`}
                title="Visualização Visual (Infográfico & Mapa Mental)"
              >
                <LayoutGrid className="w-3.5 h-3.5 shrink-0" />
                <span>Infográfico / Mapa</span>
              </button>
            </div>
          </div>

          {/* Secondary Sub-Filter Row for Profiles or FAQ (Integrated directly into the header) */}
          {(activeTab === 'perfis' || activeTab === 'faq') && (
            <div className="pt-2 border-t flex flex-wrap items-center justify-between gap-2 text-xs" style={styles.filterDividerStyle}>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[10px] font-black uppercase tracking-wider opacity-85 mr-1">
                  {activeTab === 'perfis' ? 'Filtrar Ator:' : 'Categoria:'}
                </span>
                {(activeTab === 'perfis'
                  ? [
                      { id: 'todos', label: 'Todos os Perfis' },
                      { id: 'discente', label: `1. Aluno (${installationProfile.studentEmailDomains[0] ? `@${installationProfile.studentEmailDomains[0]}` : 'e-mail institucional'})` },
                      { id: 'coordenador', label: '2. Presidente' },
                      { id: 'visitante', label: '3. Visitante / Comunidade' },
                      { id: 'master', label: '4. Usuário Master' }
                    ]
                  : [
                      { id: 'todos', label: 'Todas as Dúvidas' },
                      { id: 'discente', label: '1. Aluno' },
                      { id: 'coordenador', label: '2. Presidente' },
                      { id: 'visitante', label: '3. Visitante' },
                      { id: 'master', label: '4. Usuário Master' },
                      { id: 'assinaturas', label: '5. Assinaturas Asten' }
                    ]
                ).map(f => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setSelectedProfileFilter(f.id)}
                    className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase transition-all cursor-pointer border select-none ${
                      selectedProfileFilter === f.id
                        ? styles.filterActiveChipClass
                        : styles.filterInactiveChipClass
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
              <span className="text-[10px] font-bold opacity-80">
                {activeTab === 'perfis'
                  ? `Exibindo ${filteredProfileRows.length} etapa(s)`
                  : `Exibindo ${filteredFaqRows.length} dúvida(s)`}
              </span>
            </div>
          )}
        </div>

        {displayMode === 'infographic' ? (
          <TutorialInfographicView
            activeSection={activeTab}
            onNavigate={onNavigate}
            filteredProfileRows={filteredProfileRows}
            filteredModulesRows={filteredModulesRows}
            filteredFlowRows={filteredFlowRows}
            filteredFaqRows={filteredFaqRows}
            selectedProfileFilter={selectedProfileFilter}
          />
        ) : (
          <>
        {activeTab === 'perfis' && (
          <div className="w-full">
            <TableScrollWrapper>
              <table className={`w-full ${styles.cellAlignClass} border-collapse text-xs`}>
                <thead className={`${styles.headerTheadClass} ${styles.headerTextColorClass} ${styles.headerFontSizeClass} ${styles.headerWeightClass} ${styles.headerCasingClass} tracking-normal`} style={styles.theadStyle}>
                  <tr>
                    {TUTORIAL_PROFILE_COLUMNS.map(col => (
                      <th
                        key={col.key}
                        className={`${styles.headerThClass} ${styles.cellPadClass} ${styles.headerBorderClass} ${styles.headerWeightClass} ${styles.headerTextColorClass} select-none`}
                      >
                        {formatColumnLabel(col.key, col.label, tutorialTextFormat, tutorialLabels)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {filteredProfileRows.map(row => (
                    <tr key={row.id} className={`${styles.rowZebraClass} transition-colors`}>
                      <td className={`${styles.cellPadClass} ${styles.borderClass} font-black text-slate-900 whitespace-nowrap`}>
                        <span className="inline-flex items-center px-2 py-0.5 rounded bg-slate-100 border border-slate-300 font-extrabold text-[10.5px]">
                          {row.etapa}
                        </span>
                      </td>
                      <td className={`${styles.cellPadClass} ${styles.borderClass} font-bold text-slate-800 whitespace-nowrap`}>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase border ${
                          row.role === 'discente'
                            ? 'bg-amber-50 text-amber-900 border-amber-300'
                            : row.role === 'coordenador'
                            ? 'bg-emerald-50 text-emerald-900 border-emerald-300'
                            : row.role === 'visitante'
                            ? 'bg-sky-50 text-sky-900 border-sky-300'
                            : 'bg-slate-100 text-slate-900 border-slate-300'
                        }`}>
                          {row.perfil}
                        </span>
                      </td>
                      <td className={`${styles.cellPadClass} ${styles.borderClass} font-extrabold text-slate-900`}>
                        {row.acao}
                      </td>
                      <td className={`${styles.cellPadClass} ${styles.borderClass} text-slate-700 text-left leading-relaxed`}>
                        {row.descricao}
                      </td>
                      <td className={`${styles.cellPadClass} ${styles.borderClass} text-slate-600 text-left font-medium`}>
                        {row.prazo}
                      </td>
                      <td className={`${styles.cellPadClass} ${styles.borderClass} whitespace-nowrap font-bold text-slate-900`}>
                        <span className="inline-flex items-center gap-1 text-[10.5px] bg-emerald-50 text-emerald-950 px-2 py-0.5 rounded border border-emerald-200">
                          <FileCheck className="w-3 h-3 text-emerald-700" />
                          {row.entregavel}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableScrollWrapper>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: MÓDULOS E RECURSOS DO PORTAL (TABULADO) */}
        {/* ========================================================================= */}
        {activeTab === 'modulos' && (
          <div className="space-y-3">
            <div className="p-3 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between text-xs">
              <span className="font-bold text-slate-700 uppercase tracking-wider text-[10.5px]">
                Estrutura de telas e módulos do Portal de TCC
              </span>
              <span className="text-[10px] font-bold text-slate-500">
                {filteredModulesRows.length} módulos documentados
              </span>
            </div>

            <TableScrollWrapper>
              <table className={`w-full ${styles.cellAlignClass} border-collapse text-xs`}>
                <thead className={`${styles.headerTheadClass} ${styles.headerTextColorClass} ${styles.headerFontSizeClass} ${styles.headerWeightClass} ${styles.headerCasingClass} tracking-normal`} style={styles.theadStyle}>
                  <tr>
                    {TUTORIAL_MODULES_COLUMNS.map(col => (
                      <th
                        key={col.key}
                        className={`${styles.headerThClass} ${styles.cellPadClass} ${styles.headerBorderClass} ${styles.headerWeightClass} ${styles.headerTextColorClass} select-none`}
                      >
                        {formatColumnLabel(col.key, col.label, tutorialTextFormat, tutorialLabels)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {filteredModulesRows.map(row => (
                    <tr key={row.modulo} className={`${styles.rowZebraClass} transition-colors`}>
                      <td className={`${styles.cellPadClass} ${styles.borderClass} font-black text-slate-900 whitespace-nowrap`}>
                        <div className="flex items-center gap-1.5">
                          <Layers className="w-3.5 h-3.5 text-slate-600" />
                          <span>{row.modulo}</span>
                        </div>
                      </td>
                      <td className={`${styles.cellPadClass} ${styles.borderClass} font-bold text-slate-700`}>
                        {row.publico}
                      </td>
                      <td className={`${styles.cellPadClass} ${styles.borderClass} text-slate-800 text-left font-medium leading-relaxed`}>
                        {row.objetivo}
                      </td>
                      <td className={`${styles.cellPadClass} ${styles.borderClass} text-slate-600 text-left leading-relaxed`}>
                        {row.recursos}
                      </td>
                      <td className={`${styles.cellPadClass} ${styles.borderClass} font-bold text-slate-900 text-left`}>
                        <span className="text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 inline-block">
                          {row.acoes}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableScrollWrapper>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 3: FLUXOGRAMAS E PRAZOS REGIMENTAIS (TABULADO) */}
        {/* ========================================================================= */}
        {activeTab === 'fluxo' && (
          <div className="space-y-3">
            <div className="p-3 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between text-xs">
              <span className="font-bold text-slate-700 uppercase tracking-wider text-[10.5px]">
                Quadro Resumo de Ações, Atores, Prazos Regimentais e Documentos
              </span>
              <span className="text-[10px] font-bold text-slate-500">
                Fluxo Oficial 100% Digital
              </span>
            </div>

            <TableScrollWrapper>
              <table className={`w-full ${styles.cellAlignClass} border-collapse text-xs`}>
                <thead className={`${styles.headerTheadClass} ${styles.headerTextColorClass} ${styles.headerFontSizeClass} ${styles.headerWeightClass} ${styles.headerCasingClass} tracking-normal`} style={styles.theadStyle}>
                  <tr>
                    {TUTORIAL_FLOW_COLUMNS.map(col => (
                      <th
                        key={col.key}
                        className={`${styles.headerThClass} ${styles.cellPadClass} ${styles.headerBorderClass} ${styles.headerWeightClass} ${styles.headerTextColorClass} select-none`}
                      >
                        {formatColumnLabel(col.key, col.label, tutorialTextFormat, tutorialLabels)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {filteredFlowRows.map(row => (
                    <tr key={row.fase} className={`${styles.rowZebraClass} transition-colors`}>
                      <td className={`${styles.cellPadClass} ${styles.borderClass} font-black text-slate-900 whitespace-nowrap`}>
                        <span className="inline-flex items-center px-2 py-0.5 rounded bg-slate-100 border border-slate-300 font-extrabold text-[10.5px]">
                          {row.fase}
                        </span>
                      </td>
                      <td className={`${styles.cellPadClass} ${styles.borderClass} font-bold text-slate-800 whitespace-nowrap`}>
                        {row.responsavel}
                      </td>
                      <td className={`${styles.cellPadClass} ${styles.borderClass} font-extrabold text-amber-950 bg-amber-50/60 whitespace-nowrap`}>
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-amber-700" />
                          <span>{row.prazo}</span>
                        </div>
                      </td>
                      <td className={`${styles.cellPadClass} ${styles.borderClass} text-slate-700 text-left leading-relaxed`}>
                        {row.procedimento}
                      </td>
                      <td className={`${styles.cellPadClass} ${styles.borderClass} font-bold text-slate-900 whitespace-nowrap`}>
                        <span className="inline-flex items-center gap-1 text-[10.5px] bg-emerald-50 text-emerald-950 px-2 py-0.5 rounded border border-emerald-200">
                          <FileCheck className="w-3 h-3 text-emerald-700" />
                          {row.entregavel}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableScrollWrapper>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 4: PERGUNTAS E DÚVIDAS FREQUENTES (FAQ TABULADO) */}
        {/* ========================================================================= */}
        {activeTab === 'faq' && (
          <div className="w-full">
            <TableScrollWrapper>
              <table className={`w-full ${styles.cellAlignClass} border-collapse text-xs`}>
                <thead className={`${styles.headerTheadClass} ${styles.headerTextColorClass} ${styles.headerFontSizeClass} ${styles.headerWeightClass} ${styles.headerCasingClass} tracking-normal`} style={styles.theadStyle}>
                  <tr>
                    {TUTORIAL_FAQ_COLUMNS.map(col => (
                      <th
                        key={col.key}
                        className={`${styles.headerThClass} ${styles.cellPadClass} ${styles.headerBorderClass} ${styles.headerWeightClass} ${styles.headerTextColorClass} select-none`}
                      >
                        {formatColumnLabel(col.key, col.label, tutorialTextFormat, tutorialLabels)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {filteredFaqRows.map(row => (
                    <tr key={row.id} className={`${styles.rowZebraClass} transition-colors`}>
                      <td className={`${styles.cellPadClass} ${styles.borderClass} font-black text-slate-900 whitespace-nowrap`}>
                        <span className="inline-flex items-center px-2 py-0.5 rounded bg-slate-100 border border-slate-300 font-extrabold text-[10.5px]">
                          {row.categoria}
                        </span>
                      </td>
                      <td className={`${styles.cellPadClass} ${styles.borderClass} font-extrabold text-slate-900 text-left`}>
                        {row.pergunta}
                      </td>
                      <td className={`${styles.cellPadClass} ${styles.borderClass} text-slate-700 text-left leading-relaxed`}>
                        {row.resposta}
                      </td>
                      <td className={`${styles.cellPadClass} ${styles.borderClass} font-bold text-emerald-900 bg-emerald-50/40 text-left`}>
                        <div className="flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                          <span>{row.recomendacao}</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableScrollWrapper>
          </div>
        )}
        </>
        )}

      </div>
    </div>
  );
};
