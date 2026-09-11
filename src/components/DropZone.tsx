import React, { useRef, useState } from 'react';
import { Archive, Upload, FileCode2, FileText, Sparkles, FolderArchive, ArrowRight, CheckCircle2 } from 'lucide-react';

interface DropZoneProps {
  onFileSelect: (file: File) => void;
  onLoadSample: (type: 'react' | 'docs') => void;
  isLoading: boolean;
}

export const DropZone: React.FC<DropZoneProps> = ({ onFileSelect, onLoadSample, isLoading }) => {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      onFileSelect(file);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onFileSelect(e.target.files[0]);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      {/* Hero Welcome Banner */}
      <div className="text-center mb-10">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 text-xs font-semibold mb-4">
          <Sparkles className="w-3.5 h-3.5 text-blue-400" />
          <span>Pronto para receber seu arquivo .ZIP</span>
        </div>
        <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-100 tracking-tight">
          Extraia, Visualize e Gerencie Pacotes Compactados
        </h2>
        <p className="mt-3 text-base text-slate-400 max-w-2xl mx-auto">
          Arraste e solte o seu arquivo compactado (.ZIP) abaixo para explorar a estrutura de pastas,
          visualizar códigos, imagens e documentos, ou editar e re-compactar em segundos.
        </p>
      </div>

      {/* Main Drag & Drop Box */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`relative border-2 border-dashed rounded-2xl p-10 sm:p-14 text-center cursor-pointer transition-all duration-300 group ${
          isDragging
            ? 'border-blue-500 bg-blue-500/10 scale-[1.01]'
            : 'border-slate-700 bg-slate-900/60 hover:border-slate-500 hover:bg-slate-900/80'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".zip,.rar,.7z,.tar,.gz"
          onChange={handleInputChange}
          className="hidden"
        />

        <div className="w-20 h-20 mx-auto rounded-3xl bg-slate-800 border border-slate-700 flex items-center justify-center text-blue-400 group-hover:scale-110 group-hover:border-blue-500/50 group-hover:text-blue-300 transition-all duration-300 shadow-xl">
          {isLoading ? (
            <Archive className="w-10 h-10 animate-bounce text-blue-400" />
          ) : (
            <Upload className="w-10 h-10 text-blue-400 group-hover:text-blue-300" />
          )}
        </div>

        <div className="mt-6">
          <p className="text-lg font-semibold text-slate-200">
            {isLoading ? 'Descomprimindo o arquivo...' : 'Arraste e solte o arquivo .ZIP aqui'}
          </p>
          <p className="text-sm text-slate-400 mt-1">
            ou clique para navegar no seu computador
          </p>
        </div>

        <div className="mt-6 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium text-sm transition-all shadow-lg shadow-blue-600/25">
          <FolderArchive className="w-4 h-4" />
          <span>Selecionar Arquivo do Computador</span>
        </div>

        <div className="mt-6 flex flex-wrap justify-center items-center gap-4 text-xs text-slate-400">
          <span className="flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Leitura Local Segura</span>
          <span className="flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Suporte a Subpastas</span>
          <span className="flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Análise IA Gemini</span>
        </div>
      </div>

      {/* Preset Demos / Modelos para teste imediato */}
      <div className="mt-12 border-t border-slate-800/80 pt-8">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 text-center mb-4">
          Ainda não enviou seu arquivo? Teste com um projeto modelo:
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div
            onClick={(e) => { e.stopPropagation(); onLoadSample('react'); }}
            className="p-5 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-all cursor-pointer group flex items-start gap-4 hover:shadow-lg hover:shadow-cyan-950/20"
          >
            <div className="p-3 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 shrink-0">
              <FileCode2 className="w-6 h-6" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-slate-200 text-sm group-hover:text-cyan-400 transition-colors">
                  Projeto React & Vite (.ZIP)
                </h3>
                <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-cyan-400 group-hover:translate-x-1 transition-all" />
              </div>
              <p className="text-xs text-slate-400 mt-1 line-clamp-2">
                Contém componentes TypeScript, configurações de dependência, estilos Tailwind e ativos SVG.
              </p>
            </div>
          </div>

          <div
            onClick={(e) => { e.stopPropagation(); onLoadSample('docs'); }}
            className="p-5 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-all cursor-pointer group flex items-start gap-4 hover:shadow-lg hover:shadow-emerald-950/20"
          >
            <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0">
              <FileText className="w-6 h-6" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-slate-200 text-sm group-hover:text-emerald-400 transition-colors">
                  Pacote de Documentos e Relatórios
                </h3>
                <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-emerald-400 group-hover:translate-x-1 transition-all" />
              </div>
              <p className="text-xs text-slate-400 mt-1 line-clamp-2">
                Contém arquivos Markdown, tabelas CSV, relatórios executivos e termos de serviço.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
