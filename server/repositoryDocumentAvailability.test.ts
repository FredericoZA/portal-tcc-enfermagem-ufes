import assert from 'node:assert/strict';
import test from 'node:test';
import type {ProcessDocument, SignatureJob} from '../src/types';
import type {LegacyAcademicRecord} from '../src/types/legacyArchive';
import {DEMO_PROCESSES} from '../src/services/demoSeed';
import {publishedRepositoryDocuments, repositoryDocumentStatus} from '../src/utils/repositoryDocuments';
import {currentRepositoryDocuments, legacyRepositoryDocuments} from './repositoryDocumentAvailability';
import {runtimeReadProjection} from './runtimeReadProjection';

const hash = 'a'.repeat(64);

test('repository recognizes linked files instead of draft status and leaves unauthorized private columns unknown',()=>{
  const process = structuredClone(DEMO_PROCESSES[0]);
  process.acervo = {...process.acervo,trabalhoCompletoFileId:'private-fixture-work',trabalhoCompletoSha256:hash};
  process.defesa.invitationDriveFileId = undefined;
  process.defesa.reservationHistory = [{
    startAt:'2026-01-01T10:00:00-03:00',endAt:'2026-01-01T11:00:00-03:00',local:'Local fictício',
    invalidatedAt:'2026-01-01T08:00:00-03:00',invalidatedBy:'fixture',invitationDriveFileId:'private-fixture-invitation',
  }];
  const invite = {id:'doc-convite',type:'CONVITE',status:'NAO_DISPONIVEL',visibleToRoles:['STUDENT']} as ProcessDocument;
  const minutes = {id:'doc-ata',type:'ATA',status:'AGUARDANDO_ASSINATURA',visibleToRoles:['STUDENT']} as ProcessDocument;
  const jobs = [{processId:process.id,documentType:'ATA',status:'PENDING',driveUnsignedFileId:'private-fixture-unsigned'}] as unknown as SignatureJob[];
  const forms = [{formType:'CONFIRMACAO_LOCAL',status:'PENDING',driveFileId:'private-fixture-pending',sha256:hash}];
  const base = {process,jobs,forms,documents:[invite,minutes],publicDocuments:[invite,minutes],
    presidencyDeclaration:false,master:false,roles:[],participant:false};
  const unauthorized = currentRepositoryDocuments(base);
  assert.equal(unauthorized.docTccCompleto,undefined);
  assert.equal(unauthorized.docConvite,undefined);
  assert.deepEqual(publishedRepositoryDocuments(process),{});

  const master = currentRepositoryDocuments({...base,master:true});
  assert.equal(master.docConvite,true);
  assert.equal(master.docAta,false);
  assert.equal(master.docReserva,false);
  assert.equal(master.docTccCompleto,`/api/processes/${process.id}/files/trabalho-completo/download`);
  assert.doesNotMatch(JSON.stringify(master),/private-fixture-|[a-f0-9]{64}/);
  assert.equal(repositoryDocumentStatus(master.docTccCompleto),'Presente');
  assert.equal(repositoryDocumentStatus(master.docAta),'Ausente');
  assert.equal(repositoryDocumentStatus(unauthorized.docTccCompleto),'Não exibido');
});

test('historical evaluator authority exposes only the instrument, not other private legacy files',()=>{
  const administrative = [
    {kind:'AVALIACAO',driveFileId:'fixture-evaluation'},
    {kind:'CONVITE',driveFileId:'fixture-invitation'},
    {kind:'ATA',driveFileId:'fixture-minutes'},
  ].map(file=>({...file,folderId:'fixture-private-folder',sha256:hash,fileName:'Original.pdf',visibility:'PRIVATE_ADMINISTRATIVE_DOCUMENT'}));
  const legacy = {
    id:'legado-0099',attachments:[],
    provenance:{administrativeDocuments:administrative,legacySpreadsheetEvidence:{data:'private_fixture_grade'}},
  } as unknown as LegacyAcademicRecord;
  const evaluator = legacyRepositoryDocuments(legacy,false,true);
  assert.equal(evaluator.docAvaliacao,'/api/legacy-academic-records/legado-0099/evaluation-documents/0/download');
  assert.equal(evaluator.docConvite,undefined);
  assert.equal(evaluator.docAta,'/api/public/legacy-academic-records/legado-0099/documents/2/download');
  assert.equal(legacyRepositoryDocuments(legacy,false,false).docAvaliacao,undefined);
  const master = legacyRepositoryDocuments(legacy,true,false);
  assert.equal(master.docConvite,'/api/admin/legacy-academic-records/legado-0099/documents/1/download');
  assert.equal(master.docTccCompleto,false);
  assert.doesNotMatch(JSON.stringify(master),/fixture-|private_fixture_grade|Original\.pdf/);
  assert.equal(runtimeReadProjection('GET','/repository/document-availability'),'LITE');
});

test('archived current documents point to their matching reservation and signed original routes',()=>{
  const process = structuredClone(DEMO_PROCESSES[0]);
  const start = '2026-01-01T10:00:00-03:00';
  process.defesa = {
    ...process.defesa,startAt:start,localStatus:'CONFIRMADO',reservationRevision:3,
    localConfirmedAt:'2025-12-20T10:00:00-03:00',
    departmentResponse:undefined,reservationHistory:undefined,
    invitationDriveFileId:'fixture-issued-invitation',
  };
  const documents = [
    {id:'doc-convite',type:'CONVITE',status:'DISPONIVEL',currentVersion:1,visibleToRoles:['STUDENT']},
    {id:'doc-ata',type:'ATA',status:'ASSINADO',currentVersion:2,visibleToRoles:['STUDENT']},
  ] as ProcessDocument[];
  const jobs = [{
    processId:process.id,documentType:'ATA',status:'ARCHIVED',documentVersion:2,
    driveSignedFileId:'fixture-signed-original',signedSha256:hash,
  }] as SignatureJob[];
  const actual = currentRepositoryDocuments({
    process,jobs,documents,publicDocuments:[],master:false,participant:true,roles:['STUDENT'],presidencyDeclaration:false,
    forms:[{formType:'CONFIRMACAO_LOCAL',status:'ARCHIVED',reservationRevision:3,driveFileId:'fixture-reservation',sha256:hash}],
  });
  assert.equal(actual.docReserva,`/api/processes/${process.id}/location-proof/download?receipt=revision-3`);
  assert.equal(actual.docConvite,`/api/processes/${process.id}/documents/doc-convite/download`);
  assert.equal(actual.docAta,`/api/processes/${process.id}/documents/doc-ata/download`);
  assert.equal(actual.docTermo,undefined);
  assert.doesNotMatch(JSON.stringify(actual),/fixture-reservation|fixture-signed|fixture-issued/);
});
