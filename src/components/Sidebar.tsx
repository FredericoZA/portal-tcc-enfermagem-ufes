import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { NursingEmblemLogo } from './NursingEmblemLogo';
import {
  Award,
  BarChart3,
  BookOpen,
  Calendar,
  ChevronLeft,
  FileText,
  HelpCircle,
  LogIn,
  Settings,
  Copy,
} from 'lucide-react';
import { loadSiteLayoutConfig, SITE_LAYOUT_EVENT, SiteLayoutConfig } from '../utils/siteLayoutConfig';

interface SidebarProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  isOpenMobile: boolean;
  setIsOpenMobile: (open: boolean) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentTab, setCurrentTab, isOpenMobile, setIsOpenMobile }) => {
  const { isMasterAdmin, isAuthenticated, settings, userEmail } = useAuth();
  const courseLogo = String((settings as any)?.courseLogoDataUrl || '');
  const configuredLogo = courseLogo || settings?.integrationStudio?.brandKit?.courseLogoUrl || settings?.integrationStudio?.brandKit?.universityLogoUrl || '';
  const isVisitor = !isAuthenticated;
  const isCollapsed = false;
  const [isHovered, setIsHovered] = useState(false);
  const [layoutConfig, setLayoutConfig] = useState<SiteLayoutConfig>(loadSiteLayoutConfig());
  const [runtimeBuild, setRuntimeBuild] = useState({ version: '1.0.0-rc.13', commit: '' });
  const accessLocation = layoutConfig.sidebarLocationText || 'Campus de Maruípe · Vitória/ES';

  useEffect(() => {
    const handleLayoutChange = (event: Event) => setLayoutConfig((event as CustomEvent<SiteLayoutConfig>).detail || loadSiteLayoutConfig());
    window.addEventListener(SITE_LAYOUT_EVENT, handleLayoutChange);
    return () => window.removeEventListener(SITE_LAYOUT_EVENT, handleLayoutChange);
  }, []);

  useEffect(() => {
    let active = true;
    void fetch('/api/health', { cache: 'no-store' }).then((response) => response.ok ? response.json() : Promise.reject(new Error('health unavailable'))).then((payload: any) => {
      if (!active) return;
      setRuntimeBuild({ version: String(payload?.version || '1.0.0-rc.13'), commit: String(payload?.commit || '').slice(0, 7) });
    }).catch(() => undefined);
    return () => { active = false; };
  }, []);

  const handleNav = (tab: string) => { setCurrentTab(tab); setIsOpenMobile(false); };
  const isColorLight = (hex?: string) => {
    if (!hex) return false;
    if (['#ffffff', '#f8fafc', '#f1f5f9', '#e2e8f0', '#f0f1e7', '#e0f2fe', '#fefce8', '#fff1f2'].includes(hex)) return true;
    const clean = hex.replace('#', ''); if (clean.length !== 6) return false;
    const r = parseInt(clean.substring(0, 2), 16), g = parseInt(clean.substring(2, 4), 16), b = parseInt(clean.substring(4, 6), 16);
    return (r * 299 + g * 587 + b * 114) / 1000 > 140;
  };
  const isHeaderLight = isColorLight(layoutConfig.sidebarHeaderBgColor || '#03271f');
  const sidebarHeaderTitleColor = layoutConfig.sidebarTitleColor || (isHeaderLight ? '#0f172a' : '#ffffff');
  const sidebarFooterTextColor = isHeaderLight ? '#0f172a' : '#ffffff';
  const sidebarFooterMutedColor = isHeaderLight ? '#64748b' : '#d6d9d7';
  const getNavLabel = (id: string, fallback: string) => layoutConfig.sidebarNavLabels?.[id] || fallback;
  const getNavEmoji = (id: string, fallback: string) => layoutConfig.sidebarNavEmojis?.[id] || fallback;
  const renderNavIcon = (id: string, Icon: React.ComponentType<{ className?: string }>, defaultEmoji: string, isActive: boolean) => {
    const rawEmoji = getNavEmoji(id, defaultEmoji); const emoji = Array.from(rawEmoji || '')[0] || defaultEmoji;
    if ((layoutConfig.sidebarIconMode || 'emoji') === 'lucide') return <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-200'}`} />;
    return <span className="text-base shrink-0 leading-none">{emoji}</span>;
  };
  const sidebarLogoSrc = courseLogo || (layoutConfig.sidebarLogoType === 'custom' && layoutConfig.sidebarCustomLogoUrl ? layoutConfig.sidebarCustomLogoUrl : configuredLogo);

  return <>
    {isOpenMobile && <div id="sidebar-mobile-backdrop" className="fixed inset-0 bg-slate-900/60 z-40 lg:hidden backdrop-blur-xs" onClick={() => setIsOpenMobile(false)} />}
    {isCollapsed && <div id="sidebar-hover-trigger" className="hidden lg:flex fixed left-0 top-0 bottom-0 w-3 z-45 bg-slate-200/40 hover:bg-emerald-600/10 border-r border-slate-300/30 hover:border-emerald-500/50 items-center justify-center transition-all duration-150 cursor-pointer group" onMouseEnter={() => setIsHovered(true)} title="Passe o mouse aqui para abrir o menu lateral"><ChevronLeft className="w-3.5 h-3.5 text-slate-500 opacity-0 group-hover:opacity-100 rotate-180 transition-opacity duration-150" /></div>}
    <div id="sidebar-layout-spacer" className={`hidden lg:block transition-all duration-300 ease-in-out shrink-0 overflow-hidden ${isCollapsed ? 'w-0' : 'w-64'}`} />
    <aside id="portal-sidebar" onMouseEnter={() => setIsHovered(true)} onMouseLeave={() => setIsHovered(false)} style={{backgroundColor: layoutConfig.sidebarBgColor || '#06372d',borderColor: layoutConfig.sidebarDividerColor || '#365349',color: layoutConfig.sidebarTextColor || '#f8fafc'}} className={`fixed top-0 bottom-0 left-0 z-50 w-64 text-slate-100 flex flex-col border-r transition-all duration-300 ease-in-out ${isOpenMobile ? 'translate-x-0' : '-translate-x-full'} ${isCollapsed ? (isHovered ? 'lg:translate-x-0 lg:shadow-2xl' : 'lg:-translate-x-full') : 'lg:translate-x-0'}`}>
      <div style={{backgroundColor: layoutConfig.sidebarHeaderBgColor || '#03271f',borderColor: layoutConfig.sidebarDividerColor || '#365349'}} className="px-3 py-4 border-b flex items-center justify-between relative group">
        <button type="button" onClick={() => handleNav('home')} className="flex items-center gap-2.5 hover:opacity-95 transition-opacity focus:outline-none cursor-pointer flex-1 min-w-0" title="Ir para o Calendário Público Inicial">
          <NursingEmblemLogo size={58} className="shrink-0" customSrc={sidebarLogoSrc || '/colenf-logo.png'} />
          <div className="flex flex-col flex-1 min-w-0 items-center justify-center text-center pr-1">
            <h1 className="font-black text-[15px] sm:text-base tracking-tight uppercase leading-tight text-center whitespace-normal w-full" style={{ color: sidebarHeaderTitleColor }}>{layoutConfig.sidebarTitle || 'Portal de TCC'}</h1>
            <p className="mt-1.5 w-full text-center text-[13px] sm:text-[14px] font-bold tracking-[0.01em] leading-snug" style={{ color: isHeaderLight ? '#475569' : '#f1f5f9' }}>
              Enfermagem e Obstetrícia · UFES
            </p>
          </div>
        </button>
        <button id="close-mobile-sidebar-btn" onClick={() => setIsOpenMobile(false)} className="lg:hidden text-slate-300 hover:text-white p-1" aria-label="Fechar menu"><ChevronLeft className="w-5 h-5" /></button>
      </div>

      <nav id="sidebar-nav" className="flex-1 p-3 space-y-1.5 overflow-y-auto">
        {(() => {
          const allNavMap: Record<string, { id: string; label: string; icon: React.ComponentType<{ className?: string }>; emoji: string; visible: boolean }> = {
            home: { id: 'home', label: getNavLabel('home', 'Calendário'), icon: Calendar, emoji: '📅', visible: true },
            biblioteca: { id: 'biblioteca', label: getNavLabel('biblioteca', 'Repositório'), icon: BookOpen, emoji: '📚', visible: true },
            tutorial: { id: 'tutorial', label: getNavLabel('tutorial', 'Como usar'), icon: HelpCircle, emoji: '❓', visible: true },
            'meus-processos': { id: 'meus-processos', label: getNavLabel('meus-processos', 'Meus TCCs'), icon: FileText, emoji: '📋', visible: !isVisitor },
            coordenador: { id: 'coordenador', label: getNavLabel('coordenador', 'Área do Presidente'), icon: Award, emoji: '🏛️', visible: isMasterAdmin && !isVisitor },
            configuracoes: { id: 'configuracoes', label: getNavLabel('configuracoes', 'Configurações'), icon: Settings, emoji: '⚙️', visible: isMasterAdmin && !isVisitor },
            analise: { id: 'analise', label: getNavLabel('indicadores', 'Indicadores'), icon: BarChart3, emoji: getNavEmoji('indicadores', '📊'), visible: isMasterAdmin && !isVisitor },
            replicar: { id: 'replicar', label: getNavLabel('replicar', 'Replicar Portal'), icon: Copy, emoji: getNavEmoji('replicar', '🧩'), visible: true }
          };
          const configuredOrder = layoutConfig.sidebarNavOrder && layoutConfig.sidebarNavOrder.length > 0 ? layoutConfig.sidebarNavOrder.filter((key) => !['acessar-portal', 'assinaturas'].includes(key)).map((key) => key === 'indicadores' ? 'analise' : key) : ['home', 'biblioteca', 'DIVIDER_1', 'meus-processos', 'coordenador', 'configuracoes', 'analise', 'DIVIDER_2', 'tutorial', 'replicar'];
          const order = [...configuredOrder]; if (!order.includes('analise')) { const settingsIndex = order.indexOf('configuracoes'); order.splice(settingsIndex >= 0 ? settingsIndex + 1 : order.length, 0, 'analise'); } if (!order.includes('replicar')) order.push('replicar');
          return order.map((itemKey, idx) => {
            if (itemKey.startsWith('DIVIDER')) { if (layoutConfig.sidebarShowDividers === false || layoutConfig.sidebarDividerStyle === 'none') return null; return <div key={`${itemKey}-${idx}`} className="my-2.5 pt-0.5 border-t transition-colors" style={{ borderColor: layoutConfig.sidebarDividerColor || '#365349', borderStyle: layoutConfig.sidebarDividerStyle || 'solid' }} />; }
            const item = allNavMap[itemKey]; if (!item || !item.visible) return null; const Icon = item.icon; const isActive = currentTab === item.id || (item.id === 'home' && currentTab === 'calendario');
            return <button key={item.id} id={`nav-item-${item.id}`} onClick={() => handleNav(item.id)} className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all text-left cursor-pointer ${isActive ? 'font-extrabold shadow-sm' : 'hover:bg-white/10'}`} style={isActive ? {backgroundColor: layoutConfig.sidebarActiveBgColor || '#344125',color: layoutConfig.sidebarActiveTextColor || '#ffffff',borderLeft: `3px solid ${layoutConfig.sidebarActiveBorderColor || '#aeb7b2'}`,paddingLeft: '0.75rem'} : { color: layoutConfig.sidebarTextColor || '#f8fafc' }}><div className="flex items-center gap-3">{renderNavIcon(item.id, Icon, item.emoji, isActive)}<span>{item.label}</span></div></button>;
          });
        })()}
      </nav>

      <div id="sidebar-user-footer" style={{backgroundColor: layoutConfig.sidebarHeaderBgColor || '#03271f',borderColor: layoutConfig.sidebarDividerColor || '#365349'}} className="p-4 border-t space-y-2">
        {isVisitor ? <button id="bottom-access-portal-btn" type="button" onClick={() => handleNav('acessar-portal')} className="w-full flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-slate-100 px-3 py-2.5 text-xs font-black uppercase tracking-wide text-slate-800 shadow-sm hover:bg-white transition-colors"><LogIn className="w-4 h-4" />Entrar no Portal</button> : <><div className="text-[10px] font-bold uppercase tracking-widest" style={{ color: sidebarFooterMutedColor }}>{layoutConfig.sidebarSessionLabel || 'Sessão ativa'}</div><div className="text-xs font-semibold break-all" style={{ color: sidebarFooterTextColor }} title={userEmail}>{userEmail}</div></>}
        <div className="text-[10px] whitespace-normal leading-4 text-center" style={{ color: sidebarFooterMutedColor }} title={accessLocation}>{accessLocation}</div>
        <div className="text-[9px] font-medium tracking-wide text-center" style={{ color: sidebarFooterMutedColor }} title={runtimeBuild.commit ? `Commit ${runtimeBuild.commit}` : undefined}>Versão do sistema: v{runtimeBuild.version}{runtimeBuild.commit ? ` · ${runtimeBuild.commit}` : ''}</div>
      </div>
    </aside>
  </>;
};
