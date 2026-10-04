import { portalFontFamily } from './portalFonts';
export const PORTAL_APPEARANCE_LINKS_KEY = 'portal_linked_items_map_v1';
export const PORTAL_APPEARANCE_LINKS_EVENT = 'portal_appearance_links_changed';
export const TABLE_LAYOUTS_EVENT = 'global_table_layouts_changed';
export const GLOBAL_POPUP_STYLE_KEY = 'portal_global_popup_style_v1';
export const GLOBAL_POPUP_STYLE_EVENT = 'portal_global_popup_style_changed';

export interface GlobalPopupStyle {
  surfaceBgColor: string;
  headerBgColor: string;
  headerTextColor: string;
  actionBgColor: string;
  actionTextColor: string;
  fontFamily: string;
  fontSize: string;
  borderRadius: string;
  borderColor: string;
  styleVariant: 'solid' | 'minimal' | 'elevated';
}

export const DEFAULT_GLOBAL_POPUP_STYLE: GlobalPopupStyle = {
  surfaceBgColor: 'var(--portal-surface-panel)',
  headerBgColor: 'var(--portal-brand-header)',
  headerTextColor: 'var(--portal-text-light)',
  actionBgColor: 'var(--portal-brand-action)',
  actionTextColor: 'var(--portal-text-light)',
  fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif',
  fontSize: '14px',
  borderRadius: '16px',
  borderColor: 'var(--portal-border)',
  styleVariant: 'solid',
};

export const DEFAULT_PORTAL_APPEARANCE_LINKS: Record<string, boolean> = {
  site_header: true,
  site_sidebar: true,
  site_footer: true,
  global_table_buttons: true,
  global_table_style: true,
  sheet_calendar: true,
  sheet_repository: true,
  sheet_my_tccs: true,
  sheet_coordinator: true,
  global_popup_style: true,
  popup_tcc_detail: true,
  popup_new_defense: true,
  popup_upload_ata: true,
  popup_hipoar: true,
  popup_pdf_viewer: true,
  popup_login: true,
  popup_correction: true,
};

export const TABLE_STORAGE_BY_EDITOR_TAB: Readonly<Record<string, string>> = {
  sheet_calendar: 'defenses',
  sheet_repository: 'acervo',
  sheet_my_tccs: 'meus_processos',
  sheet_coordinator: 'coordinator',
};

export const TABLE_EDITOR_TAB_BY_STORAGE: Readonly<Record<string, string>> = Object.fromEntries(
  Object.entries(TABLE_STORAGE_BY_EDITOR_TAB).map(([tab, storage]) => [storage, tab]),
);

function normalizePopupStyle(_style: Partial<GlobalPopupStyle> = {}): GlobalPopupStyle {
  return { ...DEFAULT_GLOBAL_POPUP_STYLE, fontFamily: portalFontFamily(DEFAULT_GLOBAL_POPUP_STYLE.fontFamily) };
}

export function unifiedAppearanceLinks(links: Record<string, boolean> = {}): Record<string, boolean> {
  return Object.fromEntries(Object.keys({ ...DEFAULT_PORTAL_APPEARANCE_LINKS, ...links }).map(key => [key, true]));
}

export function loadPortalAppearanceLinks(): Record<string, boolean> {
  return { ...DEFAULT_PORTAL_APPEARANCE_LINKS };
}

export function isPortalAppearanceLinked(itemKey: string): boolean {
  return loadPortalAppearanceLinks()[itemKey] !== false;
}

export function loadGlobalPopupStyle(): GlobalPopupStyle {
  return normalizePopupStyle(DEFAULT_GLOBAL_POPUP_STYLE);
}

export function saveGlobalPopupStyle(_style: GlobalPopupStyle, emitEvent = true): GlobalPopupStyle {
  const normalized = loadGlobalPopupStyle();
  if (typeof window !== 'undefined' && emitEvent) {
    window.dispatchEvent(new CustomEvent(GLOBAL_POPUP_STYLE_EVENT, { detail: normalized }));
  }
  return normalized;
}

export function tableInheritsGlobalAppearance(storageKey: string): boolean {
  const itemKey = TABLE_EDITOR_TAB_BY_STORAGE[storageKey];
  return itemKey ? isPortalAppearanceLinked(itemKey) : true;
}

export function savePortalAppearanceLinks(
  _links: Record<string, boolean>,
  _globalTableFormat?: Record<string, unknown>,
  emitEvents = true,
): Record<string, boolean> {
  const normalized = { ...DEFAULT_PORTAL_APPEARANCE_LINKS };
  if (typeof window !== 'undefined' && emitEvents) {
    window.dispatchEvent(new CustomEvent(PORTAL_APPEARANCE_LINKS_EVENT, { detail: normalized }));
    window.dispatchEvent(new CustomEvent(TABLE_LAYOUTS_EVENT));
  }
  return normalized;
}
