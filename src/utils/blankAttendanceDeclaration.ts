/** Um clique na barra lateral inicia o download, sem abrir pop-up ou formulário. */
export async function downloadBlankAttendanceDeclaration(): Promise<void> {
  const response=await fetch('/api/public/attendance-declaration.pdf');
  if(!response.ok){const body=await response.json().catch(()=>({}));throw new Error(body.error||'Declaração indisponível.');}
  const bytes=new Uint8Array(await response.arrayBuffer());
  if(bytes.length>2*1024*1024||new TextDecoder().decode(bytes.slice(0,5))!=='%PDF-')throw new Error('O Portal não devolveu o PDF aprovado.');
  const url=URL.createObjectURL(new Blob([bytes],{type:'application/pdf'}));
  const link=document.createElement('a');link.href=url;link.download='declaracao-de-comparecimento-comissao-tcc.pdf';
  document.body.appendChild(link);try{link.click();}finally{link.remove();window.setTimeout(()=>URL.revokeObjectURL(url),60000);}
}
