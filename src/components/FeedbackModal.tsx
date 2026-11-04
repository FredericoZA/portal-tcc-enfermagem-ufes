import React, { useEffect, useState } from 'react';
import { CheckCircle2, ImagePlus, Lightbulb, LoaderCircle, X } from 'lucide-react';
import { PortalModalShell } from './PortalModalShell';
import { apiClient } from '../services/apiClient';
interface FeedbackModalProps { open:boolean; onClose:()=>void; }
const MAX_FILE_SIZE=1_500_000;
const validFileTypes=new Set(['image/png','image/jpeg','image/webp']);

async function readFeedbackImage(file: File):Promise<string> {
  return new Promise((resolve,reject)=>{
    const reader=new FileReader();
    reader.onload=()=>resolve(String(reader.result||''));
    reader.onerror=()=>reject(new Error('Não foi possível ler a imagem.'));
    reader.readAsDataURL(file);
  });
}

export const FeedbackModal:React.FC<FeedbackModalProps>=({open,onClose})=>{
  const [description,setDescription]=useState('');
  const [file,setFile]=useState<File|null>(null);
  const [imagePreview,setImagePreview]=useState('');
  const [hiddenField,setHiddenField]=useState('');
  const [submitting,setSubmitting]=useState(false);
  const [success,setSuccess]=useState(false);
  const [message,setMessage]=useState('');


  useEffect(()=>{
    if(!file){setImagePreview('');return;}
    const url=URL.createObjectURL(file);
    setImagePreview(url);
    return()=>URL.revokeObjectURL(url);
  },[file]);

  const close=()=>{
    if(submitting)return;
    setDescription('');setFile(null);setHiddenField('');
    setSuccess(false);setMessage('');
    onClose();
  };

  const chooseImage=(selected?:File)=>{
    setMessage('');
    if(!selected){setFile(null);return;}
    if(!validFileTypes.has(selected.type)){
      setMessage('Envie uma imagem PNG, JPEG ou WebP.');
      return;
    }
    if(selected.size>MAX_FILE_SIZE){
      setMessage('O tamanho máximo da imagem é 1,5 MB.');
      return;
    }
    setFile(selected);
  };

  const submit=async(e:React.FormEvent)=>{
    e.preventDefault();
    if(submitting)return;
    setMessage('');
    if(description.trim().length<20){
      setMessage('Descreva a sugestão com pelo menos 20 caracteres.');
      return;
    }
    setSubmitting(true);
    try{
      const imageDataUrl=file?await readFeedbackImage(file):undefined;
      await apiClient.sendPublicFeedback({description:description.trim(),imageDataUrl,extraField:hiddenField});
      setSuccess(true);setDescription('');setFile(null);
    }catch(error){setMessage(error instanceof Error?error.message:'Não foi possível registrar a sugestão.');}
    finally{setSubmitting(false);}
  };

  return <PortalModalShell
    open={open}
    onClose={close}
    closeOnBackdrop={!submitting}
    closeOnEscape={!submitting}
    title="Sugestões"
    subtitle="Ajude a melhorar o Portal TCC"
    icon={Lightbulb}
    maxWidthClass="max-w-lg"
    heightClass="max-h-[90vh]"
    bodyClassName="p-4 sm:p-5"
  >
    {success?(
      <div role="status" className="flex flex-col items-center gap-3 py-7 text-center">
        <CheckCircle2 className="h-12 w-12 text-emerald-700" aria-hidden="true"/>
        <h3 className="text-base font-bold text-slate-950">Sugestão recebida</h3>
        <p className="max-w-sm text-sm text-slate-700">Sua mensagem foi registrada para avaliação da equipe responsável pelo Portal TCC.</p>
        <button type="button" onClick={close} className="rounded-full bg-emerald-800 px-5 py-2.5 text-xs font-bold text-white">Fechar</button>
      </div>
    ):(
      <form onSubmit={(e)=>void submit(e)} className="space-y-4">
        <p className="text-xs leading-5 text-slate-600">Descreva o que aconteceu ou o que pode melhorar. Não é necessário entrar no Portal. Para proteger a privacidade, não inclua nomes, e-mails, matrículas, documentos ou outras informações pessoais de estudantes e terceiros no texto ou nas imagens.</p>
        <label className="block space-y-1.5 text-xs font-bold text-slate-800">
          <span>Descrição da sugestão *</span>
          <textarea
            id="public-feedback-description"
            required minLength={20} maxLength={4000} rows={5}
            value={description} onChange={(e)=>setDescription(e.target.value)}
            placeholder="Conte o problema ou explique sua ideia de melhoria..."
            className="w-full resize-y rounded-xl border border-slate-300 bg-white p-3 text-sm font-normal leading-5 text-slate-900 outline-none focus:ring-2 focus:ring-emerald-600"
          />
          <span className="block text-right text-[10px] font-normal text-slate-500">{description.length}/4.000 caracteres</span>
        </label>
        <div className="space-y-2">
          <label htmlFor="public-feedback-image" className="block text-xs font-bold text-slate-800">Imagem ou captura de tela (opcional)</label>
          <div className="flex flex-wrap items-center gap-2">
            <label htmlFor="public-feedback-image" className="inline-flex min-h-9 cursor-pointer items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50">
              <ImagePlus className="h-4 w-4" aria-hidden="true"/>
              {file?'Trocar imagem':'Adicionar imagem'}
            </label>
            <input id="public-feedback-image" type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={e=>chooseImage(e.target.files?.[0])} />
            {file&&<button type="button" onClick={()=>setFile(null)} className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-bold text-red-700"><X className="h-3.5 w-3.5" aria-hidden="true"/>Remover</button>}
          </div>
          {imagePreview&&<img src={imagePreview} alt="Prévia da imagem que será enviada" className="max-h-52 max-w-full rounded-lg border border-slate-300 bg-white object-contain"/>}
          <p className="text-[11px] leading-4 text-slate-600">PNG, JPEG ou WebP, até 1,5 MB. Evite incluir dados pessoais ou informações de outros alunos nas imagens.</p>
        </div>
        <label className="absolute -left-[10000px] top-auto h-px w-px overflow-hidden" aria-hidden="true">
          Não preencha<input type="text" tabIndex={-1} autoComplete="off" value={hiddenField} onChange={e=>setHiddenField(e.target.value)}/>
        </label>
        {message&&<p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800">{message}</p>}
        <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
          <button type="button" disabled={submitting} onClick={close} className="rounded-full border border-slate-300 bg-white px-4 py-2.5 text-xs font-bold text-slate-800 disabled:opacity-50">Cancelar</button>
          <button type="submit" disabled={submitting||description.trim().length<20} className="inline-flex items-center gap-2 rounded-full bg-emerald-800 px-5 py-2.5 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">
            {submitting?<LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true"/>:<Lightbulb className="h-4 w-4" aria-hidden="true"/>}
            {submitting?'Enviando…':'Enviar sugestão'}
          </button>
        </div>
      </form>
    )}
  </PortalModalShell>;
};
