import React, { useEffect, useLayoutEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { portalNotice } from '../services/portalDialogs';
import { OilLampIcon } from './OilLampIcon';
import { FeedbackModal } from './FeedbackModal';
import {
  Award,
  BarChart3,
  BookOpen,
  Calendar,
  ChevronLeft,
  Copy,
  FileDown,
  FileText,
  GitBranch,
  HelpCircle,
  Info,
  Lightbulb,
  LogIn,
  LogOut,
  MapPin,
  Settings,
} from 'lucide-react';
import { loadSiteLayoutConfig, SITE_LAYOUT_EVENT, SiteLayoutConfig } from '../utils/siteLayoutConfig';
import { PORTAL_THEME } from '../theme/portalTheme';
import { downloadBlankAttendanceDeclaration } from '../utils/blankAttendanceDeclaration';

interface SidebarProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  isOpenMobile: boolean;
  setIsOpenMobile: (open: boolean) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentTab, setCurrentTab, isOpenMobile, setIsOpenMobile }) => {
  const { isMasterAdmin, isCommissionPresident, isAuthenticated, settings, userEmail, logout } = useAuth();
  const isVisitor = !isAuthenticated;
  const isCollapsed = false;
  const [isHovered, setIsHovered] = useState(false);
  const [keyboardNavigation, setKeyboardNavigation] = useState(true);
  useEffect(() => {
    // Escape dismisses a layer; it must not turn a mouse-selected route into
    // a keyboard-focus highlight when focus returns from that layer.
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setKeyboardNavigation(false);
      else if (event.key === 'Tab') setKeyboardNavigation(true);
    };
    const onPointerDown = () => setKeyboardNavigation(false);
    window.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('pointerdown', onPointerDown, true);
    return () => {
      window.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('pointerdown', onPointerDown, true);
    };
  }, []);

  useLayoutEffect(() => {
    if (!isOpenMobile) return;
    const sidebar = document.getElementById('portal-sidebar');
    document.getElementById('close-mobile-sidebar-btn')?.focus({ preventScroll: true });
    return () => {
      if (document.activeElement === document.body || sidebar?.contains(document.activeElement)) {
        document.getElementById('open-mobile-sidebar-btn')?.focus({ preventScroll: true });
      }
    };
  }, [isOpenMobile]);

  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isDownloadingAttendance, setIsDownloadingAttendance] = useState(false);
  const [feedbackMode,setFeedbackMode]=useState<'submit'|null>(null);
  const [layoutConfig, setLayoutConfig] = useState<SiteLayoutConfig>(loadSiteLayoutConfig());
  const appVersion = String((import.meta as any).env?.VITE_APP_VERSION || '0.0.0');
  const buildCommit = String((import.meta as any).env?.VITE_GIT_COMMIT || '').slice(0, 7);

  useEffect(() => {
    const handleLayoutChange = (event: Event) => setLayoutConfig((event as CustomEvent<SiteLayoutConfig>).detail || loadSiteLayoutConfig());
    window.addEventListener(SITE_LAYOUT_EVENT, handleLayoutChange);
    return () => window.removeEventListener(SITE_LAYOUT_EVENT, handleLayoutChange);
  }, []);

  const handleNav = (tab: string) => { setCurrentTab(tab); setIsOpenMobile(false); };
  const handleLogout = async () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    try {
      await logout();
      handleNav('home');
    } catch {
      portalNotice('Não foi possível concluir a saída. Confira a conexão e tente novamente.', {title:'Saída não concluída'});
    } finally {
      setIsLoggingOut(false);
    }
  };
  const handleAttendanceDownload = async () => {
    if (isDownloadingAttendance) return;
    setIsDownloadingAttendance(true);
    try {
      await downloadBlankAttendanceDeclaration();
      setIsOpenMobile(false);
    } catch {
      portalNotice('Não foi possível baixar a declaração. Tente novamente.', { title: 'Download indisponível' });
    } finally {
      setIsDownloadingAttendance(false);
    }
  };
  const isColorLight = (hex?: string) => {
    if (!hex) return false;
    if (['#ffffff', '#f8fafc', 'var(--portal-surface-page)', '#e2e8f0', '#f0f1e7', '#e0f2fe', '#fefce8', '#fff1f2'].includes(hex)) return true;
    const clean = hex.replace('#', ''); if (clean.length !== 6) return false;
    const r = parseInt(clean.substring(0, 2), 16), g = parseInt(clean.substring(2, 4), 16), b = parseInt(clean.substring(4, 6), 16);
    return (r * 299 + g * 587 + b * 114) / 1000 > 140;
  };
  const isHeaderLight = isColorLight(layoutConfig.sidebarHeaderBgColor || PORTAL_THEME.chrome.sidebarFooter);
  const sidebarHeaderTitleColor = layoutConfig.sidebarTitleColor || (isHeaderLight ? PORTAL_THEME.text.dark : PORTAL_THEME.text.light);
  const sidebarFooterTextColor = isHeaderLight ? '#0f172a' : '#ffffff';
  const sidebarFooterMutedColor = isHeaderLight ? '#64748b' : '#d6d9d7';
  const sidebarAccent = layoutConfig.sidebarSubtitleColor || 'var(--portal-sidebar-active-accent)';
  const getNavLabel = (id: string, fallback: string) => layoutConfig.sidebarNavLabels?.[id] || fallback;
  const renderNavIcon = (_id: string, Icon: React.ComponentType<{ className?: string }>, _defaultEmoji: string, _isActive: boolean) => (
    <Icon className="h-4 w-4 shrink-0 text-white" aria-hidden="true" />
  );

  return <>
    {isOpenMobile && <div id="sidebar-mobile-backdrop" className="fixed inset-0 bg-slate-900/60 z-40 lg:hidden backdrop-blur-xs" onClick={() => setIsOpenMobile(false)} />}
    {isCollapsed && <div id="sidebar-hover-trigger" className="hidden lg:flex fixed left-0 top-0 bottom-0 w-3 z-45 bg-slate-200/40 hover:bg-emerald-600/10 border-r border-slate-300/30 hover:border-emerald-500/50 items-center justify-center transition-all duration-150 cursor-pointer group" onMouseEnter={() => setIsHovered(true)} title="Passe o mouse aqui para abrir o menu lateral"><ChevronLeft className="w-3.5 h-3.5 text-slate-500 opacity-0 group-hover:opacity-100 rotate-180 transition-opacity duration-150" /></div>}
    <div id="sidebar-layout-spacer" className={`hidden lg:block transition-all duration-300 ease-in-out shrink-0 overflow-hidden ${isCollapsed ? 'w-0' : 'w-64'}`} />
    <aside id="portal-sidebar" onKeyDown={(event) => {
      if (isOpenMobile && event.key === 'Escape') {
        event.stopPropagation();
        setIsOpenMobile(false);
      }
    }} data-keyboard-navigation={keyboardNavigation ? 'true' : 'false'} onMouseEnter={() => setIsHovered(true)} onMouseLeave={() => setIsHovered(false)} style={{backgroundColor: layoutConfig.sidebarBgColor || PORTAL_THEME.chrome.sidebarFooter,borderColor: layoutConfig.sidebarDividerColor || PORTAL_THEME.chrome.divider,color: layoutConfig.sidebarTextColor || PORTAL_THEME.text.light}} className={`fixed top-0 bottom-0 left-0 z-50 w-64 max-w-full text-slate-100 flex flex-col border-r transition-transform duration-300 ease-in-out ${isOpenMobile ? 'translate-x-0' : 'invisible -translate-x-full lg:visible'} ${isCollapsed ? (isHovered ? 'lg:translate-x-0 lg:shadow-2xl' : 'lg:-translate-x-full') : 'lg:translate-x-0'}`}>
      <div style={{backgroundColor: layoutConfig.sidebarHeaderBgColor || PORTAL_THEME.chrome.sidebarFooter,borderColor: layoutConfig.sidebarDividerColor || PORTAL_THEME.chrome.divider}} className="px-2.5 py-3.5 border-b flex items-center justify-between relative group">
        <button type="button" onClick={() => handleNav('home')} className="flex items-center gap-2 hover:opacity-95 transition-opacity focus:outline-none cursor-pointer flex-1 min-w-0" title="Ir para o Calendário Público Inicial">
          <OilLampIcon size={64.8} />
          <div className="flex flex-col flex-1 min-w-0 items-center justify-center text-center pr-1">
            <h1 className="font-black text-[14.4px] sm:text-[15.3px] tracking-tight uppercase leading-tight text-center whitespace-normal w-full" style={{ color: sidebarHeaderTitleColor }}>{layoutConfig.sidebarTitle || 'Portal de TCC'}</h1>
            <div className="portal-sidebar-subtitle mt-1.5 w-full text-center font-black tracking-[0.055em] leading-[1.25] uppercase" style={{ color: sidebarAccent }}>
              <span className="block">{layoutConfig.sidebarSubtitle || 'Enfermagem'}</span>
            </div>
          </div>
        </button>
        <button id="close-mobile-sidebar-btn" type="button" onClick={() => setIsOpenMobile(false)} className="lg:hidden text-slate-300 hover:text-white p-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white" aria-label="Fechar menu"><ChevronLeft className="w-5 h-5" /></button>
      </div>

      <nav id="sidebar-nav" className="flex flex-1 min-h-0 flex-col gap-4 p-3 overflow-y-auto">
        {(() => {
          const allNavMap: Record<string, { id: string; label: string; icon: React.ComponentType<{ className?: string }>; emoji: string; visible: boolean }> = {
            home: { id: 'home', label: getNavLabel('home', 'Calendário'), icon: Calendar, emoji: '', visible: true },
            biblioteca: { id: 'biblioteca', label: getNavLabel('biblioteca', 'Repositório'), icon: BookOpen, emoji: '', visible: true },
            'como-chegar': { id: 'como-chegar', label: getNavLabel('como-chegar', 'Como chegar'), icon: MapPin, emoji: '', visible: true },
            'informacoes-gerais': { id: 'informacoes-gerais', label: getNavLabel('informacoes-gerais', 'Informações gerais'), icon: Info, emoji: '', visible: true },
            tutorial: { id: 'tutorial', label: getNavLabel('tutorial', 'Como usar'), icon: HelpCircle, emoji: '', visible: true },
            'fluxo-tcc': { id: 'fluxo-tcc', label: getNavLabel('fluxo-tcc', 'Fluxo do TCC'), icon: GitBranch, emoji: '', visible: true },
            'meus-processos': { id: 'meus-processos', label: getNavLabel('meus-processos', 'Meus TCCs'), icon: FileText, emoji: '', visible: !isVisitor },
            coordenador: { id: 'coordenador', label: getNavLabel('coordenador', 'Área do Presidente'), icon: Award, emoji: '', visible: (isMasterAdmin || isCommissionPresident) && !isVisitor },
            configuracoes: { id: 'configuracoes', label: getNavLabel('configuracoes', 'Configurações'), icon: Settings, emoji: '', visible: isMasterAdmin && !isVisitor },
            analise: { id: 'analise', label: getNavLabel('indicadores', 'Indicadores'), icon: BarChart3, emoji: '', visible: true },
            replicar: { id: 'replicar', label: getNavLabel('replicar', 'Replicar Portal'), icon: Copy, emoji: '', visible: true },
            'declaracao-comparecimento': { id: 'declaracao-comparecimento', label: 'Declaração de comparecimento', icon: FileDown, emoji: '', visible: true },
            sugestoes: { id: 'sugestoes', label: 'Sugestões', icon: Lightbulb, emoji: '', visible: true }
          };
          const configuredOrder = layoutConfig.sidebarNavOrder && layoutConfig.sidebarNavOrder.length > 0 ? layoutConfig.sidebarNavOrder.filter((key) => !['acessar-portal', 'assinaturas'].includes(key)).map((key) => key === 'indicadores' ? 'analise' : key) : ['home', 'biblioteca', 'DIVIDER_1', 'meus-processos', 'coordenador', 'configuracoes', 'DIVIDER_2', 'analise', 'como-chegar', 'informacoes-gerais', 'tutorial', 'fluxo-tcc', 'replicar'];
          const order = [...configuredOrder].filter((key) => key !== 'analise' && key !== 'sugestoes' && key !== 'declaracao-comparecimento');
          const indicatorsAnchor = order.indexOf('como-chegar');
          order.splice(indicatorsAnchor >= 0 ? indicatorsAnchor : order.length, 0, 'analise');
          const sanitizedOrder = order.filter((key) => !['logs', 'asten-logs'].includes(key));
          order.splice(0, order.length, ...sanitizedOrder);
          if (!order.includes('como-chegar')) { const tutorialIndex = order.indexOf('tutorial'); order.splice(tutorialIndex >= 0 ? tutorialIndex : order.length, 0, 'como-chegar'); }
          if (!order.includes('informacoes-gerais')) { const tutorialIndex = order.indexOf('tutorial'); order.splice(tutorialIndex >= 0 ? tutorialIndex : order.length, 0, 'informacoes-gerais'); }
          if (!order.includes('fluxo-tcc')) { const replicationIndex = order.indexOf('replicar'); order.splice(replicationIndex >= 0 ? replicationIndex : order.length, 0, 'fluxo-tcc'); }
          if (!order.includes('replicar')) order.push('replicar');
          const informationEnd = order.indexOf('replicar');
          order.splice(informationEnd, 0, 'sugestoes', 'declaracao-comparecimento');
          const renderNavItem = (itemKey: string, idx: number) => {
            if (itemKey.startsWith('DIVIDER')) { if (layoutConfig.sidebarShowDividers === false || layoutConfig.sidebarDividerStyle === 'none') return null; return <div key={`${itemKey}-${idx}`} className="my-2.5 pt-0.5 border-t transition-colors" style={{ borderColor: layoutConfig.sidebarDividerColor || PORTAL_THEME.chrome.divider, borderStyle: layoutConfig.sidebarDividerStyle || 'solid' }} />; }
            const item = allNavMap[itemKey]; if (!item || !item.visible) return null; const Icon = item.icon; const isActive = currentTab === item.id || (item.id === 'home' && currentTab === 'calendario');
            return <button key={item.id} id={`nav-item-${item.id}`} type="button" onClick={() => {
              if (item.id === 'sugestoes') {
                setFeedbackMode('submit');
                setIsOpenMobile(false);
              } else if (item.id === 'declaracao-comparecimento') {
                void handleAttendanceDownload();
              } else handleNav(item.id);
            }} disabled={item.id === 'declaracao-comparecimento' && isDownloadingAttendance} title={item.id === 'declaracao-comparecimento' ? 'Baixar PDF em branco para preenchimento manual' : undefined} aria-label={item.id === 'declaracao-comparecimento' ? 'Baixar declaração de comparecimento em PDF' : undefined} className={`portal-sidebar-nav-item w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl border border-transparent outline-none font-bold text-left transition-all cursor-pointer ${isActive ? 'portal-sidebar-nav-active font-extrabold shadow-sm' : 'hover:bg-white/10'} disabled:opacity-60`} style={isActive ? {backgroundColor: layoutConfig.sidebarActiveBgColor || 'var(--portal-sidebar-active)',color: layoutConfig.sidebarActiveTextColor || '#ffffff'} : { color: layoutConfig.sidebarTextColor || '#f8fafc' }}><div className="flex items-center gap-3">{renderNavIcon(item.id, Icon, item.emoji, isActive)}<span>{item.label}</span></div></button>;
          };
          const publicKeys = order.filter((key) => ['home', 'biblioteca'].includes(key));
          const userKeys = order.filter((key) => ['meus-processos', 'coordenador', 'configuracoes'].includes(key));
          const replicationKeys = order.filter((key) => key === 'replicar');
          const informationKeys = order.filter((key) =>
            !key.startsWith('DIVIDER') && !publicKeys.includes(key) && !userKeys.includes(key) && !replicationKeys.includes(key)
          );
          const showSectionDividers = layoutConfig.sidebarShowDividers !== false && layoutConfig.sidebarDividerStyle !== 'none';
          const sectionDividerStyle = {
            borderColor: layoutConfig.sidebarDividerColor || PORTAL_THEME.chrome.divider,
            borderStyle: layoutConfig.sidebarDividerStyle || 'solid',
          };
          const renderSection = (title: string, keys: string[], index: number) => {
            const visibleKeys = keys.filter((key) => allNavMap[key]?.visible);
            if (!visibleKeys.length && title !== 'ÁREA DO USUÁRIO') return null;
            return <section key={title} aria-label={title} className={index > 0 ? `pt-3 ${showSectionDividers ? 'border-t' : ''}` : ''} style={index > 0 && showSectionDividers ? sectionDividerStyle : undefined}>
              <p className="portal-sidebar-section-heading px-3.5 mb-2 font-extrabold uppercase tracking-widest" style={{ color: sidebarAccent }}>{title}</p>
              <div className="space-y-1">
                {visibleKeys.length ? visibleKeys.map((key, itemIndex) => renderNavItem(key, itemIndex)) : (
                  <p className="portal-sidebar-section-hint px-3.5 py-2 leading-relaxed" style={{ color: layoutConfig.sidebarTextColor || PORTAL_THEME.text.light }}>
                    Entre no Portal para acompanhar seus TCCs e atividades.
                  </p>
                )}
              </div>
            </section>;
          };
          return <>
            <div className="shrink-0 space-y-3">
              {renderSection('CONSULTA PÚBLICA', publicKeys, 0)}
              {renderSection('ÁREA DO USUÁRIO', userKeys, 1)}
              {renderSection('INFORMAÇÕES', informationKeys, 2)}
              {renderSection('REPLICAÇÃO', replicationKeys, 3)}
            </div>

          </>;
        })()}
      </nav>

      <div id="sidebar-user-footer" style={{backgroundColor: layoutConfig.sidebarHeaderBgColor || PORTAL_THEME.chrome.sidebarFooter,borderColor: layoutConfig.sidebarDividerColor || PORTAL_THEME.chrome.divider}} className="p-4 border-t space-y-2 text-center">
        {isVisitor ? <button id="bottom-access-portal-btn" type="button" onClick={() => handleNav('acessar-portal')} className="w-full flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-slate-100 px-3 py-2.5 text-xs font-black normal-case tracking-wide text-slate-800 shadow-sm hover:bg-white transition-colors"><LogIn className="w-4 h-4" />Entrar no Portal</button> : <>
          <button id="bottom-logout-portal-btn" type="button" onClick={() => void handleLogout()} disabled={isLoggingOut} className="w-full flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-slate-100 px-3 py-2.5 text-xs font-black normal-case tracking-wide text-slate-800 shadow-sm hover:bg-white disabled:opacity-60 transition-colors"><LogOut className="w-4 h-4" />{isLoggingOut ? 'Saindo…' : 'Sair do Portal'}</button>
          <div className="pt-2 border-t w-full" style={{ borderColor: layoutConfig.sidebarDividerColor || PORTAL_THEME.chrome.divider }}>
            <div className="text-[10px] font-bold normal-case tracking-widest text-center" style={{ color: sidebarFooterMutedColor }}>{layoutConfig.sidebarSessionLabel || 'Sessão ativa'}</div>
            <div className="mt-1 text-xs font-semibold break-all text-center" style={{ color: sidebarFooterTextColor }} title={userEmail}>{userEmail}</div>
          </div>
        </>}
        <div className="text-[9px] font-medium tracking-wide text-center" style={{ color: sidebarFooterMutedColor }} title={buildCommit ? `Fingerprint do build: ${buildCommit}` : undefined}>Versão do sistema: {appVersion}{buildCommit ? ` · ${buildCommit}` : ''}</div>
      </div>
    </aside>
    <FeedbackModal open={feedbackMode!==null} onClose={()=>setFeedbackMode(null)} />
  </>;
};
