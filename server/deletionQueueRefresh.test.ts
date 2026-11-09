import test from 'node:test';import assert from 'node:assert/strict';
import {subscribeDeletionQueueRefresh} from '../src/utils/deletionQueueRefresh';
import {PORTAL_LIVE_UPDATE_EVENT} from '../src/utils/portalLiveEvents';

function fixture(pending:boolean){
 const doc=new EventTarget(),win=new EventTarget();let refreshes=0,timers=0,cleared=0,tick:(()=>void)|undefined;
 const document=Object.assign(doc,{visibilityState:'visible' as DocumentVisibilityState});
 const window=Object.assign(win,{setInterval:(handler:()=>void,ms:number)=>{assert.equal(ms,60000);timers++;tick=handler;return 1;},clearInterval:(id:number)=>{assert.equal(id,1);cleared++;tick=undefined;}});
 const cleanup=subscribeDeletionQueueRefresh(pending,()=>{refreshes++;},{document,window:window as unknown as Window});
 return {document,window,cleanup,tick:()=>tick?.(),counts:()=>({refreshes,timers,cleared})};
}
test('empty queue removes all ten idle minute refreshes while retaining live and visibility revalidation',()=>{
 const f=fixture(false);for(let i=0;i<10;i++)f.tick();assert.deepEqual(f.counts(),{refreshes:0,timers:0,cleared:0});
 f.window.dispatchEvent(new Event(PORTAL_LIVE_UPDATE_EVENT));f.document.dispatchEvent(new Event('visibilitychange'));assert.equal(f.counts().refreshes,2);
 f.document.visibilityState='hidden';f.window.dispatchEvent(new Event(PORTAL_LIVE_UPDATE_EVENT));f.document.dispatchEvent(new Event('visibilitychange'));assert.equal(f.counts().refreshes,2);
 f.cleanup();f.document.visibilityState='visible';f.window.dispatchEvent(new Event(PORTAL_LIVE_UPDATE_EVENT));f.document.dispatchEvent(new Event('visibilitychange'));assert.equal(f.counts().refreshes,2);
});
test('pending tasks retain bounded one-minute reads only when visible, and unmount clears the timer',()=>{
 const f=fixture(true);for(let i=0;i<10;i++)f.tick();assert.equal(f.counts().refreshes,10);assert.equal(f.counts().timers,1);
 f.document.visibilityState='hidden';f.tick();assert.equal(f.counts().refreshes,10);
 f.cleanup();f.tick();assert.equal(f.counts().cleared,1);assert.equal(f.counts().refreshes,10);
});


test('real queue load coalesces concurrent refreshes and ignores a result after identity or request invalidation',async()=>{
 const {readFile}=await import('node:fs/promises');const {runInNewContext}=await import('node:vm');
 const source=await readFile(new URL('../src/components/ProcessDeletionQueuePanel.tsx',import.meta.url),'utf8');
 const body=source.match(/const load=useCallback\(async\(\)=>\{([\s\S]*?)\n \},\[identityKey\]\);/)?.[1];assert.ok(body);
 for(const invalidation of ['identity','request','none']){
  let reads=0,applied=0;let resolve!:(value:unknown)=>void;
  const gate=new Promise(r=>{resolve=r;});
  const context={identityKey:'master@example.invalid',currentIdentity:{current:'master@example.invalid'},epoch:{current:0},inFlight:{current:null},apiClient:{getProcessDeletions:()=>{reads++;return gate;}},setTasks:()=>{applied++;},setLoadError:()=>{}};
  const load=runInNewContext(`(async()=>{${body}})`,context);
  const first=load(),second=load();assert.equal(reads,1);
  if(invalidation==='identity')context.currentIdentity.current='other@example.invalid';
  if(invalidation==='request')context.epoch.current++;
  resolve([]);await Promise.all([first,second]);assert.equal(applied,invalidation==='none'?1:0);
 }
});
