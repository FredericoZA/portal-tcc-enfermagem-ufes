import React from 'react';
import {Plus} from 'lucide-react';
export interface WorkflowStageSummary{id:string;title:string;actions:readonly unknown[]}
export function WorkflowStageOverview({stages,selectedId,onSelect,onAdd}:{stages:readonly WorkflowStageSummary[];selectedId?:string;onSelect:(id:string)=>void;onAdd:()=>void}){
 return <section className="portal-workflow-overview rounded-xl border border-[var(--portal-border)] bg-[var(--portal-surface-panel)] p-3" aria-labelledby="workflow-timeline-title">
  <div className="mb-3 flex items-center justify-between gap-3"><h4 id="workflow-timeline-title" className="text-xs font-bold text-slate-800">Etapas do processo</h4><span className="text-[10px] font-semibold text-slate-600">{stages.length} etapas · {stages.reduce((total,stage)=>total+stage.actions.length,0)} atividades</span></div>
  <div className="portal-workflow-sequence">{stages.map((stage,index)=><button key={stage.id} type="button" onClick={()=>onSelect(stage.id)} aria-pressed={stage.id===selectedId} className="portal-workflow-step portal-workflow-overview-step border border-slate-300 bg-white text-center" title={stage.title}>
   <span className="portal-workflow-overview-number">{index+1}</span><span className="portal-workflow-overview-title">{stage.title}</span><span className="portal-workflow-overview-count">{stage.actions.length===1?'1 atividade':`${stage.actions.length} atividades`}</span>
  </button>)}<button type="button" onClick={onAdd} className="portal-workflow-step portal-workflow-add flex flex-col items-center justify-center gap-2 border border-dashed border-slate-400 bg-white text-[10px] font-semibold" aria-label="Adicionar etapa"><Plus className="h-5 w-5"/><span>Adicionar</span></button></div>
 </section>;
}
