import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,writeFile,readFile,rm,access} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import type {ProcessData} from '../src/types';
import {DEMO_PROCESSES,INITIAL_SETTINGS} from '../src/services/demoSeed';

async function textOf(bytes:ArrayBuffer){
 const {getDocument}=await import('pdfjs-dist/legacy/build/pdf.mjs');
 const task=getDocument({data:new Uint8Array(bytes),verbosity:0});
 const pdf=await task.promise;
 try{const pages=[];for(let i=1;i<=pdf.numPages;i++){const content=await(await pdf.getPage(i)).getTextContent();pages.push(content.items.map((item:any)=>item.str||'').join(' '));}return pages.join('\n');}finally{await task.destroy();}
}

function fixture():ProcessData{
 const p=structuredClone(DEMO_PROCESSES[0]);
 p.id='receipt-history-fixture';p.protocolo='TCC-2026-0880';p.previousProtocols=['OLD-RECEIPT-880'];
 p.status='AGUARDANDO_CONFIRMACAO_LOCAL';p.etapaAtual='CONFIRMACAO_LOCAL';p.titulo='Título Atual do Processo';
 p.aluno1={nome:'Autora Atual',email:'private-student@example.invalid',matricula:'PRIVATE-REGISTRATION-880'};
 p.aluno2=null;p.orientador.email='private-advisor@example.invalid';p.coorientador=null;
 p.defesa={startAt:'2026-12-17T17:00:00Z',endAt:'2026-12-17T18:30:00Z',local:'Auditório Atual',reservationRevision:2,localStatus:'PENDENTE',
  departmentResponse:{revision:2,decision:'CONFIRMED',startAt:'2026-12-17T17:00:00Z',endAt:'2026-12-17T18:30:00Z',local:'Auditório Atual',respondedAt:'2026-11-04T17:00:00Z',respondedBy:'private-responder@example.invalid',receiptBody:'Título: Título Atual do Processo\nAutor: Autora Atual\nLocal: Auditório Atual'},
  reservationHistory:[
   {reservationRevision:0,startAt:'2026-12-07T18:30:00Z',endAt:'2026-12-07T20:00:00Z',local:'Sala Histórica Recusada',invalidatedAt:'2026-11-02T12:00:00Z',invalidatedBy:'private-actor@example.invalid',receiptContext:{orientador:structuredClone(p.orientador),coorientador:null,banca:structuredClone(p.banca),titulo:'Título Histórico da Recusa',aluno1:{nome:'Autora Histórica',email:'private-original-student@example.invalid',matricula:'PRIVATE-ORIGINAL-REGISTRATION'},aluno2:null},departmentResponse:{revision:0,decision:'UNAVAILABLE',startAt:'2026-12-07T18:30:00Z',endAt:'2026-12-07T20:00:00Z',respondedAt:'2026-11-01T15:41:00Z',respondedBy:'private-original-responder@example.invalid',receiptBody:'Título: Título Histórico da Recusa\nAutor: Autora Histórica\nLocal: Sala Histórica Recusada'},locationProof:{driveFileId:'PRIVATE-DRIVE-FILE',fileName:'private-proof.pdf',version:1,sha256:'a'.repeat(64),uploadedAt:'2026-11-01T15:42:00Z',uploadedBy:'private-uploader@example.invalid',reservationRevision:0}},
   {reservationRevision:1,startAt:'2026-12-10T16:00:00Z',endAt:'2026-12-10T17:30:00Z',local:'Sala Histórica Autorizada',invalidatedAt:'2026-11-03T12:00:00Z',invalidatedBy:'private-actor@example.invalid',departmentResponse:{revision:1,decision:'CONFIRMED',startAt:'2026-12-10T16:00:00Z',endAt:'2026-12-10T17:30:00Z',local:'Sala Histórica Autorizada',respondedAt:'2026-11-02T14:00:00Z',respondedBy:'private-original-responder@example.invalid',receiptBody:'Título: Título Histórico do Aceite\nAutor: Autora Histórica\nLocal: Sala Histórica Autorizada'}},
   // A duplicate snapshot of the answered current revision is still one receipt.
   {reservationRevision:2,startAt:'2026-12-17T17:00:00Z',endAt:'2026-12-17T18:30:00Z',local:'Auditório Atual',invalidatedAt:'2026-11-04T17:01:00Z',invalidatedBy:'private-actor@example.invalid',departmentResponse:{revision:2,decision:'CONFIRMED',startAt:'2026-12-17T17:00:00Z',endAt:'2026-12-17T18:30:00Z',local:'Auditório Atual',respondedAt:'2026-11-04T17:00:00Z',respondedBy:'private-responder@example.invalid',receiptBody:''}}
  ]};
 return p;
}

test('HTTP: reservation receipt history exposes one safe summary per answer and selects the exact public PDF',{timeout:60000},async(t)=>{
 const directory=await mkdtemp(path.join(tmpdir(),'portal-receipt-history-http-'));
 const p=fixture(),pending=structuredClone(p),draft=structuredClone(p),other=structuredClone(p),empty=structuredClone(p),denied=structuredClone(p),legacyPrivacy=structuredClone(p);
 pending.id='pending-receipt-history';pending.protocolo='TCC-2026-0881';pending.previousProtocols=[];pending.defesa.reservationRevision=3;pending.defesa.departmentResponse=undefined;
 draft.id='draft-receipt-history';draft.protocolo='TCC-2026-0882';draft.previousProtocols=[];draft.status='EM_RASCUNHO';
 other.id='other-receipt-history';other.protocolo='TCC-2026-0883';other.previousProtocols=[];other.defesa.reservationHistory=[];other.defesa.departmentResponse!.revision=7;other.defesa.reservationRevision=7;
 empty.id='no-receipts';empty.protocolo='TCC-2026-0884';empty.previousProtocols=[];empty.defesa.reservationHistory=[];empty.defesa.departmentResponse=undefined;
 denied.id='denied-receipt-history';denied.protocolo='TCC-2026-0885';denied.previousProtocols=[];denied.defesa.departmentResponse!.decision='UNAVAILABLE';
 legacyPrivacy.id='legacy-private-identifiers';legacyPrivacy.protocolo='TCC-2026-0886';legacyPrivacy.previousProtocols=[];legacyPrivacy.defesa.reservationRevision=3;legacyPrivacy.defesa.departmentResponse=undefined;legacyPrivacy.defesa.reservationHistory=legacyPrivacy.defesa.reservationHistory!.slice(0,2);
 legacyPrivacy.defesa.reservationHistory![0].receiptContext=undefined;legacyPrivacy.defesa.reservationHistory![0].departmentResponse!.receiptBody='Título: Título Histórico da Recusa\nAutoria: 2022101234 - Nome Social Antigo';
 legacyPrivacy.defesa.reservationHistory![1].receiptContext=undefined;legacyPrivacy.defesa.reservationHistory![1].departmentResponse!.receiptBody='Título: Título Histórico do Aceite\nAutoria: REG2022-123 - Outro Nome Social';
 const statePath=path.join(directory,'portal-state.json'),networkMarker=path.join(directory,'external-request-attempt.txt');
 await writeFile(statePath,JSON.stringify({settings:INITIAL_SETTINGS,processes:[p,pending,draft,other,empty,denied,legacyPrivacy],memberships:[],emailDeliveries:[],signatureJobs:[]}));
 const port=47600+Math.floor(Math.random()*300),base=`http://127.0.0.1:${port}`;
 const safeEnvironment=Object.fromEntries(['PATH','HOME','TMPDIR','LANG','TZ'].filter(key=>process.env[key]).map(key=>[key,process.env[key]]));
 const boot="import dotenv from 'dotenv';import{appendFile}from'node:fs/promises';dotenv.config=()=>({parsed:{}});globalThis.fetch=async()=>{await appendFile(process.env.NETWORK_ATTEMPT_MARKER,'blocked\\n');throw Error('External HTTP disabled in receipt test');};await import('./server.ts');";
 const child=spawn(process.execPath,['--import','tsx','--input-type=module','-e',boot],{cwd:process.cwd(),env:{...safeEnvironment,NODE_ENV:'development',HOST:'127.0.0.1',PORT:String(port),PORTAL_PUBLIC_URL:base,APP_URL:base,PORTAL_DATA_DIR:directory,PORTAL_PERSISTENCE_PROVIDER:'local_file',PORTAL_ALLOW_LOCAL_SECRET_STORE:'true',PORTAL_ALLOW_LOCAL_OTP_STORE:'true',PORTAL_SESSION_SECRET:'receipt-history-fixture-session-0123456789',PORTAL_OTP_PEPPER:'receipt-history-fixture-otp-0123456789012',ASTEN_INTEGRATION_ENABLED:'false',SUPABASE_URL:'',SUPABASE_SECRET_KEY:'',SUPABASE_SERVICE_ROLE_KEY:'',VERCEL:'',NETWORK_ATTEMPT_MARKER:networkMarker},stdio:'ignore'});
 const list=(protocol=p.protocolo)=>fetch(`${base}/api/public/processes/${encodeURIComponent(protocol)}/reservation-receipts`);
 const receipt=(id?:string,protocol=p.protocolo)=>fetch(`${base}/api/public/processes/${encodeURIComponent(protocol)}/reservation-receipt${id===undefined?'':`?receipt=${encodeURIComponent(id)}`}`);
 try{
  const deadline=Date.now()+25000;while(true){try{if((await fetch(base+'/api/health')).ok)break;}catch{}if(Date.now()>deadline||child.exitCode!==null)throw Error('Isolated receipt HTTP server did not start');await new Promise(r=>setTimeout(r,100));}
  await t.test('public index deduplicates revisions, preserves outcomes and omits private fields',async()=>{
   const response=await list();assert.equal(response.status,200);assert.match(response.headers.get('cache-control')||'',/no-store/);
   const body=await response.json();assert.equal(body.currentStatus,'CONFIRMADO');assert.deepEqual(body.items.map((item:any)=>item.id),['revision-2','revision-1','revision-0']);assert.deepEqual(body.items.map((item:any)=>item.current),[true,false,false]);
   assert.deepEqual(body.items.map((item:any)=>item.decision),['CONFIRMED','CONFIRMED','UNAVAILABLE']);
   assert.doesNotMatch(JSON.stringify(body),/private-|PRIVATE-|respondedBy|receiptBody|sha256|driveFileId|invalidatedBy|matricula|@/);
   assert.match(body.items[2].url,/receipt=revision-0$/);
   for(const item of body.items)assert.deepEqual(Object.keys(item).sort(),['id','revision','decision','startAt','endAt','local','respondedAt','current','url'].sort());
   const alias=await list('OLD-RECEIPT-880');assert.equal(alias.status,200);assert.equal((await alias.json()).items.length,3);
   const view=await(await fetch(`${base}/api/public/processes/${p.protocolo}`)).json();assert.equal(view.defesa.hasReservationReceipt,true);assert.equal(view.defesa.reservationReceiptCount,3);
  });
  await t.test('selected historical refusal retains original date, location, title and author',async()=>{
   const response=await receipt('revision-0');assert.equal(response.status,200);assert.match(response.headers.get('content-type')||'',/application\/pdf/);assert.match(response.headers.get('content-disposition')||'',/revision-0\.pdf/);assert.equal(response.headers.get('x-content-type-options'),'nosniff');
   const text=await textOf(await response.arrayBuffer());assert.match(text,/RESERVA RECUSADA/);assert.match(text,/Título Histórico da Recusa/);assert.match(text,/Autor: Autora Histórica/);assert.match(text,/Sala Histórica Recusada/);assert.match(text,/segunda-feira, 7 de dezembro de 2026/);assert.match(text,/15:30 às 17:00/);
   assert.doesNotMatch(text,/Auditório Atual|Título Atual|private-|PRIVATE-|@/);
  });
  await t.test('selected historical acceptance and default current receipt remain distinct',async()=>{
   const old=await receipt('revision-1');assert.equal(old.status,200);const oldText=await textOf(await old.arrayBuffer());assert.match(oldText,/RESERVA CONFIRMADA/);assert.match(oldText,/Título Histórico do Aceite/);assert.match(oldText,/Sala Histórica Autorizada/);assert.doesNotMatch(oldText,/Auditório Atual|@/);
   const current=await receipt();assert.equal(current.status,200);assert.match(current.headers.get('content-disposition')||'',/0880-comprovante\.pdf/);const currentText=await textOf(await current.arrayBuffer());assert.match(currentText,/Título Atual do Processo/);assert.match(currentText,/Auditório Atual/);assert.doesNotMatch(currentText,/Histórica|PRIVATE-|private-|@/);
  });
  await t.test('pending revision still exposes previous receipts without presenting a current acceptance',async()=>{
   const body=await(await list(pending.protocolo)).json();assert.equal(body.currentStatus,'PENDENTE');assert.equal(body.items.length,3);assert.ok(body.items.every((item:any)=>item.current===false));
   const fallback=await receipt(undefined,pending.protocolo);assert.equal(fallback.status,200);assert.match(await textOf(await fallback.arrayBuffer()),/Auditório Atual/);
   const noHistory=await(await list(empty.protocolo)).json();assert.deepEqual(noHistory.items,[]);assert.equal(noHistory.currentStatus,'PENDENTE');assert.equal((await receipt(undefined,empty.protocolo)).status,404);
  });
  await t.test('a refusal overrides a stale pending flag and a duplicate historical acceptance',async()=>{
   const body=await(await list(denied.protocolo)).json();assert.equal(body.currentStatus,'RECUSADO');assert.equal(body.items.length,3);assert.equal(body.items[0].decision,'UNAVAILABLE');assert.equal(body.items[0].current,true);
   const current=await receipt(undefined,denied.protocolo);assert.equal(current.status,200);assert.match(await textOf(await current.arrayBuffer()),/RESERVA RECUSADA/);
  });
  await t.test('old author snapshots never expose registrations that differ from the current account',async()=>{
   for(const [revision,name] of [[0,'Nome Social Antigo'],[1,'Outro Nome Social']] as const){
    const response=await receipt(`revision-${revision}`,legacyPrivacy.protocolo);assert.equal(response.status,200);
    const text=await textOf(await response.arrayBuffer());assert.match(text,new RegExp(name));assert.doesNotMatch(text,/2022101234|REG2022-123|PRIVATE-REGISTRATION-880|@/);
   }
  });
  await t.test('unknown, malformed, cross-process and draft selections do not fall back',async()=>{
   assert.equal((await receipt('revision-999')).status,404);assert.equal((await receipt('revision-0',other.protocolo)).status,404);assert.equal((await receipt('../../private')).status,404);
   assert.equal((await fetch(`${base}/api/public/processes/${p.protocolo}/reservation-receipt?receipt=revision-0&receipt=revision-1`)).status,400);assert.equal((await receipt('')).status,400);
   assert.equal((await list(draft.protocolo)).status,404);assert.equal((await receipt('revision-0',draft.protocolo)).status,404);assert.equal((await list('UNKNOWN-TCC')).status,404);
  });
  assert.equal(await access(networkMarker).then(()=>true,()=>false),false,'the read-only index/PDF flow must never call a provider');
  const persisted=JSON.parse(await readFile(statePath,'utf8'));assert.deepEqual(persisted.processes,JSON.parse(JSON.stringify([p,pending,draft,other,empty,denied,legacyPrivacy])),'GETs must not rewrite process facts or history');assert.equal(persisted.emailDeliveries.length,0);assert.equal(persisted.signatureJobs.length,0);
 }finally{if(child.exitCode===null){const stopped=new Promise(r=>child.once('exit',r));child.kill('SIGTERM');await stopped;}await rm(directory,{recursive:true,force:true});}
});
