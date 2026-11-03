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

/** The opening is body text, not a bold title. Variable markers are emphasized
 * again immediately after this reset, before Google replaces their values. */
export function buildAtaOpeningNormalRequests(document:any):any[]{
 const requests:any[]=[];
 const walk=(node:any,scope:Record<string,string>={})=>{
  if(!node||typeof node!=='object')return;
  if(Array.isArray(node)){node.forEach(value=>walk(value,scope));return;}
  const current=node.tabProperties?.tabId?{...scope,tabId:node.tabProperties.tabId}:scope;
  const runs=node.paragraph?.elements?.filter((element:any)=>typeof element.textRun?.content==='string');
  if(runs?.length&&/^\s*Ata da Sessão de Defesa Final/iu.test(runs.map((run:any)=>run.textRun.content).join(''))){
   const first=runs[0],last=runs[runs.length-1];
   requests.push({updateTextStyle:{range:{...current,startIndex:first.startIndex,endIndex:last.startIndex+last.textRun.content.length},textStyle:{bold:false},fields:'bold'}});
  }
  for(const [key,value]of Object.entries(node))if(!['paragraph','textRun','headers','footers'].includes(key))walk(value,current);
 };
 walk(document);return requests;
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
              baselineOffset: 'NORMAL', foregroundColor: {color: {rgbColor: {red: 0, green: 0, blue: 0}}},
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


/** The declaration's co-advisor role uses the same regular weight as other roles.
 * Complete participant names are emphasized again afterwards. */
export function buildDeclarationCoAdvisorNormalRequests(document:any):any[]{
 const requests:any[]=[];
 const walk=(node:any,scope:Record<string,string>={})=>{
  if(!node||typeof node!=='object')return;
  if(Array.isArray(node)){node.forEach(value=>walk(value,scope));return;}
  const current=node.tabProperties?.tabId?{...scope,tabId:node.tabProperties.tabId}:scope;
  const runs=node.paragraph?.elements?.filter((element:any)=>typeof element.textRun?.content==='string');
  if(runs?.length&&/^\s*Coorientador(?:a)?\s/iu.test(runs.map((run:any)=>run.textRun.content).join(''))){
   const first=runs[0],last=runs[runs.length-1];
   requests.push({updateTextStyle:{range:{...current,startIndex:first.startIndex,endIndex:last.startIndex+last.textRun.content.length},textStyle:{bold:false},fields:'bold'}});
  }
  for(const[key,value]of Object.entries(node))if(!['paragraph','textRun','headers','footers'].includes(key))walk(value,current);
 };
 walk(document);return requests;
}
