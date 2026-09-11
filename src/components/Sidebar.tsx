import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { NursingEmblemLogo } from './NursingEmblemLogo';
import {
  Calendar,
  FileText,
  Award,
  Settings,
  ChevronLeft,
  BookOpen,
  HelpCircle,
  GraduationCap
} from 'lucide-react';
import { ShieldCheck } from 'lucide-react';
import { loadSiteLayoutConfig, SITE_LAYOUT_EVENT, SiteLayoutConfig } from '../utils/siteLayoutConfig';
import { resolveInstallationProfile } from '../utils/installationProfile';

interface SidebarProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  isOpenMobile: boolean;
  setIsOpenMobile: (open: boolean) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  setCurrentTab,
  isOpenMobile,
  setIsOpenMobile
}) => {
  const { isMasterAdmin, isAuthenticated, settings, userEmail } = useAuth();
  const installationProfile=resolveInstallationProfile(settings);
  const configuredLogo=settings?.integrationStudio?.brandKit?.courseLogoUrl||settings?.integrationStudio?.brandKit?.universityLogoUrl||'';
  const isVisitor = !isAuthenticated;

  const isCollapsed = false;
  const [isHovered, setIsHovered] = React.useState<boolean>(false);
  const [layoutConfig, setLayoutConfig] = useState<SiteLayoutConfig>(loadSiteLayoutConfig());
  const accessLocation = layoutConfig.sidebarLocationText || installationProfile.city;

  useEffect(() => {
    const handleLayoutChange = (e: Event) => {
      const customEvent = e as CustomEvent<SiteLayoutConfig>;
      if (customEvent.detail) {
        setLayoutConfig(customEvent.detail);
      } else {
        setLayoutConfig(loadSiteLayoutConfig());
      }
    };

    window.addEventListener(SITE_LAYOUT_EVENT, handleLayoutChange);
    return () => {
      window.removeEventListener(SITE_LAYOUT_EVENT, handleLayoutChange);
    };
  }, []);

  const handleNav = (tab: string) => {
    if (tab === 'meus-processos' && isVisitor) {
      setCurrentTab('home');
      setTimeout(() => {
        const btn = document.getElementById('open-login-modal-btn') || document.getElementById('bottom-access-portal-btn');
        if (btn) btn.click();
      }, 80);
      return;
    }
    setCurrentTab(tab);
    setIsOpenMobile(false);
  };

  const isColorLight = (hex?: string) => {
    if (!hex) return false;
    if (hex === '#ffffff' || hex === '#f8fafc' || hex === '#f1f5f9' || hex === '#e2e8f0' || hex === '#f0fdf4' || hex === '#e0f2fe' || hex === '#fefce8' || hex === '#fff1f2') return true;
    const clean = hex.replace('#', '');
    if (clean.length === 6) {
      const r = parseInt(clean.substring(0, 2), 16);
      const g = parseInt(clean.substring(2, 4), 16);
      const b = parseInt(clean.substring(4, 6), 16);
      const brightness = (r * 299 + g * 587 + b * 114) / 1000;
      return brightness > 140;
    }
    return false;
  };

  const isHeaderLight = isColorLight(layoutConfig.sidebarHeaderBgColor || '#011812');
  const sidebarHeaderTitleColor = layoutConfig.sidebarTitleColor || (isHeaderLight ? '#0f172a' : '#ffffff');
  const sidebarFooterTextColor = isHeaderLight ? '#0f172a' : '#ffffff';
  const sidebarFooterMutedColor = isHeaderLight ? '#64748b' : '#94a3b8';

  const getNavLabel = (id: string, fallback: string) => {
    return layoutConfig.sidebarNavLabels?.[id] || fallback;
  };

  const getNavEmoji = (id: string, fallback: string) => {
    return layoutConfig.sidebarNavEmojis?.[id] || fallback;
  };

  const renderNavIcon = (id: string, Icon: React.ComponentType<{ className?: string }>, defaultEmoji: string, isActive: boolean) => {
    const rawEmoji = getNavEmoji(id, defaultEmoji);
    // Ensure we don't accidentally display double emojis if stored string has duplicates
    const emoji = Array.from(rawEmoji || '')[0] || defaultEmoji;
    const mode = layoutConfig.sidebarIconMode || 'emoji';

    if (mode === 'lucide') {
      return <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-[#7bc394]' : 'text-slate-300'}`} />;
    }
    // Default: 'emoji' (only a single clean emoticon)
    return <span className="text-base shrink-0 leading-none">{emoji}</span>;
  };

  const navItems = [
    { id: 'home', label: getNavLabel('home', 'Calendário'), icon: Calendar, emoji: '📅', visible: true },
    { id: 'biblioteca', label: getNavLabel('biblioteca', 'Repositório'), icon: BookOpen, emoji: '📚', visible: true },
    { id: 'tutorial', label: getNavLabel('tutorial', 'Tutorial'), icon: HelpCircle, emoji: '📖', visible: true },
    { id: 'acessar-portal', label: getNavLabel('acessar-portal', 'Acessar Portal'), icon: FileText, emoji: '🔑', visible: isVisitor },
    { id: 'meus-processos', label: getNavLabel('meus-processos', 'Meus TCCs'), icon: FileText, emoji: '📋', visible: !isVisitor },
    { id: 'coordenador', label: getNavLabel('coordenador', 'Área do Presidente'), icon: Award, emoji: '🏛️', visible: isMasterAdmin && !isVisitor },
    { id: 'assinaturas', label: getNavLabel('assinaturas', 'Assinaturas'), icon: ShieldCheck, emoji: '🔐', visible: isMasterAdmin && !isVisitor },
    { id: 'configuracoes', label: getNavLabel('configuracoes', 'Configurações'), icon: Settings, emoji: '⚙️', visible: isMasterAdmin && !isVisitor }
  ];

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpenMobile && (
        <div
          id="sidebar-mobile-backdrop"
          className="fixed inset-0 bg-slate-900/60 z-40 lg:hidden backdrop-blur-xs"
          onClick={() => setIsOpenMobile(false)}
        />
      )}

      {/* Hover Trigger Zone for Desktop when Collapsed */}
      {isCollapsed && (
        <div
          id="sidebar-hover-trigger"
          className="hidden lg:flex fixed left-0 top-0 bottom-0 w-3 z-45 bg-slate-200/40 hover:bg-emerald-600/10 border-r border-slate-300/30 hover:border-emerald-500/50 items-center justify-center transition-all duration-150 cursor-pointer group"
          onMouseEnter={() => setIsHovered(true)}
          title="Passe o mouse aqui para abrir o menu lateral"
        >
          <ChevronLeft className="w-3.5 h-3.5 text-slate-500 opacity-0 group-hover:opacity-100 rotate-180 transition-opacity duration-150" />
        </div>
      )}

      {/* Outer Layout Spacer for Desktop to push/not-push content */}
      <div
        id="sidebar-layout-spacer"
        className={`hidden lg:block transition-all duration-300 ease-in-out shrink-0 overflow-hidden ${
          isCollapsed ? 'w-0' : 'w-64'
        }`}
      />

      {/* Sidebar Drawer Container */}
      <aside
        id="portal-sidebar"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        style={{
          backgroundColor: layoutConfig.sidebarBgColor || '#011f17',
          borderColor: layoutConfig.sidebarDividerColor || '#033628',
          color: layoutConfig.sidebarTextColor || '#e2e8f0',
        }}
        className={`fixed top-0 bottom-0 left-0 z-50 w-64 text-slate-100 flex flex-col border-r transition-all duration-300 ease-in-out ${
          isOpenMobile ? 'translate-x-0' : '-translate-x-full'
        } ${
          isCollapsed
            ? isHovered
              ? 'lg:translate-x-0 lg:shadow-2xl'
              : 'lg:-translate-x-full'
            : 'lg:translate-x-0'
        }`}
      >
        {/* Institutional Branding Header (Clickable to Home) */}
        <div
          style={{
            backgroundColor: layoutConfig.sidebarHeaderBgColor || '#011812',
            borderColor: layoutConfig.sidebarDividerColor || '#033628',
          }}
          className="p-4 sm:p-5 border-b flex items-center justify-between relative group"
        >
          <button
            type="button"
            onClick={() => handleNav('home')}
            className="flex items-center gap-3 text-left hover:opacity-90 transition-opacity focus:outline-none cursor-pointer flex-1 min-w-0"
            title="Ir para o Calendário Público Inicial"
          >
            {layoutConfig.sidebarLogoType === 'custom' && layoutConfig.sidebarCustomLogoUrl ? (
              <img
                src={layoutConfig.sidebarCustomLogoUrl}
                alt="Logo"
                className="w-14 h-14 object-contain shrink-0 rounded-md"
              />
            ) : (
              <NursingEmblemLogo size={60} className="shrink-0" customSrc={configuredLogo} />
            )}

            <div className="text-center flex flex-col items-center flex-1 min-w-0 pr-1">
              <h1
                className="font-black text-base sm:text-lg tracking-tight uppercase leading-tight text-center truncate w-full"
                style={{ color: sidebarHeaderTitleColor }}
              >
                {layoutConfig.sidebarTitle || installationProfile.portalName}
              </h1>
              <p
                className="text-[11.5px] sm:text-[12px] font-extrabold tracking-widest uppercase mt-0.5 text-center truncate w-full"
                style={{ color: layoutConfig.sidebarSubtitleColor || (isHeaderLight ? '#047857' : '#7bc394') }}
              >
                {layoutConfig.sidebarSubtitle || `${installationProfile.courseName} • ${installationProfile.institutionAcronym || installationProfile.institutionName}`}
              </p>
            </div>
          </button>
          
          {/* Close Button for Mobile */}
          <button
            id="close-mobile-sidebar-btn"
            onClick={() => setIsOpenMobile(false)}
            className="lg:hidden text-slate-300 hover:text-white p-1"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Menu */}
        <nav id="sidebar-nav" className="flex-1 p-3 space-y-1.5 overflow-y-auto">
          {(() => {
            const allNavMap: Record<string, { id: string; label: string; icon: React.ComponentType<{ className?: string }>; emoji: string; visible: boolean }> = {
              home: { id: 'home', label: getNavLabel('home', 'Calendário'), icon: Calendar, emoji: '📅', visible: true },
              biblioteca: { id: 'biblioteca', label: getNavLabel('biblioteca', 'Repositório'), icon: BookOpen, emoji: '📚', visible: true },
              tutorial: { id: 'tutorial', label: getNavLabel('tutorial', 'Tutorial'), icon: HelpCircle, emoji: '📖', visible: true },
              'acessar-portal': { id: 'acessar-portal', label: getNavLabel('acessar-portal', 'Acessar Portal'), icon: FileText, emoji: '🔑', visible: isVisitor },
              'meus-processos': { id: 'meus-processos', label: getNavLabel('meus-processos', 'Meus TCCs'), icon: FileText, emoji: '📋', visible: !isVisitor },
              coordenador: { id: 'coordenador', label: getNavLabel('coordenador', 'Área do Presidente'), icon: Award, emoji: '🏛️', visible: isMasterAdmin && !isVisitor },
              assinaturas: { id: 'assinaturas', label: getNavLabel('assinaturas', 'Assinaturas'), icon: ShieldCheck, emoji: '🔐', visible: isMasterAdmin && !isVisitor },
              configuracoes: { id: 'configuracoes', label: getNavLabel('configuracoes', 'Configurações'), icon: Settings, emoji: '⚙️', visible: isMasterAdmin && !isVisitor }
            };

            const configuredOrder = layoutConfig.sidebarNavOrder && layoutConfig.sidebarNavOrder.length > 0
              ? layoutConfig.sidebarNavOrder
              : ['home', 'biblioteca', 'DIVIDER_1', 'meus-processos', 'coordenador', 'assinaturas', 'configuracoes', 'DIVIDER_2', 'tutorial'];
            const order = configuredOrder.includes('assinaturas') ? configuredOrder : configuredOrder.flatMap(item=>item==='configuracoes'?['assinaturas',item]:[item]);

            return order.map((itemKey, idx) => {
              if (itemKey.startsWith('DIVIDER')) {
                if (layoutConfig.sidebarShowDividers === false || layoutConfig.sidebarDividerStyle === 'none') {
                  return null;
                }
                return (
                  <div
                    key={`${itemKey}-${idx}`}
                    className="my-2.5 pt-0.5 border-t transition-colors"
                    style={{
                      borderColor: layoutConfig.sidebarDividerColor || '#033628',
                      borderStyle: layoutConfig.sidebarDividerStyle || 'solid',
                    }}
                  />
                );
              }

              const item = allNavMap[itemKey];
              if (!item || !item.visible) return null;

              const Icon = item.icon;
              const isActive = currentTab === item.id || (item.id === 'home' && currentTab === 'calendario');

              return (
                <button
                  key={item.id}
                  id={`nav-item-${item.id}`}
                  onClick={() => handleNav(item.id)}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-full font-bold text-xs uppercase tracking-wider transition-all text-left cursor-pointer ${
                    isActive ? 'font-extrabold shadow-2xs' : 'hover:bg-black/15'
                  }`}
                  style={
                    isActive
                      ? {
                          backgroundColor: layoutConfig.sidebarActiveBgColor || '#033d2e',
                          color: layoutConfig.sidebarActiveTextColor || '#a4ebd4',
                          borderLeft: `3px solid ${layoutConfig.sidebarActiveBorderColor || '#7bc394'}`,
                          paddingLeft: '0.75rem',
                        }
                      : {
                          color: layoutConfig.sidebarTextColor || '#e2e8f0',
                        }
                  }
                >
                  <div className="flex items-center gap-3">
                    {renderNavIcon(item.id, Icon, item.emoji, isActive)}
                    <span>{item.label}</span>
                  </div>
                </button>
              );
            });
          })()}
        </nav>

        {/* User Footer Card */}
        <div
          id="sidebar-user-footer"
          style={{
            backgroundColor: layoutConfig.sidebarHeaderBgColor || '#011812',
            borderColor: layoutConfig.sidebarDividerColor || '#033628',
          }}
          className="p-4 border-t space-y-1"
        >
          <div
            className="text-[10px] font-bold uppercase tracking-widest"
            style={{ color: sidebarFooterMutedColor }}
          >
            {layoutConfig.sidebarSessionLabel || 'Sessão Ativa:'}
          </div>
          <div
            className="text-xs font-semibold truncate"
            style={{ color: sidebarFooterTextColor }}
            title={userEmail}
          >
            {userEmail}
          </div>
          <div
            className="text-[10px] truncate"
            style={{ color: sidebarFooterMutedColor }}
            title={accessLocation}
          >
            {accessLocation}
          </div>
        </div>
      </aside>
    </>
  );
};
