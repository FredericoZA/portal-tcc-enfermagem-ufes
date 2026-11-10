import test from 'node:test';
import assert from 'node:assert/strict';
import {verifyDriveReferenceMetadata} from './googleWorkspace';

test('verificação das referências usa somente metadados e recusa arquivos excluídos/tipo incorreto',async()=>{
 const original=globalThis.fetch;let payload={id:'reference',mimeType:'application/pdf',trashed:false};const requests:URL[]=[];
 globalThis.fetch=async input=>{const url=new URL(String(input));requests.push(url);assert.equal(url.searchParams.get('fields'),'id,mimeType,trashed');assert.equal(url.searchParams.get('alt'),null);return Response.json(payload);};
 try{
  await verifyDriveReferenceMetadata('synthetic','reference');
  payload={...payload,trashed:true};await assert.rejects(verifyDriveReferenceMetadata('synthetic','reference'));
  payload={...payload,trashed:false,mimeType:'application/vnd.google-apps.folder'};await verifyDriveReferenceMetadata('synthetic','reference',true);await assert.rejects(verifyDriveReferenceMetadata('synthetic','reference'));
  payload={...payload,id:'different'};await assert.rejects(verifyDriveReferenceMetadata('synthetic','reference',true));assert.equal(requests.length,5);
 }finally{globalThis.fetch=original;}
});
