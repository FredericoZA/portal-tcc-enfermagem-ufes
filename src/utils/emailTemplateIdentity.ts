/** IDs identify templates; equal names alone never justify removing a user template. */
export function uniqueEmailTemplates<T extends {id?:unknown}>(templates:T[]):T[]{
 const seen=new Set<string>();
 return templates.filter(template=>{
  const id=String(template.id||'');if(!id)return true;
  if(seen.has(id))return false;seen.add(id);return true;
 });
}

/** Display the standard messages in the requested order; keep custom messages stable. */
export function orderEmailTemplates<T extends {id?: unknown}>(templates: T[]): T[] {
 const ids = ['email-reserva', 'email-confirmacao', 'email-convite', 'email-conclusao', 'email-entrega-repositorio'];
 const rank = (template: T) => { const index = ids.indexOf(String(template.id)); return index < 0 ? ids.length : index; };
 return [...templates].sort((left, right) => rank(left) - rank(right));
}
