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
  const [isDragging, setIsDragging] = useState(false);

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
    setScrollTop(containerRef.current.scrollTop);
  };

  const finishDrag = () => {
    setIsMouseDown(false);
    setIsDragging(false);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isMouseDown || !containerRef.current) return;
    const walkX = (e.clientX - startX) * 1.35;
    const walkY = (e.clientY - startY) * 1.15;
    if (Math.max(Math.abs(walkX), Math.abs(walkY)) > 5) {
      e.preventDefault();
      setIsDragging(true);
      containerRef.current.scrollLeft = scrollLeft - walkX;
      containerRef.current.scrollTop = scrollTop - walkY;
    }
  };

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    const container = containerRef.current;
    if (!container) return;

    const horizontalIntent = e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY);
    if (horizontalIntent && container.scrollWidth > container.clientWidth) {
      const delta = Math.abs(e.deltaX) > 0 ? e.deltaX : e.deltaY;
      const before = container.scrollLeft;
      container.scrollLeft += delta;
      if (container.scrollLeft !== before) e.preventDefault();
      return;
    }

    if (container.scrollHeight > container.clientHeight) {
      const before = container.scrollTop;
      container.scrollTop += e.deltaY;
      if (container.scrollTop !== before) e.preventDefault();
    }
  };

  return (
    <div
      ref={containerRef}
      onMouseDown={handleMouseDown}
      onMouseLeave={finishDrag}
      onMouseUp={finishDrag}
      onMouseMove={handleMouseMove}
      onWheel={handleWheel}
      className={`w-full bg-white overflow-auto table-sticky-container ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
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
