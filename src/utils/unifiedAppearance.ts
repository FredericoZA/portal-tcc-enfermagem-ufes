import type { GlobalSettings } from '../types';
import { DEFAULT_GLOBAL_POPUP_STYLE, unifiedAppearanceLinks } from './portalAppearanceLinks';
import { portalFontFamily, portalFontKey } from './portalFonts';

/** Keep old content/layout settings; discard only per-screen style exceptions. */
export function normalizeUnifiedAppearance(settings: GlobalSettings): GlobalSettings {
  const appearance = settings.portalAppearance || { schemaVersion: 4 };
  const general = appearance.generalPopups || {};
  const popup = { ...DEFAULT_GLOBAL_POPUP_STYLE, surfaceBgColor: general.uploadAtaBg || DEFAULT_GLOBAL_POPUP_STYLE.surfaceBgColor,
    headerBgColor: general.uploadAtaHeaderBg || DEFAULT_GLOBAL_POPUP_STYLE.headerBgColor,
    headerTextColor: general.uploadAtaHeaderTextColor || DEFAULT_GLOBAL_POPUP_STYLE.headerTextColor,
    actionBgColor: general.uploadAtaBtnBg || DEFAULT_GLOBAL_POPUP_STYLE.actionBgColor,
    actionTextColor: general.uploadAtaBtnText || DEFAULT_GLOBAL_POPUP_STYLE.actionTextColor,
    fontFamily: general.fontFamily || DEFAULT_GLOBAL_POPUP_STYLE.fontFamily,
    fontSize: general.fontSize || DEFAULT_GLOBAL_POPUP_STYLE.fontSize,
    borderRadius: general.borderRadius || DEFAULT_GLOBAL_POPUP_STYLE.borderRadius,
    borderColor: general.borderColor || DEFAULT_GLOBAL_POPUP_STYLE.borderColor,
    ...appearance.globalPopupStyle };
  popup.fontFamily = portalFontFamily(popup.fontFamily);
  const layouts = Object.fromEntries(Object.entries(settings.tableLayouts || {}).map(([key, value]) => {
    const layout = value && typeof value === 'object' ? { ...value as Record<string, unknown> } : {};
    delete layout.textFormat;
    return [key, { ...layout, inheritGlobalAppearance: true }];
  }));
  return { ...settings, tableLayouts: layouts,
    tableAppearance: { ...settings.tableAppearance, fontFamily: portalFontKey(popup.fontFamily), customHeaderColor: popup.headerBgColor, customHeaderTextColor: popup.headerTextColor, headerTextColor: 'custom', toolbarButtonColor: popup.actionBgColor },
    portalAppearance: { ...appearance, schemaVersion: 4,
    generalPopups: { ...general, fontFamily: popup.fontFamily, fontSize: popup.fontSize, borderRadius: popup.borderRadius, borderColor: popup.borderColor, styleVariant: popup.styleVariant,
      ...Object.fromEntries(['newDefense', 'uploadAta', 'hipoar', 'pdfViewer', 'correction'].flatMap(prefix => [
        [`${prefix}Bg`, popup.surfaceBgColor], [`${prefix}HeaderBg`, popup.headerBgColor], [`${prefix}HeaderTextColor`, popup.headerTextColor], [`${prefix}BtnBg`, popup.actionBgColor], [`${prefix}BtnText`, popup.actionTextColor],
      ])), hipoarAccentColor: popup.actionBgColor,
      correctionTitle: 'Solicitação de Correção',
      correctionSubtitle: 'Descreva a correção necessária para o documento ou registro selecionado.' },
    linkedItems: unifiedAppearanceLinks(appearance.linkedItems), globalPopupStyle: popup,
    tccDetailPopup: { ...appearance.tccDetailPopup, modalBgColor: popup.surfaceBgColor, headerBgColor: popup.headerBgColor, headerTextColor: popup.headerTextColor, primaryActionColor: popup.actionBgColor, primaryActionTextColor: popup.actionTextColor },
    calendarPopup: { ...appearance.calendarPopup, headerThemeMode: 'custom', modalBgColor: popup.surfaceBgColor, cardBgColor: popup.surfaceBgColor, headerBgColor: popup.headerBgColor, headerTextColor: popup.headerTextColor, progressBarCustomColor: popup.actionBgColor },
    loginPopup: { ...appearance.loginPopup, cardBgColor: popup.headerBgColor, cardTextColor: popup.headerTextColor, primaryBtnBg: popup.actionBgColor, primaryBtnTextColor: popup.actionTextColor },
  } };
}
