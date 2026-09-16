import React, { useEffect, useMemo, useState } from 'react';
import { Plus, QrCode, Save, Trash2, Users } from 'lucide-react';
import QRCode from 'qrcode';
import { useAuth } from '../context/AuthContext';
import { apiClient } from '../services/apiClient';

interface Props { isMaster: boolean; }
interface CommissionMemberInfo { id:string; name:string; email?:string; startDate?:string; endDate?:string; active:boolean; }
const inputClass='w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 outline-none focus:border-slate-500';
const actionClass='inline-flex min-h-9 items-center justify-center gap-2 rounded-lg border border-[#2d6c50] bg-[#337959] px-3 py-1.5 text-[10px] font-black uppercase tracking-wide text-white shadow-sm transition hover:brightness-95 disabled:opacity-50';
const makeId=()=>`commission-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
const normalizeMembers=(members:CommissionMemberInfo[])=>members.map((m)=>({id:String(m.id||makeId()),name:String(m.name||'').trim(),email:String(m.email||'').trim().toLowerCase(),startDate:String(m.startDate||''),endDate:String(m.endDate||''),active:m.active!==false})).filter((m)=>m.name);

export const CommissionIdentityPanel:React.FC<Props>=({isMaster})=>{
  const {settings,refreshAuth}=useAuth(); const s=settings as any;
  const initialMembers=useMemo(()=>normalizeMembers(Array.isArray(s?.commissionMembers)?s.commissionMembers:[]),[s?.commissionMembers]);
  const [members,setMembers]=useState<CommissionMemberInfo[]>(initialMembers);
  const [masterName,setMasterName]=useState(String(s?.ownerName||s?.portalMaintainerName||''));
  const [masterEmail,setMasterEmail]=useState(String(s?.masterEmail||''));
  const [presidentName,setPresidentName]=useState(String(s?.commissionPresidentName||''));
  const [presidentEmail,setPresidentEmail]=useState(String(s?.commissionPresidentEmail||''));
  const [contactEmail,setContactEmail]=useState(String(s?.contactEmail||''));
  const [whatsappUrl,setWhatsappUrl]=useState(String(s?.whatsappUrl||''));
  const [qrDataUrl,setQrDataUrl]=useState(''); const [saving,setSaving]=useState(false); const [feedback,setFeedback]=useState<{ok:boolean;text:string}|null>(null);
  useEffect(()=>setMembers(initialMembers),[initialMembers]);
  useEffect(()=>{setMasterName(String(s?.ownerName||s?.portalMaintainerName||''));setMasterEmail(String(s?.masterEmail||''));setPresidentName(String(s?.commissionPresidentName||''));setPresidentEmail(String(s?.commissionPresidentEmail||''));setContactEmail(String(s?.contactEmail||''));setWhatsappUrl(String(s?.whatsappUrl||''));},[s?.ownerName,s?.portalMaintainerName,s?.masterEmail,s?.commissionPresidentName,s?.commissionPresidentEmail,s?.contactEmail,s?.whatsappUrl]);
  useEffect(()=>{let active=true;const value=whatsappUrl.trim();if(!value){setQrDataUrl('');return()=>{active=false;};}void QRCode.toDataURL(value,{width:280,margin:0,errorCorrectionLevel:'M'}).then((url)=>{if(active)setQrDataUrl(url);}).catch(()=>{if(active)setQrDataUrl('');});return()=>{active=false;};},[whatsappUrl]);
  if(!isMaster)return null;
  const updateMember=(id:string,updates:Partial<CommissionMemberInfo>)=>setMembers((prev)=>prev.map((m)=>m.id===id?{...m,...updates}:m));
  const save=async()=>{setSaving(true);setFeedback(null);try{
    const normalized=normalizeMembers(members);const emailOk=(v:string)=>!v||/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
    const mEmail=masterEmail.trim().toLowerCase(),pEmail=presidentEmail.trim().toLowerCase(),publicEmail=contactEmail.trim().toLowerCase();
    if(!emailOk(mEmail)||!emailOk(pEmail)||!emailOk(publicEmail))throw new Error('Revise os endereços de e-mail informados.');
    if(normalized.some((m)=>m.email&&!emailOk(m.email||'')))throw new Error('Há integrante da comissão com e-mail inválido.');
    const invalidPeriod=normalized.find((m)=>m.startDate&&m.endDate&&m.endDate<m.startDate);if(invalidPeriod)throw new Error(`Período inválido para ${invalidPeriod.name}.`);
    const wa=whatsappUrl.trim();if(wa){const parsed=new URL(wa);if(!['https:','http:'].includes(parsed.protocol))throw new Error('O WhatsApp precisa usar uma URL http/https.');}
    await apiClient.updateSettings({ownerName:masterName.trim(),portalMaintainerName:masterName.trim(),commissionPresidentName:presidentName.trim(),commissionMembers:normalized,contactEmail:publicEmail,whatsappUrl:wa} as any);
    const transfers:string[]=[];
    if(mEmail&&mEmail!==String(s?.masterEmail||'').toLowerCase()){await apiClient.createAdministrationTransfer('MASTER_ADMIN',mEmail);transfers.push('Master');}
    if(pEmail&&pEmail!==String(s?.commissionPresidentEmail||'').toLowerCase()){await apiClient.createAdministrationTransfer('COMMISSION_PRESIDENT',pEmail);transfers.push('Presidência');}
    setMembers(normalized);await refreshAuth();setFeedback({ok:true,text:transfers.length?`Dados salvos. Transferência segura iniciada para: ${transfers.join(' e ')}.`:'Comissão, contatos e QR Code salvos.'});
  }catch(error){setFeedback({ok:false,text:error instanceof Error?error.message:'Não foi possível salvar a Comissão.'});}finally{setSaving(false);}};
  return <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm" aria-labelledby="commission-management-title">
    <div className="flex flex-col gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2.5 lg:flex-row lg:items-center lg:justify-between"><div><div className="flex items-center gap-2"><Users className="h-5 w-5 text-[#337959]"/><h3 id="commission-management-title" className="font-black uppercase tracking-wide text-slate-950">Gestão da Comissão de TCC</h3></div><p className="mt-0.5 text-[11px] text-slate-600">Presidência, secretário/Master, contatos públicos e integrantes em um único cadastro.</p></div><div className="flex gap-2"><button type="button" onClick={()=>setMembers((prev)=>[...prev,{id:makeId(),name:'',email:'',startDate:'',endDate:'',active:true}])} className={actionClass}><Plus className="h-4 w-4"/>Adicionar membro</button><button type="button" onClick={()=>void save()} disabled={saving} className={actionClass}><Save className="h-4 w-4"/>{saving?'Salvando…':'Salvar Comissão'}</button></div></div>
    <div className="grid gap-2 border-b border-slate-200 p-3 lg:grid-cols-[1fr_1fr_1fr_120px]">
      <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-2.5"><div className="text-[9px] font-black uppercase text-slate-600">Presidência</div><input value={presidentName} onChange={(e)=>setPresidentName(e.target.value)} className={`${inputClass} mt-2`} placeholder="Nome da Presidente"/><input type="email" value={presidentEmail} onChange={(e)=>setPresidentEmail(e.target.value)} className={`${inputClass} mt-2`} placeholder="E-mail da Presidência"/></div>
      <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-2.5"><div className="text-[9px] font-black uppercase text-slate-600">Secretário / Master</div><input value={masterName} onChange={(e)=>setMasterName(e.target.value)} className={`${inputClass} mt-2`} placeholder="Nome do responsável"/><input type="email" value={masterEmail} onChange={(e)=>setMasterEmail(e.target.value)} className={`${inputClass} mt-2`} placeholder="E-mail do Master"/></div>
      <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-2.5"><div className="text-[9px] font-black uppercase text-slate-600">Contato público</div><input type="email" value={contactEmail} onChange={(e)=>setContactEmail(e.target.value)} className={`${inputClass} mt-2`} placeholder="E-mail da secretaria"/><input value={whatsappUrl} onChange={(e)=>setWhatsappUrl(e.target.value)} className={`${inputClass} mt-2`} placeholder="Link do WhatsApp"/></div>
      <div className="flex min-h-28 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 p-1">{qrDataUrl?<img src={qrDataUrl} alt="QR Code do WhatsApp" className="h-24 w-24 object-contain"/>:<div className="text-center text-[9px] text-slate-500"><QrCode className="mx-auto mb-1 h-5 w-5"/>WhatsApp gera o QR</div>}</div>
    </div>
    <div className="overflow-x-auto"><table className="w-full min-w-[780px] border-collapse text-left"><thead className="bg-[#005830] text-[10px] font-black uppercase tracking-wider text-white"><tr><th className="px-3 py-2">Nome</th><th className="px-3 py-2">E-mail</th><th className="px-3 py-2">Início</th><th className="px-3 py-2">Fim</th><th className="px-3 py-2 text-center">Ativo</th><th className="w-12"/></tr></thead><tbody className="divide-y divide-slate-100">{members.length===0&&<tr><td colSpan={6} className="px-4 py-3 text-center text-xs text-slate-500">Nenhum integrante adicional cadastrado.</td></tr>}{members.map((m)=><tr key={m.id}><td className="px-2 py-1.5"><input value={m.name} onChange={(e)=>updateMember(m.id,{name:e.target.value})} className={inputClass} placeholder="Nome"/></td><td className="px-2 py-1.5"><input type="email" value={m.email||''} onChange={(e)=>updateMember(m.id,{email:e.target.value})} className={inputClass}/></td><td className="px-2 py-1.5"><input type="date" value={m.startDate||''} onChange={(e)=>updateMember(m.id,{startDate:e.target.value})} className={inputClass}/></td><td className="px-2 py-1.5"><input type="date" value={m.endDate||''} onChange={(e)=>updateMember(m.id,{endDate:e.target.value})} className={inputClass}/></td><td className="px-2 py-1.5 text-center"><input type="checkbox" checked={m.active!==false} onChange={(e)=>updateMember(m.id,{active:e.target.checked})} className="h-4 w-4 accent-[#337959]"/></td><td><button type="button" onClick={()=>setMembers((prev)=>prev.filter((x)=>x.id!==m.id))} className="rounded-lg p-2 text-rose-600 hover:bg-rose-50" aria-label={`Excluir ${m.name||'membro'}`}><Trash2 className="h-4 w-4"/></button></td></tr>)}</tbody></table></div>
    {feedback&&<div className={`border-t border-slate-200 px-4 py-2 text-[11px] font-semibold ${feedback.ok?'text-slate-700':'text-rose-700'}`} role="status">{feedback.text}</div>}
  </section>;
};
