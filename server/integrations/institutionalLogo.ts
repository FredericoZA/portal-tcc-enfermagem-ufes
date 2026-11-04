/** Replace identified course emblems only in a temporary, unsigned Google Doc. */
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
      if(/\bcolenf\b|colenf[-_]logo|logo[-_ ](?:do[-_ ])?colegiado/iu.test(identity))ids.set(id,tabId||ids.get(id));
    }
    for(const [key,item]of Object.entries(object))if(key!=='inlineObjects')visit(item,tabId);
  };
  visit(document);
  return [...ids].map(([imageObjectId,tabId])=>({replaceImage:{imageObjectId,uri:crestUrl,imageReplaceMethod:'CENTER_CROP',...(tabId?{tabId}:{})}}));
}
