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

/** Keep keyboard navigation in the topmost modal; a native top-layer dialog takes precedence. */
export function containModalTab(element:HTMLElement,event:KeyboardEvent):void {
  if(event.key!=='Tab'||event.defaultPrevented)return;
  const document=element.ownerDocument;
  let nativeModal:Element|null=null;
  try{nativeModal=document.querySelector('dialog:modal');}catch{nativeModal=document.querySelector('dialog[open]');}
  if(nativeModal?nativeModal!==element:topmostModal(document)!==element)return;
  const selector='a[href],area[href],summary,button,input:not([type="hidden"]),select,textarea,iframe,object,embed,[contenteditable]:not([contenteditable="false"]),[tabindex]';
  const targets=Array.from(element.querySelectorAll<HTMLElement>(selector)).filter(target=>{
    if((target.tabIndex<0&&(!target.isContentEditable||target.hasAttribute('tabindex')))||target.matches(':disabled')||target.closest('[hidden],[inert],[aria-hidden="true"]')||!target.getClientRects().length)return false;
    const style=document.defaultView?.getComputedStyle(target);
    const closedDetails=target.closest('details:not([open])');
    return style?.visibility!=='hidden'&&style?.display!=='none'&&(!closedDetails||closedDetails.querySelector('summary')===target);
  }).filter((target,_,candidates)=>{
    if(target.tagName!=='INPUT'||(target as HTMLInputElement).type!=='radio'||!(target as HTMLInputElement).name)return true;
    const radio=target as HTMLInputElement;
    const group=candidates.filter((item):item is HTMLInputElement=>item.tagName==='INPUT'&&(item as HTMLInputElement).type==='radio'&&(item as HTMLInputElement).name===radio.name&&(item as HTMLInputElement).form===radio.form&&item.getRootNode()===radio.getRootNode());
    return target===(group.find(item=>item.checked)||group[0]);
  }).map((target,index)=>({target,index})).sort((a,b)=>{
    const order=(target:HTMLElement)=>target.tabIndex>0?target.tabIndex:Number.MAX_SAFE_INTEGER;
    return order(a.target)-order(b.target)||a.index-b.index;
  }).map(item=>item.target);
  const active=document.activeElement;
  const first=targets[0],last=targets.at(-1);
  const destination=!first?element:!element.contains(active)?event.shiftKey?last:first
    :event.shiftKey&&(active===first||active===element)?last:!event.shiftKey&&active===last?first:undefined;
  if(!destination)return;
  event.preventDefault();event.stopImmediatePropagation();destination.focus({preventScroll:true});
}

/** One bubbling document listener runs after React handlers and before legacy window listeners. */
export function registerModalEscape(element: HTMLElement, onClose: () => void, closeOnEscape = true): () => void {
  const document = element.ownerDocument;
  let registry = registries.get(document);
  if (!registry) {
    const entries = new Map<HTMLElement, EscapeHandler>();
    const listener = (event: KeyboardEvent) => {
      if(event.key==='Tab'&&!event.defaultPrevented){const top=topmostModal(document);if(top&&entries.has(top))containModalTab(top,event);return;}
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
