import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

class EventSurface {
  listeners=new Map<string,Set<Function>>();
  addEventListener(type:string,fn:Function){const set=this.listeners.get(type)||new Set();set.add(fn);this.listeners.set(type,set);}
  removeEventListener(type:string,fn:Function){this.listeners.get(type)?.delete(fn);}
  count(){return [...this.listeners.values()].reduce((sum,set)=>sum+set.size,0);}
}
class Host extends EventSurface {
  isConnected=true;
  nodeType=1;
  matches(selector:string){return selector==='table';}
  closest(selector:string){return selector==='table'?this:null;}
  querySelector(){return null;}
  classList={add(..._classes:string[]){},remove(..._classes:string[]){}};
  scrollWidth=500;clientWidth=100;scrollHeight=500;clientHeight=100;scrollTop=0;scrollLeft=0;
}

function runtimeHarness(storageBlocked=false){
  const source=readFileSync('src/components/PortalSpreadsheetRuntime.tsx','utf8');
  const component=source.slice(source.indexOf('export const PortalSpreadsheetRuntime ='));
  const frames=new Map<number,Function>();let nextFrame=1,cleanup:Function|undefined,notify:Function|undefined;
  const window=new EventSurface();let tables:Host[]=[];
  const root={nodeType:1,closest:()=>null,querySelectorAll:()=>tables,contains:(host:Host)=>tables.includes(host)};
  const context={
    useLayoutEffect:(fn:Function)=>{cleanup=fn();},migrateLegacyLimits:()=>{},
    document:{getElementById:()=>root},window,
    requestAnimationFrame:(fn:Function)=>{const id=nextFrame++;frames.set(id,fn);return id;},cancelAnimationFrame:(id:number)=>frames.delete(id),
    MutationObserver:class{constructor(fn:Function){notify=fn;}observe(){}disconnect(){}},
    tableKey:()=> 'audit_logs',enhancePortalTable:()=>{},markSpreadsheet:()=>{},findScrollHost:(table:Host)=>table,applyPagination:()=>{},removeOrphanPagers:()=>{},cleanupDetachedPortalTableInteractions:()=>{},cleanupPortalTableInteractions:()=>{},
    INTERACTIVE_SELECTOR:'button',performance:{now:()=>0},Map,Math,
    PORTAL_TABLE_KEYS:['audit_logs'],tablePreferenceKey:()=>{throw Error('Sem identidade confirmada não consultar preferências pessoais.');},
    localStorage:{getItem(){throw new DOMException('Browser storage blocked','SecurityError');},setItem(){throw new DOMException('Browser storage blocked','SecurityError');}},
  };
  const storageMigration=storageBlocked ? source.slice(source.indexOf('const DEFAULT_PAGE_SIZE:'),source.indexOf('function tableKey(')) : '';
  const code=ts.transpileModule(storageMigration+component.replace('export const','const')+'\nPortalSpreadsheetRuntime();',{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
  vm.runInNewContext(code,context);
  const flush=()=>{const pending=[...frames.values()];frames.clear();pending.forEach(fn=>fn());};
  const navigate=(host:Host)=>{const previous=tables;tables.forEach(old=>old.isConnected=false);tables=[host];notify?.([{type:'childList',target:root,addedNodes:[host],removedNodes:previous}]);flush();};
  return {window,navigate,flush,notify:(records:unknown[])=>notify?.(records),close:()=>cleanup?.(),get pendingFrames(){return frames.size;}};
}

test('navegações repetidas liberam hosts, listeners e arraste das planilhas removidas',()=>{
  const runtime=runtimeHarness();const visited:Host[]=[];
  for(let index=0;index<100;index++){
    const host=new Host();visited.push(host);runtime.navigate(host);
    assert.equal(host.count(),3);
    if(index>0)assert.equal(visited[index-1].count(),0,'o DOM da página anterior não mantém handlers');
    const down=[...host.listeners.get('mousedown')!][0];
    down({button:0,target:{closest:()=>null},clientX:10,clientY:10});
    assert.equal(runtime.window.listeners.get('mousemove')?.size,1,'só o arraste do host atual fica ativo');
    assert.equal(runtime.window.listeners.get('mouseup')?.size,1);
  }
  assert.equal(visited.filter(host=>host.count()>0).length,1);
  runtime.close();
  assert.ok(visited.every(host=>host.count()===0));assert.equal(runtime.window.count(),0);
});

test('refresh do mesmo host não duplica binds nem cria ciclo de MutationObserver',()=>{
  const runtime=runtimeHarness();const host=new Host();runtime.navigate(host);
  runtime.flush();runtime.flush();
  assert.equal(host.count(),3);assert.equal(runtime.pendingFrames,0);
  runtime.close();assert.equal(host.count(),0);assert.equal(runtime.window.count(),0);
});


test('mutações fora das tabelas não agendam refresh; alterações de dados/células continuam observadas',()=>{
  const runtime=runtimeHarness();const host=new Host();runtime.navigate(host);
  const outside={nodeType:1,closest:()=>null,matches:()=>false,querySelector:()=>null};
  for(let index=0;index<10;index++)runtime.notify([{type:'characterData',target:{nodeType:3,parentElement:outside},addedNodes:[],removedNodes:[]}]);
  runtime.notify([{type:'childList',target:outside,addedNodes:[outside],removedNodes:[]}]);
  assert.equal(runtime.pendingFrames,0,'relógio, sidebar e avisos não percorrem as tabelas');
  runtime.notify([{type:'characterData',target:{nodeType:3,parentElement:host},addedNodes:[],removedNodes:[]}]);
  assert.equal(runtime.pendingFrames,1,'texto alterado em uma célula atualiza a tabela');
  runtime.flush();
  runtime.notify([{type:'childList',target:outside,addedNodes:[{...outside,querySelector:()=>host}],removedNodes:[]}]);
  assert.equal(runtime.pendingFrames,1,'inserção de container com tabela continua coberta');
  runtime.flush();
  runtime.notify([{type:'childList',target:outside,addedNodes:[],removedNodes:[{...outside,querySelector:()=>host}]}]);
  assert.equal(runtime.pendingFrames,1,'remoção do container dispara cleanup');
  runtime.close();
});


test('montagem real com migração de preferências não falha quando o navegador bloqueia storage',()=>{
  let runtime:ReturnType<typeof runtimeHarness>|undefined;
  assert.doesNotThrow(()=>{runtime=runtimeHarness(true);});
  assert.equal(runtime!.pendingFrames,1,'a montagem concluiu e agendou a primeira atualização');
  runtime!.close();assert.equal(runtime!.window.count(),0);
});
