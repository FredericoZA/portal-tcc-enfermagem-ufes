import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';
import {ASTEN_STATUS_CHECK_INTERVAL_MS} from './workflow/astenAtaStatus';

function actualFunction(name:string){
 const server=readFileSync('server.ts','utf8');
 const start=server.indexOf(`  async function ${name}(`)>=0?server.indexOf(`  async function ${name}(`):server.indexOf(`  function ${name}(`);
 assert.ok(start>=0,name);
 return server.slice(start,server.indexOf('\n  }\n',start)+5).trim();
}
function compile(name:string,ports:Record<string,unknown>){
 return runInNewContext(ts.transpileModule(`(${actualFunction(name)})`,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,ports);
}

test('fallback real só consulta envelope existente e não grava estado idêntico nem despacha e-mail',async()=>{
 const calls:string[]=[],now=Date.now();let writes=0,archives=0;
 const process:any={id:'current',dataRevision:3,avaliacao:{status:'CONCLUIDO'}};
 const job:any={id:'existing-term',processId:process.id,documentType:'TERMO',provider:'ASTEN',providerEnvelopeId:'kept-id',status:'SENT',updatedAt:new Date(now-ASTEN_STATUS_CHECK_INTERVAL_MS).toISOString()};
 let verified='SENT';
 const check=compile('checkCurrentAstenEnvelope',{
  Date,astenStatusChecks:new Map(),ASTEN_STATUS_CHECK_INTERVAL_MS,
  currentAstenCheckDue:()=>true,
  getPersistentAstenConnection:async()=>({token:'test-only'}),
  callAsten:async(method:string,params:any)=>{calls.push(method);assert.equal(method,'getDadosEnvelope');assert.equal(params.idEnvelope,'kept-id');assert.equal(params.getLobs,'N');return{};},
  inferAstenJobStatus:()=>verified,
  persistPortalStateDurably:async()=>{writes++;},archiveSignatureJobAutomatically:async()=>{archives++;},
 });
 assert.equal(await check(process,job),true);assert.deepEqual(calls,['getDadosEnvelope']);assert.equal(writes,0);assert.equal(archives,0);
 verified='SIGNED';assert.equal(await check(process,job),true);assert.equal(job.status,'SIGNED');assert.equal(job.providerDispatchState,'SENT');assert.equal(writes,1);assert.equal(archives,1);
 calls.length=0;assert.equal(await check(process,job),true);assert.equal(calls.length,0,'assinatura já confirmada só retoma arquivo');assert.equal(writes,2);assert.equal(archives,2);
});

test('agendador real limita consulta a uma em andamento e respeita escopo de declaração da Presidência',async()=>{
 const process:any={id:'current'};
 const ata:any={id:'ata',documentType:'ATA'},term:any={id:'term',documentType:'TERMO'},declaration:any={id:'decl',documentType:'DECLARACAO'};
 const checked:string[]=[],scheduled=new Set();let releases=0;
 const schedule=compile('scheduleCurrentAstenCheck',{
  signatureJobsStore:[ata,term,declaration],processesStore:[process],scheduledAstenChecks:scheduled,
  currentAstenCheckDue:()=>true,acquireRuntimeRequest:async()=>()=>{releases++;},
  remotePersistenceQueue:Promise.resolve(),settlePreviousRuntimeWrites:(q:Promise<void>)=>q,
  getSupabaseRuntimeStatus:()=>({durablePersistenceReady:false}),
  checkCurrentAstenEnvelope:async(_process:any,job:any)=>{checked.push(job.id);},
  process:{env:{}},console,
 });
 for(let i=0;i<8;i++)schedule(process,['DECLARACAO']);
 await new Promise(resolve=>setImmediate(resolve));
 assert.deepEqual(checked,['decl']);assert.equal(releases,1);assert.equal(scheduled.size,0);
});
