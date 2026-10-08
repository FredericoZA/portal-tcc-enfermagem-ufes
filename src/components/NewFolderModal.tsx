import React, { useState } from 'react';
import { FolderPlus } from 'lucide-react';
import { PortalModalShell } from './PortalModalShell';

interface NewFolderModalProps {
  isOpen: boolean;
  currentFolder: string;
  onClose: () => void;
  onCreate: (folderPath: string) => void;
}

export const NewFolderModal: React.FC<NewFolderModalProps> = ({ isOpen, currentFolder, onClose, onCreate }) => {
  const [folderName, setFolderName] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!folderName.trim()) return;
    let fullPath = currentFolder ? `${currentFolder}/${folderName.trim()}` : folderName.trim();
    if (!fullPath.endsWith('/')) fullPath += '/';
    onCreate(fullPath);
    setFolderName('');
    onClose();
  };

  return (
    <PortalModalShell open={isOpen} onClose={onClose} title="Criar nova pasta" subtitle="Organize os arquivos do projeto" icon={FolderPlus} maxWidthClass="max-w-md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <section className="portal-modal-card p-4">
          <label className="mb-1 block text-xs font-bold text-slate-700">Nome da pasta</label>
          <div className="portal-modal-inner flex items-center overflow-hidden text-xs">
            <span className="border-r border-[var(--portal-border)] bg-[var(--portal-surface-card)] px-3 py-2 font-mono text-slate-600">
              {currentFolder ? `${currentFolder}/` : '/'}
            </span>
            <input autoFocus type="text" placeholder="ex: componentes, imagens, docs" value={folderName} onChange={(e) => setFolderName(e.target.value)} className="min-w-0 flex-1 bg-white px-3 py-2 font-mono text-slate-900 outline-none" />
          </div>
        </section>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="portal-action">Cancelar</button>
          <button type="submit" disabled={!folderName.trim()} className="portal-action portal-action-primary disabled:opacity-50">Criar pasta</button>
        </div>
      </form>
    </PortalModalShell>
  );
};
