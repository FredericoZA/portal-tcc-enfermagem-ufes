import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import express from 'express';
import type { Server } from 'node:http';
import type { LegacyAcademicRecord } from '../src/types/legacyArchive';
import { legacyEvaluationParticipantRole } from './legacyPrivateAccess';
import { installLegacyEvaluationDocumentRoutes } from './legacyEvaluationDocumentRoutes';

const pdf = Buffer.from('%PDF-1.4\nverified private evaluation\n%%EOF');
function fixture(): LegacyAcademicRecord {
  const file = { driveFileId: 'private_evaluation_12345', fileName: 'instrumento.pdf', folderId: 'private_folder_12345',
    sha256: createHash('sha256').update(pdf).digest('hex'), visibility: 'PRIVATE_ADMINISTRATIVE_DOCUMENT' };
  return { id: 'legado-0001', protocolo: '001 - Legado', sourceFingerprint: 'a'.repeat(64),
    titulo: 'Trabalho histórico', autores: ['Álice da Silva'], orientador: 'Carolina Santos',
    coorientador: '', coorientadorInstituicao: '', examinadores: [], resumo: '', palavrasChave: [],
    dataDefesa: '2025-08-28', horaDefesa: '', localDefesa: 'Sala', attachments: [],
    isPublic: false, publishFullWork: false, publishExpandedAbstract: false,
    publicationState: 'NOT_REQUESTED', authorizationDecision: 'DENIED',
    provenance: {
      verifiedPublicationParticipants: { authors: [{ nome: 'Álice da Silva', email: 'alice@example.invalid' }],
        advisor: { nome: 'Carolina Santos', email: 'advisor@example.invalid' }, verifiedBy: 'master@example.invalid' },
      administrativeDocuments: [
        { ...file, driveFileId: 'public_ata_123456789', fileName: 'ata.pdf', kind: 'ATA' },
        { ...file, kind: 'AVALIACAO' },
        { ...file, driveFileId: 'private_invitation_12345', fileName: 'convite.pdf', kind: 'CONVITE' },
      ],
    } };
}
async function harness(t: { after: (fn: () => Promise<void>) => void }) {
  const app = express(), state = { record: fixture() as LegacyAcademicRecord | undefined,
    revoked: false, reads: 0, deliveries: 0, linkReads:0, read: async () => pdf,
    links:async()=>({view:'https://drive.google.com/file/d/private_evaluation_12345/view',download:'https://drive.usercontent.google.com/download?id=private_evaluation_12345'}) as {view:string;download:string}|null };
  const email = (req: express.Request) => req.get('x-test-identity');
  const trusted = (value: string) => value === 'master@example.invalid';
  installLegacyEvaluationDocumentRoutes(app, {
    authenticate: (req, res, next) => email(req) ? next() : res.status(401).json({ error: 'Login necessário' }),
    email, record: id => state.record?.id === id ? state.record : undefined,
    canRead: (record, actor) => actor === 'master@example.invalid' || Boolean(legacyEvaluationParticipantRole(record, actor,
      { isTrustedVerifier: trusted, isAccessRevoked: () => state.revoked })),
    read: async () => { state.reads++; return state.read(); },
    links:async(file,record,actor)=>{assert.equal(file.kind,'AVALIACAO');assert.equal(record.id,'legado-0001');assert.ok(['alice@example.invalid','advisor@example.invalid','master@example.invalid'].includes(actor));state.linkReads++;return state.links();},
    deliver: async (_req, res, _record, _index, file, bytes) => {
      state.deliveries++; res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${file.fileName}"`); res.send(bytes);
    },
  });
  const server = await new Promise<Server>(resolve => { const server = app.listen(0, '127.0.0.1', () => resolve(server)); });
  t.after(() => new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())));
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  const get = (path: string, actor = '') => fetch(base + path, { headers: actor ? { 'x-test-identity': actor } : {} });
  return { state, get, listing: '/api/legacy-academic-records/legado-0001/evaluation-documents' };
}

test('authenticated historical readers list only evaluation references; visitor and unrelated roles learn nothing', async t => {
  const { state, get, listing } = await harness(t);
  assert.equal((await get(listing)).status, 401);
  for (const actor of ['examiner@example.invalid', 'president@example.invalid', 'other-author@example.invalid']) {
    assert.equal((await get(listing, actor)).status, 404);
  }
  for (const actor of ['alice@example.invalid', 'advisor@example.invalid', 'master@example.invalid']) {
    const response = await get(listing, actor); assert.equal(response.status, 200);
    assert.match(response.headers.get('cache-control')!, /private.*no-store/);
    const body = await response.json(); assert.deepEqual(body, [{ index: 1, kind: 'AVALIACAO', fileName: 'instrumento.pdf',
      downloadUrl: listing + '/1/download' }]);
    assert.doesNotMatch(JSON.stringify(body), /private_(evaluation|folder|invitation)|alice@|advisor@|verifiedBy|ata\.pdf/);
  }
  assert.equal(state.reads, 0);
});
test('a private evaluation download checks role, file type, index, hash and private cache headers', async t => {
  const { state, get, listing } = await harness(t);
  for (const index of ['0', '2', '-1', '01', '100', '1e0', 'missing']) {
    assert.equal((await get(listing + '/' + index + '/download', 'alice@example.invalid')).status, 404);
  }
  assert.equal((await get(listing.replace('legado-0001', 'legado-0002') + '/1/download', 'alice@example.invalid')).status, 404);
  assert.equal((await get(listing + '/1/download')).status, 401);
  assert.equal((await get(listing + '/1/download', 'examiner@example.invalid')).status, 404);
  assert.equal(state.reads, 0);
  for (const actor of ['alice@example.invalid', 'advisor@example.invalid', 'master@example.invalid']) {
    const response = await get(listing + '/1/download', actor); assert.equal(response.status, 200);
    assert.match(response.headers.get('cache-control')!, /private.*no-store/);
    assert.deepEqual(Buffer.from(await response.arrayBuffer()), pdf);
  }
  assert.equal(state.reads, 3); assert.equal(state.deliveries, 3);
  state.read = async () => Buffer.from('%PDF-changed');
  assert.equal((await get(listing + '/1/download', 'alice@example.invalid')).status, 409);
  assert.equal(state.deliveries, 3);
});
test('participant revocation during storage I/O prevents delivery', async t => {
  const { state, get, listing } = await harness(t);
  state.read = async () => { state.revoked = true; return pdf; };
  assert.equal((await get(listing + '/1/download', 'alice@example.invalid')).status, 404);
  assert.equal(state.reads, 1); assert.equal(state.deliveries, 0);
  assert.equal((await get(listing, 'alice@example.invalid')).status, 404);
});
test('Drive evaluation view resolves only the authorized original without PDF transfer or permission enrollment',async t=>{
  const {state,get,listing}=await harness(t),route=listing+'/1/download?delivery=drive-links';
  assert.equal((await get(route)).status,401);
  assert.equal((await get(route,'examiner@example.invalid')).status,404);
  assert.equal((await get(route.replace('/1/','/0/'),'alice@example.invalid')).status,404);
  assert.equal(state.linkReads,0);
  const response=await get(route,'alice@example.invalid');assert.equal(response.status,200);
  assert.match(response.headers.get('cache-control')!,/private.*no-store/);
  assert.deepEqual(await response.json(),{links:await state.links()});assert.equal(state.linkReads,1);
  assert.equal(state.reads,0);assert.equal(state.deliveries,0);
  state.links=async()=>null;
  assert.deepEqual(await (await get(route,'advisor@example.invalid')).json(),{links:null});
  state.links=async()=>{throw Object.assign(Error('authorization expired'),{code:'GOOGLE_REAUTHORIZATION_REQUIRED'});};
  assert.equal((await get(route,'advisor@example.invalid')).status,409,'a failed document reference is not presented as a successful Drive view');
  state.links=async()=>{state.revoked=true;return null;};
  assert.equal((await get(route,'alice@example.invalid')).status,404,'revocation during Drive metadata lookup wins');
  assert.equal(state.reads,0);
});
test('replacement or removal during storage I/O prevents stale evaluation delivery', async t => {
  for (const mode of ['replacement', 'removal']) {
    const { state, get, listing } = await harness(t);
    state.read = async () => {
      if (mode === 'replacement') (state.record!.provenance.administrativeDocuments as any[])[1].driveFileId = 'another_private_id_12345';
      else state.record = undefined;
      return pdf;
    };
    assert.equal((await get(listing + '/1/download', 'advisor@example.invalid')).status, 404);
    assert.equal(state.deliveries, 0);
  }
});
