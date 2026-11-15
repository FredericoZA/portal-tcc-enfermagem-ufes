import test from 'node:test';
import assert from 'node:assert/strict';
import { DEMO_PROCESSES } from '../../src/services/demoSeed';
import {
  isProcessReviewMetadataField,
  processDataReviewValues,
  processDataReviewPatch,
  processDataReviewHasChanges,
  processDataReviewBlocker,
} from '../../src/utils/processDataReview';
import type {SignatureJob} from '../../src/types';

test('review snapshot preserves participants and timezone without exporting documents or identifiers', () => {
  const process = structuredClone(DEMO_PROCESSES[0]);
  process.defesa.startAt = '2026-11-11T02:47:00.000Z';
  process.banca.reverse();
  const values = processDataReviewValues(process);
  assert.equal(values.defesa.date, '2026-11-10');
  assert.equal(values.defesa.time, '23:47');
  assert.deepEqual(
    values.banca.map((person) => [person.id, person.funcao]),
    [
      ['b3', 'EXAMINER_3'],
      ['b2', 'EXAMINER_2'],
    ],
  );
  for (const field of [
    'matricula',
    'acervo',
    'avaliacao',
    'protocolo',
    'driveFolderId',
    'status',
  ])
    assert.equal(field in values, false);
  assert.equal('matricula' in values.aluno1, false);
});

test('unchanged review has no mutation payload and one field edit sends only that field', () => {
  const base = processDataReviewValues(DEMO_PROCESSES[0]);
  const unchanged = processDataReviewPatch(
    base,
    structuredClone(base),
    7,
    [],
  );
  assert.equal(processDataReviewHasChanges(unchanged), false);
  const next = structuredClone(base);
  next.titulo = 'Novo título';
  const patch = processDataReviewPatch(
    base,
    next,
    7,
    [],
  );
  assert.deepEqual(patch, {
    expectedDataRevision: 7,
    confirmed: true,
    titulo: 'Novo título',
  });
});

test('metadata is whitelisted and structural or sensitive answers cannot enter the client patch', () => {
  const base = processDataReviewValues(DEMO_PROCESSES[0]);
  const next = structuredClone(base);
  next.registrationAnswers = {
    ...base.registrationAnswers,
    PERIODO_ACADEMICO: '2026-2',
    TEMA_PRINCIPAL: 'Saúde mental',
    STATUS: 'CONCLUIDO',
    ALUNO_1_MATRICULA: '1234',
    CPF: '999',
    ASTEN_TOKEN: 'x',
    OUTRO_CAMPO: 'ignorado',
  };
  const patch = processDataReviewPatch(base, next, 7, [
    'PERIODO_ACADEMICO',
    'TEMA_PRINCIPAL',
    'STATUS',
    'ALUNO_1_MATRICULA',
    'CPF',
    'ASTEN_TOKEN',
  ]);
  assert.deepEqual(patch.registrationAnswers, {
    PERIODO_ACADEMICO: '2026-2',
    TEMA_PRINCIPAL: 'Saúde mental',
  });
  for (const field of [
    'ATA_FINAL',
    'PUBLICAR_TRABALHO',
    'GOV_ASSINATURA',
    'EXAMINADOR_2_NOME',
    'RA',
    'TITULO',
    'SIAPE',
    'MATRICULA',
  ]) {
    if (field !== 'RA')
      assert.equal(isProcessReviewMetadataField(field), false, field);
  }
});

test('changing author display order does not exchange author identities', () => {
  const base = processDataReviewValues(DEMO_PROCESSES[1]);
  const next = { ...base, authorOrder: 'ALUNO_2_FIRST' as const };
  const patch = processDataReviewPatch(base, next, 7, []);
  assert.equal(patch.authorOrder, 'ALUNO_2_FIRST');
  assert.equal(patch.aluno1, undefined);
  assert.equal(patch.aluno2, undefined);
});

test('review entry point mirrors server locks for recorded ata, final delivery and signature jobs',()=>{
  const editable=structuredClone(DEMO_PROCESSES[7]);
  assert.equal(processDataReviewBlocker(editable,[]),undefined);
  for(const change of [
    {status:'CONCLUIDO'},
    {avaliacao:{...editable.avaliacao,status:'CONCLUIDO'}},
    {avaliacao:{...editable.avaliacao,submittedAt:'2026-11-11T12:00:00Z'}},
    {acervo:{...editable.acervo,submittedAt:'2026-11-11T12:00:00Z'}},
    {avaliacao:{...editable.avaliacao,reviewedAta:{}}},
  ])assert.ok(processDataReviewBlocker({...editable,...change} as typeof editable,[]));
  for(const status of ['WAITING_INTEGRATION','QUEUED','READY_FOR_REVIEW','APPROVED','SENDING','SENT','PARTIALLY_SIGNED','SIGNED','DRIVE_SYNC_PENDING']) {
    assert.ok(processDataReviewBlocker(editable,[{processId:editable.id,documentType:'ATA',status} as SignatureJob]),status);
  }
  assert.equal(processDataReviewBlocker(editable,[{processId:editable.id,documentType:'ATA',status:'CANCELED'} as SignatureJob]),undefined);
  assert.equal(processDataReviewBlocker(editable,[{processId:'another-process',documentType:'ATA',status:'SENT'} as SignatureJob]),undefined);
  assert.ok(processDataReviewBlocker(editable,[{processId:editable.id,documentType:'TERMO',status:'SENT'} as SignatureJob]));
});
