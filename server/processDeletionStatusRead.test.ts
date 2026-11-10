import test from 'node:test';import assert from 'node:assert/strict';import express from 'express';import {createServer} from 'node:http';
import {createDeletionStatusReader,installDeletionStatusRoute} from './processDeletionStatusRead';
import {setPortalSessionCookie} from './security/firebaseAuth';
import {createRuntimeRequestQueue,attachRuntimeRequestLifecycle,beginRuntimeRequestTask} from './runtimeRequestQueue';
import {readFileSync} from 'node:fs';import {createHmac} from 'node:crypto';
const master='master@example.invalid',owner='owner@example.invalid';
function state():any{return{settings:{masterEmail:master,ownerEmail:owner,sessionValidAfter:0,privateKey:'never-return'},revokedSessionIds:[],processes:[],processDeletionTasks:[{id:'delete_p_123',processId:'p',protocol:'TCC - 00002',deleteFiles:true,clearHistory:true,status:'PENDING',errors:[],createdAt:'2026-11-08T12:00:00Z',envelopes:['private-envelope'],rootFolderId:'private-root',fileIds:['private-file'],protectedIds:[],jobIds:['private-job']}],auditLogs:[{id:'private-log',action:'PRIVATE_OTHER_ACTION',entityType:'private',entityId:'private',after:{secret:'never-return'}}]};}
async function harness(t:any){
 const env={PORTAL_SESSION_SECRET:'synthetic-deletion-status-test-secret-000000000',PORTAL_ALLOW_INSECURE_DEMO_AUTH:'false',NODE_ENV:'test',VERCEL:''};for(const[key,value]of Object.entries(env)){const before=process.env[key];process.env[key]=value;t.after(()=>{if(before===undefined)delete process.env[key];else process.env[key]=before;});}
 let current=state(),revision=1,checks=0,reads=0,fail=false;const ports={durable:()=>true,readRevision:async()=>{checks++;if(fail)throw Error('unavailable');return revision;},readDurable:async()=>{reads++;return structuredClone(current);},readLocal:()=>assert.fail('No local fallback')};const read=createDeletionStatusReader(ports);const app=express();installDeletionStatusRoute(app,read);
 const acquire=createRuntimeRequestQueue();const release=await acquire();let released=0;const request={};const lifecycle=attachRuntimeRequestLifecycle(request,()=>{released++;release();});const settle=beginRuntimeRequestTask(request);lifecycle.hydrationFinished();lifecycle.responseFinished();app.use((_req,res)=>res.status(503).json({code:'RUNTIME_BUSY'}));
 const server=createServer(app);await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise<void>((resolve,reject)=>{settle();server.close(error=>error?reject(error):resolve());}));const address=server.address() as any;const url=`http://127.0.0.1:${address.port}/api/admin/process-deletions/status?processId=p&taskId=delete_p_123`;
 const cookie=(email:string)=>{let header='';const identity=setPortalSessionCookie({setHeader:(_key:string,value:string)=>{header=value;}} as any,email);return{identity,value:header.split(';')[0]};};
 return{read,ports,cookie,request:(cookieValue?:string)=>fetch(url,{headers:cookieValue?{Cookie:cookieValue}:{}}),current:()=>current,setState:(next:any)=>{current=next;revision++;},setFailure:(value:boolean)=>{fail=value;},counts:()=>({checks,reads}),released:()=>released};
}
test('real signed Master and owner can read during cleanup lease; response reveals only existing deletion summary',async t=>{
 const h=await harness(t);for(const email of[master,owner]){const res=await h.request(h.cookie(email).value);assert.equal(res.status,200);assert.equal(res.headers.get('cache-control'),'private, no-store');const data=await res.json();assert.equal(data.state,'PENDING');assert.equal(data.taskId,'delete_p_123');assert.equal(data.cleanup.envelopeCount,1);assert.doesNotMatch(JSON.stringify(data),/private-envelope|private-root|private-file|private-job|private-log|never-return|master@example/);}
 assert.equal(h.released(),0);assert.equal(h.counts().reads,1);assert.equal(h.counts().checks,3);
});
test('missing or forged cookie fails before database; presidency and student remain forbidden',async t=>{
 const h=await harness(t);assert.equal((await h.request()).status,401);const signed=h.cookie(master).value;assert.equal((await h.request(signed+'tampered')).status,401);assert.equal(h.counts().reads,0);
 const token=signed.slice(signed.indexOf('=')+1);const identity=JSON.parse(Buffer.from(token.split('.')[0],'base64url').toString());identity.expiresAt=Math.floor(Date.now()/1000)-1;const payload=Buffer.from(JSON.stringify(identity)).toString('base64url');const signature=createHmac('sha256',process.env.PORTAL_SESSION_SECRET!).update(payload).digest('base64url');assert.equal((await h.request(signed.slice(0,signed.indexOf('=')+1)+payload+'.'+signature)).status,401);assert.equal(h.counts().reads,0);
 for(const email of['president@example.invalid','student@example.invalid'])assert.equal((await h.request(h.cookie(email).value)).status,403);
});
test('fresh revision applies revoked session, changed Master and sessionValidAfter even after cached allowed status',async t=>{
 const h=await harness(t);const cookie=h.cookie(master);assert.equal((await h.request(cookie.value)).status,200);
 let next=state();next.revokedSessionIds=[cookie.identity.sessionId];h.setState(next);let res=await h.request(cookie.value);assert.equal(res.status,401);assert.match(res.headers.get('set-cookie')||'',/Max-Age=0/);
 next=state();next.settings.masterEmail='new-master@example.invalid';h.setState(next);assert.equal((await h.request(cookie.value)).status,403);
 next=state();next.settings.sessionValidAfter=cookie.identity.issuedAt+1;h.setState(next);assert.equal((await h.request(cookie.value)).status,401);
});
test('failed fresh revision returns503 without former private result; changed revision reloads status',async t=>{
 const h=await harness(t);const cookie=h.cookie(master).value;assert.equal((await h.request(cookie)).status,200);h.setFailure(true);const res=await h.request(cookie);assert.equal(res.status,503);assert.equal(res.headers.get('retry-after'),'5');assert.equal((await res.json()).code,'DELETION_STATUS_UNAVAILABLE');h.setFailure(false);
 const next=state();next.processDeletionTasks=[];next.auditLogs=[{id:'completion',action:'EXCLUSAO_PROCESSO_TCC',entityType:'process_deletion',entityId:'delete_p_123',timestamp:'2026-11-08',after:{deletedProcessId:'p',cleanupConfirmed:true}}];h.setState(next);assert.equal((await(await h.request(cookie)).json()).state,'COMPLETED');
});
test('concurrent private reads coalesce but authorization is never cached across identities',async t=>{
 const h=await harness(t);const results=await Promise.all(Array.from({length:15},()=>h.read()));assert.equal(results.length,15);assert.deepEqual(h.counts(),{checks:2,reads:1});
 const masterCookie=h.cookie(master).value,student=h.cookie('student@example.invalid').value;assert.equal((await h.request(masterCookie)).status,200);assert.equal((await h.request(student)).status,403);
 results[0].settings.masterEmail='attacker@example.invalid';assert.equal((await h.request(student)).status,403);
});
test('status installed before runtime lock; old queued status route removed',()=>{
 const source=readFileSync('server.ts','utf8');const install=source.indexOf('  installDeletionStatusRoute(app,');assert.ok(install>0&&install<source.indexOf('  const acquireRuntimeRequest='));assert.doesNotMatch(source,/app\.get\('\/api\/admin\/process-deletions\/status',requireAuthenticated/);assert.match(source.slice(install,source.indexOf('  const acquireRuntimeRequest=',install)),/loadPortalRuntimeState<PersistedPortalState>\(false\)/);
});

test('revision racing authorization snapshot fails closed instead of authorizing former Master',async t=>{
 const h=await harness(t);let checks=0;h.ports.readRevision=async()=>++checks===1?1:2;const read=createDeletionStatusReader(h.ports);
 await assert.rejects(read(),/revisão administrativa mudou/);await read();assert.equal(h.counts().reads,2);
});

test('cached private projection contains native summaries with no fabricated file or envelope arrays',async t=>{
 const h=await harness(t);const snapshot=state();snapshot.processDeletionTasks[0].errors=['Limpeza externa pendente'];snapshot.processDeletionTasks[0].astenReconciliation=[{id:'private-envelope',state:'REVIEW'}];h.setState(snapshot);
 const projection=await h.read();assert.equal(projection.tasks[0].externalPending,1);assert.equal(projection.tasks[0].status,'PENDING');assert.deepEqual(projection.tasks[0].errors,['Limpeza externa pendente']);for(const key of['envelopes','astenReconciliation','rootFolderId','fileIds','jobIds'])assert.equal(key in projection.tasks[0],false);
 const data=await(await h.request(h.cookie(master).value)).json();assert.equal(data.cleanup.externalPending,1);assert.deepEqual(data.cleanup.errors,['Limpeza externa pendente']);
});
