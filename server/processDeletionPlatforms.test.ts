import test from 'node:test';import assert from 'node:assert/strict';
import {deleteProcessCalendarEvents} from './integrations/googleWorkspace';
import {deleteProcessSupabaseObjects} from './integrations/supabaseStorageStaging';
import {purgeSupabaseProcessHistory} from './integrations/supabase';
import {processDeletionNextRetryAt,selectDueProcessDeletions,type ProcessDeletionTask} from './workflow/processDeletion';

test('Calendar removes only bound events, includes pagination and tolerates already removed IDs',async()=>{
 const original=globalThis.fetch,deleted:string[]=[];globalThis.fetch=(async(url:any,init:any)=>{const u=new URL(String(url));if(init?.method==='DELETE'){deleted.push(u.pathname.split('/').pop()!);return new Response(null,{status:410});}return Response.json({items:[{id:'own',extendedProperties:{private:{portalTccProcessId:'p'}}},{id:'foreign',extendedProperties:{private:{portalTccProcessId:'other',portalTccProtocol:'TCC-2026-0001'}}},{id:'untagged',extendedProperties:{}}]});}) as typeof fetch;
 try{await deleteProcessCalendarEvents({accessToken:'fake-token',calendarId:'calendar',processId:'p',protocol:'TCC-2026-0001'});assert.deepEqual(deleted,['own']);}finally{globalThis.fetch=original;}
});

test('Supabase keeps object inventory when removal fails and never deletes another process ticket',async()=>{
 const original=globalThis.fetch,env={...process.env};Object.assign(process.env,{PORTAL_PERSISTENCE_PROVIDER:'supabase',SUPABASE_URL:'https://cleanup.supabase.co',SUPABASE_SECRET_KEY:'fake-cleanup-key'});const requests:Array<{url:string;method:string}>=[];let fail=true,rows=true;
 globalThis.fetch=(async(url:any,init:any)=>{const u=String(url),method=init?.method||'GET';requests.push({url:u,method});if(u.includes('/storage/v1/object/'))return new Response(null,{status:fail?503:204});if(method==='DELETE'){assert.ok(u.includes('process_external_id=eq.p'));rows=false;return new Response(null,{status:204});}return Response.json(u.includes('portal_upload_staging')&&rows?[{id:'ticket',object_path:'uploads/p/file.pdf'}]:[]);}) as typeof fetch;
 try{await assert.rejects(deleteProcessSupabaseObjects('p'),/503/);assert.equal(requests.filter(r=>r.method==='DELETE'&&r.url.includes('/rest/v1/')).length,0);fail=false;await deleteProcessSupabaseObjects('p');assert.ok(requests.some(r=>r.method==='DELETE'&&r.url.includes('process_external_id=eq.p')));}finally{globalThis.fetch=original;process.env=env;}
});

test('Supabase exposes only a safe diagnostic code, without claiming every 400 is a missing migration',async()=>{
 const original=globalThis.fetch,env={...process.env};Object.assign(process.env,{PORTAL_PERSISTENCE_PROVIDER:'supabase',SUPABASE_URL:'https://cleanup.supabase.co',SUPABASE_SECRET_KEY:'fake-cleanup-key'});globalThis.fetch=(async()=>Response.json({code:'21000',message:'sensitive row body'},{status:400})) as typeof fetch;
 try{await assert.rejects(purgeSupabaseProcessHistory('p','TCC-2026-0001',[]),(e:Error)=>e.message.includes('21000')&&!e.message.includes('sensitive')&&!e.message.includes('migração'));}finally{globalThis.fetch=original;process.env=env;}
});


test('cleanup scheduling bypasses leased, deferred and exhausted work while remaining compatible with older tasks',()=>{
 const now=Date.parse('2026-11-05T08:00:00Z'),day=86_400_000;
 const older=(id:string,patch:Partial<ProcessDeletionTask>={})=>({id,processId:id,protocol:id,createdAt:new Date(now-day).toISOString(),rootFolderId:'',fileIds:[],protectedIds:[],envelopes:[],jobIds:[],clearHistory:true,deleteFiles:true,status:'PENDING',errors:[],...patch}) as ProcessDeletionTask;
 const tasks=[
  older('leased',{processingUntil:new Date(now+60_000).toISOString()}),
  older('deferred',{attemptCount:3,nextRetryAt:processDeletionNextRetryAt(3,now)}),
  older('intervention',{attemptCount:7}),
  older('legacy'),
  older('ready',{attemptCount:1,nextRetryAt:new Date(now).toISOString()}),
  older('completed',{status:'COMPLETED'}),
 ];
 assert.deepEqual(selectDueProcessDeletions(tasks,now).map(task=>task.id),['legacy','ready']);
 assert.equal(processDeletionNextRetryAt(1,now),new Date(now+day).toISOString());
 assert.equal(processDeletionNextRetryAt(6,now),new Date(now+7*day).toISOString());
 assert.equal(processDeletionNextRetryAt(7,now),undefined);
 assert.ok(selectDueProcessDeletions(tasks,now+60_001,10).some(task=>task.id==='leased'));
});
