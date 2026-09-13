import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { useAuth } from '../context/AuthContext';
import {
  MapPin,
  ChevronUp,
  ChevronDown,
  Lightbulb,
  Info,
  Car,
  MessageCircle,
  Mail
} from 'lucide-react';
import { loadSiteLayoutConfig, SITE_LAYOUT_EVENT, SiteLayoutConfig } from '../utils/siteLayoutConfig';
import { resolveInstallationProfile } from '../utils/installationProfile';

interface FooterProps {
  showLocationDirections?: boolean;
}

interface FooterCommissionMember {
  id?: string;
  name: string;
  email?: string;
  startDate?: string;
  endDate?: string;
  active?: boolean;
}

export const Footer: React.FC<FooterProps> = ({ showLocationDirections = false }) => {
  const { settings } = useAuth();
  const typedSettings = settings as any;
  const installationProfile=resolveInstallationProfile(settings);
  const [showDirections, setShowDirections] = useState(false);
  const [layoutConfig, setLayoutConfig] = useState<SiteLayoutConfig>(loadSiteLayoutConfig());
  const [generatedQrCode, setGeneratedQrCode] = useState('');

  useEffect(() => {
    const handleLayoutChange = (e: Event) => {
      const customEvent = e as CustomEvent<SiteLayoutConfig>;
      if (customEvent.detail) {
        setLayoutConfig(customEvent.detail);
      } else {
        setLayoutConfig(loadSiteLayoutConfig());
      }
    };

    window.addEventListener(SITE_LAYOUT_EVENT, handleLayoutChange);
    return () => {
      window.removeEventListener(SITE_LAYOUT_EVENT, handleLayoutChange);
    };
  }, []);

  const presidentName = settings?.commissionPresidentName || layoutConfig.footerPresidentName || 'Não configurado';
  const presidentEmail = settings?.commissionPresidentEmail || '';
  const presidentLabel = layoutConfig.footerPresidentLabel || 'Presidente da Comissão';
  const membersLabel = layoutConfig.footerMembersLabel || 'Membros da Comissão';
  const configuredCommissionMembers: FooterCommissionMember[] = Array.isArray(typedSettings?.commissionMembers)
    ? typedSettings.commissionMembers.filter((member: FooterCommissionMember) => member && member.active !== false && String(member.name || '').trim())
    : [];
  const legacyCommissionMembers: FooterCommissionMember[] = [
    settings?.commissionMember2Name,
    settings?.commissionMember3Name,
    settings?.commissionMember4Name,
    settings?.commissionMember5Name,
  ].filter(Boolean).map((name, index) => ({ id: `legacy-${index}`, name: String(name), email: '', startDate: '', endDate: '', active: true }));
  const layoutCommissionMembers: FooterCommissionMember[] = (layoutConfig.footerMembersList || []).filter(Boolean).map((name, index) => ({ id: `layout-${index}`, name, email: '', startDate: '', endDate: '', active: true }));
  const membersList = configuredCommissionMembers.length
    ? configuredCommissionMembers
    : legacyCommissionMembers.length
      ? legacyCommissionMembers
      : layoutCommissionMembers;
  const devTitle = layoutConfig.footerDevTitle || 'Desenvolvimento da Plataforma e Suporte';
  const devName = layoutConfig.footerDevName || settings?.portalMaintainerName || 'Equipe responsável pela instalação';
  const whatsappLabel = layoutConfig.footerWhatsappLabel || 'WhatsApp Secretária';
  const whatsappUrl = layoutConfig.footerWhatsappUrl || settings?.whatsappUrl || '';
  const contactEmail = layoutConfig.footerContactEmail || settings?.contactEmail || '';
  const locationText = layoutConfig.footerLocationText || installationProfile.defaultDefenseLocation || `Consulte ${installationProfile.departmentName || installationProfile.courseName} para confirmar o local da defesa.`;
  const qrLabel = layoutConfig.footerQrLabel || 'WhatsApp QR';
  const qrCodeSource = layoutConfig.footerQrCodeUrl || generatedQrCode;

  useEffect(() => {
    let active = true;
    if (!whatsappUrl) { setGeneratedQrCode(''); return () => { active = false; }; }
    void QRCode.toDataURL(whatsappUrl, { width: 240, margin: 1, errorCorrectionLevel: 'M' })
      .then((value) => { if (active) setGeneratedQrCode(value); })
      .catch(() => { if (active) setGeneratedQrCode(''); });
    return () => { active = false; };
  }, [whatsappUrl]);

  // Dynamic style tokens
  const footerBg = layoutConfig.footerBgColor || '#011812';
  const footerText = layoutConfig.footerTextColor || '#ffffff';
  const footerMuted = layoutConfig.footerMutedTextColor || '#94a3b8';
  const footerBorder = layoutConfig.footerBorderColor || '#033628';
  const footerDivider = layoutConfig.footerDividerColor || '#033628';
  const whatsappBg = layoutConfig.footerWhatsappBtnBg || '#059669';
  const whatsappText = layoutConfig.footerWhatsappBtnText || '#ffffff';
  const qrBg = layoutConfig.footerQrBgColor || '#ffffff';
  const qrText = layoutConfig.footerQrTextColor || '#0f172a';
  const qrBorder = layoutConfig.footerQrBorderColor || '#e2e8f0';

  const formatTermDate = (value?: string) => {
    if (!value) return '';
    const date = new Date(`${value}T12:00:00`);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('pt-BR');
  };

  return (
    <footer id="home-page-footer-notes" className="space-y-2.5 pt-2 pb-4 border-t border-slate-200 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 relative">
      {showLocationDirections && (
        <div 
          onClick={() => setShowDirections(!showDirections)}
          className="bg-slate-50 p-2.5 sm:p-3 border border-slate-200 text-xs text-slate-600 rounded-sm cursor-pointer hover:bg-slate-100/80 transition-all select-none"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-emerald-700 shrink-0" />
              <span>
                <strong>Local das Apresentações:</strong> {locationText}
              </span>
            </div>
            <div className="flex items-center gap-1 text-emerald-800 hover:text-emerald-900 font-extrabold uppercase tracking-wider text-[10px] shrink-0 self-start sm:self-center cursor-pointer p-1 rounded-2xs hover:bg-emerald-100/60 transition-colors" title={showDirections ? "Ocultar detalhes" : "Instruções de como chegar (Expandir)"}>
              {showDirections ? <ChevronUp className="w-4 h-4 shrink-0 text-emerald-800" /> : <ChevronDown className="w-4 h-4 shrink-0 text-emerald-800" />}
            </div>
          </div>

          {showDirections && (
            <div className="mt-2.5 pt-2.5 border-t border-slate-200 space-y-2.5 text-slate-700">
              <div className="space-y-2">
                <h4 className="font-bold text-slate-900 text-[10px] uppercase tracking-wider flex items-center gap-1.5">
                  <Lightbulb className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                  <span>Dicas Úteis de Acesso e Localização</span>
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[10px] sm:text-[11px]">
                  <div className="bg-white p-2 border border-slate-200 rounded-2xs flex gap-2">
                    <div className="w-5 h-5 rounded-xs bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
                      <MapPin className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-slate-600"><strong>Vindo do HUCAM:</strong> Subir a ladeira principal do campus de Maruípe e manter-se à direita nas duas bifurcações.</span>
                  </div>

                  <div className="bg-white p-2 border border-slate-200 rounded-2xs flex gap-2">
                    <div className="w-5 h-5 rounded-xs bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
                      <Info className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-slate-600"><strong>Ponto de Referência:</strong> Prédio situado exatamente em frente à Capela Universitária de Maruípe.</span>
                  </div>

                  <div className="bg-white p-2 border border-slate-200 rounded-2xs flex gap-2">
                    <div className="w-5 h-5 rounded-xs bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
                      <Car className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-slate-600"><strong>Estacionamento:</strong> Vagas externas gratuitas no campus de Maruípe, sujeitas à lotação do período.</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      <div 
        className="p-3.5 sm:p-5 rounded-sm text-[11px] relative group border transition-all"
        style={{
          backgroundColor: footerBg,
          color: footerText,
          borderColor: footerBorder
        }}
      >
        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-10 lg:gap-12 items-center text-center">
          
          {/* Column 1: Presidente e Membros da Comissão (Centered) */}
          <div 
            className="space-y-2 flex flex-col items-center justify-center w-full md:pr-10 lg:pr-12 md:border-r"
            style={{ borderRightColor: footerDivider }}
          >
            <div className="w-full">
              <div 
                className="font-extrabold uppercase tracking-wider text-[9px]"
                style={{ color: footerMuted }}
              >
                {presidentLabel}
              </div>
              <p 
                className="font-bold text-[11.5px] mt-0.5"
                style={{ color: footerText }}
              >
                {presidentName}
              </p>
              {presidentEmail && (
                <a href={`mailto:${presidentEmail}`} className="mt-0.5 block font-mono text-[9.5px] hover:underline" style={{ color: footerMuted }}>
                  {presidentEmail}
                </a>
              )}
            </div>
            <div 
              className="pt-2 border-t w-full"
              style={{ borderTopColor: footerDivider }}
            >
              <div 
                className="font-extrabold uppercase tracking-wider text-[9px]"
                style={{ color: footerMuted }}
              >
                {membersLabel}
              </div>
              <div 
                className="font-medium text-[10.5px] mt-0.5 space-y-0.5 text-center"
                style={{ color: footerText }}
              >
                {membersList.length ? membersList.map((member) => (
                  <div key={member.id || member.name} className="py-0.5">
                    <p className="font-semibold">{member.name}</p>
                    {member.email && (
                      <a href={`mailto:${member.email}`} className="block font-mono text-[9px] hover:underline" style={{ color: footerMuted }}>
                        {member.email}
                      </a>
                    )}
                    {(member.startDate || member.endDate) && (
                      <p className="text-[9px]" style={{ color: footerMuted }}>
                        {member.startDate ? `Início: ${formatTermDate(member.startDate)}` : ''}
                        {member.startDate && member.endDate ? ' · ' : ''}
                        {member.endDate ? `Fim: ${formatTermDate(member.endDate)}` : ''}
                      </p>
                    )}
                  </div>
                )) : <p>Não configurado</p>}
              </div>
            </div>
          </div>

          {/* Column 2: Desenvolvimento, Secretaria, WhatsApp, Email and QR Code */}
          <div 
            className="flex flex-col sm:flex-row items-center justify-center gap-4 w-full pt-3 md:pt-0 border-t md:border-t-0"
            style={{ borderTopColor: footerDivider }}
          >
            <div className="flex flex-col items-center text-center space-y-2">
              <div className="text-center">
                <div 
                  className="font-extrabold uppercase tracking-wider text-[9px] leading-tight text-center"
                  style={{ color: footerMuted }}
                >
                  {devTitle.includes('\n') ? (
                    devTitle.split('\n').map((line, i) => <React.Fragment key={i}>{line}<br /></React.Fragment>)
                  ) : (
                    <>Desenvolvimento da Plataforma<br />e Suporte</>
                  )}
                </div>
                <p 
                  className="font-bold text-[11.5px] mt-0.5 text-center"
                  style={{ color: footerText }}
                >
                  {devName}
                </p>
              </div>

              {/* Action Button & Email below it */}
              <div className="flex flex-col items-center gap-1 text-center">
                {whatsappUrl && <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 font-bold uppercase tracking-wider text-[10px] rounded-2xs transition-all shadow-2xs whitespace-nowrap hover:brightness-110 active:scale-95"
                  style={{
                    backgroundColor: whatsappBg,
                    color: whatsappText
                  }}
                >
                  <MessageCircle className="w-3.5 h-3.5 shrink-0" style={{ color: whatsappText }} />
                  <span>{whatsappLabel}</span>
                </a>}

                {contactEmail && <div className="flex items-center justify-center gap-1 mt-0.5" style={{ color: footerMuted }}>
                  <Mail className="w-3 h-3 shrink-0" style={{ color: whatsappBg }} />
                  <span className="font-mono text-[9.5px] select-all">{contactEmail}</span>
                </div>}
              </div>
            </div>

            {/* QR Code alongside Secretary details */}
            {qrCodeSource && <div 
              className="flex flex-col items-center p-1.5 shrink-0 self-center w-24 h-24 sm:w-[112px] sm:h-auto sm:self-stretch sm:aspect-square justify-center sm:-my-4 border sm:border-t-0 sm:border-b-0 sm:border-x rounded-sm sm:rounded-none overflow-hidden"
              style={{
                backgroundColor: qrBg,
                borderColor: qrBorder
              }}
            >
              <img
                src={qrCodeSource}
                alt="WhatsApp QR Code"
                className="w-[90%] h-[90%] object-contain"
                referrerPolicy="no-referrer"
              />
              <span 
                className="font-black text-[7px] sm:text-[7.5px] uppercase tracking-wider mt-0.5 whitespace-nowrap"
                style={{ color: qrText }}
              >
                {qrLabel}
              </span>
            </div>}
          </div>

        </div>
      </div>
    </footer>
  );
};
