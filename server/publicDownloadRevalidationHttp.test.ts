import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,writeFile,readFile,rm,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {DEMO_PROCESSES,INITIAL_SETTINGS} from '../src/services/demoSeed';
import {publicPdfEtag} from './publicDownloadRevalidation';

test('HTTP revalidation avoids rereading an approved PDF and checks publication withdrawal before returning 304',{timeout:60000},async()=>{
 const directory=await mkdtemp(path.join(tmpdir(),'portal-public-revalidate-'));
 const bytes=Buffer.from('%PDF-1.4\nfixture for byte transfer test\n%%EOF');
 const hash=createHash('sha256').update(bytes).digest('hex'),key='d'.repeat(64);
 const p=structuredClone(DEMO_PROCESSES[0]);p.status='CONCLUIDO';p.dataRevision=2;p.acervo={...p.acervo,submittedAt:'2026-11-15T00:00:00Z',authorizationConfirmedAt:'2026-11-15T00:00:00Z',publishFullWork:true,publishExpandedAbstract:false,publicationState:'PUBLIC',publicationSyncedAt:'2026-11-15T00:00:00Z',publicationWithdrawnAt:undefined,trabalhoCompletoFileId:'local_review_'+key,publicFullWorkFileId:'public-copy',trabalhoCompletoSha256:hash};
 const jobs=['ATA','TERMO'].map(documentType=>({id:'archived-'+documentType,processId:p.id,documentType,documentVersion:1,sourceDataRevision:2,status:'ARCHIVED',driveSignedFileId:'signed-'+documentType}));
 await mkdir(path.join(directory,'arquivos-demonstrativos'));
 const file=path.join(directory,'arquivos-demonstrativos',key+'.pdf');await writeFile(file,bytes);
 await writeFile(path.join(directory,'arquivos-demonstrativos',key+'.json'),JSON.stringify({processId:p.id,artifactType:'TRABALHO_COMPLETO',fileName:'fixture.pdf',sha256:hash}));
 await writeFile(path.join(directory,'portal-state.json'),JSON.stringify({settings:INITIAL_SETTINGS,processes:[p],signatureJobs:jobs,auditLogs:[],memberships:[]}));
 const port=49000+Math.floor(Math.random()*500),base=`http://127.0.0.1:${port}`,route=base+`/api/public/processes/${p.id}/files/trabalho-completo/download`;
 let child:ReturnType<typeof spawn>|undefined;
 const start=async()=>{
 child=spawn(process.execPath,['--import','tsx','server.ts'],{cwd:process.cwd(),env:{...process.env,NODE_ENV:'development',DISABLE_HMR:'true',PORT:String(port),HOST:'127.0.0.1',PORTAL_DATA_DIR:directory,PORTAL_PERSISTENCE_PROVIDER:'local_file',PORTAL_LOCAL_REVIEW_DATA:'true',PORTAL_ALLOW_INSECURE_DEMO_AUTH:'true',PORTAL_TEST_DOCUMENT_RENDERER:'true',PORTAL_ALLOW_LOCAL_OTP_STORE:'true',PORTAL_ALLOW_LOCAL_SECRET_STORE:'true',PORTAL_OTP_DELIVERY_MODE:'log',PORTAL_SESSION_SECRET:'revalidate-test-0123456789abcdef-0123456789',PORTAL_OTP_PEPPER:'revalidate-test-pepper-0123456789abcdef',ASTEN_INTEGRATION_ENABLED:'false',SUPABASE_URL:'',SUPABASE_SECRET_KEY:'',SUPABASE_SERVICE_ROLE_KEY:'',VERCEL:''},stdio:'ignore'});
 const deadline=Date.now()+25000;while(true){try{if((await fetch(base+'/api/health')).ok)return;}catch{}if(Date.now()>deadline||child.exitCode!==null)throw new Error('Fixture did not start');await new Promise(r=>setTimeout(r,100));}
 };
 const stop=async()=>{if(child?.exitCode===null){const done=new Promise(r=>child!.once('exit',r));child.kill('SIGTERM');await done;}};
 try{
 await start();assert.deepEqual(await (await fetch(route+'?delivery=drive-links')).json(),{links:null});assert.equal((await fetch(route.replace('trabalho-completo','resumo-expandido')+'?delivery=drive-links')).status,404);const first=await fetch(route);assert.equal(first.status,200,await first.clone().text());assert.deepEqual(Buffer.from(await first.arrayBuffer()),bytes);assert.equal(first.headers.get('etag'),publicPdfEtag(hash));assert.match(first.headers.get('cache-control')!,/private.*no-cache/);
 await rm(file);const reused=await fetch(route,{headers:{'if-none-match':first.headers.get('etag')!}});assert.equal(reused.status,304);assert.equal((await reused.arrayBuffer()).byteLength,0);
 assert.equal((await fetch(route,{headers:{'if-none-match':publicPdfEtag('a'.repeat(64))!}})).status,502,'a different hash cannot skip the file read');
 await stop();const state=JSON.parse(await readFile(path.join(directory,'portal-state.json'),'utf8'));state.processes.find((row:any)=>row.id===p.id).acervo.publicationWithdrawnAt=new Date().toISOString();await writeFile(path.join(directory,'portal-state.json'),JSON.stringify(state));await start();
 assert.equal((await fetch(route+'?delivery=drive-links')).status,404);const revoked=await fetch(route,{headers:{'if-none-match':publicPdfEtag(hash)!}});assert.equal(revoked.status,404);assert.equal(revoked.headers.get('etag')===publicPdfEtag(hash),false);
 }finally{await stop();await rm(directory,{recursive:true,force:true});}
});
