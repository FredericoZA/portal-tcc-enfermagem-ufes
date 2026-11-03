/** Restores metadata without replaying provider work or replacing newer evidence. */
export function mergeOperationalMetadata<T extends {id:string;processId?:string;status?:string}>(current:T[], imported:unknown, processIds:Set<string>, terminalStatuses:Set<string>):T[]{
 if(imported!==undefined&&!Array.isArray(imported))throw new Error('Metadados operacionais inválidos no backup.');
 const rows=(imported||[]) as T[];
 if(rows.length>10_000||rows.some(row=>!row||typeof row!=='object'||typeof row.id!=='string'||!row.id))throw new Error('Metadados operacionais inválidos no backup.');
 if(new Set(rows.map(row=>row.id)).size!==rows.length)throw new Error('Metadados operacionais duplicados no backup.');
 const merged=new Map<string,T>();
 for(const row of rows){
  if(current.some(item=>item.id===row.id))continue;
  if(!terminalStatuses.has(String(row.status)))throw new Error('O backup contém operações pendentes desconhecidas. Reconcilie os provedores antes de restaurar.');
  merged.set(row.id,row);
 }
 for(const row of current)merged.set(row.id,row);
 for(const row of merged.values())if(row.processId&&!processIds.has(row.processId))throw new Error('A restauração removeria um TCC com histórico operacional. Preserve esse processo no backup.');
 return structuredClone([...merged.values()]);
}
