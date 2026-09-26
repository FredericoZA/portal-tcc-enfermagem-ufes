import React, { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';

export interface SettingsWorkspaceSection {
  id: string;
  label: string;
  description?: string;
  icon?: React.ComponentType<{ className?: string }>;
  content: React.ReactNode;
}

interface SettingsWorkspaceModalProps {
  open: boolean;
  title: string;
  icon?: React.ComponentType<{ className?: string }>;
  sections: SettingsWorkspaceSection[];
  onClose: () => void;
}

export const SettingsWorkspaceModal: React.FC<SettingsWorkspaceModalProps> = ({ open, title, icon: TitleIcon, sections, onClose }) => {
  const firstId = sections[0]?.id || '';
  const [activeId, setActiveId] = useState(firstId);
  useEffect(() => {
    if (open && (!activeId || !sections.some((section) => section.id === activeId))) setActiveId(firstId);
  }, [open, activeId, firstId, sections]);
  const current = useMemo(() => sections.find((section) => section.id === activeId) || sections[0], [sections, activeId]);
  if (!open || !current) return null;
  const CurrentIcon = current.icon;

  return <div className="fixed inset-0 z-[1000005] flex items-center justify-center bg-slate-950/65 p-3 backdrop-blur-sm" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}>
    <section
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="portal-settings-workspace flex max-h-[94vh] w-full max-w-[1600px] flex-col overflow-hidden rounded-2xl border border-slate-300 shadow-2xl"
      style={{ backgroundColor: 'var(--portal-surface-page)' }}
    >
      <header className="portal-settings-workspace-header flex items-center justify-between border-b-[16px] border-white px-4 py-3 text-white" style={{ backgroundColor: 'var(--portal-green-header)' }}>
        <div className="flex min-w-0 items-center gap-2">{TitleIcon && <TitleIcon className="h-5 w-5 shrink-0"/>}<h2 className="truncate text-sm font-black uppercase tracking-wide">{title}</h2></div>
        <button type="button" onClick={onClose} className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white bg-white text-black shadow-sm" aria-label="Fechar"><X className="h-4 w-4"/></button>
      </header>
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
        <main className="min-w-0 flex-1 overflow-y-auto p-3 sm:p-4" style={{ backgroundColor: 'var(--portal-surface-layer-1)' }}>
          <div className="mb-3 flex items-center gap-2 rounded-xl border px-4 py-2.5 text-white shadow-sm" style={{ backgroundColor: 'var(--portal-green-action)', borderColor: 'var(--portal-green-action-border)' }}>{CurrentIcon && <CurrentIcon className="h-4 w-4"/>}<div><h3 className="text-xs font-black uppercase tracking-wide">{current.label}</h3>{current.description && <p className="mt-0.5 text-[10px] text-white/80">{current.description}</p>}</div></div>
          <div className="portal-settings-workspace-content min-w-0 rounded-xl" style={{ backgroundColor: 'var(--portal-surface-layer-2)' }}>{current.content}</div>
        </main>
      </div>
    </section>
  </div>;
};
