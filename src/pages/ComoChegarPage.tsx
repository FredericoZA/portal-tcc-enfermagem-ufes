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
    className="portal-action-green relative flex min-h-[64px] w-full flex-col items-center justify-center gap-1 rounded-xl border border-[#2d6c50] bg-[#337959] px-2 py-2.5 text-center text-[9px] font-extrabold uppercase tracking-wide text-white shadow-sm transition hover:brightness-95"
  >
    <ExternalLink className="absolute right-2 top-2 h-3 w-3 shrink-0 opacity-75" />
    <Icon className="h-5 w-5 shrink-0" />
    <span className="leading-3.5">{label}</span>
  </a>
);

export const ComoChegarPage: React.FC = () => {
  const { settings } = useAuth();
  const profile = resolveInstallationProfile(settings);
  const layout = loadSiteLayoutConfig();
  const location = layout.footerLocationText || profile.defaultDefenseLocation || 'Departamento de Enfermagem · CCS/UFES · Campus de Maruípe · Vitória/ES';

  return (
    <div id="como-chegar-page-container" className="portal-public-shell mx-auto max-w-none overflow-hidden rounded-2xl border border-slate-300 bg-[#e1e6e9] shadow-sm">
      <section className="portal-public-header border-b-2 border-white bg-[#005830] px-3.5 py-3 text-white sm:px-4">
        <div className="flex items-center gap-2">
          <ColorfulHeaderIcon type="location" />
          <h1 className="text-sm font-black uppercase tracking-tight text-white sm:text-base">Como chegar</h1>
        </div>
      </section>

      <section className="portal-layer-panel bg-[#e1e6e9] p-3 sm:p-4">
        <div className="grid items-start gap-3 md:grid-cols-[minmax(0,1.45fr)_minmax(280px,.8fr)] xl:grid-cols-[minmax(0,1.65fr)_minmax(330px,.72fr)]">
          <div className="portal-layer-card overflow-hidden rounded-2xl border border-slate-300 bg-[#d5dce0] shadow-sm">
            <iframe
              title="Mapa do Campus de Maruípe com o Departamento de Enfermagem"
              src={GOOGLE_MAPS_EMBED}
              className="block min-h-[360px] w-full border-0 bg-slate-200 md:min-h-[520px] xl:min-h-[600px]"
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
                className="inline-flex shrink-0 items-center gap-1 font-bold text-[#337959] hover:underline"
                title="Abrir o ponto do Departamento de Enfermagem no Google Maps"
              >
                Abrir mapa
                <ExternalLink className="h-3.5 w-3.5 shrink-0" />
              </a>
            </div>
          </div>

          <div className="space-y-3">
            <section className="portal-layer-card rounded-2xl border border-slate-300 bg-[#d5dce0] p-3 shadow-sm">
              <div className="flex items-start gap-2.5">
                <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-[#337959]" />
                <div className="min-w-0">
                  <h2 className="text-xs font-black uppercase tracking-wide text-slate-900">Departamento de Enfermagem — CCS/UFES</h2>
                  <p className="mt-0.5 text-[11px] leading-4 text-slate-700">{location}</p>
                  <p className="mt-1 text-[10px] leading-4 text-slate-600">Os aplicativos de navegação usam a localização atual do dispositivo quando essa permissão estiver disponível.</p>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-1.5">
                <ExternalAction href={GOOGLE_MAPS_ROUTE} label="Google Maps" icon={MapPin} />
                <ExternalAction href={WAZE_ROUTE} label="Waze" icon={Navigation} />
                <ExternalAction href={UFES_MAP} label="Mapa da UFES" icon={MapIcon} />
              </div>
            </section>

            <section className="portal-layer-card rounded-2xl border border-slate-300 bg-[#d5dce0] p-3 shadow-sm">
              <h2 className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-slate-900">
                <Navigation className="h-4 w-4 text-[#337959]" />
                Referências de chegada
              </h2>
              <div className="mt-2 space-y-1.5 text-[11px] leading-4 text-slate-700">
                <p className="portal-layer-inner rounded-lg border border-slate-200 bg-white px-3 py-2"><strong>Vindo do HUCAM:</strong> suba a ladeira principal do Campus de Maruípe e mantenha-se à direita nas duas bifurcações.</p>
                <p className="portal-layer-inner rounded-lg border border-slate-200 bg-white px-3 py-2"><strong>Referência:</strong> o Departamento de Enfermagem fica em frente à Capela Universitária de Maruípe.</p>
                <p className="portal-layer-inner rounded-lg border border-slate-200 bg-white px-3 py-2"><strong>Estacionamento:</strong> há vagas externas gratuitas, sujeitas à lotação.</p>
              </div>
            </section>

            <section className="portal-layer-card rounded-2xl border border-slate-300 bg-[#d5dce0] p-3 shadow-sm">
              <h2 className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-slate-900">
                <Building2 className="h-4 w-4 text-[#337959]" />
                Locais atuais de apresentação
              </h2>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <div className="portal-layer-inner rounded-xl border border-slate-200 bg-white px-3 py-2.5">
                  <div className="text-[10px] font-extrabold uppercase tracking-wide text-slate-900">Auditório de Enfermagem</div>
                  <div className="mt-0.5 text-[10px] text-slate-600">1º pavimento</div>
                </div>
                <div className="portal-layer-inner rounded-xl border border-slate-200 bg-white px-3 py-2.5">
                  <div className="text-[10px] font-extrabold uppercase tracking-wide text-slate-900">Sala de Reuniões</div>
                  <div className="mt-0.5 text-[10px] text-slate-600">2º pavimento</div>
                </div>
              </div>
              <p className="mt-2 text-[10px] leading-4 text-slate-600">O local específico de cada defesa continua indicado no calendário e no convite da apresentação.</p>
            </section>
          </div>
        </div>
      </section>
    </div>
  );
};
