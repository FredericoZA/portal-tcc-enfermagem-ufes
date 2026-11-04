import {sanitizeTablePreference,validTableKey,TABLE_DEFAULTS_EVENT} from '../utils/tablePreferences';
import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { PORTAL_LIVE_UPDATE_EVENT } from '../utils/portalLiveEvents';
import { GlobalRole, ProcessMembership, GlobalSettings } from '../types';
import { apiClient, ApiRequestError, setActiveUserEmail, getActiveUserEmail, invalidateIdentityRequests, PORTAL_SESSION_EXPIRED_EVENT } from '../services/apiClient';
import { loadSiteLayoutConfig } from '../utils/siteLayoutConfig';

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
const AUTH_CACHE_MAX_AGE_MS = 3 * 60 * 60 * 1000;
const SESSION_ACTIVITY_TOUCH_INTERVAL_MS = 60 * 1000;

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
  const href = String(siteConfig?.sidebarCustomLogoUrl || '/ufes-crest.png').trim() || '/ufes-crest.png';
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
  // Respostas anteriores a uma saída/troca de conta não pertencem à sessão atual.
  const identityRevision = useRef(0);

  const applyPublicSettings = (rawSettings: GlobalSettings) => {
    // A aparência do Portal é definida pelo código. Configurações visuais antigas
    // permanecem apenas como histórico persistido e não são reaplicadas ao navegador.
    let layoutsChanged = false;
    for (const [key, value] of Object.entries(rawSettings.tableLayouts || {})) {
      if (!validTableKey(key)) continue;
      try {
        const serialized = JSON.stringify(sanitizeTablePreference(value));
        const storageKey = `default_table_config_${key}`;
        if (localStorage.getItem(storageKey) !== serialized) { localStorage.setItem(storageKey, serialized); layoutsChanged = true; }
      } catch { /* A broken old preference must not stop authentication. */ }
    }
    setSettings(rawSettings);
    if (layoutsChanged) window.dispatchEvent(new Event(TABLE_DEFAULTS_EVENT));
    syncPortalFavicon(loadSiteLayoutConfig());
    if(rawSettings.integrationStudio?.operationsPolicy&&typeof document!=='undefined'){const policy=rawSettings.integrationStudio.operationsPolicy;document.documentElement.lang=policy.defaultLocale||'pt-BR';document.documentElement.style.setProperty('--portal-target-size',`${policy.accessibility?.minimumTargetSize||44}px`);document.documentElement.dataset.portalMotion=policy.accessibility?.reducedMotionByDefault?'reduced':'system';}
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

  useEffect(()=>{
    const expired=()=>{identityRevision.current+=1;clearIdentity();setIsLoading(false);};
    window.addEventListener(PORTAL_SESSION_EXPIRED_EVENT,expired);
    return()=>window.removeEventListener(PORTAL_SESSION_EXPIRED_EVENT,expired);
  },[]);

  const refreshAuth=async()=>{
    const revision=++identityRevision.current;
    const isCurrent=()=>identityRevision.current===revision;
    setIsLoading(true);
    const settingsTask=apiClient.getSettings().then(value=>{if(isCurrent())applyPublicSettings(value);}).catch(err=>{if(!isCurrent())return;console.error('Erro ao carregar configurações públicas do portal:',err);syncPortalFavicon(loadSiteLayoutConfig());});
    const identityTask=getIdentityWithRetry().then(value=>{if(isCurrent())applyIdentity(value);}).catch(err=>{
      if(!isCurrent())return;
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
    await Promise.allSettled([settingsTask,identityTask]);if(isCurrent())setIsLoading(false);
  };

  useEffect(() => {
    void refreshAuth();
  }, []);

  useEffect(()=>{
    let active=true;
    const update=()=>{
      // Não ativa o estado de carregamento: mantém a tela e os rascunhos abertos.
      void apiClient.getSettings().then(data=>{if(active)applyPublicSettings(data);}).catch(()=>undefined);
      if(isAuthenticated)void apiClient.getMe().then(data=>{if(active)applyIdentity(data);}).catch(()=>undefined);
    };
    window.addEventListener(PORTAL_LIVE_UPDATE_EVENT,update);
    return ()=>{active=false;window.removeEventListener(PORTAL_LIVE_UPDATE_EVENT,update);};
  },[isAuthenticated]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const recoverAfterReconnect = () => { void refreshAuth(); };
    const synchronizeTabs = (event: StorageEvent) => {
      if (event.key !== 'portal_tcc_active_email') return;
      invalidateIdentityRequests();
      identityRevision.current+=1;
      clearIdentity();
      setSettings(null);
      void refreshAuth();
    };
    syncPortalFavicon(loadSiteLayoutConfig());
    window.addEventListener('online', recoverAfterReconnect);
    window.addEventListener('storage', synchronizeTabs);
    return () => {
      window.removeEventListener('online', recoverAfterReconnect);
      window.removeEventListener('storage', synchronizeTabs);
    };
  }, []);

  useEffect(() => {
    if (!isAuthenticated || typeof window === 'undefined') return;
    let lastTouchAt = 0;
    let touchInFlight = false;
    let active = true;

    const touchSession = () => {
      const now = Date.now();
      if (touchInFlight || now - lastTouchAt < SESSION_ACTIVITY_TOUCH_INTERVAL_MS) return;
      lastTouchAt = now;
      touchInFlight = true;
      const revision=identityRevision.current;
      void apiClient.getMe()
        .then(value=>{if(active&&revision===identityRevision.current)applyIdentity(value);})
        .catch(error => {if(active&&revision===identityRevision.current&&error instanceof ApiRequestError&&error.status===401)clearIdentity();})
        .finally(() => { touchInFlight = false; });
    };

    const activityEvents: Array<keyof WindowEventMap> = ['pointerdown', 'keydown', 'touchstart', 'wheel', 'focus'];
    activityEvents.forEach(eventName => window.addEventListener(eventName, touchSession, { passive: true }));
    return () => {active=false;activityEvents.forEach(eventName => window.removeEventListener(eventName, touchSession));};
  }, [isAuthenticated,userEmail]);

  const switchUser = async (email: string) => {
    identityRevision.current+=1;
    clearIdentity();
    setSettings(null);
    setActiveUserEmail(email);
    await refreshAuth();
  };

  const hasAdvisorRole = memberships.some((m) => m.roles.includes('ADVISOR'));
  const isCommissionPresident = globalRoles.includes('COMMISSION_PRESIDENT');
  const isMasterAdmin = globalRoles.includes('MASTER_ADMIN');
  const logout=async()=>{
    await apiClient.logout();
    identityRevision.current+=1;
    setActiveUserEmail('');
    clearIdentity();
    setSettings(null);
    // O retorno à área pública não depende da latência de outra leitura do banco.
    void refreshAuth();
  };

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
