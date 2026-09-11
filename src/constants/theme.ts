/**
 * Unified System Design Theme Constants
 * 
 * Standardized gray color palette for buttons, table filters, gear icons (engrenagens),
 * and search loops (lupas) across all pages of the application.
 * 
 * The primary button gray is 20% lighter than dark charcoal (slate-600 / slate-700).
 */

export const THEME = {
  // Primary Action Button (Standardized Charcoal Gray - 20% lighter)
  btnPrimary: 'bg-slate-600 hover:bg-slate-700 active:bg-slate-800 text-white border border-slate-500 shadow-2xs transition-all cursor-pointer font-extrabold uppercase tracking-wider',
  
  // Secondary Light Gray Button
  btnSecondary: 'bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-800 border border-slate-300 shadow-2xs transition-all cursor-pointer font-bold uppercase tracking-wider',
  
  // Outline Button
  btnOutline: 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 shadow-2xs transition-all cursor-pointer font-bold uppercase tracking-wider',
  
  // Pill Button (Rounded Full)
  btnPillPrimary: 'bg-slate-600 hover:bg-slate-700 active:bg-slate-800 text-white border border-slate-500 rounded-full px-4 py-2 text-xs font-extrabold uppercase tracking-wider shadow-2xs transition-all cursor-pointer active:scale-95 shrink-0',
  
  // Filter Pill Active State (Standardized Charcoal Gray)
  filterActive: 'border-slate-600 bg-slate-600 text-white shadow-2xs font-black uppercase tracking-wider',
  
  // Filter Pill Inactive State
  filterInactive: 'border-slate-300 bg-slate-100 text-slate-700 hover:bg-slate-200 font-bold uppercase tracking-wider',
  
  // Header Icon Buttons (Search Lupa & Settings Engrenagem)
  headerIconButton: 'bg-slate-600 hover:bg-slate-700 text-white border border-slate-500 rounded-full h-7.5 w-7.5 flex items-center justify-center cursor-pointer shadow-2xs transition-all shrink-0',
  headerIconButtonActive: 'bg-slate-700 text-white border-slate-400',
  
  // Table Gear (Engrenagem) & Search (Lupa) Icon Styles
  gearIconBtn: 'bg-slate-600 hover:bg-slate-700 text-white border border-slate-500 rounded-full h-7.5 w-7.5 flex items-center justify-center cursor-pointer shadow-2xs transition-all shrink-0',
  lupaIconBtn: 'bg-slate-600 hover:bg-slate-700 text-white border border-slate-500 rounded-full h-7.5 w-7.5 flex items-center justify-center cursor-pointer shadow-2xs transition-all shrink-0',
};
