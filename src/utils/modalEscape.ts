type EscapeHandler = { onClose: () => void; closeOnEscape: boolean };
type ModalRegistry = { entries: Map<HTMLElement, EscapeHandler>; listener: (event: KeyboardEvent) => void };
const registries = new WeakMap<Document, ModalRegistry>();
const modalSelector = '[role="dialog"][aria-modal="true"], [role="alertdialog"][aria-modal="true"]';

function stackingOrder(element: HTMLElement): number[] {
  const order: number[] = [];
  for (let node: HTMLElement | null = element; node; node = node.parentElement) {
    const zIndex = node.ownerDocument.defaultView?.getComputedStyle(node).zIndex;
    if (zIndex && zIndex !== 'auto' && Number.isFinite(Number(zIndex))) order.unshift(Number(zIndex));
  }
  return order;
}

/** Uses the visible modal stack, including dialogs with their own keyboard handler (such as login). */
export function topmostModal(document: Document): HTMLElement | null {
  let top: HTMLElement | null = null;
  let topOrder: number[] = [];
  for (const element of document.querySelectorAll<HTMLElement>(modalSelector)) {
    const style = document.defaultView?.getComputedStyle(element);
    if (!element.getClientRects().length || style?.visibility === 'hidden' || style?.display === 'none') continue;
    const order = stackingOrder(element);
    let comparison = 0;
    for (let index = 0; index < Math.max(order.length, topOrder.length); index++) {
      comparison = (order[index] || 0) - (topOrder[index] || 0);
      if (comparison) break;
    }
    // Equal stacking contexts are painted in DOM order: the later dialog is on top.
    if (!top || comparison >= 0) { top = element; topOrder = order; }
  }
  return top;
}

/** One bubbling document listener runs after React handlers and before legacy window listeners. */
export function registerModalEscape(element: HTMLElement, onClose: () => void, closeOnEscape = true): () => void {
  const document = element.ownerDocument;
  let registry = registries.get(document);
  if (!registry) {
    const entries = new Map<HTMLElement, EscapeHandler>();
    const listener = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      const top = topmostModal(document);
      const handler = top && entries.get(top);
      if (!handler) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (handler.closeOnEscape) handler.onClose();
    };
    registry = { entries, listener };
    registries.set(document, registry);
    document.addEventListener('keydown', listener);
  }
  const handler = { onClose, closeOnEscape };
  registry.entries.set(element, handler);
  return () => {
    if (registry.entries.get(element) === handler) registry.entries.delete(element);
    if (!registry.entries.size) {
      document.removeEventListener('keydown', registry.listener);
      registries.delete(document);
    }
  };
}
