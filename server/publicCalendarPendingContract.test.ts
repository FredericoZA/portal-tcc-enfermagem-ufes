import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('calendário e lista leem projeção pública para visitantes e pessoas autenticadas', () => {
  const page = read('src/pages/HomePage.tsx');
  const api = read('src/services/apiClient.ts');
  const server = read('server.ts');
  assert.match(api, /getPublicCalendar:.*\/api\/public\/calendar/);
  assert.match(page, /const \[calendarProcesses, setCalendarProcesses\]/);
  assert.match(page, /const filteredProcesses = calendarProcesses\.filter/);
  assert.match(page, /apiClient\.getPublicCalendar\(\)/);
  const agenda = read('src/pages/AgendaPage.tsx');
  assert.match(agenda, /apiClient\.getPublicCalendar\(\)/);
  assert.match(agenda, /PORTAL_LIVE_UPDATE_EVENT/);
  assert.match(server, /app\.get\('\/api\/public\/calendar'.*filter\(isPublicCalendarDefense\)/);
});

test('solicitação pendente aparece clara e identificada na célula, no pop-up e na lista', () => {
  const page = read('src/pages/HomePage.tsx');
  const css = read('src/styles/portal-sheet.css');
  assert.match(page, /data-reservation-status=\{isPending \? 'pending' : 'confirmed'\}/);
  assert.match(page, /Aguardando confirmação do local — reserva provisória/);
  assert.match(page, /Aguardando confirmação<\/span>/);
  assert.match(css, /data-reservation-status="pending"/);
});

test('arquivo de agenda diferencia solicitação provisória de defesa confirmada', () => {
  const server = read('server.ts');
  assert.match(server, /STATUS:\$\{isDefenseReservationPending\(process\)\?'TENTATIVE':'CONFIRMED'\}/);
  assert.match(server, /processesStore\.filter\(isPublicCalendarDefense\)/);
});
