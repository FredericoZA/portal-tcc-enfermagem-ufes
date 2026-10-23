import {PDFDocument,PDFName,PDFString,PDFHexString} from 'pdf-lib';

/** Deliberately invalid CMS: exercises structural binding and simulated manual review only. */
export async function pdfWithTestSignature(original,{alterContent=false}={}){
  const pdf=await PDFDocument.load(original,{updateMetadata:false});
  if(alterContent)pdf.getPage(0).drawText('CONTEUDO ALTERADO');
  const signature=pdf.context.obj({Type:'Sig',Filter:'Adobe.PPKLite',SubFilter:'adbe.pkcs7.detached',ByteRange:[0,1111111111,2222222222,3333333333],Contents:PDFHexString.of('01'.repeat(128))});
  const field=pdf.context.obj({FT:'Sig',T:PDFString.of('TEST_ONLY_NOT_CRYPTOGRAPHICALLY_VALID'),V:pdf.context.register(signature)});
  pdf.catalog.set(PDFName.of('AcroForm'),pdf.context.obj({Fields:[pdf.context.register(field)]}));
  const result=Buffer.from(await pdf.save({useObjectStreams:false,updateFieldAppearances:false}));
  const text=result.toString('latin1');
  const contents=/\/Contents <[0-9a-f]+>/i.exec(text);
  if(!contents)throw new Error('Fixture inválida.');
  const gapStart=contents.index+contents[0].indexOf('<'),gapEnd=contents.index+contents[0].length;
  const ranges=[gapStart,gapEnd,result.length-gapEnd].map(value=>String(value).padStart(10,'0'));
  return Buffer.from(text.replace('1111111111 2222222222 3333333333',ranges.join(' ')),'latin1');
}
