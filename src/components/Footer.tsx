import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { useAuth } from '../context/AuthContext';
import { MapPin, ChevronUp, ChevronDown, Lightbulb, Info, Car, MessageCircle, Mail } from 'lucide-react';
import { loadSiteLayoutConfig, SITE_LAYOUT_EVENT, SiteLayoutConfig } from '../utils/siteLayoutConfig';
import { resolveInstallationProfile } from '../utils/installationProfile';

interface FooterProps { showLocationDirections?: boolean; }
interface FooterCommissionMember { id?: string; name: string; email?: string; startDate?: string; endDate?: string; active?: boolean; }

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
      setLayoutConfig(customEvent.detail || loadSiteLayoutConfig());
    };
    window.addEventListener(SITE_LAYOUT_EVENT, handleLayoutChange);
    return () => window.removeEventListener(SITE_LAYOUT_EVENT, handleLayoutChange);
  }, []);

  const presidentName = settings?.commissionPresidentName || layoutConfig.footerPresidentName || 'Não configurado';
  const presidentEmail = settings?.commissionPresidentEmail || '';
  const presidentLabel = layoutConfig.footerPresidentLabel || 'Presidente da Comissão';
  const membersLabel = layoutConfig.footerMembersLabel || 'Membros da Comissão';
  const configuredCommissionMembers: FooterCommissionMember[] = Array.isArray(typedSettings?.commissionMembers)
    ? typedSettings.commissionMembers.filter((member: FooterCommissionMember) => member && member.active !== false && String(member.name || '').trim())
    : [];
  const legacyCommissionMembers: FooterCommissionMember[] = [settings?.commissionMember2Name,settings?.commissionMember3Name,settings?.commissionMember4Name,settings?.commissionMember5Name]
    .filter(Boolean).map((name, index) => ({ id: `legacy-${index}`, name: String(name), email: '', startDate: '', endDate: '', active: true }));
  const layoutCommissionMembers: FooterCommissionMember[] = (layoutConfig.footerMembersList || []).filter(Boolean).map((name, index) => ({ id: `layout-${index}`, name, email: '', startDate: '', endDate: '', active: true }));
  const membersList = configuredCommissionMembers.length ? configuredCommissionMembers : legacyCommissionMembers.length ? legacyCommissionMembers : layoutCommissionMembers;
  const devTitle = layoutConfig.footerDevTitle || 'Desenvolvimento da Plataforma e Suporte';
  const devName = layoutConfig.footerDevName || settings?.portalMaintainerName || 'Equipe responsável pela instalação';
  const whatsappLabel = layoutConfig.footerWhatsappLabel || 'WhatsApp Secretaria';
  const whatsappUrl = layoutConfig.footerWhatsappUrl || settings?.whatsappUrl || '';
  const contactEmail = layoutConfig.footerContactEmail || settings?.contactEmail || '';
  const locationText = layoutConfig.footerLocationText || installationProfile.defaultDefenseLocation || `Consulte ${installationProfile.departmentName || installationProfile.courseName} para confirmar o local da defesa.`;
  const qrCodeSource = layoutConfig.footerQrCodeUrl || generatedQrCode;

  useEffect(() => {
    let active = true;
    if (!whatsappUrl) { setGeneratedQrCode(''); return () => { active = false; }; }
    void QRCode.toDataURL(whatsappUrl, { width: 420, margin: 0, errorCorrectionLevel: 'M' })
      .then((value) => { if (active) setGeneratedQrCode(value); })
      .catch(() => { if (active) setGeneratedQrCode(''); });
    return () => { active = false; };
  }, [whatsappUrl]);

  const footerBg = layoutConfig.footerBgColor || '#082a22';
  const footerText = '#ffffff';
  const footerMuted = '#d9dfdc';
  const footerBorder = layoutConfig.footerBorderColor || '#315247';
  const footerDivider = layoutConfig.footerDividerColor || '#315247';
  const whatsappBg = layoutConfig.footerWhatsappBtnBg || '#616b66';
  const whatsappText = '#ffffff';

  const formatTermDate = (value?: string) => {
    if (!value) return '';
    const date = new Date(`${value}T12:00:00`);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('pt-BR');
  };

  return (
    <footer id="home-page-footer-notes" className="space-y-2 pt-2 pb-3 border-t border-slate-200 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 relative">
      {showLocationDirections && (
        <div onClick={() => setShowDirections(!showDirections)} className="bg-slate-50 p-2.5 border border-slate-200 text-xs text-slate-600 rounded-sm cursor-pointer hover:bg-slate-100 transition-all select-none">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2"><MapPin className="w-4 h-4 text-slate-600 shrink-0" /><span><strong>Local das Apresentações:</strong> {locationText}</span></div>
            <div className="flex items-center gap-1 text-slate-700 font-extrabold uppercase tracking-wider text-[10px] shrink-0 self-start sm:self-center p-1" title={showDirections ? 'Ocultar detalhes' : 'Instruções de como chegar'}>{showDirections ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}</div>
          </div>
          {showDirections && (
            <div className="mt-2 pt-2 border-t border-slate-200 space-y-2 text-slate-700">
              <h4 className="font-bold text-slate-900 text-[10px] uppercase tracking-wider flex items-center gap-1.5"><Lightbulb className="w-3.5 h-3.5 text-slate-600" />Dicas úteis de acesso e localização</h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[10px] sm:text-[11px]">
                <div className="bg-white p-2 border border-slate-200 rounded flex gap-2"><MapPin className="w-4 h-4 text-slate-500 shrink-0"/><span><strong>Vindo do HUCAM:</strong> Subir a ladeira principal do campus de Maruípe e manter-se à direita nas duas bifurcações.</span></div>
                <div className="bg-white p-2 border border-slate-200 rounded flex gap-2"><Info className="w-4 h-4 text-slate-500 shrink-0"/><span><strong>Ponto de referência:</strong> prédio situado em frente à Capela Universitária de Maruípe.</span></div>
                <div className="bg-white p-2 border border-slate-200 rounded flex gap-2"><Car className="w-4 h-4 text-slate-500 shrink-0"/><span><strong>Estacionamento:</strong> vagas externas gratuitas no campus, sujeitas à lotação.</span></div>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="rounded-sm text-[11px] relative border overflow-hidden" style={{ backgroundColor: footerBg, color: footerText, borderColor: footerBorder }}>
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.25fr] items-stretch">
          <div className="p-4 sm:p-5 flex flex-col items-center justify-center text-center lg:border-r" style={{ borderColor: footerDivider }}>
            <div className="w-full">
              <div className="font-extrabold uppercase tracking-wider text-[9px]" style={{ color: footerMuted }}>{presidentLabel}</div>
              <p className="font-bold text-[11.5px] mt-0.5" style={{ color: footerText }}>{presidentName}</p>
              {presidentEmail && <a href={`mailto:${presidentEmail}`} className="mt-0.5 block font-mono text-[9.5px] hover:underline" style={{ color: footerMuted }}>{presidentEmail}</a>}
            </div>
            <div className="pt-2 mt-2 border-t w-full" style={{ borderTopColor: footerDivider }}>
              <div className="font-extrabold uppercase tracking-wider text-[9px]" style={{ color: footerMuted }}>{membersLabel}</div>
              <div className="font-medium text-[10.5px] mt-0.5 space-y-0.5 text-center" style={{ color: footerText }}>
                {membersList.length ? membersList.map((member) => <div key={member.id || member.name} className="py-0.5"><p className="font-semibold">{member.name}</p>{member.email && <a href={`mailto:${member.email}`} className="block font-mono text-[9px] hover:underline" style={{ color: footerMuted }}>{member.email}</a>}{(member.startDate || member.endDate) && <p className="text-[9px]" style={{ color: footerMuted }}>{member.startDate ? `Início: ${formatTermDate(member.startDate)}` : ''}{member.startDate && member.endDate ? ' · ' : ''}{member.endDate ? `Fim: ${formatTermDate(member.endDate)}` : ''}</p>}</div>) : <p>Não configurado</p>}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-[1fr_190px] lg:grid-cols-[1fr_230px] items-stretch border-t lg:border-t-0" style={{ borderColor: footerDivider }}>
            <div className="p-4 sm:p-5 flex flex-col items-center justify-center text-center gap-2">
              <div><div className="font-extrabold uppercase tracking-wider text-[9px] leading-tight" style={{ color: footerMuted }}>{devTitle.includes('\n') ? devTitle.split('\n').map((line, i) => <React.Fragment key={i}>{line}<br /></React.Fragment>) : <>Desenvolvimento da Plataforma<br />e Suporte</>}</div><p className="font-bold text-[11.5px] mt-0.5" style={{ color: footerText }}>{devName}</p></div>
              {whatsappUrl && <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-3 py-1.5 font-bold uppercase tracking-wider text-[10px] rounded transition-all hover:brightness-110" style={{ backgroundColor: whatsappBg, color: whatsappText }}><MessageCircle className="w-3.5 h-3.5" /><span>{whatsappLabel}</span></a>}
              {contactEmail && <div className="flex items-center justify-center gap-1" style={{ color: footerMuted }}><Mail className="w-3 h-3" /><span className="font-mono text-[9.5px] select-all">{contactEmail}</span></div>}
            </div>

            {qrCodeSource && <div className="flex min-h-[180px] items-center justify-center bg-white overflow-hidden sm:min-h-0"><img src={qrCodeSource} alt="QR Code do WhatsApp" className="block h-full max-h-[230px] w-full object-contain" referrerPolicy="no-referrer" /></div>}
          </div>
        </div>
      </div>
    </footer>
  );
};
