/** Replace identified university/course emblems only in a temporary, unsigned Google Doc. */
export function institutionalLogoRequests(document:unknown, crestUrl?:string):Array<Record<string,unknown>> {
  if(!crestUrl||!/^https:\/\//.test(crestUrl))return [];
  const ids=new Map<string,string|undefined>();
  const visit=(value:unknown,tabId?:string)=>{
    if(!value||typeof value!=='object')return;
    if(Array.isArray(value)){value.forEach(item=>visit(item,tabId));return;}
    const object=value as Record<string,any>;
    tabId=object.tabProperties?.tabId||tabId;
    for(const [id,item] of Object.entries(object.inlineObjects||{})){
      const embedded=(item as any)?.inlineObjectProperties?.embeddedObject;
      if(!embedded?.imageProperties)continue;
      const identity=[embedded.title,embedded.description,embedded.imageProperties.sourceUri].filter(Boolean).join(' ');
      if(/\bcolenf\b|colenf[-_]logo|logo[-_ ](?:do[-_ ])?colegiado|ufes[-_]crest|brasão da UFES/iu.test(identity))ids.set(id,tabId||ids.get(id));
    }
    for(const [key,item]of Object.entries(object))if(key!=='inlineObjects')visit(item,tabId);
  };
  visit(document);
  return [...ids].map(([imageObjectId,tabId])=>({replaceImage:{imageObjectId,uri:crestUrl,imageReplaceMethod:'CENTER_CROP',...(tabId?{tabId}:{})}}));
}


/** Keep the institutional letterhead to UFES, CCS and course. The issuing
 * commission belongs in the closing block, not below the course heading. */
export function institutionalHeadingRequests(document:unknown):Array<Record<string,unknown>>{
 const paragraphs:Array<{text:string;start:number;end:number;scope:Record<string,string>}>=[];
 const walk=(node:any,scope:Record<string,string>={})=>{
  if(!node||typeof node!=='object')return;
  if(Array.isArray(node)){node.forEach(item=>walk(item,scope));return;}
  const current=node.tabProperties?.tabId?{...scope,tabId:node.tabProperties.tabId}:scope;
  if(node.paragraph?.elements)paragraphs.push({text:node.paragraph.elements.map((item:any)=>item.textRun?.content||'').join(''),start:node.startIndex,end:node.endIndex,scope:current});
  for(const [key,value]of Object.entries(node)){
   if(['headers','footers'].includes(key))for(const [segmentId,content]of Object.entries(value||{}))walk(content,{...current,segmentId});
   else if(!['paragraph','textRun'].includes(key))walk(value,current);
  }
 };
 walk(document);
 const at=paragraphs.findIndex(row=>/^CURSO DE GRADUAÇÃO EM ENFERMAGEM E OBSTETRÍCIA\s*$/iu.test(row.text.trim()));
 if(at<0)return [];
 const heading=paragraphs[at],extra=[];
 for(const row of paragraphs.slice(at+1)){
  if(JSON.stringify(row.scope)!==JSON.stringify(heading.scope))break;
  if(!row.text.trim())continue;
  if(!/^(?:DEPARTAMENTO DE ENFERMAGEM|COMISSÃO (?:DE |DOS? )?TRABALHOS? DE CONCLUSÃO DE CURSO)\s*$/iu.test(row.text.trim()))break;
  if(Number.isSafeInteger(row.start)&&Number.isSafeInteger(row.end))extra.push(row);
 }
 return extra.sort((a,b)=>b.start-a.start).map(row=>({deleteContentRange:{range:{startIndex:row.start,endIndex:row.end,...row.scope}}}));
}
