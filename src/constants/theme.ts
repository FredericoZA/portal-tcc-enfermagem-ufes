/**
 * Unified System Design Theme Constants
 *
 * Padrão visual da atualização 17:
 * - controles de cabeçalho em branco-gelo (#f1f5f9)
 * - estado selecionado em cinza-claro (#e2e8f0)
 * - texto/ícones escuros
 */

export const THEME = {
  // Primary Action Button (mantido para ações de negócio fora das barras de planilha)
  btnPrimary: 'bg-slate-600 hover:bg-slate-700 active:bg-slate-800 text-white border border-slate-500 shadow-2xs transition-all cursor-pointer font-extrabold uppercase tracking-wider',

  // Secondary / neutral controls
  btnSecondary: 'bg-slate-100 hover:bg-slate-200 active:bg-slate-200 text-slate-900 border border-slate-300 shadow-2xs transition-all cursor-pointer font-bold uppercase tracking-wider',

  // Outline Button
  btnOutline: 'bg-slate-100 hover:bg-slate-200 text-slate-900 border border-slate-300 shadow-2xs transition-all cursor-pointer font-bold uppercase tracking-wider',

  // Pill Button (generic primary action; not a table filter)
  btnPillPrimary: 'bg-slate-600 hover:bg-slate-700 active:bg-slate-800 text-white border border-slate-500 rounded-full px-4 py-2 text-xs font-extrabold uppercase tracking-wider shadow-2xs transition-all cursor-pointer active:scale-95 shrink-0',

  // Filter states
  filterActive: 'border-slate-300 bg-slate-200 text-slate-900 shadow-2xs font-black uppercase tracking-wider',
  filterInactive: 'border-slate-300 bg-slate-100 text-slate-900 hover:bg-slate-200 font-bold uppercase tracking-wider',

  // Header icon buttons
  headerIconButton: 'bg-slate-100 hover:bg-slate-200 text-slate-900 border border-slate-300 rounded-full h-7.5 w-7.5 flex items-center justify-center cursor-pointer shadow-2xs transition-all shrink-0',
  headerIconButtonActive: 'bg-slate-200 text-slate-900 border-slate-300',

  // Table gear/search buttons
  gearIconBtn: 'bg-slate-100 hover:bg-slate-200 text-slate-900 border border-slate-300 rounded-full h-7.5 w-7.5 flex items-center justify-center cursor-pointer shadow-2xs transition-all shrink-0',
  lupaIconBtn: 'bg-slate-100 hover:bg-slate-200 text-slate-900 border border-slate-300 rounded-full h-7.5 w-7.5 flex items-center justify-center cursor-pointer shadow-2xs transition-all shrink-0',
};
