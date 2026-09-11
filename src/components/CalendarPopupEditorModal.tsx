import React, { useState } from 'react';
import {
  X,
  Palette,
  Layout,
  Sliders,
  Check,
  RotateCcw,
  Sparkles,
  Clock,
  MapPin,
  FileText,
  User,
  Users,
  Shield,
  Eye,
  Type,
  Layers,
  CheckCircle2,
  SlidersHorizontal,
  FolderKanban,
  Tag
} from 'lucide-react';
import {
  CalendarPopupFormat,
  DEFAULT_CALENDAR_POPUP_FORMAT,
  CALENDAR_POPUP_PRESETS,
  saveCalendarPopupConfig
} from '../utils/calendarPopupConfig';

interface CalendarPopupEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialFormat?: CalendarPopupFormat;
  onSave?: (savedFormat: CalendarPopupFormat) => void;
}

const COLOR_PRESETS = [
  { label: 'Verde', hex: '#005830' },
  { label: 'Verde Militar', hex: '#435649' },
  { label: 'Azul Petróleo / Navy', hex: '#1e3a8a' },
  { label: 'Grafite Executivo', hex: '#0f172a' },
  { label: 'Bordô / Vinho', hex: '#7f1d1d' },
  { label: 'Roxo', hex: '#581c87' },
  { label: 'Cinza Ardósia', hex: '#334155' },
  { label: 'Branco / Clean', hex: '#ffffff' },
];

const PROGRESS_COLOR_PRESETS = [
  { label: 'Esmeralda', hex: '#10b981' },
  { label: 'Verde Militar', hex: '#435649' },
  { label: 'Azul Real', hex: '#2563eb' },
  { label: 'Roxo Vibrante', hex: '#8b5cf6' },
  { label: 'Laranja Âmbar', hex: '#f59e0b' },
  { label: 'Rosa Pink', hex: '#ec4899' },
  { label: 'Vermelho Carmim', hex: '#ef4444' },
  { label: 'Azul Ciano', hex: '#06b6d4' },
];

const MODAL_BG_PRESETS = [
  { label: 'Cinza Neutro Claro', hex: '#f1f5f9' },
  { label: 'Branco Puro', hex: '#ffffff' },
  { label: 'Verde Suave', hex: '#f0fdf4' },
  { label: 'Azul Gelo Suave', hex: '#f0f9ff' },
  { label: 'Cinza Médio', hex: '#e2e8f0' },
  { label: 'Creme Quente', hex: '#fbfbf9' },
];

export const CalendarPopupEditorModal: React.FC<CalendarPopupEditorModalProps> = ({
  isOpen,
  onClose,
  initialFormat = DEFAULT_CALENDAR_POPUP_FORMAT,
  onSave,
}) => {
  const [format, setFormat] = useState<CalendarPopupFormat>(() => ({
    ...DEFAULT_CALENDAR_POPUP_FORMAT,
    ...initialFormat,
  }));

  const [activeTab, setActiveTab] = useState<'presets' | 'colors' | 'progress' | 'fields' | 'layout'>('presets');
  const [hasSaved, setHasSaved] = useState(false);

  if (!isOpen) return null;

  const handleUpdate = <K extends keyof CalendarPopupFormat>(key: K, value: CalendarPopupFormat[K]) => {
    setFormat((prev) => {
      const next = { ...prev, [key]: value };
      saveCalendarPopupConfig(next);
      if (onSave) onSave(next);
      return next;
    });
  };

  const handleApplyPreset = (presetFormat: CalendarPopupFormat) => {
    const next = { ...presetFormat };
    setFormat(next);
    saveCalendarPopupConfig(next);
    if (onSave) onSave(next);
  };

  const handleReset = () => {
    const next = { ...DEFAULT_CALENDAR_POPUP_FORMAT };
    setFormat(next);
    saveCalendarPopupConfig(next);
    if (onSave) onSave(next);
  };

  // Preview styling calculations
  const progressPercent = 80;
  const progressHeightClass =
    format.progressBarHeight === 'thin'
      ? 'h-1'
      : format.progressBarHeight === 'thick'
      ? 'h-2.5'
      : format.progressBarHeight === 'extra'
      ? 'h-3.5'
      : 'h-1.5';

  const cardPaddingClass =
    format.cardPadding === 'compact'
      ? 'p-3'
      : format.cardPadding === 'spacious'
      ? 'p-6'
      : 'p-4 sm:p-5';

  const cardRadiusClass = format.cardBorderRadius || 'rounded-xl';

  const shadowClass =
    format.cardShadow === 'none'
      ? 'shadow-none'
      : format.cardShadow === 'medium'
      ? 'shadow-md'
      : format.cardShadow === 'prominent'
      ? 'shadow-lg'
      : 'shadow-xs';

  const borderClass =
    format.cardBorderWidth === 'none'
      ? 'border-0'
      : format.cardBorderWidth === 'medium'
      ? 'border-2'
      : format.cardBorderWidth === 'thick'
      ? 'border-3'
      : 'border';

  const titleSizeClass =
    format.cardTitleSize === 'xs'
      ? 'text-xs'
      : format.cardTitleSize === 'base'
      ? 'text-sm sm:text-base'
      : format.cardTitleSize === 'lg'
      ? 'text-base sm:text-lg'
      : 'text-xs sm:text-sm';

  const titleWeightClass =
    format.cardTitleWeight === 'normal'
      ? 'font-normal'
      : format.cardTitleWeight === 'semibold'
      ? 'font-semibold'
      : format.cardTitleWeight === 'bold'
      ? 'font-bold'
      : 'font-black';

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center z-[1000002] p-3 sm:p-5 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl border border-slate-300 w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden shadow-2xl animate-in zoom-in-95 duration-150">
        
        {/* HEADER DO MODAL */}
        <div className="bg-slate-100 p-4 sm:p-5 flex items-center justify-between border-b border-slate-300 shrink-0">
          <div className="flex items-center gap-3">
            <span className="p-2 bg-white text-slate-800 rounded-xl border border-slate-300 shadow-2xs">
              <Sliders className="w-5 h-5 text-slate-700" />
            </span>
            <div>
              <h2 className="text-sm sm:text-base font-black uppercase tracking-tight text-slate-900 flex items-center gap-2">
                <span>Personalizar Popup do Calendário</span>
                <span className="text-[10px] bg-emerald-100 text-emerald-900 font-extrabold px-2 py-0.5 rounded-full border border-emerald-300">
                  Secretário Master
                </span>
              </h2>
              <p className="text-[11px] text-slate-600 font-medium mt-0.5">
                Configure estilos completos, cores, barras de progresso e visibilidade dos campos com pré-visualização ao vivo.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-slate-400 hover:text-slate-800 hover:bg-slate-200 transition-colors cursor-pointer border border-transparent hover:border-slate-300"
            title="Fechar editor"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* NAVEGAÇÃO DE ABAS */}
        <div className="bg-slate-50 border-b border-slate-200 px-4 pt-2 flex items-center gap-1.5 overflow-x-auto shrink-0 select-none">
          <button
            type="button"
            onClick={() => setActiveTab('presets')}
            className={`flex items-center gap-2 px-3.5 py-2 text-xs font-black uppercase tracking-wider rounded-t-xl border-t border-x transition-all cursor-pointer ${
              activeTab === 'presets'
                ? 'bg-white text-slate-900 border-slate-300 -mb-[1px] shadow-2xs font-black'
                : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>1. Estilos Prontos</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('colors')}
            className={`flex items-center gap-2 px-3.5 py-2 text-xs font-black uppercase tracking-wider rounded-t-xl border-t border-x transition-all cursor-pointer ${
              activeTab === 'colors'
                ? 'bg-white text-slate-900 border-slate-300 -mb-[1px] shadow-2xs font-black'
                : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Palette className="w-3.5 h-3.5 text-emerald-600" />
            <span>2. Cores & Tema</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('progress')}
            className={`flex items-center gap-2 px-3.5 py-2 text-xs font-black uppercase tracking-wider rounded-t-xl border-t border-x transition-all cursor-pointer ${
              activeTab === 'progress'
                ? 'bg-white text-slate-900 border-slate-300 -mb-[1px] shadow-2xs font-black'
                : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-blue-600" />
            <span>3. Barra de Progresso</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('fields')}
            className={`flex items-center gap-2 px-3.5 py-2 text-xs font-black uppercase tracking-wider rounded-t-xl border-t border-x transition-all cursor-pointer ${
              activeTab === 'fields'
                ? 'bg-white text-slate-900 border-slate-300 -mb-[1px] shadow-2xs font-black'
                : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Eye className="w-3.5 h-3.5 text-indigo-600" />
            <span>4. Campos & Rótulos</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('layout')}
            className={`flex items-center gap-2 px-3.5 py-2 text-xs font-black uppercase tracking-wider rounded-t-xl border-t border-x transition-all cursor-pointer ${
              activeTab === 'layout'
                ? 'bg-white text-slate-900 border-slate-300 -mb-[1px] shadow-2xs font-black'
                : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Layout className="w-3.5 h-3.5 text-purple-600" />
            <span>5. Layout & Tipografia</span>
          </button>
        </div>

        {/* CORPO: CONTROLES + PREVIEW EM TEMPO REAL */}
        <div className="flex-1 overflow-y-auto grid grid-cols-1 lg:grid-cols-12 gap-0">
          
          {/* PAINEL ESQUERDO: CONTROLES DA ABA ATIVA (7 colunas) */}
          <div className="lg:col-span-7 p-4 sm:p-6 space-y-5 border-b lg:border-b-0 lg:border-r border-slate-200 overflow-y-auto max-h-[calc(92vh-180px)]">
            
            {/* ABA 1: PRESETS PRONTOS */}
            {activeTab === 'presets' && (
              <div className="space-y-4">
                <div className="border border-slate-200 bg-slate-50 p-4 rounded-xl space-y-3">
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-amber-500" />
                    <span>Estilos Pré-definidos (1 Clique)</span>
                  </h3>
                  <p className="text-xs text-slate-600">
                    Selecione um estilo pronto e refine cada detalhe nas abas seguintes conforme desejar:
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                    {CALENDAR_POPUP_PRESETS.map((preset) => (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => handleApplyPreset(preset.format)}
                        className="p-3 rounded-xl border border-slate-200 bg-white hover:border-slate-400 hover:shadow-xs transition-all text-left group cursor-pointer flex flex-col justify-between"
                      >
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span 
                              className="w-3.5 h-3.5 rounded-full border border-black/10 shrink-0" 
                              style={{ backgroundColor: preset.format.headerBgColor }} 
                            />
                            <span className="text-xs font-black text-slate-900 group-hover:text-slate-950">
                              {preset.name}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 line-clamp-2">
                            {preset.description}
                          </p>
                        </div>
                        <span className="text-[10px] font-bold text-slate-600 group-hover:text-slate-900 mt-2 block">
                          Aplicar este estilo →
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ABA 2: CORES & TEMA */}
            {activeTab === 'colors' && (
              <div className="space-y-4">
                {/* Cabeçalho */}
                <div className="border border-slate-200 bg-slate-50 p-4 rounded-xl space-y-3">
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 flex items-center gap-1.5">
                    <Palette className="w-4 h-4 text-slate-700" />
                    <span>Cabeçalho do Modal</span>
                  </h3>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-slate-700 block">
                      Origem da cor do cabeçalho
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => handleUpdate('headerThemeMode', 'inherit')}
                        className={`p-2.5 rounded-xl border text-xs font-bold text-left transition-all cursor-pointer ${
                          format.headerThemeMode === 'inherit'
                            ? 'bg-white text-slate-900 border-slate-400 ring-2 ring-slate-400 shadow-2xs'
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        <div className="font-extrabold text-slate-900">Sincronizado com a Tabela</div>
                        <div className="text-[10px] text-slate-500 font-normal mt-0.5">Usa o tema da tabela/calendário</div>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleUpdate('headerThemeMode', 'custom')}
                        className={`p-2.5 rounded-xl border text-xs font-bold text-left transition-all cursor-pointer ${
                          format.headerThemeMode === 'custom'
                            ? 'bg-white text-slate-900 border-slate-400 ring-2 ring-slate-400 shadow-2xs'
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        <div className="font-extrabold text-slate-900">Cor Personalizada</div>
                        <div className="text-[10px] text-slate-500 font-normal mt-0.5">Definir cor de fundo e texto</div>
                      </button>
                    </div>
                  </div>

                  {format.headerThemeMode === 'custom' && (
                    <div className="space-y-3 pt-2 border-t border-slate-200">
                      <div className="space-y-1.5">
                        <span className="text-[10px] font-black uppercase text-slate-700 block">
                          Paleta Rápida para o Cabeçalho:
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {COLOR_PRESETS.map((preset) => (
                            <button
                              key={preset.hex}
                              type="button"
                              onClick={() => {
                                handleUpdate('headerBgColor', preset.hex);
                                handleUpdate('headerTextColor', preset.hex === '#ffffff' ? '#0f172a' : '#ffffff');
                              }}
                              className="px-2 py-1 rounded-lg border border-slate-300 text-[10.5px] font-bold flex items-center gap-1.5 bg-white hover:bg-slate-100 cursor-pointer shadow-2xs"
                            >
                              <span className="w-3 h-3 rounded-full border border-black/10" style={{ backgroundColor: preset.hex }} />
                              <span>{preset.label}</span>
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3 pt-1">
                        <div>
                          <label className="text-[10px] font-black uppercase text-slate-600 block mb-1">
                            Cor de Fundo do Topo
                          </label>
                          <div className="flex items-center gap-2">
                            <input
                              type="color"
                              value={format.headerBgColor || '#435649'}
                              onChange={(e) => handleUpdate('headerBgColor', e.target.value)}
                              className="w-8 h-8 rounded-lg border border-slate-300 cursor-pointer p-0.5"
                            />
                            <input
                              type="text"
                              value={format.headerBgColor || '#435649'}
                              onChange={(e) => handleUpdate('headerBgColor', e.target.value)}
                              className="w-full text-xs font-mono font-bold bg-white border border-slate-300 rounded-lg px-2 py-1 uppercase"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="text-[10px] font-black uppercase text-slate-600 block mb-1">
                            Cor do Texto do Topo
                          </label>
                          <div className="flex items-center gap-2">
                            <input
                              type="color"
                              value={format.headerTextColor || '#ffffff'}
                              onChange={(e) => handleUpdate('headerTextColor', e.target.value)}
                              className="w-8 h-8 rounded-lg border border-slate-300 cursor-pointer p-0.5"
                            />
                            <input
                              type="text"
                              value={format.headerTextColor || '#ffffff'}
                              onChange={(e) => handleUpdate('headerTextColor', e.target.value)}
                              className="w-full text-xs font-mono font-bold bg-white border border-slate-300 rounded-lg px-2 py-1 uppercase"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Título Personalizado */}
                  <div className="pt-2 border-t border-slate-200">
                    <label className="text-[10px] font-black uppercase text-slate-700 block mb-1">
                      Título do Cabeçalho
                    </label>
                    <input
                      type="text"
                      value={format.headerCustomTitle || ''}
                      onChange={(e) => handleUpdate('headerCustomTitle', e.target.value)}
                      placeholder="AGENDA DE DEFESAS DE TCC"
                      className="w-full text-xs font-bold bg-white border border-slate-300 rounded-lg px-3 py-1.5 uppercase"
                    />
                  </div>
                </div>

                {/* Cores do Fundo e dos Cards */}
                <div className="border border-slate-200 bg-slate-50 p-4 rounded-xl space-y-3">
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-slate-700" />
                    <span>Cores do Fundo e dos Cards</span>
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-black uppercase text-slate-600 block mb-1">
                        Fundo do Modal (Janela)
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={format.modalBgColor || '#f1f5f9'}
                          onChange={(e) => handleUpdate('modalBgColor', e.target.value)}
                          className="w-8 h-8 rounded-lg border border-slate-300 cursor-pointer p-0.5"
                        />
                        <input
                          type="text"
                          value={format.modalBgColor || '#f1f5f9'}
                          onChange={(e) => handleUpdate('modalBgColor', e.target.value)}
                          className="w-full text-xs font-mono font-bold bg-white border border-slate-300 rounded-lg px-2 py-1 uppercase"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] font-black uppercase text-slate-600 block mb-1">
                        Fundo dos Cards de Defesa
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={format.cardBgColor || '#ffffff'}
                          onChange={(e) => handleUpdate('cardBgColor', e.target.value)}
                          className="w-8 h-8 rounded-lg border border-slate-300 cursor-pointer p-0.5"
                        />
                        <input
                          type="text"
                          value={format.cardBgColor || '#ffffff'}
                          onChange={(e) => handleUpdate('cardBgColor', e.target.value)}
                          className="w-full text-xs font-mono font-bold bg-white border border-slate-300 rounded-lg px-2 py-1 uppercase"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] font-black uppercase text-slate-600 block mb-1">
                        Fundo do Bloco de Dados Interno
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={format.cardInnerBgColor || '#f8fafc'}
                          onChange={(e) => handleUpdate('cardInnerBgColor', e.target.value)}
                          className="w-8 h-8 rounded-lg border border-slate-300 cursor-pointer p-0.5"
                        />
                        <input
                          type="text"
                          value={format.cardInnerBgColor || '#f8fafc'}
                          onChange={(e) => handleUpdate('cardInnerBgColor', e.target.value)}
                          className="w-full text-xs font-mono font-bold bg-white border border-slate-300 rounded-lg px-2 py-1 uppercase"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] font-black uppercase text-slate-600 block mb-1">
                        Cor da Borda dos Cards
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={format.cardBorderColor || '#cbd5e1'}
                          onChange={(e) => handleUpdate('cardBorderColor', e.target.value)}
                          className="w-8 h-8 rounded-lg border border-slate-300 cursor-pointer p-0.5"
                        />
                        <input
                          type="text"
                          value={format.cardBorderColor || '#cbd5e1'}
                          onChange={(e) => handleUpdate('cardBorderColor', e.target.value)}
                          className="w-full text-xs font-mono font-bold bg-white border border-slate-300 rounded-lg px-2 py-1 uppercase"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Sombras e Espessura da Borda */}
                  <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-200">
                    <div>
                      <label className="text-[10px] font-black uppercase text-slate-700 block mb-1">
                        Espessura da Borda do Card
                      </label>
                      <select
                        value={format.cardBorderWidth || 'thin'}
                        onChange={(e) => handleUpdate('cardBorderWidth', e.target.value as any)}
                        className="w-full text-xs font-bold bg-white border border-slate-300 rounded-lg px-2 py-1.5 cursor-pointer"
                      >
                        <option value="none">Sem Borda (0px)</option>
                        <option value="thin">Borda Fina (1px)</option>
                        <option value="medium">Borda Média (2px)</option>
                        <option value="thick">Borda Marcada (3px)</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[10px] font-black uppercase text-slate-700 block mb-1">
                        Sombra e Elevação
                      </label>
                      <select
                        value={format.cardShadow || 'subtle'}
                        onChange={(e) => handleUpdate('cardShadow', e.target.value as any)}
                        className="w-full text-xs font-bold bg-white border border-slate-300 rounded-lg px-2 py-1.5 cursor-pointer"
                      >
                        <option value="none">Sem Sombra (Plano)</option>
                        <option value="subtle">Sombra Suave (Padrão)</option>
                        <option value="medium">Sombra Média Elevada</option>
                        <option value="prominent">Sombra Proeminente</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ABA 3: BARRA DE PROGRESSO */}
            {activeTab === 'progress' && (
              <div className="space-y-4">
                <div className="border border-slate-200 bg-slate-50 p-4 rounded-xl space-y-3">
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <SlidersHorizontal className="w-4 h-4 text-slate-700" />
                      <span>Exibição da Barra de Progresso</span>
                    </span>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={format.showProgressBar !== false}
                        onChange={(e) => handleUpdate('showProgressBar', e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
                    </label>
                  </h3>

                  {format.showProgressBar !== false && (
                    <div className="space-y-3 pt-2">
                      {/* Percentual e Rótulo */}
                      <div className="flex items-center justify-between p-2.5 bg-white rounded-lg border border-slate-200">
                        <div>
                          <div className="text-xs font-bold text-slate-900">Exibir Texto da Etapa e Porcentagem</div>
                          <div className="text-[10px] text-slate-500">Exemplo: "ETAPA 4/5: BANCA EXAMINADORA" e "80%"</div>
                        </div>
                        <input
                          type="checkbox"
                          checked={format.showProgressPercent !== false}
                          onChange={(e) => handleUpdate('showProgressPercent', e.target.checked)}
                          className="w-4 h-4 text-emerald-600 rounded cursor-pointer"
                        />
                      </div>

                      {/* Modo de cor */}
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase text-slate-700 block">
                          Modo de Coloração da Barra
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => handleUpdate('progressBarColorMode', 'dynamic')}
                            className={`p-2.5 rounded-xl border text-xs font-bold text-left transition-all cursor-pointer ${
                              format.progressBarColorMode === 'dynamic' || !format.progressBarColorMode
                                ? 'bg-white text-slate-900 border-slate-400 ring-2 ring-slate-400 shadow-2xs'
                                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                            }`}
                          >
                            <div className="font-extrabold text-slate-900">Dinâmico por Etapa</div>
                            <div className="text-[10px] text-slate-500 font-normal mt-0.5">
                              Muda de cor automaticamente conforme o avanço do TCC
                            </div>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleUpdate('progressBarColorMode', 'custom')}
                            className={`p-2.5 rounded-xl border text-xs font-bold text-left transition-all cursor-pointer ${
                              format.progressBarColorMode === 'custom'
                                ? 'bg-white text-slate-900 border-slate-400 ring-2 ring-slate-400 shadow-2xs'
                                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                            }`}
                          >
                            <div className="font-extrabold text-slate-900">Cor Personalizada Fixa</div>
                            <div className="text-[10px] text-slate-500 font-normal mt-0.5">
                              Cor única definida pelo secretário master
                            </div>
                          </button>
                        </div>
                      </div>

                      {/* Cores da barra personalizada */}
                      {format.progressBarColorMode === 'custom' && (
                        <div className="space-y-2 p-3 bg-white rounded-lg border border-slate-200">
                          <span className="text-[10px] font-black uppercase text-slate-700 block">
                            Paleta de Cores para a Barra:
                          </span>
                          <div className="flex flex-wrap gap-1.5">
                            {PROGRESS_COLOR_PRESETS.map((preset) => (
                              <button
                                key={preset.hex}
                                type="button"
                                onClick={() => handleUpdate('progressBarCustomColor', preset.hex)}
                                className="px-2 py-1 rounded-lg border border-slate-300 text-[10.5px] font-bold flex items-center gap-1.5 bg-slate-50 hover:bg-slate-100 cursor-pointer"
                              >
                                <span className="w-3 h-3 rounded-full" style={{ backgroundColor: preset.hex }} />
                                <span>{preset.label}</span>
                              </button>
                            ))}
                          </div>

                          <div className="grid grid-cols-2 gap-3 pt-2">
                            <div>
                              <label className="text-[10px] font-black uppercase text-slate-600 block mb-1">
                                Cor do Preenchimento
                              </label>
                              <div className="flex items-center gap-2">
                                <input
                                  type="color"
                                  value={format.progressBarCustomColor || '#10b981'}
                                  onChange={(e) => handleUpdate('progressBarCustomColor', e.target.value)}
                                  className="w-8 h-8 rounded-lg border border-slate-300 cursor-pointer p-0.5"
                                />
                                <input
                                  type="text"
                                  value={format.progressBarCustomColor || '#10b981'}
                                  onChange={(e) => handleUpdate('progressBarCustomColor', e.target.value)}
                                  className="w-full text-xs font-mono font-bold bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 uppercase"
                                />
                              </div>
                            </div>

                            <div>
                              <label className="text-[10px] font-black uppercase text-slate-600 block mb-1">
                                Cor do Trilho (Fundo da Barra)
                              </label>
                              <div className="flex items-center gap-2">
                                <input
                                  type="color"
                                  value={format.progressBarTrackColor || '#e2e8f0'}
                                  onChange={(e) => handleUpdate('progressBarTrackColor', e.target.value)}
                                  className="w-8 h-8 rounded-lg border border-slate-300 cursor-pointer p-0.5"
                                />
                                <input
                                  type="text"
                                  value={format.progressBarTrackColor || '#e2e8f0'}
                                  onChange={(e) => handleUpdate('progressBarTrackColor', e.target.value)}
                                  className="w-full text-xs font-mono font-bold bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 uppercase"
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Espessura e Efeitos */}
                      <div className="grid grid-cols-2 gap-3 pt-1">
                        <div>
                          <label className="text-[10px] font-black uppercase text-slate-700 block mb-1">
                            Espessura da Barra
                          </label>
                          <select
                            value={format.progressBarHeight || 'normal'}
                            onChange={(e) => handleUpdate('progressBarHeight', e.target.value as any)}
                            className="w-full text-xs font-bold bg-white border border-slate-300 rounded-lg px-2 py-1.5 cursor-pointer"
                          >
                            <option value="thin">Fina (4px)</option>
                            <option value="normal">Normal (6px)</option>
                            <option value="thick">Encorpada (10px)</option>
                            <option value="extra">Extra Grossa (14px)</option>
                          </select>
                        </div>

                        <div>
                          <label className="text-[10px] font-black uppercase text-slate-700 block mb-1">
                            Efeito de Brilho / Glow
                          </label>
                          <select
                            value={format.progressBarGlow ? 'glow' : 'normal'}
                            onChange={(e) => handleUpdate('progressBarGlow', e.target.value === 'glow')}
                            className="w-full text-xs font-bold bg-white border border-slate-300 rounded-lg px-2 py-1.5 cursor-pointer"
                          >
                            <option value="normal">Padrão Sólido</option>
                            <option value="glow">Brilho Luminoso Suave</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ABA 4: CAMPOS DO CARD & RÓTULOS */}
            {activeTab === 'fields' && (
              <div className="space-y-4">
                <div className="border border-slate-200 bg-slate-50 p-4 rounded-xl space-y-3">
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 flex items-center gap-1.5">
                    <Eye className="w-4 h-4 text-slate-700" />
                    <span>Visibilidade dos Campos no Card</span>
                  </h3>
                  <p className="text-xs text-slate-600">
                    Ative ou desative cada seção individualmente para manter os cards com as informações exatas desejadas:
                  </p>

                  <div className="space-y-2 pt-1">
                    {/* Horário */}
                    <label className="flex items-center justify-between p-2.5 bg-white rounded-lg border border-slate-200 cursor-pointer hover:bg-slate-50">
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-emerald-800" />
                        <span className="text-xs font-bold text-slate-900">Horário da Defesa (⏰ 06:00 às 07:30)</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={format.showTime !== false}
                        onChange={(e) => handleUpdate('showTime', e.target.checked)}
                        className="w-4 h-4 text-emerald-600 rounded cursor-pointer"
                      />
                    </label>

                    {/* Local */}
                    <label className="flex items-center justify-between p-2.5 bg-white rounded-lg border border-slate-200 cursor-pointer hover:bg-slate-50">
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-slate-600" />
                        <span className="text-xs font-bold text-slate-900">Local da Apresentação (📍 Auditório / Sala)</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={format.showLocation !== false}
                        onChange={(e) => handleUpdate('showLocation', e.target.checked)}
                        className="w-4 h-4 text-emerald-600 rounded cursor-pointer"
                      />
                    </label>

                    {/* Protocolo */}
                    <label className="flex items-center justify-between p-2.5 bg-white rounded-lg border border-slate-200 cursor-pointer hover:bg-slate-50">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-slate-600" />
                        <span className="text-xs font-bold text-slate-900">Número do Protocolo (TCC-2026-0002)</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={format.showProtocol !== false}
                        onChange={(e) => handleUpdate('showProtocol', e.target.checked)}
                        className="w-4 h-4 text-emerald-600 rounded cursor-pointer"
                      />
                    </label>

                    {/* Título */}
                    <label className="flex items-center justify-between p-2.5 bg-white rounded-lg border border-slate-200 cursor-pointer hover:bg-slate-50">
                      <div className="flex items-center gap-2">
                        <Type className="w-4 h-4 text-slate-600" />
                        <span className="text-xs font-bold text-slate-900">Título do TCC</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={format.showTitle !== false}
                        onChange={(e) => handleUpdate('showTitle', e.target.checked)}
                        className="w-4 h-4 text-emerald-600 rounded cursor-pointer"
                      />
                    </label>

                    {/* Discentes */}
                    <div className="p-2.5 bg-white rounded-lg border border-slate-200 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-slate-700" />
                          <span className="text-xs font-bold text-slate-900">Discentes Apresentadores</span>
                        </div>
                        <input
                          type="checkbox"
                          checked={format.showStudents !== false}
                          onChange={(e) => handleUpdate('showStudents', e.target.checked)}
                          className="w-4 h-4 text-emerald-600 rounded cursor-pointer"
                        />
                      </div>
                      {format.showStudents !== false && (
                        <div className="pl-6 pt-1 border-t border-slate-100 flex items-center justify-between">
                          <span className="text-[11px] text-slate-600 font-medium">Exibir número de matrícula do aluno</span>
                          <input
                            type="checkbox"
                            checked={format.showStudentRegistration !== false}
                            onChange={(e) => handleUpdate('showStudentRegistration', e.target.checked)}
                            className="w-3.5 h-3.5 text-emerald-600 rounded cursor-pointer"
                          />
                        </div>
                      )}
                    </div>

                    {/* Orientador */}
                    <div className="p-2.5 bg-white rounded-lg border border-slate-200 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Shield className="w-4 h-4 text-slate-700" />
                          <span className="text-xs font-bold text-slate-900">Professor(a) Orientador(a)</span>
                        </div>
                        <input
                          type="checkbox"
                          checked={format.showAdvisor !== false}
                          onChange={(e) => handleUpdate('showAdvisor', e.target.checked)}
                          className="w-4 h-4 text-emerald-600 rounded cursor-pointer"
                        />
                      </div>
                      {format.showAdvisor !== false && (
                        <div className="pl-6 pt-1 border-t border-slate-100 flex items-center justify-between">
                          <span className="text-[11px] text-slate-600 font-medium">Exibir sigla da instituição</span>
                          <input
                            type="checkbox"
                            checked={format.showAdvisorInstitution !== false}
                            onChange={(e) => handleUpdate('showAdvisorInstitution', e.target.checked)}
                            className="w-3.5 h-3.5 text-emerald-600 rounded cursor-pointer"
                          />
                        </div>
                      )}
                    </div>

                    {/* Coorientador */}
                    <label className="flex items-center justify-between p-2.5 bg-white rounded-lg border border-slate-200 cursor-pointer hover:bg-slate-50">
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-slate-600" />
                        <span className="text-xs font-bold text-slate-900">Professor(a) Coorientador(a) (se houver)</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={format.showCoAdvisor !== false}
                        onChange={(e) => handleUpdate('showCoAdvisor', e.target.checked)}
                        className="w-4 h-4 text-emerald-600 rounded cursor-pointer"
                      />
                    </label>

                    {/* Banca Examinadora */}
                    <div className="p-2.5 bg-white rounded-lg border border-slate-200 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Users className="w-4 h-4 text-slate-700" />
                          <span className="text-xs font-bold text-slate-900">Banca Examinadora (Membros)</span>
                        </div>
                        <input
                          type="checkbox"
                          checked={format.showCommittee !== false}
                          onChange={(e) => handleUpdate('showCommittee', e.target.checked)}
                          className="w-4 h-4 text-emerald-600 rounded cursor-pointer"
                        />
                      </div>
                      {format.showCommittee !== false && (
                        <div className="pl-6 pt-1 border-t border-slate-100 flex items-center justify-between">
                          <span className="text-[11px] text-slate-600 font-medium">Exibir instituição dos membros da banca</span>
                          <input
                            type="checkbox"
                            checked={format.showCommitteeInstitution !== false}
                            onChange={(e) => handleUpdate('showCommitteeInstitution', e.target.checked)}
                            className="w-3.5 h-3.5 text-emerald-600 rounded cursor-pointer"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Rótulos Customizáveis */}
                <div className="border border-slate-200 bg-slate-50 p-4 rounded-xl space-y-3">
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 flex items-center gap-1.5">
                    <Tag className="w-4 h-4 text-slate-700" />
                    <span>Personalizar Nomes dos Rótulos</span>
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-black uppercase text-slate-600 block mb-1">
                        Rótulo de Alunos
                      </label>
                      <input
                        type="text"
                        value={format.studentLabel || ''}
                        onChange={(e) => handleUpdate('studentLabel', e.target.value)}
                        placeholder="Discentes Apresentadores:"
                        className="w-full text-xs font-bold bg-white border border-slate-300 rounded-lg px-2.5 py-1.5"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-black uppercase text-slate-600 block mb-1">
                        Rótulo de Orientador
                      </label>
                      <input
                        type="text"
                        value={format.advisorLabel || ''}
                        onChange={(e) => handleUpdate('advisorLabel', e.target.value)}
                        placeholder="Orientador(a):"
                        className="w-full text-xs font-bold bg-white border border-slate-300 rounded-lg px-2.5 py-1.5"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-black uppercase text-slate-600 block mb-1">
                        Rótulo de Coorientador
                      </label>
                      <input
                        type="text"
                        value={format.coAdvisorLabel || ''}
                        onChange={(e) => handleUpdate('coAdvisorLabel', e.target.value)}
                        placeholder="Coorientador(a):"
                        className="w-full text-xs font-bold bg-white border border-slate-300 rounded-lg px-2.5 py-1.5"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-black uppercase text-slate-600 block mb-1">
                        Rótulo da Banca
                      </label>
                      <input
                        type="text"
                        value={format.committeeLabel || ''}
                        onChange={(e) => handleUpdate('committeeLabel', e.target.value)}
                        placeholder="Banca Examinadora:"
                        className="w-full text-xs font-bold bg-white border border-slate-300 rounded-lg px-2.5 py-1.5"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ABA 5: LAYOUT & TIPOGRAFIA */}
            {activeTab === 'layout' && (
              <div className="space-y-4">
                <div className="border border-slate-200 bg-slate-50 p-4 rounded-xl space-y-3">
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 flex items-center gap-1.5">
                    <Layout className="w-4 h-4 text-slate-700" />
                    <span>Disposição e Grade dos Cards</span>
                  </h3>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-slate-700 block">
                      Estrutura de Colunas
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => handleUpdate('columnsLayout', 'auto')}
                        className={`p-2.5 rounded-xl border text-xs font-bold text-center transition-all cursor-pointer ${
                          format.columnsLayout === 'auto' || !format.columnsLayout
                            ? 'bg-white text-slate-900 border-slate-400 ring-2 ring-slate-400 shadow-2xs'
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        <div className="font-extrabold text-slate-900">Automático</div>
                        <div className="text-[10px] text-slate-500 font-normal">1 col celular, 2 tela ampla</div>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleUpdate('columnsLayout', '1')}
                        className={`p-2.5 rounded-xl border text-xs font-bold text-center transition-all cursor-pointer ${
                          format.columnsLayout === '1'
                            ? 'bg-white text-slate-900 border-slate-400 ring-2 ring-slate-400 shadow-2xs'
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        <div className="font-extrabold text-slate-900">1 Coluna Fixa</div>
                        <div className="text-[10px] text-slate-500 font-normal">Lista vertical única</div>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleUpdate('columnsLayout', '2')}
                        className={`p-2.5 rounded-xl border text-xs font-bold text-center transition-all cursor-pointer ${
                          format.columnsLayout === '2'
                            ? 'bg-white text-slate-900 border-slate-400 ring-2 ring-slate-400 shadow-2xs'
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        <div className="font-extrabold text-slate-900">2 Colunas Lado a Lado</div>
                        <div className="text-[10px] text-slate-500 font-normal">Cards paralelos</div>
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-200">
                    <div>
                      <label className="text-[10px] font-black uppercase text-slate-700 block mb-1">
                        Espaçamento Interno (Padding)
                      </label>
                      <select
                        value={format.cardPadding || 'normal'}
                        onChange={(e) => handleUpdate('cardPadding', e.target.value as any)}
                        className="w-full text-xs font-bold bg-white border border-slate-300 rounded-lg px-2 py-1.5 cursor-pointer"
                      >
                        <option value="compact">Compacto (Menor altura)</option>
                        <option value="normal">Padrão Equilibrado</option>
                        <option value="spacious">Espaçoso (Mais respiro)</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[10px] font-black uppercase text-slate-700 block mb-1">
                        Arredondamento dos Cantos
                      </label>
                      <select
                        value={format.cardBorderRadius || 'rounded-xl'}
                        onChange={(e) => handleUpdate('cardBorderRadius', e.target.value as any)}
                        className="w-full text-xs font-bold bg-white border border-slate-300 rounded-lg px-2 py-1.5 cursor-pointer"
                      >
                        <option value="rounded-none">Cantos Retos (0px)</option>
                        <option value="rounded-lg">Suave (8px)</option>
                        <option value="rounded-xl">Médio (12px)</option>
                        <option value="rounded-2xl">Arredondado (16px)</option>
                        <option value="rounded-3xl">Ultra Arredondado (24px)</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Tipografia do Título */}
                <div className="border border-slate-200 bg-slate-50 p-4 rounded-xl space-y-3">
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 flex items-center gap-1.5">
                    <Type className="w-4 h-4 text-slate-700" />
                    <span>Tipografia do Título do Trabalho</span>
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="text-[10px] font-black uppercase text-slate-700 block mb-1">
                        Tamanho do Texto
                      </label>
                      <select
                        value={format.cardTitleSize || 'sm'}
                        onChange={(e) => handleUpdate('cardTitleSize', e.target.value as any)}
                        className="w-full text-xs font-bold bg-white border border-slate-300 rounded-lg px-2 py-1.5 cursor-pointer"
                      >
                        <option value="xs">Pequeno (11px)</option>
                        <option value="sm">Médio (13px)</option>
                        <option value="base">Grande (15px)</option>
                        <option value="lg">Extra Grande (17px)</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[10px] font-black uppercase text-slate-700 block mb-1">
                        Peso da Fonte
                      </label>
                      <select
                        value={format.cardTitleWeight || 'black'}
                        onChange={(e) => handleUpdate('cardTitleWeight', e.target.value as any)}
                        className="w-full text-xs font-bold bg-white border border-slate-300 rounded-lg px-2 py-1.5 cursor-pointer"
                      >
                        <option value="normal">Normal</option>
                        <option value="semibold">Semibold</option>
                        <option value="bold">Negrito (Bold)</option>
                        <option value="black">Ultra Black</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[10px] font-black uppercase text-slate-700 block mb-1">
                        Letras Maiúsculas
                      </label>
                      <select
                        value={format.cardTitleUppercase !== false ? 'uppercase' : 'normal'}
                        onChange={(e) => handleUpdate('cardTitleUppercase', e.target.value === 'uppercase')}
                        className="w-full text-xs font-bold bg-white border border-slate-300 rounded-lg px-2 py-1.5 cursor-pointer"
                      >
                        <option value="uppercase">MAIÚSCULAS (Caixa Alta)</option>
                        <option value="normal">Normal (Como Digitado)</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-black uppercase text-slate-600 block mb-1">
                      Cor do Título do TCC
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={format.cardTitleColor || '#0f172a'}
                        onChange={(e) => handleUpdate('cardTitleColor', e.target.value)}
                        className="w-8 h-8 rounded-lg border border-slate-300 cursor-pointer p-0.5"
                      />
                      <input
                        type="text"
                        value={format.cardTitleColor || '#0f172a'}
                        onChange={(e) => handleUpdate('cardTitleColor', e.target.value)}
                        className="w-full text-xs font-mono font-bold bg-white border border-slate-300 rounded-lg px-2 py-1 uppercase"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* PAINEL DIREITO: PRÉ-VISUALIZAÇÃO AO VIVO (5 colunas) */}
          <div className="lg:col-span-5 p-4 sm:p-6 bg-slate-900 flex flex-col justify-between overflow-y-auto max-h-[calc(92vh-180px)] select-none">
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
                  <Eye className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Pré-visualização em Tempo Real</span>
                </span>
                <span className="text-[9.5px] font-mono text-slate-500 bg-slate-800 px-2 py-0.5 rounded-md">
                  Amostra do Card
                </span>
              </div>

              {/* CARD DE EXEMPLO */}
              <div
                className={`${cardPaddingClass} ${cardRadiusClass} ${borderClass} ${shadowClass} transition-all space-y-3.5`}
                style={{
                  backgroundColor: format.cardBgColor || '#ffffff',
                  borderColor: format.cardBorderColor || '#cbd5e1',
                }}
              >
                {/* Linha Superior: Horário + Local + Protocolo */}
                {(format.showTime !== false || format.showLocation !== false || format.showProtocol !== false) && (
                  <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-200 text-xs">
                    {format.showTime !== false ? (
                      <div className="flex items-center gap-1.5 font-black" style={{ color: format.timeTextColor || '#065f46' }}>
                        <Clock className="w-4 h-4 shrink-0" />
                        <span>06:00 às 07:30</span>
                      </div>
                    ) : <div />}

                    <div className="flex items-center gap-1.5">
                      {format.showLocation !== false && (
                        <span 
                          className="text-[10px] font-bold px-2 py-0.5 rounded-md truncate max-w-[120px]"
                          style={{ backgroundColor: format.locationBadgeBg || '#f1f5f9', color: '#475569' }}
                        >
                          📍 Auditório Rosa
                        </span>
                      )}
                      {format.showProtocol !== false && (
                        <span 
                          className="font-mono font-bold px-2 py-0.5 rounded-md border border-slate-250 text-[10px]"
                          style={{ backgroundColor: format.protocolBadgeBg || '#f1f5f9', color: format.protocolBadgeText || '#1e293b' }}
                        >
                          TCC-2026-0002
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Título do TCC */}
                {format.showTitle !== false && (
                  <h4
                    className={`${titleSizeClass} ${titleWeightClass} leading-snug ${
                      format.cardTitleUppercase !== false ? 'uppercase' : ''
                    }`}
                    style={{ color: format.cardTitleColor || '#0f172a' }}
                  >
                    O CUIDADO DE ENFERMAGEM À SAÚDE MENTAL NA ATENÇÃO PRIMÁRIA
                  </h4>
                )}

                {/* Bloco Interno: Alunos e Professores */}
                {(format.showStudents !== false || format.showAdvisor !== false || format.showCoAdvisor !== false || format.showCommittee !== false) && (
                  <div
                    className="text-xs space-y-2 p-3 rounded-lg border border-slate-200 transition-colors"
                    style={{ backgroundColor: format.cardInnerBgColor || '#f8fafc' }}
                  >
                    {format.showStudents !== false && (
                      <div>
                        <span className="font-black text-slate-500 text-[10px] uppercase tracking-wider block mb-0.5">
                          {format.studentLabel || 'Discentes Apresentadores:'}
                        </span>
                        <div className="font-black text-slate-900 text-xs flex items-center gap-1.5">
                          <span>MARIANA ALVES DA SILVA</span>
                          {format.showStudentRegistration !== false && (
                            <span className="text-[10px] text-slate-500 font-mono font-normal">
                              (202210045)
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    {format.showAdvisor !== false && (
                      <div>
                        <span className="font-black text-slate-500 text-[10px] uppercase tracking-wider block">
                          {format.advisorLabel || 'Orientador(a):'}
                        </span>
                        <div className="font-bold text-slate-900 text-xs">
                          PROFª. DRª. ANA CAROLINA MENDES
                          {format.showAdvisorInstitution !== false && (
                            <span className="text-[10px] text-slate-500 font-mono font-normal ml-1">
                              (IES)
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    {format.showCoAdvisor !== false && (
                      <div>
                        <span className="font-black text-slate-500 text-[10px] uppercase tracking-wider block">
                          {format.coAdvisorLabel || 'Coorientador(a):'}
                        </span>
                        <div className="font-bold text-slate-900 text-xs">
                          PROF. DR. RODRIGO SANTOS
                          {format.showAdvisorInstitution !== false && (
                            <span className="text-[10px] text-slate-500 font-mono font-normal ml-1">
                              (IES)
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    {format.showCommittee !== false && (
                      <div>
                        <span className="font-black text-slate-500 text-[10px] uppercase tracking-wider block">
                          {format.committeeLabel || 'Banca Examinadora:'}
                        </span>
                        <div className="text-[11px] text-slate-800 space-y-0.5 mt-0.5">
                          <div>
                            • PROFª. DRª. HELENA COSTA{' '}
                            {format.showCommitteeInstitution !== false && (
                              <span className="text-[10px] text-slate-500 font-mono">(IES)</span>
                            )}
                          </div>
                          <div>
                            • DR. MARCELO NOGUEIRA{' '}
                            {format.showCommitteeInstitution !== false && (
                              <span className="text-[10px] text-slate-500 font-mono">(HUCAM)</span>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Barra de Progresso */}
                {format.showProgressBar !== false && (
                  <div className="space-y-1 pt-2 border-t border-slate-100">
                    {format.showProgressPercent !== false && (
                      <div className="flex items-center justify-between text-[9.5px] font-semibold text-slate-600 uppercase">
                        <span>ETAPA 4/5: BANCA EXAMINADORA</span>
                        <span className="text-slate-900 font-mono font-bold">{progressPercent}%</span>
                      </div>
                    )}
                    <div
                      className={`w-full ${progressHeightClass} rounded-full overflow-hidden`}
                      style={{ backgroundColor: format.progressBarTrackColor || '#e2e8f0' }}
                    >
                      <div
                        className={`${progressHeightClass} rounded-full transition-all duration-300 ${
                          format.progressBarGlow ? 'shadow-[0_0_8px_rgba(16,185,129,0.7)]' : ''
                        }`}
                        style={{
                          width: `${progressPercent}%`,
                          backgroundColor:
                            format.progressBarColorMode === 'custom'
                              ? format.progressBarCustomColor || '#10b981'
                              : '#10b981',
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="pt-4 border-t border-slate-800 text-[11px] text-slate-400">
              💡 As preferências são salvas instantaneamente e sincronizadas com todas as visualizações do calendário.
            </div>
          </div>
        </div>

        {/* RODAPÉ DO MODAL COM BOTÕES DE AÇÃO */}
        <div className="bg-slate-100 p-4 sm:p-5 flex items-center justify-between gap-3 border-t border-slate-300 shrink-0">
          <button
            type="button"
            onClick={handleReset}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-200 rounded-xl border border-slate-300 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Restaurar Padrão</span>
          </button>
        </div>

      </div>
    </div>
  );
};
