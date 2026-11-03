import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { readPrivatePortalImage, storePrivatePortalImage } from './googleDriveImages';

const technical = 'technical_root_123456';
const folder = 'images_folder_123456';
const file = 'image_archive_123456';
const ctx = { accessToken: 'fixture-access-token', academicRootId: 'academic_root_123456' };
async function fixture(t: any) {
  const before = process.env.PORTAL_DRIVE_TECHNICAL_FOLDER_ID;
  process.env.PORTAL_DRIVE_TECHNICAL_FOLDER_ID = technical;
  t.after(() => { if (before === undefined) delete process.env.PORTAL_DRIVE_TECHNICAL_FOLDER_ID; else process.env.PORTAL_DRIVE_TECHNICAL_FOLDER_ID = before; });
  const bytes = await sharp({ create: { width: 2, height: 2, channels: 4, background: '#89b19f' } }).png().toBuffer();
  const hash = createHash('sha256').update(bytes).digest('hex');
  let writes = 0; let mediaReads = 0; let corrupt = false; let broad = false; let missing = false;
  t.mock.method(globalThis, 'fetch', async (input: unknown, init?: RequestInit) => {
    const url = new URL(String(input));
    assert.equal(url.hostname, 'www.googleapis.com');
    if (url.pathname.endsWith('/permissions')) return Response.json({ permissions: [{ type: broad ? 'anyone' : 'user', role: 'owner' }] });
    if (url.pathname.endsWith('/' + technical)) return Response.json({ id: technical, mimeType: 'application/vnd.google-apps.folder', parents: ['outside_academic'], capabilities: { canAddChildren: true } });
    if (url.searchParams.has('q')) return Response.json({ files: url.searchParams.get('q')!.includes('appProperties') || missing ? [] : [{ id: folder }] });
    if (init?.method === 'POST') {
      writes++;
      assert.equal(url.searchParams.get('uploadType'), 'multipart');
      assert.ok(Buffer.from(init.body as Buffer).includes(bytes));
      assert.doesNotMatch(String(init.body), /"anyone"|"role":"reader"/);
      return Response.json({ id: file });
    }
    if (url.searchParams.get('alt') === 'media') { mediaReads++; return new Response(corrupt ? Buffer.alloc(bytes.length) : bytes, { headers: { 'content-length': String(bytes.length) } }); }
    return Response.json({ size: String(bytes.length), mimeType: 'image/png', parents: [folder], appProperties: { imageKind: 'RUNTIME_ASSET', sha256: hash } });
  });
  return { bytes, hash, writes: () => writes, mediaReads: () => mediaReads, corrupt: () => { corrupt = true; }, broad: () => { broad = true; }, missing: () => { missing = true; } };
}

test('arquivo é privado, mantém bytes e é confirmado por tamanho/hash/releitura', async t => {
  const f = await fixture(t);
  const ref = await storePrivatePortalImage({ bytes: f.bytes, mimeType: 'image/png', kind: 'RUNTIME_ASSET', key: 'a'.repeat(64) }, ctx);
  assert.equal(ref.driveFileId, file); assert.equal(ref.contentSha256, f.hash);
  assert.equal(f.writes(), 1); assert.equal(f.mediaReads(), 1);
  assert.deepEqual(await readPrivatePortalImage(ref, 'RUNTIME_ASSET', ctx), f.bytes);
  assert.equal(f.writes(), 1);
  f.corrupt();
  await assert.rejects(readPrivatePortalImage(ref, 'RUNTIME_ASSET', ctx), /integridade/);
});

test('imagem inválida ou destino público é recusado antes de upload', async t => {
  const f = await fixture(t);
  await assert.rejects(storePrivatePortalImage({ bytes: Buffer.from('%PDF-incompatible'), mimeType: 'image/png', kind: 'RUNTIME_ASSET', key: 'a'.repeat(64) }, ctx));
  f.broad();
  await assert.rejects(storePrivatePortalImage({ bytes: f.bytes, mimeType: 'image/png', kind: 'RUNTIME_ASSET', key: 'a'.repeat(64) }, ctx), /compartilhada/);
  assert.equal(f.writes(), 0);
});

test('leitura pública não cria uma pasta quando o destino está ausente', async t => {
  const f = await fixture(t); f.missing();
  await assert.rejects(readPrivatePortalImage({ driveFileId: file, contentSha256: f.hash, mimeType: 'image/png', byteLength: f.bytes.length }, 'RUNTIME_ASSET', ctx), /não foi localizado/);
  assert.equal(f.writes(), 0);
});
