import React, { useEffect, useState } from 'react';
import type { ProcessData } from '../types';
import { apiClient } from '../services/apiClient';
import { ExternalLink, FileText, FolderOpen, ShieldCheck } from 'lucide-react';
import { GoogleDriveExplorer } from '../components/GoogleDriveExplorer';
import { ColorfulHeaderIcon } from '../components/ColorfulHeaderIcon';
import { useAuth } from '../context/AuthContext';
import { resolveInstallationProfile } from '../utils/installationProfile';

interface DocumentosPageProps {
  onSelectProcess: (processId: string) => void;
}
const TYPES = [
  ['CONVITE','Carta-convite'],
  ['ATA','Ata da defesa'],
  ['TERMO','Termo de autorização (quando aplicável)'],
  ['DECLARACAO','Declaração da Comissão']
] as const;

export const DocumentosPage: React.FC<DocumentosPageProps> = ({ onSelectProcess }) => {
  const { settings } = useAuth();
  const profile = resolveInstallationProfile(settings);
  const [processes, setProcesses] = useState<ProcessData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active=true;
    setIsLoading(true);
    apiClient.getProcesses().then(data=>{
      if(active){setProcesses(data);setError('');}
    }).catch(()=>{
      if(active)setError('Não foi possível carregar os processos. Atualize a página para tentar novamente.');
    }).finally(()=>{if(active)setIsLoading(false);});
    return ()=>{active=false;};
  },[]);

  return (
    <div id="documentos-page-container" className="space-y-3.5 max-w-7xl mx-auto py-1.5">
      <div className="bg-[var(--portal-brand-header)] text-white p-3.5 sm:p-4 rounded-2xl border border-emerald-900/80 shadow-sm space-y-1">
        <div className="text-emerald-200 text-[10px] font-extrabold normal-case tracking-widest leading-none">
          {profile.institutionAcronym} • {profile.departmentName || profile.institutionName}
        </div>
        <div className="flex items-center gap-2 mt-1">
          <ColorfulHeaderIcon type="documents" />
          <h1 className="text-sm sm:text-base font-black text-white normal-case tracking-tight">Documentos dos TCCs</h1>
        </div>
        <p className="text-[10px] sm:text-[11px] text-emerald-100/95 font-medium leading-normal mt-0.5">
          Consulte os documentos realmente emitidos e suas assinaturas pelo detalhe do processo, conforme seu perfil de acesso.
        </p>
      </div>

      <section className="rounded-xl border border-slate-300 bg-white p-3 sm:p-4 space-y-2" aria-label="Legislação aplicável aos documentos">
        <h2 className="flex items-center gap-2 text-xs font-black text-slate-900 sm:text-sm"><ShieldCheck className="h-4 w-4 text-[var(--portal-brand-action)]"/>Legislação, privacidade e revisão humana</h2>
        <p className="text-xs leading-5 text-slate-700">A Portaria Normativa GR/Ufes nº 310/2026 disciplina o uso institucional de sistemas de inteligência artificial. Neste portal, as atas são preenchidas a partir de modelos e regras programadas. O texto-base do parecer não avalia o TCC: o orientador deve registrar a fundamentação deliberada pela banca e conferir a versão final.</p>
        <p className="text-xs leading-5 text-slate-700">Os documentos e dados pessoais seguem controles de acesso, autorização de publicação e demais medidas de proteção aplicáveis. Essas salvaguardas técnicas não substituem a análise institucional de conformidade com a LGPD.</p>
        <a href="/legislacao/PORTARIA_NORMATIVA_GR_UFES_310_2026.md" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-bold text-[var(--portal-brand-action)] underline-offset-2 hover:underline"><ExternalLink className="h-3.5 w-3.5"/>Consultar Portaria nº 310/2026 (transcrição para leitura)</a>
      </section>

      <GoogleDriveExplorer />

      {isLoading ? <p role="status" className="rounded-lg border border-slate-200 bg-white p-6 text-xs text-slate-600">Carregando documentos…</p>
        : error ? <p role="alert" className="rounded-lg border border-red-300 bg-white p-6 text-xs text-red-800">{error}</p>
        : processes.length===0 ? <p className="rounded-lg border border-slate-200 bg-white p-6 text-xs text-slate-600">Não há TCCs vinculados a este acesso.</p>
        : <div className="space-y-3.5">
          {processes.map(proc=>(
            <section key={proc.id} className="space-y-3 border border-slate-200 border-l-2 border-l-emerald-600 bg-white p-4 shadow-2xs">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
                <div className="min-w-0"><span className="rounded-full bg-slate-900 px-2.5 py-0.5 text-xs font-black text-white">{proc.protocolo}</span><h3 className="mt-2 text-sm font-bold text-slate-900">{proc.titulo}</h3></div>
                <button type="button" className="portal-action inline-flex items-center gap-2" onClick={()=>onSelectProcess(proc.id)}><FolderOpen className="h-3.5 w-3.5"/>Abrir documentos do TCC</button>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {TYPES.map(([kind,label])=>(
                  <div key={kind} className="border border-slate-200 bg-slate-50 p-3">
                    <p className="flex items-center gap-2 text-xs font-bold text-slate-900"><FileText className="h-4 w-4" aria-hidden="true"/>{label}</p>
                    <p className="mt-1 text-xs text-slate-600">Disponibilidade e assinaturas: consultar o processo.</p>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>}
    </div>
  );
};
