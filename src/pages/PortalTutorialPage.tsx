import React, {useState} from 'react';
import {BookOpen, Download} from 'lucide-react';
import {PortalIllustratedGuide} from '../components/PortalIllustratedGuide';
import {PortalSectionDivider} from '../components/PortalSectionDivider';
import {ColorfulHeaderIcon} from '../components/ColorfulHeaderIcon';

interface PortalTutorialPageProps {
  onNavigate: (tab: string) => void;
}

type Role = 'aluno' | 'orientador' | 'examinador' | 'visitante';

const roleLabels: Record<Role, string> = {
  aluno: 'Aluno',
  orientador: 'Orientador',
  examinador: 'Examinador',
  visitante: 'Visitante',
};

export const PortalTutorialPage: React.FC<PortalTutorialPageProps> = () => {
  const [role, setRole] = useState<Role>('aluno');

  return (
    <div id="portal-tutorial-page" className="portal-public-shell portal-layer-panel mx-auto max-w-none overflow-hidden rounded-2xl border border-slate-300 shadow-sm">
      <section className="portal-public-header text-white">
        <div className="portal-public-title-row flex-wrap gap-2">
          <ColorfulHeaderIcon type="tutorial" />
          <h1 className="text-base font-black normal-case tracking-tight text-white sm:text-lg">Como usar o Portal de TCC</h1>
        </div>
        <div className="portal-public-filter-row portal-tutorial-filter-row flex-wrap gap-2 text-xs min-w-0">
          <span className="portal-filter-label opacity-80 shrink-0">Meu perfil:</span>
          <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Perfil do manual">
            {(Object.keys(roleLabels) as Role[]).map(key => (
              <button key={key} type="button" onClick={() => setRole(key)} data-selected={role === key ? 'true' : 'false'} aria-pressed={role === key} className="portal-standard-filter-chip portal-table-filter-chip cursor-pointer select-none">
                <span>{roleLabels[key]}</span>
              </button>
            ))}
          </div>
        </div>
      </section>
      <PortalSectionDivider />
      <div className="p-3 sm:p-4" key={role}>
        <aside id="tutorial-manual-notice" aria-labelledby="tutorial-manual-heading" className="portal-instruction mb-3 flex flex-wrap items-center gap-3 rounded-xl p-3 sm:mb-4 sm:max-w-fit lg:w-1/3 lg:min-w-[23rem] lg:max-w-none">
          <BookOpen className="h-5 w-5 shrink-0" aria-hidden="true"/>
          <div className="min-w-0 flex-1 basis-32">
            <h2 id="tutorial-manual-heading" className="text-sm font-bold">Acesse o manual detalhado</h2>
            <p className="mt-1 text-sm leading-relaxed">Consulte as orientações completas para acessar e acompanhar seu TCC.</p>
          </div>
          <a id="tutorial-manual-pdf" href="/manual/manual-portal-tcc.pdf" target="_blank" rel="noopener noreferrer" className="inline-flex min-h-9 shrink-0 items-center justify-center gap-2 rounded-full border border-amber-400 bg-amber-100 px-3 py-2 text-xs font-bold text-amber-950 hover:bg-amber-200" aria-label="Abrir manual completo do Portal de TCC em PDF"><Download className="h-4 w-4" aria-hidden="true"/><span>Manual em PDF</span></a>
        </aside>
        <PortalIllustratedGuide role={role}/>
      </div>
    </div>
  );
};
