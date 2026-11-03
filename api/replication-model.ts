import type { Request, Response } from 'express';
import JSZip from 'jszip';
import { getGoogleWorkspaceAccessToken } from '../server/integrations/googleWorkspace';

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const ZIP_MIME = 'application/zip';

const REPLICATION_MODELS = {
  convite: {
    fileId: '1zz6GJEiFfdo_9s4Nl2GBTtGh-MVetwiZ',
    fileName: 'modelo-convite-defesa.docx',
    nativeDocument: false,
  },
  ata: {
    fileId: '1fsllAgip66pjCNvufTkrKmKbi9B06L3q',
    fileName: 'modelo-ata-defesa.docx',
    nativeDocument: false,
  },
  termo: {
    fileId: '1zEFMRD6wqQA6G_igb6Xu4eA_efD-niWN7OqMOHw8nVU',
    fileName: 'modelo-termo-autorizacao.docx',
    nativeDocument: true,
  },
  declaracao: {
    fileId: '18C7hvz3nLniwmKTNyVT7RuHnZN8C72C76pC7uQ8h3II',
    fileName: 'modelo-declaracao-banca.docx',
    nativeDocument: true,
  },
} as const;

type ModelKey = keyof typeof REPLICATION_MODELS;
type DownloadKey = ModelKey | 'all';

function modelKey(value: unknown): DownloadKey | null {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'all') return 'all';
  return Object.prototype.hasOwnProperty.call(REPLICATION_MODELS, normalized)
    ? normalized as ModelKey
    : null;
}

export async function exportReplicationModel(key: ModelKey, accessToken: string) {
  const model = REPLICATION_MODELS[key];
  const url = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(model.fileId)}${model.nativeDocument?`/export?mimeType=${encodeURIComponent(DOCX_MIME)}`:"?alt=media"}`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(20_000),
  });

  if (!response.ok) {
    console.error('[Replicação] Google Drive recusou a exportação de um modelo.', { status: response.status });
    throw new Error('Falha ao exportar um dos modelos de replicação.');
  }

  const content = Buffer.from(await response.arrayBuffer());
  if (!content.length || content.length > 16 * 1024 * 1024) {
    throw new Error('Um dos modelos retornados pelo Google Drive é inválido.');
  }
  const archive=await JSZip.loadAsync(content);
  if(!archive.file('word/document.xml'))throw new Error('O modelo recebido não é um documento Word válido.');
  return { ...model, content };
}

export default async function handler(req: Request, res: Response) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Método não permitido.' });
  }

  const key = modelKey(req.params?.slug || req.query?.slug);
  if (!key) return res.status(404).json({ error: 'Modelo não localizado.' });

  try {
    const accessToken = await getGoogleWorkspaceAccessToken();

    if (key === 'all') {
      const zip = new JSZip();
      const entries = await Promise.all(
        (Object.keys(REPLICATION_MODELS) as ModelKey[]).map((model) => exportReplicationModel(model, accessToken)),
      );
      entries.forEach((entry) => zip.file(entry.fileName, entry.content));
      const content = await zip.generateAsync({
        type: 'nodebuffer',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 },
      });
      if (!content.length || content.length > 64 * 1024 * 1024) {
        return res.status(502).json({ error: 'O pacote de modelos gerado é inválido.' });
      }
      const fileName = 'modelos-portal-tcc.zip';
      res.setHeader('Content-Type', ZIP_MIME);
      res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`);
      res.setHeader('Content-Length', String(content.length));
      return res.status(200).send(content);
    }

    const model = await exportReplicationModel(key, accessToken);
    res.setHeader('Content-Type', DOCX_MIME);
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(model.fileName)}`);
    res.setHeader('Content-Length', String(model.content.length));
    return res.status(200).send(model.content);
  } catch (error) {
    console.error('[Replicação] Falha ao preparar modelo público.', error instanceof Error ? { name: error.name } : undefined);
    return res.status(502).json({ error: 'Não foi possível preparar os modelos para download.' });
  }
}
