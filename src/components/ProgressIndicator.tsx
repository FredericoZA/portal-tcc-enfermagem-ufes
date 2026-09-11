import React from 'react';
import { TableTextFormat } from './TableColumnSelectorPanel';
import { getTableStyles } from '../utils/tableFormatters';

interface ProgressIndicatorProps {
  percent: number;
  label?: string;
  textFormat?: TableTextFormat;
}

export const ProgressIndicator: React.FC<ProgressIndicatorProps> = ({ percent, label, textFormat }) => {
  const value = Math.max(0, Math.min(100, Math.round(percent || 0)));
  const styles = getTableStyles(textFormat);
  const mode = textFormat?.progressStyle || 'circle';

  if (mode === 'bar') {
    return (
      <div className="min-w-[82px] space-y-1" title={label}>
        <div className="h-2 overflow-hidden rounded-full bg-slate-200">
          <div className="h-full rounded-full transition-all" style={{ width: `${value}%`, backgroundColor: styles.progressStrokeColor }} />
        </div>
        <span className="block text-[9px] font-black text-slate-700">{value}%</span>
      </div>
    );
  }

  if (mode === 'badge') {
    return (
      <span className="inline-flex min-w-[48px] items-center justify-center rounded-full border px-2 py-1 text-[10px] font-black" style={{ color: styles.progressStrokeColor, borderColor: styles.progressStrokeColor, backgroundColor: `${styles.progressStrokeColor}14` }} title={label}>
        {value}%
      </span>
    );
  }

  return (
    <div className="relative mx-auto h-10 w-10" title={label}>
      <svg viewBox="0 0 36 36" className="h-10 w-10 -rotate-90">
        <circle cx="18" cy="18" r="15" fill="none" stroke={styles.progressBgStrokeColor} strokeWidth="4" />
        <circle cx="18" cy="18" r="15" fill="none" stroke={styles.progressStrokeColor} strokeWidth="4" strokeLinecap="round" strokeDasharray={`${value} 100`} pathLength="100" />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[9px] font-black text-slate-800">{value}%</span>
    </div>
  );
};
