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
  typography: [],
  errors: [],
  warnings: [],
  scope: 'Dados fictícios locais; valida responsividade, overflow, navegação e perfis. Não valida provedores externos, zoom manual ou leitor de tela.'
};
let browser, child, dataDir;

const ignoreConsoleError = (text) => /ERR_FAILED|ERR_BLOCKED|Failed to load resource|Permissions policy violation: Geolocation|Refused to frame .*google\.com|Failed to read the .*localStorage.*Access is denied/i.test(text);

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
    page.on('pageerror', error => {
      if (!ignoreConsoleError(error.message)) report.errors.push(`${email}: ${error.message}`);
    });
    page.on('console', message => {
      if (message.type() === 'error' && !ignoreConsoleError(message.text())) report.errors.push(`${email}: ${message.text()}`);
    });
    return { context, page };
  };

  const navigate = async (page, tab) => {
    await page.evaluate(target => window.dispatchEvent(new CustomEvent('portal:navigate', { detail: target })), tab);
    await page.locator('#portal-app-root main').first().waitFor({ state: 'visible' });
    const lazyFallback = page.getByText('Carregando conteúdo...', { exact: true });
    if (await lazyFallback.count()) {
      await lazyFallback.first().waitFor({ state: 'hidden', timeout: 6000 }).catch(() => {});
    }
    await page.waitForTimeout(250);
  };

  const capture = async (page, name) => {
    await page.locator('#portal-app-root main').first().waitFor({ state: 'visible' });
    const lazyFallback = page.getByText('Carregando conteúdo...', { exact: true });
    if (await lazyFallback.count()) {
      await lazyFallback.first().waitFor({ state: 'hidden', timeout: 6000 }).catch(() => {});
    }
    await page.waitForTimeout(150);
    await page.waitForFunction(() => document.body.innerText.trim().length > 80);
    if (await page.locator('vite-error-overlay').count()) throw new Error(`${name}: overlay de erro do Vite.`);
    const file = `${name}.png`;
    await page.screenshot({ path: path.join(output, file), fullPage: true });
    // Inventário dos valores EFETIVOS de font-size no Chromium, por página e modal.
    // Inclui os elementos visíveis com texto, não apenas as declarações do CSS.
    const fonts = await page.evaluate(() => {
      const histogram = {};
      const outliers = [];
      const selectors = 'h1,h2,h3,h4,h5,h6,p,label,button,a,td,th,span,strong,small,input,textarea,select,summary,[role="heading"]';
      const insideSheet = (el) => Boolean(el.closest('.portal-spreadsheet-table,.portal-spreadsheet-scroll-host,.portal-calendar-day-cell,.portal-calendar-empty-cell'));
      for (const el of document.querySelectorAll(selectors)) {
        if (el.closest('script,style,[hidden],[aria-hidden="true"]') || !el.getClientRects().length) continue;
        const style = getComputedStyle(el);
        if (style.visibility === 'hidden' || style.display === 'none') continue;
        const label = (el.getAttribute('aria-label') || el.getAttribute('placeholder') || el.textContent || '').trim().replace(/\\s+/g, ' ').slice(0, 80);
        if (!label) continue;
        const px = Math.round(parseFloat(style.fontSize)*10)/10;
        if (!Number.isFinite(px)) continue;
        const region = el.closest('.portal-settings-workspace') ? 'configuracoes-popup' :
          insideSheet(el) ? 'planilha-calendario' : 'portal-geral';
        const key = `${region}:${px}px`;
        histogram[key] = (histogram[key] || 0) + 1;
        if (px < 10.5 && outliers.length < 24 && region !== 'planilha-calendario') {
          outliers.push({
            size: px, region, tag: el.tagName.toLowerCase(),
            classes: String(el.getAttribute('class') || '').slice(0, 120),
            sample: label
          });
        }
      }
      // A amostragem por tags acima monitora a regressão histórica.
      // A contagem abaixo examina cada NÓ DE TEXTO visível, inclusive conteúdo
      // direto em <div>, <li> e <article>, evitando contar pais e filhos duas vezes.
      const textNodeHistogram = {};
      const textNodeOutliers = [];
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      let node;
      while ((node = walker.nextNode())) {
        const parent = node.parentElement;
        const sample = (node.textContent || '').trim().replace(/\\s+/g, ' ').slice(0, 80);
        if (!parent || !sample || parent.closest('script,style,svg,noscript,[hidden],[aria-hidden="true"]')) continue;
        if (!parent.getClientRects().length) continue;
        const style = getComputedStyle(parent);
        if (style.display === 'none' || style.visibility === 'hidden') continue;
        const px = Math.round(parseFloat(style.fontSize)*10)/10;
        if (!Number.isFinite(px)) continue;
        const region = parent.closest('.portal-settings-workspace') ? 'configuracoes-popup' :
          insideSheet(parent) ? 'planilha-calendario' : 'portal-geral';
        const key = `${region}:${px}px`;
        textNodeHistogram[key]=(textNodeHistogram[key]||0)+1;
        if(px<10.5&&region!=='planilha-calendario'&&textNodeOutliers.length<16) {
          textNodeOutliers.push({size:px,region,tag:parent.tagName.toLowerCase(),
            classes:String(parent.getAttribute('class')||'').slice(0,120),sample});
        }
      }
      return { histogram, outliers, textNodes:{histogram:textNodeHistogram,outliers:textNodeOutliers} };
    });
    report.typography.push({ screen: name, ...fonts });
    if (name === 'master-inicio-320') {
      const dialogFonts=await page.evaluate(()=>{
        const dialog=document.createElement('dialog');
        dialog.className='portal-feedback-dialog portal-modal-surface';
        dialog.style.display='block';
        dialog.innerHTML='<header><h2>Confirmação</h2></header><p>Mensagem de teste</p>';
        document.body.appendChild(dialog);
        const heading=parseFloat(getComputedStyle(dialog.querySelector('h2')).fontSize);
        const message=parseFloat(getComputedStyle(dialog.querySelector('p')).fontSize);
        dialog.remove();
        // Exercita a prioridade CSS com as classes históricas dos botões de exclusão.
        const deleteButton=document.createElement('button');
        deleteButton.className='bg-rose-50 text-rose-700';
        deleteButton.innerHTML='<svg class="lucide lucide-trash-2"></svg>';
        document.body.appendChild(deleteButton);
        const trash={
          background:getComputedStyle(deleteButton).backgroundColor,
          color:getComputedStyle(deleteButton.querySelector('svg')).color
        };
        deleteButton.remove();
        return {heading,message,trash};
      });
      if(dialogFonts.heading!==18||dialogFonts.message!==11)
        report.errors.push(`Diálogo nativo fora da escala: ${JSON.stringify(dialogFonts)}`);
      if(dialogFonts.trash.background!=='rgb(255, 255, 255)'||dialogFonts.trash.color!=='rgb(220, 38, 38)')
        report.errors.push(`Botão de exclusão sem prioridade correta: ${JSON.stringify(dialogFonts.trash)}`);
    }

    // Contrato absoluto: todos os textos visíveis devem usar somente 11, 14 ou 18 px.
    // Valida as fontes COMPUTADAS, inclusive quando o Tailwind ou um estilo inline
    // tentar restabelecer dimensões históricas.
    const offScale = Object.entries({ ...fonts.histogram, ...fonts.textNodes.histogram })
      .filter(([key]) => ![11, 14, 18].includes(Number(key.split(':').at(-1).replace('px', ''))));
    if (offScale.length) report.errors.push(`${name}: fonte fora da escala 18/14/11 (${JSON.stringify(offScale)})`);
    const navAndTitles = await page.evaluate(() => {
      const visibleSizes = (selector) => Array.from(document.querySelectorAll(selector))
        .filter(el => el.getClientRects().length > 0)
        .map(el => Math.round(parseFloat(getComputedStyle(el).fontSize) * 10) / 10);
      return {
        sidebar: visibleSizes('#sidebar-nav button, #sidebar-nav button span'),
        titles: visibleSizes('#portal-app-root h1, #portal-app-root h2, .portal-settings-workspace-title h2, [data-portal-sheet-title="true"] h3')
      };
    });
    if (navAndTitles.sidebar.some(size => size !== 14)) report.errors.push(`${name}: navegação lateral fora de 14px`);
    if (navAndTitles.titles.some(size => size !== 18)) report.errors.push(`${name}: títulos fora de 18px`);
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
    for (const width of [320, 768, 1024, 1440, 1920]) {
      await page.setViewportSize({ width, height: 960 });
      await page.goto(base, { waitUntil: 'networkidle' });
      await capture(page, `master-inicio-${width}`);
      if (width >= 1440) {
        const layout = await page.evaluate(() => {
          const main = document.querySelector('#portal-app-root main');
          const pageRoot = document.querySelector('#home-page-container');
          return {
            mainWidth: Math.round(main?.getBoundingClientRect().width || 0),
            pageWidth: Math.round(pageRoot?.getBoundingClientRect().width || 0),
            viewport: innerWidth
          };
        });
        if (layout.mainWidth < width * 0.80 || (layout.pageWidth > 0 && layout.pageWidth < layout.mainWidth * 0.90)) {
          report.errors.push(`master-inicio-${width}: largura útil não acompanha o viewport (${JSON.stringify(layout)}).`);
        }
      }
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
        const routeSelectors = {
          indicadores: '#indicadores-publicos-page',
          'como-chegar': '#como-chegar-page-container',
          tutorial: '#portal-tutorial-page',
          'fluxo-tcc': '#fluxo-tcc-page',
          replicar: '#portal-replication-page',
          'meus-processos': '#meus-processos-page-container',
          coordenador: '#coordenador-page-root',
          configuracoes: '#configuracoes-page-container'
        };
        if (routeSelectors[tab]) {
          await page.locator(routeSelectors[tab]).waitFor({ state: 'visible', timeout: 6000 });
        }
        if (tab === 'calendario') {
          const calendarVisual = await page.evaluate(() => {
            const cells = Array.from(document.querySelectorAll('.portal-calendar-day-cell'));
            const emptyCells = Array.from(document.querySelectorAll('.portal-calendar-empty-cell'));
            const dayColors = Array.from(new Set(cells.map((cell) => getComputedStyle(cell).backgroundColor)));
            const emptyColors = Array.from(new Set(emptyCells.map((cell) => getComputedStyle(cell).backgroundColor)));
            const filterRow = document.querySelector('.portal-defense-filter-row');
            const banner = filterRow?.parentElement;
            const filterStyle = filterRow ? getComputedStyle(filterRow) : null;
            const filterRect = filterRow?.getBoundingClientRect();
            const bannerRect = banner?.getBoundingClientRect();
            return {
              cellCount: cells.length,
              emptyCount: emptyCells.length,
              dayColors,
              emptyColors,
              dividerTop: filterStyle ? parseFloat(filterStyle.borderTopWidth || '0') : 0,
              dividerTopColor: filterStyle?.borderTopColor || '',
              dividerBottom: filterStyle ? parseFloat(filterStyle.borderBottomWidth || '0') : 0,
              dividerBottomColor: filterStyle?.borderBottomColor || '',
              filterHeight: filterRect ? Math.round(filterRect.height) : 0,
              fullWidth: Boolean(filterRect && bannerRect && Math.abs(filterRect.left-bannerRect.left)<=1 && Math.abs(filterRect.right-bannerRect.right)<=1)
            };
          });
          if (
            calendarVisual.cellCount < 20
            || calendarVisual.cellCount > 23
            || calendarVisual.dayColors.length !== 1
            || calendarVisual.dayColors[0] !== 'rgb(213, 220, 224)'
          ) {
            report.errors.push(`master-calendario-${width}: grade útil ou cor dos dias divergente (${JSON.stringify(calendarVisual)}).`);
          }
          if (
            calendarVisual.emptyCount > 0
            && (calendarVisual.emptyColors.length !== 1 || calendarVisual.emptyColors[0] !== 'rgb(225, 230, 233)')
          ) {
            report.errors.push(`master-calendario-${width}: vazios do calendário não usam #E1E6E9 (${JSON.stringify(calendarVisual)}).`);
          }
          if (
            Math.abs(calendarVisual.dividerTop - 5) > 0.5
            || calendarVisual.dividerTopColor !== 'rgb(255, 255, 255)'
            || Math.abs(calendarVisual.dividerBottom - 15) > 0.5
            || calendarVisual.dividerBottomColor !== 'rgb(255, 255, 255)'
            || calendarVisual.filterHeight !== 65
            || !calendarVisual.fullWidth
          ) {
            report.errors.push(`master-calendario-${width}: geometria canônica da barra de filtro divergente (${JSON.stringify(calendarVisual)}).`);
          }
        }
        if (['como-chegar', 'tutorial', 'replicar'].includes(tab)) {
          const layerContract = await page.evaluate((currentTab) => {
            const ids = {
              'como-chegar': '#como-chegar-page-container',
              tutorial: '#portal-tutorial-page',
              replicar: '#portal-replication-page'
            };
            const root = document.querySelector(ids[currentTab]);
            const panel = root?.querySelector('.portal-layer-panel');
            const card = root?.querySelector('.portal-layer-card');
            const inner = root?.querySelector('.portal-layer-inner');
            return {
              panel: panel ? getComputedStyle(panel).backgroundColor : '',
              card: card ? getComputedStyle(card).backgroundColor : '',
              inner: inner ? getComputedStyle(inner).backgroundColor : ''
            };
          }, tab);
          if (
            layerContract.panel !== 'rgb(225, 230, 233)'
            || layerContract.card !== 'rgb(213, 220, 224)'
            || (layerContract.inner && layerContract.inner !== 'rgb(255, 255, 255)')
          ) {
            report.errors.push(`master-${label}-${width}: contrato das superfícies divergente (${JSON.stringify(layerContract)}).`);
          }
        }
        if (tab === 'como-chegar' && width >= 1024) {
          const geometry = await page.evaluate(() => {
            const map = document.querySelector('#como-chegar-page-container iframe')?.getBoundingClientRect();
            const department = document.querySelector('#como-chegar-page-container .grid > div:nth-child(2) > .portal-layer-card:first-child')?.getBoundingClientRect();
            return map && department ? {mapLeft:map.left,mapWidth:map.width,departmentLeft:department.left,departmentWidth:department.width} : null;
          });
          if (!geometry || geometry.departmentLeft <= geometry.mapLeft || geometry.mapWidth <= geometry.departmentWidth) {
            report.errors.push(`master-como-chegar-${width}: mapa e informações não estão distribuídos em esquerda/direita (${JSON.stringify(geometry)}).`);
          }
        }
        if (tab === 'indicadores') {
          // O painel carrega métricas de forma assíncrona após montar a rota;
          // aguardar os dados reais antes de aplicar o contrato visual.
          await page.locator('#indicadores-publicos-page').getByText(/TCCs cadastrados/i).first().waitFor({state:'visible',timeout:8000}).catch(()=>{});
          const indicatorError = await page.getByText('Não foi possível carregar os indicadores.', { exact: true }).count();
          const metricText = await page.locator('#indicadores-publicos-page').innerText().catch(() => '');
          if (indicatorError || !/TCCs cadastrados/i.test(metricText)) {
            report.errors.push(`master-indicadores-${width}: painel de indicadores não carregou dados públicos.`);
          }
        }
        if (tab === 'biblioteca') {
          const repoHeaderLine = await page.evaluate(() => {
            const header = document.querySelector('#biblioteca-tccs-section > div > div:first-child > div:last-child');
            return header ? parseFloat(getComputedStyle(header).borderTopWidth || '0') : 0;
          });
          if (repoHeaderLine > 0) report.errors.push(`master-repositorio-${width}: linha indevida permanece no cabeçalho (${repoHeaderLine}px).`);
        }
        if (tab === 'tutorial') {
          const tutorialColor = await page.evaluate(() => {
            const box = document.querySelector('#portal-tutorial-finish-card');
            return box ? getComputedStyle(box).backgroundColor : '';
          });
          if (tutorialColor !== 'rgb(213, 220, 224)') {
            report.errors.push(`master-como-usar-${width}: caixa final fora da camada cinza (${tutorialColor}).`);
          }
        }
        if (tab === 'replicar' && width >= 1024) {
          const modelCards = await page.evaluate(() => {
            const cards = Array.from(document.querySelectorAll('#portal-replication-page .portal-layer-card'));
            return cards.map((el) => Math.round(el.getBoundingClientRect().height));
          });
          if (!modelCards.length || Math.max(...modelCards) > 160) {
            report.errors.push(`master-replicar-${width}: cartões de modelos continuam altos (${JSON.stringify(modelCards)}).`);
          }
        }
        if (tab === 'coordenador' && width >= 768) {
          const coordinatorUi = await page.evaluate(() => {
            const row = document.querySelector('.portal-coordinator-filter-row');
            const rowStyle = row ? getComputedStyle(row) : null;
            const rowRect = row?.getBoundingClientRect();
            const parentRect = row?.parentElement?.getBoundingClientRect();
            const chips = Array.from(document.querySelectorAll('#coordenador-page-root .portal-standard-filter-chip'));
            const chipState = chips.map((chip) => ({
              transform: getComputedStyle(chip).transform,
              margin: getComputedStyle(chip).margin
            }));
            const dots = chips.map((chip) => {
              const dot = chip.querySelector('span');
              return dot ? getComputedStyle(dot).backgroundColor : '';
            });
            const asten = document.querySelector('#coordenador-page-root button[title="Assinar selecionados pela Asten"]');
            const gov = document.querySelector('#coordenador-page-root button[title="Preparar selecionados para assinatura Gov.br"]');
            const search = document.querySelector('#coordenador-page-root button[aria-label^="Buscar registros"]');
            const refresh = document.querySelector('#coordenador-refresh-btn');
            const settings = document.querySelector('#coordenador-page-root button[aria-label="Configurar exibição da planilha"]');
            const before = (a, b) => Boolean(a && b && (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING));
            return {
              divider: rowStyle ? parseFloat(rowStyle.borderTopWidth || '0') : 0,
              dividerColor: rowStyle?.borderTopColor || '',
              fullWidth: Boolean(rowRect && parentRect && Math.abs(rowRect.left-parentRect.left)<=1 && Math.abs(rowRect.right-parentRect.right)<=1),
              chipState,
              dots,
              hasRefresh: Boolean(refresh),
              orderOk: before(asten,gov) && before(gov,search) && before(search,settings)
            };
          });
          if (coordinatorUi.divider !== 5 || coordinatorUi.dividerColor !== 'rgb(255, 255, 255)' || !coordinatorUi.fullWidth) {
            report.errors.push(`master-presidencia-${width}: divisor branco não ocupa o cabeçalho inteiro (${JSON.stringify(coordinatorUi)}).`);
          }
          if (coordinatorUi.chipState.some((item) => item.transform !== 'none' || item.margin !== '0px')) {
            report.errors.push(`master-presidencia-${width}: filtro altera margem/transformação ao selecionar (${JSON.stringify(coordinatorUi.chipState)}).`);
          }
          if (!coordinatorUi.dots.includes('rgb(155, 136, 75)') || !coordinatorUi.dots.includes('rgb(126, 144, 126)')) {
            report.errors.push(`master-presidencia-${width}: filtros não preservam a paleta semântica pendente/assinada (${JSON.stringify(coordinatorUi.dots)}).`);
          }
          if (coordinatorUi.hasRefresh || !coordinatorUi.orderOk) {
            report.errors.push(`master-presidencia-${width}: barra deve manter Asten/Gov/lupa/engrenagem sem atualização manual.`);
          }
        }
        if (tab === 'meus-processos' && width >= 768) {
          const tccUi = await page.evaluate(() => {
            const row = document.querySelector('.portal-meus-processos-filter-row');
            const style = row ? getComputedStyle(row) : null;
            const rect = row?.getBoundingClientRect();
            const parent = row?.parentElement?.getBoundingClientRect();
            return {
              divider: style ? parseFloat(style.borderTopWidth || '0') : 0,
              dividerColor: style?.borderTopColor || '',
              fullWidth: Boolean(rect&&parent&&Math.abs(rect.left-parent.left)<=1&&Math.abs(rect.right-parent.right)<=1),
              hasRegister: Boolean(document.querySelector('#meus-processos-btn-novo')),
              hasSearch: Boolean(document.querySelector('#meus-processos-page-container button[aria-label^="Buscar registros"]')),
              hasRefresh: Boolean(document.querySelector('#meus-processos-refresh-btn')),
              hasSettings: Boolean(document.querySelector('#meus-processos-page-container button[aria-label="Configurar exibição da planilha"]'))
            };
          });
          if (tccUi.divider !== 5 || tccUi.dividerColor !== 'rgb(255, 255, 255)' || !tccUi.fullWidth) {
            report.errors.push(`master-meus-tccs-${width}: divisor branco não ocupa o cabeçalho inteiro (${JSON.stringify(tccUi)}).`);
          }
          if (!tccUi.hasRegister || !tccUi.hasSearch || tccUi.hasRefresh || !tccUi.hasSettings) {
            report.errors.push(`master-meus-tccs-${width}: barra deve manter cadastro/lupa/engrenagem sem atualização manual (${JSON.stringify(tccUi)}).`);
          }
        }
        if (tab === 'configuracoes') {
          const settingsUi = await page.evaluate(() => {
            const root = document.querySelector('#configuracoes-page-container');
            const hub = document.querySelector('#portal-settings-hub');
            const launchers = Array.from(document.querySelectorAll('#portal-settings-hub .portal-settings-launcher'));
            const hubStyle = hub ? getComputedStyle(hub) : null;
            return {
              root: Boolean(root),
              hub: Boolean(hub),
              launcherCount: launchers.length,
              hubBackground: hubStyle?.backgroundColor || '',
              hubBorderTop: hubStyle?.borderTopWidth || '',
              hasLegacySyncSection: Boolean(document.querySelector('#google-workspace-sync-section')),
              hasLegacyModelsSection: Boolean(document.querySelector('#master-flow-system-section'))
            };
          });
          if (
            !settingsUi.root
            || !settingsUi.hub
            || settingsUi.launcherCount < 9
            || !['rgba(0, 0, 0, 0)', 'transparent'].includes(settingsUi.hubBackground)
            || settingsUi.hasLegacySyncSection
            || settingsUi.hasLegacyModelsSection
          ) {
            report.errors.push(`master-configuracoes-${width}: hub de Configurações fora da arquitetura nativa (${JSON.stringify(settingsUi)}).`);
          }
        }
        // Tipografia e geometria dos seis editores administrativos: confirmar estilos
        // COMPUTADOS em navegador real, não somente strings das classes Tailwind.
        if (tab === 'configuracoes' && width === 1440) {
          for (const [title,slug] of [
            ['Rodapé e Identidade','identidade'],
            ['Integrações e Plataforma','integracoes'],
            ['Documentos e Variáveis','documentos'],
            ['E-mails','emails'],
            ['Formulários','formularios'],
            ['Fluxos','fluxos']
          ]) {
            const launcher=page.locator('#portal-settings-hub .portal-settings-launcher').filter({hasText:title}).first();
            await launcher.click();
            const modal=page.locator('.portal-settings-workspace');
            await modal.waitFor({state:'visible'});
            const visual=await page.evaluate(()=>{
              const root=document.querySelector('.portal-settings-workspace');
              const pane=root?.querySelector('.portal-settings-single-pane');
              const fields=Array.from(root?.querySelectorAll('input:not([type="checkbox"]):not([type="radio"]):not([type="file"]),textarea,select')||[])
                .filter(el=>el.getClientRects().length>0)
                .map(el=>({tag:el.tagName,size:parseFloat(getComputedStyle(el).fontSize)}));
              const trash=Array.from(root?.querySelectorAll('button:has(svg[class*="lucide-trash"])')||[])
                .filter(el=>el.getClientRects().length>0)
                .map(el=>({background:getComputedStyle(el).backgroundColor,icon:getComputedStyle(el.querySelector('svg')).color}));
              return {width:root?.getBoundingClientRect().width||0,viewport:innerWidth,
                bodyFont:pane?parseFloat(getComputedStyle(pane).fontSize):0,
                heading:parseFloat(getComputedStyle(root.querySelector('.portal-settings-workspace-title h2')).fontSize),
                fields,trash};
            });
            if(Math.abs(visual.bodyFont-11)>0.25||Math.abs(visual.heading-18)>0.25||
              visual.fields.some(field=>Math.abs(field.size-11)>0.5)||
              visual.width>visual.viewport-8){
              report.errors.push(`config-${slug}: escala/viewport divergente (${JSON.stringify(visual).slice(0,750)})`);
            }
            if(visual.trash.some(item=>item.background!=='rgb(255, 255, 255)'||item.icon!=='rgb(220, 38, 38)')){
              report.errors.push(`config-${slug}: exclusão fora do padrão branco/vermelho (${JSON.stringify(visual.trash)})`);
            }
            await capture(page,`master-config-modal-${slug}-1440`);
            await page.keyboard.press('Escape');
            await modal.waitFor({state:'hidden'});
          }
          for(const [title,slug] of [
            ['Acesso','acesso'],
            ['Registros de Assinatura','assinaturas'],
            ['Registro de Logs','logs']
          ]){
            await page.locator('#portal-settings-hub .portal-settings-launcher').filter({hasText:title}).first().click();
            const modal=page.locator('.portal-settings-workspace');
            await modal.waitFor({state:'visible'});
            const sheet=await page.evaluate(()=>{
              const root=document.querySelector('.portal-settings-workspace');
              const table=root?.querySelector('.portal-spreadsheet-table');
              return {sheet:root?.getAttribute('data-portal-sheet-workspace'),
                width:root?.getBoundingClientRect().width||0,viewport:innerWidth,
                font:table?parseFloat(getComputedStyle(table).fontSize):null};
            });
            if(sheet.sheet!=='true'||sheet.width>sheet.viewport-8||
              (sheet.font!==null&&Math.abs(sheet.font-11)>0.5)){
              report.errors.push(`config-${slug}: planilha deve manter 11px e respeitar o viewport (${JSON.stringify(sheet)})`);
            }
            await capture(page,`master-config-modal-${slug}-1440`);
            await page.keyboard.press('Escape');
            await modal.waitFor({state:'hidden'});
          }
        }
        if (tab === 'fluxo-tcc' && width >= 1440) {
          const fluxoGeometry = await page.evaluate(() => {
            const root = document.querySelector('#fluxo-tcc-page')?.getBoundingClientRect();
            const main = document.querySelector('#portal-app-root main')?.getBoundingClientRect();
            return root && main ? { rootWidth: Math.round(root.width), mainWidth: Math.round(main.width) } : null;
          });
          if (!fluxoGeometry || fluxoGeometry.rootWidth < fluxoGeometry.mainWidth * 0.90) {
            report.errors.push(`master-fluxo-tcc-${width}: Fluxo não acompanha a largura útil (${JSON.stringify(fluxoGeometry)}).`);
          }
        }
        if (['indicadores', 'como-chegar', 'tutorial', 'fluxo-tcc', 'replicar'].includes(tab)) {
          const headerGap = await page.evaluate((currentTab) => {
            const ids = {
              indicadores: '#indicadores-publicos-page',
              'como-chegar': '#como-chegar-page-container',
              tutorial: '#portal-tutorial-page',
              'fluxo-tcc': '#fluxo-tcc-page',
              replicar: '#portal-replication-page'
            };
            const root = document.querySelector(ids[currentTab]);
            const first = root?.querySelector(':scope > section:first-child');
            if (!root || !first) return 999;
            return Math.round(first.getBoundingClientRect().top - root.getBoundingClientRect().top);
          }, tab).catch(() => 999);
          if (headerGap > 1) {
            report.errors.push(`master-${label}-${width}: cabeçalho verde não encosta no topo (gap ${headerGap}px).`);
          }
        }
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
  await writeFile(path.join(output, 'typography-audit.json'), JSON.stringify(report.typography, null, 2));
  const allFonts = {};
  for (const screen of report.typography) for (const [size,count] of Object.entries(screen.histogram)) allFonts[size]=(allFonts[size]||0)+count;
  const allTextNodes={};
  for(const screen of report.typography) for(const [size,count] of Object.entries(screen.textNodes?.histogram||{})) allTextNodes[size]=(allTextNodes[size]||0)+count;
  console.log('[TYPOGRAPHY_AUDIT]', JSON.stringify({ screens:report.typography.length, histogram:allFonts, textNodeHistogram:allTextNodes,
    sampleOutliers:report.typography.filter(screen=>screen.outliers.length).slice(0,12).map(screen=>({screen:screen.screen,outliers:screen.outliers.slice(0,3)})) }));
  await writeFile(path.join(output, 'resultado.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
}