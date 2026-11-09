import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import {
  API_REQUEST_TIMEOUT_MS, LONG_REQUEST_TIMEOUT_MS, ApiRequestError,
  apiClient, downloadApiFileRequest, fetchApiRequest, withApiRequestDeadline,
} from '../src/services/apiClient';
import { portalOperations } from '../src/services/portalOperations';
import { mayUseLegacyDevelopmentUpload } from '../src/services/secureStagedUpload';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}
const never = () => new Promise<never>(() => {});
const flush = async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); };
function timeoutError(error: unknown) {
  assert.ok(error instanceof ApiRequestError);
  assert.equal(error.code, 'REQUEST_TIMEOUT');
  assert.equal(error.status, 0);
  return true;
}
function mockFetch(t: TestContext, implementation: typeof fetch) {
  return t.mock.method(globalThis, 'fetch', implementation);
}

test('API comum expira em 120 segundos, aborta o transporte e não repete a mutação', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let signal!: AbortSignal;
  const fetch = mockFetch(t, async (_input, options) => { signal = options!.signal!; return never(); });
  const operation = apiClient.updateProcess('fixture-local', { expectedDataRevision: 17 });
  const check = assert.rejects(operation, error => {
    timeoutError(error);
    assert.match((error as Error).message, /Não foi possível confirmar o resultado/);
    assert.match((error as Error).message, /antes de repetir/);
    return true;
  });
  assert.equal(portalOperations.getSnapshot().pending, 1);
  t.mock.timers.tick(API_REQUEST_TIMEOUT_MS - 1);
  assert.equal(signal.aborted, false);
  t.mock.timers.tick(1);
  await check;
  assert.equal(signal.aborted, true);
  assert.equal(fetch.mock.callCount(), 1);
  assert.equal(fetch.mock.calls[0].arguments[1]?.method, 'PATCH');
  assert.equal(JSON.parse(String(fetch.mock.calls[0].arguments[1]?.body)).expectedDataRevision, 17);
  assert.equal(portalOperations.getSnapshot().pending, 0);
  assert.equal(mayUseLegacyDevelopmentUpload(0, 1024, true), false);
});

test('o prazo inclui a leitura do JSON depois dos cabeçalhos', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let bodyReads = 0;
  mockFetch(t, async () => ({ ok: true, json: () => { bodyReads++; return never(); } }) as unknown as Response);
  const operation = fetchApiRequest('/api/fixture-local', { timeoutMs: 50 });
  const check = assert.rejects(operation, timeoutError);
  await flush();
  assert.equal(bodyReads, 1);
  t.mock.timers.tick(50);
  await check;
});

test('o prazo também encerra uma resposta de erro cujo corpo travou', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  mockFetch(t, async () => ({ ok: false, status: 503, json: never }) as unknown as Response);
  const check = assert.rejects(fetchApiRequest('/api/fixture-local', { timeoutMs: 50 }), timeoutError);
  await flush();
  t.mock.timers.tick(50);
  await check;
});

test('cancelamento do chamador mantém o motivo no sinal composto e não repete POST', async t => {
  const caller = new AbortController();
  const reason = new Error('Cancelamento local de teste');
  let signal!: AbortSignal;
  const fetch = mockFetch(t, async (_input, options) => { signal = options!.signal!; return never(); });
  const operation = fetchApiRequest('/api/fixture-local', { method: 'POST', signal: caller.signal });
  const check = assert.rejects(operation, error => {
    assert.ok(error instanceof ApiRequestError);
    assert.equal(error.code, 'REQUEST_CANCELED');
    assert.match(error.message, /Confira o processo ou os dados antes de repetir/);
    return true;
  });
  caller.abort(reason);
  await check;
  assert.notEqual(signal, caller.signal);
  assert.equal(signal.aborted, true);
  assert.equal(signal.reason, reason);
  assert.equal(fetch.mock.callCount(), 1);
});

test('sinal já cancelado impede inclusive o primeiro envio', async t => {
  const caller = new AbortController();
  caller.abort();
  const fetch = mockFetch(t, async () => Response.json({ unexpected: true }));
  await assert.rejects(fetchApiRequest('/api/fixture-local', { signal: caller.signal }), error =>
    error instanceof ApiRequestError && error.code === 'REQUEST_CANCELED');
  assert.equal(fetch.mock.callCount(), 0);
});

test('cancelamento nativo e motivo nulo preservam o erro claro do cliente', async t => {
  const caller = new AbortController();
  let signal!: AbortSignal;
  mockFetch(t, async (_input, options) => {
    signal = options!.signal!;
    return new Promise<Response>((_, reject) => signal.addEventListener('abort', () => reject(signal.reason), { once: true }));
  });
  const check = assert.rejects(fetchApiRequest('/api/fixture-local', { signal: caller.signal }), error =>
    error instanceof ApiRequestError && error.code === 'REQUEST_CANCELED');
  caller.abort(null);
  await check;
  assert.equal(signal.reason, null);
});

test('sucesso preserva resposta, opções e credenciais e remove prazo e listener', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const caller = new AbortController();
  const remove = t.mock.method(caller.signal, 'removeEventListener');
  let signal!: AbortSignal;
  const fetch = mockFetch(t, async (_input, options) => {
    signal = options!.signal!;
    return Response.json({ saved: true, revision: 18 });
  });
  const result = await fetchApiRequest('/api/fixture-local', {
    method: 'PATCH', signal: caller.signal, timeoutMs: 100, body: '{"expectedRevision":17}',
    headers: { 'Idempotency-Key': 'fixture-local-operation' },
  });
  assert.deepEqual(result, { saved: true, revision: 18 });
  const options = fetch.mock.calls[0].arguments[1]!;
  assert.equal(options.credentials, 'include');
  assert.equal((options.headers as Record<string, string>)['Idempotency-Key'], 'fixture-local-operation');
  assert.equal('timeoutMs' in options, false);
  assert.equal(remove.mock.callCount(), 1);
  t.mock.timers.tick(1000);
  caller.abort();
  assert.equal(signal.aborted, false);
});

test('erros HTTP mantêm código e campos de validação sem retry', async t => {
  const fetch = mockFetch(t, async () => Response.json({
    error: 'O registro mudou.', code: 'STALE_DATA_REVISION', issues: { titulo: 'Confira o título.' },
  }, { status: 409 }));
  await assert.rejects(fetchApiRequest('/api/fixture-local', { method: 'PATCH' }), error => {
    assert.ok(error instanceof ApiRequestError);
    assert.equal(error.status, 409);
    assert.equal(error.code, 'STALE_DATA_REVISION');
    assert.deepEqual(error.issues, { titulo: 'Confira o título.' });
    return true;
  });
  assert.equal(fetch.mock.callCount(), 1);
});

test('download tem cinco minutos e o prazo continua durante a leitura do PDF', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const body = deferred<Blob>();
  let signal!: AbortSignal;
  mockFetch(t, async (_input, options) => {
    signal = options!.signal!;
    return { ok: true, headers: new Headers({ 'content-disposition': 'attachment; filename="fixture.pdf"' }), blob: () => body.promise } as Response;
  });
  const operation = downloadApiFileRequest('/api/fixture-local.pdf');
  const check = assert.rejects(operation, timeoutError);
  await flush();
  t.mock.timers.tick(API_REQUEST_TIMEOUT_MS + 1);
  assert.equal(signal.aborted, false);
  t.mock.timers.tick(LONG_REQUEST_TIMEOUT_MS - API_REQUEST_TIMEOUT_MS - 1);
  await check;
  assert.equal(signal.aborted, true);
});

test('download concluído preserva bytes e nome UTF-8 e encerra o indicador', async t => {
  const bytes = new Uint8Array([37, 80, 68, 70, 45, 49, 46, 55]);
  mockFetch(t, async () => new Response(bytes, { headers: {
    'content-disposition': "attachment; filename*=UTF-8''comprovante%20de%20reserva.pdf",
  } }));
  const result = await apiClient.downloadReservationReceipt('fixture-local');
  assert.equal(result.fileName, 'comprovante de reserva.pdf');
  assert.deepEqual(new Uint8Array(await result.blob.arrayBuffer()), bytes);
  assert.equal(portalOperations.getSnapshot().pending, 0);
});

test('manutenção longa pode concluir depois do prazo comum sem ser repetida', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const response = deferred<Response>();
  let signal!: AbortSignal;
  const fetch = mockFetch(t, async (_input, options) => { signal = options!.signal!; return response.promise; });
  const operation = apiClient.runBackupDrill();
  t.mock.timers.tick(API_REQUEST_TIMEOUT_MS + 1);
  assert.equal(signal.aborted, false);
  response.resolve(Response.json({ verified: true }));
  assert.deepEqual(await operation, { verified: true });
  t.mock.timers.tick(LONG_REQUEST_TIMEOUT_MS);
  assert.equal(signal.aborted, false);
  assert.equal(fetch.mock.callCount(), 1);
});

test('upload transmite o sinal ao PUT e encerra uma transferência travada sem replay', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { location: { origin: 'http://localhost:3000' } } });
  t.after(() => {
    if (previousWindow) Object.defineProperty(globalThis, 'window', previousWindow);
    else Reflect.deleteProperty(globalThis, 'window');
  });
  const started = deferred<void>();
  let signal!: AbortSignal;
  const fetch = mockFetch(t, async (input, options) => {
    if (input === '/api/uploads/staging') return Response.json({
      uploadId: 'fixture-local', provider:'drive', uploadUrl: 'https://www.googleapis.com/upload/drive/v3/files?upload_id=fixture',
      expiresAt: new Date(Date.now() + 600_000).toISOString(), maxSizeBytes: 1024,
    });
    assert.equal(input, 'https://www.googleapis.com/upload/drive/v3/files?upload_id=fixture');
    signal = options!.signal!;
    started.resolve();
    return never();
  });
  const file = new File(['fixture-local'], 'fixture.pdf', { type: 'application/pdf' });
  const operation = apiClient.uploadProcessPdfFile('fixture-local', 'trabalho-completo', file);
  const check = assert.rejects(operation, timeoutError);
  await started.promise;
  t.mock.timers.tick(LONG_REQUEST_TIMEOUT_MS);
  await check;
  assert.equal(signal.aborted, true);
  assert.equal(fetch.mock.callCount(), 2);
  assert.equal(fetch.mock.calls[1].arguments[1]?.credentials, 'omit');
  assert.equal(fetch.mock.calls[1].arguments[1]?.method, 'PUT');
  assert.equal(fetch.mock.calls[1].arguments[1]?.body, file);
  assert.equal(new Headers(fetch.mock.calls[1].arguments[1]?.headers).get('content-range'), `bytes 0-${file.size - 1}/${file.size}`);
  assert.equal(portalOperations.getSnapshot().pending, 0);
});

test('prazo inválido falha antes de executar o transporte', async () => {
  for (const timeoutMs of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
    let called = false;
    await assert.rejects(withApiRequestDeadline(async () => { called = true; }, { timeoutMs }), RangeError);
    assert.equal(called, false);
  }
});
