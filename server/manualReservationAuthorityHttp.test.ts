import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp, writeFile, readFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {DEMO_PROCESSES, INITIAL_SETTINGS} from '../src/services/demoSeed';
import {createProfessionalPdf} from './documents/simplePdf';

test('manual confirmation cannot turn a student-uploaded PDF into reservation approval', {timeout: 45000}, async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'portal-manual-reservation-'));
  const p = structuredClone(DEMO_PROCESSES[0]);
  p.status = 'AGUARDANDO_CONFIRMACAO_LOCAL'; p.etapaAtual = 'CONFIRMACAO_LOCAL';
  p.avaliacao = {status: 'PENDENTE'}; p.acervo.submittedAt = undefined;
  p.defesa = {...p.defesa, localStatus: 'PENDENTE', reservationRevision: 0,
    invitationSentAt: undefined, invitationDriveFileId: undefined, departmentResponse: undefined, locationProof: undefined};
  const settings = {...INITIAL_SETTINGS, driveRootFolderId: 'local-test-root', documentModels: {CONVITE: {driveFileId: 'fixture-model'}}};
  const memberships = [
    {email: p.aluno1.email, roles: ['STUDENT']},
    {email: p.orientador.email, roles: ['ADVISOR']},
    ...p.banca.filter(m => m.email !== p.orientador.email).map(m => ({email: m.email, roles: ['EXAMINER']})),
  ].map((member, i) => ({...member, id: `membership-${i}`, processId: p.id, active: true}));
  const refused = structuredClone(p); refused.id = 'refused-manual-test'; refused.defesa.localStatus = 'RECUSADO';
  refused.defesa.departmentResponse = {decision: 'UNAVAILABLE', revision: 0, respondedAt: new Date().toISOString(), respondedBy: 'department@example.invalid', startAt: p.defesa.startAt, endAt: p.defesa.endAt};
  await writeFile(path.join(directory, 'portal-state.json'), JSON.stringify({settings, processes: [p, refused], memberships, signatureJobs: []}));
  const port = 46800 + Math.floor(Math.random() * 300), base = `http://127.0.0.1:${port}`;
  // Only OS essentials are inherited: the test cannot load provider credentials.
  const systemEnv = Object.fromEntries(['PATH', 'HOME', 'TMPDIR', 'LANG'].flatMap(key => process.env[key] ? [[key, process.env[key]!]] : []));
  const bootstrap = "import{createRequire}from'node:module';import{pathToFileURL}from'node:url';const require=createRequire(import.meta.url);require('dotenv').config=()=>({parsed:{}});await import(pathToFileURL(process.cwd()+'/server.ts').href);";
  const child = spawn(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', bootstrap], {cwd: process.cwd(), env: {...systemEnv,
    NODE_ENV: 'development', HOST: '127.0.0.1', PORT: String(port), PORTAL_PUBLIC_URL: base,
    PORTAL_DATA_DIR: directory, PORTAL_PERSISTENCE_PROVIDER: 'local_file',
    PORTAL_LOCAL_REVIEW_DATA: 'true', PORTAL_TEST_DOCUMENT_RENDERER: 'true', PORTAL_ALLOW_INSECURE_DEMO_AUTH: 'true',
    PORTAL_ALLOW_LOCAL_OTP_STORE: 'true', PORTAL_ALLOW_LOCAL_SECRET_STORE: 'true',
    PORTAL_SESSION_SECRET: 'manual-reservation-test-0123456789abcdef', PORTAL_OTP_PEPPER: 'manual-reservation-pepper-0123456789abcdef',
    ASTEN_INTEGRATION_ENABLED: 'false', DOTENV_CONFIG_PATH: path.join(directory, 'absent.env')}, stdio: 'ignore'});
  const disk = async () => JSON.parse(await readFile(path.join(directory, 'portal-state.json'), 'utf8'));
  const confirm = (email: string, extra: Record<string, unknown> = {}) => fetch(`${base}/api/processes/${p.id}/confirm-location`, {
    method: 'POST', headers: {'content-type': 'application/json', ...(email ? {'x-demo-user-email': email} : {})},
    body: JSON.stringify({local: p.defesa.local, confirmationReceived: true, ...extra}),
  });
  try {
    const deadline = Date.now() + 20000;
    while (true) {try {if ((await fetch(base + '/api/health')).ok) break;} catch {}
      if (Date.now() > deadline || child.exitCode !== null) throw new Error('Isolated server failed to start');
      await new Promise(r => setTimeout(r, 100));}
    const pdf = createProfessionalPdf({title: 'Comprovante fictício', protocol: p.protocolo, body: 'Arquivo sem autorização do responsável.'});
    const upload = await fetch(`${base}/api/processes/${p.id}/location-proof`, {method: 'POST',
      headers: {'content-type': 'application/json', 'x-demo-user-email': p.aluno1.email},
      body: JSON.stringify({fileName: 'teste.pdf', contentBase64: pdf.toString('base64')})});
    assert.equal(upload.status, 201, await upload.clone().text());
    const before = (await disk()).processes[0];
    assert.equal(before.defesa.locationProof.uploadedBy, p.aluno1.email);
    const unauthorized = [p.aluno1.email, p.orientador.email, ...p.banca.map(m => m.email)];
    for (const email of new Set(unauthorized)) {
      const response = await confirm(email, {manualConfirmationReason: 'Tentativa de contornar a autorização', departmentResponse: {decision: 'CONFIRMED'}});
      assert.equal(response.status, 403, email);
      assert.equal((await response.json()).code, 'MANUAL_CONFIRMATION_FORBIDDEN');
    }
    assert.equal((await confirm('')).status, 401);
    assert.equal((await confirm('stranger@example.invalid')).status, 404);
    assert.deepEqual((await disk()).processes[0], before, 'rejected requests must not change process state');
    assert.equal((await disk()).workflowRuns?.length || 0, 0);
    const noReason = await confirm('master@portal.local');
    assert.equal((await noReason.json()).code, 'MANUAL_CONFIRMATION_REASON_REQUIRED');
    const oversized = await confirm('master@portal.local', {manualConfirmationReason: 'x'.repeat(1001)});
    assert.equal(oversized.status, 400);
    const decision = await fetch(`${base}/api/processes/${refused.id}/confirm-location`, {method: 'POST',
      headers: {'content-type': 'application/json', 'x-demo-user-email': 'master@portal.local'},
      body: JSON.stringify({local: refused.defesa.local, confirmationReceived: true, manualConfirmationReason: 'Não deve substituir recusa'})});
    assert.equal(decision.status, 409);
    assert.equal((await decision.json()).code, 'RESERVATION_DECISION_RECORDED');
    assert.equal((await disk()).processes.find((item: {id: string}) => item.id === refused.id).defesa.localStatus, 'RECUSADO');
    // A valid administrative exception preserves its origin and reason in audit.
    const accepted = await confirm('master@portal.local', {manualConfirmationReason: 'Autorização documental conferida pela secretaria'});
    assert.ok([200, 202].includes(accepted.status), await accepted.clone().text());
    const after = await disk();
    assert.equal(after.processes[0].defesa.localStatus, 'CONFIRMADO');
    const log = after.auditLogs.find((l: {action: string}) => l.action === 'CONFIRMACAO_LOCAL_ADMINISTRATIVA');
    assert.equal(log.actorEmail, 'master@portal.local');
    assert.equal(log.after.reason, 'Autorização documental conferida pela secretaria');
    assert.equal(log.after.proofSha256, before.defesa.locationProof.sha256);
    assert.equal(after.processes[0].defesa.departmentResponse, undefined, 'manual exception must not impersonate email approval');
  } finally {
    child.kill('SIGTERM'); await new Promise<void>(resolve => child.exitCode !== null ? resolve() : child.once('exit', () => resolve()));
    await rm(directory, {recursive: true, force: true});
  }
});
