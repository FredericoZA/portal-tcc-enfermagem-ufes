import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {buildSync} from 'esbuild';

function target(){
 const listeners=new Map<string,Set<Function>>();
 return {listeners,addEventListener(name:string,fn:Function){if(!listeners.has(name))listeners.set(name,new Set());listeners.get(name)!.add(fn);},removeEventListener(name:string,fn:Function){listeners.get(name)?.delete(fn);},fire(name:string,event:any={}){for(const fn of [...listeners.get(name)||[]])fn(event);},count(){return [...listeners.values()].reduce((n,s)=>n+s.size,0);}};
}
function fixture(){
 const source=readFileSync(new URL('../src/utils/portalTableDom.ts',import.meta.url),'utf8')+'\nexport {installResizer as testInstallResizer};';
 const code=buildSync({stdin:{contents:source,resolveDir:new URL('../src/utils/',import.meta.url).pathname,loader:'ts'},bundle:true,platform:'node',format:'cjs',write:false,logLevel:'silent'}).outputFiles[0].text;
 const doc=Object.assign(target(),{documentElement:{classList:{add(){},remove(){}}},createElement(){return Object.assign(target(),{setAttribute(){}});}});
 const win=target();const module={exports:{} as any};
 vm.runInNewContext(code,{module,exports:module.exports,document:doc,window:win,console,Event,CustomEvent:class{},localStorage:{getItem(){return null;},setItem(){throw Error('should not write during cancel');}},Map,Set,WeakMap});
 const table={isConnected:true};let handle:any;
 const header={dataset:{},cellIndex:0,querySelector(){return null;},getBoundingClientRect(){return{width:100};},appendChild(value:any){handle=value;}};
 module.exports.testInstallResizer(table,header,0);
 const start=()=>handle.fire('pointerdown',{button:0,clientX:0,preventDefault(){},stopPropagation(){}});
 return{api:module.exports,doc,win,table,start};
}

test('detached table releases resize listeners without waiting for pointerup',()=>{
 const f=fixture();f.start();assert.equal(f.doc.count(),3);assert.equal(f.win.count(),1);
 f.table.isConnected=false;f.api.cleanupDetachedPortalTableInteractions();
 assert.equal(f.doc.count(),0);assert.equal(f.win.count(),0);
 f.api.cleanupDetachedPortalTableInteractions();assert.equal(f.doc.count(),0);
});
test('pointer cancellation, blur, new drag and teardown release the prior resize',()=>{
 for(const event of ['pointercancel','blur','teardown']){
  const f=fixture();f.start();f.start();assert.equal(f.doc.count(),3);assert.equal(f.win.count(),1);
  if(event==='teardown')f.api.cleanupPortalTableInteractions();else if(event==='blur')f.win.fire(event);else f.doc.fire(event);
  assert.equal(f.doc.count(),0,event);assert.equal(f.win.count(),0,event);
 }
});
