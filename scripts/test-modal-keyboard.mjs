import assert from 'node:assert/strict';
import {mkdtemp, mkdir, writeFile, symlink, rm, realpath} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {createServer} from 'vite';
import react from '@vitejs/plugin-react';

// Exercises real React portals and keyboard events without starting the Portal API
// or sharing Vite's cache with a developer's existing localhost instance.
const repo = path.resolve(new URL('..', import.meta.url).pathname);
const temporary = await realpath(await mkdtemp(path.join(tmpdir(), 'portal-modal-keyboard-')));
let vite, browser;
try {
  await symlink(path.join(repo, 'node_modules'), path.join(temporary, 'node_modules'));
  await writeFile(path.join(temporary, 'package.json'), '{"type":"module"}');
  await writeFile(path.join(temporary, 'index.html'), '<div id="root"></div><script type="module" src="/fixture.tsx"></script>');
  await writeFile(path.join(temporary, 'fixture.tsx'), `
import React,{useEffect,useRef,useState} from 'react';
import{createRoot}from'react-dom/client';
import{PortalModalShell}from${JSON.stringify(path.join(repo,'src/components/PortalModalShell.tsx'))};
import{registerModalEscape}from${JSON.stringify(path.join(repo,'src/utils/modalEscape.ts'))};
function Fixture(){
 const[parent,setParent]=useState(false),[child,setChild]=useState(false),[grand,setGrand]=useState(false),[blocked,setBlocked]=useState(false),[login,setLogin]=useState(false),[aboveLogin,setAboveLogin]=useState(false);
 const parentRef=useRef(null),opener=useRef(null);
 useEffect(()=>{if(parent&&parentRef.current)return registerModalEscape(parentRef.current,()=>{setParent(false);setTimeout(()=>opener.current?.focus(),0);});},[parent]);
 // This is intentionally a legacy window listener, like the real login dialog.
 useEffect(()=>{if(!login)return;const listener=e=>{if(e.key==='Escape')setLogin(false);};window.addEventListener('keydown',listener);return()=>window.removeEventListener('keydown',listener);},[login]);
 return <><button ref={opener} onClick={()=>setParent(true)}>Abrir TCC</button>
 {parent&&<div ref={parentRef} role="dialog" aria-modal="true" aria-label="TCC" style={{position:'fixed',inset:0,zIndex:1000001,background:'white',padding:20}}>
 <button onClick={()=>setChild(true)}>Ver comprovante</button><button onClick={()=>setBlocked(true)}>Operação em andamento</button><button onClick={()=>setLogin(true)}>Entrar</button></div>}
 <PortalModalShell open={child} onClose={()=>setChild(false)} title="Comprovante" footer={<button autoFocus onClick={()=>setChild(false)}>Fechar comprovante</button>}><button onClick={()=>setGrand(true)}>Abrir detalhes do PDF</button><input aria-label="Escape local" onKeyDown={e=>{if(e.key==='Escape')e.preventDefault()}}/></PortalModalShell>
 <PortalModalShell open={grand} onClose={()=>setGrand(false)} title="Detalhes do PDF" zIndexClass="test-upper" footer={<button autoFocus onClick={()=>setGrand(false)}>Fechar detalhes</button>}>PDF</PortalModalShell>
 <PortalModalShell open={blocked} closeOnEscape={false} onClose={()=>setBlocked(false)} title="Processando" footer={<button onClick={()=>setBlocked(false)}>Concluir operação</button>}>Aguarde</PortalModalShell>
 {login&&<div data-portal-login-modal role="dialog" aria-modal="true" aria-label="Login" style={{position:'fixed',inset:40,zIndex:1000040,background:'white'}}><button onClick={()=>setAboveLogin(true)}>Ajuda do login</button></div>}
 <PortalModalShell open={aboveLogin} onClose={()=>setAboveLogin(false)} title="Ajuda do login" zIndexClass="test-above-login" footer={<button autoFocus onClick={()=>setAboveLogin(false)}>Fechar ajuda</button>}>Ajuda</PortalModalShell></>;
}
createRoot(document.getElementById('root')).render(<React.StrictMode><Fixture/></React.StrictMode>);
`);
  await writeFile(path.join(temporary, 'styles.css'), '');
  vite = await createServer({configFile:false,root:temporary,cacheDir:path.join(temporary,'vite-cache'),plugins:[react()],server:{host:'127.0.0.1',port:0,hmr:false,fs:{allow:[temporary,repo]}},optimizeDeps:{include:['react','react-dom/client','react/jsx-runtime']}});
  await vite.listen();
  const base = vite.resolvedUrls.local[0];
  const modulePath = process.env.PLAYWRIGHT_MODULE || path.join(process.env.HOME || '', '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
  const {chromium} = await import(pathToFileURL(modulePath).href);
  browser = await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE}:process.platform==='darwin'?{executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'}:{})});
  const page = await browser.newPage();
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto(base,{waitUntil:'networkidle'});
  await page.addStyleTag({content:'.portal-modal-backdrop{position:fixed;inset:0;z-index:1000010;display:flex;align-items:center;justify-content:center;background:#0003}.portal-modal-surface{background:white;padding:20px}.test-upper{z-index:1000020}.test-above-login{z-index:1000050}'});
  const dialog=name=>page.getByRole('dialog',{name,exact:true});
  const button=name=>page.getByRole('button',{name,exact:true});
  const visible=async name=>assert.equal(await dialog(name).isVisible(),true,name+' permanece aberto');
  const absent=async name=>assert.equal(await dialog(name).count(),0,name+' foi fechado');
  const focused=async name=>{await page.waitForFunction(label=>Array.from(document.querySelectorAll('button')).some(node=>node.textContent===label&&document.activeElement===node),name,{timeout:2000});};

  await button('Abrir TCC').click();await button('Ver comprovante').click();
  await visible('Comprovante');await page.keyboard.press('Escape');
  await absent('Comprovante');await visible('TCC');await focused('Ver comprovante');

  await button('Ver comprovante').click();await button('Abrir detalhes do PDF').click();
  const ids=await page.locator('[role=dialog][aria-labelledby]').evaluateAll(elements=>elements.map(element=>element.getAttribute('aria-labelledby')));
  assert.equal(new Set(ids).size,ids.length,'cada modal tem nome acessível com ID próprio');
  await page.keyboard.press('Escape');await absent('Detalhes do PDF');await visible('Comprovante');await visible('TCC');await focused('Abrir detalhes do PDF');
  await page.getByRole('textbox',{name:'Escape local'}).focus();await page.keyboard.press('Escape');await visible('Comprovante');
  await button('Fechar comprovante').focus();await page.keyboard.press('Escape');await absent('Comprovante');await visible('TCC');await focused('Ver comprovante');

  await button('Operação em andamento').click();await page.keyboard.press('Escape');await visible('Processando');await visible('TCC');
  await button('Concluir operação').click();await absent('Processando');await focused('Operação em andamento');

  await button('Entrar').click();await button('Ajuda do login').click();await page.keyboard.press('Escape');
  await absent('Ajuda do login');await visible('Login');await visible('TCC');await focused('Ajuda do login');
  await page.keyboard.press('Escape');await absent('Login');await visible('TCC');
  await page.keyboard.press('Escape');await absent('TCC');await focused('Abrir TCC');
  assert.deepEqual(errors,[]);
  await mkdir(path.join(repo,'output/playwright'),{recursive:true});
  await writeFile(path.join(repo,'output/playwright/modal-keyboard-qa.json'),JSON.stringify({passed:true,checks:['child Escape preserves parent and restores focus','three layers close one at a time','unique accessible heading IDs','local preventDefault respected','closeOnEscape false blocks parent','legacy login window listener cannot close under a child','final Escape closes parent and restores opener'],errors},null,2));
  console.log('PASS: modal stack, Escape, blocking operation, login, unique IDs and focus restoration in a real browser.');
} finally {
  if(browser)await browser.close();
  if(vite)await vite.close();
  await rm(temporary,{recursive:true,force:true});
}
