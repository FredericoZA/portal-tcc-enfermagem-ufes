import React from 'react';
import { createPortal } from 'react-dom';
import { Palette, X } from 'lucide-react';
import type { GlobalSettings } from '../types';
import { MasterAndPresidentConfigForm } from './AuditAndSecuritySection';
import { CommissionIdentityPanel } from './CommissionIdentityPanel';

interface Props{isOpen:boolean;onClose:()=>void;onOpenAppearance:()=>void;settings:GlobalSettings;onSettingsUpdated:(settings:GlobalSettings)=>void;showNotification:(message:string)=>void;}
export const PortalPersonalizationHubModal:React.FC<Props>=({isOpen,onClose,onOpenAppearance,settings,onSettingsUpdated,showNotification})=>{
  if(!isOpen)return null;
  return createPortal(<div className="fixed inset-0 z-[1000000] flex items-start justify-center overflow-y-auto bg-slate-950/70 p-3 backdrop-blur-sm"><div role="dialog" aria-modal="true" aria-label="Personalização do Portal" className="my-4 w-full max-w-5xl overflow-hidden rounded-2xl border border-slate-300 bg-[#f0f0f0] shadow-2xl"><header className="flex items-center justify-between bg-[#005830] px-4 py-3 text-white"><div className="flex items-center gap-2"><span className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-300 bg-white"><Palette className="h-4 w-4 text-slate-700"/></span><h2 className="text-sm font-black uppercase tracking-wide">Personalização do Portal</h2></div><button type="button" onClick={onClose} className="rounded-lg border border-white/60 bg-white p-1.5 text-slate-800" aria-label="Fechar"><X className="h-4 w-4"/></button></header><div className="space-y-3 p-3 sm:p-4"><button type="button" onClick={()=>{onClose();onOpenAppearance();}} className="flex w-full items-center justify-between rounded-xl border border-slate-300 bg-white px-4 py-3 text-left shadow-sm hover:bg-slate-50"><div><div className="text-xs font-black uppercase tracking-wide text-slate-900">Aparência, barras, rodapé e planilhas</div><div className="mt-1 text-[11px] text-slate-600">Cores, textos institucionais, barra superior, barra lateral, rodapé, QR Code, botões, pop-ups e aparência das tabelas.</div></div><Palette className="h-5 w-5 text-[#337959]"/></button><MasterAndPresidentConfigForm settings={settings} onSettingsUpdated={onSettingsUpdated} showNotification={showNotification}/><CommissionIdentityPanel isMaster/></div></div></div>,document.body);
};
