import test from 'node:test';
import assert from 'node:assert/strict';
import {persistStudioRuntimeImage} from './supabase';
test('imagem pequena também é persistida antes de devolver a URL pública',async t=>{
  let body:any;
  t.mock.method(globalThis,'fetch',async(_url,init)=>{body=JSON.parse(String(init?.body));return new Response(null,{status:201});});
  const image='data:image/png;base64,iVBORw0KGgo=';
  const url=await persistStudioRuntimeImage(image);
  assert.match(url,/^\/api\/public\/runtime-assets\/[a-f0-9]{64}$/);
  assert.equal(body.data_url,image);assert.equal(body.byte_length,8);assert.equal(body.mime_type,'image/png');
  await assert.rejects(persistStudioRuntimeImage('data:image/svg+xml;base64,PHN2Zz4='));
});
