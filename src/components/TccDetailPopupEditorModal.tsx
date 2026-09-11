import React from 'react';
import {
  X,
  Palette,
  Eye,
  RotateCcw,
  CheckCircle2,
  FileText,
  Users,
  Award,
  Check,
  GraduationCap,
  Sliders,
  Wand2
} from 'lucide-react';
import { TccDetailPopupFormat, DEFAULT_TCC_DETAIL_POPUP_FORMAT } from '../types/tccDetailFormat';

interface TccDetailPopupEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  format: TccDetailPopupFormat;
  onSave: (newFormat: TccDetailPopupFormat) => void;
}

export interface ColorSchemeOption {
  id: string;
  name: string;
  primaryColor: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
}

// 7 Standard Rainbow Color Schemes
export const RAINBOW_COLOR_SCHEMES: ColorSchemeOption[] = [
  {
    id: 'vermelho',
    name: '1. Vermelho',
    primaryColor: '#dc2626',
    badgeBg: '#fef2f2',
    badgeText: '#991b1b',
    badgeBorder: '#fca5a5'
  },
  {
    id: 'laranja',
    name: '2. Laranja',
    primaryColor: '#ea580c',
    badgeBg: '#fff7ed',
    badgeText: '#c2410c',
    badgeBorder: '#fed7aa'
  },
  {
    id: 'amarelo',
    name: '3. Amarelo',
    primaryColor: '#d97706',
    badgeBg: '#fefce8',
    badgeText: '#a16207',
    badgeBorder: '#fef08a'
  },
  {
    id: 'verde',
    name: '4. Verde',
    primaryColor: '#005830',
    badgeBg: '#e6f4ed',
    badgeText: '#005830',
    badgeBorder: '#a3d9be'
  },
  {
    id: 'azul',
    name: '5. Azul',
    primaryColor: '#2563eb',
    badgeBg: '#eff6ff',
    badgeText: '#1d4ed8',
    badgeBorder: '#93c5fd'
  },
  {
    id: 'indigo',
    name: '6. Índigo',
    primaryColor: '#4f46e5',
    badgeBg: '#eef2ff',
    badgeText: '#3730a3',
    badgeBorder: '#c7d2fe'
  },
  {
    id: 'violeta',
    name: '7. Violeta / Roxo',
    primaryColor: '#9333ea',
    badgeBg: '#faf5ff',
    badgeText: '#7e22ce',
    badgeBorder: '#e9d5ff'
  }
];

export const COLOR_SCHEMES_20 = RAINBOW_COLOR_SCHEMES; // Backward compatibility alias

export function generateDerivedColors(hexColor: string) {
  let hex = hexColor.replace('#', '');
  if (hex.length === 3) {
    hex = hex.split('').map(c => c + c).join('');
  }
  if (hex.length !== 6) {
    return {
      badgeBg: '#e6f4ed',
      badgeText: '#005830',
      badgeBorder: '#a3d9be'
    };
  }

  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);

  const bgR = Math.round(r * 0.10 + 255 * 0.90);
  const bgG = Math.round(g * 0.10 + 255 * 0.90);
  const bgB = Math.round(b * 0.10 + 255 * 0.90);

  const borderR = Math.round(r * 0.45 + 255 * 0.55);
  const borderG = Math.round(g * 0.45 + 255 * 0.55);
  const borderB = Math.round(b * 0.45 + 255 * 0.55);

  const toHex = (n: number) => n.toString(16).padStart(2, '0');

  return {
    badgeBg: `#${toHex(bgR)}${toHex(bgG)}${toHex(bgB)}`,
    badgeText: `#${hex}`,
    badgeBorder: `#${toHex(borderR)}${toHex(borderG)}${toHex(borderB)}`
  };
}

export const TccDetailPopupEditorModal: React.FC<TccDetailPopupEditorModalProps> = ({
  isOpen,
  onClose,
  format,
  onSave
}) => {
  if (!isOpen) return null;

  // Current active colors
  const primaryColor = format.primaryActionColor || '#005830';
  const badgeBg = format.badgeBgColor || '#e6f4ed';
  const badgeText = format.badgeTextColor || primaryColor;
  const badgeBorder = format.badgeBorderColor || '#a3d9be';

  const handleSelectScheme = (scheme: ColorSchemeOption) => {
    const updated: TccDetailPopupFormat = {
      ...format,
      presetTheme: scheme.id,
      primaryActionColor: scheme.primaryColor,
      stateMachineActiveColor: scheme.primaryColor,
      badgeBgColor: scheme.badgeBg,
      badgeTextColor: scheme.badgeText,
      badgeBorderColor: scheme.badgeBorder,
      modalBgColor: '#f8fafc',
      cardBgColor: '#ffffff',
      cardBorderColor: '#e2e8f0'
    };
    onSave(updated);
  };

  const handleCustomPrimaryChange = (newBaseColor: string) => {
    const derived = generateDerivedColors(newBaseColor);
    const updated: TccDetailPopupFormat = {
      ...format,
      presetTheme: 'custom',
      primaryActionColor: newBaseColor,
      stateMachineActiveColor: newBaseColor,
      badgeBgColor: derived.badgeBg,
      badgeTextColor: derived.badgeText,
      badgeBorderColor: derived.badgeBorder
    };
    onSave(updated);
  };

  const handleAutoDerive = () => {
    const derived = generateDerivedColors(primaryColor);
    const updated: TccDetailPopupFormat = {
      ...format,
      badgeBgColor: derived.badgeBg,
      badgeTextColor: derived.badgeText,
      badgeBorderColor: derived.badgeBorder
    };
    onSave(updated);
  };

  const handleResetDefaults = () => {
    onSave(DEFAULT_TCC_DETAIL_POPUP_FORMAT);
  };

  return (
    <div className="fixed inset-0 z-[1000001] flex items-center justify-center p-3 sm:p-5 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full max-w-3xl max-h-[92vh] bg-white rounded-2xl border border-slate-200 shadow-2xl flex flex-col overflow-hidden text-slate-900 animate-in zoom-in-95 duration-150">
        
        {/* Header Bar */}
        <div className="bg-slate-50 border-b border-slate-200 p-3 sm:p-4 shrink-0 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center justify-center shrink-0 shadow-2xs">
              <Palette className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-black text-xs sm:text-sm uppercase tracking-wide text-slate-900">
                Personalização Visual do Painel de TCC
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleResetDefaults}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-700 bg-white hover:bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-300 transition-colors cursor-pointer shadow-2xs"
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-600" />
              <span>Restaurar</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer shrink-0"
              title="Fechar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* FIXED TOP DEMONSTRATION SECTION */}
        <div className="shrink-0 bg-slate-100/90 border-b border-slate-200 p-3 sm:p-4 shadow-2xs">
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
            <div className="bg-slate-50 px-3 py-1.5 border-b border-slate-200 flex items-center justify-between">
              <span className="text-[10.5px] font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <Eye className="w-3.5 h-3.5 text-slate-600" />
                <span>Demonstração Fixa em Tempo Real</span>
              </span>
            </div>

            <div className="p-3 bg-slate-50/60 space-y-2.5">
              {/* Sample Header / Title */}
              <div className="bg-white border border-slate-200 rounded-lg p-2.5 shadow-2xs flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-[10.5px] font-mono font-bold text-slate-700 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded">
                    TCC-2026-0003
                  </span>
                  <span
                    className="text-[10.5px] font-bold px-2 py-0.5 rounded border shadow-2xs transition-all duration-200"
                    style={{
                      backgroundColor: badgeBg,
                      color: badgeText,
                      borderColor: badgeBorder
                    }}
                  >
                    Etapa: ASSINATURA
                  </span>
                </div>

                <button
                  type="button"
                  className="px-3 py-1 rounded-md text-xs font-bold text-white shadow-2xs flex items-center gap-1 transition-all duration-200 cursor-default"
                  style={{ backgroundColor: primaryColor }}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Ação Principal</span>
                </button>
              </div>

              {/* Sample Navigation Tabs */}
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs font-semibold overflow-x-auto">
                <div className="px-2.5 py-1 rounded-md bg-white text-slate-900 shadow-2xs border border-slate-200 flex items-center gap-1.5 font-bold">
                  <FileText className="w-3.5 h-3.5 transition-colors duration-200" style={{ color: primaryColor }} />
                  <span>Ficha Cadastral</span>
                </div>
                <div className="px-2.5 py-1 rounded-md text-slate-600 flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-slate-400" />
                  <span>Banca Examinadora</span>
                </div>
                <div className="px-2.5 py-1 rounded-md text-slate-600 flex items-center gap-1.5">
                  <Award className="w-3.5 h-3.5 text-slate-400" />
                  <span>Avaliação</span>
                </div>
              </div>

              {/* Sample Content Box */}
              <div className="bg-white border border-slate-200 rounded-lg p-2 flex items-center gap-2 text-xs">
                <div
                  className="w-6 h-6 rounded-md flex items-center justify-center shrink-0 border transition-all duration-200"
                  style={{ backgroundColor: badgeBg, color: badgeText, borderColor: badgeBorder }}
                >
                  <GraduationCap className="w-3.5 h-3.5" />
                </div>
                <div>
                  <span className="text-[9.5px] font-bold uppercase text-slate-400 block">Discente Autor</span>
                  <span className="font-bold text-slate-900 leading-none">Lucas Almeida Ribeiro</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Scrollable Main Options Content */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-5 custom-scrollbar bg-slate-50/50">

          <div className="space-y-3">
            <label className="text-xs font-black uppercase tracking-wider text-slate-800 block">
              Selecione uma cor
            </label>

            {/* Grid of 7 Rainbow Schemes */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {RAINBOW_COLOR_SCHEMES.map((scheme) => {
                const isSelected = primaryColor.toLowerCase() === scheme.primaryColor.toLowerCase();
                return (
                  <button
                    key={scheme.id}
                    type="button"
                    onClick={() => handleSelectScheme(scheme)}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between relative ${
                      isSelected
                        ? 'bg-white border-2 border-slate-900 shadow-sm ring-2 ring-slate-900/10'
                        : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50 shadow-2xs'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        {/* Primary Circle */}
                        <div
                          className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 shadow-xs text-white"
                          style={{ backgroundColor: scheme.primaryColor }}
                        >
                          {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                        </div>

                        {/* Tag Preview */}
                        <div
                          className="px-1.5 py-0.5 rounded text-[9.5px] font-extrabold border"
                          style={{
                            backgroundColor: scheme.badgeBg,
                            color: scheme.badgeText,
                            borderColor: scheme.badgeBorder
                          }}
                        >
                          Tag
                        </div>
                      </div>

                      {isSelected && (
                        <span className="text-[9px] font-extrabold uppercase bg-slate-900 text-white px-2 py-0.5 rounded">
                          ATIVO
                        </span>
                      )}
                    </div>

                    <div className="mt-2">
                      <span className="text-xs font-bold text-slate-900 block leading-tight">
                        {scheme.name}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Custom Fine Tuning Grade for Derived Shades */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs space-y-3">
            <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2.5 flex-wrap">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded bg-slate-100 text-slate-700 flex items-center justify-center">
                  <Sliders className="w-3.5 h-3.5" />
                </div>
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-800">
                  Ajuste Fino das Tonalidades Derivadas
                </h3>
              </div>

              <button
                type="button"
                onClick={handleAutoDerive}
                className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-300 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs"
                title="Calcular cores derivadas de fundo, texto e borda com base na cor principal"
              >
                <Wand2 className="w-3.5 h-3.5 text-emerald-700" />
                <span>⚡ Gerar Derivadas</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 pt-1">
              {/* Primary Color Picker */}
              <div className="bg-slate-50 border border-slate-200 p-2.5 rounded-lg space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-700 block">
                  1. Cor Principal
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={primaryColor}
                    onChange={(e) => handleCustomPrimaryChange(e.target.value)}
                    className="w-7 h-7 rounded border border-slate-300 cursor-pointer p-0 bg-transparent shrink-0"
                  />
                  <input
                    type="text"
                    value={primaryColor}
                    onChange={(e) => handleCustomPrimaryChange(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-xs font-mono font-bold text-slate-800 outline-none focus:ring-1 focus:ring-slate-900"
                  />
                </div>
              </div>

              {/* Derived Badge Background Picker */}
              <div className="bg-slate-50 border border-slate-200 p-2.5 rounded-lg space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-700 block">
                  2. Fundo da Tag
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={badgeBg}
                    onChange={(e) => onSave({ ...format, badgeBgColor: e.target.value })}
                    className="w-7 h-7 rounded border border-slate-300 cursor-pointer p-0 bg-transparent shrink-0"
                  />
                  <input
                    type="text"
                    value={badgeBg}
                    onChange={(e) => onSave({ ...format, badgeBgColor: e.target.value })}
                    className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-xs font-mono font-bold text-slate-800 outline-none focus:ring-1 focus:ring-slate-900"
                  />
                </div>
              </div>

              {/* Derived Badge Text Picker */}
              <div className="bg-slate-50 border border-slate-200 p-2.5 rounded-lg space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-700 block">
                  3. Texto da Tag
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={badgeText}
                    onChange={(e) => onSave({ ...format, badgeTextColor: e.target.value })}
                    className="w-7 h-7 rounded border border-slate-300 cursor-pointer p-0 bg-transparent shrink-0"
                  />
                  <input
                    type="text"
                    value={badgeText}
                    onChange={(e) => onSave({ ...format, badgeTextColor: e.target.value })}
                    className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-xs font-mono font-bold text-slate-800 outline-none focus:ring-1 focus:ring-slate-900"
                  />
                </div>
              </div>

              {/* Derived Badge Border Picker */}
              <div className="bg-slate-50 border border-slate-200 p-2.5 rounded-lg space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-700 block">
                  4. Borda da Tag
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={badgeBorder}
                    onChange={(e) => onSave({ ...format, badgeBorderColor: e.target.value })}
                    className="w-7 h-7 rounded border border-slate-300 cursor-pointer p-0 bg-transparent shrink-0"
                  />
                  <input
                    type="text"
                    value={badgeBorder}
                    onChange={(e) => onSave({ ...format, badgeBorderColor: e.target.value })}
                    className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-xs font-mono font-bold text-slate-800 outline-none focus:ring-1 focus:ring-slate-900"
                  />
                </div>
              </div>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};
