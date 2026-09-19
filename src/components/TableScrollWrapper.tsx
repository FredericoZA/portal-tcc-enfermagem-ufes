import React, { useRef, useState } from 'react';

interface TableScrollWrapperProps {
  children: React.ReactNode;
}

export const TableScrollWrapper: React.FC<TableScrollWrapperProps> = ({ children }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isMouseDown, setIsMouseDown] = useState(false);
  const [startX, setStartX] = useState(0);
  const [startY, setStartY] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [scrollTop, setScrollTop] = useState(0);
  const scrollParentRef = useRef<HTMLElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);


  const findVerticalScrollParent = (node: HTMLElement | null): HTMLElement | null => {
    let current = node?.parentElement || null;
    while (current) {
      const overflowY = window.getComputedStyle(current).overflowY;
      if ((overflowY === 'auto' || overflowY === 'scroll') && current.scrollHeight > current.clientHeight) return current;
      current = current.parentElement;
    }
    return document.scrollingElement as HTMLElement | null;
  };

  // A tabela cresce naturalmente; o arraste acompanha horizontalmente a tabela e verticalmente a página.
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
    setStartX(e.clientX);
    setStartY(e.clientY);
    setScrollLeft(containerRef.current.scrollLeft);
    scrollParentRef.current = findVerticalScrollParent(containerRef.current);
    setScrollTop(scrollParentRef.current?.scrollTop || 0);
  };

  const finishDrag = () => {
    setIsMouseDown(false);
    setIsDragging(false);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isMouseDown || !containerRef.current) return;
    const walkX = (e.clientX - startX) * 1.5;
    const walkY = (e.clientY - startY) * 1.15;
    if (Math.max(Math.abs(walkX), Math.abs(walkY)) > 5) {
      e.preventDefault();
      setIsDragging(true);
      containerRef.current.scrollLeft = scrollLeft - walkX;
      if (scrollParentRef.current) scrollParentRef.current.scrollTop = scrollTop - walkY;
    }
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
