import {readFileSync} from 'node:fs';
import path from 'node:path';
import {StandardFontEmbedder} from 'pdf-lib';
import {FontNames} from '@pdf-lib/standard-fonts';
import {documentHeaderLines} from '../../src/utils/institutionalIdentity';

const normalizePdfText = (value: string) => value
  .normalize('NFC')
  .replace(/[“”]/g, '"')
  .replace(/[‘’]/g, "'")
  .replace(/[–—]/g, '-')
  .replace(/…/g, '...')
  .replace(/☒/g, '[X]').replace(/☐/g, '[ ]')
  .replace(/[^\u0009\u000A\u000D\u0020-\u00FF]/g, '');

const escapeLiteral = (value: string) => normalizePdfText(value)
  .replace(/\\/g, '\\\\')
  .replace(/\(/g, '\\(')
  .replace(/\)/g, '\\)');

function wrapText(text: string, maxLength = 86): string[] {
  const output: string[] = [];
  for (const paragraph of normalizePdfText(text).split(/\r?\n/)) {
    const words = paragraph.trim().split(/\s+/).filter(Boolean);
    if (!words.length) { output.push(''); continue; }
    let line = '';
    for (const word of words) {
      if (!line) line = word;
      else if (`${line} ${word}`.length <= maxLength) line += ` ${word}`;
      else { output.push(line); line = word; }
    }
    if (line) output.push(line);
    output.push('');
  }
  return output;
}

type ArmsImage={object:Buffer;width:number;height:number};
let cachedArms:ArmsImage|undefined;

function nationalArmsImage():ArmsImage{
  if(cachedArms)return cachedArms;
  const png=readFileSync(path.join(process.cwd(),'server/documents/assets/national-arms.png'));
  if(!png.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))throw new Error('Brasão institucional inválido.');
  let width=0,height=0,palette:Buffer|undefined,transparency:Buffer|undefined;const chunks:Buffer[]=[];
  for(let offset=8;offset+12<=png.length;){
    const length=png.readUInt32BE(offset),type=png.subarray(offset+4,offset+8).toString('ascii');
    if(offset+12+length>png.length)throw new Error('Brasão institucional incompleto.');
    const data=png.subarray(offset+8,offset+8+length);
    if(type==='IHDR'){
      if(length!==13||data[8]!==8||data[9]!==3||data[10]!==0||data[11]!==0||data[12]!==0)throw new Error('Formato do brasão institucional não suportado.');
      width=data.readUInt32BE(0);height=data.readUInt32BE(4);
    }else if(type==='PLTE')palette=data;
    else if(type==='tRNS')transparency=data;
    else if(type==='IDAT')chunks.push(data);
    offset+=length+12;
    if(type==='IEND')break;
  }
  if(!width||!height||!palette||palette.length%3!==0||!chunks.length||(transparency&&(transparency.length!==1||transparency[0]!==0)))throw new Error('Brasão institucional não suportado.');
  const image=Buffer.concat(chunks),mask=transparency?' /Mask [0 0]':'';
  const dictionary=`<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace [/Indexed /DeviceRGB ${palette.length/3-1} <${palette.toString('hex')}>] /BitsPerComponent 8 /Filter /FlateDecode /DecodeParms << /Predictor 15 /Colors 1 /BitsPerComponent 8 /Columns ${width} >>${mask} /Length ${image.length} >>\nstream\n`;
  cachedArms={object:Buffer.concat([Buffer.from(dictionary,'ascii'),image,Buffer.from('\nendstream','ascii')]),width,height};
  return cachedArms;
}

const headerFont=StandardFontEmbedder.for(FontNames.Helvetica);
const headerWidth=(text:string,size:number)=>Array.from(text).reduce((width,character)=>width+headerFont.widthOfTextAtSize(character,size),0);

function headerCommands(institution:string|undefined,course:string|undefined,arms:ArmsImage):{commands:string[];bodyY:number;titleY:number;protocolY:number;separatorY:number}{
  const labels=documentHeaderLines({institution,course}).map(normalizePdfText),maxTextWidth=451;
  const imageScale=46/Math.max(arms.width,arms.height),imageWidth=arms.width*imageScale,imageHeight=arms.height*imageScale;
  const imageY=842-8-imageHeight,textTop=imageY-5;
  let size=8.75,rows:string[]=[],height=0;
  while(true){
    rows=[];
    for(const label of labels){
      let row='';
      for(const word of label.split(/\s+/)){
        const next=row?`${row} ${word}`:word;
        if(row&&headerWidth(next,size)>maxTextWidth){rows.push(row);row=word;}else row=next;
      }
      if(row)rows.push(row);
    }
    height=headerFont.heightOfFontAtSize(size,{descender:false})+(rows.length-1)*size*1.45;
    if(imageHeight+5+height<=100&&rows.every(row=>headerWidth(row,size)<=maxTextWidth))break;
    if(size<=5)throw new Error('O cabeçalho institucional excede a área reservada.');
    size-=.25;
  }
  const titleY=textTop-height-22,protocolY=titleY-17,separatorY=protocolY-10,bodyY=separatorY-24;
  return {titleY,protocolY,separatorY,bodyY,commands:[
    `q ${imageWidth.toFixed(3)} 0 0 ${imageHeight.toFixed(3)} ${((595-imageWidth)/2).toFixed(3)} ${imageY.toFixed(3)} cm /Arms Do Q`,
    ...rows.map((row,index)=>`BT /F1 ${size} Tf ${((595-headerWidth(row,size))/2).toFixed(3)} ${(textTop-headerFont.heightOfFontAtSize(size,{descender:false})-index*size*1.45).toFixed(3)} Td (${escapeLiteral(row)}) Tj ET`)
  ]};
}

function pageStream(title: string, protocol: string, header:ReturnType<typeof headerCommands>, footer: string, lines: string[], page: number, total: number): Buffer {
  const body = lines.map((line) => `(${escapeLiteral(line)}) Tj T*`).join('\n');
  const stream = [
    '0.02 0.32 0.18 rg',
    ...header.commands,
    `BT /F1 15 Tf 72 ${header.titleY.toFixed(3)} Td (${escapeLiteral(title.toLocaleUpperCase('pt-BR'))}) Tj ET`,
    '0.12 0.16 0.22 rg',
    `BT /F1 9 Tf 72 ${header.protocolY.toFixed(3)} Td (${escapeLiteral(protocol)}) Tj ET`,
    `0.82 0.85 0.88 RG 72 ${header.separatorY.toFixed(3)} m 523 ${header.separatorY.toFixed(3)} l S`,
    `BT /F1 11 Tf 15 TL 72 ${header.bodyY.toFixed(3)} Td ${body} ET`,
    '0.82 0.85 0.88 RG 72 55 m 523 55 l S',
    '0.35 0.40 0.46 rg',
    `BT /F1 8 Tf 72 40 Td (${escapeLiteral(`${footer} - página ${page} de ${total}`)}) Tj ET`
  ].join('\n');
  return Buffer.from(stream, 'latin1');
}

export function createProfessionalPdf(input: { title: string; protocol: string; body: string; institution?: string; course?: string; footer?: string }): Buffer {
  const allLines = wrapText(input.body);
  const arms=nationalArmsImage(),header=headerCommands(input.institution,input.course,arms);
  const perPage = Math.floor((header.bodyY-80)/15)+1;
  const pages: string[][] = [];
  for (let index = 0; index < allLines.length; index += perPage) pages.push(allLines.slice(index, index + perPage));
  if (!pages.length) pages.push(['']);

  const objects: Buffer[] = [];
  const armsObject=4+pages.length*2;
  const pageRefs = pages.map((_, index) => `${4 + index * 2} 0 R`).join(' ');
  objects.push(Buffer.from('<< /Type /Catalog /Pages 2 0 R >>', 'ascii'));
  objects.push(Buffer.from(`<< /Type /Pages /Kids [${pageRefs}] /Count ${pages.length} >>`, 'ascii'));
  objects.push(Buffer.from('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>', 'ascii'));
  pages.forEach((lines, index) => {
    const pageObject = 4 + index * 2;
    const contentObject = pageObject + 1;
    const stream = pageStream(input.title, input.protocol, header, input.footer || 'Portal de TCC', lines, index + 1, pages.length);
    objects.push(Buffer.from(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> /XObject << /Arms ${armsObject} 0 R >> >> /Contents ${contentObject} 0 R >>`, 'ascii'));
    objects.push(Buffer.concat([Buffer.from(`<< /Length ${stream.length} >>\nstream\n`, 'ascii'), stream, Buffer.from('\nendstream', 'ascii')]));
  });
  objects.push(arms.object);

  const chunks: Buffer[] = [Buffer.from('%PDF-1.4\n%âãÏÓ\n', 'latin1')];
  const offsets = [0];
  let byteOffset = chunks[0].length;
  objects.forEach((object, index) => {
    offsets.push(byteOffset);
    const wrapped = Buffer.concat([Buffer.from(`${index + 1} 0 obj\n`, 'ascii'), object, Buffer.from('\nendobj\n', 'ascii')]);
    chunks.push(wrapped);
    byteOffset += wrapped.length;
  });
  const xrefOffset = byteOffset;
  const xref = [`xref\n0 ${objects.length + 1}\n`, '0000000000 65535 f \n', ...offsets.slice(1).map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`)].join('');
  chunks.push(Buffer.from(`${xref}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`, 'ascii'));
  return Buffer.concat(chunks);
}
