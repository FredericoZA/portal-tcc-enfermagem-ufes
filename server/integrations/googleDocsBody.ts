/** Only the main body is editable; institutional headers, footers and their images stay intact. */
export function documentMainBody(document:any){
 const tabs:any[]=[];
 const walk=(items:any[])=>{for(const tab of items||[]){if(tab.documentTab?.body||tab.body)tabs.push({body:tab.documentTab?.body||tab.body,tabId:tab.tabProperties?.tabId||tab.tabId});walk(tab.childTabs);}};
 walk(document.tabs);
 const target=tabs[0]||(document.body?{body:document.body}:null);
 if(!target)return null;
 const content=target.body.content||[],paragraphs=content.filter((item:any)=>item.paragraph);
 if(!paragraphs.length)return null;
 // Preserve structured tables rather than flattening them through a text editor.
 if(content.some((item:any)=>item.table)||paragraphs.some((item:any)=>(item.paragraph.elements||[]).some((element:any)=>!element.textRun)))return null;
 const text=paragraphs.map((item:any)=>(item.paragraph.elements||[]).map((element:any)=>element.textRun?.content||'').join('')).join('').replace(/\u000b/g,'\n');
 const layout = paragraphs.map((item:any) => ({
  alignment: item.paragraph.paragraphStyle?.alignment as 'START'|'CENTER'|'END'|'JUSTIFIED'|undefined,
  tabStops: (item.paragraph.paragraphStyle?.tabStops||[]).map((tab:any)=>({offset:Number(tab.offset?.magnitude)||0,alignment:tab.alignment as 'START'|'CENTER'|'END'|undefined})) as Array<{offset:number;alignment?:'START'|'CENTER'|'END'}>,
  runs: (item.paragraph.elements||[]).map((element:any) => ({
   text: String(element.textRun.content||'').replace(/\u000b/g,'\n'),
   bold: Boolean(element.textRun.textStyle?.bold),
   italic: Boolean(element.textRun.textStyle?.italic),
   underline: Boolean(element.textRun.textStyle?.underline),
   size: Number(element.textRun.textStyle?.fontSize?.magnitude)||undefined,
   font: element.textRun.textStyle?.weightedFontFamily?.fontFamily as string|undefined,
  })) as Array<{text:string;bold:boolean;italic:boolean;underline:boolean;size?:number;font?:string}>,
 }));
 const styles=paragraphs.flatMap((item:any)=>(item.paragraph.elements||[]).map((element:any)=>
  element.textRun.textStyle as Record<string,unknown>|undefined,
 )) as Array<Record<string,unknown>|undefined>;
 return {layout,styles,text:text.trimEnd(),startIndex:paragraphs[0].startIndex||1,endIndex:Math.max(...content.map((item:any)=>item.endIndex||0))-1,tabId:target.tabId};
}
/** Keep unchanged paragraphs/runs in place instead of rebuilding the whole ata. */
function changedRanges(before:string,after:string,preserveRuns:boolean):Array<{start:number;end:number;text:string}>{
 const oldLines=before.match(/[^\n]*\n|[^\n]+$/g)||[],newLines=after.match(/[^\n]*\n|[^\n]+$/g)||[];
 const patches:Array<{start:number;end:number;text:string}>=[];
 const add=(oldText:string,newText:string,offset:number)=>{
  if(oldText===newText)return;
  let prefix=0,suffix=0;
  while(prefix<oldText.length&&prefix<newText.length&&oldText[prefix]===newText[prefix])prefix++;
  while(suffix<oldText.length-prefix&&suffix<newText.length-prefix&&oldText[oldText.length-1-suffix]===newText[newText.length-1-suffix])suffix++;
  if(prefix&&/[\uD800-\uDBFF]/.test(oldText[prefix-1]))prefix--;
  if(suffix&&/[\uDC00-\uDFFF]/.test(oldText[oldText.length-suffix]))suffix--;
  patches.push({start:offset+prefix,end:offset+oldText.length-suffix,text:newText.slice(prefix,newText.length-suffix)});
 };
 const reviseLine=(oldText:string,newText:string,offset:number)=>{
  if(oldText===newText)return;
  const words=/[\p{L}\p{M}\p{N}]+|[^\p{L}\p{M}\p{N}]/gu;
  const previous=oldText.match(words)||[],next=newText.match(words)||[];
  if(!preserveRuns||previous.length*next.length>160_000){add(oldText,newText,offset);return;}
  alignChanges(previous,next,(removed,inserted,start)=>add(removed.join(''),inserted.join(''),offset+start));
 };
 if(oldLines.length>500||newLines.length>500){add(before,after,0);return patches;}
 alignChanges(oldLines,newLines,(removed,inserted,start)=>{
  if(removed.length!==inserted.length){add(removed.join(''),inserted.join(''),start);return;}
  let offset=start;
  for(let index=0;index<removed.length;index++){
   reviseLine(removed[index],inserted[index],offset);
   offset+=removed[index].length;
  }
 });
 return patches;
}
function alignChanges(before:string[],after:string[],changed:(removed:string[],inserted:string[],offset:number)=>void){
 const scores=Array.from({length:before.length+1},()=>new Uint16Array(after.length+1));
 for(let i=before.length-1;i>=0;i--)for(let j=after.length-1;j>=0;j--)scores[i][j]=before[i]===after[j]?scores[i+1][j+1]+1:Math.max(scores[i+1][j],scores[i][j+1]);
 let i=0,j=0,offset=0;
 while(i<before.length||j<after.length){
  if(i<before.length&&j<after.length&&before[i]===after[j]){offset+=before[i++].length;j++;continue;}
  const start=offset,removed:string[]=[],inserted:string[]=[];
  while(i<before.length||j<after.length){
   if(i<before.length&&j<after.length&&before[i]===after[j])break;
   if(i<before.length&&(j===after.length||scores[i+1][j]>=scores[i][j+1])){removed.push(before[i]);offset+=before[i++].length;}
   else inserted.push(after[j++]);
  }
  changed(removed,inserted,start);
 }
}
export function bodyEditRequests(document:any,text:string):any[]{
 const body=documentMainBody(document);if(!body)throw new Error('Este modelo contém estrutura que exige edição do DOCX pelo Master.');
 const scope=body.tabId?{tabId:body.tabId}:{},clean=text.replace(/\r\n?/g,'\n').trimEnd();
 let offset=0,styleIndex=0;
 const styledRuns=body.layout.flatMap(paragraph=>paragraph.runs.map(run=>{
  const start=offset;offset+=run.text.length;
  return {...run,start,end:offset,style:body.styles[styleIndex++]};
 }));
 return changedRanges(body.text,clean,styledRuns.some(run=>run.style&&Object.keys(run.style).length)).sort((a,b)=>b.start-a.start).flatMap(patch=>{
  const run=styledRuns.find(run=>patch.start>=run.start&&patch.start<run.end&&patch.end<=run.end);
  const fields=run?.style?Object.keys(run.style):[];
  return [
  ...(patch.end>patch.start?[{deleteContentRange:{range:{startIndex:body.startIndex+patch.start,endIndex:body.startIndex+patch.end,...scope}}}]:[]),
  ...(patch.text?[{insertText:{location:{index:body.startIndex+patch.start,...scope},text:patch.text}}]:[]),
  ...(patch.text&&fields.length&&!patch.text.includes('\n')?[{updateTextStyle:{range:{startIndex:body.startIndex+patch.start,endIndex:body.startIndex+patch.start+patch.text.length,...scope},textStyle:run?.style,fields:fields.join(',')}}]:[])
  ];
 });
}
