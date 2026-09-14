import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import QRCode from 'qrcode';
import { useAuth } from '../context/AuthContext';
import { MapPin, Lightbulb, Info, Car, MessageCircle, Mail } from 'lucide-react';
import { loadSiteLayoutConfig, SITE_LAYOUT_EVENT, SiteLayoutConfig } from '../utils/siteLayoutConfig';
import { resolveInstallationProfile } from '../utils/installationProfile';

interface FooterProps { showLocationDirections?: boolean; }
interface FooterCommissionMember { id?:string; name:string; email?:string; startDate?:string; endDate?:string; active?:boolean; }

const WhatsAppMark: React.FC<{ className?: string }> = ({ className = '' }) => (
  <svg viewBox="0 0 32 32" aria-hidden="true" className={className}>
    <path fill="currentColor" d="M9.4 24.8l1-3.7a9.5 9.5 0 1 1 3.6 2.3l-4.6 1.4Zm6.7-17.2a7.1 7.1 0 0 0-6.1 10.8l.4.6-.6 2.2 2.3-.7.6.4a7.2 7.2 0 1 0 3.4-13.3Zm4.2-8.2c-.2-.1-1.3-.7-1.5-.8-.2-.1-.4-.1-.5.1s-.6.8-.7 1c-.1.1-.2.2-.4.1a5.8 5.8 0 0 1-1.7-1.1 6.4 6.4 0 0 1-1.2-1.5c-.1-.2 0-.3 0-.4.1-.1.2-.2.3-.4l.2-.3c.1-.1.1-.3 0-.4 0-.1-.5-1.3-.7-1.8-.2-.4-.4-.4-.5-.4h-.5c-.2 0-.4.1-.6.3-.2.2-.8.8-.8 1.9s.8 2.1 1 2.2c.1.2 1.6 2.5 3.8 3.4 1.9.8 2.3.7 2.8.6.4-.1 1.3-.5 1.5-1 .2-.5.2-1 .1-1.1-.1-.2-.3-.2-.5-.3Z" transform="translate(0 8)" />
  </svg>
);

export const Footer: React.FC<FooterProps> = ({ showLocationDirections=false }) => {
  const { settings } = useAuth();
  const typedSettings=settings as any;
  const installationProfile=resolveInstallationProfile(settings);
  const [layoutConfig,setLayoutConfig]=useState<SiteLayoutConfig>(loadSiteLayoutConfig());
  const [generatedQrCode,setGeneratedQrCode]=useState('');
  const [locationPortalTarget,setLocationPortalTarget]=useState<HTMLElement|null>(null);

  useEffect(()=>{const fn=(e:Event)=>setLayoutConfig((e as CustomEvent<SiteLayoutConfig>).detail||loadSiteLayoutConfig());window.addEventListener(SITE_LAYOUT_EVENT,fn);return()=>window.removeEventListener(SITE_LAYOUT_EVENT,fn);},[]);
  useEffect(()=>{setLocationPortalTarget(showLocationDirections ? document.getElementById('home-page-container') : null);},[showLocationDirections]);

  const presidentName=settings?.commissionPresidentName||layoutConfig.footerPresidentName||'Não configurado';
  const presidentEmail=settings?.commissionPresidentEmail||'';
  const configured:FooterCommissionMember[]=Array.isArray(typedSettings?.commissionMembers)?typedSettings.commissionMembers.filter((m:FooterCommissionMember)=>m&&m.active!==false&&String(m.name||'').trim()):[];
  const legacy=[settings?.commissionMember2Name,settings?.commissionMember3Name,settings?.commissionMember4Name,settings?.commissionMember5Name].filter(Boolean).map((name,index)=>({id:`legacy-${index}`,name:String(name),active:true}));
  const layout=(layoutConfig.footerMembersList||[]).filter(Boolean).map((name,index)=>({id:`layout-${index}`,name,active:true}));
  const membersList=configured.length?configured:legacy.length?legacy:layout;
  const devName=layoutConfig.footerDevName||settings?.portalMaintainerName||'Equipe responsável pela instalação';
  const whatsappUrl=layoutConfig.footerWhatsappUrl||settings?.whatsappUrl||'';
  const contactEmail=layoutConfig.footerContactEmail||settings?.contactEmail||'';
  const locationText=layoutConfig.footerLocationText||installationProfile.defaultDefenseLocation||`Consulte ${installationProfile.departmentName||installationProfile.courseName} para confirmar o local da defesa.`;
  const qrCodeSource=layoutConfig.footerQrCodeUrl||generatedQrCode;

  useEffect(()=>{let active=true;if(!whatsappUrl){setGeneratedQrCode('');return()=>{active=false;};}void QRCode.toDataURL(whatsappUrl,{width:420,margin:0,errorCorrectionLevel:'H'}).then(v=>{if(active)setGeneratedQrCode(v);}).catch(()=>{if(active)setGeneratedQrCode('');});return()=>{active=false;};},[whatsappUrl]);

  const footerBg=layoutConfig.footerBgColor||'#03271f', footerText=layoutConfig.footerTextColor||'#fff', footerMuted=layoutConfig.footerMutedTextColor||'#eef1ef', footerBorder=layoutConfig.footerBorderColor||'#365349', footerDivider=layoutConfig.footerDividerColor||'#365349';
  const whatsappBg=layoutConfig.footerWhatsappBtnBg||'#5b635e', whatsappText=layoutConfig.footerWhatsappBtnText||'#fff';
  const formatTermDate=(value?:string)=>{if(!value)return'';const date=new Date(`${value}T12:00:00`);return Number.isNaN(date.getTime())?value:date.toLocaleDateString('pt-BR');};

  const locationCard = showLocationDirections && locationPortalTarget ? createPortal(
    <section id="presentation-location-card" className="rounded-xl border border-slate-200 bg-slate-50/95 px-3 py-2.5 text-slate-600 shadow-xs">
      <div className="flex items-center gap-2 text-xs sm:text-[13px]">
        <MapPin className="h-4 w-4 shrink-0 text-slate-600" />
        <span><strong className="text-slate-700">Local das Apresentações:</strong> {locationText}</span>
      </div>
      <div className="mt-2 grid gap-1.5 border-t border-slate-200 pt-2 text-[10px] sm:grid-cols-3 sm:text-[11px]">
        <div className="flex gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-2"><Lightbulb className="h-4 w-4 shrink-0 text-slate-500"/><span><strong>Vindo do HUCAM:</strong> subir a ladeira principal do campus de Maruípe e manter-se à direita nas duas bifurcações.</span></div>
        <div className="flex gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-2"><Info className="h-4 w-4 shrink-0 text-slate-500"/><span><strong>Referência:</strong> prédio em frente à Capela Universitária de Maruípe.</span></div>
        <div className="flex gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-2"><Car className="h-4 w-4 shrink-0 text-slate-500"/><span><strong>Estacionamento:</strong> vagas externas gratuitas, sujeitas à lotação.</span></div>
      </div>
    </section>,
    locationPortalTarget
  ) : null;

  return <>
    {locationCard}
    <footer id="home-page-footer-notes" className="space-y-2 pt-2 pb-3 border-t border-slate-200 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 relative">
      <div className="overflow-hidden rounded-lg border text-[11px]" style={{backgroundColor:footerBg,color:footerText,borderColor:footerBorder}}>
        <div className="grid md:grid-cols-[1fr_1.18fr] items-stretch">
          <div className="p-3 md:border-r space-y-2.5 text-center" style={{borderColor:footerDivider}}>
            <div>
              <div className="font-extrabold uppercase tracking-wider text-[9px]" style={{color:footerMuted}}>{layoutConfig.footerPresidentLabel||'Presidente da Comissão'}</div>
              <p className="font-bold text-[12px] mt-1">{presidentName}</p>
              {presidentEmail&&<a href={`mailto:${presidentEmail}`} className="mt-1 block font-mono text-[9.5px] hover:underline" style={{color:footerMuted}}>{presidentEmail}</a>}
            </div>
            <div className="pt-2.5 border-t" style={{borderColor:footerDivider}}>
              <div className="font-extrabold uppercase tracking-wider text-[9px]" style={{color:footerMuted}}>{layoutConfig.footerMembersLabel||'Membros da Comissão'}</div>
              <div className="mt-1 grid sm:grid-cols-2 gap-x-4 gap-y-1 text-center">
                {membersList.length?membersList.map((member)=><div key={member.id||member.name}><p className="font-semibold">{member.name}</p>{member.email&&<a href={`mailto:${member.email}`} className="font-mono text-[9px] hover:underline" style={{color:footerMuted}}>{member.email}</a>}{(member.startDate||member.endDate)&&<p className="text-[9px]" style={{color:footerMuted}}>{member.startDate?`Início: ${formatTermDate(member.startDate)}`:''}{member.startDate&&member.endDate?' · ':''}{member.endDate?`Fim: ${formatTermDate(member.endDate)}`:''}</p>}</div>):<p className="sm:col-span-2" style={{color:footerMuted}}>Não configurado</p>}
              </div>
            </div>
          </div>
          <div className="flex items-center justify-center px-3 py-2 min-h-[132px]">
            <div className="flex w-full max-w-[475px] items-center justify-center gap-2">
              <div className="min-w-0 flex-1 flex flex-col justify-center items-center text-center gap-1.5">
                <div><div className="font-extrabold uppercase tracking-wider text-[9px] leading-tight" style={{color:footerMuted}}>Desenvolvimento da Plataforma<br/>e Suporte</div><p className="font-bold text-[12px] mt-1">{devName}</p></div>
                {whatsappUrl&&<a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-3 py-1.5 font-bold uppercase tracking-wider text-[10px] rounded-lg transition-all hover:brightness-110" style={{backgroundColor:whatsappBg,color:whatsappText}}><MessageCircle className="w-3.5 h-3.5"/>WhatsApp Secretaria</a>}
                {contactEmail&&<div className="flex items-center gap-1" style={{color:footerMuted}}><Mail className="w-3 h-3"/><span className="font-mono text-[9.5px] select-all">{contactEmail}</span></div>}
              </div>
              {qrCodeSource&&<div className="relative w-[104px] h-[104px] sm:w-[112px] sm:h-[112px] shrink-0 rounded-xl border border-slate-300 bg-white p-1.5 shadow-lg"><img src={qrCodeSource} alt="QR Code para contato pelo WhatsApp" className="block h-full w-full rounded-lg object-contain" referrerPolicy="no-referrer"/><span className="absolute left-1/2 top-1/2 flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-[#25D366] text-white shadow-md ring-[3px] ring-white"><WhatsAppMark className="h-5 w-5"/></span></div>}
            </div>
          </div>
        </div>
      </div>
    </footer>
  </>;
};
