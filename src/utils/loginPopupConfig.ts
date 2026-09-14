import { isPortalAppearanceLinked, loadGlobalPopupStyle } from './portalAppearanceLinks';

export interface LoginPopupConfig {
  title: string;
  subtitle: string;
  description: string;
  discenteTip: string;
  docenteTip: string;
  emailLabel: string;
  emailPlaceholder: string;
  buttonText: string;
  securityText: string;
  locationText: string;
  headerTheme: 'emerald' | 'slate' | 'blue' | 'purple' | 'indigo' | 'amber' | 'rose';
  showLogo: boolean;
  showTipsBox: boolean;
  showSecurityFooter: boolean;
  borderRadius: 'rounded-lg' | 'rounded-xl' | 'rounded-2xl' | 'rounded-3xl';
  cardBgColor?: string;
  cardTextColor?: string;
  primaryBtnBg?: string;
  primaryBtnTextColor?: string;
}

export const DEFAULT_LOGIN_POPUP_CONFIG: LoginPopupConfig = {
  title: 'Acesso ao Portal do TCC',
  subtitle: 'Enfermagem e Obstetrícia · UFES',
  description: 'Informe o e-mail cadastrado para receber um código de acesso de seis dígitos. Após a validação, os TCCs vinculados ao seu e-mail aparecerão automaticamente.',
  discenteTip: 'utilize sempre seu e-mail institucional @edu.ufes.br',
  docenteTip: 'utilize exatamente o e-mail informado no cadastro do TCC.',
  emailLabel: 'E-mail cadastrado',
  emailPlaceholder: 'nome@edu.ufes.br',
  buttonText: 'Enviar código de acesso',
  securityText: 'Ambiente Acadêmico Seguro',
  locationText: 'Ambiente institucional',
  headerTheme: 'slate',
  showLogo: false,
  showTipsBox: true,
  showSecurityFooter: false,
  borderRadius: 'rounded-2xl',
  cardBgColor: '#ffffff',
  cardTextColor: '#0f172a',
  primaryBtnBg: '#47866A',
  primaryBtnTextColor: '#ffffff'
};

export const LOGIN_POPUP_STORAGE_KEY = 'portal_login_popup_config_v1';
export const LOGIN_POPUP_CONFIG_EVENT = 'portal_login_popup_config_changed';

export function loadLoginPopupConfig(): LoginPopupConfig {
  if (typeof window === 'undefined') return { ...DEFAULT_LOGIN_POPUP_CONFIG };
  try {
    const raw = localStorage.getItem(LOGIN_POPUP_STORAGE_KEY);
    const local = raw
      ? {
          ...DEFAULT_LOGIN_POPUP_CONFIG,
          ...JSON.parse(raw),
          title: DEFAULT_LOGIN_POPUP_CONFIG.title,
          subtitle: DEFAULT_LOGIN_POPUP_CONFIG.subtitle,
          description: DEFAULT_LOGIN_POPUP_CONFIG.description,
          discenteTip: DEFAULT_LOGIN_POPUP_CONFIG.discenteTip,
          docenteTip: DEFAULT_LOGIN_POPUP_CONFIG.docenteTip,
          emailLabel: DEFAULT_LOGIN_POPUP_CONFIG.emailLabel,
          emailPlaceholder: DEFAULT_LOGIN_POPUP_CONFIG.emailPlaceholder,
          buttonText: DEFAULT_LOGIN_POPUP_CONFIG.buttonText,
          securityText: DEFAULT_LOGIN_POPUP_CONFIG.securityText,
          locationText: DEFAULT_LOGIN_POPUP_CONFIG.locationText,
          headerTheme: DEFAULT_LOGIN_POPUP_CONFIG.headerTheme,
          showLogo: DEFAULT_LOGIN_POPUP_CONFIG.showLogo,
          showSecurityFooter: DEFAULT_LOGIN_POPUP_CONFIG.showSecurityFooter,
          cardBgColor: DEFAULT_LOGIN_POPUP_CONFIG.cardBgColor,
          cardTextColor: DEFAULT_LOGIN_POPUP_CONFIG.cardTextColor,
          primaryBtnBg: DEFAULT_LOGIN_POPUP_CONFIG.primaryBtnBg,
          primaryBtnTextColor: DEFAULT_LOGIN_POPUP_CONFIG.primaryBtnTextColor
        }
      : { ...DEFAULT_LOGIN_POPUP_CONFIG };
    if (!isPortalAppearanceLinked('popup_login')) return local;
    const global = loadGlobalPopupStyle();
    return {
      ...local,
      cardBgColor: DEFAULT_LOGIN_POPUP_CONFIG.cardBgColor,
      cardTextColor: DEFAULT_LOGIN_POPUP_CONFIG.cardTextColor,
      primaryBtnBg: DEFAULT_LOGIN_POPUP_CONFIG.primaryBtnBg,
      primaryBtnTextColor: DEFAULT_LOGIN_POPUP_CONFIG.primaryBtnTextColor,
      borderRadius: global.borderRadius === '8px'
        ? 'rounded-lg'
        : global.borderRadius === '12px'
          ? 'rounded-xl'
          : global.borderRadius === '24px'
            ? 'rounded-3xl'
            : 'rounded-2xl',
    };
  } catch (e) {
    console.warn('Error loading login popup config:', e);
  }
  return { ...DEFAULT_LOGIN_POPUP_CONFIG };
}

export function saveLoginPopupConfig(config: LoginPopupConfig): void {
  try {
    localStorage.setItem(LOGIN_POPUP_STORAGE_KEY, JSON.stringify(config));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(LOGIN_POPUP_CONFIG_EVENT, { detail: config }));
    }
  } catch (e) {
    console.error('Error saving login popup config:', e);
  }
}
