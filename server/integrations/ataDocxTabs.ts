import JSZip from 'jszip';

/** Edit an isolated DOCX byte copy; the approved source and every other part stay intact. */
export async function prepareAtaDocxTabs(source:Buffer):Promise<Buffer>{
 if(!source.length||source.length>16*1024*1024)throw new Error('O DOCX da ata deve ter até 16 MB.');
 const zip=await JSZip.loadAsync(source,{checkCRC32:true});
 const files=Object.values(zip.files).filter(file=>!file.dir);
 if(files.length>1024||files.reduce((size,file)=>size+Number((file as any)._data?.uncompressedSize||0),0)>64*1024*1024)throw new Error('O conteúdo expandido do DOCX da ata ultrapassa o limite seguro.');
 const part=zip.file('word/document.xml');
 if(!part||Number((part as any)._data?.uncompressedSize)>16*1024*1024)throw new Error('O modelo da ata não contém um document.xml válido de até 16 MB.');
 const xml=await part.async('string');
 if(!xml.includes('<w:body'))throw new Error('A estrutura XML do modelo da ata não permite organizar as assinaturas.');
 const pageWidth=Number(xml.match(/<w:pgSz\b[^>]*\bw:w="(\d+)"/)?.[1]||11906);
 if(pageWidth<8000||pageWidth>20000)throw new Error('Confira a largura da página do modelo da ata.');
 const usefulWidth=pageWidth-2*42.52*20;
 const tabs=`<w:tabs><w:tab w:val="center" w:pos="${Math.round(usefulWidth/4)}"/><w:tab w:val="center" w:pos="${Math.round(usefulWidth*3/4)}"/></w:tabs>`;
 const patched=xml.replace(/<w:p\b[^>]*>[\s\S]*?<\/w:p>/g,paragraph=>{
  // Existing tabbed content has its own layout. Never silently reinterpret it.
  if(/<w:tabs\b|<w:tab(?:\s|\/|>)/.test(paragraph))return paragraph;
  if(/<w:pPr\s*\/>/.test(paragraph))return paragraph.replace(/<w:pPr\s*\/>/,`<w:pPr>${tabs}</w:pPr>`);
  if(/<w:pPr\b/.test(paragraph))return paragraph.replace(/<w:pPr\b[^>]*>[\s\S]*?<\/w:pPr>/,properties=>{
   const later=/<w:(?:suppressAutoHyphens|kinsoku|wordWrap|overflowPunct|topLinePunct|autoSpaceDE|autoSpaceDN|bidi|adjustRightInd|snapToGrid|spacing|ind|contextualSpacing|mirrorIndents|suppressOverlap|jc|textDirection|textAlignment|textboxTightWrap|outlineLvl|divId|cnfStyle|rPr|sectPr|pPrChange)\b/;
   const index=properties.search(later);
   return index>=0?properties.slice(0,index)+tabs+properties.slice(index):properties.replace('</w:pPr>',tabs+'</w:pPr>');
  });
  return paragraph.replace(/^(<w:p\b[^>]*>)/,`$1<w:pPr>${tabs}</w:pPr>`);
 });
 zip.file('word/document.xml',patched);
 const copy=await zip.generateAsync({type:'nodebuffer',compression:'DEFLATE'});
 if(copy.length>16*1024*1024)throw new Error('A cópia temporária do DOCX da ata ultrapassa 16 MB.');
 return copy;
}
