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
      if(/\bcolenf\b|colenf[-_]logo|logo[-_ ](?:do[-_ ])?colegiado|ufes[-_]crest|brasão da UFES|national[-_ ]arms|armas nacionais|bras[aã]o (?:de |das? )?armas/iu.test(identity))ids.set(id,tabId||ids.get(id));
    }
    for(const [key,item]of Object.entries(object))if(key!=='inlineObjects')visit(item,tabId);
  };
  visit(document);
  const requests:Array<Record<string,unknown>>=[...ids].map(([imageObjectId,tabId])=>({replaceImage:{imageObjectId,uri:crestUrl,imageReplaceMethod:'CENTER_CROP',...(tabId?{tabId}:{})}}));
  if(crestUrl.endsWith('/national-arms.png')){
    const paragraphs=documentParagraphs(document);
    for(const row of paragraphs){
      if(row.footer||row.text.trim()||!row.elements.some(item=>ids.has(item.inlineObjectElement?.inlineObjectId)))continue;
      const following=paragraphs.filter(item=>scopeKey(item.scope)===scopeKey(row.scope)&&item.start>row.start);
      const heading=following.find(item=>item.text.trim());
      if(heading&&institutionalHeading(heading.text))requests.push(centeredParagraph(row));
    }
  }
  return requests;
}

type DocumentParagraph={text:string;start:number;end:number;scope:Record<string,string>;elements:Array<Record<string,any>>;footer:boolean};
const scopeKey=(scope:Record<string,string>)=>JSON.stringify(scope);
const institutionalHeading=(text:string)=>/^(?:UNIVERSIDADE FEDERAL DO ESPÍRITO SANTO|CENTRO DE CIÊNCIAS DA SAÚDE|CURSO DE GRADUAÇÃO EM ENFERMAGEM E OBSTETRÍCIA)$/iu.test(text.trim());
function centeredParagraph(row:DocumentParagraph):Record<string,unknown>{
 return {updateParagraphStyle:{range:{startIndex:row.start,endIndex:row.end,...row.scope},paragraphStyle:{alignment:'CENTER',indentStart:{magnitude:0,unit:'PT'},indentEnd:{magnitude:0,unit:'PT'},indentFirstLine:{magnitude:0,unit:'PT'}},fields:'alignment,indentStart,indentEnd,indentFirstLine'}};
}
function documentParagraphs(document:unknown):DocumentParagraph[]{
 const paragraphs:DocumentParagraph[]=[];
 const seen=new Set<string>();
 const hasTabContent=(tabs:any[]):boolean=>tabs.some(tab=>tab.documentTab?.body||tab.documentTab?.headers||tab.documentTab?.footers||hasTabContent(tab.childTabs||[]));
 const walk=(node:any,scope:Record<string,string>={},footer=false)=>{
  if(!node||typeof node!=='object')return;
  if(Array.isArray(node)){node.forEach(item=>walk(item,scope,footer));return;}
  const current=node.tabProperties?.tabId?{...scope,tabId:node.tabProperties.tabId}:scope;
  if(node.paragraph?.elements&&Number.isSafeInteger(node.startIndex)&&Number.isSafeInteger(node.endIndex)&&node.endIndex>node.startIndex){
   const text=node.paragraph.elements.map((item:any)=>item.textRun?.content||'').join('');
   const key=`${scopeKey(current)}:${node.startIndex}:${node.endIndex}`;
   if(!seen.has(key)){seen.add(key);paragraphs.push({text,start:node.startIndex,end:node.endIndex,scope:current,elements:node.paragraph.elements,footer});}
  }
  const tabContent=Array.isArray(node.tabs)&&hasTabContent(node.tabs);
  for(const [key,value]of Object.entries(node)){
   if(tabContent&&['body','headers','footers'].includes(key))continue;
   if(['headers','footers'].includes(key))for(const [segmentId,content]of Object.entries(value||{}))walk(content,{...current,segmentId},key==='footers');
   else if(!['paragraph','textRun'].includes(key))walk(value,current,footer);
  }
 };
 walk(document);
 return paragraphs;
}
function uppercaseParagraph(row:DocumentParagraph):Array<Record<string,unknown>>{
 const requests:Array<Record<string,unknown>>=[];
 const styles=new Set(['backgroundColor','baselineOffset','bold','fontSize','foregroundColor','italic','link','smallCaps','strikethrough','underline','weightedFontFamily']);
 let cursor=row.start;
 const runs:Array<{start:number;text:string;style:Record<string,unknown>}>=[];
 for(const element of row.elements){
  const content=String(element.textRun?.content||''),start=Number.isSafeInteger(element.startIndex)?element.startIndex:cursor;
  const text=content.replace(/\n$/u,'');
  if(text&&text!==text.toLocaleUpperCase('pt-BR'))runs.push({start,text,style:Object.fromEntries(Object.entries(element.textRun?.textStyle||{}).filter(([key])=>styles.has(key)))});
  cursor=start+(content.length||(element.inlineObjectElement?1:0));
 }
 for(const run of runs.sort((a,b)=>b.start-a.start)){
  const range={startIndex:run.start,endIndex:run.start+run.text.length,...row.scope};
  requests.push({deleteContentRange:{range}},{insertText:{location:{index:run.start,...row.scope},text:run.text.toLocaleUpperCase('pt-BR')}});
  if(Object.keys(run.style).length)requests.push({updateTextStyle:{range,textStyle:run.style,fields:Object.keys(run.style).join(',')}});
 }
 return requests;
}

/** Keep the institutional letterhead to UFES, CCS and course. The issuing
 * commission belongs in the closing block, not below the course heading. */
export function institutionalHeadingRequests(document:unknown):Array<Record<string,unknown>>{
 const paragraphs=documentParagraphs(document),requests:Array<Record<string,unknown>>=[];
 for(const key of new Set(paragraphs.filter(row=>!row.footer).map(row=>scopeKey(row.scope)))){
  const rows=paragraphs.filter(row=>!row.footer&&scopeKey(row.scope)===key);
  const at=rows.findIndex(row=>/^CURSO DE GRADUAÇÃO EM ENFERMAGEM E OBSTETRÍCIA$/iu.test(row.text.trim()));
  if(at<0)continue;
  const headings=[rows[at]],extra:DocumentParagraph[]=[];
  for(let i=at-1;i>=0;i--){if(!rows[i].text.trim())continue;if(!institutionalHeading(rows[i].text))break;headings.push(rows[i]);}
  for(const row of rows.slice(at+1)){
   if(!row.text.trim())continue;
   if(!/^(?:DEPARTAMENTO DE ENFERMAGEM|COMISSÃO (?:DE |DOS? )?TRABALHOS? DE CONCLUSÃO DE CURSO)$/iu.test(row.text.trim()))break;
   extra.push(row);
  }
  requests.push(...extra.sort((a,b)=>b.start-a.start).map(row=>({deleteContentRange:{range:{startIndex:row.start,endIndex:row.end,...row.scope}}})));
  for(const row of headings.sort((a,b)=>b.start-a.start))requests.push(centeredParagraph(row),...uppercaseParagraph(row));
 }
 return requests;
}
