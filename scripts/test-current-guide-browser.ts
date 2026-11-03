import {createRequire} from 'node:module';
import {createHmac} from 'node:crypto';
import {spawn} from 'node:child_process';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {DEMO_PROCESSES,INITIAL_SETTINGS} from '../src/services/demoSeed';
const {chromium}=createRequire(import.meta.url)(path.join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES,'playwright'));
const dir=await mkdtemp(path.join(tmpdir(),'portal-browser-session-'));
const master='tccenfermagemufes@gmail.com',secret='browser-active-session-secret-0123456789abcdef';
const baseProcess={...structuredClone(DEMO_PROCESSES[0]),id:'browser-deletable',acervo:undefined,etapaAtual:'CONFIRMACAO_LOCAL',status:'AGUARDANDO_CONFIRMACAO_LOCAL',driveFolderId:undefined,defesa:{...structuredClone(DEMO_PROCESSES[0].defesa),invitationDriveFileId:undefined,localStatus:'PENDENTE',localConfirmedAt:undefined}};
baseProcess.aluno1.email='student.one@edu.ufes.br';
baseProcess.banca=baseProcess.banca.filter(person=>person.email!==baseProcess.orientador.email&&person.email!==baseProcess.coorientador?.email);
const otherProcess={...structuredClone(baseProcess),id:'browser-protected',driveFolderId:'institutional-record'};
otherProcess.aluno1.email='other.student@edu.ufes.br';
otherProcess.defesa.startAt='2026-12-10T17:00:00.000Z';
Object.assign(otherProcess,{etapaAtual:'REPOSITORIO',status:'AGUARDANDO_DADOS_FINAIS',signatureProviderPreferences:{ATA:'GOV_BR'},avaliacao:{...otherProcess.avaliacao,status:'CONCLUIDO'}});
await writeFile(path.join(dir,'portal-state.json'),JSON.stringify({settings:{...INITIAL_SETTINGS,masterEmail:master,ownerEmail:master},processes:[baseProcess,otherProcess],memberships:[],signatureJobs:[]}));
const port=47000+Math.floor(Math.random()*500),base=`http://127.0.0.1:${port}`;
const child=spawn(process.execPath,['dist/server/server.cjs'],{cwd:process.cwd(),env:{...process.env,NODE_ENV:'development',HOST:'127.0.0.1',PORT:String(port),PORTAL_PUBLIC_URL:base,APP_URL:base,PORTAL_DATA_DIR:dir,PORTAL_PERSISTENCE_PROVIDER:'local_file',PORTAL_ALLOW_INSECURE_DEMO_AUTH:'false',PORTAL_TEST_DOCUMENT_RENDERER:'true',PORTAL_SERVE_COMPILED_CLIENT:'true',PORTAL_ALLOW_LOCAL_OTP_STORE:'true',PORTAL_ALLOW_LOCAL_SECRET_STORE:'true',PORTAL_SESSION_SECRET:secret,PORTAL_OTP_PEPPER:'browser-session-otp-pepper-0123456789abcdef',ASTEN_INTEGRATION_ENABLED:'false',SUPABASE_URL:'',SUPABASE_SECRET_KEY:'',SUPABASE_SERVICE_ROLE_KEY:'',VERCEL:''},stdio:'ignore'});
let browser,page;
try{
 const deadline=Date.now()+20000;while(true){try{if((await fetch(base+'/api/health')).ok)break;}catch{}if(Date.now()>deadline||child.exitCode!==null)throw Error('Test server did not start');await new Promise(r=>setTimeout(r,100));}
 const now=Math.floor(Date.now()/1000),issuedAt=now-3600;
 const value=Buffer.from(JSON.stringify({sessionId:'browser_session_fixture_1234567890',uid:`email:${master}`,email:master,emailVerified:true,authTime:issuedAt,issuedAt,expiresAt:now+3600,isDemo:false,method:'EMAIL_OTP'})).toString('base64url');
 browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
 const context=await browser.newContext({viewport:{width:1440,height:1100}});
 await context.addCookies([{name:'portal_tcc_session',value:`${value}.${createHmac('sha256',secret).update(value).digest('base64url')}`,domain:'127.0.0.1',path:'/',httpOnly:true,sameSite:'Lax'}]);
 await context.route('**/*',r=>r.request().url().startsWith(base)||/^(blob|data):/.test(r.request().url())?r.continue():r.abort());
 page=await context.newPage();page.on('response',async r=>{if(r.url().includes('/api/processes/')&&r.status()>=400)console.log('PROCESS_ERROR',r.status(),await r.text());});page.on('pageerror',e=>console.log('PAGEERROR',e.stack));page.on('console',m=>{if(m.type()==='error')console.log('CONSOLE',m.text());});let loginRequests=0;page.on('request',r=>{if(r.url().includes('/api/auth/request-code'))loginRequests++;});
 await page.goto(base+'/');
 await page.getByRole('button',{name:'Como usar',exact:true}).click();
 for(const role of ['Aluno','Orientador','Visitante']){
  await page.getByRole('button',{name:role,exact:true}).click();
  assert.equal(await page.getByRole('button',{name:'Presidente da Comissão',exact:true}).count(),0);
  const guide=page.getByRole('region',{name:'Manual ilustrado'});
  const count=await guide.getByRole('tab').count();assert.equal(count,role==='Aluno'?7:role==='Orientador'?5:4);
  for(let index=0;index<count;index++){
   await guide.getByRole('tab').nth(index).click();
   const images=guide.locator('img');
   if(await images.count())await images.first().evaluate(image=>image.decode());
   const text=await guide.getByRole('tabpanel').innerText();assert.doesNotMatch(text,/anexe o e-mail|assine o PDF e devolva o arquivo com todas/);
   if(index===0&&role!=='Visitante')assert.match(text,/Entrar pelo link recebido por e-mail/);
   if(role==='Aluno'&&text.includes('Cadastrar o TCC e os participantes')){assert.match(text,/ordem desejada/);assert.match(text,/tratamento e a titulação/);}
   if(role==='Aluno'&&text.includes('Conferir ou corrigir data, horário e local'))assert.match(text,/aguarde o novo aceite/i);
   if(role==='Orientador'&&text.includes('Conferir, assinar e baixar documentos')){assert.match(text,/devolva o PDF completo/i);assert.match(text,/use apenas Ver e Baixar PDF/);}
   if(role==='Visitante'&&text.includes('Pesquisar o Repositório público')){assert.match(text,/login é opcional/i);assert.match(text,/E-mails, matrículas e registros não aparecem/);}
  }
  await page.screenshot({path:`.portal-data/como-usar-${role.toLowerCase()}.png`,fullPage:true});
 }
 await page.setViewportSize({width:390,height:844});
 await page.waitForFunction(()=>document.querySelector('#portal-sidebar')!.getBoundingClientRect().right<=1);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 await page.screenshot({path:'.portal-data/como-usar-mobile.png',fullPage:true});
 await page.setViewportSize({width:1440,height:1100});
 await page.getByRole('button',{name:'Fluxo do TCC',exact:true}).click();
 await page.getByRole('heading',{name:'Fluxo do TCC',exact:true}).waitFor();
 const flow=await page.locator('main').innerText();assert.match(flow,/aceita ou recusa/);assert.match(flow,/1h30/);assert.doesNotMatch(flow,/anexa o e-mail em PDF/);
 assert.match(flow,/ordem dos autores/);assert.match(flow,/invalida a confirmação anterior/);assert.match(flow,/Somente o orientador assina a ata/);assert.match(flow,/somente o orientador devolve o mesmo PDF com todas as assinaturas/);assert.match(flow,/função é diferente da presidência da sessão/);assert.match(flow,/e-mails, matrículas e registros permanecem restritos/);assert.doesNotMatch(flow,/Vínculo: Rodapé/);
 await page.screenshot({path:'.portal-data/fluxo-tcc-atualizado.png',fullPage:true});
 await page.getByRole('button',{name:'Replicar Portal',exact:true}).click();
 await page.getByRole('heading',{name:'Replicar Portal',exact:true}).waitFor();
 const response=await context.request.get(base+'/replicacao/GUIA_PARA_IA.md');assert.equal(response.status(),200);assert.match(await response.text(),/nove avisos/);assert.doesNotMatch(await response.text(),/exige PDF da resposta/);
 await page.screenshot({path:'.portal-data/replicar-portal-atualizado.png',fullPage:true});
 if(process.env.PORTAL_REFRESH_GUIDE_IMAGES==='true'){
  await page.getByRole('button',{name:'Meus TCCs',exact:true}).click();
  await page.getByRole('button',{name:'Cadastrar TCC',exact:true}).click();
  const registration=page.getByRole('dialog',{name:'Cadastrar Trabalho de TCC',exact:true});
  await registration.waitFor();
  assert.doesNotMatch(await registration.innerText(),/registre o local autorizado/);
  await registration.screenshot({path:'public/manual/cadastro.jpg',type:'jpeg',quality:90});
 }
 await page.goto(base+'/?tcc=browser-deletable&secao=geral');
 await page.getByRole('dialog',{name:'Detalhes do Trabalho de TCC',exact:true}).waitFor();
 const reservation=page.getByRole('region',{name:'Reserva do local da defesa'});await reservation.waitFor();assert.match(await reservation.innerText(),/formulário enviado por e-mail/);assert.equal(await reservation.locator('input[type=file]').count(),0);assert.doesNotMatch(await reservation.innerText(),/não precisa anexar/);assert.ok(await reservation.evaluate(el=>Boolean(el.compareDocumentPosition(document.querySelector('[aria-label="Dados do processo"]')!)&Node.DOCUMENT_POSITION_FOLLOWING)));assert.match(await reservation.evaluate(el=>getComputedStyle(el).backgroundColor),/^(rgb\(255, 251, 235\)|oklch\(0\.987 0\.022 95\.277\))$/);
 await reservation.screenshot({path:'.portal-data/reserva-fluxo-atual.png'});
 const members=page.getByRole('region',{name:'Dados dos membros',exact:true});
 const roster=members.getByRole('table',{name:'Participantes do TCC e seus dados cadastrais'});
 assert.equal(await roster.getByRole('columnheader').count(),7);
 assert.ok(await roster.getByRole('rowheader').count()>=4);
 assert.equal(await roster.getByRole('columnheader',{name:'E-mail',exact:true}).count(),1);
 for(const row of await roster.locator('tbody tr').all())assert.equal(await row.getByRole('cell').count(),6);
 await members.screenshot({path:'.portal-data/compact-members-desktop.png'});
 await roster.getByRole('button',{name:'Editar Nome — Discente autor 1',exact:true}).click();
 const editedName=roster.getByRole('textbox',{name:'Nome — Discente autor 1',exact:true});
 await editedName.fill('Nome Social de Teste');await editedName.press('Tab');
 await roster.getByRole('button',{name:'Editar Nome — Discente autor 1',exact:true}).getByText('Nome Social de Teste',{exact:true}).waitFor();
 const savedMember=await context.request.get(base+'/api/processes/browser-deletable');assert.equal((await savedMember.json()).aluno1.nome,'Nome Social de Teste');
 await page.setViewportSize({width:390,height:844});
 await page.waitForFunction(()=>document.querySelector('#portal-sidebar')!.getBoundingClientRect().right<=1);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 assert.equal(await members.locator('.portal-members-table-scroll').evaluate(el=>el.scrollWidth>el.clientWidth),true);
 await members.screenshot({path:'.portal-data/compact-members-mobile.png'});
 await page.setViewportSize({width:1440,height:1100});

 if(process.env.PORTAL_REFRESH_GUIDE_IMAGES==='true'){await reservation.scrollIntoViewIfNeeded();await page.getByRole('dialog',{name:'Detalhes do Trabalho de TCC',exact:true}).screenshot({path:'public/manual/confirmacao.jpg',type:'jpeg',quality:90});}
 await page.getByRole('button',{name:'Documentos do processo',exact:true}).click();
 await page.getByText('4 documento(s)',{exact:true}).waitFor();
 const dialog=page.getByRole('dialog',{name:'Detalhes do Trabalho de TCC',exact:true});
 await dialog.screenshot({path:'.portal-data/documentos-fluxo-atual.png'});
 if(process.env.PORTAL_REFRESH_GUIDE_IMAGES==='true')await dialog.screenshot({path:'public/manual/documentos.jpg',type:'jpeg',quality:90});
 if(process.env.PORTAL_REFRESH_GUIDE_IMAGES==='true'){
  await page.getByRole('button',{name:'Repositório',exact:true}).last().click();
  await page.getByText(/^A entrega final será liberada após a assinatura do orientador e o arquivamento da ata\./).waitFor();
  await dialog.screenshot({path:'public/manual/repositorio.jpg',type:'jpeg',quality:90});
 }
 await page.goto(base+'/?tcc=browser-protected');
 const pendingDialog=page.getByRole('dialog',{name:'Detalhes do Trabalho de TCC',exact:true});await pendingDialog.waitFor();
 await pendingDialog.getByText('Etapa: Assinaturas',{exact:true}).waitFor();
 assert.equal(await pendingDialog.getByRole('button',{name:'Documentos do processo',exact:true}).getAttribute('aria-pressed'),'true');
 await pendingDialog.getByRole('button',{name:'Avaliação e ata',exact:true}).click();
 assert.equal(await pendingDialog.getByRole('button',{name:'Baixar e enviar ata assinada no Gov.br',exact:true}).count(),0);
 await pendingDialog.getByRole('button',{name:'Reabrir avaliação',exact:true}).waitFor();
 assert.equal(await pendingDialog.getByRole('button',{name:'Reabrir avaliação',exact:true}).evaluate(el=>getComputedStyle(el).borderRadius),'9999px');
 const evaluationNote=pendingDialog.getByRole('complementary',{name:'Avaliação e assinatura da ata'});
 assert.match(await evaluationNote.innerText(),/Avaliação registrada.*Documentos do processo/);
 assert.match(await evaluationNote.evaluate(el=>getComputedStyle(el).backgroundColor),/^(rgb\(255, 251, 235\)|oklch\(0\.987 0\.022 95\.277\))$/);
 await pendingDialog.screenshot({path:'.portal-data/evaluation-documents-only.png'});
 await pendingDialog.getByRole('button',{name:'Documentos do processo',exact:true}).click();
 await pendingDialog.getByRole('button',{name:'Gov.br',exact:true}).first().click();
 const govModal=page.getByRole('dialog',{name:'Assinatura gov.br',exact:true});await govModal.waitFor();
 await govModal.getByRole('heading',{name:'2. Devolver o documento assinado',exact:true}).waitFor();
 await govModal.getByRole('button',{name:'Gerar e baixar PDF',exact:true}).waitFor();
 assert.equal(await govModal.getByRole('button',{name:'Devolver PDF assinado',exact:true}).isDisabled(),true);
 await govModal.screenshot({path:'.portal-data/gov-evaluation-two-steps.png'});
 await govModal.getByRole('button',{name:'Fechar',exact:true}).click();
 const preparedJob={id:'gov-ui-fixture',processId:otherProcess.id,protocol:otherProcess.protocolo,documentType:'ATA',documentVersion:1,sourceDataRevision:otherProcess.dataRevision,provider:'GOV_BR',status:'READY_FOR_REVIEW',signers:[{id:'advisor',name:otherProcess.orientador.nome,email:otherProcess.orientador.email,role:'ADVISOR',status:'WAITING',signingOrder:1}]};
 await page.route(base+'/api/processes/browser-protected/signatures',route=>route.fulfill({json:[preparedJob]}));
 await pendingDialog.getByRole('button',{name:'Gov.br',exact:true}).first().click();
 await govModal.getByRole('button',{name:'Baixar PDF para assinar',exact:true}).waitFor();
 assert.equal(await govModal.getByRole('button',{name:'Devolver PDF assinado',exact:true}).isEnabled(),true);
 const returnFile=govModal.locator('input[type=file]');assert.equal(await returnFile.isEnabled(),true);
 const downloadAction=govModal.getByRole('button',{name:'Baixar PDF para assinar',exact:true});
 assert.equal(await downloadAction.evaluate(el=>getComputedStyle(el).borderRadius),'9999px');
 await govModal.screenshot({path:'.portal-data/gov-evaluation-prepared-upload.png'});
 await govModal.getByRole('button',{name:'Fechar',exact:true}).click();

 await pendingDialog.getByRole('button',{name:'Repositório',exact:true}).click();
 await pendingDialog.getByText(/^A entrega final será liberada após a assinatura do orientador e o arquivamento da ata\./).waitFor();
 const repoInstruction=pendingDialog.getByText(/^A entrega final será liberada após a assinatura do orientador e o arquivamento da ata\./);
 assert.equal(await repoInstruction.evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(255, 251, 235)');
 assert.match(await repoInstruction.innerText(),/será gerado o Termo de Autorização/);
 assert.equal(await pendingDialog.getByText('Autorizo a publicação:',{exact:true}).count(),0);
 await pendingDialog.screenshot({path:'.portal-data/repository-yellow-instruction.png'});


 let repositoryFixture={...structuredClone(otherProcess),etapaAtual:'REPOSITORIO',status:'AGUARDANDO_DADOS_FINAIS',signatureProviderPreferences:{TERMO:'GOV_BR'},acervo:{trabalhoCompletoFileId:'local-fixture',trabalhoCompletoFileName:'trabalho-final.pdf',trabalhoCompletoFileUrl:'/fixture.pdf',publishFullWork:false,publishExpandedAbstract:false}};
 await page.route(base+'/api/processes/browser-protected',route=>route.fulfill({json:repositoryFixture}));
 await page.route(base+'/api/processes/browser-protected/signatures',route=>route.fulfill({json:[{...preparedJob,status:'ARCHIVED',driveSignedFileId:'signed-ata-fixture'}]}));
 await page.route(base+'/api/processes/browser-protected/final-data',async route=>{
  const payload=route.request().postDataJSON();assert.equal(payload.publishFullWork,true);assert.equal(payload.signatureProvider,'GOV_BR');assert.equal(payload.authorizationConfirmed,undefined);
  repositoryFixture={...repositoryFixture,etapaAtual:'ASSINATURA',status:'AGUARDANDO_ASSINATURA',acervo:{...repositoryFixture.acervo,...payload,submittedAt:new Date().toISOString()}};
  await route.fulfill({json:repositoryFixture});
 });
 await page.goto(base+'/?tcc=browser-protected&secao=acervo');
 const repositoryDialog=page.getByRole('dialog',{name:'Detalhes do Trabalho de TCC',exact:true});
 await repositoryDialog.getByRole('textbox',{name:'Resumo síntese do TCC',exact:true}).fill('Resumo final de teste para confirmar a navegação após a entrega.');
 for(let i=1;i<=5;i++)await repositoryDialog.getByRole('textbox',{name:`Palavra-chave ${i}`,exact:true}).fill(`Tema ${i}`);
 await repositoryDialog.locator('#acervo-public-toggle').check();
 await repositoryDialog.getByRole('combobox',{name:'Assinatura do Termo',exact:true}).selectOption('GOV_BR');
 await repositoryDialog.getByRole('button',{name:'Salvar no acervo e finalizar o processo',exact:true}).click();
 await repositoryDialog.getByText(/^Entrega salva\. Em Documentos do processo, abra Gov.br/).waitFor();
 assert.equal(await repositoryDialog.getByRole('button',{name:'Documentos do processo',exact:true}).getAttribute('aria-pressed'),'true');
 assert.equal(await page.getByRole('dialog',{name:'Mensagem do portal',exact:true}).count(),0);
 await repositoryDialog.screenshot({path:'.portal-data/repository-saved-documents.png'});

 const termJob={...preparedJob,documentType:'TERMO',id:'gov-term-master',status:'READY_FOR_REVIEW'};
 await page.route(base+'/api/processes/browser-protected/signatures',route=>route.fulfill({json:[{...preparedJob,status:'ARCHIVED',driveSignedFileId:'ata-signed'},termJob]}));
 await page.route(base+'/api/processes/browser-protected/documents',route=>route.fulfill({json:[{id:'term-document',type:'TERMO',title:'Termo de Autorização',status:'AGUARDANDO_ASSINATURA',requiresSignature:true,currentVersion:1,visibleToRoles:['MASTER_ADMIN']}]}));
 await page.goto(base+'/?tcc=browser-protected&secao=docs');
 const termDialog=page.getByRole('dialog',{name:'Detalhes do Trabalho de TCC',exact:true});
 await termDialog.getByRole('button',{name:'Gov.br',exact:true}).click();
 const termModal=page.getByRole('dialog',{name:'Assinatura gov.br',exact:true});
 await termModal.getByRole('button',{name:'Baixar PDF para assinar',exact:true}).waitFor();
 const termReturn=termModal.getByRole('button',{name:'Devolver PDF assinado',exact:true});
 assert.equal(await termReturn.isEnabled(),true,'Master can return the authorization term');
 const chooserEvent=page.waitForEvent('filechooser');await termReturn.click();
 const chooser=await chooserEvent;assert.equal(chooser.isMultiple(),false);
 await termModal.screenshot({path:'.portal-data/gov-term-master-file-picker.png'});
 await termModal.getByRole('button',{name:'Fechar',exact:true}).click();
 assert.equal(loginRequests,0);
 const after=JSON.parse(await readFile(path.join(dir,'portal-state.json'),'utf8'));assert.equal(after.processes.length,2);
 console.log('PASS: três perfis e suas atividades, imagens, navegação pública, mobile e guia de replicação; nenhum processo criado ou e-mail enviado.');
}catch(error){if(page){console.log(await page.locator('body').innerText());await page.screenshot({path:'.portal-data/scheduling-notice-failure.png'});}throw error;}finally{if(browser)await browser.close();if(child.exitCode===null){const stopped=new Promise(r=>child.once('exit',r));child.kill('SIGTERM');await stopped;}await rm(dir,{recursive:true,force:true});}
