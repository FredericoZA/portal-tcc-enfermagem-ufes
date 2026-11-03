import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { persistStudioRuntimeImage, loadRuntimeImage, externalizeRuntimeImages } from './supabase';
import { normalizePortalImage } from './googleDriveImages';

test('imagem é arquivada no Drive antes de persistir somente metadados e devolver a mesma URL', async t => {
  let body: any; let archived = false;
  t.mock.method(globalThis, 'fetch', async (_url, init) => {
    if (init?.method === 'POST') { assert.equal(archived, true); body = JSON.parse(String(init.body)); return new Response(null, { status: 201 }); }
    return Response.json([]);
  });
  const image = 'data:image/png;base64,iVBORw0KGgo=';
  const key = createHash('sha256').update(image).digest('hex');
  const url = await persistStudioRuntimeImage(image, async input => {
    assert.equal(input.kind, 'RUNTIME_ASSET'); assert.equal(input.key, key);
    assert.deepEqual(input.bytes, Buffer.from('iVBORw0KGgo=', 'base64')); archived = true;
    return { driveFileId: 'private_image_123', contentSha256: 'b'.repeat(64), mimeType: input.mimeType, byteLength: input.bytes.length };
  });
  assert.equal(url, '/api/public/runtime-assets/' + key);
  assert.equal(body.data_url, undefined);
  assert.equal(body.drive_file_id, 'private_image_123');
  assert.equal(body.content_sha256, 'b'.repeat(64));
  assert.equal(body.byte_length, 8); assert.equal(body.mime_type, 'image/png');
  await assert.rejects(persistStudioRuntimeImage('data:image/svg+xml;base64,PHN2Zz4='));
});

test('sem migração ou com falha de arquivo não cria registro incompleto no banco', async t => {
  let writes = 0; let uploads = 0;
  const request = t.mock.method(globalThis, 'fetch', async (_url, init) => { if (init?.method === 'POST') writes++; return new Response(null, { status: 400 }); });
  const archive = async () => { uploads++; throw new Error('Drive indisponível'); };
  await assert.rejects(persistStudioRuntimeImage('data:image/png;base64,iVBORw0KGgo=', archive), /não está preparado/);
  assert.equal(uploads, 0); assert.equal(writes, 0);
  request.mock.restore();
  t.mock.method(globalThis, 'fetch', async (_url, init) => { if (init?.method === 'POST') writes++; return Response.json([]); });
  await assert.rejects(persistStudioRuntimeImage('data:image/png;base64,iVBORw0KGgo=', archive), /Drive indisponível/);
  assert.equal(writes, 0);
});

test('leitor usa referência Drive e preserva leitura do legado durante implantação', async t => {
  const bytes = Buffer.from('iVBORw0KGgo=', 'base64');
  let record: Record<string, unknown> = { drive_file_id: 'private_image_123', content_sha256: 'b'.repeat(64), byte_length: bytes.length, mime_type: 'image/png', data_url: 'data:image/png;base64,broken' };
  t.mock.method(globalThis, 'fetch', async () => Response.json([record]));
  const image = await loadRuntimeImage('a'.repeat(64), async (ref, kind) => { assert.equal(kind, 'RUNTIME_ASSET'); assert.equal(ref.driveFileId, 'private_image_123'); return bytes; });
  assert.deepEqual(image, { bytes, mimeType: 'image/png' });
  record = { data_url: 'data:image/png;base64,iVBORw0KGgo=', mime_type: 'image/png' };
  assert.deepEqual(await loadRuntimeImage('a'.repeat(64)), { bytes, mimeType: 'image/png' });
});

test('snapshot com SVG preserva a chave, usa sua raiz e grava metadados dos bytes convertidos',async t=>{
  const svg=Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="2" height="2"><rect width="1" height="2" fill="green"/></svg>');
  const image='data:image/svg+xml;base64,'+svg.toString('base64');
  const key=createHash('sha256').update(image).digest('hex');
  const converted=await normalizePortalImage(svg,'image/svg+xml');
  let body:any;let uploads=0;
  t.mock.method(globalThis,'fetch',async(_url,init)=>{if(init?.method==='POST'){body=JSON.parse(String(init.body));return new Response(null,{status:201});}return Response.json([]);});
  const result=await externalizeRuntimeImages({settings:{driveRootFolderId:'saved_academic_root_123',logo:image},audit:[{logo:image}]},async input=>{
    uploads++;assert.equal(input.academicRootId,'saved_academic_root_123');assert.deepEqual(input.bytes,svg);
    return {driveFileId:'converted_image_123',mimeType:converted.mimeType,byteLength:converted.bytes.length,contentSha256:createHash('sha256').update(converted.bytes).digest('hex')};
  });
  assert.equal(uploads,1);
  assert.deepEqual(result,{settings:{driveRootFolderId:'saved_academic_root_123',logo:'/api/public/runtime-assets/'+key},audit:[{logo:'/api/public/runtime-assets/'+key}]});
  assert.equal(body.asset_key,key);assert.equal(body.mime_type,'image/png');assert.equal(body.byte_length,converted.bytes.length);assert.equal(body.data_url,undefined);
});

test('SVG e GIF legados permanecem legíveis como PNG sem escrita ou exposição do XML',async t=>{
  const svg=Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"><rect width="1" height="1" fill="green"/></svg>');
  let row={data_url:'data:image/svg+xml;base64,'+svg.toString('base64')};let writes=0;
  t.mock.method(globalThis,'fetch',async(_url,init)=>{if(init?.method)writes++;return Response.json([row]);});
  const image=await loadRuntimeImage('a'.repeat(64));
  assert.equal(image?.mimeType,'image/png');assert.deepEqual(image?.bytes.subarray(0,8),Buffer.from([137,80,78,71,13,10,26,10]));
  const {default:sharp}=await import('sharp');
  const gif=await sharp(image!.bytes).gif().toBuffer();row={data_url:'data:image/gif;base64,'+gif.toString('base64')};
  assert.equal((await loadRuntimeImage('b'.repeat(64)))?.mimeType,'image/png');assert.equal(writes,0);
});
