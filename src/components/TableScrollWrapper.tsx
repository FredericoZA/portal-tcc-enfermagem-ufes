import React from 'react';

interface TableScrollWrapperProps {
  children: React.ReactNode;
}

/**
 * Contêiner estrutural das planilhas.
 * O comportamento de resize, filtros, sticky, paginação e arraste é aplicado
 * pelo único PortalSpreadsheetRuntime montado na raiz da aplicação.
 */
export const TableScrollWrapper: React.FC<TableScrollWrapperProps> = ({ children }) => {
  return (
    <div
        data-portal-scroll-host="true"
        className="portal-spreadsheet-scroll-host table-sticky-container w-full overflow-auto bg-white"
        style={{
          maxHeight: 'min(68vh, 720px)',
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
