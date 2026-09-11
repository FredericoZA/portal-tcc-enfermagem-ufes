import React, { useState } from 'react';
import { X, FolderPlus } from 'lucide-react';

interface NewFolderModalProps {
  isOpen: boolean;
  currentFolder: string;
  onClose: () => void;
  onCreate: (folderPath: string) => void;
}

export const NewFolderModal: React.FC<NewFolderModalProps> = ({
  isOpen,
  currentFolder,
  onClose,
  onCreate,
}) => {
  const [folderName, setFolderName] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!folderName.trim()) return;

    let fullPath = currentFolder 
      ? `${currentFolder}/${folderName.trim()}`
      : folderName.trim();

    if (!fullPath.endsWith('/')) {
      fullPath += '/';
    }

    onCreate(fullPath);
    setFolderName('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2 text-slate-100 font-semibold text-sm">
            <FolderPlus className="w-5 h-5 text-amber-400" />
            <span>Criar Nova Pasta</span>
          </div>
          <button onClick={onClose} aria-label="Fechar criação de pasta" className="p-1 text-slate-400 hover:text-slate-200">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">
              Nome da Pasta:
            </label>
            <div className="flex items-center rounded-xl bg-slate-800 border border-slate-700 overflow-hidden text-xs text-slate-300">
              <span className="px-3 py-2 text-slate-500 bg-slate-850 font-mono text-[11px] border-r border-slate-700">
                {currentFolder ? `${currentFolder}/` : '/'}
              </span>
              <input
                type="text"
                placeholder="ex: componentes, imagens, docs"
                value={folderName}
                onChange={(e) => setFolderName(e.target.value)}
                autoFocus
                className="flex-1 px-3 py-2 bg-transparent text-slate-100 focus:outline-none font-mono"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!folderName.trim()}
              className="px-4 py-2 rounded-xl text-xs font-medium bg-amber-600 hover:bg-amber-500 text-white font-semibold disabled:opacity-50"
            >
              Criar Pasta
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
