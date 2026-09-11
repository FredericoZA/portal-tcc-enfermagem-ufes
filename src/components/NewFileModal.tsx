import React, { useState } from 'react';
import { X, FilePlus } from 'lucide-react';

interface NewFileModalProps {
  isOpen: boolean;
  currentFolder: string;
  onClose: () => void;
  onCreate: (filePath: string, initialContent: string) => void;
}

export const NewFileModal: React.FC<NewFileModalProps> = ({
  isOpen,
  currentFolder,
  onClose,
  onCreate,
}) => {
  const [fileName, setFileName] = useState('');
  const [content, setContent] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fileName.trim()) return;

    const fullPath = currentFolder 
      ? `${currentFolder}/${fileName.trim()}`
      : fileName.trim();

    onCreate(fullPath, content);
    setFileName('');
    setContent('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2 text-slate-100 font-semibold text-sm">
            <FilePlus className="w-5 h-5 text-emerald-400" />
            <span>Criar Novo Arquivo</span>
          </div>
          <button onClick={onClose} aria-label="Fechar criação de arquivo" className="p-1 text-slate-400 hover:text-slate-200">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">
              Caminho / Nome do Arquivo:
            </label>
            <div className="flex items-center rounded-xl bg-slate-800 border border-slate-700 overflow-hidden text-xs text-slate-300">
              <span className="px-3 py-2 text-slate-500 bg-slate-850 font-mono text-[11px] border-r border-slate-700">
                {currentFolder ? `${currentFolder}/` : '/'}
              </span>
              <input
                type="text"
                placeholder="ex: script.js, config.json, notas.txt"
                value={fileName}
                onChange={(e) => setFileName(e.target.value)}
                autoFocus
                className="flex-1 px-3 py-2 bg-transparent text-slate-100 focus:outline-none font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">
              Conteúdo Inicial (Opcional):
            </label>
            <textarea
              rows={5}
              placeholder="// Insira seu código ou texto aqui..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="w-full p-3 rounded-xl bg-slate-800 border border-slate-700 text-xs text-slate-100 font-mono focus:outline-none focus:border-blue-500"
            />
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
              disabled={!fileName.trim()}
              className="px-4 py-2 rounded-xl text-xs font-medium bg-emerald-600 hover:bg-emerald-500 text-white font-semibold disabled:opacity-50"
            >
              Criar Arquivo
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
