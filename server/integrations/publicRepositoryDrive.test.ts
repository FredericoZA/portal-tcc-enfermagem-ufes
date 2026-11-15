import test from 'node:test';import assert from 'node:assert/strict';
import {publicRepositoryDriveLinks} from './publicRepositoryDrive';import {withdrawDriveFilePublicAccess,withdrawManyPublicDriveFiles,prepareAuthorizedPublicationSource} from './googleDriveArchive';
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
  if(method==='PATCH'){if(u.pathname.endsWith('/collaborator')){assert.deepEqual(body,{role:'reader'});state.writer=false;}else{assert.equal(u.pathname,'/drive/v3/files/'+copy);assert.deepEqual(body,{trashed:true});state.trashed=true;}return Response.json({});}
  if(u.pathname==='/drive/v3/files')return Response.json({files:state.existing&&!state.trashed?[copyMetadata]:[]});
  return Response.json(sourceMetadata);
 });
 return {calls,state,input:{accessToken:'fixture',sourceFileId:source,scope:'process-1',sha256:sha,artifactType:'TRABALHO_COMPLETO' as const,assertAuthorized:async()=>state.authorized},sourceMetadata,copyMetadata,source,copy,parent};
}
test('authorized original becomes public reader only; repeat clicks never copy or transfer PDF bytes',async t=>{
 const f=fixture(t);assert.deepEqual(await publicRepositoryDriveLinks(f.input),{view:f.sourceMetadata.webViewLink,download:f.sourceMetadata.webContentLink});
 await publicRepositoryDriveLinks(f.input);assert.equal(f.calls.filter(c=>c.method==='POST').length,1);assert.equal(f.state.writer,false);assert.equal(f.state.shared,true);assert.ok(f.calls.every(c=>c.method!=='DELETE'));
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
test('final authorization synchronization grants read-only access to the existing original',async t=>{
 const f=fixture(t);const result=await prepareAuthorizedPublicationSource({accessToken:'fixture',processFolderId:f.parent,sourceFileId:f.source,processId:'process-1',artifactType:'TRABALHO_COMPLETO',sha256:f.input.sha256,assertAuthorized:f.input.assertAuthorized});assert.equal(result.id,f.source);assert.equal(f.state.shared,true);
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
 await assert.rejects(publicRepositoryDriveLinks(f.input));assert.equal(f.state.shared,false);assert.ok(!f.calls.some(c=>c.method==='POST'));
});
test('an expanded abstract can only be published with its own bound source type',async t=>{
 const f=fixture(t);await assert.rejects(publicRepositoryDriveLinks({...f.input,artifactType:'RESUMO_EXPANDIDO'}),/outro processo/);assert.equal(f.state.shared,false);assert.ok(!f.calls.some(c=>c.method==='POST'));
});
