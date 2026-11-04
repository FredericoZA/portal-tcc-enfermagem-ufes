import type {ProcessData,ProcessDocument} from '../src/types';
/** Only issued invitation and archived signed academic documents may be offered publicly. */
export function publicAcademicDocuments(process:ProcessData,documents:ProcessDocument[]){
 return documents.filter(doc=>['CONVITE','ATA','TERMO','DECLARACAO'].includes(doc.type)&&(doc.type!=='TERMO'||Boolean(process.acervo?.publishFullWork||process.acervo?.publishExpandedAbstract))&&(doc.type==='CONVITE'?doc.status==='DISPONIVEL':doc.status==='ASSINADO')).map(doc=>({id:doc.id,type:doc.type,title:doc.title||doc.type,status:doc.status,version:doc.currentVersion,url:`/api/public/processes/${encodeURIComponent(process.protocolo)}/documents/${encodeURIComponent(doc.id)}/download`}));
}
/** Do not rewrite signed bytes: refuse a public copy containing contact or registration fields. */
export async function assertPublicAcademicPdf(bytes:Buffer,process:ProcessData){
 const {getDocument}=await import('pdfjs-dist/legacy/build/pdf.mjs');
 const task=getDocument({data:new Uint8Array(bytes),useSystemFonts:true,verbosity:0});let pdf:any;
 try{
  pdf=await task.promise;if(await pdf.getAttachments())throw new Error('Documento com anexos internos.');
  let text='',extracted='';for(let i=1;i<=pdf.numPages;i++){const page=await pdf.getPage(i);const content=(await page.getTextContent()).items.map((item:any)=>item.str||'').join(' ');extracted+=content;text+=content+' '+JSON.stringify(await page.getAnnotations());}
  const metadata=await pdf.getMetadata();text+=' '+JSON.stringify(metadata.info||{})+' '+JSON.stringify(metadata.metadata?.getAll?.()||{});
  if(extracted.trim().length<20||/(?:matr[ií]cula|siape|registro\s*(?:acad[eê]mico|funcional))\s*[:nº°.-]*\s*\d+/i.test(text)||/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(text))throw new Error('Documento contém contato privado.');
  // Signed bytes are preserved; copies containing private identifiers fail closed.
  if (/\b(?:CPF|RG|CNH|passaporte|telefone|celular|data\s+de\s+nascimento)\s*[:nº°.-]*\s*[\d(]/i.test(text)
    || /(?<!\d)\d{3}\.\d{3}\.\d{3}-\d{2}(?!\d)/.test(text)) throw new Error('Documento contém identificação privada.');
  const digits=text.replace(/\D/g,'');
  const normalizedText=text.normalize('NFKC').replace(/\s+/g,'').toLowerCase();
  for(const person of [process.aluno1,process.aluno2,process.orientador,process.coorientador,...process.banca]){
   for(const value of [(person as any)?.matricula,(person as any)?.siape]){
    const raw=String(value||'').normalize('NFKC').replace(/\s+/g,'').toLowerCase();
    const key=raw.replace(/\D/g,'');
    if((key.length>=4&&digits.includes(key))||(raw.length>=4&&normalizedText.includes(raw)))throw new Error('Documento contém registro privado.');
   }
  }
 }finally{if(pdf&&typeof pdf.destroy==='function')await pdf.destroy();else await task.destroy();}
}
