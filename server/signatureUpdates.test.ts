import test from 'node:test';
import assert from 'node:assert/strict';
import type { SignatureJob } from '../src/types';
import { createSignatureUpdateWatcher, hasPendingSignatureUpdates, signatureUpdatesFingerprint } from '../src/utils/signatureUpdates';

function job(status: SignatureJob['status'] = 'SENT'): SignatureJob {
  return { id: 'signature-1', status, updatedAt: '2026-10-15T12:00:00Z', signers: [] } as SignatureJob;
}
function timers() {
  const pending = new Map<object, { callback: () => void; delay: number }>();
  return {
    pending,
    schedule(callback: () => void, delay: number) { const id = {}; pending.set(id, { callback, delay }); return id; },
    cancel(id: unknown) { pending.delete(id as object); },
    async run() {
      const entry = pending.entries().next().value;
      assert.ok(entry, 'há um próximo intervalo agendado');
      pending.delete(entry[0]);
      entry[1].callback();
      await new Promise(resolve => setImmediate(resolve));
    },
  };
}

test('fingerprint ignora reordenação e identifica assinatura, arquivo e atualização', () => {
  const first = job();
  const second = { ...job(), id: 'signature-2' };
  const fingerprint = signatureUpdatesFingerprint([first, second]);
  assert.equal(fingerprint, signatureUpdatesFingerprint([second, first]));
  for (const change of [
    { status: 'SIGNED' }, { updatedAt: '2026-10-15T12:00:10Z' },
    { driveSignedFileId: 'signed-drive-id' }, { signedSha256: 'signed-sha' },
    { signers: [{ id: 'advisor', status: 'SIGNED', signedAt: '2026-10-15T12:00:10Z' }] },
  ]) {
    assert.notEqual(fingerprint, signatureUpdatesFingerprint([{ ...first, ...change } as SignatureJob, second]));
  }
});

test('somente arquivos arquivados e estados encerrados dispensam observação', () => {
  for (const status of ['ARCHIVED', 'CANCELED', 'DECLINED', 'EXPIRED'] as const) assert.equal(hasPendingSignatureUpdates([job(status)]), false);
  for (const status of ['SENT', 'SIGNED', 'PARTIALLY_SIGNED', 'DRIVE_SYNC_PENDING', 'SENDING'] as const) assert.equal(hasPendingSignatureUpdates([job(status)]), true);
  assert.equal(hasPendingSignatureUpdates([]), false);
});

test('consulta apenas assinaturas a cada dez segundos e não recarrega dados iguais', async () => {
  const clock = timers();
  let fetches = 0;
  let reloads = 0;
  const watcher = createSignatureUpdateWatcher({
    getKnownJobs: () => [job()], fetchJobs: async () => { fetches++; return [job()]; },
    onChange: () => { reloads++; }, isActive: () => true,
    schedule: clock.schedule, cancel: clock.cancel,
  });
  watcher.start();
  assert.equal(fetches, 0);
  assert.equal([...clock.pending.values()][0].delay, 10_000);
  await clock.run();
  await clock.run();
  assert.equal(fetches, 2);
  assert.equal(reloads, 0);
  watcher.stop();
  assert.equal(clock.pending.size, 0);
});

test('assinatura recebida no Portal recarrega uma vez e encerra após arquivo disponível', async () => {
  const clock = timers();
  let known = [job()];
  let reloads = 0;
  const archived = { ...job('ARCHIVED'), driveSignedFileId: 'private-signed-pdf' };
  const watcher = createSignatureUpdateWatcher({
    getKnownJobs: () => known, fetchJobs: async () => [archived],
    onChange: jobs => { reloads++; known = jobs; }, isActive: () => true,
    schedule: clock.schedule, cancel: clock.cancel,
  });
  watcher.start();
  await clock.run();
  assert.equal(reloads, 1);
  assert.equal(known[0].driveSignedFileId, 'private-signed-pdf');
  assert.equal(clock.pending.size, 0);
});

test('aba oculta suspende consultas e voltar ao foco verifica imediatamente', async () => {
  const clock = timers();
  let active = false;
  let fetches = 0;
  const watcher = createSignatureUpdateWatcher({
    getKnownJobs: () => [job()], fetchJobs: async () => { fetches++; return [job()]; },
    onChange: () => {}, isActive: () => active,
    schedule: clock.schedule, cancel: clock.cancel,
  });
  watcher.start();
  assert.equal(clock.pending.size, 0);
  watcher.wake();
  assert.equal(fetches, 0);
  active = true;
  watcher.wake();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(fetches, 1);
  assert.equal(clock.pending.size, 1);
  active = false;
  watcher.pause();
  assert.equal(clock.pending.size, 0);
  watcher.stop();
});

test('focus repetido não sobrepõe consulta e desmontagem ignora resposta atrasada', async () => {
  const clock = timers();
  let resolveFetch!: (jobs: SignatureJob[]) => void;
  let fetches = 0;
  let reloads = 0;
  const watcher = createSignatureUpdateWatcher({
    getKnownJobs: () => [job()],
    fetchJobs: () => { fetches++; return new Promise<SignatureJob[]>(resolve => { resolveFetch = resolve; }); },
    onChange: () => { reloads++; }, isActive: () => true,
    schedule: clock.schedule, cancel: clock.cancel,
  });
  watcher.wake();
  watcher.wake();
  assert.equal(fetches, 1);
  watcher.stop();
  resolveFetch([job('ARCHIVED')]);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(reloads, 0);
  assert.equal(clock.pending.size, 0);
});

test('falha temporária preserva estado e tenta novamente; sessão inválida encerra consultas', async () => {
  for (const status of [500, 401, 403]) {
    const clock = timers();
    let reloads = 0;
    const watcher = createSignatureUpdateWatcher({
      getKnownJobs: () => [job()], fetchJobs: async () => { throw { status }; },
      onChange: () => { reloads++; }, isActive: () => true,
      schedule: clock.schedule, cancel: clock.cancel,
    });
    watcher.start();
    await clock.run();
    assert.equal(reloads, 0);
    assert.equal(clock.pending.size, status === 500 ? 1 : 0);
    watcher.stop();
  }
});
