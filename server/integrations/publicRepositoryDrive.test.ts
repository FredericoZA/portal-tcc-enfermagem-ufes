import test from 'node:test';import assert from 'node:assert/strict';
import {DriveFlatFolderPermissionError,publicRepositoryDriveLinks} from './publicRepositoryDrive';import {withdrawDriveFilePublicAccess,withdrawManyPublicDriveFiles,preparePublicationSource} from './googleDriveArchive';
function fixture(t:any){
 const calls:{path:string;method:string;body:any}[]=[],sha='a'.repeat(64),source='original_source_123',copy='old_copy_1234',parent='private_folder_123';
 const sourceMetadata={id:source,name:'work.pdf',mimeType:'application/pdf',sha256Checksum:sha,parents:[parent],appProperties:{portal:'portal-tcc',portalProcessId:'process-1',artifactType:'TRABALHO_COMPLETO'},webViewLink:`https://drive.google.com/file/d/${source}/view`,webContentLink:`https://drive.google.com/uc?id=${source}&export=download`};
 const copyMetadata={...sourceMetadata,id:copy,appProperties:{portal:'portal-tcc',portalProcessId:'process-1',publicationSourceFileId:source,sha256:sha,artifactType:'PUBLIC_REPOSITORY_COPY'}};
 const state={existing:false,shared:false,authorized:true,copyShared:true,trashed:false,writer:true};
 t.mock.method(globalThis,'fetch',async(input:any,init?:RequestInit)=>{
  const u=new URL(String(input)),method=init?.method||'GET',body=init?.body?JSON.parse(String(init.body)):null;calls.push({path:u.pathname,method,body});
  assert.equal(u.searchParams.has('alt'),false,'PDF bytes must stay in Drive');assert.ok(!u.pathname.endsWith('/copy'),'No copy operation is allowed');
  if(u.pathname.endsWith('/permissions')){
   const target=u.pathname.split('/').at(-2);
   if(method==='POST'){assert.equal(target,source);assert.deepEqual(body,{type:'anyone',role:'reader',allowFileDiscovery:false});state.shared=true;return Response.json({id:'public-permission'});}
   return Response.json({permissions:[{id:'owner',type:'user',role:'owner'},...(target===source?[{id:'collaborator',type:'user',role:state.writer?'writer':'reader'}]:[]),...((target===source&&state.shared)||(target===copy&&state.copyShared)?[{id:'public-permission',type:'anyone',role:'reader'}]:[])]});
  }
  if(method==='DELETE'){if(u.pathname.includes('/'+source+'/'))state.shared=false;else state.copyShared=false;return new Response(null,{status:204});}
  if(method==='PATCH'){if(u.pathname.endsWith('/collaborator')){assert.deepEqual(body,{role:'reader'});state.writer=false;}else if(u.pathname==='/drive/v3/files/'+source&&body.appProperties){Object.assign(sourceMetadata.appProperties,body.appProperties);}else{assert.equal(u.pathname,'/drive/v3/files/'+copy);assert.deepEqual(body,{trashed:true});state.trashed=true;}return Response.json({});}
  if(u.pathname==='/drive/v3/files')return Response.json({files:state.existing&&!state.trashed?[copyMetadata]:[]});
  return Response.json(sourceMetadata);
 });
 return {calls,state,input:{accessToken:'fixture',sourceFileId:source,scope:'process-1',sha256:sha,artifactType:'TRABALHO_COMPLETO' as const,assertAuthorized:async()=>state.authorized},sourceMetadata,copyMetadata,source,copy,parent};
}
test('authorized original becomes public reader only; repeat clicks never copy or transfer PDF bytes',async t=>{
 const f=fixture(t);assert.deepEqual(await publicRepositoryDriveLinks(f.input),{view:f.sourceMetadata.webViewLink,download:f.sourceMetadata.webContentLink});
 await publicRepositoryDriveLinks(f.input);assert.equal(f.calls.filter(c=>c.method==='POST').length,1);assert.equal(f.state.writer,false);assert.equal(f.state.shared,true);assert.ok(f.calls.every(c=>c.method!=='DELETE'));
});
test('historical publication preserves nominal editors and remains pending without granting public access',async t=>{
 const f=fixture(t);
 await assert.rejects(publicRepositoryDriveLinks({...f.input,preserveNamedPermissions:true}),/permissão nominal de edição/);
 assert.equal(f.state.writer,true);assert.equal(f.state.shared,false);
 assert.ok(!f.calls.some(call=>call.method==='POST'||call.method==='PATCH'&&call.path.endsWith('/collaborator')));
});
test('denial reaches no provider; changed original hash revokes old public access',async t=>{
 const f=fixture(t);f.state.authorized=false;await assert.rejects(publicRepositoryDriveLinks(f.input));assert.equal(f.calls.length,0);
 f.state.authorized=true;f.state.shared=true;f.sourceMetadata.sha256Checksum='b'.repeat(64);await assert.rejects(publicRepositoryDriveLinks(f.input),/difere/);assert.equal(f.state.shared,false);assert.ok(!f.calls.some(c=>c.method==='POST'));
});
test('authorization revoked while sharing removes the original public permission',async t=>{
 const f=fixture(t);let checks=0;f.input.assertAuthorized=async()=>++checks<4;
 await assert.rejects(publicRepositoryDriveLinks(f.input),/autorização/);assert.equal(f.state.shared,false);assert.ok(!f.calls.some(c=>c.method==='DELETE'&&!c.path.includes('/permissions/')));
});
test('only verified former duplicates are revoked and trashed after original publication',async t=>{
 const f=fixture(t);f.state.existing=true;await publicRepositoryDriveLinks(f.input);assert.equal(f.state.shared,true);assert.equal(f.state.copyShared,false);assert.equal(f.state.trashed,true);
});
test('a differing former copy loses public access but its unique content is preserved',async t=>{
 const f=fixture(t);f.state.existing=true;f.copyMetadata.sha256Checksum='b'.repeat(64);await publicRepositoryDriveLinks(f.input);assert.equal(f.state.copyShared,false);assert.equal(f.state.trashed,false);
});
test('invalid duplicate inventory can never trash the original',async t=>{
 const f=fixture(t);f.state.existing=true;f.copyMetadata.id=f.source;await assert.rejects(publicRepositoryDriveLinks(f.input),/Vínculo/);assert.ok(!f.calls.some(c=>c.method==='PATCH'&&c.path==='/drive/v3/files/'+f.source));assert.equal(f.state.shared,false);
});
test('authorization preparation binds the original without premature public access',async t=>{
 const f=fixture(t);const result=await preparePublicationSource({accessToken:'fixture',processFolderId:f.parent,sourceFileId:f.source,processId:'process-1',artifactType:'TRABALHO_COMPLETO',sha256:f.input.sha256});assert.equal(result.id,f.source);assert.equal(f.state.shared,false);
});
test('withdrawal removes public access from original and former duplicate without touching the owner',async t=>{
 const f=fixture(t);f.state.existing=true;f.state.shared=true;assert.equal((await withdrawDriveFilePublicAccess('fixture',f.source)).removed,2);assert.equal(f.state.shared,false);assert.equal(f.state.copyShared,false);assert.ok(f.calls.filter(c=>c.method==='DELETE').every(c=>c.path.endsWith('/public-permission')));
});
test('withdrawal reaches every public copy even if the original is deleted or inaccessible',async t=>{
 for(const status of [404,403]){
  let copyRevoked=false;
  t.mock.method(globalThis,'fetch',async(input:any,init?:RequestInit)=>{
   const u=new URL(String(input));
   if(u.pathname==='/drive/v3/files')return Response.json({files:[{id:'public_copy_1234'}]});
   if(u.pathname.includes('private_source_123'))return Response.json({error:{message:'Original unavailable'}},{status});
   if(init?.method==='DELETE'){copyRevoked=true;return new Response(null,{status:204});}
   return Response.json({permissions:[{id:'public-reader',type:'anyone',role:'reader'}]});
  });
  const run=withdrawDriveFilePublicAccess('fixture','private_source_123');
  if(status===404)assert.equal((await run).removed,1);else await assert.rejects(run,/pendentes/);
  assert.equal(copyRevoked,true);
 }
});

test('withdrawal of multiple PDFs continues after an individual source failure',async t=>{
 const revoked:string[]=[];
 t.mock.method(globalThis,'fetch',async(input:any,init?:RequestInit)=>{
  const u=new URL(String(input));if(u.pathname==='/drive/v3/files')return Response.json({files:[]});
  if(u.pathname.includes('inaccessible_source'))return Response.json({error:{message:'No access'}},{status:403});
  if(init?.method==='DELETE'){revoked.push(u.pathname);return new Response(null,{status:204});}
  return Response.json({permissions:[{id:'reader',type:'anyone',role:'reader'}]});
 });
 await assert.rejects(withdrawManyPublicDriveFiles('fixture',['inaccessible_source','other_source_123']),/pendentes/);assert.equal(revoked.length,1);
});

test('Drive refusal to remove collaborator editing fails closed and revokes public reading',async t=>{
 const f=fixture(t),fetch=globalThis.fetch;f.state.shared=true;
 t.mock.method(globalThis,'fetch',async(input:any,init?:RequestInit)=>{
  if(init?.method==='PATCH'&&String(input).includes('/permissions/collaborator'))return Response.json({error:{message:'Inherited editing cannot be changed'}},{status:403});
  return fetch(input,init);
 });
 await assert.rejects(publicRepositoryDriveLinks(f.input));assert.equal(f.state.shared,false);assert.ok(!f.calls.some(c=>c.method==='POST'&&c.path.endsWith('/permissions')));
});
test('flat process properties prevent inherited-editing fallback from creating subfolders or moving the original',async t=>{
 const f=fixture(t),fetch=globalThis.fetch;f.state.shared=true;
 t.mock.method(globalThis,'fetch',async(input:any,init?:RequestInit)=>{
  const u=new URL(String(input));
  if(init?.method==='PATCH'&&u.pathname.endsWith('/permissions/collaborator'))return Response.json({error:{errors:[{reason:'cannotModifyInheritedPermission'}]}},{status:403});
  if(u.pathname==='/drive/v3/files/'+f.parent){
   assert.ok((u.searchParams.get('fields')||'').split(',').includes('properties'),'Migration properties must be read across OAuth applications');
   return Response.json({id:f.parent,mimeType:'application/vnd.google-apps.folder',parents:['academic_root_123'],properties:{portalDriveLayout:'flat-v1'}});
  }
  return fetch(input,init);
 });
 await assert.rejects(publicRepositoryDriveLinks(f.input),error=>error instanceof DriveFlatFolderPermissionError&&error.code==='DRIVE_FLAT_FOLDER_PERMISSION_CONFLICT'&&/leitura na pasta/.test(error.message));
 assert.equal(f.state.shared,false);
 assert.equal(f.state.writer,true,'Publication must not claim owner-only editing after an inherited permission refusal');
 assert.deepEqual(f.sourceMetadata.parents,[f.parent]);
 assert.equal(f.calls.some(call=>call.method==='POST'),false);
 assert.equal(f.calls.some(call=>call.method==='PATCH'&&call.path==='/drive/v3/files/'+f.source),false);
});
test('a flat ancestor also blocks isolating an original still inside an old child folder',async t=>{
 const f=fixture(t),fetch=globalThis.fetch;f.state.shared=true;
 t.mock.method(globalThis,'fetch',async(input:any,init?:RequestInit)=>{
  const u=new URL(String(input));
  if(init?.method==='PATCH'&&u.pathname.endsWith('/permissions/collaborator'))return Response.json({error:{}},{status:403});
  if(u.pathname==='/drive/v3/files/'+f.parent)return Response.json({id:f.parent,mimeType:'application/vnd.google-apps.folder',parents:['flat_process_123']});
  if(u.pathname==='/drive/v3/files/flat_process_123')return Response.json({id:'flat_process_123',mimeType:'application/vnd.google-apps.folder',parents:[],properties:{portalDriveLayout:'flat-v1'}});
  return fetch(input,init);
 });
 await assert.rejects(publicRepositoryDriveLinks(f.input),DriveFlatFolderPermissionError);
 assert.equal(f.state.shared,false);
 assert.equal(f.calls.some(call=>call.method==='POST'),false);
});
test('an expanded abstract can only be published with its own bound source type',async t=>{
 const f=fixture(t);await assert.rejects(publicRepositoryDriveLinks({...f.input,artifactType:'RESUMO_EXPANDIDO'}),/outro processo/);assert.equal(f.state.shared,false);assert.ok(!f.calls.some(c=>c.method==='POST'));
});
test('inherited editing is isolated in an owner-only child while preserving the original ID and bytes',async t=>{
 const sha='a'.repeat(64),sourceId='original_source_123',oldParent='old_parent_123',folderId='owned_folder_123';let moved=false,limited=false,shared=false,created=0;
 const folder=()=>({id:folderId,mimeType:'application/vnd.google-apps.folder',parents:[oldParent],inheritedPermissionsDisabled:limited,appProperties:{portal:'portal-tcc',portalProcessId:'process-1',artifactType:'ORIGINALS_PRIVATE_FOLDER'}});
 const source=()=>({id:sourceId,name:'original.pdf',mimeType:'application/pdf',sha256Checksum:sha,parents:[moved?folderId:oldParent],appProperties:{portal:'portal-tcc',portalProcessId:'process-1',artifactType:'TRABALHO_COMPLETO'},webViewLink:`https://drive.google.com/file/d/${sourceId}/view`,webContentLink:`https://drive.google.com/uc?id=${sourceId}&export=download`});
 t.mock.method(globalThis,'fetch',async(input:any,init?:RequestInit)=>{
  const u=new URL(String(input)),method=init?.method||'GET',body=init?.body?JSON.parse(String(init.body)):null;assert.ok(!u.pathname.endsWith('/copy'));assert.ok(!u.searchParams.has('alt'));
  if(u.pathname.endsWith('/permissions/inherited-writer'))return Response.json({error:{errors:[{reason:'cannotModifyInheritedPermission'}]}},{status:403});
  if(u.pathname.endsWith('/permissions')){
   const id=u.pathname.split('/').at(-2);
   if(method==='POST'){assert.equal(id,sourceId);assert.deepEqual(body,{type:'anyone',role:'reader',allowFileDiscovery:false});shared=true;return Response.json({id:'public'});}
   if(id===oldParent)return Response.json({permissions:[{id:'other-owner',type:'user',role:'owner'},{id:'institutional',type:'user',role:'writer'}]});
   return Response.json({permissions:[{id:'institutional',type:'user',role:'owner'},...((id===sourceId&&!moved)||(id===folderId&&!limited)?[{id:'inherited-writer',type:'user',role:'writer'}]:[]),...(id===folderId&&limited?[{id:'inherited-writer',type:'user',role:'reader',view:'metadata'}]:[]),...(id===sourceId&&shared?[{id:'public',type:'anyone',role:'reader'}]:[])]});
  }
  if(u.pathname==='/drive/v3/files'){
   if(method==='POST'){created++;assert.equal(body.mimeType,'application/vnd.google-apps.folder');assert.deepEqual(body.parents,[oldParent]);return Response.json(folder());}
   return Response.json({files:[]});
  }
  if(u.pathname.endsWith('/'+oldParent))return Response.json({id:oldParent,mimeType:'application/vnd.google-apps.folder',parents:[],properties:{}});
  if(u.pathname.endsWith('/'+folderId)){if(method==='PATCH'){assert.deepEqual(body,{inheritedPermissionsDisabled:true});limited=true;}return Response.json(folder());}
  if(method==='PATCH'){assert.equal(u.pathname,'/drive/v3/files/'+sourceId);assert.equal(u.searchParams.get('addParents'),folderId);assert.equal(u.searchParams.get('removeParents'),oldParent);assert.deepEqual(body,{});moved=true;}
  return Response.json(source());
 });
 const input={accessToken:'fixture',sourceFileId:sourceId,scope:'process-1',sha256:sha,artifactType:'TRABALHO_COMPLETO' as const,assertAuthorized:async()=>true};
 assert.equal((await publicRepositoryDriveLinks(input)).view,source().webViewLink);await publicRepositoryDriveLinks(input);assert.equal(created,1);assert.equal(moved,true);assert.equal(limited,true);assert.equal(shared,true);
});

test('issued public documents bind the exact signature job and cache content validation by original hash',async t=>{
 const f=fixture(t);Object.assign(f.sourceMetadata.appProperties,{artifactType:'ATA',portalSignatureJobId:'job-1'});let checks=0;
 const input={...f.input,artifactType:'ATA' as const,signatureJobId:'job-1',validatePublicContent:async()=>{checks++;}};
 await publicRepositoryDriveLinks(input);await publicRepositoryDriveLinks(input);
 assert.equal(checks,1);assert.equal(f.state.shared,true);assert.ok(!f.calls.some(c=>c.path.endsWith('/copy')));
 await assert.rejects(publicRepositoryDriveLinks({...input,signatureJobId:'wrong-job'}),/outro processo ou versão/);
});
test('unsafe issued documents are never made public and lose previous public read permission',async t=>{
 const f=fixture(t);Object.assign(f.sourceMetadata.appProperties,{artifactType:'CONVITE'});f.state.shared=true;
 await assert.rejects(publicRepositoryDriveLinks({...f.input,artifactType:'CONVITE',validatePublicContent:async()=>{throw Error('credencial de acesso pessoal');}}),/credencial/);
 assert.equal(f.state.shared,false);assert.ok(!f.calls.some(c=>c.method==='POST'));
});

test('document binding is checked again after the public content review',async t=>{
 const f=fixture(t);Object.assign(f.sourceMetadata.appProperties,{artifactType:'ATA',portalSignatureJobId:'job-1'});
 await assert.rejects(publicRepositoryDriveLinks({...f.input,artifactType:'ATA',signatureJobId:'job-1',validatePublicContent:async()=>{f.sourceMetadata.appProperties.portalProcessId='other-process';}}),/mudou durante/);
 assert.equal(f.state.shared,false);assert.ok(!f.calls.some(c=>c.method==='POST'));
});
