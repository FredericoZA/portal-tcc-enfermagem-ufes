import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { persistStudioRuntimeImage, loadRuntimeImage } from './supabase';

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
