import test from 'node:test';import assert from 'node:assert/strict';
import {publicRepositoryDriveLinks} from './publicRepositoryDrive';import {withdrawDriveFilePublicAccess,withdrawManyPublicDriveFiles} from './googleDriveArchive';
function fixture(t:any){
 const calls:{path:string;method:string;body:any}[]=[],sha='a'.repeat(64),source='private_source_123',copy='public_copy_1234',parent='private_folder_123';
 const props={portal:'portal-tcc',portalProcessId:'process-1',publicationSourceFileId:source,sha256:sha,artifactType:'PUBLIC_REPOSITORY_COPY'};
 const sourceMetadata={id:source,name:'work.pdf',mimeType:'application/pdf',sha256Checksum:sha,parents:[parent],appProperties:{portal:'portal-tcc',portalProcessId:'process-1',artifactType:'TRABALHO_COMPLETO'}};
 const copyMetadata={...sourceMetadata,id:copy,appProperties:props,webViewLink:`https://drive.google.com/file/d/${copy}/view`,webContentLink:`https://drive.usercontent.google.com/download?id=${copy}&export=download`};
 const state={existing:false,shared:false,authorized:true,wrongHash:false,removed:false};
 t.mock.method(globalThis,'fetch',async(input:any,init?:RequestInit)=>{
  const u=new URL(String(input)),method=init?.method||'GET',body=init?.body?JSON.parse(String(init.body)):null;calls.push({path:u.pathname,method,body});
  assert.equal(u.searchParams.has('alt'),false,'PDF bytes must stay in Drive');
  if(u.pathname.endsWith('/copy')){assert.equal(method,'POST');assert.deepEqual(body.parents,[parent]);assert.equal(body.description,'');assert.equal(u.searchParams.get('ignoreDefaultVisibility'),'true');assert.equal(u.searchParams.get('copyComments'),'false');assert.equal(body.appProperties.publicationSourceFileId,source);state.existing=true;return Response.json(copyMetadata);}
  if(u.pathname.endsWith('/permissions')){
   const target=u.pathname.split('/').at(-2);
   if(method==='POST'){assert.equal(target,copy,'never share original or folder');assert.deepEqual(body,{type:'anyone',role:'reader',allowFileDiscovery:false});state.shared=true;return Response.json({id:'public-permission'});}
   return Response.json({permissions:[{id:'owner',type:'user',role:'owner'},...(target===copy&&state.shared?[{id:'public-permission',type:'anyone',role:'reader'}]:[])]});
  }
  if(method==='DELETE'){if(u.pathname.endsWith('/public-permission'))state.shared=false;else state.removed=true;return new Response(null,{status:204});}
  if(u.pathname==='/drive/v3/files')return Response.json({files:state.existing?[{id:copy}]:[]});
  return Response.json(u.pathname.endsWith('/'+source)?{...sourceMetadata,sha256Checksum:state.wrongHash?'b'.repeat(64):sha}:copyMetadata);
 });
 return {calls,state,input:{accessToken:'fixture',sourceFileId:source,scope:'process-1',sha256:sha,artifactType:'TRABALHO_COMPLETO' as const,assertAuthorized:async()=>state.authorized},copyMetadata,source,copy};
}
test('public copy is hash-bound, source stays private and repeated clicks transfer metadata only',async t=>{
 const f=fixture(t);assert.deepEqual(await publicRepositoryDriveLinks(f.input),{view:f.copyMetadata.webViewLink,download:f.copyMetadata.webContentLink});
 await publicRepositoryDriveLinks(f.input);assert.equal(f.calls.filter(c=>c.path.endsWith('/copy')).length,1);assert.equal(f.calls.filter(c=>c.method==='POST'&&c.path.endsWith('/permissions')).length,1);
});
test('denial reaches no provider; changed source hash never publishes',async t=>{
 const f=fixture(t);f.state.authorized=false;await assert.rejects(publicRepositoryDriveLinks(f.input));assert.equal(f.calls.length,0);
 f.state.authorized=true;f.state.wrongHash=true;await assert.rejects(publicRepositoryDriveLinks(f.input),/difere/);assert.ok(!f.calls.some(c=>c.method==='POST'));
});
test('an authorization revoked during creation discards the new copy without releasing a link',async t=>{
 const f=fixture(t);let checks=0;f.input.assertAuthorized=async()=>++checks<4;
 await assert.rejects(publicRepositoryDriveLinks(f.input),/autorização/);assert.equal(f.state.removed,true);
});
test('an existing withdrawn copy is never republished by GET',async t=>{
 const f=fixture(t);f.state.existing=true;f.state.shared=false;await assert.rejects(publicRepositoryDriveLinks(f.input),/retirada/);assert.ok(!f.calls.some(c=>c.method==='POST'));
});
test('withdrawal revokes every derivative and never removes private owner access',async t=>{
 const f=fixture(t);f.state.existing=true;f.state.shared=true;assert.equal((await withdrawDriveFilePublicAccess('fixture',f.source)).removed,1);assert.equal(f.state.shared,false);assert.ok(f.calls.filter(c=>c.method==='DELETE').every(c=>c.path.endsWith('/public-permission')));
});

test('a modified public copy loses the permission behind previously issued Drive links',async t=>{
 const f=fixture(t);f.state.existing=true;f.state.shared=true;f.copyMetadata.sha256Checksum='b'.repeat(64);
 await assert.rejects(publicRepositoryDriveLinks(f.input),/cópia pública mudou/);assert.equal(f.state.shared,false);assert.ok(!f.calls.some(c=>c.method==='POST'));
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

test('an invalid copy response can never delete or share the private source',async t=>{
 const f=fixture(t);f.copyMetadata.id=f.source;
 await assert.rejects(publicRepositoryDriveLinks(f.input),/cópia do PDF/);
 assert.ok(!f.calls.some(c=>c.method==='DELETE'));assert.ok(!f.calls.some(c=>c.method==='POST'&&c.path.endsWith('/permissions')));
});
