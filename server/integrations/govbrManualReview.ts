import {createHash} from 'node:crypto';
import {PDFArray, PDFDict, PDFDocument, PDFHexString, PDFName, PDFNumber, PDFRef, PDFStream, type PDFContext, type PDFObject} from 'pdf-lib';
import type {SignatureJob} from '../../src/types/signatures';
import {assertSafeUploadedDocument} from '../security/fileSafety';

/** Structural binding only. Cryptographic validity and holder identity require human ITI review. */
export async function inspectGovbrReturnedPdf(original:Buffer,returned:Buffer,expectedOriginalSha256:string):Promise<string>{
  if(createHash('sha256').update(original).digest('hex')!==expectedOriginalSha256)throw new Error('O original não corresponde à versão preparada pelo Portal.');
  if(!returned.length||returned.length>50*1024*1024||!returned.subarray(0,5).equals(Buffer.from('%PDF-')))throw new Error('Envie um PDF de até 50 MB.');
  await assertSafeUploadedDocument(returned,'PDF');
  const [before,after]=await Promise.all([PDFDocument.load(original,{updateMetadata:false,throwOnInvalidObject:true}),PDFDocument.load(returned,{updateMetadata:false,throwOnInvalidObject:true})]);
  if(before.isEncrypted||after.isEncrypted||!before.getPageCount()||before.getPageCount()!==after.getPageCount())throw new Error('O PDF devolvido não mantém as páginas do original.');
  // Resolve references rather than comparing object numbers, which may change on signing.
  const canonical=(object:PDFObject|undefined,context:PDFContext,stack=new Set<PDFObject>(),budget={count:0}):string=>{
    if(!object)return 'missing';
    if(++budget.count>50_000||stack.size>100)throw new Error('A estrutura do PDF excede o limite de conferência.');
    if(object instanceof PDFRef){const resolved=context.lookup(object);if(!resolved)throw new Error('Referência inválida no PDF.');return canonical(resolved,context,stack,budget);}
    if(stack.has(object))return 'cycle';
    stack.add(object);
    let value:string;
    if(object instanceof PDFStream)value=`stream:${canonical(object.dict,context,stack,budget)}:${createHash('sha256').update(object.getContents()).digest('hex')}`;
    else if(object instanceof PDFDict)value=object.entries().sort(([a],[b])=>a.toString().localeCompare(b.toString())).map(([key,item])=>`${key}:${canonical(item,context,stack,budget)}`).join('|');
    else if(object instanceof PDFArray)value=object.asArray().map(item=>canonical(item,context,stack,budget)).join(',');
    else value=object.toString();
    stack.delete(object);return value;
  };
  for(let index=0;index<before.getPageCount();index++){
    const left=before.getPage(index),right=after.getPage(index);
    if(JSON.stringify([left.getMediaBox(),left.getCropBox(),left.getRotation()])!==JSON.stringify([right.getMediaBox(),right.getCropBox(),right.getRotation()])||
      canonical(left.node.Contents(),before.context)!==canonical(right.node.Contents(),after.context)||
      canonical(left.node.Resources(),before.context)!==canonical(right.node.Resources(),after.context))throw new Error('O conteúdo do PDF difere do original. Assine o arquivo baixado do Portal sem editar ou imprimir novamente.');
  }
  const hasSignature=after.getForm().getFields().some(field=>{
    if(field.acroField.dict.get(PDFName.of('FT'))?.toString()!=='/Sig')return false;
    const value=field.acroField.dict.lookup(PDFName.of('V'));
    if(!(value instanceof PDFDict))return false;
    const range=value.lookup(PDFName.of('ByteRange')),contents=value.lookup(PDFName.of('Contents'));
    if(!(range instanceof PDFArray)||range.size()!==4||!(contents instanceof PDFHexString)||!contents.asBytes().some(byte=>byte!==0))return false;
    const entries=range.asArray();if(!entries.every(item=>item instanceof PDFNumber))return false;
    const [start,length,next,last]=entries.map(item=>(item as PDFNumber).asNumber());
    return entries.every(item=>Number.isSafeInteger((item as PDFNumber).asNumber()))&&start===0&&length>0&&next>length&&last>0&&next+last===returned.length;
  });
  if(!hasSignature)throw new Error('Não foi encontrada uma assinatura digital incorporada que cubra o PDF. Uma imagem de assinatura não é suficiente.');
  return createHash('sha256').update(returned).digest('hex');
}

export interface GovbrReviewConfirmation {sha256:string;itiApproved:boolean;signerMatches:boolean;documentMatches:boolean;}
export function assertGovbrManualApproval(job:SignatureJob,currentRevision:number,input:GovbrReviewConfirmation):void{
  if(job.provider!=='GOV_BR'||!['ATA','TERMO','DECLARACAO'].includes(job.documentType)||job.status==='CANCELED')throw new Error('Esta assinatura não pertence ao fluxo Gov.br.');
  if(job.sourceDataRevision!==currentRevision)throw new Error('Os dados do TCC mudaram. Prepare uma nova versão antes de conferir.');
  if(!job.govbrReview||job.govbrReview.sha256!==input.sha256)throw new Error('O PDF foi substituído ou ainda não foi enviado. Confira novamente o arquivo atual.');
  if(input.itiApproved!==true||input.signerMatches!==true||input.documentMatches!==true)throw new Error('Confirme o resultado aprovado no VALIDAR/ITI, o titular esperado e o conteúdo do documento.');
}
