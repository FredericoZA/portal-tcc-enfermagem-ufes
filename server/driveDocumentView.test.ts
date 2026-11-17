import test from 'node:test';
import assert from 'node:assert/strict';
import {driveDocumentViewUrl,openDriveDocument} from '../src/utils/driveDocumentAccess';

const links={view:'https://drive.google.com/file/d/exact_original_123/view?resourcekey=allowed',download:'https://drive.usercontent.google.com/download?id=exact_original_123&export=download'};
test('view opens the exact verified Drive original and keeps download separate',async()=>{
  const previous=Object.getOwnPropertyDescriptor(globalThis,'window'),events:string[]=[];
  const tab={opener:{} as unknown,closed:false,close(){this.closed=true;},location:{replace(url:string){events.push(url);}}};
  Object.defineProperty(globalThis,'window',{configurable:true,value:{open:(url:string,target:string)=>{assert.equal(url,'about:blank');assert.equal(target,'_blank');events.push('opened');return tab;}}});
  try{
    await openDriveDocument(async()=>{events.push('resolved');return {links};});
    assert.deepEqual(events,['opened','resolved',links.view]);assert.equal(tab.opener,null);assert.equal(tab.closed,false);
    for(const result of [{links:null},{links:null,requiresDriveAuthorization:true}]){
      tab.closed=false;
      await assert.rejects(openDriveDocument(async()=>result),/original ainda não foi vinculado/);
      assert.equal(tab.closed,true,'an unavailable Drive original never silently becomes a Portal preview');
    }
    events.length=0;
    await openDriveDocument(async()=>({links}),()=>false);assert.deepEqual(events,['opened']);assert.equal(tab.closed,true);
  }finally{if(previous)Object.defineProperty(globalThis,'window',previous);else Reflect.deleteProperty(globalThis,'window');}
});
test('view rejects untrusted, token-bearing and ambiguous destinations',()=>{
  for(const view of ['javascript:alert(1)','http://drive.google.com/file','https://drive.google.com.attacker.invalid/file','https://owner@drive.google.com/file','https://drive.google.com:8443/file','https://drive.google.com/file?access_token=secret','https://drive.google.com/file?key=secret'])assert.throws(()=>driveDocumentViewUrl({links:{...links,view}}),/não foi confirmado/);
  assert.equal(driveDocumentViewUrl({links}),links.view);
});
test('a blocked popup is reported before requesting a document',async()=>{
  const previous=Object.getOwnPropertyDescriptor(globalThis,'window');let requested=false;
  Object.defineProperty(globalThis,'window',{configurable:true,value:{open:()=>null}});
  try{await assert.rejects(openDriveDocument(async()=>{requested=true;return {links};}),/nova aba/);assert.equal(requested,false);}
  finally{if(previous)Object.defineProperty(globalThis,'window',previous);else Reflect.deleteProperty(globalThis,'window');}
});
