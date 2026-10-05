import React from 'react';
import { TableTextFormat } from './TableColumnSelectorPanel';

interface ProgressIndicatorProps {
  percent: number;
  label?: string;
  textFormat?: TableTextFormat;
}

function stageLabel(label?: string) {
  if (!label) return 'Etapa';
  const match = label.match(/Etapa\s+([\d.,]+)(?:\/\d+)?/i);
  return match ? `Etapa ${match[1].replace('.', ',')}` : label;
}

/**
 * Indicador textual canônico da etapa do TCC.
 * A tabela recebe o texto correto na renderização React; nenhum runtime posterior
 * precisa reinterpretar porcentagens ou alterar o DOM.
 */
export const ProgressIndicator: React.FC<ProgressIndicatorProps> = ({ label }) => (
  <span
    className="portal-progress-number inline-flex min-w-[54px] items-center justify-center text-[11px] font-semibold tabular-nums text-slate-600"
    title={label}
    aria-label={label || 'Etapa do TCC'}
  >
    {stageLabel(label)}
  </span>
);
