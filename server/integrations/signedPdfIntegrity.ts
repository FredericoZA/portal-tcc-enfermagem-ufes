import {PDFDocument} from 'pdf-lib';
export async function assertSignedPdfIntegrity(pdf:Buffer):Promise<void> {
  try{
    const document=await PDFDocument.load(pdf,{updateMetadata:false,throwOnInvalidObject:true});
    if(document.isEncrypted||document.getPageCount()<1)throw new Error('PDF sem páginas acessíveis.');
  }catch{throw new Error('O PDF recebido da Asten está corrompido ou não pode ser validado. O arquivamento foi bloqueado.');}
}
