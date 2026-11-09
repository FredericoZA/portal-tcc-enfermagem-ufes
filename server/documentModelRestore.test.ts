import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';
import JSZip from 'jszip';
import {readDriveModelFingerprint,verifyMasterDocumentModelFingerprint} from './integrations/googleWorkspace';

const source=await readFile('server.ts','utf8');
const start=source.indexOf("  app.post('/api/admin/models/:type/versions/:version/restore'");
const route=source.slice(start,source.indexOf("  app.delete('/api/admin/models/:type'",start));
const modelTypes=['ATA','CONVITE','TERMO','DECLARACAO'];

function harness(type:string,hash:string){
 const selected={version:1,driveFileId:'old_model_12345',fileName:'anterior.docx',contentSha256:hash};
 const model={activeVersion:2,driveFileId:'current_model_12345',fileName:'atual.docx',contentSha256:'e'.repeat(64),versions:[selected]};
 let handler:any;let writes=0;
 const context:any={Date,Number,String,Error,ATTENDANCE_MODEL:'DECLARACAO_COMPARECIMENTO',currentSettings:{documentModels:{[type]:model}},auditLogsStore:[],
  app:{post:(_path:any,auth:any,admin:any,callback:any)=>{assert.equal(auth,'authenticated');assert.equal(admin,'master');handler=callback;}},requireAuthenticated:'authenticated',requireAdministrator:'master',
  getPortalIdentity:()=>({email:'master@example.invalid'}),getUserRolesForEmail:()=>({globalRoles:['MASTER_ADMIN']}),
  localDocumentModelsEnabled:()=>false,isReferenceDocumentModel:()=>false,getGoogleWorkspaceAccessToken:async()=>'fixture-token',verifyMasterDocumentModelFingerprint,
  persistModelPublication:async()=>{writes++;}};
 runInNewContext(ts.transpileModule(route,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,context);
 return {context,model,selected,get writes(){return writes;},request:async()=>{const res={code:200,body:null as any,status(code:number){this.code=code;return this;},json(body:any){this.body=body;return this;}};await handler({params:{type,version:'1'}},res);return res;}};
}

test('restauração operacional valida bytes históricos antes de ativar; link quebrado, Drive indisponível e conteúdo alterado preservam modelo',async()=>{
 const originalFetch=globalThis.fetch;
 const zip=new JSZip();zip.file('word/document.xml','<w:document>Versão histórica conferida</w:document>');const bytes=await zip.generateAsync({type:'nodebuffer'});
 let mode='correct';let afterRead:()=>void=()=>{};
 globalThis.fetch=async(input)=>{
  const url=String(input);
  if(mode==='unavailable')throw new Error('Drive indisponível');
  if(mode==='missing')return new Response('not found',{status:404});
  if(url.includes('fields='))return Response.json({id:'old_model_12345',mimeType:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',headRevisionId:'old-revision'});
  afterRead();return new Response(bytes);
 };
 try{
  const fingerprint=await readDriveModelFingerprint('fixture-token','old_model_12345');
  for(const type of modelTypes){
   for(const failure of ['missing','unavailable','changed']){
    mode=failure;const h=harness(type,failure==='changed'?'f'.repeat(64):fingerprint.contentSha256);
    const result=await h.request();assert.equal(result.code,409,`${type}/${failure}`);assert.equal(h.context.currentSettings.documentModels[type],h.model);assert.equal(h.model.activeVersion,2);assert.equal(h.writes,0);assert.equal(h.context.auditLogsStore.length,0);
   }
   mode='correct';const h=harness(type,fingerprint.contentSha256);const result=await h.request();
   assert.equal(result.code,200,type);assert.equal(h.context.currentSettings.documentModels[type].activeVersion,1);assert.equal(h.context.currentSettings.documentModels[type].driveFileId,h.selected.driveFileId);assert.equal(h.context.currentSettings.documentModels[type].contentSha256,fingerprint.contentSha256);assert.equal(h.writes,1);assert.equal(h.context.auditLogsStore.length,1);assert.equal(h.model.activeVersion,2);
  }
  mode='correct';const concurrent=harness('ATA',fingerprint.contentSha256);const replacement={...concurrent.model,activeVersion:3};afterRead=()=>{concurrent.context.currentSettings.documentModels.ATA=replacement;};
  assert.equal((await concurrent.request()).code,409);assert.equal(concurrent.context.currentSettings.documentModels.ATA,replacement);assert.equal(concurrent.writes,0);assert.equal(concurrent.context.auditLogsStore.length,0);
 }finally{globalThis.fetch=originalFetch;}
});
