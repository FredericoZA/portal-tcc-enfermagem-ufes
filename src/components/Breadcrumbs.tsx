import React from 'react';
import { ChevronRight, Home, Folder } from 'lucide-react';
import { Breadcrumb } from '../types';

interface BreadcrumbsProps {
  currentPath: string;
  onNavigate: (path: string) => void;
}

export const Breadcrumbs: React.FC<BreadcrumbsProps> = ({ currentPath, onNavigate }) => {
  const parts = currentPath ? currentPath.split('/').filter(Boolean) : [];

  const breadcrumbs: Breadcrumb[] = [
    { name: 'Raiz do ZIP', path: '' },
    ...parts.map((part, index) => ({
      name: part,
      path: parts.slice(0, index + 1).join('/'),
    })),
  ];

  return (
    <nav className="flex items-center space-x-1 py-2 px-4 bg-slate-900/90 border-b border-slate-800 text-xs overflow-x-auto whitespace-nowrap scrollbar-none">
      {breadcrumbs.map((crumb, idx) => {
        const isLast = idx === breadcrumbs.length - 1;
        return (
          <React.Fragment key={crumb.path || 'root'}>
            {idx > 0 && <ChevronRight className="w-3.5 h-3.5 text-slate-600 shrink-0 mx-0.5" />}
            <button
              onClick={() => onNavigate(crumb.path)}
              className={`flex items-center gap-1 px-2 py-1 rounded-md transition-colors ${
                isLast
                  ? 'font-semibold text-blue-400 bg-blue-500/10 border border-blue-500/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              {idx === 0 ? (
                <Home className="w-3.5 h-3.5" />
              ) : (
                <Folder className="w-3.5 h-3.5 text-amber-400" />
              )}
              <span>{crumb.name}</span>
            </button>
          </React.Fragment>
        );
      })}
    </nav>
  );
};
