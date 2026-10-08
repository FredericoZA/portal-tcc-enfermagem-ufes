import React, { useState } from 'react';
import { FilePlus } from 'lucide-react';
import { PortalModalShell } from './PortalModalShell';

interface NewFileModalProps {
  isOpen: boolean;
  currentFolder: string;
  onClose: () => void;
  onCreate: (filePath: string, initialContent: string) => void;
}

export const NewFileModal: React.FC<NewFileModalProps> = ({ isOpen, currentFolder, onClose, onCreate }) => {
  const [fileName, setFileName] = useState('');
  const [content, setContent] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fileName.trim()) return;
    const fullPath = currentFolder ? `${currentFolder}/${fileName.trim()}` : fileName.trim();
    onCreate(fullPath, content);
    setFileName('');
    setContent('');
    onClose();
  };

  return (
    <PortalModalShell open={isOpen} onClose={onClose} title="Criar novo arquivo" subtitle="Adicione um arquivo ao projeto" icon={FilePlus} maxWidthClass="max-w-md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <section className="portal-modal-card p-4">
          <label className="mb-1 block text-xs font-bold text-slate-700">Caminho / nome do arquivo</label>
          <div className="portal-modal-inner flex items-center overflow-hidden text-xs">
            <span className="border-r border-[var(--portal-border)] bg-[var(--portal-surface-card)] px-3 py-2 font-mono text-slate-600">
              {currentFolder ? `${currentFolder}/` : '/'}
            </span>
            <input autoFocus type="text" placeholder="ex: script.js, config.json, notas.txt" value={fileName} onChange={(e) => setFileName(e.target.value)} className="min-w-0 flex-1 bg-white px-3 py-2 font-mono text-slate-900 outline-none" />
          </div>
        </section>
        <section className="portal-modal-card p-4">
          <label className="mb-1 block text-xs font-bold text-slate-700">Conteúdo inicial (opcional)</label>
          <textarea rows={5} placeholder="// Insira seu código ou texto aqui..." value={content} onChange={(e) => setContent(e.target.value)} className="portal-input min-h-28 font-mono text-xs" />
        </section>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="portal-action">Cancelar</button>
          <button type="submit" disabled={!fileName.trim()} className="portal-action portal-action-primary disabled:opacity-50">Criar arquivo</button>
        </div>
      </form>
    </PortalModalShell>
  );
};
