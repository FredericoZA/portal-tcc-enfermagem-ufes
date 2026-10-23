import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {spawn,type ChildProcess} from 'node:child_process';
import {createHash} from 'node:crypto';
import {DEMO_PROCESSES,INITIAL_SETTINGS} from '../src/services/demoSeed';
import {pdfWithTestSignature} from '../scripts/fixtures/govbr-test-pdf.mjs';

test('Gov.br HTTP isolado: permissões, PDF pendente, conferência por hash, arquivo exato e auditoria durável', {timeout:90_000},async()=>{
  const directory=await mkdtemp(path.join(tmpdir(),'portal-govbr-test-'));
  const port=41000+Math.floor(Math.random()*1500),base=`http://127.0.0.1:${port}`;
  const fixture=structuredClone(DEMO_PROCESSES.find(item=>item.id==='demo-proc-3')!);
  Object.assign(fixture,{id:'govbr-test',protocolo:'TESTE-GOV-1',dataRevision:1,etapaAtual:'ASSINATURA',status:'AGUARDANDO_ASSINATURA'});
  fixture.avaliacao.status='CONCLUIDO';fixture.acervo={palavrasChave:['um','dois','tres','quatro','cinco'],resumoSintese:'Resumo de teste.',trabalhoCompletoFileUrl:'/private/test.pdf',submittedAt:new Date().toISOString(),publishFullWork:false,publishExpandedAbstract:false};
  const ataFixture={...structuredClone(fixture),id:'govbr-ata',protocolo:'TESTE-GOV-ATA',acervo:undefined};
  const conflicting={...structuredClone(fixture),id:'govbr-conflict',protocolo:'TESTE-GOV-2'};
  const archivedAta=(processId:string)=>({id:`ata-${processId}`,processId,documentType:'ATA',documentVersion:1,sourceDataRevision:1,status:'ARCHIVED',driveSignedFileId:'fixture-ata',updatedAt:new Date().toISOString(),createdAt:new Date().toISOString(),signers:[]});
  await writeFile(path.join(directory,'portal-state.json'),JSON.stringify({settings:{...INITIAL_SETTINGS,featureFlags:INITIAL_SETTINGS.featureFlags?.map(flag=>flag.key==='PUBLIC_AUTHENTICITY'?{...flag,enabled:true}:flag),commissionPresidentName:'Presidente de Teste',documentModels:{ATA:{type:'ATA',driveFileId:'fixture-model-ata'},DECLARACAO:{type:'DECLARACAO',driveFileId:'fixture-model'}}},processes:[fixture,conflicting,ataFixture],memberships:[{id:'ata-advisor',processId:ataFixture.id,email:ataFixture.orientador.email,roles:['ADVISOR'],active:true}],signatureJobs:[archivedAta(fixture.id),archivedAta(conflicting.id),{id:'asten-sent',processId:conflicting.id,documentType:'DECLARACAO',sourceDataRevision:1,provider:'ASTEN',status:'SENT',providerEnvelopeId:'123',documentVersion:1,updatedAt:new Date().toISOString()}]}));
  let child:ChildProcess|undefined;let logs='';
  const start=async()=>{
    child=spawn(process.execPath,['--import','tsx','server.ts'],{cwd:process.cwd(),env:{...process.env,NODE_ENV:'development',PORT:String(port),HOST:'127.0.0.1',PORTAL_DATA_DIR:directory,PORTAL_PERSISTENCE_PROVIDER:'local_file',PORTAL_ALLOW_INSECURE_DEMO_AUTH:'true',PORTAL_TEST_DOCUMENT_RENDERER:'true',ASTEN_INTEGRATION_ENABLED:'false',PORTAL_SESSION_SECRET:'govbr-test-session-secret-0123456789',SUPABASE_URL:'',SUPABASE_SECRET_KEY:'',SUPABASE_SERVICE_ROLE_KEY:'',VERCEL:''},stdio:['ignore','pipe','pipe']});
    child.stdout?.on('data',data=>{logs+=data;});child.stderr?.on('data',data=>{logs+=data;});
    for(let i=0;i<150;i++){
      if(child.exitCode!==null)throw new Error(`Servidor de teste encerrou: ${logs.slice(-1500)}`);
      try{const response=await fetch(`${base}/api/health`);if(response.ok)return;}catch{/* startup */}
      await new Promise(resolve=>setTimeout(resolve,100));
    }
    throw new Error(`Servidor de teste indisponível: ${logs.slice(-1500)}`);
  };
  const stop=async()=>{if(child&&child.exitCode===null){const exited=new Promise(resolve=>child!.once('exit',resolve));child.kill('SIGTERM');await exited;}};
  const request=async(url:string,body?:unknown,user='master@portal.local')=>{
    const response=await fetch(`${base}${url}`,{method:body===undefined?'GET':'POST',headers:{'content-type':'application/json',...(user?{'x-demo-user-email':user}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});
    return {status:response.status,body:await response.json()};
  };
  try{
    await start();
    const preflight='/api/president/declarations/asten-preflight';
    assert.equal((await request(preflight,{processIds:[fixture.id]},'')).status,401);
    assert.equal((await request(preflight,{processIds:[fixture.id]},fixture.aluno1.email)).status,403);
    assert.equal((await request(preflight,{processIds:[]})).status,400);
    const checked=await request(preflight,{processIds:[fixture.id,conflicting.id]});
    assert.equal(checked.status,200);assert.equal(checked.body[0].ready,true);assert.equal(checked.body[1].ready,false);
    const prepare='/api/processes/govbr-test/documents/DECLARACAO/sign';
    assert.equal((await request(prepare,{provider:'GOV_BR'},'')).status,401);
    assert.equal((await request(prepare,{provider:'GOV_BR'},fixture.aluno1.email)).status,404);
    assert.equal((await request('/api/processes/govbr-conflict/documents/DECLARACAO/sign',{provider:'GOV_BR'})).status,409);
    const prepared=await request(prepare,{provider:'GOV_BR'});assert.equal(prepared.status,200,JSON.stringify(prepared.body));
    const job=prepared.body.job;assert.equal(job.status,'READY_FOR_REVIEW');
    assert.equal((await request(prepare,{provider:'GOV_BR'})).body.job.id,job.id);
    const endpoint=`/api/signatures/jobs/${job.id}/govbr`;
    assert.equal((await request(`${endpoint}/download`,undefined,'')).status,401);
    assert.equal((await request(`${endpoint}/download`,undefined,fixture.aluno1.email)).status,403);
    const original=Buffer.from(await(await fetch(`${base}${endpoint}/download`,{headers:{'x-demo-user-email':'master@portal.local'}})).arrayBuffer());
    assert.equal(createHash('sha256').update(original).digest('hex'),job.contentSha256);
    assert.equal((await request(`${endpoint}/complete`,{fileName:'original.pdf',contentBase64:original.toString('base64')})).status,409);
    assert.equal((await request(`${endpoint}/complete`,{fileName:'alterado.pdf',contentBase64:(await pdfWithTestSignature(original,{alterContent:true})).toString('base64')})).status,409);
    const returned=await pdfWithTestSignature(original);
    const received=await request(`${endpoint}/complete`,{fileName:'declaracao-assinada-TESTE.pdf',contentBase64:returned.toString('base64')});
    assert.equal(received.status,200,JSON.stringify(received.body));assert.equal(received.body.status,'READY_FOR_REVIEW');assert.equal(received.body.driveSignedFileId,undefined);
    const sha256=received.body.govbrReview.sha256;
    assert.equal((await request(`${endpoint}/approve`,{sha256,itiApproved:true,signerMatches:false,documentMatches:true})).status,409);
    assert.equal((await request(`${endpoint}/approve`,{sha256:'0'.repeat(64),itiApproved:true,signerMatches:true,documentMatches:true})).status,409);
    const confirmation={sha256,itiApproved:true,signerMatches:true,documentMatches:true};
    const approved=await request(`${endpoint}/approve`,confirmation);assert.equal(approved.status,200,JSON.stringify(approved.body));assert.equal(approved.body.status,'ARCHIVED');assert.equal(approved.body.govbrReview.method,'MANUAL_VALIDAR_ITI');assert.equal(approved.body.govbrReview.approvedBy,'master@portal.local');
    assert.equal(approved.body.signers[0].signedAt,undefined,'conferência manual não inventa horário do certificado');
    const verification=await request(`/api/public/verification/${job.verificationCode}`);
    assert.equal(verification.status,200);assert.equal(verification.body.signatureValidationMethod,'MANUAL_VALIDAR_ITI');assert.equal(verification.body.signedAt,null);
    assert.equal((await request(`${endpoint}/complete`,{fileName:'outra.pdf',contentBase64:returned.toString('base64')})).status,409);
    assert.equal((await request('/api/processes/govbr-test/documents/DECLARACAO/sign',{provider:'ASTEN'})).status,409);
    const archivedDownload=await fetch(`${base}/api/processes/govbr-test/documents/doc-declaracao/download`,{headers:{'x-demo-user-email':'master@portal.local'}});
    assert.equal(archivedDownload.status,200);assert.deepEqual(Buffer.from(await archivedDownload.arrayBuffer()),returned);
    const ataPrepared=await request('/api/processes/govbr-ata/documents/ATA/sign',{provider:'GOV_BR'},ataFixture.orientador.email);
    assert.equal(ataPrepared.status,200,JSON.stringify(ataPrepared.body));
    const ataEndpoint=`/api/signatures/jobs/${ataPrepared.body.job.id}/govbr`;
    const ataOriginal=Buffer.from(await(await fetch(`${base}${ataEndpoint}/download`,{headers:{'x-demo-user-email':ataFixture.orientador.email}})).arrayBuffer());
    assert.equal(ataOriginal.subarray(0,5).toString(),'%PDF-');
    const ataReturned=await pdfWithTestSignature(ataOriginal);
    const ataReceived=await request(`${ataEndpoint}/complete`,{fileName:'ata-teste.pdf',contentBase64:ataReturned.toString('base64')},ataFixture.orientador.email);
    assert.equal(ataReceived.status,200,JSON.stringify(ataReceived.body));
    const ataApproval={sha256:ataReceived.body.govbrReview.sha256,itiApproved:true,signerMatches:true,documentMatches:true};
    assert.equal((await request(`${ataEndpoint}/approve`,ataApproval,ataFixture.orientador.email)).status,403);
    assert.equal((await request(`${ataEndpoint}/approve`,ataApproval)).body.status,'ARCHIVED');
    await stop();await start();
    assert.equal((await request(`${endpoint}/approve`,confirmation)).body.status,'ARCHIVED');
    await stop();
    const state=JSON.parse(await readFile(path.join(directory,'portal-state.json'),'utf8'));
    const events=state.auditLogs.filter((item:{action:string;processId?:string})=>item.action==='GOVBR_CONFERENCIA_MANUAL_APROVADA'&&item.processId===fixture.id);
    assert.equal(events.length,1);assert.equal(events[0].after.signedSha256,sha256);assert.equal(events[0].after.originalSha256,job.contentSha256);
    state.processes.find((item:{id:string})=>item.id===fixture.id).dataRevision++;
    await writeFile(path.join(directory,'portal-state.json'),JSON.stringify(state));await start();
    assert.equal((await request(`${endpoint}/approve`,confirmation)).status,409);
  }finally{await stop();await rm(directory,{recursive:true,force:true});}
});
