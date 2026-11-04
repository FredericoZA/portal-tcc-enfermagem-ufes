/** Read-only browser regression: synthetic GET responses, no provider requests or writes. */
import {createRequire} from 'node:module';
import path from 'node:path';
import {mkdir, writeFile} from 'node:fs/promises';
import {DEMO_PROCESSES} from '../src/services/demoSeed';
import {publicRepositoryView} from '../server/publicViews';

const require = createRequire(import.meta.url);
const runtime = process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES;
const {chromium} = runtime ? require(path.join(runtime, 'playwright')) : require('playwright');
const base = process.env.PORTAL_REVIEW_URL || 'http://127.0.0.1:3001';
if (!['127.0.0.1', 'localhost'].includes(new URL(base).hostname)) throw Error('Local browser test only');
const directory = 'output/playwright/calendar-pending-20261104';
await mkdir(directory, {recursive: true});
const item = structuredClone(DEMO_PROCESSES[0]);
Object.assign(item, {id: 'calendar-fixture', protocolo: 'TCC-2026-9001', titulo: 'Educação em Saúde — Exemplo de Agendamento', status: 'AGUARDANDO_CONFIRMACAO_LOCAL', etapaAtual: 'CONFIRMACAO_LOCAL'});
item.aluno1 = {nome: 'Alice Martins Pereira', email: 'alice@example.invalid', matricula: 'EXEMPLO001'};
item.aluno2 = null;
item.orientador = {nome: 'Carolina Souza Lima', email: 'orientador@example.invalid', tratamento: 'Professora', titulacao: 'Doutora'};
item.avaliacao = {status: 'PENDENTE'};
item.acervo = {resumoSintese: 'Exemplo fictício para conferir o calendário.', palavrasChave: ['Educação', 'Saúde', 'Enfermagem', 'Cuidado', 'Comunidade']};
item.defesa = {startAt: '2026-11-05T17:00:00Z', endAt: '2026-11-05T18:30:00Z', local: 'Auditório de Enfermagem', localStatus: 'PENDENTE'};
const stale = {id: 'google-old-fixture', portalTccProtocol: item.protocolo, summary: 'Evento antigo que não deve reaparecer', description: `Protocolo: ${item.protocolo}`, start: item.defesa.startAt, end: item.defesa.endAt};
const code = new RegExp(item.protocolo.split('-').join('\\s*-\\s*'));
const label = '(aguardando confirmação)';
const red = 'rgb(153, 27, 27)';
let current = structuredClone(item);
const browser = await chromium.launch({headless: true, executablePath: process.env.PORTAL_VISUAL_BROWSER_EXECUTABLE || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const checks: any[] = [], errors: string[] = [], writes: string[] = [], external: string[] = [];
try {
 const context = await browser.newContext({viewport: {width: 1560, height: 1160}, deviceScaleFactor: 4, timezoneId: 'America/Sao_Paulo'});
 await context.route('**/*', (route: any) => {
  const request = route.request(), url = request.url();
  if (!url.startsWith(base) && !/^(blob|data):/.test(url)) { external.push(url); return route.abort(); }
  if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method())) { writes.push(request.method() + ' ' + url); return route.abort(); }
  return route.continue();
 });
 const page = await context.newPage();
 await page.clock.setFixedTime(new Date('2026-11-04T15:00:00Z'));
 page.on('pageerror', (error: Error) => errors.push(error.message));
 await page.route(base + '/api/legacy-academic-records', (route: any) => route.fulfill({json: []}));
 await page.route(base + '/api/processes', (route: any) => route.fulfill({json: [publicRepositoryView(current)]}));
 await page.route(base + '/api/calendar/events', (route: any) => route.fulfill({json: [stale]}));
 const calendar = page.locator('[data-portal-sheet="calendar"]');
 const defenses = page.locator('[data-portal-sheet="defenses"]');

 async function inspect(name: string, present: boolean, pending: boolean) {
  await page.goto(base + '/');
  await page.getByRole('button', {name: 'Calendário', exact: true}).click();
  await calendar.waitFor();
  await page.waitForTimeout(400);
  const summary = calendar.locator('.portal-calendar-defense-summary').filter({hasText: item.titulo});
  if (present) await summary.waitFor();
  if (await summary.count() !== (present ? 1 : 0)) throw Error(name + ': incorrect calendar count');
  if (await defenses.locator('tbody tr').filter({hasText: code}).count() !== (present ? 1 : 0)) throw Error(name + ': incorrect defense list');
  if (await calendar.getByText(/Evento antigo/).count()) throw Error('Stale Google event reappeared');
  const notes = calendar.getByText(label, {exact: true});
  if (await notes.count() !== (pending ? 1 : 0)) throw Error(name + ': incorrect pending note');
  let tone = null;
  if (present) {
   const text = (await summary.innerText()).replace(/\s+/g, ' ').trim();
   const primary = (await summary.locator('.portal-calendar-defense-primary').innerText()).replace(/\s+/g, ' ').trim();
   if (/\(a confirmar\)/i.test(text)) throw Error(name + ': duplicate location suffix');
   if (pending && !/^14:00 \(aguardando confirmação\) · Educação em Saúde/.test(primary)) throw Error(name + ': waiting note must follow hour and precede title: ' + primary);
   tone = await summary.evaluate((element: HTMLElement) => ({background: getComputedStyle(element).backgroundColor, state: element.dataset.defenseState, lines: [...element.querySelectorAll(':scope > span')].map(line => ({text: line.textContent, color: getComputedStyle(line).color}))}));
   if (tone.lines.length !== 3) throw Error(name + ': expected hour/title, author and location');
   if (pending && tone.lines.some((line: any) => line.color !== red)) throw Error(name + ': every event line must be red: ' + JSON.stringify(tone));
   if (!pending && tone.lines.some((line: any) => line.color === red)) throw Error(name + ': confirmed event kept red text');
  }
  await calendar.screenshot({scale: 'css', path: `${directory}/${name}-calendario.png`});
  await defenses.screenshot({scale: 'css', path: `${directory}/${name}-lista.png`});

  if (present) {
   await summary.click();
   const popup = page.locator('#day-defenses-modal');
   await popup.waitFor();
   const card = popup.locator('.portal-calendar-day-defense');
   const popupNote = card.getByText(label, {exact: true});
   if (await popupNote.count() !== (pending ? 1 : 0)) throw Error(name + ': incorrect popup pending note');
   if (pending) {
    const timeText = (await popupNote.locator('..').innerText()).replace(/\s+/g, ' ').trim();
    if (timeText !== '14:00 às 15:30 (aguardando confirmação)') throw Error(name + ': popup note must follow time: ' + timeText);
    for (const target of [popupNote.locator('..'), card.locator('h4'), card.getByText(item.aluno1.nome, {exact: true}), card.getByText(item.defesa.local, {exact: true})]) {
     if (await target.evaluate((element: HTMLElement) => getComputedStyle(element).color) !== red) throw Error(name + ': popup event text is not red');
    }
   } else if (await card.locator('h4').evaluate((element: HTMLElement) => getComputedStyle(element).color) === red) throw Error(name + ': confirmed popup kept red text');
   await popup.screenshot({scale: 'css', path: `${directory}/${name}-detalhes-dia.png`});
   await popup.click({position: {x: 2, y: 2}});
   await popup.waitFor({state: 'detached'});
  }

  await page.getByRole('button', {name: 'Repositório', exact: true}).click();
  const repo = page.locator('[data-portal-sheet="repository"]');
  await repo.waitFor();
  await repo.locator('tbody tr').filter({hasText: code}).waitFor({timeout: 10000});
  if (await repo.locator('tbody tr').filter({hasText: code}).count() !== 1) throw Error(name + ': TCC disappeared from repository');
  if (await repo.getByText(label, {exact: true}).count() !== (pending ? 1 : 0)) throw Error(name + ': incorrect repository note');
  await repo.screenshot({scale: 'css', path: `${directory}/${name}-repositorio.png`});
  checks.push({name, onCalendar: present, pending, protocol: current.protocolo, receiptCount: publicRepositoryView(current).defesa.reservationReceiptCount, tone});
 }

 await inspect('01-pendente', true, true);
 current.defesa.localStatus = 'CONFIRMADO';
 await inspect('02-confirmado', true, false);
 current.defesa.localStatus = 'PENDENTE';
 current.defesa.departmentResponse = {revision: 0, decision: 'CONFIRMED', respondedAt: '2026-11-04T16:00:00Z', respondedBy: 'secretaria@example.invalid', startAt: item.defesa.startAt, endAt: item.defesa.endAt};
 await inspect('03-confirmado-campo-antigo-pendente', true, false);
 current.defesa.departmentResponse.decision = 'UNAVAILABLE';
 await inspect('04-recusado', false, false);
 const oldResponse = structuredClone(current.defesa.departmentResponse);
 current = structuredClone(item);
 current.defesa.reservationRevision = 1;
 current.defesa.startAt = '2026-11-06T17:00:00Z'; current.defesa.endAt = '2026-11-06T18:30:00Z';
 current.defesa.reservationHistory = [{...item.defesa, reservationRevision: 0, departmentResponse: oldResponse, invalidatedAt: '2026-11-04T16:00:00Z', invalidatedBy: 'author@example.invalid'}];
 if (!publicRepositoryView(current).defesa.hasReservationReceipt) throw Error('Historical receipt fixture was not projected');
 await inspect('05-nova-solicitacao-com-historico', true, true);
 current.defesa.departmentResponse = oldResponse;
 await inspect('06-resposta-anterior-nao-oculta-pendencia', true, true);

 // Keep an already open calendar popup synchronized with the server response.
 current = structuredClone(item);
 await page.goto(base + '/'); await page.getByRole('button', {name: 'Calendário', exact: true}).click();
 const pendingSummary = calendar.locator('.portal-calendar-defense-summary').filter({hasText: item.titulo});
 await pendingSummary.waitFor();
 await pendingSummary.screenshot({scale: 'device', path: `${directory}/evento-pendente-ampliado-4x.png`});
 await pendingSummary.click();
 const popup = page.locator('#day-defenses-modal'); await popup.waitFor();
 const popupNote = popup.getByText(label, {exact: true}); await popupNote.waitFor();
 current.defesa.localStatus = 'CONFIRMADO';
 await page.evaluate(() => window.dispatchEvent(new Event('portal:remote-data-changed')));
 await popupNote.waitFor({state: 'detached'});
 if (!await popup.isVisible()) throw Error('Acceptance closed the existing day popup');
 current.defesa.localStatus = 'PENDENTE'; current.defesa.departmentResponse = oldResponse;
 await page.evaluate(() => window.dispatchEvent(new Event('portal:remote-data-changed')));
 await popup.waitFor({state: 'detached'});
 if (checks[0].tone.background !== checks[1].tone.background) throw Error('Pending and confirmed future defenses changed background colors');
 if (errors.length || writes.length || external.length) throw Error(JSON.stringify({errors, writes, external}));
 await writeFile(`${directory}/verification.json`, JSON.stringify({localOnly: true, synthetic: true, productionWrites: false, openPopupRefresh: true, errors, writes, external, checks}, null, 2) + '\n');
 console.log(JSON.stringify({scenarios: checks.length, errors, writes, external, checks}));
} finally { await browser.close(); }
