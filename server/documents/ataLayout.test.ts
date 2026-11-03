import test from 'node:test';
import assert from 'node:assert/strict';
import {PDFDocument,StandardFonts,degrees} from 'pdf-lib';
import {ataPageLayoutRequests,numberAtaLines} from './ataLayout';

test('ata uses 1.5 cm side margins in the temporary document',()=>{
 const update=ataPageLayoutRequests()[0].updateDocumentStyle;
 assert.equal(update.fields,'marginLeft,marginRight');
 assert.deepEqual(update.documentStyle,{marginLeft:{magnitude:42.52,unit:'PT'},marginRight:{magnitude:42.52,unit:'PT'}});
});
test('line numbers cover header, split runs, signatures, footer and continue across pages',async()=>{
 const doc=await PDFDocument.create(),font=await doc.embedFont(StandardFonts.Helvetica);
 const first=doc.addPage([595,842]);
 first.drawText('Universidade Federal',{x:160,y:740,size:11,font});
 first.drawText('Texto',{x:43,y:650,size:11,font});first.drawText(' em negrito',{x:75,y:650,size:11,font});
 first.drawText('Orientador',{x:220,y:200,size:11,font});
 first.drawText('https://enfermagem.ufes.br',{x:180,y:30,size:10,font});
 first.drawText('AMOSTRA',{x:100,y:400,size:24,font,rotate:degrees(28)});
 doc.addPage([595,842]).drawText('Continuacao',{x:43,y:780,size:11,font});
 const result=await numberAtaLines(Buffer.from(await doc.save()));
 const {getDocument}=await import('pdfjs-dist/legacy/build/pdf.mjs');
 const task=getDocument({data:new Uint8Array(result),useSystemFonts:true,verbosity:0});
 try{const pdf=await task.promise;
  let previous=0;
  for(const pageNo of [1,2]){
   const content=await(await pdf.getPage(pageNo)).getTextContent();
   const gutter=content.items.filter((item:any)=>item.str&&item.transform[4]<30).map((item:any)=>Number(item.str));
   if(pageNo===1)assert.ok(gutter.length>40,'blank lines between header, body, signatures and footer are numbered');
   for(const number of gutter)assert.equal(number,++previous);
  }
 }finally{await task.destroy();}
});
