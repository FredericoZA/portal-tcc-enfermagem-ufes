import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEMO_PROCESSES, DEMO_MEMBERSHIPS, INITIAL_SETTINGS } from '../src/services/demoSeed';

test('HTTP: orientador confere e registra avaliação; aluno é recusado; aparência dinâmica é ignorada', { timeout: 45000 }, async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'portal-evaluation-'));
  const p = structuredClone(DEMO_PROCESSES[0]);p.acervo.submittedAt=undefined;
  p.defesa = { ...p.defesa, localStatus: 'CONFIRMADO', startAt: new Date(Date.now() - 3600000).toISOString(), invitationSentAt: new Date().toISOString() };
  const settings = { ...structuredClone(INITIAL_SETTINGS), documentModels: { ATA: { type: 'ATA', driveFileId: 'fixture-model', fileName: 'Ata.docx' }, CONVITE: { type: 'CONVITE', driveFileId: 'fixture-invite', fileName: 'Convite.docx' }, TERMO: { type: 'TERMO', driveFileId: 'fixture-term', fileName: 'Termo.docx' }, DECLARACAO: { type: 'DECLARACAO', driveFileId: 'fixture-declaration', fileName: 'Declaração.docx' } } };
  const custom = { id: 'form-extra-rc10', title: 'Conferência adicional', targetRole: 'Orientador', isActive: true, questions: [
    { id: 'choice', fieldKey: 'ESCOLHA', label: 'Escolha', fieldType: 'select', required: true, options: ['Sim', 'Não'] },
    { id: 'accepted', fieldKey: 'ACEITO', label: 'Confirmo', fieldType: 'checkbox', required: true },
    { id: 'old-cpf', fieldKey: 'CAMPO_PESSOAL', label: 'CPF', fieldType: 'text', required: true },
  ] };
  settings.integrationStudio = { ...settings.integrationStudio, formTemplates: [...(settings.integrationStudio?.formTemplates || []), custom] } as any;
  const local = structuredClone(p);
  local.id = 'fixture-confirmed-location';
  local.defesa.invitationSentAt = undefined;
  local.defesa.localConfirmedBy = p.aluno1.email;
  local.defesa.localConfirmedAt = new Date().toISOString();
  const memberships = DEMO_MEMBERSHIPS.filter(m => m.processId === p.id);
  const fixtureExaminer=p.banca.find(member=>member.funcao==='EXAMINER_2')!;
  if(!memberships.some(member=>member.email===fixtureExaminer.email))memberships.push({
    id:'fixture-examiner-access',processId:p.id,email:fixtureExaminer.email,roles:['EXAMINER'],active:true,
    createdAt:p.createdAt,updatedAt:p.updatedAt,
  });
  const archived=structuredClone(p);archived.id='fixture-reopen-archived';archived.status='AGUARDANDO_DADOS_FINAIS';archived.avaliacao.status='CONCLUIDO';archived.acervo.firstSubmittedAt=undefined;
  const archivedJob={id:'fixture-archived-ata',processId:archived.id,documentType:'ATA',provider:'ASTEN',documentVersion:1,sourceDataRevision:archived.dataRevision,status:'ARCHIVED',driveSignedFileId:'fixture-signed-ata',signers:[]};
  const auto={...structuredClone(p),id:'fixture-asten-intent',protocolo:'TESTE-ASTEN-AUTO'};
  const resumed={...structuredClone(archived),id:'fixture-asten-sent',protocolo:'TESTE-ASTEN-SENT',astenSignatureIntent:{documentType:'ATA' as const,revision:archived.dataRevision,queuedAt:'2026-01-01T00:00:00Z'}};
  const sentJob={...archivedJob,id:'fixture-sent-ata',processId:resumed.id,status:'SENT',driveSignedFileId:undefined,providerEnvelopeId:'12345'};
  const unqueued={...structuredClone(p),id:'fixture-asten-unqueued',protocolo:'TESTE-ASTEN-UNQUEUED',
    status:'AGUARDANDO_ASSINATURA' as const,
    avaliacao:{...p.avaliacao,status:'CONCLUIDO' as const,submittedAt:new Date().toISOString(),documentRevision:p.dataRevision},
    signatureProviderPreferences:{ATA:'ASTEN' as const},
  };
  const deliveryFixtures=['TERMO','DECLARACAO'].map(type=>({
    ...structuredClone(archived),id:`fixture-final-${type}`,protocolo:`TESTE-FINAL-${type}`,
    acervo:{...archived.acervo,trabalhoCompletoFileUrl:'/private/fixture.pdf',trabalhoCompletoFileId:'fixture-work'},
  }));
  const deliveryJobs=deliveryFixtures.map(({id})=>({...archivedJob,id:`fixture-ata-${id}`,processId:id}));
  const originalJobs=[archivedJob,sentJob,...deliveryJobs];
  await writeFile(path.join(directory, 'portal-state.json'), JSON.stringify({ settings, processes: [p,local,archived,auto,resumed,unqueued,...deliveryFixtures],signatureJobs:originalJobs, memberships: [...memberships, ...[local,archived,auto,resumed,unqueued,...deliveryFixtures].flatMap(process=>memberships.map(m => ({ ...m, id: m.id + '-'+process.id, processId: process.id })))] }));
  const port = 41000 + Math.floor(Math.random() * 1000);
  const child = spawn(process.execPath, ['--import', 'tsx', 'server.ts'], {
    cwd: fileURLToPath(new URL('..', import.meta.url)),
    env: { ...process.env, NODE_ENV: 'development', PORT: String(port), PORTAL_DATA_DIR: directory,
      PORTAL_SESSION_SECRET: 'test-session-secret-0123456789-abcdef', PORTAL_OTP_PEPPER: 'test-otp-pepper-0123456789-abcdef',
      PORTAL_ALLOW_INSECURE_DEMO_AUTH: 'true', PORTAL_ALLOW_LOCAL_OTP_STORE: 'true', PORTAL_ALLOW_LOCAL_SECRET_STORE: 'true',
      PORTAL_TEST_DOCUMENT_RENDERER:'true', PORTAL_OTP_DELIVERY_MODE: 'log', ASTEN_INTEGRATION_ENABLED: 'false', ASTEN_AUTOMATIC_WORKFLOW_ENABLED:'true', PORTAL_PERSISTENCE_PROVIDER: 'local_file',
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
    assert.ok(!customSaved.body.formSnapshot.questions.some((q:any)=>q.label==='CPF'));
    const repeated = await request(customRoute, master, formBody);
    assert.equal(repeated.status, 202);
    assert.equal(repeated.body.id, customSaved.body.id);
    const confirmed = await request(`/api/processes/${local.id}/confirm-location`, master, { local: local.defesa.local, confirmationReceived: true });
    assert.equal(confirmed.status, 404);
    assert.equal(confirmed.body.code,'API_NOT_FOUND');
    const unchanged=await request(`/api/processes/${local.id}`,master);
    assert.equal(unchanged.body.dataRevision,local.dataRevision);
    assert.equal(unchanged.body.defesa.localConfirmedAt,local.defesa.localConfirmedAt);
    assert.equal((await request(`/api/processes/${local.id}/confirm-location`, master, { local: 'Outro local', confirmationReceived: true })).status, 404);
    assert.equal((await request('/api/does-not-exist')).status, 404);
    assert.equal((await request(route + '/schema', p.aluno1.email)).status, 403);
    assert.equal((await request(route + '/schema', master)).status, 403);
    assert.equal((await request(`/api/processes/${local.id}/evaluation/schema`)).body.code, 'CONCEPT_STAGE_NOT_RELEASED');
    const schema = await request(route + '/schema');
    assert.equal(schema.status, 200);
    assert.equal(schema.body.studio.docTemplates, undefined);
    const body = { answers:{COORIENTADOR_PRESENTE:'Não'}, signatureProvider:'GOV_BR',dataConfirmed: true, expectedDataRevision: p.dataRevision, expectedSchemaRevision: schema.body.studio.revision, resultadoCode: 'APROVADO', parecer: 'Avaliação realizada e dados conferidos.' };
    assert.equal((await request(route, p.aluno1.email, body)).status, 403);
    assert.equal((await request(route, master, body)).status, 403);
    assert.equal((await request(route, p.orientador.email, { ...body, dataConfirmed: false })).body.code, 'DATA_REVIEW_REQUIRED');
    assert.equal((await request(route, p.orientador.email, { ...body, expectedDataRevision: 0 })).status, 409);
    assert.equal((await request(route,p.orientador.email,body)).body.code,'ATA_PREVIEW_REQUIRED');
    assert.equal((await request(route+'/preview',p.aluno1.email,body)).status,403);
    const preview=await request(route+'/preview',p.orientador.email,body);
    assert.equal(preview.status,200,JSON.stringify(preview.body));
    assert.ok(preview.body.contentBase64);
    assert.ok(preview.body.documentText);
    const documentText='Ata revisada integralmente, com a conferência dos dados do trabalho, da autoria e da Comissão Examinadora.';
    const revised=await request(route+'/preview',p.orientador.email,{...body,documentText});
    assert.equal(revised.status,200,JSON.stringify(revised.body));assert.equal(revised.body.documentText,documentText);
    assert.equal((await request(route,p.orientador.email,{...body,documentText:documentText+' Alterado.',previewToken:revised.body.previewToken})).body.code,'ATA_PREVIEW_REQUIRED');
    const saveDraft=async(email:string,value:unknown)=>{const response=await fetch(base+route+'/draft',{method:'PUT',headers:{'content-type':'application/json','x-demo-user-email':email},body:JSON.stringify(value)});return {status:response.status,body:await response.json()};};
    const draftInput={answers:{RESULTADO:'APROVADO',PARECER:body.parecer},documentText,expectedDataRevision:p.dataRevision};
    assert.equal((await saveDraft(p.aluno1.email,draftInput)).status,403);
    assert.equal((await saveDraft(p.orientador.email,{...draftInput,documentText:'x'.repeat(60001)})).status,400);
    const savedDraft=await saveDraft(p.orientador.email,{...draftInput,answers:{...draftInput.answers,CPF:'NOVO-DESCARTAR',ORIENTADOR_SIAPE:'NOVO-DESCARTAR',CAMPO_NAO_PUBLICADO:'NOVO-DESCARTAR'}});
    assert.equal(savedDraft.status,200);assert.doesNotMatch(JSON.stringify(savedDraft.body),/NOVO-DESCARTAR/);
    const draft=await request(route+'/draft');assert.equal(draft.body.documentText,documentText);
    assert.equal((await request(route+'/draft',p.aluno1.email)).status,403);


    assert.equal((await request(route,p.orientador.email,{...body,parecer:'Parecer alterado após a prévia.',previewToken:preview.body.previewToken})).body.code,'ATA_PREVIEW_REQUIRED');
    const earlyPreview=await request(`/api/processes/${local.id}/evaluation/preview`,p.orientador.email,body);
    assert.equal(earlyPreview.status,409,JSON.stringify(earlyPreview.body));
    assert.equal(earlyPreview.body.code,'CONCEPT_STAGE_NOT_RELEASED');
    const saved = await request(route, p.orientador.email, {...body,previewToken:preview.body.previewToken});
    assert.equal(saved.status, 200); // Registration no longer contacts a signature provider.
    assert.equal(saved.body.avaliacao.notaFinal, undefined);
    assert.equal(saved.body.avaliacao.resultadoLabel,'Aprovado');
    assert.equal(saved.body.avaliacao.dataReview.confirmedBy, p.orientador.email);
    assert.equal(saved.body.workflowPending, undefined);
    assert.equal(saved.body.etapaAtual,'ASSINATURA');assert.equal(saved.body.status,'AGUARDANDO_ASSINATURA');
    const pending=await request(`/api/processes/${p.id}`);assert.equal(pending.body.etapaAtual,'ASSINATURA');
    const upload=await request(`/api/processes/${p.id}/files/trabalho-completo`,p.aluno1.email,{});
    assert.equal(upload.status,409);assert.equal(upload.body.code,'ATA_SIGNATURE_REQUIRED');
    assert.equal((await request(route, p.orientador.email, body)).status, 409);
    const appearance = { schemaVersion: 3, linkedItems: { popup_login: false }, generalPopups: { uploadAtaHeaderBg: '#005830' } };
    const response = await fetch(base + '/api/admin/settings', { method: 'PATCH', headers: { 'content-type': 'application/json', 'x-demo-user-email': 'master@portal.local' }, body: JSON.stringify({ portalAppearance: appearance }) });
    assert.equal(response.status, 200);
    const publicSettings = await request('/api/settings', '');
    assert.equal(publicSettings.body.portalAppearance, undefined);
    assert.equal(publicSettings.body.automaticAstenEnabled, true);
    const disk = JSON.parse(await readFile(path.join(directory, 'portal-state.json'), 'utf8'));
    assert.equal(disk.studioFormSubmissions.length, 1);
    assert.equal(disk.studioFormSubmissions[0].formSnapshot.questions[0].label, 'Escolha');
    assert.equal(disk.settings.portalAppearance, undefined);
    assert.equal(disk.processes[0].avaliacao.notaFinal, undefined);
    assert.equal(disk.processes[0].avaliacao.resultadoLabel,'Aprovado');
    assert.equal(pending.body.avaliacao.resultadoLabel,'Aprovado');
    assert.deepEqual(disk.signatureJobs,JSON.parse(JSON.stringify(originalJobs)),'Registering evaluation must preserve the historical jobs and not create an Asten or Gov.br job.');
    assert.equal(disk.processes[0].astenSignatureIntent,undefined,'a opção Gov.br não enfileira Asten');
    assert.equal((disk.formArchiveJobs||[]).some((job:any)=>job.formType==='AVALIACAO'),false,'A avaliação integrada não gera outro formulário em PDF.');
    const reopenRoute=`/api/processes/${p.id}/reopen`,reason={reason:'Correção do parecer registrado na defesa.'};
    assert.equal((await request(reopenRoute,p.aluno1.email,reason)).status,403);
    assert.equal((await request(reopenRoute,'presidente@portal.local',reason)).status,404);
    const reopened=await request(reopenRoute,p.orientador.email,reason);
    assert.equal(reopened.status,200,JSON.stringify(reopened.body));assert.equal(reopened.body.avaliacao.status,'PENDENTE');
    assert.equal((await request(reopenRoute,'master@portal.local',reason)).status,200);
    const archivedDetails=await Promise.all([p.orientador.email,p.aluno1.email,p.banca.find(member=>member.funcao==='EXAMINER_2')!.email]
      .map(email=>request(`/api/processes/${archived.id}/detail`,email)));
    for(const [index,detail] of archivedDetails.entries()){
      assert.equal(detail.status,200,`perfil ${index}: ${JSON.stringify(detail.body)}`);
      assert.equal(detail.body.documents.find((doc:{type:string})=>doc.type==='ATA').status,'ASSINADO');
      assert.equal(detail.body.signatures[0].driveSignedFileId,archivedJob.driveSignedFileId);
    }
    const historicalReopen=await request(`/api/processes/${archived.id}/reopen`,p.orientador.email,reason);
    assert.equal(historicalReopen.status,200,JSON.stringify(historicalReopen.body));
    const revisedBody={...body,expectedDataRevision:historicalReopen.body.dataRevision,resultadoCode:'REPROVADO',documentText:'Ata revisada '.repeat(3000)};
    const historicalPreview=await request(`/api/processes/${archived.id}/evaluation/preview`,p.orientador.email,revisedBody);
    assert.equal(historicalPreview.status,200,JSON.stringify(historicalPreview.body));
    const historicalSaved=await request(`/api/processes/${archived.id}/evaluation`,p.orientador.email,{...revisedBody,previewToken:historicalPreview.body.previewToken});
    assert.equal(historicalSaved.status,200,JSON.stringify(historicalSaved.body));
    assert.equal(historicalSaved.body.avaliacao.status,'CONCLUIDO');
    assert.equal(historicalSaved.body.avaliacao.documentRevision,historicalSaved.body.dataRevision);
    const staleArchiveUpload=await request(`/api/processes/${archived.id}/files/trabalho-completo`,p.aluno1.email,{});
    assert.equal(staleArchiveUpload.body.code,'ATA_SIGNATURE_REQUIRED','a ata assinada antes da reabertura não libera o repositório');
    const autoRoute=`/api/processes/${auto.id}/evaluation`;
    const autoDraft=await fetch(base+autoRoute+'/draft',{method:'PUT',headers:{'content-type':'application/json','x-demo-user-email':p.orientador.email},body:JSON.stringify(draftInput)});
    assert.equal(autoDraft.status,200);
    assert.equal((await request(`/api/processes/${auto.id}`)).body.astenSignatureIntent,undefined,'rascunho não cria intenção de envio');
    const autoBody={...body,signatureProvider:'ASTEN',resultadoCode:'APROVADO_COM_RESSALVA'};
    const autoPreview=await request(autoRoute+'/preview',p.orientador.email,autoBody);
    assert.equal(autoPreview.status,200);
    const autoResult=await request(autoRoute,p.orientador.email,{...autoBody,previewToken:autoPreview.body.previewToken});
    assert.equal(autoResult.status,202,JSON.stringify(autoResult.body));
    assert.ok(autoResult.body.documents.some((doc:{type:string;status:string})=>doc.type==='ATA'&&doc.status==='AGUARDANDO_ASSINATURA'));
    assert.equal(autoResult.body.astenSignatureIntent.documentType,'ATA');
    assert.equal(autoResult.body.astenSignatureIntent.revision,autoResult.body.avaliacao.documentRevision);
    const examiner=auto.banca.find(member=>member.funcao==='EXAMINER_2')!.email;
    const sharedDetail=await request(`/api/processes/${auto.protocolo}/detail`,examiner);
    assert.equal(sharedDetail.status,200,JSON.stringify(sharedDetail.body));
    assert.equal(sharedDetail.body.process.avaliacao.documentRevision,autoResult.body.avaliacao.documentRevision);
    assert.equal(sharedDetail.body.documents.find((doc:{type:string})=>doc.type==='ATA').status,'AGUARDANDO_ASSINATURA');
    assert.equal((await request(`/api/processes/${auto.protocolo}/signatures`,examiner)).status,200);
    assert.equal((await request(`/api/processes/${auto.protocolo}/signatures`,'sem-vinculo@example.invalid')).status,404);
    const signRoute = `/api/processes/${auto.id}/documents/ATA/sign`;
    assert.equal((await request(signRoute, p.aluno1.email, {provider:'ASTEN'})).status, 403);
    const manual = await request(signRoute, p.orientador.email, {provider:'ASTEN'});
    assert.equal(manual.status, 409);
    assert.equal(manual.body.code, 'ASTEN_AUTOMATIC_WORKFLOW');

    const replay=await request(autoRoute,p.orientador.email,{...autoBody,previewToken:autoPreview.body.previewToken});
    assert.equal(replay.status,200,JSON.stringify(replay.body));
    assert.equal(replay.body.dataRevision,autoResult.body.dataRevision);
    const conflictingReplay=await request(autoRoute,p.orientador.email,{...autoBody,previewToken:autoPreview.body.previewToken,correctedDocumentText:documentText});
    assert.equal(conflictingReplay.status,409);
    assert.equal(conflictingReplay.body.code,'EVALUATION_ALREADY_SUBMITTED');
    assert.equal((await request(autoRoute,p.aluno1.email,{...autoBody,previewToken:autoPreview.body.previewToken})).status,403);
    for(let attempt=0;attempt<2;attempt++){
      const maintenance=await request('/api/admin/workflow/maintenance',master,{});
      assert.equal(maintenance.status,200,JSON.stringify(maintenance.body));
      assert.ok(maintenance.body.configurationErrors.some((item:string)=>item.includes(auto.protocolo)&&item.includes('Asten')));
    }
    const delivery={palavrasChave:['Cuidado','Saúde','Ensino','Pesquisa','Enfermagem'],resumoSintese:'Resumo de teste.'};
    const prematureDelivery=await request(`/api/processes/${auto.id}/final-data`,p.aluno1.email,delivery);
    assert.equal(prematureDelivery.body.code,'ATA_SIGNATURE_REQUIRED');
    for (const [index,type] of ['TERMO','DECLARACAO'].entries()) {
      const fixture=deliveryFixtures[index];
      const route=`/api/processes/${fixture.id}/final-data`;
      const submitted=await request(route,p.aluno1.email,{...delivery,publishFullWork:type==='TERMO'});
      assert.equal(submitted.status,202,JSON.stringify(submitted.body));
      assert.equal(submitted.body.astenSignatureIntent.documentType,type);
      assert.equal(submitted.body.astenSignatureIntent.revision,submitted.body.dataRevision);
      const manual=await request(`/api/processes/${fixture.id}/documents/${type}/sign`,type==='TERMO'?p.orientador.email:master,{provider:'ASTEN'});
      assert.equal(manual.body.code,'ASTEN_AUTOMATIC_WORKFLOW');
    }
    const finalDisk=JSON.parse(await readFile(path.join(directory,'portal-state.json'),'utf8'));
    assert.deepEqual(finalDisk.signatureJobs,JSON.parse(JSON.stringify(originalJobs)),'a manutenção sem integração não envia nem duplica uma assinatura conhecida');
    assert.equal(finalDisk.processes.find((item:any)=>item.id===resumed.id).astenSignatureIntent,undefined,'retomada reconhece envelope já encaminhado');
    assert.ok(finalDisk.processes.find((item:any)=>item.id===auto.id).astenSignatureIntent.attemptedAt,'intenção persiste para próxima tentativa');
    assert.equal(finalDisk.processes.find((item:any)=>item.id===unqueued.id).astenSignatureIntent.documentType,'ATA','ata já registrada com Asten volta à fila sem novo registro');
    assert.equal(finalDisk.auditLogs.filter((entry:any)=>entry.processId===auto.id&&entry.action==='CONCLUSAO_AVALIACAO').length,1,'a repetição confirma o registro existente');
    for (const [processId, label] of [[auto.id,'Aprovado com ressalva'],[archived.id,'Reprovado']]) {
      const persisted = finalDisk.processes.find((item: {id: string}) => item.id === processId);
      assert.equal(persisted.avaliacao.resultadoLabel,label);
      assert.equal(persisted.avaliacao.notaFinal,undefined);
      const reloaded = await request(`/api/processes/${processId}`);
      assert.equal(reloaded.body.avaliacao.resultadoLabel,label);
      assert.ok(!(finalDisk.emailDeliveries || []).some((email: {processId: string; templateId: string}) =>
        email.processId === processId && email.templateId === 'email-assinatura-ata'),
        'o aviso de assinatura consolidado não deve vazar nem disparar pela finalização sem Asten');
    }


  } finally {
    if (child.exitCode === null) {
      child.kill('SIGTERM');
      await new Promise<void>(resolve => child.once('exit', () => resolve()));
    }
    await rm(directory, { recursive: true, force: true });
  }
});
