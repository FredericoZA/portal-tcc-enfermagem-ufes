// Site Layout Configuration System (Header, Sidebar, Footer)
// Nesta instalação UFES, a identidade institucional é fixa; este arquivo trata apenas de apresentação.

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

export const DEFAULT_SITE_LAYOUT_CONFIG: SiteLayoutConfig = {
  headerInstitutionText: 'Universidade Federal do Espírito Santo',
  headerCourseTitle: 'Curso de Graduação em Enfermagem e Obstetrícia',
  headerShowRoleBadges: true,
  headerShowEmblem: false,
  headerCustomLogoUrl: '',
  headerBgColor: '#ffffff',
  headerTextColor: '#56615c',
  headerTitleColor: '#0f172a',
  headerBgImage: '',

  sidebarTitle: 'PORTAL DE TCC',
  sidebarSubtitle: 'ENFERMAGEM E OBSTETRÍCIA · UFES',
  sidebarLogoType: 'custom',
  sidebarCustomLogoUrl: '',
  sidebarNavLabels: {
    home: 'Calendário',
    biblioteca: 'Repositório',
    tutorial: 'Como usar',
    'meus-processos': 'Meus TCCs',
    coordenador: 'Área do Presidente',
    configuracoes: 'Configurações',
    indicadores: 'Indicadores'
  },
  sidebarNavEmojis: {
    home: '📅',
    biblioteca: '📚',
    tutorial: '❓',
    'meus-processos': '📋',
    coordenador: '🏛️',
    configuracoes: '⚙️',
    indicadores: '📊'
  },
  sidebarIconMode: 'emoji',
  sidebarSessionLabel: 'Sessão ativa',
  sidebarLocationText: 'Campus de Maruípe • Vitória/ES',
  sidebarBgColor: '#0c342a',
  sidebarHeaderBgColor: '#082a22',
  sidebarTextColor: '#f6f7f6',
  sidebarTitleColor: '#ffffff',
  sidebarSubtitleColor: '#d9dfdc',
  sidebarActiveBgColor: '#435649',
  sidebarActiveTextColor: '#ffffff',
  sidebarActiveBorderColor: '#d2d9d5',
  sidebarDividerColor: '#315247',
  sidebarDividerStyle: 'solid',
  sidebarShowDividers: true,
  sidebarNavOrder: ['home', 'biblioteca', 'DIVIDER_1', 'meus-processos', 'coordenador', 'configuracoes', 'indicadores', 'DIVIDER_2', 'tutorial'],

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
  footerBgColor: '#082a22',
  footerTextColor: '#ffffff',
  footerMutedTextColor: '#d9dfdc',
  footerBorderColor: '#315247',
  footerDividerColor: '#315247',
  footerWhatsappBtnBg: '#616b66',
  footerWhatsappBtnText: '#ffffff',
  footerQrBgColor: '#ffffff',
  footerQrTextColor: '#1f2937',
  footerQrBorderColor: '#ffffff'
};

export const SITE_LAYOUT_EVENT = 'site_layout_config_changed';
const STORAGE_KEY = 'site_layout_custom_config_v1';

function canonicalSidebarOrder(rawOrder: unknown): string[] {
  const allowed = new Set(['home', 'biblioteca', 'DIVIDER_1', 'meus-processos', 'coordenador', 'configuracoes', 'indicadores', 'DIVIDER_2', 'tutorial']);
  const stored = Array.isArray(rawOrder) ? rawOrder.filter((item): item is string => typeof item === 'string' && allowed.has(item)) : [];
  const order = stored.length ? [...stored] : [...(DEFAULT_SITE_LAYOUT_CONFIG.sidebarNavOrder || [])];
  if (!order.includes('indicadores')) {
    const settingsIndex = order.indexOf('configuracoes');
    order.splice(settingsIndex >= 0 ? settingsIndex + 1 : order.length, 0, 'indicadores');
  }
  return Array.from(new Set(order));
}

export function loadSiteLayoutConfig(): SiteLayoutConfig {
  if (typeof window === 'undefined') return DEFAULT_SITE_LAYOUT_CONFIG;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SITE_LAYOUT_CONFIG;
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_SITE_LAYOUT_CONFIG,
      ...parsed,
      // O cabeçalho usa o emoticon acadêmico fixo; a marca do curso fica na lateral.
      headerShowEmblem: false,
      headerCustomLogoUrl: '',
      // A identidade lateral da instalação UFES segue o padrão institucional atual,
      // mesmo que um navegador tenha salvo a paleta antiga.
      sidebarSubtitle: 'ENFERMAGEM E OBSTETRÍCIA · UFES',
      sidebarSubtitleColor: '#d9dfdc',
      sidebarLogoType: 'custom',
      sidebarCustomLogoUrl: typeof parsed.sidebarCustomLogoUrl === 'string' ? parsed.sidebarCustomLogoUrl : '',
      sidebarIconMode: parsed.sidebarIconMode === 'lucide' ? 'lucide' : 'emoji',
      sidebarNavOrder: canonicalSidebarOrder(parsed.sidebarNavOrder),
      sidebarNavLabels: {
        ...DEFAULT_SITE_LAYOUT_CONFIG.sidebarNavLabels,
        ...(parsed.sidebarNavLabels || {}),
        indicadores: 'Indicadores'
      },
      sidebarNavEmojis: {
        ...DEFAULT_SITE_LAYOUT_CONFIG.sidebarNavEmojis,
        ...(parsed.sidebarNavEmojis || {}),
        indicadores: '📊'
      },
      footerQrLabel: '',
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
      headerShowEmblem: false,
      headerCustomLogoUrl: '',
      sidebarSubtitle: 'ENFERMAGEM E OBSTETRÍCIA · UFES',
      sidebarSubtitleColor: '#d9dfdc',
      sidebarLogoType: 'custom',
      sidebarNavOrder: canonicalSidebarOrder(config.sidebarNavOrder || current.sidebarNavOrder),
      sidebarNavLabels: {
        ...current.sidebarNavLabels,
        ...(config.sidebarNavLabels || {}),
        indicadores: 'Indicadores'
      },
      sidebarNavEmojis: {
        ...current.sidebarNavEmojis,
        ...(config.sidebarNavEmojis || {}),
        indicadores: '📊'
      },
      footerQrLabel: ''
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    setTimeout(() => window.dispatchEvent(new CustomEvent(SITE_LAYOUT_EVENT, { detail: updated })), 0);
  } catch (err) {
    console.error('Erro ao salvar layout do site:', err);
  }
}

export function resetSiteLayoutConfig() {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(STORAGE_KEY);
    setTimeout(() => window.dispatchEvent(new CustomEvent(SITE_LAYOUT_EVENT, { detail: DEFAULT_SITE_LAYOUT_CONFIG })), 0);
  } catch (err) {
    console.error('Erro ao resetar layout:', err);
  }
}
