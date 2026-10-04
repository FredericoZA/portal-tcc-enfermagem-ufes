import { PORTAL_THEME } from '../theme/portalTheme';

// Site Layout Configuration System (Header, Sidebar, Footer)
// Nesta instalação UFES, a identidade visual estrutural é fixa no código.
// A configuração administrativa pode alterar conteúdo, nunca a paleta estrutural.

export interface SiteLayoutConfig {
  headerInstitutionText: string;
  headerCourseTitle: string;
  headerShowRoleBadges: boolean;
  headerShowEmblem?: boolean;
  headerCustomLogoUrl?: string;
  headerBgColor?: string;
  headerTextColor?: string;
  headerTitleColor?: string;
  headerBgImage?: string;
  sidebarTitle: string;
  sidebarSubtitle: string;
  sidebarLogoType: 'emblem' | 'caduceus' | 'lamp' | 'ufes' | 'custom';
  sidebarCustomLogoUrl?: string;
  sidebarNavLabels: Record<string, string>;
  sidebarNavEmojis: Record<string, string>;
  sidebarIconMode: 'emoji' | 'lucide';
  sidebarSessionLabel: string;
  sidebarLocationText: string;
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

/**
 * Alias temporário para consumidores históricos.
 * Os valores vêm exclusivamente de PORTAL_THEME.
 */
export const PORTAL_COLORS = {
  moss: PORTAL_THEME.brand.header,
  mossDark: PORTAL_THEME.brand.header,
  deepGreen: PORTAL_THEME.chrome.sidebarFooter,
  deepGreenDark: PORTAL_THEME.chrome.sidebarFooter,
  sidebarActive: PORTAL_THEME.chrome.active,
  lightText: PORTAL_THEME.text.light,
  mutedLight: PORTAL_THEME.text.mutedLight,
  divider: PORTAL_THEME.chrome.divider,
  whatsapp: '#25D366',
  whatsappButton: PORTAL_THEME.brand.action,
  surface: PORTAL_THEME.surface.page,
  ice: PORTAL_THEME.surface.panel,
  iceSelected: PORTAL_THEME.surface.card,
  popupMoss: PORTAL_THEME.brand.action,
} as const;

const DEFAULT_NAV_LABELS = {
  home: 'Calendário',
  biblioteca: 'Repositório',
  'como-chegar': 'Como chegar',
  tutorial: 'Como usar',
  'fluxo-tcc': 'Fluxo do TCC',
  replicar: 'Replicar Portal',
  'meus-processos': 'Meus TCCs',
  coordenador: 'Área do Presidente',
  configuracoes: 'Configurações',
  indicadores: 'Indicadores',
} as const;

const DEFAULT_NAV_EMOJIS = {
  home: '📅',
  biblioteca: '📚',
  'como-chegar': '📍',
  tutorial: '❓',
  'fluxo-tcc': '🔀',
  replicar: '🧩',
  'meus-processos': '📋',
  coordenador: '🏛️',
  configuracoes: '⚙️',
  indicadores: '📊',
} as const;

export const DEFAULT_SITE_LAYOUT_CONFIG: SiteLayoutConfig = {
  headerInstitutionText: 'Universidade Federal do Espírito Santo',
  headerCourseTitle: 'Curso de Graduação em Enfermagem e Obstetrícia · CCS/UFES',
  headerShowRoleBadges: true,
  headerShowEmblem: true,
  headerCustomLogoUrl: '/api/public/runtime-assets/2466f8db8eb7c79073c197bea09fa53946ca0ca1392a192792fa0d4f0f2e420f',
  headerBgColor: PORTAL_THEME.brand.headerInstitution,
  headerTextColor: PORTAL_THEME.text.dark,
  headerTitleColor: PORTAL_THEME.brand.action,
  headerBgImage: '',
  sidebarTitle: 'PORTAL DE TCC',
  sidebarSubtitle: 'Enfermagem',
  sidebarLogoType: 'custom',
  sidebarCustomLogoUrl: '/api/public/runtime-assets/0d8980ef61e92bca98fabe43a9ce190da409935f5ebfccc2c5f991066c7c77d7',
  sidebarNavLabels: { ...DEFAULT_NAV_LABELS },
  sidebarNavEmojis: { ...DEFAULT_NAV_EMOJIS },
  sidebarIconMode: 'emoji',
  sidebarSessionLabel: 'Sessão ativa',
  sidebarLocationText: 'Campus de Maruípe · Vitória/ES',
  sidebarBgColor: PORTAL_THEME.chrome.sidebarFooter,
  sidebarHeaderBgColor: PORTAL_THEME.chrome.sidebarFooter,
  sidebarTextColor: '#e8f3ed',
  sidebarTitleColor: PORTAL_THEME.text.light,
  sidebarSubtitleColor: PORTAL_THEME.brand.action,
  sidebarActiveBgColor: PORTAL_THEME.chrome.active,
  sidebarActiveTextColor: PORTAL_THEME.text.light,
  sidebarActiveBorderColor: PORTAL_THEME.brand.action,
  sidebarDividerColor: PORTAL_THEME.chrome.divider,
  sidebarDividerStyle: 'solid',
  sidebarShowDividers: true,
  sidebarNavOrder: ['home', 'biblioteca', 'DIVIDER_1', 'meus-processos', 'coordenador', 'configuracoes', 'DIVIDER_2', 'indicadores', 'como-chegar', 'tutorial', 'fluxo-tcc', 'replicar'],
  footerLocationText: 'Departamento de Enfermagem • CCS/UFES • Campus de Maruípe • Vitória/ES',
  footerPresidentLabel: 'Presidente da Comissão',
  footerPresidentName: '',
  footerMembersLabel: 'Membros da Comissão',
  footerMembersList: [],
  footerDevTitle: 'Desenvolvimento da Plataforma e Suporte',
  footerDevName: '',
  footerWhatsappLabel: 'WhatsApp Secretaria',
  footerWhatsappUrl: '',
  footerContactEmail: '',
  footerQrCodeUrl: '',
  footerQrLabel: '',
  footerBgColor: PORTAL_THEME.chrome.sidebarFooter,
  footerTextColor: PORTAL_THEME.text.light,
  footerMutedTextColor: PORTAL_THEME.text.mutedLight,
  footerBorderColor: PORTAL_THEME.chrome.divider,
  footerDividerColor: PORTAL_THEME.chrome.divider,
  footerWhatsappBtnBg: PORTAL_THEME.brand.action,
  footerWhatsappBtnText: PORTAL_THEME.text.light,
  footerQrBgColor: PORTAL_THEME.surface.inner,
  footerQrTextColor: PORTAL_THEME.text.dark,
  footerQrBorderColor: PORTAL_THEME.surface.inner,
};

export const SITE_LAYOUT_EVENT = 'site_layout_config_changed';

function cloneDefaultConfig(): SiteLayoutConfig {
  return {
    ...DEFAULT_SITE_LAYOUT_CONFIG,
    sidebarNavLabels: { ...DEFAULT_SITE_LAYOUT_CONFIG.sidebarNavLabels },
    sidebarNavEmojis: { ...DEFAULT_SITE_LAYOUT_CONFIG.sidebarNavEmojis },
    sidebarNavOrder: [...(DEFAULT_SITE_LAYOUT_CONFIG.sidebarNavOrder || [])],
    footerMembersList: [...DEFAULT_SITE_LAYOUT_CONFIG.footerMembersList],
  };
}

/**
 * A aparência estrutural é canônica e versionada no código.
 * Mantemos a API para não quebrar consumidores, mas não há mais migração
 * de cores antigas nem leitura de paleta do localStorage.
 */
export function loadSiteLayoutConfig(): SiteLayoutConfig {
  return cloneDefaultConfig();
}

export function saveSiteLayoutConfig(_config: Partial<SiteLayoutConfig>) {
  if (typeof window === 'undefined') return;
  const fixed = cloneDefaultConfig();
  setTimeout(() => window.dispatchEvent(new CustomEvent(SITE_LAYOUT_EVENT, { detail: fixed })), 0);
}

export function resetSiteLayoutConfig() {
  if (typeof window === 'undefined') return;
  const fixed = cloneDefaultConfig();
  setTimeout(() => window.dispatchEvent(new CustomEvent(SITE_LAYOUT_EVENT, { detail: fixed })), 0);
}
