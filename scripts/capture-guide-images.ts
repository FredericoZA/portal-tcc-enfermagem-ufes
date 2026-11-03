/** Rebuild manual illustrations from rendered current UI with isolated synthetic data.
 * No production credentials, provider traffic, or existing portal data is used.
 * Run: node --import tsx scripts/capture-guide-images.ts (after npm run build).
 */
import {createRequire} from 'node:module';
import {createHmac,createHash,randomBytes} from 'node:crypto';
import {spawn} from 'node:child_process';
import {mkdtemp,writeFile,readFile,rm,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {DEMO_PROCESSES,INITIAL_SETTINGS} from '../src/services/demoSeed';
const root=process.cwd(),temp=await mkdtemp(path.join(tmpdir(),'portal-guide-'));
const runtime=process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES||'/Users/fredericozacchedeaguiar/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules';
const {chromium}=createRequire(import.meta.url)(path.join(runtime,'playwright'));
const master='master@portal.local',advisor='orientador@example.invalid';
// Ephemeral fixture credentials for this isolated local capture only.
// The child process receives no real provider credentials.
const createLocalFixtureSecret=()=>randomBytes(48).toString('base64url');
const fixture=structuredClone(DEMO_PROCESSES[0]);
Object.assign(fixture,{id:'guide-process',protocolo:'TCC-2026-0123',titulo:'Educação em Saúde na Atenção Primária — Exemplo',createdByEmail:'alice@example.invalid',dataRevision:1,etapaAtual:'DEFESA',status:'AGUARDANDO_DEFESA',createdAt:'2026-10-02T13:00:00.000Z'});
fixture.aluno1={nome:'Alice Martins Pereira',email:'alice@example.invalid',matricula:'EXEMPLO001',tratamento:'Aluna'};
fixture.aluno2={nome:'Bruno Almeida Costa',email:'bruno@example.invalid',matricula:'EXEMPLO002',tratamento:'Aluno'};
fixture.orientador={nome:'Carolina Souza Lima',email:advisor,instituicao:'UFES',tratamento:'Professora',titulacao:'Doutora'};
fixture.coorientador={nome:'Rafael Oliveira Santos',email:'coorientador@example.invalid',instituicao:'UFES',tratamento:'Professor',titulacao:'Doutor'};
fixture.banca=[{id:'exam-a',nome:'Beatriz Rocha Silva',email:'avaliador.a@example.invalid',funcao:'EXAMINER_2',tratamento:'Professora',titulacao:'Doutora',instituicao:'UFES'},{id:'exam-b',nome:'Daniel Castro Alves',email:'avaliador.b@example.invalid',funcao:'EXAMINER_3',tratamento:'Professor',titulacao:'Mestre',instituicao:'UFES'}];
fixture.defesa={startAt:'2026-11-03T13:00:00.000Z',endAt:'2026-11-03T14:30:00.000Z',local:'Auditório do Prédio do Departamento de Enfermagem - CCS/UFES',localStatus:'CONFIRMADO',localConfirmedAt:'2026-10-29T13:00:00.000Z',invitationSentAt:'2026-10-29T13:01:00.000Z',hasReservationReceipt:true};
fixture.avaliacao={status:'PENDENTE'};fixture.acervo={resumoSintese:'Estudo demonstrativo sobre educação em saúde na atenção primária. Apresenta ações educativas, participação da comunidade e cuidados de enfermagem. Dados fictícios usados apenas neste exemplo.',palavrasChave:['Educação em Saúde','Enfermagem','Atenção Primária','Promoção da Saúde','Comunidade']};
const port=48000+Math.floor(Math.random()*500),base=`http://127.0.0.1:${port}`;
await writeFile(path.join(temp,'portal-state.json'),JSON.stringify({settings:{...INITIAL_SETTINGS,masterEmail:master,ownerEmail:master},processes:[fixture],memberships:[{id:'guide-advisor',processId:fixture.id,email:advisor,roles:['ADVISOR'],active:true,createdAt:fixture.createdAt,updatedAt:fixture.createdAt},{id:'guide-author',processId:fixture.id,email:'alice@example.invalid',roles:['STUDENT'],active:true,createdAt:fixture.createdAt,updatedAt:fixture.createdAt}],signatureJobs:[],legacyAcademicRecords:[]}));
const environment={
 NODE_ENV:'development',
 HOST:'127.0.0.1',
 PORT:String(port),
 PORTAL_PUBLIC_URL:base,
 APP_URL:base,
 PORTAL_DATA_DIR:temp,
 PORTAL_PERSISTENCE_PROVIDER:'local_file',
 PORTAL_LOCAL_REVIEW_DATA_CUSTOM_DIR:'false',
 PORTAL_ALLOW_INSECURE_DEMO_AUTH:'false',
 PORTAL_TEST_DOCUMENT_RENDERER:'true',
 PORTAL_SERVE_COMPILED_CLIENT:'true',
 PORTAL_ALLOW_LOCAL_OTP_STORE:'true',
 PORTAL_ALLOW_LOCAL_SECRET_STORE:'true',
 PORTAL_SESSION_SECRET:createLocalFixtureSecret(),
 PORTAL_OTP_PEPPER:createLocalFixtureSecret(),
 ASTEN_INTEGRATION_ENABLED:'false',
};
const bootstrap=`import {createRequire} from 'node:module';import{pathToFileURL}from'node:url';const require=createRequire(${JSON.stringify(path.join(root,'package.json'))});const dotenv=require('dotenv');dotenv.config=()=>({parsed:{}});process.chdir(${JSON.stringify(root)});await import(pathToFileURL(${JSON.stringify(path.join(root,'dist/server/server.cjs'))}).href);`;
await writeFile(path.join(temp,'start.mjs'),bootstrap);
const env=Object.fromEntries(Object.entries(process.env).filter(([key])=>['PATH','HOME','TMPDIR','LANG','TZ'].includes(key)));Object.assign(env,environment);
const child=spawn(process.execPath,[path.join(temp,'start.mjs')],{cwd:root,env,stdio:['ignore','pipe','pipe']});let serverLog='';child.stdout.on('data',x=>serverLog+=x);child.stderr.on('data',x=>serverLog+=x);
let browser:any;const images:any[]=[];const mutations:string[]=[];
try{
 for(let n=0;;n++){try{if((await fetch(base+'/api/health')).ok)break;}catch{}if(n>150||child.exitCode!==null)throw Error('Isolated server failed: '+serverLog.slice(-1200));await new Promise(r=>setTimeout(r,100));}
 browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
 const context=await browser.newContext({viewport:{width:1560,height:1460},deviceScaleFactor:1});
 await context.route('**/*',r=>r.request().url().startsWith(base)||/^(blob|data):/.test(r.request().url())?r.continue():r.abort());
 const page=await context.newPage();page.on('request',request=>{if(!['GET','HEAD','OPTIONS'].includes(request.method()))mutations.push(request.method()+' '+new URL(request.url()).pathname);});const errors:string[]=[];page.on('pageerror',error=>errors.push(String(error)));
 async function login(email:string){const now=Math.floor(Date.now()/1000),value=Buffer.from(JSON.stringify({sessionId:'guide_session_fixture_1234567890',uid:`email:${email}`,email,emailVerified:true,authTime:now-300,issuedAt:now-300,expiresAt:now+3600,isDemo:false,method:'EMAIL_OTP'})).toString('base64url');await context.clearCookies();await context.addCookies([{name:'portal_tcc_session',value:`${value}.${createHmac('sha256',environment.PORTAL_SESSION_SECRET).update(value).digest('base64url')}`,domain:'127.0.0.1',path:'/',httpOnly:true,sameSite:'Lax'}]);}
 async function save(id:string,locator:any,scenario:string){await locator.waitFor();await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(250);const file=path.join(root,'public/manual',`${id}.jpg`);await locator.screenshot({path:file,type:'jpeg',quality:91,animations:'disabled'});const bytes=await readFile(file),sharp=createRequire(import.meta.url)(path.join(root,'node_modules/sharp'));const metadata=await sharp(bytes).metadata();images.push({id,file:`/manual/${id}.jpg`,scenario,sha256:createHash('sha256').update(bytes).digest('hex'),width:metadata.width,height:metadata.height});console.log('CAPTURE',id,metadata.width,metadata.height);}
 async function home(){await page.goto(base+'/');await page.getByRole('button',{name:'Calendário',exact:true}).waitFor();}
 async function open(section:string){await page.goto(base+`/?tcc=${fixture.id}&secao=${section}`);await page.getByRole('dialog').filter({has:page.getByText('Detalhes do TCC',{exact:true})}).waitFor();await page.waitForTimeout(500);return page.getByRole('dialog').filter({has:page.getByText('Detalhes do TCC',{exact:true})});}
 await home();await page.getByRole('button',{name:'Entrar no Portal',exact:true}).click();await save('acesso',page.getByRole('dialog').last(),'Acesso público por e-mail; nenhum código real solicitado');await page.keyboard.press('Escape');
 await login(master);await home();await page.getByRole('button',{name:'Meus TCCs',exact:true}).click();await page.getByRole('button',{name:'Cadastrar TCC',exact:true}).click();await save('cadastro',page.getByRole('dialog').last(),'Cadastro inicial, etapa 1, usuário de demonstração');await page.keyboard.press('Escape');
 let dialog=await open('geral');await save('ficha',dialog,'Dados do processo fictício, identidade e quatro abas atuais');
 const edit=dialog.getByRole('button',{name:'Alterar reserva da defesa',exact:true});if(await edit.count()){await edit.click();await page.getByRole('dialog',{name:'Alterar reserva da defesa',exact:true}).waitFor();await save('confirmacao',page.getByRole('dialog').last(),'Alteração explícita da reserva, sem enviar nova solicitação');await page.keyboard.press('Escape');}else await save('confirmacao',dialog,'Reserva confirmada e acesso à alteração');
 await login(advisor);dialog=await open('avaliacao');
 await dialog.getByRole('combobox',{name:'Resultado da defesa',exact:false}).selectOption('APROVADO');
 await dialog.getByRole('textbox',{name:'Parecer da banca',exact:false}).fill('O trabalho demonstrativo apresenta coerência entre objetivos, método e resultados. A banca recomenda a aprovação.');
 await save('avaliacao',dialog,'Conceito e parecer do orientador antes do registro; sem assinatura disparada');
 await dialog.getByRole('button',{name:'Visualizar ata',exact:true}).click();
 const ataPreview=page.getByRole('dialog',{name:'Conferir Ata da defesa',exact:true});
 try{await ataPreview.waitFor({timeout:10000});await page.waitForTimeout(1500);await save('ata-previa',ataPreview.locator('div.border-t').last(),'Controles de conferência da prévia; PDF de teste não exibido, nenhum registro ou assinatura enviado');await ataPreview.getByRole('button',{name:'Voltar e corrigir',exact:true}).isVisible();await page.keyboard.press('Escape');}catch{console.log('SKIP ata-previa: modelo não disponível neste servidor isolado');}

 const completed={...structuredClone(fixture),avaliacao:{status:'CONCLUIDO',resultadoCode:'APROVADO',resultadoLabel:'Aprovado',parecer:'O trabalho demonstra coerência entre objetivos, método e resultados. A banca recomenda a aprovação.',submittedAt:'2026-11-03T14:00:00.000Z',submittedBy:advisor},etapaAtual:'ASSINATURA',status:'AGUARDANDO_ASSINATURA'};
 await page.route(base+`/api/processes/${fixture.id}`,r=>r.fulfill({json:completed}));
 const documents=[{id:'guide-invite',type:'CONVITE',title:'Carta-Convite da Banca',status:'DISPONIVEL',requiresSignature:false,currentVersion:1},{id:'guide-ata',type:'ATA',title:'Ata Oficial da Defesa Final',status:'AGUARDANDO_ASSINATURA',requiresSignature:true,currentVersion:1},{id:'guide-term',type:'TERMO',title:'Termo de Autorização e Publicação',status:'NAO_DISPONIVEL',requiresSignature:true,currentVersion:1},{id:'guide-decl',type:'DECLARACAO',title:'Declaração de Participação na Banca',status:'NAO_DISPONIVEL',requiresSignature:true,currentVersion:1}];
 await page.route(base+`/api/processes/${fixture.id}/documents`,r=>r.fulfill({json:documents}));dialog=await open('docs');await save('documentos',dialog,'Cinco caixas administrativas, ata aguardando assinatura, orientador autorizado');
 await dialog.getByRole('button',{name:'Gov.br',exact:true}).first().click();await save('gov',page.getByRole('dialog').last(),'Assinatura Gov.br: baixar original e devolver PDF; sem executar integração');await page.keyboard.press('Escape');
 const archived={id:'guide-archived',processId:fixture.id,protocol:fixture.protocolo,documentType:'ATA',documentVersion:1,sourceDataRevision:1,provider:'GOV_BR',status:'ARCHIVED',driveSignedFileId:'synthetic-signed-ata',signers:[{id:'advisor',name:fixture.orientador.nome,email:advisor,role:'ADVISOR',status:'SIGNED',signingOrder:1}]};
 await page.route(base+`/api/processes/${fixture.id}/signatures`,r=>r.fulfill({json:[archived]}));await page.route(base+`/api/processes/${fixture.id}`,r=>r.fulfill({json:{...completed,etapaAtual:'REPOSITORIO',status:'AGUARDANDO_DADOS_FINAIS'}}));
 await login('alice@example.invalid');dialog=await open('acervo');await save('repositorio',dialog,'Entrega final pelo autor após ata arquivada; publicação opcional por arquivo');
 await page.route(base+`/api/processes/${fixture.id}`,r=>r.fulfill({json:{...completed,etapaAtual:'ASSINATURA',status:'AGUARDANDO_ASSINATURA',acervo:{...fixture.acervo,submittedAt:'2026-11-03T15:00:00.000Z',trabalhoCompletoFileName:'TCC-2026-0123_TRABALHO_COMPLETO_v001.pdf',trabalhoCompletoFileUrl:'/exemplo.pdf',publishFullWork:true,publishExpandedAbstract:false}}}));dialog=await open('acervo');await save('entrega-confirmada',dialog,'Entrega final registrada: campos bloqueados e botão Editar entrega enquanto permitido');
 await context.clearCookies();await home();await page.getByRole('button',{name:'Calendário',exact:true}).click();await save('calendario',page.locator('#formal-monthly-calendar-section'),'Calendário público, defesa fictícia');await page.getByRole('button',{name:'Repositório',exact:true}).click();await save('consulta-publica',page.locator('[data-portal-sheet=repository]'),'Repositório público, consulta sem login');
 // A historical example shares the regular four-tab process model. No original personal data.
 await page.route(base+'/api/public/processes/legado-0123',r=>r.fulfill({json:{...fixture,id:'legado-0123',protocolo:'123 - Legado',legacyRecord:true,etapaAtual:'CONCLUIDO',status:'CONCLUIDO',titulo:'Educação em Saúde na Atenção Primária — Exemplo Histórico',canAccessPrivate:false,createdAt:'',updatedAt:'',aluno1:{nome:'Alice Martins Pereira'},aluno2:null,orientador:{nome:'Carolina Souza Lima'},coorientador:null,banca:[],avaliacao:{status:'PENDENTE'},documents:[]}}));
 await page.goto(base+'/?tcc=legado-0123&secao=geral');await page.waitForTimeout(700);await save('legados',page.getByRole('dialog').last(),'Modelo público compartilhado para registro histórico fictício');
 await home();await page.getByRole('button',{name:'Sugestões de melhoria',exact:true}).click();await page.getByRole('dialog').last().getByRole('textbox').first().fill('Exemplo: melhorar a descrição de uma etapa do cadastro.');await save('sugestoes',page.getByRole('dialog').last(),'Formulário público de sugestões; não enviado');
 await login(master);await home();
 const registrationAnswers={ALUNO_1_NOME:fixture.aluno1.nome,ALUNO_1_EMAIL:fixture.aluno1.email,ALUNO_1_MATRICULA:fixture.aluno1.matricula,TEM_ALUNO_2:'Sim',ALUNO_2_NOME:fixture.aluno2.nome,ALUNO_2_EMAIL:fixture.aluno2.email,ALUNO_2_MATRICULA:fixture.aluno2.matricula,AUTORIA_REFERENCIA:'os alunos',ORIENTADOR_NOME:fixture.orientador.nome,ORIENTADOR_EMAIL:advisor,ORIENTADOR_TRATAMENTO:'Professora',ORIENTADOR_TITULACAO:'Doutora',TEM_COORIENTADOR:'Sim',COORIENTADOR_NOME:fixture.coorientador.nome,COORIENTADOR_EMAIL:fixture.coorientador.email,COORIENTADOR_TRATAMENTO:'Professor',COORIENTADOR_TITULACAO:'Doutor',COORIENTADOR_INSTITUICAO:'UFES',EXAMINADOR_2_NOME:fixture.banca[0].nome,EXAMINADOR_2_EMAIL:fixture.banca[0].email,EXAMINADOR_2_TRATAMENTO:'Professora',EXAMINADOR_2_TITULACAO:'Doutora',EXAMINADOR_2_INSTITUICAO:'UFES',EXAMINADOR_3_NOME:fixture.banca[1].nome,EXAMINADOR_3_EMAIL:fixture.banca[1].email,EXAMINADOR_3_TRATAMENTO:'Professor',EXAMINADOR_3_TITULACAO:'Mestre',EXAMINADOR_3_INSTITUICAO:'UFES',TITULO:fixture.titulo,DEFESA_DATA_HORA:'2026-12-10T14:00',DEFESA_LOCAL:fixture.defesa.local};
 await page.evaluate(({master,answers})=>localStorage.setItem('portal-registration-v2:'+master,JSON.stringify({savedAt:Date.now(),answers,section:6,recent:{}})),{master,answers:registrationAnswers});
 await page.getByRole('button',{name:'Meus TCCs',exact:true}).click();await page.getByRole('button',{name:'Cadastrar TCC',exact:true}).click();const reserveForm=page.getByRole('dialog').last();await reserveForm.getByRole('heading',{name:'Reserva do local',exact:true}).waitFor();await save('reserva',reserveForm,'Última etapa do cadastro: orientações e reserva do único local, dados fictícios, sem enviar');await page.keyboard.press('Escape');
 await page.getByRole('button',{name:'Área do Presidente',exact:true}).click();await save('presidencia',page.locator('[data-portal-sheet=president]'),'Área de declarações, lista de demonstração');
 const finalState=JSON.parse(await readFile(path.join(temp,'portal-state.json'),'utf8'));if(finalState.processes.length!==1||(finalState.signatureJobs||[]).length||(finalState.emailDeliveries||[]).length)throw Error('Capture unexpectedly changed live process or integration jobs.');if(mutations.some(value=>/\/auth\/request-code|\/feedback$|\/final-data$|\/signatures$/.test(value)))throw Error('Capture attempted a delivery or provider mutation.');
 await writeFile(path.join(root,'public/manual/capture-manifest.json'),JSON.stringify({capturedAt:new Date().toISOString(),source:'Current compiled local UI, built from workspace; isolated temporary local_file backend',synthetic:true,providerTrafficBlocked:true,productionWrites:false,verification:{liveProcesses:1,signatureJobs:0,emailDeliveries:0,mutations},interceptedScenarios:['ATA registrada para demonstração de documentos','ATA arquivada para liberar exemplo de entrega','Registro histórico fictício'],images,errors},null,2)+'\n');
 if(errors.length)throw Error('Browser errors: '+errors.join('\n'));
 console.log('Guide images refreshed: '+images.length);
}catch(error){console.error(error);if(browser){const pages=browser.contexts()[0]?.pages();if(pages?.[0]){console.error((await pages[0].locator('body').innerText()).slice(-8000));await pages[0].screenshot({path:path.join(root,'output/playwright/guide-capture-failure.png'),fullPage:true});}}process.exitCode=1;}finally{await browser?.close();if(child.exitCode===null){const stopped=new Promise(r=>child.once('exit',r));child.kill('SIGTERM');await stopped;}await rm(temp,{recursive:true,force:true});}
