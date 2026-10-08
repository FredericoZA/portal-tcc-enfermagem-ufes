import test from 'node:test';
import assert from 'node:assert/strict';
import type { SignatureJob } from '../src/types/signatures';
import {
  canPrepareDeclarationForGovBr,
  canSendDeclarationToAsten,
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
  assert.equal(canPrepareDeclarationForGovBr(queue, [], 'p1'), true);
});

test('Gov.br continua disponível quando Asten apenas aguarda integração', () => {
  assert.equal(canPrepareDeclarationForGovBr(queue, [job('ASTEN', 'WAITING_INTEGRATION')], 'p1'), true);
});

test('Gov.br é bloqueado quando Asten já tem compromisso externo', () => {
  const jobs = [job('ASTEN', 'SENT', { providerEnvelopeId: 'env-1', providerCreationState: 'CONFIRMED' })];
  assert.equal(canPrepareDeclarationForGovBr(queue, jobs, 'p1'), false);
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
  assert.equal(canPrepareDeclarationForGovBr([], [], 'p1'), false);
});
