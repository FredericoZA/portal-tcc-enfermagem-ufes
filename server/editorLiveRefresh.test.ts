import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';
const source=readFileSync('src/pages/ProcessoDetailPage.tsx','utf8');
const compile=(text:string)=>ts.transpileModule(text,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;

test('fechar editor reativo libera a atualização pendente, sem apagar rascunho ativo de outra seção',()=>{
 const start=source.indexOf('const setSummaryEditing=React.useCallback(')+'const setSummaryEditing=React.useCallback('.length;
 const end=source.indexOf(',[]);',start);assert.ok(start>40&&end>start);
 const state={editing:false,refreshes:0},context:any={editingSectionRef:{current:null},setSummaryEditingState:(value:boolean)=>{state.editing=value;},remoteUpdatePending:true,loadData:()=>{state.refreshes++;return Promise.resolve();}};
 const notify=runInNewContext(compile(`(${source.slice(start,end)})`),context);
 const effectStart=source.indexOf('    if(!editingSectionRef.current && remoteUpdatePending)');
 const effectEnd=source.indexOf('  },[editingSection,summaryEditing,remoteUpdatePending]);',effectStart);
 assert.ok(effectStart>0&&effectEnd>effectStart);
 const refresh=()=>runInNewContext(compile(`(function(){${source.slice(effectStart,effectEnd)}})()`),context);
 notify(true);assert.equal(state.editing,true);refresh();assert.equal(state.refreshes,0);
 notify(false);assert.equal(state.editing,false);assert.equal(context.editingSectionRef.current,null);
 refresh();assert.equal(state.refreshes,1,'o fechamento permite atualizar sem fechar o processo');
 context.editingSectionRef.current='acervo';notify(false);refresh();assert.equal(state.refreshes,1);assert.equal(context.editingSectionRef.current,'acervo');
});

test('consulta antiga que termina depois de uma gravação não gera falso aviso de outra edição',async()=>{
 const begin=source.indexOf('    let active=true;\n    const verify=async()=>{');
 const end=source.indexOf('  },[processId,userEmail,readOnly,waitingForReservation]);',begin);assert.ok(begin>0&&end>begin);
 for(const [revision,updatedAt,expected] of [[4,'2030-01-01T10:00:00Z',false],[5,'2030-01-01T09:59:00Z',false],[5,'2030-01-01T10:01:00Z',true],[6,'2030-01-01T10:00:00Z',true]] as const){
  let handler!:()=>void,flag=false;
  const context={Date,waitingForReservation:false,processId:'p',userEmail:'a',document:{visibilityState:'visible'},deletionDialogRef:{current:false},repositorySubmitInFlight:{current:false},liveRefreshInFlight:{current:false},editingSectionRef:{current:'cadastral'},lastProcessRevision:{current:{revision:5,updatedAt:'2030-01-01T10:00:00Z'}},apiClient:{getProcessById:async()=>({dataRevision:revision,updatedAt})},setRemoteUpdatePending:(value:boolean)=>{flag=value;},loadData:async()=>{throw Error('active draft must not be replaced');},ApiRequestError:class extends Error{},portalNotice:()=>{},onBackRef:{current:()=>{}},PORTAL_LIVE_UPDATE_EVENT:'changed',window:{addEventListener:(_event:string,fn:()=>void)=>{handler=fn;},removeEventListener:()=>{}}};
  const cleanup=runInNewContext(compile(`(function(){${source.slice(begin,end)}})()`),context);
  handler();await new Promise<void>(resolve=>setImmediate(resolve));assert.equal(flag,expected,`${revision}/${updatedAt}`);cleanup();
 }
});


test('live read of this form submission does not report another session, including a read already in flight',async()=>{
 const begin=source.indexOf('    let active=true;\n    const verify=async()=>{'),end=source.indexOf('  },[processId,userEmail,readOnly,waitingForReservation]);',begin);
 let handler!:()=>void,resolveRead!:(value:any)=>void,reads=0,flag=false;
 const context={Date,waitingForReservation:false,processId:'p',document:{visibilityState:'visible'},deletionDialogRef:{current:false},repositorySubmitInFlight:{current:true},liveRefreshInFlight:{current:false},editingSectionRef:{current:'acervo'},lastProcessRevision:{current:{revision:5,updatedAt:'2030-01-01T10:00:00Z'}},apiClient:{getProcessById:()=>{reads++;return new Promise(resolve=>{resolveRead=resolve;});}},setRemoteUpdatePending:(value:boolean)=>{flag=value;},loadData:async()=>{},ApiRequestError:class extends Error{},portalNotice:()=>{},onBackRef:{current:()=>{}},PORTAL_LIVE_UPDATE_EVENT:'changed',window:{addEventListener:(_event:string,fn:()=>void)=>{handler=fn;},removeEventListener:()=>{}}};
 const cleanup=runInNewContext(compile(`(function(){${source.slice(begin,end)}})()`),context);
 handler();await Promise.resolve();assert.equal(reads,0);
 context.repositorySubmitInFlight.current=false;handler();assert.equal(reads,1);
 context.repositorySubmitInFlight.current=true;resolveRead({dataRevision:6,updatedAt:'2030-01-01T10:01:00Z'});
 await new Promise<void>(resolve=>setImmediate(resolve));assert.equal(flag,false);cleanup();
});
