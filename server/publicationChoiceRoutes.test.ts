import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import type { Server } from 'node:http';
import { installPublicationChoiceRoutes } from './publicationChoiceRoutes';
import {
  beginPublicationChoice,
  finishPublicationRevocation,
  assertRenewedPublicationSigners,
  authorMayChangePublication,
  publicationChoiceView,
} from './workflow/publicationChoice';
import { publicFileAuthorized } from './workflow/publicationAccess';
import { signatureDocumentRevision } from '../src/utils/documentSignatureState';
import { assertDocumentSignatureOpen } from './workflow/signaturePolicy';
import type { ProcessData, SignatureJob } from '../src/types';
import { restoreChangesPublicFiles } from './workflow/publicationRestoreGuard';

function fixture(): ProcessData {
  return {
    id: 'p1',
    protocolo: 'TCC - 00001',
    dataRevision: 7,
    status: 'CONCLUIDO',
    etapaAtual: 'CONCLUIDO',
    aluno1: { nome: 'Alice', email: 'alice@example.com' },
    aluno2: { nome: 'Bob', email: 'bob@example.com' },
    orientador: { nome: 'Advisor', email: 'advisor@example.com' },
    avaliacao: { status: 'CONCLUIDO', documentRevision: 3 },
    acervo: {
      submittedAt: '2026-01-01',
      authorizationConfirmedAt: '2026-01-01',
      publishFullWork: true,
      publishExpandedAbstract: false,
      publicationState: 'PUBLIC',
      publicationSyncedAt: '2026-01-01',
      trabalhoCompletoFileId: 'full_original',
      trabalhoCompletoSha256: 'a'.repeat(64),
      publicFullWorkFileId: 'full_original',
    },
  } as ProcessData;
}
const job = (type: string, revision: number) =>
  ({
    id: type,
    processId: 'p1',
    documentType: type,
    status: 'ARCHIVED',
    sourceDataRevision: revision,
    documentVersion: 1,
    driveSignedFileId: 'signed_' + type,
    signers:
      type === 'ATA'
        ? [
            { email: 'advisor@example.com', role: 'ADVISOR', status: 'SIGNED' },
            { email: 'examiner1@example.com', role: 'EXAMINER', status: 'SIGNED' },
            { email: 'examiner2@example.com', role: 'EXAMINER', status: 'SIGNED' },
          ]
        : [],
  }) as SignatureJob;

test('a coauthor may withdraw a pending public choice and a late term remains obsolete', () => {
  const p = fixture();
  p.acervo.publishFullWork = false;
  const pending = beginPublicationChoice(
    p,
    { publishFullWork: true, publishExpandedAbstract: false },
    [],
    'alice@example.com',
    'pending-publication',
    '2026-11-16',
  );
  finishPublicationRevocation(pending, '2026-11-16');
  assert.equal(publicationChoiceView(pending, 'bob@example.com').request?.canRetry, false);
  const restricted = beginPublicationChoice(
    pending,
    { publishFullWork: false, publishExpandedAbstract: false },
    [],
    'bob@example.com',
    'author-veto',
    '2026-11-17',
  );
  assert.equal(restricted.acervo.publicationChange?.requestedBy, 'bob@example.com');
  assert.equal(restricted.dataRevision, 9);
  finishPublicationRevocation(restricted, '2026-11-17');
  assert.equal(restricted.acervo.publicationChange?.status, 'COMPLETED');
  assert.equal(publicFileAuthorized(restricted, [job('TERMO', 8)], 'trabalho-completo'), false);
  assert.throws(() =>
    beginPublicationChoice(
      pending,
      { publishFullWork: true, publishExpandedAbstract: true },
      [],
      'bob@example.com',
      'wider',
      '2026-11-17',
    ),
  );
});

test('requests require active authorship and cannot be removed through backup restoration', () => {
  const p = fixture();
  assert.equal(authorMayChangePublication(p, 'alice@example.com', true), true);
  assert.equal(authorMayChangePublication(p, 'alice@example.com', false), false);
  assert.equal(authorMayChangePublication({ ...p, legacyRecord: true }, 'alice@example.com', true), false);
  assert.equal(
    authorMayChangePublication({ ...p, status: 'AGUARDANDO_ASSINATURA' }, 'alice@example.com', true),
    false,
  );
  const next = beginPublicationChoice(
    p,
    { publishFullWork: false, publishExpandedAbstract: false },
    [],
    'alice@example.com',
    'request-backup',
    '2026-11-16',
  );
  const before = { processes: [next], jobs: [], legacy: [] };
  assert.equal(restoreChangesPublicFiles(before, structuredClone(before)), false);
  assert.equal(restoreChangesPublicFiles(before, { ...before, processes: [p] }), true);
  const view = JSON.stringify(publicationChoiceView(next, 'alice@example.com'));
  assert.ok(!view.includes('full_original'));
  assert.ok(!view.includes('alice@example.com'));
});

test('consent change blocks publication immediately and freezes only the completed declaration revision', () => {
  const p = fixture(),
    jobs = [job('ATA', 3), job('TERMO', 7), job('DECLARACAO', 7)];
  assert.equal(publicFileAuthorized(p, jobs, 'trabalho-completo'), true);
  const next = beginPublicationChoice(
    p,
    { publishFullWork: false, publishExpandedAbstract: false },
    jobs,
    'alice@example.com',
    'request-1',
    '2026-11-16',
  );
  assert.equal(publicFileAuthorized(next, jobs, 'trabalho-completo'), false);
  assert.equal(p.acervo!.publishFullWork, true);
  assert.equal(signatureDocumentRevision(next, 'ATA'), 3);
  assert.equal(signatureDocumentRevision(next, 'DECLARACAO'), 7);
  assert.equal(signatureDocumentRevision(next, 'TERMO'), 8);
  assert.ok(next.acervo!.publicationChange!.revokeFileIds.includes('signed_TERMO'));
  assert.equal(jobs[1].status, 'ARCHIVED', 'signed evidence is not erased');
  finishPublicationRevocation(next, '2026-11-16');
  assert.equal(next.acervo!.publicationChange!.status, 'COMPLETED');
  assert.equal(next.acervo!.publicationState, 'WITHDRAWN');
});
test('a new public choice requires a new term and never reuses the completed old one', () => {
  const p = fixture();
  p.acervo!.publishFullWork = false;
  p.acervo!.publicationState = 'WITHDRAWN';
  const next = beginPublicationChoice(
    p,
    { publishFullWork: true, publishExpandedAbstract: false },
    [job('TERMO', 7)],
    'bob@example.com',
    'request-2',
    '2026-11-16',
  );
  finishPublicationRevocation(next, '2026-11-16');
  assert.equal(next.acervo!.publicationChange!.status, 'AWAITING_SIGNATURE');
  assert.equal(publicFileAuthorized(next, [job('ATA', 3), job('TERMO', 7)], 'trabalho-completo'), false);
  assert.doesNotThrow(() => assertDocumentSignatureOpen(next, 'TERMO', [job('TERMO', 7)]));
  assert.throws(() => assertDocumentSignatureOpen(next, 'ATA', []));
  assert.throws(
    () => assertRenewedPublicationSigners(next, { signers: [{ email: 'alice@example.com' }] as any }),
    /todos os autores/,
  );
  assert.doesNotThrow(() =>
    assertRenewedPublicationSigners(next, {
      signers: ['alice@example.com', 'bob@example.com', 'advisor@example.com'].map((email) => ({
        email,
      })) as any,
    }),
  );
});
test('publication choice routes reject impersonation, stale input and preserve a pending Drive failure for retry', async (t) => {
  let p = fixture(),
    revocations = 0,
    failDrive = true,
    terms = 0,
    persists = 0,
    audits = 0,
    accessible = true;
  const app = express();
  app.use(express.json());
  installPublicationChoiceRoutes(app, {
    authenticate: (_req, _res, next) => next(),
    email: (req) => req.get('x-fixture-email'),
    process: (id) => (id === p.id ? p : undefined),
    access: () => accessible,
    replace: (next) => {
      p = next;
    },
    jobs: () => [job('TERMO', 7)],
    audit: () => {
      audits++;
    },
    persist: async () => {
      persists++;
    },
    revoke: async () => {
      revocations++;
      if (failDrive) throw Error('Drive unavailable');
    },
    destroyPreviousTerms: async () => {},
    term: async () => {
      terms++;
    },
  });
  const server: Server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  t.after(() => new Promise<void>((resolve, reject) => server.close((e) => (e ? reject(e) : resolve()))));
  const address = server.address();
  if (!address || typeof address === 'string') throw Error('address');
  const url = `http://127.0.0.1:${address.port}/api/processes/p1/publication-choice`;
  const request = (email: string | undefined, body?: any) =>
    fetch(url, {
      method: body ? 'POST' : 'GET',
      headers: { ...(email ? { 'x-fixture-email': email } : {}), 'Content-Type': 'application/json' },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  assert.equal((await request(undefined)).status, 401);
  assert.equal((await request('stranger@example.com')).status, 404);
  assert.equal((await request('advisor@example.com')).status, 404);
  accessible = false;
  assert.equal((await request('alice@example.com')).status, 404);
  accessible = true;
  assert.equal((await request('alice@example.com', { expectedRevision: 1, confirmed: true })).status, 409);
  const body = {
    expectedRevision: 7,
    confirmed: true,
    publishFullWork: false,
    publishExpandedAbstract: false,
  };
  const first = await request('alice@example.com', body);
  assert.equal(first.status, 202);
  const pending = await first.json();
  assert.equal(pending.request.status, 'REVOKING_DRIVE');
  assert.equal(p.acervo!.publicationState, 'WITHDRAWN');
  assert.equal(terms, 0);
  assert.equal(audits, 1);
  failDrive = false;
  const retry = await request('alice@example.com', {
    ...body,
    expectedRevision: 8,
    requestId: pending.request.id,
  });
  assert.equal(retry.status, 200);
  assert.equal((await retry.json()).request.status, 'COMPLETED');
  assert.equal(audits, 1);
  assert.equal(revocations, 2);
  assert.ok(persists >= 3);
  assert.equal(terms, 0);
  assert.equal((await request('alice@example.com', body)).status, 409);
});

test('Master can prepare replacement for a legacy; an ordinary author cannot, and the new term stays separate', async t=>{
 let p=fixture();p.id='legado-0997';p.legacyRecord=true;
 let revocations=0,terms=0;
 const app=express();app.use(express.json());
 installPublicationChoiceRoutes(app,{authenticate:(_req,_res,next)=>next(),email:req=>req.get('x-fixture-email'),master:email=>email==='master@example.invalid',process:id=>id===p.id?p:undefined,access:()=>true,replace:next=>{p=next;},jobs:()=>[],audit:()=>{},persist:async()=>{},revoke:async()=>{revocations++;},destroyPreviousTerms:async()=>{},term:async()=>{terms++;}});
 const server:Server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});t.after(()=>new Promise<void>((resolve,reject)=>server.close(e=>e?reject(e):resolve())));const address=server.address();if(!address||typeof address==='string')throw Error('address');const root=`http://127.0.0.1:${address.port}/api/processes/${p.id}/publication-choice`;
 const request=(email:string,body:any,path='')=>fetch(root+path,{method:'POST',headers:{'x-fixture-email':email,'Content-Type':'application/json'},body:JSON.stringify(body)});
 assert.equal((await request('alice@example.com',{expectedRevision:7},'/edit')).status,404);
 assert.equal((await request('master@example.invalid',{expectedRevision:6},'/edit')).status,409);
 const prepared=await request('master@example.invalid',{expectedRevision:7},'/edit');assert.equal(prepared.status,200);assert.equal((await prepared.json()).request.status,'EDITING');assert.equal(revocations,1);assert.equal(terms,0);
 assert.equal((await request('master@example.invalid',{expectedRevision:8},'/edit')).status,200);assert.equal(revocations,1,'repeating preparation must be idempotent');
 const saved=await request('master@example.invalid',{expectedRevision:8,confirmed:true,publishFullWork:false,publishExpandedAbstract:false});assert.equal(saved.status,200);assert.equal((await saved.json()).request.status,'COMPLETED');assert.equal(terms,0,'restriction does not issue an empty term');
});
