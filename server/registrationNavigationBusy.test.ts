import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';
import {portalOperations,withBlockingPortalOperation} from '../src/services/portalOperations';

test('troca de etapa adquire trava antes do React renderizar e não repete salvamento',async()=>{
 const source=readFileSync('src/components/ConfigurableRegistration.tsx','utf8');
 const start=source.indexOf('  const runBusy=');
 const end=source.indexOf('\n  const [eligibility',start);
 assert.ok(start>0&&end>start);
 const busyRef={current:false},states:boolean[]=[];
 const runBusy=runInNewContext(ts.transpileModule(`(()=>{${source.slice(start,end)};return runBusy;})()`,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,{busyRef,setBusy:(value:boolean)=>states.push(value),withBlockingPortalOperation});
 let resolve!:()=>void,writes=0;
 const response=new Promise<void>(done=>{resolve=done;});
 const first=runBusy('Salvando rascunho…',async()=>{writes++;await response;});
 const second=runBusy('Salvando rascunho…',async()=>{writes++;});
 assert.equal(writes,1);assert.equal(busyRef.current,true);
 assert.equal(portalOperations.getSnapshot().blocking,true);
 resolve();await Promise.all([first,second]);
 assert.deepEqual(states,[true,false]);assert.equal(busyRef.current,false);
 await assert.rejects(runBusy('Salvando rascunho…',async()=>{throw Error('Falha de salvamento');}),/Falha de salvamento/);
 assert.equal(busyRef.current,false);assert.equal(portalOperations.getSnapshot().pending,0);
});

test('aviso bloqueante usa dialog modal nativo, impede Escape e fecha ao concluir',()=>{
 const source=readFileSync('src/components/PortalOperationStatus.tsx','utf8');
 const start=source.indexOf('function BlockingOperationStatus(');
 const end=source.indexOf('\n/**',start);
 const effects:Array<()=>void|(()=>void)>=[];let opened=0,closed=0;
 const element={open:false,showModal(){this.open=true;opened++;},close(){this.open=false;closed++;}};
 const React={createElement:(tag:unknown,props:any,...children:unknown[])=>({tag,props,children})};
 const render=runInNewContext(ts.transpileModule(`(()=>{${source.slice(start,end)};return BlockingOperationStatus;})()`,{compilerOptions:{jsx:ts.JsxEmit.React,target:ts.ScriptTarget.ES2022}}).outputText,{React,useRef:()=>({current:element}),useLayoutEffect:(fn:()=>void)=>effects.push(fn),createPortal:(content:unknown)=>content,document:{body:{}}});
 const dialog=render({label:'Salvando rascunho…'});
 assert.equal(dialog.tag,'dialog');assert.equal(dialog.props.role,'dialog');assert.equal(dialog.props['aria-modal'],'true');
 let closesUnderlying=0,stopped=false;
 dialog.props.onKeyDown({key:'Escape',stopPropagation:()=>{stopped=true;}});
 if(!stopped)closesUnderlying++;
 assert.equal(closesUnderlying,0,'Escape cannot reach the registration modal document listener');
 let canceled=false;dialog.props.onCancel({preventDefault:()=>{canceled=true;}});assert.equal(canceled,true);
 const cleanup=effects[0]();assert.equal(opened,1);assert.equal(element.open,true);
 assert.ok(typeof cleanup==='function');cleanup();assert.equal(closed,1);assert.equal(element.open,false);
});
