import React from 'react';
import { MapPin, Building2 } from 'lucide-react';
import { ColorfulHeaderIcon } from '../components/ColorfulHeaderIcon';
import { useAuth } from '../context/AuthContext';
import { resolveInstallationProfile } from '../utils/installationProfile';
import { loadSiteLayoutConfig } from '../utils/siteLayoutConfig';

export const ComoChegarPage: React.FC = () => {
  const { settings } = useAuth();
  const profile = resolveInstallationProfile(settings);
  const layout = loadSiteLayoutConfig();
  const location = layout.footerLocationText || profile.defaultDefenseLocation;
  return (
    <div id="como-chegar-page-container" className="space-y-3 max-w-4xl mx-auto py-2">
      <div className="bg-[#005830] text-white p-3.5 sm:p-4 rounded-2xl border border-emerald-900/80 shadow-sm space-y-1">
        <div className="text-emerald-200 text-[10px] font-extrabold uppercase tracking-widest leading-none">
          {profile.institutionAcronym} • {profile.departmentName || profile.institutionName}
        </div>
        <div className="flex items-center gap-2 mt-1">
          <ColorfulHeaderIcon type="location" />
          <h1 className="text-sm sm:text-base font-black text-white uppercase tracking-tight">
            Local das Defesas
          </h1>
        </div>
        <p className="text-[10px] sm:text-[11px] text-emerald-100/95 font-medium leading-normal mt-0.5">
          Informações de localização publicadas para as defesas de {profile.courseName}.
        </p>
      </div>

      <div className="bg-white p-6 border border-slate-300 rounded-2xl shadow-sm space-y-6 text-xs text-slate-700 mt-3">
        <div className="flex items-start gap-3 bg-emerald-50 p-4 border border-emerald-200 border-l-4 border-l-emerald-600">
          <Building2 className="w-6 h-6 text-emerald-700 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h3 className="font-extrabold text-slate-900 text-sm uppercase">
              {profile.campusName || profile.departmentName}
            </h3>
            <p className="text-slate-700">
              {location}
            </p>
          </div>
        </div>

        <div className="flex items-start gap-3 bg-slate-50 p-4 border border-slate-200">
          <MapPin className="w-5 h-5 text-emerald-700 shrink-0" />
          <p>
            O local definitivo de cada defesa aparece no calendário e no convite. O usuário Master pode editar estas orientações em Configurações, sem alterar o código.
          </p>
        </div>
      </div>
    </div>
  );
};
