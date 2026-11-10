import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {PORTAL_REPOSITORY_CHANGED_EVENT} from '../src/utils/portalLiveEvents';

function panelFixture(input:{result?:unknown;requestError?:Error;refreshError?:boolean;confirm?:()=>Promise<boolean>}={}){
 const source=readFileSync('src/components/WorkflowRecoveryPanel.tsx','utf8');
 const loadStart=source.indexOf('  const load='),loadEnd=source.indexOf('  useEffect(',loadStart);
 const retryStart=source.indexOf('  const retry='),retryEnd=source.indexOf('  const content=',retryStart);
 const code=ts.transpileModule(`(function(){${source.slice(loadStart,loadEnd)}${source.slice(retryStart,retryEnd)};return retry;})()`,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
 let message='',busy='',calls=0,refreshes=0,confirmations=0,blockingCalls=0,blocking=false;const events:string[]=[];
 const actionInProgress={current:false};
 const retry=vm.runInNewContext(code,{withBlockingPortalOperation:async(_label:string,operation:()=>Promise<unknown>)=>{blockingCalls++;blocking=true;try{return await operation();}finally{blocking=false;}},processId:'fixture-process',historyOnly:false,onUpdated:undefined,actionInProgress,data:{studioRevision:8},useCallback:(callback:Function)=>callback,
  setBusy:(value:string)=>{busy=value;},setMessage:(value:string|((before:string)=>string))=>{message=typeof value==='function'?value(message):value;},setData:()=>{},
  portalConfirm:async()=>{confirmations++;return input.confirm?input.confirm():true;},
  apiClient:{retryWorkflowOperation:async()=>{calls++;if(input.requestError)throw input.requestError;return input.result;},getWorkflowOperations:async()=>{refreshes++;if(input.refreshError)throw Error('readback unavailable');return{processId:'fixture-process'};}},
  window:{dispatchEvent:(event:{type:string})=>{events.push(event.type);}},CustomEvent:class{constructor(public type:string){}},PORTAL_REPOSITORY_CHANGED_EVENT,
 });
 return{retry,actionInProgress,get:()=>({message,busy,calls,refreshes,confirmations,events,blockingCalls,blocking})};
}

test('accepted archive retry shows confirmed invitation and refreshes existing views exactly once',async()=>{
 const f=panelFixture({result:{status:'ARCHIVED',workflowPending:false,confirmationMessage:'Comprovante arquivado e convite enviado à banca.'}});
 await f.retry('/api/admin/form-archives/form/retry');const result=f.get();
 assert.match(result.message,/convite enviado/);assert.equal(result.calls,1);assert.equal(result.refreshes,1);
 assert.deepEqual(result.events,[PORTAL_REPOSITORY_CHANGED_EVENT]);assert.equal(result.blockingCalls,1);assert.equal(result.blocking,false);assert.equal(result.busy,'');assert.equal(f.actionInProgress.current,false);
});
test('archive success without confirmed invitation remains explicitly pending',async()=>{
 const f=panelFixture({result:{status:'ARCHIVED',workflowPending:true,workflowError:'Convite aguarda o provedor.',confirmationMessage:'Comprovante arquivado. O convite ainda aguarda confirmação.'}});
 await f.retry('/api/admin/form-archives/form/retry');const result=f.get();
 assert.match(result.message,/aguarda confirmação/);assert.match(result.message,/continuação do fluxo pendente/);assert.doesNotMatch(result.message,/convite enviado/);
 assert.equal(result.calls,1);assert.deepEqual(result.events,[PORTAL_REPOSITORY_CHANGED_EVENT]);
});
test('refresh failure cannot erase the mutation result or repeat the accepted operation',async()=>{
 const f=panelFixture({result:{confirmationMessage:'Convite enviado à banca.'},refreshError:true});
 await f.retry('/api/admin/form-archives/form/retry');const result=f.get();
 assert.match(result.message,/^Convite enviado à banca\./);assert.match(result.message,/Não foi possível atualizar a lista/);
 assert.equal(result.calls,1);assert.equal(result.refreshes,1);assert.equal(result.busy,'');assert.equal(f.actionInProgress.current,false);
});
test('synchronous action guard blocks double click while confirmation is still open',async()=>{
 let release!:(accepted:boolean)=>void;
 const confirmation=new Promise<boolean>(resolve=>{release=resolve;});
 const f=panelFixture({confirm:()=>confirmation,result:{status:'ARCHIVED'}});
 const first=f.retry('/api/admin/form-archives/form/retry');await f.retry('/api/admin/form-archives/form/retry');
 assert.equal(f.get().confirmations,1);assert.equal(f.get().calls,0);assert.equal(f.get().blockingCalls,0,'the global blocker must wait for confirmation to avoid trapping its dialog');
 release(true);await first;assert.equal(f.get().calls,1);assert.equal(f.get().blockingCalls,1);assert.equal(f.get().blocking,false);assert.equal(f.actionInProgress.current,false);
});
test('unconfirmed request or cancelled confirmation emits no data-change event and never repeats the POST',async()=>{
 for(const input of [{requestError:Error('Resultado não confirmado.')},{confirm:async()=>false}]){
  const f=panelFixture(input);await f.retry('/api/admin/form-archives/form/retry');const result=f.get();
  assert.equal(result.calls,input.requestError?1:0);assert.deepEqual(result.events,[]);assert.equal(result.refreshes,0);
  assert.equal(result.busy,'');assert.equal(f.actionInProgress.current,false);
 }
});
