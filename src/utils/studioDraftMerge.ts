/** Three-way rebase: preserve local edits and independent changes saved by another tab. */
export function mergeStudioDraft<T>(base:T,local:T,remote:T):T {
 const same=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
 const merge=(b:any,l:any,r:any,path:string):any=>{
  if(same(l,b))return r;
  if(same(r,b)||same(l,r))return l;
  if(['docTemplates','emailTemplates','formTemplates'].includes(path)&&Array.isArray(b)&&Array.isArray(l)&&Array.isArray(r)){
   const keyed=(items:any[])=>items.every(item=>item&&typeof item.id==='string')&&new Set(items.map(item=>item.id)).size===items.length;
   if(keyed(b)&&keyed(l)&&keyed(r)){
    const ids=(items:any[])=>items.map(item=>item.id);
    const bi=ids(b),li=ids(l),ri=ids(r);
    if(!same(li,bi)&&!same(ri,bi)&&!same(li,ri))throw new Error(`Há alterações simultâneas na ordem de ${path}. Seu rascunho foi preservado; confira este campo antes de salvar.`);
    const order=same(li,bi)?ri:li;
    for(const id of bi.filter((id:string)=>!order.includes(id)))merge(b.find(item=>item.id===id),l.find(item=>item.id===id),r.find(item=>item.id===id),`${path}.${id}`);
    return order.map((id:string)=>merge(b.find(item=>item.id===id),l.find(item=>item.id===id),r.find(item=>item.id===id),`${path}.${id}`)).filter((value:any)=>value!==undefined);
   }
  }
  if(l&&r&&typeof l==='object'&&typeof r==='object'&&!Array.isArray(l)&&!Array.isArray(r)){
   return Object.fromEntries([...new Set([...Object.keys(b||{}),...Object.keys(l),...Object.keys(r)])].map(key=>[key,merge(b?.[key],l[key],r[key],path?`${path}.${key}`:key)]).filter(([,value])=>value!==undefined));
  }
  throw new Error(`Há alterações simultâneas em ${path}. Seu rascunho foi preservado; confira este campo antes de salvar.`);
 };
 const metadata=new Set(['revision','savedAt','savedBy','publication','auditTrail']);
 const b={...base} as any,l={...local} as any,r={...remote} as any;
 for(const key of metadata){delete b[key];delete l[key];delete r[key];}
 return {...remote,...merge(b,l,r,'')} as T;
}
