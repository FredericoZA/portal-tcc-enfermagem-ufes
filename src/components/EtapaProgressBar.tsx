import React from 'react';
import { ProcessEtapa } from '../types';
import { Check } from 'lucide-react';

interface EtapaProgressBarProps {
  currentEtapa: ProcessEtapa;
}

const ETAPAS_CONFIG: { code: ProcessEtapa; label: string; description: string }[] = [
  { code: 'CADASTRO', label: 'Cadastro', description: 'Dados cadastrados' },
  { code: 'AGENDAMENTO', label: 'Agendamento', description: 'Slot confirmado' },
  { code: 'CONVITE', label: 'Convite e Banca', description: 'Banca notificada' },
  { code: 'DEFESA', label: 'Defesa', description: 'Apresentação' },
  { code: 'AVALIACAO', label: 'Avaliação', description: 'Parecer do Orientador' },
  { code: 'ASSINATURA', label: 'Assinaturas', description: 'Assinaturas pela Asten' },
  { code: 'DOCUMENTOS', label: 'Documentos', description: 'PDFs gerados' },
  { code: 'CONCLUIDO', label: 'Concluído', description: 'Finalizado' },
];

export const EtapaProgressBar: React.FC<EtapaProgressBarProps> = ({ currentEtapa }) => {
  const currentIndex = ETAPAS_CONFIG.findIndex((e) => e.code === currentEtapa);

  return (
    <div id="process-etapa-progress-bar" className="w-full bg-white px-4 py-3 rounded-xl border border-slate-200/80 shadow-2xs">
      <div className="flex items-center justify-between text-xs mb-2">
        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
          Fluxo do Processo
        </span>
        <span className="text-[11px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
          Etapa: {ETAPAS_CONFIG[currentIndex]?.label || currentEtapa}
        </span>
      </div>

      {/* Desktop Step Bar */}
      <div className="hidden md:flex items-center justify-between relative">
        {/* Connecting line */}
        <div className="absolute left-3 right-3 top-3 -translate-y-1/2 h-0.5 bg-slate-200 -z-0" />
        <div
          className="absolute left-3 top-3 -translate-y-1/2 h-0.5 bg-emerald-700 -z-0 transition-all duration-300"
          style={{
            width: `${(Math.max(0, currentIndex) / (ETAPAS_CONFIG.length - 1)) * 100}%`,
          }}
        />

        {ETAPAS_CONFIG.map((step, idx) => {
          const isDone = idx < currentIndex;
          const isCurrent = idx === currentIndex;

          return (
            <div key={step.code} className="flex flex-col items-center relative z-10">
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-all ${
                  isDone
                    ? 'bg-emerald-700 text-white'
                    : isCurrent
                    ? 'bg-slate-900 text-white ring-2 ring-emerald-600 ring-offset-1 font-extrabold'
                    : 'bg-white text-slate-400 border border-slate-300'
                }`}
              >
                {isDone ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : idx + 1}
              </div>

              <span
                className={`text-[10px] tracking-tight mt-1 whitespace-nowrap ${
                  isCurrent
                    ? 'font-bold text-slate-900'
                    : isDone
                    ? 'font-medium text-slate-700'
                    : 'font-normal text-slate-400'
                }`}
              >
                {step.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Mobile Step Compact Bar */}
      <div className="md:hidden space-y-1.5 pt-1">
        <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden border border-slate-200">
          <div
            className="bg-emerald-700 h-2 transition-all duration-300"
            style={{ width: `${((currentIndex + 1) / ETAPAS_CONFIG.length) * 100}%` }}
          />
        </div>
        <div className="flex justify-between text-[10px] text-slate-500">
          <span>Passo {currentIndex + 1} de {ETAPAS_CONFIG.length}</span>
          <span className="font-semibold text-slate-800">{ETAPAS_CONFIG[currentIndex]?.label}</span>
        </div>
      </div>
    </div>
  );
};
