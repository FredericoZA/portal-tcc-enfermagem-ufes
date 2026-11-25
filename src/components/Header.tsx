import { NursingEmblemLogo } from './NursingEmblemLogo';
import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Menu, Shield, User } from 'lucide-react';
import { loadSiteLayoutConfig, SITE_LAYOUT_EVENT, SiteLayoutConfig } from '../utils/siteLayoutConfig';
import { resolveInstallationProfile } from '../utils/installationProfile';
import { NotificationBell } from './NotificationBell';
import { SiteZoomControls } from './SiteZoomControls';
import { apiClient } from '../services/apiClient';
import { PORTAL_THEME } from '../theme/portalTheme';

interface HeaderProps {
  onOpenMobileSidebar: () => void;
  isMobileSidebarOpen: boolean;
  onGoHome?: () => void;
  title?: string;
}

const PUBLIC_VISITOR_SUFFIX = '@publico.local';

export const Header: React.FC<HeaderProps> = ({ onOpenMobileSidebar, isMobileSidebarOpen, onGoHome }) => {
  const { userEmail, globalRoles, settings, viewingAccount } = useAuth();
  const [accounts, setAccounts] = useState<{ email: string; name: string }[] | null>(null);
  const [accountError, setAccountError] = useState('');
  const [accountBusy, setAccountBusy] = useState(false);
  const changeAccount = async (email: string | null) => {
    setAccountError('');
    setAccountBusy(true);
    try {
      await apiClient.setAccountView(email);
      sessionStorage.removeItem('portal_tcc_identity_cache_v1');
      window.location.assign(window.location.pathname);
    } catch (error) {
      setAccountError(error instanceof Error ? error.message : 'Não foi possível trocar a visualização.');
      setAccountBusy(false);
    }
  };
  const installationProfile = resolveInstallationProfile(settings);
  const [layoutConfig, setLayoutConfig] = useState<SiteLayoutConfig>(loadSiteLayoutConfig());

  useEffect(() => {
    const handleLayoutChange = (e: Event) => {
      const customEvent = e as CustomEvent<SiteLayoutConfig>;
      if (customEvent.detail) setLayoutConfig(customEvent.detail);
      else setLayoutConfig(loadSiteLayoutConfig());
    };
    window.addEventListener(SITE_LAYOUT_EVENT, handleLayoutChange);
    return () => window.removeEventListener(SITE_LAYOUT_EVENT, handleLayoutChange);
  }, []);

  const headerStyle: React.CSSProperties = {
    backgroundColor: layoutConfig.headerBgColor || PORTAL_THEME.brand.headerInstitution,
    ...(layoutConfig.headerBgImage ? { backgroundImage: `url(${layoutConfig.headerBgImage})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}),
  };
  const headerLogo = String(layoutConfig.headerCustomLogoUrl || '');
  const normalizedEmail = String(userEmail || '').trim().toLowerCase();
  const isPublicVisitor = !normalizedEmail || normalizedEmail.endsWith(PUBLIC_VISITOR_SUFFIX);
  const showAuthenticatedIdentity = !isPublicVisitor;
  const isMaster = globalRoles.includes('MASTER_ADMIN');
  const isCommissionPresident = globalRoles.includes('COMMISSION_PRESIDENT');
  const accessLabel = isMaster
    ? 'Usuário Master'
    : isCommissionPresident
      ? 'Presidente da Comissão'
      : 'Acesso pelo e-mail';

  return (
    <header id="portal-header" className="border-b border-slate-200 shadow-2xs sticky top-0 z-30 transition-colors" style={headerStyle}>
      <div className="w-full px-6 py-1.5 sm:py-2 flex flex-wrap items-center justify-between gap-3">
        <div className="flex w-full min-w-0 items-center gap-3 xl:w-auto">
          <button id="open-mobile-sidebar-btn" type="button" onClick={onOpenMobileSidebar} className="lg:hidden p-2 rounded-full text-slate-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current" aria-label="Abrir menu" aria-controls="portal-sidebar" aria-expanded={isMobileSidebarOpen}><Menu className="w-6 h-6" /></button>
          <div className="flex min-w-0 items-center gap-2">
            <NursingEmblemLogo size={40} customSrc={/UFES|Universidade Federal do Esp[íi]rito Santo/iu.test(installationProfile.institutionName)?'/ufes-crest.png':headerLogo||'/ufes-crest.png'} />
            <button type="button" onClick={onGoHome} className="text-left focus:outline-none cursor-pointer" title="Voltar ao Calendário Público Inicial">
              <div className="text-[9px] sm:text-[10px] font-extrabold normal-case tracking-widest leading-none mb-1" style={{ color: PORTAL_THEME.text.dark }}>{layoutConfig.headerInstitutionText || installationProfile.institutionName}</div>
              <h1 className="text-[11px] sm:text-xs md:text-sm font-black tracking-tight normal-case leading-snug flex items-center gap-1.5" style={{ color: PORTAL_THEME.brand.header }}><span>{layoutConfig.headerCourseTitle || `${installationProfile.courseName} · CCS/UFES`}</span></h1>
            </button>
          </div>
        </div>

        {showAuthenticatedIdentity && (
          <div className="flex w-full max-w-full flex-wrap items-center justify-end gap-2 xl:w-auto">
            {layoutConfig.headerShowRoleBadges && (isMaster ? (
              <span id="role-badge-master" className="inline-flex h-8 shrink-0 items-center gap-1 whitespace-nowrap bg-red-700 text-white border border-red-800 text-[10px] px-2.5 py-0 rounded-full font-bold normal-case tracking-wider">
                <Shield className="w-3.5 h-3.5 text-white" />Usuário Master
              </span>
            ) : isCommissionPresident ? (
              <span id="role-badge-coord" className="inline-flex h-8 shrink-0 items-center gap-1 whitespace-nowrap bg-red-700 text-white border border-red-800 text-[10px] px-2.5 py-0 rounded-full font-bold normal-case tracking-wider">
                <Shield className="w-3.5 h-3.5 text-white" />Presidente da Comissão
              </span>
            ) : null)}
            <SiteZoomControls />

            <div id="user-profile-summary" className="flex min-w-0 items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3.5 py-1.5">
              <User className="h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />
              {isMaster && !viewingAccount && accounts ? (
                <select className="portal-input max-w-[250px]" aria-label="Conta para visualizar" value="" disabled={accountBusy} onChange={e => { if (e.target.value) void changeAccount(e.target.value); }}>
                  <option value="">Selecionar conta para consulta</option>
                  {[...accounts].sort((a,b) => a.name.localeCompare(b.name,'pt-BR')).map(account =>
                    <option key={account.email} value={account.email}>{account.name} ({account.email})</option>)}
                </select>
              ) : isMaster && !viewingAccount ? (
                <button type="button" className="text-left text-xs" aria-label="Visualizar outra conta do Portal" onClick={() => {
                  setAccountError('');
                  void apiClient.getAccountViewTargets().then(setAccounts).catch(() => setAccountError('Não foi possível carregar as contas.'));
                }}>
                  <span className="block max-w-[180px] truncate font-bold text-slate-900" title={userEmail}>{userEmail}</span>
                  <span className="font-semibold text-emerald-700">Visualizar outra conta</span>
                </button>
              ) : <div className="text-xs">
                <div className="max-w-[180px] truncate font-bold text-slate-900" title={userEmail}>{userEmail}</div>
                <div className="text-[10px] font-bold normal-case tracking-wider text-emerald-700">{accessLabel}</div>
              </div>}
            </div>
            {viewingAccount && <div className="flex flex-wrap items-center gap-2">
              <span role="status" className="text-xs font-semibold">Consulta como {viewingAccount}</span>
              <button type="button" className="portal-action" disabled={accountBusy} onClick={() => void changeAccount(null)}>Voltar à visão Master</button>
            </div>}
            {accountError && <span role="alert" className="text-xs text-red-800">{accountError}</span>}
            <NotificationBell key={normalizedEmail} />
          </div>
        )}
      </div>
    </header>
  );
};
