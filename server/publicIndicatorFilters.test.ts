import assert from 'node:assert/strict';
import test from 'node:test';
import { disclosedMonthYears, filterDisclosedMonths, filterDisclosedPeriod } from '../src/utils/publicIndicatorFilters';

test('year selection preserves disclosed months and gaps without synthesizing zero buckets', () => {
  const items = [{key:'2025-03',label:'mar de 2025',count:3},{key:'2025-08',label:'ago de 2025',count:4},{key:'2026-01',label:'jan de 2026',count:5}];
  assert.deepEqual(disclosedMonthYears(items), ['2025','2026']);
  assert.deepEqual(filterDisclosedMonths(items,'2025'), items.slice(0,2));
  assert.equal(filterDisclosedMonths(items,'2024'), items);
  assert.equal(filterDisclosedMonths(items,''), items);
  assert.equal(items.length,3);
});

test('period selection can only reveal existing disclosed buckets and preserves original counts', () => {
  const items = [{key:'2026-1',label:'2026-1',count:6},{key:'unknown',label:'Não informado',count:10}];
  assert.deepEqual(filterDisclosedPeriod(items,'2026-1'), [items[0]]);
  assert.deepEqual(filterDisclosedPeriod(items,'unknown'), [items[1]]);
  assert.equal(filterDisclosedPeriod(items,'2026-2'),items);
  assert.equal(filterDisclosedPeriod(items,''),items);
  assert.equal(items[1].count,10);
});
