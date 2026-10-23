/** One-time, idempotent release migration; preserve the prior Studio snapshot and process data. */
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {loadPortalRuntimeState,savePortalRuntimeState} from '../server/integrations/supabase';
import {consolidateProcessForms,RETIRED_PROCESS_FORM_IDS} from '../src/utils/processFormConsolidation';
import {compileWorkflow} from '../server/workflow/runtime';
Object.assign(process.env,JSON.parse(readFileSync(new URL('../vercel.json',import.meta.url),'utf8')).env);
assert.equal(process.env.SUPABASE_URL,'https://vvgdmycmotazqjvpywmk.supabase.co');
const state=await loadPortalRuntimeState<any>();assert.ok(state?.settings?.integrationStudio);
const before=state.settings.integrationStudio,after=consolidateProcessForms(before);
if(JSON.stringify(before)===JSON.stringify(after)){console.log('PROCESS_FORMS_ALREADY_CONSOLIDATED');}
else{
 const beforeErrors=new Set(compileWorkflow(before).issues.filter(item=>item.severity==='ERROR').map(item=>item.code+item.message));
 const newErrors=compileWorkflow(after).issues.filter(item=>item.severity==='ERROR'&&!beforeErrors.has(item.code+item.message));
 assert.equal(newErrors.length,0,'A consolidação não pode criar referências inválidas no fluxo.');
 assert.ok(after.formTemplates.some((item:any)=>item.id==='form-reserva-aluno'),'Preservar cadastro inicial.');
 const now=new Date().toISOString(),revision=Number(before.revision||0)+1;
 state.studioVersions=[...(state.studioVersions||[]),{revision:before.revision,savedAt:before.savedAt,savedBy:before.savedBy,snapshot:before}].slice(-30);
 after.revision=revision;after.savedAt=now;after.savedBy=state.settings.masterEmail;
 if(after.publication)after.publication={...after.publication,publishedRevision:revision,publishedAt:now};
 state.settings.integrationStudio=after;state.settings.updatedAt=now;
 state.auditLogs=[...(state.auditLogs||[]),{id:'process-forms-consolidation-'+revision,timestamp:now,actorEmail:state.settings.masterEmail,actorRoles:['MASTER_ADMIN'],action:'CONSOLIDACAO_PREENCHIMENTO_DIRETO_NO_PROCESSO',entityType:'integration_studio',entityId:String(revision),before:{forms:before.formTemplates.map((item:any)=>item.id)},after:{forms:after.formTemplates.map((item:any)=>item.id)}}];
 await savePortalRuntimeState(state);
 console.log('PROCESS_FORMS_CONSOLIDATED',JSON.stringify({revision,retired:before.formTemplates.filter((item:any)=>RETIRED_PROCESS_FORM_IDS.has(item.id)).map((item:any)=>item.id),remaining:after.formTemplates.map((item:any)=>item.id),processesPreserved:state.processes?.length||0}));
}
