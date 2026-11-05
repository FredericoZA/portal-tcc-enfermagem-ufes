import assert from 'node:assert/strict';
import test from 'node:test';
import {readBoundedResponse,ResponseSizeError} from './boundedResponse';

test('leitura limitada preserva bytes e tamanho de uma resposta completa',async()=>{
  const bytes=Buffer.from('%PDF-1.7\nconteudo-assinado');
  assert.deepEqual(await readBoundedResponse(new Response(bytes),bytes.length,bytes.length),bytes);
  assert.deepEqual(await readBoundedResponse(new Response(bytes,{headers:{'content-encoding':'gzip','content-length':'2'}}),bytes.length,bytes.length),bytes);
});

test('limite é aplicado durante a leitura, mesmo sem Content-Length ou com valor menor',async()=>{
  for(const headers of [{},{'content-length':'4'}]){
    let chunks=0,cancelled=false;
    const response=new Response(new ReadableStream<Uint8Array>({
      pull(controller){chunks++;controller.enqueue(new Uint8Array(4));},
      cancel(){cancelled=true;}
    },{highWaterMark:0}),{headers});
    await assert.rejects(readBoundedResponse(response,6),ResponseSizeError);
    assert.equal(chunks,2);assert.equal(cancelled,true);
  }
});

test('tamanho declarado excessivo ou divergente é recusado antes de consumir o corpo',async()=>{
  for(const declared of ['9','4','invalid']){
    let chunks=0,cancelled=false;
    const response=new Response(new ReadableStream<Uint8Array>({
      pull(controller){chunks++;controller.enqueue(new Uint8Array(4));},
      cancel(){cancelled=true;}
    },{highWaterMark:0}),{headers:{'content-length':declared}});
    await assert.rejects(readBoundedResponse(response,8,8),ResponseSizeError);
    assert.equal(chunks,0);assert.equal(cancelled,true);
  }
});

test('resposta truncada ou vazia não satisfaz o tamanho autorizado',async()=>{
  await assert.rejects(readBoundedResponse(new Response(new Uint8Array(4)),8,8),ResponseSizeError);
  await assert.rejects(readBoundedResponse(new Response(null),8),ResponseSizeError);
});
