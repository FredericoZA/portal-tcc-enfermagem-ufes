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

export const PORTAL_COLORS = {
  moss: '#006000',
  mossDark: '#006000',
  deepGreen: '#011f17',
  deepGreenDark: '#011f17',
  sidebarActive: '#154c41',
  neutralAction: '#909090',
  neutralActionHover: '#909090',
  lightText: '#ffffff',
  mutedLight: '#d9d9d9',
  divider: '#154c41',
  whatsapp: '#78a65a',
  whatsappButton: '#78a65a',
  surface: '#b7b7b7',
  pageSurface: '#f2f2f2',
  panelSurface: '#d9d9d9',
  innerSurface: '#ffffff',
  selection: '#909090',
  popupMoss: '#006000'
} as const;

export const DEFAULT_SITE_LAYOUT_CONFIG: SiteLayoutConfig = {
  headerInstitutionText: 'Universidade Federal do Espírito Santo',
  headerCourseTitle: 'Curso de Graduação em Enfermagem e Obstetrícia · CCS/UFES',
  headerShowRoleBadges: true,
  headerShowEmblem: true,
  headerCustomLogoUrl: '/api/public/runtime-assets/2466f8db8eb7c79073c197bea09fa53946ca0ca1392a192792fa0d4f0f2e420f',
  headerBgColor: PORTAL_COLORS.surface,
  headerTextColor: '#000000',
  headerTitleColor: PORTAL_COLORS.popupMoss,
  headerBgImage: '',
  sidebarTitle: 'PORTAL DE TCC',
  sidebarSubtitle: 'Enfermagem',
  sidebarLogoType: 'custom',
  sidebarCustomLogoUrl: '/api/public/runtime-assets/0d8980ef61e92bca98fabe43a9ce190da409935f5ebfccc2c5f991066c7c77d7',
  sidebarNavLabels: {
    home: 'Calendário', biblioteca: 'Repositório', 'como-chegar': 'Como chegar', tutorial: 'Como usar', 'fluxo-tcc': 'Fluxo do TCC', replicar: 'Replicar Portal',
    'meus-processos': 'Meus TCCs', coordenador: 'Área do Presidente', configuracoes: 'Configurações', indicadores: 'Indicadores'
  },
  sidebarNavEmojis: {
    home: '📅', biblioteca: '📚', 'como-chegar': '📍', tutorial: '❓', 'fluxo-tcc': '🔀', replicar: '🧩', 'meus-processos': '📋', coordenador: '🏛️', configuracoes: '⚙️', indicadores: '📊'
  },
  sidebarIconMode: 'emoji', sidebarSessionLabel: 'Sessão ativa', sidebarLocationText: 'Campus de Maruípe · Vitória/ES',
  sidebarBgColor: '#011f17',
  sidebarHeaderBgColor: '#011f17',
  sidebarTextColor: '#ffffff',
  sidebarTitleColor: '#ffffff', sidebarSubtitleColor: '#ffffff',
  sidebarActiveBgColor: '#154c41', sidebarActiveTextColor: '#ffffff', sidebarActiveBorderColor: '#154c41',
  sidebarDividerColor: '#154c41', sidebarDividerStyle: 'solid', sidebarShowDividers: true,
  sidebarNavOrder: ['home', 'biblioteca', 'DIVIDER_1', 'meus-processos', 'coordenador', 'configuracoes', 'DIVIDER_2', 'indicadores', 'como-chegar', 'tutorial', 'fluxo-tcc', 'replicar'],
  footerLocationText: 'Departamento de Enfermagem • CCS/UFES • Campus de Maruípe • Vitória/ES',
  footerPresidentLabel: 'Presidente da Comissão', footerPresidentName: '', footerMembersLabel: 'Membros da Comissão', footerMembersList: [],
  footerDevTitle: 'Desenvolvimento da Plataforma e Suporte', footerDevName: '', footerWhatsappLabel: 'WhatsApp Secretaria', footerWhatsappUrl: '', footerContactEmail: '',
  footerQrCodeUrl: '', footerQrLabel: '', footerBgColor: '#011f17', footerTextColor: '#ffffff', footerMutedTextColor: '#d9d9d9',
  footerBorderColor: '#154c41', footerDividerColor: '#154c41', footerWhatsappBtnBg: '#78a65a', footerWhatsappBtnText: '#000000',
  footerQrBgColor: '#ffffff', footerQrTextColor: '#0f172a', footerQrBorderColor: '#ffffff'
};

export const SITE_LAYOUT_EVENT = 'site_layout_config_changed';
const STORAGE_KEY = 'site_layout_custom_config_v1';
const LEGACY_COLORS: Record<string, string> = {
  '#5f6937': PORTAL_COLORS.neutralAction, '#4f582e': PORTAL_COLORS.neutralActionHover, '#616d36': PORTAL_COLORS.divider,
  '#aab388': PORTAL_COLORS.popupMoss, '#e0e3cf': '#e5e7eb', '#f0f1e7': '#f8fafc', '#c8ceb0': PORTAL_COLORS.mutedLight, '#525c2e': PORTAL_COLORS.sidebarActive, '#343b20': PORTAL_COLORS.deepGreen, '#252a16': PORTAL_COLORS.deepGreenDark,
  '#cbd5d1': PORTAL_COLORS.popupMoss,
  '#344125': PORTAL_COLORS.moss, '#435649': PORTAL_COLORS.moss, '#005830': PORTAL_COLORS.moss,
  '#47866a': PORTAL_COLORS.popupMoss, '#1ea952': PORTAL_COLORS.popupMoss
};
function migrateColor(value: unknown, fallback?: string): string | undefined {
  if (typeof value !== 'string' || !value.trim()) return fallback;
  return LEGACY_COLORS[value.toLowerCase()] || value;
}
function canonicalSidebarOrder(rawOrder: unknown): string[] {
  const allowed = new Set(['home','biblioteca','DIVIDER_1','meus-processos','coordenador','configuracoes','indicadores','DIVIDER_2','como-chegar','tutorial','fluxo-tcc','replicar']);
  const stored = Array.isArray(rawOrder) ? rawOrder.filter((item): item is string => typeof item === 'string' && allowed.has(item)) : [];
  const order = stored.length ? [...stored] : [...(DEFAULT_SITE_LAYOUT_CONFIG.sidebarNavOrder || [])];
  const withoutIndicators=order.filter(item=>item!=='indicadores');
  const indicatorAnchor=withoutIndicators.indexOf('como-chegar');
  withoutIndicators.splice(indicatorAnchor>=0?indicatorAnchor:withoutIndicators.length,0,'indicadores');
  order.splice(0,order.length,...withoutIndicators);
  if (!order.includes('como-chegar')) { const i=order.indexOf('tutorial'); order.splice(i>=0?i:order.length,0,'como-chegar'); }
  if (!order.includes('fluxo-tcc')) { const i=order.indexOf('replicar'); order.splice(i>=0?i:order.length,0,'fluxo-tcc'); }
  if (!order.includes('replicar')) order.push('replicar');
  return Array.from(new Set(order));
}
function normalizeHeaderCourseTitle(value: unknown): string {
  const title = typeof value === 'string' && value.trim() ? value.trim() : DEFAULT_SITE_LAYOUT_CONFIG.headerCourseTitle;
  return /ccs\s*\/\s*ufes/i.test(title) ? title : `${title} · CCS/UFES`;
}
function normalizeSidebarSubtitle(value: unknown): string {
  const subtitle = typeof value === 'string' ? value.trim() : '';
  if (!subtitle || /curso de graduação/i.test(subtitle) || /enfermagem.*ufes/i.test(subtitle) || /ccs\s*\/\s*ufes/i.test(subtitle)) return 'Enfermagem';
  return subtitle;
}
function normalizeVisualConfig(parsed: any): SiteLayoutConfig {
  return {
    ...DEFAULT_SITE_LAYOUT_CONFIG, ...parsed,
    headerShowEmblem: parsed?.headerShowEmblem !== false,
    headerCustomLogoUrl: typeof parsed?.headerCustomLogoUrl === 'string' ? parsed.headerCustomLogoUrl : '',
    headerInstitutionText: parsed?.headerInstitutionText || DEFAULT_SITE_LAYOUT_CONFIG.headerInstitutionText,
    headerCourseTitle: normalizeHeaderCourseTitle(parsed?.headerCourseTitle),
    headerBgColor: PORTAL_COLORS.surface,
    headerTextColor: '#000000',
    headerTitleColor: PORTAL_COLORS.popupMoss,
    sidebarLogoType:'custom', sidebarCustomLogoUrl:typeof parsed?.sidebarCustomLogoUrl==='string'?parsed.sidebarCustomLogoUrl:'', sidebarIconMode:parsed?.sidebarIconMode==='lucide'?'lucide':'emoji',
    sidebarTitle: parsed?.sidebarTitle || DEFAULT_SITE_LAYOUT_CONFIG.sidebarTitle,
    sidebarSubtitle: normalizeSidebarSubtitle(parsed?.sidebarSubtitle),
    sidebarBgColor:DEFAULT_SITE_LAYOUT_CONFIG.sidebarBgColor, sidebarHeaderBgColor:DEFAULT_SITE_LAYOUT_CONFIG.sidebarHeaderBgColor,
    sidebarTextColor:DEFAULT_SITE_LAYOUT_CONFIG.sidebarTextColor, sidebarTitleColor:DEFAULT_SITE_LAYOUT_CONFIG.sidebarTitleColor,
    sidebarSubtitleColor: '#ffffff',
    sidebarActiveBgColor:PORTAL_COLORS.sidebarActive,
    sidebarActiveTextColor:'#ffffff',
    sidebarActiveBorderColor:PORTAL_COLORS.sidebarActive, sidebarDividerColor:DEFAULT_SITE_LAYOUT_CONFIG.sidebarDividerColor,
    sidebarNavOrder:canonicalSidebarOrder(parsed?.sidebarNavOrder),
    sidebarNavLabels:{...DEFAULT_SITE_LAYOUT_CONFIG.sidebarNavLabels,...(parsed?.sidebarNavLabels||{}),'como-chegar':'Como chegar',indicadores:'Indicadores','fluxo-tcc':'Fluxo do TCC',replicar:'Replicar Portal'},
    sidebarNavEmojis:{...DEFAULT_SITE_LAYOUT_CONFIG.sidebarNavEmojis,...(parsed?.sidebarNavEmojis||{}),'como-chegar':'📍',indicadores:'📊','fluxo-tcc':'🔀',replicar:'🧩'},
    footerMembersList:Array.isArray(parsed?.footerMembersList)?parsed.footerMembersList:[], footerBgColor:DEFAULT_SITE_LAYOUT_CONFIG.footerBgColor,
    footerTextColor:DEFAULT_SITE_LAYOUT_CONFIG.footerTextColor, footerMutedTextColor:DEFAULT_SITE_LAYOUT_CONFIG.footerMutedTextColor,
    footerBorderColor:DEFAULT_SITE_LAYOUT_CONFIG.footerBorderColor, footerDividerColor:DEFAULT_SITE_LAYOUT_CONFIG.footerDividerColor,
    footerWhatsappBtnBg:DEFAULT_SITE_LAYOUT_CONFIG.footerWhatsappBtnBg, footerWhatsappBtnText:DEFAULT_SITE_LAYOUT_CONFIG.footerWhatsappBtnText,
    footerQrLabel:'', footerQrBorderColor:'#ffffff'
  };
}
export function loadSiteLayoutConfig(): SiteLayoutConfig {
  // A aparência estrutural é canônica e versionada no código.
  return {
    ...DEFAULT_SITE_LAYOUT_CONFIG,
    sidebarNavLabels: { ...DEFAULT_SITE_LAYOUT_CONFIG.sidebarNavLabels },
    sidebarNavEmojis: { ...DEFAULT_SITE_LAYOUT_CONFIG.sidebarNavEmojis },
    sidebarNavOrder: [...(DEFAULT_SITE_LAYOUT_CONFIG.sidebarNavOrder || [])],
    footerMembersList: [...DEFAULT_SITE_LAYOUT_CONFIG.footerMembersList],
  };
}

export function saveSiteLayoutConfig(_config: Partial<SiteLayoutConfig>) {
  // Compatibilidade temporária para consumidores antigos: não persiste estilo.
  if(typeof window==='undefined')return;
  const fixed=loadSiteLayoutConfig();
  setTimeout(()=>window.dispatchEvent(new CustomEvent(SITE_LAYOUT_EVENT,{detail:fixed})),0);
}

export function resetSiteLayoutConfig(){
  if(typeof window==='undefined')return;
  const fixed=loadSiteLayoutConfig();
  setTimeout(()=>window.dispatchEvent(new CustomEvent(SITE_LAYOUT_EVENT,{detail:fixed})),0);
}
