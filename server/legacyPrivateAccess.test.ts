import test from 'node:test';
import assert from 'node:assert/strict';
import { legacyEvaluationParticipantRole, verifiedLegacyParticipants } from './legacyPrivateAccess';

const trusted = (email: string) => email === 'master@example.invalid';
const fixture = () => ({
  id: 'legado-0001', autores: ['Álice da Silva', 'Bruno Souza'], orientador: 'Carolina Santos',
  provenance: { verifiedPublicationParticipants: {
    authors: [{ nome: 'Álice da Silva', email: 'alice@example.invalid' }, { nome: 'Bruno Souza', email: 'bruno@example.invalid' }],
    advisor: { nome: 'Carolina Santos', email: 'advisor@example.invalid' }, verifiedBy: 'master@example.invalid',
  } } as Record<string, unknown>,
});
const role = (record: ReturnType<typeof fixture>, email: string) => legacyEvaluationParticipantRole(record, email, { isTrustedVerifier: trusted });

test('legacy evaluation readers require an explicit verified binding and never use raw or saved-process contacts', () => {
  const r = fixture();
  delete r.provenance.verifiedPublicationParticipants;
  r.provenance.submission = { email: 'alice@example.invalid' };
  r.provenance.publicationProcess = { aluno1: { nome: 'Álice da Silva', email: 'alice@example.invalid' } };
  assert.equal(role(r, 'alice@example.invalid'), undefined);
  assert.equal(verifiedLegacyParticipants(r, trusted), undefined);
});
test('only verified authors and advisor receive a historical read role', () => {
  const r = fixture();
  assert.equal(role(r, ' ALICE@EXAMPLE.INVALID '), 'STUDENT');
  assert.equal(role(r, 'bruno@example.invalid'), 'STUDENT');
  assert.equal(role(r, 'advisor@example.invalid'), 'ADVISOR');
  for (const email of ['', 'examiner@example.invalid', 'president@example.invalid', 'elsewhere@example.invalid']) {
    assert.equal(role(r, email), undefined);
  }
});
test('email verification alone cannot attach a different or similar historical person', () => {
  const changes = [
    (r: ReturnType<typeof fixture>) => { r.autores[0] = 'Alice da Silva'; },
    (r: ReturnType<typeof fixture>) => { r.autores[0] = 'Álice Silva'; },
    (r: ReturnType<typeof fixture>) => { r.orientador = 'Outra Carolina Santos'; },
    (r: ReturnType<typeof fixture>) => { r.autores.push('Nova Autora'); },
  ];
  for (const mutate of changes) { const r = fixture(); mutate(r); assert.equal(role(r, 'alice@example.invalid'), undefined); }
  const r = fixture(); r.autores[0] = '  ÁLICE  DA SILVA  ';
  assert.equal(role(r, 'alice@example.invalid'), 'STUDENT');
});
test('malformed, duplicate or untrusted contact proof fails closed for every participant', () => {
  const changes = [
    (c: any) => { c.verifiedBy = 'not-an-email'; },
    (c: any) => { c.verifiedBy = 'examiner@example.invalid'; },
    (c: any) => { c.verifiedBy = ''; },
    (c: any) => { c.advisor.email = 'alice@example.invalid'; },
    (c: any) => { c.authors[1].email = 'ALICE@example.invalid'; },
    (c: any) => { c.authors[0].email = 'alice@example.invalid,other@example.invalid'; },
    (c: any) => { c.authors[0].email = 'alice@example.invalid\r\nBcc:x@example.invalid'; },
    (c: any) => { c.authors = [c.authors[0]]; },
    (c: any) => { delete c.advisor; },
  ];
  for (const mutate of changes) {
    const r = fixture(); mutate(r.provenance.verifiedPublicationParticipants);
    assert.equal(role(r, 'alice@example.invalid'), undefined); assert.equal(role(r, 'advisor@example.invalid'), undefined);
  }
});
test('explicit revocation wins over verified historical contacts without reviving other roles', () => {
  const r = fixture(), policy = { isTrustedVerifier: trusted,
    isAccessRevoked: (email: string, id: string) => email === 'alice@example.invalid' && id === r.id };
  assert.equal(legacyEvaluationParticipantRole(r, 'alice@example.invalid', policy), undefined);
  assert.equal(legacyEvaluationParticipantRole(r, 'advisor@example.invalid', policy), 'ADVISOR');
});
