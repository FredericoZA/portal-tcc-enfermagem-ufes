import React, { useState, useEffect } from 'react';
import { ProcessData } from '../types';
import { useAuth } from '../context/AuthContext';
import { apiClient } from '../services/apiClient';
import { formatDatePt, formatStudentsString } from '../utils/formatters';
import { StudentNames } from '../components/StudentNames';
import { ColorfulHeaderIcon } from '../components/ColorfulHeaderIcon';
import { CheckSquare, ArrowRight, AlertCircle } from 'lucide-react';
import { resolveInstallationProfile } from '../utils/installationProfile';

interface AvaliacoesPageProps {
  onSelectProcess: (processId: string) => void;
}

export const AvaliacoesPage: React.FC<AvaliacoesPageProps> = ({ onSelectProcess }) => {
  const { userEmail, settings } = useAuth();
  const profile = resolveInstallationProfile(settings);
  const [processes, setProcesses] = useState<ProcessData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    apiClient.getProcesses().then((data) => {
      // Filter TCCs where user is Orientador/Advisor
      const pendingEvals = data.filter((p) => p.orientador.email === userEmail || p.avaliacao.status === 'PENDENTE');
      setProcesses(pendingEvals);
      setIsLoading(false);
    });
  }, [userEmail]);

  return (
    <div id="avaliacoes-page-container" className="space-y-3 max-w-7xl mx-auto py-1.5">
      <div className="bg-[#005830] text-white p-3.5 sm:p-4 rounded-2xl border border-emerald-900/80 shadow-sm space-y-1">
        <div className="text-emerald-200 text-[10px] font-extrabold uppercase tracking-widest leading-none">
          {profile.institutionAcronym} • {profile.departmentName || profile.institutionName}
        </div>
        <div className="flex items-center gap-2 mt-1">
          <ColorfulHeaderIcon type="evaluation" />
          <h1 className="text-sm sm:text-base font-black text-white uppercase tracking-tight">
            Avaliações de TCC Sob Sua Orientação
          </h1>
        </div>
        <p className="text-[10px] sm:text-[11px] text-emerald-100/95 font-medium leading-normal mt-0.5">
          Confira os dados do aluno, selecione o resultado e registre o parecer e preencha o parecer da banca.
        </p>
      </div>

      {isLoading ? (
        <div className="bg-white p-6 text-center text-xs font-semibold text-slate-500 border border-slate-200">
          Carregando avaliações...
        </div>
      ) : processes.length === 0 ? (
        <div className="bg-white p-8 text-center border border-slate-200 space-y-2">
          <CheckSquare className="w-8 h-8 text-slate-400 mx-auto" />
          <h3 className="font-bold text-slate-800 text-sm uppercase">Nenhuma avaliação pendente</h3>
          <p className="text-xs text-slate-500">
            Você não possui processos de TCC aguardando avaliação no momento.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {processes.map((proc) => (
            <div
              key={proc.id}
              className="bg-white p-4 border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-3 border-l-2 border-l-emerald-600"
            >
              <div className="space-y-2 max-w-2xl">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black text-slate-900 tracking-tight">{proc.protocolo}</span>
                  <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-sm uppercase tracking-wider ${
                    proc.avaliacao.status === 'CONCLUIDO' ? 'bg-emerald-100 text-emerald-900 border border-emerald-300' : 'bg-amber-100 text-amber-950 border border-amber-300'
                  }`}>
                    {proc.avaliacao.status === 'CONCLUIDO' ? 'Avaliação Concluída' : 'Avaliação Pendente'}
                  </span>
                </div>

                <h3 className="font-bold text-slate-900 text-sm uppercase">{proc.titulo}</h3>
                <div className="text-xs text-slate-600 space-y-1">
                  <div>
                    <strong>Aluno(s):</strong>
                    <StudentNames aluno1={proc.aluno1} aluno2={proc.aluno2} align="left" itemClassName="text-xs font-bold text-slate-900" />
                  </div>
                  <div><strong>Data da Defesa:</strong> {formatDatePt(proc.defesa.startAt)}</div>
                </div>
              </div>

              <button
                onClick={() => onSelectProcess(proc.id)}
                className="flex items-center gap-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs uppercase tracking-wider px-5 py-2.5 rounded-sm shadow-xs transition-colors"
              >
                <span>{proc.avaliacao.status === 'CONCLUIDO' ? 'Ver Parecer Registrado' : 'Realizar Avaliação'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
