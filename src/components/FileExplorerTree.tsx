import React, { useState } from 'react';
import { ZipItem } from '../types';
import { formatBytes, isImageFile, isTextFile, isAudioFile, isVideoFile, isPdfFile } from '../utils/zipHelpers';
import { 
  Folder, 
  FolderOpen, 
  FileText, 
  FileCode, 
  FileImage, 
  FileAudio, 
  FileVideo, 
  File, 
  Search, 
  Download, 
  Trash2, 
  ChevronRight, 
  ChevronDown,
  ArrowUpDown,
  CheckSquare,
  Square
} from 'lucide-react';

interface FileExplorerTreeProps {
  items: ZipItem[];
  currentFolder: string;
  selectedPath: string | null;
  onSelectFile: (item: ZipItem) => void;
  onNavigateFolder: (path: string) => void;
  onDeleteFile: (path: string) => void;
  onExtractFile: (path: string, filename: string) => void;
}

export const FileExplorerTree: React.FC<FileExplorerTreeProps> = ({
  items,
  currentFolder,
  selectedPath,
  onSelectFile,
  onNavigateFolder,
  onDeleteFile,
  onExtractFile,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'size' | 'type'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Filter items in current folder or matching search query
  const filteredItems = items.filter((item) => {
    if (searchQuery.trim()) {
      return item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
             item.path.toLowerCase().includes(searchQuery.toLowerCase());
    }
    // Direct child of currentFolder
    return item.parentPath === currentFolder;
  });

  // Sort items: folders first, then sorted by chosen field
  const sortedItems = [...filteredItems].sort((a, b) => {
    if (a.dir !== b.dir) return a.dir ? -1 : 1;

    let res = 0;
    if (sortBy === 'name') {
      res = a.name.localeCompare(b.name);
    } else if (sortBy === 'size') {
      res = a.size - b.size;
    } else if (sortBy === 'type') {
      res = (a.extension || '').localeCompare(b.extension || '');
    }
    return sortOrder === 'asc' ? res : -res;
  });

  const toggleSort = (field: 'name' | 'size' | 'type') => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
  };

  const getFileIcon = (item: ZipItem) => {
    if (item.dir) {
      return item.path === currentFolder 
        ? <FolderOpen className="w-4 h-4 text-amber-400 shrink-0" />
        : <Folder className="w-4 h-4 text-amber-400 shrink-0" />;
    }
    const ext = item.extension;
    if (isImageFile(ext)) return <FileImage className="w-4 h-4 text-emerald-400 shrink-0" />;
    if (isTextFile(ext)) return <FileCode className="w-4 h-4 text-cyan-400 shrink-0" />;
    if (isAudioFile(ext)) return <FileAudio className="w-4 h-4 text-purple-400 shrink-0" />;
    if (isVideoFile(ext)) return <FileVideo className="w-4 h-4 text-rose-400 shrink-0" />;
    if (isPdfFile(ext)) return <FileText className="w-4 h-4 text-red-400 shrink-0" />;
    return <File className="w-4 h-4 text-slate-400 shrink-0" />;
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 text-slate-200 border-r border-slate-800">
      {/* Search Bar & Header controls */}
      <div className="p-3 border-b border-slate-800 space-y-2">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
          <input
            type="text"
            placeholder="Buscar arquivos no .ZIP..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
          />
        </div>

        {/* Sort Controls */}
        <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
          <span>Ordenar por:</span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => toggleSort('name')}
              className={`px-1.5 py-0.5 rounded ${sortBy === 'name' ? 'bg-blue-500/20 text-blue-400' : 'hover:bg-slate-800'}`}
            >
              Nome
            </button>
            <button
              onClick={() => toggleSort('size')}
              className={`px-1.5 py-0.5 rounded ${sortBy === 'size' ? 'bg-blue-500/20 text-blue-400' : 'hover:bg-slate-800'}`}
            >
              Tamanho
            </button>
            <button
              onClick={() => toggleSort('type')}
              className={`px-1.5 py-0.5 rounded ${sortBy === 'type' ? 'bg-blue-500/20 text-blue-400' : 'hover:bg-slate-800'}`}
            >
              Tipo
            </button>
          </div>
        </div>
      </div>

      {/* Item List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {/* Parent folder navigation button if deep in subfolders */}
        {!searchQuery && currentFolder && (
          <button
            onClick={() => {
              const parts = currentFolder.split('/');
              parts.pop();
              onNavigateFolder(parts.join('/'));
            }}
            className="w-full text-left px-3 py-2 rounded-lg text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800 flex items-center gap-2 border border-dashed border-slate-800 hover:border-slate-700 transition-colors"
          >
            <FolderOpen className="w-4 h-4 text-amber-400/80" />
            <span>.. (Voltar para pasta anterior)</span>
          </button>
        )}

        {sortedItems.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500">
            {searchQuery ? 'Nenhum arquivo encontrado com esse filtro.' : 'Esta pasta está vazia.'}
          </div>
        ) : (
          sortedItems.map((item) => {
            const isSelected = selectedPath === item.path;

            return (
              <div
                key={item.path}
                onClick={() => {
                  if (item.dir) {
                    onNavigateFolder(item.path);
                  } else {
                    onSelectFile(item);
                  }
                }}
                className={`group flex items-center justify-between px-3 py-2 rounded-lg text-xs cursor-pointer transition-all ${
                  isSelected
                    ? 'bg-blue-600/20 text-blue-300 font-medium border border-blue-500/30 shadow-sm'
                    : 'text-slate-300 hover:bg-slate-800/80 hover:text-slate-100'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0 pr-2">
                  {getFileIcon(item)}
                  <span className="truncate">{item.name}</span>
                </div>

                <div className="flex items-center gap-2 text-slate-500 shrink-0">
                  {!item.dir && (
                    <span className="text-[10px] text-slate-400 font-mono">
                      {formatBytes(item.size)}
                    </span>
                  )}

                  {/* Actions on hover */}
                  <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity">
                    {!item.dir && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onExtractFile(item.path, item.name);
                        }}
                        className="p-1 rounded hover:bg-slate-700 text-slate-300 hover:text-blue-400 transition-colors"
                        title="Baixar arquivo individual"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteFile(item.path);
                      }}
                      className="p-1 rounded hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition-colors"
                      title="Excluir arquivo do ZIP"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
