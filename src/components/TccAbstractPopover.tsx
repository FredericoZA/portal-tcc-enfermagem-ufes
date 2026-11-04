import React, { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { FileText, X } from 'lucide-react';

interface TccAbstractPopoverProps {
  summary?: string;
  processLabel: string;
  unavailableLabel?: string;
}

const ABSTRACT_OPEN_EVENT = 'portal:abstract-open';

/** Reads only the abstract already authorized by the list's API response. */
export const TccAbstractPopover: React.FC<TccAbstractPopoverProps> = ({
  summary,
  processLabel,
  unavailableLabel = 'Resumo não informado',
}) => {
  const text = summary?.trim() || '';
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const focusOnOpen = useRef(false);
  const popupId = useId();
  const headingId = `${popupId}-heading`;

  const cancelClose = () => {
    if (closeTimer.current !== null) clearTimeout(closeTimer.current);
    closeTimer.current = null;
  };
  const show = () => {
    cancelClose();
    if (text) {
      window.dispatchEvent(new CustomEvent(ABSTRACT_OPEN_EVENT, { detail: popupId }));
      setOpen(true);
    }
  };
  const close = () => {
    cancelClose();
    setOpen(false);
  };
  const closeAfterLeave = () => {
    cancelClose();
    // Allow the pointer to cross the small gap between the icon and the balloon.
    closeTimer.current = setTimeout(() => {
      closeTimer.current = null;
      const focused = document.activeElement;
      if (focused !== buttonRef.current && !popupRef.current?.contains(focused)) setOpen(false);
    }, 200);
  };
  const handleBlur = (event: React.FocusEvent) => {
    const next = event.relatedTarget as Node | null;
    if (next !== buttonRef.current && !popupRef.current?.contains(next)) closeAfterLeave();
  };

  useEffect(() => () => {
    if (closeTimer.current !== null) clearTimeout(closeTimer.current);
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const anchor = buttonRef.current?.getBoundingClientRect();
      const popup = popupRef.current;
      if (!anchor || !popup) return;
      const gutter = 12;
      const gap = 8;
      const { width, height } = popup.getBoundingClientRect();
      const below = window.innerHeight - anchor.bottom - gutter - gap;
      const above = anchor.top - gutter - gap;
      const top = below >= height || below >= above ? anchor.bottom + gap : anchor.top - gap - height;
      setPosition({
        left: Math.max(gutter, Math.min(anchor.left + anchor.width / 2 - width / 2, window.innerWidth - width - gutter)),
        top: Math.max(gutter, Math.min(top, window.innerHeight - height - gutter)),
      });
    };
    const dismiss = () => setOpen(false);
    const dismissFromViewport = () => {
      if (popupRef.current?.contains(document.activeElement)) buttonRef.current?.focus({ preventScroll: true });
      setOpen(false);
    };
    const onOtherAbstract = (event: Event) => {
      if ((event as CustomEvent<string>).detail !== popupId) dismiss();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.stopPropagation();
      if (popupRef.current?.contains(document.activeElement)) buttonRef.current?.focus({ preventScroll: true });
      setOpen(false);
    };
    const onOutsidePointer = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!buttonRef.current?.contains(target) && !popupRef.current?.contains(target)) dismiss();
    };
    const onScroll = (event: Event) => {
      if (!popupRef.current?.contains(event.target as Node)) dismissFromViewport();
    };
    place();
    if (focusOnOpen.current) {
      popupRef.current?.querySelector<HTMLElement>('.portal-abstract-content')?.focus({ preventScroll: true });
      focusOnOpen.current = false;
    }
    window.addEventListener(ABSTRACT_OPEN_EVENT, onOtherAbstract);
    document.addEventListener('pointerdown', onOutsidePointer);
    document.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('resize', dismissFromViewport);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      window.removeEventListener(ABSTRACT_OPEN_EVENT, onOtherAbstract);
      document.removeEventListener('pointerdown', onOutsidePointer);
      document.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('resize', dismissFromViewport);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [open, text, popupId]);

  if (!text) {
    return <span className="portal-abstract-unavailable" role="img" aria-label={unavailableLabel} title={unavailableLabel}>
      <FileText size={16} aria-hidden="true" />
    </span>;
  }

  return <>
    <button
      ref={buttonRef}
      type="button"
      className="portal-abstract-trigger"
      aria-label={`Ler resumo do TCC ${processLabel}`}
      aria-haspopup="dialog"
      aria-expanded={open}
      aria-controls={open ? popupId : undefined}
      onPointerEnter={(event) => { if (event.pointerType !== 'touch') show(); }}
      onPointerLeave={(event) => { if (event.pointerType !== 'touch') closeAfterLeave(); }}
      onFocus={show}
      onBlur={handleBlur}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => {
        event.stopPropagation();
        if (event.detail === 0) {
          focusOnOpen.current = true;
          const content = popupRef.current?.querySelector<HTMLElement>('.portal-abstract-content');
          if (content) {
            content.focus({ preventScroll: true });
            focusOnOpen.current = false;
          }
        }
        show();
      }}
    >
      <FileText size={17} aria-hidden="true" />
    </button>
    {open && createPortal(
      <div
        ref={popupRef}
        id={popupId}
        role="dialog"
        aria-modal="false"
        aria-labelledby={headingId}
        className="portal-abstract-popover"
        style={{ top: position.top, left: position.left }}
        onPointerEnter={cancelClose}
        onPointerLeave={closeAfterLeave}
        onFocus={cancelClose}
        onBlur={handleBlur}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="portal-abstract-heading">
          <div>
            <strong id={headingId}>Resumo do TCC</strong>
            <span>{processLabel}</span>
          </div>
          <button type="button" className="portal-abstract-close" aria-label="Fechar resumo" onClick={() => {
            buttonRef.current?.focus({ preventScroll: true });
            close();
          }}><X size={16} aria-hidden="true" /></button>
        </div>
        <div className="portal-abstract-content" tabIndex={0} role="region" aria-label="Texto completo do resumo">{text}</div>
      </div>,
      document.body,
    )}
  </>;
};
