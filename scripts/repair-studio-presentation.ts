/** Idempotent release repair of missing legacy presentation metadata. */
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {loadPortalRuntimeState,savePortalRuntimeState} from '../server/integrations/supabase';
import {DEFAULT_BRAND_KIT} from '../src/services/integrationStudioService';
import {resolveInstallationProfile} from '../src/utils/installationProfile';
import {validateCourseStudio} from '../src/utils/courseStudioValidator';
Object.assign(process.env,JSON.parse(readFileSync(new URL('../vercel.json',import.meta.url),'utf8')).env);
assert.equal(process.env.SUPABASE_URL,'https://vvgdmycmotazqjvpywmk.supabase.co');
const state=await loadPortalRuntimeState<any>();assert.ok(state?.settings?.integrationStudio);
const before=state.settings.integrationStudio,profile=resolveInstallationProfile(state.settings);
const brandKit={...DEFAULT_BRAND_KIT,institutionName:profile.institutionName,courseName:profile.courseName,...before.brandKit};
if(Object.entries(brandKit).every(([key,value])=>before.brandKit?.[key]===value))console.log('STUDIO_PRESENTATION_ALREADY_COMPLETE');
else{
 const now=new Date().toISOString(),revision=Number(before.revision||0)+1;
 const after={...before,brandKit,revision,savedAt:now,savedBy:state.settings.masterEmail};
 const validation=validateCourseStudio(after);assert.ok(validation.ready,'A configuração reparada precisa passar pela validação completa.');
 if(after.publication)after.publication={...after.publication,publishedRevision:revision,publishedAt:now,validationScore:validation.score};
 state.studioVersions=[...(state.studioVersions||[]),{id:`studio-before-presentation-${revision}`,revision:before.revision,createdAt:now,createdBy:state.settings.masterEmail,checksum:createHash('sha256').update(JSON.stringify(before)).digest('hex'),snapshot:before}].slice(-30);
 state.settings={...state.settings,integrationStudio:after,updatedAt:now};
 state.auditLogs=[...(state.auditLogs||[]),{id:`studio-presentation-${revision}`,timestamp:now,actorEmail:state.settings.masterEmail,actorRoles:['MASTER_ADMIN'],action:'COMPLEMENTACAO_METADADOS_VISUAIS_ESTUDIO',entityType:'integration_studio',entityId:String(revision),after:{revision,validationReady:true}}];
 await savePortalRuntimeState(state);
 console.log('STUDIO_PRESENTATION_REPAIRED',JSON.stringify({revision,validationReady:true,processesPreserved:state.processes.length}));
}
