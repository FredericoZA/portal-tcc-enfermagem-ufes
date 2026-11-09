import test from 'node:test';
import assert from 'node:assert/strict';
import {apiClient,invalidateIdentityRequests} from '../src/services/apiClient';

function gate(){let release!:()=>void;const promise=new Promise<void>(resolve=>{release=resolve;});return{promise,release};}

test('simultaneous repository reads transfer once, keep independent objects and refresh after completion',async t=>{
 invalidateIdentityRequests();
 const hold=gate();
 const transport=t.mock.method(globalThis,'fetch',async()=>{await hold.promise;return Response.json([{id:'current'}]);});
 const first=apiClient.getPublicRepository(),second=apiClient.getPublicRepository();
 assert.equal(transport.mock.callCount(),1);
 hold.release();
 const [a,b]=await Promise.all([first,second]);
 a[0].id='edited locally';
 assert.equal(b[0].id,'current');
 await apiClient.getPublicRepository();
 assert.equal(transport.mock.callCount(),2,'settled reads are not cached');
});

test('a changed identity never joins the previous account read',async t=>{
 invalidateIdentityRequests();
 const hold=gate();let count=0;
 t.mock.method(globalThis,'fetch',async()=>{const identity=++count;await hold.promise;return Response.json([{id:String(identity)}]);});
 const before=apiClient.getProcesses();
 invalidateIdentityRequests();
 const after=apiClient.getProcesses();
 assert.equal(count,2);
 hold.release();
 assert.equal((await before)[0].id,'1');assert.equal((await after)[0].id,'2');
});

test('a mutation invalidates reads on both sides of its acknowledgement',async t=>{
 invalidateIdentityRequests();
 const hold=gate();let calls=0;
 t.mock.method(globalThis,'fetch',async(_input,options)=>{
  calls++;
  if(options?.method==='PATCH'){await hold.promise;return Response.json({id:'saved'});}
  return Response.json([{id:String(calls)}]);
 });
 const before=apiClient.getProcesses();
 const write=apiClient.updateProcess('fixture',{titulo:'saved'});
 const during=apiClient.getProcesses();
 assert.equal(calls,3);
 await Promise.all([before,during]);hold.release();await write;
 await apiClient.getProcesses();assert.equal(calls,4);
});

test('failed reads can be retried and caller cancellation keeps a separate transport',async t=>{
 invalidateIdentityRequests();
 let failed=true;
 const transport=t.mock.method(globalThis,'fetch',async()=>{
  if(failed)return Response.json({error:'unavailable'},{status:503});
  return Response.json([]);
 });
 await assert.rejects(apiClient.getProcesses(),/unavailable/);
 failed=false;await apiClient.getProcesses();
 assert.equal(transport.mock.callCount(),2);
 const one=new AbortController(),two=new AbortController();
 await Promise.all([apiClient.getProcesses({signal:one.signal}),apiClient.getProcesses({signal:two.signal})]);
 assert.equal(transport.mock.callCount(),4);
});

test('calendar aggregate uses one public read and preserves caller cancellation',async t=>{
 invalidateIdentityRequests();const calls:Array<{path:string;signal?:AbortSignal}>=[];
 t.mock.method(globalThis,'fetch',async(input,options)=>{
  calls.push({path:String(input),signal:options?.signal||undefined});
  if(calls.length===1)return Response.json({processes:[{id:'TCC - 00001',protocolo:'TCC - 00001',status:'CONCLUIDO'}],googleEvents:[]});
  return new Promise((_resolve,reject)=>options?.signal?.addEventListener('abort',()=>reject(new DOMException('Aborted','AbortError')),{once:true}));
 });
 const result=await apiClient.getPublicCalendarData();
 assert.equal(calls[0].path,'/api/public/calendar-data');assert.equal(result.processes[0].id,'TCC - 00001');assert.equal(result.processes[0].status,'CONCLUIDO');
 const controller=new AbortController();const pending=apiClient.getPublicCalendarData({signal:controller.signal});controller.abort();
 await assert.rejects(pending,(error:any)=>error.code==='REQUEST_CANCELED');assert.equal(calls.length,2);assert.equal(calls[1].signal?.aborted,true);
});
