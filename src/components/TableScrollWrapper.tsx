import React from 'react';

interface TableScrollWrapperProps {
  children: React.ReactNode;
  fillHeight?: boolean;
}

/**
 * Contêiner estrutural das planilhas.
 * O comportamento de resize, filtros, sticky, paginação e arraste é aplicado
 * pelo único PortalSpreadsheetRuntime montado na raiz da aplicação.
 */
export const TableScrollWrapper: React.FC<TableScrollWrapperProps> = ({ children, fillHeight = false }) => {
  return (
    <div
        data-portal-scroll-host="true"
        className={`portal-spreadsheet-scroll-host table-sticky-container w-full overflow-auto ${fillHeight ? 'h-full min-h-0 flex-1' : ''}`}
        style={{
          maxHeight: fillHeight ? 'none' : 'min(68vh, 720px)',
          height: fillHeight ? '100%' : undefined,
          overscrollBehavior: 'contain',
          scrollbarGutter: 'stable both-edges',
          WebkitOverflowScrolling: 'touch',
        }}
      >
      <div className="min-w-max">
        {children}
      </div>
    </div>
  );
};
