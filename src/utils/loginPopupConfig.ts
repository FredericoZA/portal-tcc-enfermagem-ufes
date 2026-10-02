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
  description: 'Informe o e-mail cadastrado no Portal para receber um código de acesso de seis dígitos. Use o mesmo endereço associado ao seu perfil.',
  discenteTip: 'se você é discente, utilize seu e-mail institucional @edu.ufes.br.',
  docenteTip: 'Master, Presidência, docentes, banca e demais usuários devem usar exatamente o e-mail cadastrado no Portal; ele pode ser institucional ou pessoal (Gmail, Outlook/Hotmail etc.).',
  emailLabel: 'E-mail cadastrado',
  emailPlaceholder: 'seuemail@exemplo.com',
  buttonText: 'Enviar código de acesso',
  securityText: 'Ambiente Acadêmico Seguro',
  locationText: 'Ambiente institucional',
  headerTheme: 'slate',
  showLogo: false,
  showTipsBox: true,
  showSecurityFooter: false,
  borderRadius: 'rounded-2xl',
  cardBgColor: '#154d41',
  cardTextColor: '#ffffff',
  primaryBtnBg: '#154d41',
  primaryBtnTextColor: '#ffffff'
};

export const LOGIN_POPUP_STORAGE_KEY = 'portal_login_popup_config_v1';
export const LOGIN_POPUP_CONFIG_EVENT = 'portal_login_popup_config_changed';

export function loadLoginPopupConfig(): LoginPopupConfig {
  return { ...DEFAULT_LOGIN_POPUP_CONFIG };
}

export function saveLoginPopupConfig(_config: LoginPopupConfig): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(LOGIN_POPUP_CONFIG_EVENT, { detail: loadLoginPopupConfig() }));
  }
}
