/** Registration starts the process; preserve every stage, action and later relative order. */
export function registrationFirst<T extends {triggerEvent?:unknown;stageNumber?:number}>(stages:T[]):T[]{
 const index=stages.findIndex(stage=>stage.triggerEvent==='TCC_CREATED');
 const ordered=index>0?[stages[index],...stages.slice(0,index),...stages.slice(index+1)]:stages;
 return ordered.map((stage,index)=>({...stage,stageNumber:index+1}));
}
