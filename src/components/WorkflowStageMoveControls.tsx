import React from 'react';
import {ChevronLeft,ChevronRight} from 'lucide-react';
import {workflowStageMoveBlockReason} from '../utils/workflowStageOrder';
export function WorkflowStageMoveControls({stages,index,onMove}:{stages:readonly {triggerEvent?:unknown}[];index:number;onMove:(direction:-1|1)=>void}){
 const initial=index===0&&stages[0]?.triggerEvent==='TCC_CREATED';
 if(initial)return <span className="rounded-lg border border-[var(--portal-border)] bg-white px-3 py-2 text-[10px] font-semibold text-slate-600" title="O cadastro inicia o processo e permanece como primeira etapa.">Etapa inicial fixa</span>;
 return <div className="flex items-center gap-1.5" role="group" aria-label="Reordenar etapa">{([-1,1] as const).map(direction=>{
  const reason=workflowStageMoveBlockReason(stages,index,direction);
  const label=direction===-1?'Mover etapa para a esquerda':'Mover etapa para a direita';
  const Icon=direction===-1?ChevronLeft:ChevronRight;
  return <span key={direction} title={reason||label}><button type="button" disabled={Boolean(reason)} onClick={()=>onMove(direction)} aria-label={reason?`${label}: ${reason}`:label} className="portal-toolbar-icon-button disabled:opacity-30"><Icon className="h-3.5 w-3.5"/></button></span>;
 })}</div>;
}
