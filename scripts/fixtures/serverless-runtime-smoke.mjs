// Copied beside emitted artifacts by test-serverless-build.mjs. All upstreams
// are synthetic, intercepted here before any application bundle is imported.
import assert from 'node:assert/strict';
import { createCipheriv, createHash, randomBytes } from 'node:crypto';
import { createServer } from 'node:http';
import { once } from 'node:events';
import JSZip from 'jszip';
import sharp from 'sharp';

const png = await sharp({ create: { width: 2, height: 2, channels: 4, background: '#31785b' } }).png().toBuffer();
const imageHash = createHash('sha256').update(png).digest('hex');
const word = new JSZip();
word.file('word/document.xml', '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"/>');
const docx = await word.generateAsync({ type: 'nodebuffer' });
const iv = randomBytes(12);
const cipher = createCipheriv('aes-256-gcm', Buffer.from(process.env.PORTAL_SECRET_ENCRYPTION_KEY, 'hex'), iv);
cipher.setAAD(Buffer.from('portal-tcc:google_workspace:v1'));
const ciphertext = Buffer.concat([cipher.update(randomBytes(32).toString('hex')), cipher.final()]);
const secretRow = { provider: 'google_workspace', ciphertext: ciphertext.toString('base64'), iv: iv.toString('base64'), auth_tag: cipher.getAuthTag().toString('base64'), metadata: { __portalCryptoKeyId: 'v1' } };
const calls = [];
const unexpected = [];
const json = (value) => Response.json(value);

globalThis.fetch = async (input, init = {}) => {
  const url = new URL(String(input));
  const method = String(init.method || 'GET').toUpperCase();
  calls.push({ host: url.host, path: url.pathname, method });
  if (url.origin === 'https://database.example.invalid') {
    if (method === 'POST' && url.pathname === '/rest/v1/rpc/portal_runtime_capabilities') {
      return json({ transactional_runtime: true, optimistic_concurrency: true, normalized_core_projection: true, secure_file_transport: 'SUPABASE_PRIVATE_STORAGE', asten_transactional_outbox: true, schema_version: 6 });
    }
    if (method === 'GET' && url.pathname === '/rest/v1/portal_runtime_state') {
      return json([{ payload: { settings: { driveRootFolderId: 'root_fixture_123' }, processes: [] }, revision: 1 }]);
    }
    if (method === 'GET' && url.pathname === '/rest/v1/portal_runtime_assets') {
      if (url.searchParams.get('asset_key') === 'eq.' + 'b'.repeat(64)) {
        return json([{ drive_file_id: 'image_fixture_123', content_sha256: imageHash, mime_type: 'image/png', byte_length: png.length }]);
      }
      const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="2" height="2"><rect width="2" height="2" fill="green"/></svg>';
      return json([{ mime_type: 'image/svg+xml', data_url: 'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64') }]);
    }
    if (method === 'GET' && url.pathname === '/rest/v1/portal_integration_secrets') return json([secretRow]);
    // Startup checks query only empty normalized tables. Never allow database writes.
    if (method === 'GET' && url.pathname.startsWith('/rest/v1/portal_') && url.searchParams.get('limit') === '0') return json([]);
  }
  if (method === 'POST' && url.origin === 'https://oauth2.googleapis.com' && url.pathname === '/token') return json({ access_token: randomBytes(32).toString('hex') });
  if (method === 'GET' && url.origin === 'https://www.googleapis.com') {
    if (url.pathname.endsWith('/permissions')) return json({ permissions: [{ type: 'user', role: 'owner' }] });
    if (url.pathname === '/drive/v3/files/technical_fixture_123') return json({ id: 'technical_fixture_123', mimeType: 'application/vnd.google-apps.folder', parents: [], capabilities: { canAddChildren: true } });
    if (url.pathname === '/drive/v3/files') return json({ files: [{ id: 'visual_folder_fixture_123' }] });
    if (url.pathname === '/drive/v3/files/image_fixture_123') {
      if (url.searchParams.get('alt') === 'media') return new Response(png, { headers: { 'Content-Length': String(png.length) } });
      return json({ size: String(png.length), mimeType: 'image/png', parents: ['visual_folder_fixture_123'], appProperties: { imageKind: 'RUNTIME_ASSET', sha256: imageHash } });
    }
    if (url.pathname.startsWith('/drive/v3/files/')) return new Response(docx);
  }
  unexpected.push({ host: url.host, path: url.pathname, method });
  throw new Error('Unexpected upstream in serverless artifact smoke test.');
};

const handlers = {};
for (const name of ['index', 'runtime-asset', 'replication-model', 'public-indicators']) {
  handlers[name] = (await import('./api/' + name + '.js')).default;
  assert.equal(typeof handlers[name], 'function');
}
const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1');
  if (url.pathname === '/__smoke/calls') {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ calls, unexpected }));
    return;
  }
  const name = url.pathname.startsWith('/asset') ? 'runtime-asset'
    : url.pathname.startsWith('/replication') ? 'replication-model'
      : url.pathname.startsWith('/indicators') ? 'public-indicators' : 'index';
  req.query = Object.fromEntries(url.searchParams);
  req.headers['x-real-ip'] = '127.0.0.1';
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (value) => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(value)); return res; };
  res.send = (value) => { res.end(value); return res; };
  try { await handlers[name](req, res); }
  catch (error) {
    console.error(error);
    if (!res.writableEnded) res.status(500).json({ error: 'SERVERLESS_ARTIFACT_EXECUTION_FAILED' });
  }
});
server.listen(0, '127.0.0.1');
await once(server, 'listening');
console.log(JSON.stringify({ port: server.address().port }));
process.on('SIGTERM', () => server.close(() => process.exit(0)));
