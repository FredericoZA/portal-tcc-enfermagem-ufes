import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import express, { type Request, type Response } from 'express';
import { createRequestAdmission, admitPortalRequest } from './requestAdmission';
import { createPortalHttpApp } from '../httpApp';

test('orçamento se recupera no prazo, isola clientes e limita cardinalidade sem apagar cotas', () => {
  let instant = 0;
  const admit = createRequestAdmission({ now: () => instant, maxBuckets: 2, limits: { api: 2 } });
  assert.equal(admit('a', 'api').allowed, true);
  assert.equal(admit('a', 'api').allowed, true);
  assert.deepEqual(admit('a', 'api'), { allowed: false, retryAfter: 60 });
  assert.equal(admit('b', 'api').allowed, true);
  assert.equal(admit('c', 'api').allowed, false);
  assert.equal(admit('a', 'api').allowed, false);
  instant = 60_000;
  assert.equal(admit('c', 'api').allowed, true);
  assert.equal(admit('a', 'api').allowed, true);
});

test('orçamentos preservam abertura e polling de 25 alunos no mesmo NAT', () => {
  const admit = createRequestAdmission({ now: () => 0 });
  for (let student = 0; student < 25; student++) {
    for (let request = 0; request < 20; request++) assert.equal(admit('campus', 'api').allowed, true);
    for (let poll = 0; poll < 4; poll++) assert.equal(admit('campus', 'sync').allowed, true);
  }
  for (let request = 0; request < 500; request++) assert.equal(admit('campus', 'api').allowed, true);
  assert.equal(admit('campus', 'api').allowed, false);
  assert.equal(admit('campus', 'callback').allowed, true);
});

test('admissão aceita os cabeçalhos Node recebidos na Vercel', () => {
  const previousVercel = process.env.VERCEL;
  process.env.VERCEL = '1';
  let status = 0;
  const response = { setHeader() {}, status(value: number) { status = value; return this; }, json() {} } as unknown as Response;
  try {
    const req = { method: 'GET', url: '/api/processes', headers: { 'x-real-ip': '192.0.2.240' }, socket: { remoteAddress: '127.0.0.1' } } as unknown as Request;
    assert.equal(admitPortalRequest(req, response), true);
    assert.equal(status, 0);
  } finally {
    if (previousVercel === undefined) delete process.env.VERCEL; else process.env.VERCEL = previousVercel;
  }
});

test('recusa ocorre antes do parser e hidratação; headers falsos e mudança de URL não reiniciam cota', async () => {
  const previousVercel = process.env.VERCEL;
  delete process.env.VERCEL;
  let status = 0;
  const response = { setHeader() {}, status(value: number) { status = value; return this; }, json() {} } as unknown as Response;
  try {
    for (let n = 0; n < 1000; n++) {
      const req = { method: 'POST', url: '/api/path-' + n, socket: { remoteAddress: '127.0.0.1' }, headers: { 'x-real-ip': '203.0.113.' + n, 'x-forwarded-for': '198.51.100.' + n } } as unknown as Request;
      assert.equal(admitPortalRequest(req, response), true);
      // api/index.ts and Express may see the same request; count it only once.
      assert.equal(admitPortalRequest(req, response), true);
    }
    assert.equal(status, 0);
    const app = createPortalHttpApp();
    let parsed = 0, hydrated = 0;
    app.use(express.json());
    app.use('/api', (_req, _res, next) => { parsed++; hydrated++; next(); });
    app.post('/api/next', (_req, res) => res.json({ ok: true }));
    app.get('/api/health', (_req, res) => res.json({ ok: true }));
    const server = app.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const address = server.address();
    assert.ok(address && typeof address === 'object');
    const base = `http://127.0.0.1:${address.port}`;
    try {
      const blocked = await fetch(base + '/api/next?alternate=1', { method: 'POST', headers: { 'content-type': 'application/json', 'x-real-ip': '203.0.113.100', 'x-forwarded-for': '203.0.113.101', cookie: 'new=identity' }, body: '{invalid-json' });
      assert.equal(blocked.status, 429);
      assert.equal((await blocked.json()).code, 'REQUEST_RATE_LIMITED');
      assert.ok(Number(blocked.headers.get('retry-after')) > 0);
      assert.equal(parsed, 0);
      assert.equal(hydrated, 0);
      assert.equal((await fetch(base + '/api/health')).status, 200);
    } finally { await new Promise<void>(resolve => server.close(() => resolve())); }
  } finally {
    if (previousVercel === undefined) delete process.env.VERCEL; else process.env.VERCEL = previousVercel;
  }
});
