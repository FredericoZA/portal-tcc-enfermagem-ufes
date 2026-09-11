// Site Layout Configuration System (Header, Sidebar, Footer)
// Allows administrators to customize institution names, logos, navigation labels, commission members, contacts, etc.

export interface SiteLayoutConfig {
  // Top Header
  headerInstitutionText: string;
  headerCourseTitle: string;
  headerShowRoleBadges: boolean;
  headerShowEmblem?: boolean;
  headerCustomLogoUrl?: string;
  headerBgColor?: string;
  headerTextColor?: string;
  headerTitleColor?: string;
  headerBgImage?: string;

  // Left Sidebar
  sidebarTitle: string;
  sidebarSubtitle: string;
  sidebarLogoType: 'emblem' | 'caduceus' | 'lamp' | 'ufes' | 'custom';
  sidebarCustomLogoUrl?: string;
  sidebarNavLabels: Record<string, string>;
  sidebarNavEmojis: Record<string, string>;
  sidebarIconMode: 'emoji' | 'lucide';
  sidebarSessionLabel: string;
  sidebarLocationText: string;
  // Sidebar Colors & Dividers
  sidebarBgColor?: string;
  sidebarHeaderBgColor?: string;
  sidebarTextColor?: string;
  sidebarTitleColor?: string;
  sidebarSubtitleColor?: string;
  sidebarActiveBgColor?: string;
  sidebarActiveTextColor?: string;
  sidebarActiveBorderColor?: string;
  sidebarDividerColor?: string;
  sidebarDividerStyle?: 'solid' | 'dashed' | 'dotted' | 'none';
  sidebarShowDividers?: boolean;
  sidebarNavOrder?: string[];

  // Footer
  footerLocationText: string;
  footerPresidentLabel: string;
  footerPresidentName: string;
  footerMembersLabel: string;
  footerMembersList: string[];
  footerDevTitle: string;
  footerDevName: string;
  footerWhatsappLabel: string;
  footerWhatsappUrl: string;
  footerContactEmail: string;
  footerQrCodeUrl?: string;
  footerQrLabel: string;
  // Footer Colors & Styling
  footerBgColor?: string;
  footerTextColor?: string;
  footerMutedTextColor?: string;
  footerBorderColor?: string;
  footerDividerColor?: string;
  footerWhatsappBtnBg?: string;
  footerWhatsappBtnText?: string;
  footerQrBgColor?: string;
  footerQrTextColor?: string;
  footerQrBorderColor?: string;
}

export const DEFAULT_SITE_LAYOUT_CONFIG: SiteLayoutConfig = {
  headerInstitutionText: '',
  headerCourseTitle: '',
  headerShowRoleBadges: true,
  headerShowEmblem: true,
  headerCustomLogoUrl: '',
  headerBgColor: '#ffffff',
  headerTextColor: '#047857',
  headerTitleColor: '#0f172a',
  headerBgImage: '',

  sidebarTitle: 'PORTAL DE TCC',
  sidebarSubtitle: '',
  sidebarLogoType: 'emblem',
  sidebarCustomLogoUrl: '',
  sidebarNavLabels: {
    home: 'Calendário',
    biblioteca: 'Repositório',
    tutorial: 'Tutorial',
    'acessar-portal': 'Acessar Portal',
    'meus-processos': 'Meus TCCs',
    coordenador: 'Área do Presidente',
    configuracoes: 'Configurações'
  },
  sidebarNavEmojis: {
    home: '📅',
    biblioteca: '📚',
    tutorial: '📖',
    'acessar-portal': '🔑',
    'meus-processos': '📋',
    coordenador: '🏛️',
    configuracoes: '⚙️'
  },
  sidebarIconMode: 'emoji',
  sidebarSessionLabel: 'Sessão Ativa:',
  sidebarLocationText: '',
  sidebarBgColor: '#011f17',
  sidebarHeaderBgColor: '#011812',
  sidebarTextColor: '#e2e8f0',
  sidebarTitleColor: '#ffffff',
  sidebarSubtitleColor: '#7bc394',
  sidebarActiveBgColor: '#033d2e',
  sidebarActiveTextColor: '#a4ebd4',
  sidebarActiveBorderColor: '#7bc394',
  sidebarDividerColor: '#033628',
  sidebarDividerStyle: 'solid',
  sidebarShowDividers: true,
  sidebarNavOrder: ['home', 'biblioteca', 'DIVIDER_1', 'meus-processos', 'coordenador', 'configuracoes', 'DIVIDER_2', 'tutorial'],

  footerLocationText: '',
  footerPresidentLabel: 'Presidente da Comissão',
  footerPresidentName: '',
  footerMembersLabel: 'Membros da Comissão',
  footerMembersList: [],
  footerDevTitle: 'Desenvolvimento da Plataforma e Suporte',
  footerDevName: '',
  footerWhatsappLabel: 'WhatsApp Secretária',
  footerWhatsappUrl: '',
  footerContactEmail: '',
  footerQrCodeUrl: '',
  footerQrLabel: 'WhatsApp QR',
  footerBgColor: '#011812',
  footerTextColor: '#ffffff',
  footerMutedTextColor: '#94a3b8',
  footerBorderColor: '#033628',
  footerDividerColor: '#033628',
  footerWhatsappBtnBg: '#059669',
  footerWhatsappBtnText: '#ffffff',
  footerQrBgColor: '#ffffff',
  footerQrTextColor: '#0f172a',
  footerQrBorderColor: '#e2e8f0'
};

export const SITE_LAYOUT_EVENT = 'site_layout_config_changed';
const STORAGE_KEY = 'site_layout_custom_config_v1';

export function loadSiteLayoutConfig(): SiteLayoutConfig {
  if (typeof window === 'undefined') return DEFAULT_SITE_LAYOUT_CONFIG;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SITE_LAYOUT_CONFIG;
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_SITE_LAYOUT_CONFIG,
      ...parsed,
      sidebarIconMode: parsed.sidebarIconMode === 'lucide' ? 'lucide' : 'emoji',
      sidebarNavLabels: {
        ...DEFAULT_SITE_LAYOUT_CONFIG.sidebarNavLabels,
        ...(parsed.sidebarNavLabels || {})
      },
      footerMembersList: Array.isArray(parsed.footerMembersList)
        ? parsed.footerMembersList
        : DEFAULT_SITE_LAYOUT_CONFIG.footerMembersList
    };
  } catch (err) {
    console.error('Erro ao carregar layout do site:', err);
    return DEFAULT_SITE_LAYOUT_CONFIG;
  }
}

export function saveSiteLayoutConfig(config: Partial<SiteLayoutConfig>) {
  if (typeof window === 'undefined') return;
  try {
    const current = loadSiteLayoutConfig();
    const updated: SiteLayoutConfig = {
      ...current,
      ...config,
      sidebarNavLabels: {
        ...current.sidebarNavLabels,
        ...(config.sidebarNavLabels || {})
      }
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent(SITE_LAYOUT_EVENT, { detail: updated }));
    }, 0);
  } catch (err) {
    console.error('Erro ao salvar layout do site:', err);
  }
}

export function resetSiteLayoutConfig() {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(STORAGE_KEY);
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent(SITE_LAYOUT_EVENT, { detail: DEFAULT_SITE_LAYOUT_CONFIG }));
    }, 0);
  } catch (err) {
    console.error('Erro ao resetar layout:', err);
  }
}
