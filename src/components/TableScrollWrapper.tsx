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

  // Mouse drag-to-scroll implementation for intuitive spreadsheet navigation
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    // Only initiate drag if left clicking and not clicking on interactive elements
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
    ) {
      return;
    }

    if (!containerRef.current) return;
    setIsMouseDown(true);
    setStartX(e.pageX - containerRef.current.offsetLeft);
    setStartY(e.pageY - containerRef.current.offsetTop);
    setScrollLeft(containerRef.current.scrollLeft);
    setScrollTop(containerRef.current.scrollTop);
  };

  const handleMouseLeave = () => {
    setIsMouseDown(false);
    setIsDragging(false);
  };

  const handleMouseUp = () => {
    setIsMouseDown(false);
    setIsDragging(false);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isMouseDown || !containerRef.current) return;
    e.preventDefault();
    const x = e.pageX - containerRef.current.offsetLeft;
    const y = e.pageY - containerRef.current.offsetTop;
    const walkX = (x - startX) * 1.5; // Scroll speed multiplier
    const walkY = (y - startY) * 1.5;
    
    if (Math.abs(walkX) > 5 || Math.abs(walkY) > 5) {
      setIsDragging(true);
    }

    containerRef.current.scrollLeft = scrollLeft - walkX;
    containerRef.current.scrollTop = scrollTop - walkY;
  };

  return (
    <div 
      ref={containerRef}
      onMouseDown={handleMouseDown}
      onMouseLeave={handleMouseLeave}
      onMouseUp={handleMouseUp}
      onMouseMove={handleMouseMove}
      className={`w-full bg-white overflow-x-auto overflow-y-auto max-h-[620px] table-sticky-container ${
        isDragging ? 'cursor-grabbing' : 'cursor-grab'
      }`}
    >
      <div className="min-w-max">
        {children}
      </div>
    </div>
  );
};
