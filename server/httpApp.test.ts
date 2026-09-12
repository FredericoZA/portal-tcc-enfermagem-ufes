import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import express from 'express';
import { createPortalHttpApp, portalHttpError } from './httpApp';

test('API retorna JSON após rejeição assíncrona, omite o segredo e continua atendendo', async () => {
  const app = createPortalHttpApp();
  app.use(express.json({ limit: '1kb' }));
  app.set('trust proxy', 1);
  assert.equal(app.get('trust proxy'), 1);
  app.get('/async-error', [async () => { await Promise.resolve(); throw new Error('secret-token-must-not-leak'); }]);
  app.post('/echo', (req, res) => { res.json(req.body); });
  app.get('/health', async (_req, res) => { res.json({ ok: true }); });
  app.use(portalHttpError);
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  const base = `http://127.0.0.1:${address.port}`;
  try {
    const failed = await fetch(base + '/async-error');
    assert.equal(failed.status, 500);
    const body = await failed.json();
    assert.equal(body.code, 'REQUEST_FAILED');
    assert.ok(body.requestId);
    assert.ok(!JSON.stringify(body).includes('secret-token'));
    assert.equal((await fetch(base + '/echo', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{oops' })).status, 400);
    assert.equal((await fetch(base + '/echo', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ value: 'x'.repeat(2000) }) })).status, 413);
    assert.deepEqual(await (await fetch(base + '/health')).json(), { ok: true });
  } finally { await new Promise<void>(resolve => server.close(() => resolve())); }
});

test('mutações de navegador exigem origem confiável', async () => {
  const app = createPortalHttpApp();
  app.use(express.json());
  app.post('/mutate', (_req, res) => res.json({ ok: true }));
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  const base = `http://127.0.0.1:${address.port}`;
  try {
    const blocked = await fetch(base + '/mutate', {
      method: 'POST',
      headers: { origin: 'https://attacker.invalid', 'sec-fetch-site': 'cross-site', 'content-type': 'application/json' },
      body: '{}'
    });
    assert.equal(blocked.status, 403);
    assert.equal((await blocked.json()).code, 'ORIGIN_VALIDATION_FAILED');

    const sameOrigin = await fetch(base + '/mutate', {
      method: 'POST',
      headers: { origin: base, 'sec-fetch-site': 'same-origin', 'content-type': 'application/json' },
      body: '{}'
    });
    assert.equal(sameOrigin.status, 200);

    const serverToServer = await fetch(base + '/mutate', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
    assert.equal(serverToServer.status, 200);
  } finally { await new Promise<void>(resolve => server.close(() => resolve())); }
});
