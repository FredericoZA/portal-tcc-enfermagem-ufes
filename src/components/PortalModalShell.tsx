import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';

interface PortalModalShellProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  icon?: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidthClass?: string;
  heightClass?: string;
  bodyClassName?: string;
  className?: string;
  labelledBy?: string;
  closeOnBackdrop?: boolean;
  closeOnEscape?: boolean;
  zIndexClass?: string;
}

/**
 * Shell visual canônico dos pop-ups do Portal.
 * Regra: cabeçalho verde full-width -> faixa branca -> corpo branco-gelo.
 * O fechamento visual por "X" não faz parte do padrão: use ESC, clique externo
 * e ações explícitas (Cancelar/Fechar) quando a operação precisar delas.
 */
export const PortalModalShell: React.FC<PortalModalShellProps> = ({
  open,
  onClose,
  title,
  subtitle,
  icon: Icon,
  children,
  footer,
  maxWidthClass = 'max-w-3xl',
  heightClass = '',
  bodyClassName = 'p-4',
  className = '',
  labelledBy,
  closeOnBackdrop = true,
  closeOnEscape = true,
  zIndexClass = 'z-[1000000]',
}) => {
  useEffect(() => {
    if (!open || !closeOnEscape) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, closeOnEscape, onClose]);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  }, [open]);

  if (!open) return null;
  const titleId = labelledBy || 'portal-modal-title';

  return createPortal(
    <div
      className={`portal-modal-backdrop fixed inset-0 ${zIndexClass} flex items-center justify-center overflow-y-auto p-2 sm:p-4`}
      onMouseDown={(event) => {
        if (closeOnBackdrop && event.target === event.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`portal-standard-modal portal-modal-surface flex w-full flex-col overflow-hidden ${maxWidthClass} ${heightClass} ${className}`}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="portal-modal-header shrink-0">
          {Icon && <Icon className="h-4 w-4 shrink-0 text-white" aria-hidden="true" />}
          <div className="min-w-0">
            <h2 id={titleId} className="truncate text-[13px] font-black uppercase tracking-wide text-white">{title}</h2>
            {subtitle && <p className="mt-0.5 truncate text-[10px] font-semibold text-white/85">{subtitle}</p>}
          </div>
        </header>
        <div className="portal-modal-divider shrink-0" aria-hidden="true" />
        <div className={`portal-modal-body min-h-0 overflow-y-auto ${bodyClassName}`}>{children}</div>
        {footer && <footer className="portal-modal-footer shrink-0">{footer}</footer>}
      </section>
    </div>,
    document.body
  );
};
