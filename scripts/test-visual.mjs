#!/usr/bin/env node
// Local fixture gallery; it never authenticates against a production installation.
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const root = fileURLToPath(new URL('..', import.meta.url));
const output = path.resolve(process.env.PORTAL_VISUAL_OUTPUT || path.join(root, '..', 'portal-visual-rc8'));
await mkdir(output, { recursive: true });
const report = { status: 'NAO_CONFIRMADO', generatedAt: new Date().toISOString(), screenshots: [], errors: [], scope: 'Dados fictícios locais; não valida provedores, zoom real ou leitor de tela.' };
let browser, child, dataDir;
try {
  let chromium;
  try { ({ chromium } = createRequire(import.meta.url)('playwright')); }
  catch {
    const dependencies = process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES;
    if (dependencies) ({ chromium } = createRequire(path.join(dependencies, '__portal_resolver.cjs'))('playwright'));
  }
  if (!chromium || !existsSync(chromium.executablePath())) {
    throw Object.assign(new Error('Chromium de automação ausente. Instale Playwright e seu navegador no ambiente de verificação.'), { unavailable: true });
  }
  browser = await chromium.launch({ headless: true });
  dataDir = await mkdtemp(path.join(tmpdir(), 'portal-visual-'));
  const port = 40500 + Math.floor(Math.random() * 1000);
  const base = `http://127.0.0.1:${port}`;
  child = spawn(process.execPath, ['--import', 'tsx', 'server.ts'], { cwd: root, env: { ...process.env, NODE_ENV: 'development', VERCEL: '', PORT: String(port), PORTAL_DATA_DIR: dataDir, PORTAL_PERSISTENCE_PROVIDER: 'local_file', PORTAL_ALLOW_INSECURE_DEMO_AUTH: 'true', PORTAL_ALLOW_LOCAL_OTP_STORE: 'true', PORTAL_OTP_DELIVERY_MODE: 'log', ASTEN_INTEGRATION_ENABLED: 'false', PORTAL_SESSION_SECRET: 'visual-test-session-0123456789abcdef', PORTAL_OTP_PEPPER: 'visual-test-otp-0123456789abcdef' }, stdio: 'ignore' });
  let healthy = false;
  for (let n = 0; n < 100; n++) {
    if (child.exitCode !== null) throw new Error('O servidor da galeria não iniciou.');
    try { healthy = (await fetch(`${base}/api/health`)).ok; } catch { /* starting */ }
    if (healthy) break;
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  if (!healthy) throw new Error('Servidor indisponível após 25 segundos.');
  const context = await browser.newContext({ extraHTTPHeaders: { 'x-demo-user-email': 'master@portal.local' }, reducedMotion: 'reduce' });
  // No third-party content or outgoing browser calls in fixture captures.
  await context.route('**/*', route => route.request().url().startsWith(base) || /^(data|blob):/.test(route.request().url()) ? route.continue() : route.abort());
  await context.addInitScript(() => localStorage.setItem('portal_tcc_active_email', 'master@portal.local'));
  const page = await context.newPage();
  page.on('pageerror', error => report.errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error' && !/ERR_FAILED|ERR_BLOCKED|Failed to load resource/.test(message.text())) report.errors.push(message.text()); });
  const capture = async (name) => {
    await page.locator('main').waitFor({ state: 'visible' });
    await page.waitForFunction(() => document.body.innerText.trim().length > 100);
    if (await page.locator('vite-error-overlay').count()) throw new Error('Overlay de erro do Vite.');
    const file = `${name}.png`;
    await page.screenshot({ path: path.join(output, file), fullPage: true });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 2);
    report.screenshots.push({ file, overflow });
    if (overflow) report.errors.push(`${name}: rolagem horizontal da página inteira.`);
  };
  for (const width of [320, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 960 });
    await page.goto(base, { waitUntil: 'networkidle' });
    await capture(`inicio-${width}`);
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('portal:navigate', { detail: 'configuracoes' })));
    await page.locator('#master-flow-system-section').waitFor({ state: 'visible' });
    if (!(await page.getByRole('button', { name: 'Oficina', exact: true }).isVisible())) await page.locator('#master-flow-system-section > button').click();
    await page.getByRole('button', { name: 'Oficina', exact: true }).click();
    await page.getByRole('heading', { name: 'Oficina da secretaria' }).waitFor();
    await capture(`oficina-${width}`);
    await page.keyboard.press('Tab');
    const focus = await page.evaluate(() => document.activeElement !== document.body);
    if (!focus) report.errors.push(`oficina-${width}: foco de teclado ausente.`);
  }
  await page.emulateMedia({ forcedColors: 'active' });
  await capture('oficina-alto-contraste');
  report.status = report.errors.length ? 'REPROVADO' : 'CAPTURAS_GERADAS';
  await writeFile(path.join(output, 'index.html'), '<!doctype html><meta charset="utf-8"><title>Galeria RC8</title><style>body{font:16px system-ui;margin:24px;background:#f5f7fa}img{max-width:100%;border:1px solid #888}figure{margin:24px 0}</style><h1>Galeria RC8 · dados fictícios</h1><p>Compare as imagens com uma referência aprovada. Geração de capturas não equivale a aprovação visual ou WCAG.</p>' + report.screenshots.map(s => `<figure><figcaption>${s.file}</figcaption><img src="${s.file}" alt="${s.file}"></figure>`).join(''));
  process.exitCode = report.errors.length ? 1 : 0;
} catch (error) {
  report.errors.push(error.message);
  report.status = error.unavailable ? 'NAO_CONFIRMADO' : 'REPROVADO';
  process.exitCode = error.unavailable ? 78 : 1;
} finally {
  await browser?.close();
  if (child) { child.kill('SIGTERM'); await new Promise(resolve => { const timer = setTimeout(resolve, 3000); child.once('exit', () => { clearTimeout(timer); resolve(); }); }); }
  if (dataDir) await rm(dataDir, { recursive: true, force: true });
  await writeFile(path.join(output, 'resultado.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
}
