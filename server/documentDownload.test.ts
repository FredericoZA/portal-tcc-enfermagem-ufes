import test from 'node:test';
import assert from 'node:assert/strict';
import {downloadPortalDocument} from '../src/utils/documentDownload';
test('private document downloads use API bytes and refuse foreign origins before sending credentials',async()=>{
 const originalWindow=Object.getOwnPropertyDescriptor(globalThis,'window'),originalDocument=Object.getOwnPropertyDescriptor(globalThis,'document'),originalFetch=globalThis.fetch;
 let calls=0,clicked=false;const anchor={href:'',download:'',click(){clicked=true;}};
 Object.defineProperty(globalThis,'window',{configurable:true,value:{location:{origin:'http://localhost:3000'},setTimeout:(fn:()=>void)=>{fn();return 0;}}});
 Object.defineProperty(globalThis,'document',{configurable:true,value:{createElement:()=>anchor}});
 globalThis.fetch=async(input,options)=>{calls++;assert.equal(input,'/api/processes/qa58-08/documents/doc-convite/download');assert.equal(options?.credentials,'include');return new Response('%PDF-1.4\nficticio',{headers:{'content-type':'application/pdf','content-disposition':'attachment; filename="convite-teste.pdf"'}});};
 try{
  await assert.rejects(()=>downloadPortalDocument('https://foreign.example/api/processes/qa58-08/documents/doc-convite/download'));
  await assert.rejects(()=>downloadPortalDocument('/api/admin/settings'));assert.equal(calls,0);
  await downloadPortalDocument('/api/processes/qa58-08/documents/doc-convite/download');assert.equal(calls,1);assert.equal(clicked,true);assert.equal(anchor.download,'convite-teste.pdf');
 }finally{globalThis.fetch=originalFetch;if(originalWindow)Object.defineProperty(globalThis,'window',originalWindow);else Reflect.deleteProperty(globalThis,'window');if(originalDocument)Object.defineProperty(globalThis,'document',originalDocument);else Reflect.deleteProperty(globalThis,'document');}
});
