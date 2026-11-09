import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const base = new URL(process.env.PORTAL_NAVIGATION_TEST_BASE_URL || 'http://127.0.0.1:3000');
if (!['localhost', '127.0.0.1'].includes(base.hostname)) throw new Error('Use uma instância local para validar a navegação.');
const modules = process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES
  || path.join(process.env.HOME || '', '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules');
const { chromium } = await import(pathToFileURL(path.join(modules, 'playwright/index.mjs')).href);
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.PORTAL_TEST_CHROMIUM || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
});

try {
  for (const width of [390, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: 950 } });
    await context.addInitScript(() => localStorage.setItem('portal_table_page_size_acervo', '25'));
    const records = Array.from({ length: 100 }, (_, index) => ({
      id: `fixture-${index}`, protocolo: `Teste ${index}`, titulo: `Trabalho de demonstração ${index}`,
      autores: ['Estudante de Teste'], orientador: 'Orientadora de Teste', examinadores: [],
      dataDefesa: '2025-11-05', localDefesa: 'Sala de Teste', resumo: 'Resumo demonstrativo', publicFiles: [],
    }));
    await context.route('**/*', (route) => {
      const url = new URL(route.request().url());
      if (url.origin !== base.origin && !['data:', 'blob:'].includes(url.protocol)) return route.abort();
      if (url.pathname === '/api/legacy-academic-records') return route.fulfill({ json: records });
      return route.continue();
    });
    const page = await context.newPage();
    const errors: Error[] = [];
    page.on('pageerror', (error) => errors.push(error));
    await page.goto(base.href, { waitUntil: 'networkidle' });
    const sidebar = page.locator('#portal-sidebar');
    const openMenu = page.getByRole('button', { name: 'Abrir menu', exact: true });
    const closeMenu = sidebar.getByRole('button', { name: 'Fechar menu', exact: true });
    const isFocused = (locator) => locator.evaluate((element) => document.activeElement === element);

    if (width < 1024) {
      assert.equal(await sidebar.isVisible(), false);
      assert.equal(await openMenu.getAttribute('aria-expanded'), 'false');
      await page.keyboard.press('Tab');
      assert.equal(await isFocused(openMenu), true, 'O menu fechado fica fora da ordem de Tab.');
      await page.keyboard.press('Enter');
      assert.equal(await openMenu.getAttribute('aria-expanded'), 'true');
      assert.equal(await isFocused(closeMenu), true, 'Ao abrir, o foco entra no menu.');
      await page.keyboard.press('Escape');
      assert.equal(await sidebar.isVisible(), false);
      assert.equal(await isFocused(openMenu), true, 'Ao fechar, o foco volta ao botão de abertura.');
      await page.keyboard.press('Enter');
    } else {
      assert.equal(await sidebar.isVisible(), true);
    }

    await sidebar.getByRole('button', { name: 'Repositório', exact: true }).click();
    const pager = page.getByRole('navigation', { name: 'Paginação da planilha' });
    const next = pager.getByRole('button', { name: 'Próxima', exact: true });
    const previous = pager.getByRole('button', { name: 'Anterior', exact: true });
    const activePage = pager.locator('button[aria-current="page"]');
    await next.focus();
    await page.keyboard.press('Enter');
    assert.equal(await activePage.textContent(), '2');
    assert.equal(await isFocused(next), true, 'A próxima página mantém o foco no controle equivalente.');
    await previous.focus();
    await page.keyboard.press('Enter');
    assert.equal(await activePage.textContent(), '1');
    assert.equal(await previous.isDisabled(), true);
    assert.equal(await isFocused(activePage), true, 'Na primeira página, o foco vai para o número atual.');

    const pageNumbers = pager.getByRole('button', { name: /^\d+$/ });
    const lastPage = await pageNumbers.last().textContent();
    await pageNumbers.last().focus();
    await page.keyboard.press('Enter');
    assert.equal(await activePage.textContent(), lastPage);
    assert.equal(await isFocused(activePage), true, 'Ao escolher uma página, o número mantém o foco.');
    await previous.focus();
    await page.keyboard.press('Enter');
    assert.equal(await isFocused(previous), true);
    await next.focus();
    await page.keyboard.press('Enter');
    assert.equal(await activePage.textContent(), lastPage);
    assert.equal(await next.isDisabled(), true);
    assert.equal(await isFocused(activePage), true, 'Na última página, o foco vai para o número atual.');
    assert.deepEqual(errors, []);
    await context.close();
  }
  console.log('PASS: foco no menu e na paginação do Repositório em 390 e 1440 px.');
} finally {
  await browser.close();
}
