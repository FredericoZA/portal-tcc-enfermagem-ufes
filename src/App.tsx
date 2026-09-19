import { PortalDialogs } from './components/PortalDialogs';
import { PortalErrorBoundary } from './components/PortalErrorBoundary';
import React, { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { AuthProvider } from './context/AuthContext';
import { UserSimulatorBar } from './components/UserSimulatorBar';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { EmergencyRecoveryModal } from './components/EmergencyRecoveryModal';
import { IndicadoresPage } from './pages/IndicadoresPage';
import { PortalFeedbackController } from './components/PortalFeedbackController';

const HomePage = lazy(() => import('./pages/HomePage').then((module) => ({ default: module.HomePage })));
const PortalTutorialPage = lazy(() => import('./pages/PortalTutorialPage').then((module) => ({ default: module.PortalTutorialPage })));
const FluxoTccPage = lazy(() => import('./pages/FluxoTccPage').then((module) => ({ default: module.FluxoTccPage })));
const PortalReplicationPage = lazy(() => import('./pages/PortalReplicationPage').then((module) => ({ default: module.PortalReplicationPage })));
const MeusProcessosPage = lazy(() => import('./pages/MeusProcessosPage').then((module) => ({ default: module.MeusProcessosPage })));
const ProcessoDetailPage = lazy(() => import('./pages/ProcessoDetailPage').then((module) => ({ default: module.ProcessoDetailPage })));
const WizardCadastroPage = lazy(() => import('./pages/WizardCadastroPage').then((module) => ({ default: module.WizardCadastroPage })));
const AgendaPage = lazy(() => import('./pages/AgendaPage').then((module) => ({ default: module.AgendaPage })));
const AvaliacoesPage = lazy(() => import('./pages/AvaliacoesPage').then((module) => ({ default: module.AvaliacoesPage })));
const DocumentosPage = lazy(() => import('./pages/DocumentosPage').then((module) => ({ default: module.DocumentosPage })));
const CoordenadorPage = lazy(() => import('./pages/CoordenadorPage').then((module) => ({ default: module.CoordenadorPage })));
const ConfiguracoesPage = lazy(() => import('./pages/ConfiguracoesPage').then((module) => ({ default: module.ConfiguracoesPage })));
const AuditLogsPage = lazy(() => import('./pages/AuditLogsPage').then((module) => ({ default: module.AuditLogsPage })));
const AstenLogsPage = lazy(() => import('./pages/AstenLogsPage').then((module) => ({ default: module.AstenLogsPage })));
const ComoChegarPage = lazy(() => import('./pages/ComoChegarPage').then((module) => ({ default: module.ComoChegarPage })));

function PageLoadingFallback() {
  return (
    <div className="portal-route-loading" role="status" aria-live="polite" aria-label="Carregando conteúdo">
      <span className="portal-route-loading__indicator" aria-hidden="true" />
      <span>Carregando conteúdo…</span>
    </div>
  );
}

export default function App() {
  const [currentTab, setCurrentTab] = useState('home');
  const [selectedProcessId, setSelectedProcessId] = useState<string | null>(null);
  const [selectedProcessReadOnly, setSelectedProcessReadOnly] = useState<boolean>(false);
  const [isOpenMobileSidebar, setIsOpenMobileSidebar] = useState(false);
  const [isEmergencyModalOpen, setIsEmergencyModalOpen] = useState(false);
  const [emergencySecretKeyParam] = useState('');
  const processDialogRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const handleSelectProcess = (id: string, readOnly = false) => {
    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setSelectedProcessId(id);
    setSelectedProcessReadOnly(readOnly);
  };

  const handleCloseProcess = () => {
    setSelectedProcessId(null);
    window.setTimeout(() => previousFocusRef.current?.focus(), 0);
  };

  const handleNavigate = (tab: string) => {
    setSelectedProcessId(null);
    setCurrentTab(tab);
  };

  useEffect(() => {
    const navigate = (event: Event) => handleNavigate(String((event as CustomEvent).detail || 'home'));
    window.addEventListener('portal:navigate', navigate);
    return () => window.removeEventListener('portal:navigate', navigate);
  }, []);

  useEffect(() => {
    if (currentTab !== 'acessar-portal') return;
    const timer = window.setTimeout(() => document.getElementById('open-login-modal-btn')?.click(), 120);
    return () => window.clearTimeout(timer);
  }, [currentTab]);

  useEffect(() => {
    if (!selectedProcessId) return;
    processDialogRef.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') handleCloseProcess();
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [selectedProcessId]);

  const renderMainTab = () => {
    switch (currentTab) {
      case 'home':
      case 'calendario':
        return <HomePage initialPublicTab="calendario" onNavigate={handleNavigate} />;
      case 'biblioteca':
        return <HomePage initialPublicTab="biblioteca" onNavigate={handleNavigate} />;
      case 'tutorial':
        return <PortalTutorialPage onNavigate={handleNavigate} />;
      case 'fluxo-tcc':
        return <FluxoTccPage />;
      case 'replicar':
        return <PortalReplicationPage />;
      case 'acessar-portal':
        return <HomePage onNavigate={handleNavigate} />;
      case 'meus-processos':
        return <MeusProcessosPage onSelectProcess={(id) => handleSelectProcess(id, false)} onNavigateToWizard={() => handleNavigate('novo-processo')} />;
      case 'novo-processo':
        return <WizardCadastroPage onSuccess={(newId) => handleSelectProcess(newId, false)} onCancel={() => handleNavigate('meus-processos')} />;
      case 'agenda':
        return <AgendaPage onSelectProcess={(id) => handleSelectProcess(id, true)} />;
      case 'avaliacoes':
        return <AvaliacoesPage onSelectProcess={(id) => handleSelectProcess(id, false)} />;
      case 'documentos':
        return <DocumentosPage onSelectProcess={(id) => handleSelectProcess(id, false)} />;
      case 'coordenador':
        return <CoordenadorPage onSelectProcess={(id) => handleSelectProcess(id, false)} />;
      case 'configuracoes':
        return <ConfiguracoesPage />;
      case 'logs':
        return <AuditLogsPage />;
      case 'asten-logs':
        return <AstenLogsPage />;
      case 'analise':
      case 'indicadores':
        return <IndicadoresPage />;
      case 'como-chegar':
        return <ComoChegarPage />;
      default:
        return <HomePage onNavigate={handleNavigate} />;
    }
  };

  return (
    <AuthProvider>
      <PortalDialogs />
      <PortalFeedbackController />
      <div id="portal-app-root" className="min-h-screen bg-slate-100 flex flex-col font-sans antialiased text-slate-900">
        {(import.meta as any).env?.DEV && <UserSimulatorBar />}

        <div className="flex-1 flex overflow-hidden">
          <Sidebar
            currentTab={currentTab}
            setCurrentTab={(tab) => {
              setSelectedProcessId(null);
              setCurrentTab(tab);
            }}
            isOpenMobile={isOpenMobileSidebar}
            setIsOpenMobile={setIsOpenMobileSidebar}
          />

          <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
            <Header
              onOpenMobileSidebar={() => setIsOpenMobileSidebar(true)}
              onGoHome={() => {
                setSelectedProcessId(null);
                setCurrentTab('home');
              }}
              title={
                selectedProcessId ? 'Detalhes do Trabalho de TCC'
                  : currentTab === 'home' ? 'Página Inicial Pública'
                  : currentTab === 'tutorial' ? 'Como usar o Portal'
                  : currentTab === 'fluxo-tcc' ? 'Fluxo do TCC'
                  : currentTab === 'replicar' ? 'Replicar o Portal'
                  : currentTab === 'como-chegar' ? 'Como chegar'
                  : currentTab === 'acessar-portal' ? 'Acesso ao Portal'
                  : currentTab === 'meus-processos' ? 'Meus Trabalhos de TCC'
                  : currentTab === 'novo-processo' ? 'Cadastrar Trabalho de TCC'
                  : currentTab === 'agenda' ? 'Agenda de Defesas'
                  : currentTab === 'avaliacoes' ? 'Avaliações de TCC'
                  : currentTab === 'documentos' ? 'Documentos'
                  : currentTab === 'coordenador' ? 'Área do Presidente'
                  : currentTab === 'configuracoes' ? 'Configurações & Modelos de Arquivos'
                  : currentTab === 'logs' ? 'Registro de Logs'
                  : currentTab === 'asten-logs' ? 'Registros da Asten'
                  : (currentTab === 'analise' || currentTab === 'indicadores') ? 'Indicadores'
                  : 'Portal de TCC'
              }
            />

            <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto min-h-[500px]">
              <PortalErrorBoundary key={currentTab}><Suspense fallback={<PageLoadingFallback />}>{renderMainTab()}</Suspense></PortalErrorBoundary>
            </main>

            <Footer />
          </div>
        </div>

        {selectedProcessId && (
          <div className="fixed inset-0 bg-slate-900/80 z-50 overflow-y-auto p-2 sm:p-4 md:p-6 backdrop-blur-xs animate-fadeIn flex justify-center items-start" onClick={handleCloseProcess}>
            <div
              ref={processDialogRef}
              role="dialog"
              aria-modal="true"
              aria-label="Detalhes do Trabalho de TCC"
              tabIndex={-1}
              className="max-w-6xl w-full bg-slate-100 rounded-2xl shadow-2xl border border-slate-300 overflow-hidden relative my-2 sm:my-4 animate-in zoom-in-95 duration-150"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-3 sm:p-5 bg-slate-100 max-h-[90vh] overflow-y-auto custom-scrollbar">
                <PortalErrorBoundary key={selectedProcessId}><Suspense fallback={<PageLoadingFallback />}>
                  <ProcessoDetailPage processId={selectedProcessId} readOnly={selectedProcessReadOnly} onBack={handleCloseProcess} isModal={true} />
                </Suspense></PortalErrorBoundary>
              </div>
            </div>
          </div>
        )}

        <EmergencyRecoveryModal isOpen={isEmergencyModalOpen} onClose={() => setIsEmergencyModalOpen(false)} defaultSecretKey={emergencySecretKeyParam} />
      </div>
    </AuthProvider>
  );
}
