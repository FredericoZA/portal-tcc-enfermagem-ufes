import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createServer, type AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { DEMO_MEMBERSHIPS, DEMO_PROCESSES, INITIAL_SETTINGS } from '../src/services/demoSeed';

test('Master views named accounts with the target permissions and leaves a Master audit trail', { timeout: 60_000 }, async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'portal-account-view-'));
  const statePath = path.join(directory, 'portal-state.json');
  const master = 'master-account-view@example.invalid';
  const president = 'presidencia-account-view@example.invalid';
  const advisor = DEMO_PROCESSES[0].orientador;
  const student = DEMO_PROCESSES[0].aluno1;
  const other = DEMO_PROCESSES.find(process => process.aluno1.email !== student.email && process.aluno2?.email !== student.email)!;
  const legacyEmail = 'autora-legada@example.invalid';
  const legacyId = 'legado-0001';
  const revoked = 'revogado-account-view@example.invalid';
  await writeFile(statePath, JSON.stringify({
    settings: { ...INITIAL_SETTINGS, masterEmail: master, ownerEmail: master, commissionPresidentEmail: president, commissionPresidentName: 'Presidência de Teste' },
    processes: DEMO_PROCESSES,
    memberships: DEMO_MEMBERSHIPS,
    authorizedStudents: [{ id: 'revoked-account', email: revoked, nome: 'Conta revogada', active: false, processIds: [] }],
    legacyAcademicRecords: [{
      id: legacyId, protocolo: '001 - Legado', titulo: 'Trabalho histórico de teste',
      sourceFingerprint: 'a'.repeat(64), autores: ['Autora do Histórico'], orientador: 'Orientador do Histórico',
      coorientador: '', coorientadorInstituicao: '', examinadores: [], resumo: '', palavrasChave: [],
      dataDefesa: '2025-08-22', horaDefesa: '14:00:00', localDefesa: 'Sala de teste', attachments: [],
      provenance: { verifiedPublicationParticipants: {
        authors: [{ nome: 'Autora do Histórico', email: legacyEmail }],
        advisor: { nome: 'Orientador do Histórico', email: 'orientador-legado@example.invalid' },
        verifiedBy: master,
      } },
    }],
  }));

  const reservation = createServer();
  await new Promise<void>(resolve => reservation.listen(0, '127.0.0.1', resolve));
  const port = (reservation.address() as AddressInfo).port;
  await new Promise<void>((resolve, reject) => reservation.close(error => error ? reject(error) : resolve()));
  const base = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, ['--import', 'tsx', 'server.ts'], { env: {
    PATH: process.env.PATH, NODE_ENV: 'development', DISABLE_HMR: 'true', HOST: '127.0.0.1', PORT: String(port),
    PORTAL_PUBLIC_URL: base, PORTAL_DATA_DIR: directory, PORTAL_PERSISTENCE_PROVIDER: 'local_file',
    PORTAL_SESSION_SECRET: randomBytes(32).toString('hex'), PORTAL_OTP_PEPPER: randomBytes(32).toString('hex'),
    PORTAL_ALLOW_LOCAL_OTP_STORE: 'true', PORTAL_OTP_DELIVERY_MODE: 'log', ASTEN_INTEGRATION_ENABLED: 'false',
  }, stdio: ['ignore', 'pipe', 'pipe'] });
  let logs = '';
  child.stdout.on('data', chunk => { logs += String(chunk); });
  child.stderr.on('data', chunk => { logs += String(chunk); });

  const request = (route: string, cookie = '', method = 'GET', body?: unknown) => fetch(base + route, {
    method, headers: { cookie, 'content-type': 'application/json', ...(method === 'GET' ? {} : { origin: base }) },
    body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(10_000),
  });
  const cookieFrom = (response: Response, name: string) => {
    const cookie = response.headers.getSetCookie().find(value => value.startsWith(name + '='))?.split(';')[0];
    assert.ok(cookie, name);
    return cookie;
  };
  const otpSession = async (email: string) => {
    const ack = await request('/api/auth/request-code', '', 'POST', { email });
    assert.equal(ack.status, 200);
    assert.equal((await ack.json()).sent, true);
    const challenge = cookieFrom(ack, 'portal_otp_challenge');
    const deadline = Date.now() + 2_000;
    let code: string | undefined;
    do {
      code = [...logs.matchAll(/\[Portal OTP desenvolvimento\] ([^\s:]+): (\d{6})/g)].reverse().find(match => match[1] === email)?.[2];
      if (!code) await new Promise(resolve => setTimeout(resolve, 10));
    } while (!code && Date.now() < deadline);
    assert.ok(code, 'local OTP delivery');
    const verified = await request('/api/auth/verify-code', challenge, 'POST', { email, code });
    assert.equal(verified.status, 200);
    return cookieFrom(verified, 'portal_tcc_session');
  };

  try {
    const deadline = Date.now() + 20_000;
    while (!await request('/api/health').then(response => response.ok, () => false)) {
      if (Date.now() > deadline || child.exitCode !== null) throw new Error('Servidor local não iniciou. ' + logs.slice(-600));
      await new Promise(resolve => setTimeout(resolve, 80));
    }
    const endpoint = '/api/account-view';
    const accounts = endpoint + '/accounts';
    const masterSession = await otpSession(master);
    const studentSession = await otpSession(student.email);
    assert.equal((await request(accounts)).status, 401);
    assert.equal((await request(accounts, studentSession)).status, 403);
    assert.equal((await request(endpoint, studentSession, 'POST', { email: advisor.email })).status, 403);
    const directoryResponse = await request(accounts, masterSession);
    assert.match(directoryResponse.headers.get('cache-control') || '', /private, no-store/);
    const targets = await directoryResponse.json();
    for (const [email, name] of [[student.email, student.nome], [advisor.email, advisor.nome], [president, 'Presidência de Teste'], [legacyEmail, 'Autora do Histórico']]) {
      assert.deepEqual(targets.find((target: { email: string }) => target.email === email), { email, name });
    }
    assert.ok(!targets.some((target: { email: string }) => [master, revoked].includes(target.email)));
    assert.equal((await request(endpoint, masterSession, 'POST', { email: revoked })).status, 404);

    const studentView = await request(endpoint, masterSession, 'POST', { email: student.email });
    assert.equal(studentView.status, 200);
    const viewCookie = cookieFrom(studentView, 'portal_tcc_view');
    const viewingStudent = `${masterSession}; ${viewCookie}`;
    const me = await (await request('/api/me', viewingStudent)).json();
    const actual = await (await request('/api/me', studentSession)).json();
    assert.deepEqual(me, { ...actual, viewingAccount: student.email, accountView: { masterEmail: master, targetName: student.nome } });
    assert.deepEqual(await (await request('/api/processes', viewingStudent)).json(), await (await request('/api/processes', studentSession)).json());
    assert.equal((await request(`/api/processes/${other.id}/detail`, viewingStudent)).status, 404);
    assert.equal((await request(`/api/processes/${DEMO_PROCESSES[0].id}/documents`, viewingStudent)).status, 200);
    assert.equal((await request('/api/admin/audit-logs', viewingStudent)).status, 403);
    const beforeReadOnly = await readFile(statePath, 'utf8');
    const blocked = await request('/api/notification-preferences', viewingStudent, 'PATCH', { email: false });
    assert.equal(blocked.status, 403);
    assert.equal((await blocked.json()).code, 'ACCOUNT_VIEW_READ_ONLY');
    assert.equal((await request(`/api/processes/${DEMO_PROCESSES[0].id}/signatures`, viewingStudent)).status, 200);
    assert.equal(await readFile(statePath, 'utf8'), beforeReadOnly);
    assert.equal((await request('/api/processes', `${studentSession}; ${viewCookie}`)).status, 403);
    assert.equal((await request(accounts, viewingStudent)).status, 200);

    const presidentView = await request(endpoint, viewingStudent, 'POST', { email: president });
    const viewingPresident = `${masterSession}; ${cookieFrom(presidentView, 'portal_tcc_view')}`;
    assert.deepEqual((await (await request('/api/me', viewingPresident)).json()).globalRoles, ['COMMISSION_PRESIDENT']);
    assert.equal((await request('/api/coordinator/signature-queue', viewingPresident)).status, 200);

    const legacyView = await request(endpoint, viewingPresident, 'POST', { email: legacyEmail });
    const viewingLegacy = `${masterSession}; ${cookieFrom(legacyView, 'portal_tcc_view')}`;
    assert.equal((await (await request(`/api/public/processes/${legacyId}`, viewingLegacy)).json()).canAccessLegacyEvaluation, true);
    const returned = await request(endpoint, viewingLegacy, 'POST', { email: null });
    assert.equal(returned.status, 200);
    assert.equal(cookieFrom(returned, 'portal_tcc_view'), 'portal_tcc_view=');
    assert.deepEqual((await (await request('/api/me', masterSession)).json()).globalRoles, ['MASTER_ADMIN']);
    const auditFeed = await request('/api/admin/audit-logs?paginated=true', masterSession);
    assert.equal(auditFeed.status, 200);
    const { items } = await auditFeed.json();
    for (const email of [student.email, president, legacyEmail]) {
      assert.ok(items.some((item: any) => item.action === 'VISUALIZACAO_DE_CONTA' && item.entityId === email && item.actorEmail === master));
    }
    assert.ok(items.some((item: any) => item.action === 'RETORNO_VISAO_MASTER' && item.entityId === legacyEmail && item.actorEmail === master));

    const logout = await request('/api/auth/logout', viewingStudent, 'POST');
    assert.equal(logout.status, 200);
    assert.equal(cookieFrom(logout, 'portal_tcc_view'), 'portal_tcc_view=');
    assert.equal((await (await request('/api/me', masterSession)).json()).isAuthenticated, false);
  } finally {
    if (child.exitCode === null) {
      const stopped = new Promise(resolve => child.once('exit', resolve));
      child.kill();
      await stopped;
    }
    await rm(directory, { recursive: true, force: true });
  }
});
