import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DEMO_PROCESSES, INITIAL_SETTINGS } from '../src/services/demoSeed';
import { courseStudioFixture } from './fixtures/courseStudioFixture';

test('retomadas legadas não publicam eventos cuja etapa deixou de ser elegível', { timeout:45_000 }, async()=>{
  const directory=await mkdtemp(join(tmpdir(),'portal-legacy-workflow-retry-'));
  const baseProcess=structuredClone(DEMO_PROCESSES[0]);
  baseProcess.avaliacao={status:'PENDENTE'};
  baseProcess.acervo=undefined;
  baseProcess.status='AGUARDANDO_DEFESA';
  baseProcess.defesa={...baseProcess.defesa,localStatus:'CONFIRMADO',reservationRevision:0,
    invitationDriveFileId:'fixture-invitation',invitationSentAt:'2026-01-01T10:00:00Z'};
  const processes=['old-evaluation','old-repository','old-publication'].map(id=>({...structuredClone(baseProcess),id}));
  const studio=courseStudioFixture();
  const events=['EVALUATION_SUBMITTED','REPOSITORY_SUBMITTED','PUBLICATION_CLEARED'];
  studio.emailTemplates.push(...events.map(event=>({id:'fixture-'+event,name:'Aviso '+event,recipient:'{{ORIENTADOR_EMAIL}}',subject:event,body:'Aviso fictício de evento confirmado.'})));
  for(const event of events){
    const stage=studio.workflowStages.find(item=>item.triggerEvent===event)!;
    stage.actions=[{id:'fixture-action-'+event,type:'email',refId:'fixture-'+event,title:'Avisar o evento'}];
  }
  const archive=(id:string,processId:string,formType:string)=>({id,processId,formType,version:baseProcess.dataRevision,status:'ARCHIVED',driveFileId:'fixture-form',artifactBase64:'',createdAt:baseProcess.createdAt,updatedAt:baseProcess.updatedAt});
  const archives=[archive('old-ata-form',processes[0].id,'AVALIACAO'),archive('old-final-form',processes[1].id,'DADOS_FINAIS')];
  const run={id:'legacy-publication-run',processId:processes[2].id,protocol:baseProcess.protocolo,
    eventCode:'PUBLICATION_CLEARED',studioRevision:studio.revision,status:'PARTIAL_FAILURE',actions:[],issues:[],
    actorEmail:'master@portal.local',startedAt:baseProcess.createdAt,completedAt:baseProcess.createdAt};
  // An archived receipt from an earlier scheduling cannot release the current failed one.
  const current=structuredClone(baseProcess);current.id='current-reservation';current.dataRevision=baseProcess.dataRevision+1;
  current.defesa={...current.defesa,localStatus:'CONFIRMADO',reservationRevision:1,invitationSentAt:undefined,
    departmentResponse:{revision:1,decision:'CONFIRMED',respondedBy:'master@portal.local',respondedAt:current.updatedAt,
      local:current.defesa.local,startAt:current.defesa.startAt,endAt:current.defesa.endAt}};
  processes.push(current);
  archives.push(archive('earlier-reservation-archive',current.id,'CONFIRMACAO_LOCAL'));
  const failedCurrent={...archive('current-reservation-archive',current.id,'CONFIRMACAO_LOCAL'),version:current.dataRevision,
    reservationRevision:1,status:'FAILED',lastError:'The operation was aborted due to timeout'};
  archives.push(failedCurrent);
  const currentRun={...run,id:'current-confirmed-run',processId:current.id,eventCode:'LOCATION_CONFIRMED',sourceDataRevision:current.dataRevision};
  const stateFile=join(directory,'portal-state.json');
  await writeFile(stateFile,JSON.stringify({settings:{...INITIAL_SETTINGS,integrationStudio:studio},processes,
    signatureJobs:[],formArchiveJobs:archives,workflowRuns:[run,currentRun],auditLogs:[],memberships:[],emailDeliveries:[]}));
  const runtime=String.raw`
    import dotenv from 'dotenv';dotenv.config=()=>({parsed:{}});
    globalThis.fetch=async(input,init={})=>{
      const url=new URL(String(input));
      if(url.href==='https://oauth2.googleapis.com/token')return Response.json({access_token:'fake-token',expires_in:3600});
      if(url.href==='https://gmail.googleapis.com/gmail/v1/users/me/messages/send'){
        process.send?.({kind:'sent'});return Response.json({id:'fake-message',threadId:'fake-thread'});
      }
      process.send?.({kind:'unexpected',origin:url.origin});throw Error('Provider disabled in fixture.');
    };
    const {saveIntegrationSecret}=await import('./server/integrations/integrationSecrets.ts');
    await saveIntegrationSecret('google_workspace','fake-refresh-token',{email:'sender@example.invalid'});
    await import('./server.ts');
  `;
  const port=48800+Math.floor(Math.random()*200),base=`http://127.0.0.1:${port}`;
  const child=spawn(process.execPath,['--import','tsx','--input-type=module','-e',runtime],{
    env:{PATH:process.env.PATH,HOME:process.env.HOME,NODE_ENV:'development',HOST:'127.0.0.1',PORT:String(port),
      PORTAL_DATA_DIR:directory,APP_URL:base,PORTAL_PUBLIC_URL:base,PORTAL_PERSISTENCE_PROVIDER:'local_file',
      PORTAL_ALLOW_INSECURE_DEMO_AUTH:'true',PORTAL_ALLOW_LOCAL_SECRET_STORE:'true',PORTAL_SESSION_SECRET:randomBytes(40).toString('hex'),
      PORTAL_SECRET_ENCRYPTION_KEY:randomBytes(32).toString('hex'),GOOGLE_OAUTH_CLIENT_ID:'fake-client',
      GOOGLE_OAUTH_CLIENT_SECRET:'fake-secret',ASTEN_INTEGRATION_ENABLED:'false'},
    stdio:['ignore','ignore','ignore','ipc'],
  });
  let sent=0;
  const unexpected:string[]=[];
  child.on('message',(event:any)=>{if(event.kind==='sent')sent++;if(event.kind==='unexpected')unexpected.push(event.origin);});
  try{
    const deadline=Date.now()+20_000;
    while(true){
      try{if((await fetch(base+'/api/health')).ok)break;}catch{}
      if(Date.now()>deadline||child.exitCode!==null)throw Error('Fixture did not start');
      await new Promise(resolve=>setTimeout(resolve,100));
    }
    const before=JSON.parse(await readFile(stateFile,'utf8'));
    const observations:Array<{route:string;status:number;code?:string;sent:number}>=[];
    for(const route of ['/api/admin/form-archives/old-ata-form/retry','/api/admin/form-archives/old-final-form/retry',
      '/api/admin/workflow/runs/legacy-publication-run/retry']){
      const response=await fetch(base+route,{method:'POST',headers:{'x-demo-user-email':'master@portal.local','content-type':'application/json'},body:'{}'});
      const body=await response.json();
      observations.push({route,status:response.status,code:body.code,sent});
    }
    assert.deepEqual(observations.map(item=>item.status),[409,409,409],JSON.stringify(observations));
    assert.ok(observations.every(item=>item.code==='WORKFLOW_RETRY_NOT_ELIGIBLE'));
    const blocked=await fetch(base+'/api/admin/workflow/runs/current-confirmed-run/retry',{method:'POST',headers:{'x-demo-user-email':'master@portal.local','content-type':'application/json'},body:'{}'});
    assert.equal(blocked.status,409);assert.match((await blocked.json()).error,/agendamento ainda não foi arquivada/);
    assert.equal(sent,0);
    assert.deepEqual(unexpected,[]);
    const after=JSON.parse(await readFile(stateFile,'utf8'));
    for(const key of ['processes','emailDeliveries','workflowRuns','formArchiveJobs','signatureJobs','auditLogs']){
      assert.deepEqual(after[key],before[key],key);
    }
  }finally{
    if(child.exitCode===null&&child.signalCode===null){
      const stopped=new Promise(resolve=>child.once('exit',resolve));child.kill('SIGTERM');await stopped;
    }
    await rm(directory,{recursive:true,force:true});
  }
});
