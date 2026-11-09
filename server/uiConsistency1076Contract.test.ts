import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('calendário público mantém dias semanais e acrescenta fins de semana com defesas', () => {
  const home = read('src/pages/HomePage.tsx');

  assert.match(home, /buildCalendarMonthGrid\(year,month,calendarStarts\)/);
  assert.match(home, /calendarGrid\.weekdays/);
  assert.match(home, /const firstCalendarDayOffset/);
  assert.match(home, /const trailingCalendarDayCells/);
  assert.match(home, /gridTemplateColumns:calendarGrid\.gridTemplateColumns/);
  assert.match(home, /CALENDAR_WEEKDAY_LABELS\[day\]/);
  assert.doesNotMatch(home, /<div>DOM<\/div>|<div>SÁB<\/div>|portal-core-calendar-weekend/);
  assert.match(home, /calendarDays\.map\(\(dayNum, idx\)/);
});

test('número do dia não fica menor que o cabeçalho semanal', () => {
  const home = read('src/pages/HomePage.tsx');
  const css = read('src/styles/portal-components.css');

  assert.match(home, /portal-calendar-day-number/);
  assert.match(css, /\.portal-calendar-day-number \{[\s\S]*font-size: var\(--portal-type-content\)/);
});

test('título da seção de cadastro fica dentro do cartão', () => {
  const registration = read('src/components/ConfigurableRegistration.tsx');
  const css = read('src/styles/portal-components.css');

  assert.match(registration, /<legend className="sr-only">\{sections\[currentSection\]\}<\/legend>/);
  assert.match(registration, /<h2 className="portal-registration-section-title sm:col-span-2">\{sections\[currentSection\]==='Segundo autor'\?'Autoria nos documentos':sections\[currentSection\]\}<\/h2>/);
  assert.doesNotMatch(registration, /<legend className="px-2 text-lg font-bold">/);
  assert.match(css, /\.portal-registration-section-title \{[\s\S]*grid-column: 1 \/ -1/);
});

test('release consolidada foi avançada sem regredir o contrato 1.0.76', () => {
  assert.equal(JSON.parse(read('package.json')).version, '1.0.79');
});
