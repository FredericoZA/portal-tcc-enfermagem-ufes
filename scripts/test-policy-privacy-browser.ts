/** Isolated local role/visibility regression; all identities and statistics are synthetic. */
import {createRequire} from 'node:module';
import path from 'node:path';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {DEMO_PROCESSES} from '../src/services/demoSeed';
import {buildPublicIndicators} from '../server/publicIndicators';
const require=createRequire(import.meta.url),runtime=process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES;
const {chromium}=runtime?require(path.join(runtime,'playwright')):require('playwright');
const base=process.env.PORTAL_REVIEW_URL||'http://127.0.0.1:3001';
if(!['localhost','127.0.0.1'].includes(new URL(base).hostname))throw Error('Local preview only');
const out='output/policy-review';await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,...(process.env.PORTAL_VISUAL_BROWSER_EXECUTABLE?{executablePath:process.env.PORTAL_VISUAL_BROWSER_EXECUTABLE}:{})});
const errors:string[]=[],checks:any[]=[];
try{
 for(const [role,email,roles] of [['visitante','',[]],['aluno','aluno@example.invalid',[]],['master','master@portal.local',['MASTER_ADMIN']],['presidencia','presidente@portal.local',['COMMISSION_PRESIDENT']]] as const){
  const context=await browser.newContext({viewport:{width:1500,height:1050},timezoneId:'America/Sao_Paulo'});
  await context.route('**/*',(route:any)=>route.request().url().startsWith(base)||/^(blob|data):/.test(route.request().url())?route.continue():route.abort());
  if(email)await context.setExtraHTTPHeaders({'x-demo-user-email':email});
  const page=await context.newPage();page.on('pageerror',(error:Error)=>errors.push(error.message));
  await page.route(base+'/api/me',(route:any)=>route.fulfill({json:{userEmail:email,globalRoles:roles,memberships:[],isAuthenticated:Boolean(email)}}));
  await page.route(base+'/api/processes',(route:any)=>route.fulfill({json:[]}));
  await page.route(base+'/api/legacy-academic-records',(route:any)=>route.fulfill({json:[]}));
  let requests=0,administrativeRequests=0;
  await page.route(base+'/api/public/indicators',(route:any)=>{requests++;return route.fulfill({json:buildPublicIndicators(Array.from({length:6},()=>structuredClone(DEMO_PROCESSES[0])))});});
  await page.route(base+'/api/admin/indicators',(route:any)=>{administrativeRequests++;return route.abort();});
  await page.goto(base+'/');await page.getByRole('button',{name:'Calendário',exact:true}).waitFor();
  const indicators=page.locator('#sidebar-nav').getByRole('button',{name:'Indicadores',exact:true});
  await indicators.waitFor();await indicators.click();await page.locator('#indicadores-publicos-page').waitFor();await page.getByText('Carregando estatísticas acadêmicas…').waitFor({state:'detached'});assert.equal(requests,1);assert.equal(administrativeRequests,0);await page.screenshot({path:`${out}/${role}-indicadores.png`,fullPage:false});
  checks.push({role,indicatorsAllowed:true,statisticRequests:requests,administrativeRequests});
  await context.close();
 }
 assert.deepEqual(errors,[]);
 await writeFile(`${out}/verification.json`,JSON.stringify({localOnly:true,synthetic:true,realProviderCalls:false,errors,checks},null,2)+'\n');console.log(JSON.stringify({errors,checks}));
}finally{await browser.close();}
