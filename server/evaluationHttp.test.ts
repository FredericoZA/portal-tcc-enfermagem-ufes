import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEMO_PROCESSES, DEMO_MEMBERSHIPS, INITIAL_SETTINGS } from '../src/services/demoSeed';

test('HTTP: orientador confere e registra avaliação; aluno é recusado; estado e aparência ficam gravados', { timeout: 45000 }, async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'portal-evaluation-'));
  const p = structuredClone(DEMO_PROCESSES[0]);
  p.defesa = { ...p.defesa, localStatus: 'CONFIRMADO', startAt: new Date(Date.now() - 3600000).toISOString(), invitationSentAt: new Date().toISOString() };
  const settings = { ...structuredClone(INITIAL_SETTINGS), documentModels: { ATA: { type: 'ATA', driveFileId: 'fixture-model', fileName: 'Ata.docx' }, CONVITE: { type: 'CONVITE', driveFileId: 'fixture-invite', fileName: 'Convite.docx' } } };
  const custom = { id: 'form-extra-rc10', title: 'Conferência adicional', targetRole: 'Orientador', isActive: true, questions: [
    { id: 'choice', fieldKey: 'ESCOLHA', label: 'Escolha', fieldType: 'select', required: true, options: ['Sim', 'Não'] },
    { id: 'accepted', fieldKey: 'ACEITO', label: 'Confirmo', fieldType: 'checkbox', required: true },
  ] };
  settings.integrationStudio = { ...settings.integrationStudio, formTemplates: [...(settings.integrationStudio?.formTemplates || []), custom] } as any;
  const local = structuredClone(p);
  local.id = 'fixture-confirmed-location';
  local.defesa.invitationSentAt = undefined;
  local.defesa.localConfirmedBy = p.aluno1.email;
  local.defesa.localConfirmedAt = new Date().toISOString();
  const memberships = DEMO_MEMBERSHIPS.filter(m => m.processId === p.id);
  await writeFile(path.join(directory, 'portal-state.json'), JSON.stringify({ settings, processes: [p, local], memberships: [...memberships, ...memberships.map(m => ({ ...m, id: m.id + '-local', processId: local.id }))] }));
  const port = 41000 + Math.floor(Math.random() * 1000);
  const child = spawn(process.execPath, ['--import', 'tsx', 'server.ts'], {
    cwd: fileURLToPath(new URL('..', import.meta.url)),
    env: { ...process.env, NODE_ENV: 'development', PORT: String(port), PORTAL_DATA_DIR: directory,
      PORTAL_SESSION_SECRET: 'test-session-secret-0123456789-abcdef', PORTAL_OTP_PEPPER: 'test-otp-pepper-0123456789-abcdef',
      PORTAL_ALLOW_INSECURE_DEMO_AUTH: 'true', PORTAL_ALLOW_LOCAL_OTP_STORE: 'true', PORTAL_ALLOW_LOCAL_SECRET_STORE: 'true',
      PORTAL_OTP_DELIVERY_MODE: 'log', ASTEN_INTEGRATION_ENABLED: 'false', PORTAL_PERSISTENCE_PROVIDER: 'local_file',
      SUPABASE_URL: '', SUPABASE_SERVICE_ROLE_KEY: '', SUPABASE_SECRET_KEY: '',
    }, stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.resume(); child.stderr.resume();
  const base = `http://127.0.0.1:${port}`;
  const request = async (route: string, email = p.orientador.email, body?: unknown) => {
    const r = await fetch(base + route, { method: body === undefined ? 'GET' : 'POST', headers: { 'content-type': 'application/json', 'x-demo-user-email': email }, body: body === undefined ? undefined : JSON.stringify(body) });
    return { status: r.status, body: await r.json() };
  };
  try {
    const deadline = Date.now() + 25000;
    while (true) {
      try { if ((await fetch(base + '/api/health')).ok) break; } catch { /* startup */ }
      if (Date.now() > deadline || child.exitCode !== null) throw new Error('Servidor de teste não iniciou.');
      await new Promise(r => setTimeout(r, 200));
    }
    const route = `/api/processes/${p.id}/evaluation`;
    const frontend = await fetch(base + '/');
    const html = await frontend.text();
    const nonce = frontend.headers.get('content-security-policy')?.match(/'nonce-([^']+)'/)?.[1];
    assert.ok(nonce, 'Vite deve autorizar seu preâmbulo React por nonce');
    const inlineScripts = [...html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)].filter(match => match[2].trim());
    assert.ok(inlineScripts.some(match => match[2].includes('/@react-refresh')));
    for (const script of inlineScripts) assert.ok(script[1].includes(`nonce="${nonce}"`));
    const master = 'master@portal.local';
    const forms = await request(`/api/processes/${p.id}/forms`, master);
    assert.equal(forms.status, 200);
    assert.deepEqual(forms.body.map((f: any) => f.id), [custom.id]);
    const customRoute = `/api/processes/${p.id}/forms/${custom.id}/submissions`;
    const formBody = { expectedFormRevision: settings.integrationStudio?.revision || 0, answers: { ESCOLHA: 'Sim', ACEITO: true } };
    assert.equal((await request(customRoute, p.aluno1.email, formBody)).status, 404);
    assert.equal((await request(customRoute, master, { ...formBody, expectedFormRevision: -1 })).body.code, 'STALE_FORM_REVISION');
    assert.equal((await request(customRoute, master, { ...formBody, answers: { ESCOLHA: 'Inventada', ACEITO: false } })).body.code, 'INVALID_FORM_ANSWERS');
    const customSaved = await request(customRoute, master, formBody);
    assert.equal(customSaved.status, 202);
    assert.equal(customSaved.body.workflowPending, true);
    assert.equal(customSaved.body.formSnapshot.title, custom.title);
    const repeated = await request(customRoute, master, formBody);
    assert.equal(repeated.status, 202);
    assert.equal(repeated.body.id, customSaved.body.id);
    const confirmed = await request(`/api/processes/${local.id}/confirm-location`, p.aluno1.email, { local: local.defesa.local, confirmationReceived: true });
    assert.equal(confirmed.status, 202);
    assert.equal(confirmed.body.dataRevision, local.dataRevision);
    assert.equal(confirmed.body.defesa.localConfirmedAt, local.defesa.localConfirmedAt);
    assert.equal((await request(`/api/processes/${local.id}/confirm-location`, p.aluno1.email, { local: 'Outro local', confirmationReceived: true })).status, 409);
    assert.equal((await request('/api/does-not-exist')).status, 404);
    assert.equal((await request(route + '/schema', p.aluno1.email)).status, 403);
    const schema = await request(route + '/schema');
    assert.equal(schema.status, 200);
    assert.equal(schema.body.studio.docTemplates, undefined);
    const body = { dataConfirmed: true, expectedDataRevision: p.dataRevision, expectedSchemaRevision: schema.body.studio.revision, resultadoCode: 'APROVADO', parecer: 'Avaliação realizada e dados conferidos.' };
    assert.equal((await request(route, p.aluno1.email, body)).status, 403);
    assert.equal((await request(route, p.orientador.email, { ...body, dataConfirmed: false })).body.code, 'DATA_REVIEW_REQUIRED');
    assert.equal((await request(route, p.orientador.email, { ...body, expectedDataRevision: 0 })).status, 409);
    const saved = await request(route, p.orientador.email, body);
    assert.equal(saved.status, 202); // Saved locally; Google archive intentionally unavailable.
    assert.equal(saved.body.avaliacao.notaFinal, undefined);
    assert.equal(saved.body.avaliacao.dataReview.confirmedBy, p.orientador.email);
    assert.equal(saved.body.workflowPending, true);
    assert.equal((await request(route, p.orientador.email, body)).status, 409);
    const appearance = { schemaVersion: 3, linkedItems: { popup_login: false }, generalPopups: { uploadAtaHeaderBg: '#005830' } };
    const response = await fetch(base + '/api/admin/settings', { method: 'PATCH', headers: { 'content-type': 'application/json', 'x-demo-user-email': 'master@portal.local' }, body: JSON.stringify({ portalAppearance: appearance }) });
    assert.equal(response.status, 200);
    const publicSettings = await request('/api/settings', '');
    assert.equal(publicSettings.body.portalAppearance.linkedItems.popup_login, true);
    const disk = JSON.parse(await readFile(path.join(directory, 'portal-state.json'), 'utf8'));
    assert.equal(disk.studioFormSubmissions.length, 1);
    assert.equal(disk.studioFormSubmissions[0].formSnapshot.questions[0].label, 'Escolha');
    assert.equal(disk.settings.portalAppearance.schemaVersion, 4);
    assert.equal(disk.processes[0].avaliacao.notaFinal, undefined);
  } finally {
    if (child.exitCode === null) {
      child.kill('SIGTERM');
      await new Promise<void>(resolve => child.once('exit', () => resolve()));
    }
    await rm(directory, { recursive: true, force: true });
  }
});
