import test from 'node:test';import assert from 'node:assert/strict';
import {deleteProcessDriveArtifacts} from './integrations/googleDriveArchive';
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
