import assert from 'node:assert/strict';
import test from 'node:test';
import {RuntimeSnapshotReadBudget,readSnapshotWithTransportRecovery,snapshotTransportFailure} from './runtimeSnapshotRead';
import {loadPortalRuntimeState,refreshPortalRuntimeState} from './supabase';

function environment(t:any,label:string,delta=false){
 for(const [key,value] of Object.entries({SUPABASE_URL:`https://${label}.invalid`,SUPABASE_SECRET_KEY:'fixture',PORTAL_PERSISTENCE_PROVIDER:'supabase',PORTAL_RUNTIME_AUDIT_DELTA:String(delta)})){
  const before=process.env[key];process.env[key]=value;t.after(()=>{if(before===undefined)delete process.env[key];else process.env[key]=before;});
 }
}
test('orçamento único de30s cobre espera e segunda leitura, sem multiplicar tentativasHTTP',async()=>{
 let now=0;const budget=new RuntimeSnapshotReadBudget(()=>now,async ms=>{now+=ms;});
 assert.equal(budget.timeout('state',20_000),20_000);
 now=20_000;assert.equal(budget.consumeTransportRetry(new DOMException('timeout','TimeoutError')),true);
 await budget.backoff(250);
 assert.equal(budget.timeout('state',20_000),9750);
 assert.equal(budget.consumeTransportRetry(new TypeError('fetch failed')),false);
 now=30_000;
 assert.throws(()=>budget.timeout('state',20_000),(error:any)=>error.code==='SUPABASE_SNAPSHOT_TIMEOUT');
 let calls=0;
 const expired=new RuntimeSnapshotReadBudget(()=>now,async ms=>{now+=ms;});
 await assert.rejects(readSnapshotWithTransportRecovery(async b=>{calls++;b.timeout('state',20_000);now+=30_001;return 'late';},expired),(error:any)=>error.code==='SUPABASE_SNAPSHOT_TIMEOUT');
 assert.equal(calls,1);
});
test('classificação de transporte exclui erros de dados e mensagens arbitrárias',()=>{
 assert.equal(snapshotTransportFailure(new TypeError('Cannot read properties of null')),null);
 assert.equal(snapshotTransportFailure(new SyntaxError('Unexpected token')),null);
 assert.equal(snapshotTransportFailure(Object.assign(new Error('denied'),{code:'SUPABASE_HTTP_403'})),null);
 assert.equal(snapshotTransportFailure(new TypeError('terminated')),'TRANSPORT');
});
for(const failure of ['fetch','body'] as const)test(`snapshot real retoma uma vez após falha de ${failure}, sem mutação`,async t=>{
 environment(t,`snapshot-${failure}`);let calls=0;
 t.mock.method(globalThis,'fetch',async(_url:any,options?:RequestInit)=>{
  calls++;assert.equal(options?.method,undefined);
  if(calls===1){
   if(failure==='fetch')throw new TypeError('fetch failed');
   return new Response(new ReadableStream({start(controller){controller.error(new DOMException('aborted','AbortError'));}}));
  }
  return Response.json([{revision:7,payload:{access:{allowed:false}}}]);
 });
 assert.deepEqual(await loadPortalRuntimeState(),{access:{allowed:false}});assert.equal(calls,2);
});
test('falha persistente de transporte é limitada a2leituras e não entrega cache antigo',async t=>{
 environment(t,'snapshot-no-stale');let calls=0;
 t.mock.method(globalThis,'fetch',async()=>Response.json([{revision:7,payload:{allowed:true}}]));
 await loadPortalRuntimeState();
 t.mock.method(globalThis,'fetch',async()=>{calls++;throw new TypeError('terminated');});
 await assert.rejects(loadPortalRuntimeState(),(error:any)=>error.code==='SUPABASE_SNAPSHOT_TRANSPORT'&&!error.message.includes('terminated'));
 assert.equal(calls,2);
 await assert.rejects(refreshPortalRuntimeState());
});
for(const rejection of ['401','403','json','payload','revision','57014'] as const)test(`snapshot não acrescenta retomada para rejeição ${rejection}`,async t=>{
 environment(t,`snapshot-rejection-${rejection}`);let calls=0;
 t.mock.method(globalThis,'fetch',async()=>{
  calls++;
  if(rejection==='401'||rejection==='403')return Response.json({code:'42501'},{status:Number(rejection)});
  if(rejection==='json')return new Response('{');
  if(rejection==='payload')return Response.json([{revision:7,payload:[]}]);
  if(rejection==='revision')return Response.json([{revision:0,payload:{}}]);
  return Response.json({code:'57014'},{status:500});
 });
 await assert.rejects(loadPortalRuntimeState());
 assert.equal(calls,rejection==='57014'?3:1);
});
test('uma retomada de rede não reinicia o limite3 das tentativasHTTP5xx',async t=>{
 environment(t,'snapshot-mixed-errors');let calls=0;
 t.mock.method(globalThis,'fetch',async()=>{calls++;if(calls===1)throw new TypeError('fetch failed');return Response.json({code:'57014'},{status:500});});
 await assert.rejects(loadPortalRuntimeState(),(error:any)=>error.code==='SUPABASE_57014');
 assert.equal(calls,3);
});
test('restoreAuditChunks inválido não é erro de transporte nem solicita outro snapshot',async t=>{
 environment(t,'snapshot-invalid-chunks',true);let calls=0;
 t.mock.method(globalThis,'fetch',async()=>Response.json([{revision:7,payload:{auditLogs:[{id:'private'}]}}]));
 await loadPortalRuntimeState();
 t.mock.method(globalThis,'fetch',async()=>{calls++;return Response.json([{revision:8,payload:{},audit_chunks:[{fingerprint:'a'.repeat(64)}]}]);});
 await assert.rejects(loadPortalRuntimeState(),/Bloco.*ausente/);assert.equal(calls,1);
});
test('fallback RPCtimeout→canônico consome a única recuperação de transporte',async t=>{
 environment(t,'snapshot-warm-one-recovery',true);let calls=0;
 t.mock.method(globalThis,'fetch',async()=>Response.json([{revision:7,payload:{auditLogs:[]}}]));
 await loadPortalRuntimeState();
 t.mock.method(globalThis,'fetch',async(url:any)=>{
  calls++;
  if(String(url).includes('/rpc/'))throw new DOMException('timeout','TimeoutError');
  return new Response(new ReadableStream({start(controller){controller.error(new TypeError('terminated'));}}));
 });
 await assert.rejects(loadPortalRuntimeState(),(error:any)=>error.code==='SUPABASE_SNAPSHOT_TRANSPORT');
 assert.equal(calls,2,'não acrescenta outro GET depois do fallback existente');
});
