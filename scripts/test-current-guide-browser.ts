import assert from 'node:assert/strict';
import {mkdir, writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
import {activitiesForRole, guideActivityOrder} from '../src/components/PortalIllustratedGuide';

// Read-only browser check of the actual guide UI. No login, form submission,
// provider call or production dataset is needed.
const base = process.env.PORTAL_GUIDE_TEST_BASE_URL || 'http://localhost:3000';
if (!['localhost', '127.0.0.1'].includes(new URL(base).hostname)) throw new Error('Use uma instância local para validar o manual.');
const {chromium} = await import(pathToFileURL(path.join(process.env.HOME || '', '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs')).href);
const output = path.resolve(process.env.PORTAL_GUIDE_TEST_OUTPUT || 'output/playwright');
await mkdir(output, {recursive: true});
const browser = await chromium.launch({headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const context = await browser.newContext({viewport: {width: 1440, height: 1050}});
const page = await context.newPage();
const errors: string[] = [];
const checked: Record<string, unknown>[] = [];
page.on('pageerror', error => errors.push(error.message));
const roleLabels = {aluno: 'Aluno', orientador: 'Orientador', examinador: 'Examinador', visitante: 'Visitante'} as const;
try {
  await page.goto(base, {waitUntil: 'networkidle'});
  await page.getByRole('button', {name: 'Entrar no Portal', exact: true}).click();
  const login = page.getByRole('dialog', {name: 'Acesso ao Portal', exact: true});
  const loginHeading = login.getByRole('heading', {name: 'Acesso ao Portal do TCC', exact: true});
  const loginGeometry = await loginHeading.evaluate(heading => {
    const icon = heading.parentElement!.querySelector('svg.lucide-lock')!;
    const label = heading.getBoundingClientRect();
    const lock = icon.getBoundingClientRect();
    return {size: lock.width, font: Number.parseFloat(getComputedStyle(heading).fontSize),
      aligned: Math.abs((label.top + label.height / 2) - (lock.top + lock.height / 2)) <= 1};
  });
  assert.equal(loginGeometry.size, loginGeometry.font);
  assert.equal(loginGeometry.aligned, true);
  await login.screenshot({path: path.join(output, 'cadeado-acesso-atual.png')});
  await page.keyboard.press('Escape');
  await login.waitFor({state: 'hidden'});
  await page.getByRole('button', {name: 'Como usar', exact: true}).click();
  const manual = page.locator('#portal-tutorial-page');
  await manual.getByRole('heading', {name: 'Como usar o Portal de TCC', exact: true}).waitFor();
  assert.equal(await manual.getByRole('group', {name: 'Perfil do manual'}).getByRole('button').count(), 4);
  const verifyLayout = async (width: number, role: string, activity: string) => {
    const layout = await manual.locator('.portal-guide-content').evaluate(content => {
      const instructions = content.querySelector('ol')!;
      const text = instructions.getBoundingClientRect();
      const figure = content.querySelector('figure')!.getBoundingClientRect();
      const grid = content.getBoundingClientRect();
      const columns = getComputedStyle(content).gridTemplateColumns.split(' ').map(Number.parseFloat);
      return {
        font: Number.parseFloat(getComputedStyle(instructions).fontSize),
        columns,
        centered: Math.abs(figure.left + figure.width / 2 - (grid.right - columns[1] / 2)) < 2,
        textBeforeFigure: figure.top >= text.bottom,
        overflow: instructions.scrollWidth > instructions.clientWidth + 1,
      };
    });
    const label = `${role}/${activity} em ${width}px`;
    assert.ok(layout.font >= 16, `Corpo legível: ${label}`);
    assert.equal(layout.overflow, false, `Texto sem corte: ${label}`);
    if (width >= 1024) {
      assert.equal(layout.columns.length, 2, `Duas colunas: ${label}`);
      assert.ok(Math.abs(layout.columns[0] - layout.columns[1]) < 2, `Metades iguais: ${label}`);
      assert.ok(layout.centered, `Figura centralizada na metade direita: ${label}`);
    } else {
      assert.ok(layout.textBeforeFigure, `Figura depois do texto: ${label}`);
    }
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true, `Sem rolagem horizontal: ${label}`);
  };
  for (const role of Object.keys(guideActivityOrder) as (keyof typeof roleLabels)[]) {
    await manual.getByRole('button', {name: roleLabels[role], exact: true}).click();
    assert.equal(await manual.getByRole('heading', {name: /^(Antes de começar|Veja onde clicar|Conferência antes de encerrar|Erros a evitar)/}).count(), 0);
    assert.equal(await manual.locator('.portal-tutorial-before').count(), 0);
    assert.equal(await manual.locator('.portal-tutorial-checklist').count(), 0);
    const activities = activitiesForRole(role);
    const previous = manual.getByRole('button', {name: 'Tela anterior', exact: true});
    const next = manual.getByRole('button', {name: 'Próxima tela', exact: true});
    assert.equal(await manual.getByRole('combobox').count(), 0);
    assert.equal(await previous.isDisabled(), true);
    assert.equal(await manual.locator('[data-guide-activity]').getByRole('heading', {name: `${activities[0].title} — 1/${activities.length}`, exact: true}).count(), 1);
    assert.equal(await manual.locator('[data-guide-activity]').evaluate(el => getComputedStyle(el).backgroundColor), 'rgb(216, 223, 227)');
    for (const [activityIndex, activity] of activities.entries()) {
      const panel = manual.locator('[data-guide-activity]');
      await panel.getByRole('heading', {name: activity.title, exact: false}).waitFor();
      await verifyLayout(1440, role, activity.id);
      await panel.locator('img').first().scrollIntoViewIfNeeded();
      await panel.locator('img').first().evaluate(async (img: HTMLImageElement) => { await img.decode(); });
      assert.equal(await panel.locator('img').first().evaluate((img: HTMLImageElement) => img.naturalWidth > 100 && img.naturalHeight > 100), true);
      const imagePresentation = await panel.locator('img').first().evaluate((img: HTMLImageElement) => ({
        width: img.getBoundingClientRect().width,
        naturalWidth: img.naturalWidth,
        frameBackground: getComputedStyle(img.parentElement!).backgroundColor,
        frameBorder: getComputedStyle(img.parentElement!).borderTopWidth,
      }));
      assert.ok(imagePresentation.width <= imagePresentation.naturalWidth + 1, `${activity.id}: imagem ampliada além da origem`);
      assert.equal(imagePresentation.frameBackground, 'rgba(0, 0, 0, 0)');
      assert.equal(imagePresentation.frameBorder, '0px');
      if (activity.id === 'acesso') assert.ok(imagePresentation.width <= 380);
      if (activity.id === 'sugestoes') assert.ok(imagePresentation.width <= 400);
      for (const summary of await panel.locator('summary').filter({hasText: 'Ver exemplo:'}).all()) {
        await summary.click();
        const image = summary.locator('..').locator('img');
        await image.scrollIntoViewIfNeeded();
        await image.evaluate(async (img: HTMLImageElement) => { await img.decode(); });
        await summary.click();
      }
      await panel.getByText('Dúvidas desta atividade', {exact: true}).click();
      assert.match(await panel.innerText(), /Como saber que terminou/);
      assert.match(await panel.innerText(), new RegExp(activity.help[0].slice(0, 18).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
      checked.push({role, activity: activity.id, image: await panel.locator('img').first().getAttribute('src')});
      if (activityIndex < activities.length - 1) await next.click();
    }
    assert.equal(await next.isDisabled(), true);
    await previous.click();
    await manual.locator('[data-guide-activity]').getByRole('heading', {name: activities.at(-2)!.title, exact: false}).waitFor();
    await previous.focus();
    await page.keyboard.press('Home');
    assert.equal(await previous.isDisabled(), true);
    await next.focus();
    await page.keyboard.press('ArrowRight');
    await manual.locator('[data-guide-activity]').getByRole('heading', {name: activities[1].title, exact: false}).waitFor();
    await manual.screenshot({path: path.join(output, `manual-atual-${role}.png`)});
  }
  assert.equal(await manual.locator('#tutorial-manual-notice').count(), 0);
  const pdfLink = manual.locator('.portal-public-title-row').getByRole('link', {name: 'Acesse o manual detalhado em PDF'});
  assert.equal(await pdfLink.getAttribute('href'), '/manual/manual-portal-tcc.pdf');
  assert.equal(await pdfLink.getAttribute('target'), '_blank');
  await pdfLink.focus();
  assert.equal(await pdfLink.evaluate(el => document.activeElement === el), true);
  const pdfResponse = await context.request.get(new URL('/manual/manual-portal-tcc.pdf', base).href);
  assert.equal(pdfResponse.status(), 200);
  assert.match(pdfResponse.headers()['content-type'] || '', /application\/pdf/i);
  assert.equal((await pdfResponse.body()).subarray(0, 5).toString(), '%PDF-');
  assert.equal(await manual.getByRole('button', {name: 'Ver o Fluxo do TCC', exact: true}).count(), 0);
  await page.getByRole('button', {name: 'Fluxo do TCC', exact: true}).click();
  const flow = page.locator('#fluxo-tcc-page');
  await flow.getByRole('heading', {name: 'Fluxo do TCC', exact: true}).waitFor();
  assert.equal(await flow.getByRole('heading', {name: 'Assinaturas no processo', exact: true}).count(), 1);
  assert.equal(await flow.locator('.portal-flow-step').count(), 8);
  const flowText = await flow.locator('.portal-flow-step').allTextContents();
  assert.ok(flowText.findIndex(text => /termo de autorização/i.test(text)) <
    flowText.findIndex(text => /assinar a declaração/i.test(text)));
  assert.equal(await page.locator('#signature-flow-title').count(), 1);
  assert.match(await flow.innerText(), /Portal do Professor/);
  assert.match(await flow.locator('[aria-labelledby="signature-flow-title"]').innerText(), /Orientador e dois examinadores/);
  await flow.locator('img').scrollIntoViewIfNeeded();
  await flow.locator('img').evaluate(async (img: HTMLImageElement) => { await img.decode(); });
  const signatureLayout = flow.locator('[data-signature-layout]');
  const tableBox = await signatureLayout.getByRole('region').boundingBox();
  const imageBox = await signatureLayout.locator('figure').boundingBox();
  assert.ok(tableBox && imageBox && imageBox.x >= tableBox.x + tableBox.width - 1, 'Tabela e imagem lado a lado no desktop');
  assert.ok(tableBox && imageBox && Math.abs(tableBox.y - imageBox.y) <= 1, 'Tabela e imagem alinhadas pelo topo');
  assert.equal(await signatureLayout.locator('tbody tr').count(), 5);
  assert.equal(await flow.locator('[aria-labelledby="signature-flow-title"] .portal-instruction').count(), 0);
  await flow.screenshot({path: path.join(output, 'fluxo-tcc-atual.png')});
  for (const width of [390, 768]) {
    await page.setViewportSize({width, height: 844});
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true, `Overflow fluxo at ${width}`);
    const signatureTable = flow.getByRole('region', {name: 'Tabela de assinaturas do processo'});
    const tableSize = await signatureTable.evaluate(el => ({available: el.clientWidth, content: el.scrollWidth}));
    assert.equal(tableSize.content > tableSize.available, tableSize.available < 440, `Rolagem da tabela de assinaturas em ${width}px`);
  }
  await page.setViewportSize({width: 1440, height: 1050});
  await page.getByRole('button', {name: 'Como usar', exact: true}).click();
  await manual.waitFor();
  for (const width of [390, 768, 1920]) {
    await page.setViewportSize({width, height: 844});
    const headerFits = await manual.evaluate(root => {
      const title = root.querySelector('.portal-public-title-row')!.getBoundingClientRect();
      const pdf = root.querySelector('#tutorial-manual-pdf')!.getBoundingClientRect();
      const filter = root.querySelector('.portal-tutorial-filter-row')!.getBoundingClientRect();
      return pdf.bottom <= title.bottom && title.bottom <= filter.top &&
        [...root.querySelectorAll('.portal-tutorial-filter-row button')].every(button =>
          button.getBoundingClientRect().bottom <= filter.bottom);
    });
    assert.ok(headerFits, `Cabeçalho do manual sem sobreposição em ${width}px`);
    for (const role of Object.keys(guideActivityOrder) as (keyof typeof roleLabels)[]) {
      await manual.getByRole('button', {name: roleLabels[role], exact: true}).click();
      const activities = activitiesForRole(role);
      const next = manual.getByRole('button', {name: 'Próxima tela', exact: true});
      for (const [index, activity] of activities.entries()) {
        const panel = manual.locator(`[data-guide-activity="${activity.id}"]`);
        await panel.waitFor();
        await verifyLayout(width, role, activity.id);
        assert.equal(await panel.locator('img').first().evaluate(img => img.getBoundingClientRect().width <= innerWidth), true);
        if (index < activities.length - 1) await next.click();
      }
    }
    await manual.screenshot({path: path.join(output, `manual-atual-${width}.png`)});
  }
  await page.setViewportSize({width: 1440, height: 950});
  await page.getByRole('button', {name: 'Informações gerais', exact: true}).click();
  const info = page.locator('#informacoes-gerais-tcc-page');
  const course = info.getByRole('region', {name: 'Sobre o Trabalho de Conclusão de Curso'});
  const portal = info.getByRole('region', {name: 'Informações sobre o Portal TCC'});
  await course.waitFor();
  assert.equal(await course.getByRole('heading', {level: 3}).count(), 9);
  assert.equal(await portal.getByRole('heading', {level: 3}).count(), 2);
  assert.equal(await portal.getByRole('link').count(), 5);
  await page.keyboard.press('Tab');
  for (const width of [390, 768, 1440]) {
    await page.setViewportSize({width, height: 950});
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `Overflow das informações gerais em ${width}px`);
    const cards = await course.locator('section').evaluateAll(items => items.map(card => {
      const {x, y, height, bottom} = card.getBoundingClientRect();
      return {
        x, y, height,
        paddingBottom: Number.parseFloat(getComputedStyle(card).paddingBottom),
        remaining: bottom - card.lastElementChild!.getBoundingClientRect().bottom,
        minHeight: getComputedStyle(card).minHeight,
      };
    }));
    assert.equal(new Set(cards.map(card => card.x)).size, width === 390 ? 1 : width === 768 ? 2 : 3);
    for (const y of new Set(cards.map(card => card.y))) {
      const row = cards.filter(card => card.y === y);
      assert.ok(row.every(card => card.minHeight === 'auto' || card.minHeight === '0px'));
      assert.equal(new Set(row.map(card => card.height)).size, 1, `Altura alinhada por linha em ${width}px`);
      assert.ok(row.some(card => card.remaining <= card.paddingBottom + 2), `Linha dimensionada pelo conteúdo em ${width}px`);
    }
    for (const link of await info.getByRole('link').all()) {
      await link.focus();
      assert.equal(await link.evaluate(el => document.activeElement === el && el.matches(':focus-visible')), true);
    }
  }
  await info.screenshot({path: path.join(output, 'informacoes-gerais-atual.png')});
  assert.deepEqual(errors, []);
  await writeFile(path.join(output, 'manual-atual-browser-qa.json'), JSON.stringify({base, checked, loginGeometry, viewports: [1440, 1920, 768, 390], errors, dataMutations: false}, null, 2));
  console.log(`PASS: ${checked.length} atividades, quatro perfis, imagens, teclado, oito passos, um quadro de assinaturas e quatro larguras. Nenhum login ou envio realizado.`);
} finally {
  await context.close();
  await browser.close();
}
