import React from 'react';

interface TableScrollWrapperProps {
  children: React.ReactNode;
}

/**
 * Contêiner tabular único. A interação de roda/arraste e o sticky são tratados
 * pela camada estrutural global para que todas as planilhas tenham exatamente
 * o mesmo comportamento, inclusive dentro dos popups de Configurações.
 */
export const TableScrollWrapper: React.FC<TableScrollWrapperProps> = ({ children }) => (
  <div
    data-portal-scroll-host="true"
    className="portal-v53-scroll-host table-sticky-container w-full overflow-auto bg-white"
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
