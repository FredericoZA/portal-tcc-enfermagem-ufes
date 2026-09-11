import React, { useEffect, useState } from 'react';
import JSZip from 'jszip';
import { ZipItem } from '../types';
import { 
  formatBytes, 
  isImageFile, 
  isTextFile, 
  isAudioFile, 
  isVideoFile, 
  isPdfFile,
  downloadZipItem
} from '../utils/zipHelpers';
import { 
  Download, 
  Edit3, 
  Save, 
  X, 
  FileCode, 
  FileImage, 
  FileText, 
  Eye, 
  Sparkles, 
  Copy, 
  Check, 
  ZoomIn, 
  ZoomOut,
  Maximize2
} from 'lucide-react';

interface FileViewerProps {
  activeItem: ZipItem | null;
  zip: JSZip | null;
  onSaveFileContent: (path: string, newContent: string) => Promise<void>;
  onAnalyzeActiveFileWithAI: (content: string) => void;
  onClose: () => void;
}

export const FileViewer: React.FC<FileViewerProps> = ({
  activeItem,
  zip,
  onSaveFileContent,
  onAnalyzeActiveFileWithAI,
  onClose,
}) => {
  const [content, setContent] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [editValue, setEditValue] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);
  const [zoomLevel, setZoomLevel] = useState<number>(100);

  useEffect(() => {
    if (!activeItem || !zip || activeItem.dir) {
      setContent(null);
      setImageUrl(null);
      setMediaUrl(null);
      setIsEditing(false);
      return;
    }

    const loadContent = async () => {
      setLoading(true);
      try {
        const file = zip.file(activeItem.path);
        if (!file) {
          setContent('Arquivo não encontrado no ZIP.');
          setLoading(false);
          return;
        }

        const ext = activeItem.extension;

        if (isImageFile(ext)) {
          const blob = await file.async('blob');
          const url = URL.createObjectURL(blob);
          setImageUrl(url);
        } else if (isAudioFile(ext) || isVideoFile(ext)) {
          const blob = await file.async('blob');
          const url = URL.createObjectURL(blob);
          setMediaUrl(url);
        } else if (isTextFile(ext) || activeItem.size < 500000) {
          // Attempt text read for text files or small files
          const text = await file.async('string');
          setContent(text);
          setEditValue(text);
        } else {
          setContent(`[Arquivo binário ou muito grande para visualização de texto. Tamanho: ${formatBytes(activeItem.size)}]`);
        }
      } catch (err: any) {
        console.error('Error reading zip file content:', err);
        setContent('Erro ao ler conteúdo do arquivo.');
      } finally {
        setLoading(false);
      }
    };

    loadContent();

    return () => {
      if (imageUrl) URL.revokeObjectURL(imageUrl);
      if (mediaUrl) URL.revokeObjectURL(mediaUrl);
    };
  }, [activeItem, zip]);

  if (!activeItem) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-slate-950 text-slate-500 text-center">
        <div className="w-16 h-16 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-600 mb-4">
          <Eye className="w-8 h-8" />
        </div>
        <h3 className="text-base font-semibold text-slate-300">Nenhum arquivo selecionado</h3>
        <p className="text-xs text-slate-500 mt-1 max-w-sm">
          Selecione um arquivo da lista à esquerda para visualizar seu conteúdo, editar código, ver imagens ou analisar com IA.
        </p>
      </div>
    );
  }

  const handleCopy = () => {
    if (content) {
      navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleSave = async () => {
    if (activeItem) {
      await onSaveFileContent(activeItem.path, editValue);
      setContent(editValue);
      setIsEditing(false);
    }
  };

  const ext = activeItem.extension;

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-950 text-slate-200 min-w-0">
      {/* Top File Action Toolbar */}
      <div className="h-12 px-4 border-b border-slate-800 bg-slate-900 flex items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-mono text-xs px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 uppercase font-semibold">
            .{ext || 'FILE'}
          </span>
          <span className="font-semibold text-xs text-slate-100 truncate">
            {activeItem.name}
          </span>
          <span className="text-[11px] text-slate-500 hidden sm:inline">
            ({formatBytes(activeItem.size)})
          </span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {content !== null && isTextFile(ext) && (
            <>
              {!isEditing ? (
                <button
                  onClick={() => setIsEditing(true)}
                  className="px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors flex items-center gap-1"
                >
                  <Edit3 className="w-3.5 h-3.5 text-amber-400" />
                  <span className="hidden sm:inline">Editar</span>
                </button>
              ) : (
                <button
                  onClick={handleSave}
                  className="px-2.5 py-1 rounded-lg text-xs font-medium bg-emerald-600 hover:bg-emerald-500 text-white transition-colors flex items-center gap-1"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Salvar alterações</span>
                </button>
              )}

              <button
                onClick={handleCopy}
                className="px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors flex items-center gap-1"
                title="Copiar Código"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span className="hidden sm:inline">{copied ? 'Copiado' : 'Copiar'}</span>
              </button>

              <button
                onClick={() => onAnalyzeActiveFileWithAI(content || '')}
                className="px-2.5 py-1 rounded-lg text-xs font-medium bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/30 transition-colors flex items-center gap-1"
                title="Explicar arquivo com IA"
              >
                <Sparkles className="w-3.5 h-3.5 text-yellow-300" />
                <span className="hidden sm:inline">Explicar com IA</span>
              </button>
            </>
          )}

          <button
            onClick={() => zip && downloadZipItem(zip, activeItem.path, activeItem.name)}
            className="px-2.5 py-1 rounded-lg text-xs font-medium bg-blue-600 hover:bg-blue-500 text-white transition-colors flex items-center gap-1"
            title="Baixar apenas este arquivo"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Baixar</span>
          </button>

          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors ml-1"
            title="Fechar visualizador"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-auto p-4 flex flex-col justify-center">
        {loading ? (
          <div className="flex items-center justify-center p-12 text-slate-400 text-xs gap-2">
            <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            <span>Carregando arquivo...</span>
          </div>
        ) : imageUrl ? (
          /* Image Preview */
          <div className="flex-1 flex flex-col items-center justify-center space-y-4">
            <div className="flex items-center gap-2 bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-800 text-xs">
              <button
                onClick={() => setZoomLevel((z) => Math.max(30, z - 25))}
                className="p-1 text-slate-400 hover:text-slate-200"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <span className="font-mono text-slate-300">{zoomLevel}%</span>
              <button
                onClick={() => setZoomLevel((z) => Math.min(300, z + 25))}
                className="p-1 text-slate-400 hover:text-slate-200"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
            </div>
            <div className="max-w-full max-h-[70vh] overflow-auto p-4 bg-slate-900/50 rounded-xl border border-slate-800 flex items-center justify-center">
              <img
                src={imageUrl}
                alt={activeItem.name}
                style={{ width: `${zoomLevel}%`, maxWidth: 'none' }}
                className="object-contain rounded transition-all duration-150"
              />
            </div>
          </div>
        ) : mediaUrl ? (
          /* Audio / Video Player */
          <div className="flex-1 flex items-center justify-center p-6">
            {isAudioFile(ext) ? (
              <div className="w-full max-w-md p-6 rounded-2xl bg-slate-900 border border-slate-800 text-center space-y-4">
                <FileCode className="w-12 h-12 text-purple-400 mx-auto" />
                <p className="font-medium text-slate-200 text-sm">{activeItem.name}</p>
                <audio controls src={mediaUrl} className="w-full" />
              </div>
            ) : (
              <video controls src={mediaUrl} className="max-w-full max-h-[70vh] rounded-xl border border-slate-800" />
            )}
          </div>
        ) : isEditing ? (
          /* Text Edit Mode */
          <div className="flex-1 flex flex-col h-full">
            <textarea
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              className="flex-1 w-full p-4 font-mono text-xs bg-slate-900 text-slate-100 border border-slate-800 rounded-xl focus:outline-none focus:border-blue-500 resize-none leading-relaxed"
            />
          </div>
        ) : content !== null ? (
          /* Text / Code Viewer */
          <div className="flex-1 overflow-auto rounded-xl border border-slate-800 bg-slate-900/80 p-4 font-mono text-xs text-slate-200 leading-relaxed whitespace-pre-wrap break-all">
            {content}
          </div>
        ) : (
          <div className="text-center p-12 text-slate-500 text-xs">
            Formato de arquivo não suportado para visualização direta em texto.
          </div>
        )}
      </div>
    </div>
  );
};
