import { useEffect } from 'react';

const MONTHS: Record<string, number> = {
  janeiro: 0,
  fevereiro: 1,
  'março': 2,
  marco: 2,
  abril: 3,
  maio: 4,
  junho: 5,
  julho: 6,
  agosto: 7,
  setembro: 8,
  outubro: 9,
  novembro: 10,
  dezembro: 11,
};

function removeHoverUtilityClasses(root: ParentNode = document) {
  root.querySelectorAll<HTMLElement>('#portal-app-root [class*="hover"]')
    .forEach((element) => {
      const removable = Array.from(element.classList).filter((token) => /(?:^|:)hover[:/]|group-hover[:/]|peer-hover[:/]/.test(token));
      if (removable.length) element.classList.remove(...removable);
    });
}

function getCalendarPeriod() {
  const title = Array.from(document.querySelectorAll<HTMLElement>('h1,h2,h3,div,span'))
    .map((node) => node.textContent || '')
    .find((text) => /CALENDÁRIO DE DEFESAS\s*[—-]/i.test(text));

  const match = title?.match(/CALENDÁRIO DE DEFESAS\s*[—-]\s*([A-ZÁÀÂÃÉÊÍÓÔÕÚÇ]+)\s+DE\s+(\d{4})/i);
  if (!match) return null;

  const month = MONTHS[match[1].toLocaleLowerCase('pt-BR')];
  const year = Number(match[2]);
  if (month === undefined || !year) return null;
  return { month, year };
}

function removeWeekendEvents(cell: HTMLElement) {
  cell.classList.add('portal1042-calendar-weekend');
  cell.setAttribute('aria-disabled', 'true');
  cell.setAttribute('title', 'Defesas de TCC não são agendadas aos sábados e domingos.');

  cell.querySelector('.portal-calendar-preview-list')?.remove();
  Array.from(cell.children).forEach((child, index) => {
    if (index === 0) return;
    if ((child.textContent || '').toLocaleUpperCase('pt-BR').includes('DEFESA')) child.remove();
  });
}

function bindCalendarPreviewClick(cell: HTMLElement) {
  cell.querySelectorAll<HTMLElement>('.portal-calendar-preview').forEach((preview) => {
    if (preview.dataset.portal1042ClickForward === 'true') return;
    preview.dataset.portal1042ClickForward = 'true';
    preview.setAttribute('role', 'button');
    preview.setAttribute('tabindex', '0');

    const openDay = (event: Event) => {
      event.preventDefault();
      event.stopPropagation();
      cell.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
    };

    preview.addEventListener('click', openDay);
    preview.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') openDay(event);
    });
  });
}

function refineCalendar() {
  const period = getCalendarPeriod();
  if (!period) return;

  document.querySelectorAll<HTMLElement>('.portal-calendar-day-cell').forEach((cell) => {
    const day = Number(cell.querySelector(':scope > div:first-child span')?.textContent?.trim() || cell.querySelector('span')?.textContent?.trim());
    if (!day) return;

    const weekday = new Date(period.year, period.month, day).getDay();
    const isWeekend = weekday === 0 || weekday === 6;

    if (isWeekend) {
      removeWeekendEvents(cell);
      return;
    }

    cell.classList.remove('portal1042-calendar-weekend');
    cell.removeAttribute('aria-disabled');
    bindCalendarPreviewClick(cell);
  });
}

function refineAll() {
  removeHoverUtilityClasses();
  refineCalendar();
}

export function PortalInteractionRefinementEnhancer() {
  useEffect(() => {
    let frame = 0;
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(refineAll);
    };

    refineAll();

    const observer = new MutationObserver(schedule);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'aria-pressed', 'data-selected'],
    });

    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, []);

  return null;
}
