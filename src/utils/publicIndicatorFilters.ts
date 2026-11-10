export type DisclosedIndicatorBucket = { label: string; count: number; key?: string };

export function disclosedMonthYears(items: DisclosedIndicatorBucket[]): string[] {
  return [...new Set(items.flatMap((item) => {
    const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(item.key || item.label);
    return match ? [match[1]] : [];
  }))].sort();
}

export function filterDisclosedMonths<T extends DisclosedIndicatorBucket>(items: T[], year: string): T[] {
  if (!disclosedMonthYears(items).includes(year)) return items;
  return items.filter((item) => (item.key || item.label).startsWith(`${year}-`));
}

export const disclosedBucketKey = (item: DisclosedIndicatorBucket) => item.key || item.label;

export function filterDisclosedPeriod<T extends DisclosedIndicatorBucket>(items: T[], period: string): T[] {
  return items.some((item) => disclosedBucketKey(item) === period)
    ? items.filter((item) => disclosedBucketKey(item) === period)
    : items;
}
