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
const master='master-browser@portal.local',secret='browser-active-session-secret-0123456789abcdef';
const baseProcess={...structuredClone(DEMO_PROCESSES[0]),id:'browser-deletable',driveFolderId:undefined,defesa:{...structuredClone(DEMO_PROCESSES[0].defesa),invitationDriveFileId:undefined}};
await writeFile(path.join(dir,'portal-state.json'),JSON.stringify({settings:{...INITIAL_SETTINGS,masterEmail:master,ownerEmail:master},processes:[baseProcess,{...structuredClone(baseProcess),id:'browser-protected',driveFolderId:'institutional-record'}],memberships:[],signatureJobs:[]}));
const port=47000+Math.floor(Math.random()*500),base=`http://127.0.0.1:${port}`;
const child=spawn(process.execPath,['dist/server/server.cjs'],{cwd:process.cwd(),env:{...process.env,NODE_ENV:'development',HOST:'127.0.0.1',PORT:String(port),PORTAL_DATA_DIR:dir,PORTAL_PERSISTENCE_PROVIDER:'local_file',PORTAL_ALLOW_INSECURE_DEMO_AUTH:'false',PORTAL_TEST_DOCUMENT_RENDERER:'true',PORTAL_SERVE_COMPILED_CLIENT:'true',PORTAL_ALLOW_LOCAL_OTP_STORE:'true',PORTAL_ALLOW_LOCAL_SECRET_STORE:'true',PORTAL_SESSION_SECRET:secret,PORTAL_OTP_PEPPER:'browser-session-otp-pepper-0123456789abcdef',ASTEN_INTEGRATION_ENABLED:'false',SUPABASE_URL:'',SUPABASE_SECRET_KEY:'',SUPABASE_SERVICE_ROLE_KEY:'',VERCEL:''},stdio:'ignore'});
let browser,page;
try{
 const deadline=Date.now()+20000;while(true){try{if((await fetch(base+'/api/health')).ok)break;}catch{}if(Date.now()>deadline||child.exitCode!==null)throw Error('Test server did not start');await new Promise(r=>setTimeout(r,100));}
 const now=Math.floor(Date.now()/1000),issuedAt=now-3600;
 const value=Buffer.from(JSON.stringify({sessionId:'browser_session_fixture_1234567890',uid:`email:${master}`,email:master,emailVerified:true,authTime:issuedAt,issuedAt,expiresAt:now+3600,isDemo:false,method:'EMAIL_OTP'})).toString('base64url');
 browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
 const context=await browser.newContext({viewport:{width:1440,height:1100}});
 await context.addCookies([{name:'portal_tcc_session',value:`${value}.${createHmac('sha256',secret).update(value).digest('base64url')}`,domain:'127.0.0.1',path:'/',httpOnly:true,sameSite:'Lax'}]);
 await context.route('**/*',r=>r.request().url().startsWith(base)||/^(blob|data):/.test(r.request().url())?r.continue():r.abort());
 page=await context.newPage();page.on('pageerror',e=>console.log('PAGEERROR',e.stack));page.on('console',m=>{if(m.type()==='error')console.log('CONSOLE',m.text());});let loginRequests=0;page.on('request',r=>{if(r.url().includes('/api/auth/request-code'))loginRequests++;});
 await page.goto(base+'/');
 await page.getByRole('button',{name:'Meus TCCs',exact:true}).click();
 await page.getByRole('button',{name:'Cadastrar TCC',exact:true}).click();
 const notice=page.getByRole('note',{name:'Antes de solicitar o agendamento'});
 let reached=false;
 for(let step=0;step<12;step++){
  if(await page.getByRole('heading',{name:'Reserva do local',exact:true}).count()){reached=true;break;}
  const form=page.locator('form[aria-labelledby="registration-title"]');
  for(const select of await form.locator('select').all()){if(!await select.inputValue()){const value=await select.locator('option').evaluateAll(options=>options.map(o=>o.value).find(Boolean));if(value)await select.selectOption(value);}}
  for(const input of await form.locator('input:not([type="checkbox"]):not([type="hidden"])').all()){
   if(!await input.isVisible()||await input.getAttribute('readonly')!==null)continue;
   const type=await input.getAttribute('type')||'text';
   if(await input.inputValue())continue;
   await input.fill(type==='email'?'amostra@edu.ufes.br':type==='date'?'2026-11-20':type==='time'?'14:10':type==='number'?'1234567':'Mariana Alves da Silva');
  }
  for(const textarea of await form.locator('textarea').all())if(!await textarea.inputValue())await textarea.fill('Trabalho demonstrativo para revisão do agendamento');
  await page.getByRole('button',{name:'Continuar',exact:true}).click();
 }
 assert.equal(reached,true,'scheduling section reached without creating a process');await notice.waitFor();
 assert.match(await notice.innerText(),/Bloqueio temporário/);
 assert.equal(await notice.locator('input').count(),0);
 const location=page.getByLabel(/Local da defesa/);
 const picker=page.getByRole('button',{name:'Ver calendário de horários'});
 const before=await notice.boundingBox(),venue=await location.boundingBox(),calendar=await picker.boundingBox();
 assert.ok(before&&venue&&calendar&&before.y<venue.y&&venue.x<calendar.x,'notice and location precede the calendar');
 assert.equal(await page.locator('form[aria-labelledby="registration-title"] input:is([type="date"],[type="time"])').count(),0);
 assert.equal(await picker.isEnabled(),false);
 await location.selectOption({index:1});
 assert.equal(await picker.isEnabled(),true);
 await picker.click();
 const month=page.getByRole('region',{name:'Calendário mensal de defesas'});
 await month.waitFor();
 const surfaces=await month.evaluate(element=>{
  const dialog=element.closest('[role="dialog"]')!;
  const reference=document.createElement('div');
  reference.style.backgroundColor='var(--portal-surface-panel)';
  dialog.append(reference);
  const lightGray=getComputedStyle(reference).backgroundColor;
  reference.remove();
  return {
   lightGray,
   chrome:[...dialog.querySelectorAll(':scope > :is(.portal-modal-divider,.portal-modal-body,.portal-modal-footer)')].map(part=>getComputedStyle(part).backgroundColor),
   month:getComputedStyle(element).backgroundColor,
  };
 });
 assert.deepEqual(surfaces.chrome,Array(3).fill(surfaces.lightGray));
 assert.notEqual(surfaces.month,surfaces.lightGray);
 await month.getByRole('button',{name:/^\d{1,2} de /}).first().click();
 const daily=page.getByRole('dialog',{name:/Horários da defesa/});
 await daily.getByRole('heading',{name:'Faixa de horários do local'}).waitFor();
 const dailyBackgrounds=await daily.locator(':scope > :is(.portal-modal-divider,.portal-modal-body,.portal-modal-footer)').evaluateAll(parts=>parts.map(part=>getComputedStyle(part).backgroundColor));
 assert.deepEqual(dailyBackgrounds,surfaces.chrome);
 await daily.getByRole('button',{name:'Voltar ao calendário'}).click();
 await page.getByRole('button',{name:'Cancelar',exact:true}).click();
 await page.screenshot({path:'.portal-data/scheduling-notice-agendamento.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});await notice.scrollIntoViewIfNeeded();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.screenshot({path:'.portal-data/scheduling-notice-mobile.png',fullPage:true});
 assert.equal(loginRequests,0);console.log('PASS: location before calendar, monthly view without manual date fields, mobile layout, no registration submitted.');

}catch(error){if(page){console.log(await page.locator('body').innerText());await page.screenshot({path:'.portal-data/scheduling-notice-failure.png'});}throw error;}finally{if(browser)await browser.close();if(child.exitCode===null){const stopped=new Promise(r=>child.once('exit',r));child.kill('SIGTERM');await stopped;}await rm(dir,{recursive:true,force:true});}
