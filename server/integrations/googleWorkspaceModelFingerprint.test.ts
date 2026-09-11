import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import JSZip from 'jszip';
import { verifyMasterDocumentModelFingerprint } from './googleWorkspace';

test('modelo ativo exige o mesmo conteúdo, revisão e horário publicados', async () => {
  const originalFetch=globalThis.fetch;
  const zip=new JSZip();
  zip.file('[Content_Types].xml','<Types/>');
  zip.folder('word')!.file('document.xml','<w:document><w:p>Modelo controlado</w:p></w:document>');
  const bytes=await zip.generateAsync({type:'nodebuffer'});
  const canonical=createHash('sha256');
  canonical.update('[Content_Types].xml\0<Types/>\0word/document.xml\0<w:document><w:p>Modelo controlado</w:p></w:document>\0');
  globalThis.fetch=async(input) => {
    const url=String(input);
    if(url.includes('fields='))return new Response(JSON.stringify({id:'modelo123456',mimeType:'application/vnd.google-apps.document',modifiedTime:'2026-09-06T12:00:00.000Z',version:'7',headRevisionId:'rev-7'}),{status:200,headers:{'content-type':'application/json'}});
    if(url.includes('/export?'))return new Response(bytes,{status:200});
    return new Response('não esperado',{status:404});
  };
  try{
    const contentSha256=canonical.digest('hex');
    await assert.doesNotReject(() => verifyMasterDocumentModelFingerprint({accessToken:'token-de-teste',fileId:'modelo123456',contentSha256,driveRevisionId:'rev-7',driveModifiedTime:'2026-09-06T12:00:00.000Z'}));
    await assert.rejects(() => verifyMasterDocumentModelFingerprint({accessToken:'token-de-teste',fileId:'modelo123456',contentSha256:'b'.repeat(64),driveRevisionId:'rev-7'}),/alterado diretamente/i);
    await assert.rejects(() => verifyMasterDocumentModelFingerprint({accessToken:'token-de-teste',fileId:'modelo123456',contentSha256,driveRevisionId:'rev-anterior'}),/alterado diretamente/i);
  }finally{globalThis.fetch=originalFetch;}
});
