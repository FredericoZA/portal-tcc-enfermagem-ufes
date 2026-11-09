import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';
import {DEMO_PROCESSES} from '../src/services/demoSeed';
import {captureSignaturePolicySnapshot,deriveSignatureSigners,assertCurrentSignatureRecipients,signatureSignersFromSnapshot} from './workflow/signaturePolicy';
import {evaluationPreviewToken,readEvaluationPreview} from './security/evaluationPreview';
const source=readFileSync('server.ts','utf8');const compile=(text:string)=>ts.transpileModule(text,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
const p=()=>{const value=structuredClone(DEMO_PROCESSES[0]);value.avaliacao.coadvisorPresent=false;return value;};
const settings=()=>({commissionPresidentName:'Presidência',commissionPresidentEmail:'president@example.invalid',integrationStudio:{revision:8,docTemplates:[{id:'tmpl-ata',type:'ATA',signatureRecipientRoles:['ADVISOR','EXAMINERS','AUTHORS','COADVISOR_PRESENT']}]},documentModels:{ATA:{}}} as any);
test('actual preview binding invalidates a previously reviewed token when signer roles or contact changes',()=>{
 const currentSettings=settings(),process=p();
 const begin=source.indexOf('function evaluationPreviewBinding('),end=source.indexOf('\nfunction evaluationPreviewSecret',begin);assert.ok(begin>0&&end>begin);
 const binding=runInNewContext(compile(`${source.slice(begin,end)};evaluationPreviewBinding`),{captureSignaturePolicySnapshot,currentSettings,ataModelFingerprint:()=> 'same-model',normalizeEmail:(value:string)=>value.toLowerCase()});
 const input={coadvisorPresent:false,resultadoCode:'APROVADO',parecer:'Parecer de demonstração',answers:{}};
 const original=binding(process,process.orientador.email,input,'ASTEN'),secret='fixture-secret';const token=evaluationPreviewToken(secret,original,Date.now()+60000);
 assert.ok(readEvaluationPreview(token,secret,original));
 currentSettings.integrationStudio.docTemplates[0].signatureRecipientRoles.push('COMMISSION_PRESIDENT');
 assert.equal(readEvaluationPreview(token,secret,binding(process,process.orientador.email,input,'ASTEN')),null);
});
test('snapshot digest survives JSONB-style object property reordering',()=>{
 const process=p(),config=settings(),signers=deriveSignatureSigners(process,'ATA',config),snapshot=captureSignaturePolicySnapshot(process,'ATA',config,signers);
 const reverse=(value:any):any=>Array.isArray(value)?value.map(reverse):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).reverse().map(([key,item])=>[key,reverse(item)])):value;
 assert.doesNotThrow(()=>assertCurrentSignatureRecipients(process,'ATA',{ataSignerPolicy:'BOARD_AUTHORS_V1',signers,signerPolicySnapshot:reverse(snapshot)},config));
});
test('Gov.br actual request gate allows only a frozen additional signer to download original and preserves return permission',()=>{
 const process=p(),config=settings();config.integrationStudio.docTemplates[0].signatureRecipientRoles.push('COMMISSION_PRESIDENT');
 const signers=deriveSignatureSigners(process,'ATA',config),snapshot=captureSignaturePolicySnapshot(process,'ATA',config,signers);
 const job:any={id:'job',processId:process.id,documentType:'ATA',provider:'GOV_BR',status:'READY_FOR_REVIEW',signers,signerPolicySnapshot:snapshot,ataSignerPolicy:'BOARD_AUTHORS_V1'};
 const start=source.indexOf('  const govbrJobForRequest='),finish=source.indexOf("  app.get('/api/signatures/jobs/:id/govbr/download'",start);assert.ok(start>0&&finish>start);
 const context:any={signatureJobsStore:[job],processesStore:[process],currentSettings:config,getPortalIdentity:()=>({email:config.commissionPresidentEmail}),canAccessSignatureDocument:()=>false,normalizeEmail:(value:string)=>value.toLowerCase(),canInitiateSignature:()=>false,signatureJobMatchesCurrentRevision:()=>true,hasCompetingSignatureArchive:()=>false,assertSignatureEligibility:()=>{},signatureSignersFromSnapshot,registeredSignatureSigners:deriveSignatureSigners,assertCurrentSignatureRecipients};
 const gate=runInNewContext(compile(`(function(){${source.slice(start,finish)};return govbrJobForRequest;})()`),context);
 assert.equal(gate({params:{id:'job'}},true).job,job);assert.throws(()=>gate({params:{id:'job'}},false),/não encontrado/);
 context.getPortalIdentity=()=>({email:'unrelated@example.invalid'});assert.throws(()=>gate({params:{id:'job'}},true),/não encontrado/);
});

test('actual PDF reconstruction uses the frozen signer list and suppresses later config for a default-layout job',async()=>{
 const start=source.indexOf('      const frozenStudio=currentSettings.integrationStudio?'),end=source.indexOf('\n    }\n    const regeneratedHash',start);assert.ok(start>0&&end>start);
 for(const configured of [false,true]){
  const signers=[{role:'PRESIDENT',email:'frozen@example.invalid',name:'Frozen',signingOrder:1,status:'WAITING'}];let renderArgs:any[]=[];
  const context:any={structuredClone,currentSettings:{integrationStudio:{docTemplates:[{id:'tmpl-termo',type:'TERMO',signatureRecipientRoles:['AUTHORS','ADVISOR','EXAMINERS']}]}},job:{documentType:'TERMO',verificationCode:'fixture',renderVariables:{},signerPolicySnapshot:{configured},signers},process:p(),resolveSignatureTemplateType:(template:any)=>template.type,renderOfficialTemplatePdf:async(...args:any[])=>{renderArgs=args;return Buffer.from('fixture');}};
  await runInNewContext(compile(`(async function(){let artifactPdf;${source.slice(start,end)};return artifactPdf;})()`),context);
  if(configured)assert.equal(renderArgs[8],signers);else{assert.equal(renderArgs[8],undefined);assert.equal(renderArgs[4].docTemplates[0].signatureRecipientRoles,undefined);}
  assert.ok(context.currentSettings.integrationStudio.docTemplates[0].signatureRecipientRoles,'reconstruction does not mutate current settings');
 }
});

test('server academic gate rejects a snapshot with a forged digest even when frontend structure appears complete',async()=>{
 const {ataArchived}=await import('./workflow/gates');
 const process=p();process.avaliacao.status='CONCLUIDO';process.avaliacao.documentRevision=4;
 const config=settings(),signers=deriveSignatureSigners(process,'ATA',config),snapshot=captureSignaturePolicySnapshot(process,'ATA',config,signers);
 const job:any={processId:process.id,documentType:'ATA',sourceDataRevision:4,documentVersion:1,status:'ARCHIVED',driveSignedFileId:'signed',ataSignerPolicy:'BOARD_AUTHORS_V1',signerPolicySnapshot:snapshot,signers:signers.map(s=>({...s,status:'SIGNED'}))};
 assert.equal(ataArchived(process,[job]),true);job.signerPolicySnapshot.digest='a'.repeat(64);assert.equal(ataArchived(process,[job]),false);
});
