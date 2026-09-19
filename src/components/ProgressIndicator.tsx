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
  return (
    <span
      className="portal-progress-number inline-flex min-w-[42px] items-center justify-center text-[11px] font-semibold tabular-nums text-slate-600"
      title={label}
      aria-label={label ? `${value}% — ${label}` : `${value}%`}
    >
      {value}%
    </span>
  );
};
