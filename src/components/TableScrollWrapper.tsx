import React, { useRef } from 'react';
import { PortalSpreadsheetRuntime } from './PortalSpreadsheetRuntime';

interface TableScrollWrapperProps {
  children: React.ReactNode;
}

/**
 * Contêiner canônico das planilhas.
 * O comportamento de resize, filtros, sticky, paginação e arraste fica
 * restrito a este host, sem varredura global do aplicativo.
 */
export const TableScrollWrapper: React.FC<TableScrollWrapperProps> = ({ children }) => {
  const hostRef = useRef<HTMLDivElement>(null);

  return (
    <>
      <div
        ref={hostRef}
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
      <PortalSpreadsheetRuntime rootRef={hostRef} />
    </>
  );
};
