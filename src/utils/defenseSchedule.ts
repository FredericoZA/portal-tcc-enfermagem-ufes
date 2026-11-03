/** Every defense reserves exactly 1h30 in the agenda, independently of document dates. */
export const DEFENSE_DURATION_MINUTES = 90;
export function defenseEndAt(startAt:string):string {
  return new Date(Date.parse(startAt)+DEFENSE_DURATION_MINUTES*60_000).toISOString();
}
