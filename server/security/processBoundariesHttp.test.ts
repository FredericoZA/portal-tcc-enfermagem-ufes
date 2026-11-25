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

test('HTTP: authors and the advisor cannot override a reservation conflict; Master cannot reschedule', { timeout: 45_000 }, async () => {
  const process = processFixture();
  const other = processFixture('other-process');
  other.defesa.startAt = '2030-11-04T14:00:00.000Z';
  other.aluno1.email = 'other-author@boundaries.invalid';
  other.orientador.email = 'other-advisor@boundaries.invalid';
  other.banca.forEach((member, index) => { member.email = `other-examiner-${index}@boundaries.invalid`; });
  const f = await fixture(initialState([process, other]));
  const change = (email: string, body: object) => f.request(`/api/processes/${process.id}/reservation-change`, email, 'POST', body);
  try {
    const edited=await f.request(`/api/processes/${process.id}`, student, 'PATCH', { titulo: 'Correção permitida antes do convite' });
    assert.equal(edited.status, 200);
    const {dataRevision,titulo}=await edited.json();
    const beforeRepeat = await f.state();
    const repeat = await f.request(`/api/processes/${process.id}`, student, 'PATCH', { titulo, expectedDataRevision: dataRevision });
    assert.equal(repeat.status, 200);
    assert.equal((await repeat.json()).dataRevision, dataRevision);
    assert.deepEqual(await f.state(), beforeRepeat, 'saving identical data leaves the Drive and audit state alone');
    const raw = await f.request(`/api/processes/${process.id}`, student, 'PATCH', { defesa: { startAt: '2000-01-01T14:00:00Z' } });
    assert.equal(raw.status, 400);
    assert.equal((await raw.json()).code, 'RESERVATION_CHANGE_REQUIRED');
    const proposal={date:'2030-11-04',time:'11:00',locationChoice:process.defesa.local,expectedDataRevision:dataRevision,conflictOverrideReason:'Tentativa de ignorar o conflito'};
    assert.equal((await change(student,{...proposal,date:'2000-01-01'})).status,400);
    assert.equal((await change(student,{...proposal,expectedDataRevision:undefined})).status,409);
    const denied = await change(student,proposal);
    assert.equal(denied.status, 409);
    assert.equal((await denied.json()).code, 'DEFENSE_CONFLICT');
    const advisorDenied = await change(advisor, proposal);
    assert.equal(advisorDenied.status, 409);
    assert.equal((await advisorDenied.json()).code, 'DEFENSE_CONFLICT');
    assert.equal((await change(master, proposal)).status, 403);
    const saved = await f.state();
    const unchanged = saved.processes.find((item: { id: string }) => item.id === process.id);
    assert.deepEqual(unchanged.defesa, process.defesa);
    assert.ok(!saved.auditLogs.some((item: { action: string }) => item.action === 'SOBRESCRITA_CONFLITO_DEFESA'));
    for (const date of ['2030-11-09', '2030-11-10']) {
      const weekend = await change(student, { ...proposal, date });
      assert.equal(weekend.status, 400, await weekend.clone().text());
      assert.match((await weekend.json()).error, /segunda a sexta/);
    }
    const afterWeekend = (await f.state()).processes.find((item: { id: string }) => item.id === process.id);
    assert.deepEqual(afterWeekend.defesa, process.defesa);
  } finally { await f.close(); }
});

test('HTTP: the reservation route blocks a signature being dispatched before a Drive file exists', { timeout: 45_000 }, async () => {
  const process=processFixture();
  const f=await fixture({...initialState([process]),signatureJobs:[{
    id:'signature-being-dispatched',processId:process.id,documentType:'ATA',status:'SENDING',provider:'ASTEN',signers:[]
  }]});
  try {
    const response=await f.request(`/api/processes/${process.id}/reservation-change`,student,'POST',{
      date:'2030-11-06',time:'11:00',locationChoice:process.defesa.local,expectedDataRevision:process.dataRevision
    });
    assert.equal(response.status,409);
    assert.equal((await response.json()).code,'ACTIVE_SIGNATURE_ENVELOPE');
    const saved=await f.state();
    assert.deepEqual(saved.processes[0].defesa,process.defesa);
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

test('HTTP: advisor can correct registration before invitation and stages lock subsequent edits', { timeout: 45_000 }, async () => {
  const early = processFixture('guide-edit-before-invitation');
  const invited = processFixture('guide-edit-after-invitation');
  const archived = processFixture('guide-edit-after-archive');
  const concluded = processFixture('guide-edit-after-completion');
  for (const [index, item] of [early, invited, archived, concluded].entries()) {
    item.defesa.startAt = `2030-11-0${5 + index}T14:00:00.000Z`;
    item.defesa.endAt = `2030-11-0${5 + index}T15:30:00.000Z`;
  }
  invited.defesa.invitationSentAt = now(); // A previously sent invitation can lack its original Drive reference.
  archived.avaliacao = {status: 'CONCLUIDO', submittedAt: now(), documentRevision: 1};
  archived.status = 'AGUARDANDO_DADOS_FINAIS';
  archived.etapaAtual = 'REPOSITORIO';
  concluded.avaliacao = archived.avaliacao;
  concluded.acervo = {submittedAt: now(), publishFullWork: false, publishExpandedAbstract: false};
  concluded.status = 'CONCLUIDO';
  concluded.etapaAtual = 'CONCLUIDO';
  const state = initialState([early, invited, archived, concluded]);
  const examiner = early.banca[0].email;
  state.memberships.push({id: 'guide-edit-examiner', processId: early.id, email: examiner, roles: ['EXAMINER'], active: true, createdAt: now(), updatedAt: now()});
  const signatureJobs = [archived, concluded].map(item => ({
    id: `${item.id}-ata`, processId: item.id, documentType: 'ATA', provider: 'GOV_BR', documentVersion: 1,
    sourceDataRevision: 1, status: 'ARCHIVED', driveSignedFileId: `${item.id}-pdf`,
    signers: [
      {role: 'ADVISOR', email: advisor, status: 'SIGNED'},
      ...item.banca.map(member => ({role: 'EXAMINER', email: member.email, status: 'SIGNED'})),
    ],
  }));
  const f = await fixture({...state, signatureJobs});
  try {
    const endpoint = (id: string) => `/api/processes/${id}`;
    const correction = {
      titulo: 'Título Corrigido Antes do Convite',
      banca: early.banca.map(member => ({...member, nome: member.nome + ' Corrigido'})),
    };
    assert.equal((await f.request(endpoint(early.id), examiner)).status, 200);
    assert.equal((await f.request(endpoint(early.id), examiner, 'PATCH', correction)).status, 403);
    assert.equal((await f.request(endpoint(early.id) + '/final-data', examiner, 'POST', {})).status, 403);
    assert.equal((await f.request(endpoint(early.id) + '/repository/reopen', examiner, 'POST', {})).status, 403);
    assert.equal((await f.request(endpoint(early.id), advisor, 'PATCH', correction)).status, 200);
    const saved = (await f.state()).processes.find((item: {id: string}) => item.id === early.id);
    assert.equal(saved.titulo, correction.titulo);
    assert.deepEqual(saved.banca.map((member: {nome: string}) => member.nome), correction.banca.map(member => member.nome));
    for (const [item, code] of [[invited, 'ISSUED_DOCUMENT_LOCK'], [archived, 'PROCESS_DATA_LOCKED'], [concluded, 'PROCESS_DATA_LOCKED']] as const) {
      const response = await f.request(endpoint(item.id), advisor, 'PATCH', correction);
      assert.equal(response.status, 409, item.id);
      assert.equal((await response.json()).code, code);
    }
    const approved = await f.request(endpoint(invited.id), advisor, 'PATCH', {
      ...correction, expectedDataRevision: invited.dataRevision, revalidateIssuedInvitation: true,
    });
    assert.equal(approved.status,202,await approved.clone().text());
    const restarted = await approved.json();
    assert.equal(restarted.titulo,correction.titulo);
    assert.equal(restarted.reservationRestarted,true);
    assert.equal(restarted.defesa.invitationSentAt,undefined);
    assert.equal(restarted.defesa.localStatus,'PENDENTE');
    assert.equal(restarted.defesa.reservationHistory[0].invitationSentAt,invited.defesa.invitationSentAt);
    const reopen = await f.request(endpoint(concluded.id) + '/repository/reopen', student, 'POST', {});
    assert.equal(reopen.status, 409);
    assert.equal((await reopen.json()).code, 'REPOSITORY_CLOSED');
    assert.deepEqual((await f.state()).signatureJobs, signatureJobs);
  } finally { await f.close(); }
});

test('HTTP: historical board roles cannot override the registered advisor', { timeout: 45_000 }, async () => {
  const process = processFixture();
  process.defesa = {...process.defesa,localStatus:'CONFIRMADO',startAt:new Date(Date.now()-3600_000).toISOString(),invitationSentAt:now()};
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

test('HTTP: final delivery requires the deposit, protects closed records and keeps each publication choice private before signature', { timeout: 60_000 }, async () => {
  const choices = [[false, false], [true, false], [false, true], [true, true]];
  const ready = (id: string) => {
    const process = processFixture(id);
    process.status = 'AGUARDANDO_DADOS_FINAIS';
    process.etapaAtual = 'REPOSITORIO';
    process.defesa.startAt = '2025-02-20T17:00:00.000Z';
    process.avaliacao = { status: 'CONCLUIDO' };
    process.acervo = {
      trabalhoCompletoFileId: 'fixture-pdf',
      trabalhoCompletoFileUrl: 'https://example.invalid/fixture-pdf',
      resumoExpandidoFileId: 'fixture-abstract',
    };
    return process;
  };
  const variants = choices.map((_, index) => ready(`publication-${index}`));
  const missingPdf = ready('missing-deposit');
  missingPdf.acervo = undefined;
  const closed = ready('completed-deposit');
  closed.status = 'CONCLUIDO';
  closed.etapaAtual = 'CONCLUIDO';
  const processes = [...variants, missingPdf, closed];
  const state = initialState(processes);
  const f = await fixture({
    ...state,
    settings: { ...state.settings, documentModels: {
      TERMO: { type: 'TERMO', driveFileId: 'fixture-term-model' },
      DECLARACAO: { type: 'DECLARACAO', driveFileId: 'fixture-declaration-model' },
    } },
    signatureJobs: processes.map(process => ({
      id: `ata-${process.id}`, processId: process.id, documentType: 'ATA', documentVersion: 1,
      sourceDataRevision: process.dataRevision, status: 'ARCHIVED', driveSignedFileId: 'fixture-ata',
    })),
  });
  const data = { resumoSintese: 'Resumo sintético para o teste.', palavrasChave: ['a', 'b', 'c', 'd', 'e'] };
  const submit = (id: string, payload: object, email = student) => f.request(`/api/processes/${id}/final-data`, email, 'POST', payload);
  try {
    assert.equal((await submit(variants[0].id, data, advisor)).status, 403);
    for (const palavrasChave of [data.palavrasChave.slice(1), [...data.palavrasChave, 'f']]) {
      const rejected = await submit(variants[0].id, { ...data, palavrasChave });
      assert.equal(rejected.status, 400);
      assert.match((await rejected.json()).error, /exatamente cinco/);
    }
    const withoutSummary = await submit(variants[0].id, { ...data, resumoSintese: '  ' });
    assert.equal(withoutSummary.status, 400);
    assert.match((await withoutSummary.json()).error, /resumo/);
    const withoutPdf = await submit(missingPdf.id, data);
    assert.equal(withoutPdf.status, 400);
    assert.match((await withoutPdf.json()).error, /Anexe o PDF/);
    assert.equal((await submit(closed.id, data)).status, 409);
    assert.equal((await f.request(`/api/processes/${closed.id}/repository/reopen`, student, 'POST')).status, 409);
    assert.equal((await f.request(`/api/processes/${closed.id}`, student, 'PATCH', { titulo: 'Alteração após conclusão' })).status, 409);
    assert.equal((await f.request(`/api/processes/${closed.id}/evaluation`, advisor, 'POST', { resultado: 'Reprovado' })).status, 409);
    assert.equal((await f.request(`/api/processes/${closed.id}/files/trabalho-completo`, student, 'POST', {})).status, 409);
    for (const [index, [publishFullWork, publishExpandedAbstract]] of choices.entries()) {
      const { id } = variants[index];
      const result = await submit(id, { ...data, publishFullWork, publishExpandedAbstract });
      assert.ok([200, 202].includes(result.status), await result.clone().text());
      const updated = await result.json();
      assert.equal(updated.acervo.publishFullWork, publishFullWork);
      assert.equal(updated.acervo.publishExpandedAbstract, publishExpandedAbstract);
      assert.equal(Boolean(updated.acervo.authorizationConfirmedAt), publishFullWork || publishExpandedAbstract);
      assert.equal(updated.status, 'AGUARDANDO_ASSINATURA');
      for (const artifact of ['trabalho-completo', 'resumo-expandido']) {
        assert.equal((await f.request(`/api/public/processes/${id}/files/${artifact}/download`, '', 'GET', undefined, '')).status, 404);
      }
    }
    const persisted = await f.state();
    assert.equal(persisted.signatureJobs.length, processes.length, 'submission does not falsely record a provider signature');
    assert.equal(persisted.processes.find((process: { id: string }) => process.id === missingPdf.id).acervo?.submittedAt, undefined);
  } finally {
    await f.close();
  }
});

test('HTTP: the retired document correction route rejects new requests and preserves history', { timeout: 45_000 }, async () => {
  const open = processFixture();
  const finished = processFixture('closed-correction-process');
  finished.status = 'CONCLUIDO';
  finished.etapaAtual = 'CONCLUIDO';
  finished.avaliacao = { status: 'CONCLUIDO' };
  const historicalTicket = {
    id: 'historical-correction', processId: open.id, documentId: 'doc-ata', documentVersion: 1,
    requestedByEmail: student, requestedByRoles: ['STUDENT'], description: 'Registro histórico da solicitação.',
    status: 'CORRIGIDO', createdAt: now(),
  };
  const f = await fixture(initialState([open, finished], [historicalTicket]));
  const path = (id: string, doc: string) => `/api/processes/${id}/documents/${doc}/correction-request`;
  try {
    assert.equal((await f.request(path(open.id, 'doc-ata'), '', 'POST', {}, '')).status, 401);
    const before = await f.state();
    for (const process of [open, finished]) {
      for (const [role, doc] of [[student, 'doc-convite'], [advisor, 'doc-ata'], [student, 'doc-termo'], [master, 'doc-declaracao']]) {
        const result = await f.request(path(process.id, doc), role, 'POST', { description: 'Pedido da versão anterior do Portal.' });
        assert.equal(result.status, 410);
        assert.equal((await result.json()).code, 'DOCUMENT_CORRECTION_REQUEST_RETIRED');
      }
    }
    const history = await f.request('/api/admin/correction-requests', master);
    assert.equal(history.status, 200);
    assert.deepEqual(await history.json(), [historicalTicket]);
    assert.deepEqual(await f.state(), before, 'retired requests never change documents, tickets or audit records');
  } finally { await f.close(); }
});

test('HTTP: Presidency sees only eligible declarations and cannot modify unrelated TCCs or administrative settings', { timeout: 45_000 }, async () => {
  const president = 'president@boundaries.invalid';
  const unrelated = processFixture();
  const ready = processFixture('ready-declaration');
  ready.status = 'AGUARDANDO_ASSINATURA';
  ready.avaliacao = { status: 'CONCLUIDO' };
  ready.acervo = {
    submittedAt: now(), palavrasChave: ['a','b','c','d','e'], resumoSintese: 'Resumo para a declaração',
    trabalhoCompletoFileUrl: '/restricted-pdf-should-not-leak', publishFullWork: false
  };
  const job = (id: string, documentType: string, overrides = {}) => ({
    id, processId: ready.id, documentType, status: 'QUEUED', provider: 'ASTEN',
    sourceDataRevision: ready.dataRevision, documentVersion: 1, updatedAt: now(),
    renderVariables: { ALUNO_EMAIL: student }, ...overrides
  });
  const state = initialState([unrelated, ready]);
  const f = await fixture({ ...state, settings: {...state.settings, commissionPresidentEmail: president, commissionPresidentName: 'Presidente de teste', documentModels: {
    DECLARACAO: { type: 'DECLARACAO', driveFileId: 'fixture-declaration-model' },
  }}, signatureJobs: [
    job('archived-ata', 'ATA', { status: 'ARCHIVED', driveSignedFileId: 'private-ata-drive-file' }),
    job('declaration', 'DECLARACAO'),
  ]});
  try {
    const list = await f.request('/api/processes', president);
    assert.equal(list.status, 200);
    assert.deepEqual(await list.json(), []);
    for (const suffix of ['', '/documents', '/audit-logs', '/files/trabalho-completo/download', '/documents/doc-ata/download']) {
      assert.equal((await f.request(`/api/processes/${ready.id}${suffix}`, president)).status, 404, suffix);
    }
    assert.equal((await f.request(`/api/processes/${unrelated.id}`, president, 'PATCH', {titulo: 'Alteração indevida'})).status, 404);
    assert.equal((await f.request(`/api/processes/${unrelated.id}`, president, 'DELETE', {confirmation: 'EXCLUIR', expectedProcessId: unrelated.id})).status, 403);
    assert.equal((await f.request('/api/admin/restore-full-backup', president, 'POST', {})).status, 403);
    assert.equal((await f.request('/api/admin/backup', president)).status, 403);
    assert.equal((await f.request('/api/admin/settings', president, 'PATCH', {emailConfig: {senderLabel: 'Indevido'}})).status, 403);
    assert.equal((await f.request('/api/admin/administration-transfers', president, 'POST', {role: 'MASTER_ADMIN', targetEmail: president})).status, 403);
    assert.equal((await f.request('/api/signatures/jobs/archived-ata/retry', president, 'POST', {})).status, 404);
    assert.equal((await f.request(`/api/processes/${unrelated.id}/documents/DECLARACAO/sign`, president, 'POST', {})).status, 404);

    const queue = await f.request('/api/president/signature-queue', president);
    assert.equal(queue.status, 200);
    assert.match(queue.headers.get('cache-control') || '', /no-store/);
    const rows = await queue.json();
    assert.deepEqual(rows.map((item: {process:{id:string}}) => item.process.id), [ready.id]);
    assert.deepEqual(rows[0].documents.map((item: {type:string}) => item.type), ['DECLARACAO']);
    assert.deepEqual(rows[0].jobs.map((item: {id:string}) => item.id), ['declaration']);
    assert.doesNotMatch(JSON.stringify(rows), /author@boundaries|restricted-pdf-should-not-leak|private-ata-drive-file/);

    const scopedJobs = await f.request(`/api/processes/${ready.id}/signatures`, president);
    assert.equal(scopedJobs.status, 200);
    assert.deepEqual((await scopedJobs.json()).map((item: {id:string}) => item.id), ['declaration']);
    const prepared = await f.request(`/api/processes/${ready.id}/documents/DECLARACAO/sign`, president, 'POST', { provider: 'GOV_BR' });
    assert.equal(prepared.status, 200, await prepared.clone().text());
    const { job: declaration } = await prepared.json();
    assert.equal(declaration.status, 'READY_FOR_REVIEW');
    assert.deepEqual(declaration.signers.map((signer: {email:string}) => signer.email), [president]);
    const downloadPath = `/api/signatures/jobs/${declaration.id}/govbr/download`;
    const pdf = await f.request(downloadPath, president);
    assert.equal(pdf.status, 200);
    assert.equal((await pdf.text()).slice(0, 5), '%PDF-');
    const stranger = 'outsider@boundaries.invalid';
    const denied = await f.request(downloadPath, stranger);
    const unknown = await f.request('/api/signatures/jobs/missing/govbr/download', stranger);
    assert.equal(denied.status, 404);
    assert.deepEqual(await denied.json(), await unknown.json());
    assert.equal((await f.request(`/api/processes/${unrelated.id}`, master)).status, 200);
    assert.equal((await f.state()).processes.length, 2);
  } finally { await f.close(); }
});

test('HTTP: examiner-only enrollment cannot register, and an independently authorized student can', { timeout: 45_000 }, async () => {
  const process = processFixture();
  const examiner = process.banca[0].email;
  const state = initialState([process]);
  state.authorizedStudents.push({ ...state.authorizedStudents[0], id: 'access-examiner', email: examiner,
    roles: ['EXAMINER'], accessType: 'EXAMINER', origin: 'TCC_FORM' });
  state.memberships.push({ ...state.memberships[0], id: 'member-examiner', email: examiner, roles: ['EXAMINER'] });
  const f = await fixture(state);
  try {
    assert.equal((await (await f.request('/api/me', examiner)).json()).canRegisterProcess, false);
    assert.equal((await f.request('/api/processes', examiner, 'POST', {})).status, 403);
    assert.equal((await f.request('/api/forms/registration-schema', examiner)).status, 403);
    assert.equal((await f.request('/api/forms/registration-suggestions?field=email&q=aut', examiner)).status, 403);
    const email = 'new-author@boundaries.invalid';
    assert.equal((await (await f.request('/api/me', email)).json()).canRegisterProcess, true);
    assert.equal((await f.request('/api/forms/registration-schema', email)).status, 200);
  } finally { await f.close(); }
});
