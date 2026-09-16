import React from 'react';
import { createPortal } from 'react-dom';
import {
  BarChart3,
  BookOpen,
  CalendarDays,
  FileText,
  GraduationCap,
  LayoutPanelTop,
  LogIn,
  MapPin,
  Palette,
  PanelBottom,
  PanelLeft,
  PanelsTopLeft,
  ShieldCheck,
  X,
} from 'lucide-react';
import type { GlobalSettings } from '../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onOpenAppearance: () => void;
  settings: GlobalSettings;
  onSettingsUpdated: (settings: GlobalSettings) => void;
  showNotification: (message: string) => void;
}

const screens = [
  { label: 'Barra superior', icon: LayoutPanelTop },
  { label: 'Barra lateral', icon: PanelLeft },
  { label: 'Rodapé', icon: PanelBottom },
  { label: 'Login e acesso', icon: LogIn },
  { label: 'Calendário', icon: CalendarDays },
  { label: 'Repositório', icon: BookOpen },
  { label: 'Meus TCCs', icon: GraduationCap },
  { label: 'Área do Presidente', icon: ShieldCheck },
  { label: 'Indicadores', icon: BarChart3 },
  { label: 'Como chegar', icon: MapPin },
  { label: 'Fluxo do TCC', icon: FileText },
  { label: 'Pop-ups e formulários', icon: PanelsTopLeft },
] as const;

export const PortalPersonalizationHubModal: React.FC<Props> = ({ isOpen, onClose, onOpenAppearance }) => {
  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[1000000] flex items-start justify-center overflow-y-auto bg-slate-950/70 p-3 backdrop-blur-sm">
      <div
        id="portal-personalization-hub"
        role="dialog"
        aria-modal="true"
        aria-label="Personalização do Portal TCC"
        className="my-4 w-full max-w-5xl overflow-hidden rounded-2xl border border-slate-300 bg-[#f0f0f0] shadow-2xl"
      >
        <header className="flex items-center justify-between bg-[#337959] px-4 py-3 text-white">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/70 bg-white shadow-sm">
              <Palette className="h-4 w-4 text-slate-700" />
            </span>
            <h2 className="text-sm font-black uppercase tracking-wide">Personalização do Portal TCC</h2>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg border border-white/70 bg-white p-1.5 text-slate-800 shadow-sm" aria-label="Fechar">
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="space-y-3 p-3 sm:p-4">
          <div className="rounded-xl border border-slate-300 bg-white p-3 shadow-sm">
            <div className="text-xs font-black uppercase tracking-wide text-slate-900">Telas e superfícies do Portal</div>
            <p className="mt-1 text-[11px] leading-4 text-slate-600">
              A aparência é global: o Master personaliza uma vez e visitantes, alunos, orientadores e Presidência recebem o mesmo padrão visual. Colunas e ordem das tabelas são configuradas na engrenagem da própria tabela.
            </p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {screens.map(({ label, icon: Icon }) => (
                <div key={label} className="flex min-h-11 items-center gap-2 rounded-lg border border-slate-200 bg-[#f0f0f0] px-3 py-2 text-[11px] font-extrabold text-slate-800">
                  <Icon className="h-4 w-4 shrink-0 text-[#337959]" />
                  <span>{label}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-slate-300 bg-white p-3 shadow-sm">
            <div className="flex items-start gap-2">
              <Palette className="mt-0.5 h-5 w-5 shrink-0 text-[#337959]" />
              <div>
                <div className="text-xs font-black uppercase tracking-wide text-slate-900">Editor completo de aparência</div>
                <p className="mt-1 text-[11px] leading-4 text-slate-600">
                  Cores, tipografia, títulos, margens, espaçamentos, células, cabeçalhos, botões, filtros, bordas, arredondamento, sombras, logos, QR Code e pop-ups ficam concentrados no editor visual.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-slate-300 pt-3">
            <button type="button" onClick={onClose} className="inline-flex min-w-28 items-center justify-center rounded-lg border border-[#2d6c50] bg-[#337959] px-4 py-2 text-xs font-black uppercase tracking-wide text-white shadow-sm hover:brightness-95">
              Fechar
            </button>
            <button type="button" onClick={() => { onClose(); onOpenAppearance(); }} className="inline-flex min-w-44 items-center justify-center gap-2 rounded-lg border border-[#2d6c50] bg-[#337959] px-4 py-2 text-xs font-black uppercase tracking-wide text-white shadow-sm hover:brightness-95">
              <Palette className="h-4 w-4" /> Abrir personalização
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
};
