// Local browser regression: no production access or real email delivery.
import {createRequire} from 'node:module';
import {spawn} from 'node:child_process';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {DEMO_PROCESSES,INITIAL_SETTINGS} from '../src/services/demoSeed.ts';
let chromium;
try{({chromium}=createRequire(import.meta.url)('playwright'));}catch{
 const dependencies=process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES;
 if(dependencies)({chromium}=createRequire(path.join(dependencies,'__portal_resolver.cjs'))('playwright'));
}
if(!chromium)throw new Error('Playwright não está disponível no ambiente de verificação.');
const output=path.resolve(process.env.PORTAL_LINK_TEST_OUTPUT||'.portal-data/email-link-review');await mkdir(output,{recursive:true});

const dir=await mkdtemp(path.join(tmpdir(),'portal-browser-session-'));
const master='master-browser@portal.local',secret='browser-active-session-secret-0123456789abcdef';
const baseProcess={...structuredClone(DEMO_PROCESSES[0]),id:'browser-deletable',driveFolderId:undefined,defesa:{...structuredClone(DEMO_PROCESSES[0].defesa),invitationDriveFileId:undefined}};
await writeFile(path.join(dir,'portal-state.json'),JSON.stringify({settings:{...INITIAL_SETTINGS,masterEmail:master,ownerEmail:master},processes:[baseProcess,{...structuredClone(baseProcess),id:'browser-protected',protocolo:'TCC-2026-9001',status:'CONCLUIDO',etapaAtual:'CONCLUIDO',driveFolderId:'institutional-record'}],memberships:[],signatureJobs:[]}));
const port=40700+Math.floor(Math.random()*500),base=`http://127.0.0.1:${port}`;
const child=spawn(process.execPath,['dist/server/server.cjs'],{cwd:process.cwd(),env:{...process.env,NODE_ENV:'development',HOST:'127.0.0.1',PORT:String(port),PORTAL_DATA_DIR:dir,PORTAL_PUBLIC_URL:base,APP_URL:base,PORTAL_PERSISTENCE_PROVIDER:'local_file',PORTAL_ALLOW_INSECURE_DEMO_AUTH:'false',PORTAL_TEST_DOCUMENT_RENDERER:'true',PORTAL_SERVE_COMPILED_CLIENT:'true',PORTAL_OTP_DELIVERY_MODE:'log',PORTAL_ALLOW_LOCAL_OTP_STORE:'true',PORTAL_ALLOW_LOCAL_SECRET_STORE:'true',PORTAL_SESSION_SECRET:secret,PORTAL_OTP_PEPPER:'browser-session-otp-pepper-0123456789abcdef',ASTEN_INTEGRATION_ENABLED:'false',SUPABASE_URL:'',SUPABASE_SECRET_KEY:'',SUPABASE_SERVICE_ROLE_KEY:'',VERCEL:''},stdio:['ignore','pipe','pipe']});
let browser,page;let serverOutput='';child.stdout?.on('data',chunk=>{serverOutput+=chunk.toString();});
try{
 const deadline=Date.now()+20000;while(true){try{if((await fetch(base+'/api/health')).ok)break;}catch{}if(Date.now()>deadline||child.exitCode!==null)throw Error('Test server did not start');await new Promise(r=>setTimeout(r,100));}
 browser=await chromium.launch({headless:true,...(process.env.PORTAL_VISUAL_BROWSER_EXECUTABLE?{executablePath:process.env.PORTAL_VISUAL_BROWSER_EXECUTABLE}:{})});
 const context=await browser.newContext({viewport:{width:1440,height:1100}});
 await context.route('**/*',r=>r.request().url().startsWith(base)||/^(blob|data):/.test(r.request().url())?r.continue():r.abort());
 page=await context.newPage();page.on('pageerror',e=>console.log('PAGEERROR',e.stack));page.on('console',m=>{if(m.type()==='error')console.log('CONSOLE',m.text());});let loginRequests=0;page.on('request',r=>{if(r.url().includes('/api/auth/request-code'))loginRequests++;});
 let privateRequests=0;page.on('request',r=>{if(new URL(r.url()).pathname.startsWith('/api/processes/'))privateRequests++;});
 await page.goto(base+'/');await page.getByRole('button',{name:'Repositório',exact:true}).click();
 const repositoryCode=page.locator('#home-page-container td[title="Clique aqui no Nº do Processo para abrir o TCC"]').filter({hasText:/TCC\s*-\s*2026\s*-\s*9001/}).first();await repositoryCode.waitFor();await repositoryCode.click();
 await page.getByPlaceholder('nome@exemplo.com').waitFor();await page.getByRole('button',{name:'Cancelar',exact:true}).click();await page.getByRole('region',{name:'Consulta pública do TCC'}).waitFor();assert.equal(privateRequests,0);await page.getByRole('region',{name:'Consulta pública do TCC'}).getByRole('button',{name:'Fechar',exact:true}).click();
 const target=base+'/?tcc=TCC-2026-9001&secao=docs';await page.goto(target);
 await page.getByPlaceholder('nome@exemplo.com').waitFor();assert.equal(privateRequests,0);assert.equal(await page.getByRole('dialog',{name:'Detalhes do Trabalho de TCC',exact:true}).count(),1);assert.equal(page.url(),target);
 await page.getByRole('button',{name:'Cancelar',exact:true}).click();assert.equal(page.url(),target);await page.getByRole('region',{name:'Consulta pública do TCC'}).waitFor();assert.equal(privateRequests,0);const publicView=page.getByRole('region',{name:'Consulta pública do TCC'});await publicView.getByRole('tab',{name:'Dados do processo',exact:true}).click();assert.match(await publicView.innerText(),new RegExp(baseProcess.aluno1.nome));assert.ok(!(await publicView.innerText()).includes(baseProcess.aluno1.email));assert.ok(!(await publicView.innerText()).includes(baseProcess.aluno1.matricula));await page.screenshot({path:path.join(output,'email-link-public-data.png')});await publicView.getByRole('tab',{name:'Documentos do processo',exact:true}).click();assert.equal(page.url(),target);await page.screenshot({path:path.join(output,'email-link-public.png')});
 await page.getByRole('region',{name:'Consulta pública do TCC'}).getByRole('button',{name:'Entrar no Portal',exact:true}).click();await page.getByPlaceholder('nome@exemplo.com').waitFor();await page.keyboard.press('Escape');await page.getByPlaceholder('nome@exemplo.com').waitFor({state:'hidden'});await page.getByRole('region',{name:'Consulta pública do TCC'}).waitFor();assert.equal(page.url(),target);await page.getByRole('region',{name:'Consulta pública do TCC'}).getByRole('button',{name:'Entrar no Portal',exact:true}).click();await page.getByPlaceholder('nome@exemplo.com').fill(master);
 await page.getByRole('button',{name:'Enviar código',exact:true}).click();await page.getByPlaceholder('000000').waitFor();
 const code=serverOutput.match(/\[Portal OTP desenvolvimento\] master-browser@portal\.local: (\d{6})/)?.[1];assert.ok(code,'Development-only OTP was generated locally');
 await page.getByPlaceholder('000000').fill(code);await page.locator('#home-page-container').getByRole('button',{name:'Entrar',exact:true}).click();
 await page.getByRole('dialog',{name:'Detalhes do Trabalho de TCC',exact:true}).waitFor();await page.getByRole('button',{name:'Documentos do processo',exact:true}).waitFor();assert.equal(await page.getByRole('button',{name:'Documentos do processo',exact:true}).getAttribute('aria-pressed'),'true');assert.equal(new URL(page.url()).searchParams.get('secao'),'docs');assert.ok(['TCC-2026-9001','browser-protected'].includes(new URL(page.url()).searchParams.get('tcc')));assert.equal(loginRequests,1);
 await page.screenshot({path:path.join(output,'email-link-authenticated.png')});
 await page.reload();await page.getByRole('dialog',{name:'Detalhes do Trabalho de TCC',exact:true}).waitFor();assert.equal(await page.getByPlaceholder('nome@exemplo.com').count(),0);assert.equal(loginRequests,1);
 await page.goto(base+'/?tcc=browser-protected&secao=geral');await page.getByRole('button',{name:'Dados do processo',exact:true}).waitFor();assert.equal(await page.getByRole('button',{name:'Dados do processo',exact:true}).getAttribute('aria-pressed'),'true');assert.equal(loginRequests,1);
 await page.getByRole('button',{name:'Excluir trabalho',exact:true}).click();
 const deleteDialog=page.getByRole('dialog',{name:'Exclusão de Trabalho de TCC',exact:true});await deleteDialog.waitFor();assert.ok(!(await deleteDialog.innerText()).includes('não pode ser excluído'));assert.ok(!(await deleteDialog.innerText()).includes('novo login'));
 assert.equal(await deleteDialog.getByRole('checkbox').count(),0);assert.match(await deleteDialog.innerText(),/Exclusão completa do TCC/);await deleteDialog.getByRole('textbox').fill('EXCLUIR');assert.equal(await deleteDialog.getByRole('button',{name:'Confirmar exclusão definitiva',exact:true}).isEnabled(),true);await page.screenshot({path:path.join(output,'master-delete-options.png')});await deleteDialog.getByRole('button',{name:'Cancelar',exact:true}).click();
 await page.goto(base+'/');await page.getByRole('button',{name:'Configurações',exact:true}).click();await page.getByRole('button',{name:'E-mails Mensagens institucionais',exact:false}).click();
 const emailSelect=page.getByRole('combobox',{name:'Selecionar e-mail',exact:true});await emailSelect.waitFor();assert.equal(await emailSelect.locator('option').count(),9);await page.screenshot({path:path.join(output,'settings-nine-emails.png')});await page.keyboard.press('Escape');
 await page.getByRole('button',{name:'Formulários Formulários, campos',exact:false}).click();const formSelect=page.getByRole('combobox',{name:'Selecionar formulário',exact:true});await formSelect.waitFor();assert.equal(await formSelect.locator('option').count(),2);await formSelect.selectOption('form-reserva-departamento');await page.screenshot({path:path.join(output,'settings-department-form.png')});await page.keyboard.press('Escape');
 await page.goto(base+'/?tcc=browser-protected&secao=geral');await page.getByRole('button',{name:'Dados do processo',exact:true}).waitFor();
 await context.clearCookies();await page.reload();await page.getByPlaceholder('nome@exemplo.com').waitFor();assert.equal(new URL(page.url()).searchParams.get('tcc'),'browser-protected');assert.equal(new URL(page.url()).searchParams.get('secao'),'geral');
 await page.screenshot({path:path.join(output,'email-link-login.png')});
 await writeFile(path.join(output,'email-link-result.json'),JSON.stringify({repositoryButtonOpensPublicDetail:true,anonymousShowsLogin:true,publicDetailBehindLogin:true,cancellationKeepsPublicView:true,publicViewHidesContactAndRegistration:true,noPrivateRequestBeforeLogin:true,cancellationPreservesDestination:true,realLocalOtpLogin:true,opensOriginalProcessAndSection:true,activeSessionSkipsOtp:true,expiredSessionPreservesDestination:true,otpRequests:loginRequests,productionTouched:false},null,2));
 console.log('Email link browser -> real local OTP -> original TCC/docs; cancel, reload, geral and expired-session destination verified. No real emails or production changes.');
}catch(error){if(page){console.log(await page.locator('body').innerText());await page.screenshot({path:path.join(output,'email-link-failure.png')});}throw error;}finally{if(browser)await browser.close();if(child.exitCode===null){const stopped=new Promise(r=>child.once('exit',r));child.kill('SIGTERM');await stopped;}await rm(dir,{recursive:true,force:true});}
