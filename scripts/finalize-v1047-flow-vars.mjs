import fs from 'node:fs';
const path='src/components/IntegrationStudioPanel.tsx';
let s=fs.readFileSync(path,'utf8');
const once=(a,b,label)=>{if(s.includes(b))return;if(!s.includes(a))throw new Error(label);s=s.replace(a,b);};
once("  const [selectedFormQuestionId, setSelectedFormQuestionId] = useState(formTemplates[0]?.questions?.[0]?.id || '');","  const [selectedFormQuestionId, setSelectedFormQuestionId] = useState(formTemplates[0]?.questions?.[0]?.id || '');\n  const [selectedWorkflowStageId, setSelectedWorkflowStageId] = useState(workflowStages[0]?.id || '');",'workflow state');
once("    setWorkflowStages(previous=>[...previous,{id:`stage-${Date.now()}`,stageNumber,title:`Nova etapa ${stageNumber}`,triggerEvent:'TCC_CREATED',description:'Descreva a condição e o resultado esperado desta etapa.',actions:[]}]);\n    setIsDirty(true);","    const id=`stage-${Date.now()}`;\n    setWorkflowStages(previous=>[...previous,{id,stageNumber,title:`Nova etapa ${stageNumber}`,triggerEvent:'TCC_CREATED',description:'Descreva a condição e o resultado esperado desta etapa.',actions:[]}]);\n    setSelectedWorkflowStageId(id);\n    setIsDirty(true);",'select new workflow stage');
if(!s.includes("selectedWorkflowStageId===stage.id?'Ocultar':'Editar'")){
 const start=s.indexOf('{workflowStages.map((stage,index)=>'); if(start<0)throw new Error('workflow map');
 const remove='<button type="button" onClick={()=>removeWorkflowStage(stage.id)} className="rounded-lg border border-rose-200 bg-rose-50 p-2 text-rose-700"><Trash2 className="h-3.5 w-3.5"/></button>';
 const p=s.indexOf(remove,start); if(p<0)throw new Error('workflow remove');
 const btn='<button type="button" onClick={()=>setSelectedWorkflowStageId(selectedWorkflowStageId===stage.id?\'\':stage.id)} className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-[9px] font-black uppercase text-slate-700">{selectedWorkflowStageId===stage.id?\'Ocultar\':\'Editar\'}</button>';
 s=s.slice(0,p)+btn+s.slice(p);
 const detail='<div className="space-y-3 p-4">'; const d=s.indexOf(detail,p); if(d<0)throw new Error('workflow detail');
 s=s.slice(0,d)+'<div className={selectedWorkflowStageId===stage.id?\'space-y-3 p-4\':\'hidden\'}>'+s.slice(d+detail.length);
}
if(!s.includes('portal-studio-variable-maintenance grid gap-2')){
 const old='<div className="grid gap-4 xl:grid-cols-[.85fr_1.15fr]">';
 const at=s.indexOf(old,s.indexOf("activeTab === 'variables'")); if(at<0)throw new Error('variable maintenance');
 s=s.slice(0,at)+'<div className="portal-studio-variable-maintenance grid gap-2 lg:grid-cols-2">'+s.slice(at+old.length);
}
fs.writeFileSync(path,s);
