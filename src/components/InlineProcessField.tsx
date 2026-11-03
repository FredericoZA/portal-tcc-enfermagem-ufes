import {INSTITUTION_ACRONYM_HELP} from '../utils/institutionName';
import React,{useRef,useState} from 'react';
import {Pencil} from 'lucide-react';

/** Save a changed value when leaving the field; Escape discards the current edit. */
export function InlineProcessField({label,value,display=value,type='text',options,editable,beforeEdit,onSave,onEditingChange}:{label:string;value:string;display?:string;type?:string;options?:readonly string[];editable:boolean;beforeEdit?:()=>Promise<boolean>;onEditingChange?:(editing:boolean)=>void;onSave:(value:string)=>Promise<void>}){
 const [editing,setEditing]=useState(false),[draft,setDraft]=useState(value),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const saving=useRef(false),canceled=useRef(false);
 const editSave=useRef(onSave);
 const endEdit=()=>{setEditing(false);onEditingChange?.(false);};
 const save=async(next:string)=>{
  if(saving.current||canceled.current)return;
  if(next===value){endEdit();setError('');return;}
  saving.current=true;setBusy(true);setError('');
  try{await editSave.current(next);endEdit();}
  catch(cause){setError(cause instanceof Error?cause.message:'Não foi possível salvar este campo.');}
  finally{saving.current=false;setBusy(false);}
 };
 const beginEdit=async()=>{
  if(saving.current)return;
  saving.current=true;setBusy(true);setError('');
  try{
   if(beforeEdit&&!(await beforeEdit()))return;
   canceled.current=false;editSave.current=onSave;setDraft(value);setEditing(true);onEditingChange?.(true);
  }catch(cause){setError(cause instanceof Error?cause.message:'Não foi possível iniciar a edição.');}
  finally{saving.current=false;setBusy(false);}
 };
 return <div className="portal-inline-field">{editing?<>
  <div className="portal-inline-field-editor" aria-busy={busy}>
   {options?<select autoFocus aria-label={label} className="portal-input" value={draft} disabled={busy} onChange={event=>{setDraft(event.target.value);void save(event.target.value);}} onBlur={event=>void save(event.currentTarget.value)} onKeyDown={event=>{if(event.key==='Escape'){event.preventDefault();canceled.current=true;endEdit();}}}><option value="">Selecione…</option>{options.map(option=><option key={option}>{option}</option>)}</select>:<input autoFocus aria-label={label} aria-invalid={Boolean(error)} type={type} className="portal-input" value={draft} disabled={busy}
    onChange={event=>setDraft(event.target.value)} onBlur={event=>void save(event.currentTarget.value)}
    onKeyDown={event=>{
     if(event.key==='Escape'){event.preventDefault();event.stopPropagation();canceled.current=true;endEdit();setError('');}
     if(event.key==='Enter'){event.preventDefault();event.currentTarget.blur();}
    }}/> }
  </div>
  {/^Instituição\b/.test(label)&&<p className="mt-1 text-xs text-slate-600">{INSTITUTION_ACRONYM_HELP}</p>}
  {error&&<p role="alert" className="text-xs text-red-800">{error}</p>}
 </>:editable?<button type="button" className="portal-inline-field-trigger" aria-label={`Editar ${label}`} disabled={busy} onClick={()=>void beginEdit()}><span className="portal-inline-field-value">{display||'Não informado'}</span><Pencil className="portal-inline-field-pencil" size={13}/></button>:<span className="portal-inline-field-value">{display||'Não informado'}</span>}</div>;
}
