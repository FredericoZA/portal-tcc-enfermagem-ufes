import test from 'node:test';
import assert from 'node:assert/strict';
import type { SignatureJob } from '../src/types/signatures';
import {
  createSignatureActionLock,
  dispatchDeclarationBatch,
  dispatchDeclarationToAsten,
  remainingSelectedDeclarations,
  canSendDeclarationToAsten,
  canReviewDeclarationWithGovbr,
  hasPendingDeclaration,
} from '../src/utils/coordinatorSignatureActions';

const queue = [{
  process: { id: 'p1' },
  documents: [{ type: 'DECLARACAO', requiresSignature: true, status: 'AGUARDANDO_ASSINATURA' }],
}];

function job(provider: 'ASTEN'|'GOV_BR', status: SignatureJob['status'], extra: Partial<SignatureJob> = {}): SignatureJob {
  return {
    id: provider + '-1',
    processId: 'p1',
    protocol: 'TCC-1',
    documentType: 'DECLARACAO',
    documentTitle: 'Declaração',
    documentVersion: 1,
    sourceDataRevision: 1,
    fileName: 'declaracao.pdf',
    mimeType: 'application/pdf',
    contentSha256: 'abc',
    idempotencyKey: provider + '-key',
    status,
    signers: [],
    createdAt: '2026-10-08T00:00:00.000Z',
    createdBy: 'master@example.test',
    updatedAt: '2026-10-08T00:00:00.000Z',
    provider,
    ...extra,
  };
}

test('fila pendente é a fonte de verdade para habilitar assinatura', () => {
  assert.equal(hasPendingDeclaration(queue, 'p1'), true);
  assert.equal(canSendDeclarationToAsten(queue, [], 'p1'), true);
});

test('Gov.br permite abrir preparação e conferência sem habilitar envio paralelo à Asten',()=>{
  assert.equal(canReviewDeclarationWithGovbr([],'p1',1),true);
  assert.equal(canReviewDeclarationWithGovbr([job('ASTEN','QUEUED')],'p1',1),true);
  for(const existing of [job('ASTEN','SENT'),job('ASTEN','PROVIDER_ERROR',{providerEnvelopeId:'123'}),job('ASTEN','QUEUED',{providerCreationState:'UNCERTAIN'}),job('ASTEN','PROVIDER_ERROR',{providerDispatchState:'UNCERTAIN'}),job('GOV_BR','ARCHIVED')])assert.equal(canReviewDeclarationWithGovbr([existing],'p1',1),false);
  assert.equal(canReviewDeclarationWithGovbr([job('GOV_BR','READY_FOR_REVIEW')],'p1',1),true);
  assert.equal(canReviewDeclarationWithGovbr([job('GOV_BR','DRIVE_SYNC_PENDING')],'p1',1),true);
  assert.equal(canReviewDeclarationWithGovbr([job('GOV_BR','ARCHIVED',{sourceDataRevision:0})],'p1',1),true);
});

test('Asten permite retomar apenas estados recuperáveis', () => {
  assert.equal(canSendDeclarationToAsten(queue, [job('ASTEN', 'PROVIDER_ERROR')], 'p1'), true);
  assert.equal(canSendDeclarationToAsten(queue, [job('ASTEN', 'SENT')], 'p1'), false);
  assert.equal(canSendDeclarationToAsten(queue, [job('ASTEN', 'PROVIDER_ERROR', { providerCreationState: 'UNCERTAIN' })], 'p1'), false);
});

test('Asten não abre fluxo paralelo quando Gov.br já foi preparado', () => {
  assert.equal(canSendDeclarationToAsten(queue, [job('GOV_BR', 'READY_FOR_REVIEW')], 'p1'), false);
});

test('processo sem declaração pendente não habilita os botões', () => {
  assert.equal(canSendDeclarationToAsten([], [], 'p1'), false);
});


test('declaração com falha recuperável mantém ação segura mesmo fora da fila pendente', () => {
  assert.equal(canSendDeclarationToAsten([], [job('ASTEN', 'PROVIDER_ERROR')], 'p1'), true);
  assert.equal(canSendDeclarationToAsten([], [job('ASTEN', 'PROVIDER_ERROR', {providerCreationState:'UNCERTAIN'})], 'p1'), false);
});


test('despacho incerto não habilita outra tentativa, mesmo com falha recuperável', () => {
  for (const providerDispatchState of ['UNCERTAIN', 'SENDING'] as const) {
    assert.equal(canSendDeclarationToAsten(queue, [job('ASTEN', 'PROVIDER_ERROR', {
      providerEnvelopeId: 'env-1', providerDispatchState
    })], 'p1'), false);
  }
});

test('envio e retomada usam o mesmo motor sem aceitar destinatários do cliente', async () => {
  const calls: unknown[][] = [];
  const client = {
    signProcessDocument: async (...args: [string, string]) => {
      calls.push(['create', ...args]);
      return { job: job('ASTEN', 'SENT') };
    },
    retrySignatureJob: async (id: string) => {
      calls.push(['retry', id]);
      return job('ASTEN', 'SENT');
    }
  };
  await dispatchDeclarationToAsten(queue, [], 'p1', client);
  await dispatchDeclarationToAsten(queue, [job('ASTEN', 'PROVIDER_ERROR')], 'p1', client);
  assert.deepEqual(calls, [['create', 'p1', 'DECLARACAO'], ['retry', 'ASTEN-1']]);
});

test('ação inelegível não faz chamada e resposta sem despacho confirmado não conta como envio', async () => {
  let calls = 0;
  const client = {
    signProcessDocument: async () => { calls++; return { job: job('ASTEN', 'QUEUED') }; },
    retrySignatureJob: async () => { calls++; return job('ASTEN', 'QUEUED'); }
  };
  await assert.rejects(dispatchDeclarationToAsten([], [], 'p1', client), /não está disponível/);
  assert.equal(calls, 0);
  await assert.rejects(dispatchDeclarationToAsten(queue, [], 'p1', client), /não foi confirmado/);
  assert.equal(calls, 1);
});

test('lote é sequencial, elimina duplicatas e mantém resultados parciais', async () => {
  let active = 0;
  let peak = 0;
  const calls: string[] = [];
  const result = await dispatchDeclarationBatch(['p1', 'p2', 'p1', 'p3'], async id => {
    active++;
    peak = Math.max(peak, active);
    calls.push(id);
    await Promise.resolve();
    active--;
    if (id === 'p2') throw new Error('Documento pendente.');
  });
  assert.equal(peak, 1);
  assert.deepEqual(calls, ['p1', 'p2', 'p3']);
  assert.deepEqual(result, {
    completedIds: ['p1', 'p3'],
    failures: [{ processId: 'p2', message: 'Documento pendente.' }],
    unattemptedIds: []
  });
});

test('lote interrompe após perda de autenticação e preserva itens não tentados', async () => {
  const calls: string[] = [];
  const result = await dispatchDeclarationBatch(['p1', 'p2', 'p3'], async id => {
    calls.push(id);
    if (id === 'p2') throw Object.assign(new Error('Entre novamente.'), { status: 428 });
  });
  assert.deepEqual(calls, ['p1', 'p2']);
  assert.deepEqual(result.completedIds, ['p1']);
  assert.deepEqual(result.unattemptedIds, ['p3']);
  assert.deepEqual(remainingSelectedDeclarations(['p1', 'p2', 'p3'], result), ['p2', 'p3']);
});

test('recarga retira da seleção um envio confirmado apesar de erro de rede', () => {
  const result = {
    completedIds: ['p1'],
    failures: [{ processId: 'p2', message: 'Conexão interrompida.' }],
    unattemptedIds: ['p3']
  };
  const refreshed = {
    queue: ['p1', 'p2', 'p3'].map(id => ({ ...queue[0], process: { id } })),
    jobs: [job('ASTEN', 'SENT', { processId: 'p2' })]
  };
  assert.deepEqual(remainingSelectedDeclarations(['p1', 'p2', 'p3'], result, refreshed), ['p3']);
});

test('bloqueio síncrono impede duplo clique individual ou lote e libera depois', async () => {
  const lock = createSignatureActionLock();
  let release!: () => void;
  const pending = new Promise<void>(resolve => { release = resolve; });
  let calls = 0;
  const first = lock.run(async () => { calls++; await pending; return 'concluído'; });
  const second = await lock.run(async () => { calls++; return 'duplicado'; });
  assert.equal(second, undefined);
  assert.equal(calls, 1);
  release();
  assert.equal(await first, 'concluído');
  assert.equal(await lock.run(async () => { calls++; return 'novo'; }), 'novo');
  assert.equal(calls, 2);
  await assert.rejects(lock.run(async () => { throw new Error('falha'); }), /falha/);
  assert.equal(await lock.run(async () => 'retomado'), 'retomado');
});
