import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Menu, Shield, User, Building2 } from 'lucide-react';
import { NursingEmblemLogo } from './NursingEmblemLogo';
import { loadSiteLayoutConfig, SITE_LAYOUT_EVENT, SiteLayoutConfig } from '../utils/siteLayoutConfig';
import { resolveInstallationProfile } from '../utils/installationProfile';
import { NotificationBell } from './NotificationBell';

interface HeaderProps {
  onOpenMobileSidebar: () => void;
  onGoHome?: () => void;
  title?: string;
}

export const Header: React.FC<HeaderProps> = ({ onOpenMobileSidebar, onGoHome, title }) => {
  const { userEmail, globalRoles, memberships, settings } = useAuth();
  const installationProfile=resolveInstallationProfile(settings);
  const configuredLogo=settings?.integrationStudio?.brandKit?.courseLogoUrl||settings?.integrationStudio?.brandKit?.universityLogoUrl||'';
  const [layoutConfig, setLayoutConfig] = useState<SiteLayoutConfig>(loadSiteLayoutConfig());

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

  const headerStyle: React.CSSProperties = {
    backgroundColor: layoutConfig.headerBgColor || '#ffffff',
    ...(layoutConfig.headerBgImage
      ? {
          backgroundImage: `url(${layoutConfig.headerBgImage})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }
      : {}),
  };

  return (
    <header
      id="portal-header"
      className="border-b border-slate-200 shadow-2xs sticky top-0 z-30 transition-colors"
      style={headerStyle}
    >
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-1.5 sm:py-2 flex items-center justify-between gap-3">
        
        {/* Left: Mobile Menu Trigger & Title */}
        <div className="flex items-center gap-3">
          <button
            id="open-mobile-sidebar-btn"
            onClick={onOpenMobileSidebar}
            className="lg:hidden p-2 rounded-full text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus:outline-none"
            aria-label="Abrir menu"
          >
            <Menu className="w-6 h-6" />
          </button>

          <div className="flex items-center gap-2">
            {layoutConfig.headerCustomLogoUrl ? (
              <img
                src={layoutConfig.headerCustomLogoUrl}
                alt="Logo do Cabeçalho"
                className="w-8 h-8 sm:w-9 sm:h-9 object-contain shrink-0 rounded-md"
              />
            ) : layoutConfig.headerShowEmblem ? (
              <NursingEmblemLogo size={34} className="shrink-0" customSrc={configuredLogo} />
            ) : null}

            <button
              type="button"
              onClick={onGoHome}
              className="text-left hover:opacity-90 transition-opacity focus:outline-none cursor-pointer"
              title="Voltar ao Calendário Público Inicial"
            >
              <div
                className="text-[9px] sm:text-[10px] font-extrabold uppercase tracking-widest leading-none mb-1"
                style={{ color: layoutConfig.headerTextColor || '#047857' }}
              >
                {layoutConfig.headerInstitutionText || installationProfile.institutionName}
              </div>
              <h1
                className="text-[11px] sm:text-xs md:text-sm font-black tracking-tight uppercase leading-snug flex items-center gap-1.5"
                style={{ color: layoutConfig.headerTitleColor || '#0f172a' }}
              >
                {!layoutConfig.headerCustomLogoUrl && !layoutConfig.headerShowEmblem && (
                  <Building2 className="w-4 h-4 text-emerald-700 shrink-0" />
                )}
                <span>{layoutConfig.headerCourseTitle || installationProfile.courseName}</span>
              </h1>
              {title&&<div className="mt-0.5 truncate text-[10px] font-semibold text-slate-500" aria-current="page">{title}</div>}
            </button>
          </div>
        </div>

        {/* Right: User Status Badges */}
        <div className="hidden md:flex items-center gap-2">
          {userEmail && <NotificationBell />}
          {layoutConfig.headerShowRoleBadges && (
            globalRoles.includes('MASTER_ADMIN') ? (
              <span id="role-badge-master" className="inline-flex items-center gap-1 bg-amber-100 text-amber-950 border border-amber-300 text-[10px] px-2.5 py-1 rounded-full font-bold uppercase tracking-wider">
                <Shield className="w-3.5 h-3.5 text-amber-800" />
                Master Admin
              </span>
            ) : globalRoles.includes('COMMISSION_PRESIDENT') ? (
              <span id="role-badge-coord" className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-900 border border-emerald-300 text-[10px] px-2.5 py-1 rounded-full font-bold uppercase tracking-wider">
                <NursingEmblemLogo size={14} customSrc={configuredLogo} />
                Presidente da Comissão
              </span>
            ) : null
          )}

          <div id="user-profile-summary" className="flex items-center gap-2 bg-slate-50 px-3.5 py-1.5 rounded-full border border-slate-200">
            <User className="w-4 h-4 text-slate-500" />
            <div className="text-xs">
              <div className="font-bold text-slate-900 truncate max-w-[180px]" title={userEmail}>
                {userEmail}
              </div>
              <div className="text-[10px] text-emerald-700 font-bold uppercase tracking-wider">
                {memberships.length > 0
                  ? `${memberships.length} trabalho(s) de TCC`
                  : 'Acesso Institucional'}
              </div>
            </div>
          </div>
        </div>

      </div>
    </header>
  );
};
