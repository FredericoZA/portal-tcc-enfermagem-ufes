import type {ProcessData,ProcessDocument} from '../src/types';
import {hasPersonalEmailAccess} from './integrations/emailAuditCopy';
/** Only issued invitation and archived signed academic documents may be offered publicly. */
export function publicAcademicDocuments(process:ProcessData,documents:ProcessDocument[]){
 return documents.filter(doc=>['CONVITE','ATA','TERMO','DECLARACAO'].includes(doc.type)&&(doc.type!=='TERMO'||Boolean(process.acervo?.publishFullWork||process.acervo?.publishExpandedAbstract))&&(doc.type==='CONVITE'?doc.status==='DISPONIVEL':doc.status==='ASSINADO')).map(doc=>({id:doc.id,type:doc.type,title:doc.title||doc.type,status:doc.status,version:doc.currentVersion,url:`/api/public/processes/${encodeURIComponent(process.protocolo)}/documents/${encodeURIComponent(doc.id)}/download`}));
}
function normalizedCredentialText(text:string):string{
 for(let i=0;i<3;i++){
  const next=text.replace(/\\(?:u([a-f\d]{4})|(["'\\/nrtbf]))/gi,(_match,code:string,escaped:string)=>code?String.fromCharCode(Number.parseInt(code,16)):/^[nrtbf]$/i.test(escaped)?' ':escaped);
  if(next===text)break;text=next;
 }
 return text;
}
function explicitCredentialEvidence(text:string):string{
 const parts=[text];
 for(const value of text.match(/https?:\/\/[^\s"'<>{}\\]+/gi)||[]){
  try{
   const url=new URL(value.replace(/&amp;/gi,'&'));
   parts.push(...url.searchParams.values(),url.pathname,url.hash);
  }catch{}
 }
 return parts.map(value=>{
  for(let i=0;i<3;i++){
   try{const decoded=decodeURIComponent(value);if(decoded===value)break;value=decoded;}catch{break;}
  }
  return normalizedCredentialText(value);
 }).join(' ');
}
function hasExplicitCredential(text:string):boolean{
 return /\bBearer\s+[A-Za-z0-9._~+/-]{8,}/i.test(text)
  || /https?:\/\/[^\s/"'<>:]+:[^\s/"'<>]+@/i.test(text)
  || /\b(?:access_token|session_token|refresh_token|client_secret|api[_-]?key|tokenAPI|token|secret|password|senha)\s*["']?\s*[=:]\s*["']?[^\s"',:}]{4,}/i.test(text)
  || /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/.test(text);
}
function withoutPublicVerificationUrls(text:string,portalBaseUrl:string):string{
 let portalOrigin='';try{portalOrigin=new URL(portalBaseUrl).origin;}catch{}
 return text.replace(/https?:\/\/[^\s"'<>{}\\]+/gi,value=>{
  try{
   const url=new URL(value.replace(/&amp;/gi,'&'));
   if(url.username||url.password||!/^[#a-z\d._~-]*$/i.test(url.hash))return value;
   const portal=url.origin===portalOrigin&&/^\/api\/public\/verification\/[a-z\d._~-]+\/?$/i.test(url.pathname);
   const asten=url.protocol==='https:'&&url.host==='plataforma.astenassinatura.com.br'&&/^\/validar-documento(?:\/[a-z\d._~-]+)?\/?$/i.test(url.pathname);
   if(!portal&&!asten)return value;
   if([...url.searchParams.keys()].some(key=>!['code','codigo','hash','id','chave'].includes(key.toLowerCase())))return value;
   return '[endereço público de autenticidade]';
  }catch{return value;}
 });
}
export async function assertPublicAcademicPdf(bytes:Buffer,_process:ProcessData,options:{portalBaseUrl?:string}={}){
 const {getDocument}=await import('pdfjs-dist/legacy/build/pdf.mjs');
 const task=getDocument({data:new Uint8Array(bytes),useSystemFonts:true,verbosity:0});let pdf:any;
 try{
  pdf=await task.promise;if(await pdf.getAttachments())throw new Error('Documento com anexos internos.');
  let text='',extracted='';for(let i=1;i<=pdf.numPages;i++){const page=await pdf.getPage(i);const content=(await page.getTextContent()).items.map((item:any)=>item.str||'').join(' ');extracted+=content;text+=content+' '+JSON.stringify(await page.getAnnotations());}
  const metadata=await pdf.getMetadata();text+=' '+JSON.stringify(metadata.info||{})+' '+JSON.stringify(metadata.metadata?.getAll?.()||{});
  if(extracted.trim().length<20)throw new Error('Não foi possível conferir o conteúdo do documento.');
  const normalizedText=normalizedCredentialText(text);
  const credentialText=withoutPublicVerificationUrls(normalizedText,options.portalBaseUrl||String(process.env.PORTAL_PUBLIC_URL||process.env.APP_URL||''));
  if(hasPersonalEmailAccess(credentialText)
    || hasExplicitCredential(explicitCredentialEvidence(normalizedText)))throw new Error('Documento contém credencial de acesso pessoal.');
  if (/\b(?:CPF|RG|CNH|passaporte|telefone|celular|data\s+de\s+nascimento)\s*[:nº°.-]*\s*[\d(]/i.test(text)
    || /(?<!\d)\d{3}\.\d{3}\.\d{3}-\d{2}(?!\d)/.test(text)) throw new Error('Documento contém identificação privada.');
 }finally{if(pdf&&typeof pdf.destroy==='function')await pdf.destroy();else await task.destroy();}
}
