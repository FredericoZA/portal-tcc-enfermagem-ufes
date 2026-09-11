export const PORTAL_FONTS = {
  system: 'Inter, ui-sans-serif, system-ui, sans-serif',
  inter: 'Inter, ui-sans-serif, system-ui, sans-serif',
  roboto: 'Roboto, Arial, sans-serif', arial: 'Arial, sans-serif', verdana: 'Verdana, sans-serif',
  georgia: 'Georgia, serif', serif: 'ui-serif, Georgia, serif',
  mono: 'ui-monospace, SFMono-Regular, monospace', rounded: 'Nunito, Inter, ui-sans-serif, sans-serif',
} as const;
export function portalFontKey(value: string | undefined): keyof typeof PORTAL_FONTS {
  const raw = String(value || '').toLowerCase().trim();
  if (Object.hasOwn(PORTAL_FONTS, raw)) return raw as keyof typeof PORTAL_FONTS;
  if (/monospace|courier/.test(raw)) return 'mono';
  if (/nunito|rounded/.test(raw)) return 'rounded';
  for (const key of ['roboto', 'arial', 'verdana', 'georgia', 'inter'] as const) if (raw.startsWith(key)) return key;
  return raw.startsWith('ui-serif') ? 'serif' : 'system';
}
export const portalFontFamily = (value?: string) => PORTAL_FONTS[portalFontKey(value)];
