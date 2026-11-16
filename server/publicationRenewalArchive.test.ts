import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { beginPublicationChoice, finishPublicationRevocation } from './workflow/publicationChoice';
import { declarationReady } from './workflow/gates';
import { publicFileAuthorized } from './workflow/publicationAccess';
import { signatureDocumentRevision } from '../src/utils/documentSignatureState';

const source = readFileSync('server.ts', 'utf8');
function fn(name: string) {
  const start = source.indexOf(`async function ${name}(`);
  assert.ok(start >= 0, name);
  return source.slice(start, source.indexOf('\n}', start) + 2);
}
function harness() {
  const original: any = {
    id: 'renewal-fixture',
    protocolo: 'TCC - 99001',
    dataRevision: 7,
    status: 'CONCLUIDO',
    etapaAtual: 'CONCLUIDO',
    aluno1: { email: 'author@example.invalid' },
    orientador: { email: 'advisor@example.invalid' },
    avaliacao: { status: 'CONCLUIDO', documentRevision: 3 },
    driveFolderId: 'private-folder-fixture',
    acervo: {
      submittedAt: '2026-01-01',
      publishFullWork: false,
      trabalhoCompletoFileId: 'original-full-fixture',
      trabalhoCompletoSha256: 'a'.repeat(64),
    },
  };
  const jobs: any[] = [
    {
      id: 'ata',
      processId: original.id,
      documentType: 'ATA',
      documentVersion: 1,
      sourceDataRevision: 3,
      status: 'ARCHIVED',
      driveSignedFileId: 'ata-signed',
      signers: [
        { email: 'advisor@example.invalid', role: 'ADVISOR', status: 'SIGNED' },
        { email: 'one@example.invalid', role: 'EXAMINER', status: 'SIGNED' },
        { email: 'two@example.invalid', role: 'EXAMINER', status: 'SIGNED' },
      ],
    },
  ];
  const p = beginPublicationChoice(
    original,
    { publishFullWork: true, publishExpandedAbstract: false },
    jobs,
    'author@example.invalid',
    'request-renewal',
    '2026-11-16',
  );
  finishPublicationRevocation(p, '2026-11-16');
  const job: any = {
    id: 'new-term',
    processId: p.id,
    documentType: 'TERMO',
    documentVersion: 2,
    sourceDataRevision: 8,
    status: 'ARCHIVED',
    driveSignedFileId: 'term-signed',
    postArchivePending: true,
    signers: [],
  };
  p.acervo.publicationChange!.signatureJobId = job.id;
  jobs.push(job);
  let failDrive = false,
    persists = 0;
  const published: string[] = [],
    events: string[] = [];
  const context: any = {
    Date,
    Error,
    signatureDocumentRevision,
    processesStore: [p],
    signatureJobsStore: jobs,
    declarationReady,
    publicationRequested: (v: any) => Boolean(v.acervo.publishFullWork || v.acervo.publishExpandedAbstract),
    getGoogleWorkspaceAccessToken: async () => 'fixture-only',
    preparePublicationSource: async (input: any) => {
      if (failDrive) throw Error('Drive unavailable');
      published.push(input.sourceFileId);
      return { id: input.sourceFileId, webViewLink: 'https://drive.google.com/fixture-only' };
    },
    getUserRolesForEmail: () => ({ globalRoles: [] }),
    auditLogsStore: [],
    persistPortalStateDurably: async () => {
      persists++;
    },
    executeConfiguredWorkflowEvent: async (_: any, event: string) => {
      events.push(event);
      return { status: 'COMPLETED' };
    },
    executeAutomaticAsten: async () => assert.fail('A completed process must not issue another declaration'),
    updateProcessCompletion: () => {},
  };
  runInNewContext(
    ts.transpileModule(fn('syncAuthorizedPublication') + '\n' + fn('finishArchivedSignature'), {
      compilerOptions: { target: ts.ScriptTarget.ES2022 },
    }).outputText,
    context,
  );
  return {
    p,
    job,
    jobs,
    published,
    events,
    persists: () => persists,
    setFail: (value: boolean) => {
      failDrive = value;
    },
    finish: () => context.finishArchivedSignature(job, 'callback@fixture.invalid'),
  };
}

test('renewed signed term publishes only the authorized original and completes the pending request', async () => {
  const h = harness();
  assert.equal(publicFileAuthorized(h.p, h.jobs, 'trabalho-completo'), false);
  await h.finish();
  assert.equal(h.p.acervo.publicationChange!.status, 'COMPLETED');
  assert.equal(h.job.postArchivePending, undefined);
  assert.deepEqual(h.published, ['original-full-fixture']);
  assert.equal(publicFileAuthorized(h.p, h.jobs, 'trabalho-completo'), true);
  assert.equal(publicFileAuthorized(h.p, h.jobs, 'resumo-expandido'), false);
  assert.equal(h.p.status, 'CONCLUIDO');
  assert.deepEqual(h.events, ['SIGNATURE_COMPLETED']);
  assert.ok(h.persists() >= 2);
  await h.finish();
  assert.equal(h.published.length, 1, 'callback retry must not publish twice');
});
test('Drive failure after signature stays blocked and retries without a second signature', async () => {
  const h = harness();
  h.setFail(true);
  await h.finish();
  assert.equal(h.p.acervo.publicationChange!.status, 'AWAITING_SIGNATURE');
  assert.equal(h.job.postArchivePending, true);
  assert.equal(publicFileAuthorized(h.p, h.jobs, 'trabalho-completo'), false);
  h.setFail(false);
  await h.finish();
  assert.equal(h.p.acervo.publicationChange!.status, 'COMPLETED');
  assert.equal(h.published.length, 1);
  assert.equal(h.jobs.length, 2);
});
test('late signature callback cannot undo a newer author restriction', async () => {
  const h = harness();
  const restricted = beginPublicationChoice(
    h.p,
    { publishFullWork: false, publishExpandedAbstract: false },
    h.jobs,
    'author@example.invalid',
    'withdraw-renewal',
    '2026-11-17',
  );
  Object.assign(h.p, restricted);
  await h.finish();
  assert.equal(h.p.acervo.publicationChange!.id, 'withdraw-renewal');
  assert.equal(h.published.length, 0);
  assert.equal(publicFileAuthorized(h.p, h.jobs, 'trabalho-completo'), false);
});
