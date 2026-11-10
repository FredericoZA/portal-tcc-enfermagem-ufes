import test from 'node:test';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
import {readExistingGeneratedInvitation} from './googleDriveArchive';
const pdf=Buffer.from('%PDF-1.7\noriginal approved bytes'),sha256=createHash('sha256').update(pdf).digest('hex');
const input={accessToken:'isolated-test',rootFolderId:'private-root',processId:'p',jobId:'workflow_'+('a'.repeat(64))};
function metadata(){return {id:'invitation-existing-id',name:'convite.pdf',mimeType:'application/pdf',parents:['generated-folder'],
 appProperties:{portal:'portal-tcc',portalProcessId:'p',portalSignatureJobId:input.jobId,portalLifecycle:'GERADO',artifactType:'CONVITE',sha256}};}
async function fixture<T>(options:{change?:(file:any)=>void;duplicates?:boolean;outside?:boolean;bytes?:Buffer;empty?:boolean},check:(calls:Array<{url:URL;method:string}>)=>Promise<T>){
 const original=globalThis.fetch,calls:Array<{url:URL;method:string}>=[];const file=metadata();options.change?.(file);
 globalThis.fetch=async(raw,init:RequestInit={})=>{
  const url=new URL(String(raw));calls.push({url,method:init.method||'GET'});assert.equal(init.method||'GET','GET','recovery must not write or convert');
  if(url.searchParams.has('q')){
   assert.match(url.searchParams.get('q')!,/portalSignatureJobId/);assert.match(url.searchParams.get('q')!,/portalProcessId/);
   return Response.json({files:options.empty?[]:options.duplicates?[file,{...file,id:'duplicate-existing-id'}]:[file]});
  }
  if(url.pathname.endsWith('/permissions'))return Response.json({permissions:[{type:'user',role:'owner'}]});
  if(url.searchParams.get('alt')==='media')return new Response(options.bytes||pdf);
  if(url.pathname.endsWith('/generated-folder'))return Response.json({id:'generated-folder',mimeType:'application/vnd.google-apps.folder',parents:[options.outside?'another-root':input.rootFolderId]});
  if(url.pathname.endsWith('/another-root'))return Response.json({id:'another-root',mimeType:'application/vnd.google-apps.folder',parents:[]});
  if(url.pathname.endsWith('/invitation-existing-id'))return Response.json(file);
  throw Error('Unexpected isolated Google read');
 };
 try{return await check(calls);}finally{globalThis.fetch=original;}
}
test('a generated invitation whose upload ACK was lost is recovered by action, process, ancestry and content hash before rendering again',{concurrency:false},async()=>{
 await fixture({},async calls=>{const recovered=await readExistingGeneratedInvitation(input);assert.deepEqual(recovered,{id:'invitation-existing-id',fileName:'convite.pdf',sha256});assert.ok(calls.length>1);assert.ok(calls.every(item=>item.method==='GET'));});
 await fixture({},async calls=>{await readExistingGeneratedInvitation({...input,expectedFileId:'invitation-existing-id'});assert.ok(calls.every(item=>!item.url.searchParams.has('q')),'known pointer is verified directly');});
});
test('new reservation with no artifact returns null; an old pointer is never silently reused',{concurrency:false},async()=>{
 await fixture({empty:true},async calls=>{assert.equal(await readExistingGeneratedInvitation(input),null);assert.equal(calls.length,1);});
 await fixture({change:file=>file.appProperties.portalSignatureJobId='workflow_old-reservation'},async()=>{await assert.rejects(readExistingGeneratedInvitation({...input,expectedFileId:'invitation-existing-id'}),/revisão desta execução/);});
});
test('duplicates, cross-process scope, unsafe ancestry and differing bytes fail closed without a new upload',{concurrency:false},async()=>{
 for(const options of [{duplicates:true},{outside:true},{bytes:Buffer.from('%PDF-1.7\nchanged')},{change:(file:any)=>file.appProperties.portalProcessId='other'},{change:(file:any)=>file.appProperties.sha256=''}]){
  await fixture(options,async()=>{await assert.rejects(readExistingGeneratedInvitation(input));});
 }
});
