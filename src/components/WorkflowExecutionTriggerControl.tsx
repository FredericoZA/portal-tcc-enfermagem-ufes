import React from 'react';
import {WORKFLOW_EXECUTION_EVENTS} from '../utils/workflowExecutionTrigger';
export function WorkflowExecutionTriggerControl({stageEvent,value,onChange,requiredEvent,prerequisite,hasPreviousStage=false}:{stageEvent:string;value?:string;onChange:(event?:string)=>void;requiredEvent?:string;prerequisite?:string;hasPreviousStage?:boolean}) {
  const label = WORKFLOW_EXECUTION_EVENTS.find(([event])=>event===stageEvent)?.[1] || stageEvent;
  return <div className="space-y-2 text-left">
    <select aria-label="Gatilho para execução" className="portal-input w-full bg-white text-xs" value={value||''} onChange={event=>onChange(event.target.value||undefined)}>
      <option value="">{hasPreviousStage?'Etapa anterior → entrada nesta etapa':'Entrada nesta etapa'} — {label}</option>
      <optgroup label="Ação do sistema">{WORKFLOW_EXECUTION_EVENTS.map(([event,title])=><option key={event} value={event} disabled={Boolean(requiredEvent&&requiredEvent!==event)}>{title}</option>)}</optgroup>
      {value&&!WORKFLOW_EXECUTION_EVENTS.some(([event])=>event===value)&&<option value={value}>Gatilho atual: {value}</option>}
    </select>
    {prerequisite&&<p className="text-[10px] leading-4 text-slate-600">{prerequisite}</p>}
  </div>;
}
