import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

export interface SettingsWorkspaceSection {
  id: string;
  label: string;
  description?: string;
  icon?: React.ComponentType<{ className?: string }>;
  content: React.ReactNode;
  /**
   * Full-bleed sections use the entire workspace content area, without the
   * generic inner padding/card. This is appropriate for self-contained
   * operational panels such as the infrastructure integrations dashboard.
   */
  fullBleed?: boolean;
}

interface SettingsWorkspaceModalProps {
  open: boolean;
  title: string;
  icon?: React.ComponentType<{ className?: string }>;
  sections: SettingsWorkspaceSection[];
  onClose: () => void;
}

type EmbeddedCapableProps = { embedded?: boolean };

const SettingsWorkspaceHeaderHostContext = createContext<HTMLDivElement | null>(null);

export const SettingsWorkspaceHeaderPortal: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const host = useContext(SettingsWorkspaceHeaderHostContext);
  return host ? createPortal(children, host) : null;
};

export const SettingsWorkspaceModal: React.FC<SettingsWorkspaceModalProps> = ({ open, title, icon: TitleIcon, sections, onClose }) => {
  const firstId = sections[0]?.id || '';
  const [activeId, setActiveId] = useState(firstId);
  const [headerHost, setHeaderHost] = useState<HTMLDivElement | null>(null);

  useEffect(() => {
    if (open && (!activeId || !sections.some((section) => section.id === activeId))) setActiveId(firstId);
  }, [open, activeId, firstId, sections]);

  useEffect(() => {
    if (!open) setHeaderHost(null);
  }, [open]);

  const current = useMemo(() => sections.find((section) => section.id === activeId) || sections[0], [sections, activeId]);
  if (!open || !current) return null;

  const singlePane = sections.length === 1;
  // `integrations` predates the explicit fullBleed contract. Keeping it as a
  // compatibility default avoids coupling visual correctness to old callers.
  const fullBleed = current.fullBleed ?? current.id === 'integrations';
  const singlePaneContent = singlePane && React.isValidElement(current.content)
    ? React.cloneElement(current.content as React.ReactElement<EmbeddedCapableProps>, { embedded: true })
    : current.content;

  const workspaceContent = singlePane ? (
    <main className="portal-settings-single-pane min-w-0 flex-1 overflow-y-auto" style={{ backgroundColor: 'var(--portal-surface-layer-1)' }}>
      {singlePaneContent}
    </main>
  ) : (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden md:flex-row" style={{ backgroundColor: 'var(--portal-surface-layer-1)' }}>
      <aside className="max-h-52 w-full shrink-0 overflow-y-auto border-b border-slate-300 p-3 md:max-h-none md:w-64 md:border-b-0 md:border-r" style={{ backgroundColor: 'var(--portal-surface-layer-2)' }}>
        <div className="rounded-xl border border-slate-300 p-2 shadow-sm" style={{ backgroundColor: 'var(--portal-surface-inner)' }}>
          <div className="mb-2 border-b border-slate-200 px-2 pb-2 text-[10px] font-black uppercase tracking-wider text-slate-600">Navegação</div>
          <div className="space-y-1">{sections.map((section) => {
            const Icon = section.icon;
            const selected = section.id === current.id;
            return <button
              key={section.id}
              type="button"
              onClick={() => setActiveId(section.id)}
              className={`flex w-full items-start gap-2 rounded-lg border px-2.5 py-2 text-left transition-colors ${selected ? 'text-white' : 'border-transparent text-slate-800 hover:border-slate-300'}`}
              style={selected
                ? { backgroundColor: 'var(--portal-green-action)', borderColor: 'var(--portal-green-action-border)' }
                : { backgroundColor: 'var(--portal-surface-inner)' }}
            >
              {Icon && <Icon className="mt-0.5 h-4 w-4 shrink-0"/>}
              <span className="min-w-0"><strong className="block text-[11px] font-black uppercase">{section.label}</strong>{section.description && <span className={`mt-0.5 block text-[9px] leading-4 ${selected ? 'text-white/80' : 'text-slate-500'}`}>{section.description}</span>}</span>
            </button>;
          })}</div>
        </div>
      </aside>
      <main
        className={`portal-settings-workspace-main min-w-0 flex-1 overflow-y-auto ${fullBleed ? 'p-0' : 'p-3 sm:p-4'}`}
        data-portal-full-bleed={fullBleed ? 'true' : 'false'}
        style={{ backgroundColor: fullBleed ? 'var(--portal-surface-layer-2)' : 'var(--portal-surface-layer-1)' }}
      >
        <div
          className={`portal-settings-workspace-content min-w-0 ${fullBleed ? 'min-h-full h-full rounded-none' : 'rounded-xl'}`}
          data-portal-full-bleed={fullBleed ? 'true' : 'false'}
          style={{ backgroundColor: 'var(--portal-surface-layer-2)' }}
        >
          {current.content}
        </div>
      </main>
    </div>
  );

  return <div className="fixed inset-0 z-[1000005] flex items-center justify-center bg-slate-950/65 p-3 backdrop-blur-sm" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}>
    <section
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="portal-settings-workspace flex max-h-[94vh] w-full max-w-[1600px] flex-col overflow-hidden rounded-2xl border border-slate-300 shadow-2xl"
      style={{ backgroundColor: 'var(--portal-surface-page)' }}
    >
      <header className="portal-settings-workspace-header flex min-h-[58px] items-center justify-between gap-3 border-b-[16px] border-white px-4 py-3 text-white" style={{ backgroundColor: 'var(--portal-green-header)' }}>
        <div className="flex min-w-0 items-center gap-2">{TitleIcon && <TitleIcon className="h-5 w-5 shrink-0"/>}<h2 className="truncate text-sm font-black uppercase tracking-wide">{title}</h2></div>
        <div className="flex min-w-0 items-center justify-end gap-1.5">
          <div ref={setHeaderHost} className="flex min-w-0 flex-wrap items-center justify-end gap-1.5" data-settings-workspace-header-actions="true" />
          <button type="button" onClick={onClose} className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white bg-white text-black shadow-sm" aria-label="Fechar"><X className="h-4 w-4"/></button>
        </div>
      </header>

      <SettingsWorkspaceHeaderHostContext.Provider value={headerHost}>
        {workspaceContent}
      </SettingsWorkspaceHeaderHostContext.Provider>
    </section>
  </div>;
};