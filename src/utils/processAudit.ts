import type {AuditLog} from '../types';

/** Readable differences of server-recorded values. File contents never belong in the history. */
export function auditChanges(log:Pick<AuditLog,'before'|'after'>):string {
 const flatten=(value:unknown,prefix='',out:Record<string,string>={})=>{
  if(value&&typeof value==='object')for(const [key,item] of Object.entries(value)){
   if(/base64|token|secret|password|artifact|contentText|htmlBody/i.test(key))continue;
   flatten(item,prefix?`${prefix}.${key}`:key,out);
  }else out[prefix]=value===undefined?'(ausente)':value===null?'(vazio)':String(value);
  return out;
 };
 const before=flatten(log.before),after=flatten(log.after);
 return [...new Set([...Object.keys(before),...Object.keys(after)])]
  .filter(key=>before[key]!==after[key])
  .map(key=>`${key}: ${before[key]??'(ausente)'} → ${after[key]??'(ausente)'}`).join('\n')||'Evento registrado pelo servidor.';
}

export function sanitizeProcessAudit<T>(value:T):T {
 if(Array.isArray(value))return value.map(sanitizeProcessAudit) as T;
 if(!value||typeof value!=='object')return value;
 return Object.fromEntries(Object.entries(value).filter(([key])=>!/base64|token|secret|password|credential|api[_-]?key|artifact|contentText|htmlBody/i.test(key)).map(([key,item])=>[key,sanitizeProcessAudit(item)])) as T;
}
