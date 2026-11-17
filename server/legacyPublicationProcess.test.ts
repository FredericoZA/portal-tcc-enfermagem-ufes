import test from 'node:test';
import assert from 'node:assert/strict';
import { historicalPublicationProcess, storeHistoricalPublicationProcess } from './legacyPublicationProcess';
import {
  canonicalLegacyRecord,
  publicLegacyAcademicView,
  publicLegacyAdministrativeDocuments,
} from './legacyArchive';
import {
  authorMayChangePublication,
  beginPublicationChoice,
  finishPublicationRevocation,
} from './workflow/publicationChoice';
import { assertSignatureEligibility } from './workflow/signaturePolicy';

function fixture(): any {
  return canonicalLegacyRecord({
    id: 'legado-0998',
    protocolo: '998 - Legado',
    titulo: 'Historical fixture',
    autores: ['Author'],
    orientador: 'Advisor',
    coorientador: '',
    coorientadorInstituicao: '',
    examinadores: [],
    resumo: '',
    palavrasChave: [],
    dataDefesa: '2024-01-01',
    horaDefesa: '',
    localDefesa: '',
    attachments: [
      {
        kind: 'TRABALHO_COMPLETO',
        driveFileId: 'original_legacy_1234',
        fileName: 'work.pdf',
        sha256: 'a'.repeat(64),
      },
    ],
    provenance: {
      publicationImportBaseline:{publicFiles:[{kind:'TRABALHO_COMPLETO',sha256:'a'.repeat(64)}]},
      originalConsent: ['Sim'],
      processFolderId: 'private_folder_1234',
      administrativeDocuments: [
        {
          kind: 'TERMO',
          driveFileId: 'old_term_123456',
          folderId: 'private_folder_1234',
          fileName: 'term.pdf',
          sha256: 'b'.repeat(64),
          visibility: 'PRIVATE_ADMINISTRATIVE_DOCUMENT',
        },
      ],
    },
  } as any);
}
test('historical editing is Master only and never fabricates ATA, declaration or a live process', () => {
  const record = fixture(),
    p = historicalPublicationProcess(record);
  assert.equal(p.avaliacao.status, 'PENDENTE');
  assert.equal(authorMayChangePublication(p, 'master@example.invalid', true, true), true);
  assert.equal(authorMayChangePublication(p, 'author@example.invalid', true), false);
  const next = beginPublicationChoice(
    p,
    { publishFullWork: false, publishExpandedAbstract: false },
    [],
    'master@example.invalid',
    'request',
    '2026-11-16',
  );
  storeHistoricalPublicationProcess(record, next);
  assert.equal(record.isPublic, false);
  assert.equal(publicLegacyAcademicView(record).publicFiles.length, 0);
  assert.deepEqual(publicLegacyAdministrativeDocuments(record), []);
  assert.ok(next.acervo.publicationChange!.revokeFileIds.includes('old_term_123456'));
  finishPublicationRevocation(next, '2026-11-16');
  storeHistoricalPublicationProcess(record, next);
  assert.equal(record.authorizationDecision, 'DENIED');
  assert.equal(record.provenance.originalConsent[0], 'Sim');
  assert.equal(record.provenance.administrativeDocuments[0].driveFileId, 'old_term_123456');
  assert.ok(!JSON.stringify(publicLegacyAcademicView(record)).includes('publicationProcess'));
});
test('historical new consent exposes only the specifically authorized PDF after the renewed signed term', () => {
  const record = fixture(),
    p = historicalPublicationProcess(record);
  const next = beginPublicationChoice(
    p,
    { publishFullWork: true, publishExpandedAbstract: false },
    [],
    'master@example.invalid',
    'request',
    '2026-11-16',
    true,
  );
  storeHistoricalPublicationProcess(record, next);
  finishPublicationRevocation(next, '2026-11-16');
  assert.doesNotThrow(() => assertSignatureEligibility(next, 'TERMO', []));
  assert.throws(() => assertSignatureEligibility(next, 'ATA', []));
  storeHistoricalPublicationProcess(record, next);
  assert.equal(record.isPublic, false);
  next.acervo.publicationChange!.status = 'COMPLETED';
  next.acervo.publicationChange!.signatureJobId = 'new-signed-term';
  next.acervo.publicationSyncedAt = '2026-11-17';
  storeHistoricalPublicationProcess(record, next);
  assert.equal(record.isPublic, true);
  const oldId = next.acervo.trabalhoCompletoFileId;
  next.acervo.trabalhoCompletoFileId = 'replacement_legacy_123';
  next.acervo.trabalhoCompletoSha256 = 'c'.repeat(64);
  next.acervo.publicationChange!.status = 'EDITING';
  storeHistoricalPublicationProcess(record, next);
  assert.equal(record.isPublic, false);
  assert.equal(record.provenance.supersededAttachments[0].driveFileId, oldId);
  assert.equal(record.attachments[0].driveFileId, 'replacement_legacy_123');
});

test('a later withdrawal beats renewed consent, while a subsequent signed renewal may publish again',()=>{
 const record=fixture();
 record.provenance.publicationOverride={status:'COMPLETED',publishFullWork:true,signedTermJobId:'term-new',syncedAt:'2026-11-16T12:00:00Z'};
 record.provenance.publicationWithdrawal={withdrawnAt:'2026-11-16T13:00:00Z',drivePending:true};
 assert.equal(canonicalLegacyRecord(record).isPublic,false);
 record.provenance.publicationOverride.syncedAt='2026-11-16T14:00:00Z';
 assert.equal(canonicalLegacyRecord(record).isPublic,true);
 record.provenance.publicationWithdrawal.withdrawnAt='2026-11-16T14:00:00Z';
 assert.equal(canonicalLegacyRecord(record).isPublic,false,'equal or ambiguous timing fails closed');
});
