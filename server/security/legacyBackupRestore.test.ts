import assert from 'node:assert/strict';
import {createHash, randomBytes} from 'node:crypto';
import {spawn} from 'node:child_process';
import {mkdtemp, rm, writeFile} from 'node:fs/promises';
import {createServer} from 'node:net';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import test from 'node:test';
import {DEMO_PROCESSES, INITIAL_SETTINGS} from '../../src/services/demoSeed';
import {canonicalLegacyRecord} from '../legacyArchive';
import type {LegacyAcademicRecord} from '../../src/types/legacyArchive';

test('HTTP backup round trip preserves historical consent, Drive references and completed operations', {timeout:45000}, async()=>{
  const directory=await mkdtemp(path.join(tmpdir(),'portal-backup-roundtrip-'));
  await writeFile(path.join(directory,'portal-state.json'),JSON.stringify({settings:structuredClone(INITIAL_SETTINGS),processes:[],legacyAcademicRecords:[],memberships:[]}));
  const reservation=createServer();
  await new Promise<void>(resolve=>reservation.listen(0,'127.0.0.1',resolve));
  const port=(reservation.address() as import('node:net').AddressInfo).port;
  await new Promise<void>((resolve,reject)=>reservation.close(error=>error?reject(error):resolve()));
  const child=spawn(process.execPath,['--import','tsx','server.ts'],{
    cwd:fileURLToPath(new URL('../..',import.meta.url)),
    env:{...process.env,NODE_ENV:'development',PORT:String(port),PORTAL_DATA_DIR:directory,
      PORTAL_SESSION_SECRET:randomBytes(32).toString('hex'),PORTAL_OTP_PEPPER:randomBytes(32).toString('hex'),
      PORTAL_ALLOW_INSECURE_DEMO_AUTH:'true',PORTAL_ALLOW_LOCAL_OTP_STORE:'true',PORTAL_ALLOW_LOCAL_SECRET_STORE:'true',
      PORTAL_TEST_DOCUMENT_RENDERER:'true',PORTAL_OTP_DELIVERY_MODE:'log',ASTEN_INTEGRATION_ENABLED:'false',
      PORTAL_PERSISTENCE_PROVIDER:'local_file',SUPABASE_URL:'',SUPABASE_SERVICE_ROLE_KEY:'',SUPABASE_SECRET_KEY:''},
    stdio:['ignore','pipe','pipe']
  });
  child.stdout.resume();child.stderr.resume();
  const base=`http://127.0.0.1:${port}`;
  const request=async(endpoint:string,body?:unknown,email='master@portal.local')=>{
    const response=await fetch(base+endpoint,{method:body===undefined?'GET':'POST',headers:{'content-type':'application/json',...(email?{'x-demo-user-email':email}:{})},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(6000)});
    return {status:response.status,body:await response.json()};
  };
  try{
    const deadline=Date.now()+25000;
    while(true){
      try{if((await fetch(base+'/api/health')).ok)break;}catch{/* startup */}
      if(Date.now()>deadline||child.exitCode!==null)throw new Error('Servidor de backup não iniciou.');
      await new Promise(resolve=>setTimeout(resolve,100));
    }
    assert.equal((await request('/api/admin/backup',undefined,'')).status,401);
    assert.equal((await request('/api/admin/backup',undefined,'student@example.invalid')).status,403);
    const processFixture=structuredClone(DEMO_PROCESSES[0]);
    processFixture.id='backup-demo-process';processFixture.protocolo='TCC-2099-0001';
    const record=(index:number,consent:string)=>canonicalLegacyRecord({
      id:`legado-${String(index).padStart(4,'0')}`,protocolo:`${String(index).padStart(3,'0')} - Legado`,sourceFingerprint:String(index).repeat(64),
      titulo:'Trabalho histórico demonstrativo',autores:['Autora demonstrativa'],orientador:'Docente demonstrativo',coorientador:'',coorientadorInstituicao:'',examinadores:[],
      resumo:'Resumo demonstrativo',palavrasChave:['Enfermagem'],dataDefesa:'2023-06-01',horaDefesa:'14:00:00',localDefesa:'Auditório',
      isPublic:false,publishFullWork:false,publishExpandedAbstract:false,publicationState:'NOT_REQUESTED',authorizationDecision:'UNSPECIFIED',
      attachments:[{driveFileId:`private_academic_file_${index}`,fileName:'trabalho.pdf',kind:'TRABALHO_COMPLETO',evidence:'Referência demonstrativa conferida',sha256:'a'.repeat(64)}],
      provenance:{originalConsent:[consent],administrativeDocuments:[{driveFileId:`private_admin_file_${index}`,folderId:'private_folder_demo',fileName:'ata.pdf',kind:'ATA',visibility:'PRIVATE_ADMINISTRATIVE_DOCUMENT',sha256:'b'.repeat(64)}]}
    } as LegacyAcademicRecord);
    const records=[record(1,'Não'),record(2,'Sim')];
    const completedAt='2026-10-15T18:00:00.000Z';
    const payload={schemaVersion:5,settings:structuredClone(INITIAL_SETTINGS),processes:[processFixture],legacyAcademicRecords:records,
      operationalMetadata:{signatureJobs:[{id:'signed-demo',processId:processFixture.id,status:'SIGNED',providerEnvelopeId:'demo-envelope'}],
        emailDeliveries:[{id:'email-demo',processId:processFixture.id,status:'ACCEPTED_BY_GMAIL',acceptedAt:completedAt}],
        astenWebhookEvents:[{id:'event-demo',status:'SIGNED',processedAt:completedAt,safePayload:{}},{id:'old-event-demo',status:'SENT',safePayload:{processedAt:completedAt}}]}};
    assert.equal((await request('/api/admin/restore-full-backup',payload,'')).status,401);
    assert.equal((await request('/api/admin/restore-full-backup',payload,'student@example.invalid')).status,403);
    const preview=await request('/api/admin/restore-full-backup',payload);
    assert.equal(preview.status,200);assert.equal(preview.body.requiresConfirmation,true);assert.equal(preview.body.summary.legacyCount,2);
    assert.equal((await request('/api/public/repository',undefined,'')).body.length,0,'preview does not mutate the archive');
    const restored=await request('/api/admin/restore-full-backup',{...payload,confirmHash:preview.body.confirmHash});
    assert.equal(restored.status,200);assert.equal(restored.body.legacyCount,2);
    const exported=await request('/api/admin/backup');
    assert.equal(exported.status,200);assert.equal(exported.body.schemaVersion,5);assert.deepEqual(exported.body.legacyAcademicRecords,records);
    for(const key of ['signatureJobs','emailDeliveries','astenWebhookEvents'])assert.deepEqual(exported.body.operationalMetadata[key],payload.operationalMetadata[key as keyof typeof payload.operationalMetadata]);
    const {checksum,...backupBody}=exported.body;
    assert.equal(checksum,createHash('sha256').update(JSON.stringify(backupBody)).digest('hex'));
    const publicRecords=(await request('/api/public/repository',undefined,'')).body;
    assert.equal(publicRecords.length,2);
    const denied=(await request('/api/legacy-academic-records',undefined,'')).body.find((record:{id:string})=>record.id==='legado-0001');
    assert.deepEqual(denied.publicFiles,[]);
    assert.ok(!JSON.stringify(publicRecords).includes('private_admin_file'));
    const oldBackup={schemaVersion:4,settings:payload.settings,processes:payload.processes};
    const oldPreview=await request('/api/admin/restore-full-backup',oldBackup);
    assert.equal(oldPreview.body.summary.legacyCount,2);
    assert.equal((await request('/api/admin/restore-full-backup',{...oldBackup,confirmHash:oldPreview.body.confirmHash})).status,200);
    assert.deepEqual((await request('/api/admin/backup')).body.legacyAcademicRecords,records,'old backups preserve an archive they did not contain');
    for(const invalid of [null,{},[records[0],records[0]],[{...records[0],publishFullWork:true}],[{...records[0],provenance:{...records[0].provenance,administrativeDocuments:[{driveFileId:'../private'}]}}]]){
      assert.equal((await request('/api/admin/restore-full-backup',{...oldBackup,legacyAcademicRecords:invalid})).status,400);
    }
    const pendingMetadata=[{signatureJobs:[{id:'new-pending',processId:processFixture.id,status:'SENDING'}]},
      {emailDeliveries:[{id:'new-failed',processId:processFixture.id,status:'FAILED'}]},
      {astenWebhookEvents:[{id:'new-callback',status:'SIGNED',safePayload:{}}]},
      {astenWebhookEvents:[{id:'bad-callback',status:'SIGNED',processedAt:'not-a-date',safePayload:{}}]}];
    for(const operationalMetadata of pendingMetadata)assert.equal((await request('/api/admin/restore-full-backup',{...oldBackup,operationalMetadata})).status,409,'unknown pending work must not replay');
  }finally{
    if(child.exitCode===null){child.kill('SIGTERM');await new Promise(resolve=>child.once('exit',resolve));}
    await rm(directory,{recursive:true,force:true});
  }
});
