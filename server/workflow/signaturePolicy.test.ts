import test from 'node:test';
import assert from 'node:assert/strict';
import type { ProcessData, SignatureJob } from '../../src/types';
import {
  assertSignatureEligibility,
  canInitiateSignature,
  deriveSignatureSigners,
  isValidSignatureEmail,
  publicationRequested,
  repositoryDataComplete,
} from './signaturePolicy';

const president = { commissionPresidentEmail: 'Presidente@example.org', commissionPresidentName: 'Presidente cadastrado' };
function processFixture(): ProcessData {
  return {
    id: 'process-1', protocolo: 'TCC-1', dataRevision: 2,
    aluno1: { nome: 'Autora Um', email: ' Autora1@example.org ' },
    aluno2: null,
    orientador: { nome: 'Orientador cadastrado', email: ' Orientador@example.org ' },
    avaliacao: { status: 'CONCLUIDO' },
    acervo: {
      palavrasChave: ['um', 'dois', 'três', 'quatro', 'cinco'],
      resumoSintese: 'Resumo', trabalhoCompletoFileUrl: '/private/work',
      publishFullWork: true, publishExpandedAbstract: false,
      submittedAt: '2026-10-15T12:00:00.000Z', authorizationConfirmedAt: '2026-10-15T12:00:00.000Z',
    },
  } as ProcessData;
}
function archivedJob(type: 'ATA' | 'TERMO'): SignatureJob {
  return {
    processId: 'process-1', documentType: type, documentVersion: 1,
    sourceDataRevision: 2, status: 'ARCHIVED', driveSignedFileId: `signed-${type}`,
  } as SignatureJob;
}

test('ata usa somente o orientador cadastrado e normaliza seu e-mail', () => {
  const signers = deriveSignatureSigners(processFixture(), 'ATA', president);
  assert.equal(signers.length, 1);
  assert.deepEqual(signers[0], {
    id: 'advisor:orientador@example.org', role: 'ADVISOR', name: 'Orientador cadastrado',
    email: 'orientador@example.org', signingOrder: 1, status: 'WAITING',
  });
});

test('termo inclui um ou dois autores e orientador simultaneamente', () => {
  const process = processFixture();
  assert.deepEqual(deriveSignatureSigners(process, 'TERMO', president).map(signer => signer.email), ['autora1@example.org', 'orientador@example.org']);
  process.aluno2 = { ...process.aluno1, nome: 'Autor Dois', email: 'autor2@example.org' };
  const signers = deriveSignatureSigners(process, 'TERMO', president);
  assert.deepEqual(signers.map(signer => signer.role), ['STUDENT', 'STUDENT', 'ADVISOR']);
  assert.deepEqual(signers.map(signer => signer.signingOrder), [1, 1, 1]);
});

test('declaração usa presidente configurado, sem substituir por master ou destinatário do pedido', () => {
  const process = Object.assign(processFixture(), { recipientEmail: 'invasor@example.org', signers: [{ email: 'invasor@example.org' }] });
  const settings = { ...president, masterEmail: 'master@example.org', recipientEmail: 'invasor@example.org' };
  assert.deepEqual(deriveSignatureSigners(process, 'DECLARACAO', settings).map(signer => signer.email), ['presidente@example.org']);
  assert.throws(() => deriveSignatureSigners(process, 'DECLARACAO', { commissionPresidentEmail: '' }), /Presidente/);
});

test('cadastro de signatário inválido é recusado antes de gerar qualquer artefato', () => {
  for (const invalid of ['', 'sem-arroba', 'aluno@example.org\r\nBcc:outro@example.org', 'aluno@example.org\n', 'a'.repeat(250) + '@x.org']) {
    const process = processFixture();
    process.orientador.email = invalid;
    assert.equal(isValidSignatureEmail(invalid), false);
    assert.throws(() => deriveSignatureSigners(process, 'ATA', president), /e-mail válido/);
  }
});

test('termo rejeita autores repetidos ou autor cadastrado como orientador', () => {
  const process = processFixture();
  process.aluno2 = { ...process.aluno1, email: 'AUTORA1@example.org' };
  assert.throws(() => deriveSignatureSigners(process, 'TERMO', president), /e-mails distintos/);
  process.aluno2 = null;
  process.orientador.email = process.aluno1.email;
  assert.throws(() => deriveSignatureSigners(process, 'TERMO', president), /e-mails distintos/);
});

test('só administrador ou signatário do tipo pode iniciar a solicitação', () => {
  const process = processFixture();
  assert.equal(canInitiateSignature('autora1@example.org', process, 'ATA', president), false);
  assert.equal(canInitiateSignature('ORIENTADOR@example.org', process, 'ATA', president), true);
  assert.equal(canInitiateSignature('autora1@example.org', process, 'TERMO', president), true);
  assert.equal(canInitiateSignature('orientador@example.org', process, 'TERMO', president), true);
  assert.equal(canInitiateSignature('orientador@example.org', process, 'DECLARACAO', president), false);
  assert.equal(canInitiateSignature('presidente@example.org', process, 'DECLARACAO', president), true);
  assert.equal(canInitiateSignature('examinador@example.org', process, 'ATA', president), false);
  assert.equal(canInitiateSignature('master@example.org', process, 'ATA', president, ['MASTER_ADMIN']), true);
  assert.equal(canInitiateSignature('', process, 'ATA', president, ['MASTER_ADMIN']), false);
});

test('avaliação pendente impede todos os tipos, inclusive para administrador', () => {
  const process = processFixture();
  process.avaliacao.status = 'PENDENTE' as ProcessData['avaliacao']['status'];
  assert.equal(canInitiateSignature('master@example.org', process, 'ATA', president, ['MASTER_ADMIN']), true);
  for (const type of ['ATA', 'TERMO', 'DECLARACAO'] as const) {
    assert.throws(() => assertSignatureEligibility(process, type, []), /avaliação pendente/);
  }
});

test('ata pode preceder dados finais; termo e declaração aguardam repositório completo', () => {
  const process = processFixture();
  delete process.acervo;
  assert.equal(repositoryDataComplete(process), false);
  assert.doesNotThrow(() => assertSignatureEligibility(process, 'ATA', []));
  for (const type of ['TERMO', 'DECLARACAO'] as const) {
    assert.throws(() => assertSignatureEligibility(process, type, []), /dados finais/);
  }
});

test('publicação parcial de resumo também exige arquivo e termo autorizado', () => {
  const process = processFixture();
  process.acervo!.publishFullWork = false;
  process.acervo!.publishExpandedAbstract = true;
  assert.equal(publicationRequested(process), true);
  assert.equal(repositoryDataComplete(process), false);
  process.acervo!.resumoExpandidoFileId = 'expanded-abstract';
  assert.equal(repositoryDataComplete(process), true);
  delete process.acervo!.authorizationConfirmedAt;
  assert.throws(() => assertSignatureEligibility(process, 'TERMO', []), /autorização/);
  process.acervo!.authorizationConfirmedAt = '2026-10-15T12:00:00.000Z';
  assert.doesNotThrow(() => assertSignatureEligibility(process, 'TERMO', []));
});

test('sem publicação não há termo; declaração requer ata e dispensa termo', () => {
  const process = processFixture();
  process.acervo!.publishFullWork = false;
  assert.equal(publicationRequested(process), false);
  assert.throws(() => assertSignatureEligibility(process, 'TERMO', []), /só é aplicável/);
  assert.throws(() => assertSignatureEligibility(process, 'DECLARACAO', []), /Ata e o Termo/);
  assert.doesNotThrow(() => assertSignatureEligibility(process, 'DECLARACAO', [archivedJob('ATA')]));
});

test('declaração exige ata arquivada e termo aplicável da revisão atual arquivado', () => {
  const process = processFixture();
  const ata = archivedJob('ATA');
  const term = archivedJob('TERMO');
  assert.throws(() => assertSignatureEligibility(process, 'DECLARACAO', [ata]), /Ata e o Termo/);
  assert.throws(() => assertSignatureEligibility(process, 'DECLARACAO', [{ ...ata, status: 'SIGNED' }, term]), /Ata e o Termo/);
  assert.throws(() => assertSignatureEligibility(process, 'DECLARACAO', [ata, { ...term, sourceDataRevision: 1 }]), /Ata e o Termo/);
  assert.throws(() => assertSignatureEligibility(process, 'DECLARACAO', [ata, { ...term, driveSignedFileId: undefined }]), /Ata e o Termo/);
  assert.doesNotThrow(() => assertSignatureEligibility(process, 'DECLARACAO', [ata, term]));
  delete process.acervo!.submittedAt;
  assert.throws(() => assertSignatureEligibility(process, 'DECLARACAO', [ata, term]), /Ata e o Termo/);
});
