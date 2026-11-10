import React from 'react';
import {X} from 'lucide-react';

export function RoleSelectionControl<Role extends string>({label,value,options,required=[],onChange}:{label:string;value:readonly Role[];options:readonly {value:Role;label:string}[];required?:readonly Role[];onChange:(roles:Role[])=>void}){
  const available=options.filter(option=>!value.includes(option.value));
  return <fieldset className="min-w-0 space-y-2">
    <legend className="text-xs font-semibold text-slate-700">{label}</legend>
    <div className="flex flex-wrap gap-1.5">
      {value.map(role=><span key={role} className="inline-flex items-center gap-1 rounded-lg border border-[var(--portal-border)] bg-white py-1 pl-2 text-xs font-semibold text-slate-800">
        {options.find(option=>option.value===role)?.label||role}
        {required.includes(role)?<span className="px-2 text-[10px] font-normal text-slate-500">Obrigatório</span>:<button type="button" onClick={()=>onChange(value.filter(item=>item!==role))} aria-label={`Remover ${options.find(option=>option.value===role)?.label||role} de ${label}`} className="inline-flex min-h-8 min-w-8 items-center justify-center rounded-md text-slate-600 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--portal-brand-action)]"><X className="h-3.5 w-3.5" aria-hidden="true"/></button>}
      </span>)}
      {!value.length&&<span className="text-xs text-slate-500">Selecione um destinatário.</span>}
    </div>
    {!!available.length&&<label className="block"><span className="sr-only">Adicionar em {label}</span><select value="" className="portal-input w-full bg-white text-xs" onChange={event=>{if(event.target.value)onChange([...value,event.target.value as Role]);}}><option value="">Adicionar destinatário…</option>{available.map(option=><option key={option.value} value={option.value}>{option.label}</option>)}</select></label>}
    {!value.length&&<p role="alert" className="text-xs font-semibold text-[var(--portal-danger)]">Selecione ao menos um destinatário antes de publicar.</p>}
  </fieldset>;
}
