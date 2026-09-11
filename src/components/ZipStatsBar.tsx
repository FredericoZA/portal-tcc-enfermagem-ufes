import React from 'react';
import { ZipStats } from '../types';
import { formatBytes } from '../utils/zipHelpers';
import { FileText, Folder, HardDrive, Zap, PieChart } from 'lucide-react';

interface ZipStatsBarProps {
  stats: ZipStats;
}

export const ZipStatsBar: React.FC<ZipStatsBarProps> = ({ stats }) => {
  const fileTypeEntries = (Object.entries(stats.fileTypes) as [string, number][]).sort((a, b) => b[1] - a[1]);

  return (
    <div className="bg-slate-900 border-b border-slate-800 p-4 text-xs">
      <div className="max-w-7xl mx-auto grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Total Files & Folders */}
        <div className="p-3 rounded-xl bg-slate-800/60 border border-slate-700/60 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400">
            <FileText className="w-4 h-4" />
          </div>
          <div>
            <p className="text-slate-400 font-medium">Arquivos e Pastas</p>
            <p className="font-semibold text-slate-100 text-sm">
              {stats.totalFiles} {stats.totalFiles === 1 ? 'arquivo' : 'arquivos'}, {stats.totalFolders} {stats.totalFolders === 1 ? 'pasta' : 'pastas'}
            </p>
          </div>
        </div>

        {/* Uncompressed Size */}
        <div className="p-3 rounded-xl bg-slate-800/60 border border-slate-700/60 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
            <HardDrive className="w-4 h-4" />
          </div>
          <div>
            <p className="text-slate-400 font-medium">Tamanho Descomprimido</p>
            <p className="font-semibold text-slate-100 text-sm">
              {formatBytes(stats.uncompressedSize)}
            </p>
          </div>
        </div>

        {/* Compressed Size */}
        <div className="p-3 rounded-xl bg-slate-800/60 border border-slate-700/60 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400">
            <Folder className="w-4 h-4" />
          </div>
          <div>
            <p className="text-slate-400 font-medium">Tamanho Compactado</p>
            <p className="font-semibold text-slate-100 text-sm">
              {formatBytes(stats.compressedSize)}
            </p>
          </div>
        </div>

        {/* Compression Savings */}
        <div className="p-3 rounded-xl bg-slate-800/60 border border-slate-700/60 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400">
            <Zap className="w-4 h-4" />
          </div>
          <div>
            <p className="text-slate-400 font-medium">Taxa de Compressão</p>
            <p className="font-semibold text-purple-300 text-sm">
              {stats.compressionRatio}% de economia
            </p>
          </div>
        </div>
      </div>

      {/* File Extensions Breakdown */}
      {fileTypeEntries.length > 0 && (
        <div className="max-w-7xl mx-auto mt-3 pt-3 border-t border-slate-800/80 flex items-center flex-wrap gap-2">
          <span className="text-slate-400 text-xs font-medium flex items-center gap-1 mr-1">
            <PieChart className="w-3.5 h-3.5 text-slate-400" />
            Tipos de Arquivo:
          </span>
          {fileTypeEntries.slice(0, 8).map(([ext, count]) => (
            <span
              key={ext}
              className="px-2 py-0.5 rounded-md bg-slate-800 border border-slate-700 text-slate-300 text-xs font-mono flex items-center gap-1"
            >
              <span className="font-semibold text-blue-400">.{ext}</span>
              <span className="text-slate-400">({count})</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
};
