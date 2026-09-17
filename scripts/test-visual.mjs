#!/usr/bin/env node
// Homologação visual com dados fictícios locais. Nunca autentica nem grava na produção.
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const root = fileURLToPath(new URL('..', import.meta.url));
const output = path.resolve(process.env.PORTAL_VISUAL_OUTPUT || path.join(root, 'artifacts', 'portal-visual-final'));
await mkdir(output, { recursive: true });
const report = {
  status: 'NAO_CONFIRMADO',
  generatedAt: new Date().toISOString(),
  fixtureProcesses: 0,
  fixtureStatuses: [],
  screenshots: [],
  errors: [],
  warnings: [],
  scope: 'Dados fictícios locais; valida responsividade, overflow, navegação e perfis. Não valida provedores externos, zoom manual ou leitor de tela.'
};
let browser, child, dataDir;

const ignoreConsoleError = (text) => /ERR_FAILED|ERR_BLOCKED|Failed to load resource|Permissions policy violation: Geolocation|Refused to frame ['"]https:\/\/www\.google\.com\/|Failed to read the ['"]localStorage['"] property from ['"]Window['"]: Access is denied for this document/i.test(text);

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
  child = spawn(process.execPath, ['--import', 'tsx', 'server.ts'], {
    cwd: root,
    env: {
      ...process.env,
      NODE_ENV: 'development',
      VERCEL: '',
      PORT: String(port),
      PORTAL_DATA_DIR: dataDir,
      PORTAL_PERSISTENCE_PROVIDER: 'local_file',
      PORTAL_ALLOW_INSECURE_DEMO_AUTH: 'true',
      PORTAL_ALLOW_LOCAL_OTP_STORE: 'true',
      PORTAL_OTP_DELIVERY_MODE: 'log',
      ASTEN_INTEGRATION_ENABLED: 'false',
      PORTAL_SESSION_SECRET: 'visual-test-session-0123456789abcdef',
      PORTAL_OTP_PEPPER: 'visual-test-otp-0123456789abcdef'
    },
    stdio: 'ignore'
  });

  let healthy = false;
  for (let n = 0; n < 100; n++) {
    if (child.exitCode !== null) throw new Error('O servidor da galeria não iniciou.');
    try { healthy = (await fetch(`${base}/api/health`)).ok; } catch { /* inicialização */ }
    if (healthy) break;
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  if (!healthy) throw new Error('Servidor indisponível após 25 segundos.');

  const fixtureResponse = await fetch(`${base}/api/processes`, { headers: { 'x-demo-user-email': 'master@portal.local' } });
  if (!fixtureResponse.ok) throw new Error(`Não foi possível consultar os processos fictícios: HTTP ${fixtureResponse.status}`);
  const fixtureProcesses = await fixtureResponse.json();
  report.fixtureProcesses = Array.isArray(fixtureProcesses) ? fixtureProcesses.length : 0;
  report.fixtureStatuses = Array.from(new Set((Array.isArray(fixtureProcesses) ? fixtureProcesses : []).map(item => item.status).filter(Boolean)));
  if (report.fixtureProcesses < 5) report.errors.push(`QA insuficiente: apenas ${report.fixtureProcesses} processo(s) fictício(s).`);
  for (const status of ['AGUARDANDO_DEFESA', 'EM_AVALIACAO', 'AGUARDANDO_ASSINATURA']) {
    if (!report.fixtureStatuses.includes(status)) report.errors.push(`QA sem processo fictício no estado ${status}.`);
  }

  const newPersonaPage = async (email) => {
    const context = await browser.newContext({
      extraHTTPHeaders: { 'x-demo-user-email': email },
      reducedMotion: 'reduce'
    });
    await context.route('**/*', route => route.request().url().startsWith(base) || /^(data|blob):/.test(route.request().url()) ? route.continue() : route.abort());
    await context.addInitScript(userEmail => localStorage.setItem('portal_tcc_active_email', userEmail), email);
    const page = await context.newPage();
    page.on('pageerror', error => report.errors.push(`${email}: ${error.message}`));
    page.on('console', message => {
      if (message.type() === 'error' && !ignoreConsoleError(message.text())) report.errors.push(`${email}: ${message.text()}`);
    });
    return { context, page };
  };

  const navigate = async (page, tab) => {
    await page.evaluate(target => window.dispatchEvent(new CustomEvent('portal:navigate', { detail: target })), tab);
    await page.locator('main').waitFor({ state: 'visible' });
    await page.waitForTimeout(250);
  };

  const capture = async (page, name) => {
    await page.locator('main').waitFor({ state: 'visible' });
    const lazyFallback = page.getByText('Carregando conteúdo...', { exact: true });
    if (await lazyFallback.count()) {
      await lazyFallback.first().waitFor({ state: 'hidden', timeout: 6000 }).catch(() => {});
    }
    await page.waitForTimeout(150);
    await page.waitForFunction(() => document.body.innerText.trim().length > 80);
    if (await page.locator('vite-error-overlay').count()) throw new Error(`${name}: overlay de erro do Vite.`);
    const file = `${name}.png`;
    await page.screenshot({ path: path.join(output, file), fullPage: true });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 2);
    const overflowElements = overflow ? await page.evaluate(() => {
      const viewport = innerWidth;
      return Array.from(document.querySelectorAll('body *')).map(element => {
        const rect = element.getBoundingClientRect();
        return { element, rect };
      }).filter(({ rect }) => rect.right > viewport + 2 || rect.left < -2).slice(0, 12).map(({ element, rect }) => ({
        selector: `${element.tagName.toLowerCase()}${element.id ? `#${element.id}` : ''}${typeof element.className === 'string' && element.className.trim() ? `.${element.className.trim().split(/\s+/).slice(0, 3).join('.')}` : ''}`,
        left: Math.round(rect.left),
        right: Math.round(rect.right),
        width: Math.round(rect.width),
        viewport
      }));
    }) : [];
    report.screenshots.push({ file, overflow, overflowElements });
    if (overflow) report.errors.push(`${name}: rolagem horizontal global. Elementos: ${overflowElements.map(item => `${item.selector}(${item.left}..${item.right})`).join(', ') || 'não identificado'}.`);
  };

  // Master: percorre as telas centrais e públicas em quatro larguras.
  {
    const { context, page } = await newPersonaPage('master@portal.local');
    for (const width of [320, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 960 });
      await page.goto(base, { waitUntil: 'networkidle' });
      await capture(page, `master-inicio-${width}`);
      for (const [tab, label] of [
        ['calendario', 'calendario'],
        ['biblioteca', 'repositorio'],
        ['indicadores', 'indicadores'],
        ['como-chegar', 'como-chegar'],
        ['tutorial', 'como-usar'],
        ['fluxo-tcc', 'fluxo-tcc'],
        ['replicar', 'replicar-portal'],
        ['meus-processos', 'meus-tccs'],
        ['coordenador', 'presidencia'],
        ['configuracoes', 'configuracoes']
      ]) {
        await navigate(page, tab);
        await capture(page, `master-${label}-${width}`);
      }
    }
    await page.emulateMedia({ forcedColors: 'active' });
    await page.setViewportSize({ width: 1024, height: 960 });
    await navigate(page, 'meus-processos');
    await capture(page, 'master-meus-tccs-alto-contraste');
    await page.keyboard.press('Tab');
    if (!(await page.evaluate(() => document.activeElement !== document.body))) report.errors.push('master: foco de teclado ausente após Tab.');
    await context.close();
  }

  // Personas funcionais: comprovam visões diferentes usando os mesmos processos fictícios.
  for (const persona of [
    { email: 'mariana.silva@aluno.ufes.br', tabs: [['meus-processos', 'aluno-meus-tccs']] },
    { email: 'ana.santos@ufes.br', tabs: [['meus-processos', 'orientador-meus-tccs'], ['avaliacoes', 'orientador-avaliacoes']] },
    { email: 'roberto.lima@ufes.br', tabs: [['meus-processos', 'coorientador-meus-tccs']] },
    { email: 'presidente@portal.local', tabs: [['coordenador', 'presidente-assinaturas']] }
  ]) {
    const { context, page } = await newPersonaPage(persona.email);
    await page.setViewportSize({ width: 1280, height: 960 });
    await page.goto(base, { waitUntil: 'networkidle' });
    for (const [tab, label] of persona.tabs) {
      await navigate(page, tab);
      await capture(page, label);
    }
    await context.close();
  }

  report.status = report.errors.length ? 'REPROVADO' : 'CAPTURAS_GERADAS';
  await writeFile(path.join(output, 'index.html'), '<!doctype html><meta charset="utf-8"><title>Homologação visual Portal TCC</title><style>body{font:16px system-ui;margin:24px;background:#f5f7fa}img{max-width:100%;border:1px solid #888}figure{margin:24px 0}code{white-space:pre-wrap}</style><h1>Portal TCC · QA visual com dados fictícios</h1><p>As capturas usam somente o servidor local e os processos DEMO do repositório. Geração de captura não substitui homologação humana.</p>' + report.screenshots.map(s => `<figure><figcaption>${s.file}${s.overflow ? ' — OVERFLOW' : ''}</figcaption><img src="${s.file}" alt="${s.file}">${s.overflowElements?.length ? `<pre>${JSON.stringify(s.overflowElements, null, 2)}</pre>` : ''}</figure>`).join(''));
  process.exitCode = report.errors.length ? 1 : 0;
} catch (error) {
  report.errors.push(error.message);
  report.status = error.unavailable ? 'NAO_CONFIRMADO' : 'REPROVADO';
  process.exitCode = error.unavailable ? 78 : 1;
} finally {
  await browser?.close();
  if (child) {
    child.kill('SIGTERM');
    await new Promise(resolve => {
      const timer = setTimeout(resolve, 3000);
      child.once('exit', () => { clearTimeout(timer); resolve(); });
    });
  }
  if (dataDir) await rm(dataDir, { recursive: true, force: true });
  await writeFile(path.join(output, 'resultado.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
}