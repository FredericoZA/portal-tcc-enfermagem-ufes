import React, { useRef, useState } from 'react';

interface TableScrollWrapperProps {
  children: React.ReactNode;
}

export const TableScrollWrapper: React.FC<TableScrollWrapperProps> = ({ children }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isMouseDown, setIsMouseDown] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  // A tabela cresce naturalmente na vertical. O arraste continua exclusivamente
  // horizontal, evitando que “100/Todos” pareça não funcionar dentro de uma janela fixa.
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (
      target.tagName === 'INPUT' ||
      target.tagName === 'BUTTON' ||
      target.tagName === 'A' ||
      target.tagName === 'SELECT' ||
      target.closest('button') ||
      target.closest('input') ||
      target.closest('a') ||
      target.closest('select') ||
      target.closest('thead') ||
      target.closest('th')
    ) return;

    if (!containerRef.current || e.button !== 0) return;
    setIsMouseDown(true);
    setStartX(e.pageX - containerRef.current.offsetLeft);
    setScrollLeft(containerRef.current.scrollLeft);
  };

  const finishDrag = () => {
    setIsMouseDown(false);
    setIsDragging(false);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isMouseDown || !containerRef.current) return;
    const x = e.pageX - containerRef.current.offsetLeft;
    const walkX = (x - startX) * 1.5;
    if (Math.abs(walkX) > 5) {
      e.preventDefault();
      setIsDragging(true);
    }
    containerRef.current.scrollLeft = scrollLeft - walkX;
  };

  return (
    <div
      ref={containerRef}
      onMouseDown={handleMouseDown}
      onMouseLeave={finishDrag}
      onMouseUp={finishDrag}
      onMouseMove={handleMouseMove}
      className={`w-full bg-white overflow-x-auto overflow-y-visible table-sticky-container ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
    >
      <div className="min-w-max">
        {children}
      </div>
    </div>
  );
};
