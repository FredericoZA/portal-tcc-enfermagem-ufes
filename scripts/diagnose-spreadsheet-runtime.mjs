#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const root = fileURLToPath(new URL('..', import.meta.url));
const output = path.join(root, 'artifacts', 'spreadsheet-diagnostic');
await mkdir(output, { recursive: true });
let browser, child, dataDir;
const result = { errors: [], console: [], initial: null, repository: null };
try {
  let chromium;
  try { ({ chromium } = createRequire(import.meta.url)('playwright')); } catch {}
  if (!chromium || !existsSync(chromium.executablePath())) throw new Error('Chromium indisponível');
  browser = await chromium.launch({ headless: true });
  dataDir = await mkdtemp(path.join(tmpdir(), 'portal-sheet-diag-'));
  const port = 42100 + Math.floor(Math.random() * 300);
  const base = `http://127.0.0.1:${port}`;
  child = spawn(process.execPath, ['--import', 'tsx', 'server.ts'], {
    cwd: root,
    env: { ...process.env, NODE_ENV:'development', VERCEL:'', PORT:String(port), PORTAL_DATA_DIR:dataDir, PORTAL_PERSISTENCE_PROVIDER:'local_file', PORTAL_ALLOW_INSECURE_DEMO_AUTH:'true', PORTAL_ALLOW_LOCAL_OTP_STORE:'true', PORTAL_OTP_DELIVERY_MODE:'log', ASTEN_INTEGRATION_ENABLED:'false', PORTAL_SESSION_SECRET:'diag-session-0123456789abcdef', PORTAL_OTP_PEPPER:'diag-otp-0123456789abcdef' },
    stdio:'ignore'
  });
  for (let n=0;n<100;n+=1) {
    try { if ((await fetch(`${base}/api/health`)).ok) break; } catch {}
    await new Promise(r=>setTimeout(r,200));
  }
  const context = await browser.newContext({ extraHTTPHeaders:{'x-demo-user-email':'master@portal.local'}, reducedMotion:'reduce' });
  await context.route('**/*', route => route.request().url().startsWith(base) || /^(data|blob):/.test(route.request().url()) ? route.continue() : route.abort());
  await context.addInitScript(() => localStorage.setItem('portal_tcc_active_email','master@portal.local'));
  const page = await context.newPage();
  page.on('pageerror', e => result.errors.push(e.message));
  page.on('console', m => { if (['error','warning'].includes(m.type())) result.console.push(`${m.type()}: ${m.text()}`); });
  await page.setViewportSize({width:1440,height:900});
  await page.goto(base,{waitUntil:'networkidle'});
  await page.waitForTimeout(1500);
  const inspect = () => ({
    url: location.href,
    bodyText: document.body.innerText.slice(0,500),
    tables: Array.from(document.querySelectorAll('table')).map((t,i)=>({i, marker:t.getAttribute('data-portal-spreadsheet'), classes:t.className, parent:t.parentElement?.className || '', section:t.closest('section')?.id || '', headers:Array.from(t.querySelectorAll('thead th')).map(th=>(th.textContent||'').replace(/\s+/g,' ').trim()).slice(0,5)})),
    runtimeHosts: document.querySelectorAll('.portal-spreadsheet-scroll-host').length,
    pagers: document.querySelectorAll('.portal-spreadsheet-pager').length,
    rootVersion: document.body.innerText.match(/Versão do sistema:\s*([^\n]+)/i)?.[1] || ''
  });
  result.initial = await page.evaluate(inspect);
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('portal:navigate',{detail:'biblioteca'})));
  await page.locator('#biblioteca-tccs-section').waitFor({state:'visible',timeout:12000});
  await page.locator('#biblioteca-tccs-section table').waitFor({state:'visible',timeout:20000});
  await page.waitForTimeout(2500);
  result.repository = await page.evaluate(inspect);
  await page.screenshot({path:path.join(output,'repositorio.png'),fullPage:true});
  await context.close();
} catch(e) {
  result.errors.push(e instanceof Error ? e.stack || e.message : String(e));
} finally {
  await browser?.close();
  if (child) child.kill('SIGTERM');
  if (dataDir) await rm(dataDir,{recursive:true,force:true});
  await writeFile(path.join(output,'diagnostico.json'),JSON.stringify(result,null,2));
  console.log(JSON.stringify(result,null,2));
  if (result.errors.length) process.exitCode=1;
}
