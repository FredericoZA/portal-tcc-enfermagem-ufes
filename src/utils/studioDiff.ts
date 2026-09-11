import type { IntegrationStudioSettings } from '../types/integrationStudio';
export interface StudioChange { area:string; key:string; change:'ADDED'|'REMOVED'|'CHANGED'; detail:string; impactsActiveProcesses:boolean }
function flatten(studio:Partial<IntegrationStudioSettings>){
  const entries=new Map<string,{area:string;value:unknown}>();
  for(const [property,area] of [['docTemplates','Modelos'],['emailTemplates','E-mails'],['workflowStages','Etapas'],['formTemplates','Formulários']] as const){
    for(const item of studio[property]||[]){const {lastUpdated,savedAt,...value}=item as any;entries.set(`${property}.${value.id}`,{area,value});}
  }
  for(const [key,value] of Object.entries(studio.operationalConfig||{}))entries.set(`operationalConfig.${key}`,{area:'Regras operacionais',value});
  entries.set('brandKit',{area:'Aparência',value:studio.brandKit});return entries;
}
const stable=(value:unknown):string=>JSON.stringify(value,(_,entry)=>entry&&typeof entry==='object'&&!Array.isArray(entry)?Object.fromEntries(Object.entries(entry).sort(([a],[b])=>a.localeCompare(b))):entry);
export function compareStudioVersions(before:Partial<IntegrationStudioSettings>,after:Partial<IntegrationStudioSettings>):StudioChange[]{
  const a=flatten(before),b=flatten(after),changes:StudioChange[]=[];
  for(const key of new Set([...a.keys(),...b.keys()])){const old=a.get(key),next=b.get(key);if(stable(old?.value)===stable(next?.value))continue;
    const change=!old?'ADDED':!next?'REMOVED':'CHANGED';const fields=change==='CHANGED'?Object.keys({...old?.value as any,...next?.value as any}).filter(field=>stable((old!.value as any)?.[field])!==stable((next!.value as any)?.[field])).join(', '):'';
    changes.push({area:next?.area||old!.area,key,change,detail:fields?`Campos alterados: ${fields}`:change==='ADDED'?'Incluído no rascunho':'Removido no rascunho',impactsActiveProcesses:(next?.area||old?.area)!=='Aparência'});
  }return changes;
}
