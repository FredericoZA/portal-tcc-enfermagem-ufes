import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,writeFile,readFile,rm,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {DEMO_PROCESSES,DEMO_MEMBERSHIPS,INITIAL_SETTINGS} from '../src/services/demoSeed';
import {createProfessionalPdf} from './documents/simplePdf';
import {localReviewFilesEnabled} from './localReviewFiles';
test('local PDF adapter refuses production, remote persistence and missing explicit demo opt-in',()=>{
 const env={NODE_ENV:'development',PORTAL_PERSISTENCE_PROVIDER:'local_file',PORTAL_TEST_DOCUMENT_RENDERER:'true',PORTAL_LOCAL_REVIEW_DATA:'true',PORTAL_ALLOW_INSECURE_DEMO_AUTH:'true'};
 assert.equal(localReviewFilesEnabled(env),true);
 for(const patch of [{NODE_ENV:'production'},{VERCEL:'1'},{PORTAL_PERSISTENCE_PROVIDER:'supabase'},{PORTAL_TEST_DOCUMENT_RENDERER:'false'},{PORTAL_LOCAL_REVIEW_DATA:'false'},{PORTAL_ALLOW_INSECURE_DEMO_AUTH:'false'}])assert.equal(localReviewFilesEnabled({...env,...patch}),false);
});
test('HTTP local uploads persist real PDF bytes, enforce roles, version replacements and reject cross-process references',{timeout:45000},async()=>{
 const directory=await mkdtemp(path.join(tmpdir(),'portal-review-files-'));const p=structuredClone(DEMO_PROCESSES[0]);p.aluno1.email='presentation.test@edu.ufes.br';if(p.aluno2)p.aluno2.email='presentation.second@edu.ufes.br';p.banca=p.banca.filter(member=>member.email!==p.orientador.email);p.avaliacao={status:'PENDENTE'};p.acervo.submittedAt=undefined;p.defesa.localStatus='PENDENTE';
 const other={...structuredClone(p),id:'other-review',createdByEmail:'other@example.invalid'};other.aluno1.email='other.author@edu.ufes.br';if(other.aluno2)other.aluno2.email='other.second@edu.ufes.br';other.defesa.startAt='2026-12-31T14:00:00-03:00';
 await writeFile(path.join(directory,'portal-state.json'),JSON.stringify({settings:INITIAL_SETTINGS,processes:[p,other],memberships:DEMO_MEMBERSHIPS,signatureJobs:[]}));
 const port=48400+Math.floor(Math.random()*300),base=`http://127.0.0.1:${port}`;
 const start=()=>spawn(process.execPath,['--import','tsx','server.ts'],{cwd:process.cwd(),env:{...process.env,NODE_ENV:'development',PORT:String(port),HOST:'127.0.0.1',PORTAL_DATA_DIR:directory,PORTAL_PERSISTENCE_PROVIDER:'local_file',PORTAL_LOCAL_REVIEW_DATA:'true',PORTAL_ALLOW_INSECURE_DEMO_AUTH:'true',PORTAL_TEST_DOCUMENT_RENDERER:'true',PORTAL_ALLOW_LOCAL_OTP_STORE:'true',PORTAL_OTP_DELIVERY_MODE:'log',PORTAL_SESSION_SECRET:'local-pdf-test-0123456789abcdef-0123456789',PORTAL_OTP_PEPPER:'local-pdf-test-pepper-0123456789abcdef',ASTEN_INTEGRATION_ENABLED:'false',SUPABASE_URL:'',SUPABASE_SECRET_KEY:'',SUPABASE_SERVICE_ROLE_KEY:'',VERCEL:''},stdio:'ignore'});
 let child=start();
 const pdf=createProfessionalPdf({title:'FICTÍCIO',protocol:p.protocolo,body:'Teste sem validade.'});
 const upload=async(route:string,bytes:Buffer=pdf,email=p.aluno1.email)=>fetch(base+route,{method:'POST',headers:{'content-type':'application/json',...(email?{'x-demo-user-email':email}:{})},body:JSON.stringify({fileName:'teste.pdf',contentBase64:bytes.toString('base64')})});
 try{
  const deadline=Date.now()+20000;while(true){try{if((await fetch(base+'/api/health')).ok)break;}catch{}if(Date.now()>deadline||child.exitCode!==null)throw new Error('Servidor não iniciou');await new Promise(r=>setTimeout(r,100));}
  for(const field of [{protocolo:'TCC-2026-9876'},{createdAt:'2000-01-01T00:00:00.000Z'},{previousProtocols:[] }]){
   const response=await fetch(`${base}/api/processes/${p.id}`,{method:'PATCH',headers:{'content-type':'application/json','x-demo-user-email':'master@portal.local'},body:JSON.stringify(field)});
   assert.equal(response.status,400);assert.equal((await response.json()).code,'IMMUTABLE_PROCESS_IDENTITY');
  }
  const identityState=JSON.parse(await readFile(path.join(directory,'portal-state.json'),'utf8')).processes[0];assert.equal(identityState.protocolo,p.protocolo);assert.equal(identityState.createdAt,p.createdAt);
  const edited=await fetch(`${base}/api/processes/${p.id}`,{method:'PATCH',headers:{'content-type':'application/json','x-demo-user-email':'master@portal.local'},body:JSON.stringify({titulo:'Título alterado sem mudar os participantes legados'})});assert.equal(edited.status,200,await edited.clone().text());
  const presentationPatch={aluno1:{...p.aluno1,tratamento:'Aluna'},orientador:{...p.orientador,tratamento:'Professora',titulacao:'Doutora'}};
  const editPresentation=async(email:string,patch= presentationPatch)=>fetch(`${base}/api/processes/${p.id}`,{method:'PATCH',headers:{'content-type':'application/json',...(email?{'x-demo-user-email':email}:{})},body:JSON.stringify(patch)});
  assert.equal((await editPresentation('')).status,401);
  assert.equal((await editPresentation(p.aluno1.email)).status,200);
  const presented=await editPresentation('master@portal.local');assert.equal(presented.status,200,await presented.clone().text());
  const invalidTreatment=await editPresentation('master@portal.local',{...presentationPatch,aluno1:{...p.aluno1,tratamento:'Professor'}});assert.equal(invalidTreatment.status,400);
  const presentationState=JSON.parse(await readFile(path.join(directory,'portal-state.json'),'utf8'));
  assert.equal(presentationState.processes[0].aluno1.tratamento,'Aluna');assert.equal(presentationState.processes[0].orientador.titulacao,'Doutora');
  assert.ok(presentationState.auditLogs.some((log:any)=>log.processId===p.id&&log.actorEmail==='master@portal.local'&&JSON.stringify(log.after).includes('Professora')));
  const order=await fetch(`${base}/api/processes/${p.id}`,{method:'PATCH',headers:{'content-type':'application/json','x-demo-user-email':'master@portal.local'},body:JSON.stringify({authorOrder:'ALUNO_2_FIRST'})});assert.equal(order.status,200,await order.clone().text());
  const invalidOrder=await fetch(`${base}/api/processes/${p.id}`,{method:'PATCH',headers:{'content-type':'application/json','x-demo-user-email':'master@portal.local'},body:JSON.stringify({authorOrder:'DROP'})});assert.equal(invalidOrder.status,400);
  const orderState=JSON.parse(await readFile(path.join(directory,'portal-state.json'),'utf8'));assert.equal(orderState.processes[0].authorOrder,'ALUNO_2_FIRST');assert.equal(orderState.processes[0].aluno1.email,p.aluno1.email);assert.ok(orderState.auditLogs.some((log:any)=>log.processId===p.id&&log.after?.authorOrder==='ALUNO_2_FIRST'));
  const invalidParticipant=await fetch(`${base}/api/processes/${p.id}`,{method:'PATCH',headers:{'content-type':'application/json','x-demo-user-email':'master@portal.local'},body:JSON.stringify({orientador:{...p.orientador,email:p.aluno1.email}})});assert.equal(invalidParticipant.status,400);
  // Registry edits are tested before issuance; upload scenarios start with an archived ata.
  const stopped=new Promise(resolve=>child.once('exit',resolve));child.kill('SIGTERM');await stopped;
  const issuedState=JSON.parse(await readFile(path.join(directory,'portal-state.json'),'utf8'));
  issuedState.processes[0].avaliacao.status='CONCLUIDO';
  const invitationKey='1'.repeat(64), reviewDir=path.join(directory,'arquivos-demonstrativos');
  await mkdir(reviewDir);
  await writeFile(path.join(reviewDir,invitationKey+'.pdf'),pdf);
  await writeFile(path.join(reviewDir,invitationKey+'.json'),JSON.stringify({processId:p.id,artifactType:'CONVITE',fileName:'convite-teste.pdf',sha256:createHash('sha256').update(pdf).digest('hex')}));
  Object.assign(issuedState.processes[0].defesa,{localStatus:'CONFIRMADO',invitationDriveFileId:'local_review_'+invitationKey,invitationSentAt:undefined});
  issuedState.signatureJobs=[{id:'archived-ata',processId:p.id,documentType:'ATA',documentVersion:1,sourceDataRevision:issuedState.processes[0].dataRevision,status:'ARCHIVED',driveSignedFileId:'fixture-signed-ata'}];
  await writeFile(path.join(directory,'portal-state.json'),JSON.stringify(issuedState));child=start();
  const restartDeadline=Date.now()+20000;while(true){try{if((await fetch(base+'/api/health')).ok)break;}catch{}if(Date.now()>restartDeadline||child.exitCode!==null)throw new Error('Servidor não reiniciou');await new Promise(r=>setTimeout(r,100));}
  const privateHeaders={'x-demo-user-email':'master@portal.local'};
  const privateDocs=await fetch(`${base}/api/processes/${p.id}/documents`,{headers:privateHeaders});
  assert.equal(privateDocs.status,200);
  const invitation=(await privateDocs.json()).find((item:any)=>item.type==='CONVITE');
  assert.equal(invitation.status,'DISPONIVEL');
  const privatePdf=await fetch(base+invitation.driveDownloadUrl,{headers:privateHeaders});
  assert.equal(privatePdf.status,200);
  assert.deepEqual(Buffer.from(await privatePdf.arrayBuffer()),pdf);
  assert.equal((await fetch(base+invitation.driveDownloadUrl)).status,401);
  assert.equal((await fetch(`${base}/api/public/processes/${p.id}/documents/doc-convite/download`)).status,404);
  const route=`/api/processes/${p.id}/files/trabalho-completo`;
  assert.equal((await upload(route,pdf,'')).status,401);assert.equal((await upload(route,pdf,p.orientador.email)).status,403);assert.equal((await upload(route,Buffer.from('inválido'))).status,400);
  const r=await upload(route);assert.equal(r.status,201,await r.clone().text());const saved=await r.json();assert.match(saved.id,/^local_review_/);assert.equal(saved.version,1);
  const same=await upload(route);assert.equal(same.status,200);assert.equal((await same.json()).reused,true);
  const dl=await fetch(base+route+'/download',{headers:{'x-demo-user-email':p.aluno1.email}});assert.equal(dl.status,200);assert.deepEqual(Buffer.from(await dl.arrayBuffer()),pdf);
  assert.equal((await fetch(base+route+'/download')).status,401);assert.equal((await upload('/api/processes/other-review/files/trabalho-completo')).status,404);
  const next=createProfessionalPdf({title:'FICTÍCIO 2',protocol:p.protocolo,body:'Segunda versão.'});const replaced=await upload(route,next);assert.equal(replaced.status,201);assert.equal((await replaced.json()).version,2);
  const proof=await upload(`/api/processes/${p.id}/location-proof`);assert.equal(proof.status,404);assert.equal((await proof.json()).code,'API_NOT_FOUND');
  const state=JSON.parse(await readFile(path.join(directory,'portal-state.json'),'utf8'));assert.equal(state.processes[0].acervo.trabalhoCompletoVersion,2);assert.ok(state.auditLogs.some((log:any)=>log.action==='VERSAO_ARQUIVO_SUBSTITUIDA'));assert.equal(state.processes[0].defesa.locationProof,undefined);
 }finally{const exit=new Promise(r=>child.once('exit',r));if(child.exitCode===null){child.kill('SIGTERM');await exit;}await rm(directory,{recursive:true,force:true});}
});
