export * from './types/index';

export interface ZipItem {
  path: string;
  name: string;
  dir: boolean;
  size: number; // uncompressed size
  compressedSize: number;
  date?: Date;
  extension: string;
  depth: number;
  parentPath: string;
}

export interface ZipStats {
  totalFiles: number;
  totalFolders: number;
  uncompressedSize: number;
  compressedSize: number;
  compressionRatio: number;
  fileTypes: { [ext: string]: number };
}

export interface Breadcrumb {
  name: string;
  path: string;
}

export type ViewMode = 'tree' | 'grid' | 'details';

export interface SampleZipOption {
  id: string;
  title: string;
  description: string;
  iconName: string;
  fileCount: number;
  generator: () => Promise<Blob>;
}

export interface AIAnalysisResponse {
  text?: string;
  error?: string;
  loading?: boolean;
}

