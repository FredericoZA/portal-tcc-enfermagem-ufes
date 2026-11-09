import React, { useEffect, useState } from 'react';
import { Minus, Plus } from 'lucide-react';

const ZOOM_STORAGE_KEY = 'portal-tcc:site-zoom';
const MIN_ZOOM = 70;
const MAX_ZOOM = 150;
const ZOOM_STEP = 10;
const DEFAULT_ZOOM = 100;

const readSavedZoom = (): number => {
  if (typeof window === 'undefined') return DEFAULT_ZOOM;

  try {
    const stored = window.localStorage.getItem(ZOOM_STORAGE_KEY);
    if (stored === null) return DEFAULT_ZOOM;

    const value = Number(stored);
    if (Number.isInteger(value) && value >= MIN_ZOOM && value <= MAX_ZOOM && value % ZOOM_STEP === 0) {
      return value;
    }
  } catch {
    // O zoom continua funcionando caso o armazenamento do navegador esteja indisponível.
  }

  return DEFAULT_ZOOM;
};

export const SiteZoomControls: React.FC = () => {
  const [zoom, setZoom] = useState(readSavedZoom);

  useEffect(() => {
    // CSS zoom recalcula o layout, diferentemente de transform: scale().
    document.documentElement.style.zoom = String(zoom / 100);

    try {
      window.localStorage.setItem(ZOOM_STORAGE_KEY, String(zoom));
    } catch {
      // A persistência é opcional e não deve impedir o ajuste visual.
    }
  }, [zoom]);

  return (
    <div
      id="site-zoom-controls"
      role="group"
      aria-label="Controle de zoom do portal"
      className="inline-flex h-[30px] shrink-0 items-center gap-0 rounded-full border border-slate-200 bg-white px-0.5"
    >
      <button
        id="site-zoom-out"
        type="button"
        onClick={() => setZoom((current) => Math.max(MIN_ZOOM, current - ZOOM_STEP))}
        disabled={zoom <= MIN_ZOOM}
        aria-label="Diminuir zoom do portal"
        title="Diminuir zoom"
        className="flex h-6 w-6 items-center justify-center rounded-full text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-30"
      >
        <Minus className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
      <output
        aria-live="polite"
        aria-atomic="true"
        className="min-w-8 text-center text-[10px] font-bold tabular-nums text-slate-700"
      >
        {zoom}%
      </output>
      <button
        id="site-zoom-in"
        type="button"
        onClick={() => setZoom((current) => Math.min(MAX_ZOOM, current + ZOOM_STEP))}
        disabled={zoom >= MAX_ZOOM}
        aria-label="Aumentar zoom do portal"
        title="Aumentar zoom"
        className="flex h-6 w-6 items-center justify-center rounded-full text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-30"
      >
        <Plus className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
    </div>
  );
};
