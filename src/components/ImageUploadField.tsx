import { portalNotice } from '../services/portalDialogs';
import React, { useRef, useState } from 'react';
import { Upload, Link, X, Image as ImageIcon, Check } from 'lucide-react';

export interface ImageUploadFieldProps {
  label: string;
  value: string;
  placeholder?: string;
  onChange: (val: string) => void;
  showPresets?: boolean;
  helpText?: string;
}

export const EMBLEM_PRESETS = [
  {
    id: 'generic_academic_emblem',
    name: 'Emblema acadêmico neutro',
    icon: '🏛️',
    url: '',
  }
];

export const ImageUploadField: React.FC<ImageUploadFieldProps> = ({
  label,
  value,
  placeholder,
  onChange,
  showPresets = true,
  helpText,
}) => {
  const [activeMode, setActiveMode] = useState<'upload' | 'url'>('upload');
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files[0]) {
      processFile(files[0]);
    }
  };

  const processFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      portalNotice('Por favor, selecione um arquivo de imagem válido (PNG, JPG, SVG, WEBP).');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        onChange(event.target.result as string);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  return (
    <div className="space-y-2 bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
      <div className="flex items-center justify-between">
        <label className="block text-[11px] font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
          <ImageIcon className="w-3.5 h-3.5 text-slate-700" />
          <span>{label}</span>
        </label>
        
        {/* Toggle between Upload and URL */}
        <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-[10px] font-bold">
          <button
            type="button"
            onClick={() => setActiveMode('upload')}
            className={`px-2 py-0.5 rounded-md flex items-center gap-1 transition-all cursor-pointer ${
              activeMode === 'upload'
                ? 'bg-white text-slate-900 shadow-2xs font-black'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Upload className="w-3 h-3" />
            <span>Arquivo</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveMode('url')}
            className={`px-2 py-0.5 rounded-md flex items-center gap-1 transition-all cursor-pointer ${
              activeMode === 'url'
                ? 'bg-white text-slate-900 shadow-2xs font-black'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Link className="w-3 h-3" />
            <span>Link / URL</span>
          </button>
        </div>
      </div>

      {helpText && (
        <p className="text-[10px] text-slate-500 font-medium">
          {helpText}
        </p>
      )}

      {/* Main Upload / URL Area */}
      {activeMode === 'upload' ? (
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/svg+xml,image/webp,image/gif"
            onChange={handleFileChange}
            className="hidden"
          />

          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-3 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-1.5 ${
              isDragging
                ? 'border-slate-800 bg-slate-100 ring-2 ring-slate-400'
                : 'border-slate-300 hover:border-slate-400 bg-slate-50 hover:bg-slate-100/80'
            }`}
          >
            <div className="p-2 rounded-full bg-white shadow-2xs border border-slate-200 text-slate-700">
              <Upload className="w-4 h-4" />
            </div>
            <div className="text-xs font-bold text-slate-800">
              Clique para escolher a imagem do seu computador
            </div>
            <div className="text-[10px] text-slate-500 font-medium">
              ou arraste e solte o arquivo PNG, JPG, SVG ou WEBP aqui
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-1">
          <input
            type="text"
            value={value || ''}
            placeholder={placeholder || 'https://instituicao.example/logo.png'}
            onChange={(e) => onChange(e.target.value)}
            className="w-full text-xs font-bold bg-white border border-slate-300 rounded-lg p-2.5 text-slate-900 shadow-2xs focus:border-slate-400 focus:ring-1 focus:ring-slate-400 transition-all"
          />
        </div>
      )}

      {/* Current Image Preview & Removal */}
      {value ? (
        <div className="flex items-center justify-between bg-slate-50 p-2 rounded-lg border border-slate-200">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-12 h-12 bg-white rounded-lg border border-slate-300 p-1 flex items-center justify-center shrink-0 overflow-hidden shadow-2xs">
              <img
                src={value}
                alt="Preview da imagem"
                className="w-full h-full object-contain"
              />
            </div>
            <div className="min-w-0 text-left">
              <div className="text-[11px] font-extrabold text-slate-800 flex items-center gap-1">
                <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span className="truncate">Imagem Carregada com Sucesso</span>
              </div>
              <div className="text-[9.5px] text-slate-500 font-mono truncate max-w-[200px] sm:max-w-xs">
                {value.startsWith('data:') ? 'Arquivo anexado do computador' : value}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onChange('')}
            className="px-2.5 py-1.5 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg flex items-center gap-1 transition-colors cursor-pointer shrink-0 shadow-2xs"
            title="Remover imagem e voltar ao emblema original"
          >
            <X className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Remover</span>
          </button>
        </div>
      ) : null}

      {/* Quick Emblem Presets */}
      {showPresets && (
        <div className="pt-2 border-t border-slate-100 space-y-1.5">
          <div className="text-[10px] font-black text-slate-600 uppercase tracking-wider">
            Ou use o emblema acadêmico neutro:
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
            {EMBLEM_PRESETS.map((preset) => {
              const isSelected = (!value && preset.url === '') || value === preset.url;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => onChange(preset.url)}
                  className={`p-1.5 rounded-lg border text-left text-[10px] font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-slate-900 text-white border-slate-900 shadow-2xs font-extrabold'
                      : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                  }`}
                >
                  <span className="text-xs shrink-0">{preset.icon}</span>
                  <span className="truncate">{preset.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
