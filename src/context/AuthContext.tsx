import {sanitizeTablePreference,validTableKey,TABLE_DEFAULTS_EVENT} from '../utils/tablePreferences';
import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { PORTAL_LIVE_UPDATE_EVENT } from '../utils/portalLiveEvents';
import { GlobalRole, ProcessMembership } from '../types';
import { apiClient, ApiRequestError, setActiveUserEmail, getActiveUserEmail, invalidateIdentityRequests, PORTAL_SESSION_EXPIRED_EVENT } from '../services/apiClient';
import { loadSiteLayoutConfig } from '../utils/siteLayoutConfig';

type PortalSettings = Awaited<ReturnType<typeof apiClient.getSettings>>;

interface AuthContextType {
  userEmail: string;
  globalRoles: GlobalRole[];
  memberships: ProcessMembership[];
  settings: PortalSettings | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  canRegisterProcess: boolean;
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
  canRegisterProcess: boolean;
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

export async function getIdentityWithRetry() {
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try { return await apiClient.getMe(); }
    catch (error) {
      lastError = error;
      if (error instanceof ApiRequestError && error.status >= 400 && error.status < 500 && error.status !== 429) throw error;
      const requestedWait=error instanceof ApiRequestError?error.retryAfterSeconds:undefined;
      // Respect admission/rate-limit backoff instead of immediately returning
      // to the same busy server. Long waits remain a conscious user retry.
      if(requestedWait!==undefined&&requestedWait>30)throw error;
      const waitMs=requestedWait!==undefined?Math.max(0,requestedWait)*1000:attempt===0?250:750;
      if (attempt < 2) await new Promise(resolve => setTimeout(resolve, waitMs));
    }
  }
  throw lastError;
}

/** One bounded recovery for public settings, independent of identity/permissions. */
export async function getPublicSettingsWithRetry(isCurrent:()=>boolean=()=>true):Promise<PortalSettings> {
  try { return await apiClient.getSettings(); }
  catch(error) {
    if(!isCurrent()||!(error instanceof ApiRequestError)||error.code==='REQUEST_CANCELED')throw error;
    const requestedWait=error.retryAfterSeconds;
    if(requestedWait!==undefined&&(!Number.isFinite(requestedWait)||requestedWait<0||requestedWait>30))throw error;
    // getSettings already retries this exact admission failure once internally.
    if(error.status===503&&error.code==='RUNTIME_BUSY'&&requestedWait!==undefined)throw error;
    if(![0,429,502,503,504].includes(error.status))throw error;
    await new Promise(resolve=>setTimeout(resolve,requestedWait===undefined?500:requestedWait*1000));
    if(!isCurrent())throw error;
    return apiClient.getSettings();
  }
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
  const [settings, setSettings] = useState<PortalSettings | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isAuthenticated,setIsAuthenticated]=useState(false);
  const [canRegisterProcess,setCanRegisterProcess]=useState(false);
  // Respostas anteriores a uma saída/troca de conta não pertencem à sessão atual.
  const identityRevision = useRef(0);
  const identityReadSequence = useRef(0);

  const applyPublicSettings = (rawSettings: PortalSettings) => {
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

  const applyIdentity = (meRes: Awaited<ReturnType<typeof apiClient.getMe>>) => {
    setUserEmailState(meRes.userEmail);
    setIsAuthenticated(meRes.isAuthenticated);
    setCanRegisterProcess(meRes.canRegisterProcess===true);
    setGlobalRoles(meRes.globalRoles);
    setMemberships(meRes.memberships);
    if (meRes.isAuthenticated) saveCachedIdentity({
      userEmail: meRes.userEmail,
      globalRoles: meRes.globalRoles,
      memberships: meRes.memberships,
      isAuthenticated: true,
      canRegisterProcess: meRes.canRegisterProcess===true
    }); else clearCachedIdentity();
  };

  const clearIdentity = () => {
    clearCachedIdentity();
    setUserEmailState('');
    setIsAuthenticated(false);
    setCanRegisterProcess(false);
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
    const settingsTask=getPublicSettingsWithRetry(isCurrent).then(value=>{if(isCurrent())applyPublicSettings(value);}).catch(err=>{if(!isCurrent())return;console.error('Erro ao carregar configurações públicas do portal:',err);syncPortalFavicon(loadSiteLayoutConfig());});
    const identitySequence=++identityReadSequence.current;
    const isIdentityCurrent=()=>isCurrent()&&identitySequence===identityReadSequence.current;
    const identityTask=getIdentityWithRetry().then(value=>{if(isIdentityCurrent())applyIdentity(value);}).catch(err=>{
      if(!isIdentityCurrent())return;
      const definitiveUnauthorized = err instanceof ApiRequestError && err.status === 401;
      const cached = definitiveUnauthorized ? null : readCachedIdentity();
      if (cached) {
        console.warn('Falha transitória ao confirmar a sessão; mantendo a identidade em cache até a API responder.', err);
        setUserEmailState(cached.userEmail);
        setIsAuthenticated(true);
        setCanRegisterProcess(cached.canRegisterProcess===true);
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
    let updateSequence=0;
    const update=()=>{
      const sequence=++updateSequence;
      const revision=identityRevision.current;
      const isCurrent=()=>active&&sequence===updateSequence&&revision===identityRevision.current;
      // Não ativa o estado de carregamento: mantém a tela e os rascunhos abertos.
      // Uma resposta antiga não pode restaurar sessão encerrada ou dados anteriores.
      void apiClient.getSettings().then(data=>{if(isCurrent())applyPublicSettings(data);}).catch(()=>undefined);
      if(isAuthenticated){
        const identitySequence=++identityReadSequence.current;
        void apiClient.getMe().then(data=>{if(isCurrent()&&identitySequence===identityReadSequence.current)applyIdentity(data);}).catch(()=>undefined);
      }
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
      const identitySequence=++identityReadSequence.current;
      const isCurrent=()=>active&&revision===identityRevision.current&&identitySequence===identityReadSequence.current;
      void apiClient.getMe()
        .then(value=>{if(isCurrent())applyIdentity(value);})
        .catch(error => {if(isCurrent()&&error instanceof ApiRequestError&&error.status===401)clearIdentity();})
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
        canRegisterProcess,
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
