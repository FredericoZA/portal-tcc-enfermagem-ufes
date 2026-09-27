import React, { useMemo, useState } from 'react';
import { FileStack, FileText, Mail, ClipboardList, Workflow, Variable } from 'lucide-react';
import { IntegrationStudioPanel, type StudioTab } from './IntegrationStudioPanel';
import { MasterDocumentModelsPanel } from './MasterDocumentModelsPanel';

type AreaId = 'models' | 'documents' | 'emails' | 'forms' | 'workflow' | 'variables';
type StudioProps = React.ComponentProps<typeof IntegrationStudioPanel>;

const AREAS: Array<{ id: AreaId; label: string; description: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: 'models', label: 'Modelos', description: 'Arquivos-base e versões do usuário Master.', icon: FileStack },
  { id: 'documents', label: 'Documentos', description: 'Edição e prévia dos documentos gerados.', icon: FileText },
  { id: 'emails', label: 'E-mails', description: 'Mensagens, destinatários, identidade e prévia.', icon: Mail },
  { id: 'forms', label: 'Formulários', description: 'Campos, regras e prévia do formulário.', icon: ClipboardList },
  { id: 'workflow', label: 'Fluxo', description: 'Etapas, eventos e ações do processo.', icon: Workflow },
  { id: 'variables', label: 'Variáveis', description: 'Definições canônicas, usos e saneamento.', icon: Variable },
];

const STUDIO_TAB_BY_AREA: Record<Exclude<AreaId, 'models'>, StudioTab> = {
  documents: 'documents',
  emails: 'emails',
  forms: 'forms',
  workflow: 'workflow',
  variables: 'variables',
};

/**
 * Navegação canônica do estúdio.
 *
 * O popup possui uma única barra lateral; o IntegrationStudioPanel trabalha em
 * modo controlado e não cria uma segunda navegação interna.
 */
export const ModelsVariablesWorkspace: React.FC<StudioProps> = (props) => {
  const [activeArea, setActiveArea] = useState<AreaId>('models');
  const current = useMemo(() => AREAS.find((area) => area.id === activeArea) || AREAS[0], [activeArea]);
  const CurrentIcon = current.icon;

  return (
    <div id="portal-models-workspace" className="flex min-h-[72vh] overflow-hidden rounded-2xl border border-[var(--portal-surface-border)] bg-[var(--portal-surface-muted)]">
      <aside className="w-56 shrink-0 border-r border-[var(--portal-surface-border)] bg-[var(--portal-surface-soft)] p-3">
        <div className="rounded-xl border border-[var(--portal-surface-border)] bg-white p-2 shadow-sm">
          <div className="mb-2 border-b border-slate-200 px-2 pb-2 text-[10px] font-black uppercase tracking-wider text-slate-600">Modelos e Variáveis</div>
          <nav className="space-y-1" aria-label="Áreas de Modelos e Variáveis">
            {AREAS.map((area) => {
              const Icon = area.icon;
              const selected = area.id === activeArea;
              return (
                <button
                  key={area.id}
                  type="button"
                  onClick={() => setActiveArea(area.id)}
                  className={`flex w-full items-start gap-2 rounded-lg border px-2.5 py-2 text-left transition-colors ${selected ? 'border-[var(--portal-brand-moss-soft)] bg-[var(--portal-brand-moss-soft)] text-white' : 'border-transparent bg-white text-slate-800 hover:border-slate-300 hover:bg-[var(--portal-surface-ice)]'}`}
                >
                  <Icon className="mt-0.5 h-4 w-4 shrink-0" />
                  <span><strong className="block text-[11px] font-black uppercase">{area.label}</strong><span className={`mt-0.5 block text-[9px] leading-4 ${selected ? 'text-white/80' : 'text-slate-500'}`}>{area.description}</span></span>
                </button>
              );
            })}
          </nav>
        </div>
      </aside>

      <main className="min-w-0 flex-1 overflow-y-auto bg-[var(--portal-surface-muted)] p-3 sm:p-4">
        <header className="mb-3 flex items-center gap-2 rounded-xl border border-[var(--portal-brand-moss-soft)] bg-[var(--portal-brand-moss-soft)] px-4 py-2.5 text-white shadow-sm">
          <CurrentIcon className="h-4 w-4 text-white" />
          <div><h3 className="text-xs font-black uppercase tracking-wide text-white">{activeArea === 'models' ? 'Gestão de Modelos' : `Editor de ${current.label}`}</h3><p className="mt-0.5 text-[10px] text-white/80">{current.description}</p></div>
        </header>

        <section className="min-w-0 rounded-xl bg-[var(--portal-surface-white)] p-3">
          {activeArea === 'models' ? (
            <MasterDocumentModelsPanel />
          ) : (
            <IntegrationStudioPanel
              {...props}
              activeTab={STUDIO_TAB_BY_AREA[activeArea]}
              hideNavigation
              hideHeader
            />
          )}
        </section>
      </main>
    </div>
  );
};
