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
   if(pageNo===1)assert.equal(gutter.length,4,'only the four written baselines receive numbers, despite large blank gaps');
   else assert.equal(gutter.length,1);
   for(const number of gutter)assert.equal(number,++previous);
  }
 }finally{await task.destroy();}
});
test('ata oficial exige uma página e recusa excedente sem cortar o texto',async()=>{
 const doc=await PDFDocument.create();doc.addPage([595,842]).drawText('Ata integral',{x:43,y:740});
 const one=Buffer.from(await doc.save());
 assert.equal((await PDFDocument.load(await numberAtaLines(one,{requireSinglePage:true}))).getPageCount(),1);
 doc.addPage([595,842]).drawText('Texto excedente que não pode desaparecer');
 const two=Buffer.from(await doc.save());
 await assert.rejects(numberAtaLines(two,{requireSinglePage:true}),/2 páginas.*nenhum conteúdo foi cortado/);
 assert.equal((await PDFDocument.load(two)).getPageCount(),2);
});

test('numbering skips blank and whitespace lines, shares a baseline across columns and preserves every original text position',async()=>{
 const doc=await PDFDocument.create(),font=await doc.embedFont(StandardFonts.TimesRoman),page=doc.addPage([595,842]);
 for(const [text,x,y] of [['CABECALHO',150,760],['TITULO',43,710],['Corpo da ata.',43,680],['   ',43,660],['Orientador',80,350],['Aluno',360,350],['Presidente',80,330],['Autor',360,330],['Rodape',160,40]] as const)page.drawText(text,{x,y,size:11,font});
 const source=Buffer.from(await doc.save()),result=await numberAtaLines(source);
 const {getDocument}=await import('pdfjs-dist/legacy/build/pdf.mjs');
 const read=async(bytes:Buffer)=>{const task=getDocument({data:new Uint8Array(bytes),useSystemFonts:true,verbosity:0});try{return(await(await(await task.promise).getPage(1)).getTextContent()).items.filter((item:any)=>item.str?.trim()).map((item:any)=>({text:item.str,x:item.transform[4],y:item.transform[5]}));}finally{await task.destroy();}};
 const before=await read(source),after=await read(result);
 assert.deepEqual(after.filter(item=>item.x>30),before,'adding gutter numbers must not move, remove or rewrite text');
 const numbers=after.filter(item=>item.x<30);
 assert.deepEqual(numbers.map(item=>item.text),['1','2','3','4','5','6']);
 assert.deepEqual(numbers.map(item=>item.y),[760,710,680,350,330,40]);
});
