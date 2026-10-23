import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {preparePrivatePublicationSource} from './googleDriveArchive';

test('publicação reutiliza arquivo privado, verifica bytes e não cria cópia ou permissão pública',async()=>{
 const original=globalThis.fetch;
 const pdf=Buffer.from('%PDF-1.7\nDocumento de teste');
 const sha256=createHash('sha256').update(pdf).digest('hex');
 const calls:string[]=[];
 globalThis.fetch=async(input,init)=>{
  const url=new URL(String(input));calls.push(`${init?.method||'GET'} ${url.pathname}`);
  assert.equal(init?.method||'GET','GET','Publicação não deve criar arquivo nem alterar permissões.');
  if(url.pathname.endsWith('/permissions'))return Response.json({permissions:[{type:'user',role:'owner'}]});
  if(url.searchParams.get('alt')==='media')return new Response(pdf);
  return Response.json({id:'source_document_123',name:'Trabalho.pdf',mimeType:'application/pdf',appProperties:{portal:'portal-tcc',portalProcessId:'process-1',artifactType:'TRABALHO_COMPLETO',sha256}});
 };
 try{
  const input={accessToken:'fixture',processFolderId:'process_folder_123',sourceFileId:'source_document_123',processId:'process-1',artifactType:'TRABALHO_COMPLETO' as const,sha256,version:2};
  const result=await preparePrivatePublicationSource(input);
  assert.equal(result.id,input.sourceFileId);assert.equal(result.webViewLink,'/api/public/processes/process-1/files/trabalho-completo/download');
  await assert.rejects(preparePrivatePublicationSource({...input,sha256:'0'.repeat(64)}),/mudou desde a autorização/);
  assert.ok(calls.length>0);assert.ok(calls.every(call=>!call.includes('/copy')));
 }finally{globalThis.fetch=original;}
});
