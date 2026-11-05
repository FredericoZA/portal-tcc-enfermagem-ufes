import assert from 'node:assert/strict';
import {spawn, type ChildProcess} from 'node:child_process';
import {createHash, createHmac} from 'node:crypto';
import {access, mkdir, mkdtemp, readFile, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {DEMO_PROCESSES, INITIAL_SETTINGS} from '../src/services/demoSeed';

test('Master deletion removes the complete local process without contacting Asten or disturbing another TCC', {timeout:50_000}, async () => {
  const directory=await mkdtemp(path.join(tmpdir(),'portal-complete-deletion-'));
  const port=47700+Math.floor(Math.random()*200),base=`http://127.0.0.1:${port}`;
  const master='master@portal.local',secret='complete-deletion-session-fixture-0123456789abcdef';
  const timestamp=new Date().toISOString();
  const target=structuredClone(DEMO_PROCESSES[0]),other=structuredClone(DEMO_PROCESSES[1]);
  target.id='deletion-target';target.protocolo='TCC-2026-0042';
  other.id='preserved-process';other.protocolo='TCC-2026-0041';
  target.aluno1.email='target-student@example.invalid';
  target.aluno2=null;
  other.aluno1.email='other-student@example.invalid';
  const key=(name:string)=>createHash('sha256').update(name).digest('hex');
  const localFile=(name:string)=>`local_review_${key(name)}`;
  const govbrFile=(name:string)=>`local_govbr_${key(name)}`;
  const targetFiles=['target-invitation','target-academic','target-form','target-custom','target-old-version'];
  const keptFiles=['other-academic','other-form','document-model'];
  target.defesa.invitationDriveFileId=localFile('target-invitation');
  target.acervo={...target.acervo,trabalhoCompletoFileId:localFile('target-academic')};
  (target as any).documents=[{versions:[{drivePdfId:localFile('target-old-version')}]}];
  other.acervo={...other.acervo,trabalhoCompletoFileId:localFile('other-academic')};
  const model={id:'preserved-model',type:'ATA',fileName:'modelo-ata.docx',driveFileId:localFile('document-model'),driveFileUrl:'',templateContentText:'',variables:[],uploadedAt:timestamp,uploadedBy:master};
  const settings={...structuredClone(INITIAL_SETTINGS),calendarId:'',driveRootFolderId:'',documentModels:{ATA:model}};
  const job=(id:string,processId:string,fileId:string,envelopeId?:string)=>({id,processId,protocol:processId===target.id?target.protocolo:other.protocolo,documentTitle:'Ata',documentType:'ATA',documentVersion:1,sourceDataRevision:1,provider:envelopeId?'ASTEN':'GOV_BR',...(envelopeId?{providerEnvelopeId:envelopeId}:{}),status:'ARCHIVED',createdAt:timestamp,updatedAt:timestamp,createdBy:master,signers:[],driveSignedFileId:fileId,signedSha256:key(id)});
  const targetJob=job('target-job',target.id,govbrFile('target-signed'),'external-envelope-manual');
  const keptJob=job('kept-job',other.id,govbrFile('other-signed'));
  const archive=(id:string,processId:string)=>({id,processId,formType:'CADASTRO_INICIAL',formVersion:1,status:'ARCHIVED',createdAt:timestamp,updatedAt:timestamp,artifactBase64:'',driveFileId:localFile(id==='target-archive'?'target-form':'other-form')});
  const submission=(id:string,processId:string)=>({id,processId,formId:'form-review',formRevision:1,submittedBy:master,submittedAt:timestamp,answers:{CAMPO:'Resposta preservada'},checksum:key(id),archiveStatus:'ARCHIVED',...(id==='target-submission'?{driveFileId:localFile('target-custom')}:{})});
  const mail=(id:string,processId:string)=>({id,processId,idempotencyKey:id,recipient:'recipient@example.invalid',subject:id,status:'ACCEPTED_BY_GMAIL',attempts:[],maxAttempts:1,acceptedAt:timestamp,createdAt:timestamp,updatedAt:timestamp});
  const run=(id:string,processId:string)=>({id,processId,protocol:processId===target.id?target.protocolo:other.protocolo,eventCode:'TCC_CREATED',actorEmail:master,startedAt:timestamp,completedAt:timestamp,status:'COMPLETED',actions:[],issues:[]});
  const webhook=(id:string,jobId:string,envelopeId:string)=>({id,fingerprint:key(id),envelopeId,status:'SIGNED',receivedAt:timestamp,duplicate:false,matchedJobId:jobId,safePayload:{},processedAt:timestamp});
  const entry=(id:string,email:string,origin:string,processIds:string[])=>({id,nome:id,email,active:true,processIds,origin,roles:['STUDENT'],accessType:'STUDENT',createdAt:timestamp,createdBy:master,updatedAt:timestamp});
  const draft={ownerEmail:master,answers:{ALUNO_1_EMAIL:master},section:0,revision:1,schemaRevision:0,updatedAt:timestamp,expiresAt:new Date(Date.now()+86400000).toISOString()};
  const legalHolds=[{id:'held-other',processId:other.id,reason:'Retenção acadêmica',active:true,createdAt:timestamp,createdBy:master}];
  const state={settings,legalHolds,processProtocolCounters:{'TCC-2026':42},processes:[target,other],
    memberships:[target,other].map(record=>({id:`member-${record.id}`,processId:record.id,email:record.aluno1.email,roles:['STUDENT'],active:true,createdAt:timestamp,updatedAt:timestamp})),
    authorizedStudents:[entry('target-derived',target.aluno1.email,'TCC_FORM',[target.id]),entry('manual-access','manual@example.invalid','MASTER_LIST',[target.id]),entry('shared-access','shared@example.invalid','TCC_FORM',[target.id,other.id]),entry('other-access',other.aluno1.email,'TCC_FORM',[other.id])],
    removedAccessProcessKeys:[createHash('sha256').update(`shared@example.invalid|${target.id}`).digest('hex')],
    registrationDrafts:{[master]:draft},evaluationDrafts:{[target.id]:{dataRevision:target.dataRevision,revision:1,updatedAt:timestamp},[other.id]:{dataRevision:other.dataRevision,revision:1,updatedAt:timestamp}},
    signatureJobs:[targetJob,keptJob],formArchiveJobs:[archive('target-archive',target.id),archive('kept-archive',other.id)],
    studioFormSubmissions:[submission('target-submission',target.id),submission('kept-submission',other.id)],
    emailDeliveries:[mail('target-mail',target.id),mail('kept-mail',other.id)],workflowRuns:[run('target-run',target.id),run('kept-run',other.id)],
    astenWebhookEvents:[webhook('target-webhook',targetJob.id,'external-envelope-manual'),webhook('kept-webhook',keptJob.id,'kept-envelope')],
    reminders:[{id:'target-reminder',processId:target.id,status:'SENT'},{id:'kept-reminder',processId:other.id,status:'SENT'}],
    correctionRequests:[{id:'target-correction',processId:target.id,status:'PENDING'},{id:'kept-correction',processId:other.id,status:'PENDING'}],
    auditLogs:[{id:'target-log',processId:target.id,entityId:target.id,action:'CRIACAO_PROCESSO',actorEmail:master,actorRoles:['MASTER_ADMIN'],timestamp},{id:'target-signature-log',entityId:targetJob.id,action:'ASSINATURA',actorEmail:master,actorRoles:['MASTER_ADMIN'],timestamp},{id:'kept-log',processId:other.id,entityId:other.id,action:'CRIACAO_PROCESSO',actorEmail:master,actorRoles:['MASTER_ADMIN'],timestamp}],
  };
  const stateFile=path.join(directory,'portal-state.json');
  await writeFile(stateFile,JSON.stringify(state));
  await mkdir(path.join(directory,'arquivos-demonstrativos'));await mkdir(path.join(directory,'govbr-pdfs'));
  for(const name of [...targetFiles,...keptFiles]){
    await writeFile(path.join(directory,'arquivos-demonstrativos',key(name)+'.pdf'),`%PDF-1.7\nfixture:${name}`);
    await writeFile(path.join(directory,'arquivos-demonstrativos',key(name)+'.json'),JSON.stringify({processId:targetFiles.includes(name)?target.id:other.id}));
  }
  for(const name of ['target-signed','other-signed'])await writeFile(path.join(directory,'govbr-pdfs',key(name)+'.pdf'),`%PDF-1.7\nfixture:${name}`);
  const networkLog=path.join(directory,'unexpected-network.txt'),preload=path.join(directory,'deny-external-fetch.mjs');
  await writeFile(preload,`import {appendFileSync} from 'node:fs';const original=globalThis.fetch;globalThis.fetch=async(input,init)=>{const url=new URL(typeof input==='string'||input instanceof URL?String(input):input.url);if(url.hostname==='127.0.0.1'||url.hostname==='localhost')return original(input,init);appendFileSync(${JSON.stringify(networkLog)},url.origin+'\\n');throw new Error('External providers are blocked in this fixture.');};`);
  const cookie=()=>{const now=Math.floor(Date.now()/1000),value=Buffer.from(JSON.stringify({sessionId:'complete_deletion_session_0123456789',uid:`email:${master}`,email:master,emailVerified:true,authTime:now,issuedAt:now,expiresAt:now+3600,isDemo:false,method:'EMAIL_OTP'})).toString('base64url');return `portal_tcc_session=${value}.${createHmac('sha256',secret).update(value).digest('base64url')}`;};
  let child:ChildProcess|undefined;
  const stop=async()=>{if(child&&child.exitCode===null){const done=new Promise(resolve=>child!.once('exit',resolve));child.kill('SIGTERM');await done;}};
  const start=async()=>{
    child=spawn(process.execPath,['--import',preload,'--import','tsx','server.ts'],{cwd:process.cwd(),env:{...process.env,NODE_ENV:'development',HOST:'127.0.0.1',PORT:String(port),PORTAL_DATA_DIR:directory,PORTAL_PERSISTENCE_PROVIDER:'local_file',PORTAL_ALLOW_INSECURE_DEMO_AUTH:'false',PORTAL_ALLOW_LOCAL_OTP_STORE:'true',PORTAL_ALLOW_LOCAL_SECRET_STORE:'true',PORTAL_TEST_DOCUMENT_RENDERER:'false',PORTAL_SESSION_SECRET:secret,PORTAL_OTP_PEPPER:'complete-deletion-otp-fixture-0123456789abcdef',ASTEN_INTEGRATION_ENABLED:'false',SUPABASE_URL:'',SUPABASE_SECRET_KEY:'',SUPABASE_SERVICE_ROLE_KEY:'',PORTAL_DRIVE_ROOT_FOLDER_ID:'',VERCEL:''},stdio:'ignore'});
    const deadline=Date.now()+20_000;
    while(true){try{if((await fetch(base+'/api/health')).ok)return;}catch{}if(Date.now()>deadline||child.exitCode!==null)throw new Error('Deletion fixture did not start.');await new Promise(resolve=>setTimeout(resolve,100));}
  };
  const request=(route:string,method='GET',body?:unknown)=>fetch(base+route,{method,headers:{'Content-Type':'application/json',cookie:cookie()},...(body===undefined?{}:{body:JSON.stringify(body)})});
  const json=async(route:string)=>{const response=await request(route);assert.equal(response.status,200,route);return response.json();};
  const verify=async()=>{
    assert.equal((await request(`/api/processes/${target.id}`)).status,404);
    assert.equal((await request(`/api/processes/${target.id}/evaluation/draft`)).status,404);
    assert.equal((await request(`/api/processes/${target.id}/documents`)).status,404);
    assert.equal((await request(`/api/processes/${target.id}/signatures`)).status,404);
    assert.equal((await request(`/api/public/processes/${target.id}`)).status,404);
    assert.equal((await json('/api/processes')).some((record:any)=>record.id===target.id),false);
    assert.deepEqual((await json('/api/signatures/jobs')).map((record:any)=>record.id),[keptJob.id]);
    assert.deepEqual((await json('/api/admin/form-archives')).map((record:any)=>record.id),['kept-archive']);
    assert.deepEqual((await json('/api/admin/studio-form-submissions')).map((record:any)=>record.id),['kept-submission']);
    assert.deepEqual((await json('/api/admin/email-deliveries')).map((record:any)=>record.id),['kept-mail']);
    assert.deepEqual((await json('/api/admin/workflow-runs')).map((record:any)=>record.id),['kept-run']);
    assert.deepEqual(await json('/api/admin/process-deletions'),[]);
    const restore=await request('/api/admin/restore-full-backup','POST',{settings,processes:[target,other]});
    assert.equal(restore.status,409);
    assert.equal((await restore.json()).code,'PROCESS_BACKUP_RESTORE_DELETED');
    assert.equal((await json('/api/admin/access-list')).some((entry:any)=>entry.id==='target-derived'||entry.processIds.includes(target.id)),false);
    assert.equal((await json('/api/admin/audit-logs')).some((entry:any)=>entry.processId===target.id||entry.entityId===target.id||entry.entityId===targetJob.id),false);
    const persisted=JSON.parse(await readFile(stateFile,'utf8'));
    for(const field of ['memberships','signatureJobs','formArchiveJobs','studioFormSubmissions','emailDeliveries','workflowRuns','reminders','correctionRequests'])assert.deepEqual(persisted[field],state[field].filter((record:any)=>record.processId!==target.id),field);
    assert.deepEqual(persisted.processes,[other]);assert.deepEqual(persisted.signatureJobs,[keptJob]);
    assert.deepEqual(persisted.astenWebhookEvents,[state.astenWebhookEvents[1]]);
    assert.deepEqual(persisted.auditLogs.filter((log:any)=>log.action!=='EXCLUSAO_PROCESSO_TCC'),[state.auditLogs[2]]);
    const deletionLogs=persisted.auditLogs.filter((log:any)=>log.action==='EXCLUSAO_PROCESSO_TCC');
    assert.equal(deletionLogs.length,1);
    assert.equal(deletionLogs[0].processProtocol,target.protocolo);
    assert.equal(deletionLogs[0].before,undefined);
    assert.equal(deletionLogs[0].after.cleanupStatus,'Limpeza do Portal concluída');
    assert.deepEqual(deletionLogs[0].after.manualAstenEnvelopes,['external-envelope-manual']);
    assert.deepEqual(persisted.legalHolds,legalHolds);
    assert.equal(persisted.evaluationDrafts[target.id],undefined);assert.deepEqual(persisted.evaluationDrafts[other.id],state.evaluationDrafts[other.id]);
    assert.deepEqual(persisted.registrationDrafts,{[master]:draft});
    assert.equal(persisted.authorizedStudents.some((entry:any)=>entry.id==='target-derived'||entry.processIds.includes(target.id)),false);
    const manual=persisted.authorizedStudents.find((entry:any)=>entry.id==='manual-access');assert.ok(manual.active);assert.equal(manual.origin,'MASTER_LIST');assert.deepEqual(manual.processIds,[]);
    const shared=persisted.authorizedStudents.find((entry:any)=>entry.id==='shared-access');assert.ok(shared.active);assert.deepEqual(shared.processIds,[other.id]);
    assert.ok(persisted.authorizedStudents.find((entry:any)=>entry.id==='other-access')?.active);
    assert.deepEqual(persisted.removedAccessProcessKeys,[]);
    assert.deepEqual(persisted.settings.documentModels.ATA,model);assert.deepEqual(persisted.processProtocolCounters,{'TCC-2026':42});
    for(const name of targetFiles)for(const extension of ['.pdf','.json'])await assert.rejects(access(path.join(directory,'arquivos-demonstrativos',key(name)+extension)),{code:'ENOENT'},`${name}${extension} must be removed`);
    await assert.rejects(access(path.join(directory,'govbr-pdfs',key('target-signed')+'.pdf')));
    for(const name of keptFiles)assert.equal(await readFile(path.join(directory,'arquivos-demonstrativos',key(name)+'.pdf'),'utf8'),`%PDF-1.7\nfixture:${name}`);
    assert.equal(await readFile(path.join(directory,'govbr-pdfs',key('other-signed')+'.pdf'),'utf8'),'%PDF-1.7\nfixture:other-signed');
    await assert.rejects(access(networkLog));
  };
  try{
    const activeMail={...mail('active-mail',target.id),status:'RETRY',dispatchState:'SENDING',dispatchLeaseUntil:new Date(Date.now()+60_000).toISOString()};
    await writeFile(stateFile,JSON.stringify({...state,emailDeliveries:[...state.emailDeliveries,activeMail]}));
    await start();
    const sending=await request(`/api/processes/${target.id}`,'DELETE',{confirmation:'EXCLUIR',expectedProcessId:target.id});
    assert.equal(sending.status,409);
    assert.equal((await sending.json()).code,'PROCESS_OPERATION_IN_PROGRESS');
    await stop();
    await writeFile(stateFile,JSON.stringify(state));
    await start();
    assert.equal((await json('/api/signatures/jobs')).length,2);
    const held=await request(`/api/processes/${other.id}`,'DELETE',{confirmation:'EXCLUIR',expectedProcessId:other.id});
    assert.equal(held.status,409);
    assert.equal((await held.json()).code,'PROCESS_LEGAL_HOLD');
    const omitHeld=await request('/api/admin/restore-full-backup','POST',{settings,processes:[target]});
    assert.equal(omitHeld.status,409);
    assert.equal((await omitHeld.json()).code,'PROCESS_LEGAL_HOLD');
    const omitActive=await request('/api/admin/restore-full-backup','POST',{settings,processes:[other]});
    assert.equal(omitActive.status,409);
    assert.equal((await omitActive.json()).code,'PROCESS_BACKUP_RESTORE_WOULD_DELETE');
    assert.deepEqual(await json('/api/admin/process-deletions'),[]);
    const response=await request(`/api/processes/${target.id}`,'DELETE',{confirmation:'EXCLUIR',expectedProcessId:target.id,deleteFiles:true,clearHistory:true});
    assert.equal(response.status,200,await response.clone().text());
    const result=await response.json();assert.equal(result.cleanupPending,false);assert.deepEqual(result.cleanupErrors,[]);assert.deepEqual(result.manualAstenEnvelopes,['external-envelope-manual']);assert.match(result.message,/manualmente.*Asten/i);
    await verify();
    await stop();await start();await verify();
    const backupWithoutHold={settings,processes:[other],legalHolds:[]};
    const preview=await request('/api/admin/restore-full-backup','POST',backupWithoutHold);
    assert.equal(preview.status,200,await preview.clone().text());
    const {confirmHash}=await preview.json();
    const confirmed=await request('/api/admin/restore-full-backup','POST',{...backupWithoutHold,confirmHash});
    assert.equal(confirmed.status,200,await confirmed.clone().text());
    const heldAfterRestore=await request(`/api/processes/${other.id}`,'DELETE',{confirmation:'EXCLUIR',expectedProcessId:other.id});
    assert.equal(heldAfterRestore.status,409);
    assert.equal((await heldAfterRestore.json()).code,'PROCESS_LEGAL_HOLD');
  }finally{await stop();await rm(directory,{recursive:true,force:true});}
});
