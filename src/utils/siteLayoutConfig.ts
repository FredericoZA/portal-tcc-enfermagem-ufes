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
  moss: '#344125',
  mossDark: '#20301f',
  deepGreen: '#06372d',
  deepGreenDark: '#03271f',
  neutralAction: '#5b635e',
  neutralActionHover: '#48504c',
  lightText: '#f8fafc',
  mutedLight: '#d6d9d7',
  divider: '#365349'
} as const;

export const DEFAULT_SITE_LAYOUT_CONFIG: SiteLayoutConfig = {
  headerInstitutionText: 'Universidade Federal do Espírito Santo',
  headerCourseTitle: 'Curso de Graduação em Enfermagem e Obstetrícia',
  headerShowRoleBadges: true,
  headerShowEmblem: false,
  headerCustomLogoUrl: '',
  headerBgColor: '#ffffff',
  headerTextColor: '#475569',
  headerTitleColor: '#0f172a',
  headerBgImage: '',
  sidebarTitle: 'PORTAL DE TCC',
  sidebarSubtitle: 'Enfermagem e Obstetrícia · UFES',
  sidebarLogoType: 'custom',
  sidebarCustomLogoUrl: '',
  sidebarNavLabels: {
    home: 'Calendário', biblioteca: 'Repositório', tutorial: 'Como usar', replicar: 'Replicar Portal',
    'meus-processos': 'Meus TCCs', coordenador: 'Área do Presidente', configuracoes: 'Configurações', indicadores: 'Indicadores'
  },
  sidebarNavEmojis: {
    home: '📅', biblioteca: '📚', tutorial: '❓', replicar: '🧩', 'meus-processos': '📋', coordenador: '🏛️', configuracoes: '⚙️', indicadores: '📊'
  },
  sidebarIconMode: 'emoji', sidebarSessionLabel: 'Sessão ativa', sidebarLocationText: 'Campus de Maruípe · Vitória/ES',
  sidebarBgColor: PORTAL_COLORS.deepGreen,
  sidebarHeaderBgColor: PORTAL_COLORS.deepGreenDark,
  sidebarTextColor: PORTAL_COLORS.lightText,
  sidebarTitleColor: '#ffffff', sidebarSubtitleColor: PORTAL_COLORS.mutedLight,
  sidebarActiveBgColor: '#154d41', sidebarActiveTextColor: '#ffffff', sidebarActiveBorderColor: '#cbd5d1',
  sidebarDividerColor: PORTAL_COLORS.divider, sidebarDividerStyle: 'solid', sidebarShowDividers: true,
  sidebarNavOrder: ['home', 'biblioteca', 'DIVIDER_1', 'meus-processos', 'coordenador', 'configuracoes', 'indicadores', 'DIVIDER_2', 'tutorial', 'replicar'],
  footerLocationText: 'Departamento de Enfermagem · CCS/UFES · Campus de Maruípe · Vitória/ES',
  footerPresidentLabel: 'Presidente da Comissão', footerPresidentName: '', footerMembersLabel: 'Membros da Comissão', footerMembersList: [],
  footerDevTitle: 'Desenvolvimento da Plataforma e Suporte', footerDevName: '', footerWhatsappLabel: 'WhatsApp Secretaria', footerWhatsappUrl: '', footerContactEmail: '',
  footerQrCodeUrl: '', footerQrLabel: '', footerBgColor: PORTAL_COLORS.deepGreenDark, footerTextColor: '#ffffff', footerMutedTextColor: PORTAL_COLORS.mutedLight,
  footerBorderColor: PORTAL_COLORS.divider, footerDividerColor: PORTAL_COLORS.divider, footerWhatsappBtnBg: PORTAL_COLORS.neutralAction, footerWhatsappBtnText: '#ffffff',
  footerQrBgColor: '#ffffff', footerQrTextColor: '#0f172a', footerQrBorderColor: '#ffffff'
};

export const SITE_LAYOUT_EVENT = 'site_layout_config_changed';
const STORAGE_KEY = 'site_layout_custom_config_v1';
const LEGACY_COLORS: Record<string, string> = {
  '#5f6937': PORTAL_COLORS.neutralAction, '#4f582e': PORTAL_COLORS.neutralActionHover, '#616d36': PORTAL_COLORS.divider,
  '#aab388': '#cbd5d1', '#e0e3cf': '#e5e7eb', '#f0f1e7': '#f8fafc', '#c8ceb0': PORTAL_COLORS.mutedLight, '#525c2e': '#154d41', '#343b20': PORTAL_COLORS.deepGreen, '#252a16': PORTAL_COLORS.deepGreenDark
};
function migrateColor(value: unknown, fallback?: string): string | undefined {
  if (typeof value !== 'string' || !value.trim()) return fallback;
  return LEGACY_COLORS[value.toLowerCase()] || value;
}
function canonicalSidebarOrder(rawOrder: unknown): string[] {
  const allowed = new Set(['home','biblioteca','DIVIDER_1','meus-processos','coordenador','configuracoes','indicadores','DIVIDER_2','tutorial','replicar']);
  const stored = Array.isArray(rawOrder) ? rawOrder.filter((item): item is string => typeof item === 'string' && allowed.has(item)) : [];
  const order = stored.length ? [...stored] : [...(DEFAULT_SITE_LAYOUT_CONFIG.sidebarNavOrder || [])];
  if (!order.includes('indicadores')) { const i=order.indexOf('configuracoes'); order.splice(i>=0?i+1:order.length,0,'indicadores'); }
  if (!order.includes('replicar')) order.push('replicar');
  return Array.from(new Set(order));
}
function normalizeVisualConfig(parsed: any): SiteLayoutConfig {
  return {
    ...DEFAULT_SITE_LAYOUT_CONFIG, ...parsed,
    headerShowEmblem:false, headerCustomLogoUrl:'', headerTextColor:migrateColor(parsed?.headerTextColor, DEFAULT_SITE_LAYOUT_CONFIG.headerTextColor),
    sidebarLogoType:'custom', sidebarCustomLogoUrl:typeof parsed?.sidebarCustomLogoUrl==='string'?parsed.sidebarCustomLogoUrl:'', sidebarIconMode:parsed?.sidebarIconMode==='lucide'?'lucide':'emoji',
    sidebarTitle: parsed?.sidebarTitle || DEFAULT_SITE_LAYOUT_CONFIG.sidebarTitle,
    sidebarSubtitle: !parsed?.sidebarSubtitle || /curso de graduação em enfermagem/i.test(parsed.sidebarSubtitle) ? DEFAULT_SITE_LAYOUT_CONFIG.sidebarSubtitle : parsed.sidebarSubtitle,
    sidebarBgColor:migrateColor(parsed?.sidebarBgColor,DEFAULT_SITE_LAYOUT_CONFIG.sidebarBgColor), sidebarHeaderBgColor:migrateColor(parsed?.sidebarHeaderBgColor,DEFAULT_SITE_LAYOUT_CONFIG.sidebarHeaderBgColor),
    sidebarTextColor:migrateColor(parsed?.sidebarTextColor,DEFAULT_SITE_LAYOUT_CONFIG.sidebarTextColor), sidebarTitleColor:migrateColor(parsed?.sidebarTitleColor,DEFAULT_SITE_LAYOUT_CONFIG.sidebarTitleColor),
    sidebarSubtitleColor:migrateColor(parsed?.sidebarSubtitleColor,DEFAULT_SITE_LAYOUT_CONFIG.sidebarSubtitleColor), sidebarActiveBgColor:migrateColor(parsed?.sidebarActiveBgColor,DEFAULT_SITE_LAYOUT_CONFIG.sidebarActiveBgColor),
    sidebarActiveTextColor:migrateColor(parsed?.sidebarActiveTextColor,DEFAULT_SITE_LAYOUT_CONFIG.sidebarActiveTextColor), sidebarActiveBorderColor:migrateColor(parsed?.sidebarActiveBorderColor,DEFAULT_SITE_LAYOUT_CONFIG.sidebarActiveBorderColor), sidebarDividerColor:migrateColor(parsed?.sidebarDividerColor,DEFAULT_SITE_LAYOUT_CONFIG.sidebarDividerColor),
    sidebarNavOrder:canonicalSidebarOrder(parsed?.sidebarNavOrder),
    sidebarNavLabels:{...DEFAULT_SITE_LAYOUT_CONFIG.sidebarNavLabels,...(parsed?.sidebarNavLabels||{}),indicadores:'Indicadores',replicar:'Replicar Portal'},
    sidebarNavEmojis:{...DEFAULT_SITE_LAYOUT_CONFIG.sidebarNavEmojis,...(parsed?.sidebarNavEmojis||{}),indicadores:'📊',replicar:'🧩'},
    footerMembersList:Array.isArray(parsed?.footerMembersList)?parsed.footerMembersList:[], footerBgColor:migrateColor(parsed?.footerBgColor,DEFAULT_SITE_LAYOUT_CONFIG.footerBgColor),
    footerTextColor:migrateColor(parsed?.footerTextColor,DEFAULT_SITE_LAYOUT_CONFIG.footerTextColor), footerMutedTextColor:migrateColor(parsed?.footerMutedTextColor,DEFAULT_SITE_LAYOUT_CONFIG.footerMutedTextColor),
    footerBorderColor:migrateColor(parsed?.footerBorderColor,DEFAULT_SITE_LAYOUT_CONFIG.footerBorderColor), footerDividerColor:migrateColor(parsed?.footerDividerColor,DEFAULT_SITE_LAYOUT_CONFIG.footerDividerColor),
    footerWhatsappBtnBg:migrateColor(parsed?.footerWhatsappBtnBg,DEFAULT_SITE_LAYOUT_CONFIG.footerWhatsappBtnBg), footerWhatsappBtnText:migrateColor(parsed?.footerWhatsappBtnText,DEFAULT_SITE_LAYOUT_CONFIG.footerWhatsappBtnText),
    footerQrLabel:'', footerQrBorderColor:'#ffffff'
  };
}
export function loadSiteLayoutConfig(): SiteLayoutConfig {
  if(typeof window==='undefined') return DEFAULT_SITE_LAYOUT_CONFIG;
  try { const raw=localStorage.getItem(STORAGE_KEY); return normalizeVisualConfig(raw?JSON.parse(raw):{}); }
  catch(err){ console.error('Erro ao carregar layout do site:',err); return DEFAULT_SITE_LAYOUT_CONFIG; }
}
export function saveSiteLayoutConfig(config: Partial<SiteLayoutConfig>) {
  if(typeof window==='undefined')return;
  try { const updated=normalizeVisualConfig({...loadSiteLayoutConfig(),...config}); localStorage.setItem(STORAGE_KEY,JSON.stringify(updated)); setTimeout(()=>window.dispatchEvent(new CustomEvent(SITE_LAYOUT_EVENT,{detail:updated})),0); }
  catch(err){console.error('Erro ao salvar layout do site:',err);}
}
export function resetSiteLayoutConfig(){if(typeof window==='undefined')return;try{localStorage.removeItem(STORAGE_KEY);setTimeout(()=>window.dispatchEvent(new CustomEvent(SITE_LAYOUT_EVENT,{detail:DEFAULT_SITE_LAYOUT_CONFIG})),0);}catch(err){console.error('Erro ao resetar layout:',err);}}
