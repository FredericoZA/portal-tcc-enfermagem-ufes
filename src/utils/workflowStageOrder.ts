/** Registration starts the process; preserve every stage, action and later relative order. */
export function registrationFirst<T extends {triggerEvent?:unknown;stageNumber?:number}>(stages:T[]):T[]{
 const index=stages.findIndex(stage=>stage.triggerEvent==='TCC_CREATED');
 const ordered=index>0?[stages[index],...stages.slice(0,index),...stages.slice(index+1)]:stages;
 return ordered.map((stage,index)=>({...stage,stageNumber:index+1}));
}

/** Reordering changes presentation order, never the creation boundary. */
export function workflowStageMoveBlockReason(stages:readonly {triggerEvent?:unknown}[],index:number,direction:-1|1):string|undefined {
 if(index<0||index>=stages.length)return 'Selecione uma etapa.';
 const target=index+direction;
 if(target<0)return 'Esta já é a primeira etapa.';
 if(target>=stages.length)return 'Esta já é a última etapa.';
 if((index===0||target===0)&&stages[0].triggerEvent==='TCC_CREATED')return 'O cadastro inicia o processo e permanece como primeira etapa.';
 return undefined;
}
export function moveWorkflowStageOrder<T extends {triggerEvent?:unknown;stageNumber?:number}>(stages:T[],index:number,direction:-1|1):T[]{
 if(workflowStageMoveBlockReason(stages,index,direction))return stages;
 const next=[...stages];[next[index],next[index+direction]]=[next[index+direction],next[index]];
 return next.map((stage,position)=>({...stage,stageNumber:position+1}));
}
