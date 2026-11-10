import {test} from 'node:test';
import assert from 'node:assert/strict';
import {runtimeReadFailure} from './supabase';

test('runtime read keeps only the SQLSTATE and stage, never private detail',async()=>{
  const error=await runtimeReadFailure(Response.json({code:'57014',message:'private SQL and names',details:'secret'}, {status:500}),'SNAPSHOT');
  assert.equal((error as any).code,'SUPABASE_57014');
  assert.equal((error as any).stage,'SNAPSHOT');
  assert.equal((error as any).httpStatus,500);
  assert.ok(!JSON.stringify(error).includes('secret'));
  assert.ok(!error.message.includes('private'));
});
test('invalid response and unbounded provider code use only HTTP status',async()=>{
  for(const response of [new Response('not json',{status:503}),Response.json({code:'token-private-provider-detail'},{status:403})]){
    const error=await runtimeReadFailure(response,'REVISION');
    assert.equal((error as any).code,`SUPABASE_HTTP_${response.status}`);
    assert.equal((error as any).stage,'REVISION');
  }
});
