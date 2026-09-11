import React from 'react';
import { 
  Users, 
  Layers, 
  GraduationCap, 
  HelpCircle, 
  Calendar as CalendarIcon, 
  BookOpen, 
  Award, 
  Settings, 
  FileText, 
  CheckCircle2, 
  Clock, 
  FileCheck, 
  Compass
} from 'lucide-react';

interface TutorialInfographicProps {
  activeSection: 'perfis' | 'modulos' | 'fluxo' | 'faq';
  onNavigate?: (tab: string) => void;
  filteredProfileRows: any[];
  filteredModulesRows: any[];
  filteredFlowRows: any[];
  filteredFaqRows: any[];
  selectedProfileFilter: string;
}

export const TutorialInfographicView: React.FC<TutorialInfographicProps> = ({
  activeSection,
  onNavigate,
  filteredProfileRows,
  filteredModulesRows,
  filteredFlowRows,
  filteredFaqRows,
  selectedProfileFilter
}) => {
  return (
    <div className="p-4 sm:p-6 space-y-6 bg-white">
      
      {/* 1. SEÇÃO DE PERFIS: CARDS INTERATIVOS E JORNADA PASSO A PASSO */}
      {activeSection === 'perfis' && (
        <div className="space-y-4">
          <div className="border-b border-slate-200 pb-3">
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">
              Instruções por Perfil de Acesso
            </h3>
            <p className="text-xs text-slate-600 mt-0.5">
              Diretrizes de prazos, ações e documentos exigidos para cada perfil no sistema.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {filteredProfileRows.map((row, idx) => (
              <div
                key={row.id || idx}
                className="bg-white rounded-lg border border-slate-300 p-4 flex flex-col justify-between space-y-3.5 shadow-2xs hover:border-slate-400 transition-colors"
              >
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-black text-slate-900 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                      {row.etapa}
                    </span>
                    <span className="text-[10px] font-bold uppercase text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                      {row.perfil}
                    </span>
                  </div>

                  <div>
                    <h4 className="text-xs font-black text-slate-900 uppercase">
                      {row.acao}
                    </h4>
                    <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                      {row.descricao}
                    </p>
                  </div>
                </div>

                <div className="pt-2.5 border-t border-slate-200 space-y-1.5 text-xs">
                  <div className="flex items-start gap-1.5 text-slate-700">
                    <Clock className="w-3.5 h-3.5 text-slate-500 shrink-0 mt-0.5" />
                    <span className="text-[11px]">
                      <strong className="text-slate-900 font-bold">Prazo:</strong> {row.prazo}
                    </span>
                  </div>
                  <div className="flex items-start gap-1.5 text-slate-800 bg-slate-50 p-2 rounded border border-slate-200">
                    <FileCheck className="w-3.5 h-3.5 text-slate-600 shrink-0 mt-0.5" />
                    <span className="text-[11px] font-medium">
                      <strong className="font-bold text-slate-900">Entregável:</strong> {row.entregavel}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 2. SEÇÃO DE MÓDULOS: MAPA DO SISTEMA */}
      {activeSection === 'modulos' && (
        <div className="space-y-4">
          <div className="border-b border-slate-200 pb-3">
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">
              Módulos do Sistema
            </h3>
            <p className="text-xs text-slate-600 mt-0.5">
              Visão consolidada das funções disponíveis em cada aba do portal.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {filteredModulesRows.map((mod, idx) => {
              const iconsMap: Record<string, any> = {
                'Calendário de Defesas': CalendarIcon,
                'Defesas Agendadas (Lista)': FileText,
                'Repositório de TCCs (Acervo)': BookOpen,
                'Meus TCCs (Painel do Usuário)': FileCheck,
                'Área do Presidente': Award,
                'Configurações do Sistema': Settings
              };
              const ModIcon = iconsMap[mod.modulo] || Layers;

              return (
                <div
                  key={idx}
                  className="bg-white rounded-lg border border-slate-300 p-4 flex flex-col justify-between space-y-3 shadow-2xs hover:border-slate-400 transition-colors"
                >
                  <div className="space-y-2.5">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded bg-slate-100 text-slate-800 border border-slate-200 flex items-center justify-center shrink-0">
                        <ModIcon className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <h4 className="text-xs font-black text-slate-900 uppercase">
                          {mod.modulo}
                        </h4>
                        <span className="text-[10px] text-slate-500 font-medium block">
                          Público: {mod.publico}
                        </span>
                      </div>
                    </div>

                    <div className="bg-slate-50 p-2 rounded border border-slate-200 text-xs text-slate-700">
                      <p className="font-medium text-slate-800">{mod.objetivo}</p>
                    </div>

                    <div className="space-y-1 text-xs">
                      <span className="text-[10px] font-bold uppercase text-slate-500">Recursos:</span>
                      <p className="text-[11px] text-slate-600 leading-relaxed">
                        {mod.recursos}
                      </p>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-200 text-xs">
                    <span className="text-[10px] font-bold text-slate-800 uppercase flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 text-slate-600" />
                      {mod.acoes}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 3. SEÇÃO DE FLUXO & PRAZOS: TIMELINE SEQUENCIAL */}
      {activeSection === 'fluxo' && (
        <div className="space-y-4">
          <div className="border-b border-slate-200 pb-3">
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">
              Fluxo Regimental de Defesa
            </h3>
            <p className="text-xs text-slate-600 mt-0.5">
              Etapas obrigatórias desde o agendamento inicial até a emissão de certificados e depósito no repositório.
            </p>
          </div>

          <div className="relative border-l-2 border-slate-300 ml-4 space-y-4 pl-5 my-2">
            {filteredFlowRows.map((fase, idx) => (
              <div key={idx} className="relative group">
                <div className="absolute -left-[27px] top-1.5 w-6 h-6 rounded-full bg-slate-800 text-white font-bold text-xs flex items-center justify-center border border-white">
                  {idx + 1}
                </div>

                <div className="bg-white rounded-lg border border-slate-300 p-3.5 space-y-2 shadow-2xs hover:border-slate-400 transition-colors">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                    <h4 className="text-xs font-black text-slate-900 uppercase">
                      {fase.fase}
                    </h4>
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                      <Clock className="w-3 h-3 text-slate-500" />
                      {fase.prazo}
                    </span>
                  </div>

                  <div className="text-xs text-slate-600">
                    <strong className="text-slate-900">Responsável:</strong> {fase.responsavel}
                  </div>

                  <p className="text-xs text-slate-700 bg-slate-50 p-2 rounded border border-slate-200 leading-relaxed">
                    {fase.procedimento}
                  </p>

                  <div className="flex items-center gap-2 pt-0.5">
                    <span className="text-[10px] font-bold uppercase text-slate-500">Entregável:</span>
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                      <FileCheck className="w-3 h-3 text-slate-600" />
                      {fase.entregavel}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4. SEÇÃO DE FAQ */}
      {activeSection === 'faq' && (
        <div className="space-y-4">
          <div className="border-b border-slate-200 pb-3">
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">
              Perguntas Frequentes (FAQ)
            </h3>
            <p className="text-xs text-slate-600 mt-0.5">
              Respostas diretas às principais dúvidas regimentais e operacionais do sistema.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {filteredFaqRows.map((faq, idx) => (
              <div
                key={faq.id || idx}
                className="bg-white rounded-lg border border-slate-300 p-4 flex flex-col justify-between space-y-2.5 shadow-2xs hover:border-slate-400 transition-colors"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                      {faq.categoria}
                    </span>
                  </div>

                  <h4 className="text-xs font-black text-slate-900 leading-snug">
                    {faq.pergunta}
                  </h4>

                  <p className="text-xs text-slate-700 bg-slate-50 p-2 rounded border border-slate-200 leading-relaxed">
                    {faq.resposta}
                  </p>
                </div>

                <div className="pt-2 border-t border-slate-200 flex items-center gap-1.5 text-xs text-slate-800 bg-slate-100/70 p-2 rounded border border-slate-200">
                  <CheckCircle2 className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                  <span className="text-[11px] font-medium">
                    <strong className="font-bold text-slate-900">Recomendação:</strong> {faq.recomendacao}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
};
