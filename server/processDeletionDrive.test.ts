import test from 'node:test';import assert from 'node:assert/strict';
import {deleteProcessDriveArtifacts} from './integrations/googleDriveArchive';
test('Master Drive cleanup protects model/root and only deletes a verified process tree',{concurrency:false},async()=>{
 const old=globalThis.fetch,deleted:string[]=[];
 const files:Record<string,any>={folder:{id:'folder',name:'TCC-2026-0999',parents:['processes'],mimeType:'application/vnd.google-apps.folder'},processes:{id:'processes',name:'02_PROCESSOS',parents:['root']},pdf:{id:'pdf',mimeType:'application/pdf',appProperties:{portalProcessId:'p'}}};
 globalThis.fetch=(async(url:any,init:any)=>{const u=new URL(String(url));if(init?.method==='DELETE'){deleted.push(u.pathname.split('/').pop()!);return new Response(null,{status:204});}const id=u.pathname.split('/').pop()!;if(id==='files')return Response.json({files:u.searchParams.get('q')?.includes("'folder' in parents")?[{id:'pdf'}]:[]});return files[id]?Response.json(files[id]):new Response(null,{status:404});}) as typeof fetch;
 try{await assert.rejects(deleteProcessDriveArtifacts({accessToken:'fake',processId:'p',protocol:'TCC-2026-0999',rootFolderId:'root',folderId:'root',protectedIds:[],fileIds:[]}),/preservada/);assert.equal(deleted.length,0);await deleteProcessDriveArtifacts({accessToken:'fake',processId:'p',protocol:'TCC-2026-0999',rootFolderId:'root',folderId:'folder',protectedIds:['model'],fileIds:['pdf']});assert.deepEqual(deleted,['pdf','folder']);}finally{globalThis.fetch=old;}
});
test('Master cleanup refuses an outside untagged file and preserves other process bindings',async()=>{
 const old=globalThis.fetch;let deletes=0;globalThis.fetch=(async(_url:any,init:any)=>{if(init?.method==='DELETE')deletes++;return Response.json({id:'foreign',mimeType:'application/pdf',appProperties:{portalProcessId:'other'}});}) as typeof fetch;
 try{await assert.rejects(deleteProcessDriveArtifacts({accessToken:'fake',processId:'p',protocol:'TCC-2026-0999',rootFolderId:'root',protectedIds:[],fileIds:['foreign']}),/outro processo/);assert.equal(deletes,0);}finally{globalThis.fetch=old;}
});
