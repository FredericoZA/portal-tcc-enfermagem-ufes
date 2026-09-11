import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  ListFilter,
  Settings,
} from 'lucide-react';
import {
  DEFAULT_TABLE_TEXT_FORMAT,
  TableTextFormat,
} from './TableColumnSelectorPanel';
import { getTableStyles } from '../utils/tableFormatters';

export interface HeaderSettingsPopoverProps {
  recordsLimit: number | 'all';
  setRecordsLimit: (limit: number | 'all') => void;
  allowedLimits?: (number | 'all')[];
  allColumns?: { key: string; label: string; isFixed?: boolean }[];
  visibleColumns?: Record<string, boolean>;
  setVisibleColumns?: (visible: Record<string, boolean> | ((prev: Record<string, boolean>) => Record<string, boolean>)) => void;
  columnOrder?: string[];
  setColumnOrder?: (order: string[]) => void;
  storageKey?: string;
  customLabels?: Record<string, string>;
  setCustomLabels?: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  columnWidths?: Record<string, string | number>;
  setColumnWidths?: React.Dispatch<React.SetStateAction<Record<string, string | number>>>;
  textFormat?: TableTextFormat;
  setTextFormat?: React.Dispatch<React.SetStateAction<TableTextFormat>>;
  defaultColumnOrder?: string[];
  defaultVisibleColumns?: Record<string, boolean>;
  defaultRecordsLimit?: number | 'all';
  startDate?: string;
  setStartDate?: (val: string) => void;
  endDate?: string;
  setEndDate?: (val: string) => void;
  defaultTableTitle?: string;
  defaultFilterTitle?: string;
}

export const HeaderSettingsPopover: React.FC<HeaderSettingsPopoverProps> = ({
  recordsLimit,
  setRecordsLimit,
  allowedLimits = [25, 50, 100, 'all'],
  textFormat = DEFAULT_TABLE_TEXT_FORMAT,
  defaultRecordsLimit = 25,
  startDate,
  setStartDate,
  endDate,
  setEndDate,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const styles = getTableStyles(textFormat);

  const gearButtonRef = useRef<HTMLButtonElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const [popoverPos, setPopoverPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

  const hasActiveFilters = Boolean(
    (startDate && startDate.trim() !== '') ||
    (endDate && endDate.trim() !== '') ||
    (defaultRecordsLimit && recordsLimit !== defaultRecordsLimit)
  );

  const handleToggle = () => {
    if (isOpen) {
      setIsOpen(false);
      return;
    }
    if (gearButtonRef.current) {
      const rect = gearButtonRef.current.getBoundingClientRect();
      const popupWidth = Math.min(320, window.innerWidth - 32);
      let left = rect.right - popupWidth;
      
      const maxLeft = window.innerWidth - popupWidth - 16;
      if (left > maxLeft) left = maxLeft;
      if (left < 16) left = 16;

      let top = rect.bottom + 8;
      if (top + 380 > window.innerHeight && rect.top > 400) {
        top = Math.max(16, rect.top - 380);
      }

      setPopoverPos({
        top,
        left,
      });
    }
    setIsOpen(true);
  };

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    const handleClickOutside = (e: MouseEvent) => {
      if (
        popupRef.current &&
        !popupRef.current.contains(e.target as Node) &&
        !gearButtonRef.current?.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const renderGeneralFields = () => (
    <div className="space-y-4">
      {/* Quantidade de linhas */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-black text-slate-700 uppercase tracking-wider flex items-center gap-1">
            <ListFilter className="w-3 h-3 text-slate-500" /> Linhas por página
          </span>
          <span className="text-[9px] font-bold text-slate-400">
            Atual: {recordsLimit === 'all' ? 'Todos' : recordsLimit}
          </span>
        </div>
        <div className="grid grid-cols-4 gap-1">
          {allowedLimits.map((limit) => {
            const isSelected = recordsLimit === limit;
            return (
              <button
                key={String(limit)}
                type="button"
                onClick={() => setRecordsLimit(limit)}
                className={`py-1.5 px-2 text-[10px] font-black rounded-lg border transition-all cursor-pointer text-center ${
                  isSelected
                    ? 'bg-slate-200 text-slate-900 border-slate-400 ring-2 ring-slate-400 font-black shadow-xs'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                }`}
              >
                {limit === 'all' ? 'Todos' : limit}
              </button>
            );
          })}
        </div>
      </div>

      {/* Filtro por Período */}
      <div className="space-y-1.5 border-t border-slate-200 pt-3">
        <span className="text-[10px] font-black text-slate-700 uppercase tracking-wider">
          Filtro de período
        </span>
        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <span className="text-[9px] font-bold text-slate-500">Data Inicial</span>
            <input
              type="date"
              value={startDate || ''}
              onChange={(e) => setStartDate?.(e.target.value)}
              className="mt-0.5 w-full text-[11px] font-bold bg-white border border-slate-300 rounded-lg px-2 py-1 text-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-400"
            />
          </label>
          <label className="block">
            <span className="text-[9px] font-bold text-slate-500">Data Final</span>
            <input
              type="date"
              value={endDate || ''}
              onChange={(e) => setEndDate?.(e.target.value)}
              className="mt-0.5 w-full text-[11px] font-bold bg-white border border-slate-300 rounded-lg px-2 py-1 text-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-400"
            />
          </label>
        </div>
        {(startDate || endDate) && (
          <button
            type="button"
            onClick={() => {
              setStartDate?.('');
              setEndDate?.('');
            }}
            className="text-[9.5px] font-extrabold text-red-700 hover:underline cursor-pointer pt-0.5"
          >
            Limpar filtro de datas
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div className="inline-flex items-center gap-1.5 shrink-0">
      {/* Botão de Engrenagem (Abre popover pequeno e limpo de linhas e período) */}
      <button
        ref={gearButtonRef}
        type="button"
        onClick={handleToggle}
        className={`${styles.toolbarButtonClass} relative`}
        style={styles.toolbarButtonStyle}
        title="Exibição da planilha: linhas e período"
      >
        <Settings className="h-3.5 w-3.5 text-current" />
        {hasActiveFilters && (
          <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-white" />
        )}
      </button>

      {/* Pop-up pequeno e compacto acionado pela Engrenagem */}
      {isOpen &&
        createPortal(
          <div
            ref={popupRef}
            className="fixed z-[1000001] bg-white border border-slate-300 rounded-xl shadow-2xl p-3.5 w-72 sm:w-80 max-h-[calc(100vh-1rem)] overflow-y-auto text-slate-800 animate-in fade-in zoom-in-95 duration-150"
            style={{ top: `${popoverPos.top}px`, left: `${popoverPos.left}px` }}
          >
            <div className="flex items-center justify-between border-b border-slate-200 pb-2 mb-3">
              <span className="text-[11px] font-black uppercase tracking-wider text-slate-900 flex items-center gap-1.5">
                <Settings className="h-3.5 w-3.5 text-slate-600" /> Exibição da Planilha
              </span>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-xs font-bold cursor-pointer transition-colors p-1 rounded-md"
                title="Fechar"
              >
                ✕
              </button>
            </div>

            {renderGeneralFields()}

            <div className="mt-3.5 pt-2.5 border-t border-slate-200 flex items-center justify-between gap-2">
              <span className="text-[9px] text-slate-400">ESC para fechar</span>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white text-[10px] font-extrabold uppercase rounded-lg border border-slate-900 transition-all cursor-pointer shadow-xs"
              >
                Concluir
              </button>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};
