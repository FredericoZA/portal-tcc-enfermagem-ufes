#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const root = fileURLToPath(new URL('..', import.meta.url));
const output = path.resolve(process.env.PORTAL_SPREADSHEET_OUTPUT || path.join(root, 'artifacts', 'spreadsheet-homologation'));
await mkdir(output, { recursive: true });

const report = { status: 'NAO_CONFIRMADO', generatedAt: new Date().toISOString(), checks: [], errors: [], screenshots: [] };
let browser, child, dataDir;
const ok = (name, detail = '') => report.checks.push({ name, ok: true, detail });
const fail = (name, detail = '') => { report.checks.push({ name, ok: false, detail }); report.errors.push(`${name}: ${detail}`); };
const expect = (condition, name, detail = '') => condition ? ok(name, detail) : fail(name, detail);

try {
  let chromium;
  try { ({ chromium } = createRequire(import.meta.url)('playwright')); }
  catch {
    const dependencies = process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES;
    if (dependencies) ({ chromium } = createRequire(path.join(dependencies, '__portal_resolver.cjs'))('playwright'));
  }
  if (!chromium || !existsSync(chromium.executablePath())) throw new Error('Chromium indisponível.');

  browser = await chromium.launch({ headless: true });
  dataDir = await mkdtemp(path.join(tmpdir(), 'portal-spreadsheets-'));
  const port = 41600 + Math.floor(Math.random() * 500);
  const base = `http://127.0.0.1:${port}`;
  child = spawn(process.execPath, ['--import', 'tsx', 'server.ts'], {
    cwd: root,
    env: {
      ...process.env,
      NODE_ENV: 'development', VERCEL: '', PORT: String(port), PORTAL_DATA_DIR: dataDir,
      PORTAL_PERSISTENCE_PROVIDER: 'local_file', PORTAL_ALLOW_INSECURE_DEMO_AUTH: 'true',
      PORTAL_ALLOW_LOCAL_OTP_STORE: 'true', PORTAL_OTP_DELIVERY_MODE: 'log', ASTEN_INTEGRATION_ENABLED: 'false',
      PORTAL_SESSION_SECRET: 'visual-test-session-0123456789abcdef',
      PORTAL_OTP_PEPPER: 'visual-test-otp-0123456789abcdef'
    }, stdio: 'ignore'
  });

  let healthy = false;
  for (let n = 0; n < 100; n += 1) {
    if (child.exitCode !== null) throw new Error('Servidor local encerrou antes da homologação.');
    try { healthy = (await fetch(`${base}/api/health`)).ok; } catch { /* aguardando */ }
    if (healthy) break;
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  if (!healthy) throw new Error('Servidor local indisponível.');

  const context = await browser.newContext({ extraHTTPHeaders: { 'x-demo-user-email': 'master@portal.local' }, reducedMotion: 'reduce' });
  await context.route('**/*', route => route.request().url().startsWith(base) || /^(data|blob):/.test(route.request().url()) ? route.continue() : route.abort());
  await context.addInitScript(() => localStorage.setItem('portal_tcc_active_email', 'master@portal.local'));
  const page = await context.newPage();
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(base, { waitUntil: 'networkidle' });

  const navigate = async (tab, selector) => {
    await page.evaluate(target => window.dispatchEvent(new CustomEvent('portal:navigate', { detail: target })), tab);
    await page.locator(selector).waitFor({ state: 'visible', timeout: 8000 });
    await page.waitForTimeout(650);
  };
  const shot = async (name) => {
    const file = `${name}.png`;
    await page.screenshot({ path: path.join(output, file), fullPage: true });
    report.screenshots.push(file);
  };
  const headerText = async (selector) => page.locator(selector).evaluate((header) => {
    const clone = header.cloneNode(true);
    clone.querySelectorAll('button,svg,.portal-core-resizer,.portal-core-column-menu').forEach(node => node.remove());
    return (clone.textContent || '').replace(/\s+/g, ' ').trim();
  });

  // REPOSITÓRIO
  await navigate('biblioteca', '#biblioteca-tccs-section');
  const repoTable = 'table[data-portal-spreadsheet="acervo"]';
  await page.locator(repoTable).waitFor({ state: 'visible', timeout: 8000 });
  const repoHost = '#biblioteca-tccs-section .portal-spreadsheet-scroll-host';
  const repoProcess = `${repoTable} th[data-portal-sticky-process="true"]`;
  const repoLabel = await headerText(repoProcess);
  expect(repoLabel === 'Processo', 'Repositório — cabeçalho Processo', `encontrado: ${repoLabel}`);
  const repoHeaderStyle = await page.locator(`${repoTable} th[data-portal-sticky-header="true"]`).first().evaluate(el => ({ top: getComputedStyle(el).paddingTop, bottom: getComputedStyle(el).paddingBottom, position: getComputedStyle(el).position }));
  expect(parseFloat(repoHeaderStyle.top) <= 6 && parseFloat(repoHeaderStyle.bottom) <= 6, 'Repositório — cabeçalho compacto', JSON.stringify(repoHeaderStyle));
  expect(repoHeaderStyle.position === 'sticky', 'Repositório — cabeçalho sticky', repoHeaderStyle.position);
  const repoPagerPosition = await page.locator(repoHost).evaluate(host => host.nextElementSibling?.classList.contains('portal-spreadsheet-pager') || false);
  expect(repoPagerPosition, 'Repositório — paginação após a planilha');

  const repoHostBox = await page.locator(repoHost).boundingBox();
  if (repoHostBox) {
    await page.locator(repoHost).evaluate(el => { el.scrollTop = 0; el.scrollLeft = 0; });
    await page.mouse.move(repoHostBox.x + Math.min(repoHostBox.width - 30, 650), repoHostBox.y + Math.min(repoHostBox.height - 35, 250));
    await page.mouse.wheel(0, 260);
    await page.waitForTimeout(150);
    const wheelState = await page.locator(repoHost).evaluate(el => ({ top: el.scrollTop, left: el.scrollLeft, canY: el.scrollHeight > el.clientHeight + 1, canX: el.scrollWidth > el.clientWidth + 1 }));
    if (wheelState.canY) expect(wheelState.top > 0 && wheelState.left === 0, 'Repositório — wheel vertical', JSON.stringify(wheelState));
    else ok('Repositório — wheel vertical', `host sem overflow Y; propagação nativa preservada (${JSON.stringify(wheelState)})`);

    if (wheelState.canX) {
      await page.locator(repoHost).evaluate(el => { el.scrollLeft = 180; });
      const beforeSticky = await page.locator(repoProcess).boundingBox();
      await page.locator(repoHost).evaluate(el => { el.scrollLeft = 420; });
      await page.waitForTimeout(80);
      const afterSticky = await page.locator(repoProcess).boundingBox();
      expect(Boolean(beforeSticky && afterSticky && Math.abs(beforeSticky.x - afterSticky.x) <= 2), 'Repositório — Processo permanece fixo', JSON.stringify({ before: beforeSticky?.x, after: afterSticky?.x }));

      await page.locator(repoHost).evaluate(el => { el.scrollLeft = 180; });
      const beforeDrag = await page.locator(repoHost).evaluate(el => el.scrollLeft);
      const y = repoHostBox.y + Math.min(repoHostBox.height - 40, 280);
      const x = repoHostBox.x + Math.min(repoHostBox.width - 40, 800);
      await page.mouse.move(x, y);
      await page.mouse.down();
      await page.mouse.move(x - 150, y, { steps: 8 });
      await page.mouse.up();
      const afterDrag = await page.locator(repoHost).evaluate(el => el.scrollLeft);
      expect(afterDrag > beforeDrag + 40, 'Repositório — arraste horizontal com a mão', JSON.stringify({ beforeDrag, afterDrag }));
    }
  }
  await page.locator(repoHost).evaluate(el => { el.scrollTop = 0; el.scrollLeft = 0; });
  await shot('repositorio-1440');

  // MEUS TCCs
  await navigate('meus-processos', '#meus-processos-page-container');
  const myTable = 'table[data-portal-spreadsheet="meus_processos"]';
  await page.locator(myTable).waitFor({ state: 'visible', timeout: 8000 });
  const allFilter = '#meus-processos-page-container .portal-runtime-all-filter';
  await page.locator(allFilter).waitFor({ state: 'visible', timeout: 5000 });
  const filterState = await page.evaluate(() => {
    const all = document.querySelector('#meus-processos-page-container .portal-runtime-all-filter');
    const group = all?.parentElement;
    const roles = Array.from(group?.querySelectorAll('button.portal-standard-filter-chip:not(.portal-runtime-all-filter)') || []);
    return {
      allDot: Boolean(all?.querySelector('.portal-filter-dot')),
      allBg: all ? getComputedStyle(all).backgroundColor : '',
      roleBgs: roles.map(el => getComputedStyle(el).backgroundColor),
      rightPadding: group?.closest('.portal-meus-processos-filter-row') ? getComputedStyle(group.closest('.portal-meus-processos-filter-row')).paddingRight : '',
      tones: roles.map(el => ({ tone: el.getAttribute('data-portal-role-tone'), dot: getComputedStyle(el.querySelector('.portal-filter-dot') || el.querySelector('span') || el).backgroundColor }))
    };
  });
  expect(!filterState.allDot, 'Meus TCCs — Todos sem bolinha');
  expect(filterState.roleBgs.every(bg => bg === 'rgb(255, 255, 255)'), 'Meus TCCs — outros filtros brancos quando Todos está ativo', JSON.stringify(filterState.roleBgs));
  expect(parseFloat(filterState.rightPadding) >= 24, 'Meus TCCs — respiro verde à direita', filterState.rightPadding);
  expect(new Set(filterState.tones.map(item => item.dot)).size >= 4, 'Meus TCCs — quatro cores distintas', JSON.stringify(filterState.tones));

  const evaluator = '#meus-processos-page-container button[data-portal-role-tone="evaluator"]';
  await page.locator(evaluator).click();
  await page.waitForTimeout(350);
  const selectedState = await page.evaluate(() => {
    const all = document.querySelector('#meus-processos-page-container .portal-runtime-all-filter');
    const group = all?.parentElement;
    const roles = Array.from(group?.querySelectorAll('button.portal-standard-filter-chip:not(.portal-runtime-all-filter)') || []);
    return {
      allBg: all ? getComputedStyle(all).backgroundColor : '',
      roles: roles.map(el => ({ tone: el.getAttribute('data-portal-role-tone'), bg: getComputedStyle(el).backgroundColor, pressed: el.getAttribute('aria-pressed') }))
    };
  });
  const evaluatorState = selectedState.roles.find(item => item.tone === 'evaluator');
  expect(selectedState.allBg === 'rgb(255, 255, 255)', 'Meus TCCs — Todos volta a branco após seleção específica', selectedState.allBg);
  expect(Boolean(evaluatorState && evaluatorState.bg !== 'rgb(255, 255, 255)'), 'Meus TCCs — somente selecionado fica fosco', JSON.stringify(selectedState.roles));
  expect(selectedState.roles.filter(item => item.tone !== 'evaluator').every(item => item.bg === 'rgb(255, 255, 255)'), 'Meus TCCs — filtros não selecionados permanecem brancos', JSON.stringify(selectedState.roles));
  const myHeader = await page.locator(`${myTable} th[data-portal-sticky-header="true"]`).first().evaluate(el => ({ top: getComputedStyle(el).paddingTop, bottom: getComputedStyle(el).paddingBottom }));
  expect(parseFloat(myHeader.top) <= 6 && parseFloat(myHeader.bottom) <= 6, 'Meus TCCs — cabeçalho compacto', JSON.stringify(myHeader));
  const myPager = await page.locator('#meus-processos-page-container .portal-spreadsheet-scroll-host').evaluate(host => host.nextElementSibling?.classList.contains('portal-spreadsheet-pager') || false);
  expect(myPager, 'Meus TCCs — paginação após a planilha');
  await shot('meus-tccs-1440');

  // PRESIDÊNCIA
  await navigate('coordenador', '#coordenador-page-root');
  const coordTable = 'table[data-portal-spreadsheet="coordinator"]';
  await page.locator(coordTable).waitFor({ state: 'visible', timeout: 8000 });
  const presidentState = await page.evaluate(() => {
    const table = document.querySelector('table[data-portal-spreadsheet="coordinator"]');
    const headers = Array.from(table?.tHead?.rows[0]?.cells || []);
    const process = headers.find(el => el.hasAttribute('data-portal-sticky-process'));
    const selection = headers.find(el => el.hasAttribute('data-portal-sticky-selection'));
    const envioIndex = headers.findIndex(el => (el.textContent || '').trim().toLowerCase().includes('envio'));
    const envioCell = envioIndex >= 0 ? table?.tBodies[0]?.rows[0]?.cells[envioIndex] : null;
    const row = document.querySelector('#coordenador-page-root .portal-coordinator-filter-row');
    return {
      hasSelection: Boolean(selection?.querySelector('.portal-sheet-checkbox')),
      selectionBg: selection ? getComputedStyle(selection).backgroundColor : '',
      processSticky: process ? getComputedStyle(process).position : '',
      envioPlain: envioCell?.getAttribute('data-portal-plain-text') === 'true',
      envioButton: Boolean(envioCell?.querySelector('button')),
      rightPadding: row ? getComputedStyle(row).paddingRight : ''
    };
  });
  expect(presidentState.hasSelection, 'Presidência — checkbox no cabeçalho');
  expect(presidentState.processSticky === 'sticky', 'Presidência — Processo fixo', presidentState.processSticky);
  expect(presidentState.envioPlain && !presidentState.envioButton, 'Presidência — Envio é texto, não botão', JSON.stringify(presidentState));
  expect(parseFloat(presidentState.rightPadding) >= 24, 'Presidência — respiro verde à direita', presidentState.rightPadding);
  await shot('presidencia-1440');

  // 1920px: evidência final das três planilhas
  await page.setViewportSize({ width: 1920, height: 1080 });
  for (const [tab, selector, name] of [
    ['biblioteca', '#biblioteca-tccs-section', 'repositorio-1920'],
    ['meus-processos', '#meus-processos-page-container', 'meus-tccs-1920'],
    ['coordenador', '#coordenador-page-root', 'presidencia-1920']
  ]) {
    await navigate(tab, selector);
    await shot(name);
  }

  await context.close();
  report.status = report.errors.length ? 'REPROVADO' : 'APROVADO';
} catch (error) {
  report.status = 'REPROVADO';
  report.errors.push(error instanceof Error ? error.stack || error.message : String(error));
  process.exitCode = 1;
} finally {
  await browser?.close();
  if (child) child.kill('SIGTERM');
  if (dataDir) await rm(dataDir, { recursive: true, force: true });
  await writeFile(path.join(output, 'resultado.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  if (report.errors.length) process.exitCode = 1;
}
