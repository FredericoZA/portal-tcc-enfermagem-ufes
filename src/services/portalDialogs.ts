export type PortalDialogOptions = { title?: string; confirmLabel?: string; cancelLabel?: string };

export type PortalDialog = {
  kind: 'notice' | 'confirm' | 'prompt';
  message: string;
  initialValue: string;
  title: string;
  confirmLabel: string;
  cancelLabel: string;
  resolve: (value: string | boolean | null) => void;
};

const queue: PortalDialog[] = [];
const listeners = new Set<() => void>();

const DEFAULT_COPY: Record<PortalDialog['kind'], { title: string; confirmLabel: string; cancelLabel: string }> = {
  notice: { title: 'Mensagem do portal', confirmLabel: 'Entendi', cancelLabel: '' },
  confirm: { title: 'Confirmar ação', confirmLabel: 'Confirmar', cancelLabel: 'Cancelar' },
  prompt: { title: 'Preencher informação', confirmLabel: 'Confirmar', cancelLabel: 'Cancelar' },
};

function request(kind: PortalDialog['kind'], message: unknown, initialValue = '', options: PortalDialogOptions = {}) {
  return new Promise<string | boolean | null>(resolve => {
    const defaults = DEFAULT_COPY[kind];
    queue.push({
      kind,
      message: String(message ?? ''),
      initialValue,
      title: options.title?.trim() || defaults.title,
      confirmLabel: options.confirmLabel?.trim() || defaults.confirmLabel,
      cancelLabel: options.cancelLabel?.trim() || defaults.cancelLabel,
      resolve,
    });
    listeners.forEach(listener => listener());
  });
}

export function portalNotice(message: unknown, options: PortalDialogOptions = {}): void {
  void request('notice', message, '', options);
}

export async function portalConfirm(message: unknown, options: PortalDialogOptions = {}): Promise<boolean> {
  return (await request('confirm', message, '', options)) === true;
}

export async function portalPrompt(message: unknown, initialValue = '', options: PortalDialogOptions = {}): Promise<string | null> {
  const value = await request('prompt', message, initialValue, options);
  return typeof value === 'string' ? value : null;
}

export function currentPortalDialog() { return queue[0] || null; }
export function subscribePortalDialogs(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }
export function finishPortalDialog(value: string | boolean | null) {
  const current = queue.shift();
  current?.resolve(value);
  listeners.forEach(listener => listener());
}
