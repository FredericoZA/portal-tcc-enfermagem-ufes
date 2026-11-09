import {PDFDocument,PDFName,PDFString,PDFHexString} from 'pdf-lib';

/** Deliberately invalid CMS: exercises structural binding and simulated manual review only. */
export async function pdfWithTestSignature(original,{alterContent=false,signatureCount=1,duplicateSignatureContents=false,earlierRevisionSignatures=false}={}){
  if(!Number.isSafeInteger(signatureCount)||signatureCount<1||signatureCount>16)throw new Error('Fixture inválida.');
  const pdf=await PDFDocument.load(original,{updateMetadata:false});
  if(alterContent)pdf.getPage(0).drawText('CONTEUDO ALTERADO');
  const fields=[];
  for(let index=0;index<signatureCount;index++){
    const cmsByte=(duplicateSignatureContents?1:index+1).toString(16).padStart(2,'0');
    const signature=pdf.context.obj({Type:'Sig',Filter:'Adobe.PPKLite',SubFilter:'adbe.pkcs7.detached',ByteRange:[0,1111111111,2222222222,3333333333],Contents:PDFHexString.of(cmsByte.repeat(128))});
    const field=pdf.context.obj({FT:'Sig',T:PDFString.of(`TEST_ONLY_NOT_CRYPTOGRAPHICALLY_VALID_${index}`),V:pdf.context.register(signature)});
    fields.push(pdf.context.register(field));
  }
  pdf.catalog.set(PDFName.of('AcroForm'),pdf.context.obj({Fields:fields}));
  const result=Buffer.from(await pdf.save({useObjectStreams:false,updateFieldAppearances:false}));
  const text=result.toString('latin1');
  const contents=[...text.matchAll(/\/Contents <[0-9a-f]+>/gi)];
  if(contents.length!==signatureCount)throw new Error('Fixture inválida.');
  let index=0;
  return Buffer.from(text.replaceAll('1111111111 2222222222 3333333333',()=>{
    const match=contents[index];
    const gapStart=match.index+match[0].indexOf('<'),gapEnd=match.index+match[0].length;
    const end=earlierRevisionSignatures&&index<signatureCount-1?result.length-1:result.length;
    index++;
    return [gapStart,gapEnd,end-gapEnd].map(value=>String(value).padStart(10,'0')).join(' ');
  }),'latin1');
}
