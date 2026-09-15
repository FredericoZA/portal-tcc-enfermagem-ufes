import React from 'react';
import { Building2, ExternalLink, Map as MapIcon, MapPin, Navigation } from 'lucide-react';
import { ColorfulHeaderIcon } from '../components/ColorfulHeaderIcon';
import { useAuth } from '../context/AuthContext';
import { resolveInstallationProfile } from '../utils/installationProfile';
import { loadSiteLayoutConfig } from '../utils/siteLayoutConfig';

const GOOGLE_MAPS_ROUTE = 'https://www.google.com/maps/dir/?api=1&destination=-20.2997267,-40.3195203';
const GOOGLE_MAPS_PLACE = 'https://www.google.com/maps/place/Departamento+de+Enfermagem/@-20.2997265,-40.3203702,18z/data=!4m6!3m5!1s0xb83d1ed6851f7f:0x3cd473ff2da6bb32!8m2!3d-20.2997267!4d-40.3195203!16s%2Fg%2F11g49sdt1t?entry=ttu';
const GOOGLE_MAPS_EMBED = 'https://www.google.com/maps?q=-20.2997267,-40.3195203&z=18&t=k&output=embed';
const WAZE_ROUTE = 'https://waze.com/ul?ll=-20.2997267%2C-40.3195203&navigate=yes';
const UFES_MAP = 'https://mapa.ufes.br/?campus=maruipe';

const ExternalAction: React.FC<{
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = ({ href, label, icon: Icon }) => (
  <a
    href={href}
    target="_blank"
    rel="noopener noreferrer"
    className="flex w-full items-center gap-2 rounded-xl border border-[#2d6c50] bg-[#337959] px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-wide text-white shadow-sm transition hover:brightness-95"
  >
    <Icon className="h-4 w-4 shrink-0" />
    <span className="min-w-0 flex-1 text-left leading-4">{label}</span>
    <ExternalLink className="h-3.5 w-3.5 shrink-0 opacity-80" />
  </a>
);

export const ComoChegarPage: React.FC = () => {
  const { settings } = useAuth();
  const profile = resolveInstallationProfile(settings);
  const layout = loadSiteLayoutConfig();
  const location = layout.footerLocationText || profile.defaultDefenseLocation || 'Departamento de Enfermagem · CCS/UFES · Campus de Maruípe · Vitória/ES';

  return (
    <div id="como-chegar-page-container" className="mx-auto max-w-5xl space-y-3 py-2">
      <section className="rounded-2xl border border-emerald-900/80 bg-[#005830] px-3.5 py-3 text-white shadow-sm sm:px-4">
        <div className="flex items-center gap-2">
          <ColorfulHeaderIcon type="location" />
          <h1 className="text-sm font-black uppercase tracking-tight text-white sm:text-base">Como chegar</h1>
        </div>
      </section>

      <section className="grid gap-2.5 rounded-2xl border border-slate-300 bg-[#f0f0f0] p-3 shadow-sm sm:p-4 lg:grid-cols-[minmax(0,1fr)_170px] lg:items-stretch">
        <div className="flex min-w-0 items-start gap-2.5 rounded-xl border border-slate-200 bg-white p-3">
          <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-[#337959]" />
          <div className="min-w-0">
            <h2 className="text-xs font-black uppercase tracking-wide text-slate-900">Departamento de Enfermagem — CCS/UFES</h2>
            <p className="mt-0.5 text-[11px] leading-4 text-slate-600">{location}</p>
            <p className="mt-1 text-[10px] leading-4 text-slate-500">Os aplicativos de navegação usam a localização atual do dispositivo quando essa permissão estiver disponível.</p>
          </div>
        </div>

        <div className="flex flex-col justify-center gap-1.5">
          <ExternalAction href={GOOGLE_MAPS_ROUTE} label="Google Maps" icon={MapPin} />
          <ExternalAction href={WAZE_ROUTE} label="Waze" icon={Navigation} />
          <ExternalAction href={UFES_MAP} label="Mapa da UFES" icon={MapIcon} />
        </div>
      </section>

      <section className="grid items-start gap-3 lg:grid-cols-[1.45fr_.9fr]">
        <div className="overflow-hidden rounded-2xl border border-slate-300 bg-[#f0f0f0] shadow-sm">
          <iframe
            title="Mapa do Campus de Maruípe com o Departamento de Enfermagem"
            src={GOOGLE_MAPS_EMBED}
            className="block aspect-[16/10] w-full border-0 bg-slate-200"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            allowFullScreen
          />
          <div className="flex items-center justify-between gap-3 px-3 py-2 text-[10px] font-semibold text-slate-600">
            <span>Mapa interativo em modo satélite com o Departamento de Enfermagem marcado.</span>
            <a
              href={GOOGLE_MAPS_PLACE}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex shrink-0 items-center gap-1 text-[#337959] hover:underline"
              title="Abrir o ponto do Departamento de Enfermagem no Google Maps"
            >
              Abrir mapa
              <ExternalLink className="h-3.5 w-3.5 shrink-0" />
            </a>
          </div>
        </div>

        <div className="space-y-3">
          <section className="rounded-2xl border border-slate-300 bg-[#f0f0f0] p-3 shadow-sm">
            <h2 className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-slate-900">
              <Navigation className="h-4 w-4 text-[#337959]" />
              Referências de chegada
            </h2>
            <div className="mt-2 space-y-1.5 text-[11px] leading-4 text-slate-700">
              <p className="rounded-lg border border-slate-200 bg-white px-3 py-2"><strong>Vindo do HUCAM:</strong> suba a ladeira principal do Campus de Maruípe e mantenha-se à direita nas duas bifurcações.</p>
              <p className="rounded-lg border border-slate-200 bg-white px-3 py-2"><strong>Referência:</strong> o Departamento de Enfermagem fica em frente à Capela Universitária de Maruípe.</p>
              <p className="rounded-lg border border-slate-200 bg-white px-3 py-2"><strong>Estacionamento:</strong> há vagas externas gratuitas, sujeitas à lotação.</p>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-300 bg-[#f0f0f0] p-3 shadow-sm">
            <h2 className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-slate-900">
              <Building2 className="h-4 w-4 text-[#337959]" />
              Locais atuais de apresentação
            </h2>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <div className="rounded-xl border border-slate-200 bg-white px-3 py-2.5">
                <div className="text-[10px] font-extrabold uppercase tracking-wide text-slate-900">Auditório de Enfermagem</div>
                <div className="mt-0.5 text-[10px] text-slate-600">1º pavimento</div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white px-3 py-2.5">
                <div className="text-[10px] font-extrabold uppercase tracking-wide text-slate-900">Sala de Reuniões</div>
                <div className="mt-0.5 text-[10px] text-slate-600">2º pavimento</div>
              </div>
            </div>
            <p className="mt-2 text-[10px] leading-4 text-slate-500">O local específico de cada defesa continua indicado no calendário e no convite da apresentação.</p>
          </section>
        </div>
      </section>
    </div>
  );
};
