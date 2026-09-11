import { PDFDocument, StandardFonts, rgb, degrees } from 'pdf-lib';
export interface PdfQualityReport {
  pages: number; issues: Array<{page:number;code:string;severity:'ERROR'|'WARNING';message:string}>;
  extractedCharacters: number; requiresVisualReview: true;
}
export async function inspectPdfLayout(bytes: Buffer, options: {signatureReservePoints?:number;maximumPages?:number;needsSignature?:boolean} = {}): Promise<PdfQualityReport> {
  if(bytes.length>24*1024*1024)throw new Error('PDF acima do limite de análise de 24 MB.');
  const {getDocument}=await import('pdfjs-dist/legacy/build/pdf.mjs');
  const task=getDocument({data:new Uint8Array(bytes),useSystemFonts:true,verbosity:0});
  let doc:any;
  try{
    doc=await task.promise;
    const report:PdfQualityReport={pages:doc.numPages,issues:[],extractedCharacters:0,requiresVisualReview:true};
    if(doc.numPages>(options.maximumPages||20))report.issues.push({page:0,code:'PAGE_LIMIT',severity:'ERROR',message:`O modelo gerou ${doc.numPages} páginas; confira o limite configurado.`});
    if(await doc.getJSActions())report.issues.push({page:0,code:'ACTIVE_CONTENT',severity:'ERROR',message:'O PDF contém ações JavaScript. Remova o conteúdo ativo.'});
    for(let number=1;number<=Math.min(doc.numPages,60);number++){
      const page=await doc.getPage(number),viewport=page.getViewport({scale:1});
      const content=await page.getTextContent();
      const items=content.items.filter((i:any)=>typeof i.str==='string');
      const text=items.map((i:any)=>i.str).join(' ');report.extractedCharacters+=text.trim().length;
      if(/<<[^<>]{1,100}>>|\{\{[^{}]{1,100}\}\}|\[\[[^\[\]]{1,100}\]\]|«[^«»]{1,100}»/.test(text))report.issues.push({page:number,code:'UNRESOLVED_MARKER',severity:'ERROR',message:'Há um marcador sem preenchimento no PDF.'});
      const operators=await page.getOperatorList();
      if(!text.trim()&&operators.fnArray.length<6)report.issues.push({page:number,code:'EMPTY_PAGE',severity:'WARNING',message:'Página possivelmente vazia.'});
      else if(!text.trim())report.issues.push({page:number,code:'NO_EXTRACTABLE_TEXT',severity:'WARNING',message:'Página sem texto extraível: confira se há imagem ou conteúdo vazio.'});
      let outOfBounds=false, lowest=Infinity;
      for(const item of items){
        if(!item.str.trim())continue;
        const [a,b,c,d,x,y]=item.transform;const height=item.height||Math.hypot(c,d)||Math.hypot(a,b);const width=item.width||0;
        // Text box estimate; clipping masks, kerning and image-only content need visual review.
        if(Math.abs(b)<0.1&&Math.abs(c)<0.1){if(x<page.view[0]-2||x+width>page.view[2]+2||y<page.view[1]-2||y+height>page.view[3]+3)outOfBounds=true;lowest=Math.min(lowest,y-page.view[1]);}
      }
      if(outOfBounds)report.issues.push({page:number,code:'TEXT_OUTSIDE_PAGE',severity:'WARNING',message:'Há texto cuja caixa estimada ultrapassa a página. Confira possível corte.'});
      if(options.needsSignature&&number===doc.numPages&&lowest<(options.signatureReservePoints??90))report.issues.push({page:number,code:'SIGNATURE_SPACE',severity:'WARNING',message:'O texto ocupa a reserva inferior configurada para assinaturas. Confira a composição final.'});
    }
    return report;
  }finally{
    if(doc&&typeof doc.destroy==='function')await doc.destroy();
    else if(typeof task.destroy==='function')await task.destroy();
  }
}
export async function markPreview(bytes:Buffer):Promise<Buffer>{
  const doc=await PDFDocument.load(bytes);const font=await doc.embedFont(StandardFonts.HelveticaBold);
  for(const page of doc.getPages())page.drawText('AMOSTRA - SEM VALIDADE',{x:35,y:page.getHeight()/2,size:24,font,color:rgb(.75,.1,.1),opacity:.16,rotate:degrees(28)});
  doc.setTitle('Amostra do modelo - sem validade');return Buffer.from(await doc.save());
}
