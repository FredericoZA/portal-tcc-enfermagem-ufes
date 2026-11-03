/** Only the main body is editable; institutional headers, footers and their images stay intact. */
export function documentMainBody(document:any):{text:string;startIndex:number;endIndex:number;tabId?:string}|null{
 const tabs:any[]=[];
 const walk=(items:any[])=>{for(const tab of items||[]){if(tab.documentTab?.body||tab.body)tabs.push({body:tab.documentTab?.body||tab.body,tabId:tab.tabProperties?.tabId||tab.tabId});walk(tab.childTabs);}};
 walk(document.tabs);
 const target=tabs[0]||(document.body?{body:document.body}:null);
 if(!target)return null;
 const content=target.body.content||[],paragraphs=content.filter((item:any)=>item.paragraph);
 if(!paragraphs.length)return null;
 // Preserve structured tables rather than flattening them through a text editor.
 if(content.some((item:any)=>item.table))return null;
 const text=paragraphs.map((item:any)=>(item.paragraph.elements||[]).map((element:any)=>element.textRun?.content||'').join('')).join('').replace(/\u000b/g,'\n');
 return {text:text.trimEnd(),startIndex:paragraphs[0].startIndex||1,endIndex:Math.max(...content.map((item:any)=>item.endIndex||0))-1,tabId:target.tabId};
}
/** Keep unchanged paragraphs/runs in place instead of rebuilding the whole ata. */
function changedRanges(before:string,after:string):Array<{start:number;end:number;text:string}>{
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
 if(oldLines.length>500||newLines.length>500){add(before,after,0);return patches;}
 const scores=Array.from({length:oldLines.length+1},()=>new Uint16Array(newLines.length+1));
 for(let i=oldLines.length-1;i>=0;i--)for(let j=newLines.length-1;j>=0;j--)scores[i][j]=oldLines[i]===newLines[j]?scores[i+1][j+1]+1:Math.max(scores[i+1][j],scores[i][j+1]);
 let i=0,j=0,offset=0;
 while(i<oldLines.length||j<newLines.length){
  if(i<oldLines.length&&j<newLines.length&&oldLines[i]===newLines[j]){offset+=oldLines[i++].length;j++;continue;}
  const start=offset,removed:string[]=[],inserted:string[]=[];
  while(i<oldLines.length||j<newLines.length){
   if(i<oldLines.length&&j<newLines.length&&oldLines[i]===newLines[j])break;
   if(i<oldLines.length&&(j===newLines.length||scores[i+1][j]>=scores[i][j+1])){removed.push(oldLines[i]);offset+=oldLines[i++].length;}
   else inserted.push(newLines[j++]);
  }
  if(removed.length===inserted.length){let at=start;for(let k=0;k<removed.length;k++){add(removed[k],inserted[k],at);at+=removed[k].length;}}
  else add(removed.join(''),inserted.join(''),start);
 }
 return patches;
}
export function bodyEditRequests(document:any,text:string):any[]{
 const body=documentMainBody(document);if(!body)throw new Error('Este modelo contém estrutura que exige edição do DOCX pelo Master.');
 const scope=body.tabId?{tabId:body.tabId}:{},clean=text.replace(/\r\n?/g,'\n').trimEnd();
 return changedRanges(body.text,clean).sort((a,b)=>b.start-a.start).flatMap(patch=>[
  ...(patch.end>patch.start?[{deleteContentRange:{range:{startIndex:body.startIndex+patch.start,endIndex:body.startIndex+patch.end,...scope}}}]:[]),
  ...(patch.text?[{insertText:{location:{index:body.startIndex+patch.start,...scope},text:patch.text}}]:[])
 ]);
}
