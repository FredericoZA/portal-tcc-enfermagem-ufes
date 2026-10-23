/** Explicit release action; reviewed binary inputs live only in the private release staging folder. */
import {readFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import {loadPortalRuntimeState,savePortalRuntimeState} from '../server/integrations/supabase';
import {publishMasterDocumentModel} from '../server/integrations/googleWorkspace';
Object.assign(process.env,JSON.parse(readFileSync(new URL('../vercel.json',import.meta.url),'utf8')).env);
assert.equal(process.env.SUPABASE_URL,'https://vvgdmycmotazqjvpywmk.supabase.co');
const manifestPath=new URL('../release-inputs/document-models.json',import.meta.url);
if(!existsSync(manifestPath))throw new Error('Revisões documentais conferidas não foram fornecidas.');
const entries=JSON.parse(readFileSync(manifestPath,'utf8')) as Array<{type:'ATA'|'CONVITE';sha256:string;previousFileId:string}>;
for(const entry of entries){
 assert.ok(['ATA','CONVITE'].includes(entry.type));
 const bytes=readFileSync(new URL(`../release-inputs/${entry.type}.docx`,import.meta.url));
 assert.equal(createHash('sha256').update(bytes).digest('hex'),entry.sha256);
 const zip=await JSZip.loadAsync(bytes,{checkCRC32:true});const digest=createHash('sha256');
 for(const name of Object.keys(zip.files).filter(name=>!zip.files[name].dir).sort()){digest.update(name,'utf8');digest.update('\0');digest.update(await zip.files[name].async('nodebuffer'));digest.update('\0');}
 const canonicalSha256=digest.digest('hex');
 const state=await loadPortalRuntimeState<any>();assert.ok(state?.settings?.documentModels);
 const before=state.settings.documentModels[entry.type];
 if(before?.contentSha256===canonicalSha256){console.log('REVIEWED_MODEL_ALREADY_ACTIVE',entry.type);continue;}
 assert.equal(before?.driveFileId,entry.previousFileId,'Modelo ativo mudou durante a preparação; preservar versão atual.');
 let xmlText='';
 for(const name of Object.keys(zip.files).filter(name=>/^word\/(document|header\d*|footer\d*)\.xml$/.test(name)))xmlText+=(await zip.file(name)!.async('string')).replace(/<[^>]+>/g,'').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&');
 const variables=Array.from(new Set(xmlText.match(/<<[^<>]{2,100}>>/g)||[]));assert.ok(variables.length>=8);
 const drive=await publishMasterDocumentModel({type:entry.type,fileName:`${entry.type}.docx`,content:bytes,rootFolderName:state.settings.installationProfile?.driveRootFolderName});
 assert.equal(drive.contentSha256,canonicalSha256);
 const now=new Date().toISOString();
 const history=before.versions?.length?before.versions:[{version:before.activeVersion||1,fileName:before.fileName,driveFileId:before.driveFileId,driveFileUrl:before.driveFileUrl,variables:before.variables,uploadedAt:before.uploadedAt,uploadedBy:before.uploadedBy,contentSha256:before.contentSha256,driveRevisionId:before.driveRevisionId,driveModifiedTime:before.driveModifiedTime}];
 const version={version:Math.max(...history.map((item:any)=>item.version||1))+1,fileName:drive.name,driveFileId:drive.id,driveFileUrl:drive.webViewLink,variables,uploadedAt:now,uploadedBy:state.settings.masterEmail,contentSha256:drive.contentSha256,driveRevisionId:drive.driveRevisionId,driveModifiedTime:drive.driveModifiedTime};
 const model={...before,...version,activeVersion:version.version,versions:[...history,version].slice(-30),templateContentText:''};
 state.settings.documentModels[entry.type]=model;
 if(state.settings.integrationStudio?.docTemplates)state.settings.integrationStudio.docTemplates=state.settings.integrationStudio.docTemplates.map((item:any)=>String(item.type).toUpperCase()===entry.type?{...item,...model,id:item.id,fields:item.fields||[]}:item);
 state.settings.updatedAt=now;
 state.auditLogs=[...(state.auditLogs||[]),{id:`model-revision-${entry.type}-${entry.sha256.slice(0,16)}`,timestamp:now,actorEmail:state.settings.masterEmail,actorRoles:['MASTER_ADMIN'],action:'MODELO_DOCUMENTAL_REVISADO_A_PEDIDO_DO_MASTER',entityType:'document_model',entityId:entry.type,before:{driveFileId:before.driveFileId,version:before.activeVersion||1},after:{driveFileId:drive.id,version:version.version,sha256:entry.sha256}}];
 await savePortalRuntimeState(state);
 console.log('REVIEWED_DOCUMENT_MODEL_PUBLISHED',JSON.stringify({type:entry.type,version:version.version,variables:variables.length}));
}
