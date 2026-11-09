import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import type {AuditLog} from '../src/types';
import {auditLogPageReducer, auditLogPageView, initialAuditLogPageState, waitForAuditLogRetry} from '../src/utils/auditLogPageState';

const item = (id: string): AuditLog => ({id,action:'CRIACAO_PROCESSO',actorEmail:'master@example.invalid',actorRoles:['MASTER_ADMIN'],entityType:'processo',entityId:'process-1',timestamp:'2026-11-07T12:00:00Z'});
const page = (id='log-1', nextCursor:string|null=null) => ({items:[item(id)],total:2,nextCursor,focused:null});

test('falha inicial não afirma histórico vazio nem total zero; nova tentativa pode confirmar vazio', () => {
  let state=initialAuditLogPageState();
  state=auditLogPageReducer(state,{type:'start',key:'master-a',requestId:1,mode:'replace'});
  state=auditLogPageReducer(state,{type:'failure',key:'master-a',requestId:1,message:'Falha na consulta'});
  let view=auditLogPageView(state,'master-a');
  assert.equal(view.total,null);assert.equal(view.showCount,false);assert.equal(view.showEmpty,false);assert.equal(view.loading,false);
  assert.equal(view.error,'Falha na consulta');
  state=auditLogPageReducer(state,{type:'start',key:'master-a',requestId:2,mode:'replace'});
  state=auditLogPageReducer(state,{type:'success',key:'master-a',requestId:2,page:{items:[],total:0,nextCursor:null}});
  view=auditLogPageView(state,'master-a');
  assert.equal(view.showEmpty,true);assert.equal(view.showCount,true);assert.equal(view.total,0);assert.equal(view.error,'');
});

test('troca de identidade ou filtros oculta imediatamente linhas, cursores, erros e totais antigos', () => {
  let state=auditLogPageReducer(initialAuditLogPageState(),{type:'start',key:'master-a|filtro-a',requestId:1,mode:'replace'});
  state=auditLogPageReducer(state,{type:'success',key:'master-a|filtro-a',requestId:1,page:page('private-a','cursor-a')});
  for(const key of ['master-b|filtro-a','master-a|filtro-b','']){
    const view=auditLogPageView(state,key);
    assert.deepEqual(view.items,[]);assert.equal(view.total,null);assert.equal(view.nextCursor,null);assert.equal(view.error,'');assert.equal(view.showCount,false);
  }
  assert.equal(auditLogPageView(state,'master-a|filtro-a').items[0].id,'private-a');
});

test('resposta e falha antigas não sobrescrevem a consulta mais recente', () => {
  let state=auditLogPageReducer(initialAuditLogPageState(),{type:'start',key:'current',requestId:1,mode:'replace'});
  state=auditLogPageReducer(state,{type:'start',key:'current',requestId:2,mode:'replace'});
  state=auditLogPageReducer(state,{type:'success',key:'current',requestId:2,page:page('new')});
  const current=state;
  for(const action of [
    {type:'failure' as const,key:'current',requestId:1,message:'old failure'},
    {type:'success' as const,key:'current',requestId:1,page:page('old')},
    {type:'success' as const,key:'other-account',requestId:2,page:page('other-account')},
  ])assert.equal(auditLogPageReducer(state,action),current);
});

test('falha de paginação preserva só a consulta confirmada e retoma o mesmo cursor sem duplicar linhas', () => {
  let state=auditLogPageReducer(initialAuditLogPageState(),{type:'start',key:'master-a',requestId:1,mode:'replace'});
  state=auditLogPageReducer(state,{type:'success',key:'master-a',requestId:1,page:page('new','older-cursor')});
  state=auditLogPageReducer(state,{type:'start',key:'master-a',requestId:2,mode:'append',before:'older-cursor'});
  state=auditLogPageReducer(state,{type:'failure',key:'master-a',requestId:2,message:'Falhou a página anterior'});
  let view=auditLogPageView(state,'master-a');
  assert.deepEqual(view.items.map(log=>log.id),['new']);assert.equal(view.retryBefore,'older-cursor');assert.equal(view.showCount,false);assert.equal(view.showEmpty,false);
  state=auditLogPageReducer(state,{type:'start',key:'master-a',requestId:3,mode:'append',before:view.retryBefore});
  state=auditLogPageReducer(state,{type:'success',key:'master-a',requestId:3,page:{items:[item('new'),item('older')],total:2,nextCursor:null}});
  view=auditLogPageView(state,'master-a');assert.deepEqual(view.items.map(log=>log.id),['new','older']);assert.equal(view.error,'');assert.equal(view.showCount,true);
});

/** Execute the real page's async GET handler, with only React state and transport replaced. */
function handlerHarness(fetchPage:(filters:unknown, signal:AbortSignal)=>Promise<unknown>){
  const source=readFileSync('src/pages/AuditLogsPage.tsx','utf8');
  const start=source.indexOf('  const load = useCallback(');
  const end=source.indexOf('\n  useEffect(',start);
  assert.ok(start>=0&&end>start);
  let state=initialAuditLogPageState();
  let selected:any=null;
  class ApiRequestError extends Error {constructor(message:string,readonly status:number,readonly code?:string,readonly issues?:unknown,readonly retryAfterSeconds?:number){super(message);}}
  const context={
    processId:undefined,identityKey:'master-a',queryKey:'master-a|filters',currentQueryKey:{current:'master-a|filters'},request:{current:null as AbortController|null},requestSequence:{current:0},
    search:'',kind:'all',startDate:'',endDate:'',AbortController,ApiRequestError,
    useCallback:(fn:unknown)=>fn,
    waitForAuditLogRetry: async (_signal:AbortSignal,_milliseconds:number)=>{},
    apiClient:{getAuditLogPage:fetchPage},
    dispatchPage:(action:any)=>{state=auditLogPageReducer(state,action);},
    setSelectedLogSelection:(fn:any)=>{selected=fn(selected);},
  };
  const code=ts.transpileModule(`(function(){${source.slice(start,end)}; return load;})()`,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
  const load=vm.runInNewContext(code,context) as (options?:{before?:string;silent?:boolean;focusId?:string})=>Promise<void>;
  return {load,context,get state(){return state;},ApiRequestError};
}
function deferred(){let resolve!:(value:unknown)=>void;let reject!:(error:Error)=>void;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};}

test('handler real ignora GET abortado que falha tarde e recupera com clique manual, sem reenvio automático', async () => {
  const requests:Array<ReturnType<typeof deferred>>=[];
  const harness=handlerHarness(async()=>{const response=deferred();requests.push(response);return response.promise;});
  const old=harness.load();
  const current=harness.load();
  requests[1].reject(new Error('503 body with internal details'));
  await current;
  assert.equal(requests.length,2,'não há tentativa automática em GET que falhou');
  assert.equal(harness.state.status,'error');assert.equal(auditLogPageView(harness.state,'master-a|filters').showEmpty,false);
  assert.doesNotMatch(harness.state.error,/body|internal/);
  const retry=harness.load();
  requests[2].resolve(page('confirmed'));
  await retry;
  requests[0].reject(new Error('late old failure'));
  await old;
  assert.equal(harness.state.status,'loaded');assert.deepEqual(harness.state.items.map(log=>log.id),['confirmed']);assert.equal(harness.state.error,'');
});

test('handler real não aplica GET concluído após mudança de conta ou filtro, mesmo antes do cleanup React', async () => {
  const response=deferred();let calls=0;
  const harness=handlerHarness(async()=>{calls++;return response.promise;});
  const pending=harness.load();
  harness.context.currentQueryKey.current='master-b|filters';
  response.resolve(page('private-a'));
  await pending;
  assert.deepEqual(auditLogPageView(harness.state,'master-b|filters').items,[]);
  await harness.load();
  assert.equal(calls,1,'callback de uma conta anterior não dispara nova consulta');
});

test('página associa seleção e carga à identidade e usa alerta/retry inline sem popup no GET', () => {
  const source=readFileSync('src/pages/AuditLogsPage.tsx','utf8');
  const load=source.slice(source.indexOf('  const load = useCallback('),source.indexOf('  useEffect(',source.indexOf('  const load = useCallback(')));
  assert.doesNotMatch(load,/portalNotice|setTimeout\([^]*load/);
  assert.match(source,/selectedLogSelection\?\.key === queryKey/);
  assert.match(source,/\{view.showCount &&/);assert.match(source,/view\.showEmpty/);
  assert.match(source,/\{loadError && <div role="alert"/);
  assert.match(source,/Tentar carregar novamente/);
});


test('fila ocupada permite só duas tentativas GET, respeita Retry-After e acrescenta jitter', async () => {
  let calls=0;const waits:number[]=[];
  const harness=handlerHarness(async()=>{calls++;if(calls===1)throw new harness.ApiRequestError('busy',503,'RUNTIME_BUSY',undefined,5);return page('confirmed');});
  harness.context.waitForAuditLogRetry=async(_signal,milliseconds)=>{waits.push(milliseconds);};
  await harness.load();assert.equal(calls,2);assert.equal(waits.length,1);assert.ok(waits[0]>=5100&&waits[0]<5250);assert.equal(harness.state.status,'loaded');
  calls=0;waits.length=0;
  const unavailable=handlerHarness(async()=>{calls++;throw new unavailable.ApiRequestError('busy',503,'RUNTIME_BUSY',undefined,5);});
  unavailable.context.waitForAuditLogRetry=async(_signal,milliseconds)=>{waits.push(milliseconds);};
  await unavailable.load();assert.equal(calls,2);assert.equal(waits.length,1);assert.equal(unavailable.state.status,'error');
});

test('negação, falha genérica e falta de Retry-After não são repetidas automaticamente', async () => {
  for(const [status,code,seconds] of [[401,'RUNTIME_BUSY',5],[403,'RUNTIME_BUSY',5],[503,'PERSISTENCE_FAILED',5],[503,'RUNTIME_BUSY',undefined],[503,'RUNTIME_BUSY',60]] as const){
    let calls=0;const harness=handlerHarness(async()=>{calls++;throw new harness.ApiRequestError('internal detail',status,code,undefined,seconds);});
    harness.context.waitForAuditLogRetry=async()=>assert.fail('Não repetir esta falha');
    await harness.load();assert.equal(calls,1);assert.equal(harness.state.status,'error');assert.doesNotMatch(harness.state.error,/internal detail/);
  }
});

test('espera cancelada ou troca de identidade impede a segunda tentativa GET', async () => {
  const controller=new AbortController();
  const waiting=waitForAuditLogRetry(controller.signal,30000);
  controller.abort();await assert.rejects(waiting,{name:'AbortError'});
  let calls=0;const harness=handlerHarness(async()=>{calls++;throw new harness.ApiRequestError('busy',503,'RUNTIME_BUSY',undefined,5);});
  harness.context.waitForAuditLogRetry=async()=>{harness.context.currentQueryKey.current='another-account';};
  await harness.load();assert.equal(calls,1);assert.equal(auditLogPageView(harness.state,'another-account').showCount,false);
});
