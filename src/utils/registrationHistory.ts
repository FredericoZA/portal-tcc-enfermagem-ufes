import type {RegistrationAnswers} from '../types/operationalConfig';
const TTL=7*24*60*60*1000;
const PREFIX='portal-registration-v2:';
export type RegistrationMemory={savedAt:number;answers:RegistrationAnswers;section:number;recent:Record<string,string[]>};
export const identityField=(key:string)=>/^(ALUNO_[12]|ORIENTADOR|COORIENTADOR|EXAMINADOR_[23])_(NOME|EMAIL|MATRICULA|SIAPE|INSTITUICAO)$/.test(key);
export function readRegistrationMemory(storage:Pick<Storage,'getItem'|'removeItem'>,user:string,now=Date.now()):RegistrationMemory|null{
 const key=PREFIX+user.trim().toLowerCase();
 try{const value=JSON.parse(storage.getItem(key)||'null');if(!value||!Number.isFinite(value.savedAt)||now-value.savedAt>TTL||value.savedAt>now||typeof value.answers!=='object'||!value.answers||!value.recent||typeof value.recent!=='object'){storage.removeItem(key);return null;}return {savedAt:value.savedAt,answers:Object.fromEntries(Object.entries(value.answers).filter(([,v])=>typeof v==='string'||typeof v==='boolean')) as RegistrationAnswers,section:Number.isInteger(value.section)&&value.section>=0&&value.section<100?value.section:0,recent:Object.fromEntries(Object.entries(value.recent).filter(([k,v])=>identityField(k)&&Array.isArray(v)).map(([k,v])=>[k,(v as unknown[]).filter((item):item is string=>typeof item==='string'&&item.length<=500).slice(0,20)]))};}catch{return null;}
}
export function saveRegistrationMemory(storage:Pick<Storage,'getItem'|'setItem'|'removeItem'>,user:string,answers:RegistrationAnswers,section:number,now=Date.now(),complete=false):void{
 if(!user)return;
 try{const prior=readRegistrationMemory(storage,user,now);const recent={...prior?.recent};for(const[key,value]of Object.entries(answers)){if(identityField(key)&&typeof value==='string'&&value.trim())recent[key]=Array.from(new Set([value.trim().slice(0,500),...(recent[key]||[])])).slice(0,20);}storage.setItem(PREFIX+user.trim().toLowerCase(),JSON.stringify({savedAt:now,answers:complete?{}:answers,section:complete?0:section,recent}));}catch{/* Storage may be disabled; the form remains usable. */}
}

/** Reuse recent identity values across participant roles without mixing field types. */
export function registrationFieldHistory(recent:Record<string,string[]>,fieldKey:string):string[]{
 const suffix=fieldKey.match(/_(NOME|EMAIL|MATRICULA|SIAPE|INSTITUICAO)$/)?.[1];
 if(!suffix)return [];
 const kind=suffix==='SIAPE'?'MATRICULA':suffix;
 return Array.from(new Set(Object.entries(recent).filter(([key])=>identityField(key)&&(key.endsWith(`_${kind}`)||(kind==='MATRICULA'&&key.endsWith('_SIAPE')))).flatMap(([,values])=>values)));
}
export function matchingRegistrationSuggestions(values:string[],query:string):string[]{
 const normalize=(value:string)=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR').trim();
 const prefix=normalize(query);
 return Array.from(new Set(values)).filter(value=>normalize(value).startsWith(prefix));
}
