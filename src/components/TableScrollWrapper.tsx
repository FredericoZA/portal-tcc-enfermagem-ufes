import React from 'react';

interface TableScrollWrapperProps {
  children: React.ReactNode;
}

/**
 * Contêiner canônico das planilhas. Toda interação de roda/arraste e sticky
 * é tratada pelo PortalSpreadsheetRuntime, sem camadas versionadas concorrentes.
 */
export const TableScrollWrapper: React.FC<TableScrollWrapperProps> = ({ children }) => (
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
