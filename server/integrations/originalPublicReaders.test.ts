import test from 'node:test';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
import {downloadDrivePdf,resolvePrivateDriveBrowserLinks} from './googleDriveArchive';
test('existing academic readers accept an explicitly authorized public original and retain private defaults',async t=>{
 const pdf=Buffer.from('%PDF-1.7\nOriginal authorized PDF'),sha=createHash('sha256').update(pdf).digest('hex');let role='reader';
 t.mock.method(globalThis,'fetch',async(input:any)=>{
  const u=new URL(String(input));
  if(u.pathname.endsWith('/permissions'))return Response.json({permissions:[{type:'user',role:'owner',emailAddress:'owner@example.invalid'},{type:'anyone',role}]});
  if(u.searchParams.get('alt')==='media')return new Response(pdf);
  return Response.json({id:'original_pdf_123',name:'Work.pdf',mimeType:'application/pdf',sha256Checksum:sha,appProperties:{portal:'portal-tcc',portalProcessId:'process-1',artifactType:'TRABALHO_COMPLETO',sha256:sha},webViewLink:'https://drive.google.com/file/d/original_pdf_123/view',webContentLink:'https://drive.google.com/uc?id=original_pdf_123&export=download'});
 });
 const expected={processId:'process-1',artifactType:'TRABALHO_COMPLETO',expectedSha256:sha};
 await assert.rejects(downloadDrivePdf('fixture','original_pdf_123',expected),/compartilhamento/);
 assert.deepEqual((await downloadDrivePdf('fixture','original_pdf_123',{...expected,allowPublicRead:true})).pdf,pdf);
 await assert.rejects(downloadDrivePdf('fixture','original_pdf_123',{...expected,allowPublicRead:true,expectedSha256:'b'.repeat(64)}),/difere/);
 const input={accessToken:'fixture',fileId:'original_pdf_123',email:'participant@example.invalid',...expected};
 await assert.rejects(resolvePrivateDriveBrowserLinks(input),/compartilhamento/);
 assert.ok(await resolvePrivateDriveBrowserLinks({...input,allowPublicRead:true}));
 await assert.rejects(downloadDrivePdf('fixture','original_pdf_123',{...expected,artifactType:'ATA',allowPublicRead:true}),/compartilhamento/);
 role='writer';await assert.rejects(downloadDrivePdf('fixture','original_pdf_123',{...expected,allowPublicRead:true}),/Compartilhamento/);await assert.rejects(resolvePrivateDriveBrowserLinks({...input,allowPublicRead:true}),/compartilhamento/);
});
