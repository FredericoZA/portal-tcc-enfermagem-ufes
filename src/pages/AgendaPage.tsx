import React, { useState, useEffect } from 'react';
import { ProcessData } from '../types';
import { apiClient } from '../services/apiClient';
import { formatDatePt, formatTimeExtenso } from '../utils/formatters';
import { StudentNames } from '../components/StudentNames';
import { PortalProcessPill } from '../components/PortalProcessPill';
import { Clock, Download, MapPin } from 'lucide-react';
import { ColorfulHeaderIcon } from '../components/ColorfulHeaderIcon';
import { getTableStyles, loadGlobalTableConfig, GLOBAL_TABLE_EVENT, TableTextFormat } from '../utils/tableFormatters';
import { getDefenseState } from '../utils/defenseSemantics';
import { getPortalToneCssVars } from '../utils/portalSemanticTokens';
import { useAuth } from '../context/AuthContext';
import { resolveInstallationProfile } from '../utils/installationProfile';

interface AgendaPageProps {
  onSelectProcess: (processId: string) => void;
}

export const AgendaPage: React.FC<AgendaPageProps> = ({ onSelectProcess }) => {
  const { settings } = useAuth();
  const profile = resolveInstallationProfile(settings);
  const [processes, setProcesses] = useState<ProcessData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [globalFormat, setGlobalFormat] = useState<TableTextFormat>(loadGlobalTableConfig());

  useEffect(() => {
    apiClient.getProcesses().then((data) => {
      setProcesses(data);
      setIsLoading(false);
    });

    const handleGlobalFormatChange = (e: any) => {
      const newFormat = e.detail || loadGlobalTableConfig();
      setGlobalFormat(newFormat);
    };
    window.addEventListener(GLOBAL_TABLE_EVENT, handleGlobalFormatChange);
    return () => window.removeEventListener(GLOBAL_TABLE_EVENT, handleGlobalFormatChange);
  }, []);

  const styles = getTableStyles(globalFormat);

  return (
    <div id="agenda-page-container" className="space-y-3 max-w-7xl mx-auto py-1.5" style={styles.rootStyle}>
      <div
        className={`${styles.bannerHeaderClass} p-3.5 sm:p-4 rounded-2xl border shadow-sm space-y-1 transition-colors`}
        style={styles.bannerHeaderStyle}
      >
        <div className="text-[10px] font-extrabold uppercase tracking-widest leading-none opacity-80">
          {profile.institutionAcronym} • {profile.departmentName || profile.institutionName}
        </div>
        <div className="flex items-center gap-2 mt-1">
          <ColorfulHeaderIcon type="agenda" textFormat={globalFormat} />
          <h1 className="text-sm sm:text-base font-black uppercase tracking-tight text-inherit">
            Calendário de Defesas de TCC — {profile.courseName}
          </h1>
        </div>
        <p className="text-[10px] sm:text-[11px] font-medium leading-normal mt-0.5 opacity-90">
          Apresentações públicas registradas pela comissão de TCC. Consulte data, horário e local de cada defesa.
        </p>
        <div className="pt-2">
          <a href="/api/public/calendar.ics" className="inline-flex items-center gap-2 rounded-xl border border-current/20 bg-white/10 px-3 py-2 text-[10px] font-black uppercase tracking-wide hover:bg-white/20" title="Baixar agenda para Google Calendar, Outlook ou Apple Calendar">
            <Download className="h-3.5 w-3.5" /> Baixar agenda (.ics)
          </a>
        </div>
      </div>

      {isLoading ? (
        <div className="bg-white p-6 text-center text-xs font-semibold text-slate-500 border border-slate-200">
          Carregando agenda de defesas...
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {processes.map((proc) => {
            const defenseState = getDefenseState(proc);
            const toneVars = getPortalToneCssVars(defenseState);
            return (
              <div
                key={proc.id}
                onClick={() => onSelectProcess(proc.id)}
                className="bg-white p-4 border border-slate-200 shadow-2xs hover:shadow-md transition-all cursor-pointer flex flex-col justify-between space-y-3 relative border-l-2 rounded-xl"
                style={{ ...toneVars, borderLeftColor: 'var(--portal-tone-border)' }}
              >
                <div className="space-y-3">
                  <div className="w-12 h-1" style={{ backgroundColor: 'var(--portal-tone-border)' }} />
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <PortalProcessPill value={proc.protocolo || proc.id} tone={defenseState} className="px-2 py-1 rounded-md border font-black tracking-tight" />
                    <span
                      className="portal-semantic-tone text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wider"
                      style={toneVars}
                    >
                      {proc.etapaAtual}
                    </span>
                  </div>

                  <h3 className="font-bold text-slate-900 text-sm uppercase leading-snug line-clamp-2">
                    {proc.titulo}
                  </h3>

                  <div className="text-xs text-slate-600 space-y-1 pt-1">
                    <div>
                      <strong>Aluno(s):</strong>
                      <StudentNames aluno1={proc.aluno1} aluno2={proc.aluno2} align="left" itemClassName="text-xs font-bold text-slate-900" />
                    </div>
                    <div><strong>Orientador:</strong> {proc.orientador.nome}</div>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-200 space-y-1 text-xs font-medium text-slate-700">
                  <div className="flex items-center gap-1.5 font-bold uppercase text-[11px] tracking-wider" style={{ color: 'var(--portal-tone-text)' }}>
                    <Clock className="w-3.5 h-3.5" />
                    <span>{formatDatePt(proc.defesa.startAt)} • {formatTimeExtenso(proc.defesa.startAt)}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-500 text-[11px] truncate">
                    <MapPin className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                    <span className="truncate">{proc.defesa.local}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
