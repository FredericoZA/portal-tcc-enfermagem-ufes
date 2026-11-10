/** Locate markers in paragraph text, including markers split across styled runs.
 * Style the marker before replacement so Docs retains its character formatting.
 */
export function buildMarkerBoldRequests(document: any, markers: string[]): any[] {
  const requests: any[] = [];
  const walk = (node: any, scope: { tabId?: string; segmentId?: string } = {}) => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) { node.forEach(item => walk(item, scope)); return; }
    const current = node.tabProperties?.tabId ? { ...scope, tabId: node.tabProperties.tabId } : scope;
    if (node.paragraph?.elements) {
      const runs = node.paragraph.elements.filter((e: any) => typeof e.textRun?.content === 'string');
      const text = runs.map((e: any) => e.textRun.content).join('');
      const positions: number[] = runs.flatMap((e: any) => Array.from({ length: e.textRun.content.length }, (_, i) => e.startIndex + i));
      for (const marker of markers) {
        const escaped = marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`<<${escaped}>>|\\{\\{${escaped}\\}\\}|\\[\\[${escaped}\\]\\]|«${escaped}»|-${escaped}-`, 'gi');
        for (const match of text.matchAll(regex)) {
          const start = match.index!, end = start + match[0].length;
          if (positions[start] === undefined || positions[end - 1] === undefined) continue;
          requests.push({ updateTextStyle: { range: { ...current, startIndex: positions[start], endIndex: positions[end - 1] + 1 }, textStyle: { bold: true, underline: false }, fields: 'bold,underline' } });
        }
      }
    }
    for (const [key, value] of Object.entries(node)) {
      if (key === 'headers' || key === 'footers') for (const [segmentId, content] of Object.entries(value || {})) walk(content, { ...current, segmentId });
      else if (!['paragraph', 'textRun'].includes(key)) walk(value, current);
    }
  };
  walk(document);
  return requests;
}

/** Emphasize rendered result and opinion, even if they inherited underlining. */
export function buildValueBoldRequests(document:any,values:string[]):any[]{
 const requests:any[]=[];
 const walk=(node:any,scope:Record<string,string>={})=>{
  if(!node||typeof node!=='object')return;if(Array.isArray(node)){node.forEach(n=>walk(n,scope));return;}
  const current=node.tabProperties?.tabId?{...scope,tabId:node.tabProperties.tabId}:scope;
  if(node.paragraph?.elements){const runs=node.paragraph.elements.filter((e:any)=>typeof e.textRun?.content==='string'),text=runs.map((e:any)=>e.textRun.content).join('');const positions:number[]=runs.flatMap((e:any)=>Array.from({length:e.textRun.content.length},(_,i)=>e.startIndex+i));
   for(const value of [...new Set(values.flatMap(value=>value.split(/\r?\n/)).filter(value=>value.trim()))]){let from=0;while(from<text.length){const start=text.indexOf(value,from);if(start<0)break;const end=start+value.length;from=end;if(positions[start]!==undefined&&positions[end-1]!==undefined)requests.push({updateTextStyle:{range:{...current,startIndex:positions[start],endIndex:positions[end-1]+1},textStyle:{bold:true,underline:false},fields:'bold,underline'}});}}
  }
  for(const [key,value]of Object.entries(node)){if(['headers','footers'].includes(key))for(const[segmentId,content]of Object.entries(value||{}))walk(content,{...current,segmentId});else if(!['paragraph','textRun'].includes(key))walk(value,current);}
 };walk(document);return requests;
}

/** The opening paragraph is the title: emphasize every run, including names. */
export function buildAtaOpeningTitleRequests(document:any):any[]{
 const requests:any[]=[];
 const walk=(node:any,scope:Record<string,string>={})=>{
  if(!node||typeof node!=='object')return;
  if(Array.isArray(node)){node.forEach(value=>walk(value,scope));return;}
  const current=node.tabProperties?.tabId?{...scope,tabId:node.tabProperties.tabId}:scope;
  const runs=node.paragraph?.elements?.filter((element:any)=>typeof element.textRun?.content==='string');
  if(runs?.length&&/^\s*Ata da Sessão de Defesa Final/iu.test(runs.map((run:any)=>run.textRun.content).join(''))){
   const first=runs[0],last=runs[runs.length-1];
   requests.push({updateTextStyle:{range:{...current,startIndex:first.startIndex,endIndex:last.startIndex+last.textRun.content.length},textStyle:{bold:true},fields:'bold'}});
  }
  for(const [key,value]of Object.entries(node))if(!['paragraph','textRun','headers','footers'].includes(key))walk(value,current);
 };
 walk(document);return requests;
}

/** Apply regular weight only to the narrative, from the opening time to the closing. */
export function buildAtaNarrativeStyleRequests(document:any):any[]{
 const requests:any[]=[];
 const styleBody=(body:any,tabId?:string)=>{
  const runs=(body?.content||[]).flatMap((item:any)=>item.paragraph?.elements||[])
   .filter((run:any)=>typeof run.textRun?.content==='string'&&Number.isInteger(run.startIndex));
  const text=runs.map((run:any)=>run.textRun.content).join('');
  const opening=/(?:^|[.\r\n\u000b])\s*(?=às\s)/iu.exec(text);
  if(!opening)return;
  const start=opening.index+opening[0].length;
  const closing=/Nada mais havendo a tratar,[\s\S]*?que (?:segue para ser assinada|será assinada(?: por quem de direito)?)\.?/iu.exec(text.slice(start));
  if(!closing)return;
  const end=start+closing.index+closing[0].length;
  let offset=0;
  for(const run of runs){
   const runEnd=offset+run.textRun.content.length;
   const from=Math.max(start,offset),to=Math.min(end,runEnd);
   if(from<to)requests.push({updateTextStyle:{
    range:{startIndex:run.startIndex+from-offset,endIndex:run.startIndex+to-offset,...(tabId?{tabId}:{})},
    textStyle:{bold:false,italic:false},fields:'bold,italic'
   }});
   offset=runEnd;
  }
 };
 const visitTabs=(tabs:any[])=>{
  for(const tab of tabs||[]){
   styleBody(tab.documentTab?.body||tab.body,tab.tabProperties?.tabId);
   visitTabs(tab.childTabs);
  }
 };
 if(document.tabs?.length)visitTabs(document.tabs);
 else styleBody(document.body);
 return requests;
}

/** Clear inherited bold in the authorization text, keeping the title and signatures. */
export function buildAuthorizationBodyStyleRequests(document: any): any[] {
  const requests: any[] = [];
  const styleBody = (body: any, tabId?: string) => {
    for (const entry of body?.content || []) {
      const runs = (entry.paragraph?.elements || []).filter((run: any) =>
        typeof run.textRun?.content === 'string' && Number.isInteger(run.startIndex));
      const text = runs.map((run: any) => run.textRun.content).join('').trim();
      if (!/^(?:Nós,|Eu,|[☒☐]|A autorização se limita\b|Vitória\s*[-–—]\s*ES,)/iu.test(text)) continue;
      for (const run of runs) {
        const length = run.textRun.content.trimEnd().length;
        if (!length) continue;
        requests.push({updateTextStyle: {
          range: {startIndex: run.startIndex, endIndex: run.startIndex + length, ...(tabId ? {tabId} : {})},
          textStyle: {bold: false}, fields: 'bold',
        }});
      }
    }
  };
  const visitTabs = (tabs: any[]) => {
    for (const tab of tabs) {
      styleBody(tab.documentTab?.body || tab.body, tab.tabProperties?.tabId);
      visitTabs(tab.childTabs || []);
    }
  };
  if (document.tabs?.length) visitTabs(document.tabs);
  else styleBody(document.body);
  return requests;
}

/** Make independent publication choices legible without changing their values. */
export function buildAuthorizationChoiceStyleRequests(document: any): any[] {
  const requests: any[] = [];
  const walk = (node: any, scope: Record<string, string> = {}) => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) { node.forEach(value => walk(value, scope)); return; }
    const current = node.tabProperties?.tabId ? {...scope, tabId: node.tabProperties.tabId} : scope;
    if (node.paragraph?.elements) {
      const runs = node.paragraph.elements.filter((run: any) => typeof run.textRun?.content === 'string');
      for (const run of runs) {
        for (const match of run.textRun.content.matchAll(/[☒☐]/gu)) {
          const range = {...current, startIndex: run.startIndex + match.index, endIndex: run.startIndex + match.index + 1};
          requests.push({updateTextStyle: {
            range, textStyle: {
              fontSize: {magnitude: 20, unit: 'PT'}, bold: match[0] === '☒', underline: false,
              baselineOffset: 'NONE', foregroundColor: {color: {rgbColor: {red: 0, green: 0, blue: 0}}},
            }, fields: 'fontSize,bold,underline,baselineOffset,foregroundColor',
          }});
          requests.push({updateParagraphStyle: {
            range, paragraphStyle: {spaceAbove: {magnitude: 6, unit: 'PT'}, spaceBelow: {magnitude: 4, unit: 'PT'}, lineSpacing: 115},
            fields: 'spaceAbove,spaceBelow,lineSpacing',
          }});
        }
      }
    }
    for (const [key, value] of Object.entries(node)) {
      if (key === 'headers' || key === 'footers') {
        for (const [segmentId, content] of Object.entries(value || {})) walk(content, {...current, segmentId});
      } else if (!['paragraph', 'textRun'].includes(key)) walk(value, current);
    }
  };
  walk(document);
  return requests;
}


/** Keep the declaration prose, board listing and date in regular weight. */
export function buildDeclarationBodyNormalRequests(document:any):any[]{
 return buildCoadvisorNormalRequests(document,/^\s*(?:Declaro\b|Orienta(?:dor|dora|ção)\s*(?::|\s)|Examinador(?:a)?\s*(?::|\s)|Coorientador(?:a)?\s*(?::|\s)|Vitória\s*[-–—,])/iu);
}

export function buildAtaCoadvisorRoleNormalRequests(document:any):any[]{
 return buildCoadvisorNormalRequests(document,/^\s*Coorientador(?:a)?\s*$/iu);
}

function buildCoadvisorNormalRequests(document:any, role:RegExp):any[]{
 const requests:any[]=[];
 const walk=(node:any,scope:Record<string,string>={})=>{
  if(!node||typeof node!=='object')return;
  if(Array.isArray(node)){node.forEach(value=>walk(value,scope));return;}
  const current=node.tabProperties?.tabId?{...scope,tabId:node.tabProperties.tabId}:scope;
  const runs=node.paragraph?.elements?.filter((element:any)=>typeof element.textRun?.content==='string');
  if(runs?.length&&role.test(runs.map((run:any)=>run.textRun.content).join(''))){
   const first=runs[0],last=runs[runs.length-1];
   requests.push({updateTextStyle:{range:{...current,startIndex:first.startIndex,endIndex:last.startIndex+last.textRun.content.length},textStyle:{bold:false},fields:'bold'}});
  }
  for(const[key,value]of Object.entries(node))if(!['paragraph','textRun','headers','footers'].includes(key))walk(value,current);
 };
 walk(document);return requests;
}
