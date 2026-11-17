import test from 'node:test';import assert from 'node:assert/strict';
import {measuredSupabaseResponse,resourceUsageSnapshot} from './resourceUsage';
test('bounded resource counters stream bytes once without storing sensitive request content',async()=>{
 const before=resourceUsageSnapshot().operations['runtime-state']?.bytes||0;
 const r=measuredSupabaseResponse('https://db.invalid/rest/v1/portal_runtime_state?secret=private',new Response('abc',{headers:{'x-test':'yes'}}),3);
 assert.equal(r.headers.get('x-test'),'yes');assert.equal(await r.text(),'abc');
 const snap=resourceUsageSnapshot();assert.equal(snap.operations['runtime-state'].bytes-before,3);assert.doesNotMatch(JSON.stringify(snap),/secret|private|db.invalid/);
 for(let i=0;i<100;i++)await measuredSupabaseResponse('https://db.invalid/'+i,new Response(null),0).text();
 assert.ok(Object.keys(resourceUsageSnapshot().operations).length<=6);
});

test('signature and catalog conditional reads count response bytes without retaining request identity',async()=>{
 const previous=resourceUsageSnapshot().operations['conditional-read'];
 const before={requests:previous?.requests||0,bytes:previous?.bytes||0};
 for(const name of ['portal_read_signature_projection_v1','portal_read_repository_projection_v1']){
  const response=measuredSupabaseResponse(`https://db.invalid/rest/v1/rpc/${name}?record=private-id`,Response.json({payload:null}),1);
  await response.text();
 }
 const snapshot=resourceUsageSnapshot(),measured=snapshot.operations['conditional-read'];
 assert.equal(measured.requests-before.requests,2);
 assert.equal(measured.bytes-before.bytes,Buffer.byteLength('{"payload":null}')*2);
 assert.doesNotMatch(JSON.stringify(snapshot),/private-id|db.invalid|record=/);
});
