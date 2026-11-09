/** Serialize writes to one account/table so restore cannot race an earlier save. */
const pending = new Map<string, Promise<unknown>>();
export function enqueueTablePreferenceWrite<T>(key: string, write: () => Promise<T>): Promise<T> {
  const previous = pending.get(key) || Promise.resolve();
  const result = previous.catch(() => undefined).then(write);
  pending.set(key, result);
  void result.finally(() => { if (pending.get(key) === result) pending.delete(key); }).catch(() => undefined);
  return result;
}
