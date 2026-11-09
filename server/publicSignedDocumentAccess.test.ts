import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {spawn} from 'node:child_process';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {PDFDocument,StandardFonts} from 'pdf-lib';
import {DEMO_PROCESSES,INITIAL_SETTINGS} from '../src/services/demoSeed';
import {storeReviewPdf} from './localReviewFiles';
import type {SignatureJob} from '../src/types/signatures';

async function fixturePdf(text:string){
 const document=await PDFDocument.create(),font=await document.embedFont(StandardFonts.Helvetica);
 document.addPage().drawText(text,{x:40,y:700,font,size:12,maxWidth:500,lineHeight:18});
 return Buffer.from(await document.save());
}

test('HTTP: PDF arquivado do Asten fica público sem regravar assinatura ou liberar arquivos acadêmicos',{timeout:40000},async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'portal-public-signed-')),port=43000+Math.floor(Math.random()*500),base=`http://127.0.0.1:${port}`;
 const env:NodeJS.ProcessEnv={PATH:process.env.PATH,NODE_ENV:'development',HOST:'127.0.0.1',PORT:String(port),PORTAL_DATA_DIR:dir,PORTAL_PUBLIC_URL:base,APP_URL:base,PORTAL_PERSISTENCE_PROVIDER:'local_file',PORTAL_ALLOW_INSECURE_DEMO_AUTH:'true',PORTAL_TEST_DOCUMENT_RENDERER:'true',PORTAL_LOCAL_REVIEW_DATA:'true',ASTEN_INTEGRATION_ENABLED:'false',PORTAL_SESSION_SECRET:'public-signed-fixture-secret-0123456789',SUPABASE_URL:'',SUPABASE_SECRET_KEY:'',SUPABASE_SERVICE_ROLE_KEY:'',VERCEL:''};
 const localKeys=['NODE_ENV','PORTAL_DATA_DIR','PORTAL_ALLOW_INSECURE_DEMO_AUTH','PORTAL_LOCAL_REVIEW_DATA','PORTAL_TEST_DOCUMENT_RENDERER','PORTAL_PERSISTENCE_PROVIDER','VERCEL'] as const;
 const original=new Map(localKeys.map(key=>[key,process.env[key]]));let child:ReturnType<typeof spawn>|undefined;
 try{
  for(const key of localKeys)process.env[key]=env[key];
  const processData=structuredClone(DEMO_PROCESSES[0]);
  processData.id='signed-public-fixture';processData.protocolo='TCC-2026-7711';processData.status='CONCLUIDO';processData.etapaAtual='CONCLUIDO';
  processData.aluno1.email='autora@example.invalid';processData.aluno1.matricula='9988776655';processData.avaliacao={status:'CONCLUIDO',resultadoCode:'REPROVADO',resultadoLabel:'Texto interno que não deve sair no DTO',parecer:'Parecer interno não publicado no DTO'};
  processData.acervo={...processData.acervo,publishFullWork:false,publishExpandedAbstract:false} as typeof processData.acervo;
  const bytes=await fixturePdf('Ata da defesa de Ana Silva. Registro institucional da defesa e das assinaturas.');
  const hash=createHash('sha256').update(bytes).digest('hex');
  const file=storeReviewPdf({processId:processData.id,artifactType:'ATA',fileName:'ata-assinada.pdf',pdf:bytes,sha256:hash});
  const job={id:'archived-asten-fixture',processId:processData.id,protocol:processData.protocolo,documentType:'ATA',documentTitle:'Ata',documentVersion:1,sourceDataRevision:processData.dataRevision,provider:'ASTEN',status:'ARCHIVED',driveSignedFileId:file.id,signedSha256:hash,contentSha256:hash,createdAt:'2026-11-04T12:00:00Z',updatedAt:'2026-11-04T12:00:00Z',completedAt:'2026-11-04T12:00:00Z',signers:[]} as SignatureJob;
  const pending=structuredClone(processData);pending.id='pending-public-fixture';pending.protocolo='TCC-2026-7712';pending.status='AGUARDANDO_ASSINATURA';pending.etapaAtual='ASSINATURA';
  const pendingJob={...job,id:'pending-asten-fixture',processId:pending.id,protocol:pending.protocolo,status:'PARTIALLY_SIGNED',driveSignedFileId:undefined,signers:[{id:'private-signer',name:'PRIVATE SIGNER',email:'private-signer@example.invalid',role:'ADVISOR',status:'SIGNED',signingOrder:1},{id:'private-pending',name:'PRIVATE PENDING',email:'private-pending@example.invalid',role:'EXAMINER',status:'WAITING',signingOrder:1}]} as SignatureJob;
  const restricted={...structuredClone(processData),id:'restricted-signed-fixture',protocolo:'TCC-2026-7713'};
  const restrictedBytes=await fixturePdf('Ata da defesa de Ana Silva. Matricula: 9988776655.\nE-mail da signataria: docente@example.invalid.');
  const restrictedHash=createHash('sha256').update(restrictedBytes).digest('hex');
  const restrictedFile=storeReviewPdf({processId:restricted.id,artifactType:'ATA',fileName:'ata-restrita.pdf',pdf:restrictedBytes,sha256:restrictedHash});
  const restrictedJob={...job,id:'restricted-asten-fixture',processId:restricted.id,protocol:restricted.protocolo,driveSignedFileId:restrictedFile.id,signedSha256:restrictedHash,contentSha256:restrictedHash};
  const awaitingSchedule={...structuredClone(pending),id:'awaiting-schedule-fixture',protocolo:'TCC - 00001',status:'AGUARDANDO_CONFIRMACAO_LOCAL' as const,etapaAtual:'CONFIRMACAO_LOCAL' as const};
  awaitingSchedule.defesa={...awaitingSchedule.defesa,startAt:'',endAt:'',localStatus:'PENDENTE'};
  awaitingSchedule.acervo={...processData.acervo!,resumoSintese:'Resumo ainda em edição',palavrasChave:['palavra-privada']};
  const draft={...awaitingSchedule,id:'private-draft-fixture',protocolo:'TCC - 00003',status:'EM_RASCUNHO' as const};
  await writeFile(path.join(dir,'portal-state.json'),JSON.stringify({settings:INITIAL_SETTINGS,processes:[processData,pending,restricted,awaitingSchedule,draft],signatureJobs:[job,pendingJob,restrictedJob],memberships:[]}));
  const bootstrap=path.join(dir,'start-fixture.mjs');
  await writeFile(bootstrap,`import dotenv from ${JSON.stringify(import.meta.resolve('dotenv'))};dotenv.config=()=>({parsed:{}});await import(${JSON.stringify(pathToFileURL(path.join(process.cwd(),'server.ts')).href)});`);
  child=spawn(process.execPath,['--import','tsx',bootstrap],{cwd:process.cwd(),env,stdio:'ignore'});
  const deadline=Date.now()+20000;
  while(true){try{if((await fetch(base+'/api/health')).ok)break;}catch{}if(Date.now()>deadline||child.exitCode!==null)throw Error('Fixture failed to start');await new Promise(resolve=>setTimeout(resolve,100));}
  const detail=await fetch(`${base}/api/public/processes/${processData.protocolo}`);assert.equal(detail.status,200);
  const publicData=await detail.json(),ata=publicData.documents.find((document:{type:string})=>document.type==='ATA');
  assert.ok(ata);assert.equal(ata.signatureProvider,'ASTEN');assert.equal(publicData.canAccessPrivate,false);assert.doesNotMatch(JSON.stringify(publicData),/docente@example|autora@example|9988776655|local_review_|Texto interno|Parecer interno/);
  assert.deepEqual(publicData.avaliacao,{status:'CONCLUIDO',resultadoCode:'REPROVADO',resultadoLabel:'Reprovado'});
  const repository=await (await fetch(`${base}/api/public/repository`)).json();
  assert.deepEqual(repository.find((entry:{id:string})=>entry.id===processData.protocolo).avaliacao,{status:'CONCLUIDO'});
  const unscheduled=repository.find((entry:{id:string})=>entry.id===awaitingSchedule.protocolo);
  assert.equal(unscheduled.status,'AGUARDANDO_CONFIRMACAO_LOCAL');
  assert.equal(unscheduled.defesa.startAt,'');
  assert.equal(unscheduled.acervo.resumoSintese,undefined);
  assert.deepEqual(unscheduled.acervo.palavrasChave,[]);
  assert.ok(repository.some((entry:{id:string})=>entry.id===pending.protocolo));
  assert.ok(!repository.some((entry:{id:string})=>entry.id===draft.protocolo));
  const download=await fetch(base+ata.url);assert.equal(download.status,200);assert.match(download.headers.get('content-type')||'',/application\/pdf/);
  const received=Buffer.from(await download.arrayBuffer());assert.deepEqual(received,bytes);assert.equal(createHash('sha256').update(received).digest('hex'),hash);
  assert.equal((await fetch(`${base}/api/public/processes/${restricted.protocolo}/documents/doc-ata/download`)).status,404);
  const authorized=await fetch(`${base}/api/processes/${restricted.id}/documents/doc-ata/download`,{headers:{'x-demo-user-email':'master@portal.local'}});
  assert.equal(authorized.status,200);
  assert.deepEqual(Buffer.from(await authorized.arrayBuffer()),restrictedBytes);
  const pendingDetail=await (await fetch(`${base}/api/public/processes/${pending.protocolo}`)).json();assert.equal(pendingDetail.documents.some((document:{type:string})=>document.type==='ATA'),false);assert.deepEqual(pendingDetail.avaliacao,{status:'CONCLUIDO'});assert.equal(pendingDetail.documentProgress.ATA.signed,1);assert.equal(pendingDetail.documentProgress.ATA.total,2);assert.equal(pendingDetail.documentProgress.ATA.emailSent,true);assert.doesNotMatch(JSON.stringify(pendingDetail),/PRIVATE SIGNER|private-signer|private-pending|providerEnvelope|driveUnsigned|driveSigned|signers/);assert.ok(Array.isArray(pendingDetail.reservationReceipts));
  assert.equal((await fetch(`${base}/api/public/processes/${pending.protocolo}/documents/doc-ata/download`)).status,404);
  assert.equal((await fetch(`${base}/api/public/processes/${processData.protocolo}/documents/doc-termo/download`)).status,404);
  assert.equal((await fetch(`${base}/api/public/processes/${processData.protocolo}/files/trabalho-completo/download`)).status,404);
  assert.equal((await fetch(`${base}/api/processes/${processData.id}/documents`)).status,401);
  assert.equal((await fetch(`${base}/api/processes/${processData.id}/signatures`)).status,401);
 }finally{
  if(child&&child.exitCode===null){const done=new Promise(resolve=>child!.once('exit',resolve));child.kill('SIGTERM');await done;}
  for(const [key,value] of original){if(value===undefined)delete process.env[key];else process.env[key]=value;}
  await rm(dir,{recursive:true,force:true});
 }
});
