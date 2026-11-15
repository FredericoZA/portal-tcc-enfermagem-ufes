import {ETAPAS_CONFIG,ETAPA_PROGRESS_ALIAS,ETAPA_CURRENT_LABEL} from '../utils/processStagePresentation';
import React from 'react';
import { ProcessEtapa } from '../types';
import { Check } from 'lucide-react';

interface EtapaProgressBarProps {
  currentEtapa: ProcessEtapa;
  historical?: boolean;
}

export const EtapaProgressBar: React.FC<EtapaProgressBarProps> = ({ currentEtapa, historical = false }) => {
  const normalizedEtapa=String(currentEtapa).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/\s+/g,'_') as ProcessEtapa;
  const progressCode = ETAPA_PROGRESS_ALIAS[normalizedEtapa] || normalizedEtapa;
  const currentIndex = ETAPAS_CONFIG.findIndex((e) => e.code === progressCode);
  const safeIndex = currentIndex >= 0 ? currentIndex : 0;
  const currentLabel = ETAPA_CURRENT_LABEL[normalizedEtapa] || ETAPAS_CONFIG[currentIndex]?.label || currentEtapa;

  return (
    <div
      id="process-etapa-progress-bar"
      className="w-full rounded-xl border border-slate-300 px-4 py-3 shadow-2xs"
      style={{ backgroundColor: 'var(--portal-surface-panel)' }}
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs">
        <span className="text-[11px] font-bold normal-case tracking-wider text-slate-600">Fluxo do Processo</span>
        <span className="rounded-md border border-[var(--portal-brand-action-border)] bg-[var(--portal-brand-header)] px-2 py-0.5 text-[11px] font-bold text-white">
          {historical ? 'Registro histórico' : `Etapa: ${currentLabel}`}
        </span>
      </div>

      <ol className="portal-workflow-sequence m-0 list-none p-0" aria-label="Etapas do TCC">
        {ETAPAS_CONFIG.map((step, idx) => {
          const isDone = !historical && idx < safeIndex;
          const isCurrent = !historical && idx === safeIndex;
          const statusLabel = historical
            ? (step.code === 'CADASTRO' ? 'Importado' : step.code === 'CONCLUIDO' ? 'Histórico' : 'Não informado')
            : isCurrent ? 'Etapa atual' : isDone ? 'Concluída' : 'A seguir';
          return (
            <li
              key={step.code}
              className="portal-workflow-step flex flex-col items-center rounded-xl border border-slate-300 bg-white p-3 text-center"
              title={`${step.label}: ${step.description}`}
              aria-current={isCurrent ? 'step' : undefined}
              aria-label={historical ? `${step.label}. ${statusLabel}.` : `${step.label}. ${step.description}${isCurrent ? ' Etapa atual.' : isDone ? ' Etapa concluída.' : ' Etapa futura.'}`}
            >
              <span
                className={`relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-4 border-[var(--portal-surface-panel)] text-[10px] font-black shadow-md ${
                  isCurrent
                    ? 'bg-[var(--portal-brand-action)] text-white ring-2 ring-[var(--portal-brand-action-border)] ring-offset-1'
                    : isDone
                      ? 'bg-[var(--portal-brand-action)] text-white'
                      : 'bg-white text-[var(--portal-brand-action)]'
                }`}
                aria-hidden="true"
              >
                {isDone ? <Check className="h-4 w-4 stroke-[3]" /> : idx + 1}
              </span>
              <span className={`mt-1.5 text-[10px] leading-4 ${isCurrent ? 'font-black text-slate-900' : 'font-semibold text-slate-600'}`}>
                {isCurrent ? currentLabel : step.label}
              </span>
              <span className={`mt-auto pt-1 text-[9px] ${isCurrent ? 'font-bold text-[var(--portal-brand-header)]' : 'text-slate-500'}`}>
                {statusLabel}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
};
