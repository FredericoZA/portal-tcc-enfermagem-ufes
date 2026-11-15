import test from 'node:test';
import assert from 'node:assert/strict';
import {resolvePrivateDriveBrowserLinks} from './googleDriveArchive';

test('direct Drive access uses nominal permissions and metadata only, with no PDF transfer or sharing mutation',async()=>{
 const original=globalThis.fetch,calls:string[]=[];
 const input={accessToken:'fixture',fileId:'signed_document_123',email:'Advisor@example.invalid',processId:'process-1',artifactType:'ATA',signatureJobId:'job-1',expectedSha256:'a'.repeat(64)};
 let permissions:any[]=[{type:'user',role:'reader',emailAddress:'advisor@example.invalid'}];
 const metadata:any={id:input.fileId,mimeType:'application/pdf',appProperties:{portal:'portal-tcc',portalProcessId:'process-1',artifactType:'ATA',portalSignatureJobId:'job-1',sha256:input.expectedSha256},webViewLink:'https://drive.google.com/file/d/signed_document_123/view?resourcekey=fixture',webContentLink:'https://drive.usercontent.google.com/download?id=signed_document_123&export=download'};
 globalThis.fetch=async(url,init)=>{
  const parsed=new URL(String(url));calls.push(parsed.pathname);
  assert.equal(init?.method||'GET','GET');assert.equal(parsed.searchParams.has('alt'),false,'never transfer PDF bytes');
  return Response.json(parsed.pathname.endsWith('/permissions')?{permissions}:metadata);
 };
 try{
  assert.deepEqual(await resolvePrivateDriveBrowserLinks(input),{view:metadata.webViewLink,download:metadata.webContentLink});
  assert.equal(calls.length,2);
  permissions=[{type:'user',role:'reader',emailAddress:'someone-else@example.invalid'}];calls.length=0;
  assert.equal(await resolvePrivateDriveBrowserLinks(input),null);assert.equal(calls.length,1);
  permissions=[{type:'anyone',role:'reader'}];await assert.rejects(resolvePrivateDriveBrowserLinks(input),/compartilhamento amplo/);
  permissions=[{type:'user',role:'reader',emailAddress:input.email.toLowerCase()}];
  metadata.appProperties.portalProcessId='other-process';await assert.rejects(resolvePrivateDriveBrowserLinks(input),/não corresponde/);metadata.appProperties.portalProcessId=input.processId;
  metadata.appProperties.sha256='b'.repeat(64);assert.equal(await resolvePrivateDriveBrowserLinks(input),null);metadata.appProperties.sha256=input.expectedSha256;
  for(const unsafe of ['https://drive.google.com.attacker.invalid/file','http://drive.google.com/file','https://drive.google.com/file?access_token=secret','https://evil@drive.google.com/file','javascript:alert(1)']){
   metadata.webViewLink=unsafe;assert.equal(await resolvePrivateDriveBrowserLinks(input),null);
  }
 }finally{globalThis.fetch=original;}
});
