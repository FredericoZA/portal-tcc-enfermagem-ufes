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
  subtitle: 'Curso • Instituição',
  description: 'Informe o seu e-mail institucional ou cadastrado. Enviaremos um código de seis dígitos para sua caixa de entrada. Os TCCs em que você participa aparecerão automaticamente.',
  discenteTip: 'utilize o e-mail previamente autorizado pela administração.',
  docenteTip: 'utilize exatamente o e-mail informado no cadastro do TCC.',
  emailLabel: 'E-mail Institucional ou Cadastrado',
  emailPlaceholder: 'nome@instituicao.br',
  buttonText: 'Enviar código de acesso',
  securityText: 'Ambiente Acadêmico Seguro',
  locationText: 'Ambiente institucional',
  headerTheme: 'emerald',
  showLogo: true,
  showTipsBox: true,
  showSecurityFooter: true,
  borderRadius: 'rounded-2xl',
  cardBgColor: '#ecfdf5',
  cardTextColor: '#0f172a',
  primaryBtnBg: '#005830',
  primaryBtnTextColor: '#ffffff'
};

export const LOGIN_POPUP_STORAGE_KEY = 'portal_login_popup_config_v1';
export const LOGIN_POPUP_CONFIG_EVENT = 'portal_login_popup_config_changed';

export function loadLoginPopupConfig(): LoginPopupConfig {
  if (typeof window === 'undefined') return { ...DEFAULT_LOGIN_POPUP_CONFIG };
  try {
    const raw = localStorage.getItem(LOGIN_POPUP_STORAGE_KEY);
    const local = raw
      ? { ...DEFAULT_LOGIN_POPUP_CONFIG, ...JSON.parse(raw) }
      : { ...DEFAULT_LOGIN_POPUP_CONFIG };
    if (!isPortalAppearanceLinked('popup_login')) return local;
    const global = loadGlobalPopupStyle();
    return {
      ...local,
      cardBgColor: global.headerBgColor,
      cardTextColor: global.headerTextColor,
      primaryBtnBg: global.actionBgColor,
      primaryBtnTextColor: global.actionTextColor,
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
