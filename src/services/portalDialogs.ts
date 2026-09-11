export type PortalDialog = { kind: 'notice' | 'confirm' | 'prompt'; message: string; initialValue: string; resolve: (value: string | boolean | null) => void };
const queue: PortalDialog[] = [];
const listeners = new Set<() => void>();
function request(kind: PortalDialog['kind'], message: unknown, initialValue = '') {
  return new Promise<string | boolean | null>(resolve => {
    queue.push({ kind, message: String(message ?? ''), initialValue, resolve });
    listeners.forEach(listener => listener());
  });
}
export function portalNotice(message: unknown): void { void request('notice', message); }
export async function portalConfirm(message: unknown): Promise<boolean> { return (await request('confirm', message)) === true; }
export async function portalPrompt(message: unknown, initialValue = ''): Promise<string | null> {
  const value = await request('prompt', message, initialValue);
  return typeof value === 'string' ? value : null;
}
export function currentPortalDialog() { return queue[0] || null; }
export function subscribePortalDialogs(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }
export function finishPortalDialog(value: string | boolean | null) {
  const current = queue.shift();
  current?.resolve(value);
  listeners.forEach(listener => listener());
}
