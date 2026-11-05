import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {DOCUMENT_ISSUER_LINES,documentHeaderLines} from '../src/utils/institutionalIdentity';
import {createBlankAttendanceDeclarationPdf} from '../src/utils/blankAttendanceDeclaration';
import {createRegistrationSnapshotPdf} from './documents/registrationSnapshot';
import {createReservationReceiptPdf} from './documents/reservationReceipt';
import {DEMO_PROCESSES,INITIAL_SETTINGS} from '../src/services/demoSeed';

test('generated records share the three-line right-aligned issuer, separate from the letterhead',async()=>{
 const p=structuredClone(DEMO_PROCESSES[0]);
 p.defesa.departmentResponse={revision:0,decision:'UNAVAILABLE',respondedBy:'department@example.invalid',respondedAt:'2026-11-04T15:00:00Z',startAt:p.defesa.startAt,endAt:p.defesa.endAt};
 const documents=[
  {bytes:await createBlankAttendanceDeclarationPdf(new Uint8Array(await readFile('public/national-arms.png'))),right:595.28-58,date:false,header:{left:23,right:572.28,bottom:719,top:819}},
  {bytes:await createRegistrationSnapshotPdf(p,INITIAL_SETTINGS),right:553,date:true,header:{left:0,right:595,bottom:742,top:842}},
  {bytes:await createReservationReceiptPdf(p,INITIAL_SETTINGS),right:549,date:true,header:{left:0,right:595,bottom:742,top:842}},
 ];
 const {getDocument,OPS,Util}=await import('pdfjs-dist/legacy/build/pdf.mjs');
 for(const sample of documents){
  const task=getDocument({data:new Uint8Array(sample.bytes),verbosity:0});const pdf=await task.promise;
  try{
   for(let pageIndex=1;pageIndex<=pdf.numPages;pageIndex++){
    const headerPage=await pdf.getPage(pageIndex),headerContent=await headerPage.getTextContent();
    const items=(headerContent.items as any[]).filter(item=>item.str?.trim());
    const labels=documentHeaderLines(),headerItems=items.filter(item=>labels.includes(item.str));
    assert.equal(headerItems.length,3,'Each page has exactly three institutional lines');
    for(const line of labels)assert.ok(headerItems.some(item=>item.str===line),`Missing uppercase letterhead: ${line}`);
    assert.ok(headerItems.every(item=>item.str===item.str.toLocaleUpperCase('pt-BR')),'Institutional letterhead must be uppercase');
    const pageCenter=(headerPage.view[0]+headerPage.view[2])/2;
    const textBounds=(item:any)=>({bottom:item.transform[5]+item.height*Math.min(0,headerContent.styles[item.fontName]?.descent||0),top:item.transform[5]+item.height*Math.max(1,headerContent.styles[item.fontName]?.ascent||1)});
    for(const item of headerItems){
     const bounds=textBounds(item);
     assert.ok(Math.abs(item.transform[4]+item.width/2-pageCenter)<1.5,'Every institutional line must be centered on the page');
     assert.ok(item.transform[4]>=sample.header.left&&item.transform[4]+item.width<=sample.header.right,'Institutional text fits horizontally in the header');
     assert.ok(bounds.bottom>=sample.header.bottom&&bounds.top<=sample.header.top,'Institutional text fits vertically in the header');
    }
    const operators=await headerPage.getOperatorList(),stack:number[][]=[],images:Array<{left:number;right:number;bottom:number;top:number}>=[];
    let matrix=[1,0,0,1,0,0];
    operators.fnArray.forEach((operation,index)=>{
     if(operation===OPS.save)stack.push([...matrix]);
     else if(operation===OPS.restore)matrix=stack.pop()||[1,0,0,1,0,0];
     else if(operation===OPS.transform)matrix=Util.transform(matrix,operators.argsArray[index]);
     else if(operation===OPS.paintImageXObject||operation===OPS.paintInlineImageXObject){
      const points=[[0,0],[1,0],[0,1],[1,1]].map(([x,y])=>[matrix[0]*x+matrix[2]*y+matrix[4],matrix[1]*x+matrix[3]*y+matrix[5]]);
      images.push({left:Math.min(...points.map(point=>point[0])),right:Math.max(...points.map(point=>point[0])),bottom:Math.min(...points.map(point=>point[1])),top:Math.max(...points.map(point=>point[1]))});
     }
    });
    assert.equal(images.length,1,'Each page renders one coat of arms');
    const arms=images[0],textTop=Math.max(...headerItems.map(item=>textBounds(item).top));
    assert.ok(Math.abs((arms.left+arms.right)/2-pageCenter)<1.5,'The coat of arms must be centered on the page');
    assert.ok(arms.left>=sample.header.left&&arms.right<=sample.header.right&&arms.bottom>=sample.header.bottom&&arms.top<=sample.header.top,'The coat of arms fits entirely within the header');
    assert.ok(arms.bottom>textTop,'The coat of arms is above, not beside or overlapping, the institutional lines');
    const bodyItems=items.filter(item=>!labels.includes(item.str)&&item.transform[5]<sample.header.bottom);
    assert.ok(bodyItems.length>0);
    assert.ok(Math.max(...bodyItems.map(item=>textBounds(item).top))<sample.header.bottom,'The document body does not overlap the institutional header');
   }
   const page=await pdf.getPage(pdf.numPages),content=await page.getTextContent(),items=content.items as any[];
   for(const line of DOCUMENT_ISSUER_LINES){
    const item=items.find(item=>item.str===line);assert.ok(item,`Missing issuer line: ${line}`);
    assert.ok(item.transform[5]<80,'issuing unit belongs to the closing, not the letterhead');
    assert.ok(Math.abs(item.transform[4]+item.width-sample.right)<1.5,`Issuer is not right-aligned: ${line}`);
   }
   if(sample.date){const item=items.find(item=>/^Vitória - ES,/.test(item.str));assert.ok(item);assert.ok(item.transform[5]<115);assert.ok(Math.abs(item.transform[4]+item.width-sample.right)<1.5);}
  }finally{await task.destroy();}
 }
});
