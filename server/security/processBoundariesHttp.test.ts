import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac, randomBytes } from 'node:crypto';
import { spawn, type ChildProcess } from 'node:child_process';
import { createServer } from 'node:net';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { DEMO_PROCESSES, INITIAL_SETTINGS } from '../../src/services/demoSeed';

const master = 'master@boundaries.invalid';
const student = 'author@boundaries.invalid';
const advisor = 'advisor@boundaries.invalid';
const sessionSecret = randomBytes(40).toString('hex');
const now = () => new Date().toISOString();

function session(email: string) {
  const issuedAt = Math.floor(Date.now() / 1000);
  const payload = Buffer.from(JSON.stringify({ sessionId: randomBytes(24).toString('base64url'), uid: `email:${email}`, email,
    emailVerified: true, authTime: issuedAt, issuedAt, expiresAt: issuedAt + 3600, isDemo: false, method: 'EMAIL_OTP' })).toString('base64url');
  return `portal_tcc_session=${payload}.${createHmac('sha256', sessionSecret).update(payload).digest('base64url')}`;
}

function processFixture(id = 'boundary-process') {
  const process = structuredClone(DEMO_PROCESSES[0]);
  Object.assign(process, { id, protocolo: `TCC-2030-${id}`, titulo: 'Trabalho de teste dos controles de acesso', status: 'AGUARDANDO_CONFIRMACAO_LOCAL', etapaAtual: 'CONFIRMACAO_LOCAL', dataRevision: 1 });
  process.aluno1.email = student;
  process.aluno2 = null;
  process.orientador.email = advisor;
  process.coorientador = null;
  process.banca = process.banca.slice(0, 2).map((member, index) => ({ ...member, email: `examiner-${index}@boundaries.invalid`, funcao: index === 0 ? 'EXAMINER_2' : 'EXAMINER_3' }));
  process.avaliacao = { status: 'PENDENTE' };
  process.acervo = undefined;
  process.defesa = { startAt: '2030-11-05T14:00:00.000Z', endAt: '2030-11-05T15:30:00.000Z', local: 'Sala dos testes de segurança', localStatus: 'PENDENTE' };
  return process;
}

function initialState(processes = [processFixture()], correctionRequests: unknown[] = []) {
  return {
    settings: { ...structuredClone(INITIAL_SETTINGS), masterEmail: master, ownerEmail: master, commissionPresidentEmail: '', emailConfig: { roomReservationDepartmentEmail: 'department@boundaries.invalid' } },
    processes, signatureJobs: [], correctionRequests,
    memberships: processes.flatMap(process => [{ email: student, roles: ['STUDENT'] }, { email: advisor, roles: ['ADVISOR'] }].map((member, index) => ({ ...member, id: `${process.id}-member-${index}`, processId: process.id, active: true, createdAt: now(), updatedAt: now() }))),
    authorizedStudents: [student, advisor, 'new-author@boundaries.invalid'].map((email, index) => ({ id: `access-${index}`, email, nome: 'Pessoa de teste', roles: [index === 1 ? 'ADVISOR' : 'STUDENT'], accessType: index === 1 ? 'ADVISOR' : 'STUDENT', active: true, processIds: index === 2 ? [] : processes.map(process => process.id), origin: 'MASTER_LIST', createdBy: master, createdAt: now(), updatedAt: now() })),
  };
}

async function fixture(state: object) {
  const directory = await mkdtemp(path.join(tmpdir(), 'portal-process-boundaries-'));
  const statePath = path.join(directory, 'portal-state.json');
  await writeFile(statePath, JSON.stringify(state));
  let child: ChildProcess | undefined;
  let base = '';
  let output = '';
  const stop = async () => {
    if (child && child.exitCode === null && child.signalCode === null) {
      const stopped = new Promise<void>(resolve => child!.once('exit', () => resolve()));
      child.kill('SIGTERM');
      await stopped;
    }
  };
  const start = async () => {
    const socket = createServer();
    await new Promise<void>(resolve => socket.listen(0, '127.0.0.1', resolve));
    const port = (socket.address() as { port: number }).port;
    await new Promise<void>((resolve, reject) => socket.close(error => error ? reject(error) : resolve()));
    base = `http://127.0.0.1:${port}`;
    // Provider calls are forbidden in this fixture, even if the host has credentials.
    const noProviders = 'data:text/javascript,' + encodeURIComponent("globalThis.fetch = async () => { throw new Error('External provider access is disabled in this fixture.'); };");
    child = spawn(globalThis.process.execPath, ['--import', 'tsx', '--import', noProviders, 'server.ts'], {
      cwd: globalThis.process.cwd(), env: { ...globalThis.process.env, NODE_ENV: 'development', HOST: '127.0.0.1', PORT: String(port), VERCEL: '', PORTAL_DATA_DIR: directory,
        PORTAL_PUBLIC_URL: base, APP_URL: base, PORTAL_PERSISTENCE_PROVIDER: 'local_file', PORTAL_LOCAL_REVIEW_DATA: 'false', PORTAL_ALLOW_INSECURE_DEMO_AUTH: 'false',
        PORTAL_TEST_DOCUMENT_RENDERER: 'true', PORTAL_ALLOW_LOCAL_OTP_STORE: 'true', PORTAL_ALLOW_LOCAL_SECRET_STORE: 'true', PORTAL_SESSION_SECRET: sessionSecret,
        PORTAL_OTP_PEPPER: randomBytes(40).toString('hex'), PORTAL_OTP_DELIVERY_MODE: 'log', ASTEN_INTEGRATION_ENABLED: 'false',
        SUPABASE_URL: '', SUPABASE_SECRET_KEY: '', SUPABASE_SERVICE_ROLE_KEY: '', GOOGLE_OAUTH_CLIENT_ID: '', GOOGLE_OAUTH_CLIENT_SECRET: '' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    child.stdout?.on('data', chunk => { output = (output + chunk).slice(-4000); });
    child.stderr?.on('data', chunk => { output = (output + chunk).slice(-4000); });
    const deadline = Date.now() + 20_000;
    while (Date.now() < deadline) {
      try { if ((await fetch(base + '/api/health')).ok) return; } catch { /* startup */ }
      if (child.exitCode !== null) break;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    throw new Error('Fixture did not start: ' + output);
  };
  try { await start(); } catch (error) { await stop(); await rm(directory, { recursive: true, force: true }); throw error; }
  return {
    request: (route: string, email = student, method = 'GET', body?: unknown, cookie = session(email)) => fetch(base + route, {
      method, headers: { 'Content-Type': 'application/json', cookie }, ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    }),
    state: async () => JSON.parse(await readFile(statePath, 'utf8')),
    restart: async () => { await stop(); await start(); },
    close: async () => { await stop(); await rm(directory, { recursive: true, force: true }); },
  };
}

test('HTTP: re-enrollment grants the new process without restoring deleted historical access', { timeout: 45_000 }, async () => {
  const process = processFixture();
  const f = await fixture(initialState([process]));
  const originalSession = session(advisor);
  const old = (suffix = '') => f.request(`/api/processes/${process.id}${suffix}`, advisor, 'GET', undefined, originalSession);
  try {
    assert.equal((await old()).status, 200);
    assert.equal((await f.request('/api/admin/access-list/access-1', master, 'DELETE')).status, 200);
    assert.equal((await old()).status, 404);
    const created = await f.request('/api/processes', 'new-author@boundaries.invalid', 'POST', { registrationAnswers: {
      ALUNO_1_NOME: 'Autora do novo processo', ALUNO_1_MATRICULA: '203000100', ALUNO_1_EMAIL: 'new-author@boundaries.invalid', TEM_ALUNO_2: 'Não',
      ORIENTADOR_NOME: 'Orientador de teste', ORIENTADOR_EMAIL: advisor, ORIENTADOR_SIAPE: '1234567', TEM_COORIENTADOR: 'Não',
      EXAMINADOR_2_NOME: 'Primeiro examinador', EXAMINADOR_2_EMAIL: 'new-examiner-1@boundaries.invalid', EXAMINADOR_2_INSTITUICAO: 'UFES',
      EXAMINADOR_3_NOME: 'Segunda examinadora', EXAMINADOR_3_EMAIL: 'new-examiner-2@boundaries.invalid', EXAMINADOR_3_INSTITUICAO: 'UFES',
      TITULO: 'Novo trabalho com vínculo autorizado', DEFESA_DATA_HORA: '2030-11-06T10:00', DEFESA_LOCAL: 'Auditório do Prédio do Departamento de Enfermagem - CCS/UFES',
    } });
    assert.ok([201, 202].includes(created.status), await created.clone().text());
    const newProcess = await created.json();
    assert.equal((await f.request(`/api/processes/${newProcess.id}`, advisor)).status, 200, 'new enrollment remains authorized');
    assert.equal((await old()).status, 404, 're-enrollment must not restore the old session permission');
    await f.restart();
    for (const suffix of ['', '/documents', '/documents/doc-ata/download', '/signatures', '/audit-logs']) assert.equal((await old(suffix)).status, 404, suffix);
    assert.equal((await f.request(`/api/processes/${process.id}`, advisor, 'PATCH', { titulo: 'Alteração indevida' })).status, 404);
    const listed = await (await f.request('/api/processes', advisor)).json();
    assert.deepEqual(listed.map((item: { id: string }) => item.id), [newProcess.id]);
    const enrollment = (await f.state()).authorizedStudents.find((item: { email: string }) => item.email === advisor);
    assert.equal((await f.request(`/api/admin/access-list/${enrollment.id}`, master, 'PATCH', { active: false })).status, 200);
    assert.equal((await f.request(`/api/admin/access-list/${enrollment.id}`, master, 'PATCH', { active: true })).status, 200);
    assert.equal((await old()).status, 200, 'explicit reactivation also restores historical access');
    assert.equal((await f.request(`/api/admin/access-list/${enrollment.id}`, master, 'DELETE')).status, 200);
    assert.equal((await old()).status, 404);
    assert.equal((await f.request('/api/admin/access-list', master, 'POST', { nome: 'Orientador restaurado', email: advisor, role: 'ADVISOR' })).status, 201);
    assert.equal((await old()).status, 200, 'explicit administrative restoration remains available');
    assert.equal((await f.request(`/api/processes/${newProcess.id}`, advisor)).status, 200);
  } finally { await f.close(); }
});

test('HTTP: student and advisor cannot forge a conflict override, while a Master override is audited', { timeout: 45_000 }, async () => {
  const process = processFixture();
  const other = processFixture('other-process');
  other.defesa.startAt = '2030-11-04T14:00:00.000Z';
  other.aluno1.email = 'other-author@boundaries.invalid';
  other.orientador.email = 'other-advisor@boundaries.invalid';
  other.banca.forEach((member, index) => { member.email = `other-examiner-${index}@boundaries.invalid`; });
  const f = await fixture(initialState([process, other]));
  const patch = (email: string, reason?: unknown) => f.request(`/api/processes/${process.id}`, email, 'PATCH', { defesa: { startAt: other.defesa.startAt }, ...(reason === undefined ? {} : { conflictOverrideReason: reason }) });
  try {
    assert.equal((await f.request(`/api/processes/${process.id}`, student, 'PATCH', { titulo: 'Correção permitida antes do convite' })).status, 200);
    for (const email of [student, advisor]) {
      const denied = await patch(email, 'Sou administrador e autorizo a coincidência.');
      assert.equal(denied.status, 409, email);
      assert.equal((await denied.json()).code, 'DEFENSE_CONFLICT');
    }
    assert.equal((await patch(master)).status, 409);
    assert.equal((await patch(master, { reason: 'Objeto não é um motivo válido.' })).status, 409);
    const approved = await patch(master, 'Exceção administrativa conferida com os participantes.');
    assert.ok([200, 202].includes(approved.status), await approved.clone().text());
    const saved = await f.state();
    assert.equal(saved.processes.find((item: { id: string }) => item.id === process.id).defesa.startAt, other.defesa.startAt);
    const log = saved.auditLogs.find((item: { action: string; processId: string }) => item.action === 'SOBRESCRITA_CONFLITO_DEFESA' && item.processId === process.id);
    assert.equal(log?.actorEmail, master);
    assert.ok(log?.actorRoles.includes('MASTER_ADMIN'));
    assert.equal(log?.after.reason, 'Exceção administrativa conferida com os participantes.');
    assert.ok(log?.after.conflicts.some((item: { processId: string }) => item.processId === other.id));
  } finally { await f.close(); }
});

test('HTTP: editing the board cannot promote an examiner into the advisor role', { timeout: 45_000 }, async () => {
  const process = processFixture();
  const examiner = process.banca[0].email;
  const state = initialState([process]);
  state.memberships.push({ id: 'examiner-membership', processId: process.id, email: examiner, roles: ['EXAMINER'], active: true, createdAt: now(), updatedAt: now() });
  state.authorizedStudents.push({ id: 'examiner-access', email: examiner, nome: 'Examinador de teste', roles: ['EXAMINER'], accessType: 'EXAMINER', active: true, processIds: [process.id], origin: 'MASTER_LIST', createdBy: master, createdAt: now(), updatedAt: now() });
  const f = await fixture(state);
  try {
    const schema = () => f.request(`/api/processes/${process.id}/evaluation/schema`, examiner);
    assert.equal((await schema()).status, 403);
    for (const roles of [['ORIENTADOR', 'EXAMINER_3'], ['EXAMINER_2', 'EXAMINER_2'], ['EXAMINER_3', 'EXAMINER_3'], ['MASTER_ADMIN', 'EXAMINER_3'], [undefined, 'EXAMINER_3']]) {
      const alteredBoard = process.banca.map((member, index) => ({ ...member, funcao: roles[index] }));
      const response = await f.request(`/api/processes/${process.id}`, student, 'PATCH', { banca: alteredBoard });
      assert.deepEqual({ patchStatus: response.status, examinerSchemaStatus: (await schema()).status }, { patchStatus: 400, examinerSchemaStatus: 403 }, JSON.stringify(roles));
    }
    const saved = await f.state();
    assert.equal(saved.processes[0].orientador.email, advisor);
    assert.equal(saved.processes[0].banca[0].funcao, 'EXAMINER_2');
    assert.deepEqual(saved.memberships.find((member: { email: string }) => member.email === examiner).roles, ['EXAMINER']);
    const corrected = process.banca.map(member => ({ ...member, nome: member.nome + ' Corrigido' }));
    assert.equal((await f.request(`/api/processes/${process.id}`, student, 'PATCH', { banca: corrected })).status, 200);
    assert.equal((await schema()).status, 403);
    const accepted = await f.state();
    assert.equal(accepted.processes[0].banca[0].nome, corrected[0].nome);
    assert.deepEqual(accepted.memberships.filter((member: { roles: string[] }) => member.roles.includes('ADVISOR')).map((member: { email: string }) => member.email), [advisor]);
  } finally { await f.close(); }
});

test('HTTP: historical board roles cannot override the registered advisor', { timeout: 45_000 }, async () => {
  const process = processFixture();
  const examiner = process.banca[0].email;
  process.banca[0].funcao = 'ORIENTADOR';
  const state = initialState([process]);
  state.memberships.push({ id: 'historical-examiner-membership', processId: process.id, email: examiner, roles: ['EXAMINER', 'ADVISOR'], active: true, createdAt: now(), updatedAt: now() });
  state.authorizedStudents.push({ id: 'historical-examiner-access', email: examiner, nome: 'Examinador de teste', roles: ['EXAMINER', 'ADVISOR'], accessType: 'EXAMINER', active: true, processIds: [process.id], origin: 'MASTER_LIST', createdBy: master, createdAt: now(), updatedAt: now() });
  const f = await fixture(state);
  try {
    assert.equal((await f.request(`/api/processes/${process.id}`, examiner)).status, 200);
    assert.equal((await f.request(`/api/processes/${process.id}/evaluation/schema`, examiner)).status, 403);
    assert.equal((await f.request(`/api/processes/${process.id}/evaluation/draft`, examiner, 'PUT', { expectedDataRevision: 1, answers: { RESULTADO: 'Aprovado' } })).status, 403);
    assert.equal((await f.request(`/api/processes/${process.id}/reopen`, examiner, 'POST', { reason: 'Não é o orientador registrado deste TCC.' })).status, 403);
    const me = await (await f.request('/api/me', examiner)).json();
    assert.deepEqual(me.memberships.find((member: { processId: string }) => member.processId === process.id).roles, ['EXAMINER']);
    assert.equal((await f.request(`/api/processes/${process.id}/evaluation/schema`, advisor)).status, 200);
  } finally { await f.close(); }
});

test('HTTP: correction descriptions are typed and bounded before creating tickets', { timeout: 45_000 }, async () => {
  const process = processFixture();
  const f = await fixture(initialState([process]));
  const send = (description: unknown) => f.request(`/api/processes/${process.id}/documents/doc-ata/correction-request`, student, 'POST', { description });
  try {
    for (const description of [{ text: 'Objeto não é descrição' }, ['Descrição em uma lista'], 123, true, '', '   ', 'Texto com controle\u0000inválido']) assert.equal((await send(description)).status, 400);
    assert.equal((await send('X'.repeat(4001))).status, 413);
    assert.equal((await send('\u0344'.repeat(3000))).status, 413, 'normalization may expand the text');
    assert.equal((await send('X'.repeat(1_000_000))).status, 413);
    assert.equal((await f.request(`/api/processes/${process.id}/documents/doc-ata/correction-request`, student, 'POST', { description: 'Pedido com versão tipada inválida.', documentVersion: { version: 1 } })).status, 400);
    assert.equal((await f.request(`/api/processes/${process.id}/documents/nonexistent/correction-request`, student, 'POST', { description: 'Documento sem vínculo com o processo.' })).status, 404);
    const valid = await send('A'.repeat(4000));
    assert.equal(valid.status, 201);
    assert.equal((await valid.json()).description.length, 4000);
    const saved = await f.state();
    assert.equal(saved.correctionRequests.length, 1);
    const audit = saved.auditLogs.find((item: { action: string }) => item.action === 'SOLICITACAO_AJUSTE_DOCUMENTO');
    assert.equal(audit.after.description, undefined);
    assert.equal(audit.after.descriptionLength, 4000);
    assert.match(audit.after.descriptionSha256, /^[a-f0-9]{64}$/);
    assert.ok(!JSON.stringify(audit).includes('A'.repeat(100)));
  } finally { await f.close(); }
});

test('HTTP: open correction duplicates reuse the ticket and durable requester/process quotas survive restart', { timeout: 45_000 }, async () => {
  const process = processFixture();
  const legacy = { id: 'legacy-resolved', processId: process.id, documentId: 'doc-ata', documentVersion: 1, requestedByEmail: student, requestedByRoles: ['STUDENT'], description: 'Conteúdo histórico preservado. '.repeat(400), status: 'CORRIGIDO', createdAt: new Date(Date.now() - 25 * 3600_000).toISOString() };
  const f = await fixture(initialState([process], [legacy]));
  const send = (description: string, email = student, documentId = 'doc-ata') => f.request(`/api/processes/${process.id}/documents/${documentId}/correction-request`, email, 'POST', { description });
  try {
    const first = await send('Corrigir a data apresentada no documento.');
    assert.equal(first.status, 201);
    const ticket = await first.json();
    const duplicate = await send('  Corrigir a data apresentada no documento.  ');
    assert.equal(duplicate.status, 200);
    assert.equal((await duplicate.json()).id, ticket.id);
    for (let index = 0; index < 4; index++) assert.equal((await send(`Correção distinta de número ${index}.`, student, index % 2 ? 'doc-termo' : 'doc-ata')).status, 201);
    await f.restart();
    const duplicateAtLimit = await send('Corrigir a data apresentada no documento.');
    assert.equal(duplicateAtLimit.status, 200, 'retries do not consume quota after restart');
    assert.equal((await duplicateAtLimit.json()).id, ticket.id);
    assert.equal((await send('Tentativa de ultrapassar a quota de solicitações abertas.')).status, 429);
    assert.equal((await send('O orientador possui uma quota independente.', advisor)).status, 201);
    const saved = await f.state();
    assert.deepEqual(saved.correctionRequests.find((item: { id: string }) => item.id === legacy.id), legacy);
    assert.equal(saved.correctionRequests.filter((item: { requestedByEmail: string }) => item.requestedByEmail === student).length, 6);
    assert.equal(saved.auditLogs.filter((item: { action: string; actorEmail: string }) => item.action === 'SOLICITACAO_AJUSTE_DOCUMENTO' && item.actorEmail === student).length, 5);
  } finally { await f.close(); }
});

test('HTTP: historical open tickets and recent resolved tickets count toward quotas without being truncated', { timeout: 45_000 }, async () => {
  const process = processFixture();
  const other = processFixture('recent-process');
  const makeTicket = (id: number, target = process.id) => ({ id: `historical-${target}-${id}`, processId: target, documentId: 'doc-ata', documentVersion: 1, requestedByEmail: student, requestedByRoles: ['STUDENT'], description: 'Histórico original não pode ser truncado. '.repeat(200), status: target === process.id ? 'ABERTO' : 'CORRIGIDO', createdAt: target === process.id ? '2025-01-01T00:00:00Z' : now() });
  const tickets = [...Array.from({ length: 6 }, (_, index) => makeTicket(index)), ...Array.from({ length: 10 }, (_, index) => makeTicket(index, other.id))];
  const f = await fixture(initialState([process, other], tickets));
  try {
    await f.restart();
    for (const target of [process.id, other.id]) {
      const denied = await f.request(`/api/processes/${target}/documents/doc-ata/correction-request`, student, 'POST', { description: 'Nova solicitação que deve respeitar os registros já existentes.' });
      assert.equal(denied.status, 429, target);
    }
    assert.deepEqual((await f.state()).correctionRequests, tickets);
  } finally { await f.close(); }
});
