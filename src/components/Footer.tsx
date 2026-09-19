import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import QRCode from 'qrcode';
import { useAuth } from '../context/AuthContext';
import { MapPin, Lightbulb, Info, Car, Mail, Check } from 'lucide-react';
import { loadSiteLayoutConfig, SITE_LAYOUT_EVENT, SiteLayoutConfig } from '../utils/siteLayoutConfig';
import { resolveInstallationProfile } from '../utils/installationProfile';

interface FooterProps { showLocationDirections?: boolean; }
interface FooterCommissionMember { id?:string; name:string; email?:string; startDate?:string; endDate?:string; active?:boolean; }

const WHATSAPP_GREEN = '#25D366';
const WHATSAPP_BUTTON_GREEN = '#1EA952';

const WhatsAppMark: React.FC<{ className?: string }> = ({ className = '' }) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
    <path fill="currentColor" d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.198-.347.223-.644.074-.297-.148-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.009-.371-.011-.57-.011-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479s1.065 2.875 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.99c-.002 5.45-4.437 9.884-9.884 9.884m8.413-18.297A11.815 11.815 0 0 0 12.055 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.14 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.689 1.448h.005c6.557 0 11.892-5.335 11.895-11.893a11.821 11.821 0 0 0-3.487-8.413" />
  </svg>
);

export const Footer: React.FC<FooterProps> = ({ showLocationDirections=false }) => {
  const { settings } = useAuth();
  const typedSettings=settings as any;
  const installationProfile=resolveInstallationProfile(settings);
  const [layoutConfig,setLayoutConfig]=useState<SiteLayoutConfig>(loadSiteLayoutConfig());
  const [generatedQrCode,setGeneratedQrCode]=useState('');
  const [locationPortalTarget,setLocationPortalTarget]=useState<HTMLElement|null>(null);
  const [emailCopied,setEmailCopied]=useState(false);

  useEffect(()=>{const fn=(e:Event)=>setLayoutConfig((e as CustomEvent<SiteLayoutConfig>).detail||loadSiteLayoutConfig());window.addEventListener(SITE_LAYOUT_EVENT,fn);return()=>window.removeEventListener(SITE_LAYOUT_EVENT,fn);},[]);
  useEffect(()=>{setLocationPortalTarget(showLocationDirections ? document.getElementById('home-page-container') : null);},[showLocationDirections]);

  const presidentName=settings?.commissionPresidentName||layoutConfig.footerPresidentName||'Não configurado';
  const presidentEmail=settings?.commissionPresidentEmail||'';
  const configured:FooterCommissionMember[]=Array.isArray(typedSettings?.commissionMembers)?typedSettings.commissionMembers.filter((m:FooterCommissionMember)=>m&&m.active!==false&&String(m.name||'').trim()):[];
  const legacy=[settings?.commissionMember2Name,settings?.commissionMember3Name,settings?.commissionMember4Name,settings?.commissionMember5Name].filter(Boolean).map((name,index)=>({id:`legacy-${index}`,name:String(name),active:true}));
  const layout=(layoutConfig.footerMembersList||[]).filter(Boolean).map((name,index)=>({id:`layout-${index}`,name,active:true}));
  const membersList=configured.length?configured:legacy.length?legacy:layout;
  // A Secretaria é o responsável técnico/operacional exibido no rodapé. O campo
  // ownerName é legado e pode conter apenas um rótulo genérico (ex.: “Administrador Master”).
  const devName=settings?.portalMaintainerName||settings?.ownerName||layoutConfig.footerDevName||'Equipe responsável pela instalação';
  const whatsappUrl=layoutConfig.footerWhatsappUrl||settings?.whatsappUrl||'';
  const contactEmail=settings?.contactEmail||settings?.masterEmail||layoutConfig.footerContactEmail||'';
  const locationText=layoutConfig.footerLocationText||installationProfile.defaultDefenseLocation||`Consulte ${installationProfile.departmentName||installationProfile.courseName} para confirmar o local da defesa.`;
  const qrCodeSource=layoutConfig.footerQrCodeUrl||generatedQrCode;

  useEffect(()=>{let active=true;if(!whatsappUrl){setGeneratedQrCode('');return()=>{active=false;};}void QRCode.toDataURL(whatsappUrl,{width:420,margin:0,errorCorrectionLevel:'H'}).then(v=>{if(active)setGeneratedQrCode(v);}).catch(()=>{if(active)setGeneratedQrCode('');});return()=>{active=false;};},[whatsappUrl]);

  const footerBg=layoutConfig.footerBgColor||'#03271f', footerText=layoutConfig.footerTextColor||'#fff', footerMuted=layoutConfig.footerMutedTextColor||'#eef1ef', footerBorder=layoutConfig.footerBorderColor||'#365349', footerDivider=layoutConfig.footerDividerColor||'#365349';
  const whatsappText=layoutConfig.footerWhatsappBtnText||'#fff';
  const formatTermDate=(value?:string)=>{if(!value)return'';const date=new Date(`${value}T12:00:00`);return Number.isNaN(date.getTime())?value:date.toLocaleDateString('pt-BR');};
  const copyContactEmail=async()=>{
    if(!contactEmail)return;
    try{
      await navigator.clipboard.writeText(contactEmail);
      setEmailCopied(true);
      window.setTimeout(()=>setEmailCopied(false),1600);
    }catch{
      const textarea=document.createElement('textarea');
      textarea.value=contactEmail;
      textarea.style.position='fixed';
      textarea.style.opacity='0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      textarea.remove();
      setEmailCopied(true);
      window.setTimeout(()=>setEmailCopied(false),1600);
    }
  };

  const locationCard = showLocationDirections && locationPortalTarget ? createPortal(
    <section id="presentation-location-card" className="rounded-xl border border-slate-200 bg-slate-50/95 px-3 py-2 text-slate-600 shadow-xs">
      <div className="flex items-center gap-2 text-xs sm:text-[13px]">
        <MapPin className="h-4 w-4 shrink-0 text-slate-600" />
        <span><strong className="text-slate-700">Local das Apresentações:</strong> {locationText}</span>
      </div>
      <div className="mt-1.5 grid gap-1.5 border-t border-slate-200 pt-1.5 text-[10px] sm:grid-cols-3 sm:text-[11px]">
        <div className="flex gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5"><Lightbulb className="h-4 w-4 shrink-0 text-slate-500"/><span><strong>Vindo do HUCAM:</strong> subir a ladeira principal do campus de Maruípe e manter-se à direita nas duas bifurcações.</span></div>
        <div className="flex gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5"><Info className="h-4 w-4 shrink-0 text-slate-500"/><span><strong>Referência:</strong> prédio em frente à Capela Universitária de Maruípe.</span></div>
        <div className="flex gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5"><Car className="h-4 w-4 shrink-0 text-slate-500"/><span><strong>Estacionamento:</strong> vagas externas gratuitas, sujeitas à lotação.</span></div>
      </div>
    </section>,
    locationPortalTarget
  ) : null;

  return <>
    {locationCard}
    <footer id="home-page-footer-notes" className="space-y-1 pt-1 pb-1.5 border-t border-slate-200 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 relative">
      <div className="overflow-hidden rounded-lg border text-[11px]" style={{backgroundColor:footerBg,color:footerText,borderColor:footerBorder}}>
        <div className="grid md:grid-cols-[1fr_1.18fr] items-stretch">
          <div className="p-2.5 md:border-r space-y-2 text-center" style={{borderColor:footerDivider}}>
            <div>
              <div className="font-extrabold uppercase tracking-wider text-[9px]" style={{color:footerMuted}}>{layoutConfig.footerPresidentLabel||'Presidente da Comissão'}</div>
              <p className="font-bold text-[12px] mt-0.5">{presidentName}</p>
              {presidentEmail&&<a href={`mailto:${presidentEmail}`} className="mt-0.5 block font-mono text-[9.5px] hover:underline" style={{color:footerMuted}}>{presidentEmail}</a>}
            </div>
            <div className="pt-2 border-t" style={{borderColor:footerDivider}}>
              <div className="font-extrabold uppercase tracking-wider text-[9px]" style={{color:footerMuted}}>{layoutConfig.footerMembersLabel||'Membros da Comissão'}</div>
              <div className="mt-0.5 grid sm:grid-cols-2 gap-x-4 gap-y-0.5 text-center">
                {membersList.length?membersList.map((member)=><div key={member.id||member.name}><p className="font-semibold">{member.name}</p>{member.email&&<a href={`mailto:${member.email}`} className="font-mono text-[9px] hover:underline" style={{color:footerMuted}}>{member.email}</a>}{(member.startDate||member.endDate)&&<p className="text-[9px]" style={{color:footerMuted}}>{member.startDate?`Início: ${formatTermDate(member.startDate)}`:''}{member.startDate&&member.endDate?' · ':''}{member.endDate?`Fim: ${formatTermDate(member.endDate)}`:''}</p>}</div>):<p className="sm:col-span-2" style={{color:footerMuted}}>Não configurado</p>}
              </div>
            </div>
          </div>
          <div className="flex items-center justify-center px-3 py-1.5 min-h-[112px]">
            <div className="flex w-fit max-w-full items-center justify-center gap-2">
              <div className="min-w-0 max-w-[250px] flex flex-col justify-center items-center text-center gap-1">
                <div><div className="font-extrabold uppercase tracking-wider text-[9px] leading-tight" style={{color:footerMuted}}>Desenvolvimento da Plataforma<br/>e Suporte</div><p className="font-bold text-[12px] mt-0.5">{devName}</p></div>
                {whatsappUrl&&<a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-3 py-1 font-bold uppercase tracking-wider text-[10px] rounded-lg transition-all hover:brightness-95" style={{backgroundColor:WHATSAPP_BUTTON_GREEN,color:whatsappText}}><WhatsAppMark className="w-3.5 h-3.5"/>WhatsApp Secretaria</a>}
                {contactEmail&&<button type="button" onClick={()=>void copyContactEmail()} className="flex items-center gap-1 rounded-md px-0 py-0 leading-none hover:opacity-90 focus:outline-none transition-opacity cursor-pointer" style={{color:footerMuted}} title="Clique para copiar o e-mail" aria-label={`Copiar e-mail ${contactEmail}`}>{emailCopied?<Check className="w-3 h-3"/>:<Mail className="w-3 h-3"/>}<span className="font-mono text-[9.5px] leading-none">{emailCopied?'E-mail copiado!':contactEmail}</span></button>}
              </div>
              {qrCodeSource&&<div className="relative w-[104px] h-[104px] sm:w-[112px] sm:h-[112px] shrink-0 rounded-xl border border-slate-300 bg-white p-1.5 shadow-lg"><img src={qrCodeSource} alt="QR Code para contato pelo WhatsApp" className="block h-full w-full rounded-lg object-contain" referrerPolicy="no-referrer"/><span className="absolute left-1/2 top-1/2 flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full text-white shadow-md ring-[3px] ring-white" style={{backgroundColor:WHATSAPP_GREEN}}><WhatsAppMark className="h-5 w-5"/></span></div>}
            </div>
          </div>
        </div>
      </div>
    </footer>
  </>;
};