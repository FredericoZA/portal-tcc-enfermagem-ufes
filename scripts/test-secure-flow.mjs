#!/usr/bin/env node

import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = fileURLToPath(new URL('..', import.meta.url));
const results = [];
const failures = [];

function record(name, error) {
  if (error) {
    failures.push({ name, error: error instanceof Error ? error.message : String(error) });
    console.error(`FAIL  ${name}: ${error instanceof Error ? error.message : String(error)}`);
  } else {
    results.push(name);
    console.log(`PASS  ${name}`);
  }
}

async function check(name, fn) {
  try {
    await fn();
    record(name);
  } catch (error) {
    record(name, error);
  }
}

function includesEvery(haystack, needles) {
  for (const needle of needles) assert.ok(haystack.includes(needle), `não encontrou ${JSON.stringify(needle)}`);
}

async function staticChecks() {
  const [server, types, auth, otp, asten, envExample, pdfHelpers, presidentPage, popupPreview, studioPanel, supabaseRuntime, transactionalMigration, outboxMigration] = await Promise.all([
    readFile(path.join(projectRoot, 'server.ts'), 'utf8'),
    readFile(path.join(projectRoot, 'src/types/index.ts'), 'utf8'),
    readFile(path.join(projectRoot, 'server/security/firebaseAuth.ts'), 'utf8'),
    readFile(path.join(projectRoot, 'server/security/portalOtp.ts'), 'utf8'),
    readFile(path.join(projectRoot, 'server/integrations/asten.ts'), 'utf8'),
    readFile(path.join(projectRoot, '.env.example'), 'utf8'),
    readFile(path.join(projectRoot, 'src/utils/pdfHelpers.ts'), 'utf8'),
    readFile(path.join(projectRoot, 'src/pages/CoordenadorPage.tsx'), 'utf8'),
    readFile(path.join(projectRoot, 'src/components/editor/PopupPreviewSection.tsx'), 'utf8'),
    readFile(path.join(projectRoot, 'src/components/IntegrationStudioPanel.tsx'), 'utf8'),
    readFile(path.join(projectRoot, 'server/integrations/supabase.ts'), 'utf8'),
    readFile(path.join(projectRoot, 'supabase/migrations/202608310001_portal_transactional_runtime.sql'), 'utf8'),
    readFile(path.join(projectRoot, 'supabase/migrations/202609060001_asten_transactional_outbox_v6.sql'), 'utf8')
  ]);

  await check('papéis globais limitados a Master e Presidente', () => {
    assert.ok(!server.includes('COURSE_COORDINATOR'), 'server.ts ainda contém COURSE_COORDINATOR');
    assert.ok(!types.includes('COURSE_COORDINATOR'), 'GlobalRole ainda contém COURSE_COORDINATOR');
    assert.match(types, /GlobalRole\s*=\s*'MASTER_ADMIN'\s*\|\s*'COMMISSION_PRESIDENT'/);
  });

  await check('lista de acesso usa o guardião de administração máxima', () => {
    assert.match(server, /\['\/api\/admin\/access-list','\/api\/admin\/students'\][^\n]*requireAuthenticated,requireAdministrator/);
    assert.match(server, /\['\/api\/admin\/access-list\/:id','\/api\/admin\/students\/:id'\][^\n]*requireAuthenticated,requireAdministrator/);
  });

  await check('limite de autoria não bloqueia outras participações', () => {
    includesEvery(server, [
      'Cada aluno pode autuar apenas um TCC',
      'process.aluno1.email',
      'process.aluno2?.email',
      "'EXAMINER'",
      "role:'CO_ADVISOR'"
    ]);
    assert.ok(!/membershipsStore[^;]{0,400}Cada aluno pode autuar/.test(server), 'o limite de TCC parece usar memberships em vez de somente autores');
  });

  await check('participantes do primeiro formulário entram na autorização', () => {
    includesEvery(server, [
      "role:'STUDENT',origin:'TCC_FORM'",
      "role:'ADVISOR',origin:'TCC_FORM'",
      "role:'CO_ADVISOR',origin:'TCC_FORM'",
      "role:examiner.funcao==='ORIENTADOR'?'ADVISOR':'EXAMINER'"
    ]);
  });

  await check('OTP é enumerativamente neutro, expirável e de uso único', () => {
    includesEvery(server, [
      '/api/auth/request-code',
      'Se o e-mail estiver autorizado, um código será enviado.',
      '/api/auth/verify-code'
    ]);
    includesEvery(otp, [
      "createHmac('sha256'",
      '10 * 60_000',
      'max_attempts: 5',
      'consumed_at',
      'Este código já foi utilizado.'
    ]);
    includesEvery(auth, ['HttpOnly', 'SameSite=Lax', 'timingSafeEqual']);
  });

  await check('downloads privados exigem sessão e vínculo ao processo', () => {
    assert.match(server, /app\.get\('\/api\/processes\/:id\/files\/:kind\/download',requireAuthenticated/);
    assert.match(server, /if\(!process\|\|!canAccessProcess\(identity\.email,process\.id\)\)return res\.status\(404\)/);
    assert.ok(server.includes("'Cache-Control','private, no-store'"), 'download privado sem Cache-Control private, no-store');
  });

  await check('download público tem rota separada e política por artefato', () => {
    assert.ok(/\/api\/public\/processes\/:id\/files\/:kind\/download/.test(server), 'rota pública separada não encontrada');
    includesEvery(server, ['publishFullWork', 'publishExpandedAbstract']);
  });

  await check('Asten usa os signatários e a ordem definidos', () => {
    assert.match(server, /if\(type==='ATA'\)return\[\{[^\n]*role:'ADVISOR'/);
    assert.match(server, /if\(type==='TERMO'\)\{[\s\S]{0,1400}role:'STUDENT'[\s\S]{0,500}signingOrder:1[\s\S]{0,1200}role:'ADVISOR'[\s\S]{0,400}signingOrder:2/);
    assert.match(server, /role:'PRESIDENT'[^\n]*signingOrder:1/);
    assert.match(asten, /ordem:\s*s\.order/);
  });

  await check('webhook Asten é autenticado e idempotente', () => {
    includesEvery(server, ['safeCompareWebhookSecret', 'normalizeAstenWebhookEvent', 'event.duplicate', 'duplicate:true']);
    includesEvery(asten, ['timingSafeEqual', 'ASTEN_WEBHOOK_SECRET', 'fingerprintWebhook']);
  });

  await check('auditoria aceita busca no servidor', () => {
    assert.match(server, /\/api\/admin\/audit-logs[^\n]*req/);
    assert.ok(/req\.query\.(q|search)|String\(req\.query\?\.(q|search)/.test(server), 'a rota de auditoria ainda não aplica q/search');
  });

  await check('segredos não são expostos em configuração ou VITE_', () => {
    includesEvery(server, ['containsSensitiveConfigurationKey', 'Segredos não podem ser salvos nas configurações.']);
    assert.ok(!/VITE_[A-Z0-9_]*(SECRET|TOKEN|API_KEY|PRIVATE_KEY)/.test(envExample), 'há segredo com prefixo público VITE_ no .env.example');
    assert.ok(!/^ASTEN_API_KEY\s*=.+$/m.test(envExample), 'token Asten não deve ser persistido em .env.example');
    for (const line of envExample.split(/\r?\n/)) {
      if (!/^[A-Z0-9_]*(SECRET|TOKEN|PEPPER|ENCRYPTION_KEY|PRIVATE_KEY)=/.test(line)) continue;
      assert.match(line, /=\s*""\s*$/, `valor sensível preenchido em .env.example: ${line.split('=')[0]}`);
    }
  });

  await check('PDFs não são persistidos no snapshot como Base64',()=>{
    assert.match(server,/signatureJobsStore\.map\(\(\{artifactBase64:_artifact,\.\.\.job\}\)=>job\)/);
    assert.match(server,/formArchiveJobsStore\.map\(\(\{artifactBase64:_artifact,\.\.\.job\}\)=>\(\{\.\.\.job,artifactBase64:''\}\)\)/);
  });

  await check('declaração não possui modelo textual embutido no portal',()=>{
    assert.ok(!pdfHelpers.includes('%PDF-1.4'), 'pdfHelpers ainda contém um PDF de declaração fixo');
    assert.ok(!pdfHelpers.includes('createDeclarationPdfBlob'), 'gerador local de declaração ainda existe');
    assert.ok(presidentPage.includes("downloadProcessDocument(proc.id, 'doc-declaracao')"), 'Área do Presidente não baixa a declaração assinada pela rota autenticada');
  });

  await check('prévia de login representa o acesso por e-mail e código',()=>{
    assert.ok(!popupPreview.includes('CPF ou Matrícula'), 'prévia ainda solicita CPF ou matrícula');
    assert.ok(!popupPreview.includes('Senha de Acesso'), 'prévia ainda solicita senha');
    includesEvery(popupPreview, ['E-mail institucional ou cadastrado', 'Código de confirmação']);
  });

  await check('convite usa o modelo de e-mail publicado pelo Master',()=>{
    includesEvery(server, ['buildPublishedInvitationEmail', 'Publique o modelo de e-mail', 'mergeWorkflowVariables']);
    assert.ok(!server.includes('const inviteSubject='), 'o assunto do convite continua fixo no servidor');
    assert.ok(!server.includes('const inviteText='), 'o corpo do convite continua fixo no servidor');
  });

  await check('Estúdio não persiste conteúdo de modelos documentais',()=>{
    assert.ok(!studioPanel.includes('value={selectedDoc.templateContentText}'), 'o Estúdio ainda permite editar o conteúdo do documento no portal');
    assert.ok(studioPanel.includes("templateContentText: ''"), 'o snapshot do Estúdio não limpa o conteúdo documental');
    assert.ok(studioPanel.includes('Fonte oficial única.'), 'a interface não explica a fonte externa única do modelo');
    assert.ok(server.includes('DOCX_LAYOUT_IS_SOURCE_OF_TRUTH'), 'a API antiga ainda pode reestilizar o DOCX oficial');
  });

  await check('Supabase usa commit transacional com revisão otimista e projeções normalizadas',()=>{
    includesEvery(supabaseRuntime, ['/rest/v1/rpc/portal_commit_runtime_state', 'expected_revision', 'portal_runtime_capabilities', 'transactionalRuntimeReady']);
    includesEvery(transactionalMigration, ['for update', "errcode='40001'", 'portal_project_runtime_state', 'portal_runtime_commits', 'portal_signature_jobs', 'portal_email_deliveries', 'portal_audit_events']);
    assert.ok(server.includes('incluindo a outbox transacional Asten v6'), 'produção não bloqueia a ausência do runtime seguro v6');
    assert.ok(outboxMigration.includes("'outcome','UNCERTAIN'"), 'resultado ambíguo da Asten não fica bloqueado contra recriação');
    assert.ok(!server.includes('const queued = remotePersistenceQueue;'), 'a resposta ainda captura uma fila antiga antes de a rota agendar o próprio commit');
    assert.match(server, /res\.json = \(\(body: unknown\) => \{[\s\S]{0,700}remotePersistenceQueue\.then\(\(\) => originalJson\(body\)\)/, 'resposta de escrita não aguarda a fila vigente no momento do envio');
  });
}

async function waitForHealth(baseUrl, child) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`servidor encerrou com código ${child.exitCode}`);
    try {
      const response = await fetch(`${baseUrl}/api/health`);
      if (response.ok) return;
    } catch { /* inicialização em andamento */ }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error('servidor local não ficou saudável em 30 segundos');
}

async function liveChecks() {
  const port = 39000 + Math.floor(Math.random() * 1500);
  const baseUrl = `http://127.0.0.1:${port}`;
  const dataDir = await mkdtemp(path.join(tmpdir(), 'portal-tcc-security-'));
  await writeFile(path.join(dataDir,'portal-state.json'),JSON.stringify({signatureJobs:[{id:'fixture-ata-archived',processId:'demo-proc-3',documentType:'ATA',documentVersion:1,sourceDataRevision:1,status:'ARCHIVED',driveSignedFileId:'fixture-signed-pdf',createdAt:'2026-01-01T00:00:00Z',completedAt:'2026-01-02T00:00:00Z',updatedAt:'2026-01-02T00:00:00Z',signers:[]}]}));
  const output = [];
  // The direct Node loader avoids the tsx CLI IPC socket, which is blocked in
  // some CI/sandbox environments while preserving the same TypeScript runtime.
  const child = spawn(process.execPath, ['--import', 'tsx', 'server.ts'], {
    cwd: projectRoot,
    env: {
      ...process.env,
      NODE_ENV: 'development',
      PORT: String(port),
      PORTAL_DATA_DIR: dataDir,
      PORTAL_SESSION_SECRET: 'test-session-secret-0123456789-abcdef',
      PORTAL_OTP_PEPPER: 'test-otp-pepper-0123456789-abcdefghi',
      PORTAL_ALLOW_LOCAL_OTP_STORE: 'true',
      PORTAL_ALLOW_INSECURE_DEMO_AUTH: 'true',
      PORTAL_OTP_DELIVERY_MODE: 'log',
      PORTAL_OTP_TEST_CODE: '123456',
      ASTEN_INTEGRATION_ENABLED: 'false',
      ASTEN_WEBHOOK_SECRET: 'test-webhook-secret-0123456789abcdef',
      PORTAL_TEST_DOCUMENT_RENDERER: 'true',
      PORTAL_PERSISTENCE_PROVIDER: 'local_file'
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  child.stdout.on('data', (chunk) => output.push(String(chunk)));
  child.stderr.on('data', (chunk) => output.push(String(chunk)));

  const master = 'master@portal.local';
  const president = 'presidente@portal.local';
  const ordinaryStudent = 'mariana.silva@aluno.ufes.br';
  const newStudent = 'security.test.student@aluno.ufes.br';
  const asUser = (email) => ({ 'content-type': 'application/json', 'x-demo-user-email': email });
  const request = async (pathname, options = {}) => {
    const response = await fetch(`${baseUrl}${pathname}`, options);
    const text = await response.text();
    let body;
    try { body = text ? JSON.parse(text) : null; } catch { body = text; }
    return { response, body };
  };

  try {
    try {
      await waitForHealth(baseUrl, child);
      record('runtime: servidor isolado iniciou');
    } catch (error) {
      record('runtime: servidor isolado iniciou', error);
      return;
    }

    await check('runtime: só Master e Presidente administram a lista', async () => {
      const unauth = await request('/api/admin/access-list');
      const masterResponse = await request('/api/admin/access-list', { headers: asUser(master) });
      const presidentResponse = await request('/api/admin/access-list', { headers: asUser(president) });
      const studentResponse = await request('/api/admin/access-list', { headers: asUser(ordinaryStudent) });
      const inventedCoordinator = await request('/api/admin/access-list', { headers: asUser('coordenacao.teste@ufes.br') });
      assert.equal(unauth.response.status, 401);
      assert.equal(masterResponse.response.status, 200);
      assert.equal(presidentResponse.response.status, 200);
      assert.equal(studentResponse.response.status, 403);
      assert.equal(inventedCoordinator.response.status, 403);
    });

    await check('runtime: um TCC por autor e participação ilimitada em outro', async () => {
      const profileConfigured = await request('/api/admin/installation-profile', {
        method: 'PATCH', headers: asUser(master), body: JSON.stringify({
          profile: {
            installationId: 'portal-test', portalName: 'Portal TCC Teste', institutionName: 'Instituição Teste', institutionAcronym: 'IT',
            courseName: 'Curso Teste', courseAcronym: 'CT', departmentName: 'Unidade Teste', campusName: 'Campus Teste', city: 'Cidade/UF',
            countryCode: 'BR', locale: 'pt-BR', studentEmailDomains: ['aluno.ufes.br'], internalEmailDomains: ['ufes.br'],
            protocolPrefix: 'TCC', driveRootFolderName: 'PORTAL_TCC_TESTE', defaultInstitutionName: 'Instituição Teste', defaultDefenseLocation: 'Local a confirmar'
          }
        })
      });
      assert.equal(profileConfigured.response.status, 200, JSON.stringify(profileConfigured.body));
      const authorized = await request('/api/admin/access-list', {
        method: 'POST', headers: asUser(master), body: JSON.stringify({ nome: 'Aluno Teste Segurança', email: newStudent, matricula: '2026999999' })
      });
      assert.equal(authorized.response.status, 201, JSON.stringify(authorized.body));
      const payload = {
        aluno1: { nome: 'Aluno Teste Segurança', email: newStudent, matricula: '2026999999' },
        aluno2: null,
        orientador: { nome: 'Orientadora Nova', email: 'orientadora.nova@ufes.br', siape:'1234567' },
        coorientador: null,
        titulo: 'Teste de autorização por papel no processo',
        banca: [
          { nome: 'Mariana Silva de Oliveira', email: ordinaryStudent, funcao: 'EXAMINER_2', instituicao: 'UFES' },
          { nome: 'Examinador Externo', email: 'examinador.seguro@example.org', funcao: 'EXAMINER_3', instituicao: 'Instituição Externa' }
        ],
        defesa: { local:'Auditório do Departamento de Enfermagem', startAt: '2026-12-10T14:00:00.000Z', localStatus: 'PENDENTE' }
      };
      const created = await request('/api/processes', { method: 'POST', headers: asUser(master), body: JSON.stringify(payload) });
      assert.ok([201,202].includes(created.response.status), JSON.stringify(created.body));
      assert.ok(created.body?.id);
      const duplicate = await request('/api/processes', { method: 'POST', headers: asUser(master), body: JSON.stringify({ ...payload, titulo: 'Segundo TCC proibido' }) });
      assert.equal(duplicate.response.status, 409, JSON.stringify(duplicate.body));
      const list = await request('/api/admin/access-list', { headers: asUser(master) });
      const mariana = list.body.find((entry) => entry.email === ordinaryStudent);
      assert.ok(mariana?.roles?.includes('STUDENT'));
      assert.ok(mariana?.roles?.includes('EXAMINER'));
    });

    await check('runtime: OTP autorizado é de uso único', async () => {
      const requested = await request('/api/auth/request-code', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: newStudent }) });
      assert.equal(requested.response.status, 200, JSON.stringify(requested.body));
      const verified = await request('/api/auth/verify-code', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: newStudent, code: '123456' }) });
      assert.equal(verified.response.status, 200, JSON.stringify(verified.body));
      assert.match(verified.response.headers.get('set-cookie') || '', /HttpOnly/i);
      const reused = await request('/api/auth/verify-code', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: newStudent, code: '123456' }) });
      assert.equal(reused.response.status, 401, JSON.stringify(reused.body));
    });

    await check('runtime: download privado não revela existência', async () => {
      const unauth = await request('/api/processes/demo-proc-3/files/trabalho-completo/download');
      const unrelated = await request('/api/processes/demo-proc-3/files/trabalho-completo/download', { headers: asUser('joao.pedro@aluno.ufes.br') });
      assert.equal(unauth.response.status, 401);
      assert.equal(unrelated.response.status, 404);
    });

    await check('runtime: rota pública é anônima e separada', async () => {
      const unknown = await request('/api/public/processes/processo-inexistente/files/trabalho-completo/download');
      assert.equal(unknown.response.status, 404, `esperava 404 anônimo; recebeu ${unknown.response.status}`);
    });

    await check('runtime: DTO público não expõe e-mails nem metadados internos', async () => {
      const publicList = await request('/api/processes');
      assert.equal(publicList.response.status, 200, JSON.stringify(publicList.body));
      const serialized = JSON.stringify(publicList.body);
      for (const forbidden of ['invitationRecipients','invitationDriveFileId','localEvidenceUrl','localConfirmedBy','submittedBy','driveFolderId','createdByEmail']) {
        assert.ok(!serialized.includes(forbidden), `campo interno exposto: ${forbidden}`);
      }
      assert.ok(!/@(?:ufes\.br|aluno\.ufes\.br|example\.org)/i.test(serialized), 'um e-mail pessoal apareceu na resposta pública');
    });

    await check('runtime: aluno não altera participantes pelo PATCH genérico', async () => {
      const before = await request('/api/processes/demo-proc-3', { headers: asUser('lucas.almeida@aluno.ufes.br') });
      assert.equal(before.response.status, 200, JSON.stringify(before.body));
      const attempted = await request('/api/processes/demo-proc-3', { method:'PATCH', headers:asUser('lucas.almeida@aluno.ufes.br'), body:JSON.stringify({orientador:{nome:'Atacante',email:'atacante@example.org'},banca:[],defesa:{localStatus:'CONFIRMADO',invitationDriveFileId:'forjado'}}) });
      assert.ok([200,400,403,409].includes(attempted.response.status),JSON.stringify(attempted.body));
      if(attempted.response.status===200){
        assert.equal(attempted.body.orientador.email,before.body.orientador.email);
        assert.deepEqual(attempted.body.banca,before.body.banca);
        assert.equal(attempted.body.defesa.invitationDriveFileId,before.body.defesa.invitationDriveFileId);
      }
      const preserved=await request('/api/processes/demo-proc-3',{headers:asUser('lucas.almeida@aluno.ufes.br')});assert.equal(preserved.body.orientador.email,before.body.orientador.email);assert.deepEqual(preserved.body.banca,before.body.banca);assert.equal(preserved.body.defesa.invitationDriveFileId,before.body.defesa.invitationDriveFileId);
    });

    await check('runtime: respostas aplicam cabeçalhos de endurecimento', async () => {
      const response=await fetch(`${baseUrl}/api/health`);
      assert.equal(response.headers.get('x-content-type-options'),'nosniff');
      assert.equal(response.headers.get('x-frame-options'),'DENY');
      assert.match(response.headers.get('content-security-policy')||'',/default-src 'self'/);
      assert.match(response.headers.get('referrer-policy')||'',/(no-referrer|strict-origin)/);
    });

    await check('runtime: TERMO só existe quando há publicação', async () => {
      const models = Object.fromEntries(['CONVITE', 'ATA', 'TERMO', 'DECLARACAO'].map((type) => [type, {
        id: `model-${type.toLowerCase()}`, type, label: type, fileName: `${type}.docx`, driveFileId: `drive-model-${type.toLowerCase()}`, templateContentText: ''
      }]));
      const configured = await request('/api/admin/settings', {
        method: 'PATCH', headers: asUser(master),
        body: JSON.stringify({
          documentModels: models,
          // Publicar o Estúdio força a atualização do armazenamento de modelos
          // em memória, sem enviar qualquer arquivo para uma integração externa.
          integrationStudio: {
            schemaVersion: 3, revision: 999999, savedAt: new Date().toISOString(), savedBy: master,
            brandKit: { institutionName: 'Universidade de Teste', courseName: 'Curso de Teste', primaryColor: '#005830', secondaryColor: '#ffffff', accentColor: '#0f766e', textColor: '#ffffff', universityLogoUrl: '', courseLogoUrl: '', emailBannerUrl: '', fontFamily: 'Arial', documentHeaderText: '', documentFooterText: '', emailFooterText: '' },
            driveModelosFolderUrl: '', documentDesigns: {}, emailDesigns: {}, formDesigns: {}, matrixColumns: [{ id: 'AUTORIZACAO_TESTE', name: 'AUTORIZACAO_TESTE', label: 'Autorização de teste', dataType: 'text' }, { id: 'PUBLICAR_TRABALHO', name: 'PUBLICAR_TRABALHO', label: 'Publicar trabalho', dataType: 'text' }], matrixRows: [],
            docTemplates: Object.values(models).map((model) => ({ ...model, driveFileUrl: `https://drive.google.com/file/d/${model.driveFileId}/view` })),
            emailTemplates: [{ id: 'email-convite-test', name: 'Convite', recipient: '{{ORIENTADOR_EMAIL}}', subject: 'Convite {{PROTOCOLO}}', body: 'Segue o convite.', attachments: ['model-convite'] }], formTemplates: [{ id: 'confirmacao-aluno', title: 'Confirmação do aluno', stage: 'DADOS FINAIS', targetRole: 'Aluno', description: 'Formulário configurável para teste.', isActive: true, questions: [{ id: 'aceite', fieldKey: 'AUTORIZACAO_TESTE', label: 'Confirma a informação?', fieldType: 'select', expectedAnswer: '', options: ['Sim', 'Não'], required: true }] }],
            workflowStages: [
              { id: 'stage-invite', stageNumber: 1, title: 'Convite', triggerEvent: 'LOCATION_CONFIRMED', actions: [{ id: 'invite-doc', type: 'doc', refId: 'model-convite', title: 'Gerar convite' }, { id: 'invite-mail', type: 'email', refId: 'email-convite-test', title: 'Enviar convite' }] },
              { id: 'stage-ata', stageNumber: 2, title: 'Ata', triggerEvent: 'EVALUATION_SUBMITTED', actions: [{ id: 'ata-doc', type: 'doc', refId: 'model-ata', title: 'Gerar ata' }] },
              { id: 'stage-test', stageNumber: 3, title: 'Teste', triggerEvent: 'REPOSITORY_SUBMITTED', description: 'Libera o formulário configurável após os dados finais.', actions: [{ id: 'term-doc', type: 'doc', refId: 'model-termo', title: 'Gerar termo', condition: { fieldKey: 'PUBLICAR_TRABALHO', operator: 'IS_TRUE' } }, { id: 'action-test', type: 'form', refId: 'confirmacao-aluno', title: 'Liberar confirmação do aluno' }] }
              ,{ id:'stage-declaration',stageNumber:4,title:'Declaração',triggerEvent:'PUBLICATION_CLEARED',actions:[{id:'declaration-doc',type:'doc',refId:'model-declaracao',title:'Gerar declaração'}]}
            ],
            auditTrail: []
          }
        })
      });
      assert.equal(configured.response.status, 200, JSON.stringify(configured.body));
      const baseFinalData = {
        palavrasChave: ['Oncologia', 'Quimioterapia', 'Enfermagem', 'Segurança', 'Cuidado'],
        resumoSintese: 'Primeiro parágrafo do resumo sintético.\n\nSegundo parágrafo do resumo sintético.\n\nTerceiro parágrafo com conclusões.',
        workType: 'MONOGRAFIA'
      };
      const privateSubmission = await request('/api/processes/demo-proc-3/final-data', {
        method: 'POST', headers: asUser('lucas.almeida@aluno.ufes.br'),
        body: JSON.stringify({ ...baseFinalData, publishFullWork: false, publishExpandedAbstract: false, authorizationConfirmed: false })
      });
      assert.ok([200,202].includes(privateSubmission.response.status), JSON.stringify(privateSubmission.body));
      const privateDocs = await request('/api/processes/demo-proc-3/documents', { headers: asUser('lucas.almeida@aluno.ufes.br') });
      assert.equal(privateDocs.response.status, 200, JSON.stringify(privateDocs.body));
      assert.ok(!privateDocs.body.some((document) => document.type === 'TERMO'), 'TERMO apareceu sem publicação');
      const prohibitedTerm = await request('/api/processes/demo-proc-3/documents/TERMO/sign', { method: 'POST', headers: asUser('lucas.almeida@aluno.ufes.br'), body: '{}' });
      assert.equal(prohibitedTerm.response.status, 409, JSON.stringify(prohibitedTerm.body));

      const publicSubmission = await request('/api/processes/demo-proc-3/final-data', {
        method: 'POST', headers: asUser('lucas.almeida@aluno.ufes.br'),
        body: JSON.stringify({ ...baseFinalData, publishFullWork: true, publishExpandedAbstract: false, authorizationConfirmed: true })
      });
      assert.ok([200,202].includes(publicSubmission.response.status), JSON.stringify(publicSubmission.body));
      const publicDocs = await request('/api/processes/demo-proc-3/documents', { headers: asUser('lucas.almeida@aluno.ufes.br') });
      assert.equal(publicDocs.response.status, 200, JSON.stringify(publicDocs.body));
      assert.ok(publicDocs.body.some((document) => document.type === 'TERMO'), 'TERMO ausente com publicação autorizada');
    });

    await check('runtime: formulário futuro permanece bloqueado sem arquivamento da etapa anterior', async () => {
      const available = await request('/api/processes/demo-proc-3/forms', { headers: asUser('lucas.almeida@aluno.ufes.br') });
      assert.equal(available.response.status, 200, JSON.stringify(available.body));
      assert.ok(!available.body.some((form) => form.id === 'confirmacao-aluno'));
      const invalid = await request('/api/processes/demo-proc-3/forms/confirmacao-aluno/submissions', { method: 'POST', headers: asUser('lucas.almeida@aluno.ufes.br'), body: JSON.stringify({ answers: {} }) });
      assert.equal(invalid.response.status, 404, JSON.stringify(invalid.body));
    });

    await check('runtime: assinatura falha fechada sem Google Drive autorizado', async () => {
      const result = await request('/api/processes/demo-proc-3/documents/TERMO/sign', { method: 'POST', headers: asUser('lucas.almeida@aluno.ufes.br'), body: '{}' });
      assert.equal(result.response.status, 409, JSON.stringify(result.body));
      assert.ok(!result.body?.job, 'um trabalho Asten não deveria ser criado antes do arquivamento no Drive');
    });

    await check('runtime: webhook rejeita segredo errado e deduplica', async () => {
      const payload = { evento: 'teste_homologacao', idEnvelope: 'envelope-inexistente-001', status: 'EM_ANDAMENTO' };
      const rejected = await request('/api/integrations/asten/webhook', { method: 'POST', headers: { 'content-type': 'application/json', 'x-portal-webhook-key': 'errado' }, body: JSON.stringify(payload) });
      assert.equal(rejected.response.status, 401);
      const accepted = await request('/api/integrations/asten/webhook', { method: 'POST', headers: { 'content-type': 'application/json', 'x-portal-webhook-key': 'test-webhook-secret-0123456789abcdef' }, body: JSON.stringify(payload) });
      assert.equal(accepted.response.status, 200, JSON.stringify(accepted.body));
      assert.equal(accepted.body?.duplicate, undefined);
      const duplicate = await request('/api/integrations/asten/webhook', { method: 'POST', headers: { 'content-type': 'application/json', 'x-portal-webhook-key': 'test-webhook-secret-0123456789abcdef' }, body: JSON.stringify(payload) });
      assert.equal(duplicate.response.status, 200);
      assert.equal(duplicate.body?.duplicate, true);
    });

    await check('runtime: logs são pesquisáveis por pessoa ou código', async () => {
      const byPerson = await request(`/api/admin/audit-logs?q=${encodeURIComponent(newStudent)}`, { headers: asUser(master) });
      assert.equal(byPerson.response.status, 200);
      assert.ok(Array.isArray(byPerson.body) && byPerson.body.length > 0, 'busca por pessoa vazia');
      assert.ok(byPerson.body.every((entry) => JSON.stringify(entry).toLowerCase().includes(newStudent)));
      const processes = await request('/api/processes', { headers: asUser(master) });
      const created = processes.body.find((process) => process.aluno1?.email === newStudent);
      assert.ok(created?.protocolo);
      const byCode = await request(`/api/admin/audit-logs?q=${encodeURIComponent(created.protocolo)}`, { headers: asUser(master) });
      assert.equal(byCode.response.status, 200);
      assert.ok(byCode.body.length > 0, 'busca por código vazia');
      assert.ok(byCode.body.every((entry) => JSON.stringify(entry).toLowerCase().includes(created.protocolo.toLowerCase())));
    });

    await check('runtime: esquema inicial autenticado expõe somente o formulário do aluno', async () => {
      assert.equal((await request('/api/forms/registration-schema')).response.status, 401);
      const schema = await request('/api/forms/registration-schema', { headers: asUser(ordinaryStudent) });
      assert.equal(schema.response.status, 200);
      assert.equal(schema.body.operationalConfig.reservation.departmentEmail, '');
      assert.equal(schema.body.emailTemplates, undefined);
      assert.equal(schema.body.docTemplates, undefined);
      assert.ok(schema.body.formTemplates.every(form => form.id === 'form-reserva-aluno'));
    });

    await check('runtime: rascunho é privado, versionado e não aceita conflito silencioso', async () => {
      const draftStudent='rascunho.seguro@aluno.ufes.br';
      assert.equal((await request('/api/registration/draft')).response.status,401);
      const schema=(await request('/api/forms/registration-schema',{headers:asUser(draftStudent)})).body;
      const saved=await request('/api/registration/draft',{method:'PUT',headers:asUser(draftStudent),body:JSON.stringify({expectedRevision:0,schemaRevision:schema.revision,section:0,answers:{ALUNO_1_NOME:'Aluno de Rascunho',ALUNO_1_EMAIL:'redirecionado@example.org'}})});
      assert.equal(saved.response.status,200,JSON.stringify(saved.body));assert.equal(saved.body.answers.ALUNO_1_EMAIL,draftStudent);assert.equal(saved.body.revision,1);
      assert.equal((await request('/api/registration/draft',{headers:asUser('outro@aluno.ufes.br')})).body,null);
      const conflict=await request('/api/registration/draft',{method:'PUT',headers:asUser(draftStudent),body:JSON.stringify({expectedRevision:0,schemaRevision:schema.revision,answers:{}})});assert.equal(conflict.response.status,409);
      assert.equal((await request('/api/registration/draft',{method:'DELETE',headers:asUser(draftStudent)})).response.status,200);
    });

    await check('runtime: confirmação do local exige declaração explícita e comprovante válido', async () => {
      const processes=(await request('/api/processes',{headers:asUser(master)})).body;const target=processes.find(process=>process.aluno1?.email===newStudent);assert.ok(target?.id);
      const blocked=await request(`/api/processes/${target.id}/confirm-location`,{method:'POST',headers:asUser(master),body:JSON.stringify({local:'Auditório',confirmationReceived:false})});assert.equal(blocked.response.status,400);
      const badProof=await request(`/api/processes/${target.id}/location-proof`,{method:'POST',headers:asUser(master),body:JSON.stringify({fileName:'texto.pdf',contentBase64:Buffer.from('isto não é pdf').toString('base64')})});assert.equal(badProof.response.status,422);
    });

    await check('runtime: central de fluxo é administrativa e a prévia real falha fechada sem Google', async () => {
      assert.equal((await request('/api/admin/workflow/operations')).response.status,401);
      assert.equal((await request('/api/admin/workflow/operations',{headers:asUser(ordinaryStudent)})).response.status,403);
      const operations=await request('/api/admin/workflow/operations',{headers:asUser(master)});assert.equal(operations.response.status,200);assert.ok(Array.isArray(operations.body.queue));assert.ok(Array.isArray(operations.body.deadlines));
      const preview=await request('/api/admin/models/CONVITE/preview',{method:'POST',headers:asUser(master),body:JSON.stringify({answers:{TITULO:'Amostra'}})});assert.equal(preview.response.status,422);assert.equal(preview.body.contentBase64,undefined);
    });

    await check('runtime: panorama estatístico e exportações são administrativos', async () => {
      for (const format of ['', '?format=csv', '?format=pdf']) {
        assert.equal((await request('/api/admin/analytics/advanced' + format)).response.status, 401);
        assert.equal((await request('/api/admin/analytics/advanced' + format, { headers: asUser(ordinaryStudent) })).response.status, 403);
        const report = await request('/api/admin/analytics/advanced' + format, { headers: asUser(master) });
        assert.equal(report.response.status, 200);
        assert.match(report.response.headers.get('cache-control'), /no-store/);
        if (format.includes('pdf')) assert.match(report.body.slice(0, 8), /^%PDF-/);
        else if (format.includes('csv')) assert.match(report.body, /Tempo por etapa/);
        else assert.ok(Array.isArray(report.body.stages));
        assert.ok(!JSON.stringify(report.body).includes(ordinaryStudent));
      }
    });

    await check('runtime: simulador administrativo não grava efeitos no processo', async () => {
      const endpoint = '/api/admin/workflow/simulate';
      assert.equal((await request(endpoint, { method: 'POST', headers: asUser(ordinaryStudent), body: '{}' })).response.status, 403);
      const before = (await request('/api/processes', { headers: asUser(master) })).body;
      const simulation = await request(endpoint, { method: 'POST', headers: asUser(master), body: JSON.stringify({ scenario: { locationConfirmed: false } }) });
      assert.equal(simulation.response.status, 200, JSON.stringify(simulation.body));
      assert.equal(simulation.body.externalEffects, false);
      assert.deepEqual((await request('/api/processes', { headers: asUser(master) })).body, before);
    });

    await check('runtime: configuração recusa segredo aninhado', async () => {
      const attempt = await request('/api/admin/settings', {
        method: 'PATCH', headers: asUser(master), body: JSON.stringify({ integrations: { astenApiKey: 'nao-persistir' } })
      });
      assert.equal(attempt.response.status, 400, JSON.stringify(attempt.body));
    });
  } finally {
    child.kill('SIGTERM');
    await new Promise((resolve) => {
      const timer = setTimeout(resolve, 3000);
      child.once('exit', () => { clearTimeout(timer); resolve(); });
    });
    await rm(dataDir, { recursive: true, force: true });
    if (failures.length && process.env.PORTAL_TEST_VERBOSE === 'true') {
      console.error('\n--- saída do servidor local ---\n' + output.join('').slice(-12000));
    }
  }
}

console.log('Portal TCC — auditoria de fluxo seguro\n');
await staticChecks();
if (process.env.STATIC_ONLY !== 'true') await liveChecks();

console.log(`\nResultado: ${results.length} aprovados; ${failures.length} falharam.`);
if (failures.length) {
  console.error('\nFalhas:');
  for (const failure of failures) console.error(`- ${failure.name}: ${failure.error}`);
  process.exitCode = 1;
}
