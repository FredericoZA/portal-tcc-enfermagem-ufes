import type {Color,PDFFont,PDFImage,PDFPage} from 'pdf-lib';

type HeaderBox={x:number;y:number;width:number;height:number};
type HeaderOptions={box:HeaderBox;lines:readonly string[];font:PDFFont;color:Color;arms:PDFImage;armsSize?:number;armsBackground?:Color;fontSize?:number};

function wrapHeaderLine(value:string,font:PDFFont,size:number,width:number):string[]{
 const lines:string[]=[];let line='';
 for(const word of value.trim().split(/\s+/u)){
  const next=line?`${line} ${word}`:word;
  if(font.widthOfTextAtSize(next,size)<=width){line=next;continue;}
  if(line){lines.push(line);line='';}
  for(const character of word){
   if(line&&font.widthOfTextAtSize(line+character,size)>width){lines.push(line);line='';}
   line+=character;
  }
 }
 if(line)lines.push(line);
 return lines;
}

export function drawInstitutionalPdfHeader(page:PDFPage,options:HeaderOptions):void{
 const {box,font,color,arms}=options,padding=6,gap=4;
 const availableHeight=box.height-2*padding;
 const armsSize=Math.min(options.armsSize||48,availableHeight-4),armsBox=armsSize+(options.armsBackground?4:0);
 const textWidth=box.width-2*padding;
 if(textWidth<=0||availableHeight<=0)throw new Error('Área insuficiente para o cabeçalho institucional.');
 let size=options.fontSize||9,rows:string[]=[],height=0,capHeight=0,lineHeight=0;
 while(size>=6){
  rows=options.lines.flatMap(value=>wrapHeaderLine(value.toLocaleUpperCase('pt-BR'),font,size,textWidth));
  capHeight=font.heightAtSize(size,{descender:false});lineHeight=size*1.2;
  height=armsBox+gap+capHeight+Math.max(0,rows.length-1)*lineHeight;
  if(height<=availableHeight)break;
  size-=.25;
 }
 if(height>availableHeight)throw new Error('O cabeçalho institucional excede a área reservada.');
 const centerX=box.x+box.width/2,top=box.y+(box.height+height)/2;
 const armsCenterY=top-armsBox/2;
 if(options.armsBackground)page.drawCircle({x:centerX,y:armsCenterY,size:armsBox/2,color:options.armsBackground});
 const scale=armsSize/Math.max(arms.width,arms.height),imageWidth=arms.width*scale,imageHeight=arms.height*scale;
 page.drawImage(arms,{x:centerX-imageWidth/2,y:armsCenterY-imageHeight/2,width:imageWidth,height:imageHeight});
 const textTop=top-armsBox-gap;
 rows.forEach((value,index)=>page.drawText(value,{x:centerX-font.widthOfTextAtSize(value,size)/2,y:textTop-capHeight-index*lineHeight,font,size,color}));
}
