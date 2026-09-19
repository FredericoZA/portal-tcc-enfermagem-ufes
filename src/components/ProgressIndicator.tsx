import React from 'react';
import { TableTextFormat } from './TableColumnSelectorPanel';

interface ProgressIndicatorProps {
  percent: number;
  label?: string;
  textFormat?: TableTextFormat;
}

/**
 * O progresso nas planilhas é deliberadamente textual.
 * O antigo anel SVG consumia muito contraste visual para uma informação simples
 * e deixava tabelas densas mais difíceis de varrer com os olhos.
 */
export const ProgressIndicator: React.FC<ProgressIndicatorProps> = ({ percent, label }) => {
  const value = Math.max(0, Math.min(100, Math.round(percent || 0)));
  const match = String(label || '').match(/Etapa\s+([\d.,]+)/i);
  const stage = match ? match[1].replace(',', '.') : '';
  return (
    <span
      className="portal-progress-number portal-stage-number inline-flex min-w-[28px] items-center justify-center text-[11px] font-semibold tabular-nums text-slate-600"
      title={label}
      aria-label={label || `Etapa associada ao progresso de ${value}%`}
    >
      {stage || '—'}
    </span>
  );
};
