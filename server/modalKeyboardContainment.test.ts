import test from 'node:test';import assert from 'node:assert/strict';
import {containModalTab,registerModalEscape} from '../src/utils/modalEscape';

function fixture(){
 let active:any=null,native=false,top:any;const listeners=new Map<string,Function>();const focused:string[]=[];
 const doc:any={get activeElement(){return active;},defaultView:{getComputedStyle:(node:any)=>({zIndex:node.z||'auto',visibility:node.hidden?'hidden':'visible',display:'block'})},querySelector:()=>native?{}:null,querySelectorAll:()=>[bottom,top].filter(Boolean),addEventListener:(name:string,fn:Function)=>listeners.set(name,fn),removeEventListener:(name:string)=>listeners.delete(name)};
 const control=(id:string,tabIndex=0,disabled=false,hidden=false)=>({id,tabIndex,hidden,ownerDocument:doc,parentElement:null,getClientRects:()=>hidden?[]:[{}],matches:()=>disabled,closest:()=>null,focus(){active=this;focused.push(id);}});
 const a=control('first'),b=control('last'),disabled=control('disabled',0,true),hidden=control('hidden',0,false,true);
 const modal=(id:string,children:any[],z:string):any=>({id,z,ownerDocument:doc,parentElement:null,getClientRects:()=>[{}],querySelectorAll:()=>children,contains(node:any){return node===this||children.includes(node);},focus(){active=this;focused.push(id);}});
 const bottom=modal('bottom',[control('underlying')],'1');top=modal('top',[a,disabled,hidden,b],'2');
 const key=(shiftKey=false)=>{const value:any={key:'Tab',shiftKey,defaultPrevented:false,preventDefault(){this.defaultPrevented=true;},stopImmediatePropagation(){}};return value;};
 return{doc,a,b,bottom,get top(){return top;},set top(value:any){top=value;},focused,key,set active(value:any){active=value;},set native(value:boolean){native=value;},listeners,control,modal};
}
test('Tab and ShiftTab wrap only at visible enabled boundaries of the topmost custom modal',()=>{
 const f=fixture();f.active=f.b;const next=f.key();containModalTab(f.top,next);assert.equal(next.defaultPrevented,true);assert.deepEqual(f.focused,['first']);
 f.active=f.a;const previous=f.key(true);containModalTab(f.top,previous);assert.equal(previous.defaultPrevented,true);assert.deepEqual(f.focused,['first','last']);
 f.active=f.a;const middle=f.key();containModalTab(f.top,middle);assert.equal(middle.defaultPrevented,false);
 f.active=f.b;const underlying=f.key();containModalTab(f.bottom,underlying);assert.equal(underlying.defaultPrevented,false);
});
test('native modal retains its own focus trap; empty custom modal and outside focus remain contained',()=>{
 const f=fixture();f.active=f.b;f.native=true;const native=f.key();containModalTab(f.top,native);assert.equal(native.defaultPrevented,false);assert.equal(f.focused.length,0);
 f.native=false;f.active={};const outside=f.key();containModalTab(f.top,outside);assert.equal(outside.defaultPrevented,true);assert.equal(f.focused.at(-1),'first');
 f.top=f.modal('empty',[],'3');f.active=f.top;const empty=f.key();containModalTab(f.top,empty);assert.equal(empty.defaultPrevented,true);assert.equal(f.focused.at(-1),'empty');
});
test('shared registry contains Tab while Escape is locked, and detaching removes the keyboard listener',()=>{
 const f=fixture();let closes=0;const detach=registerModalEscape(f.top,()=>{closes++;},false);
 f.active=f.b;const tab=f.key();f.listeners.get('keydown')!(tab);assert.equal(tab.defaultPrevented,true);
 const escape={...f.key(),key:'Escape'};f.listeners.get('keydown')!(escape);assert.equal(escape.defaultPrevented,true);assert.equal(closes,0);
 detach();assert.equal(f.listeners.has('keydown'),false);
});

test('radio groups select checked control, and a modeless native dialog does not disable custom containment',()=>{
 const f=fixture();const radio=(id:string,checked:boolean)=>Object.assign(f.control(id),{tagName:'INPUT',type:'radio',name:'decision',checked,form:null,getRootNode:()=>f.doc});
 const unchecked=radio('unchecked',false),checked=radio('checked',true),last=f.control('close');
 f.top=f.modal('radios',[unchecked,checked,last],'3');f.active=last;
 f.doc.querySelector=(selector:string)=>selector==='dialog[open]'?{}:null;
 const event=f.key();containModalTab(f.top,event);assert.equal(event.defaultPrevented,true);assert.equal(f.focused.at(-1),'checked');
 f.active=checked;containModalTab(f.top,f.key(true));assert.equal(f.focused.at(-1),'close');
});


test('a native top-layer dialog contains its own Tab navigation without yielding to a background custom modal',()=>{
 const f=fixture();f.doc.querySelector=()=>f.top;f.active=f.b;
 const forward=f.key();containModalTab(f.top,forward);assert.equal(forward.defaultPrevented,true);assert.equal(f.focused.at(-1),'first');
 const background=f.key();containModalTab(f.bottom,background);assert.equal(background.defaultPrevented,false);
 f.active=f.a;const backward=f.key(true);containModalTab(f.top,backward);assert.equal(backward.defaultPrevented,true);assert.equal(f.focused.at(-1),'last');
});
