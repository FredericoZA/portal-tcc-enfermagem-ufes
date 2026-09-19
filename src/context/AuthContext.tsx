import React, { createContext, useContext, useState, useEffect } from 'react';
import { normalizeUnifiedAppearance } from '../utils/unifiedAppearance';
import { saveGlobalPopupStyle } from '../utils/portalAppearanceLinks';
import { GlobalRole, ProcessMembership, GlobalSettings } from '../types';
import { apiClient, ApiRequestError, setActiveUserEmail, getActiveUserEmail } from '../services/apiClient';
import { saveGlobalTableConfig } from '../utils/tableFormatters';
import { loadSiteLayoutConfig, saveSiteLayoutConfig, SITE_LAYOUT_EVENT } from '../utils/siteLayoutConfig';
import { saveCalendarPopupConfig } from '../utils/calendarPopupConfig';
import { saveTccDetailPopupFormat } from '../types/tccDetailFormat';
import { saveLoginPopupConfig } from '../utils/loginPopupConfig';
import { saveGeneralPopupsConfig } from '../components/UnifiedPortalEditorModal';
import {
  TABLE_LAYOUTS_EVENT,
  TABLE_STORAGE_BY_EDITOR_TAB,
  savePortalAppearanceLinks,
  tableInheritsGlobalAppearance,
} from '../utils/portalAppearanceLinks';

interface AuthContextType {
  userEmail: string;
  globalRoles: GlobalRole[];
  memberships: ProcessMembership[];
  settings: GlobalSettings | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  switchUser: (email: string) => Promise<void>;
  refreshAuth: () => Promise<void>;
  hasAdvisorRole: boolean;
  isMasterAdmin: boolean;
  isCommissionPresident: boolean;
  logout: () => Promise<void>;
}

interface CachedPortalIdentity {
  userEmail: string;
  globalRoles: GlobalRole[];
  memberships: ProcessMembership[];
  isAuthenticated: boolean;
  cachedAt: number;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const AUTH_CACHE_KEY = 'portal_tcc_identity_cache_v1';
const AUTH_CACHE_MAX_AGE_MS = 30 * 60 * 1000;

function readCachedIdentity(): CachedPortalIdentity | null {
  if (typeof sessionStorage === 'undefined') return null;
  try {
    const parsed = JSON.parse(sessionStorage.getItem(AUTH_CACHE_KEY) || 'null') as CachedPortalIdentity | null;
    if (!parsed?.isAuthenticated || !parsed.userEmail || Date.now() - Number(parsed.cachedAt || 0) > AUTH_CACHE_MAX_AGE_MS) return null;
    return parsed;
  } catch { return null; }
}

function saveCachedIdentity(identity: Omit<CachedPortalIdentity, 'cachedAt'>) {
  if (typeof sessionStorage === 'undefined') return;
  try { sessionStorage.setItem(AUTH_CACHE_KEY, JSON.stringify({ ...identity, cachedAt: Date.now() })); } catch { /* cache auxiliar */ }
}

function clearCachedIdentity() {
  if (typeof sessionStorage === 'undefined') return;
  try { sessionStorage.removeItem(AUTH_CACHE_KEY); } catch { /* noop */ }
}

async function getIdentityWithRetry() {
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try { return await apiClient.getMe(); }
    catch (error) {
      lastError = error;
      if (error instanceof ApiRequestError && error.status === 401) throw error;
      if (attempt < 2) await new Promise(resolve => setTimeout(resolve, attempt === 0 ? 250 : 750));
    }
  }
  throw lastError;
}

function syncPortalFavicon(siteConfig: any) {
  if (typeof document === 'undefined') return;
  const href = String(siteConfig?.sidebarCustomLogoUrl || '/colenf-logo.png').trim() || '/colenf-logo.png';
  const iconLinks = Array.from(document.querySelectorAll<HTMLLinkElement>('link[rel="icon"], link[rel="shortcut icon"]'));
  if (!iconLinks.length) {
    const icon = document.createElement('link');
    icon.rel = 'icon';
    icon.type = 'image/png';
    document.head.appendChild(icon);
    iconLinks.push(icon);
  }
  iconLinks.forEach((link) => { link.href = href; });
  const appleLinks = Array.from(document.querySelectorAll<HTMLLinkElement>('link[rel="apple-touch-icon"]'));
  appleLinks.forEach((link) => { link.href = href; });
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [userEmail, setUserEmailState] = useState<string>(getActiveUserEmail());
  const [globalRoles, setGlobalRoles] = useState<GlobalRole[]>([]);
  const [memberships, setMemberships] = useState<ProcessMembership[]>([]);
  const [settings, setSettings] = useState<GlobalSettings | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isAuthenticated,setIsAuthenticated]=useState(false);

  const applyPublicSettings = (rawSettings: GlobalSettings) => {
    const settingsRes=normalizeUnifiedAppearance(rawSettings);setSettings(settingsRes);
    if(settingsRes.portalAppearance&&typeof window!=='undefined'){
      const appearance=settingsRes.portalAppearance;
      if(appearance.globalPopupStyle)saveGlobalPopupStyle(appearance.globalPopupStyle);
      const globalTableAppearance=settingsRes.tableAppearance||{};
      if(appearance.linkedItems)savePortalAppearanceLinks(appearance.linkedItems,globalTableAppearance as Record<string,unknown>,false);
      if(settingsRes.tableLayouts){const canonicalLayouts:Record<string,unknown>={};const legacyStorageKeys:Record<string,string>={defesas:'defenses',coordenador:'coordinator'};Object.entries(settingsRes.tableLayouts).forEach(([rawKey,rawLayout])=>{const key=legacyStorageKeys[rawKey]||rawKey;const layout=rawLayout&&typeof rawLayout==='object'?{...(rawLayout as Record<string,unknown>)}:{};if(tableInheritsGlobalAppearance(key))delete (layout as any).textFormat;(layout as any).inheritGlobalAppearance=tableInheritsGlobalAppearance(key);canonicalLayouts[key]=layout;});Object.values(TABLE_STORAGE_BY_EDITOR_TAB).forEach(key=>{const layout=canonicalLayouts[key];if(layout)localStorage.setItem(`default_table_config_${key}`,JSON.stringify(layout));});window.dispatchEvent(new CustomEvent(TABLE_LAYOUTS_EVENT,{detail:canonicalLayouts}));}
      if(appearance.siteConfig){saveSiteLayoutConfig(appearance.siteConfig as any);syncPortalFavicon(appearance.siteConfig);}else syncPortalFavicon(loadSiteLayoutConfig());
      if(appearance.calendarPopup)saveCalendarPopupConfig(appearance.calendarPopup as any);if(appearance.tccDetailPopup)saveTccDetailPopupFormat(appearance.tccDetailPopup as any);if(appearance.loginPopup)saveLoginPopupConfig(appearance.loginPopup as any);if(appearance.generalPopups)saveGeneralPopupsConfig(appearance.generalPopups as any);
    }else syncPortalFavicon(loadSiteLayoutConfig());
    if(settingsRes.tableAppearance)saveGlobalTableConfig(settingsRes.tableAppearance);
    if(settingsRes.integrationStudio?.operationsPolicy&&typeof document!=='undefined'){const policy=settingsRes.integrationStudio.operationsPolicy;document.documentElement.lang=policy.defaultLocale||'pt-BR';document.documentElement.style.setProperty('--portal-target-size',`${policy.accessibility?.minimumTargetSize||44}px`);document.documentElement.dataset.portalMotion=policy.accessibility?.reducedMotionByDefault?'reduced':'system';}
  };

  const applyIdentity = (meRes: { userEmail: string; globalRoles: any[]; memberships: any[]; isAuthenticated: boolean }) => {
    setUserEmailState(meRes.userEmail);
    setIsAuthenticated(meRes.isAuthenticated);
    setGlobalRoles(meRes.globalRoles);
    setMemberships(meRes.memberships);
    if (meRes.isAuthenticated) saveCachedIdentity({
      userEmail: meRes.userEmail,
      globalRoles: meRes.globalRoles,
      memberships: meRes.memberships,
      isAuthenticated: true
    }); else clearCachedIdentity();
  };

  const clearIdentity = () => {
    clearCachedIdentity();
    setUserEmailState('');
    setIsAuthenticated(false);
    setGlobalRoles([]);
    setMemberships([]);
  };

  const refreshAuth=async()=>{
    setIsLoading(true);
    const settingsTask=apiClient.getSettings().then(applyPublicSettings).catch(err=>{console.error('Erro ao carregar aparência pública do portal:',err);syncPortalFavicon(loadSiteLayoutConfig());});
    const identityTask=getIdentityWithRetry().then(applyIdentity).catch(err=>{
      const definitiveUnauthorized = err instanceof ApiRequestError && err.status === 401;
      const cached = definitiveUnauthorized ? null : readCachedIdentity();
      if (cached) {
        console.warn('Falha transitória ao confirmar a sessão; mantendo a identidade em cache até a API responder.', err);
        setUserEmailState(cached.userEmail);
        setIsAuthenticated(true);
        setGlobalRoles(cached.globalRoles);
        setMemberships(cached.memberships);
        return;
      }
      console.warn('Sessão não confirmada; mantendo o Portal em modo público.',err);
      clearIdentity();
    });
    await Promise.allSettled([settingsTask,identityTask]);setIsLoading(false);
  };

  useEffect(() => {
    refreshAuth();
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const syncFromLayout = (event: Event) => syncPortalFavicon((event as CustomEvent).detail || loadSiteLayoutConfig());
    const recoverAfterReconnect = () => { void refreshAuth(); };
    syncPortalFavicon(loadSiteLayoutConfig());
    window.addEventListener(SITE_LAYOUT_EVENT, syncFromLayout);
    window.addEventListener('online', recoverAfterReconnect);
    return () => {
      window.removeEventListener(SITE_LAYOUT_EVENT, syncFromLayout);
      window.removeEventListener('online', recoverAfterReconnect);
    };
  }, []);

  const switchUser = async (email: string) => {
    setActiveUserEmail(email);
    setUserEmailState(email);
    await refreshAuth();
  };

  const hasAdvisorRole = memberships.some((m) => m.roles.includes('ADVISOR'));
  const isCommissionPresident = globalRoles.includes('COMMISSION_PRESIDENT');
  const isMasterAdmin = globalRoles.includes('MASTER_ADMIN');
  const logout=async()=>{await apiClient.logout();setActiveUserEmail('');clearIdentity();await refreshAuth();};

  return (
    <AuthContext.Provider
      value={{
        userEmail,
        globalRoles,
        memberships,
        settings,
        isLoading,
        isAuthenticated,
        switchUser,
        refreshAuth,
        hasAdvisorRole,
        isMasterAdmin,
        isCommissionPresident,
        logout
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve ser usado dentro de AuthProvider');
  }
  return context;
};