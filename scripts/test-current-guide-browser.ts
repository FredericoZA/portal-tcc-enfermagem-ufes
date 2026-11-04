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
const output = path.resolve('output/playwright');
await mkdir(output, {recursive: true});
const browser = await chromium.launch({headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const context = await browser.newContext({viewport: {width: 1440, height: 1050}});
const page = await context.newPage();
const errors: string[] = [];
const checked: Record<string, unknown>[] = [];
page.on('pageerror', error => errors.push(error.message));
const roleLabels = {aluno: 'Aluno', orientador: 'Orientador', visitante: 'Visitante'} as const;
try {
  await page.goto(base, {waitUntil: 'networkidle'});
  await page.getByRole('button', {name: 'Como usar', exact: true}).click();
  const manual = page.locator('#portal-tutorial-page');
  await manual.getByRole('heading', {name: 'Como usar o Portal de TCC', exact: true}).waitFor();
  assert.equal(await manual.getByRole('group', {name: 'Perfil do manual'}).getByRole('button').count(), 3);
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
  assert.equal(await manual.locator('.portal-instruction').count(), 0);
  assert.equal(await manual.getByRole('button', {name: 'Ver o Fluxo do TCC', exact: true}).count(), 0);
  await page.getByRole('button', {name: 'Fluxo do TCC', exact: true}).click();
  const flow = page.locator('#fluxo-tcc-page');
  await flow.getByRole('heading', {name: 'Fluxo do TCC', exact: true}).waitFor();
  assert.equal(await flow.getByRole('heading', {name: 'Assinaturas no processo', exact: true}).count(), 1);
  assert.equal(await flow.locator('.portal-flow-step').count(), 8);
  assert.equal(await page.locator('#signature-flow-title').count(), 1);
  assert.match(await flow.innerText(), /Portal do Professor/);
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
  for (const width of [390, 768]) {
    await page.setViewportSize({width, height: 844});
    for (const role of Object.keys(guideActivityOrder) as (keyof typeof roleLabels)[]) {
      await manual.getByRole('button', {name: roleLabels[role], exact: true}).click();
      const activities = activitiesForRole(role);
      const next = manual.getByRole('button', {name: 'Próxima tela', exact: true});
      await next.focus();
      await page.keyboard.press('End');
      await manual.locator('[data-guide-activity]').getByRole('heading', {name: activities.at(-1)!.title, exact: false}).waitFor();
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true, `Overflow ${role} at ${width}`);
      assert.equal(await manual.locator('[data-guide-activity]').locator('img').first().evaluate((img: HTMLImageElement) => img.getBoundingClientRect().width <= innerWidth), true);
    }
    await manual.screenshot({path: path.join(output, `manual-atual-${width}.png`)});
  }
  assert.deepEqual(errors, []);
  await writeFile(path.join(output, 'manual-atual-browser-qa.json'), JSON.stringify({base, checked, viewports: [1440, 768, 390], errors, dataMutations: false}, null, 2));
  console.log(`PASS: ${checked.length} atividades, três perfis, imagens, teclado, oito passos, um quadro de assinaturas e três larguras. Nenhum login ou envio realizado.`);
} finally {
  await context.close();
  await browser.close();
}
