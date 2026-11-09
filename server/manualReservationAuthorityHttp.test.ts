import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {mkdtemp, mkdir, writeFile, readFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {DEMO_PROCESSES, INITIAL_SETTINGS} from '../src/services/demoSeed';
import {createProfessionalPdf} from './documents/simplePdf';
import {reservationToken} from './workflow/reservationConfirmation';

test('retired manual reservation routes are absent for every role while signed links and historical downloads remain available', {timeout: 45000}, async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'portal-manual-reservation-'));
  const p = structuredClone(DEMO_PROCESSES[0]);
  p.status = 'AGUARDANDO_CONFIRMACAO_LOCAL'; p.etapaAtual = 'CONFIRMACAO_LOCAL';
  p.avaliacao = {status: 'PENDENTE'}; p.acervo.submittedAt = undefined;
  p.defesa = {...p.defesa, localStatus: 'PENDENTE', reservationRevision: 0,
    invitationSentAt: undefined, invitationDriveFileId: undefined, departmentResponse: undefined, locationProof: undefined};
  const settings = {...INITIAL_SETTINGS, driveRootFolderId: 'local-test-root', documentModels: {CONVITE: {driveFileId: 'fixture-model'}},
    integrationStudio:{...INITIAL_SETTINGS.integrationStudio,emailTemplates:[{id:'email-reserva',name:'Reserva antiga',recipient:'outdated@example.invalid',subject:'Pedido',body:'Reserva'}]},
    emailConfig:{...INITIAL_SETTINGS.emailConfig,roomReservationDepartmentEmail:'department@example.invalid',roomReservationEmailCentralized:true}};
  const historical = structuredClone(p); historical.id = 'historical-reservation-proof'; historical.protocolo = 'TCC-2026-0998'; historical.defesa.localStatus='RECUSADO';
  const pdf = createProfessionalPdf({title: 'Comprovante histórico fictício', protocol: historical.protocolo, body: 'Arquivo anteriormente preservado.'});
  const sha256 = createHash('sha256').update(pdf).digest('hex');
  const key = createHash('sha256').update(JSON.stringify([historical.id,'COMPROVANTE_LOCAL',sha256])).digest('hex');
  historical.defesa.locationProof = {driveFileId:`local_review_${key}`,fileName:'historico.pdf',sha256,version:1,reservationRevision:0,uploadedAt:'2026-10-01T12:00:00Z',uploadedBy:p.aluno1.email};
  await mkdir(path.join(directory,'arquivos-demonstrativos'));
  await writeFile(path.join(directory,'arquivos-demonstrativos',key+'.pdf'),pdf);
  await writeFile(path.join(directory,'arquivos-demonstrativos',key+'.json'),JSON.stringify({processId:historical.id,artifactType:'COMPROVANTE_LOCAL',fileName:'historico.pdf',sha256}));
  const memberships = [p,historical].flatMap(process => [
    {email: process.aluno1.email, roles: ['STUDENT']},
    {email: process.orientador.email, roles: ['ADVISOR']},
    ...process.banca.filter(m => m.email !== process.orientador.email).map(m => ({email: m.email, roles: ['EXAMINER']})),
  ].map((member,i) => ({...member,id:`membership-${process.id}-${i}`,processId:process.id,active:true})));
  await writeFile(path.join(directory, 'portal-state.json'), JSON.stringify({settings, processes: [p,historical], memberships, signatureJobs: []}));
  const port = 46800 + Math.floor(Math.random() * 300), base = `http://127.0.0.1:${port}`,secret='manual-reservation-test-0123456789abcdef';
  const systemEnv = Object.fromEntries(['PATH', 'HOME', 'TMPDIR', 'LANG'].flatMap(key => process.env[key] ? [[key, process.env[key]!]] : []));
  const bootstrap = "import{createRequire}from'node:module';import{pathToFileURL}from'node:url';const require=createRequire(import.meta.url);require('dotenv').config=()=>({parsed:{}});await import(pathToFileURL(process.cwd()+'/server.ts').href);";
  const child = spawn(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', bootstrap], {cwd: process.cwd(), env: {...systemEnv,
    NODE_ENV: 'development', HOST: '127.0.0.1', PORT: String(port), PORTAL_PUBLIC_URL: base,
    PORTAL_DATA_DIR: directory, PORTAL_PERSISTENCE_PROVIDER: 'local_file',
    PORTAL_LOCAL_REVIEW_DATA: 'true', PORTAL_TEST_DOCUMENT_RENDERER: 'true', PORTAL_ALLOW_INSECURE_DEMO_AUTH: 'true',
    PORTAL_ALLOW_LOCAL_OTP_STORE: 'true', PORTAL_ALLOW_LOCAL_SECRET_STORE: 'true',
    PORTAL_SESSION_SECRET: secret, PORTAL_OTP_PEPPER: 'manual-reservation-pepper-0123456789abcdef',
    ASTEN_INTEGRATION_ENABLED: 'false', DOTENV_CONFIG_PATH: path.join(directory, 'absent.env')}, stdio: 'ignore'});
  const disk = async () => JSON.parse(await readFile(path.join(directory, 'portal-state.json'), 'utf8'));
  const post = (route:string,email:string,body:unknown) => fetch(base+route,{method:'POST',headers:{'content-type':'application/json',...(email?{'x-demo-user-email':email}:{})},body:JSON.stringify(body)});
  try {
    const deadline = Date.now() + 20000;
    while (true) {try {if ((await fetch(base + '/api/health')).ok) break;} catch {}
      if (Date.now() > deadline || child.exitCode !== null) throw new Error('Isolated server failed to start');
      await new Promise(r => setTimeout(r, 100));}
    const before = (await disk()).processes;
    const users = ['',p.aluno1.email,p.orientador.email,...p.banca.map(m=>m.email),settings.masterEmail,settings.commissionPresidentEmail,'stranger@example.invalid'];
    for(const email of new Set(users)){
      for(const target of [p,historical]){
        const confirmation=await post(`/api/processes/${target.id}/confirm-location`,email,{local:target.defesa.local,confirmationReceived:true,manualConfirmationReason:'Tentativa por rota removida'});
        assert.equal(confirmation.status,404,email);assert.equal((await confirmation.json()).code,'API_NOT_FOUND');
        const upload=await post(`/api/processes/${target.id}/location-proof`,email,{fileName:'reserva.pdf',contentBase64:pdf.toString('base64'),stagedUploadId:'old-ticket'});
        assert.equal(upload.status,404,email);assert.equal((await upload.json()).code,'API_NOT_FOUND');
      }
      const staging=await post('/api/uploads/staging',email,{purpose:'LOCATION_PROOF',processId:p.id,fileName:'reserva.pdf',size:pdf.length,mimeType:'application/pdf',sha256});
      assert.equal(staging.status,400,email);assert.match((await staging.json()).error,/Finalidade de upload inválida/);
    }
    const unchanged=await disk();assert.deepEqual(unchanged.processes,before);assert.equal(unchanged.workflowRuns?.length||0,0);assert.equal(unchanged.emailDeliveries?.length||0,0);
    const historicalRoute=`/api/processes/${historical.id}/location-proof/download`;
    assert.equal((await fetch(base+historicalRoute)).status,401);
    assert.equal((await fetch(base+historicalRoute,{headers:{'x-demo-user-email':'stranger@example.invalid'}})).status,404);
    const preserved=await fetch(base+historicalRoute,{headers:{'x-demo-user-email':p.aluno1.email}});
    assert.equal(preserved.status,200);assert.deepEqual(Buffer.from(await preserved.arrayBuffer()),pdf);
    const obsolete=reservationToken({processId:p.id,revision:0,recipient:'outdated@example.invalid',expiresAt:Date.now()+600000},secret);
    assert.ok([403,409,410].includes((await fetch(base+'/api/reservation-confirmation/'+obsolete)).status));
    const token=reservationToken({processId:p.id,revision:0,recipient:'department@example.invalid',expiresAt:Date.now()+600000},secret);
    const url=base+'/api/reservation-confirmation/'+token;
    assert.equal((await fetch(url)).status,200);
    const response=await fetch(url,{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded',origin:base},body:'decision=accept&confirmed=yes'});
    assert.equal(response.status,202);assert.match(response.headers.get('content-type')||'',/text\/html/);assert.match(await response.text(),/Resposta registrada/);
    const accepted=(await disk()).processes.find((item:any)=>item.id===p.id);
    assert.equal(accepted.protocolo,p.protocolo);assert.equal(accepted.defesa.localStatus,'CONFIRMADO');assert.equal(accepted.defesa.departmentResponse.respondedBy,'department@example.invalid');assert.equal(accepted.defesa.locationProof,undefined);
    const pendingState=await disk();
    const currentArchive=pendingState.formArchiveJobs.find((job:any)=>job.processId===p.id&&job.formType==='CONFIRMACAO_LOCAL'&&job.version===accepted.dataRevision&&job.reservationRevision===0);
    assert.equal(currentArchive?.status,'FAILED');assert.ok(currentArchive.lastError,'isolated Google failure remains visible');
    assert.equal(accepted.defesa.invitationSentAt,undefined);assert.equal(accepted.defesa.invitationDriveFileId,undefined);
    assert.ok(!(pendingState.emailDeliveries||[]).some((mail:any)=>mail.processId===p.id&&mail.templateId==='email-convite'));
    assert.ok(!(pendingState.workflowRuns||[]).some((run:any)=>run.processId===p.id&&run.eventCode==='LOCATION_CONFIRMED'));
    const receipt=await fetch(url+'/receipt');assert.equal(receipt.status,200);assert.equal(Buffer.from(await receipt.arrayBuffer()).subarray(0,5).toString(),'%PDF-');
    assert.deepEqual((await disk()).processes.find((item:any)=>item.id===historical.id).defesa.locationProof,historical.defesa.locationProof);
  } finally {
    child.kill('SIGTERM'); await new Promise<void>(resolve => child.exitCode !== null ? resolve() : child.once('exit', () => resolve()));
    await rm(directory, {recursive: true, force: true});
  }
});
