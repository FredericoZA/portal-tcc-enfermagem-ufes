import {PDFDocument,StandardFonts,rgb} from 'pdf-lib';

/** Apply to the temporary, unsigned Google Docs copy only. 1.5 cm per side. */
export function ataPageLayoutRequests(){
 return [{updateDocumentStyle:{documentStyle:{marginLeft:{magnitude:42.52,unit:'PT'},marginRight:{magnitude:42.52,unit:'PT'}},fields:'marginLeft,marginRight'}}];
}

/** Number rendered text lines, including letterhead, signatures and footer.
 * Runs from the exported unsigned PDF so wrapped lines use their actual baselines.
 * Never apply to a signed file: rewriting it would invalidate its signatures.
 */
export async function numberAtaLines(bytes:Buffer):Promise<Buffer>{
 const {getDocument}=await import('pdfjs-dist/legacy/build/pdf.mjs');
 const task=getDocument({data:new Uint8Array(bytes),useSystemFonts:true,verbosity:0});
 const source=await task.promise;
 try{
  const pdf=await PDFDocument.load(bytes),font=await pdf.embedFont(StandardFonts.Helvetica);
  let counter=1;
  for(let index=0;index<source.numPages;index++){
   const content=await (await source.getPage(index+1)).getTextContent();
   const rows:Array<{y:number;left:number}>=[];
   for(const item of content.items){
    if(!('str' in item)||!item.str.trim())continue;
    const [a,b,c,,x,y]=item.transform;
    // Exclude diagonal preview watermarks; all ordinary horizontal text is counted.
    if(Math.abs(b)>.15||Math.abs(c)>.15||a<=0)continue;
    const row=rows.find(row=>Math.abs(row.y-y)<2);
    if(row)row.left=Math.min(row.left,x);else rows.push({y,left:x});
   }
   rows.sort((a,b)=>b.y-a.y);
   const page=pdf.getPage(index);
   const gaps=rows.slice(1).map((row,i)=>rows[i].y-row.y).filter(gap=>gap>=8&&gap<=24).sort((a,b)=>a-b);
   const pitch=gaps.length?gaps[Math.floor(gaps.length/2)]:13;
   const numberedRows:Array<{y:number;left:number}>=[];
   for(let i=0;i<rows.length;i++){
    numberedRows.push(rows[i]);
    if(i+1<rows.length){
     const gap=rows[i].y-rows[i+1].y;
     const spaces=Math.max(1,Math.round(gap/pitch));
     for(let step=1;step<spaces;step++)numberedRows.push({y:rows[i].y-gap*step/spaces,left:43});
    }
   }
   for(const row of numberedRows){
    const label=String(counter++),size=8;
    // Shared gutter at 7 mm, to the left of the 15 mm text margin.
    const x=Math.min(28,row.left-8)-font.widthOfTextAtSize(label,size);
    if(x<3)throw new Error('A ata não possui margem suficiente para numerar as linhas sem sobrepor o texto.');
    page.drawText(label,{x,y:row.y,size,font,color:rgb(.3,.34,.33)});
   }
  }
  return Buffer.from(await pdf.save());
 }finally{await task.destroy();}
}
