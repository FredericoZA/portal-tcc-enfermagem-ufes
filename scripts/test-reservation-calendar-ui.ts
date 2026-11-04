/** Read-only browser regression: isolated local responses, no provider requests or writes. */
import {createRequire} from 'node:module';
import path from 'node:path';
import {mkdir,writeFile} from 'node:fs/promises';
import {DEMO_PROCESSES} from '../src/services/demoSeed';
import {publicRepositoryView} from '../server/publicViews';
const require=createRequire(import.meta.url);
const runtime=process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES;
const {chromium}=runtime?require(path.join(runtime,'playwright')):require('playwright');
const base=process.env.PORTAL_REVIEW_URL||'http://127.0.0.1:3001';
if(!['127.0.0.1','localhost'].includes(new URL(base).hostname))throw Error('Local browser test only');
const directory='output/calendar-review';await mkdir(directory,{recursive:true});
const item=structuredClone(DEMO_PROCESSES[0]);
Object.assign(item,{id:'calendar-fixture',protocolo:'TCC-2026-9001',titulo:'Educação em Saúde — Exemplo de Agendamento',status:'AGUARDANDO_CONFIRMACAO_LOCAL',etapaAtual:'CONFIRMACAO_LOCAL'});
item.aluno1={nome:'Alice Martins Pereira',email:'alice@example.invalid',matricula:'EXEMPLO001'};item.aluno2=null;
item.orientador={nome:'Carolina Souza Lima',email:'orientador@example.invalid',tratamento:'Professora',titulacao:'Doutora'};
item.avaliacao={status:'PENDENTE'};item.acervo={resumoSintese:'Exemplo fictício para conferir o calendário.',palavrasChave:['Educação','Saúde','Enfermagem','Cuidado','Comunidade']};
item.defesa={startAt:'2026-11-05T17:00:00Z',endAt:'2026-11-05T18:30:00Z',local:'Auditório de Enfermagem',localStatus:'PENDENTE',hasReservationReceipt:false} as any;
const stale={id:'google-old-fixture',portalTccProtocol:item.protocolo,summary:'Evento antigo que não deve reaparecer',description:`Protocolo: ${item.protocolo}`,start:item.defesa.startAt,end:item.defesa.endAt};
const code=new RegExp(item.protocolo.split('-').join('\\s*-\\s*'));
let current=structuredClone(item);
const browser=await chromium.launch({headless:true,...(process.env.PORTAL_VISUAL_BROWSER_EXECUTABLE?{executablePath:process.env.PORTAL_VISUAL_BROWSER_EXECUTABLE}:{})});
const checks:any[]=[];const errors:string[]=[];
try{
 const context=await browser.newContext({viewport:{width:1560,height:1160},timezoneId:'America/Sao_Paulo'});
 await context.route('**/*',(r:any)=>r.request().url().startsWith(base)||/^(blob|data):/.test(r.request().url())?r.continue():r.abort());
 const page=await context.newPage();await page.clock.setFixedTime(new Date('2026-11-04T15:00:00Z'));
 page.on('pageerror',(error:Error)=>errors.push(error.message));
 await page.route(base+'/api/legacy-academic-records',(r:any)=>r.fulfill({json:[]}));
 await page.route(base+'/api/processes',(r:any)=>r.fulfill({json:[publicRepositoryView(current)]}));
 await page.route(base+'/api/calendar/events',(r:any)=>r.fulfill({json:[stale]}));
 const calendar=page.locator('[data-portal-sheet="calendar"]');const defenses=page.locator('[data-portal-sheet="defenses"]');
 async function inspect(name:string,present:boolean,pending:boolean){
  await page.goto(base+'/');await page.getByRole('button',{name:'Calendário',exact:true}).click();await calendar.waitFor();
  await page.waitForTimeout(400);
  const summary=calendar.locator('.portal-calendar-defense-summary').filter({hasText:item.titulo});
  if(present)await summary.waitFor();
  if(await summary.count()!==(present?1:0))throw Error(name+': incorrect calendar count');
  if(await defenses.locator('tbody tr').filter({hasText:code}).count()!==(present?1:0)){await defenses.screenshot({path:directory+'/debug-lista.png'});throw Error(name+': incorrect defense list: '+await defenses.innerText());}
  if(await calendar.getByText(/Evento antigo/).count())throw Error('Stale Google event reappeared');
  const notes=calendar.getByText('(Aguardando confirmação)',{exact:true});
  if(await notes.count()!==(pending?1:0))throw Error(name+': incorrect pending note');
  const tone=present?await summary.evaluate((el:HTMLElement)=>({background:getComputedStyle(el).backgroundColor,state:el.dataset.defenseState})):null;
  if(pending&&await notes.evaluate((el:HTMLElement)=>getComputedStyle(el).color)!=='rgb(185, 28, 28)')throw Error('Pending note must be red');
  await calendar.screenshot({path:`${directory}/${name}-calendario.png`});
  await defenses.screenshot({path:`${directory}/${name}-lista.png`});
  await page.getByRole('button',{name:'Repositório',exact:true}).click();
  const repo=page.locator('[data-portal-sheet="repository"]');await repo.waitFor();
  await repo.locator('tbody tr').filter({hasText:code}).waitFor({timeout:10000});
  if(await repo.locator('tbody tr').filter({hasText:code}).count()!==1)throw Error(name+': TCC disappeared from repository');
  if(await repo.getByText('(Aguardando confirmação)',{exact:true}).count()!==(pending?1:0))throw Error(name+': incorrect repository note');
  await repo.screenshot({path:`${directory}/${name}-repositorio.png`});
  checks.push({name,onCalendar:present,pending,protocol:current.protocolo,tone});
 }
 await inspect('01-pendente',true,true);
 current.defesa.localStatus='CONFIRMADO';await inspect('02-confirmado',true,false);
 current.defesa.localStatus='PENDENTE';current.defesa.departmentResponse={revision:0,decision:'UNAVAILABLE',respondedAt:'2026-11-04T16:00:00Z',respondedBy:'secretaria@example.invalid',startAt:item.defesa.startAt,endAt:item.defesa.endAt};
 await inspect('03-recusado',false,false);
 current=structuredClone(item);current.defesa.startAt='2026-11-06T17:00:00Z';current.defesa.endAt='2026-11-06T18:30:00Z';
 await inspect('04-nova-solicitacao',true,true);
 // Keep an already open calendar popup synchronized with the server response.
 current=structuredClone(item);await page.goto(base+'/');
 await page.getByRole('button',{name:'Calendário',exact:true}).click();
 const pendingSummary=calendar.locator('.portal-calendar-defense-summary').filter({hasText:item.titulo});
 await pendingSummary.waitFor();await pendingSummary.click();
 const popup=page.locator('#day-defenses-modal');await popup.waitFor();
 const popupNote=popup.getByText('(Aguardando confirmação)',{exact:true});await popupNote.waitFor();
 current.defesa.localStatus='CONFIRMADO';
 await page.evaluate(()=>window.dispatchEvent(new Event('portal:remote-data-changed')));
 await popupNote.waitFor({state:'detached'});
 if(!await popup.isVisible())throw Error('Acceptance closed the existing day popup');
 current.defesa.localStatus='PENDENTE';current.defesa.departmentResponse={revision:0,decision:'UNAVAILABLE',respondedAt:'2026-11-04T16:00:00Z',respondedBy:'secretaria@example.invalid',startAt:item.defesa.startAt,endAt:item.defesa.endAt};
 await page.evaluate(()=>window.dispatchEvent(new Event('portal:remote-data-changed')));
 await popup.waitFor({state:'detached'});
 if(checks[0].tone.background!==checks[1].tone.background)throw Error('Pending and confirmed future defenses changed colors');
 if(errors.length)throw Error(errors.join('\n'));
 await writeFile(`${directory}/verification.json`,JSON.stringify({localOnly:true,synthetic:true,productionWrites:false,openPopupRefresh:true,errors,checks},null,2)+'\n');
 console.log(JSON.stringify({scenarios:checks.length,errors,checks}));
}catch(error){console.error(error);throw error;}finally{await browser.close();}
