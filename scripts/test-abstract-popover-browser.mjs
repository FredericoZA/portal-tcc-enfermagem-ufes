import assert from 'node:assert/strict';
import {mkdtemp, mkdir, writeFile, symlink, rm, realpath} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {createServer} from 'vite';
import react from '@vitejs/plugin-react';

// A real browser fixture with the production component and CSS. The temporary
// Vite instance has its own cache; no Portal API or user data is involved.
const repo = fileURLToPath(new URL('..',import.meta.url));
const temporary = await realpath(await mkdtemp(path.join(tmpdir(),'portal-abstract-qa-')));
const output=path.join(repo,'output/playwright/abstract-popover');
let vite,browser;
try{
  await mkdir(output,{recursive:true});
  await symlink(path.join(repo,'node_modules'),path.join(temporary,'node_modules'));
  await writeFile(path.join(temporary,'package.json'),'{"type":"module"}');
  await writeFile(path.join(temporary,'index.html'),'<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><div id="root"></div><script type="module" src="/fixture.tsx"></script></body></html>');
  await writeFile(path.join(temporary,'fixture.tsx'),`
import React from'react';import{createRoot}from'react-dom/client';
import{TccAbstractPopover}from${JSON.stringify(path.join(repo,'src/components/TccAbstractPopover.tsx'))};
import${JSON.stringify(path.join(repo,'src/styles/portal-tokens.css'))};
import${JSON.stringify(path.join(repo,'src/styles/portal-components.css'))};
const paragraph='Objetivo: conferir a apresentação do resumo no Portal TCC. O estudo sintético aborda a organização dos dados e a leitura do texto nas telas, com atenção à clareza das informações e à consulta pelos diferentes participantes. Método: observação de exemplos fictícios de navegação. Resultados: o resumo pode ser consultado sem ampliar a linha da tabela. Conclusão: a apresentação deve permanecer legível em computadores e celulares. ';
const summary=Array.from({length:4},()=>paragraph).join('\\n\\n');
createRoot(document.getElementById('root')).render(<main><h1>Repositório acadêmico</h1><p>Consulta aos resumos dos trabalhos</p><table><thead><tr><th>Processo</th><th>Trabalho</th><th>Resumo do TCC</th></tr></thead><tbody><tr><td>TCC-2026-0042</td><td>Exemplo com resumo</td><td><TccAbstractPopover summary={summary} processLabel="TCC-2026-0042"/></td></tr><tr><td>001 - Legado</td><td>Exemplo sem resumo</td><td><TccAbstractPopover processLabel="001 - Legado" unavailableLabel="Resumo não localizado no acervo importado"/></td></tr></tbody></table><button id="outside">Outra ação</button></main>);
`);
  vite=await createServer({configFile:false,root:temporary,cacheDir:path.join(temporary,'vite-cache'),plugins:[react()],server:{host:'127.0.0.1',port:0,hmr:false,fs:{allow:[temporary,repo]}},optimizeDeps:{include:['react','react-dom/client','react/jsx-runtime','lucide-react']}});
  await vite.listen();const base=vite.resolvedUrls.local[0];
  const modulePath=process.env.PLAYWRIGHT_MODULE||path.join(process.env.HOME||'','.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
  const{chromium}=await import(pathToFileURL(modulePath).href);
  browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE}:process.platform==='darwin'?{executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'}:{})});
  const report={checks:[],errors:[]};
  const setup=async options=>{const context=await browser.newContext(options),page=await context.newPage();page.on('pageerror',error=>report.errors.push(error.message));await context.route('**/*',route=>route.request().url().startsWith(base)||/^(data|blob):/.test(route.request().url())?route.continue():route.abort());await page.goto(base,{waitUntil:'networkidle'});await page.addStyleTag({content:'body{margin:0;background:#f6f7f8;color:#172033;font:14px Arial,sans-serif}main{max-width:1000px;margin:70px auto;padding:24px}h1{font-size:24px;color:#005830}table{border-collapse:collapse;width:100%;background:#dbe2e6}th{background:#bdc8ce}th,td{padding:10px;border:1px solid #b7c4cd}th:last-child,td:last-child{text-align:center}#outside{margin-top:24px} @media(max-width:500px){main{margin:30px 0;padding:12px}table{font-size:12px}th,td{padding:6px}h1{font-size:20px}}'});return{context,page};};
  const {context:desktop,page}=await setup({viewport:{width:1200,height:850}});
  const trigger=page.getByRole('button',{name:'Ler resumo do TCC TCC-2026-0042',exact:true});
  await trigger.hover();const popup=page.getByRole('dialog',{name:/Resumo do TCC/});await popup.waitFor();
  let box=await popup.boundingBox();assert.ok(Math.abs(box.width-528)<1);assert.ok(Math.abs(box.height-432)<1);
  const content=popup.getByRole('region',{name:'Texto completo do resumo'});
  assert.equal(await content.evaluate(node=>getComputedStyle(node).textAlign),'justify');
  assert.equal(await content.evaluate(node=>node.scrollHeight>node.clientHeight),true);
  await page.screenshot({path:path.join(output,'resumo-ampliado-desktop.png')});
  report.checks.push({name:'desktop: largura e limite de altura aumentados em 20%, texto justificado e rolagem interna',width:box.width,height:box.height});
  await trigger.focus();await page.keyboard.press('Enter');await content.focus();await page.keyboard.press('Escape');assert.equal(await popup.count(),0);assert.equal(await trigger.evaluate(node=>document.activeElement===node),true);
  const empty=page.getByRole('img',{name:'Resumo não localizado no acervo importado',exact:true});
  assert.equal(await empty.innerText(),'');assert.equal(await empty.locator('svg').count(),1);assert.equal(await empty.locator('button').count(),0);
  const emptyStyle=await empty.evaluate(node=>{const css=getComputedStyle(node);return{background:css.backgroundColor,border:css.borderWidth,radius:css.borderRadius}});
  assert.equal(emptyStyle.background,'rgba(0, 0, 0, 0)');assert.equal(emptyStyle.border,'0px');assert.equal(emptyStyle.radius,'0px');
  await page.locator('#outside').focus();await page.screenshot({path:path.join(output,'sem-resumo-icone-desktop.png')});report.checks.push({name:'sem resumo: apenas ícone discreto, sem traço, fundo ou borda',...emptyStyle});
  await trigger.evaluate(node=>{node.style.position='fixed';node.style.right='3px';node.style.bottom='3px';});await trigger.hover();await popup.waitFor();box=await popup.boundingBox();assert.ok(box.x>=12&&box.y>=12&&box.x+box.width<=1200-12&&box.y+box.height<=850-12);report.checks.push({name:'balão junto à borda permanece dentro da tela'});await desktop.close();
  const{context:mobile,page:phone}=await setup({viewport:{width:390,height:844},hasTouch:true,isMobile:true});
  const phoneTrigger=phone.getByRole('button',{name:'Ler resumo do TCC TCC-2026-0042',exact:true});await phoneTrigger.tap();const phonePopup=phone.getByRole('dialog',{name:/Resumo do TCC/});await phonePopup.waitFor();const mobileBox=await phonePopup.boundingBox();assert.ok(mobileBox.width<=366&&mobileBox.x>=12&&mobileBox.x+mobileBox.width<=378);assert.ok(mobileBox.height<=432&&mobileBox.y>=12&&mobileBox.y+mobileBox.height<=832);assert.equal(await phone.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await phone.screenshot({path:path.join(output,'resumo-ampliado-celular.png')});await phonePopup.getByRole('button',{name:'Fechar resumo',exact:true}).tap();assert.equal(await phonePopup.count(),0);await phone.screenshot({path:path.join(output,'sem-resumo-icone-celular.png')});report.checks.push({name:'celular: abre por toque, fecha, sem transbordamento',width:mobileBox.width,height:mobileBox.height});await mobile.close();
  assert.deepEqual(report.errors,[]);await writeFile(path.join(output,'qa.json'),JSON.stringify(report,null,2));console.log('PASS: resumo ampliado/justificado, ausência somente ícone, teclado, bordas e celular por toque.');
}finally{if(browser)await browser.close();if(vite)await vite.close();await rm(temporary,{recursive:true,force:true});}
