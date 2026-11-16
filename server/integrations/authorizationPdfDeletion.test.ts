import test from 'node:test';
import assert from 'node:assert/strict';
import {deleteAuthorizationPdfs} from './googleDriveArchive';
test('authorization deletion confirms PDF metadata, deduplicates IDs and accepts an already removed file',async()=>{
 const previous=globalThis.fetch,seen:string[]=[];
 try{
 globalThis.fetch=(async(url:any,init:any)=>{seen.push((init?.method||'GET')+' '+url);if(String(url).includes('already_removed'))return new Response('{}',{status:404});return init?.method==='DELETE'?new Response(null,{status:204}):Response.json({id:'verified_term_pdf',mimeType:'application/pdf'});}) as typeof fetch;
 await deleteAuthorizationPdfs('fixture-only',['verified_term_pdf','verified_term_pdf','already_removed']);
 assert.equal(seen.filter(x=>x.startsWith('DELETE ')).length,1);
 }finally{globalThis.fetch=previous;}
});
test('authorization deletion refuses folders and does not hide permission failures',async()=>{
 const previous=globalThis.fetch;let deletes=0;
 try{
 globalThis.fetch=(async(_url:any,init:any)=>{if(init?.method==='DELETE')deletes++;return Response.json({id:'a_folder_fixture',mimeType:'application/vnd.google-apps.folder'});}) as typeof fetch;
 await assert.rejects(deleteAuthorizationPdfs('fixture-only',['a_folder_fixture']),/PDF/);assert.equal(deletes,0);
 globalThis.fetch=(async()=>Response.json({error:{message:'forbidden'}},{status:403})) as typeof fetch;
 await assert.rejects(deleteAuthorizationPdfs('fixture-only',['verified_term_pdf']),/forbidden/);
 }finally{globalThis.fetch=previous;}
});
