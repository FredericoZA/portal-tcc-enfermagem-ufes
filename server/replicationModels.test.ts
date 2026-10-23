import test from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import {exportReplicationModel} from '../api/replication-model';
test('replication downloads DOCX bytes directly and exports native Docs without changing templates',async()=>{
 const original=globalThis.fetch;const urls:string[]=[];
 const zip=new JSZip();zip.file('word/document.xml','<w:document>&lt;&lt;alunos&gt;&gt;</w:document>');const bytes=await zip.generateAsync({type:'nodebuffer'});
 globalThis.fetch=async(input,options)=>{urls.push(String(input));assert.equal(options?.method,undefined);return new Response(bytes,{status:200});};
 try{
  for(const key of ['convite','ata','termo','declaracao'] as const){const file=await exportReplicationModel(key,'fixture-token');assert.deepEqual(file.content,bytes);assert.match(file.fileName,/\.docx$/);}
  assert.ok(urls[0].includes('1zz6GJEiFfdo_9s4Nl2GBTtGh-MVetwiZ?alt=media'));
  assert.ok(urls[1].includes('1fsllAgip66pjCNvufTkrKmKbi9B06L3q?alt=media'));
  assert.ok(urls[2].includes('/export?mimeType='));assert.ok(urls[3].includes('/export?mimeType='));
  globalThis.fetch=async()=>new Response('not a Word file');await assert.rejects(()=>exportReplicationModel('ata','fixture-token'));
 }finally{globalThis.fetch=original;}
});
