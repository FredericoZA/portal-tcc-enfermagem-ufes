import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { useAuth } from '../context/AuthContext';
import { MapPin, ChevronUp, ChevronDown, Lightbulb, Info, Car, MessageCircle, Mail } from 'lucide-react';
import { loadSiteLayoutConfig, SITE_LAYOUT_EVENT, SiteLayoutConfig } from '../utils/siteLayoutConfig';
import { resolveInstallationProfile } from '../utils/installationProfile';

interface FooterProps { showLocationDirections?: boolean; }
interface FooterCommissionMember { id?:string; name:string; email?:string; startDate?:string; endDate?:string; active?:boolean; }

export const Footer: React.FC<FooterProps> = ({ showLocationDirections=false }) => {
  const { settings } = useAuth(); const typedSettings=settings as any; const installationProfile=resolveInstallationProfile(settings);
  const [showDirections,setShowDirections]=useState(false); const [layoutConfig,setLayoutConfig]=useState<SiteLayoutConfig>(loadSiteLayoutConfig()); const [generatedQrCode,setGeneratedQrCode]=useState('');
  useEffect(()=>{const fn=(e:Event)=>setLayoutConfig((e as CustomEvent<SiteLayoutConfig>).detail||loadSiteLayoutConfig());window.addEventListener(SITE_LAYOUT_EVENT,fn);return()=>window.removeEventListener(SITE_LAYOUT_EVENT,fn);},[]);
  const presidentName=settings?.commissionPresidentName||layoutConfig.footerPresidentName||'Não configurado'; const presidentEmail=settings?.commissionPresidentEmail||'';
  const configured:FooterCommissionMember[]=Array.isArray(typedSettings?.commissionMembers)?typedSettings.commissionMembers.filter((m:FooterCommissionMember)=>m&&m.active!==false&&String(m.name||'').trim()):[];
  const legacy=[settings?.commissionMember2Name,settings?.commissionMember3Name,settings?.commissionMember4Name,settings?.commissionMember5Name].filter(Boolean).map((name,index)=>({id:`legacy-${index}`,name:String(name),active:true}));
  const layout=(layoutConfig.footerMembersList||[]).filter(Boolean).map((name,index)=>({id:`layout-${index}`,name,active:true})); const membersList=configured.length?configured:legacy.length?legacy:layout;
  const devName=layoutConfig.footerDevName||settings?.portalMaintainerName||'Equipe responsável pela instalação'; const whatsappUrl=layoutConfig.footerWhatsappUrl||settings?.whatsappUrl||''; const contactEmail=layoutConfig.footerContactEmail||settings?.contactEmail||'';
  const locationText=layoutConfig.footerLocationText||installationProfile.defaultDefenseLocation||`Consulte ${installationProfile.departmentName||installationProfile.courseName} para confirmar o local da defesa.`;
  const qrCodeSource=layoutConfig.footerQrCodeUrl||generatedQrCode;
  useEffect(()=>{let active=true;if(!whatsappUrl){setGeneratedQrCode('');return()=>{active=false;};}void QRCode.toDataURL(whatsappUrl,{width:420,margin:0,errorCorrectionLevel:'M'}).then(v=>{if(active)setGeneratedQrCode(v);}).catch(()=>{if(active)setGeneratedQrCode('');});return()=>{active=false;};},[whatsappUrl]);
  const footerBg=layoutConfig.footerBgColor||'#03271f', footerText=layoutConfig.footerTextColor||'#fff', footerMuted=layoutConfig.footerMutedTextColor||'#d6d9d7', footerBorder=layoutConfig.footerBorderColor||'#365349', footerDivider=layoutConfig.footerDividerColor||'#365349';
  const whatsappBg=layoutConfig.footerWhatsappBtnBg||'#5b635e', whatsappText=layoutConfig.footerWhatsappBtnText||'#fff';
  const formatTermDate=(value?:string)=>{if(!value)return'';const date=new Date(`${value}T12:00:00`);return Number.isNaN(date.getTime())?value:date.toLocaleDateString('pt-BR');};

  return <footer id="home-page-footer-notes" className="space-y-2 pt-2 pb-3 border-t border-slate-200 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 relative">
    {showLocationDirections&&<div onClick={()=>setShowDirections(!showDirections)} className="bg-slate-50 p-2.5 border border-slate-200 text-xs text-slate-600 rounded-lg cursor-pointer hover:bg-slate-100 transition-all select-none"><div className="flex items-center justify-between gap-2"><div className="flex items-center gap-2"><MapPin className="w-4 h-4 text-slate-600 shrink-0"/><span><strong>Local das Apresentações:</strong> {locationText}</span></div>{showDirections?<ChevronUp className="w-4 h-4"/>:<ChevronDown className="w-4 h-4"/>}</div>{showDirections&&<div className="mt-2 pt-2 border-t border-slate-200 grid sm:grid-cols-3 gap-2 text-[10px] sm:text-[11px]"><div className="bg-white p-2 border border-slate-200 rounded-lg flex gap-2"><Lightbulb className="w-4 h-4 text-slate-600 shrink-0"/><span><strong>Vindo do HUCAM:</strong> subir a ladeira principal do campus de Maruípe e manter-se à direita nas duas bifurcações.</span></div><div className="bg-white p-2 border border-slate-200 rounded-lg flex gap-2"><Info className="w-4 h-4 text-slate-600 shrink-0"/><span><strong>Referência:</strong> prédio em frente à Capela Universitária de Maruípe.</span></div><div className="bg-white p-2 border border-slate-200 rounded-lg flex gap-2"><Car className="w-4 h-4 text-slate-600 shrink-0"/><span><strong>Estacionamento:</strong> vagas externas gratuitas, sujeitas à lotação.</span></div></div>}</div>}

    <div className="overflow-hidden rounded-lg border text-[11px]" style={{backgroundColor:footerBg,color:footerText,borderColor:footerBorder}}>
      <div className="grid md:grid-cols-[1.1fr_1fr] items-stretch">
        <div className="p-4 md:border-r space-y-3 text-center" style={{borderColor:footerDivider}}>
          <div>
            <div className="font-extrabold uppercase tracking-wider text-[9px]" style={{color:footerMuted}}>{layoutConfig.footerPresidentLabel||'Presidente da Comissão'}</div>
            <p className="font-bold text-[12px] mt-1">{presidentName}</p>
            {presidentEmail&&<a href={`mailto:${presidentEmail}`} className="mt-1 block font-mono text-[9.5px] hover:underline" style={{color:footerMuted}}>{presidentEmail}</a>}
          </div>
          <div className="pt-3 border-t" style={{borderColor:footerDivider}}>
            <div className="font-extrabold uppercase tracking-wider text-[9px]" style={{color:footerMuted}}>{layoutConfig.footerMembersLabel||'Membros da Comissão'}</div>
            <div className="mt-1.5 grid sm:grid-cols-2 gap-x-4 gap-y-1.5 text-center">
              {membersList.length?membersList.map((member)=><div key={member.id||member.name}><p className="font-semibold">{member.name}</p>{member.email&&<a href={`mailto:${member.email}`} className="font-mono text-[9px] hover:underline" style={{color:footerMuted}}>{member.email}</a>}{(member.startDate||member.endDate)&&<p className="text-[9px]" style={{color:footerMuted}}>{member.startDate?`Início: ${formatTermDate(member.startDate)}`:''}{member.startDate&&member.endDate?' · ':''}{member.endDate?`Fim: ${formatTermDate(member.endDate)}`:''}</p>}</div>):<p className="sm:col-span-2" style={{color:footerMuted}}>Não configurado</p>}
            </div>
          </div>
        </div>
        <div className="flex items-center justify-center p-3 min-h-[135px]">
          <div className="flex w-full max-w-[500px] items-center justify-center gap-3 sm:gap-4">
            <div className="min-w-0 w-[280px] flex flex-col justify-center items-center text-center gap-2"><div><div className="font-extrabold uppercase tracking-wider text-[9px] leading-tight" style={{color:footerMuted}}>Desenvolvimento da Plataforma<br/>e Suporte</div><p className="font-bold text-[12px] mt-1">{devName}</p></div>{whatsappUrl&&<a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-3 py-2 font-bold uppercase tracking-wider text-[10px] rounded-lg transition-all hover:brightness-110" style={{backgroundColor:whatsappBg,color:whatsappText}}><MessageCircle className="w-3.5 h-3.5"/>WhatsApp Secretaria</a>}{contactEmail&&<div className="flex items-center gap-1" style={{color:footerMuted}}><Mail className="w-3 h-3"/><span className="font-mono text-[9.5px] select-all">{contactEmail}</span></div>}</div>
            {qrCodeSource&&<div className="w-[108px] h-[108px] sm:w-[130px] sm:h-[130px] bg-white shrink-0 overflow-hidden"><img src={qrCodeSource} alt="QR Code para contato pelo WhatsApp" className="block h-full w-full object-cover" referrerPolicy="no-referrer"/></div>}
          </div>
        </div>
      </div>
    </div>
  </footer>;
};
