import test from 'node:test';import assert from 'node:assert/strict';
import {deleteProcessDriveArtifacts} from './integrations/googleDriveArchive';

test('limpeza encontra versões gerais pelo job de assinatura sem depender do fileId atual',async t=>{
 const deleted:string[]=[],queries:string[]=[];
 const files:Record<string,any>={unsigned:{id:'unsigned',mimeType:'application/pdf',appProperties:{portal:'portal-tcc',portalSignatureJobId:'job-own'}},signed:{id:'signed',mimeType:'application/pdf',appProperties:{portal:'portal-tcc',portalSignatureJobId:'job-own'}},form:{id:'form',mimeType:'application/pdf',appProperties:{portalProcessId:'p'}}};
 t.mock.method(globalThis,'fetch',async(input:unknown,init?:RequestInit)=>{
  const url=new URL(String(input)),id=url.pathname.split('/').pop()!;
  if(init?.method==='DELETE'){deleted.push(id);delete files[id];return new Response(null,{status:204});}
  if(id==='files'){const query=url.searchParams.get('q')||'';queries.push(query);return Response.json({files:query.includes('portalSignatureJobId')?Object.values(files).map(file=>({id:file.id})):[]});}
  return files[id]?Response.json(files[id]):new Response(null,{status:404});
 });
 const input={accessToken:'fake',processId:'p',protocol:'TCC-2026-0999',rootFolderId:'root',protectedIds:['model'],fileIds:[],jobIds:['job-own']};
 await deleteProcessDriveArtifacts(input);assert.deepEqual(deleted,['unsigned','signed','form']);
 assert.ok(queries.some(query=>query.includes("key='portalSignatureJobId'")&&query.includes("value='job-own'")));
 await deleteProcessDriveArtifacts(input);assert.deepEqual(deleted,['unsigned','signed','form']);
});

test('listagem paginada é concluída antes de remover artefatos e todos os resultados são limpos',async t=>{
 const deleted:string[]=[],pages:string[]=[];
 t.mock.method(globalThis,'fetch',async(input:unknown,init?:RequestInit)=>{
  const url=new URL(String(input)),id=url.pathname.split('/').pop()!;
  if(init?.method==='DELETE'){deleted.push(id);return new Response(null,{status:204});}
  if(id==='files'){
   if(!(url.searchParams.get('q')||'').includes('appProperties'))return Response.json({files:[]});
   const page=url.searchParams.get('pageToken')||'';pages.push(page);assert.equal(deleted.length,0);
   return Response.json(page?{files:[{id:'second'}]}:{files:[{id:'first'}],nextPageToken:'next/page+'});
  }
  return Response.json({id,mimeType:'application/pdf',appProperties:{portalProcessId:'p'}});
 });
 await deleteProcessDriveArtifacts({accessToken:'fake',processId:'p',protocol:'TCC-2026-0999',rootFolderId:'root',fileIds:[],protectedIds:[]});
 assert.deepEqual(pages,['','next/page+']);assert.deepEqual(deleted,['first','second']);
});

test('filho sem vínculo que saiu da pasta e modelos movidos para o TCC são preservados',async t=>{
 const folderMime='application/vnd.google-apps.folder';
 for(const model of [false,true]){
  let deleted=0;
  const files:Record<string,any>={folder:{id:'folder',name:'TCC-2026-0999',parents:['processes'],mimeType:folderMime},processes:{id:'processes',name:'02_PROCESSOS',parents:['root'],mimeType:folderMime},child:{id:'child',mimeType:'application/pdf',parents:[model?'folder':'another-folder'],appProperties:model?{portal:'portal-tcc',lifecycle:'active-model'}:{}}};
  const mock=t.mock.method(globalThis,'fetch',async(input:unknown,init?:RequestInit)=>{
   if(init?.method==='DELETE'){deleted++;return new Response(null,{status:204});}
   const url=new URL(String(input)),id=url.pathname.split('/').pop()!;
   return id==='files'?Response.json({files:[{id:'child'}]}):Response.json(files[id]);
  });
  await assert.rejects(deleteProcessDriveArtifacts({accessToken:'fake',processId:'p',protocol:'TCC-2026-0999',rootFolderId:'root',folderId:'folder',fileIds:[],protectedIds:[]}),model?/modelo/:/vínculo|pasta/);
  assert.equal(deleted,0);mock.mock.restore();
 }
});

test('artefato antigo de outro job não é apagado por ter sido movido à pasta do TCC',async t=>{
 let deleted=0;const folderMime='application/vnd.google-apps.folder';
 const files:Record<string,any>={folder:{id:'folder',name:'TCC-2026-0999',parents:['processes'],mimeType:folderMime},processes:{id:'processes',name:'02_PROCESSOS',parents:['root'],mimeType:folderMime},child:{id:'child',mimeType:'application/pdf',parents:['folder'],appProperties:{portal:'portal-tcc',portalSignatureJobId:'job-foreign'}}};
 t.mock.method(globalThis,'fetch',async(input:unknown,init?:RequestInit)=>{
  if(init?.method==='DELETE'){deleted++;return new Response(null,{status:204});}
  const url=new URL(String(input)),id=url.pathname.split('/').pop()!;
  return id==='files'?Response.json({files:url.searchParams.get('q')?.includes("'folder' in parents")?[{id:'child'}]:[]}):Response.json(files[id]);
 });
 await assert.rejects(deleteProcessDriveArtifacts({accessToken:'fake',processId:'p',protocol:'TCC-2026-0999',rootFolderId:'root',folderId:'folder',fileIds:[],protectedIds:[],jobIds:['job-own']}),/outra solicitação de assinatura/);
 assert.equal(deleted,0);
});

test('pasta sem vínculo persistido é encontrada apenas no caminho exato do Portal',async t=>{
 const folderMime='application/vnd.google-apps.folder',protocol='TCC-2026-0999';
 for(const annual of [false,true]){
  const deleted:string[]=[],queries:string[]=[];
  const files:Record<string,any>={processes:{id:'processes',name:'02_PROCESSOS',parents:['root'],mimeType:folderMime},year:{id:'year',name:'2026',parents:['processes'],mimeType:folderMime},folder:{id:'folder',name:protocol,parents:[annual?'year':'processes'],mimeType:folderMime},child:{id:'child',parents:['folder'],mimeType:'application/pdf'}};
  const mock=t.mock.method(globalThis,'fetch',async(input:unknown,init?:RequestInit)=>{
   const url=new URL(String(input)),id=url.pathname.split('/').pop()!;
   if(init?.method==='DELETE'){deleted.push(id);delete files[id];return new Response(null,{status:204});}
   if(id==='files'){
    const query=url.searchParams.get('q')||'';queries.push(query);
    if(query.includes('appProperties'))return Response.json({files:[]});
    const parent=/^'([^']+)' in parents/.exec(query)?.[1],name=/name = '([^']+)'/.exec(query)?.[1];
    assert.ok(parent,'A busca por nome deve estar vinculada a uma pasta conhecida.');
    return Response.json({files:Object.values(files).filter(file=>file.parents?.includes(parent)&&(!name||file.name===name)).map(file=>({id:file.id}))});
   }
   return files[id]?Response.json(files[id]):new Response(null,{status:404});
  });
  const input={accessToken:'fake',processId:'p',protocol,rootFolderId:'root',protectedIds:[],fileIds:[]};
  await deleteProcessDriveArtifacts(input);assert.deepEqual(deleted,['child','folder']);
  assert.ok(queries.filter(query=>query.includes('name =')).every(query=>query.includes('in parents')));
  await deleteProcessDriveArtifacts(input);assert.deepEqual(deleted,['child','folder']);
  assert.ok(files.processes);assert.ok(files.year);mock.mock.restore();
 }
});

test('descoberta de pasta sem vínculo rejeita ambiguidade e vínculo de outro processo',async t=>{
 const folderMime='application/vnd.google-apps.folder',protocol='TCC-2026-0999';
 for(const foreign of [false,true]){
  let deleted=0;
  const files:Record<string,any>={processes:{id:'processes',name:'02_PROCESSOS',parents:['root'],mimeType:folderMime},folder:{id:'folder',name:protocol,parents:['processes'],mimeType:folderMime,appProperties:foreign?{portalProcessId:'another-process'}:{}},duplicate:{id:'duplicate',name:protocol,parents:['processes'],mimeType:folderMime}};
  const mock=t.mock.method(globalThis,'fetch',async(input:unknown,init?:RequestInit)=>{
   if(init?.method==='DELETE'){deleted++;return new Response(null,{status:204});}
   const url=new URL(String(input)),id=url.pathname.split('/').pop()!;
   if(id==='files'){
    const query=url.searchParams.get('q')||'';
    if(query.includes('appProperties'))return Response.json({files:[]});
    if(query.includes("'root' in parents"))return Response.json({files:[{id:'processes'}]});
    if(query.includes(`name = '${protocol}'`))return Response.json({files:[{id:'folder'},...(!foreign?[{id:'duplicate'}]:[])]});
    return Response.json({files:[]});
   }
   return files[id]?Response.json(files[id]):new Response(null,{status:404});
  });
  await assert.rejects(deleteProcessDriveArtifacts({accessToken:'fake',processId:'p',protocol,rootFolderId:'root',fileIds:[],protectedIds:[]}),foreign?/outro processo/:/mais de uma pasta/);
  assert.equal(deleted,0);mock.mock.restore();
 }
});
test('Master Drive cleanup protects model/root and only deletes a verified process tree',{concurrency:false},async()=>{
 const old=globalThis.fetch,deleted:string[]=[];
 const files:Record<string,any>={folder:{id:'folder',name:'TCC-2026-0999',parents:['processes'],mimeType:'application/vnd.google-apps.folder'},processes:{id:'processes',name:'02_PROCESSOS',parents:['root'],mimeType:'application/vnd.google-apps.folder'},pdf:{id:'pdf',mimeType:'application/pdf',appProperties:{portalProcessId:'p'}}};
 globalThis.fetch=(async(url:any,init:any)=>{const u=new URL(String(url));if(init?.method==='DELETE'){deleted.push(u.pathname.split('/').pop()!);return new Response(null,{status:204});}const id=u.pathname.split('/').pop()!;if(id==='files')return Response.json({files:u.searchParams.get('q')?.includes("'folder' in parents")?[{id:'pdf'}]:[]});return files[id]?Response.json(files[id]):new Response(null,{status:404});}) as typeof fetch;
 try{await assert.rejects(deleteProcessDriveArtifacts({accessToken:'fake',processId:'p',protocol:'TCC-2026-0999',rootFolderId:'root',folderId:'root',protectedIds:[],fileIds:[]}),/preservada/);assert.equal(deleted.length,0);await deleteProcessDriveArtifacts({accessToken:'fake',processId:'p',protocol:'TCC-2026-0999',rootFolderId:'root',folderId:'folder',protectedIds:['model'],fileIds:['pdf']});assert.deepEqual(deleted,['pdf','folder']);}finally{globalThis.fetch=old;}
});
test('Master cleanup accepts the previous annual hierarchy without deleting its year or shared ancestors',async()=>{
 const old=globalThis.fetch,deleted:string[]=[],folderMime='application/vnd.google-apps.folder';
 const files:Record<string,any>={
  folder:{id:'folder',name:'TCC-2026-0999',parents:['year'],mimeType:folderMime},
  year:{id:'year',name:'2026',parents:['processes'],mimeType:folderMime},
  processes:{id:'processes',name:'02_PROCESSOS',parents:['root'],mimeType:folderMime},
  nested:{id:'nested',name:'Documentos',parents:['folder'],mimeType:folderMime},
  pdf:{id:'pdf',parents:['nested'],mimeType:'application/pdf'},
  archived:{id:'archived',mimeType:'application/pdf',appProperties:{portalProcessId:'p'}}
 };
 globalThis.fetch=(async(url:any,init:any)=>{
  const u=new URL(String(url)),id=u.pathname.split('/').pop()!;
  if(init?.method==='DELETE'){deleted.push(id);return new Response(null,{status:204});}
  if(id==='files'){
   const query=u.searchParams.get('q')||'';
   return Response.json({files:query.includes("'folder' in parents")?[{id:'nested'}]:query.includes("'nested' in parents")?[{id:'pdf'}]:query.includes('appProperties has')?[{id:'archived'}]:[]});
  }
  return files[id]?Response.json(files[id]):new Response(null,{status:404});
 }) as typeof fetch;
 try{
  await deleteProcessDriveArtifacts({accessToken:'fake',processId:'p',protocol:'TCC-2026-0999',rootFolderId:'root',folderId:'folder',protectedIds:['root','processes','year','model'],fileIds:['archived']});
  assert.deepEqual(deleted,['pdf','nested','folder','archived']);
 }finally{globalThis.fetch=old;}
});
test('Master cleanup refuses malformed annual ancestry before deleting any resource',async()=>{
 const old=globalThis.fetch,folderMime='application/vnd.google-apps.folder';
 const base={
  folder:{id:'folder',name:'TCC-2026-0999',parents:['year'],mimeType:folderMime},
  year:{id:'year',name:'2026',parents:['processes'],mimeType:folderMime},
  processes:{id:'processes',name:'02_PROCESSOS',parents:['root'],mimeType:folderMime}
 };
 const variants=[
  {...base,year:{...base.year,name:'2025'}},
  {...base,year:{...base.year,name:'2026-old'}},
  {...base,year:{...base.year,name:'026'}},
  {...base,year:{...base.year,mimeType:'application/pdf'}},
  {...base,year:{...base.year,parents:['foreign-processes']}},
  {...base,processes:{...base.processes,name:'01_DOCUMENTOS'}},
  {...base,processes:{...base.processes,parents:['foreign-root']}},
  {...base,processes:{...base.processes,mimeType:'application/pdf'}},
  {...base,folder:{...base.folder,name:'TCC-2026-OTHER'}},
  {...base,folder:{...base.folder,mimeType:'application/pdf'}}
 ];
 try{
  for(const files of variants){
   let deletes=0;
   globalThis.fetch=(async(url:any,init:any)=>{
    if(init?.method==='DELETE'){deletes++;return new Response(null,{status:204});}
    const id=new URL(String(url)).pathname.split('/').pop()!;
    return id in files?Response.json(files[id as keyof typeof files]):new Response(null,{status:404});
   }) as typeof fetch;
   await assert.rejects(deleteProcessDriveArtifacts({accessToken:'fake',processId:'p',protocol:'TCC-2026-0999',rootFolderId:'root',folderId:'folder',protectedIds:[],fileIds:[]}),/não pertence/);
   assert.equal(deletes,0);
  }
 }finally{globalThis.fetch=old;}
});
test('Master cleanup refuses an outside untagged file and preserves other process bindings',async()=>{
 const old=globalThis.fetch;
 try{for(const properties of [{portalProcessId:'other'},{}]){
  let deletes=0;globalThis.fetch=(async(_url:any,init:any)=>{if(init?.method==='DELETE')deletes++;return Response.json({id:'foreign',mimeType:'application/pdf',appProperties:properties});}) as typeof fetch;
  await assert.rejects(deleteProcessDriveArtifacts({accessToken:'fake',processId:'p',protocol:'TCC-2026-0999',rootFolderId:'root',protectedIds:[],fileIds:['foreign']}),properties.portalProcessId?/outro processo/:/comprovar o vínculo/);
  assert.equal(deletes,0);
 }}finally{globalThis.fetch=old;}
});
test('Annual process cleanup still preserves protected models and foreign process children',async()=>{
 const old=globalThis.fetch,folderMime='application/vnd.google-apps.folder';
 try{for(const protectedChild of [false,true]){
  let deletes=0;
  const files:Record<string,any>={folder:{id:'folder',name:'TCC-2026-0999',parents:['year'],mimeType:folderMime},year:{id:'year',name:'2026',parents:['processes'],mimeType:folderMime},processes:{id:'processes',name:'02_PROCESSOS',parents:['root'],mimeType:folderMime},child:{id:'child',mimeType:'application/pdf',appProperties:{portalProcessId:protectedChild?'p':'other'}}};
  globalThis.fetch=(async(url:any,init:any)=>{
   if(init?.method==='DELETE'){deletes++;return new Response(null,{status:204});}
   const u=new URL(String(url)),id=u.pathname.split('/').pop()!;
   if(id==='files')return Response.json({files:u.searchParams.get('q')?.includes("'folder' in parents")?[{id:'child'}]:[]});
   return files[id]?Response.json(files[id]):new Response(null,{status:404});
  }) as typeof fetch;
  await assert.rejects(deleteProcessDriveArtifacts({accessToken:'fake',processId:'p',protocol:'TCC-2026-0999',rootFolderId:'root',folderId:'folder',protectedIds:protectedChild?['child']:[],fileIds:[]}),protectedChild?/compartilhado/:/outro processo/);
  assert.equal(deletes,0);
 }}finally{globalThis.fetch=old;}
});


test('serial migration accepts only a recorded historical name on its pinned folder and preserves its year/root guards',async t=>{
 const folderMime='application/vnd.google-apps.folder';
 for(const scenario of ['recorded','unknown-name','wrong-year','foreign-child'] as const){
  const deleted:string[]=[];
  const files:Record<string,any>={folder:{id:'folder',name:scenario==='unknown-name'?'TCC-2026-0007':'TCC-2026-0006',parents:['year'],mimeType:folderMime},year:{id:'year',name:scenario==='wrong-year'?'2025':'2026',parents:['processes'],mimeType:folderMime},processes:{id:'processes',name:'02_PROCESSOS',parents:['root'],mimeType:folderMime},child:{id:'child',mimeType:'application/pdf',parents:['folder'],appProperties:{portalProcessId:scenario==='foreign-child'?'other-process':'old-pilot'}}};
  const mock=t.mock.method(globalThis,'fetch',async(input:unknown,init?:RequestInit)=>{
   const url=new URL(String(input)),id=url.pathname.split('/').pop()!;
   if(init?.method==='DELETE'){deleted.push(id);return new Response(null,{status:204});}
   if(id==='files')return Response.json({files:(url.searchParams.get('q')||'').includes("'folder' in parents")?[{id:'child'}]:[]});
   return files[id]?Response.json(files[id]):new Response(null,{status:404});
  });
  const operation=deleteProcessDriveArtifacts({accessToken:'fixture',processId:'old-pilot',protocol:'TCC - 00002',protocolAliases:['TCC-2026-0006'],folderId:'folder',rootFolderId:'root',fileIds:[],protectedIds:[]});
  if(scenario==='recorded'){await operation;assert.deepEqual(deleted,['child','folder']);}
  else {await assert.rejects(operation,/não pertence|outro processo/);assert.deepEqual(deleted,[]);}
  mock.mock.restore();
 }
});
