import test from 'node:test';
import assert from 'node:assert/strict';
import {processDriveReaderEmails,grantMissingDriveReaders} from './processDriveReaders';
import {resolvePrivateDriveBrowserLinks,ensurePortalProcessDriveFolder,uploadProcessFormPdf,listSupersededProcessAcademicFiles} from './googleDriveArchive';
import {createHash} from 'node:crypto';

test('automatic readers come only from persisted authors and advisor',()=>{
  assert.deepEqual(processDriveReaderEmails({aluno1:{email:'Author@Example.invalid'},aluno2:{email:'author@example.invalid'},orientador:{email:'advisor@example.invalid'},banca:[{email:'examiner@example.invalid'}]} as any,()=>true),['author@example.invalid','advisor@example.invalid']);
});

test('reader enrollment is silent, read-only and does not repeat existing grants',async t=>{
  const permissions:any[]=[];let writes=0;
  t.mock.method(globalThis,'fetch',async(url,init)=>{
    const u=new URL(String(url));assert.equal(u.searchParams.get('sendNotificationEmail'),'false');
    assert.equal(init?.method,'POST');writes++;
    const body=JSON.parse(String(init.body));assert.deepEqual(body,{type:'user',role:'reader',emailAddress:'author@example.invalid'});
    return Response.json({id:'permission',...body});
  });
  await grantMissingDriveReaders('fixture','file_12345678',['author@example.invalid'],permissions);
  await grantMissingDriveReaders('fixture','file_12345678',['author@example.invalid'],permissions);
  assert.equal(writes,1);
});

test('direct access verifies file binding and integrity before enrolling a participant',async t=>{
  let writes=0,process='process-1',sha='a'.repeat(64);
  const input={accessToken:'fixture',fileId:'document_12345678',email:'author@example.invalid',readerEmails:['author@example.invalid'],processId:'process-1',artifactType:'ATA',expectedSha256:'a'.repeat(64)};
  t.mock.method(globalThis,'fetch',async(url,init)=>{
    const path=new URL(String(url)).pathname;
    if(init?.method==='POST'){writes++;return Response.json({id:'reader-1',type:'user',role:'reader',emailAddress:input.email});}
    if(path.endsWith('/permissions'))return Response.json({permissions:[{type:'user',role:'owner',emailAddress:'owner@example.invalid'}]});
    return Response.json({id:input.fileId,mimeType:'application/pdf',appProperties:{portal:'portal-tcc',portalProcessId:process,artifactType:'ATA',sha256:sha},sha256Checksum:sha,webViewLink:'https://drive.google.com/file/d/document_12345678/view',webContentLink:'https://drive.usercontent.google.com/download?id=document_12345678'});
  });
  process='other-process';await assert.rejects(resolvePrivateDriveBrowserLinks(input),/não corresponde/);assert.equal(writes,0);
  process='process-1';sha='b'.repeat(64);assert.equal(await resolvePrivateDriveBrowserLinks(input),null);assert.equal(writes,0);
  sha='a'.repeat(64);assert.ok(await resolvePrivateDriveBrowserLinks(input));assert.equal(writes,1);
  assert.equal(await resolvePrivateDriveBrowserLinks({...input,email:'outsider@example.invalid'}),null);assert.equal(writes,1);
});

test('synchronization revokes only its own obsolete reader and preserves manual grants',async t=>{
  const key='portalReader_'+createHash('sha256').update('previous@example.invalid').digest('hex').slice(0,24);
  const permissions=[{id:'managed-reader',type:'user',role:'reader',emailAddress:'previous@example.invalid'},{id:'manual-reader',type:'user',role:'reader',emailAddress:'manual@example.invalid'},{id:'owner',type:'user',role:'owner',emailAddress:'owner@example.invalid'}];
  const writes:Array<{url:string;method?:string;body:unknown}>=[];
  t.mock.method(globalThis,'fetch',async(url,init)=>{writes.push({url:String(url),method:init?.method,body:init?.body?JSON.parse(String(init.body)):null});return init?.method==='DELETE'?new Response(null,{status:204}):Response.json({id:'file_12345678'});});
  await grantMissingDriveReaders('fixture','file_12345678',[],permissions,{[key]:'managed-reader'});
  assert.equal(writes.length,2);assert.match(writes[0].url,/permissions\/managed-reader\?/);assert.equal(writes[0].method,'DELETE');
  assert.deepEqual(writes[1].body,{appProperties:{[key]:null}});assert.deepEqual(permissions.map(p=>p.id),['manual-reader','owner']);
});

test('failed permission bookkeeping rolls back only the readers created by this attempt',async t=>{
  const methods:string[]=[];
  t.mock.method(globalThis,'fetch',async(url,init)=>{
    methods.push(String(init?.method));
    if(init?.method==='POST')return Response.json({id:'new-reader',type:'user',role:'reader',emailAddress:'author@example.invalid'});
    if(init?.method==='PATCH')return new Response(null,{status:503});
    assert.match(String(url),/permissions\/new-reader\?/);
    return new Response(null,{status:204});
  });
  await assert.rejects(grantMissingDriveReaders('fixture','file_12345678',['author@example.invalid'],[],{}),/registrar/);
  assert.deepEqual(methods,['POST','PATCH','DELETE']);
});

test('reservation direct links require the exact archived form version before sharing',async t=>{
  let grants=0;
  t.mock.method(globalThis,'fetch',async(url,init)=>{
    if(init?.method==='POST'){grants++;throw Error('must not share a different revision');}
    if(String(url).includes('/permissions'))return Response.json({permissions:[]});
    return Response.json({id:'receipt_12345678',mimeType:'application/pdf',appProperties:{portal:'portal-tcc',portalProcessId:'process-1',formType:'CONFIRMACAO_LOCAL',formVersion:'1'}});
  });
  await assert.rejects(resolvePrivateDriveBrowserLinks({accessToken:'fixture',fileId:'receipt_12345678',email:'author@example.invalid',readerEmails:['author@example.invalid'],processId:'process-1',artifactType:'CONFIRMACAO_LOCAL',formVersion:2}),/não corresponde/);
  assert.equal(grants,0);
});

test('oversized and malformed addresses cannot request a Drive permission',async t=>{
  let calls=0;t.mock.method(globalThis,'fetch',async()=>{calls++;throw Error('must not contact Google');});
  for(const email of ['a@b', 'a@@b.invalid', 'a b@example.invalid', '!@!.'+'!.'.repeat(10000)]){
    assert.deepEqual(processDriveReaderEmails({aluno1:{email}} as any,()=>true),[]);
    await assert.rejects(grantMissingDriveReaders('fixture','file_12345678',[email],[]),/inválido/);
  }
  assert.equal(calls,0);
});

test('revoked participants are excluded despite their historical process membership',()=>{
  const process={aluno1:{email:'revoked@example.invalid'},aluno2:{email:'active@example.invalid'},orientador:{email:'advisor@example.invalid'}};
  assert.deepEqual(processDriveReaderEmails(process as any,email=>email!=='revoked@example.invalid'),['active@example.invalid','advisor@example.invalid']);
});

test('preparing a process folder never shares its private custom response descendants',async t=>{
  let writes=0;
  t.mock.method(globalThis,'fetch',async(url,init)=>{
    if(init?.method){writes++;throw Error('no ACL writes while preparing folders');}
    const u=new URL(String(url));if(u.pathname.endsWith('/permissions'))return Response.json({permissions:[]});
    if(u.pathname.endsWith('/processes_folder'))return Response.json({id:'processes_folder',name:'Processos',mimeType:'application/vnd.google-apps.folder',parents:['portal_root']});
    return Response.json({files:[{id:'process_folder',name:'TEST-1',mimeType:'application/vnd.google-apps.folder',parents:['processes_folder'],appProperties:{portalProcessId:'process-1'},properties:{portalDriveLayout:'flat-v1'},webViewLink:'https://drive.google.com/drive/folders/process_folder'}]});
  });
  await ensurePortalProcessDriveFolder({accessToken:'fixture',rootFolderId:'portal_root',protocol:'TEST-1',processId:'process-1'});
  assert.equal(writes,0);
});

test('custom submission PDFs remain private even if reader emails are accidentally supplied',async t=>{
  let writes=0;
  t.mock.method(globalThis,'fetch',async(url,init)=>{
    if(init?.method){writes++;throw Error('custom submissions must never receive participant ACLs');}
    const u=new URL(String(url));
    if(u.pathname.endsWith('/permissions'))return Response.json({permissions:[]});
    const q=u.searchParams.get('q')||'';
    return Response.json({files:q.includes('portalProcessId')?[{id:'custom_pdf_12345',parents:['process_folder'],appProperties:{sha256:'a'.repeat(64)}}]:[{id:'private_folder_12345'}]});
  });
  await uploadProcessFormPdf({accessToken:'fixture',processFolderId:'process_folder',processId:'process-1',protocol:'TEST-1',studentNames:['Fixture'],formType:'CUSTOM_examiner',version:1,pdf:Buffer.from('%PDF-fixture'),sha256:'a'.repeat(64),readerEmails:['author@example.invalid']});
  assert.equal(writes,0);
});

test('replaced academic originals are inventoried without PDF transfer and unrelated forms are rejected',async t=>{
  let calls=0,artifactType='TRABALHO_COMPLETO';
  t.mock.method(globalThis,'fetch',async(url,init)=>{
    calls++;assert.equal(init?.method,undefined);const u=new URL(String(url));assert.equal(u.pathname,'/drive/v3/files');
    assert.match(u.searchParams.get('q')||'',/SUPERSEDED/);assert.ok(!u.searchParams.has('alt'));
    return Response.json({files:[{id:'old_academic_12345',mimeType:'application/pdf',appProperties:{portal:'portal-tcc',portalProcessId:'process-1',lifecycle:'SUPERSEDED',artifactType,sha256:'a'.repeat(64)},sha256Checksum:'a'.repeat(64)}]});
  });
  assert.deepEqual(await listSupersededProcessAcademicFiles('fixture','process-1'),[{fileId:'old_academic_12345',artifactType,expectedSha256:'a'.repeat(64)}]);
  artifactType='CUSTOM_examiner';await assert.rejects(listSupersededProcessAcademicFiles('fixture','process-1'),/não corresponde/);assert.equal(calls,2);
});
