import React,{useRef,useState} from 'react';
import {Pencil} from 'lucide-react';

/** Save a changed value when leaving the field; Escape discards the current edit. */
export function InlineProcessField({label,value,display=value,type='text',editable,beforeEdit,onSave}:{label:string;value:string;display?:string;type?:string;editable:boolean;beforeEdit?:()=>Promise<boolean>;onSave:(value:string)=>Promise<void>}){
 const [editing,setEditing]=useState(false),[draft,setDraft]=useState(value),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const saving=useRef(false),canceled=useRef(false);
 const save=async(next:string)=>{
  if(saving.current||canceled.current)return;
  if(next===value){setEditing(false);setError('');return;}
  saving.current=true;setBusy(true);setError('');
  try{await onSave(next);setEditing(false);}
  catch(cause){setError(cause instanceof Error?cause.message:'Não foi possível salvar este campo.');}
  finally{saving.current=false;setBusy(false);}
 };
 const beginEdit=async()=>{
  if(saving.current)return;
  saving.current=true;setBusy(true);setError('');
  try{
   if(beforeEdit&&!(await beforeEdit()))return;
   canceled.current=false;setDraft(value);setEditing(true);
  }catch(cause){setError(cause instanceof Error?cause.message:'Não foi possível iniciar a edição.');}
  finally{saving.current=false;setBusy(false);}
 };
 return <div className="portal-inline-field">{editing?<>
  <div className="portal-inline-field-editor" aria-busy={busy}>
   <input autoFocus aria-label={label} aria-invalid={Boolean(error)} type={type} className="portal-input" value={draft} disabled={busy}
    onChange={event=>setDraft(event.target.value)} onBlur={event=>void save(event.currentTarget.value)}
    onKeyDown={event=>{
     if(event.key==='Escape'){event.preventDefault();event.stopPropagation();canceled.current=true;setEditing(false);setError('');}
     if(event.key==='Enter'){event.preventDefault();event.currentTarget.blur();}
    }}/>
  </div>
  {error&&<p role="alert" className="text-xs text-red-800">{error}</p>}
 </>:editable?<button type="button" className="portal-inline-field-trigger" aria-label={`Editar ${label}`} disabled={busy} onClick={()=>void beginEdit()}><span className="portal-inline-field-value">{display||'Não informado'}</span><Pencil className="portal-inline-field-pencil" size={13}/></button>:<span className="portal-inline-field-value">{display||'Não informado'}</span>}</div>;
}
