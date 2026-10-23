import React,{useEffect,useRef,useState} from 'react';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

export const DocumentFilePreview:React.FC<{url:string;format:'docx'|'pdf';label:string;onLoaded?:()=>void}>=({url,format,label,onLoaded})=>{
  const hostRef=useRef<HTMLDivElement>(null);
  const [error,setError]=useState('');
  const [loading,setLoading]=useState(true);
  useEffect(()=>{
    const controller=new AbortController();const host=hostRef.current;if(!host)return;
    let dispose=()=>{};host.replaceChildren();setError('');setLoading(true);
    void(async()=>{
      try{
        const response=await fetch(url,{credentials:'same-origin',signal:controller.signal});
        if(!response.ok)throw new Error('Não foi possível carregar o arquivo do modelo.');
        const bytes=await response.arrayBuffer();if(controller.signal.aborted)return;
        if(format==='docx'){
          const {renderAsync}=await import('docx-preview');
          if(controller.signal.aborted)return;
          // O DOCX fica em uma árvore isolada até terminar a leitura.
          const documentHost=document.createElement('div');
          await renderAsync(bytes,documentHost,undefined,{className:'portal-docx',useBase64URL:true,renderAltChunks:false});
          documentHost.querySelectorAll('a').forEach(anchor=>anchor.removeAttribute('href'));
          documentHost.querySelectorAll('[src]').forEach(node=>{const source=node.getAttribute('src')||'';if(!source.startsWith('data:'))node.removeAttribute('src');});
          if(!controller.signal.aborted)host.replaceChildren(documentHost);
        }else{
          const {getDocument,GlobalWorkerOptions}=await import('pdfjs-dist');if(controller.signal.aborted)return;GlobalWorkerOptions.workerSrc=pdfWorkerUrl;
          const task=getDocument({data:bytes});dispose=()=>{void task.destroy();};
          const pdf=await task.promise;
          for(let number=1;number<=pdf.numPages&&!controller.signal.aborted;number++){
            const page=await pdf.getPage(number);const viewport=page.getViewport({scale:1.2});
            const canvas=document.createElement('canvas');canvas.width=Math.floor(viewport.width);canvas.height=Math.floor(viewport.height);
            canvas.className='mx-auto mb-4 h-auto max-w-full bg-white';canvas.setAttribute('aria-label',`${label}, página ${number}`);
            const context=canvas.getContext('2d');if(!context)throw new Error('Prévia indisponível neste navegador.');
            if(controller.signal.aborted)return;host.appendChild(canvas);
            await page.render({canvasContext:context,viewport,canvas}).promise;
          }
        }
        if(!controller.signal.aborted)onLoaded?.();
      }catch(cause){if(!controller.signal.aborted)setError(cause instanceof Error?cause.message:'Não foi possível mostrar o modelo.');}
      finally{if(!controller.signal.aborted)setLoading(false);}
    })();
    return()=>{controller.abort();dispose();host.replaceChildren();};
  },[url,format,label]);
  return <div className="min-h-0 flex-1 overflow-auto bg-transparent">
    {loading&&<p role="status" className="text-xs">Carregando modelo…</p>}
    {error&&<p role="alert" className="text-xs text-rose-800">{error}</p>}
    <div ref={hostRef} aria-label={`Conteúdo do modelo ${label}`} inert/>
  </div>;
};
