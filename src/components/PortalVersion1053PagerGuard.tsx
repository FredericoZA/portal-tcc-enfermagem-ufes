import { useEffect } from 'react';

function patchPager(pager: HTMLElement) {
  const target = pager as HTMLElement & {
    __portalV53PagerGuard?: boolean;
    replaceChildren: (...nodes: (Node | string)[]) => void;
    appendChild: <T extends Node>(node: T) => T;
  };
  if (target.__portalV53PagerGuard) return;
  target.__portalV53PagerGuard = true;
  pager.dataset.portalV53PagerGuard = 'true';

  const nativeReplaceChildren = target.replaceChildren.bind(target);
  const nativeAppendChild = target.appendChild.bind(target);
  let buffering = false;
  let buffer: Node[] = [];
  let scheduled = false;

  const commit = () => {
    scheduled = false;
    if (!buffering) return;
    buffering = false;

    const staging = document.createElement('div');
    buffer.forEach((node) => staging.appendChild(node));
    buffer = [];

    if (staging.innerHTML === pager.innerHTML) return;
    nativeReplaceChildren(...Array.from(staging.childNodes));
  };

  const scheduleCommit = () => {
    if (scheduled) return;
    scheduled = true;
    queueMicrotask(commit);
  };

  target.replaceChildren = ((...nodes: (Node | string)[]) => {
    if (nodes.length > 0) {
      buffering = false;
      buffer = [];
      nativeReplaceChildren(...nodes);
      return;
    }
    buffering = true;
    buffer = [];
    scheduleCommit();
  }) as typeof target.replaceChildren;

  target.appendChild = ((node: Node) => {
    if (!buffering) return nativeAppendChild(node);
    buffer.push(node);
    scheduleCommit();
    return node;
  }) as typeof target.appendChild;
}

function patchAllPagers() {
  document.querySelectorAll<HTMLElement>('.portal-v52-pager').forEach(patchPager);
}

export function PortalVersion1053PagerGuard() {
  useEffect(() => {
    patchAllPagers();
    const observer = new MutationObserver(patchAllPagers);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);
  return null;
}
