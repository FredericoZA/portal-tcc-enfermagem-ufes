import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Search } from 'lucide-react';
import { TableTextFormat } from './TableColumnSelectorPanel';
import { getTableStyles } from '../utils/tableFormatters';

export interface SearchPopoverProps {
  value: string;
  onChange: (val: string) => void;
  placeholder: string;
  textFormat?: TableTextFormat;
}

export const SearchPopover: React.FC<SearchPopoverProps> = ({
  value,
  onChange,
  placeholder,
  textFormat,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const styles = getTableStyles(textFormat);
  const [popoverPos, setPopoverPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

  const handleToggle = () => {
    if (!isOpen) {
      if (buttonRef.current) {
        const rect = buttonRef.current.getBoundingClientRect();
        const popupWidth = 260;
        let left = rect.left;
        if (left + popupWidth > window.innerWidth - 10) {
          left = Math.max(10, window.innerWidth - popupWidth - 10);
        }
        if (left < 10) left = 10;
        setPopoverPos({
          top: rect.bottom + 6,
          left,
        });
      }
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
        }
      }, 50);
    }
    setIsOpen(!isOpen);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node) && !popupRef.current?.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  return (
    <div className="relative inline-block text-left shrink-0" ref={containerRef}>
      <button
        ref={buttonRef}
        type="button"
        onClick={handleToggle}
        className={`${styles.toolbarButtonClass} relative shrink-0`}
        style={styles.toolbarButtonStyle}
        title={placeholder}
      >
        <Search className="w-3.5 h-3.5 text-current" />
        {value && (
          <span className="absolute -top-1 -right-1 bg-amber-500 text-slate-950 text-[8px] font-black rounded-full h-3.5 w-3.5 flex items-center justify-center border border-slate-600">
            !
          </span>
        )}
      </button>

      {isOpen && createPortal(
        <div
          ref={popupRef}
          className="fixed z-[1000001] bg-white border border-slate-300 rounded-xl shadow-2xl p-4 w-64 max-h-[calc(100vh-1rem)] overflow-y-auto text-slate-800 animate-in fade-in zoom-in-95 duration-150"
          style={{ top: `${popoverPos.top}px`, left: `${popoverPos.left}px` }}
        >
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <span className="text-[11px] font-black uppercase tracking-wider text-slate-800 block">
                🔍 Buscar Registros
              </span>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-xs font-bold cursor-pointer transition-colors"
              >
                ✕
              </button>
            </div>
            <div className="relative">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                ref={inputRef}
                type="text"
                placeholder={placeholder}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="w-full pl-9 pr-8 py-1.5 bg-slate-50 border border-slate-200 text-slate-800 text-xs placeholder-slate-400 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-500 focus:border-slate-500 font-medium h-9"
              />
              {value && (
                <button
                  type="button"
                  onClick={() => {
                    onChange('');
                    if (inputRef.current) inputRef.current.focus();
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold transition-colors"
                >
                  ✕
                </button>
              )}
            </div>
            <div className="flex justify-between items-center text-[9px] text-slate-400/80 mt-1">
              <span>Pressione ESC para fechar</span>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="px-2.5 py-1 bg-slate-600 hover:bg-slate-700 text-white font-extrabold uppercase rounded-md border border-slate-500 transition-colors cursor-pointer"
              >
                OK
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
