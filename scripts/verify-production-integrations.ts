import {inspectPdfLayout} from '../server/workflow/documentQuality';
import {previewProcess} from '../server/workflow/modelPreview';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {loadPortalRuntimeState,savePortalRuntimeState,testSupabaseRuntimeConnection,persistStudioRuntimeImage,buildSupabaseAdminHeaders} from '../server/integrations/supabase';
import {renderGoogleDriveTemplateToPdf} from '../server/integrations/googleDocsRenderer';
import {ensurePortalRenderFolder,getGoogleWorkspaceAccessToken,verifyPrivateDriveFolder,verifyMasterDocumentModelFingerprint} from '../server/integrations/googleWorkspace';
import {loadIntegrationSecret} from '../server/integrations/integrationSecrets';
import {connectPersistentAsten,getPersistentAstenStatus} from '../server/integrations/asten';
import {saveAstenDocumentFolders,getAstenDocumentFolders} from '../server/integrations/astenFolders';
import {astenWebhookInboxReady} from '../server/integrations/astenWebhookInbox';

Object.assign(process.env,JSON.parse(readFileSync(new URL('../vercel.json',import.meta.url),'utf8')).env);
assert.equal(process.env.SUPABASE_URL,'https://vvgdmycmotazqjvpywmk.supabase.co','Banco diferente do original.');
if(process.env.PORTAL_RELEASE_ASTEN_SETUP){
  const setup=JSON.parse(process.env.PORTAL_RELEASE_ASTEN_SETUP);
  assert.equal(setup.identifier,'1350');assert.equal(setup.repositoryId,2528);
  const current=await loadIntegrationSecret('asten');
  if(current)assert.equal(current.value,setup.token,'Há uma credencial diferente no destino; preservar.');
  else await connectPersistentAsten(setup.token,String(setup.repositoryId));
  const folders=await getAstenDocumentFolders();
  if(!folders.configured)await saveAstenDocumentFolders(setup.mapping);
}
const report:{id:string;ok:boolean;detail?:string}[]=[];
async function check(id:string,task:()=>Promise<void>){try{await task();report.push({id,ok:true});}catch(error){report.push({id,ok:false,detail:error instanceof Error?error.message:'Falha'});}}
const db=await testSupabaseRuntimeConnection();
report.push({id:'original-database',ok:db.connected&&!!db.transactionalRuntimeReady});
const state=await loadPortalRuntimeState<any>();
assert.ok(state?.settings,'Estado original não encontrado.');
await check('email-image-storage',async()=>{
  const value='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==';
  const {createHash}=await import('node:crypto');const key=createHash('sha256').update(value).digest('hex');
  const endpoint=`${process.env.SUPABASE_URL}/rest/v1/portal_runtime_assets?asset_key=eq.${key}`;
  const before=await fetch(endpoint+'&select=asset_key',{headers:buildSupabaseAdminHeaders()});assert.ok(before.ok);
  const existed=(await before.json()).length>0;
  try{
    assert.equal(await persistStudioRuntimeImage(value),`/api/public/runtime-assets/${key}`);
    const readback=await fetch(endpoint+'&select=data_url',{headers:buildSupabaseAdminHeaders()});assert.ok(readback.ok);
    assert.equal((await readback.json())[0]?.data_url,value);
  }finally{if(!existed){const removed=await fetch(endpoint,{method:'DELETE',headers:buildSupabaseAdminHeaders()});assert.ok(removed.ok,'Remover somente o asset técnico recém-criado.');}}
});
if(process.env.PORTAL_RELEASE_WORKFLOW_SETUP&&!state.settings.integrationStudio?.workflowStages?.length){
  const studio=JSON.parse(process.env.PORTAL_RELEASE_WORKFLOW_SETUP);
  assert.equal(studio.workflowStages?.length,7);assert.equal(studio.emailTemplates?.length,4);
  const ids:Record<string,string>={CONVITE:'tmpl-convite',ATA:'tmpl-ata',TERMO:'tmpl-termo',DECLARACAO:'tmpl-declaracao'};
  studio.docTemplates=Object.entries(ids).map(([type,id])=>{const model=state.settings.documentModels[type];assert.ok(model?.driveFileId);return {...model,id,type,templateContentText:'',fields:[]};});
  const department=String(state.settings.emailConfig?.roomReservationDepartmentEmail||'');
  studio.emailTemplates=studio.emailTemplates.map((email:any)=>email.id==='email-reserva'?{...email,recipient:department}:email);
  state.settings.integrationStudio=studio;
  state.auditLogs=[...(state.auditLogs||[]),{id:`release-studio-${Date.now()}`,timestamp:new Date().toISOString(),actorEmail:state.settings.masterEmail,actorRoles:['MASTER_ADMIN'],action:'CONFIGURACAO_CANONICA_PUBLICADA_NA_RELEASE',entityType:'integration_studio',entityId:'studio',after:{stageCount:7,modelCount:4,emailCount:4}}];
  await savePortalRuntimeState(state);
  console.log('WORKFLOW_RELEASE',JSON.stringify({stages:7,originalProcessesPreserved:state.processes?.length}));
}

await check('model-sample-data',async()=>{const sample=previewProcess(state.settings.integrationStudio||{});assert.ok(Number.isFinite(Date.parse(sample.process.defesa.startAt)),'A amostra precisa de data e hora válidas.');});
await check('google-drive',async()=>{const token=await getGoogleWorkspaceAccessToken();await verifyPrivateDriveFolder(token,state.settings.driveRootFolderId);});
for(const type of ['CONVITE','ATA','TERMO','DECLARACAO'])await check(`model-${type}`,async()=>{const token=await getGoogleWorkspaceAccessToken();const model=state.settings.documentModels?.[type];assert.ok(model?.driveFileId,'Modelo ausente.');await verifyMasterDocumentModelFingerprint({accessToken:token,fileId:model.driveFileId,...model});
  const rendered=await renderGoogleDriveTemplateToPdf({accessToken:token,templateUrlOrId:model.driveFileId,temporaryParentId:await ensurePortalRenderFolder(token,state.settings.driveRootFolderId),outputName:`TESTE_DESCARTAVEL_${type}.pdf`,replacements:Object.fromEntries((model.variables||[]).map((key:string)=>[key,'TESTE TÉCNICO SEM VALIDADE ACADÊMICA']))});
  const quality=await inspectPdfLayout(rendered.pdf);assert.ok(quality.pages>0,'Leitor de PDF não abriu o modelo.');
  assert.ok(rendered.pdf.subarray(0,5).toString()==='%PDF-','Exportação PDF inválida.');
  assert.ok(rendered.replacementsChanged>0,'Nenhuma variável reconhecida no modelo.');
  assert.equal(rendered.unresolvedMarkers.length,0,'Modelo contém marcadores não mapeados.');
  if(type==='ATA'){
    assert.ok(rendered.documentText,'A ata deve disponibilizar seu corpo integral para correção.');
    const revised=rendered.documentText+'\nConferência técnica do editor integral, sem validade acadêmica.';
    const checked=await renderGoogleDriveTemplateToPdf({accessToken:token,templateUrlOrId:model.driveFileId,temporaryParentId:await ensurePortalRenderFolder(token,state.settings.driveRootFolderId),outputName:'TESTE_DESCARTAVEL_ATA_REVISAO.pdf',replacements:Object.fromEntries((model.variables||[]).map((key:string)=>[key,'TESTE TÉCNICO SEM VALIDADE ACADÊMICA'])),documentText:revised});
    assert.equal(checked.documentText,revised);assert.ok((await inspectPdfLayout(checked.pdf)).pages>0);
  }
});
await check('asten-connection',async()=>{const result=await getPersistentAstenStatus();assert.ok(result.configured,'Conta Asten não conectada.');assert.ok(result.dispatchEnabled,'Despacho Asten bloqueado: '+result.securityIssues.join(' '));});
await check('asten-folders',async()=>{const result=await getAstenDocumentFolders();assert.ok(result.configured,result.issues.join(' '));});
await check('asten-inbox',async()=>assert.ok(await astenWebhookInboxReady()));
console.log('BUSINESS_CONFIGURATION',JSON.stringify({workflowStages:state.settings.integrationStudio?.workflowStages?.length||0,presidentEmailConfigured:Boolean(state.settings.commissionPresidentEmail),departmentEmailConfigured:Boolean(state.settings.emailConfig?.roomReservationDepartmentEmail||state.settings.integrationStudio?.emailTemplates?.find((email:any)=>email.id==='email-reserva')?.recipient)}));
console.log('PRODUCTION_INTEGRATION_PREFLIGHT',JSON.stringify(report));
if(report.some(item=>!item.ok))process.exitCode=1;
