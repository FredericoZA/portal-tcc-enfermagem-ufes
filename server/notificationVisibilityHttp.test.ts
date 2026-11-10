import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHmac } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DEMO_MEMBERSHIPS, DEMO_PROCESSES, INITIAL_SETTINGS } from '../src/services/demoSeed';
import type { PortalNotification, PortalNotificationDetail } from '../src/types/courseOperations';

test('HTTP: alertas respeitam destinatário, solicitante e permissão para acompanhar assinaturas', { timeout: 45_000 }, async () => {
  const directory = await mkdtemp(join(tmpdir(), 'portal-notification-visibility-'));
  const [first, second] = structuredClone(DEMO_PROCESSES);
  first.status = 'CONCLUIDO';
  second.status = 'AGUARDANDO_CONFIRMACAO_LOCAL';
  const master = 'master@portal.local';
  const president = 'presidencia@example.invalid';
  const examiner = first.banca.find(member => member.email !== first.orientador.email)!.email;
  const author = first.aluno1.email;
  const advisor = first.orientador.email;
  const otherAuthor = second.aluno1.email;
  const updatedAt = '2026-11-01T15:00:00.000Z';
  const settings = { ...INITIAL_SETTINGS, masterEmail: master, commissionPresidentEmail: president };
  const mail = (id: string, processId?: string, recipient = author, requestedBy = master) => ({
    id, processId, recipient, requestedBy, subject: id, status: 'FAILED', updatedAt,
  });
  const signature = (id: string, processId: string, documentType: string) => ({
    id, processId, documentType, status: 'PROVIDER_ERROR', updatedAt,
  });
  const state = {
    settings,
    processes: [first, second],
    memberships: [
      ...DEMO_MEMBERSHIPS.filter(member => [first.id, second.id].includes(member.processId)),
      { id: 'examiner-membership', processId: first.id, email: examiner, roles: ['EXAMINER'], active: true },
    ],
    emailDeliveries: [
      { ...mail('first', first.id, author, advisor), cc: [examiner], renderedHtml: 'INTERNAL_EMAIL_BODY', attempts:[{}] },
      { ...mail('examiner-copy', first.id), workflowCc: [examiner] },
      mail('second', second.id, otherAuthor),
      mail('no-process'),
      { ...mail('sent', first.id), status: 'ACCEPTED_BY_GMAIL' },
    ],
    signatureJobs: [
      signature('first-ata', first.id, 'ATA'),
      signature('first-declaration', first.id, 'DECLARACAO'),
      signature('second-ata', second.id, 'ATA'),
      { ...signature('removed', first.id, 'ATA'), removedFromLogsAt: updatedAt },
    ],
  };
  const stateFile = join(directory, 'portal-state.json');
  await writeFile(stateFile, JSON.stringify(state));
  const port = 48200 + Math.floor(Math.random() * 300);
  const base = `http://127.0.0.1:${port}`;
  const sessionSecret = 'local-notifications-http-session-secret';
  const start = () => spawn(process.execPath, ['--import', 'tsx', 'server.ts'], {
    env: {
      PATH: process.env.PATH, HOME: process.env.HOME, HOST: '127.0.0.1', PORT: String(port),
      NODE_ENV: 'development', APP_URL: base, PORTAL_PUBLIC_URL: base, PORTAL_DATA_DIR: directory,
      PORTAL_PERSISTENCE_PROVIDER: 'local_file', PORTAL_ALLOW_INSECURE_DEMO_AUTH: 'true',
      PORTAL_ALLOW_LOCAL_SECRET_STORE: 'true', PORTAL_SESSION_SECRET: sessionSecret,
      ASTEN_INTEGRATION_ENABLED: 'false',
    },
    stdio: 'ignore',
  });
  let child = start();
  const get = (email?: string, suffix = '') => fetch(base + '/api/notifications' + suffix, email
    ? { headers: { 'x-demo-user-email': email } }
    : undefined);
  const mark = (email: string, id: string, createdAt = updatedAt) => fetch(`${base}/api/notifications/${id}/read`, {
    method:'PUT',
    headers:{'x-demo-user-email':email,'content-type':'application/json'},
    body:JSON.stringify({createdAt,ownerEmail:advisor}),
  });
  const stop = async () => {
    if (child.exitCode !== null || child.signalCode !== null) return;
    const stopped = new Promise(resolve => child.once('exit', resolve));
    child.kill('SIGTERM');
    await stopped;
  };

  const ready = async () => {
    const deadline = Date.now() + 20_000;
    while (true) {
      try { if ((await fetch(base + '/api/health')).ok) break; } catch {}
      if (Date.now() > deadline || child.exitCode !== null) throw new Error('Servidor local não iniciou');
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  };

  try {
    await ready();
    assert.equal((await get()).status, 401);
    const expectedByEmail: Record<string, string[]> = {
      [master]: ['email-examiner-copy', 'email-first', 'email-no-process', 'email-second', 'signature-first-ata', 'signature-first-declaration', 'signature-second-ata'],
      [president]: ['signature-first-declaration'],
      [author]: ['email-examiner-copy', 'email-first', 'signature-first-ata', 'signature-first-declaration'],
      [advisor]: ['email-first', 'signature-first-ata', 'signature-first-declaration', 'signature-second-ata'],
      [examiner]: ['email-examiner-copy', 'signature-first-ata', 'signature-first-declaration'],
      [otherAuthor]: ['email-second', 'signature-second-ata'],
      'visitante@example.invalid': [],
    };
    for (const [email, expected] of Object.entries(expectedByEmail)) {
      const response = await get(email);
      assert.equal(response.status, 200, email);
      assert.equal(response.headers.get('cache-control'), 'private, no-store');
      const items = await response.json() as PortalNotification[];
      assert.deepEqual(items.map(item => item.id).sort(), expected, email);
      for (const item of items) {
        assert.equal(item.createdAt, updatedAt);
        assert.equal(item.read, false);
        assert.equal(item.protocol, state.processes.find(process => process.id === item.processId)?.protocolo);
      }
    }
    assert.equal((await get(undefined,'/email-first')).status,401);
    const now = Math.floor(Date.now()/1000);
    const expired = Buffer.from(JSON.stringify({
      uid:'email:'+author,email:author,emailVerified:true,method:'EMAIL_OTP',
      sessionId:'test-expired-session-id-000000',issuedAt:now-100,authTime:now-100,expiresAt:now-1,
    })).toString('base64url');
    const signature = createHmac('sha256',sessionSecret).update(expired).digest('base64url');
    const expiredSession = await fetch(base+'/api/notifications/email-first',{
      headers:{cookie:`portal_tcc_session=${expired}.${signature}`},
    });
    assert.equal(expiredSession.status,401);
    assert.equal((await get(otherAuthor,'/email-first')).status,404);
    assert.equal((await get(master,'/signature-removed')).status,404);
    assert.equal((await get(president,'/signature-first-ata')).status,404);
    const declaration = await (await get(president,'/signature-first-declaration')).json() as PortalNotificationDetail;
    assert.deepEqual(declaration.destination,{kind:'PRESIDENCY'});
    const detail = await (await get(author,'/email-first')).json() as PortalNotificationDetail;
    assert.deepEqual(detail.destination,{kind:'PROCESS',processId:first.id,section:'cadastral'});
    assert.match(detail.context||'',/1/);
    assert.doesNotMatch(JSON.stringify(detail),/INTERNAL_EMAIL_BODY|@/);
    assert.equal((await mark(author,'email-first','stale')).status,409);
    assert.equal((await mark(otherAuthor,'email-first')).status,404);
    const beforeMarks = await readFile(stateFile,'utf8');
    const marks = await Promise.all([mark(author,'email-first'),mark(author,'email-first')]);
    assert.deepEqual(marks.map(response=>response.status),[200,200]);
    assert.equal(await readFile(stateFile,'utf8'),beforeMarks);
    assert.equal((await (await get(author,'/email-first')).json()).read,true);
    assert.equal((await (await get(advisor,'/email-first')).json()).read,false);

    await stop();
    child = start();
    await ready();
    const reopened = await (await get(author)).json() as PortalNotification[];
    assert.equal(reopened.find(item=>item.id==='email-first')?.read,true);
    assert.equal(reopened.find(item=>item.id==='email-examiner-copy')?.read,false);

    const accessList = await fetch(base + '/api/admin/access-list', { headers: { 'x-demo-user-email': master } });
    assert.equal(accessList.status, 200);
    const access = (await accessList.json() as Array<{ id: string; email: string }>).find(entry => entry.email === examiner);
    assert.ok(access);
    const revoked = await fetch(base + '/api/admin/access-list/' + access.id, {
      method: 'PATCH',
      headers: { 'x-demo-user-email': master, 'content-type': 'application/json' },
      body: JSON.stringify({ active: false }),
    });
    assert.equal(revoked.status, 200);
    const denied = await get(examiner);
    if (denied.status === 200) assert.deepEqual(await denied.json(), []);
    else assert.equal(denied.status, 401);
    assert.ok([401,404].includes((await get(examiner,'/signature-first-ata')).status));
    assert.ok([401,404].includes((await mark(examiner,'signature-first-ata')).status));
  } finally {
    await stop();
    await rm(directory, { recursive: true, force: true });
  }
});
