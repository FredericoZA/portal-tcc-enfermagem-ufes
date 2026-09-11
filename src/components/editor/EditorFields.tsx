import React from 'react';
import { Type, Image as ImageIcon } from 'lucide-react';
import { ImageUploadField } from '../ImageUploadField';

export const FONT_OPTIONS = [
  { value: 'Inter, sans-serif', label: 'Inter (Padrão Limpo)' },
  { value: 'Roboto, sans-serif', label: 'Roboto (Moderno & Técnico)' },
  { value: 'Montserrat, sans-serif', label: 'Montserrat (Elegante)' },
  { value: '"Playfair Display", serif', label: 'Playfair Display (Serifado Nobre)' },
  { value: 'Georgia, serif', label: 'Georgia (Acadêmico Clássico)' },
  { value: '"Open Sans", sans-serif', label: 'Open Sans' },
  { value: 'Lato, sans-serif', label: 'Lato' },
  { value: '"Courier New", monospace', label: 'Monospace (Terminal / Código)' },
  { value: 'system-ui, sans-serif', label: 'Sistema Operacional Nativo' },
];

export const ColorField: React.FC<{
  label: string;
  value: string;
  onChange: (val: string) => void;
}> = ({ label, value, onChange }) => (
  <label className="flex items-center justify-between gap-2 p-2.5 bg-white rounded-xl border border-slate-200 text-xs font-bold text-slate-800 cursor-pointer shadow-2xs hover:border-slate-300 transition-all">
    <span className="truncate text-slate-800 font-bold">{label}</span>
    <span className="flex items-center gap-2 shrink-0">
      <span className="text-[10px] font-mono font-extrabold text-slate-500 uppercase">{value || '#ffffff'}</span>
      <input
        type="color"
        value={value || '#ffffff'}
        onChange={(e) => onChange(e.target.value)}
        className="h-7 w-9 cursor-pointer rounded-md border border-slate-300 bg-white p-0.5 shadow-2xs"
      />
    </span>
  </label>
);

export const TextField: React.FC<{
  label: string;
  value: string;
  placeholder?: string;
  onChange: (val: string) => void;
}> = ({ label, value, placeholder, onChange }) => (
  <div className="space-y-1">
    <label className="block text-[10.5px] font-black text-slate-700 uppercase tracking-wider">
      {label}
    </label>
    <input
      type="text"
      value={value || ''}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className="w-full text-xs font-bold bg-white border border-slate-300 rounded-lg p-2.5 text-slate-900 shadow-2xs focus:border-slate-400 focus:ring-1 focus:ring-slate-400 transition-all"
    />
  </div>
);

export const FontSelectorField: React.FC<{
  label: string;
  value: string;
  onChange: (val: string) => void;
}> = ({ label, value, onChange }) => (
  <div className="space-y-1">
    <label className="block text-[10.5px] font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
      <Type className="w-3.5 h-3.5 text-slate-600" />
      <span>{label}</span>
    </label>
    <select
      value={value || 'Inter, sans-serif'}
      onChange={(e) => onChange(e.target.value)}
      className="w-full text-xs font-bold bg-white border border-slate-300 rounded-lg p-2.5 text-slate-900 shadow-2xs focus:border-slate-400 focus:ring-1 focus:ring-slate-400 transition-all cursor-pointer"
    >
      {FONT_OPTIONS.map((f) => (
        <option key={f.value} value={f.value}>
          {f.label}
        </option>
      ))}
    </select>
  </div>
);

export { ImageUploadField };
