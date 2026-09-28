import React from 'react';
import { ProcessEtapa } from '../types';
import { Check } from 'lucide-react';

interface EtapaProgressBarProps {
  currentEtapa: ProcessEtapa;
}

const ETAPAS_CONFIG: { code: ProcessEtapa; label: string; description: string }[] = [
  { code: 'CADASTRO', label: 'Cadastro', description: 'Dados do trabalho cadastrados no Portal.' },
  { code: 'AGENDAMENTO', label: 'Agendamento', description: 'Data, horário e local da defesa em confirmação.' },
  { code: 'CONVITE', label: 'Convite e Banca', description: 'Banca definida e convite encaminhado aos participantes.' },
  { code: 'DEFESA', label: 'Defesa', description: 'Apresentação do Trabalho de Conclusão de Curso.' },
  { code: 'AVALIACAO', label: 'Avaliação', description: 'Parecer e registros da avaliação da defesa.' },
  { code: 'ASSINATURA', label: 'Assinaturas', description: 'Documentos encaminhados para assinatura eletrônica.' },
  { code: 'DOCUMENTOS', label: 'Documentos', description: 'Documentos finais gerados, assinados, enviados ao repositório e arquivados.' },
  { code: 'CONCLUIDO', label: 'Concluído', description: 'Fluxo acadêmico e documental finalizado.' },
];

const ETAPA_PROGRESS_ALIAS: Partial<Record<ProcessEtapa, ProcessEtapa>> = {
  CONFIRMACAO_LOCAL: 'AGENDAMENTO',
  REPOSITORIO: 'DOCUMENTOS',
};

const ETAPA_CURRENT_LABEL: Partial<Record<ProcessEtapa, string>> = {
  CONFIRMACAO_LOCAL: 'Confirmação do local',
  REPOSITORIO: 'Repositório',
};

export const EtapaProgressBar: React.FC<EtapaProgressBarProps> = ({ currentEtapa }) => {
  const progressCode = ETAPA_PROGRESS_ALIAS[currentEtapa] || currentEtapa;
  const currentIndex = ETAPAS_CONFIG.findIndex((e) => e.code === progressCode);
  const safeIndex = currentIndex >= 0 ? currentIndex : 0;
  const currentLabel = ETAPA_CURRENT_LABEL[currentEtapa] || ETAPAS_CONFIG[currentIndex]?.label || currentEtapa;
  const currentDescription = ETAPAS_CONFIG[currentIndex]?.description || 'Etapa atual do fluxo do TCC.';

  return (
    <div
      id="process-etapa-progress-bar"
      className="w-full rounded-xl border border-slate-300 px-4 py-3 shadow-2xs"
      style={{ backgroundColor: 'var(--portal-surface-inner)' }}
    >
      <div className="mb-2 flex items-center justify-between text-xs">
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600">Fluxo do Processo</span>
        <span className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-800">
          Etapa: {currentLabel}
        </span>
      </div>

      <div className="relative hidden items-center justify-between md:flex">
        <div className="absolute left-3 right-3 top-3 -z-0 h-0.5 -translate-y-1/2 bg-slate-200" />
        <div
          className="absolute left-3 top-3 -z-0 h-0.5 -translate-y-1/2 bg-emerald-700 transition-all duration-300"
          style={{ width: `${(safeIndex / (ETAPAS_CONFIG.length - 1)) * 100}%` }}
        />

        {ETAPAS_CONFIG.map((step, idx) => {
          const isDone = idx < safeIndex;
          const isCurrent = idx === safeIndex;
          return (
            <div
              key={step.code}
              className="relative z-10 flex flex-col items-center"
              title={`${step.label}: ${step.description}`}
              aria-label={`${step.label}. ${step.description}${isCurrent ? ' Etapa atual.' : isDone ? ' Etapa concluída.' : ''}`}
            >
              <div
                className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold transition-all ${
                  isDone
                    ? 'bg-emerald-700 text-white'
                    : isCurrent
                      ? 'bg-slate-900 text-white ring-2 ring-emerald-600 ring-offset-1 font-extrabold'
                      : 'border border-slate-300 bg-white text-slate-400'
                }`}
              >
                {isDone ? <Check className="h-3.5 w-3.5 stroke-[3]" /> : idx + 1}
              </div>
              <span className={`mt-1 whitespace-nowrap text-[10px] tracking-tight ${isCurrent ? 'font-bold text-slate-900' : isDone ? 'font-medium text-slate-700' : 'font-normal text-slate-400'}`}>
                {step.label}
              </span>
            </div>
          );
        })}
      </div>

      <div className="space-y-1.5 pt-1 md:hidden" title={currentDescription}>
        <div className="h-2 w-full overflow-hidden rounded-full border border-slate-200 bg-slate-100">
          <div className="h-2 bg-emerald-700 transition-all duration-300" style={{ width: `${((safeIndex + 1) / ETAPAS_CONFIG.length) * 100}%` }} />
        </div>
        <div className="flex justify-between text-[10px] text-slate-500">
          <span>Passo {safeIndex + 1} de {ETAPAS_CONFIG.length}</span>
          <span className="font-semibold text-slate-800">{currentLabel}</span>
        </div>
      </div>
    </div>
  );
};
