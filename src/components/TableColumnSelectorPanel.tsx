import React, { useState } from 'react';
import { Shield, Lock, ArrowUp, ArrowDown, RotateCcw, Check, List, Star } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { loadGlobalTableConfig } from '../utils/tableFormatters';

export interface ColumnDef {
  key: string;
  label: string;
  icon?: string;
  isFixed?: boolean;
}

export interface TableColumnSelectorPanelProps {
  storageKey: string; // Canonical key per table, e.g. 'defenses', 'acervo', 'meus_processos'
  tabTitle: string; // e.g. "Defesas Públicas", "Repositório de TCCs", "Meus Processos"
  allColumns: ColumnDef[];
  columnOrder: string[];
  setColumnOrder: React.Dispatch<React.SetStateAction<string[]>>;
  visibleColumns: Record<string, boolean>;
  setVisibleColumns: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  defaultColumnOrder: string[];
  defaultVisibleColumns: Record<string, boolean>;
  onClose: () => void;
}

export type HeaderTheme = 
  | 'militar' 
  | 'emerald' 
  | 'forest'
  | 'steel' 
  | 'royal'
  | 'ocean'
  | 'teal' 
  | 'red' 
  | 'wine'
  | 'marsala'
  | 'orange' 
  | 'amber'
  | 'purple' 
  | 'indigo'
  | 'dark' 
  | 'slate' 
  | 'light' 
  | 'clean' 
  | 'colored';
export type HeaderTextColor = 'dark' | 'white' | 'colored' | 'muted' | 'custom';
export type BodyTextColor = 'dark' | 'neutral' | 'high-contrast' | 'colored' | 'custom';
export type CellAlignment = 'center' | 'left';
export type TableDensity = 'ultra_compact' | 'compact' | 'normal' | 'comfortable' | 'spacious';
export type TableFontSize = 'xs' | 'sm' | 'base' | 'lg';
export type TableFontFamily = 'system' | 'inter' | 'roboto' | 'arial' | 'verdana' | 'georgia' | 'serif' | 'mono' | 'rounded';
export type ProgressStyle = 'circle' | 'bar' | 'badge';
export type FilterChipStyle = 'auto' | 'militar' | 'emerald' | 'steel' | 'teal' | 'red' | 'orange' | 'purple' | 'dark' | 'slate' | 'light' | 'clean' | 'custom';
export type FirstColHighlight = 'emerald' | 'militar' | 'steel' | 'amber' | 'slate' | 'contextual' | 'custom';
export type TableRadius = 'sharp' | 'subtle' | 'rounded' | 'large';

export type FilterColorMode = 'full' | 'number_only';
export type FilterColorScheme = 'vibrant' | 'theme' | 'custom';

export interface FilterItemConfig {
  key: string;
  label: string;
  emoji?: string;
  dotColor?: string;
  bgColor?: string;
  textColor?: string;
  borderColor?: string;
  badgeBgColor?: string;
  badgeTextColor?: string;
}

export interface TableTextFormat {
  // === 1. CABEÇALHO (HEADER) ===
  boldHeaders?: boolean;
  italicHeaders?: boolean;
  wrapHeaders?: boolean;
  headerFontSize?: TableFontSize;
  headerTheme?: HeaderTheme;
  headerTextColor?: HeaderTextColor;
  headerAlignment?: CellAlignment;
  firstColAlignment?: CellAlignment;
  headerUppercase?: boolean;
  headerCasing?: 'uppercase' | 'capitalize' | 'normal';
  headerPadding?: 'compact' | 'normal' | 'spacious';
  headerShowEmojis?: boolean;
  customHeaderColor?: string;
  customHeaderSecondaryColor?: string;
  customHeaderTextColor?: string;
  customHeaderEmoji?: string; // Custom emoticon/emoji for header icon/title
  headerIconStyle?: 'boxed' | 'emoji-only' | 'hidden'; // Header emoticon display format
  customTableTitle?: string; // Overrides table banner title
  customFilterTitle?: string; // Overrides filter section prefix (e.g. "FILTRAR:")

  // === 2. FILTROS & BARRA SUPERIOR (TOOLBAR / BOTÕES) ===
  filterStyle?: FilterChipStyle;
  filterColorMode?: FilterColorMode; // 'full' (coloração no botão todo) ou 'number_only' (coloração só no número)
  filterColorScheme?: FilterColorScheme; // 'vibrant' | 'theme' | 'custom'
  filterItemsConfig?: Record<string, FilterItemConfig>; // Customization for each filter chip
  firstColHighlight?: FirstColHighlight;
  toolbarButtonColor?: string;
  toolbarButtonTextColor?: string;
  toolbarButtonBorderColor?: string;
  toolbarButtonHoverColor?: string;
  toolbarButtonShape?: 'circle' | 'rounded' | 'square';
  buttonBorderRadius?: string;
  toolbarButtonSize?: 'sm' | 'normal' | 'lg';
  toolbarButtonBorderWidth?: 'none' | 'thin' | 'medium';
  toolbarButtonOpacity?: number; // 0.1 to 1.0 or solid
  customFirstColumnColor?: string;
  customDividerColor?: string;
  customFilterDividerColor?: string;
  
  // Custom Filter Chip Colors
  customFilterActiveBg?: string;
  customFilterActiveText?: string;
  customFilterActiveBorder?: string;
  customFilterInactiveBg?: string;
  customFilterInactiveText?: string;
  customFilterInactiveBorder?: string;

  // Custom Action Buttons texts & emojis
  showNewDefenseButton?: boolean;
  newDefenseButtonText?: string;
  newDefenseButtonEmoji?: string;
  showWhatsappButton?: boolean;
  whatsappButtonText?: string;
  whatsappButtonEmoji?: string;
  whatsappButtonUrl?: string;
  showCadastrarTrabalhoButton?: boolean;
  cadastrarTrabalhoButtonText?: string;
  cadastrarTrabalhoButtonEmoji?: string;
  showDownloadDadosButton?: boolean;
  downloadDadosButtonText?: string;
  downloadDadosButtonEmoji?: string;
  showEnviarAssinadosButton?: boolean;
  enviarAssinadosButtonText?: string;
  enviarAssinadosButtonEmoji?: string;
  showBaixarSelecionadosButton?: boolean;
  baixarSelecionadosButtonText?: string;
  baixarSelecionadosButtonEmoji?: string;
  searchButtonText?: string;
  searchButtonEmoji?: string;
  refreshButtonEmoji?: string;
  settingsButtonEmoji?: string;

  // Filter chips custom labels & emojis
  filterAllLabel?: string;
  filterAllEmoji?: string;
  filterPendingLabel?: string;
  filterPendingEmoji?: string;
  filterConcludedLabel?: string;
  filterConcludedEmoji?: string;

  // === 3. TEXTO DA PLANILHA / CÉLULAS (BODY / CELLS) ===
  boldCells?: boolean;
  italicCells?: boolean;
  wrapCells?: boolean;
  fontSize?: TableFontSize;
  density?: TableDensity;
  cellPadding?: TableDensity;
  cellAlignment?: CellAlignment;
  cellTextColor?: BodyTextColor;
  cellShowEmojis?: boolean;
  zebraStriping?: boolean;
  showBorders?: boolean;
  tableRadius?: TableRadius;
  fontFamily?: TableFontFamily;
  customCellTextColor?: string;
  progressStyle?: ProgressStyle;
  progressColorMode?: 'dynamic' | 'custom';
  customProgressColor?: string;
  rowHoverEffect?: 'highlight' | 'subtle' | 'scale' | 'none';
  tableShadow?: 'none' | 'subtle' | 'medium' | 'prominent';
  statusBadgeStyle?: 'pill' | 'square' | 'dot' | 'subtle_tag';

  // === 4. EMOJIS POR COLUNA ESPECÍFICA ===
  columnEmojis?: Record<string, boolean>;
  columnBold?: Record<string, boolean>;

  // === 5. LARGURA ESPECÍFICA POR COLUNA ===
  columnWidths?: Record<string, string>;
  columnDensity?: 'compact' | 'normal' | 'wide';
}

export const DEFAULT_TABLE_TEXT_FORMAT: TableTextFormat = {
  // Cabeçalho
  boldHeaders: false,
  italicHeaders: false,
  wrapHeaders: true,
  headerFontSize: 'base',
  headerTheme: 'slate',
  headerTextColor: 'dark',
  headerAlignment: 'center',
  headerUppercase: false,
  headerCasing: 'normal',
  headerPadding: 'normal',
  headerShowEmojis: false,
  customHeaderColor: 'var(--portal-brand-header)',
  customHeaderSecondaryColor: 'var(--portal-brand-header)',
  customHeaderTextColor: 'var(--portal-text-light)',
  customHeaderEmoji: '',
  headerIconStyle: 'boxed',
  customTableTitle: '',
  customFilterTitle: 'FILTRAR:',

  // Filtros e Destaques
  filterStyle: 'slate',
  filterColorMode: 'number_only',
  filterColorScheme: 'theme',
  filterItemsConfig: {
    aluno: { key: 'aluno', label: 'ALUNO', emoji: '', dotColor: '#eab308', bgColor: '#fef9c3', textColor: '#713f12', borderColor: '#eab308', badgeBgColor: '#eab308', badgeTextColor: '#ffffff' },
    banca: { key: 'banca', label: 'BANCA', emoji: '', dotColor: '#f97316', bgColor: '#fff7ed', textColor: '#7c2d12', borderColor: '#f97316', badgeBgColor: '#f97316', badgeTextColor: '#ffffff' },
    avaliador: { key: 'avaliador', label: 'AVALIADOR', emoji: '', dotColor: '#0284c7', bgColor: '#f0f9ff', textColor: '#0369a1', borderColor: '#38bdf8', badgeBgColor: '#0284c7', badgeTextColor: '#ffffff' },
    visualizador: { key: 'visualizador', label: 'VISUALIZADOR', emoji: '', dotColor: '#64748b', bgColor: '#f8fafc', textColor: '#1e293b', borderColor: '#94a3b8', badgeBgColor: '#64748b', badgeTextColor: '#ffffff' },
    modelos: { key: 'modelos', label: 'MODELOS', emoji: '', dotColor: '#f97316', bgColor: '#fff7ed', textColor: '#7c2d12', borderColor: '#f97316', badgeBgColor: '#f97316', badgeTextColor: '#ffffff' },
    formularios: { key: 'formularios', label: 'FORMULÁRIOS', emoji: '', dotColor: '#0284c7', bgColor: '#f0f9ff', textColor: '#0369a1', borderColor: '#38bdf8', badgeBgColor: '#0284c7', badgeTextColor: '#ffffff' },
    emails: { key: 'emails', label: 'E-MAILS', emoji: '', dotColor: '#10b981', bgColor: '#ecfdf5', textColor: '#065f46', borderColor: '#34d399', badgeBgColor: '#10b981', badgeTextColor: '#ffffff' },
    all: { key: 'all', label: 'TODAS', emoji: '', dotColor: '#2563eb', bgColor: '#eff6ff', textColor: '#1e3a8a', borderColor: '#60a5fa', badgeBgColor: '#2563eb', badgeTextColor: '#ffffff' },
    pending: { key: 'pending', label: 'A DEFENDER', emoji: '', dotColor: '#eab308', bgColor: '#fef9c3', textColor: '#713f12', borderColor: '#eab308', badgeBgColor: '#eab308', badgeTextColor: '#ffffff' },
    concluded: { key: 'concluded', label: 'JÁ DEFENDIDAS', emoji: '', dotColor: '#16a34a', bgColor: '#f0fdf4', textColor: '#14532d', borderColor: '#4ade80', badgeBgColor: '#16a34a', badgeTextColor: '#ffffff' },
  },
  firstColHighlight: 'slate',
  toolbarButtonColor: '#ffffff',
  toolbarButtonTextColor: '#0f172a',
  toolbarButtonBorderColor: '',
  toolbarButtonShape: 'rounded',
  toolbarButtonSize: 'normal',
  toolbarButtonBorderWidth: 'thin',
  customFirstColumnColor: '#0f172a',
  customFilterActiveBg: '',
  customFilterActiveText: '',
  customFilterActiveBorder: '',
  customFilterInactiveBg: '',
  customFilterInactiveText: '',
  customFilterInactiveBorder: '',

  // Ações e Textos dos Botões do Topo
  showNewDefenseButton: true,
  newDefenseButtonText: 'Nova Defesa',
  newDefenseButtonEmoji: '',
  showWhatsappButton: true,
  whatsappButtonText: 'WhatsApp Secretária',
  whatsappButtonEmoji: '',
  whatsappButtonUrl: 'https://wa.me/message/HUKHX3BJAWNHJ1',
  showCadastrarTrabalhoButton: true,
  cadastrarTrabalhoButtonText: 'Cadastrar Trabalho',
  cadastrarTrabalhoButtonEmoji: '',
  showDownloadDadosButton: true,
  downloadDadosButtonText: 'Download dos Dados',
  downloadDadosButtonEmoji: '',
  showEnviarAssinadosButton: true,
  enviarAssinadosButtonText: 'Enviar Assinados',
  enviarAssinadosButtonEmoji: '',
  showBaixarSelecionadosButton: true,
  baixarSelecionadosButtonText: 'Baixar Selecionados',
  baixarSelecionadosButtonEmoji: '',
  searchButtonText: 'Buscar...',
  searchButtonEmoji: '',
  refreshButtonEmoji: '',
  settingsButtonEmoji: '',

  // Chips dos Filtros
  filterAllLabel: 'TODAS',
  filterAllEmoji: '',
  filterPendingLabel: 'A DEFENDER',
  filterPendingEmoji: '',
  filterConcludedLabel: 'JÁ DEFENDIDAS',
  filterConcludedEmoji: '',

  // Células
  boldCells: false,
  italicCells: false,
  wrapCells: true,
  fontSize: 'base',
  density: 'normal',
  cellPadding: 'normal',
  cellAlignment: 'center',
  cellTextColor: 'dark',
  cellShowEmojis: false,
  zebraStriping: false,
  showBorders: true,
  tableRadius: 'large',
  fontFamily: 'system',
  customCellTextColor: 'var(--portal-text-dark)',
  progressStyle: 'circle',
  progressColorMode: 'dynamic',
  customProgressColor: 'var(--portal-brand-action)',
  rowHoverEffect: 'subtle',
  tableShadow: 'subtle',
  statusBadgeStyle: 'pill',

  // Emojis por coluna
  columnEmojis: {},
  columnBold: {},
  columnWidths: {},
  columnDensity: 'normal',
};

// Helper to load table config from localStorage
export function loadTableConfig(
  storageKey: string,
  defaultOrder: string[],
  defaultVisible: Record<string, boolean>,
  defaultRecordsLimit: number | 'all' = 25
) {
  const globalFormat = loadGlobalTableConfig();
  if (typeof window === 'undefined') {
    return {
      columnOrder: defaultOrder,
      visibleColumns: defaultVisible,
      customLabels: {} as Record<string, string>,
      columnWidths: {} as Record<string, string | number>,
      textFormat: { ...DEFAULT_TABLE_TEXT_FORMAT, ...globalFormat },
      recordsLimit: defaultRecordsLimit,
      startDate: '',
      endDate: '',
      inheritGlobalAppearance: true
    };
  }
  try {
    const saved = localStorage.getItem(`default_table_config_${storageKey}`);
    if (saved) {
      const parsed = JSON.parse(saved);
      let order: string[] = parsed.columnOrder || defaultOrder;
      
      // Process tables keep their protocol column fixed; generic tables do not invent it.
      if (defaultOrder.includes('protocolo')) {
        order = order.filter((k: string) => k !== 'protocolo');
        order.unshift('protocolo');
      }

      // Add any missing column keys
      defaultOrder.forEach((k) => {
        if (!order.includes(k)) order.push(k);
      });

      const visible = { ...defaultVisible, ...(parsed.visibleColumns || {}) };
      // Ensure protocolo is always visible in process tables.
      if (defaultOrder.includes('protocolo')) visible.protocolo = true;

      const customLabels = parsed.customLabels || {};
      const columnWidths = parsed.columnWidths || {};
      const inheritGlobalAppearance = true;
      const textFormat: TableTextFormat = {
        ...DEFAULT_TABLE_TEXT_FORMAT,
        ...globalFormat,
        ...(inheritGlobalAppearance ? {} : (parsed.textFormat || {}))
      };
      const recordsLimit = parsed.recordsLimit !== undefined ? parsed.recordsLimit : defaultRecordsLimit;
      const startDate = parsed.startDate || '';
      const endDate = parsed.endDate || '';

      return { columnOrder: order, visibleColumns: visible, customLabels, columnWidths, textFormat, recordsLimit, startDate, endDate, inheritGlobalAppearance };
    }
  } catch (e) {
    console.error('Error loading table config:', e);
  }
  return {
    columnOrder: defaultOrder,
    visibleColumns: defaultVisible,
    customLabels: {} as Record<string, string>,
    columnWidths: {} as Record<string, string | number>,
    textFormat: { ...DEFAULT_TABLE_TEXT_FORMAT, ...globalFormat },
    recordsLimit: defaultRecordsLimit,
    startDate: '',
    endDate: '',
    inheritGlobalAppearance: true
  };
}

export const TableColumnSelectorPanel: React.FC<TableColumnSelectorPanelProps> = ({
  storageKey,
  tabTitle,
  allColumns,
  columnOrder,
  setColumnOrder,
  visibleColumns,
  setVisibleColumns,
  defaultColumnOrder,
  defaultVisibleColumns,
  onClose,
}) => {
  const { isMasterAdmin, globalRoles, userEmail } = useAuth();
  const isMaster = isMasterAdmin || globalRoles.includes('MASTER_ADMIN');
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  // Map columns by key for quick lookup
  const columnMap = new Map<string, ColumnDef>();
  allColumns.forEach((c) => columnMap.set(c.key, c));

  const fixedColumnKey = allColumns.find((column) => column.isFixed)?.key
    || (allColumns.some((column) => column.key === 'protocolo') ? 'protocolo' : undefined);
  const validColumnKeys = new Set(allColumns.map((column) => column.key));
  const normalizedOrder: string[] = Array.from(new Set<string>(columnOrder)).filter((key) => validColumnKeys.has(key));
  allColumns.forEach((column) => {
    if (!normalizedOrder.includes(column.key)) normalizedOrder.push(column.key);
  });
  if (fixedColumnKey) {
    const withoutFixed = normalizedOrder.filter((key) => key !== fixedColumnKey);
    normalizedOrder.splice(0, normalizedOrder.length, fixedColumnKey, ...withoutFixed);
  }

  // Move column at index `fromIndex` to `toIndex` (never touching index 0)
  const handleMove = (fromIndex: number, toIndex: number) => {
    const firstMovableIndex = fixedColumnKey ? 1 : 0;
    if (fromIndex < firstMovableIndex || toIndex < firstMovableIndex || fromIndex >= normalizedOrder.length || toIndex >= normalizedOrder.length) {
      return;
    }
    const newOrder = [...normalizedOrder];
    const [moved] = newOrder.splice(fromIndex, 1);
    newOrder.splice(toIndex, 0, moved);
    setColumnOrder(newOrder);
  };

  // Save as default for all users (Master Admin function)
  const handleSetAsDefault = () => {
    try {
      const existingRaw = localStorage.getItem(`default_table_config_${storageKey}`);
      const existing = existingRaw ? JSON.parse(existingRaw) : {};
      const payload = {
        ...existing,
        columnOrder: normalizedOrder,
        visibleColumns: {
          ...visibleColumns,
          ...(fixedColumnKey ? { [fixedColumnKey]: true } : {}),
        },
        updatedAt: new Date().toISOString(),
        updatedBy: userEmail,
      };
      localStorage.setItem(`default_table_config_${storageKey}`, JSON.stringify(payload));
      setSaveMessage(`Ordem e colunas salvas para "${tabTitle}". Use “Publicar” na Personalização do Portal para sincronizar com todos os usuários.`);
      setTimeout(() => setSaveMessage(null), 5000);
    } catch (e) {
      console.error(e);
      setSaveMessage('Erro ao salvar configuração padrão.');
    }
  };

  // Restore defaults (checks if master default exists, else built-in default)
  const handleRestoreDefault = () => {
    const loaded = loadTableConfig(storageKey, defaultColumnOrder, defaultVisibleColumns);
    setColumnOrder(loaded.columnOrder);
    setVisibleColumns(loaded.visibleColumns);
    setSaveMessage('Ordem e visibilidade restauradas para o padrão.');
    setTimeout(() => setSaveMessage(null), 3000);
  };

  // Toggle select all optional
  const handleSelectAll = (select: boolean) => {
    const updated: Record<string, boolean> = {
      ...visibleColumns,
      ...(fixedColumnKey ? { [fixedColumnKey]: true } : {}),
    };
    allColumns.forEach((col) => {
      if (col.key !== fixedColumnKey) {
        updated[col.key] = select;
      }
    });
    setVisibleColumns(updated);
  };

  return (
    <section className="portal-modal-card mt-2 space-y-3 p-4 text-slate-900 transition-all animate-fadeIn" aria-label={`Configurar colunas de ${tabTitle}`}>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-300 pb-2.5">
        <div className="flex items-center gap-2">
          <List className="w-4 h-4 text-[var(--portal-brand-action)] shrink-0" />
          <span className="text-xs font-black uppercase text-slate-900 tracking-wider">
            Exibição & Ordem das Colunas — {tabTitle}
          </span>
          {isMaster && (
            <span className="inline-flex items-center gap-1 bg-[var(--portal-surface-inner)] text-slate-700 border border-slate-300 text-[9.5px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider">
              <Shield className="w-3 h-3 text-[var(--portal-brand-action)]" /> Modo Administrador Master
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Master Admin: Save as Default Button */}
          {isMaster && (
            <button
              type="button"
              onClick={handleSetAsDefault}
              className="portal-action portal-action-primary text-[10px] uppercase tracking-wider"
              title="Salvar esta ordem e seleção de colunas como o padrão do sistema para esta aba"
            >
              <Star className="w-3.5 h-3.5" />
              <span>Definir como Padrão</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => handleSelectAll(true)}
            className="text-[10px] font-bold text-slate-700 hover:text-slate-950 underline cursor-pointer"
          >
            Marcar Todos
          </button>

          <button
            type="button"
            onClick={handleRestoreDefault}
            className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-700 hover:text-slate-950 underline cursor-pointer"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Restaurar Padrão</span>
          </button>
        </div>
      </div>

      {/* Confirmation Message Toast */}
      {saveMessage && (
        <div role="status" aria-live="polite" className="portal-modal-inner text-xs px-3 py-2 font-bold flex items-center justify-between animate-fadeIn">
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{saveMessage}</span>
          </div>
        </div>
      )}

      {/* Columns List with Drag/Move & Visibility Checkboxes */}
      <div className="space-y-1.5">
        <p className="text-[11px] text-slate-600 font-medium">
          Marque os campos que deseja visualizar na tabela e utilize os botões <span className="font-bold text-slate-900">▲ / ▼</span> para reordenar a posição de cada coluna. {fixedColumnKey ? <span className="font-extrabold text-slate-700">A coluna fixa é mantida em primeiro lugar.</span> : null}
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 pt-1 max-h-72 overflow-y-auto pr-1">
          {normalizedOrder.map((key, index) => {
            const colDef = columnMap.get(key) || { key, label: key };
            const isFixed = key === fixedColumnKey;
            const isVisible = !!visibleColumns[key];

            return (
              <div
                key={key}
                className={`flex items-center justify-between gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs transition-all ${
                  isFixed
                    ? 'bg-[var(--portal-surface-inner)] border-slate-300 text-slate-900 font-extrabold shadow-xs'
                    : isVisible
                    ? 'bg-[var(--portal-surface-inner)] border-slate-300 text-slate-900 font-medium'
                    : 'bg-[var(--portal-surface-panel)] border-slate-300 text-slate-500 line-through'
                }`}
              >
                <label className="flex items-center gap-2 cursor-pointer select-none truncate flex-1 min-w-0">
                  <input
                    type="checkbox"
                    checked={isFixed ? true : isVisible}
                    disabled={isFixed}
                    onChange={(e) => {
                      if (!isFixed) {
                        setVisibleColumns((prev) => ({ ...prev, [key]: e.target.checked }));
                      }
                    }}
                    className="rounded border-slate-400 text-[var(--portal-brand-action)] focus:ring-[var(--portal-focus)] disabled:opacity-80 cursor-pointer"
                  />
                  <span className="truncate text-[11.5px]">
                    {colDef.label}
                  </span>
                </label>

                {/* Fixed Badge or Reorder Action Buttons */}
                {isFixed ? (
                  <span className="inline-flex items-center gap-1 text-[9.5px] font-black uppercase tracking-wider text-slate-600 bg-[var(--portal-surface-card)] px-2 py-0.5 rounded-full border border-slate-300 shrink-0">
                    <Lock className="w-2.5 h-2.5 text-slate-500" />
                    1º Fixo
                  </span>
                ) : (
                  <div className="flex items-center gap-0.5 shrink-0">
                    {/* Move Up / Left Button */}
                    <button
                      type="button"
                      disabled={index <= (fixedColumnKey ? 1 : 0)}
                      onClick={() => handleMove(index, index - 1)}
                      className="p-1 rounded hover:bg-[var(--portal-surface-card)] disabled:opacity-20 disabled:hover:bg-transparent text-slate-700 transition-colors cursor-pointer"
                      aria-label={`Mover ${colDef.label} para cima`}
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>

                    {/* Move Down / Right Button */}
                    <button
                      type="button"
                      disabled={index >= normalizedOrder.length - 1}
                      onClick={() => handleMove(index, index + 1)}
                      className="p-1 rounded hover:bg-[var(--portal-surface-card)] disabled:opacity-20 disabled:hover:bg-transparent text-slate-700 transition-colors cursor-pointer"
                      aria-label={`Mover ${colDef.label} para baixo`}
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
