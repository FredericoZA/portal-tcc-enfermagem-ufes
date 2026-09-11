import JSZip from 'jszip';
import { ZipItem, ZipStats } from '../types';

export function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

export function getFileExtension(filename: string): string {
  const parts = filename.split('.');
  if (parts.length <= 1) return '';
  return parts.pop()?.toLowerCase() || '';
}

export function isImageFile(ext: string): boolean {
  return ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'bmp', 'ico'].includes(ext.toLowerCase());
}

export function isTextFile(ext: string): boolean {
  return [
    'txt', 'md', 'js', 'ts', 'jsx', 'tsx', 'json', 'html', 'css', 'scss', 
    'py', 'java', 'c', 'cpp', 'cs', 'php', 'rb', 'go', 'rs', 'sql', 'xml', 
    'yaml', 'yml', 'env', 'sh', 'bat', 'csv', 'log', 'svg'
  ].includes(ext.toLowerCase());
}

export function isAudioFile(ext: string): boolean {
  return ['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac'].includes(ext.toLowerCase());
}

export function isVideoFile(ext: string): boolean {
  return ['mp4', 'webm', 'ogg', 'mov', 'avi', 'mkv'].includes(ext.toLowerCase());
}

export function isPdfFile(ext: string): boolean {
  return ext.toLowerCase() === 'pdf';
}

export async function parseZipFile(file: File | Blob): Promise<{ zip: JSZip; items: ZipItem[]; stats: ZipStats }> {
  const zip = new JSZip();
  const loadedZip = await zip.loadAsync(file);
  const items: ZipItem[] = [];

  let totalUncompressed = 0;
  let totalCompressed = 0;
  let totalFiles = 0;
  let totalFolders = 0;
  const fileTypesMap: { [ext: string]: number } = {};

  loadedZip.forEach((relativePath, zipObj) => {
    // Normalise path (strip trailing slash for dirs if needed for name parsing)
    const isDir = zipObj.dir;
    const cleanPath = relativePath.endsWith('/') ? relativePath.slice(0, -1) : relativePath;
    const parts = cleanPath.split('/');
    const name = parts[parts.length - 1] || cleanPath;
    const parentPath = parts.slice(0, -1).join('/');

    // JSZip _data or uncompressed size approximation
    // @ts-ignore
    const uncompSize = zipObj._data?.uncompressedSize || 0;
    // @ts-ignore
    const compSize = zipObj._data?.compressedSize || uncompSize;

    const ext = isDir ? '' : getFileExtension(name);

    if (isDir) {
      totalFolders++;
    } else {
      totalFiles++;
      totalUncompressed += uncompSize;
      totalCompressed += compSize;
      const key = ext ? ext.toUpperCase() : 'Outros';
      fileTypesMap[key] = (fileTypesMap[key] || 0) + 1;
    }

    items.push({
      path: relativePath,
      name: name,
      dir: isDir,
      size: uncompSize,
      compressedSize: compSize,
      date: zipObj.date,
      extension: ext,
      depth: parts.length - 1,
      parentPath: parentPath,
    });
  });

  const ratio = totalUncompressed > 0 
    ? Math.max(0, Math.round((1 - totalCompressed / totalUncompressed) * 100))
    : 0;

  const stats: ZipStats = {
    totalFiles,
    totalFolders,
    uncompressedSize: totalUncompressed,
    compressedSize: totalCompressed,
    compressionRatio: ratio,
    fileTypes: fileTypesMap,
  };

  return { zip: loadedZip, items, stats };
}

export async function downloadZipItem(zip: JSZip, path: string, filename: string): Promise<void> {
  const file = zip.file(path);
  if (!file) return;

  const blob = await file.async('blob');
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function generateSampleReactZip(): Promise<Blob> {
  const sampleZip = new JSZip();

  sampleZip.file('README.md', `# Projeto Exemplo - React & Vite

Este é um projeto de demonstração criado para testar a visualização e extração de arquivos ZIP.

## Estrutura
- \`src/\`: Código fonte principal.
- \`public/\`: Ativos estáticos e imagens.
- \`package.json\`: Dependências do projeto.
`);

  sampleZip.file('package.json', JSON.stringify({
    name: "exemplo-react-app",
    version: "1.0.0",
    scripts: {
      dev: "vite",
      build: "vite build"
    },
    dependencies: {
      react: "^18.2.0",
      "react-dom": "^18.2.0"
    }
  }, null, 2));

  const srcFolder = sampleZip.folder('src');
  srcFolder?.file('App.tsx', `import React from 'react';

export default function App() {
  return (
    <div className="p-8 bg-blue-50 min-h-screen text-gray-800">
      <h1 className="text-3xl font-bold">Olá do arquivo ZIP!</h1>
      <p className="mt-2 text-gray-600">Este arquivo foi lido e descomprimido em tempo real.</p>
    </div>
  );
}
`);

  srcFolder?.file('index.css', `@tailwind base;
@tailwind components;
@tailwind utilities;

body {
  font-family: sans-serif;
}
`);

  const assetsFolder = srcFolder?.folder('assets');
  assetsFolder?.file('config.json', JSON.stringify({
    theme: "light",
    features: ["extract", "preview", "repack", "ai-analysis"],
    createdDate: new Date().toISOString()
  }, null, 2));

  // Add SVG image sample
  assetsFolder?.file('logo.svg', `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
  <circle cx="50" cy="50" r="45" fill="#3b82f6" />
  <path d="M30 50 L45 65 L70 35" stroke="#ffffff" stroke-width="8" fill="none" stroke-linecap="round" stroke-linejoin="round" />
</svg>`);

  return await sampleZip.generateAsync({ type: 'blob' });
}

export async function generateSampleDocumentsZip(): Promise<Blob> {
  const zip = new JSZip();

  zip.file('Relatorio_Executivo.md', `# Relatório Anual 2026

## Resumo dos Resultados
- **Crescimento:** +34% em relação ao ano anterior.
- **Projetos Concluídos:** 42 entregas em produção.
- **Eficiência:** Redução de 25% nos tempos de compilação e deploy.

### Próximos Passos
1. Expansão das integrações via IA.
2. Otimização de segurança e criptografia de arquivos.
`);

  zip.file('Dados_Financeiros.csv', `Mês,Receita,Despesas,Lucro
Janeiro,150000,90000,60000
Fevereiro,175000,92000,83000
Março,190000,95000,95000
Abril,210000,98000,112000
Maio,230000,105000,125000
`);

  const docs = zip.folder('Documentos_Oficiais');
  docs?.file('Termos_Servico.txt', `TERMOS E CONDIÇÕES DE USO DO SISTEMA ZIP EXPLORER
1. Aceite dos Termos.
2. Privacidade e Proteção de Dados.
3. Licenciamento e Uso Autorizado.
`);

  return await zip.generateAsync({ type: 'blob' });
}
