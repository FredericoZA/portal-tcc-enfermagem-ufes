type CatalogItem={value:string;type:string;label:string;detail:string};
type StageAction={id:string;type:string;refId?:string;title:string};
/** The stage owns its ordered actions; the catalog is only a lookup for presentation. */
export function workflowStageRows<T extends StageAction>(actions:readonly T[],catalog:readonly CatalogItem[]){
 return actions.map(action=>{
  const item=catalog.find(entry=>entry.type===action.type&&entry.value===`${action.type}:${action.refId}`);
  return {...(item||{value:`existing:${action.id}`,type:action.type,label:action.title,detail:action.type==='action'?'Rotina interna':'Item vinculado'}),action};
 });
}
