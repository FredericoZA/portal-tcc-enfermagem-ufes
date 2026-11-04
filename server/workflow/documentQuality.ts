import { PDFDocument, StandardFonts, rgb, degrees } from 'pdf-lib';
import { inspectPdfLayoutInWorker, type PdfLayoutOptions, type PdfQualityReport } from '../security/pdfLayoutInspection';
export type { PdfQualityReport } from '../security/pdfLayoutInspection';

export function inspectPdfLayout(bytes: Buffer, options: PdfLayoutOptions = {}): Promise<PdfQualityReport> {
  return inspectPdfLayoutInWorker(bytes, options);
}
export async function markPreview(bytes:Buffer):Promise<Buffer>{
  const doc=await PDFDocument.load(bytes);const font=await doc.embedFont(StandardFonts.HelveticaBold);
  for(const page of doc.getPages())page.drawText('AMOSTRA - SEM VALIDADE',{x:35,y:page.getHeight()/2,size:24,font,color:rgb(.75,.1,.1),opacity:.16,rotate:degrees(28)});
  doc.setTitle('Amostra do modelo - sem validade');return Buffer.from(await doc.save());
}
